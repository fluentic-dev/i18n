import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { I18nConfig } from './config';
import { parseJsonl, serializeJsonl } from './jsonl';
import type { TranslationRecord } from './types';

export function getPaths(config: ReturnType<typeof import('./config').prepareConfig>, languageId?: string) {
  const base = path.resolve(config.output);
  const translations = path.join(base, config.dirs.translations);
  return {
    base,
    cache: path.join(base, config.dirs.cache),
    exports: path.join(base, config.dirs.exports),
    translations,
    extracted: path.join(base, config.dirs.cache, 'extracted.json'),
    hash: path.join(translations, 'hash.json'),
    auto: languageId ? path.join(translations, languageId, 'auto.jsonl') : undefined,
    manual: languageId ? path.join(translations, languageId, 'manual.jsonl') : undefined,
    merged: languageId ? path.join(translations, languageId, 'merged.jsonl') : undefined,
  };
}

export async function readRecords(file: string | undefined): Promise<TranslationRecord[]> {
  if (!file) return [];
  let text: string;

  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  if (/^(?:<{7}|={7}|>{7}|\|{7})(?:\s|$)/m.test(text)) {
    throw new Error(`[i18n] unresolved merge conflict in ${file}; resolve it before continuing`);
  }

  try {
    const records = parseJsonl(text);

    if (
      records.some((item) =>
        !item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.source !== 'string' ||
        typeof item.translation !== 'string'
      )
    ) {
      throw new TypeError('expected translation records with id, source, and translation');
    }

    return records;
  } catch (error) {
    throw new Error(`[i18n] invalid translation file ${file}: ${String(error)}`);
  }
}

export async function writeRecords(file: string, records: TranslationRecord[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serializeJsonl(records), 'utf8');
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export async function readExtracted(file: string): Promise<TranslationRecord[]> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as TranslationRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(`[i18n] unable to read extracted messages ${file}: ${String(error)}`);
  }
}
