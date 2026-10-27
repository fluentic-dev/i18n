---
title: React Native and Expo
sidebar_label: React Native / Expo
description: Initialize Fluentic in React Native, compile messages with Babel, load catalogs, and observe language changes.
---

# React Native and Expo

Use universal `t` in your components and shared packages. The native adapter supplies React rendering, management, and state observation. Both `t.text()` and `t.jsx()` stay synchronous; initialize translations before mounting screens that render them.

## Install the runtime and adapter

```sh
pnpm add @fluentic/i18n @fluentic/i18n-rn
pnpm add -D @fluentic/i18n-cli
```

Keep the React and React Native versions supported by your Expo SDK or native app. Fluentic does not install AsyncStorage for you.

## Enable compiled messages

```ts title="i18n.config.ts"
import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['App.tsx', 'src/**/*.{ts,tsx}'] },
});
```

In an Expo app, keep the Expo preset and add the Fluentic Babel plugin:

```js title="babel.config.js"
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['@fluentic/i18n-rn/plugin/babel'],
};
```

For bare React Native, keep your existing React Native preset and add the same plugin. Preserve any ordering required by other native Babel plugins. Restart Metro with a cleared cache after changing Babel configuration (`npx expo start --clear` for Expo). The plugin reads `i18n.config.ts` from the app working directory and supports Metro's pre-parsed AST path.

Keep source imports as `@fluentic/i18n`; the plugin rewrites them to `/compiled`. A same-file alias such as `const c = t.context('account')` is supported. See [compiler rules](./compilation#same-file-tracing).

## Prepare catalogs for Metro

Follow the [CLI workflow](../cli/overview) to extract, translate, and merge. With `compiled: true`, merged files contain compact rows. The Babel plugin transforms source code; it does not add a Metro loader for `.jsonl` assets.

You can fetch JSONL from your own service, or convert the merged JSONL into a bundled JavaScript module during the build:

```js title="scripts/native-catalogs.mjs"
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const text = await readFile('i18n/data/translations/fr/merged.jsonl', 'utf8');
const rows = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
await mkdir('src/generated', { recursive: true });
await writeFile('src/generated/fr.js', `export default ${JSON.stringify(rows)};\n`);
```

Run this after `merge` and before Metro builds. This only packages the already-compiled rows; it does not parse ICU messages. Regenerate the module whenever translations change. For TypeScript apps, add a declaration alongside it:

```ts title="src/generated/fr.d.ts"
declare const rows: import('@fluentic/i18n/adapter').TranslationData;
export default rows;
```

## Initialize before rendering

```ts title="src/i18n.ts"
import { I18nManager } from '@fluentic/i18n-rn';
import french from './generated/fr';

I18nManager.configure({ languageId: 'en' });
I18nManager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? french : []);
export const ready = I18nManager.init();
```

```tsx title="App.tsx"
import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-rn';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { ready } from './src/i18n';

const greeting = t.msg('Hello {name}', { name: String });
const switchLabel = t.msg('Switch language');

function Screen() {
  const state = I18nState.use();
  const [error, setError] = useState<string | null>(null);
  async function switchLanguage() {
    try {
      setError(null);
      await I18nManager.setLanguageId(state.languageId === 'en' ? 'fr' : 'en');
    } catch {
      setError('Could not load translations. Try again.');
    }
  }
  return (
    <View>
      <Text>{t.jsx(greeting, { name: 'Ada' })}</Text>
      <Button title={t.text(switchLabel)} disabled={state.isLoading} onPress={switchLanguage} />
      {error && <Text accessibilityRole='alert'>{error}</Text>}
    </View>
  );
}

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    ready.then(() => {
      if (active) setStatus('ready');
    }, () => {
      if (active) setStatus('error');
    });
    return () => {
      active = false;
    };
  }, []);
  if (status !== 'ready') {
    return <Text>{status === 'error' ? 'Unable to load translations.' : 'Loading…'}</Text>;
  }
  return <Screen />;
}
```

`t.msg()` is safe outside components. Put textual `t.jsx()` output inside a native `Text` element. `t.jsx()` subscribes automatically; `I18nState.use()` also rerenders the button's synchronous `t.text()` title. Native rich tags should return native elements, such as `t.tag(<Text style={{fontWeight: 'bold'}} />)`.

## Persist the selected language

Install AsyncStorage according to your native platform's instructions. Before `init()`, opt in with:

```ts
import { createNativeStorage, I18nManager } from '@fluentic/i18n-rn';
import AsyncStorage from '@react-native-async-storage/async-storage';
I18nManager.setStorage(createNativeStorage(AsyncStorage));
```

Without this call, language state is in memory. The storage wrapper accepts any compatible async `getItem` / `setItem` implementation.

## Try the repository example

```sh
pnpm build:packages
pnpm --filter @example/rn build
pnpm --filter @example/rn dev
```

The Expo example includes the Babel configuration, an inert message descriptor, a compiled French catalog, and a language switcher. Its workspace Metro configuration resolves React to the app's copy; an ordinary single-app project can keep its existing Metro configuration.

See also [platform adapters](./platforms), [loading and fallbacks](./loading), and [compiler setup](./compilation).
