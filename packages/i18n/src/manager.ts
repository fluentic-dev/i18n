import { createRuntime, defaultRuntime, type Formats, getFormats, type Runtime } from './shared/runtime';
import { createStateManager } from './state-manager';
import { createStorageManager, type I18nStorage } from './storage-manager';
import { type Catalog, createTranslationManager, type TranslationLoader } from './translation-manager';
export type { I18nStorage, StoredState } from './storage-manager';
export { defineTranslationLoader } from './translation-manager';
export type * from './translation-manager';
export type StateData = { languageId: string; isLoading: boolean; ready: boolean; };
export type I18nManagerOptions = { languageId: string; fallbackLanguageId?: string; };
export type CreateI18nManagerOptions = { storage?: I18nStorage | null; runtime?: Runtime; };
export type I18nSnapshot = {
  languageId: string;
  fallbackLanguageId?: string;
  translations: Record<string, Catalog>;
  formats?: Partial<Formats>;
};
export function createI18nManager(options: CreateI18nManagerOptions = {}) {
  const runtime = options.runtime ?? createRuntime();
  const state = createStateManager<StateData>({
    languageId: runtime.languageId,
    isLoading: false,
    ready: runtime.ready,
  });
  const storage = createStorageManager(options.storage ?? null);
  const translations = createTranslationManager();
  let fallbackLanguageId: string | undefined;
  let version = 0;
  runtime.subscribe = state.subscribe;
  runtime.getSnapshot = state.get;
  const ids = (
    languageId: string,
  ) => [...new Set([languageId, languageId.split('-')[0], fallbackLanguageId].filter(Boolean) as string[])];
  const manager = {
    configure(config: I18nManagerOptions) {
      runtime.languageId = config.languageId;
      runtime.ready = false;
      fallbackLanguageId = config.fallbackLanguageId;
      version++;
      state.set({ languageId: config.languageId, ready: false });
    },
    setStorage: storage.setStorage,
    setTranslationLoader(loader: TranslationLoader | null) {
      translations.setTranslationLoader(loader);
      runtime.ready = false;
      state.set({ ready: false });
    },
    async init() {
      const saved = storage.hasStorage() ? await storage.getStorage().read() : null;
      await load(saved?.languageId ?? runtime.languageId);
    },
    async setLanguageId(languageId: string) {
      const committed = await load(languageId);
      if (committed && storage.hasStorage()) await storage.getStorage().write({ languageId });
    },
    getLanguageId() {
      return runtime.languageId;
    },
    getTranslation(args: { languageId?: string; context?: string | null; message: string; }) {
      for (const languageId of ids(args.languageId ?? runtime.languageId)) {
        const value = translations.getTranslation({ ...args, languageId, context: args.context ?? null });
        if (value !== null) return value;
      }
      return null;
    },
    getSnapshot(): I18nSnapshot {
      return {
        languageId: runtime.languageId,
        fallbackLanguageId,
        translations: Object.fromEntries(
          Object.entries(translations.catalogs).map(([id, catalog]) => [id, { ...catalog }]),
        ),
        formats: getFormats(runtime, runtime.languageId),
      };
    },
    hydrate(snapshot: I18nSnapshot) {
      version++;
      for (const id of Object.keys(translations.catalogs)) delete translations.catalogs[id];
      for (const [id, catalog] of Object.entries(snapshot.translations)) {
        translations.catalogs[id] = Object.assign(Object.create(null), catalog);
      }
      runtime.formats = snapshot.formats ?? {};
      runtime.languageId = snapshot.languageId;
      fallbackLanguageId = snapshot.fallbackLanguageId;
      runtime.ready = true;
      state.set({ languageId: snapshot.languageId, ready: true, isLoading: false });
    },
  };
  runtime.translationGetter = manager.getTranslation;
  async function load(languageId: string) {
    const current = ++version;
    state.set({ isLoading: true });
    try {
      await Promise.all(ids(languageId).map(translations.loadTranslations));
      if (version !== current) return false;
      runtime.languageId = languageId;
      runtime.ready = true;
      state.set({ languageId, ready: true, isLoading: false });
      return true;
    } finally {
      if (current === version) state.set({ isLoading: false });
    }
  }
  return { manager, state, runtime };
}
export type ManagedI18n = ReturnType<typeof createI18nManager>;
export type I18nManager = ManagedI18n['manager'];
export const defaultManaged = createI18nManager({ runtime: defaultRuntime });
export const I18nManager = defaultManaged.manager;
export const defaultI18nState = defaultManaged.state;
