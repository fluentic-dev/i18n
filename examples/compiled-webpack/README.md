# Webpack compiled example

From the repository root, build packages first, then:

```sh
pnpm --filter @example/compiled-webpack build
pnpm --filter @example/compiled-webpack start
```

Expected output: `Bonjour Ada`. The source uses a disconnected context alias. The build reads `compiled: true` from `i18n.config.ts` and emits source maps.
