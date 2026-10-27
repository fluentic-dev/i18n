---
title: Platform adapters
sidebar_label: Platform adapters
---

# Universal messages, platform setup

Business and UI modules import `t` and `I18nRegistry` from `@fluentic/i18n`. Only setup and integration files need a platform adapter.

| Entry                     | Responsibility                                                            |
| ------------------------- | ------------------------------------------------------------------------- |
| `@fluentic/i18n`          | Universal descriptors, synchronous text/JSX calls, dynamic ICU formatting |
| `@fluentic/i18n/compiled` | Compact message interpreter; selected by the compiler                     |
| `@fluentic/i18n-web`      | React rendering, subscriptions, optional browser storage                  |
| `@fluentic/i18n-rn`       | React Native rendering and optional native storage                        |
| `@fluentic/i18n-nextjs`   | RSC/client exports, request initialization and provider hydration         |
| `@fluentic/i18n/adapter`  | Generic manager factories and integration contracts                       |

The normal runtime includes `intl-messageformat`. The compiled runtime has no parser or `intl-messageformat` dependency in its import graph. Both use the same adapters. See [compilation](./compilation).

## React web

Follow the [React web / Vite guide](./react-web) for a complete compiled setup with loading and switching.

```ts
import { t } from '@fluentic/i18n';
import { createLocalStorage, I18nManager } from '@fluentic/i18n-web';

I18nManager.configure({ languageId: 'en' });
I18nManager.setStorage(createLocalStorage()); // Optional; persistence is off by default.
await I18nManager.init();
t.text('Hello');
```

`t.msg()` is safe at module scope. It performs no lookup and binds no locale. Both `t.text()` and `t.jsx()` are synchronous. Initialize before rendering. A missing translation falls back to the source; an uninitialized runtime is an error.

## React Native

Use the same universal `t`, with management from `@fluentic/i18n-rn`. Render textual JSX inside a React Native `Text` element. `createNativeStorage(AsyncStorage)` accepts an AsyncStorage-compatible object without forcing a native storage dependency.

```ts
import { createNativeStorage, I18nManager } from '@fluentic/i18n-rn';
import AsyncStorage from '@react-native-async-storage/async-storage';
I18nManager.setStorage(createNativeStorage(AsyncStorage));
```

For compilation, add `@fluentic/i18n-rn/plugin/babel` to the host app's Babel plugins. Keep its Expo/Metro preset. Follow the [React Native / Expo guide](./react-native) for Babel setup, catalog packaging, initialization, state observation, and persistence. See `examples/rn` for a runnable Expo app.

## Next.js

See [Next.js integration](./nextjs). Language selection belongs to the app. The adapter does not introduce locale URLs, routing middleware, or redirects.

## Isolated instances

`createI18nManager()` returns `{manager, state, runtime}` without replacing the default runtime. Pass an initialized instance to `I18nProvider` for an isolated React subtree. `t.jsx()` reads that provider when its returned component renders.

For synchronous attributes in an isolated provider, use `useI18nRenderer(t.text)` with a descriptor. This explicitly binds the existing universal renderer and subscribes the component. A plain global `t.text()` cannot discover React context outside React hooks.

```tsx
import { t } from '@fluentic/i18n';
import { useI18nRenderer } from '@fluentic/i18n-web';
const search = t.msg('Search');
function Search() {
  const text = useI18nRenderer(t.text);
  return <input aria-label={text(search)} />;
}
```

The adapters augment the shared `I18nJsxConfig` interface in `@fluentic/i18n/types`. A separately typechecked React library must include the React adapter's types in its own compilation; an application's augmentation cannot retroactively affect that library's typecheck.
