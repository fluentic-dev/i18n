---
title: Compile messages
sidebar_label: Compiler & bundlers
---

# Compile messages ahead of time

Compilation is optional. The default runtime accepts ICU strings and caches `IntlMessageFormat` instances. Compiled applications interpret compact message instructions and do not ship the ICU parser or `intl-messageformat`.

## What compilation changes

Keep `t.msg()`, `t.text()`, and `t.jsx()` in source. The plugin compiles static ICU messages at build time, removes static context chains, and rewrites the core import to `/compiled`. The shipped runtime formats compact instructions with native `Intl` APIs. There is no runtime ICU parsing, and the parser/compiler packages stay out of the application bundle.

The compiler preserves `t.jsx(() => element)` as a reactive boundary and compiles message calls nested inside its callback normally. In client-binding modes such as Next.js, those nested `t.text()` calls do not add a whole-component subscription; the callback boundary remains the sole subscriber.

The compiled message runtime measures about **2.4 KB gzip**. A typical React setup including the manager, translation loading, language switching, state observation, and JSX rendering measures about **4.5 KB gzip**. These sizes exclude React, catalogs, and the compiled fallback data emitted for each message. They are not claims about total application size or benchmark parity with another library.

Compilation is optional. The normal runtime remains useful for apps that want no build integration or need dynamic ICU source strings. Both paths keep the same authoring API and platform adapters. See the [React web](./react-web), [React Native / Expo](./react-native), and [Next.js](./nextjs) setup guides, or [configuration examples for each bundler](./bundlers).

## Enable the pipeline

Install the Node-only compiler alongside the CLI:

```sh
pnpm add -D @fluentic/i18n-cli @fluentic/i18n-compiler
```

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: { hashLength: 8 },
  catalogFormat: 'mjs',
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx,js,jsx}'] },
});
```

Run the normal CLI `update`/`merge` workflow. Auto and manual files remain readable records. The generated `merged.mjs` exports an array beginning with `{compiled:true}` followed by `[hash, compactMessage]` rows. Plain messages use strings; structured messages use compact instructions. Deploy catalogs with the matching runtime. Structural validation occurs once at load time.

The key is MurmurHash3 x64 128-bit encoded as base64url and shortened to eight characters by default. Set `compiled: { hashLength: 6 }` through `compiled: { hashLength: 22 }` when another size is appropriate. The CLI and every compiler plugin read the same setting. Keys depend on context and source text, never locale or translation, and catalog compilation fails on collisions. Changing the length requires regenerating catalogs and rebuilding application source.

Exports for translators still use readable records reconstructed from `meta.jsonl` and the auto/manual layers. Importing reviewed translations keeps the source/context identity.

## Add the build adapter

| Tool                        | Integration                                      |
| --------------------------- | ------------------------------------------------ |
| Vite                        | `@fluentic/i18n-compiler/vite`                   |
| Rollup                      | `@fluentic/i18n-compiler/rollup`                 |
| esbuild                     | `@fluentic/i18n-compiler/esbuild`                |
| webpack                     | `@fluentic/i18n-compiler/webpack` (plugin class) |
| Babel                       | `@fluentic/i18n-compiler/babel`                  |
| React Native / Expo         | `@fluentic/i18n-compiler/babel`                  |
| Next.js webpack / Turbopack | `@fluentic/i18n-compiler/nextjs`                 |

```ts title="vite.config.ts"
import fluentic from '@fluentic/i18n-compiler/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [fluentic({ config: './i18n.config.ts' }), react()],
});
```

Adapters never assume the config location. Pass `{config: './any/path/to/config.ts'}` to reuse its `compiled.hashLength`, pass `{hashLength: 8}` directly, or omit both to use the default. A direct hash length overrides the selected config. A compiler plugin always compiles and therefore has no `compiled` boolean.

The standalone `@fluentic/i18n-compiler` package parses its own JS/TS/JSX/TSX source, resolves bindings, rewrites calls and emits code plus source maps. It is separate from the browser/native-safe `@fluentic/i18n` runtime. Vite runs it before other transforms; Rollup users should put it before TS/JSX transpilers. The Babel adapter owns parsing through `parserOverride`, and reparses original source when a host supplies an AST. It cannot share parsing of a Fluentic source file with another parser override. Keep ordinary React/TypeScript presets.

Compiler adapters only transform application source; catalog loading stays with the host bundler. Prefer CLI-generated JSON, MJS, or CJS catalogs. JSONL text remains supported by the runtime when loaded explicitly, for example with Vite's own `?raw` imports or `fetch()`.

## Same-file tracing

```ts
import { t as tr } from '@fluentic/i18n';
const account = tr.context('account');
const actions = account.context('actions');
export const save = actions.msg('Save');
```

The compiler follows bindings back to the actual Fluentic `t` import. It removes static context chains and injects a hash plus compiled source fallback. Shadowed variables and unrelated `.text()` calls are left alone. Namespace imports, immutable local aliases, static string constants, and TypeScript expression wrappers are supported.

Scoped translators must remain local and must not be reassigned, exported, or passed into unknown functions. Repeat the context in another file. Descriptors created by `t.msg()` can be exported normally. Dynamic ICU strings require the normal runtime; the compiled runtime rejects them rather than importing a parser silently.

Normal imports of `t` are rewritten to `/compiled`; adapter imports remain unchanged. Already compiled imports are untouched. Dependencies are excluded by default. Compile shared libraries when publishing, or use `includePackages: ['@acme/ui']` in a bundler adapter when consuming source dependencies. Import rewriting alone cannot compile opaque prebuilt libraries.

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
| Dynamic `t`                                        |         50,269 |     15,681 |
| Compiled `t`                                       |          6,002 |      2,431 |
| Compiled `t` + manager + state (typical React app) |         12,255 |      4,472 |
| Dynamic `t` + manager + state (typical React app)  |         56,490 |     17,807 |
| Compiled React app + registry + localStorage       |         12,862 |      4,656 |
| Compiled `t` + all Next.js client exports          |         14,153 |      5,017 |
| Compiled `t` + all RN exports + storage wrapper    |         13,809 |      4,950 |
| Compiled `t` + all web adapter exports             |         15,268 |      5,356 |
| All web adapter exports alone                      |          9,528 |      3,415 |
| Manager factory alone                              |          5,527 |      2,151 |
| Registry alone                                     |            606 |        344 |

Measured on 2026-11-21. The bundle check asserts that compiled/runtime-management outputs contain no ICU parser, `intl-messageformat`, Babel code, or dynamic message hasher. Compiler tooling is loaded only by build entrypoints. Importing only the registry from the normal core entrypoint also tree-shakes away the dynamic formatter.

The compiled `t` measurement retains the whole API, including descriptor handling, parameter validation, rich tags, format caching, runtime lookup, and the compact interpreter. It does not include catalog loading or React itself. The typical React measurement adds `I18nManager` and `I18nState` from the web adapter, including automatic JSX subscriptions. The RN figure excludes AsyncStorage; the Next.js figure covers client code only.
