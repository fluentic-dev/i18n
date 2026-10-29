import type { DefinedTranslator, Translator, TranslatorOptions } from './types';

export function defineTranslator(options: TranslatorOptions): DefinedTranslator {
  const batch = options.batch === false ? false : options.batch ?? 50;
  if (batch !== false && (!Number.isInteger(batch) || batch < 1)) {
    throw new Error('Translator batch must be a positive integer or false');
  }
  return Object.freeze({
    translate: options.translate,
    support: options.support,
    batch,
    tag: options.tag ?? false,
  });
}

const deeplSourceLanguages = new Set(
  'ar bg cs da de el en es et fi fr he hu id it ja ko lt lv nb nl pl pt ro ru sk sl sv th tr uk vi zh'.split(' '),
);
const deeplTargetLanguages = new Set(
  'ar bg cs da de el en en-gb en-us es es-419 et fi fr he hu id it ja ko lt lv nb nl pl pt pt-br pt-pt ro ru sk sl sv th tr uk vi zh zh-hans zh-hant'
    .split(
      ' ',
    ),
);

export type ProviderTranslatorOptions = {
  apiKeyEnv?: string;
  endpoint?: string;
  apiKey?: string;
};
export type ProviderTranslatorOptionsFactory = (
  context: { env: (name: string) => string; },
) => ProviderTranslatorOptions;
type ProviderOptions = ProviderTranslatorOptions | ProviderTranslatorOptionsFactory;

export function createGoogleTranslator(options?: ProviderOptions): Translator {
  return defineTranslator({
    batch: 50,
    tag: false,
    support: () => true,
    translate: async ({ items, sourceLanguageId, targetLanguageId, env }) => {
      const resolved = typeof options === 'function' ? options({ env }) : options ?? {};
      const key = resolved.apiKey ?? env(resolved.apiKeyEnv ?? 'GOOGLE_TRANSLATE_API_KEY');
      const endpoint = resolved.endpoint ?? 'https://translation.googleapis.com/language/translate/v2';
      const url = new URL(endpoint);
      url.searchParams.set('key', key);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: items.map((item) => item.source),
          source: sourceLanguageId,
          target: targetLanguageId,
          format: 'text',
        }),
      });
      if (!response.ok) throw new Error(`Google Translate failed: ${response.status} ${await response.text()}`);
      const body = await response.json() as { data?: { translations?: Array<{ translatedText?: string; }>; }; };
      const translations = body.data?.translations;
      if (!translations || translations.length !== items.length) {
        throw new Error('Google Translate returned an unexpected response');
      }
      return items.map((item, index) => ({ id: item.id, translation: translations[index].translatedText ?? '' }));
    },
  });
}

export function createDeepLTranslator(options?: ProviderOptions): Translator {
  return defineTranslator({
    batch: 50,
    tag: true,
    support: ({ sourceLanguageId, targetLanguageId }) =>
      deeplSourceLanguages.has(sourceLanguageId.toLowerCase()) &&
      deeplTargetLanguages.has(targetLanguageId.toLowerCase()),
    translate: async ({ items, sourceLanguageId, targetLanguageId, env }) => {
      const resolved = typeof options === 'function' ? options({ env }) : options ?? {};
      const key = resolved.apiKey ?? env(resolved.apiKeyEnv ?? 'DEEPL_API_KEY');
      const endpoint = resolved.endpoint ?? 'https://api-free.deepl.com/v2/translate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: items.map((item) => item.source),
          source_lang: sourceLanguageId.toUpperCase(),
          target_lang: targetLanguageId.toUpperCase(),
        }),
      });
      if (!response.ok) throw new Error(`DeepL translation failed: ${response.status} ${await response.text()}`);
      const body = await response.json() as { translations?: Array<{ text?: string; }>; };
      const translations = body.translations;
      if (!translations || translations.length !== items.length) {
        throw new Error('DeepL returned an unexpected response');
      }
      return items.map((item, index) => ({ id: item.id, translation: translations[index].text ?? '' }));
    },
  });
}

export const googleTranslate = createGoogleTranslator;
export const deeplTranslate = createDeepLTranslator;
