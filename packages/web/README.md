# @fluentic/i18n-web

React web adapter for universal `t` from `@fluentic/i18n`. Exports `I18nManager`, `I18nState`, `I18nProvider`, `createI18nManager`, `useI18nRenderer`, and optional `createLocalStorage`.

Configure a loader, await `I18nManager.init()`, then mount the app. `t.jsx` subscribes internally; string attributes need `I18nState.use()` for the default runtime or `useI18nRenderer(t.text)` for an isolated provider. Storage is opt-in. The adapter is shared by dynamic and compiled formatting.

See `examples/i18n` and `examples/compiled-vite`.
