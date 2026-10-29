import { compileCatalog } from '@fluentic/i18n/compiler';
import { glob } from 'fast-glob';
import { rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getConfigEnv, type I18nConfig } from './config';
import type { Reporter } from './events';
import { extractMessages } from './extract';
import { createTranslationHash } from './hash';
import { getPaths, readExtracted, readRecords, writeJson, writeRecords } from './store';
import type { DefinedTranslator, MessageRecord, TranslationItem, TranslationRecord, Translator } from './types';

export async function extract(config: I18nConfig, report?: Reporter): Promise<MessageRecord[]> {
  const prepared = (await import('./config')).prepareConfig(config);
  const root = path.resolve(prepared.root);
  const files = await glob(prepared.files?.includes ?? ['**/*.{ts,tsx,js,jsx}'], {
    cwd: root,
    ignore: ['node_modules/**', ...(prepared.files?.excludes ?? [])],
  });
  const all: MessageRecord[] = [];
  report?.({ type: 'phase:start', phase: 'extract' });
  for (const file of files) {
    const messages = extractMessages(await readFile(path.join(root, file), 'utf8'), file);
    all.push(...messages);
    report?.({ type: 'file:processed', file });
  }
  const unique = [...new Map(all.map((item) => [item.id, item])).values()];
  await writeJson(getPaths(prepared).extracted, unique);
  report?.({ type: 'phase:end', phase: 'extract' });
  return unique;
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
  const source = await readExtracted(getPaths(prepared).extracted);
  report?.({ type: 'phase:start', phase: 'merge' });
  const hashes: Record<string, number> = {};

  // Check every authoring layer before writing any output.
  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    await readRecords(paths.auto);
    await readRecords(paths.manual);
  }

  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    const oldAuto = await readRecords(paths.auto);
    const oldManual = await readRecords(paths.manual);
    const auto = mergeLayer(source, oldAuto, 'auto');
    const manual = mergeLayer(source, oldManual, 'manual');
    const merged = source.map((item) => {
      const manualItem = manual.find((candidate) => candidate.id === item.id);
      const autoItem = auto.find((candidate) => candidate.id === item.id);
      return {
        ...item,
        translation: manualItem?.translation || autoItem?.translation || '',
        origin: manualItem?.translation ? 'manual' : 'auto',
      } as TranslationRecord;
    });
    await writeRecords(paths.auto!, auto);
    await writeRecords(paths.manual!, manual);
    const ordered = [...merged].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const rows = prepared.compiled
      ? [{ compiled: true }, ...compileCatalog(ordered)]
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
    hashes[languageId] = (await import('./hash')).hashTranslations(merged);
  }
  if (prepared.hashes !== false) await writeJson(getPaths(prepared).hash, hashes);
  report?.({ type: 'phase:end', phase: 'merge' });
}

/** Rebuild generated catalogs after authoring conflicts have been resolved. */
export async function conflict(config: I18nConfig, report?: Reporter): Promise<void> {
  const prepared = (await import('./config')).prepareConfig(config);
  getCatalogFormats(prepared.catalogFormat);

  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    await readRecords(paths.auto);
    await readRecords(paths.manual);
  }

  await extract(config, report);
  await merge(config, report);
}

export async function translateAuto(config: I18nConfig, report?: Reporter): Promise<void> {
  if (!config.translator) return;
  const prepared = (await import('./config')).prepareConfig(config);
  const source = await readExtracted(getPaths(prepared).extracted);
  report?.({ type: 'phase:start', phase: 'translate' });
  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    const manual = await readRecords(paths.manual);
    const auto = await readRecords(paths.auto);
    const existing = new Set([...manual, ...auto].filter((item) => item.translation).map((item) => item.id));
    const items = source.filter((item) => !existing.has(item.id));
    if (!items.length) continue;
    const request = {
      sourceLanguageId: prepared.languages.source,
      targetLanguageId: languageId,
      items,
      env: getConfigEnv(config),
    };
    const translator = await selectTranslator(config.translator, request);
    if (!translator) {
      report?.({
        type: 'warning',
        message: `No configured translator supports ${prepared.languages.source} -> ${languageId}`,
      });
      continue;
    }
    const split = translator.tag ? null : splitTaggedItems(items);
    const requestItems: TranslationItem[] = split?.items ?? items;
    const chunks = split?.chunks ?? new Map<string, TagChunk[]>();
    const results = [];
    for (const batch of chunk(requestItems, translator.batch)) {
      results.push(
        ...await translator.translate({
          sourceLanguageId: prepared.languages.source,
          targetLanguageId: languageId,
          items: batch,
          env: request.env,
        }),
      );
    }
    const translations = translator.tag
      ? new Map(results.map((result) => [result.id, result.translation]))
      : combineTaggedResults(results, chunks);
    const translated = items.map((sourceItem) => {
      const translation = translations.get(sourceItem.id);
      return translation ? { ...sourceItem, translation, origin: 'auto' as const } : null;
    }).filter(Boolean) as TranslationRecord[];
    await writeRecords(paths.auto!, [
      ...auto.filter((item) => !translated.some((next) => next.id === item.id)),
      ...translated,
    ]);
    for (const item of translated) report?.({ type: 'message:translated', id: item.id, languageId });
  }
  report?.({ type: 'phase:end', phase: 'translate' });
}

async function selectTranslator(
  configured: Translator | Translator[],
  request: Parameters<NonNullable<DefinedTranslator['support']>>[0],
): Promise<DefinedTranslator | null> {
  const translators = (Array.isArray(configured) ? configured : [configured]).map(normalizeTranslator);
  for (const translator of translators) {
    if (!translator.support || await translator.support(request)) return translator;
  }
  return null;
}

function normalizeTranslator(translator: Translator): DefinedTranslator {
  return typeof translator === 'function' ? { translate: translator, batch: 50, tag: false } : translator;
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
  await extract(config, report);
  await merge(config, report);
  await translateAuto(config, report);
  await merge(config, report);
}

export async function exportTranslations(config: I18nConfig, converterName: string, report?: Reporter): Promise<void> {
  const prepared = (await import('./config')).prepareConfig(config);
  const converter = prepared.convert?.find((item) => item.name === converterName);
  if (!converter?.export) throw new Error(`Converter "${converterName}" does not provide an export function`);
  const { mkdir, writeFile } = await import('node:fs/promises');
  report?.({ type: 'phase:start', phase: 'export' });
  for (const languageId of prepared.languages.targets) {
    const paths = getPaths(prepared, languageId);
    const records = await readableMerged(prepared, languageId);
    const result = await converter.export({ languageId, items: records });
    const exportRoot = path.join(getPaths(prepared).exports, converter.name, languageId);
    for (const file of result.files) {
      const target = path.resolve(exportRoot, file.path);
      if (!target.startsWith(`${path.resolve(exportRoot)}${path.sep}`)) {
        throw new Error(`Converter returned an invalid path: ${file.path}`);
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content);
      report?.({ type: 'file:processed', file: path.relative(prepared.output, target) });
    }
  }
  report?.({ type: 'phase:end', phase: 'export' });
}

export async function importTranslations(config: I18nConfig, converterName: string, report?: Reporter): Promise<void> {
  const prepared = (await import('./config')).prepareConfig(config);
  const converter = prepared.convert?.find((item) => item.name === converterName);
  if (!converter?.import) throw new Error(`Converter "${converterName}" does not provide an import function`);
  const { readFile, readdir } = await import('node:fs/promises');
  report?.({ type: 'phase:start', phase: 'import' });
  for (const languageId of prepared.languages.targets) {
    const exportRoot = path.join(getPaths(prepared).exports, converter.name, languageId);
    const files = await collectFiles(exportRoot, readdir);
    if (!files.length) continue;
    const imported = await converter.import({
      languageId,
      files: await Promise.all(
        files.map(async (file) => ({ path: path.relative(exportRoot, file), content: await readFile(file) })),
      ),
    });
    const manualPath = getPaths(prepared, languageId).manual!;
    const byId = new Map((await readRecords(manualPath)).map((item) => [item.id, item]));
    for (const item of imported) byId.set(item.id, { ...item, origin: 'imported' });
    await writeRecords(manualPath, [...byId.values()]);
    for (const file of files) report?.({ type: 'file:processed', file: path.relative(prepared.output, file) });
  }
  report?.({ type: 'phase:end', phase: 'import' });
}

async function collectFiles(directory: string, readdir: typeof import('node:fs/promises').readdir): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await collectFiles(file, readdir));
      else if (entry.isFile()) files.push(file);
    }
    return files;
  } catch {
    return [];
  }
}

function mergeLayer(
  source: MessageRecord[],
  old: TranslationRecord[],
  origin: TranslationRecord['origin'],
): TranslationRecord[] {
  return source.map((item) => {
    const previous = old.find((candidate) => candidate.id === item.id);
    return { ...item, translation: previous?.translation ?? '', origin };
  });
}

async function readableMerged(
  config: ReturnType<typeof import('./config').prepareConfig>,
  languageId: string,
): Promise<TranslationRecord[]> {
  const paths = getPaths(config, languageId);
  const source = await readExtracted(paths.extracted);
  const auto = new Map((await readRecords(paths.auto)).map((item) => [item.id, item]));
  const manual = new Map((await readRecords(paths.manual)).map((item) => [item.id, item]));
  return source.map((item) => ({
    ...item,
    translation: manual.get(item.id)?.translation || auto.get(item.id)?.translation || '',
    origin: manual.get(item.id)?.translation ? 'manual' : 'auto',
  }));
}
