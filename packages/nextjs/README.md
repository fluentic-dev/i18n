# @fluentic/i18n-nextjs

Next.js App Router adapter with conditional RSC/client exports. The app supplies current language and loader through `defineRequestConfig`; routing stays application-owned.

- `/plugin`: one Next config wrapper for webpack and Turbopack.
- `/config`: `defineRequestConfig` and request types.
- `/server`: `ready`, `resolveI18n`, `runWithI18n`, and server provider.
- Root entry: server or client `I18nProvider`; client state and renderer binding.

Both `t.text` and `t.jsx` remain synchronous. Await `ready()` in each independent server execution path before rendering. Use request snapshots for hydration, and `runWithI18n` for explicit async scopes in Node route handlers/actions. No process-global locale is changed per request. Edge runtime support is not included.

See [integration guide](../../docs/docs/runtime/nextjs.md) and `examples/nextjs`.
