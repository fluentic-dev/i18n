---
title: Import and export translations
sidebar_label: Import & export
---

# Import and export translations

Converters exchange translation records with external tools while preserving JSONL as the runtime catalog format. Each converter has a name and implements `export`, `import`, or both.

## Implement a JSON converter

This example exports records as readable JSON and imports edited translations. It preserves the IDs and source information needed to merge them back.

```ts title="i18n.config.ts"
import { type Converter, defineConfig, type TranslationRecord } from '@fluentic/i18n-cli';

const json: Converter = {
  name: 'json',
  export: ({ items }) => ({
    files: [{ path: 'messages.json', content: JSON.stringify(items, null, 2) }],
  }),
  import: ({ files }) => {
    const file = files.find((item) => item.path === 'messages.json');
    if (!file) return [];
    const text = typeof file.content === 'string'
      ? file.content
      : new TextDecoder().decode(file.content);
    const records: unknown = JSON.parse(text);
    if (!Array.isArray(records)) throw new Error('Expected a record array');
    for (const record of records) {
      if (
        typeof record?.id !== 'string' || typeof record?.source !== 'string' ||
        typeof record?.translation !== 'string' ||
        !(record?.context === null || typeof record?.context === 'string') ||
        !Array.isArray(record?.notes) ||
        !record.notes.every((note: unknown) => typeof note === 'string')
      ) {
        throw new Error('Invalid translation record');
      }
    }
    return records as TranslationRecord[];
  },
};

export default defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx}'] },
  convert: [json],
});
```

Run this workflow without an automatic provider:

```sh
pnpm exec fluentic-i18n extract
pnpm exec fluentic-i18n merge
pnpm exec fluentic-i18n export json
# Edit the translation fields in the exported messages.json.
pnpm exec fluentic-i18n import json
pnpm exec fluentic-i18n merge
```

The French exchange file is `i18n/data/exports/json/fr/messages.json`. Import reads files recursively from each language's converter folder and writes their records into the manual layer. Non-empty imported translations therefore take priority when merged. Import replaces existing manual records with the same ID, including when an imported translation is empty; review imported files before merging. Import does not merge or extract automatically. In dynamic mode export reads the existing merged catalog. In compiled mode it reconstructs readable merged records from the extracted source and review layers. Run `update` first when source files changed.

## Support additional formats

For CSV, PO, XLIFF, or a vendor format, replace the serialization and parsing in these callbacks. These formats aren't bundled converters. Keep a stable mapping to the generated record IDs, including context; source text alone may be ambiguous.

An export callback receives `{ languageId, items }` and returns `{ files: [{ path, content }] }`. Paths must stay inside the converter's language directory. Export overwrites files it returns and leaves other files in that directory in place. Since import reads the directory recursively, remove obsolete exchange files before importing if your converter would otherwise read them. An import callback receives `{ languageId, files }`, where contents may be strings or bytes.

Preserve complete records on import. Don't regenerate IDs from translated text, and don't edit `merged.jsonl` directly. Re-export after merging if you need a fresh exchange file.

See [CLI commands](./overview#other-commands) for extraction and merging, and [runtime loaders](../runtime/loading) for publishing the generated JSONL.
