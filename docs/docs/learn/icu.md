---
title: Plurals and select expressions
---

# Plurals and select expressions

ICU message syntax supports plural rules, string selection, and ordinals. Define variants in the message and pass the selection value as a param. Translations can use the plural categories required by their locale.

Every example here works with `t.text()`, `t.jsx()`, or as the source of a `t.msg()` descriptor.

## Plural categories and exact matches

```tsx
import { t } from '@fluentic/i18n';

t.jsx(
  '{count, plural, =0 {Your inbox is clear} one {# unread message} other {# unread messages}}',
  { count: 3 },
);
```

`=0` matches exactly zero. `one` is a language-specific plural category, not a universal test for the number 1. `other` is required. Inside a plural branch, `#` formats the count in the active locale.

Translations can add categories such as `few` and `many` without changing your component. Pass a number, not a numeric string.

## Select expressions

Use `select` for statuses, roles, or any string-valued choice:

```tsx
t.jsx(
  '{status, select, draft {Not published yet} published {Ready for readers} other {Status unavailable}}',
  { status: 'draft' },
);
```

Include `other` for values you haven't listed. Keeping the phrase together lets a translator change the grammar around the selected value.

## Ordinals

Use `selectordinal` for locale-specific ordinal forms:

```ts
t.text('You finished {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}!', {
  place: 2,
});
```

In English this produces “You finished 2nd!” Other languages can express the same idea differently in their translation.

## Plural offsets

An offset is useful for “Ada and two others”:

```ts
t.text(
  '{count, plural, offset:1 =0 {Nobody joined} =1 {{name} joined} one {{name} and one other joined} other {{name} and # others joined}}',
  { count: 4, name: 'Ada' },
);
```

Exact matches use the original count. Plural categories and `#` use the count after subtracting the offset.

## Nested expressions

You can nest plurals inside selections:

```tsx
t.jsx(
  '{role, select, owner {{count, plural, one {You own # project} other {You own # projects}}} other {{count, plural, one {You can view # project} other {You can view # projects}}}}',
  { role: 'owner', count: 2 },
);
```

Add a translator note to explain nested expressions. Keep related grammar in one message; split independent UI messages when nesting would make translation harder.

## Literal braces and apostrophes

ICU uses apostrophes to quote syntax. To display a literal `{name}`, use `'{name}'` inside the message; two apostrophes produce a literal apostrophe.

```ts
t.text("Use '{name}' as the placeholder.");
```

Don't translate param names or tag names. Translators can move `{name}` and `<link>…</link>`, but your code still provides the values by those names.

Missing params and malformed ICU syntax can throw during formatting. Review translations with representative values, especially zero, one, larger counts, and unknown selection values.

For numeric, date, and time presentation, continue with [named formats](./formatting). Use [tags and `t.tag()`](./tags) for JSX inside a message, and [descriptor schemas](../intro#define-reusable-descriptors) to declare required params before use.
