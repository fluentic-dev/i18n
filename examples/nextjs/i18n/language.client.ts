'use client';
import { createClientHandler as createCookieClientHandler } from '@fluentic/i18n-nextjs/handler/cookie/client';
import { createClientHandler as createUrlClientHandler } from '@fluentic/i18n-nextjs/handler/url/client';
import { languageMode, languages } from './languages';

const { handler: cookieHandler } = createCookieClientHandler({ ...languages, endpoint: '/api/language' });
const { handler: urlHandler } = createUrlClientHandler(languages);

export const languageHandler = languageMode === 'url' ? urlHandler : cookieHandler;
