---
title: Bundler and Babel plugins
sidebar_label: Bundler plugins
description: Enable the standalone Fluentic compiler in Vite, Rollup, esbuild, webpack, or Babel.
---

# Bundler and Babel plugins

All adapters call the same standalone compiler. It parses its own JS/TS/JSX/TSX, follows same-file bindings back to Fluentic imports, and returns transformed source with source maps. Your bundler still handles TypeScript stripping, JSX transforms, and application bundling.

First install `@fluentic/i18n` and your platform adapter, add the CLI and compiler as development dependencies, and enable `compiled: true` in [the shared configuration](./compilation#enable-the-pipeline):

```sh
pnpm add -D @fluentic/i18n-cli @fluentic/i18n-compiler
```

The compiler is a separate Node-only package, so its filesystem, Babel, and Node types do not enter the runtime package boundary. Its build integrations are exported as compiler subpaths and are used only during builds.

Continue writing `import {t} from '@fluentic/i18n'`. Do not manually change source calls to `/compiled`: that entry accepts generated payloads, not message literals.

## Vite

```ts title="vite.config.ts"
import fluentic from '@fluentic/i18n-compiler/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [fluentic({ config: './i18n.config.ts' }), react()],
});
```

The plugin runs before other source transforms. Catalogs use the bundler's normal JSON or JavaScript module handling; Vite's `?raw` imports remain available when JSONL text is intentionally used. See [the complete React web guide](./react-web).

## Rollup

```js title="rollup.config.mjs"
import fluentic from '@fluentic/i18n-compiler/rollup';
export default {
  input: 'src/main.js',
  output: { file: 'dist/main.js', format: 'esm', sourcemap: true },
  plugins: [fluentic()],
};
```

Put Fluentic before your existing TypeScript/JSX transpilers. Keep the resolution and CommonJS plugins needed by your app. The snippet shows the Fluentic integration, not a complete React bundling configuration.

## esbuild

```js title="build.mjs"
import fluentic from '@fluentic/i18n-compiler/esbuild';
import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.tsx'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  sourcemap: true,
  plugins: [fluentic()],
});
```

Fluentic transforms source in `onLoad`; esbuild then handles TS/JSX. Avoid assigning another source-owning `onLoad` plugin to the same files without coordinating their transforms.

## webpack

```js title="webpack.config.mjs"
import FluenticI18nPlugin from '@fluentic/i18n-compiler/webpack';
export default {
  mode: 'production',
  entry: './src/main.js',
  devtool: 'source-map',
  plugins: [new FluenticI18nPlugin()],
};
```

The plugin installs a pre-loader for source files and composes source maps. Keep your existing Babel, SWC, or TypeScript loader for the remaining JS/TS/JSX processing. Catalogs use standard JSON, MJS, or CJS imports and do not pass through the Fluentic loader.

## Babel

```js title="babel.config.cjs"
module.exports = {
  plugins: ['@fluentic/i18n-compiler/babel'],
};
```

Keep the app's existing presets. The plugin supports ESM and synchronous CommonJS loading. It uses its own parser for matching source; when a host such as Metro supplies an AST, it reparses the original source. Do not combine competing Babel parser overrides on the same Fluentic source file.

Babel does not bundle catalogs or implement an asset loader. Use your host's catalog loading or provide JavaScript arrays/JSONL strings to the manager. The [React Native guide](./react-native) shows how to package merged catalogs for Metro.

## Options and shared packages

Each generic plugin accepts:

```ts
{
  config: './any/path/i18n.config.ts', // Optional path, relative to the plugin working directory.
  hashLength: 8,                      // Optional override of compiled.hashLength from selected config.
  includePackages: ['@acme/ui'],       // Optional source dependencies to compile.
  excludePackages: ['legacy-ui'],     // Optional package exclusions; these always win.
}
```

File filtering is shared across the adapters:

- `include` and `exclude` accept a glob, a regular expression, or an array of either. IDs are matched without query strings or hash fragments; glob paths normalize Windows separators.
- By default, script files (`js`, `jsx`, `ts`, `tsx`, and their `m`/`c` variants) are included and `node_modules` is excluded. Setting `include` replaces the default include and removes the implicit dependency exclusion. An explicit `exclude` replaces the default exclusion.
- `includePackages` accepts an exact npm package name or an array of names. Matching packages' script files bypass file-level `include` and `exclude` rules.
- `excludePackages` accepts the same form and always wins, including over `includePackages` and `includeDependencies`.
- Package matching uses the innermost `node_modules` owner, supports scoped packages and pnpm paths, and does not apply a parent's rule to nested dependencies. Linked workspace source outside `node_modules` uses the file rules.
- `includeDependencies: true` remains supported to remove the implicit dependency exclusion for all packages.

For example, `fluentic({ includePackages: ['@acme/ui'], excludePackages: ['legacy-ui'] })` compiles application scripts and source from `@acme/ui`, while always skipping `legacy-ui`. These options also work with the Next.js wrapper; use string globs for Next.js options so Turbopack can serialize them.

Vite exposes a native `transform.filter` to skip irrelevant modules before invoking JavaScript, and its handler checks the authoritative shared filter. When an external `config` is selected, the native filter stays broad so config reloads cannot leave stale exclusions. Custom integrations can import `createTransformFilter` and `createTransformHookFilter` from `@fluentic/i18n-compiler`; the shared filter caches decisions and exposes `clear()`.

For Babel, pass options as `['@fluentic/i18n-compiler/babel', options]`. For webpack, use `new FluenticI18nPlugin(options)`; other bundler factories accept `fluentic(options)`.

Plugins never assume where the i18n config lives. Pass `config` to share `compiled.hashLength`, pass `hashLength` directly, or omit both to use the default. A direct `hashLength` overrides the selected config. A compiler plugin always compiles; adding the plugin is the build-time opt-in, so plugin options have no `compiled` boolean. The CLI still needs `compiled: true` or `compiled: { hashLength }` to emit matching compiled catalogs. Regenerate merged catalogs and restart the development server after changing mode or hash length.

Compile shared-library source when publishing, or include source dependencies in the consuming build. Runtime import rewriting cannot compile messages hidden inside opaque prebuilt dependencies. Export message descriptors between files, not scoped translators; [same-file tracing](./compilation#same-file-tracing) is intentional.

Next.js uses `@fluentic/i18n-compiler/nextjs`, which configures both webpack and Turbopack. React Native uses `@fluentic/i18n-compiler/babel` directly.

## Run the examples

From the repository root, run `pnpm build:packages`, then choose:

| Integration         | Build                                           | Try it                                          |
| ------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Vite / React        | `pnpm --filter @example/compiled-vite build`    | `pnpm --filter @example/compiled-vite dev`      |
| Rollup              | `pnpm --filter @example/compiled-rollup build`  | `pnpm --filter @example/compiled-rollup start`  |
| esbuild             | `pnpm --filter @example/compiled-esbuild build` | `pnpm --filter @example/compiled-esbuild start` |
| webpack             | `pnpm --filter @example/compiled-webpack build` | `pnpm --filter @example/compiled-webpack start` |
| Babel               | `pnpm --filter @example/compiled-babel build`   | `pnpm --filter @example/compiled-babel start`   |
| React Native / Expo | `pnpm --filter @example/rn build`               | `pnpm --filter @example/rn dev`                 |
| Next.js             | `pnpm --filter @example/nextjs build`           | `pnpm --filter @example/nextjs dev`             |

The plain bundler examples print `Bonjour Ada`. Their generated catalog fixtures are for demonstration; application catalogs should use the CLI's automatic/manual/merge workflow.
