import type { LanguageId, MessageContext } from './core/types';
import { type CompactMessage, validateCompact } from './shared/compact';
export type TranslationItem = { id: string; translation: string; };
export type CompiledTranslationItem = [string, CompactMessage];
export type TranslationJsonl = string;
export type TranslationData = TranslationItem[] | CompiledTranslationItem[] | TranslationJsonl | {
  jsonl: TranslationJsonl;
};
export type TranslationLoader = (args: { languageId: LanguageId; }) => TranslationData | Promise<TranslationData>;
export type TranslationModule = { default: TranslationData; };
export type TranslationSource = TranslationData | TranslationModule;
export type TranslationLoaderEntry =
  | TranslationSource
  | Promise<TranslationSource>
  | (() => TranslationSource | Promise<TranslationSource>);
export type TranslationLoaderMap = Record<string, TranslationLoaderEntry>;
export type Catalog = Record<string, CompactMessage>;
export function normalizeCatalog(data: TranslationData): Catalog {
  const catalog: Catalog = Object.create(null);
  const rows: unknown[] = typeof data === 'string' || !Array.isArray(data)
    ? (typeof data === 'string' ? data : data.jsonl).split(/\r?\n/).filter((line) => line.trim()).map((line) =>
      JSON.parse(line)
    )
    : data;
  for (const row of rows) {
    if (Array.isArray(row)) {
      if (row.length !== 2 || typeof row[0] !== 'string') throw new TypeError('[i18n] invalid compiled catalog row');
      validateCompact(row[1]);
      catalog[row[0]] = row[1];
    } else {
      const item = row as {
        id?: string;
        source?: string;
        context?: string;
        message?: string | [string, string];
        translation?: string;
      };
      if (!item || typeof item.translation !== 'string') throw new TypeError('[i18n] invalid translation item');
      const source = item.source ?? (Array.isArray(item.message) ? item.message[1] : item.message);
      const context = Array.isArray(item.message) ? item.message[0] : item.context;
      const id = item.id ?? (source === undefined ? undefined : context ? `${context}\0${source}` : source);
      if (typeof id !== 'string') throw new TypeError('[i18n] translation id is missing');
      // Empty authoring rows mean untranslated. Compact rows can represent intentional empty strings.
      if (item.translation !== '') catalog[id] = item.translation;
    }
  }
  return catalog;
}
export function defineTranslationLoader(loader: TranslationLoader | TranslationLoaderMap): TranslationLoader {
  if (typeof loader === 'function') return loader;
  return async ({ languageId }) => {
    if (!Object.prototype.hasOwnProperty.call(loader, languageId)) return [];
    const entry = loader[languageId];
    const source = await (typeof entry === 'function' ? entry() : entry);
    return typeof source === 'object' && source !== null && 'default' in source
      ? source.default
      : source as TranslationData;
  };
}
export function createTranslationManager() {
  const catalogs: Record<string, Catalog> = Object.create(null);
  const pending = new Map<string, Promise<void>>();
  let loader: TranslationLoader | null = null;
  let generation = 0;
  return {
    catalogs,
    setTranslationLoader(next: TranslationLoader | null) {
      loader = next;
      generation++;
      pending.clear();
      for (const key of Object.keys(catalogs)) delete catalogs[key];
    },
    async loadTranslations(languageId: string) {
      if (!loader || Object.prototype.hasOwnProperty.call(catalogs, languageId)) return;
      if (pending.has(languageId)) return pending.get(languageId);
      const version = generation;
      const currentLoader = loader;
      const task = Promise.resolve().then(() => currentLoader({ languageId })).then((data) => {
        if (version === generation) catalogs[languageId] = normalizeCatalog(data);
      }).finally(() => {
        if (version === generation) pending.delete(languageId);
      });
      pending.set(languageId, task);
      return task;
    },
    getTranslation(
      { languageId, context, message }: { languageId: string; context: MessageContext | null; message: string; },
    ) {
      const catalog = catalogs[languageId];
      return catalog?.[context ? `${context}\0${message}` : message] ?? catalog?.[message] ?? null;
    },
  };
}
