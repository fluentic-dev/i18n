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
  fr: () => import('./locales/fr.mjs'),
  de: () => import('./locales/de.mjs'),
}));
```

Generate directly importable catalogs with `catalogFormat: 'mjs'`, `'cjs'`, or `'json'`. Module defaults are unwrapped. JSONL remains accepted as text when an application loads it through a host-specific raw import or fetch. Missing map entries return an empty catalog. A plain object such as `{hello: 'Bonjour'}` is not a catalog.

## Caching and errors

The manager caches successfully loaded catalogs and deduplicates pending loads by language. Failed loads can be retried. Calling `setTranslationLoader` replaces the loader, clears catalogs, and requires initialization again. This makes refresh/invalidation explicit.

A switch commits language and ready state only after all required catalogs load. Failure leaves the old language active. When switches overlap, only the newest switch commits; earlier successful catalogs may still be cached for later use.

### Persistent browser cache

`@fluentic/i18n-web` can wrap a loader with the CLI-generated per-language hash manifest. Loader results are stored as JSON in localStorage and reused while that language's hash is unchanged:

```ts
import { defineTranslationLoader } from '@fluentic/i18n';
import { createTranslationCacheLoader, I18nManager } from '@fluentic/i18n-web';

const loader = defineTranslationLoader(async ({ languageId }) => {
  const response = await fetch(`/i18n/${languageId}/merged.jsonl`);
  if (!response.ok) throw new Error(`Unable to load ${languageId}`);
  return response.text();
});

const cacheLoader = createTranslationCacheLoader(loader, {
  hash: () => import('../../i18n/data/translations/hash.json'),
  storageKey: 'my-app:i18n',
  storageMode: 'last', // Optional: 'all' (default) or 'last'.
});

I18nManager.setTranslationLoader(cacheLoader.loader);

cacheLoader.remove('fr'); // Evict one persisted language.
cacheLoader.clear(); // Remove all catalogs saved by this wrapper.
```

The hash option also accepts the imported JSON object directly or a function returning a promise. Module defaults are unwrapped. A missing language hash bypasses persistent caching. Corrupt cache entries are ignored, and localStorage availability or quota errors do not prevent the underlying loader from returning translations. Cache removal affects persistent data; an already initialized manager may still hold that language in memory.

`storageMode: 'all'` retains every loaded language and is the default. `'last'` replaces persistent entries with only the successfully selected language. The manager notifies the cache even when switching back to an in-memory catalog; concurrent base/fallback loads cannot become the persisted selection. Failed and superseded switches retain the prior cache. If the selected language has no hash, the old entries are removed after success, and the selected language remains uncached. Install matching core and web versions for this selection-aware behavior.

For standalone calls to `cacheLoader.loader`, `'last'` retains the most recently requested successful catalog (including cache hits). A slower earlier request cannot overwrite a newer result. The option affects only this wrapper's storage key, not other localStorage data or the manager's in-memory catalogs. If browser storage refuses a write, translation loading still succeeds and the existing stored data may remain.

To force a same-session reload after removing persisted data, replace the loader to clear the manager's in-memory catalogs and initialize again:

```ts
cacheLoader.remove('fr');
I18nManager.setTranslationLoader(cacheLoader.loader);
await I18nManager.init();
```

Normally this is unnecessary: a new application load compares the current manifest with persisted hashes automatically.

## Regional and fallback catalogs

For `fr-CA`, the manager loads the selected locale, base `fr`, and the configured fallback language. Lookup follows that order and then uses the source message. The loader should return an empty catalog for a supported source language that has no translation file.

Uncompiled catalogs try the context/source key and then the unscoped source key. Compiled catalogs use the exact context-sensitive hash and fall back to the source message when it is absent. The regular runtime computes that hash when looking up messages in compiled catalogs, so compiled catalogs also work without the source plugin.

## Format validation

Uncompiled JSONL contains `[source, translation]` or `[context, source, translation]` on each line. Compiled JSONL starts with `{"compiled":true}`, followed by `[hash, compactMessage]` rows. The same rows can be supplied as an array, including the header for compiled catalogs. JSON catalogs end with a `null` sentinel, which the manager ignores. Empty authoring translations are omitted. Compiled rows are structurally validated once at load time; plain literals are strings and other messages contain compact instructions. The compiled runtime rejects uncompiled translations if a lookup returns one. Keep compiled catalogs and runtime versions together when deploying.

See [manager setup](./manager), [compilation](./compilation), and [Next.js](./nextjs).
