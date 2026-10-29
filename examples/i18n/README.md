# Interactive i18n casebook

This example is both a realistic product screen and a small manual test bench.

- **Overview** shows several features working together in a dashboard.
- **Case lab** isolates plural, select, number, date, rich-text, context, regional fallback, and source fallback behavior.
- **English**, **French**, and **French (Canada)** make source, translated, and regional fallback behavior visible.

This example uses the same workflow as an application:

1. The CLI extracts messages from `src/**/*`.
2. DeepL automatically translates supported language pairs; Google is the ordered fallback provider.
3. Generated automatic and manual layers are merged into `i18n/translations/fr/merged.jsonl`.
4. `src/translations.ts` uses `defineTranslationLoader` to import that merged catalog asynchronously when the runtime changes language.

The language control is a custom HTML listbox. It displays the runtime loading state while the catalog chunk is being imported, then the subscribed screen rerenders all plain and rich messages together.

```sh
pnpm --filter @example/i18n dev
pnpm --filter @example/i18n i18n update
pnpm --filter @example/i18n test
```

Every example config reads translation credentials from the single ignored `examples/i18n.local.env` file. The tests load the generated merged catalog and are also included in the workspace `pnpm test` command.
