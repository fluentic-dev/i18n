# @fluentic/i18n-cli

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies
  - @fluentic/i18n-compiler@0.1.0-beta.3

## 0.1.0-beta.2

### Additional beta.2 changes

- Polish all command and converter logs with colored status tags, aligned summaries, elapsed times, relative paths, nested stages, and opt-in `--verbose` file/message details. Support `--no-color`, `NO_COLOR`, and `FORCE_COLOR`. Keep config flush left and separate completion lines with a blank line.
- End each CLI invocation with exactly one blank line on success, help, or failure. Align INFO and diagnostic text with detail values, and show provider errors as structured step/language/provider/status/reason/action rows.
- Keep next steps inside command summaries, omit unnecessary merge hints, report translation progress before provider requests, and group identical-source warnings with verbose key details. Format usage errors consistently and shorten diagnostic paths.
- Show handoff locale counts and clean copyable guide/repair blocks. Describe skipped extraction files as files with no translatable messages.

- Name the coding-agent exchange format `handoff`, including converter registration, CLI commands, default directory, and manifest format.

- Add built-in JSON, CSV, XLIFF, and LLM handoff exchange workflows, custom exchange folders, and validated imports. Refresh handoff inputs without discarding agent output.
- Add `filterTranslator` language allow/deny rules. Export provider factories from `/translators` and built-in converter objects from `/converters`; keep shared types and helpers at the root. Remove the `googleTranslate` and `deeplTranslate` aliases.
- Report readable errors and useful outcomes across all CLI commands, including extraction cache statistics, translation and catalog counts, config validation, provider troubleshooting, and opt-in `--debug` details.

### Patch Changes

- Add disposable per-file extraction caching and deterministic per-language manifests hashed from final runtime catalog rows, including compiler-option changes.
- Generate JSONL, JSON, CJS, and MJS catalogs from the same reviewed translation layers.
- Use the standalone compiler package for compact catalogs and emit built TypeScript declarations.

## 0.1.0-beta.1

### Minor Changes

- Publish the first public beta of the Fluentic extraction, translation, merge, export, and conflict-recovery CLI.
- Generate JSONL, JSON, CJS, or MJS runtime catalogs, including compiled catalogs.
- Add ordered translator fallbacks with per-language-pair support checks.

### Patch Changes

- Updated dependencies
  - @fluentic/i18n@0.1.0-beta.1
