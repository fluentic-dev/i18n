# Fluentic i18n 0.1.0-beta.2

Prepared on November 21, 2026. All six tarballs include the current working-tree source. Nothing was published to npm during this preparation.

## Artifacts

| Package                   | Tarball                                   |
| ------------------------- | ----------------------------------------- |
| `@fluentic/i18n`          | `fluentic-i18n-0.1.0-beta.2.tgz`          |
| `@fluentic/i18n-compiler` | `fluentic-i18n-compiler-0.1.0-beta.2.tgz` |
| `@fluentic/i18n-cli`      | `fluentic-i18n-cli-0.1.0-beta.2.tgz`      |
| `@fluentic/i18n-web`      | `fluentic-i18n-web-0.1.0-beta.2.tgz`      |
| `@fluentic/i18n-rn`       | `fluentic-i18n-rn-0.1.0-beta.2.tgz`       |
| `@fluentic/i18n-nextjs`   | `fluentic-i18n-nextjs-0.1.0-beta.2.tgz`   |

`SHA256SUMS` covers all six archives. Tarballs are intentionally ignored by Git; retain these local files or attach them to the release.

## Release notes

The full [beta 2 release notes](../../docs/docs/releases/beta-2.md) and [CLI changelog](../../packages/cli/CHANGELOG.md) include the latest changes:

- Standalone compiler package and built TypeScript declarations across all public packages.
- React SPA translation caching, runtime catalog hashes, and fine-grained translated JSX props.
- Next.js cookie and URL language strategies.
- Built-in JSON, CSV, XLIFF, and handoff exchange, configurable providers, and translator language filters.
- Consistent colored CLI output, relative paths, aligned statistics, nested stages, verbose details, and clean handoff guide/repair blocks. Config is flush left; completion lines have a blank line above them.

## Verified

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test`: 146 tests passed across the reported test suites; bundle measurements completed.
- `pnpm build`: public packages, examples, and documentation built.
- `pnpm test:next`: cookie and URL integration checks passed.
- All archive export targets, declaration targets, CLI binaries, README/license files, and runtime dependency versions checked. No unresolved workspace/file/link runtime dependencies or environment files found.
- All six tarballs installed together into an isolated temporary project with peer auto-installation disabled. Core, compiler, CLI, converter/provider, web, and native imports passed. Packaged CLI update, JSON export/import, handoff export, and log layout passed. Next.js integration was validated in the workspace above.
- npm returned not-found responses for all six `0.1.0-beta.2` versions on the preparation date.

The subsequent [CLI output audit](CLI-OUTPUT-AUDIT.md) exercised 48 example scenarios, including all commands, built-in/custom converters, compiled catalog formats, errors, no-op runs, verbose output, and color. A real DeepL run translated four missing messages. The CLI tarball and checksums were refreshed after the audit fixes.

## Source and tag status

The tarballs include uncommitted changes on top of `e2d85ccea40a4e56dce08107012b91d15df78303`. Review and commit the prepared source, documentation, changeset state, and checksums before finalizing the release.

The existing local **and remote** `v0.1.0-beta.2` tag points to that earlier commit. It has deliberately not been moved. Reconcile the release tag with the final release commit before creating or updating the GitHub release; otherwise its source archive will omit the latest CLI changes. Moving the existing remote tag requires an intentional maintainer decision.

All package versions remain `0.1.0-beta.2`. The latest CLI changeset is recorded as included in `.changeset/pre.json`. Do not run `pnpm version-packages` for these artifacts: it prepares the next prerelease instead.

## Publish these exact tarballs

From the repository root, enter this folder and verify the archives:

```sh
cd release/0.1.0-beta.2
shasum -a 256 -c SHA256SUMS
npm whoami
```

Publish in dependency order with the explicit `beta` tag:

```sh
npm publish ./fluentic-i18n-0.1.0-beta.2.tgz --access public --tag beta
npm publish ./fluentic-i18n-compiler-0.1.0-beta.2.tgz --access public --tag beta
npm publish ./fluentic-i18n-cli-0.1.0-beta.2.tgz --access public --tag beta
npm publish ./fluentic-i18n-web-0.1.0-beta.2.tgz --access public --tag beta
npm publish ./fluentic-i18n-rn-0.1.0-beta.2.tgz --access public --tag beta
npm publish ./fluentic-i18n-nextjs-0.1.0-beta.2.tgz --access public --tag beta
```

Stop on any publishing failure. If resuming a partial publication, check the registry and publish only the remaining packages; npm versions cannot be overwritten. Use `beta`, not `latest`.

Verify the published tag for every package:

```sh
for package in i18n i18n-compiler i18n-cli i18n-web i18n-rn i18n-nextjs; do
  npm view "@fluentic/$package@beta" version
done
```

Every result should be `0.1.0-beta.2`. Attach the six tarballs and `SHA256SUMS` to the GitHub release and use the linked beta 2 notes for its description.
