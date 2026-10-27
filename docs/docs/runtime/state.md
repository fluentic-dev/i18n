---
title: React to language changes
sidebar_label: Reactivity & state
---

# Language state and React updates

`t.jsx()` handles its own updates. Use `I18nState` when your component computes a string, shows the selected language, or needs to know whether a catalog is loading.

## Read state in React

```tsx
import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

export function Search() {
  const { isLoading } = I18nState.use();
  return (
    <input
      disabled={isLoading}
      placeholder={t.text('Search projects')}
      aria-label={t.text('Search projects')}
    />
  );
}
```

The snapshot is `{ languageId, isLoading, ready }`. Call the hook once at the component's top level, even if you don't use its return value.

`I18nState.use()` makes the component rerender when the language changes, so its `t.text()` calls return updated text.

`t.jsx()` returns a React element that handles language changes itself. A component using only `t.jsx()` for its messages doesn’t need the hook. If it also uses `t.text()` or `t.try(t.text, ...)`, add the hook to keep those string values up to date.

## Read state outside React

```ts
import { I18nState } from '@fluentic/i18n-web';

const { languageId } = I18nState.get();
```

This is a snapshot. Read again when you need a current value, or subscribe for ongoing work.

## Subscribe to state changes

```ts
import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

export function syncDocumentTitle() {
  const updateTitle = () => {
    document.title = t.text('Your workspace');
  };
  updateTitle();
  return I18nState.subscribe(updateTitle);
}

const unsubscribe = syncDocumentTitle();
// Call unsubscribe() when this behavior is no longer needed.
```

A subscription callback receives no arguments; use `get()` to read the new snapshot. The return value removes the listener. State changes notify subscribers synchronously, so keep callbacks small.

## Avoid stale translated strings

Define reusable messages as descriptors and format them when needed. A string formatted at module scope retains the language used at initialization:

```ts
const title = t.msg('Your workspace');

export function getTitle() {
  return t.text(title);
}
```

In React, avoid memoizing `t.text()` with an empty dependency array. A hook-triggered render still won't recompute that memo. Formatting directly during render is the straightforward choice.

Use [language-aware callbacks](../learn/formatting#compute-params-with-callbacks) for values that `t.jsx()` should recompute internally, and [language management](./manager) to select and load a language.
