---
title: Configure the CLI
---

# CLI configuration

Define source-file patterns, languages, and output paths in `i18n.config.ts` or `i18n.config.js`. Optional translator and converter callbacks integrate external services and file formats.

## Create a configuration file

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  languages: { source: 'en', targets: ['fr', 'de'] },
  files: {
    includes: ['src/**/*.{ts,tsx,js,jsx}'],
    excludes: ['**/*.test.*', '**/*.spec.*', '**/generated/**'],
  },
});
```

Use `defineConfig()`: the CLI checks for it when loading the file. By default it reads `i18n.config.ts`, then `i18n.config.js`, from the directory where you run the command.

To use another file:

```sh
pnpm exec fluentic-i18n --config config/i18n.config.ts update
```

Add a project script so the config path is written once:

```json
{ "scripts": { "i18n": "fluentic-i18n --config i18n.config.ts" } }
```

Then run any command through the script:

```sh
pnpm i18n update
pnpm i18n merge
```

The CLI loads `i18n.env` and `i18n.env.local` beside the selected config file by default. The local file overrides the shared file, and values already present in `process.env` always win. A relative `env` path is resolved from the directory containing `i18n.config.ts` or `i18n.config.js`, not from the current working directory:

```ts
export default defineConfig({
  env: './secrets/translation.env',
  languages: { source: 'en', targets: ['fr'] },
});
```

Use `env: 'secrets/translation.env'` to choose one file, or `env: false` to disable env-file loading. Keep local secret files out of version control.

## Configure input and output paths

```ts
export default defineConfig({
  root: '.',
  output: 'i18n/data',
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx}'] },
  dirs: {
    cache: 'cache',
    translations: 'translations',
    exports: 'exports',
  },
  hashes: true,
});
```

`root` is the base for source-file matching. `output` is the generated-data directory. Both are resolved from the command's working directory, **not** from the config file; `output` is also independent of `root`. The `dirs` entries are subdirectories of `output`.

For a monorepo, run from the repository root and include the packages you own:

```ts
files: {
  includes: ['apps/web/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
  excludes: ['**/*.test.*', '**/*.stories.*'],
},
```

## Options and defaults

| Option              | Default / behavior                                                       |
| ------------------- | ------------------------------------------------------------------------ |
| `compiled`          | `false`; emit compact merged catalogs and enable compiler adapters       |
| `root`              | `'.'`                                                                    |
| `output`            | `'i18n/data'`                                                            |
| `languages`         | Required; source ID and target IDs                                       |
| `files.includes`    | `['**/*.{ts,tsx,js,jsx}']`                                               |
| `files.excludes`    | Additional ignores; `node_modules/**` is always ignored                  |
| `dirs.cache`        | `'cache'`                                                                |
| `dirs.translations` | `'translations'`                                                         |
| `dirs.exports`      | `'exports'`                                                              |
| `hashes`            | Hash output is enabled unless set to `false`                             |
| `translator`        | Optional callback; no service is selected by default                     |
| `env`               | `i18n.env` + `i18n.env.local` beside the config; set one path or `false` |
| `convert`           | Optional array of named import/export converters                         |
| `meta`              | Accepted by the config type; currently not applied to extracted records  |

Narrow your file globs so the CLI doesn't scan generated bundles or unrelated source. For per-message metadata, use `t.meta()` in a literal chain.

## Build-time configuration

Omit `translator` for a manual-only workflow. `update` still extracts and merges; it makes no provider requests. Export/import commands require a named converter in `convert`, as shown in [converters](./formats).

Import the CLI only in tooling, configuration, or build scripts. Load the resulting merged catalogs with the runtime package. Provider credentials belong in the environment of the CLI process.

Continue with [translator callbacks](./translators), [converters](./formats), or [loading catalogs in your app](../runtime/manager).

See [compiler and bundler integration](../runtime/compilation) for `compiled: true`.
