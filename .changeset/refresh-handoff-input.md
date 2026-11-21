---
"@fluentic/i18n-cli": patch
---

Refresh handoff inputs on every export with only currently missing translations while preserving existing output for agent reuse. Keep short message keys stable, never recycle retired keys, remove obsolete inputs and context even when no work remains, and roll back failed refreshes.
