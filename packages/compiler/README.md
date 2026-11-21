# @fluentic/i18n-compiler

Node build-time compiler and integrations for Fluentic i18n.

```ts
import fluentic from '@fluentic/i18n-compiler/vite';

export default { plugins: [fluentic({ config: './i18n.config.ts' })] };
```

The compiler always compiles matching source. Config location is never assumed. Both settings are optional: pass `{config: './any/path/i18n.config.ts'}` to reuse its `compiled.hashLength`, `{hashLength: 6}` to set the value directly, or neither to use the compiler default. A direct value overrides the selected config.
