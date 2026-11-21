import { getHydration, type I18nSnapshot } from './hydration-store';
import type { ManagedI18n } from './manager';
import { getFormats } from './shared/runtime';

export type { I18nSnapshot } from './hydration-store';

/** Capture loaded catalogs and locale state for transfer to another runtime. */
export function getSnapshot(instance: ManagedI18n): I18nSnapshot {
  const { runtime, translations, getFallbackLanguageId } = getHydration(instance);

  return {
    languageId: runtime.languageId,
    fallbackLanguageId: getFallbackLanguageId(),
    translations: Object.fromEntries(
      Object.entries(translations.catalogs).map(([id, catalog]) => [id, { ...catalog }]),
    ),
    formats: getFormats(runtime, runtime.languageId),
    compiledLanguages: Object.keys(translations.compiledCatalogs).filter(
      (id) => translations.compiledCatalogs[id],
    ),
  };
}

/** Initialize a runtime from a server-produced snapshot without loading catalogs. */
export function hydrate(instance: ManagedI18n, snapshot: I18nSnapshot): void {
  const { runtime, state, translations, setFallbackLanguageId, invalidate } = getHydration(instance);
  invalidate();

  for (const id of Object.keys(translations.catalogs)) delete translations.catalogs[id];
  for (const id of Object.keys(translations.compiledCatalogs)) delete translations.compiledCatalogs[id];
  for (const [id, catalog] of Object.entries(snapshot.translations)) {
    translations.catalogs[id] = Object.assign(Object.create(null), catalog);
  }

  for (const id of snapshot.compiledLanguages ?? []) translations.compiledCatalogs[id] = true;

  runtime.formats = snapshot.formats ?? {};
  runtime.languageId = snapshot.languageId;
  setFallbackLanguageId(snapshot.fallbackLanguageId);
  runtime.ready = true;
  state.set({ languageId: snapshot.languageId, ready: true, isLoading: false });
}
