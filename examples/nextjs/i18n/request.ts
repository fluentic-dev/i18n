import { defineRequestConfig } from '@fluentic/i18n-nextjs/config';
import { cookies } from 'next/headers';
import french from './fr.jsonl';
export default defineRequestConfig(async () => {
  // Locale selection belongs to this app. The adapter does not inspect URLs.
  const languageId = (await cookies()).get('language')?.value === 'fr' ? 'fr' : 'en';
  return { languageId, translationLoader: ({ languageId }) => languageId === 'fr' ? french : [] };
});
