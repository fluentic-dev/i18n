# @fluentic/i18n-compiler

Node build-time compiler and integrations for Fluentic i18n.

```ts
import fluentic from '@fluentic/i18n-compiler/vite';

export default { plugins: [fluentic({ config: './i18n.config.ts' })] };
```

The compiler always compiles matching source. Config location is never assumed. Both settings are optional: pass `{config: './any/path/i18n.config.ts'}` to reuse its `compiled.hashLength`, `{hashLength: 6}` to set the value directly, or neither to use the compiler default. A direct value overrides the selected config.

File filtering is shared across the adapters:

- `include` and `exclude` accept a glob, a regular expression, or an array of either. IDs are matched without query strings or hash fragments; glob paths normalize Windows separators.
- By default, script files (`js`, `jsx`, `ts`, `tsx`, and their `m`/`c` variants) are included and `node_modules` is excluded. Setting `include` replaces the default include and removes the implicit dependency exclusion. An explicit `exclude` replaces the default exclusion.
- `includePackages` accepts an exact npm package name or an array of names. Matching packages' script files bypass file-level `include` and `exclude` rules.
- `excludePackages` accepts the same form and always wins, including over `includePackages` and `includeDependencies`.
- Package matching uses the innermost `node_modules` owner, supports scoped packages and pnpm paths, and does not apply a parent's rule to nested dependencies. Linked workspace source outside `node_modules` uses the file rules.
- `includeDependencies: true` remains supported to remove the implicit dependency exclusion for all packages.

For example, `fluentic({ includePackages: ['@acme/ui'], excludePackages: ['legacy-ui'] })` compiles application scripts and source from `@acme/ui`, while always skipping `legacy-ui`. These options also work with the Next.js wrapper; use string globs for Next.js options so Turbopack can serialize them.

Vite exposes a native `transform.filter` to skip irrelevant modules before invoking JavaScript, and its handler checks the authoritative shared filter. When an external `config` is selected, the native filter stays broad so config reloads cannot leave stale exclusions. Custom integrations can import `createTransformFilter` and `createTransformHookFilter` from `@fluentic/i18n-compiler`; the shared filter caches decisions and exposes `clear()`.
