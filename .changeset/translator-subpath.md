---
"@fluentic/i18n-cli": minor
---

Move built-in translator factories to `@fluentic/i18n-cli/translators` and expose the built-in `jsonConverter`, `csvConverter`, and `xliffConverter` objects through `@fluentic/i18n-cli/converters`. Remove the `googleTranslate` and `deeplTranslate` aliases; use `createGoogleTranslator` and `createDeepLTranslator`. All shared types, helpers, configuration, and command APIs remain at the package root.
