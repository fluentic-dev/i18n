<div align="center">
  <img src="./docs/static/img/logo.svg" alt="Fluentic i18n" width="88" height="88" />
  <h1>Fluentic i18n</h1>
  <p><strong>Build naturally. Translate effortlessly.</strong></p>
  <p>Developer-first internationalization for React and JavaScript, with extraction, automatic translation, human review, and production-ready catalogs in one workflow.</p>
  <p>
    <a href="https://fluenticstack.com/i18n/">Documentation</a> ·
    <a href="https://fluenticstack.com/i18n/docs/intro/">Get started</a> ·
    <a href="https://fluenticstack.com/i18n/docs/cli/overview/">CLI guide</a>
  </p>
</div>

> [!IMPORTANT]
> Fluentic i18n is currently **pre-release**. The source, examples, and documentation are public, but the `@fluentic/*` npm packages have not been published yet. Expect API changes while the first release is prepared.

## Why Fluentic?

Most i18n libraries help you render translated strings. Fluentic covers the work around those strings too:

- Write messages where you use them. No key-naming system or separate message registry is required.
- Extract messages from your source code with a small CLI command.
- Let Google Translate, DeepL, or your own translator create the first draft.
- Keep human translations separate, so automatic updates never overwrite approved work.
- Store one message per JSONL line to keep Git diffs and merges readable.
- Export to external formats for translators, agencies, or translation platforms.
- Load only the language data your application needs and validate changes with a compact hash.

The default workflow is simple:

```text
write messages → extract → auto-translate → review → ship
```

Automatic translation is the fast path, not a lock-in. You can review everything manually, correct only the messages that need attention, or bring translations back from an external tool.

## Install

The following commands apply after the first npm release. To evaluate the project today, clone this repository and use the workspace development instructions below.

```sh
pnpm add @fluentic/i18n @fluentic/i18n-web
pnpm add -D @fluentic/i18n-cli
```

## Your first message

Initialize the web adapter before mounting (see runtime setup below). Use t.jsx() for text or rich content in React:

```tsx
import { t } from '@fluentic/i18n';

export function Welcome({ name }: { name: string; }) {
  return (
    <main>
      <h1>{t.jsx('Welcome back, {name}!', { name })}</h1>
      <p>{t.jsx('Your workspace is ready.')}</p>
    </main>
  );
}
```

Use ICU messages for plurals without adding another API:

```tsx
t.jsx(
  '{count, plural, =0 {No messages} one {# message} other {# messages}}',
  { count },
);
```

When a message needs to be reused, define it once with t.msg():

```ts
import { t } from '@fluentic/i18n';

export const savedMessage = t.msg('Your changes are saved.');
```

For messages with parameters, declare the required value types once. The original message and its schema stay attached to the descriptor, so TypeScript checks every later render site and IDE hover shows the source message:

```ts
const greeting = t.msg('Hello, {name}!', { name: String });

t.text(greeting, { name: 'Ada' });
t.jsx(greeting, { name: 'Ada' });
```

Use String, Number, Boolean, or Date as schema markers. They are declarations only; t.text() and t.jsx() always receive real runtime values.

Render it as JSX or get a string for an attribute, notification, or browser API:

```tsx
import { t } from '@fluentic/i18n';

import { savedMessage } from './messages';

export function Status() {
  return <p aria-label={t.text(savedMessage)}>{t.jsx(savedMessage)}</p>;
}
```

For values that may already be translated messages, choose the output with t.try():

```ts
import type { MessageDescriptor } from '@fluentic/i18n';

function notificationText(value: string | MessageDescriptor) {
  return t.try(t.text, value);
}
```

For links and other inline elements, use ICU tags:

```tsx
t.jsx('Read the <link>documentation</link>.', {
  link: t.tag((chunks) => <a href='/docs'>{chunks}</a>),
});
```

Keep messages as string literals so the CLI can find them. The same source text is the message identity; add context when two identical messages need different translations.

## Configure the runtime

The web adapter provides React rendering and management; message imports remain universal. Set the initial language and tell it how to load a catalog:

```ts
import { defineTranslationLoader } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';

I18nManager.configure({ languageId: 'en' });
I18nManager.setTranslationLoader(defineTranslationLoader(async ({ languageId }) => {
  const response = await fetch('/i18n/translations/' + languageId + '.jsonl');
  return response.text();
}));

await I18nManager.setLanguageId('fr');
```

Components using t.jsx() update with the active language. If a component reads translated strings through t.text(), call I18nState.use() so it subscribes to language changes.

## Extract and translate

Create i18n.config.ts at your project root:

```ts
import { createDeepLTranslator, defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  languages: {
    source: 'en',
    targets: ['fr', 'de', 'ja'],
  },
  files: {
    includes: ['src/**/*.{ts,tsx,js,jsx}'],
  },
  translator: createDeepLTranslator(),
});
```

Add the CLI script:

```json
{
  "scripts": {
    "i18n": "fluentic-i18n --config i18n.config.ts"
  }
}
```

Then run the complete development flow:

```sh
pnpm i18n update
```

Fluentic extracts messages, keeps automatic and manual translations in separate layers, and writes the merged catalog used by the application. Re-running the command is safe: existing manual translations remain intact, while new messages can be translated automatically.

## Keep secrets out of your config

By default, Fluentic looks beside i18n.config.ts for i18n.env and i18n.env.local. Process environment variables take priority.

Put local keys in i18n.env.local and add that file to .gitignore:

```env
DEEPL_API_KEY=your-key
```

You can choose another env file from the config. Relative paths are resolved beside the config file:

```ts
export default defineConfig({
  env: 'config/secrets.env',
  languages: { source: 'en', targets: ['fr'] },
  translator: createDeepLTranslator(),
});
```

Google Translate and DeepL are built in. A custom translator is defined with `defineTranslator({ support, translate, batch, tag })`, which lets the CLI choose the first supported provider from an ordered array, batch requests, and handle inline tags according to provider capabilities.

## Ahead-of-time compilation

Set `compiled: true` in `defineConfig`, regenerate merged catalogs, and add the plugin for Vite, Rollup, esbuild, webpack, Babel, React Native, or Next.js. Auto/manual catalogs stay unchanged. The compiler traces local context aliases and replaces literals with `[hash, compact AST]`; universal imports become `/compiled`. Both `t.text` and `t.jsx` stay synchronous.

See the [compiler guide](docs/docs/runtime/compilation.md), [platform adapters](docs/docs/runtime/platforms.md), and [Next.js integration](docs/docs/runtime/nextjs.md). Run `pnpm build:packages`, then try the projects in `examples/`.

## Packages

| Package                 | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| @fluentic/i18n          | Universal t, descriptors, I18nRegistry, and dynamic formatting    |
| @fluentic/i18n/compiled | Compact message runtime selected by compiler plugins              |
| @fluentic/i18n-web      | React web adapter, I18nManager and I18nState                      |
| @fluentic/i18n/core     | Framework-neutral message and formatting primitives               |
| @fluentic/i18n-cli      | Extraction, catalogs, translation runners, converters, and hashes |
| @fluentic/i18n-rn       | React Native runtime bindings                                     |
| @fluentic/i18n-nextjs   | Next.js and RSC runtime bindings                                  |

The platform packages are separate so each environment can provide its own loading, state, and JSX behavior without pulling browser-specific code into another bundle.

## Learn the workflow

- [Start with messages](https://fluenticstack.com/i18n/docs/intro/)
- [Understand the runtime](https://fluenticstack.com/i18n/docs/runtime/manager/)
- [Extract and translate](https://fluenticstack.com/i18n/docs/cli/overview/)
- [Configure translators and env files](https://fluenticstack.com/i18n/docs/cli/translators/)
- [Use ICU formatting](https://fluenticstack.com/i18n/docs/learn/icu/)

## Develop this repository

Requirements: Node.js 20 or newer and pnpm 10.17.1 through Corepack.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:next
```

Run the interactive browser casebook:

```sh
pnpm --filter @example/i18n dev
```

The documentation site runs with:

```sh
pnpm --filter @docs/app dev
```

The monorepo contains:

- `packages/i18n`: universal message API, runtime, compiler, and bundler integrations;
- `packages/cli`: extraction, translation, merge, and exchange tooling;
- `packages/web`, `packages/rn`, and `packages/nextjs`: platform adapters;
- `examples`: dynamic and compiled integrations for supported platforms;
- `docs`: the Docusaurus documentation site and Cloudflare worker;
- `tests`: cross-package workflow and deployment behavior checks.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Licensed under the [MIT License](LICENSE).
