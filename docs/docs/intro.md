---
title: Define and render messages
sidebar_label: Define & render messages
description: Define inline messages and reusable descriptors, render text or JSX, and handle language changes in React.
---

# Define and render messages

Messages import universal `t`. Install and [initialize a platform adapter](./runtime/platforms) before rendering; `t.msg()` declarations can run before initialization. Existing users can follow the [adapter migration guide](./runtime/migration).

Write translatable messages directly where you use them. Use `t.jsx()` inside JSX to handle language changes automatically, and `t.text()` when you need a plain string. Use `t.msg()` to define a message with type-safe params, then pass it to `t.jsx()` or `t.text()` wherever you need it. No separate translation keys or central message registry are required.

## Choose your translation workflow

Manual translations are first-class: a team can translate every message manually, use an automatic provider, or combine both. Automatic translation is optional; no provider is configured by default.

The CLI keeps three files for each target language:

- `manual.jsonl` holds translations entered by people or imported from external tools.
- `auto.jsonl` holds provider results for previously untranslated messages.
- `merged.jsonl` is generated from those layers; non-empty manual translations take priority.

Review translations in your application with representative values. Put approved or corrected wording in the manual layer and run `merge` to rebuild the catalog. Review is a team activity, not a CLI approval command.

JSONL stores one record per line, so Git can merge unrelated message edits with fewer conflicts. Converters let teams exchange JSON, CSV, PO, or XLIFF with external tools; these formats require converter callbacks. See [the message workflow](./learn/message-workflow), [CLI commands](./cli/overview), and [import/export converters](./cli/formats).

## Installation

```sh
pnpm add @fluentic/i18n @fluentic/i18n-web
```

Choose a setup guide: [React web / Vite](./runtime/react-web), [React Native / Expo](./runtime/react-native), or [Next.js](./runtime/nextjs).

## Optional: compile messages at build time

Enable `compiled: true` and add a [build plugin](./runtime/bundlers) to remove the ICU parser from your shipped runtime. Keep writing the same message API and importing `t` from `@fluentic/i18n`. Automatic and manual translation files stay readable; the CLI emits compact merged catalogs.

The compiled message runtime is about 2.2 KB gzip; a typical React setup with loading, switching, and observable state is about 3.9 KB gzip, excluding React and message data. See [the compiler guide](./runtime/compilation) for setup, tradeoffs, and measurement details.

## Render an inline message

```tsx title="Welcome.tsx"
import { t } from '@fluentic/i18n';

export function Welcome() {
  return <h1>{t.jsx('Welcome back!')}</h1>;
}
```

`t.jsx()` accepts a source message and returns a React element. After initialization, it uses the loaded translation or falls back to the source, and updates automatically when the language changes.

## Interpolate params

Declare placeholders in the message and pass their values as the second argument:

```tsx
export function Welcome({ name }: { name: string; }) {
  return <h1>{t.jsx('Welcome back, {name}!', { name })}</h1>;
}
```

Named placeholders allow translations to reorder values. Keep the source message a string literal so the CLI can extract it.

Avoid building messages with string concatenation or interpolated JavaScript templates. Write `t.jsx('Hello, {name}', { name })`, rather than putting the name directly into the source string.

## Define reusable descriptors

Use `t.msg()` to define messages in shared modules, navigation configuration, or validation rules. It returns a typed descriptor that is translated when rendered. Param schemas also make every later render site type-safe.

```ts title="messages.ts"
import { t } from '@fluentic/i18n';

export const welcome = t.msg('Welcome back, {name}!', {
  name: String,
});
export const saved = t.msg('Your changes are saved.');
```

`t.jsx()` accepts either a source string or a descriptor:

```tsx title="Welcome.tsx"
import { t } from '@fluentic/i18n';

import { welcome } from './messages';

export function Welcome({ name }: { name: string; }) {
  return <h1>{t.jsx(welcome, { name })}</h1>;
}
```

Descriptors can be defined at module scope and reused across components. They resolve in the current language when rendered. `String`, `Number`, `Boolean`, and `Date` in `t.msg()` are type markers, not values. They describe the real values that every `t.text()`, `t.jsx()`, or `t.try()` call must provide.

## Return a string

Use `t.text()` when an API expects a string, such as a notification handler or `document.title`. It accepts the same source strings, descriptors, and params as `t.jsx()`.

```ts title="notifications.ts"
import { t } from '@fluentic/i18n';

import { saved } from './messages';

export function showSavedNotification(notify: (text: string) => void) {
  notify(t.text(saved));
}
```

Outside React, call `t.text()` when you need the value. It formats in the current language at that moment. An already-created string won't change later.

### Use strings in React attributes

When you use `t.text()` inside a component—for example, for a `placeholder`, `title`, or `aria-label`—add `I18nState.use()` if those values should update when the language changes:

```tsx title="Search.tsx"
import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

export function Search() {
  I18nState.use();

  return (
    <input
      aria-label={t.text('Search projects')}
      placeholder={t.text('Try a project name')}
    />
  );
}
```

`I18nState.use()` makes the component rerender when the language changes, so `t.text()` returns the updated text. Call it once at the top level of the component.

:::tip Language changes in React
`t.jsx()` returns a React element that handles language changes itself, so it doesn’t need this extra hook. If you also use `t.text()` or `t.try(t.text, ...)` in the component, use `I18nState.use()` to keep those string values up to date.
:::

## Handle descriptors or plain values

Use `t.try()` in helpers that accept either a message descriptor or a plain value. It renders descriptors with the supplied renderer and returns other values unchanged:

```ts
import { type MessageDescriptor, t } from '@fluentic/i18n';

function notificationText(value: string | MessageDescriptor) {
  return t.try(t.text, value);
}

notificationText(t.msg('Saved successfully')); // Translated string
notificationText('Server maintenance at 18:00'); // Original string
```

Use `t.try(t.jsx, value, params)` when the result may be React content. Plain values are returned unchanged, without translation lookup. Formatting errors, including invalid ICU syntax and missing params, propagate to the caller.

## Use ICU plurals

Use ICU plural expressions to select a message variant from a numeric param:

```tsx
export function Inbox({ count }: { count: number; }) {
  return t.jsx(
    '{count, plural, =0 {All caught up!} one {# unread message} other {# unread messages}}',
    { count },
  );
}
```

## Render tags in JSX

Use ICU tags with `t.tag()` handlers to render links or other React elements within a message:

```tsx
export function Help() {
  return (
    <p>
      {t.jsx('Need a hand? <link>Read the guide</link>.', {
        link: t.tag((chunks) => <a href='/help'>{chunks}</a>),
      })}
    </p>
  );
}
```

`t.tag()` marks a callback as a tag handler. The callback receives the translated content inside the tag. You can also define tagged messages with `t.msg()` and pass the handlers to `t.jsx()` when rendering.

## Choose the appropriate method

| Use case                                        | Method                 |
| ----------------------------------------------- | ---------------------- |
| Text or JSX content in React                    | `t.jsx('Save')`        |
| A message defined before use                    | `t.msg('Save')`        |
| A string for an attribute or another API        | `t.text(message)`      |
| To accept descriptors alongside ordinary values | `t.try(t.text, value)` |

Fluentic uses source text as message identity instead of requiring explicit translation keys. Add [context](./learn/metadata) when identical source text needs different translations. The CLI extracts definitions from `t.msg()`, `t.text()`, and `t.jsx()`.

**Next: [Extract and translate messages →](./cli/overview)**
