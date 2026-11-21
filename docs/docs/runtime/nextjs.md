---
title: Next.js request integration
sidebar_label: Next.js
---

# Next.js App Router

Install `@fluentic/i18n` and `@fluentic/i18n-nextjs`. Business components still import `t` from `@fluentic/i18n`. The adapter selects RSC and client implementations with conditional exports.

## Install and configure

```sh
pnpm add @fluentic/i18n @fluentic/i18n-nextjs
pnpm add -D @fluentic/i18n-cli @fluentic/i18n-compiler
```

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  catalogFormat: 'mjs',
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'] },
});
```

Adjust the globs if your app uses `src/` or shared source packages. Follow the [CLI workflow](../cli/overview) to extract, translate, and merge. Source calls and catalogs must use the same compilation mode.

## Connect the plugin

```js title="next.config.mjs"
import withFluentic from '@fluentic/i18n-compiler/nextjs';
export default withFluentic({
  requestConfig: './i18n/request.ts',
})({});
```

The Node-only compiler package configures webpack and Turbopack source transforms and connects the application-owned request module. The Next.js runtime package remains compiler-free. The compiler does not assume where `i18n.config.ts` lives: optionally pass `config` with any path to share its `compiled.hashLength`, pass `hashLength` directly, or omit both to use the default. A direct value overrides the selected config. Keep `compiled: true` in the CLI config so it emits matching compiled catalogs.

## Define supported languages

Cookie and URL-prefix strategies share one definition:

```ts title="i18n/languages.ts"
import { defineLanguages } from '@fluentic/i18n-nextjs/language';

export const languages = defineLanguages({
  languages: ['en', 'fr'] as const,
  defaultLanguageId: 'en',
});
```

The client factories for both strategies return the same stateless `{handler}` shape. The handler function receives the requested language ID, performs its configured cookie or URL operation, and starts a full browser navigation. It does not read React context, current i18n state, or Next router hooks. The server remains the source of truth and returns a newly rendered snapshot rather than loading translations in the browser.

## Cookie-based language

Create the server handler and use it in the request module:

```ts title="i18n/language.server.ts"
import { createServerHandler } from '@fluentic/i18n-nextjs/handler/cookie/server';
import { languages } from './languages';

export const languageServer = createServerHandler({
  ...languages,
  cookie: { name: 'language' },
});
```

```ts title="i18n/request.ts"
import { defineRequestConfig } from '@fluentic/i18n-nextjs/config';
import french from './data/translations/fr/merged.mjs';
import { languageServer } from './language.server';

export default defineRequestConfig(async () => {
  const languageId = await languageServer.getLanguageId();
  return {
    languageId,
    translationLoader: ({ languageId }) => languageId === 'fr' ? french : [],
  };
});
```

Expose the ready-made cookie mutation as a route handler:

```ts title="app/api/language/route.ts"
import { languageServer } from '../../../i18n/language.server';

export const POST = languageServer.POST;
```

Create the matching client handler:

```ts title="i18n/language.client.ts"
'use client';
import { createClientHandler } from '@fluentic/i18n-nextjs/handler/cookie/client';
import { languages } from './languages';

export const { handler: languageHandler } = createClientHandler({
  ...languages,
  endpoint: '/api/language',
});
```

The handler validates the language, asks the route handler to write the HTTP-only cookie, and reloads the document after a successful response.

## URL-prefix language

URL mode uses `/en/...` and `/fr/...`. Construct the server integration once; it returns the pieces needed by request configuration and Next Proxy:

```ts title="i18n/language.server.ts"
import { createServerHandler } from '@fluentic/i18n-nextjs/handler/url/server';
import { languages } from './languages';

export const languageServer = createServerHandler({
  ...languages,
  rememberCookie: 'language',
});
```

Put the returned Proxy function in Next's root `proxy.ts`:

```ts title="proxy.ts"
import { languageServer } from './i18n/language.server';

export default languageServer.proxy;

export const config = {
  matcher: '/((?!api|_next|.*\\..*).*)',
};
```

The Proxy validates prefixes, redirects unprefixed requests, negotiates `Accept-Language`, optionally remembers the selection, and forwards the resolved language through a private request header. `languageServer.getLanguageId()` reads that header in the request configuration shown earlier.

The client handler reads the browser URL only when invoked. It preserves the pathname, query, and hash while replacing the language prefix:

```ts title="i18n/language.client.ts"
'use client';
import { createClientHandler } from '@fluentic/i18n-nextjs/handler/url/client';
import { languages } from './languages';

export const { handler: languageHandler } = createClientHandler(languages);
```

The CLI emits the directly importable module because `catalogFormat` is set to `'mjs'`. You can use `'json'` or `'cjs'` instead, or supply an async catalog loader.

## Initialize before synchronous rendering

```tsx title="app/page.tsx"
import { t } from '@fluentic/i18n';
import { ready } from '@fluentic/i18n-nextjs/server';
const title = t.msg('Account');
export default async function Page() {
  await ready();
  return <h1 title={t.text(title)}>{t.jsx(title)}</h1>;
}
```

Both rendering methods remain synchronous. The app awaits `ready()` in the execution path that renders them. Metadata and independent pages/layouts should await readiness themselves; a layout does not guarantee sibling execution order. `t.msg()` is always safe at module scope.

## Hydrate client components

```tsx title="app/layout.tsx"
import { I18nProvider } from '@fluentic/i18n-nextjs';
import { ready } from '@fluentic/i18n-nextjs/server';
export default async function Layout({ children }: { children: React.ReactNode; }) {
  const snapshot = await ready();
  return (
    <html lang={snapshot.languageId}>
      <body>
        <I18nProvider snapshot={snapshot}>{children}</I18nProvider>
      </body>
    </html>
  );
}
```

The server provider also accepts an omitted `snapshot` and resolves the request itself. Alternatively `resolveI18n({languageId, translationLoader})` creates a snapshot explicitly. The boundary owns the hydrated runtime for the document. Only serializable catalog data crosses the boundary, and loaders stay server-side.

Both renderers work directly in Client Components, including text attributes during SSR and hydration:

```tsx
'use client';
import { t } from '@fluentic/i18n';
const label = t.msg('Search');
export function Search() {
  return <input aria-label={t.text(label)} />;
}
```

The Next compiler recognizes Client Component modules and generates the internal provider binding for `t.text()`. It inserts one hook at the top of each component or custom hook that renders text, so source calls remain unchanged and hook ordering stays valid. A client `t.text()` at module scope or in an unrelated helper is rejected; define descriptors at module scope and format them inside the component. `t.jsx(message)` already returns a provider-aware element and needs no generated binding.

`t.jsx(() => element)` is also provider-aware. Message calls nested in its callback are extracted and compiled normally, but nested `t.text()` calls do not inject a whole-component subscription—the callback wrapper remains the fine-grained language boundary.

## Switch languages across server and client

```tsx title="components/LanguagePicker.tsx"
'use client';
import { I18nManager } from '@fluentic/i18n-nextjs';
import { languageHandler } from '../i18n/language.client';

export function LanguagePicker({ languageId }: { languageId: 'en' | 'fr'; }) {
  const next = languageId === 'en' ? 'fr' : 'en';

  return (
    <button onClick={() => I18nManager.setLanguageId(next, languageHandler)}>
      Switch to {next}
    </button>
  );
}
```

The Next-specific `I18nManager.setLanguageId(id, handler)` passes the requested ID to the selected handler. It never changes or loads browser catalogs directly. Calling `languageHandler(id)` is equivalent if the manager facade is not needed. Pass the current server-resolved language to the picker as a prop when it needs to calculate the next language.

The App Router does not expose an imperative router outside React hooks, and `Link` is a component rather than a callable navigation API. These stateless handlers therefore use `window.location`: URL mode assigns or replaces the localized URL, and cookie mode reloads after its POST. That full request is intentional because language selection remains server-owned.

## Actions and route handlers

React's render cache is not a general server execution scope. Wrap any server function that renders translated output with `i18nFn`. It preserves the function parameters and resolved return type, loads the application `i18n/request.ts`, initializes a separate manager, and scopes the whole invocation with `AsyncLocalStorage`, preserving isolation across awaits and concurrent requests.

The wrapper also works in Next's Edge Runtime because Next exposes its supported `node:async_hooks` subset there. The repository test suite runs the same wrapper in a real `runtime = 'edge'` Route Handler for both cookie and URL-prefix modes. Next 16.4 currently warns that its Edge Runtime is deprecated in favor of the Node.js runtime, so prefer Node.js for new Next routes unless the deployment requires Edge. Edge compatibility here does not by itself guarantee a particular Cloudflare adapter configuration; that adapter and its compatibility flags must also support `AsyncLocalStorage`.

Registry options passed through request `formats` apply to server formatting. Custom client format factories and rich handlers must be registered client-side rather than serialized as functions.

```ts title="app/api/greeting/route.ts"
import { t } from '@fluentic/i18n';
import { i18nFn } from '@fluentic/i18n-nextjs/server';
const greeting = t.msg('Hello');

export const GET = i18nFn(async () => {
  return Response.json({ greeting: t.text(greeting) });
});
```

The same pattern preserves the argument and result types of a Server Action:

```ts title="app/actions.ts"
'use server';
import { t } from '@fluentic/i18n';
import { i18nFn } from '@fluentic/i18n-nextjs/server';
const saved = t.msg('Changes saved');

export const save = i18nFn(async (data: FormData) => {
  // Save data...
  return { message: t.text(saved) };
});
```

JavaScript does not allow `export async const`; the wrapper returns an async function, so use `export const POST = i18nFn(...)`. The same wrapper works for Route Handlers, Server Actions, and other server callbacks. `runWithI18n(config, callback)` remains available when a function intentionally needs configuration different from the application request module.

## Try the repository example

```sh
pnpm build:packages
pnpm --filter @example/nextjs dev:cookie
pnpm --filter @example/nextjs dev:url
```

One example switches between both strategies with `NEXT_PUBLIC_I18N_LANGUAGE_MODE`. It includes server rendering, metadata, plain client `t.text()`, client hydration, language switching, and isolated Node and Edge async routes. Use `build:cookie`, `build:url`, `build:turbo:cookie`, and `build:turbo:url` to exercise both bundlers.
