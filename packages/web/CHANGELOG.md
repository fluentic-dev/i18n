# @fluentic/i18n-web

## 0.1.0-beta.2

### Additional beta.2 changes

- Add `storageMode: 'last' | 'all'` to `createTranslationCacheLoader`, defaulting to `all`. Last mode retains the selected language without letting fallback or superseded requests replace it.

### Patch Changes

- Add `createTranslationCacheLoader`, which persists loader results per language, invalidates them with the CLI-generated hash manifest, and exposes `remove(languageId)` and `clear()` controls.
- Keep corrupt, unavailable, or quota-limited local storage from breaking translation loading.
- Publish built TypeScript declarations and require the beta.2 core runtime.

## 0.1.0-beta.1

### Minor Changes

- Publish the first public beta of the React web bindings with language persistence and React integration.

### Patch Changes

- Updated dependencies
  - @fluentic/i18n@0.1.0-beta.1
