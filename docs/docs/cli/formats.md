---
title: Import and export translations
sidebar_label: Import & export
---

# Import and export translations

Exchange formats move readable translations between Fluentic and external tools. Built-in `json`, `csv`, `xliff`, and `handoff` formats work without `config.convert`. Runtime catalog generation (`catalogFormat`) and automatic translation providers (`translator`) remain separate application configuration.

## Quick export and import

```sh
pnpm exec fluentic-i18n extract
pnpm exec fluentic-i18n export json --output ./translations-review
# Edit translations-review/fr/messages.json (and the other target locales).
pnpm exec fluentic-i18n import json --input ./translations-review
pnpm exec fluentic-i18n merge
```

Replace `json` with `csv` or `xliff` for the other formats. The folder options work with built-ins and configured converters. The CLI prints the absolute exchange folder on every export/import, annotating it with `(default)` when no option was supplied. The default is `<output>/<dirs.exports>/<converter>`, normally `i18n/data/exports/<converter>`. Relative folder options resolve from the working directory.

| Name      | File inside each locale folder     | Exchange structure                                                                            |
| --------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `json`    | `fr/messages.json`                 | Array of readable records with source, context, translation, ID, notes, and optional metadata |
| `csv`     | `fr/messages.csv`                  | `context,source,translation` columns; empty context means no context                          |
| `xliff`   | `fr/messages.xlf`                  | XLIFF 1.2 with source/target text, notes, and a Fluentic context group                        |
| `handoff` | `input/fr.json` → `output/fr.json` | Missing translations only, short keys, shared manifest and optional context                   |

JSON, CSV, and XLIFF export all current source messages with their effective manual/automatic translations, including empty values for missing translations. Import expects exactly the corresponding file in each configured locale folder. Edit only translation values, the CSV translation column, or XLIFF targets. Source and context identify a message; changing them can make the import invalid. Rows may be omitted for a partial import. An empty translation explicitly clears that manual entry; an existing automatic translation can then become effective when merged. Source notes and metadata remain owned by the app's source catalog.

CSV follows [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180), including quoted commas, quotes, and multiline text; import also accepts a UTF-8 BOM, LF newlines, and reordered columns. XLIFF uses the [1.2 namespace and structure](https://docs.oasis-open.org/xliff/v1.2/os/xliff-core.html). This built-in supports the exported single-file, flat `trans-unit` layout with plain text or CDATA in source/target. Rich-text message tags are XML-escaped text. XLIFF 2.x, grouped units, inline XML codes, DTDs, and entity declarations require a custom converter; unsupported structures produce errors rather than flattening message content.

Imports validate every locale before writing manual layers. Malformed files, duplicate messages, unknown source/context pairs, and unsafe paths fail without changing translation layers. These general exchange formats do not perform the handoff's snapshot and ICU contract checks. Export overwrites its own files; keep reviewed edits elsewhere before re-exporting. Import does not extract or merge automatically.

## Translate with a coding agent

Use the built-in `handoff` workflow without configuring a translator or converter:

```sh
pnpm exec fluentic-i18n extract
pnpm exec fluentic-i18n export handoff --output ./translation-handoff
# Paste the printed prompt into a coding agent; wait for it to write all output files.
pnpm exec fluentic-i18n import handoff --input ./translation-handoff
pnpm exec fluentic-i18n merge
```

Export writes only missing translations as minimal `input/<locale>.json` dictionaries. For example, `{"m0":"Pay {amount}"}` becomes `{"m0":"Payer {amount}"}` in `output/fr.json`. The agent preserves every key and writes all matching locale files. A shared optional `context.json` contains message context, notes, and metadata. `manifest.json` records source identities and snapshots for the importer; the agent leaves it untouched.

The CLI prints a ready-to-copy guide with absolute folder paths and JSON/ICU rules. Import validates the complete batch before writing any manual translations, including duplicate keys, missing/extra files and keys, nonempty string values, ICU syntax, placeholders, tags, and formatting contracts. Locale-specific plural categories are allowed. Identical source and translated text produces a warning, since names may legitimately stay unchanged. Structural validation cannot judge translation quality.

On output errors, import prints a correction prompt with file/key diagnostics. Paste it back into the agent and rerun import after correction. If source messages or translation layers changed, run `extract` and export a fresh handoff instead. Every export replaces `input/` with only currently missing entries and refreshes the manifest and optional context. Existing `output/` files are preserved for the agent to reuse and update. Matching source identities retain their short keys; retired keys are never reused for different messages. The agent must reconcile output with the current input, removing obsolete keys/files before import. When nothing is missing, export leaves `input/` empty, preserves output, and reports no work. Reuse the same handoff folder for later exports. Without folder options, both commands use `<output>/<dirs.exports>/handoff`, normally `i18n/data/exports/handoff`. Imports stage all writes and use per-file atomic replacement with rollback on write failure; avoid concurrent catalog writers during import. Run `merge` separately after a successful import.

## Override a built-in or add a converter

Import built-in converter objects `jsonConverter`, `csvConverter`, and `xliffConverter` from `@fluentic/i18n-cli/converters` to call them directly or reuse them in custom converters. The CLI still selects built-in formats by name without configuration. Shared types (`Converter`, `ConverterInput`, `ConverterOutput`, `ConverterImportInput`) and programmatic commands (`exportTranslations`, `importTranslations`) live at `@fluentic/i18n-cli`.

```ts
import { csvConverter, jsonConverter, xliffConverter } from '@fluentic/i18n-cli/converters';
```

These are converter objects with `name`, `export`, and `import` members. `handoff` remains a folder workflow, available through the root `exportHandoff` and `importHandoff` helpers.

Entries in `config.convert` take precedence by exact name. For example, a converter named `json` replaces the built-in JSON converter; one named `handoff` replaces that whole workflow with your configured per-locale converter. If an override lacks an import or export callback, that operation fails instead of falling back to the built-in. The first matching config entry is used.

This example explicitly overrides `json`. It is optional: remove `convert: [json]` to use the built-in again.

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

The French exchange file is `i18n/data/exports/json/fr/messages.json`. Import reads files recursively from each language's converter folder and writes their records into the manual layer. Non-empty imported translations therefore take priority when merged. Import replaces existing manual records with the same ID, including when an imported translation is empty; review imported files before merging. Import does not merge or extract automatically. Export reconstructs readable records directly from the automatic and manual translation layers. Run `extract` first when source files changed.

## Support additional formats

For PO, a vendor format, or a different JSON/CSV/XLIFF layout, implement or override a named converter. Keep a stable mapping to the generated record IDs, including context; source text alone may be ambiguous.

An export callback receives `{ sourceLanguageId, languageId, items }` and returns `{ files: [{ path, content }] }`. Paths must stay inside the converter's language directory. Export overwrites files it returns and leaves other files in that directory in place. Since import reads the directory recursively, remove obsolete exchange files before importing if your converter would otherwise read them. An import callback receives `{ sourceLanguageId, languageId, files }`, where contents may be strings or bytes.

Return valid translation records for known source/context pairs on import. The importer retains current source notes and metadata. Don't regenerate IDs from translated text, and don't edit `merged.jsonl` directly. Re-export after merging if you need a fresh exchange file.

See [CLI commands](./overview#other-commands) for extraction and merging, and [runtime loaders](../runtime/loading) for publishing the generated JSONL.

Programmatic callers can pass a fourth argument: `exportTranslations(config, 'csv', reporter, { directory: './review' })` or `importTranslations(config, 'csv', reporter, { directory: './review' })`. They use the same override resolution and path diagnostics as the CLI.
