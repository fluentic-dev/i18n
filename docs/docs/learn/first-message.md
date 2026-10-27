---
title: Basic React usage
---

# Basic React usage

Install the core and web adapter, [initialize the manager](../runtime/manager) before mounting, and use `t.jsx()` to render a message in a React component:

```sh
pnpm add @fluentic/i18n @fluentic/i18n-web
```

```tsx
import { t } from '@fluentic/i18n';

export function Welcome() {
  return <h1>{t.jsx('Welcome back!')}</h1>;
}
```

`t.jsx()` renders the source text when no translation is available. The returned React element handles language changes automatically.

All of `t.jsx()`, `t.text()`, and `t.msg()` mark literal messages for [CLI extraction](../cli/overview). Messages can stay in the same file as their component. Use `t.msg()` to define a message and its type-safe params before rendering it later.

The [message guide](../intro) covers params, shared `t.msg()` descriptors, strings inside and outside components, `t.try()`, plurals, and links.
