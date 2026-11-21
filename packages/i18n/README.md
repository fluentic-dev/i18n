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

For a fine-grained React update boundary, wrap one element whose string props use `t.text`:

```tsx
t.jsx(() => <input placeholder={t.text('Search')} />);
```

Only that wrapper reruns when the language changes. Use `I18nState.use()` instead when rerendering the whole component is more convenient.

The default runtime uses cached `intl-messageformat`. Install the separate Node-only `@fluentic/i18n-compiler` package, set `compiled: true` or `compiled: { hashLength: 8 }` for the CLI, and add its `/vite`, `/rollup`, `/esbuild`, `/webpack`, `/babel`, or `/nextjs` integration. Adding a compiler integration always compiles source; its only compilation option is `hashLength`, which defaults to the value in shared CLI config. Compiled merged catalogs start with `{"compiled":true}` followed by short base64url-keyed compact messages.

See [platforms](../../docs/docs/runtime/platforms.md), [compiler](../../docs/docs/runtime/compilation.md), [API](../../docs/docs/api.md), and the projects under `examples/`.
