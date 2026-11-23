# Fluentic i18n 0.1.0-beta.4

Prepared November 21, 2026. Preparation does not publish to npm, create a Git tag, or update the publication ledger.

## Publication plan

| Package                   | Action                   | Version selected by the plan |
| ------------------------- | ------------------------ | ---------------------------- |
| `@fluentic/i18n-compiler` | Publish changed compiler | `0.1.0-beta.4`               |
| `@fluentic/i18n-cli`      | Publish changed CLI      | `0.1.0-beta.4`               |
| `@fluentic/i18n`          | Skip unchanged contents  | `0.1.0-beta.2`               |
| `@fluentic/i18n-nextjs`   | Skip unchanged contents  | `0.1.0-beta.2`               |
| `@fluentic/i18n-rn`       | Skip unchanged contents  | `0.1.0-beta.2`               |
| `@fluentic/i18n-web`      | Skip unchanged contents  | `0.1.0-beta.2`               |

All six workspace versions are beta.4. Selection compares normalized packed contents against the recorded npm beta.2 baseline. The compiler archive depends on core beta.2; the CLI archive depends on compiler beta.4. See [plan.json](plan.json) and [SHA256SUMS](SHA256SUMS) for exact archives and checksums.

## Release notes

- Add `fluentic-i18n lint` for read-only source, extraction, and authoring-catalog validation. Report source locations, rule codes, ICU translation mismatches, extraction drift, and per-language coverage. Errors fail the command; `--strict` also fails on warnings. Incomplete translation coverage remains informational.
- Reuse compiler import/alias/context analysis and the handoff ICU contract comparison. Check missing/unused parameters, descriptor schemas, obvious literal type mismatches, rich-text tags, select keys, plural offsets, exact-number cases, and formatting contracts while allowing locale-specific plural categories.
- Add `lint.parameterChecks`: a boolean or a map of `msg`, `jsx`, `text`, and `translation`. Each entry supports a boolean or `{ enabled, skip }`. Skip accepts one rule or an array, with exact/contains matching, direct boolean predicates, or `{ check: predicate }`; the first match skips. Translation callbacks receive both source and translation. Disabling parameter checks does not disable ICU syntax validation.
- Add `lint.forbiddenMessages`: exact/contains rules or diagnostic callbacks, individually or in arrays. Support custom severity, rule IDs, and messages. Async forbidden-message callbacks are supported; skip predicates are synchronous. No product names are forbidden by default.
- Separate `RUN lint`, diagnostics, and the final summary with blank lines. Keep normal and strict exit behavior consistent with the summary.
- Expose structured programmatic lint results and emitted public option types. Fix CLI/compiler declaration imports so TypeScript NodeNext consumers can resolve public exports and infer callback arguments.
- Include the previously prepared compiler file/package filters and CLI reporting improvements relative to the recorded publication baseline.

See the [CLI README](../../packages/cli/README.md#read-only-lint-checks) for examples and detailed limits. Static analysis does not fully validate dynamic parameter objects or descriptor rendering. Structure comparison uses sets, so repeated-placeholder counts and every nesting/branch-placement change remain outside its scope. Lint does not judge translation quality or validate generated merged catalogs.

## Verified

- `pnpm typecheck` and `pnpm format:check` pass.
- `pnpm test` passes: 190 tests across the reported suites, plus bundle measurements. This includes 30 lint tests and a public declaration consumer test under both NodeNext and Bundler resolution.
- The documentation production build passes.
- Isolated installation of the selected tarballs verifies dependency versions, compiler ESM/CJS loading and transforms, read-only lint behavior, skip rules, CLI spacing, and warning/error/strict exit behavior.
- A separate TypeScript consumer compiles against the installed archives with strict NodeNext resolution and callback type inference.
- Repeated preparation produces identical SHA-256 checksums. Archive hashes match the plan; the publication ledger remains unchanged.

## Publish

Follow [RELEASING.md](../../RELEASING.md). `pnpm release` rebuilds, checks immutable npm versions, and publishes only selected packages under the `beta` tag. Commit the publication ledger only after successful publication. Tarballs are ignored by Git; retain or attach the prepared archives separately.
