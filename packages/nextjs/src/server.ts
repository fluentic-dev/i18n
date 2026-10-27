import 'server-only';
import requestConfig from '@fluentic/i18n-nextjs/request';
import {
  createI18nManager,
  type I18nSnapshot,
  type ManagedI18n,
  type PartsRenderer,
  setRuntimeResolver,
  withRuntime,
} from '@fluentic/i18n/adapter';
import { AsyncLocalStorage } from 'node:async_hooks';
import React, { cache } from 'react';
import { I18nProvider as ClientProvider } from './client';
import type { RequestConfig } from './config';
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
  return current.manager.getSnapshot();
}
export async function resolveI18n(config: RequestConfig): Promise<I18nSnapshot> {
  return (await initialize(createServerManaged(), config)).manager.getSnapshot();
}
/** Route handlers, server actions: isolate the entire async operation explicitly. */
export async function runWithI18n<T>(config: RequestConfig, fn: () => T | Promise<T>): Promise<T> {
  const managed = await initialize(createServerManaged(), config);
  return explicitScope.run(managed, fn);
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
export const I18nManager: ManagedI18n['manager'] = new Proxy({} as ManagedI18n['manager'], {
  get(_target, key: keyof ManagedI18n['manager']) {
    return (...args: unknown[]) => {
      const manager = (explicitScope.getStore() ?? getManaged()).manager;
      return Reflect.apply(manager[key], manager, args);
    };
  },
});
export const I18nState = {
  get: () => (explicitScope.getStore() ?? getManaged()).state.get(),
  subscribe: (_listener: () => void) => () => {},
  use: () => (explicitScope.getStore() ?? getManaged()).state.get(),
};
export function useI18nRuntime() {
  return (explicitScope.getStore() ?? getManaged()).runtime;
}
export function useI18nRenderer<F extends (...args: any[]) => any>(renderer: F): F {
  const runtime = useI18nRuntime();
  return ((...args: Parameters<F>) => withRuntime(runtime, () => renderer(...args))) as F;
}
export { createI18nManager, defineTranslationLoader } from '@fluentic/i18n/adapter';
