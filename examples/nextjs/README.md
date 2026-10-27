# Next.js App Router

Build the workspace packages, then `pnpm --filter @example/nextjs dev`.
The app owns locale selection through a cookie. `i18n/request.ts` supplies the
language and loader; the provider hydrates client messages. Page and metadata
independently await request readiness before synchronous formatting.

`pnpm --filter @example/nextjs build` exercises webpack; `build:turbo` exercises
Turbopack. The single Fluentic Next plugin configures both. Switch language in the
page to verify server rendering, metadata, client attributes and hydration.
