# @fluentic/i18n

Universal message declarations and synchronous rendering. Import `t` and `I18nRegistry` here in shared business/UI modules. Install a platform adapter for rendering and management:

- `@fluentic/i18n-web`: React SPA/browser.
- `@fluentic/i18n-rn`: React Native / Expo.
- `@fluentic/i18n-nextjs`: Next.js App Router.

```ts
import { t } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';
const greeting = t.msg('Hello {name}', { name: String });
I18nManager.configure({ languageId: 'en' });
await I18nManager.init();
t.text(greeting, { name: 'Ada' });
```

`t.msg` is inert and safe at module scope. `t.text` returns a string; `t.jsx` returns JSX synchronously. Initialize before rendering. Persistence is opt-in.

The default runtime uses cached `intl-messageformat`. Set `compiled: true` in your CLI configuration and add `@fluentic/i18n/plugin/{vite,rollup,esbuild,webpack,babel}` to compile messages. The plugin rewrites universal imports to `/compiled`, which interprets compact messages without an ICU parser. Auto/manual files stay unchanged; merged rows become `[hash, compactMessage]`.

See [platforms](../../docs/docs/runtime/platforms.md), [compiler](../../docs/docs/runtime/compilation.md), [API](../../docs/docs/api.md), and the projects under `examples/`.
