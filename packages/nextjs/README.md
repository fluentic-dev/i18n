# @fluentic/i18n-nextjs

Next.js App Router adapter with conditional RSC/client exports, a single hydrated browser runtime, and built-in cookie or URL-prefix language handling.

- `/config`: `defineRequestConfig` and request types.
- `/language`: shared language definitions and handler contracts.
- `/server`: `ready`, generic `i18nFn`, low-level `runWithI18n`, and the server provider.
- `/handler/cookie/server` and `/handler/cookie/client`: cookie resolution, mutation endpoint, and stateless switching handler.
- `/handler/url/server` and `/handler/url/client`: prefix Proxy, request resolution, and stateless navigation handler.
- Root entry: the hydration boundary, read-only state, and navigation-backed manager facade.

Both `t.text` and `t.jsx` remain synchronous and work directly in Server and Client Components. The Next compiler generates the provider binding needed by client `t.text()` calls, so application source does not use a renderer hook. Await `ready()` in each independent server execution path. Language changes remain server-owned: the cookie handler posts the new ID and reloads, while the URL handler performs a full navigation to the localized path. Neither handler reads React or i18n state. Wrap any translated server function with `i18nFn`; `runWithI18n` remains the configurable low-level primitive. The async scope is tested in both Next Node and Edge Route Handlers, and no process-global server locale is changed per request. Next 16.4 warns that its Edge Runtime is deprecated in favor of Node.js.

See [integration guide](../../docs/docs/runtime/nextjs.md) and `examples/nextjs`.
