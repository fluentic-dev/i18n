---
"@fluentic/i18n": patch
---

Place descriptor JSX overloads before callback overloads in both runtimes. Preserve empty-result types for nullish `t.params` inputs, require nested descriptor schema values to have their required params bound, and snapshot schemas so caller mutations cannot change descriptor validation.
