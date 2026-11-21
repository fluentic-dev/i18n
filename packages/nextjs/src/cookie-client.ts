import { type LanguageChangeHandler, type LanguageDefinition, requireLanguageId } from './language';

export type CookieClientOptions<LanguageId extends string> = LanguageDefinition<LanguageId> & {
  endpoint?: string;
};

export function createClientHandler<LanguageId extends string>(
  options: CookieClientOptions<LanguageId>,
): { handler: LanguageChangeHandler<LanguageId>; } {
  const endpoint = options.endpoint ?? '/api/language';

  const handler: LanguageChangeHandler<LanguageId> = async (value) => {
    const languageId = requireLanguageId(options, value);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: languageId,
    });
    if (!response.ok) throw new Error(`[i18n] language update failed (${response.status})`);
    if (typeof window === 'undefined') {
      throw new Error('[i18n] the cookie client handler can only navigate in a browser');
    }

    window.location.reload();
  };

  return { handler };
}

export { createClientHandler as createCookieClientHandler };
