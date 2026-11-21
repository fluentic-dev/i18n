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

export type TranslatorFilterOptions = {
  /** Target language IDs to allow. Omit to allow all languages supported by the translator. */
  allow?: readonly string[];
  /** Target language IDs to deny. Takes precedence over allow. */
  deny?: readonly string[];
};

/** Restrict a translator's supported target languages using case-insensitive, exact IDs. */
export function filterTranslator(translator: Translator, options: TranslatorFilterOptions): DefinedTranslator {
  const provider: TranslatorOptions = typeof translator === 'function' ? { translate: translator } : translator;
  const allow = options.allow && new Set(options.allow.map((id) => id.toLowerCase()));
  const deny = new Set(options.deny?.map((id) => id.toLowerCase()));

  return defineTranslator({
    ...provider,
    support: (request) => {
      const target = request.targetLanguageId.toLowerCase();
      if ((allow && !allow.has(target)) || deny.has(target)) return false;
      return provider.support ? provider.support(request) : true;
    },
  });
}
