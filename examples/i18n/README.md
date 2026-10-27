# Interactive i18n casebook

This example is both a realistic product screen and a small manual test bench.

- **Overview** shows several features working together in a dashboard.
- **Case lab** isolates plural, select, number, date, rich-text, context, regional fallback, and source fallback behavior.
- **English**, **French**, and **French (Canada)** make source, translated, and regional fallback behavior visible.

The browser and the tests load the same catalog from `src/catalogs.ts`, so the example cannot silently drift away from its assertions.

```sh
pnpm --filter @example/i18n dev
pnpm --filter @example/i18n test
```

The tests cover every interactive case and are also included in the workspace `pnpm test` command.
