---
title: Catalog hashes and cache invalidation
sidebar_label: Catalog hashes
---

# Catalog hashes and cache invalidation

The CLI writes per-language content hashes to `i18n/data/translations/hash.json` during merging. Use them to invalidate cached catalogs when translations change.

## Hash manifest

```json
{ "fr": 4274974171, "de": 1820034421 }
```

These are illustrative values. A merge calculates a numeric hash from each target's final runtime catalog rows. Translation changes and compiler options that alter emitted rows change the hash. Notes, authoring metadata, and output-format whitespace do not. Set `hashes: false` to stop generating the file.

## Invalidate cached catalogs

Publish the hash file beside your catalogs. The web package provides the production wrapper for comparing it with locally cached catalogs:

```ts
import { createTranslationCacheLoader, I18nManager } from '@fluentic/i18n-web';

const cache = createTranslationCacheLoader(loader, {
  hash: () => import('./i18n/data/translations/hash.json'),
});

I18nManager.setTranslationLoader(cache.loader);
```

Keep the catalog and its matching hash together. A versioned deployment or HTTP cache policy can also solve this without custom hash logic.

The default manager keeps an in-memory catalog cache. `createTranslationCacheLoader` adds hash-aware localStorage persistence for browser SPAs and exposes `remove(languageId)` and `clear()`. See [translation loaders](../runtime/loading#persistent-browser-cache) for the complete API and behavior.

Both `merge` and `update` regenerate the manifest; `extract`, `translate`, and `import` alone do not. See [CLI commands](./overview#other-commands).

These hashes are change hints, not cryptographic integrity checks.
