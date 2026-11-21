import { defineLanguages } from '@fluentic/i18n-nextjs/language';

export const languages = defineLanguages({
  languages: ['en', 'fr'] as const,
  defaultLanguageId: 'en',
});
export type LanguageId = (typeof languages.languages)[number];

export const languageMode = process.env.NEXT_PUBLIC_I18N_LANGUAGE_MODE === 'url' ? 'url' : 'cookie';
