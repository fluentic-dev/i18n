---
title: Next.js request integration
sidebar_label: Next.js
---

# Next.js App Router

Install `@fluentic/i18n` and `@fluentic/i18n-nextjs`. Business components still import `t` from `@fluentic/i18n`. The adapter selects RSC and client implementations with conditional exports.

## Install and configure

```sh
pnpm add @fluentic/i18n @fluentic/i18n-nextjs
pnpm add -D @fluentic/i18n-cli
```

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'] },
});
```

Adjust the globs if your app uses `src/` or shared source packages. Follow the [CLI workflow](../cli/overview) to extract, translate, and merge. Source calls and catalogs must use the same compilation mode.

## Connect the plugin

```js title="next.config.mjs"
import withFluentic from '@fluentic/i18n-nextjs/plugin';
export default withFluentic({
  requestConfig: './i18n/request.ts',
  config: './i18n.config.ts',
})({});
```

The plugin configures webpack and Turbopack loaders and connects the application-owned request module. It does not select a language or manage routes. Keep `compiled: true` in `i18n.config.ts` to enable message compilation.

## Resolve the current request

```ts title="i18n/request.ts"
import { defineRequestConfig } from '@fluentic/i18n-nextjs/config';
import { cookies } from 'next/headers';
import french from './data/translations/fr/merged.jsonl';
export default defineRequestConfig(async () => ({
  languageId: (await cookies()).get('language')?.value === 'fr' ? 'fr' : 'en',
  translationLoader: ({ languageId }) => languageId === 'fr' ? french : [],
}));
```

Direct `.jsonl` imports are handled by the Next plugin. Add a TypeScript declaration for them:

```ts title="catalogs.d.ts"
declare module '*.jsonl' {
  const content: string;
  export default content;
}
```

The path above uses the CLI's default output directory. You can instead supply an async loader that fetches catalogs from application storage.

Choose language IDs from your app's supported set. The callback can use application data, cookies or route information. React request caching shares initialization between RSC consumers. Catalogs, locale and state are not stored in a process-global manager.

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

The server provider also accepts omitted `snapshot` and resolves the request itself. Alternatively `resolveI18n({languageId, translationLoader})` creates a snapshot explicitly. A snapshot configures the client provider, not an implicit global server locale. Only serializable catalog data crosses the boundary; loaders stay server-side.

Client `t.jsx()` uses provider state. For text attributes during client SSR and hydration, bind the renderer explicitly:

```tsx
'use client';
import { t } from '@fluentic/i18n';
import { useI18nRenderer } from '@fluentic/i18n-nextjs';
const label = t.msg('Search');
export function Search() {
  const text = useI18nRenderer(t.text);
  return <input aria-label={text(label)} />;
}
```

## Switch languages across server and client

Change the app's locale source, then refresh so the next server snapshot hydrates the provider. For the cookie-based configuration above:

```ts title="app/api/language/route.ts"
import { cookies } from 'next/headers';
export async function POST(request: Request) {
  const language = await request.text();
  if (!['en', 'fr'].includes(language)) return new Response('Invalid language', { status: 400 });
  (await cookies()).set('language', language, { httpOnly: true, sameSite: 'lax', path: '/' });
  return new Response(null, { status: 204 });
}
```

```tsx title="components/LanguagePicker.tsx"
'use client';
import { I18nState } from '@fluentic/i18n-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function LanguagePicker() {
  const { languageId } = I18nState.use();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  async function switchLanguage() {
    setSaving(true);
    setError(false);
    try {
      const response = await fetch('/api/language', {
        method: 'POST',
        body: languageId === 'en' ? 'fr' : 'en',
      });
      if (!response.ok) throw new Error('Language update failed');
      startTransition(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button disabled={saving || pending} onClick={switchLanguage}>Switch language</button>
      {error && <p role='alert'>Could not change language. Try again.</p>}
    </>
  );
}
```

Render the picker beneath `I18nProvider`. Its state comes from that provider, and `t.jsx()` follows the new snapshot. Use request refreshes for this setup: mutating a standalone browser manager would not update the server's locale source. Routing, cookie policy, and supported languages remain application decisions.

## Actions and route handlers

React's render cache is not a general server execution scope. Use `runWithI18n(config, async () => ...)` for route handlers and actions. It initializes a separate manager and scopes the whole callback with Node `AsyncLocalStorage`, preserving isolation across awaits. This integration targets the Node runtime; Edge support is not advertised.

Registry options passed through request `formats` apply to server formatting. Custom client format factories and rich handlers must be registered client-side rather than serialized as functions.

```ts title="app/api/greeting/route.ts"
import { t } from '@fluentic/i18n';
import { runWithI18n } from '@fluentic/i18n-nextjs/server';
import requestConfig from '../../../i18n/request';
const greeting = t.msg('Hello');
export async function GET() {
  return runWithI18n(await requestConfig(), async () => {
    return Response.json({ greeting: t.text(greeting) });
  });
}
```

## Try the repository example

```sh
pnpm build:packages
pnpm --filter @example/nextjs dev
```

The example includes server rendering, metadata, client hydration, cookie-based language switching, and an isolated async route. Its production build can be exercised with webpack or Turbopack. From the repository root, `pnpm --filter @example/nextjs build && pnpm test:next` checks concurrent requests in different languages.
