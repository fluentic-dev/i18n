import type { Formats, I18nManagerOptions, TranslationData, TranslationLoader } from '@fluentic/i18n/adapter';
export type RequestConfig = I18nManagerOptions & {
  translationLoader?: TranslationLoader;
  translations?: TranslationData;
  formats?: Partial<Formats>;
};
export type RequestConfigFactory = () => RequestConfig | Promise<RequestConfig>;
export function defineRequestConfig<T extends RequestConfigFactory>(factory: T): T {
  return factory;
}
