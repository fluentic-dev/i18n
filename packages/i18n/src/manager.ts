import { registerHydration } from './hydration-store';
import { createRuntime, defaultRuntime, type Runtime } from './shared/runtime';
import { createStateManager } from './state-manager';
import { createStorageManager, type I18nStorage } from './storage-manager';
import { createTranslationManager, type TranslationLoader } from './translation-manager';

export type { I18nStorage, StoredState } from './storage-manager';
export { defineTranslationLoader } from './translation-manager';
export type * from './translation-manager';

export type StateData = { languageId: string; isLoading: boolean; ready: boolean; };
export type I18nManagerOptions = { languageId: string; fallbackLanguageId?: string; };
export type CreateI18nManagerOptions = { storage?: I18nStorage | null; runtime?: Runtime; };
export type GetTranslationArgs = { languageId?: string; context?: string | null; message: string; };

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

  /* configure */

  const configure = (config: I18nManagerOptions) => {
    runtime.languageId = config.languageId;
    runtime.ready = false;
    fallbackLanguageId = config.fallbackLanguageId;
    version++;
    state.set({ languageId: config.languageId, ready: false });
  };

  const setTranslationLoader = (loader: TranslationLoader | null) => {
    translations.setTranslationLoader(loader);
    runtime.ready = false;
    state.set({ ready: false });
  };

  /* language and translations */

  const init = async () => {
    const saved = storage.hasStorage() ? await storage.getStorage().read() : null;

    await loadTranslations(saved?.languageId ?? runtime.languageId);
  };

  const setLanguageId = async (languageId: string) => {
    const committed = await loadTranslations(languageId);

    if (committed && storage.hasStorage()) await storage.getStorage().write({ languageId });
  };

  const getLanguageId = () => {
    return runtime.languageId;
  };

  const getTranslation = (args: GetTranslationArgs) => {
    for (const languageId of getLanguageIds(args.languageId ?? runtime.languageId)) {
      const value = translations.getTranslation({ ...args, languageId, context: args.context ?? null });

      if (value !== null) return value;
    }

    return null;
  };

  /* utils */

  const getLanguageIds = (languageId: string) => {
    const ids = fallbackLanguageId === undefined
      ? [languageId, languageId.split('-')[0]]
      : [languageId, languageId.split('-')[0], fallbackLanguageId];

    return [...new Set(ids)];
  };

  const loadTranslations = async (languageId: string) => {
    const current = ++version;
    state.set({ isLoading: true });

    try {
      translations.languageLoading();
      await Promise.all(getLanguageIds(languageId).map(translations.loadTranslations));
      if (version !== current) return false;
      translations.languageSelected(languageId);
      runtime.languageId = languageId;
      runtime.ready = true;
      state.set({ languageId, ready: true, isLoading: false });

      return true;
    } finally {
      if (current === version) state.set({ isLoading: false });
    }
  };

  const manager = {
    configure,
    setStorage: storage.setStorage,
    setTranslationLoader,
    init,
    setLanguageId,
    getLanguageId,
    getTranslation,
  };

  runtime.translationGetter = (args) => {
    for (const languageId of getLanguageIds(args.languageId)) {
      const compiled = translations.compiledCatalogs[languageId];
      const message = compiled && args.getCompiledId ? args.getCompiledId() : args.message;
      const context = compiled && args.getCompiledId ? null : args.context;
      const value = translations.getTranslation({ languageId, context, message });

      if (value !== null) return compiled ? { compiled: value } : value;
    }

    return null;
  };

  const managed = { manager, state, runtime };
  registerHydration(managed, {
    runtime,
    state,
    translations,
    getFallbackLanguageId: () => fallbackLanguageId,
    setFallbackLanguageId: (languageId) => {
      fallbackLanguageId = languageId;
    },
    invalidate: () => {
      version++;
    },
  });

  return managed;
}

export type ManagedI18n = ReturnType<typeof createI18nManager>;
export type I18nManager = ManagedI18n['manager'];
export const defaultManaged = createI18nManager({ runtime: defaultRuntime });
export const I18nManager = defaultManaged.manager;
export const defaultI18nState = defaultManaged.state;
