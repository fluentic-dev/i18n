---
title: Load translations and switch languages
sidebar_label: Load & switch languages
description: Configure I18nManager, implement a translation loader, and manage language selection and persistence.
---

# Load translations and switch languages

Use `I18nManager` to configure the initial language, load translation catalogs, and switch languages at runtime. Register a loader and call `init()` before mounting the React app.

Catalog loading is separate from [extraction, translation, review, and merging](../cli/overview). The runtime loads `merged.jsonl`; it does not call providers or combine the manual and automatic layers.

## Configure a translation loader

For this example, copy the CLI's French `merged.jsonl` to `public/i18n/fr.jsonl` and the German one to `public/i18n/de.jsonl`. In a Vite app, these files are served at `/i18n/fr.jsonl` and `/i18n/de.jsonl`. Include this copy step in your build pipeline.

```ts title="i18n.ts"
import { defineTranslationLoader } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';

I18nManager.configure({ languageId: 'en' });

const loadTranslations = defineTranslationLoader(async ({ languageId }) => {
  // English is already in the source messages.
  if (languageId === 'en') return [];

  const response = await fetch(`/i18n/${languageId}.jsonl`);
  if (!response.ok) {
    throw new Error(`Could not load ${languageId}: ${response.status}`);
  }
  return response.text();
});

I18nManager.setTranslationLoader(loadTranslations);

export function initializeI18n() {
  return I18nManager.init();
}
```

`defineTranslationLoader()` gives your callback a typed contract. You can also pass the callback directly to `setTranslationLoader()`.

```tsx title="main.tsx"
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeI18n } from './i18n';

async function start() {
  await initializeI18n();
  createRoot(document.getElementById('root')!).render(<App />);
}

void start().catch((error) => {
  console.error(error);
  document.getElementById('root')!.textContent = 'Unable to load translations. Please reload.';
});
```

`configure()` sets the language synchronously. `init()` restores a saved preference, if one exists, and loads that language. Awaiting it avoids rendering the first screen before its translations arrive.

## Implement a language selector

```tsx title="LanguagePicker.tsx"
import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-web';
import { useState } from 'react';

export function LanguagePicker() {
  const { languageId, isLoading } = I18nState.use();
  const [failed, setFailed] = useState(false);

  async function changeLanguage(next: string) {
    setFailed(false);
    try {
      await I18nManager.setLanguageId(next);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div aria-busy={isLoading}>
      <label>
        {t.jsx('Language')}
        <select
          value={languageId}
          disabled={isLoading}
          onChange={(event) => void changeLanguage(event.target.value)}
        >
          <option value='en'>English</option>
          <option value='fr'>Français</option>
          <option value='de'>Deutsch</option>
        </select>
      </label>
      {failed && <p role='alert'>{t.jsx('Could not load translations. Please try again.')}</p>}
    </div>
  );
}
```

`t.jsx()` handles language changes itself. If you use `t.text()` inside a component, add `I18nState.use()` so the component rerenders and displays the updated text.

### Loading state and errors

`setLanguageId()` sets `isLoading` and loads the selected, base, and configured fallback catalogs. It commits the active language only when loading succeeds. Existing messages stay in the previous language while loading.

The promise rejects if loading fails; the previous active language remains selected. Catch the error in your UI, as above. Selecting the same language again can retry the load.

## Supported catalog formats

Your loader can return any of these, directly or in a promise:

| Return value        | Use case                                             |
| ------------------- | ---------------------------------------------------- |
| A raw JSONL string  | Fetching CLI output from your server or CDN          |
| `{ jsonl: string }` | Your data layer wraps the file contents              |
| `TranslationItem[]` | Importing parsed items or receiving them from an API |

Loaders can use bundled imports, HTTP requests, or cached catalogs. These strategies use the same loader interface and require no changes to message calls. [See translation loaders →](./loading)

## Persist language preferences

Persistence is disabled by default. Call `I18nManager.setStorage(createLocalStorage())` from `@fluentic/i18n-web` to opt into browser storage under `fluentic:i18n:state`. Successful switches save the preference; `init()` restores it.

To let your app own persistence, set an adapter **before** initialization:

```ts
I18nManager.setStorage({
  read() {
    const languageId = localStorage.getItem('app-language');
    return languageId ? { languageId } : null;
  },
  write({ languageId }) {
    localStorage.setItem('app-language', languageId);
  },
});
```

Both methods may be asynchronous. Use `I18nManager.setStorage(null)` to disable persistence. If an old saved preference shouldn't override your configured language, disable or update storage before calling `init()`.

## Fallback behavior

When no translation is available, Fluentic renders the source message. If the source messages are English, an English catalog is optional.

For `fr-CA`, the manager loads and checks `fr-CA`, `fr`, and the optional `fallbackLanguageId` before using the source. Duplicate language IDs are loaded once.

Use language IDs accepted by `Intl`, such as `en`, `fr`, or `pt-BR`. The runtime passes them to the ICU formatter; arbitrary identifiers aren't mapped to locales for you.

**Next: [Configure formats and dynamic params →](../learn/formatting)**
