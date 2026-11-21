import {
  type Converter,
  type ConverterImportInput,
  type ConverterInput,
  type ConverterOutput,
  defineConfig,
  defineTranslator,
  filterTranslator,
  type ProviderTranslatorOptions,
  type ProviderTranslatorOptionsFactory,
  type TranslationRecord,
  type TranslationRequest,
  type TranslationResult,
  type Translator,
} from '@fluentic/i18n-cli';
import { csvConverter, jsonConverter, xliffConverter } from '@fluentic/i18n-cli/converters';
import { createDeepLTranslator } from '@fluentic/i18n-cli/translators';

// @ts-expect-error Core helpers belong to the root.
import { defineTranslator as providerDefineTranslator } from '@fluentic/i18n-cli/translators';
// @ts-expect-error Core translator types belong to the root.
import type { Translator as ProviderTranslator } from '@fluentic/i18n-cli/translators';
// @ts-expect-error Shared provider options belong to the root.
import type { ProviderTranslatorOptions as SubpathOptions } from '@fluentic/i18n-cli/translators';
// @ts-expect-error Shared converter contracts belong to the root.
import type { Converter as SubpathConverter } from '@fluentic/i18n-cli/converters';
// @ts-expect-error Provider aliases have been removed.
import { deeplTranslate, googleTranslate } from '@fluentic/i18n-cli/translators';

const options: ProviderTranslatorOptions = { apiKeyEnv: 'DEEPL_API_KEY' };
const factory: ProviderTranslatorOptionsFactory = () => options;
const translator: Translator = filterTranslator(createDeepLTranslator(factory), { allow: ['fr'] });
const custom = defineTranslator({
  translate: (request: TranslationRequest): TranslationResult[] =>
    request.items.map(({ id, source }) => ({ id, translation: source })),
});
const converter: Converter = {
  name: 'custom',
  export: (input: ConverterInput): ConverterOutput => ({
    files: [{ path: 'messages.json', content: JSON.stringify(input.items) }],
  }),
  import: (_input: ConverterImportInput): TranslationRecord[] => [],
};
defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  translator: [translator, custom],
  convert: [converter, jsonConverter, csvConverter, xliffConverter],
});
