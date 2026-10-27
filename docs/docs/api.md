---
title: API reference
---

# API reference

This page summarizes the public message, runtime, state, and formatting APIs. For usage examples, see [Define and render messages](./intro).

## Messages

Import messages from `@fluentic/i18n` on every platform. `/core` is a compatibility alias. A platform adapter supplies JSX rendering.

| API                                   | Behavior                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `t.msg(source, schema?)`              | Define a typed descriptor without translating it; schema values are `String`, `Number`, `Boolean`, or `Date` |
| `t.text(sourceOrDescriptor, params?)` | Format a string; typed descriptors require their declared params                                             |
| `t.jsx(sourceOrDescriptor, params?)`  | Return a React element that updates on language changes; core uses the configured JSX handler                |
| `t.try(renderer, value, params?)`     | Use `t.text` or `t.jsx` for descriptors and return other values unchanged                                    |
| `t.clone(descriptor)`                 | Copy a descriptor while preserving its message literal and param schema                                      |
| `t.params(params?)`                   | Return the param object, or `{}` for nullish input                                                           |
| `t.tag(handlerOrElement)`             | Mark a tag callback; React adapters also accept an element to clone                                          |
| `t.notranslate(callback)`             | Skip lookup during a synchronous callback; still run ICU formatting                                          |

`context(name)`, `note(text)`, and `meta(value)` return a scoped message API. Chain them before `msg`, `text`, or `jsx`. Context contributes to identity; notes accumulate; metadata is replaced by the latest value.

All three message methods are [extraction markers](./cli/overview#2-understand-extraction). Use [context](./learn/metadata) for identical source text with different meanings and [tags](./learn/tags) for JSX inside messages.

For a descriptor defined before use, declare its required param types once:

```ts
const greeting = t.msg('Hello, {name}!', { name: String });

t.text(greeting, { name: 'Ada' });
t.jsx(greeting, { name: 'Ada' });
t.try(t.text, greeting, { name: 'Ada' });
```

The declaration is retained in the descriptor type, including the original message literal, so IDE hover information remains useful. Render-time values may be real values or language-aware callbacks. See [formats and dynamic values](./learn/formatting).

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

See [translation loaders](./runtime/loading) for language maps and [language management](./runtime/manager) for initialization, persistence, and errors. `createI18nManager()` does not replace the default runtime. Pass the initialized instance to `I18nProvider` for an isolated subtree.

A loader receives `{ languageId }` and returns JSONL, `{ jsonl: string }`, or `TranslationItem[]` / compiled tuple rows, synchronously or asynchronously. A storage adapter has `read()` and `write({ languageId })`, both optionally asynchronous.

## State

| API                             | Behavior                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| `I18nState.get()`               | Read `{ languageId, isLoading, ready }`                     |
| `I18nState.use()`               | Subscribe a React component and return the current snapshot |
| `I18nState.subscribe(listener)` | Listen for updates; returns an unsubscribe function         |

`t.jsx()` subscribes internally. For strings computed during React rendering, call `I18nState.use()` in the component; see [state and reactivity](./runtime/state).

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

`I18nProvider` accepts an initialized `instance` or a serializable `snapshot`. `useI18nRenderer(t.text)` binds string formatting to that provider and subscribes to changes. Both `t.text()` and `t.jsx()` remain synchronous; setup loads translations before rendering.

The Next.js server entry exports `ready()`, `resolveI18n(config)`, and `runWithI18n(config, callback)`. Its RSC provider resolves the request snapshot; the client implementation hydrates it. See [Next.js](./runtime/nextjs).

## Compiler

`@fluentic/i18n/compiler` exports `transform`, `collectMessages`, `compileMessage`, `compileCatalog`, `messageId`, and `COMPACT_VERSION`. These are Node build-time APIs. See [bundler plugins](./runtime/compilation) for integration and same-file tracing rules.
