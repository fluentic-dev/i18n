---
title: React to language changes
sidebar_label: Reactivity & state
---

# Language state and React updates

`t.jsx(message)` handles its own updates. For synchronous `t.text()` values, choose between a convenient component-level subscription with `I18nState.use()` and a fine-grained single-element boundary with `t.jsx(() => element)`.

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

## Update one element without rerendering its parent

Use the callback overload when one element has translated string props and the parent does not otherwise need language state:

```tsx
import { t } from '@fluentic/i18n';

export function Search() {
  return t.jsx(() => (
    <input
      placeholder={t.text('Search projects')}
      aria-label={t.text('Search projects')}
    />
  ));
}
```

The callback must return one React element. The wrapper subscribes to the active i18n runtime and reruns only the callback when its language changes; `Search` itself does not rerender. Nested `t.text()` calls remain normal extraction and compiler markers.

Keep React hooks in components or custom hooks, not inside the callback. Capture their results from the parent when needed:

```tsx
export function Search() {
  const query = useSearchQuery();

  return t.jsx(() => <input value={query} placeholder={t.text('Search projects')} />);
}
```

Use `I18nState.use()` instead when many elements depend on language, the component needs `languageId` or `isLoading`, or a whole-component rerender is simpler.

| Need                                             | Use                    |
| ------------------------------------------------ | ---------------------- |
| Translated JSX content                           | `t.jsx(message)`       |
| One element with translated string props         | `t.jsx(() => element)` |
| Many language-dependent values or language state | `I18nState.use()`      |

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
