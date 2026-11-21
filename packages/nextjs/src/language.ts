export type LanguageDefinition<LanguageId extends string = string> = {
  languages: readonly LanguageId[];
  defaultLanguageId: LanguageId;
};

export type LanguageChangeOptions = {
  replace?: boolean;
  scroll?: boolean;
};

export type LanguageChangeHandler<LanguageId extends string = string> = (
  languageId: LanguageId,
  options?: LanguageChangeOptions,
) => Promise<void>;

export type NextI18nManager = {
  setLanguageId<LanguageId extends string>(
    languageId: LanguageId,
    handler: LanguageChangeHandler<LanguageId>,
    options?: LanguageChangeOptions,
  ): Promise<void>;
};

export function defineLanguages<const LanguageId extends string>(
  definition: LanguageDefinition<LanguageId>,
): LanguageDefinition<LanguageId> {
  if (!definition.languages.length) throw new Error('[i18n] configure at least one language');
  if (new Set(definition.languages).size !== definition.languages.length) {
    throw new Error('[i18n] configured languages must be unique');
  }
  if (!definition.languages.includes(definition.defaultLanguageId)) {
    throw new Error('[i18n] defaultLanguageId must be included in languages');
  }

  return definition;
}

export function resolveLanguageId<LanguageId extends string>(
  definition: LanguageDefinition<LanguageId>,
  value: string | null | undefined,
): LanguageId | null {
  return value && definition.languages.includes(value as LanguageId) ? value as LanguageId : null;
}

export function requireLanguageId<LanguageId extends string>(
  definition: LanguageDefinition<LanguageId>,
  value: string,
): LanguageId {
  const languageId = resolveLanguageId(definition, value);
  if (!languageId) throw new RangeError(`[i18n] unsupported language: ${value}`);

  return languageId;
}
