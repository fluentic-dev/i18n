import type { MessageFormatOptions, MessageTagHandler, TranslationGetter } from '../core/types';

export type Formats = {
  number: Record<string, Intl.NumberFormatOptions>;
  date: Record<string, Intl.DateTimeFormatOptions>;
  time: Record<string, Intl.DateTimeFormatOptions>;
};

export type FormatContext = { languageId: string; };
export type FormatFactory<T> = T | ((context: FormatContext) => T);
export type RegistryConfig = { [K in keyof Formats]: Record<string, FormatFactory<Formats[K][string]>>; };
export type PartsRenderer = (runtime?: Runtime) => unknown[];

export type Runtime = {
  languageId: string;
  ready: boolean;
  translationsEnabled: boolean;
  translationGetter: TranslationGetter | null;
  formats: Partial<Formats>;
  registry: RegistryConfig;
  jsxLineBreak: unknown;
  jsxHandler: ((options: MessageFormatOptions, render: PartsRenderer) => unknown) | null;
  tagElement: ((element: unknown) => (chunks: unknown[]) => unknown) | null;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
};

export function createRuntime(): Runtime {
  return {
    languageId: 'en',
    ready: false,
    translationsEnabled: true,
    translationGetter: null,
    formats: {},
    registry: { number: {}, date: {}, time: {} },
    jsxLineBreak: '\n',
    jsxHandler: null,
    tagElement: null,
    subscribe: () => () => {},
    getSnapshot: () => null,
  };
}

export const defaultRuntime = createRuntime();
let resolver = () => defaultRuntime;

export function setRuntimeResolver(next: () => Runtime): void {
  resolver = next;
}

export function getRuntime(): Runtime {
  return resolver();
}

export function setTranslationGetter(getter: TranslationGetter | null): void {
  getRuntime().translationGetter = getter;
}

export function setLanguageId(languageId: string): void {
  getRuntime().languageId = languageId;
}

export function setFormats(formats: Partial<Formats>): void {
  getRuntime().formats = formats;
}

export function setGetJsxHandler(handler: Runtime['jsxHandler']): void {
  getRuntime().jsxHandler = handler;
}

export const I18nRegistry = {
  addNumberFormat(name: string, format: FormatFactory<Intl.NumberFormatOptions>) {
    getRuntime().registry.number[name] = format;
  },
  addDateFormat(name: string, format: FormatFactory<Intl.DateTimeFormatOptions>) {
    getRuntime().registry.date[name] = format;
  },
  addTimeFormat(name: string, format: FormatFactory<Intl.DateTimeFormatOptions>) {
    getRuntime().registry.time[name] = format;
  },
  setLanguageId,
  getConfig(): RegistryConfig {
    const r = getRuntime().registry;

    return { number: { ...r.number }, date: { ...r.date }, time: { ...r.time } };
  },
};

export function getFormats(runtime: Runtime, languageId: string): Partial<Formats> {
  const resolve = <T>(entries: Record<string, FormatFactory<T>>) =>
    Object.fromEntries(
      Object.entries(entries).map((
        [key, value],
      ) => [key, typeof value === 'function' ? (value as (context: FormatContext) => T)({ languageId }) : value]),
    );

  return {
    number: { ...runtime.formats.number, ...resolve(runtime.registry.number) },
    date: { ...runtime.formats.date, ...resolve(runtime.registry.date) },
    time: { ...runtime.formats.time, ...resolve(runtime.registry.time) },
  };
}

export function noTranslate<T>(fn: () => T): T {
  const runtime = getRuntime();
  const previous = runtime.translationsEnabled;
  runtime.translationsEnabled = false;

  try {
    return fn();
  } finally {
    runtime.translationsEnabled = previous;
  }
}

export function createTagHandler<T, R>(handler: (chunks: Array<string | T>) => R): MessageTagHandler<T, R> {
  Object.defineProperty(handler, '__fluenticTagHandler', { value: true });

  return handler as MessageTagHandler<T, R>;
}
/** Synchronous binding only: async callers must keep and use their own instance. */
export function withRuntime<T>(runtime: Runtime, fn: () => T): T {
  const previous = resolver;
  resolver = () => runtime;

  try {
    return fn();
  } finally {
    resolver = previous;
  }
}
