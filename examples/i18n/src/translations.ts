import { defineTranslationLoader } from '@fluentic/i18n-web';

export const loadExampleTranslations = defineTranslationLoader({
  fr: () => import('../i18n/translations/fr/merged.jsonl'),
});
