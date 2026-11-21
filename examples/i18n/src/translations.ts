import { createTranslationCacheLoader, defineTranslationLoader } from '@fluentic/i18n-web';

const loadExampleTranslations = defineTranslationLoader({
  fr: () => import('../i18n/translations/fr/merged.jsonl?raw'),
});

export const translationCache = createTranslationCacheLoader(loadExampleTranslations, {
  hash: () => import('../i18n/translations/hash.json'),
  storageKey: 'fluentic:casebook:translations',
});
