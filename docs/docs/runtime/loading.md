---
title: Translation loaders
sidebar_label: Translation loaders
---

# Translation loaders

A loader receives `{languageId}` and returns JSONL text, `{jsonl}`, or an array of catalog rows. It may return a promise.

```ts
import { defineTranslationLoader } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';
I18nManager.setTranslationLoader(defineTranslationLoader({
  en: [],
  fr: () => import('./locales/fr.jsonl'),
  de: () => import('./locales/de.jsonl'),
}));
```

The compiler bundler adapters load `.jsonl` modules as strings; Vite also supports its own `?raw` imports. Module defaults are unwrapped. Missing map entries return an empty catalog. A plain object such as `{hello: 'Bonjour'}` is not a catalog.

## Caching and errors

The manager caches successfully loaded catalogs and deduplicates pending loads by language. Failed loads can be retried. Calling `setTranslationLoader` replaces the loader, clears catalogs, and requires initialization again. This makes refresh/invalidation explicit.

A switch commits language and ready state only after all required catalogs load. Failure leaves the old language active. When switches overlap, only the newest switch commits; earlier successful catalogs may still be cached for later use.

## Regional and fallback catalogs

For `fr-CA`, the manager loads the selected locale, base `fr`, and the configured fallback language. Lookup follows that order and then uses the source message. The loader should return an empty catalog for a supported source language that has no translation file.

Uncompiled catalogs try the context/source key and then the unscoped source key. Compiled catalogs use the exact context-sensitive hash and fall back to the source message when it is absent. The regular runtime computes that hash when looking up messages in compiled catalogs, so compiled catalogs also work without the source plugin.

## Format validation

Uncompiled JSONL contains `[source, translation]` or `[context, source, translation]` on each line. Compiled JSONL starts with `{"compiled":true}`, followed by `[hash, compactMessage]` rows. The same rows can be supplied as an array, including the header for compiled catalogs. JSON catalogs end with a `null` sentinel, which the manager ignores. Empty authoring translations are omitted. Compiled rows are structurally validated once at load time; plain literals are strings and other messages contain compact instructions. The compiled runtime rejects uncompiled translations if a lookup returns one. Keep compiled catalogs and runtime versions together when deploying.

See [manager setup](./manager), [compilation](./compilation), and [Next.js](./nextjs).
