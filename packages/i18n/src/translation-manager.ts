import type { LanguageId, MessageContext } from './core/types';
import { type Catalog, parseCatalog, type TranslationData } from './translation';

export type * from './translation';
export { normalizeCatalog } from './translation';

export type TranslationLoaderArgs = { languageId: LanguageId; };
export type TranslationLookupArgs = { languageId: LanguageId; context: MessageContext | null; message: string; };
export type TranslationLoader = (args: TranslationLoaderArgs) => TranslationData | Promise<TranslationData>;
export type TranslationModule = { default: TranslationData; };
export type TranslationSource = TranslationData | TranslationModule;

export type TranslationLoaderEntry =
  | TranslationSource
  | Promise<TranslationSource>
  | (() => TranslationSource | Promise<TranslationSource>);

export type TranslationLoaderMap = Record<string, TranslationLoaderEntry>;

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
  const compiledCatalogs: Record<string, boolean> = Object.create(null);

  let loader: TranslationLoader | null = null;
  let generation = 0;

  const setTranslationLoader = (next: TranslationLoader | null) => {
    loader = next;
    generation++;
    pending.clear();

    for (const key of Object.keys(catalogs)) delete catalogs[key];
    for (const key of Object.keys(compiledCatalogs)) delete compiledCatalogs[key];
  };

  const loadTranslations = async (languageId: string) => {
    if (!loader || Object.prototype.hasOwnProperty.call(catalogs, languageId)) return;
    if (pending.has(languageId)) return pending.get(languageId);

    const version = generation;
    const currentLoader = loader;

    const task = Promise.resolve().then(() => currentLoader({ languageId })).then((data) => {
      if (version === generation) {
        const result = parseCatalog(data);
        catalogs[languageId] = result.catalog;
        compiledCatalogs[languageId] = result.compiled;
      }
    }).finally(() => {
      if (version === generation) pending.delete(languageId);
    });

    pending.set(languageId, task);

    return task;
  };

  const getTranslation = (args: TranslationLookupArgs) => {
    const catalog = catalogs[args.languageId];
    const id = args.context ? `${args.context}\0${args.message}` : args.message;

    return catalog?.[id] ?? catalog?.[args.message] ?? null;
  };

  return { catalogs, compiledCatalogs, setTranslationLoader, loadTranslations, getTranslation };
}
