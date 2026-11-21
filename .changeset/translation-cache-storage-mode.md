---
"@fluentic/i18n-web": minor
"@fluentic/i18n": minor
---

Add storageMode: 'last' | 'all' to createTranslationCacheLoader, defaulting to all. Last mode retains only the selected language after a successful switch, including manager memory-cache hits, without letting fallback loads or superseded requests overwrite it. Add optional loader lifecycle notifications so persistent caches can observe successful manager selections.
