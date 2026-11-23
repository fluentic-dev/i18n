import { compileMessage, lintSource, matchingMessageTerms, shouldCheckParameters } from '@fluentic/i18n-compiler';
import { glob } from 'fast-glob';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { messageContract } from './catalog-validation';
import { type I18nConfig, prepareConfig } from './config';
import { displayPath } from './display-path';
import { errorMessage } from './errors';
import type { Reporter } from './events';
import { getPaths, readMeta, recordId } from './store';
import type { MessageRecord } from './types';

export type LintDiagnostic = {
  severity: 'error' | 'warning';
  code: string;
  file: string;
  line?: number;
  column?: number;
  message: string;
};
export type LintResult = {
  diagnostics: LintDiagnostic[];
  errors: number;
  warnings: number;
  files: number;
  messages: number;
  coverage: Record<string, { translated: number; total: number; }>;
};

/** Read-only source and authoring catalog checks. Does not use or update extraction caches. */
export async function lint(config: I18nConfig, report?: Reporter): Promise<LintResult> {
  const prepared = prepareConfig(config);
  const diagnostics: LintDiagnostic[] = [];
  const add = (severity: LintDiagnostic['severity'], code: string, file: string, message: string, line?: number) =>
    diagnostics.push({ severity, code, file, message, ...(line ? { line } : {}) });
  report?.({ type: 'phase:start', phase: 'lint', separateBody: true });
  const root = path.resolve(prepared.root);
  if (!(await stat(root)).isDirectory()) throw new Error(`Source root is not a folder: ${displayPath(root)}`);
  const files = (await glob(prepared.files?.includes ?? ['**/*.{ts,tsx,js,jsx}'], {
    cwd: root,
    ignore: ['node_modules/**', ...(prepared.files?.excludes ?? [])],
    followSymbolicLinks: false,
  })).sort();
  const messages = new Map<string, MessageRecord>();
  const sourceFiles = new Map<string, string>();
  let extractionFailed = false;
  for (const relative of files) {
    const file = path.join(root, relative);
    try {
      const result = lintSource(await readFile(file, 'utf8'), file, undefined, {
        parameterChecks: prepared.lint?.parameterChecks,
      });
      diagnostics.push(...result.diagnostics.map((item) => ({ ...item, file })));
      if (result.diagnostics.some((item) => item.code === 'extraction' || item.code === 'static-message')) {
        extractionFailed = true;
      }
      for (const item of result.messages) {
        const id = recordId(item.context, item.source);
        const previous = messages.get(id);
        sourceFiles.set(id, file);
        if (previous && JSON.stringify(previous.meta) !== JSON.stringify(item.meta)) {
          add('error', 'conflicting-metadata', file, `Conflicting metadata for ${JSON.stringify(item.source)}.`);
        }
        messages.set(
          id,
          { ...item, id, notes: [...new Set([...(previous?.notes ?? []), ...item.notes])] } as MessageRecord,
        );
      }
      report?.({ type: 'file:processed', file });
    } catch (error) {
      extractionFailed = true;
      add('error', 'extraction', file, errorMessage(error));
    }
  }
  if (!files.length) {
    add('warning', 'no-files', root, 'No source files matched. Check files.includes and files.excludes.');
  } else if (!messages.size && !extractionFailed) {
    add('warning', 'no-messages', root, 'No messages found. Check source patterns and translator imports.');
  }
  const paths = getPaths(prepared);
  let metadata: MessageRecord[] = [];
  let metadataValid = true;
  try {
    await stat(paths.meta);
    metadata = await readMeta(paths.meta);
  } catch (error) {
    metadataValid = false;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      add('warning', 'missing-metadata', paths.meta, 'Metadata catalog is missing. Run fluentic-i18n extract.');
    } else add('error', 'invalid-metadata', paths.meta, errorMessage(error));
  }
  const known = new Set<string>();
  for (const item of metadata) {
    if (known.has(item.id)) {
      add('error', 'duplicate-message', paths.meta, `Duplicate source ${JSON.stringify(item.source)}.`);
    }
    known.add(item.id);
    try {
      compileMessage(item.source);
    } catch (error) {
      add('error', 'invalid-icu', paths.meta, `${JSON.stringify(item.source)}: ${errorMessage(error)}`);
    }
  }
  const configuredRules = prepared.lint?.forbiddenMessages;
  const rules = configuredRules === undefined
    ? []
    : Array.isArray(configuredRules)
    ? configuredRules
    : [configuredRules];
  for (const item of new Map([...metadata, ...messages.values()].map((item) => [item.id, item])).values()) {
    for (const [index, rule] of rules.entries()) {
      const options = typeof rule === 'function' ? { check: rule } : rule;
      const code = options.id ?? 'forbidden-message';
      const file = sourceFiles.get(item.id) ?? paths.meta;
      try {
        let findings: string | string[] | undefined;
        if (options.check) {
          findings = await options.check(item.source);
        } else {
          findings = matchingMessageTerms(item.source, options)
            .map((term) =>
              options.message ??
                `Source ${options.match === 'exact' ? 'equals' : 'contains'} ${
                  JSON.stringify(term)
                }. Use a placeholder or render it separately.`
            );
        }
        const results = findings === undefined ? [] : Array.isArray(findings) ? findings : [findings];
        if (!results.every((result) => typeof result === 'string' && result.trim())) {
          throw new Error('Check must return a non-empty diagnostic string, an array of those strings, or undefined.');
        }
        for (const message of new Set(results)) {
          add(options.severity ?? 'warning', code, file, `${JSON.stringify(item.source)}: ${message}`);
        }
      } catch (error) {
        add(
          'error',
          'forbidden-rule-error',
          file,
          `Rule ${options.id ?? index + 1} failed for ${JSON.stringify(item.source)}: ${errorMessage(error)}`,
        );
      }
    }
  }
  if (metadataValid && !extractionFailed) {
    const added = [...messages.keys()].filter((id) => !known.has(id)).length;
    const removed = metadata.filter((item) => !messages.has(item.id)).length;
    const changed = metadata.filter((item) => {
      const current = messages.get(item.id);
      return current && (JSON.stringify([...current.notes].sort()) !== JSON.stringify([...item.notes].sort()) ||
        JSON.stringify(current.meta) !== JSON.stringify(item.meta));
    }).length;
    if (added || removed || changed) {
      add(
        'warning',
        'extraction-drift',
        paths.meta,
        `${added} new, ${removed} removed, ${changed} metadata changes. Run fluentic-i18n extract.`,
      );
    }
  }
  const coverage: LintResult['coverage'] = {};
  for (const language of prepared.languages.targets) {
    const localePaths = getPaths(prepared, language);
    const translated = new Set<string>();
    for (const file of [localePaths.manual!, localePaths.auto!]) {
      let contents: string;
      try {
        contents = await readFile(file, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') add('error', 'catalog-read', file, errorMessage(error));
        continue;
      }
      const seen = new Set<string>();
      for (const [index, line] of contents.split(/\r?\n/).entries()) {
        if (!line.trim()) continue;
        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          add('error', 'invalid-row', file, 'Invalid JSON or unresolved merge conflict.', index + 1);
          continue;
        }
        if (!Array.isArray(row) || ![2, 3].includes(row.length) || !row.every((value) => typeof value === 'string')) {
          add(
            'error',
            'invalid-row',
            file,
            'Expected [source, translation] or [context, source, translation].',
            index + 1,
          );
          continue;
        }
        const source = row[row.length - 2] as string;
        const translation = row[row.length - 1] as string;
        const id = recordId(row.length === 3 ? row[0] as string : null, source);
        if (seen.has(id)) {
          add('error', 'duplicate-message', file, `Duplicate source ${JSON.stringify(source)}.`, index + 1);
        }
        seen.add(id);
        if (metadataValid && !known.has(id)) {
          add(
            'error',
            'unknown-source',
            file,
            `Source ${JSON.stringify(source)} has no metadata. Run fluentic-i18n extract.`,
            index + 1,
          );
        }
        let sourceContract: string[];
        try {
          sourceContract = messageContract(source);
        } catch (error) {
          add(
            'error',
            'invalid-icu',
            file,
            `Invalid source ${JSON.stringify(source)}: ${errorMessage(error)}`,
            index + 1,
          );
          continue;
        }
        if (!translation) continue;
        let targetContract: string[];
        try {
          targetContract = messageContract(translation);
        } catch (error) {
          add(
            'error',
            'invalid-icu',
            file,
            `Invalid translation of ${JSON.stringify(source)}: ${errorMessage(error)}`,
            index + 1,
          );
          continue;
        }
        translated.add(id);
        const checks = prepared.lint?.parameterChecks;
        const check = typeof checks === 'object' ? checks.translation : checks;
        try {
          if (!shouldCheckParameters(check, { message: source, translation })) continue;
        } catch (error) {
          add(
            'error',
            'parameter-check-error',
            file,
            `translation: ${JSON.stringify(source)}: ${errorMessage(error)}`,
            index + 1,
          );
          continue;
        }
        const missing = sourceContract.filter((part) => !targetContract.includes(part));
        const added = targetContract.filter((part) => !sourceContract.includes(part));
        if (missing.length || added.length) {
          add(
            'error',
            'translation-structure',
            file,
            `${JSON.stringify(source)}: ICU structure differs. Missing: ${
              missing.map(describeContract).join(', ') || 'none'
            }; added: ${added.map(describeContract).join(', ') || 'none'}.`,
            index + 1,
          );
        }
      }
    }
    coverage[language] = {
      translated: [...messages.keys()].filter((id) => translated.has(id)).length,
      total: messages.size,
    };
  }
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  for (const item of diagnostics) {
    const location = `${displayPath(item.file)}${item.line ? `:${item.line}:${item.column ?? 1}` : ''}`;
    const message = `${location} [${item.code}] ${item.message}`;
    report?.(item.severity === 'error' ? { type: 'error', error: message } : { type: 'warning', message });
  }
  report?.({
    type: 'phase:end',
    phase: 'lint',
    separateDetails: diagnostics.length > 0,
    details: {
      Files: String(files.length),
      Messages: String(messages.size),
      ...Object.fromEntries(
        Object.entries(coverage).map((
          [language, value],
        ) => [language, `${value.translated}/${value.total} translated · ${value.total - value.translated} missing`]),
      ),
      Result: `${errors} errors · ${warnings} warnings`,
    },
  });
  return { diagnostics, errors, warnings, files: files.length, messages: messages.size, coverage };
}

function describeContract(signature: string): string {
  const [type, name, ...details] = JSON.parse(signature) as [number, string, ...unknown[]];
  if (type === 6) return 'plural #';
  if (type === 7) return `<${name}>`;
  const label = ['argument', 'number', 'date', 'time', 'select', 'plural'][type];
  return `${name} (${label}${details.length ? `: ${details.map((value) => JSON.stringify(value)).join(', ')}` : ''})`;
}
