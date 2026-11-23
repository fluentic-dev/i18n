---
"@fluentic/i18n-cli": minor
"@fluentic/i18n-compiler": minor
---

Add read-only `fluentic-i18n lint` checks for source parameters, ICU translation contracts, authoring catalogs, extraction drift, and coverage, with optional strict warning failures and project-specific forbidden-message rules. Add `lint.parameterChecks` to toggle parameter and schema diagnostics globally or per method/translation layer, with per-message skip match rules and predicates, and `lint.forbiddenMessages` for exact, substring, or custom callback checks. Expose structured lint results for tooling and reuse source analysis and handoff validation.

Emit explicit relative declaration imports for CLI/compiler TypeScript NodeNext consumers.
