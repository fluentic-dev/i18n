import { defineTranslator } from './translator';
import type { ProviderTranslatorOptions, ProviderTranslatorOptionsFactory, Translator } from './types';

const deeplSourceLanguages = new Set(
  'ar bg cs da de el en es et fi fr he hu id it ja ko lt lv nb nl pl pt ro ru sk sl sv th tr uk vi zh'.split(' '),
);
const deeplTargetLanguages = new Set(
  'ar bg cs da de el en en-gb en-us es es-419 et fi fr he hu id it ja ko lt lv nb nl pl pt pt-br pt-pt ro ru sk sl sv th tr uk vi zh zh-hans zh-hant'
    .split(
      ' ',
    ),
);

type ProviderOptions = ProviderTranslatorOptions | ProviderTranslatorOptionsFactory;

export function createGoogleTranslator(options?: ProviderOptions): Translator {
  return defineTranslator({
    batch: 50,
    tag: false,
    support: () => true,
    translate: async ({ items, sourceLanguageId, targetLanguageId, env }) => {
      const resolved = resolveOptions(options, env);
      const key = resolved.apiKey ?? env(resolved.apiKeyEnv ?? 'GOOGLE_TRANSLATE_API_KEY');
      const endpoint = resolved.endpoint ?? 'https://translation.googleapis.com/language/translate/v2';
      const url = providerUrl(endpoint);
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
      if (!response.ok) throw providerError('Google Translate', response.status);
      const body = await response.json().catch(() => {
        throw new Error('Translation service returned invalid JSON. Check the configured endpoint and try again.');
      }) as { data?: { translations?: Array<{ translatedText?: string; }>; }; };
      const translations = body.data?.translations;
      if (
        !Array.isArray(translations) || translations.length !== items.length ||
        translations.some((item) => !item || typeof item.translatedText !== 'string')
      ) {
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
      const resolved = resolveOptions(options, env);
      const key = resolved.apiKey ?? env(resolved.apiKeyEnv ?? 'DEEPL_API_KEY');
      const endpoint = resolved.endpoint ?? 'https://api-free.deepl.com/v2/translate';
      const response = await fetch(providerUrl(endpoint), {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: items.map((item) => item.source),
          source_lang: sourceLanguageId.toUpperCase(),
          target_lang: targetLanguageId.toUpperCase(),
        }),
      });
      if (!response.ok) throw providerError('DeepL', response.status);
      const body = await response.json().catch(() => {
        throw new Error('Translation service returned invalid JSON. Check the configured endpoint and try again.');
      }) as { translations?: Array<{ text?: string; }>; };
      const translations = body.translations;
      if (
        !Array.isArray(translations) || translations.length !== items.length ||
        translations.some((item) => !item || typeof item.text !== 'string')
      ) {
        throw new Error('DeepL returned an unexpected response');
      }
      return items.map((item, index) => ({ id: item.id, translation: translations[index].text ?? '' }));
    },
  });
}

function resolveOptions(
  options: ProviderOptions | undefined,
  env: (name: string) => string,
): ProviderTranslatorOptions {
  const value = typeof options === 'function' ? options({ env }) : options ?? {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid translator options. Return an options object from the provider factory.');
  }
  for (const field of ['apiKey', 'apiKeyEnv', 'endpoint'] as const) {
    if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) {
      throw new Error(`Invalid translator option "${field}". Use a non-empty string.`);
    }
  }
  return value;
}

function providerUrl(endpoint: string): URL {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return url;
  } catch {
    throw new Error('Invalid translator endpoint. Use a full http:// or https:// URL.');
  }
}

function providerError(provider: string, status: number): Error {
  const advice = status === 401 || status === 403
    ? 'Check your API key and service permissions.'
    : status === 429
    ? 'Rate limit reached. Wait before retrying, or check your quota.'
    : status === 456
    ? 'Translation quota exceeded. Check your plan and usage.'
    : status >= 500
    ? 'The service is temporarily unavailable. Try again later.'
    : 'Check the language pair, request size, and configured endpoint.';
  return new Error(`${provider} request failed (HTTP ${status}). ${advice}`);
}
