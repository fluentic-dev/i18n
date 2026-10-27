import React, { createContext, useContext, useRef, useSyncExternalStore } from 'react';
import type { MessageFormatOptions } from './core/types';
import { createI18nManager, defaultManaged, type I18nSnapshot, type ManagedI18n } from './manager';
import { defaultRuntime, getRuntime, type PartsRenderer, type Runtime, withRuntime } from './shared/runtime';
declare module '@fluentic/i18n/types' {
  interface I18nJsxConfig {
    JSX: React.ReactElement;
    Element: React.ReactElement;
    Value: React.ReactNode;
  }
}
const Context = createContext<ManagedI18n | null>(null);
function TranslatedMessage({ render }: { render: PartsRenderer; }) {
  const managed = useContext(Context);
  const runtime = managed?.runtime ?? getRuntime();
  useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  return React.createElement(
    React.Fragment,
    null,
    ...render(runtime).map((part, index) =>
      React.createElement(React.Fragment, { key: index }, part as React.ReactNode)
    ),
  );
}
export function installReactAdapter(runtime: Runtime): void {
  runtime.jsxHandler = (_options: MessageFormatOptions, render: PartsRenderer) =>
    React.createElement(TranslatedMessage, { render });
  runtime.tagElement = (element) => {
    if (!React.isValidElement(element)) throw new TypeError('[i18n] t.tag expects a handler or React element');
    return (chunks) => React.cloneElement(element, undefined, ...chunks as React.ReactNode[]);
  };
}
installReactAdapter(defaultRuntime);
export const I18nManager = defaultManaged.manager;
export const I18nState = {
  get: defaultManaged.state.get,
  subscribe: defaultManaged.state.subscribe,
  use() {
    const managed = useContext(Context) ?? defaultManaged;
    return useSyncExternalStore(managed.state.subscribe, managed.state.get, managed.state.get);
  },
};
export function I18nProvider(
  { children, snapshot, instance }: { children?: React.ReactNode; snapshot?: I18nSnapshot; instance?: ManagedI18n; },
) {
  const ref = useRef<{ managed: ManagedI18n; snapshot?: I18nSnapshot; instance?: ManagedI18n; } | null>(null);
  if (!ref.current || ref.current.snapshot !== snapshot || ref.current.instance !== instance) {
    if (snapshot && instance) throw new Error('[i18n] pass either snapshot or instance, not both');
    const managed = instance ?? createI18nManager();
    installReactAdapter(managed.runtime);
    if (snapshot) managed.manager.hydrate(snapshot);
    ref.current = { managed, snapshot, instance };
  }
  const managed = ref.current.managed;
  const state = useSyncExternalStore(managed.state.subscribe, managed.state.get, managed.state.get);
  if (!state.ready) throw new Error('[i18n] initialize the provider instance or pass a ready snapshot');
  return React.createElement(Context.Provider, { value: managed }, children);
}
/** Explicit binding for text attributes in isolated providers and SSR. */
export function useI18nRuntime(): Runtime {
  const managed = useContext(Context) ?? defaultManaged;
  useSyncExternalStore(managed.state.subscribe, managed.state.get, managed.state.get);
  return managed.runtime;
}
export { createI18nManager, defineTranslationLoader } from './manager';
export type { I18nSnapshot, I18nStorage, ManagedI18n, StateData } from './manager';
/** Bind an existing universal renderer to this provider (including client SSR). */
export function useI18nRenderer<F extends (...args: any[]) => any>(renderer: F): F {
  const runtime = useI18nRuntime();
  return ((...args: Parameters<F>) => withRuntime(runtime, () => renderer(...args))) as F;
}
