---
"@fluentic/i18n": patch
"@fluentic/i18n-cli": patch
"@fluentic/i18n-compiler": patch
"@fluentic/i18n-nextjs": patch
"@fluentic/i18n-rn": patch
"@fluentic/i18n-web": patch
---

Prepare the second public beta with a standalone compiler package, generated runtime catalog formats, production-oriented React SPA loading and cache behavior, expanded Next.js cookie and URL language handling, TypeScript 7 builds, and package exports backed exclusively by emitted declaration files.

The web adapter adds `createTranslationCacheLoader`, which persists loader results per language, invalidates them with the CLI-generated hash manifest, and exposes explicit `remove(languageId)` and `clear()` controls.
