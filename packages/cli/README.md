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

## Read-only lint checks

```sh
pnpm exec fluentic-i18n lint
pnpm exec fluentic-i18n lint --strict
```

`lint` scans the configured source files without using or writing the extraction cache. It checks `meta.jsonl` and every target language's `manual.jsonl` and `auto.jsonl`, reports diagnostics with rule codes and locations, and summarizes translation coverage. It does not generate translations, invoke providers, or write catalogs. As with other commands, loading the config executes your config module.

Errors include invalid source/ICU syntax, malformed catalog rows, duplicate identities, translations without metadata, conflicting source metadata, and incompatible translation structures. ICU comparison checks arguments, tags, formatting styles, select keys, plural type, offset, and exact-number cases, while allowing language-specific plural categories.

Source checks reuse the compiler's import, alias, and context resolution:

```tsx
// Error: missing runtime parameter.
t.jsx('Hello {name}');
// Correct:
t.jsx('Hello {name}', { name: user.name });

// Warning: missing descriptor schema entry.
t.msg('Hello {name}');
// Correct:
t.msg('Hello {name}', { name: String });
```

Checks also cover nested parameters, missing rich-text handlers, extra keys, schema constructors passed as rendering values, and obviously incompatible literal values for numeric/date parameters. `{break}` is supplied by the runtime. Rich-text handlers are not required in primitive descriptor schemas.

Use `lint.parameterChecks` to control parameter and descriptor schema diagnostics:

```ts
lint: {
  parameterChecks: {
    msg: false,
    jsx: {
      skip: [
        { match: 'exact', terms: 'Legacy {name}' },
        { match: 'contains', terms: ['Debug', 'Internal'], caseSensitive: false },
        ({ message }) => message.startsWith('Test'),
        { check: ({ message }) => message.startsWith('Preview') },
      ],
    },
    text: true,
    translation: {
      skip: ({ message, translation }) => message === 'Legacy {name}' && translation === 'Legacy',
    },
  },
}
```

`true` (the default) enables all parameter checks; `false` disables them all, including translation structure comparison. A map controls `msg`, `jsx`, `text`, and `translation` individually; omitted checks remain enabled. Each entry accepts a boolean or `{ enabled?, skip? }`. `enabled` defaults to `true`; `enabled: false` bypasses the check without calling `skip`. `skip` accepts one rule or an array. A rule can be `{ match: 'exact' | 'contains', terms: string | string[], caseSensitive?: boolean }`, a direct predicate, or `{ check: predicate }`. Matching uses the same implementation as `forbiddenMessages`. String rules always match the source message, including for translation checks. Exact matches compare the entire ICU string; contains matches substrings. Matching is case-sensitive by default.

Rules run in order: any matching rule or predicate returning `true` skips the check and short-circuits later rules. If none matches, including an empty rule array, the check runs. A thrown or invalid callback result reports an error and stops that check's rule evaluation. Skip rules do not accept diagnostic `id`, `severity`, or `message` fields. Unlike `forbiddenMessages` callbacks, which return diagnostic text, skip callbacks return booleans.

The `msg`, `jsx`, and `text` predicates receive `{ message: string }`, containing the ICU source message. The `translation` predicate receives `{ message: string, translation: string }`, with the catalog row's source and translated ICU strings. Translation predicates run for each non-empty, syntactically valid authoring row in both manual and automatic layers. Predicates are synchronous; throwing or returning a non-boolean produces a `parameter-check-error` while other checks continue. The top-level `parameterChecks` accepts only a boolean or the four-check map, never a top-level `{ enabled, skip }` object.

Source switches cover missing/unused parameters, incompatible literal types, missing/incompatible descriptor schemas, and schema constructors passed as rendering values. The translation switch controls the full ICU structure comparison, including arguments, tags, select keys, plural offsets, and formatting styles. Source and translation ICU syntax, catalog row validity, extraction, forbidden-message rules, and coverage checks remain enabled even when parameter checks are disabled or skipped. Keep custom predicates read-only.

Missing metadata, extraction drift (new/removed messages or changed notes/metadata), unused parameters, and missing or incompatible schema entries produce warnings. Errors exit with status 1; `--strict` also fails on warnings. Incomplete translation coverage is informational and does not fail either mode.

Optional project-specific terms can be kept out of source messages:

```ts
export default defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  lint: {
    forbiddenMessages: [
      { match: 'exact', terms: 'Acme' },
      { match: 'contains', terms: ['WhatsApp', 'Booking.com'], caseSensitive: false },
      {
        id: 'custom-wording',
        severity: 'error',
        check: (icuMessage) =>
          icuMessage.includes('internal-only')
            ? 'Remove internal wording from this message.'
            : undefined,
      },
    ],
  },
});
```

`forbiddenMessages` accepts one rule or an array of rules. `terms` also accepts a single string or an array. `exact` matches the entire ICU source string; `contains` matches a substring anywhere in it, including ICU arguments and branch text. Matching is case-sensitive unless `caseSensitive: false`. Rules default to warnings; set `severity: 'error'` to fail lint without `--strict`. An optional `message` replaces the built-in diagnostic for a matching rule, and `id` identifies the rule in diagnostics. No product names are forbidden by default.

A callback can be provided directly (`forbiddenMessages: (icuMessage) => ...`) or as a rule's `check` property. It receives the complete ICU source string and returns a diagnostic string, an array of diagnostic strings, or `undefined` when valid. Async callbacks are supported. Callbacks run once per context/source identity across extracted and catalog-only messages. Exceptions and invalid return values produce rule-execution errors while other checks continue. Callbacks are trusted configuration code; keep them read-only to preserve lint's read-only behavior.

The earlier `forbiddenTerms` option is replaced by `forbiddenMessages: { match: 'contains', terms: [...] }`.

Static analysis checks literal messages and inline parameter/schema objects. Dynamic objects, spreads, computed keys, descriptor rendering, and callbacks are not fully validated; this is not a replacement for TypeScript or runtime tests. Structure comparison uses sets, so repeated-placeholder counts and every change in nesting or branch placement are not checked. Lint does not assess translation quality or validate generated merged catalogs.

Programmatic callers can use `await lint(config, reporter?)` to receive diagnostics, error/warning counts, file/message totals, and coverage by locale. The function returns findings without throwing; configuration, source-root, and file-discovery failures can still throw.
