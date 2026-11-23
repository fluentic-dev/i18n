# @fluentic/i18n-cli

Public tooling contracts for extracting messages, maintaining normalized catalogs, running automatic translation, and importing/exporting translator files.

The package keeps translation providers and format converters as functions. The CLI orchestrator owns matching, merging, diagnostics, and file layout.

## Command output

`Config` is flush left, phase details are indented, and completion lines are separated by a blank line. Each whole CLI invocation ends with exactly one empty line, including help and failures. INFO text aligns with detail values; provider errors use structured diagnostic rows. Translation, merge, and exchange commands show labeled totals and next steps. Handoff adds per-locale validation counts and clean, copyable agent instructions (with absolute paths inside the instructions).

Commands use colored `RUN`, `DONE`, `INFO`, `WARN`, and `ERROR` tags, aligned details, and elapsed times. Paths are relative to the working directory when shorter. `update` groups its stages with indentation. Individual files and translated message IDs are hidden by default; use `--verbose` (or `-v`) to show them. Handoff groups identical-source warnings by locale; verbose output includes every affected key. Translation prints progress before provider requests. Suggested next steps appear before completion and are omitted when no files were imported or when `update` already performs the next stage.

Color is automatic for terminals and disabled for redirected output. Use `--no-color` or `NO_COLOR` to disable it, or `FORCE_COLOR=1` to enable it in captured output. Warnings and errors go to stderr; `--debug` adds technical error details.

## Built-in exchange formats

Use `json`, `csv`, `xliff`, or `handoff` without converter configuration:

```sh
pnpm exec fluentic-i18n extract
pnpm exec fluentic-i18n export csv --output ./translations-review
# Edit translations-review/<locale>/messages.csv.
pnpm exec fluentic-i18n import csv --input ./translations-review
pnpm exec fluentic-i18n merge
```

JSON writes `<locale>/messages.json` as an array of translation records. CSV writes `<locale>/messages.csv` with `context,source,translation` columns and quoted multiline fields. XLIFF writes `<locale>/messages.xlf` as XLIFF 1.2 with text targets, notes, and context. XLIFF supports the exported flat, single-file layout; inline XML codes and grouped units require a custom converter. Message markup is preserved as escaped XML text.

All exchange commands print their exchange folder relative to the working directory when shorter, marked `(default)` when no CLI folder option is supplied. The default is `<output>/<dirs.exports>/<converter>`. Explicit folder options also work for custom converters. JSON/CSV/XLIFF include all current messages and effective translations; `handoff` exports only missing translations. General imports validate all locale files and source identities before writing, but do not apply the handoff's snapshot/ICU checks. Partial rows are supported; an empty translation clears the manual entry. Import retains the source catalog's notes and metadata.

`config.convert` overrides built-ins by exact name. The first matching entry wins for the whole converter; missing methods do not fall back to the built-in. This includes overrides of `handoff`. Additional names register custom formats. `catalogFormat` and `translator` remain separate application configuration.

```ts
export default defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  convert: [{ name: 'json', export: myJsonExport, import: myJsonImport }],
});
```

## Coding-agent translation handoff

`handoff` is a built-in export/import workflow. It needs no translator or converter configuration.

```sh
pnpm exec fluentic-i18n extract
pnpm exec fluentic-i18n export handoff --output ./translation-handoff
# Paste the printed guide into a coding agent and let it write the output folder.
pnpm exec fluentic-i18n import handoff --input ./translation-handoff
pnpm exec fluentic-i18n merge
```

Without `--output` or `--input`, the folder defaults to `<output>/<dirs.exports>/handoff` (`i18n/data/exports/handoff` with default configuration). Every export refreshes `input/` with only currently missing translations, removing previous input files and obsolete context. You can reuse the same folder. `output/` is preserved byte-for-byte so the coding agent can reuse and update prior results. Short keys remain stable for the same source identity and retired keys are never reassigned. The guide tells the agent to remove output keys/files that are absent from the new input before importing. If nothing is missing, export clears `input/` and reports that there is no work; existing output is still preserved.

```text
translation-handoff/
  manifest.json
  context.json       # only when messages have context, notes, or metadata
  input/fr.json
  input/ja.json
  output/            # agent writes matching locale files here
```

Each input is a flat object such as `{"m0":"Pay {amount}"}`. Output uses the same keys and translated values, for example `{"m0":"Payer {amount}"}`. Short IDs are local to the handoff; the manifest maps them back to source messages, including context. Context is stored once across locales. The printed prompt contains absolute input/output paths and the required JSON and ICU rules. The agent does not need to read the manifest.

Import validates the whole batch before changing manual translation layers. It rejects missing/extra files or keys, duplicate JSON keys, empty/non-string values, invalid ICU syntax, changed placeholders/tags/formatting contracts, unsafe locale paths, and symbolic links. Target-language plural categories can differ. Identical source and translation values produce warnings. Validation checks structure, not translation quality.

Source changes (including notes and context) or changes to an exported locale's automatic/manual layers invalidate the handoff. Run `extract` and export again to refresh the handoff in that case. Repairable output failures print a prompt with exact file/key diagnostics to paste back into the coding agent. Correct the output and rerun import. No translation layers change on validation failure. Successful import stages files and replaces each file by rename, with rollback on write failure; this is not a cross-file transaction against process crashes or concurrent writers. Run `merge` afterward to rebuild runtime catalogs.

Programmatic callers can use `exportHandoff(config, { directory })`, which returns the agent prompt, and `importHandoff(config, { directory }, reporter?)`. The `exportTranslations` and `importTranslations` functions use the shared registry and honor config overrides. Both accept a fourth argument `{ directory }` for a custom exchange folder; export sends the guide through the reporter's `info` event. Direct `exportHandoff`/`importHandoff` calls always run the built-in workflow.
