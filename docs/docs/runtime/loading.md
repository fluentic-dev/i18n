---
title: Translation loaders
sidebar_label: Translation loaders
---

# Translation loaders

A loader receives `{languageId}` and returns JSONL text, `{jsonl}`, authoring records, or compiled `[hash, compactMessage]` rows. It may return a promise.

```ts
import { defineTranslationLoader } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';
I18nManager.setTranslationLoader(defineTranslationLoader({
  en: [],
  fr: () => import('./locales/fr.jsonl'),
  de: () => import('./locales/de.jsonl'),
}));
```

The compiler bundler adapters support `.jsonl` modules; Vite also supports its own `?raw` imports. Module defaults are unwrapped. Missing map entries return an empty catalog. A plain object such as `{hello: 'Bonjour'}` is not a catalog.

## Caching and errors

The manager caches successfully loaded catalogs and deduplicates pending loads by language. Failed loads can be retried. Calling `setTranslationLoader` replaces the loader, clears catalogs, and requires initialization again. This makes refresh/invalidation explicit.

A switch commits language and ready state only after all required catalogs load. Failure leaves the old language active. When switches overlap, only the newest switch commits; earlier successful catalogs may still be cached for later use.

## Regional and fallback catalogs

For `fr-CA`, the manager loads the selected locale, base `fr`, and the configured fallback language. Lookup follows that order and then uses the source message. The loader should return an empty catalog for a supported source language that has no translation file.

Contextual messages try their context/source key and then the unscoped source key in dynamic mode. Compiled messages use their exact context-sensitive hash; they fall back to the compiled source when that hash is absent. They do not reconstruct unscoped source keys at runtime.

## Format validation

Dynamic records use `id` or source/context identity plus a string translation. Empty authoring translations are treated as missing. Compiled rows are structurally validated once at load time; plain literals are strings and other messages contain compact instructions. Keep compiled catalogs and runtime format versions together when deploying.

See [manager setup](./manager), [compilation](./compilation), and [Next.js](./nextjs).
