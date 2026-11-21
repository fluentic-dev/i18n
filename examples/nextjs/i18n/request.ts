import { defineRequestConfig } from '@fluentic/i18n-nextjs/config';
import french from './data/translations/fr/merged.mjs';
import { languageServer } from './language.server';
export default defineRequestConfig(async () => {
  const languageId = await languageServer.getLanguageId();
  return { languageId, translationLoader: ({ languageId }) => languageId === 'fr' ? french : [] };
});
