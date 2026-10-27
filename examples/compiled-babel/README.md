# Babel compiled example

From the repository root, build packages first, then:

```sh
pnpm --filter @example/compiled-babel build
pnpm --filter @example/compiled-babel start
```

Expected output: `Bonjour Ada`. The source uses a disconnected context alias. The build reads `compiled: true` from `i18n.config.ts` and emits source maps.
