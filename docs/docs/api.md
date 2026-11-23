---
title: API reference
---

# API reference

This page summarizes the public message, runtime, state, and formatting APIs. For usage examples, see [Define and render messages](./intro).

## Messages

Import messages from `@fluentic/i18n` on every platform. `/core` is a compatibility alias. A platform adapter supplies JSX rendering.

| API                                   | Behavior                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `t.msg(source, schema?)`              | Define a typed descriptor without translating it; schema values are `String`, `Number`, `Boolean`, `Date`, or `t.msg` |
| `t.msg(descriptor, params)`           | Copy a descriptor with typed params bound for later rendering; no translation happens yet                             |
| `t.text(sourceOrDescriptor, params?)` | Format a string; typed descriptors require their declared params                                                      |
| `t.jsx(sourceOrDescriptor, params?)`  | Return a React element that updates on language changes; core uses the configured JSX handler                         |
| `t.jsx(() => element)`                | Wrap one React element in a fine-grained boundary that reruns only its callback on language changes                   |
| `t.try(renderer, value, params?)`     | Use `t.text` or `t.jsx` for descriptors and return other values unchanged                                             |
| `t.clone(descriptor)`                 | Copy a descriptor while preserving its message literal and param schema                                               |
| `t.params(params?)`                   | Return the param object, or `{}` for nullish input                                                                    |
| `t.tag(handlerOrElement)`             | Mark a tag callback; React adapters also accept an element to clone                                                   |
| `t.notranslate(callback)`             | Skip lookup during a synchronous callback; still run ICU formatting                                                   |

`context(name)`, `note(text)`, and `meta(value)` return a scoped message API. Chain them before `msg`, `text`, or `jsx`. Context contributes to identity; notes accumulate; metadata is replaced by the latest value.

All three message methods are [extraction markers](./cli/overview#2-understand-extraction). Use [context](./learn/metadata) for identical source text with different meanings and [tags](./learn/tags) for JSX inside messages.

`{break}` is a reserved built-in param for an intentional line break and does not need a runtime value. Physical line wrapping in source strings and translations is normalized to spaces; see [explicit line breaks](./learn/formatting#add-an-explicit-line-break).

For a descriptor defined before use, declare its required param types once:

```ts
const greeting = t.msg('Hello, {name}!', { name: String });

t.text(greeting, { name: 'Ada' });
t.jsx(greeting, { name: 'Ada' });
t.try(t.text, greeting, { name: 'Ada' });
```

Bind values inside a component when you want to assemble messages first and render them later:

```tsx
const revenueBy = t.msg('Revenue, by {basis}', { basis: t.msg });
const stayNight = t.msg('stay night');

function Metric() {
  const label = t.msg(revenueBy, { basis: stayNight });

  return <span>{t.jsx(label)}</span>;
}
```

`t.msg(descriptor, params)` requires all params declared by the original schema and returns a new, frozen descriptor. It copies the params and preserves the original context, notes, metadata, and compiled identity. The original descriptor is unchanged. Callbacks and nested descriptors resolve at render time, so `t.jsx(bound)` continues to update when the language changes. `String` fields accept external strings or callbacks returning strings. Fields declared as `t.msg` require message descriptors or callbacks returning descriptors; bind any required params on the nested message first.

`t.text(bound)`, `t.jsx(bound)`, and `t.try(t.text, bound)` need no additional params. You can pass typed overrides at render time or create another descriptor with `t.msg(bound, overrides)`; those overrides merge with the bound values. Initial binding requires all declared params, rather than supporting partial binding.

Descriptors are opaque: unique-symbol type markers retain the original message literal and param types for inference, while runtime fields stay internal. Use `isMessageDescriptor()` to identify them and `t.clone()` to copy them rather than reading fields or spreading descriptor objects. Render-time values may be real values or language-aware callbacks. See [formats and dynamic values](./learn/formatting).

## Language and catalogs

Import management from `@fluentic/i18n-web` or `@fluentic/i18n-rn`. Next.js has request-oriented APIs described below. `defineTranslationLoader` also remains available from the universal core.

| API                                                              | Behavior                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `I18nManager.configure({ languageId, fallbackLanguageId? })`     | Set runtime language options synchronously; doesn't load catalogs      |
| `I18nManager.setTranslationLoader(loaderOrNull)`                 | Register one loader for all languages                                  |
| `defineTranslationLoader(loaderOrMap)`                           | Type a loader callback or adapt a language map into a loader           |
| `I18nManager.init()`                                             | Restore saved language and load its catalog; returns a promise         |
| `I18nManager.setLanguageId(id)`                                  | Select, load, and persist a language; returns a promise                |
| `I18nManager.getLanguageId()`                                    | Read the selected language                                             |
| `I18nManager.getTranslation({ languageId?, context?, message })` | Look up a translation template or return `null`; doesn't format params |
| `I18nManager.setStorage(adapterOrNull)`                          | Replace or disable preference storage                                  |
| `createI18nManager({ storage? })`                                | Create an isolated `{manager, state, runtime}` instance                |
| `createTranslationCacheLoader(loader, { hash })`                 | Wrap a web loader with hash-aware localStorage persistence             |

See [translation loaders](./runtime/loading) for language maps and [language management](./runtime/manager) for initialization, persistence, and errors. `createI18nManager()` does not replace the default runtime. Pass the initialized instance to `I18nProvider` for an isolated subtree.

A loader receives `{ languageId }` and returns JSONL, `{ jsonl: string }`, or `TranslationItem[]` / compiled tuple rows, synchronously or asynchronously. A storage adapter has `read()` and `write({ languageId })`, both optionally asynchronous.

`createTranslationCacheLoader()` returns `{loader, remove(languageId), clear()}`. Pass `loader` to the manager; the controls affect its persistent browser data. Its `hash` option accepts a manifest object, imported module, promise, or synchronous/async function returning one. `storageMode?: 'last' | 'all'` defaults to `'all'`; `'last'` persists only the successfully selected language, including switches to in-memory catalogs. See [persistent browser cache](./runtime/loading#persistent-browser-cache).

## State

| API                             | Behavior                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| `I18nState.get()`               | Read `{ languageId, isLoading, ready }`                     |
| `I18nState.use()`               | Subscribe a React component and return the current snapshot |
| `I18nState.subscribe(listener)` | Listen for updates; returns an unsubscribe function         |

`t.jsx(message)` subscribes internally. For string props, use `I18nState.use()` to rerender the whole component or `t.jsx(() => element)` as a targeted single-element boundary. See [state and reactivity](./runtime/state).

## Formats

| API                                                    | Behavior                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `I18nRegistry.addNumberFormat(name, optionsOrFactory)` | Name a number format                                          |
| `I18nRegistry.addDateFormat(name, optionsOrFactory)`   | Name a date format                                            |
| `I18nRegistry.addTimeFormat(name, optionsOrFactory)`   | Name a time format                                            |
| `I18nRegistry.getConfig()`                             | Read a copy of the registered format maps                     |
| `I18nRegistry.setLanguageId(id)`                       | Set the formatter locale only; doesn't load or notify the app |

Factories receive `{ languageId }`. Use the manager to change the app's language; registry setters are lower-level operations.

## Integration primitives

`@fluentic/i18n/adapter` exports runtime factories, generic managers, storage helpers, renderer registration and synchronous `withRuntime`. These modules do not import the dynamic formatter. The universal core exports `setFormats` and `I18nRegistry`.

`isMessageDescriptor` and `isMessageTagHandler` are type guards. Public types include `MessageDescriptor`, `MessageInput`, `MessageParams`, `MessageValueContext`, and `MessageFormatOptions`.

For tooling, see [CLI configuration](./cli/configuration), [translator callbacks](./cli/translators), and [converters](./cli/formats).

## React adapters and Next.js

The web and React Native `I18nProvider` accepts an initialized `instance`. `useI18nRenderer(t.text)` binds string formatting to an isolated provider runtime. The Next.js provider owns its server-to-client hydration boundary, and its compiler generates the internal binding for Client Component `t.text()` calls, so application source uses plain `t.text()` and `t.jsx()` on both sides.

## Server hydration

Snapshot transfer is isolated from the normal SPA manager API. SSR adapters can import it explicitly:

```ts
import { getSnapshot, hydrate } from '@fluentic/i18n/hydration';
```

`getSnapshot(instance)` captures the initialized language, fallback, loaded catalogs, formats, and compiled-catalog markers. `hydrate(instance, snapshot)` restores them into another isolated manager without loading catalogs. Next.js uses this module internally; client-only SPAs do not need it.

The Next.js server entry exports `ready()`, `i18nFn(fn)`, `resolveI18n(config)`, and the low-level `runWithI18n(config, callback)`. Cookie and URL-prefix handler subpaths expose strategy-specific server integrations plus client factories that both return `{handler}`. Next's `I18nManager.setLanguageId(id, handler)` delegates to one of those handler functions and never loads catalogs in the browser. See [Next.js](./runtime/nextjs).

## Compiler

The separate Node-only `@fluentic/i18n-compiler` package exports `transform`, `collectMessages`, `compileMessage`, `compileCatalog`, `messageId`, and `COMPACT_VERSION`. Its `/vite`, `/rollup`, `/esbuild`, `/webpack`, `/babel`, and `/nextjs` subpaths provide build integrations without adding Node types or compiler dependencies to `@fluentic/i18n`. See [bundler plugins](./runtime/compilation) for integration and same-file tracing rules.
