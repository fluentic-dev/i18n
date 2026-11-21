import {
  defineTranslationLoader,
  type TranslationData,
  type TranslationLoader,
  type TranslationLoaderMap,
} from '@fluentic/i18n';

export type TranslationHash = string | number;
export type TranslationHashManifest = Record<string, TranslationHash>;
export type TranslationHashModule = { default: TranslationHashManifest; };
export type TranslationHashSource =
  | TranslationHashManifest
  | TranslationHashModule
  | Promise<TranslationHashManifest | TranslationHashModule>
  | (() =>
    | TranslationHashManifest
    | TranslationHashModule
    | Promise<TranslationHashManifest | TranslationHashModule>);

export type TranslationCacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type TranslationCacheLoaderOptions = {
  hash: TranslationHashSource;
  storage?: TranslationCacheStorage | null;
  storageKey?: string;
  /** Persist every loaded language (default), or only the selected language (or the most recently requested successful catalog when used standalone). */
  storageMode?: 'last' | 'all';
};

type CacheEntry = { hash: TranslationHash; data: TranslationData; };
type TranslationCache = { version: 1; entries: Record<string, CacheEntry>; };
export type TranslationCacheLoader = {
  loader: TranslationLoader;
  clear(): void;
  remove(languageId: string): void;
};

const DEFAULT_STORAGE_KEY = 'fluentic:i18n:translation-cache';

function isManifest(value: unknown): value is TranslationHashManifest {
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value) &&
      Object.values(value).every((hash) => typeof hash === 'string' || typeof hash === 'number'),
  );
}

function isTranslationData(value: unknown): value is TranslationData {
  return typeof value === 'string' || Array.isArray(value) || Boolean(
    value && typeof value === 'object' && 'jsonl' in value &&
      typeof (value as { jsonl?: unknown; }).jsonl === 'string',
  );
}

function readCache(storage: TranslationCacheStorage, storageKey: string): TranslationCache {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { version: 1, entries: {} };
    const parsed = JSON.parse(raw) as Partial<TranslationCache>;
    if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return { version: 1, entries: {} };
    }

    const entries: Record<string, CacheEntry> = {};
    for (const [languageId, entry] of Object.entries(parsed.entries)) {
      if (
        entry && typeof entry === 'object' && 'hash' in entry &&
        (typeof entry.hash === 'string' || typeof entry.hash === 'number') &&
        'data' in entry && isTranslationData(entry.data)
      ) entries[languageId] = entry as CacheEntry;
    }
    return { version: 1, entries };
  } catch {
    return { version: 1, entries: {} };
  }
}

function getDefaultStorage(): TranslationCacheStorage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Cache loader results in localStorage and invalidate each language with the generated hash manifest. */
export function createTranslationCacheLoader(
  loader: TranslationLoader | TranslationLoaderMap,
  options: TranslationCacheLoaderOptions,
): TranslationCacheLoader {
  const load = defineTranslationLoader(loader);
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const storageMode = options.storageMode ?? 'all';
  let requestSequence = 0;
  let lastSuccessfulRequest = 0;
  let managerSelection = false;
  const loaded = new Map<string, { request: number; entry: CacheEntry | null; }>();
  let pendingManifest: Promise<TranslationHashManifest> | null = null;

  const resolveManifest = () => {
    if (pendingManifest) return pendingManifest;

    pendingManifest = Promise.resolve(typeof options.hash === 'function' ? options.hash() : options.hash).then(
      (source) => {
        const manifest = isManifest(source) ? source : source.default;
        if (!isManifest(manifest)) throw new TypeError('[i18n] invalid translation hash manifest');
        return manifest;
      },
    ).finally(() => {
      pendingManifest = null;
    });

    return pendingManifest;
  };

  const getStorage = () => options.storage === undefined ? getDefaultStorage() : options.storage;
  const persistLast = (storage: TranslationCacheStorage, languageId: string, entry: CacheEntry | null) => {
    try {
      if (entry) {
        storage.setItem(
          storageKey,
          JSON.stringify(
            {
              version: 1,
              entries: { [languageId]: entry },
            } satisfies TranslationCache,
          ),
        );
      } else {
        // Without a hash the new catalog cannot be persisted safely.
        storage.removeItem(storageKey);
      }
    } catch {
      // Storage is an optimization. Quota and privacy failures must not break translations.
    }
  };
  const cachedLoader: TranslationLoader = async (args) => {
    const request = ++requestSequence;
    const storage = getStorage();
    if (!storage) return load(args);

    const manifest = await resolveManifest();
    const hasHash = Object.prototype.hasOwnProperty.call(manifest, args.languageId);
    const hash = manifest[args.languageId];
    const cached = hasHash ? readCache(storage, storageKey) : null;
    const entry = cached && Object.prototype.hasOwnProperty.call(cached.entries, args.languageId)
      ? cached.entries[args.languageId]
      : undefined;
    const hit = entry && Object.is(entry.hash, hash);
    const data = hit ? entry.data : await load(args);

    if (storageMode === 'last') {
      const next = hasHash ? { hash, data } : null;
      if (request >= (loaded.get(args.languageId)?.request ?? 0)) {
        loaded.set(args.languageId, { request, entry: next });
      }
      // Managers notify us after the selected locale AND its fallbacks succeed.
      // This also handles switching back to an already loaded in-memory catalog.
      if (managerSelection) return data;
      // A slow earlier standalone request must not replace a newer successful one.
      if (request < lastSuccessfulRequest) return data;
      lastSuccessfulRequest = request;
      persistLast(storage, args.languageId, next);
    } else if (hasHash && !hit) {
      const latest = readCache(storage, storageKey);
      latest.entries[args.languageId] = { hash, data };
      try {
        storage.setItem(storageKey, JSON.stringify(latest));
      } catch {
        // Storage is an optimization. Quota and privacy failures must not break translations.
      }
    }
    return data;
  };

  if (storageMode === 'last') {
    cachedLoader.onLanguageLoading = () => {
      managerSelection = true;
    };
    cachedLoader.onLanguageSelected = (languageId) => {
      lastSuccessfulRequest = ++requestSequence;
      const storage = getStorage();
      const selected = loaded.get(languageId);
      if (storage && selected) persistLast(storage, languageId, selected.entry);
    };
  }

  return {
    loader: cachedLoader,
    clear() {
      const storage = getStorage();
      if (!storage) return;
      try {
        storage.removeItem(storageKey);
      } catch {
        // Storage is optional and may be unavailable under browser privacy settings.
      }
    },
    remove(languageId) {
      const storage = getStorage();
      if (!storage) return;
      const cached = readCache(storage, storageKey);
      if (!Object.prototype.hasOwnProperty.call(cached.entries, languageId)) return;
      delete cached.entries[languageId];
      try {
        if (Object.keys(cached.entries).length === 0) storage.removeItem(storageKey);
        else storage.setItem(storageKey, JSON.stringify(cached));
      } catch {
        // Storage is optional and may be unavailable under browser privacy settings.
      }
    },
  };
}
