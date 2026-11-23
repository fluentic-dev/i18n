# CLI output audit — beta 2

Executed in `examples/i18n` on November 21, 2026. All 48 final scenarios returned their expected exit status. A separate real DeepL run successfully translated four missing English-to-French messages. Its results were reused for later no-op checks to avoid repeat provider requests. Two-language and partial-response scenarios used deterministic test translators.

The existing DeepL credential was copied into the ignored `examples/i18n.local.env`; it was never printed or included in release artifacts. Original example translations, caches, and exchange files were restored and their file hashes compared with the backup. Temporary test configs were removed.

## Improvements from the audit

- Translation announces the language pair and pending message count before requesting the provider.
- Suggested next steps stay inside the summary, before `DONE`. No-op imports and `update` stages do not suggest unnecessary merges.
- Handoff groups identical-source warnings by locale. `--verbose` lists every affected key.
- Usage errors and command failures share the `ERROR` format and consistent spacing.
- Nested completion summaries are separated from the preceding stage. Catalog, config, extraction, and exchange diagnostics use shorter paths.
- Empty extraction warnings quote `"."` so the current directory cannot be mistaken for two dots.

`Config` is flush left; details are indented by phase; every successful command ends with a blank line and `DONE`. Color output was checked with `FORCE_COLOR=1`; plain output contains no ANSI escapes. Copyable handoff instructions retain absolute paths.

## Representative outputs

### 09-import-json

```text
Config:      i18n.config.ts

RUN  import
  Converter:   json
  Exchange:    i18n/exports/json (default)
  fr:          49 validated · 1 file
  Imported:    49
  Files:       1 updated
  Next:        fluentic-i18n merge

DONE  import (3 ms)
```

### 16-import-handoff-identical

```text
Config:      i18n.config.ts

RUN  import
  Converter:   handoff
  Exchange:    i18n/exports/handoff (default)
  WARN         fr.json: 49 translations match the source; verify that this is intentional
    Use --verbose to list affected keys.
  fr:          49/49 validated
  Imported:    49
  Files:       1 updated
  Next:        fluentic-i18n merge

DONE  import (32 ms)
```

### 25-custom-missing-input

```text
Config:      .cli-log-audit.config.mjs

RUN  import
  Converter:   vendor
  Exchange:    i18n/not-there
  WARN         fr: no files found in i18n/not-there/fr; skipped. Check --input or run export first.
  Imported:    0
  Files:       0 updated
  Status:      No files imported

DONE  import (2 ms)
```

### 38-update-two-languages

```text
Config:      .cli-log-audit.config.mjs

RUN  update

  RUN  extract
    Source:      .
    Catalogs:    i18n/translations
    Files:       4 matched · 4 cached · 0 parsed
    Skipped:     0 files with no translatable messages · 0 removed
    Messages:    49 unique · 2 target languages

  DONE  extract (17 ms)

  RUN  translate
    fr:          translating 47 messages (en -> fr)
    fr:          47 translated · 0 missing
    ja:          translating 49 messages (en -> ja)
    ja:          49 translated · 0 missing
    Translated:  96
    Missing:     0

  DONE  translate (2 ms)

  RUN  merge
    fr:          49/49 translated · 0 missing
    ja:          49/49 translated · 0 missing
    Files:       2 written
    Formats:     jsonl
    Catalogs:    i18n/translations

  DONE  merge (3 ms)

  Status:      Extraction, translation, and catalog merge completed

DONE  update (23 ms)
```

### 36-update-failure

```text
Config:      .cli-log-audit.config.mjs

RUN  update

  RUN  extract
    Source:      .
    Catalogs:    i18n/translations
    Files:       4 matched · 4 cached · 0 parsed
    Skipped:     0 files with no translatable messages · 0 removed
    Messages:    49 unique · 1 target language

  DONE  extract (16 ms)

  RUN  translate
    fr:          translating 49 messages (en -> fr)

ERROR  update failed

  Reason:      Translation failed for en -> fr: Audit nested failure
```

## Scenario results

Exit 1 means an intentionally exercised error, not a failed audit. Raw logs below are local, ignored artifacts.

| Scenario                          | Expected exit | Actual exit | Log                                                       |
| --------------------------------- | ------------- | ----------- | --------------------------------------------------------- |
| 01-extract-cold                   | 0             | 0           | [Output](cli-audit/01-extract-cold.log)                   |
| 02-extract-cached                 | 0             | 0           | [Output](cli-audit/02-extract-cached.log)                 |
| 03-merge                          | 0             | 0           | [Output](cli-audit/03-merge.log)                          |
| 04-conflict                       | 0             | 0           | [Output](cli-audit/04-conflict.log)                       |
| 05-translate-live-results-current | 0             | 0           | [Output](cli-audit/05-translate-live-results-current.log) |
| 06-translate-current              | 0             | 0           | [Output](cli-audit/06-translate-current.log)              |
| 07-update                         | 0             | 0           | [Output](cli-audit/07-update.log)                         |
| 08-export-json                    | 0             | 0           | [Output](cli-audit/08-export-json.log)                    |
| 09-import-json                    | 0             | 0           | [Output](cli-audit/09-import-json.log)                    |
| 08-export-csv                     | 0             | 0           | [Output](cli-audit/08-export-csv.log)                     |
| 09-import-csv                     | 0             | 0           | [Output](cli-audit/09-import-csv.log)                     |
| 08-export-xliff                   | 0             | 0           | [Output](cli-audit/08-export-xliff.log)                   |
| 09-import-xliff                   | 0             | 0           | [Output](cli-audit/09-import-xliff.log)                   |
| 10-export-json-custom-path        | 0             | 0           | [Output](cli-audit/10-export-json-custom-path.log)        |
| 11-import-json-custom-path        | 0             | 0           | [Output](cli-audit/11-import-json-custom-path.log)        |
| 12-export-handoff-empty           | 0             | 0           | [Output](cli-audit/12-export-handoff-empty.log)           |
| 13-import-handoff-empty           | 0             | 0           | [Output](cli-audit/13-import-handoff-empty.log)           |
| 14-export-handoff-missing         | 0             | 0           | [Output](cli-audit/14-export-handoff-missing.log)         |
| 15-import-handoff-invalid         | 1             | 1           | [Output](cli-audit/15-import-handoff-invalid.log)         |
| 16-import-handoff-identical       | 0             | 0           | [Output](cli-audit/16-import-handoff-identical.log)       |
| 17-import-handoff-stale           | 1             | 1           | [Output](cli-audit/17-import-handoff-stale.log)           |
| 18-unknown-converter              | 1             | 1           | [Output](cli-audit/18-unknown-converter.log)              |
| 19-no-translator                  | 0             | 0           | [Output](cli-audit/19-no-translator.log)                  |
| 20-no-files                       | 0             | 0           | [Output](cli-audit/20-no-files.log)                       |
| 21-empty-merge                    | 0             | 0           | [Output](cli-audit/21-empty-merge.log)                    |
| 22-empty-translate                | 0             | 0           | [Output](cli-audit/22-empty-translate.log)                |
| 23-custom-export                  | 0             | 0           | [Output](cli-audit/23-custom-export.log)                  |
| 24-custom-import                  | 0             | 0           | [Output](cli-audit/24-custom-import.log)                  |
| 25-custom-missing-input           | 0             | 0           | [Output](cli-audit/25-custom-missing-input.log)           |
| 26-json-missing-input             | 1             | 1           | [Output](cli-audit/26-json-missing-input.log)             |
| 27-json-malformed                 | 1             | 1           | [Output](cli-audit/27-json-malformed.log)                 |
| 28-unsupported-provider           | 0             | 0           | [Output](cli-audit/28-unsupported-provider.log)           |
| 29-provider-error                 | 1             | 1           | [Output](cli-audit/29-provider-error.log)                 |
| 30-partial-translation            | 0             | 0           | [Output](cli-audit/30-partial-translation.log)            |
| 31-color-merge                    | 0             | 0           | [Output](cli-audit/31-color-merge.log)                    |
| 32-verbose-export                 | 0             | 0           | [Output](cli-audit/32-verbose-export.log)                 |
| 33-usage-error                    | 1             | 1           | [Output](cli-audit/33-usage-error.log)                    |
| 34-help                           | 0             | 0           | [Output](cli-audit/34-help.log)                           |
| 37-merge-all-compiled-formats     | 0             | 0           | [Output](cli-audit/37-merge-all-compiled-formats.log)     |
| 38-update-two-languages           | 0             | 0           | [Output](cli-audit/38-update-two-languages.log)           |
| 39-handoff-custom-folder          | 0             | 0           | [Output](cli-audit/39-handoff-custom-folder.log)          |
| 40-handoff-verbose-import         | 0             | 0           | [Output](cli-audit/40-handoff-verbose-import.log)         |
| 41-provider-missing-key           | 1             | 1           | [Output](cli-audit/41-provider-missing-key.log)           |
| 42-converter-error                | 1             | 1           | [Output](cli-audit/42-converter-error.log)                |
| 43-config-missing                 | 1             | 1           | [Output](cli-audit/43-config-missing.log)                 |
| 44-verbose-extract                | 0             | 0           | [Output](cli-audit/44-verbose-extract.log)                |
| 35-conflict-unresolved            | 1             | 1           | [Output](cli-audit/35-conflict-unresolved.log)            |
| 36-update-failure                 | 1             | 1           | [Output](cli-audit/36-update-failure.log)                 |

The [live DeepL output](cli-audit/05-translate-live-deepl.log) records the initial provider run before the final formatting fixes. The final replay checks the same translated catalog without another paid request.

## Follow-up: extra command arguments

Reproduced `pnpm i18n import export handoff` in the example. Parser errors now include structured usage, a converter example where relevant, and help. A blank line separates this block from pnpm's own `ELIFECYCLE` footer. The CLI retains exit status 1.

```text
ERROR  import accepts one converter. Run import and export as separate commands.

  Usage:       fluentic-i18n import [options] <converter>
  Example:     fluentic-i18n import handoff
  Help:        fluentic-i18n import --help
```

The extra-argument regression covers import, export, and extract. The beta 2 CLI tarball and checksums include this follow-up.

## Final alignment and invocation spacing

Replayed all 48 scenarios after aligning INFO/WARN/GUIDE/file messages with detail values and adding the invocation-level final separator. Every success, help output, and expected error ended with exactly one empty line; no triple newlines appeared. Original example files were restored and verified again.

The HTTP 456 quota response was simulated in a nested `update` regression without a real provider request. Its stderr is now:

```text
ERROR  update failed

  Step:        translate
  Languages:   en -> fr
  Provider:    DeepL
  HTTP:        456
  Reason:      Translation quota exceeded
  Next:        Check your plan and usage.
```

The output includes one additional empty line after the last displayed row before returning control to the shell. Generic failures use a separate Reason row, with long diagnostics wrapped and continuation lines aligned. Debug stack output and help receive the same final separator. Only the whole invocation adds the exit separator; nested phases do not.

## Conflict spacing follow-up

The introductory INFO paragraph now has a blank line before it and its text aligns with detail values. The parent Status row is separated from the nested merge completion by a blank line. A dedicated CLI regression verifies both boundaries and the final exit separator.

```text
RUN  conflict

  INFO         Rebuilding catalogs from resolved authoring files. Unresolved conflict markers will stop the command.

  RUN  merge
    ...

  DONE  merge (11 ms)

  Status:      Catalogs rebuilt from resolved authoring files

DONE  conflict (12 ms)
```
