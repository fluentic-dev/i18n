---
title: Connect a translation service
sidebar_label: Translation services
---

# Translation providers

Import built-in providers (`createGoogleTranslator`, `createDeepLTranslator`) from `@fluentic/i18n-cli/translators`. Core helpers (`defineConfig`, `defineTranslator`, `filterTranslator`) and all shared types, including `ProviderTranslatorOptions` and `ProviderTranslatorOptionsFactory`, remain at `@fluentic/i18n-cli`.

Configure a `translator` with `defineTranslator` to integrate a translation provider or internal service. The CLI passes untranslated records to the callback and merges the returned translations by message ID. The callback receives `env(name)`, which reads `process.env` first, then `i18n.env.local`, then `i18n.env`.

Pass an ordered array when a secondary service should cover language pairs unsupported by the preferred provider. The CLI calls each optional `support` predicate and uses the first matching translator:

```ts
import { defineConfig } from '@fluentic/i18n-cli';
import { createDeepLTranslator, createGoogleTranslator } from '@fluentic/i18n-cli/translators';

export default defineConfig({
  languages: { source: 'en', targets: ['fr', 'ga'] },
  translator: [createDeepLTranslator(), createGoogleTranslator()],
});
```

In this example DeepL handles its supported pairs and Google is the fallback. Provider order is significant.

Automatic translation is optional. Omit `translator` to use only manual translations; see the [manual workflow](./overview#3-understand-the-translation-files).

## Filter a translator's languages

Use `filterTranslator` to restrict the target languages accepted by a built-in or custom translator:

```ts
import { defineConfig, filterTranslator } from '@fluentic/i18n-cli';
import { createDeepLTranslator, createGoogleTranslator } from '@fluentic/i18n-cli/translators';

export default defineConfig({
  languages: { source: 'en', targets: ['fr', 'de', 'ja', 'vi'] },
  translator: [
    filterTranslator(createDeepLTranslator(), {
      allow: ['fr', 'de', 'ja'],
      deny: ['ja'],
    }),
    filterTranslator(createGoogleTranslator(), { deny: ['vi'] }),
  ],
});
```

DeepL handles `fr` and `de`, Google handles `ja`, and neither translator accepts `vi`. When no translator accepts a pair, the CLI reports it and skips translation for that target.

`allow` and `deny` match exact target language IDs, ignoring case (`pt` and `pt-BR` are distinct). Deny takes precedence. Omit `allow` to accept all languages supported by the wrapped translator except denied languages; an empty `allow` array accepts none. The wrapper preserves the original support check, batching, and tag handling, so it cannot enable a language pair rejected by the underlying translator. It also accepts plain translation callbacks.

## Implement a translator callback

```ts
import { defineTranslator } from '@fluentic/i18n-cli';

export const translate = defineTranslator({
  support: ({ sourceLanguageId, targetLanguageId }) =>
    sourceLanguageId === 'en' && ['fr', 'de'].includes(targetLanguageId),
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

`support` may return a boolean or a promise. It receives the same request data as `translate`, including `sourceLanguageId`, `targetLanguageId`, `items`, and `env`. If it is omitted, the translator accepts every pair.

Wire it into `defineConfig({ languages: …, translator: translate })`. For common providers, use `createGoogleTranslator()` or `createDeepLTranslator()` from `@fluentic/i18n-cli/translators`.

```ts
import { defineConfig } from '@fluentic/i18n-cli';
import { createGoogleTranslator } from '@fluentic/i18n-cli/translators';

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

`defineTranslator` accepts three provider capability options:

- `support`: whether the provider accepts a language pair. It defaults to accepting every pair.
- `batch`: maximum number of items per call. It defaults to `50`. Set it to `false` to call the provider once per item.
- `tag`: whether the provider accepts Fluentic's inline tags such as `<link>…</link>`. It defaults to `false`.

When `tag: false`, the CLI separates tagged messages into text chunks before calling the provider, then puts the translated chunks back around the original tags. Each chunk also receives `originalSource`, `originalId`, `chunkIndex`, and `chunkCount` so a provider can use the complete message as context.

The built-in DeepL adapter sets `tag: true`, so the CLI sends whole messages, including tags. It does not set a DeepL tag-handling option or validate that returned tags and ICU syntax are preserved. Google Translate uses `tag: false` and requests plain-text translation. Chunk splitting preserves tag positions but does not parse ICU expressions; review messages combining tags with plurals or selects.

Both adapters use batches of 50. Google defaults to the v2 endpoint and `GOOGLE_TRANSLATE_API_KEY`; DeepL defaults to the Free endpoint and `DEEPL_API_KEY`. Both accept `apiKey`, `apiKeyEnv`, and `endpoint`, or a factory receiving `{ env }`. See [provider setup](./overview#4-automatically-translate-missing-messages).

## Retries and errors

The CLI reports the failing language pair and readable guidance for missing credentials, invalid endpoints, authentication failures, rate limits, and service outages. Use `--debug` when you need technical error details.

Split large batches, retry rate limits, and control concurrency inside your callback. The CLI doesn't supply those policies. A thrown error fails the command; the optional result `error` field doesn't trigger a retry or reporting by itself.

If a translation needs another attempt, clear its automatic value and ensure no manual override exists, then run `update`. Changing the source text creates a new message identity that is included in the next extraction.
