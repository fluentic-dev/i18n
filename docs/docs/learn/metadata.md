---
title: Context, notes, and metadata
---

# Context, notes, and metadata

Use context to distinguish messages with identical source text. Add notes for translator guidance and metadata for translation tooling. All three can be chained before `msg()`, `text()`, or `jsx()`.

## Distinguish messages with context

```tsx
import { t } from '@fluentic/i18n';

t.context('file-action').jsx('Open');
t.context('shop-status').jsx('Open');
```

The context and source text together identify the message. In this example, the action “Open” and the status “Open” can have separate translations.

You can compose it inline:

```ts
t.context('billing').context('invoice').msg('Open');
```

That message has the context `billing.invoice`. Changing context changes identity, so existing translations won't automatically move to the new one.

## Add translator notes

Use `.note()` to describe usage, UI constraints, or intended meaning:

```tsx
t.context('checkout')
  .note('Primary button below the order summary. Takes the customer to payment.')
  .note('Keep it short enough for a mobile button.')
  .jsx('Continue');
```

Notes accumulate along the chain. They don't change the rendered message or its identity. When the same identity appears several times, the current extractor keeps one record rather than combining notes; define a shared descriptor when you want one authoritative set of instructions.

## Attach structured metadata

```ts
t.context('checkout')
  .meta({ screen: 'payment', characterLimit: 24 })
  .msg('Continue');
```

Metadata accepts JSON-compatible values and is included in the extracted record. Your translator or tooling can use it for validation or categorization. Fluentic doesn’t enforce metadata fields such as `characterLimit`. A later `.meta()` call replaces an earlier value.

A descriptor keeps the context, notes, and metadata from its definition. Applying a scope at render time, such as `t.context('other').jsx(descriptor)`, does not override them.

## Extraction requirements

Use literal context, note, metadata, and message values in the same chain rooted at the imported `t`. The current CLI doesn't trace aliases or a scope stored in a variable. A descriptor created by that chain can then be exported and reused anywhere.

See [extraction](../cli/overview#2-understand-extraction) for supported markers and [message definitions](../intro#define-reusable-descriptors) for reuse.

If a contextual translation is missing, runtime lookup can use a context-free translation of the same source text in that catalog. Avoid adding a generic translation when it would be wrong for one of the specialized meanings.
