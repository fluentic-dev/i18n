# @fluentic/i18n

## 0.1.0-beta.2

### Additional beta.2 changes

- Notify loader lifecycle hooks after successful language selections so persistent caches can track selected languages.

### Patch Changes

- Add `t.jsx(() => element)` as a fine-grained React boundary that refreshes one element's translated string props without rerendering its parent component.
- Move server snapshot transfer out of the SPA manager and into the explicit `@fluentic/i18n/hydration` entry point.
- Harden lazy catalog loading, compiled catalog validation, locale fallback, and concurrent language switching.
- Generate and publish declaration files from TypeScript 7 instead of exposing package source files as types.

## 0.1.0-beta.1

### Minor Changes

- Publish the first public beta of the typed Fluentic i18n runtime and React bindings.
- Add optional build-time ICU compilation for Babel, Vite, Rollup, esbuild, and webpack.
- Load JSONL or array catalogs in compiled and uncompiled formats, with locale fallback and deterministic message hashing.
- Add isolated managers, reactive language state, rich-message rendering, and configurable JSX line breaks.
