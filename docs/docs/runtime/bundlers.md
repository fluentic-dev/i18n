---
title: Bundler and Babel plugins
sidebar_label: Bundler plugins
description: Enable the standalone Fluentic compiler in Vite, Rollup, esbuild, webpack, or Babel.
---

# Bundler and Babel plugins

All adapters call the same standalone compiler. It parses its own JS/TS/JSX/TSX, follows same-file bindings back to Fluentic imports, and returns transformed source with source maps. Your bundler still handles TypeScript stripping, JSX transforms, and application bundling.

First install `@fluentic/i18n` and your platform adapter, add `@fluentic/i18n-cli` as a development dependency, and enable `compiled: true` in [the shared configuration](./compilation#enable-the-pipeline). The compiler plugins ship as subpaths of the runtime package; they are used at build time only.

Continue writing `import {t} from '@fluentic/i18n'`. Do not manually change source calls to `/compiled`: that entry accepts generated payloads, not message literals.

## Vite

```ts title="vite.config.ts"
import fluentic from '@fluentic/i18n/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [fluentic(), react()] });
```

The plugin runs before other source transforms. It loads direct `.jsonl` imports as text; Vite's `?raw` imports continue to return text. See [the complete React web guide](./react-web).

## Rollup

```js title="rollup.config.mjs"
import fluentic from '@fluentic/i18n/plugin/rollup';
export default {
  input: 'src/main.js',
  output: { file: 'dist/main.js', format: 'esm', sourcemap: true },
  plugins: [fluentic()],
};
```

Put Fluentic before your existing TypeScript/JSX transpilers. Keep the resolution and CommonJS plugins needed by your app. The snippet shows the Fluentic integration, not a complete React bundling configuration.

## esbuild

```js title="build.mjs"
import fluentic from '@fluentic/i18n/plugin/esbuild';
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
import FluenticI18nPlugin from '@fluentic/i18n/plugin/webpack';
export default {
  mode: 'production',
  entry: './src/main.js',
  devtool: 'source-map',
  plugins: [new FluenticI18nPlugin()],
};
```

The plugin installs a pre-loader and composes source maps. Keep your existing Babel, SWC, or TypeScript loader for the remaining JS/TS/JSX processing. Both direct `.jsonl` imports and source files are handled by the Fluentic loader.

## Babel

```js title="babel.config.cjs"
module.exports = {
  plugins: ['@fluentic/i18n/plugin/babel'],
};
```

Keep the app's existing presets. The plugin supports ESM and synchronous CommonJS loading. It uses its own parser for matching source; when a host such as Metro supplies an AST, it reparses the original source. Do not combine competing Babel parser overrides on the same Fluentic source file.

Babel does not bundle catalogs or implement an asset loader. Use your host's catalog loading or provide JavaScript arrays/JSONL strings to the manager. The [React Native guide](./react-native) shows how to package merged catalogs for Metro.

## Options and shared packages

Each generic plugin accepts:

```ts
{
  config: './i18n.config.ts', // Optional path, relative to the app working directory.
  compiled: true,           // Optional explicit override of shared config.
  includeDependencies: true // Optional; dependencies are excluded by default.
}
```

For Babel, pass options as `['@fluentic/i18n/plugin/babel', options]`. For webpack, use `new FluenticI18nPlugin(options)`; other bundler factories accept `fluentic(options)`.

With no override, plugins read `i18n.config.ts`, `.js`, or `.mjs` from the app working directory. Compilation is disabled when no config enables it. The CLI and plugin must use the same compilation mode. Regenerate merged catalogs and restart the development server after changing mode.

Compile shared-library source when publishing, or include source dependencies in the consuming build. Runtime import rewriting cannot compile messages hidden inside opaque prebuilt dependencies. Export message descriptors between files, not scoped translators; [same-file tracing](./compilation#same-file-tracing) is intentional.

Next.js uses its own [single configuration wrapper](./nextjs), which configures both webpack and Turbopack. React Native uses `@fluentic/i18n-rn/plugin/babel`. Do not add the generic plugin again when a framework adapter already installs it.

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
