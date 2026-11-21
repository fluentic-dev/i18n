---
title: React web with Vite
sidebar_label: React web / Vite
description: Set up compiled Fluentic messages, translation loading, and reactive language switching in a React app.
---

# React web with Vite

The web adapter supplies React rendering, an observable language state, and a catalog manager. Message files import only universal `t`.

## Install and configure

```sh
pnpm add @fluentic/i18n @fluentic/i18n-web
pnpm add -D @fluentic/i18n-cli @fluentic/i18n-compiler
```

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  catalogFormat: 'mjs',
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx}'] },
});
```

```ts title="vite.config.ts"
import fluentic from '@fluentic/i18n-compiler/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [fluentic({ config: './i18n.config.ts' }), react()],
});
```

Add an `i18n` script running `fluentic-i18n --config i18n.config.ts`, then follow the [CLI guide](../cli/overview) to extract and translate messages. Run `pnpm i18n merge` after editing translations. Compiled catalogs and compiled source must be deployed together.

Compilation is optional: to use the dynamic runtime, omit the Fluentic build plugin and leave `compiled` disabled. The manager and message API stay the same.

## Load catalogs before mounting

```ts title="src/i18n.ts"
import { defineTranslationLoader } from '@fluentic/i18n';
import { createLocalStorage, createTranslationCacheLoader, I18nManager } from '@fluentic/i18n-web';

I18nManager.configure({ languageId: 'en' });
I18nManager.setStorage(createLocalStorage());

const catalogLoader = defineTranslationLoader({
  en: [],
  fr: () => import('../i18n/data/translations/fr/merged.mjs'),
});
export const translationCache = createTranslationCacheLoader(catalogLoader, {
  hash: () => import('../i18n/data/translations/hash.json'),
  storageKey: 'my-app:i18n:catalogs',
});
I18nManager.setTranslationLoader(translationCache.loader);
export const initializeI18n = () => I18nManager.init();
```

English falls back to the compiled source messages. The generated MJS module exports catalog rows directly; the manager unwraps module defaults. The cache wrapper persists raw loader results per language and reloads only when the CLI-generated runtime hash changes. `createLocalStorage()` separately persists the selected language. JSON and CJS outputs are also available through `catalogFormat`.

```tsx title="src/main.tsx"
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeI18n } from './i18n';

const root = document.getElementById('root')!;
initializeI18n().then(
  () => createRoot(root).render(<App />),
  () => {
    root.textContent = 'Unable to load translations. Please reload.';
  },
);
```

## Render and switch languages

```tsx title="src/App.tsx"
import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-web';
import { useState } from 'react';

const account = t.context('account');
const greeting = account.msg('Hello {name}', { name: String });

export function App() {
  const state = I18nState.use();
  const [error, setError] = useState(false);
  async function switchLanguage() {
    try {
      setError(false);
      await I18nManager.setLanguageId(state.languageId === 'en' ? 'fr' : 'en');
    } catch {
      setError(true);
    }
  }
  return (
    <main>
      <h1>{t.jsx(greeting, { name: 'Ada' })}</h1>
      <button
        disabled={state.isLoading}
        onClick={switchLanguage}
        aria-label={t.text('Switch language')}
      >
        {t.jsx('Switch language')}
      </button>
      {error && <p role='alert'>Could not load translations. Try again.</p>}
    </main>
  );
}
```

The descriptor is declared before initialization; formatting happens after readiness. `t.jsx()` updates automatically. `I18nState.use()` updates the loading state and the plain-string attribute. Failed language loads keep the previous active language.

`t.jsx(() => element)` is a fine-grained escape hatch for one element whose string-only props must update without rerendering its parent component:

```tsx
return t.jsx(() => (
  <input
    placeholder={t.text('Search projects')}
    aria-label={t.text('Search projects')}
  />
));
```

Only the wrapper reruns the callback in the active i18n runtime when its language changes. Calls nested inside it remain ordinary `t.text()` calls for extraction and compilation. Treat the callback as render logic and keep React hooks in components or custom hooks, not inside this callback.

Use `I18nState.use()` when rerendering the whole component is simpler or when many elements depend on the language. The callback form exists for targeted update boundaries; it is not required around every `t.text()` call.

Optional persistence is `I18nManager.setStorage(createLocalStorage())` before `init()`, with both exports imported from `@fluentic/i18n-web`. For multiple independent subtrees, use an initialized manager instance with `I18nProvider`; see [isolated instances](./platforms#isolated-instances).

## Try the repository example

```sh
pnpm build:packages
pnpm --filter @example/compiled-vite dev
```

For other bundlers, see [build integrations](./bundlers). For SSR with request-specific languages, use the [Next.js guide](./nextjs) instead of a shared server singleton.
