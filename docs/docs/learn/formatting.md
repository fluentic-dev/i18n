---
title: Formats and dynamic params
sidebar_label: Formats & dynamic values
description: Add locale-aware numbers, dates, computed params, and reusable messages without changing the way you render.
---

# Formats and dynamic params

Message params support numbers, dates, descriptors, and callbacks. Use ICU syntax to format values within a message, and `I18nRegistry` to register formats shared across your app. Declare reusable message param types with `t.msg()`, then provide real values to `t.text()` or `t.jsx()`.

## Format numbers, dates, and times

Use ICU format arguments to format values in the active locale:

```tsx
import { t } from '@fluentic/i18n';

export function OrderSummary({ total, deliveryDate }: {
  total: number;
  deliveryDate: Date;
}) {
  return t.jsx('Total: {total, number}. Arrives {date, date, long}.', {
    total,
    date: deliveryDate,
  });
}
```

Pass a number or `Date`, not a preformatted string. The active language determines separators, month names, and ordering. You can use `{time, time, short}` for times too.

## Register named formats

Register shared number, date, and time formats during initialization:

```ts title="i18n.ts"
import { I18nRegistry } from '@fluentic/i18n';

I18nRegistry.addNumberFormat('price', {
  style: 'currency',
  currency: 'EUR',
});

I18nRegistry.addDateFormat('delivery', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

I18nRegistry.addTimeFormat('meeting', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});
```

Use those names inside any message:

```tsx
t.jsx('Pay {amount, number, price}', { amount: 29.9 });
t.jsx('Arrives {day, date, delivery}', { day: new Date('2026-11-03T12:00:00Z') });
t.jsx('Starts at {start, time, meeting}', { start: new Date('2026-11-03T14:00:00Z') });
```

The amount stays in euros when the language changes; locale affects its presentation, not currency conversion. Choose currencies and time zones from your product's data.

### Configure formats by language

A format definition can also be a callback. It receives the language used for that formatting call:

```ts
I18nRegistry.addNumberFormat('compact', ({ languageId }) => ({
  notation: 'compact',
  maximumFractionDigits: languageId.startsWith('fr') ? 1 : 0,
}));
```

Register formats before rendering. Registration itself doesn't notify React subscribers; the named format is resolved when a message is formatted.

## Compute params with callbacks

A param callback receives `{ languageId }` when the message is formatted. Use it to resolve language-dependent values:

```tsx
const productNames: Record<string, string> = {
  en: 'Travel mug',
  fr: 'Mug de voyage',
};

const addedToCart = t.msg('{product} was added to your cart.', {
  product: String,
});

export function CartNotice() {
  return t.jsx(addedToCart, {
    product: ({ languageId }) => productNames[languageId] ?? productNames.en,
  });
}
```

The descriptor can be defined once and its param schema is checked at every render site. The callback runs again when the message renders in another language. Keep these callbacks synchronous and free of side effects; load remote data before you render.

:::tip Value callbacks and tag handlers
A plain function computes a value from `{ languageId }`. A function wrapped in `t.tag()` receives the chunks inside an ICU tag and turns them into JSX content. Use `t.tag()` for links, emphasis, and other React elements.
:::

## Compose descriptors

Pass a descriptor as a param to resolve it in the same language as the containing message:

```tsx
const plan = t.msg('Pro plan');
const confirmation = t.msg('You are now using {plan}.');

export function Confirmation() {
  return t.jsx(confirmation, { plan });
}
```

The nested descriptor is formatted when the containing message renders, including after language changes. It must not require params of its own, because nested rendering receives no params. With a declared `{ plan: String }` schema, use `plan: () => t.text(plan)` instead: the type expects a string or a callback returning a string. A descriptor without a schema also accepts a callback returning another descriptor.

This works well for independently named concepts such as plans or statuses. For grammar-sensitive phrases, keep the whole sentence together and use [ICU selection](./icu); some languages need to change surrounding words too.

## Param schemas are not default values

```ts
const invitation = t.msg('Invite {name} to {workspace}', {
  name: String,
  workspace: String,
});

const inviteAda = t.clone(invitation);

t.text(inviteAda, { name: 'Ada', workspace: 'Design team' });
t.text(invitation, { name: 'Lin', workspace: 'Engineering' });
```

`String`, `Number`, `Boolean`, and `Date` passed to `t.msg()` describe required runtime values. They are not values themselves and cannot be passed to `t.text()` or `t.jsx()`. `t.clone()` preserves the original message literal and schema. Keep a `t.text()` call inside a function if its result needs to reflect the current language later.

`t.params()` is still useful for typing or forwarding real runtime values:

```ts
const values = t.params({ name: 'Ada', workspace: 'Design team' });
t.text(invitation, values);
```

## Disable translation lookup temporarily

For a diagnostic or a source-language preview, temporarily skip translation lookup:

```ts
const sourcePreview = t.notranslate(() => t.text('Hello, {name}!', { name: 'Ada' }));
```

Params and ICU formatting still run using the active locale. This is a synchronous scope: don't use it around async work or deferred `t.jsx()` rendering.

## Related guides

For additional syntax and integration examples:

- [Plurals and select expressions](./icu): zero cases, ordinal numbers, and nested selections.
- [Tags and JSX](./tags): links, nested tags, and shared descriptors.
- [Context and translator guidance](./metadata): identical words with different meanings.
- [Translation loaders](../runtime/loading): bundled catalogs, fallbacks, and caching.
- [API reference](../api): signatures and behavior of the public APIs.
