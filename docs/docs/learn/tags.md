---
title: Tags and JSX
---

# Tags and JSX

Use ICU tags to embed React elements in a translatable message. Tag handlers define the markup in code, while translations can reorder the tagged content.

## Use an element for simple markup

Pass a React element to `t.tag()` when you just need to wrap the translated content:

```tsx
t.jsx('Hello, <strong>{name}</strong>!', {
  name: 'Ada',
  strong: t.tag(<strong />),
});
```

The React runtime clones the element, preserves its props, and replaces its children with the translated content. Use a callback for custom rendering logic.

## Define tag handlers

```tsx
import { t } from '@fluentic/i18n';

export function GettingStarted() {
  return (
    <p>
      {t.jsx('Read <guide>the guide</guide> to get started.', {
        guide: t.tag((chunks) => <a href='/guide'>{chunks}</a>),
      })}
    </p>
  );
}
```

`guide` is an ICU tag name. Its `t.tag()` callback receives the translated chunks inside the tag and returns a React element. Attributes such as `href` are defined in the handler.

`t.jsx()` handles language changes automatically; this component doesn’t need `I18nState.use()`.

## Reuse tagged message descriptors

Define the message with `t.msg()` in a shared module:

```ts title="messages.ts"
import { t } from '@fluentic/i18n';

export const terms = t.msg('By continuing, you accept <terms>our terms</terms>.');
```

Pass the tag handlers when rendering the descriptor:

```tsx
import { t } from '@fluentic/i18n';

import { terms } from './messages';

export function Agreement() {
  return t.jsx(terms, {
    terms: t.tag((chunks) => <a href='/terms'>{chunks}</a>),
  });
}
```

The descriptor works the same way as a literal passed directly to `t.jsx()`.

## Combine tags and params

```tsx
t.jsx('Hello, <strong>{name}</strong>. <link>Open your workspace</link>.', {
  name: 'Ada',
  strong: t.tag((chunks) => <strong>{chunks}</strong>),
  link: t.tag((chunks) => <a href='/workspace'>{chunks}</a>),
});
```

Tags can be nested. Define translatable text in the message and use handlers for markup, attributes, and event handlers.

## Render tagged messages as strings

For a string-only destination, provide tag handlers that return strings:

```ts
t.text('Read <guide>the guide</guide>.', {
  guide: t.tag((chunks) => chunks.join('')),
});
```

`t.text()` throws if JSX content produces a non-string result. Use `t.jsx()` for React nodes; don't cast JSX output to a string.

The React element shorthand is enabled by the installed web, RN, or Next.js adapter; universal `t` remains the import in message files.

A plain param callback has a different job: it receives `{ languageId }` and computes a value. Always wrap a tag handler with `t.tag()` so Fluentic can distinguish the two.

See [ICU expressions](./icu) for plurals and selects, and [language-aware callbacks](./formatting#compute-params-with-callbacks) for computed values.
