import 'server-only';
import requestConfig from '@fluentic/i18n-nextjs/request';
import { createI18nManager, type ManagedI18n, type PartsRenderer, setRuntimeResolver } from '@fluentic/i18n/adapter';
import { getSnapshot, type I18nSnapshot } from '@fluentic/i18n/hydration';
import { AsyncLocalStorage } from 'node:async_hooks';
import React, { cache } from 'react';
import { I18nProvider as ClientProvider } from './client';
import type { RequestConfig } from './config';
import type { LanguageChangeHandler, LanguageChangeOptions, NextI18nManager } from './language';
export { defineRequestConfig } from './config';
export type { RequestConfig, RequestConfigFactory } from './config';
const explicitScope = new AsyncLocalStorage<ManagedI18n>();
function createServerManaged() {
  const managed = createI18nManager();
  managed.runtime.jsxHandler = (_options, render) => React.createElement(ServerMessage, { render });
  managed.runtime.tagElement = (element) => {
    if (!React.isValidElement(element)) throw new TypeError('[i18n] t.tag expects a React element or handler');
    return (chunks) => React.cloneElement(element, undefined, ...chunks as React.ReactNode[]);
  };
  return managed;
}
const getManaged = cache(createServerManaged);
setRuntimeResolver(() => (explicitScope.getStore() ?? getManaged()).runtime);
async function initialize(managed: ManagedI18n, config: RequestConfig) {
  managed.manager.configure(config);
  if (config.formats) managed.runtime.formats = config.formats;
  managed.manager.setTranslationLoader(
    config.translationLoader ?? (({ languageId }) => languageId === config.languageId ? config.translations ?? [] : []),
  );
  await managed.manager.init();
  return managed;
}
const getRequestManaged = cache(async () => initialize(getManaged(), await requestConfig()));
/** Await in the execution path that uses synchronous t.text; layouts do not order siblings. */
export async function ready(): Promise<I18nSnapshot> {
  const current = explicitScope.getStore() ?? await getRequestManaged();
  return getSnapshot(current);
}
export async function resolveI18n(config: RequestConfig): Promise<I18nSnapshot> {
  return getSnapshot(await initialize(createServerManaged(), config));
}
/** Route handlers, server actions: isolate the entire async operation explicitly. */
export async function runWithI18n<T>(config: RequestConfig, fn: () => T): Promise<Awaited<T>> {
  const managed = await initialize(createServerManaged(), config);
  return await explicitScope.run(managed, fn);
}

/** Wrap any server function with the application request config and an isolated i18n scope. */
export function i18nFn<Arguments extends unknown[], Result>(
  fn: (...args: Arguments) => Result,
): (...args: Arguments) => Promise<Awaited<Result>> {
  const wrapped = async (...args: Arguments) => {
    const result = await runWithI18n(await requestConfig(), () => fn(...args));

    return result;
  };

  return wrapped as (...args: Arguments) => Promise<Awaited<Result>>;
}
function ServerMessage({ render }: { render: PartsRenderer; }) {
  const runtime = (explicitScope.getStore() ?? getManaged()).runtime;
  // t.jsx is synchronous. The caller/provider must initialize before actual rendering.
  return React.createElement(
    React.Fragment,
    null,
    ...render(runtime).map((part, index) =>
      React.createElement(React.Fragment, { key: index }, part as React.ReactNode)
    ),
  );
}
export async function I18nProvider({ children, snapshot }: { children?: React.ReactNode; snapshot?: I18nSnapshot; }) {
  return React.createElement(ClientProvider, { snapshot: snapshot ?? await ready() }, children);
}
// Resolve at invocation time, never capture a request in a module-level singleton.
const requestManager = new Proxy({} as ManagedI18n['manager'], {
  get(_target, key: keyof ManagedI18n['manager']) {
    return (...args: unknown[]) => {
      const manager = (explicitScope.getStore() ?? getManaged()).manager;
      return Reflect.apply(manager[key], manager, args);
    };
  },
});
export const I18nManager: NextI18nManager = {
  setLanguageId<LanguageId extends string>(
    languageId: LanguageId,
    handler: LanguageChangeHandler<LanguageId>,
    options?: LanguageChangeOptions,
  ) {
    if (!handler) throw new Error('[i18n] Next.js language changes require a URL or cookie language handler');

    return handler(languageId, options);
  },
};
export const I18nState = {
  get: () => (explicitScope.getStore() ?? getManaged()).state.get(),
  subscribe: (_listener: () => void) => () => {},
  use: () => (explicitScope.getStore() ?? getManaged()).state.get(),
};
export { createI18nManager, defineTranslationLoader } from '@fluentic/i18n/adapter';
export { defineLanguages } from './language';
export type { LanguageChangeHandler, LanguageChangeOptions, LanguageDefinition, NextI18nManager } from './language';
