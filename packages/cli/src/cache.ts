import { glob } from 'fast-glob';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { displayPath } from './display-path';
import { contextualError } from './errors';
import { extractMessages } from './extract';
import { hashText } from './hash';
import { getPaths, writeJson } from './store';
import type { MessageRecord } from './types';

const CACHE_VERSION = 2;
export type ExtractStats = { files: number; cached: number; parsed: number; skipped: number; removed: number; };

type FileHash = { hash: number; size: number; updated: number; };
type FileHashes = {
  version: number;
  rootDir: string;
  fingerprint: string;
  hashes: Record<string, FileHash>;
};
type ExtractCache = {
  version: number;
  files: string[];
  messages: Record<string, MessageRecord[]>;
};

async function readCache<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function validHashes(value: FileHashes): boolean {
  return Boolean(
    value && typeof value === 'object' && value.hashes && typeof value.hashes === 'object' &&
      Object.values(value.hashes).every((item) =>
        item && typeof item.hash === 'number' && typeof item.size === 'number' && typeof item.updated === 'number'
      ),
  );
}

function validExtract(value: ExtractCache): boolean {
  return Boolean(
    value && typeof value === 'object' && Array.isArray(value.files) &&
      value.files.every((file) => typeof file === 'string') && value.messages && typeof value.messages === 'object' &&
      Object.values(value.messages).every(Array.isArray),
  );
}

function mayContainMessages(text: string): boolean {
  return /(?:from\s*|require\s*\(\s*)['"]@fluentic\/i18n(?:\/core)?['"]/.test(text) &&
    /(?:\.\s*(?:msg|text|jsx)|\[\s*['"](?:msg|text|jsx)['"]\s*\])\s*\(/.test(text);
}

export async function extractWithCache(
  config: ReturnType<typeof import('./config').prepareConfig>,
  onFile: (file: string) => void,
  onSummary?: (stats: ExtractStats) => void,
): Promise<MessageRecord[]> {
  const rootDir = path.resolve(config.root);
  if (!(await stat(rootDir)).isDirectory()) {
    throw new Error(`Source root is not a folder: ${displayPath(rootDir)}. Check config.root.`);
  }
  const includes = config.files?.includes ?? ['**/*.{ts,tsx,js,jsx}'];
  const excludes = ['node_modules/**', ...(config.files?.excludes ?? [])];
  const fingerprint = JSON.stringify([CACHE_VERSION, includes, excludes]);
  const paths = getPaths(config);
  const emptyHashes: FileHashes = { version: CACHE_VERSION, rootDir, fingerprint, hashes: {} };
  const emptyExtract: ExtractCache = { version: CACHE_VERSION, files: [], messages: {} };
  let hashes = await readCache(paths.fileHashes, emptyHashes);
  let extracted = await readCache(paths.extractCache, emptyExtract);

  if (
    !validHashes(hashes) || !validExtract(extracted) || hashes.version !== CACHE_VERSION ||
    hashes.rootDir !== rootDir || hashes.fingerprint !== fingerprint || extracted.version !== CACHE_VERSION
  ) {
    hashes = emptyHashes;
    extracted = emptyExtract;
  }

  const entries = await glob(includes, {
    cwd: rootDir,
    ignore: excludes,
    followSymbolicLinks: false,
    stats: true,
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const files = entries.map((entry) => entry.path);
  const fileSet = new Set(files);
  const stats: ExtractStats = {
    files: files.length,
    cached: 0,
    parsed: 0,
    skipped: 0,
    removed: extracted.files.filter((file) => !fileSet.has(file)).length,
  };
  const nextHashes: Record<string, FileHash> = {};
  const nextMessages: Record<string, MessageRecord[]> = {};

  for (const entry of entries) {
    const file = entry.path;
    const updated = entry.stats?.mtimeMs ?? 0;
    const size = entry.stats?.size ?? 0;
    const cachedHash = hashes.hashes[file];
    const cachedMessages = extracted.messages[file];

    if (cachedHash && cachedMessages && cachedHash.updated === updated && cachedHash.size === size) {
      nextHashes[file] = cachedHash;
      nextMessages[file] = cachedMessages;
      stats.cached++;
      continue;
    }

    const text = await readFile(path.join(rootDir, file), 'utf8');
    const hash = hashText(text);
    nextHashes[file] = { hash, size, updated };

    if (cachedHash && cachedMessages && cachedHash.hash === hash) {
      nextMessages[file] = cachedMessages;
      stats.cached++;
      continue;
    }

    if (mayContainMessages(text)) {
      try {
        nextMessages[file] = extractMessages(text, file);
      } catch (error) {
        throw contextualError(`Could not extract messages from ${displayPath(file)}`, error);
      }
      stats.parsed++;
      onFile(file);
    } else {
      nextMessages[file] = [];
      stats.skipped++;
    }
  }

  const nextExtract: ExtractCache = { version: CACHE_VERSION, files, messages: nextMessages };
  const nextFileHashes: FileHashes = {
    version: CACHE_VERSION,
    rootDir,
    fingerprint,
    hashes: nextHashes,
  };
  await writeJson(paths.fileHashes, nextFileHashes);
  await writeJson(paths.extractCache, nextExtract);

  const messages = new Map<string, MessageRecord>();
  for (const item of files.flatMap((file) => nextMessages[file] ?? [])) {
    const previous = messages.get(item.id);
    if (!previous) {
      messages.set(item.id, item);
      continue;
    }
    if (JSON.stringify(previous.meta) !== JSON.stringify(item.meta)) {
      throw new Error(`[i18n] conflicting metadata for ${JSON.stringify(item.source)}`);
    }
    previous.notes = [...new Set([...previous.notes, ...item.notes])];
  }
  onSummary?.(stats);
  return [...messages.values()].sort((a, b) =>
    (a.context ?? '').localeCompare(b.context ?? '') || a.source.localeCompare(b.source)
  );
}
