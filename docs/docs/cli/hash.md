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

These are illustrative values. A merge calculates a numeric hash from each target's ordered `[id, translation]` pairs. Changes to notes or metadata alone do not change it; record order can. Set `hashes: false` to stop generating the file.

## Invalidate cached catalogs

Publish the hash file beside your catalogs. Your loader can fetch a fresh hash manifest, compare the selected language's hash with a cached entry, and reuse the cached JSONL when it matches. Otherwise, fetch and cache the new catalog.

Keep the catalog and its matching hash together. A versioned deployment or HTTP cache policy can also solve this without custom hash logic.

The default manager doesn't fetch this manifest or implement persistent catalog caching. It remembers the language preference; your loader owns catalog caching. See [loading recipes](../runtime/loading) for an in-memory example.

Both `merge` and `update` regenerate the manifest; `extract`, `translate`, and `import` alone do not. See [CLI commands](./overview#other-commands).

These hashes are change hints, not cryptographic integrity checks.
