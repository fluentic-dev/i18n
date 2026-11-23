---
title: v0.1.0 beta.2
sidebar_label: Beta.2 changes
description: React SPA caching, fine-grained JSX reactivity, standalone compilation, explicit hydration, and built declaration files.
---

# What changed in beta.2

Beta.2 completes the production-oriented React SPA path and makes server and build-time features explicit package boundaries. All public packages use the same `0.1.0-beta.2` version.

## React SPA updates

The web adapter now exports `createTranslationCacheLoader()`. It wraps an ordinary translation loader, stores its raw result per language in localStorage, and compares it with the CLI-generated runtime hash on later application loads:

```ts
const cache = createTranslationCacheLoader(loader, {
  hash: () => import('../i18n/translations/hash.json'),
});

I18nManager.setTranslationLoader(cache.loader);

cache.remove('fr');
cache.clear();
```

Unavailable, corrupt, private-mode, or quota-limited storage does not prevent the underlying loader from returning translations. Cache controls remove persistent data; replacing the manager loader also clears its in-memory catalogs.

The CLI hashes final runtime catalog rows rather than only authoring records. Translation changes and compiler options that change emitted rows therefore invalidate the browser cache together.

## Fine-grained string props

React adapters support a callback overload for one element with translated string props:

```tsx
return t.jsx(() => (
  <input
    placeholder={t.text('Search projects')}
    aria-label={t.text('Search projects')}
  />
));
```

Only the wrapper reruns on language changes; its parent component does not. The callback must return one React element and should not contain hooks. Nested messages are extracted and compiled normally.

Use `I18nState.use()` when rerendering the whole component is more convenient or when it needs `languageId`, `isLoading`, or `ready`.

## Package boundaries

- Build transforms and Vite, Rollup, esbuild, webpack, Babel, React Native, and Next.js integrations live in the Node-only `@fluentic/i18n-compiler` package.
- `getSnapshot()` and `hydrate()` live at `@fluentic/i18n/hydration`. They are no longer methods on the normal SPA manager.
- Next.js owns its hydration boundary internally and provides validated cookie and URL-prefix language strategies.
- The core, web, native, Next.js, CLI, and compiler packages publish TypeScript-generated `dist/*.d.ts` files. Package `types` exports no longer point at source files.
- Package builds use TypeScript 7.0.2.

## SPA setup summary

For a compiled Vite SPA, install the runtime, adapter, CLI, and compiler:

```sh
pnpm add @fluentic/i18n@beta @fluentic/i18n-web@beta
pnpm add -D @fluentic/i18n-cli@beta @fluentic/i18n-compiler@beta
```

Enable `compiled: true` in `i18n.config.ts`, add `@fluentic/i18n-compiler/vite` before the React plugin, configure a hash-aware loader, await `I18nManager.init()`, and only then mount React. Follow the complete [React web / Vite guide](../runtime/react-web).

## Migration notes

- Replace imports from old `@fluentic/i18n/plugin/*` paths with `@fluentic/i18n-compiler/*`.
- Replace manager-level snapshot calls with imports from `@fluentic/i18n/hydration` in custom SSR adapters. SPAs need neither API.
- Keep normal application imports as `import {t} from '@fluentic/i18n`; compiler plugins rewrite them internally.
- Deploy compiled source and compiled catalogs together.
- Keep using `I18nState.use()` for component-level reactivity. Adopt `t.jsx(() => element)` only where a targeted element boundary is useful.

See the [API reference](../api), [compiler guide](../runtime/compilation), [translation cache guide](../runtime/loading#persistent-browser-cache), and [catalog hash guide](../cli/hash) for the complete behavior.

## Translation tooling

Beta.2 includes built-in JSON, CSV, XLIFF, and LLM handoff exchange workflows. Handoff exports refresh missing inputs while preserving existing agent output. Imports validate translation records before writing them.

Core helpers and all shared types remain at `@fluentic/i18n-cli`. Import concrete implementations from their subpaths:

```ts
import { defineConfig, filterTranslator } from '@fluentic/i18n-cli';
import { csvConverter, jsonConverter, xliffConverter } from '@fluentic/i18n-cli/converters';
import { createDeepLTranslator, createGoogleTranslator } from '@fluentic/i18n-cli/translators';
```

`filterTranslator` supports target-language allow and deny lists while preserving a provider's support checks. The old `googleTranslate` and `deeplTranslate` aliases are removed.

Every CLI command now reports readable failures and useful outcomes. Extraction includes cache-hit and message counts even when all files are cached. Translation, merge, import, and export report counts and output locations. Output uses colored status tags, aligned summaries, elapsed times, and relative paths where practical. `Config` stays flush left, nested stages are indented, and completion lines have a blank line above them. Use `--verbose` for individual files and message IDs, and `--no-color` or `NO_COLOR` to disable color. `FORCE_COLOR=1` enables color in captured output. Handoff guides and repair instructions are clean copyable blocks with absolute paths inside the instructions. Stack traces are hidden by default; use `--debug` for technical details.

The web translation cache also supports `storageMode: 'last' | 'all'` (default `all`), allowing apps to persist only the selected language.

The handoff format is named `handoff`: use `export handoff` and `import handoff`. Its default directory is `<output>/<dirs.exports>/handoff`. Re-export any manifests created with the previous format name before importing.
