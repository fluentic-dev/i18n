import * as formatting from './core/format';
import { createT } from './core/i18n';

export const t = /* @__PURE__ */ createT(formatting);
export type { MessageApi, TApi } from './core/i18n';
export * from './core/types';
export { I18nRegistry, noTranslate, setFormats } from './shared/runtime';
export { defineTranslationLoader } from './translation-manager';
export type { TranslationData, TranslationItem, TranslationLoader, TranslationLoaderMap } from './translation-manager';
