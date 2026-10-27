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
pnpm add -D @fluentic/i18n-cli
```

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx}'] },
});
```

```ts title="vite.config.ts"
import fluentic from '@fluentic/i18n/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [fluentic(), react()] });
```

Add an `i18n` script running `fluentic-i18n --config i18n.config.ts`, then follow the [CLI guide](../cli/overview) to extract and translate messages. Run `pnpm i18n merge` after editing translations. Compiled catalogs and compiled source must be deployed together.

Compilation is optional: to use the dynamic runtime, omit the Fluentic build plugin and leave `compiled` disabled. The manager and message API stay the same.

## Load catalogs before mounting

```ts title="src/i18n.ts"
import { defineTranslationLoader } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';

I18nManager.configure({ languageId: 'en' });
I18nManager.setTranslationLoader(defineTranslationLoader({
  fr: () => import('../i18n/data/translations/fr/merged.jsonl?raw'),
}));
export const initializeI18n = () => I18nManager.init();
```

English falls back to the compiled source messages. Vite's `?raw` returns JSONL text; the manager accepts text or parsed rows. Keep `/// <reference types="vite/client" />` in your Vite environment declarations for raw-import types. Direct `.jsonl` imports are also supported by the Fluentic plugin; declare their module type if you use them in TypeScript.

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

Optional persistence is `I18nManager.setStorage(createLocalStorage())` before `init()`, with both exports imported from `@fluentic/i18n-web`. For multiple independent subtrees, use an initialized manager instance with `I18nProvider`; see [isolated instances](./platforms#isolated-instances).

## Try the repository example

```sh
pnpm build:packages
pnpm --filter @example/compiled-vite dev
```

For other bundlers, see [build integrations](./bundlers). For SSR with request-specific languages, use the [Next.js guide](./nextjs) instead of a shared server singleton.
