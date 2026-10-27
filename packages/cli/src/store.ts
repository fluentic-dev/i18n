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
  try {
    return parseJsonl(await readFile(file, 'utf8'));
  } catch {
    return [];
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
  } catch {
    return [];
  }
}
