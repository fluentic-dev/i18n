---
title: Migrate to adapters
sidebar_label: Adapter migration
---

# Migrate existing applications

Message imports stay universal:

```ts
import { defineTranslationLoader, I18nRegistry, t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-web';
```

Use `@fluentic/i18n-rn` for native setup and `@fluentic/i18n-nextjs` for Next.js integration. The root package no longer installs React or browser storage. `/core` remains a compatibility alias for universal messages.

1. Add the platform adapter and move manager/state imports to it.
2. Await initialization before mounting/rendering. Rendering before readiness now throws. Module-scope declarations should use `t.msg`, not formatted strings.
3. Opt into persistence with `createLocalStorage()` or `createNativeStorage(store)` if needed.
4. Expect language changes to commit after loading succeeds. Failures retain the old language. The manager loads base/fallback catalogs and caches successful loads.
5. For isolated React providers, bind attribute renderers with `useI18nRenderer(t.text)`. The default browser singleton still supports plain `t.text` plus `I18nState.use()`.
6. For Next.js, configure the request module and await `ready()` in independent server render paths. Use provider snapshots for client hydration.

Compilation is a separate opt-in: set `compiled: true`, add the bundler adapter and regenerate merged files. Auto/manual files remain unchanged. Existing review history does not need migration. Do not manually rewrite authored message literals into hashes.

The repository's RN example pins a compatible Expo/React Native set and resolves React to the app's copy in Metro, since the web examples exercise another React version. Consumers should retain their own platform's supported version set.
