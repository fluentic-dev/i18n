import { compileCatalog } from '@fluentic/i18n-compiler';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type ExtractStats, extractWithCache } from './cache';
import { getConfigEnv, type I18nConfig, prepareConfig } from './config';
import { resolveConverter } from './converters';
import { displayPath } from './display-path';
import { contextualError, errorMessage } from './errors';
import type { Reporter } from './events';
import { noSymlinks } from './exchange-paths';
import { hashText } from './hash';
import { getPaths, readMeta, readRecords, recordId, writeJson, writeMeta, writeRecords } from './store';
import type {
  DefinedTranslator,
  ExchangeOptions,
  MessageRecord,
  TranslationItem,
  TranslationRecord,
  Translator,
} from './types';

export async function extract(config: I18nConfig, report?: Reporter): Promise<MessageRecord[]> {
  const prepared = (await import('./config')).prepareConfig(config);
  report?.({ type: 'phase:start', phase: 'extract' });
  report?.({
    type: 'info',
    message: `Source: ${displayPath(prepared.root)}\nCatalogs: ${displayPath(getPaths(prepared).translations)}`,
  });
  const started = Date.now();
  let stats!: ExtractStats;
  const messages = await extractWithCache(prepared, (file) => report?.({ type: 'file:processed', file }), (value) => {
    stats = value;
  });
  await syncTranslationFiles(prepared, messages);
  if (!stats.files) {
    report?.({
      type: 'warning',
      message: `No source files matched in ${
        JSON.stringify(displayPath(prepared.root))
      }. Check files.includes and files.excludes in your config.`,
    });
  } else if (!messages.length) {
    report?.({
      type: 'warning',
      message: 'No translatable messages found. Check your source files and @fluentic/i18n imports.',
    });
  }
  report?.({
    type: 'phase:end',
    phase: 'extract',
    details: {
      Files: `${stats.files} matched · ${stats.cached} cached · ${stats.parsed} parsed`,
      Skipped: `${stats.skipped} ${
        stats.skipped === 1 ? 'file' : 'files'
      } with no translatable messages · ${stats.removed} removed`,
      Messages: `${messages.length} unique · ${prepared.languages.targets.length} target ${
        prepared.languages.targets.length === 1 ? 'language' : 'languages'
      }`,
    },
    summary: `${stats.files} files matched; ${stats.cached} cached, ${stats.parsed} parsed, ${stats.skipped} ${
      stats.skipped === 1 ? 'file' : 'files'
    } with no translatable messages, ${stats.removed} removed. ${messages.length} unique messages; ${prepared.languages.targets.length} target languages. ${
      Date.now() - started
    } ms.`,
  });
  return messages;
}

function getCatalogFormats(formats: I18nConfig['catalogFormat']) {
  const selected = formats === undefined ? ['jsonl'] : Array.isArray(formats) ? formats : [formats];
  const supported = ['jsonl', 'json', 'cjs', 'mjs'];

  if (selected.length === 0 || selected.some((format) => !supported.includes(format))) {
    throw new Error('[i18n] catalogFormat must contain at least one supported format');
  }

  return selected;
}

export async function merge(config: I18nConfig, report?: Reporter): Promise<void> {
  const prepared = (await import('./config')).prepareConfig(config);
  const formats = getCatalogFormats(prepared.catalogFormat);
  report?.({ type: 'phase:start', phase: 'merge' });
  const hashes: Record<string, number> = {};
  const messages = await readMessages(prepared);
  if (!messages.length) {
    report?.({
      type: 'warning',
      message:
        'No source messages in the catalog. Run fluentic-i18n extract first, and check your file patterns if it finds none.',
    });
  }

  // Check every authoring layer before writing any output.
  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    await readRecords(paths.auto, messages);
    await readRecords(paths.manual, messages);
  }

  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    const merged = await readableMerged(prepared, languageId, messages);
    const ordered = [...merged].sort((a, b) =>
      (a.context ?? '').localeCompare(b.context ?? '') || a.source.localeCompare(b.source)
    );
    const rows = prepared.compiled
      ? [
        { compiled: true },
        ...compileCatalog(ordered, {
          hashLength: typeof prepared.compiled === 'object' ? prepared.compiled.hashLength : undefined,
        }),
      ]
      : ordered.filter((item) => item.translation !== '').map((item) =>
        item.context ? [item.context, item.source, item.translation] : [item.source, item.translation]
      );
    const allFormats = ['jsonl', 'json', 'cjs', 'mjs'] as const;

    for (const format of allFormats) {
      const file = paths.merged!.replace(/\.jsonl$/, `.${format}`);

      if (!formats.includes(format)) {
        await rm(file, { force: true });
        continue;
      }

      const lines = rows.map((row) => JSON.stringify(row));
      const content = format === 'jsonl'
        ? lines.join('\n') + (lines.length ? '\n' : '')
        : format === 'json'
        ? `[\n${lines.map((line) => `  ${line},\n`).join('')}  null\n]\n`
        : `${format === 'cjs' ? 'module.exports = ' : 'export default '}[\n${
          lines.map((line) => `  ${line},\n`).join('')
        }];\n`;

      await writeFile(file, content);
    }
    await rm(paths.merged! + '.meta.json', { force: true });
    // Hash the runtime rows rather than the authoring records. Compiler options can
    // change the emitted catalog even when every translation remains unchanged.
    hashes[languageId] = hashText(rows.map((row) => JSON.stringify(row)).join('\n'));
    const translatedCount = merged.filter((item) => item.translation).length;
    report?.({
      type: 'info',
      details: {
        [languageId]: `${translatedCount}/${messages.length} translated · ${messages.length - translatedCount} missing`,
      },
      message: `${languageId}: ${translatedCount}/${messages.length} translated; ${
        messages.length - translatedCount
      } missing.`,
    });
  }
  if (prepared.hashes !== false) await writeJson(getPaths(prepared).hash, hashes);
  report?.({
    type: 'phase:end',
    phase: 'merge',
    details: {
      Files: `${prepared.languages.targets.length * formats.length} written`,
      Formats: formats.join(', '),
      Catalogs: displayPath(getPaths(prepared).translations),
    },
    summary: `${prepared.languages.targets.length * formats.length} catalog files (${formats.join(', ')}) in ${
      displayPath(getPaths(prepared).translations)
    }.`,
  });
}

/** Rebuild generated catalogs after authoring conflicts have been resolved. */
export async function conflict(config: I18nConfig, report?: Reporter): Promise<void> {
  report?.({ type: 'phase:start', phase: 'conflict' });
  report?.({
    type: 'info',
    message: 'Rebuilding catalogs from resolved authoring files. Unresolved conflict markers will stop the command.',
  });
  await merge(config, report);
  report?.({
    type: 'phase:end',
    phase: 'conflict',
    details: { Status: 'Catalogs rebuilt from resolved authoring files' },
  });
}

export async function translateAuto(config: I18nConfig, report?: Reporter): Promise<void> {
  await translate(config, report, true);
}

async function translate(config: I18nConfig, report: Reporter | undefined, suggestMerge: boolean): Promise<void> {
  const prepared = (await import('./config')).prepareConfig(config);
  report?.({ type: 'phase:start', phase: 'translate' });
  if (!config.translator || (Array.isArray(config.translator) && !config.translator.length)) {
    report?.({
      type: 'phase:end',
      phase: 'translate',
      summary: 'Skipped; no translator configured.',
      details: {
        Status: 'Skipped; no translator configured',
        Next: 'Set translator in your config, or continue with manual translations',
      },
    });
    return;
  }
  let totalTranslated = 0;
  let totalMissing = 0;
  const source = await readMessages(prepared);
  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    const manual = await readRecords(paths.manual, source);
    const auto = await readRecords(paths.auto, source);
    const existing = new Set([...manual, ...auto].filter((item) => item.translation).map((item) => item.id));
    const items = source.filter((item) => !existing.has(item.id));
    if (!items.length) {
      report?.({
        type: 'info',
        message: `${languageId}: ${
          source.length ? 'up to date; no missing translations.' : 'no source messages. Run extract first.'
        }`,
      });
      continue;
    }
    const request = {
      sourceLanguageId: prepared.languages.source,
      targetLanguageId: languageId,
      items,
      env: getConfigEnv(config),
    };
    let translator: DefinedTranslator | null;
    try {
      translator = await selectTranslator(config.translator, request);
    } catch (error) {
      throw contextualError(`Translator support check failed for ${prepared.languages.source} -> ${languageId}`, error);
    }
    if (!translator) {
      report?.({
        type: 'warning',
        message:
          `No configured translator supports ${prepared.languages.source} -> ${languageId}. ${items.length} messages remain untranslated. Configure a fallback provider or translate them manually.`,
      });
      totalMissing += items.length;
      continue;
    }
    report?.({
      type: 'info',
      message: `${languageId}: translating ${items.length} ${
        items.length === 1 ? 'message' : 'messages'
      } (${prepared.languages.source} -> ${languageId})`,
    });
    const split = translator.tag ? null : splitTaggedItems(items);
    const requestItems: TranslationItem[] = split?.items ?? items;
    const chunks = split?.chunks ?? new Map<string, TagChunk[]>();
    const results = [];
    for (const batch of chunk(requestItems, translator.batch)) {
      try {
        const result = await translator.translate({
          sourceLanguageId: prepared.languages.source,
          targetLanguageId: languageId,
          items: batch,
          env: request.env,
        });
        if (
          !Array.isArray(result) ||
          result.some((item) => !item || typeof item.id !== 'string' || typeof item.translation !== 'string')
        ) {
          throw new Error(
            'Invalid translator response. Return an array of { id, translation } objects with string values.',
          );
        }
        results.push(...result);
      } catch (error) {
        throw contextualError(`Translation failed for ${prepared.languages.source} -> ${languageId}`, error, {
          Step: 'translate',
          Languages: `${prepared.languages.source} -> ${languageId}`,
        });
      }
    }
    const translations = translator.tag
      ? new Map(results.map((result) => [result.id, result.translation]))
      : combineTaggedResults(results, chunks);
    const translated = items.map((sourceItem) => {
      const translation = translations.get(sourceItem.id);
      return translation ? { ...sourceItem, translation, origin: 'auto' as const } : null;
    }).filter(Boolean) as TranslationRecord[];
    const translatedIds = new Set(translated.map((item) => item.id));
    await writeRecords(paths.auto!, [
      ...auto.filter((item) => !translatedIds.has(item.id)),
      ...translated,
    ]);
    totalTranslated += translated.length;
    totalMissing += items.length - translated.length;
    report?.({
      type: 'info',
      details: { [languageId]: `${translated.length} translated · ${items.length - translated.length} missing` },
      message: `${languageId}: ${translated.length} translated; ${items.length - translated.length} still missing.`,
    });
    for (const item of translated) report?.({ type: 'message:translated', id: item.id, languageId });
  }
  report?.({
    type: 'phase:end',
    phase: 'translate',
    details: {
      Translated: String(totalTranslated),
      Missing: String(totalMissing),
      ...(totalTranslated && suggestMerge ? { Next: 'fluentic-i18n merge' } : {}),
    },
    summary: `${totalTranslated} messages translated; ${totalMissing} still missing.${
      totalTranslated && suggestMerge ? ' Run fluentic-i18n merge to rebuild runtime catalogs.' : ''
    }`,
  });
}

async function selectTranslator(
  configured: Translator | Translator[],
  request: Parameters<NonNullable<DefinedTranslator['support']>>[0],
): Promise<DefinedTranslator | null> {
  const translators = (Array.isArray(configured) ? configured : [configured]).map(normalizeTranslator);
  for (const translator of translators) {
    const supported = translator.support ? await translator.support(request) : true;
    if (typeof supported !== 'boolean') {
      throw new Error('Translator support must return a boolean. Check the support callback.');
    }
    if (supported) return translator;
  }
  return null;
}

function normalizeTranslator(translator: Translator): DefinedTranslator {
  return typeof translator === 'function'
    ? { translate: translator, batch: 50, tag: false }
    : { ...translator, batch: translator.batch ?? 50, tag: translator.tag ?? false };
}

function chunk<T>(items: T[], batch: number | false): T[][] {
  const size = batch === false ? 1 : batch;
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

type TagChunk = { item: TranslationItem; textIndex: number; };

function splitTaggedItems(items: MessageRecord[]): { items: TranslationItem[]; chunks: Map<string, TagChunk[]>; } {
  const translatedItems: TranslationItem[] = [];
  const chunks = new Map<string, TagChunk[]>();
  for (const item of items) {
    const parts = splitTagParts(item.source);
    const textParts = parts.filter((part): part is { type: 'text'; value: string; } =>
      part.type === 'text' && part.value.trim().length > 0
    );
    const hasTag = parts.some((part) => part.type === 'tag');
    if (!hasTag || textParts.length === 0) {
      translatedItems.push(item);
      continue;
    }
    const itemChunks: TagChunk[] = [];
    for (const [chunkIndex, part] of textParts.entries()) {
      const chunkItem: TranslationItem = {
        ...item,
        id: item.id + '#chunk-' + chunkIndex,
        source: part.value,
        originalSource: item.source,
        originalId: item.id,
        chunkIndex,
        chunkCount: textParts.length,
      };
      translatedItems.push(chunkItem);
      itemChunks.push({ item: chunkItem, textIndex: parts.indexOf(part) });
    }
    chunks.set(item.id, itemChunks);
  }
  return { items: translatedItems, chunks };
}

function combineTaggedResults(
  results: Array<{ id: string; translation: string; }>,
  chunks: Map<string, TagChunk[]>,
): Map<string, string> {
  const byId = new Map(results.map((result) => [result.id, result.translation]));
  const combined = new Map<string, string>();
  for (const [originalId, itemChunks] of chunks) {
    const first = itemChunks[0]?.item;
    if (!first?.originalSource) continue;
    const parts = splitTagParts(first.originalSource);
    const translations = itemChunks.map((chunk) => byId.get(chunk.item.id));
    if (translations.some((translation) => translation === undefined)) continue;
    let textIndex = 0;
    combined.set(
      originalId,
      parts.map((part) =>
        part.type === 'tag' ? part.value : (part.value.trim().length ? translations[textIndex++] : part.value)
      ).join(''),
    );
  }
  for (const [id, translation] of byId) if (!id.includes('#chunk-')) combined.set(id, translation);
  return combined;
}

function splitTagParts(source: string): Array<{ type: 'tag' | 'text'; value: string; }> {
  return source.split(/(<\/?[A-Za-z][\w.-]*(?:\s[^>]*)?>)/g).filter(Boolean).map((value) => ({
    type: /^<\/?[A-Za-z]/.test(value) ? 'tag' : 'text',
    value,
  }));
}

export async function update(config: I18nConfig, report?: Reporter): Promise<void> {
  report?.({ type: 'phase:start', phase: 'update' });
  await extract(config, report);
  await translate(config, report, false);
  await merge(config, report);
  report?.({
    type: 'phase:end',
    phase: 'update',
    details: { Status: 'Extraction, translation, and catalog merge completed' },
    summary: 'Extraction, automatic translation, and catalog merge completed. Review any warnings above.',
  });
}

function exchangeRoot(config: I18nConfig, name: string, options: ExchangeOptions, report?: Reporter): string {
  const root = path.resolve(options.directory ?? path.join(getPaths(prepareConfig(config)).exports, name));
  report?.({
    type: 'info',
    message: `Exchange folder: ${displayPath(root)}${options.directory === undefined ? ' (default)' : ''}`,
    details: { Exchange: `${displayPath(root)}${options.directory === undefined ? ' (default)' : ''}` },
  });
  return root;
}

function checkExchangeLanguages(languages: string[]): void {
  const seen = new Set<string>();
  for (const language of languages) {
    if (!/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(language) || seen.has(language.toLowerCase())) {
      throw new Error(`Unsafe or duplicate target locale: ${JSON.stringify(language)}`);
    }
    seen.add(language.toLowerCase());
  }
}

export async function exportTranslations(
  config: I18nConfig,
  converterName: string,
  report?: Reporter,
  options: ExchangeOptions = {},
): Promise<void> {
  const prepared = prepareConfig(config);
  const handler = resolveConverter(config, converterName);
  checkExchangeLanguages(prepared.languages.targets);
  report?.({ type: 'phase:start', phase: 'export' });
  report?.({ type: 'info', message: `Converter: ${converterName}` });
  const root = exchangeRoot(config, converterName, options, report);
  await noSymlinks(root, root);
  if (handler.kind === 'folder') {
    await handler.export(config, { directory: root }, report);
    report?.({
      type: 'phase:end',
      phase: 'export',
      details: { Status: 'Export complete' },
      summary: `${converterName} written to ${displayPath(root)}.`,
    });
    return;
  }
  const converter = handler.converter;
  if (!converter.export) {
    throw new Error(
      `Converter "${converterName}" does not provide an export function. Add export to this converter in config.convert, or choose another format.`,
    );
  }
  const { mkdir, writeFile } = await import('node:fs/promises');
  const pending: Array<{ target: string; content: string | Uint8Array; }> = [];
  const seen = new Set<string>();
  for (const languageId of prepared.languages.targets) {
    const records = await readableMerged(prepared, languageId);
    const exportRoot = path.join(root, languageId);
    let result;
    try {
      result = await converter.export({ sourceLanguageId: prepared.languages.source, languageId, items: records });
      if (
        !result || !Array.isArray(result.files) || result.files.some((file) =>
          !file || typeof file.path !== 'string' ||
          !(typeof file.content === 'string' || file.content instanceof Uint8Array)
        )
      ) {
        throw new Error('Invalid converter response. Return { files: [{ path, content }] } with text or byte content.');
      }
    } catch (error) {
      throw contextualError(`Converter "${converterName}" export failed for ${languageId}`, error);
    }
    report?.({
      type: 'info',
      details: {
        [languageId]: `${records.length} ${records.length === 1 ? 'message' : 'messages'} · ${result.files.length} ${
          result.files.length === 1 ? 'file' : 'files'
        } prepared`,
      },
      message: `${languageId}: ${records.length} messages; ${result.files.length} export files.`,
    });
    for (const file of result.files) {
      const target = path.resolve(exportRoot, file.path);
      if (!target.startsWith(`${exportRoot}${path.sep}`) || seen.has(target)) {
        throw new Error(`Converter returned an invalid or duplicate path: ${file.path}`);
      }
      seen.add(target);
      await noSymlinks(target, root);
      pending.push({ target, content: file.content });
    }
  }
  for (const { target, content } of pending) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    report?.({ type: 'file:processed', file: target });
  }
  report?.({
    type: 'phase:end',
    phase: 'export',
    details: { Files: `${pending.length} written`, Languages: String(prepared.languages.targets.length) },
    summary: `${pending.length} files written to ${displayPath(root)} (${converterName}).`,
  });
}

export async function importTranslations(
  config: I18nConfig,
  converterName: string,
  report?: Reporter,
  options: ExchangeOptions = {},
): Promise<void> {
  const prepared = prepareConfig(config);
  const handler = resolveConverter(config, converterName);
  checkExchangeLanguages(prepared.languages.targets);
  report?.({ type: 'phase:start', phase: 'import' });
  report?.({ type: 'info', message: `Converter: ${converterName}` });
  const root = exchangeRoot(config, converterName, options, report);
  await noSymlinks(root, root);
  if (handler.kind === 'folder') {
    let filesUpdated = 0;
    await handler.import(config, { directory: root }, (event) => {
      if (event.type === 'file:processed') filesUpdated++;
      report?.(event);
    });
    report?.({
      type: 'phase:end',
      phase: 'import',
      details: filesUpdated ? { Next: 'fluentic-i18n merge' } : {},
      summary: `${converterName} imported from ${displayPath(root)}.`,
    });
  } else {
    const converter = handler.converter;
    if (!converter.import) {
      throw new Error(
        `Converter "${converterName}" does not provide an import function. Add import to this converter in config.convert, or choose another format.`,
      );
    }
    const { readFile, readdir } = await import('node:fs/promises');
    const messages = await readMessages(prepared);
    const sourceById = new Map(messages.map((item) => [item.id, item]));
    let importedCount = 0;
    const pending: Array<{ file: string; records: TranslationRecord[]; }> = [];
    for (const languageId of prepared.languages.targets) {
      const exportRoot = path.join(root, languageId);
      const files = await collectFiles(exportRoot, readdir);
      if (!files.length && !handler.builtin) {
        report?.({
          type: 'warning',
          message: `${languageId}: no files found in ${
            displayPath(exportRoot)
          }; skipped. Check --input or run export first.`,
        });
        continue;
      }
      let imported: TranslationRecord[];
      try {
        imported = await converter.import({
          sourceLanguageId: prepared.languages.source,
          languageId,
          files: await Promise.all(
            files.map(async (file) => ({ path: path.relative(exportRoot, file), content: await readFile(file) })),
          ),
        });
        if (!Array.isArray(imported)) {
          throw new Error(
            'Invalid converter response. The import callback must return an array of translation records.',
          );
        }
      } catch (error) {
        throw new Error(
          `Converter "${converterName}" import failed for ${languageId} (${displayPath(exportRoot)}): ${
            errorMessage(error)
          }. No translations were changed.`,
        );
      }
      const manualPath = getPaths(prepared, languageId).manual!;
      await noSymlinks(manualPath, getPaths(prepared).translations);
      const byId = new Map((await readRecords(manualPath, messages)).map((item) => [item.id, item]));
      const seen = new Set<string>();
      for (const item of imported) {
        if (
          !item || typeof item.source !== 'string' || typeof item.translation !== 'string' ||
          !(item.context === null || typeof item.context === 'string')
        ) {
          throw new Error(`${displayPath(exportRoot)}: invalid translation record. No translations were changed.`);
        }
        const id = recordId(item.context, item.source);
        const source = sourceById.get(id);
        if (!source || seen.has(id)) {
          throw new Error(
            `${displayPath(exportRoot)}: ${seen.has(id) ? 'duplicate' : 'unknown'} source/context: ${
              JSON.stringify([item.context, item.source])
            }. No translations were changed.`,
          );
        }
        seen.add(id);
        byId.set(id, { ...source, translation: item.translation, origin: 'imported' });
      }
      importedCount += imported.length;
      report?.({
        type: 'info',
        details: {
          [languageId]: `${imported.length} validated · ${files.length} ${files.length === 1 ? 'file' : 'files'}`,
        },
        message: `${languageId}: ${imported.length} translations validated from ${files.length} files.`,
      });
      pending.push({ file: manualPath, records: [...byId.values()] });
    }
    // Parse and validate every locale before changing any authoring layer.
    for (const { file, records } of pending) {
      await writeRecords(file, records);
      report?.({ type: 'file:processed', file });
    }
    report?.({
      type: 'phase:end',
      phase: 'import',
      details: {
        Imported: String(importedCount),
        Files: `${pending.length} updated`,
        ...(pending.length ? { Next: 'fluentic-i18n merge' } : { Status: 'No files imported' }),
      },
      summary: `${importedCount} translations imported; ${pending.length} language files updated.`,
    });
  }
}

async function collectFiles(directory: string, readdir: typeof import('node:fs/promises').readdir): Promise<string[]> {
  await noSymlinks(directory, directory);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${displayPath(file)}`);
    if (entry.isDirectory()) files.push(...await collectFiles(file, readdir));
    else if (entry.isFile()) files.push(file);
    else throw new Error(`Unsupported exchange file: ${displayPath(file)}`);
  }
  return files;
}

function mergeLayer(
  source: MessageRecord[],
  old: TranslationRecord[],
  origin: TranslationRecord['origin'],
): TranslationRecord[] {
  const previousById = new Map(old.map((item) => [item.id, item]));
  return source.map((item) => {
    const previous = previousById.get(item.id);
    return { ...item, translation: previous?.translation ?? '', origin };
  });
}

async function readableMerged(
  config: ReturnType<typeof import('./config').prepareConfig>,
  languageId: string,
  messages?: MessageRecord[],
): Promise<TranslationRecord[]> {
  messages ??= await readMessages(config);
  const paths = getPaths(config, languageId);
  const autoRecords = await readRecords(paths.auto, messages);
  const manualRecords = await readRecords(paths.manual, messages);
  const auto = new Map(autoRecords.map((item) => [item.id, item]));
  const manual = new Map(manualRecords.map((item) => [item.id, item]));
  return messages.map((item) => ({
    ...item,
    translation: manual.get(item.id)?.translation || auto.get(item.id)?.translation || '',
    origin: manual.get(item.id)?.translation ? 'manual' : 'auto',
  }));
}

async function syncTranslationFiles(
  config: ReturnType<typeof import('./config').prepareConfig>,
  source: MessageRecord[],
): Promise<void> {
  const previousMessages = await readMeta(getPaths(config).meta);
  const layers = await Promise.all(config.languages.targets.map(async (languageId) => {
    const paths = getPaths(config, languageId);
    return {
      paths,
      auto: await readRecords(paths.auto, previousMessages),
      manual: await readRecords(paths.manual, previousMessages),
    };
  }));

  for (const { paths, auto, manual } of layers) {
    await writeRecords(paths.auto!, mergeLayer(source, auto, 'auto'));
    await writeRecords(paths.manual!, mergeLayer(source, manual, 'manual'));
  }
  await writeMeta(getPaths(config).meta, source);
}

async function readMessages(
  config: ReturnType<typeof import('./config').prepareConfig>,
): Promise<MessageRecord[]> {
  return readMeta(getPaths(config).meta);
}
