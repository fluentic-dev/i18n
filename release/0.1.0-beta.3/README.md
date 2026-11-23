# Fluentic i18n 0.1.0-beta.3

Prepared November 21, 2026. No npm packages were published during preparation.

## Publication plan

| Package                   | Action                                       | Published version after release |
| ------------------------- | -------------------------------------------- | ------------------------------- |
| `@fluentic/i18n-compiler` | Publish changed compiler                     | `0.1.0-beta.3`                  |
| `@fluentic/i18n-cli`      | Publish CLI with updated compiler dependency | `0.1.0-beta.3`                  |
| `@fluentic/i18n`          | Skip unchanged contents                      | `0.1.0-beta.2`                  |
| `@fluentic/i18n-nextjs`   | Skip unchanged contents                      | `0.1.0-beta.2`                  |
| `@fluentic/i18n-rn`       | Skip unchanged contents                      | `0.1.0-beta.2`                  |
| `@fluentic/i18n-web`      | Skip unchanged contents                      | `0.1.0-beta.2`                  |

All workspace versions are beta.3. The normalized packed-content comparison against npm beta.2 selected only compiler and CLI. See [plan.json](plan.json) and [SHA256SUMS](SHA256SUMS) for exact artifacts and checksums.

The compiler archive depends on core beta.2; the CLI archive depends on compiler beta.3. No package requires an unpublished core beta.3.

## Release notes

- Add shared compiler filtering with file globs/regular expressions and exact `includePackages`/`excludePackages` options across bundler adapters. Package exclusions win; package inclusions override file filters for script files.
- Support scoped packages, pnpm layouts, Windows paths, query/hash suffixes, and nested dependency ownership.
- Expose Vite's native transform hook filter while retaining the authoritative shared JavaScript check, including config reload handling.
- Keep the legacy `includeDependencies` option working.
- Update the CLI's compiler dependency to include these improvements.
- Publish only packages with changed shipped contents; coordinated version bumps no longer force unchanged runtime adapters to npm.

## Publish

Follow [RELEASING.md](../../RELEASING.md). `pnpm release` rebuilds and publishes only selected packages under `beta`; commit the updated publication ledger afterward. No new Git tag or GitHub release has been created by this preparation.

## Verified

- `pnpm typecheck` passed across the workspace.
- `pnpm test` passed: 159 tests across the reported suites, including five release workflow tests, plus bundle measurements.
- Repeated preparation produced identical tarball SHA-256 checksums.
- Both selected archives installed together in an isolated project against the published core beta.2. Compiler ESM/CJS loading, Vite filters, a message transform, dependency resolution, and CLI help passed.
- The release workflow tests cover version-only skips, meaningful payload/dependency changes, dependency ordering, immutable-version conflicts, partial failure/resume, and registry verification failures.
