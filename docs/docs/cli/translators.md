---
title: Connect a translation service
sidebar_label: Translation services
---

# Translation providers

Configure a `translator` with `defineTranslator` to integrate a translation provider or internal service. The CLI passes untranslated records to the callback and merges the returned translations by message ID. The callback receives `env(name)`, which reads `process.env` first, then `i18n.env.local`, then `i18n.env`.

Automatic translation is optional. Omit `translator` to use only manual translations; see the [manual workflow](./overview#3-understand-the-translation-files).

## Implement a translator callback

```ts
import { defineTranslator } from '@fluentic/i18n-cli';

export const translate = defineTranslator({
  batch: 50,
  tag: false,
  translate: async ({
    sourceLanguageId,
    targetLanguageId,
    items,
    env,
  }) => {
    const apiKey = env('TRANSLATION_API_KEY');

    // Example: an endpoint you own that implements this JSON contract.
    const response = await fetch(env('TRANSLATION_SERVICE_URL'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceLanguageId, targetLanguageId, items }),
    });
    if (!response.ok) throw new Error(`Translation failed: ${response.status}`);

    const results: unknown = await response.json();
    if (!Array.isArray(results)) throw new Error('Expected a translation array');

    return results.map((result) => {
      if (typeof result?.id !== 'string' || typeof result?.translation !== 'string') {
        throw new Error('Each result needs a string id and translation');
      }
      return { id: result.id, translation: result.translation };
    });
  },
});
```

Wire it into `defineConfig({ languages: …, translator: translate })`. For common providers, use `createGoogleTranslator()` or `createDeepLTranslator()` from `@fluentic/i18n-cli`.

```ts
import { createGoogleTranslator, defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  translator: createGoogleTranslator(),
});
```

## Input records and output validation

Each item contains `id`, `source`, `context`, `notes`, and optional `meta`. A custom translator can forward those details to its service. The built-in Google and DeepL adapters send source strings and language IDs, not notes, context, or metadata.

Keep the `id` unchanged in every result. Param names such as `{name}` and tag names such as `<link>` must also survive translation. Validate ICU messages and review representative output before shipping a catalog.

## Missing translations and merge behavior

For each target language, the CLI calls the translator with messages that have no translation in either the manual or automatic layer. Returned translations are written to the automatic layer; existing manual translations are never replaced. Results with an empty translation are ignored, and unknown IDs are not added to the catalog.

`update` merges afterward. If you run `translate` on its own, run `merge` next. Human translations remain the preferred layer.

## Batching and tags

`defineTranslator` accepts two provider capability options:

- `batch`: maximum number of items per call. It defaults to `50`. Set it to `false` to call the provider once per item.
- `tag`: whether the provider accepts Fluentic's inline tags such as `<link>…</link>`. It defaults to `false`.

When `tag: false`, the CLI separates tagged messages into text chunks before calling the provider, then puts the translated chunks back around the original tags. Each chunk also receives `originalSource`, `originalId`, `chunkIndex`, and `chunkCount` so a provider can use the complete message as context.

The built-in DeepL adapter sets `tag: true`, so the CLI sends whole messages, including tags. It does not set a DeepL tag-handling option or validate that returned tags and ICU syntax are preserved. Google Translate uses `tag: false` and requests plain-text translation. Chunk splitting preserves tag positions but does not parse ICU expressions; review messages combining tags with plurals or selects.

Both adapters use batches of 50. Google defaults to the v2 endpoint and `GOOGLE_TRANSLATE_API_KEY`; DeepL defaults to the Free endpoint and `DEEPL_API_KEY`. Both accept `apiKey`, `apiKeyEnv`, and `endpoint`, or a factory receiving `{ env }`. See [provider setup](./overview#4-automatically-translate-missing-messages).

## Retries and errors

Split large batches, retry rate limits, and control concurrency inside your callback. The CLI doesn't supply those policies. A thrown error fails the command; the optional result `error` field doesn't trigger a retry or reporting by itself.

If a translation needs another attempt, clear its automatic value and ensure no manual override exists, then run `update`. Changing the source text creates a new message identity that is included in the next extraction.
