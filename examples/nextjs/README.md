# Next.js App Router

This example demonstrates both built-in language strategies with the same page and
language picker:

- `pnpm --filter @example/nextjs dev:cookie` keeps the URL stable, updates an
  HTTP-only cookie through the built-in POST handler, and refreshes the RSC tree.
- `pnpm --filter @example/nextjs dev:url` uses `/en/...` and `/fr/...` prefixes;
  Proxy redirects unprefixed requests and the client handler navigates between
  localized URLs.

`i18n/request.ts` consumes the selected server handler. The root provider only
hydrates the single browser runtime; plain `t.text()` and `t.jsx()` work in Server
and Client Components. Page and metadata independently await request readiness.
`/api/check` and `/api/edge-check` verify the same request-scoped translation
wrapper in Node and Edge Route Handlers. Next 16.4 emits a deprecation warning for
its Edge Runtime and recommends Node.js for new routes.

Webpack builds use `build:cookie` and `build:url`. Turbopack builds use
`build:turbo:cookie` and `build:turbo:url`.
