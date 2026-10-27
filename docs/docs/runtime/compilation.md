---
title: Compile messages
sidebar_label: Compiler & bundlers
---

# Compile messages ahead of time

Compilation is optional. The default runtime accepts ICU strings and caches `IntlMessageFormat` instances. Compiled applications interpret compact message instructions and do not ship the ICU parser or `intl-messageformat`.

## What compilation changes

Keep `t.msg()`, `t.text()`, and `t.jsx()` in source. The plugin compiles static ICU messages at build time, removes static context chains, and rewrites the core import to `/compiled`. The shipped runtime formats compact instructions with native `Intl` APIs. There is no runtime ICU parsing, and the parser/compiler packages stay out of the application bundle.

The compiled message runtime measures about **2.2 KB gzip**. A typical React setup including the manager, translation loading, language switching, state observation, and JSX rendering measures about **3.9 KB gzip**. These sizes exclude React, catalogs, and the compiled fallback data emitted for each message. They are not claims about total application size or benchmark parity with another library.

Compilation is optional. The normal runtime remains useful for apps that want no build integration or need dynamic ICU source strings. Both paths keep the same authoring API and platform adapters. See the [React web](./react-web), [React Native / Expo](./react-native), and [Next.js](./nextjs) setup guides, or [configuration examples for each bundler](./bundlers).

## Enable the pipeline

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx,js,jsx}'] },
});
```

Run the normal CLI `update`/`merge` workflow. Auto and manual files remain readable records. Each compiled `merged.jsonl` line is `[hash, compactMessage]`. Plain messages use strings; structured messages use compact instructions. An adjacent `.meta.json` records format version 1. Deploy catalogs with the matching runtime; if fetching external catalogs, check the metadata version before passing the data to the loader. Structural validation occurs once at load time.

The hash is the first 96 bits of SHA-256 over the source identity: `context + '\0' + source`, or just source without context. It does not depend on locale or translation. Catalog compilation checks collisions across its records. Editing the source or context changes its identity. Empty authoring translations are omitted; an explicit compiled row with an empty string renders empty text.

Exports for translators still use readable merged records reconstructed from the auto/manual layers. Importing reviewed translations therefore keeps the existing source/context identity.

## Add the build adapter

| Tool                        | Integration                                    |
| --------------------------- | ---------------------------------------------- |
| Vite                        | `@fluentic/i18n/plugin/vite`                   |
| Rollup                      | `@fluentic/i18n/plugin/rollup`                 |
| esbuild                     | `@fluentic/i18n/plugin/esbuild`                |
| webpack                     | `@fluentic/i18n/plugin/webpack` (plugin class) |
| Babel                       | `@fluentic/i18n/plugin/babel`                  |
| React Native / Expo         | `@fluentic/i18n-rn/plugin/babel`               |
| Next.js webpack / Turbopack | `@fluentic/i18n-nextjs/plugin`                 |

```ts title="vite.config.ts"
import fluentic from '@fluentic/i18n/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [fluentic(), react()] });
```

Adapters read `i18n.config.ts`, `.js`, or `.mjs` in the working directory. Pass `{config: './path/to/config.ts'}` for another location. `{compiled: true}` is also available for isolated build fixtures. The CLI and plugin must agree on compilation mode. After changing the mode, regenerate catalogs and restart the development server.

The standalone compiler parses its own JS/TS/JSX/TSX source, resolves bindings, rewrites calls and emits code plus source maps. Vite runs it before other transforms; Rollup users should put it before TS/JSX transpilers. The Babel adapter owns parsing through `parserOverride`, and reparses original source when a host supplies an AST. It cannot share parsing of a Fluentic source file with another parser override. Keep ordinary React/TypeScript presets.

Vite, Rollup, esbuild and webpack adapters load `.jsonl` imports as arrays. Babel only transforms source: use the host's asset loader or provide parsed catalogs/JSONL strings. `?raw` remains Vite's own text-loading mechanism.

## Same-file tracing

```ts
import { t as tr } from '@fluentic/i18n';
const account = tr.context('account');
const actions = account.context('actions');
export const save = actions.msg('Save');
```

The compiler follows bindings back to the actual Fluentic `t` import. It removes static context chains and injects a hash plus compiled source fallback. Shadowed variables and unrelated `.text()` calls are left alone. Namespace imports, immutable local aliases, static string constants, and TypeScript expression wrappers are supported.

Scoped translators must remain local and must not be reassigned, exported, or passed into unknown functions. Repeat the context in another file. Descriptors created by `t.msg()` can be exported normally. Dynamic ICU strings require the normal runtime; the compiled runtime rejects them rather than importing a parser silently.

Normal imports of `t` are rewritten to `/compiled`; adapter imports remain unchanged. Already compiled imports are untouched. Dependencies are excluded by default. Compile shared libraries when publishing, or use `includeDependencies: true` in a supported bundler adapter when consuming source dependencies. Import rewriting alone cannot compile opaque prebuilt libraries.

## Examples

From the repository root, run `pnpm build:packages`, then:

- `pnpm --filter @example/compiled-vite dev`: React UI and locale switching.
- `pnpm --filter @example/compiled-rollup build && pnpm --filter @example/compiled-rollup start`
- `pnpm --filter @example/compiled-esbuild build && pnpm --filter @example/compiled-esbuild start`
- `pnpm --filter @example/compiled-webpack build && pnpm --filter @example/compiled-webpack start`
- `pnpm --filter @example/compiled-babel build && pnpm --filter @example/compiled-babel start`
- `pnpm --filter @example/rn dev`: Expo app; `build` checks the RN Babel transform.
- `pnpm --filter @example/nextjs dev`: request-isolated RSC/client application.

The Node examples print `Bonjour Ada`. Run `pnpm test:bundles` to measure the packaged runtime and verify that compiled bundles have no FormatJS parser or message formatter.

## Runtime size measurements

The workspace's `pnpm test:bundles` bundles the packaged ESM entrypoints with esbuild minification. React, translation catalogs, per-message fallback payloads, and application loader code are excluded. These are standalone import measurements, not additive costs; shared code is deduplicated when bundled together.

| Export set                                         | Minified bytes | Gzip bytes |
| -------------------------------------------------- | -------------: | ---------: |
| Dynamic `t`                                        |         46,111 |     13,974 |
| Compiled `t`                                       |          5,325 |      2,190 |
| Compiled `t` + manager + state (typical React app) |         10,339 |      3,887 |
| Dynamic `t` + manager + state (typical React app)  |         51,156 |     15,763 |
| Compiled React app + registry + localStorage       |         10,946 |      4,072 |
| Compiled `t` + all Next.js client exports          |         11,404 |      4,198 |
| Compiled `t` + all RN exports + storage wrapper    |         11,962 |      4,390 |
| Compiled `t` + all web adapter exports             |         11,732 |      4,307 |
| All web adapter exports alone                      |          6,926 |      2,626 |
| Manager factory alone                              |          4,847 |      1,891 |
| Registry alone                                     |            566 |        321 |

Measured on 2026-10-27. The bundle check asserts that compiled/runtime-management outputs contain no ICU parser, `intl-messageformat`, or Babel code. Compiler tooling is loaded only by build entrypoints. Importing only the registry from the normal core entrypoint also tree-shakes away the dynamic formatter.

The compiled `t` measurement retains the whole API, including descriptor handling, parameter validation, rich tags, format caching, runtime lookup, and the compact interpreter. It does not include catalog loading or React itself. The typical React measurement adds `I18nManager` and `I18nState` from the web adapter, including automatic JSX subscriptions. The RN figure excludes AsyncStorage; the Next.js figure covers client code only.
