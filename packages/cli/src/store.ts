import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { I18nConfig } from './config';
import { displayPath } from './display-path';
import { parseJsonl, serializeJsonl } from './jsonl';
import type { MessageMetadata, MessageRecord, MetaTuple, TranslationRecord, TranslationTuple } from './types';

export function recordId(context: string | null, source: string): string {
  return JSON.stringify([context, source]);
}

export function getPaths(config: ReturnType<typeof import('./config').prepareConfig>, languageId?: string) {
  const base = path.resolve(config.output);
  const translations = path.join(base, config.dirs.translations);
  return {
    base,
    cache: path.join(base, config.dirs.cache),
    extractCache: path.join(base, config.dirs.cache, 'extract.json'),
    fileHashes: path.join(base, config.dirs.cache, 'hashes.json'),
    exports: path.join(base, config.dirs.exports),
    translations,
    meta: path.join(translations, 'meta.jsonl'),
    hash: path.join(translations, 'hash.json'),
    auto: languageId ? path.join(translations, languageId, 'auto.jsonl') : undefined,
    manual: languageId ? path.join(translations, languageId, 'manual.jsonl') : undefined,
    merged: languageId ? path.join(translations, languageId, 'merged.jsonl') : undefined,
  };
}

async function readJsonl(file: string | undefined): Promise<unknown[]> {
  if (!file) return [];
  let text: string;

  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  if (/^(?:<{7}|={7}|>{7}|\|{7})(?:\s|$)/m.test(text)) {
    throw new Error(`[i18n] unresolved merge conflict in ${displayPath(file)}; resolve it before continuing`);
  }

  try {
    return parseJsonl(text);
  } catch (error) {
    throw new Error(`[i18n] invalid translation file ${displayPath(file)}: ${String(error)}`);
  }
}

export async function readMeta(file: string): Promise<MessageRecord[]> {
  const rows = await readJsonl(file);
  try {
    return rows.map((row) => {
      if (Array.isArray(row) && (row.length === 2 || row.length === 3)) {
        const contextual = row.length === 3;
        const context = contextual ? row[0] : null;
        const source = contextual ? row[1] : row[0];
        const metadata = row[contextual ? 2 : 1];
        if (
          typeof source !== 'string' || (context !== null && typeof context !== 'string') || !metadata ||
          typeof metadata !== 'object' || Array.isArray(metadata) ||
          !Array.isArray((metadata as MessageMetadata).notes) ||
          !(metadata as MessageMetadata).notes.every((note) => typeof note === 'string')
        ) throw new TypeError('expected [message, metadata] or [context, message, metadata]');
        const { notes, meta } = metadata as MessageMetadata;
        return { id: recordId(context, source), source, context, notes, ...(meta === undefined ? {} : { meta }) };
      }
      throw new TypeError('expected message metadata rows');
    });
  } catch (error) {
    throw new Error(`[i18n] invalid metadata file ${displayPath(file)}: ${String(error)}`);
  }
}

export async function readRecords(
  file: string | undefined,
  messages?: MessageRecord[],
): Promise<TranslationRecord[]> {
  if (!file) return [];
  const metadata = new Map(messages?.map((item) => [recordId(item.context, item.source), item]));
  const origin = file && path.basename(file) === 'manual.jsonl' ? 'manual' : 'auto';
  const rows = await readJsonl(file);
  try {
    return rows.map((row) => {
      if (Array.isArray(row) && (row.length === 2 || row.length === 3)) {
        const contextual = row.length === 3;
        const context = contextual ? row[0] : null;
        const source = contextual ? row[1] : row[0];
        const translation = row[contextual ? 2 : 1];
        if (
          typeof source !== 'string' || typeof translation !== 'string' ||
          (context !== null && typeof context !== 'string')
        ) throw new TypeError('expected [message, translation] or [context, message, translation]');
        const id = recordId(context, source);
        const message = metadata.get(id);
        if (messages && !message) throw new TypeError(`translation has no metadata: ${JSON.stringify(source)}`);
        return {
          id,
          source,
          context,
          notes: message?.notes ?? [],
          ...(message?.meta === undefined ? {} : { meta: message.meta }),
          translation,
          origin,
        };
      }
      throw new TypeError('expected translation rows');
    });
  } catch (error) {
    throw new Error(`[i18n] invalid translation file ${displayPath(file)}: ${String(error)}`);
  }
}

export async function writeRecords(file: string, records: TranslationRecord[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const rows: TranslationTuple[] = records.map((item) =>
    item.context ? [item.context, item.source, item.translation] : [item.source, item.translation]
  );
  await writeFile(file, serializeJsonl(rows), 'utf8');
}

export async function writeMeta(file: string, records: MessageRecord[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const rows: MetaTuple[] = records.map((item) => {
    const metadata: MessageMetadata = { notes: item.notes, ...(item.meta === undefined ? {} : { meta: item.meta }) };
    return item.context ? [item.context, item.source, metadata] : [item.source, metadata];
  });
  await writeFile(file, serializeJsonl(rows), 'utf8');
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
