import { type LanguageChangeHandler, type LanguageDefinition, requireLanguageId } from './language';

export function localizePathname<LanguageId extends string>(
  pathname: string,
  languageId: LanguageId,
  definition: LanguageDefinition<LanguageId>,
): string {
  requireLanguageId(definition, languageId);
  const segments = pathname.split('/').filter(Boolean);
  if (definition.languages.includes(segments[0] as LanguageId)) segments.shift();

  return '/' + [encodeURIComponent(languageId), ...segments].join('/');
}

export function createClientHandler<LanguageId extends string>(
  options: LanguageDefinition<LanguageId>,
): { handler: LanguageChangeHandler<LanguageId>; } {
  const handler: LanguageChangeHandler<LanguageId> = async (value, change = {}) => {
    const languageId = requireLanguageId(options, value);
    if (typeof window === 'undefined') {
      throw new Error('[i18n] the URL client handler can only navigate in a browser');
    }
    const href = localizePathname(window.location.pathname, languageId, options) +
      window.location.search +
      window.location.hash;

    window.location[change.replace ? 'replace' : 'assign'](href);
  };

  return { handler };
}

export { createClientHandler as createUrlClientHandler };
