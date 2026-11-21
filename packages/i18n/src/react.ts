import React, { createContext, useContext, useRef, useSyncExternalStore } from 'react';
import type { MessageFormatOptions } from './core/types';
import { createI18nManager, defaultManaged, type ManagedI18n } from './manager';
import { defaultRuntime, getRuntime, type PartsRenderer, type Runtime, withRuntime } from './shared/runtime';

declare module './types' {
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

function ReactiveJsxCallback({ render }: { render: () => React.ReactNode; }) {
  const managed = useContext(Context);
  const runtime = managed?.runtime ?? getRuntime();
  useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);

  return React.createElement(React.Fragment, null, withRuntime(runtime, render));
}

export function installReactAdapter(runtime: Runtime, lineBreak: React.ReactNode = React.createElement('br')): void {
  runtime.jsxLineBreak = lineBreak;
  runtime.jsxHandler = (_options: MessageFormatOptions, render: PartsRenderer) =>
    React.createElement(TranslatedMessage, { render });
  runtime.jsxCallbackHandler = (render) =>
    React.createElement(ReactiveJsxCallback, { render: render as () => React.ReactNode });
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
  { children, instance, lineBreak }: {
    children?: React.ReactNode;
    instance?: ManagedI18n;
    lineBreak?: React.ReactNode;
  },
) {
  const ref = useRef<
    { managed: ManagedI18n; instance?: ManagedI18n; lineBreak?: React.ReactNode; } | null
  >(null);

  if (!ref.current || ref.current.instance !== instance || ref.current.lineBreak !== lineBreak) {
    const managed = instance ?? createI18nManager();
    installReactAdapter(managed.runtime, lineBreak);
    ref.current = { managed, instance, lineBreak };
  }

  const managed = ref.current.managed;
  const state = useSyncExternalStore(managed.state.subscribe, managed.state.get, managed.state.get);

  if (!state.ready) throw new Error('[i18n] initialize the provider instance before rendering');

  return React.createElement(Context.Provider, { value: managed }, children);
}
/** Explicit binding for text attributes in isolated providers and SSR. */
export function useI18nRuntime(): Runtime {
  const managed = useContext(Context) ?? defaultManaged;
  useSyncExternalStore(managed.state.subscribe, managed.state.get, managed.state.get);

  return managed.runtime;
}

export { createI18nManager, defineTranslationLoader } from './manager';
export type { I18nStorage, ManagedI18n, StateData } from './manager';
/** Bind an existing universal renderer to this provider (including client SSR). */
export function useI18nRenderer<F extends (...args: any[]) => any>(renderer: F): F {
  const runtime = useI18nRuntime();

  return ((...args: Parameters<F>) => withRuntime(runtime, () => renderer(...args))) as F;
}
