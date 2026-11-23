# Releases

Changesets keeps the six workspace versions coordinated. Publishing is selective: `pnpm release` compares packed contents with the last verified npm publication and uploads only changed packages. A workspace version bump alone does not trigger publication.

## Prepare

1. Add changesets for user-facing changes.
2. Run `pnpm version-packages`, then `pnpm install --lockfile-only`.
3. Run `pnpm typecheck` and `pnpm test`.
4. Run `pnpm release:prepare` to build packages and create the publication plan, selected tarballs, and `SHA256SUMS` in `release/<version>/`.
5. Review `plan.json`, the changelogs, and the selected archives. Commit the source, versions, lockfile, plan, checksums, and release notes. Tarballs are ignored by Git; retain or attach them to the release.

`node scripts/release.mjs --dry-run` prepares the same plan without rebuilding. Neither preparation command publishes or changes the publication ledger.

## Publish

Run `pnpm release` when ready to publish. It rebuilds, computes the plan, checks selected versions against npm, and publishes selected tarballs in dependency order with the active Changesets prerelease tag (currently `beta`), or `latest` outside prerelease mode.

A skipped package stays at its last published version even when its workspace version is higher. Its npm tag is untouched. For example, a beta.3 release can publish compiler and CLI while core, web, RN, and Next.js remain at beta.2.

The command updates `release/published-<tag>.json` only after verifying each successful upload's npm integrity. Commit this ledger after publication, including after a partially successful release. Run releases from one checkout at a time. If publication fails, fix the cause and rerun `pnpm release`: already-recorded packages are skipped, and an uploaded but unrecorded version is recovered only when its archive integrity matches exactly. A conflicting immutable npm version fails before any package is uploaded.

The release script replaces `changeset publish` and the old all-package tag synchronization command. Do not use those to publish this workspace: they would bypass content selection. The release script does not create Git commits, tags, or GitHub releases.

## What counts as a change

The SHA-256 fingerprint covers each packed file's path, executable bits, and bytes. It excludes the root changelog and normalizes `package.json` by removing its own `version` and `devDependencies`, then sorting object keys. Tar timestamps and compression do not affect this fingerprint.

Runtime code, declarations, source maps, README/license files, exports, runtime dependency ranges, peer ranges, and other shipped manifest fields remain significant. Changes to build tools matter if they change the generated output. A version string embedded in runtime code remains significant. `SHA256SUMS` separately hashes the exact selected archives without normalization.

Workspace dependencies are resolved in dependency order in a temporary staging directory. References to skipped packages use their last published versions; references to changed packages use the new version. Therefore, a real runtime dependency update can require publishing a consumer even when its own source is unchanged. Explicit non-workspace ranges are preserved. Workspace manifests are never rewritten to pin these published versions.

Supported workspace dependency forms are `workspace:*`, `workspace:^`, and `workspace:~`. Runtime workspace dependency cycles fail explicitly. Coordinated workspace versions are still required. Keep the fingerprint algorithm versioned; changing normalization requires a deliberate baseline migration.

## Publication baseline

`release/published-beta.json` was initialized from the actual npm beta.2 tarballs, with their registry integrity verified. It is not based on local Git tags or old local build artifacts.

For a new release channel, run `pnpm release:baseline` once. It downloads that channel's published packages and records normalized content fingerprints and npm integrity values. A registry-confirmed missing package/tag is treated as a new publication; network/authentication failures abort without writing a baseline. The command refuses to overwrite an existing ledger. Stable and prerelease channels have separate ledgers so a beta upload cannot suppress the first stable publication.

Never advance the ledger during preparation or copy a prepared plan into it: that would mark unpublished content as released.
