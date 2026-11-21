import { createI18nManager } from '@fluentic/i18n/adapter';
import { hydrate, type I18nSnapshot } from '@fluentic/i18n/hydration';
import { I18nProvider as ReactProvider, I18nState } from '@fluentic/i18n/react';
import React from 'react';
import type { LanguageChangeHandler, LanguageChangeOptions, NextI18nManager } from './language';

/** Hydrates the document runtime. Next.js remains the source of truth for language changes. */
export function I18nProvider(
  { children, snapshot }: { children?: React.ReactNode; snapshot?: I18nSnapshot; },
) {
  const ref = React.useRef<{ snapshot: I18nSnapshot; instance: ReturnType<typeof createI18nManager>; } | null>(null);

  if (!snapshot) throw new Error('[i18n] the client hydration boundary requires a server snapshot');

  if (!ref.current || ref.current.snapshot !== snapshot) {
    const instance = createI18nManager();
    hydrate(instance, snapshot);
    ref.current = { snapshot, instance };
  }

  return React.createElement(ReactProvider, { instance: ref.current.instance }, children);
}

export const I18nManager: NextI18nManager = {
  setLanguageId<LanguageId extends string>(
    languageId: LanguageId,
    handler: LanguageChangeHandler<LanguageId>,
    options?: LanguageChangeOptions,
  ) {
    if (!handler) {
      throw new Error('[i18n] Next.js language changes require a URL or cookie language handler');
    }

    return handler(languageId, options);
  },
};

export { I18nState };
export type { I18nSnapshot } from '@fluentic/i18n/hydration';
export { defineLanguages } from './language';
export type { LanguageChangeHandler, LanguageChangeOptions, LanguageDefinition, NextI18nManager } from './language';
