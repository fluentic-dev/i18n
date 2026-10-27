export const apis = [
  {
    icon: 'message',
    name: 't.msg()',
    label: 'Define without rendering',
    title: 'Define for later use.',
    text: 'Use `t.msg()` to define a message and its type-safe params. Render it later with `t.jsx()` or `t.text()`.',
    code: `// Simple message
const hello = t.msg('Hello!');

// With a string param
const welcome = t.msg('Welcome, {name}!', { name: String });`,
    to: '/docs/learn/message-workflow',
  },
  {
    icon: 'code',
    name: 't.jsx()',
    label: 'Render as JSX',
    title: 'Render the message as JSX.',
    text: 'Use `t.jsx()` inside JSX to render a message. It handles language changes automatically.',
    code: `// Simple message
<p>{t.jsx(hello)}</p>

// With params
<h1>
  {t.jsx(welcome, { name: 'Ada' })}
</h1>`,
    to: '/docs/learn/tags',
  },
  {
    icon: 'text',
    name: 't.text()',
    label: 'Return a string',
    title: 'Use the message as plain text.',
    text: 'Use `t.text()` to render a message as a plain string.',
    code: `// Simple message
const greeting = t.text(hello);

// With params
const text = t.text(welcome, {
  name: 'Ada',
});`,
    to: '/docs/learn/first-message',
  },
];

export const features = [
  {
    group: 'code',
    icon: 'context',
    title: 'Write messages inline',
    text:
      'Put each message directly in the `t.jsx()` or `t.text()` call. This keeps the wording and context with the code that uses it, so you can update a feature without maintaining a separate key map.',
    language: 'tsx',
    code: `t.jsx('Save changes');

// Same text, different meanings
t.context('file-action').jsx('Open');
t.context('shop-status').jsx('Open');`,
    to: '/docs/learn/metadata',
  },
  {
    group: 'code',
    icon: 'rich',
    title: 'Keep tags in the message',
    text:
      'ICU tags let translators move links, emphasis, and variables naturally. React markup stays in your tag handlers.',
    language: 'tsx',
    code: `t.jsx('Read <link>the guide</link>.', {
  link: t.tag(<a href="/guide" />),
});`,
    to: '/docs/learn/tags',
  },
  {
    group: 'code',
    icon: 'switch',
    title: 'Update the UI when the language changes',
    text: 'Configure catalog loading with `I18nManager`. Switch the active language and let `t.jsx()` update the UI.',
    language: 'tsx',
    code: `// After configuring your catalog loader
await I18nManager.setLanguageId('fr');

// Updates with the active language
const Welcome = () => <h1>{t.jsx('Hello!')}</h1>;`,
    to: '/docs/runtime/manager',
  },
  {
    group: 'code',
    icon: 'check',
    title: 'Typed message descriptors',
    text:
      'Declare param types on `t.msg()` descriptors so messages can be stored or passed around while TypeScript checks values at each render site.',
    language: 'tsx',
    code: `const hello = t.msg('Hello, {name}!', {
  name: String,
});

// ✅ Valid: name is a string
t.text(hello, { name: 'Ada' });

// ❌ TypeScript error: name must be a string
t.text(hello, { name: 42 });`,
    to: '/docs/learn/message-workflow',
  },
  {
    group: 'code',
    icon: 'components',
    title: 'In components and beyond',
    text: 'Use the same message API inside and outside components, with JSX or plain string output.',
    language: 'tsx',
    code: `import { t } from '@fluentic/i18n';


// Render inside a component
const Hello = () => <h1>{t.jsx('Hello!')}</h1>;

// Get a string wherever you need one
const getGreeting = () => t.text('Hello!');`,
    to: '/docs/learn/first-message',
  },
  {
    group: 'workflow',
    icon: 'extract',
    title: 'Extract marked messages from your code',
    text:
      '`t.jsx()`, `t.text()`, and `t.msg()` mark translatable messages. The CLI recognizes those calls and extracts their source text, context, notes, and stable IDs for translation.',
    language: 'tsx',
    code: `import { t } from '@fluentic/i18n';

// Direct message with a runtime value
t.jsx('Welcome back, {name}!', { name });

// Reusable, type-checked message
const inbox = t.msg('You have {count} messages', {
  count: Number,
});

// Same wording, with meaning for translators
t.context('checkout')
  .note('Primary payment action')
  .jsx('Continue');`,
    command: 'pnpm i18n extract',
    to: '/docs/cli/overview',
  },
  {
    group: 'workflow',
    icon: 'merge',
    title: 'Combine automatic and manual translations',
    text:
      'Use automatic translation services when they help, or provide manual translations for messages that need a deliberate wording. The CLI combines both into the catalog your app loads.',
    language: 'bash',
    code: `# Extract, translate, and merge with your configured provider
pnpm i18n update

# translations/fr/
# auto.jsonl   — automatic translations
# manual.jsonl — your translations and corrections
# merged.jsonl — combined catalog your app loads`,
    to: '/docs/cli/overview',
  },
  {
    group: 'workflow',
    icon: 'translate',
    title: 'Translate with the service you choose',
    text:
      'Use Google Translate, DeepL, or another configured service to translate extracted messages. Use `defineTranslator()` when you want to connect your own provider.',
    language: 'typescript',
    code: `import {
  defineConfig, createGoogleTranslator,
} from '@fluentic/i18n-cli';

export default defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  translator: createGoogleTranslator(),
  // Or use createDeepLTranslator()
});`,
    command: 'pnpm i18n update',
    to: '/docs/cli/translators',
  },
  {
    group: 'workflow',
    icon: 'exchange',
    title: 'Edit catalogs with the tools your team uses',
    text:
      'JSONL is line-oriented by design, so Git can handle changes from multiple developers with fewer unrelated merge conflicts. If editing JSONL is inconvenient, export to JSON, CSV, PO, or XLIFF, edit in another tool, and import the translations back.',
    language: 'bash',
    code: `# After registering the guide's JSON converter
pnpm i18n export json

# Send messages.json for translation, then import
pnpm i18n import json
pnpm i18n merge`,
    command: null,
    to: '/docs/cli/formats',
  },
  {
    group: 'code',
    icon: 'download',
    title: 'Load languages on demand',
    text:
      'Load a language only when it’s selected. Standard dynamic imports cache each module, so switching back reuses it. The `?raw` imports return catalog text and require bundler support.',
    language: 'typescript',
    code: `import { defineTranslationLoader } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';

const loader = defineTranslationLoader({
  fr: () => import('./translations/fr/merged.jsonl?raw'),
  de: () => import('./translations/de/merged.jsonl?raw'),
});

I18nManager.setTranslationLoader(loader);`,
    command: null,
    to: '/docs/runtime/loading',
  },
];

export const locales = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'fr', label: 'FR', name: 'French' },
  { id: 'de', label: 'DE', name: 'German' },
  { id: 'ja', label: 'JA', name: 'Japanese' },
];

export const steps = [
  {
    title: 'Mark messages in code',
    text: 'Use `t.jsx()`, `t.text()`, or `t.msg()` wherever a message needs translation.',
    detail: 'Translatable markers',
    to: '/docs/learn/first-message',
  },
  {
    title: 'Extract messages',
    text: 'The CLI recognizes those markers and collects source text, context, notes, and IDs.',
    detail: '`pnpm i18n extract`',
    to: '/docs/cli/overview',
  },
  {
    title: 'Translate messages',
    text: 'Use Google Translate, DeepL, another provider, or your own manual translations.',
    detail: 'Automatic or manual',
    to: '/docs/cli/translators',
  },
  {
    title: 'Review and exchange',
    text: 'Keep deliberate corrections or edit exported catalogs in the tools your team already uses.',
    detail: 'JSONL · PO · XLIFF',
    to: '/docs/cli/formats',
  },
  {
    title: 'Load catalogs',
    text: 'Rebuild merged catalogs and load the language your application needs.',
    detail: '`I18nManager`',
    to: '/docs/runtime/loading',
  },
];

export const faqs = [
  [
    'Do I need the compiler plugin?',
    'No. The default runtime formats ICU strings with IntlMessageFormat. Enable `compiled: true` and add a build plugin when you want compact catalogs and no runtime ICU parser. Your source-level message API stays the same; automatic and manual translations stay readable.',
  ],
  [
    'What does the ~2.2 KB size include?',
    'It is the gzipped compiled message runtime, including the full `t` API and compact ICU formatting. A typical React setup with catalog loading, language switching, state observation, and JSX rendering measures ~3.9 KB gzip. React, catalogs, per-message fallback data, and application loader code are additional.',
  ],
  [
    'Why is `t.msg()` separate from `t.jsx()` and `t.text()`?',
    'Messages often need to live outside a render call: in constants, status objects, business logic, shared packages, or values passed between layers. They still need to be translatable without choosing their final output up front.\n\n`t.msg()` returns a `MessageDescriptor` that stores the source message and param types without resolving a value immediately. Store it, pass it around, and render it later with `t.jsx(message)` or `t.text(message)`. The same descriptor works in either direction and uses the current language when rendered.\n\nWhen you need the translated value immediately, call `t.jsx()` or `t.text()` directly. Use `t.msg()` when definition and rendering happen in different places.',
  ],
  [
    'How does Fluentic identify messages without keys?',
    'Source text identifies a message by default. Add `t.context()` when identical text has different meanings. Context and source text together determine identity, so changing either creates a different message.',
  ],
  [
    'Can I use Fluentic outside a React web app?',
    'Yes. Import universal `t` from `@fluentic/i18n`. Use `@fluentic/i18n-web` for React web setup, `@fluentic/i18n-rn` for React Native and Expo, or `@fluentic/i18n-nextjs` for request initialization and client hydration. Business modules keep the same message imports across platforms.',
  ],
  [
    'Will automatic translation overwrite reviewed work?',
    'No. Automatic and reviewed translations are stored separately. When the CLI builds a merged catalog, a non-empty reviewed translation takes priority.',
  ],
];

export const heroExamples = [
  {
    id: 'simple',
    label: 'Simple',
    title: 'Start with a sentence.',
    description: 'Write one message. Get a string or render it in React—no keys needed.',
    files: [{
      name: 'hello.ts',
      code: `import { t } from '@fluentic/i18n';

// Return a string
t.text('Hello, world!');

// Render as JSX
t.jsx('Hello, world!');`,
    }],
    practical: `import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

// Outside a component: use the current language
export const getGreeting = () => t.text('Hello, world!');

export function Greeting() {
  // Re-render when the language changes to update t.text()
  I18nState.use();
  return <h1>{t.text('Hello, world!')}</h1>;
}

// t.jsx() subscribes to language changes automatically
export const AutoGreeting = () => t.jsx('Hello, world!');`,
    output: ['Hello, world!', 'Bonjour le monde !', 'Hallo, Welt!', 'こんにちは、世界！'],
    to: '/docs/learn/first-message',
  },
  {
    id: 'params',
    label: 'Params',
    title: 'Pass typed params.',
    description: 'Put variables in the message and pass their values alongside it.',
    files: [{
      name: 'greeting.ts',
      code: `import { t } from '@fluentic/i18n';

// Return a string with params
t.text('Hello, {name}!', { name: 'Ada' });

// Render as JSX with params
t.jsx('Hello, {name}!', { name: 'Ada' });`,
    }],
    practical: `import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

// Outside a component: use the current language
export const getGreeting = (name: string) =>
  t.text('Hello, {name}!', { name });

export function Greeting({ name }: { name: string }) {
  // Re-render when the language changes to update t.text()
  I18nState.use();
  return <h1>{t.text('Hello, {name}!', { name })}</h1>;
}

// t.jsx() subscribes to language changes automatically
export const AutoGreeting = () =>
  t.jsx('Hello, {name}!', { name: 'Ada' });`,
    output: ['Hello, Ada!', 'Bonjour, Ada !', 'Hallo, Ada!', 'こんにちは、Ada！'],
    to: '/docs/learn/icu',
  },
  {
    id: 'reusable',
    label: 'Define',
    title: 'Define before rendering.',
    description: 'Define a message and its type-safe params now. Render it later as JSX or a string.',
    files: [{
      name: 'messages.ts',
      code: `import { t } from '@fluentic/i18n';

const welcome = t.msg('Welcome, {name}!', { name: String });

// Render later
t.jsx(welcome, { name: 'Ada' });
t.text(welcome, { name: 'Ada' });`,
    }],
    practical: `import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

// Define before a component knows its output
const welcome = t.msg('Welcome, {name}!', { name: String });

export function Welcome({ name }: { name: string }) {
  I18nState.use();
  return <h1>{t.jsx(welcome, { name })}</h1>;
}

// The same message can return a string elsewhere
export const getWelcome = (name: string) =>
  t.text(welcome, { name });`,
    output: ['Welcome, Ada!', 'Bienvenue, Ada !', 'Willkommen, Ada!', 'ようこそ、Ada！'],
    to: '/docs/learn/message-workflow',
  },
  {
    id: 'tags',
    label: 'Tags',
    title: 'Keep tags in the message.',
    description: 'Use tags for links and emphasis while translators can move them within the sentence.',
    files: [{
      name: 'Greeting.tsx',
      code: `import { t } from '@fluentic/i18n';

export const Greeting = () => t.jsx(
  'Read <link>the guide</link>.',
  { link: t.tag(<a href="/guide" />) },
);`,
    }],
    practical: `import { t } from '@fluentic/i18n';
import { I18nState } from '@fluentic/i18n-web';

const message = t.msg(
  'Read <link>the guide</link>, {name}.',
  { name: String },
);

export function Greeting({ name }: { name: string }) {
  I18nState.use();
  return t.jsx(message, {
    name,
    link: t.tag((chunks) => <a href="/guide">{chunks}</a>),
  });
}`,
    output: [
      'Read the guide, Ada.',
      'Lisez le guide, Ada.',
      'Lies den Leitfaden, Ada.',
      'ガイドを読んでください、Ada。',
    ],
    to: '/docs/learn/tags',
  },
];

export const icuExamples = [
  {
    title: 'Variables',
    summary: 'Insert a value into a message',
    description:
      'Use a named argument for text, identifiers, or other values that should appear in the translated sentence.',
    language: 'tsx',
    code: `const welcome = t.msg('Welcome, {name}!', { name: String });\n\nt.jsx(welcome, { name: 'Ada' });`,
  },
  {
    title: 'Numbers, dates, and times',
    summary: 'Format values with the active locale',
    description:
      'Pass raw numbers and Date objects. ICU and Intl choose separators, symbols, month names, and ordering for the active language.',
    language: 'tsx',
    code:
      `t.jsx(\n  'Total: {total, number}. Ships {date, date, long} at {date, time, short}.',\n  {\n    total: 1299.5,\n    date: new Date('2026-11-03T14:30:00Z'),\n  },\n);`,
    note:
      'Keep values unformatted until rendering. Do not pass a preformatted number or date string when the message needs locale-aware output.',
  },
  {
    title: 'Register custom formats',
    summary: 'Reuse number, date, and time options',
    description:
      'Register named Intl formats once during setup, then reference those names inside messages throughout the app. The active locale controls presentation while your product controls values such as currency and time zone.',
    language: 'ts',
    code: `import { I18nRegistry, t } from '@fluentic/i18n';

I18nRegistry.addNumberFormat('price', {
  style: 'currency', currency: 'EUR',
});
I18nRegistry.addDateFormat('delivery', {
  day: 'numeric', month: 'long', timeZone: 'UTC',
});
I18nRegistry.addTimeFormat('meeting', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
});

const when = new Date('2026-11-03T14:00:00Z');
t.text(
  'Pay {amount, number, price}. Delivery: {when, date, delivery} at {when, time, meeting}.',
  { amount: 29.9, when },
);`,
  },
  {
    title: 'Language-aware formats',
    summary: 'Choose options from the language ID',
    description:
      'A registered format can be a callback. Fluentic calls it with the language used for the current formatting operation.',
    language: 'ts',
    code:
      `I18nRegistry.addNumberFormat('compact', ({ languageId }) => ({\n  notation: 'compact',\n  maximumFractionDigits: languageId.startsWith('fr') ? 1 : 0,\n}));\n\nt.text('Views: {count, number, compact}', { count: 1234000 });`,
  },
  {
    title: 'Plural and ordinal branches',
    summary: 'Handle counts and positions',
    description:
      'Use exact matches such as =0, locale-specific plural categories such as one and other, or selectordinal for values like 1st, 2nd, and 3rd.',
    language: 'tsx',
    code:
      `t.text(\n  '{count, plural, =0 {No files} one {# file} other {# files}}',\n  { count: 3 },\n);\n\nt.text(\n  '{rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place',\n  { rank: 2 },\n);`,
  },
  {
    title: 'Select by a semantic value',
    summary: 'Choose a branch for a state or category',
    description:
      'Use select when the choice is not a number. Keep grammar-sensitive text in the message so translators can change the surrounding words.',
    language: 'tsx',
    code:
      `t.text(\n  '{status, select, active {Your account is active.} other {Your account is unavailable.}}',\n  { status: 'active' },\n);`,
  },
  {
    title: 'Tags and links',
    summary: 'Let translators move inline elements',
    description:
      'ICU tags keep the complete sentence together while tag handlers provide the React elements that stay in your code.',
    language: 'tsx',
    code:
      `t.jsx('Read <link>the documentation</link>.', {\n  link: t.tag((chunks) => <a href="/docs">{chunks}</a>),\n});`,
  },
  {
    title: 'Dynamic param values',
    summary: 'Resolve a value for the active language',
    description:
      'A param can be a synchronous callback. Fluentic calls it with { languageId } while formatting, which is useful for language-specific names, labels, or preloaded data.',
    language: 'tsx',
    code:
      `const product = t.msg('{name} was added to your cart.', {\n  name: String,\n});\n\nt.jsx(product, {\n  name: ({ languageId }) =>\n    languageId.startsWith('fr') ? 'Mug de voyage' : 'Travel mug',\n});`,
    note:
      'Keep callbacks synchronous and side-effect free. Load remote data before rendering; callbacks resolve already-available values.',
  },
];

export const examples = [
  {
    label: 'UI & tags',
    file: 'Welcome.tsx',
    title: 'Keep the whole sentence together',
    text:
      'Translators can reorder the message, including its tags. You control the markup and destination of each link in code.',
    output: 'Hello, Ada. Open your workspace.',
    to: '/docs/learn/tags',
    code:
      `t.jsx('Hello, <strong>{name}</strong>. <link>Open your workspace</link>.', {\n  name,\n  strong: t.tag(<strong />),\n  link: t.tag((chunks) => <a href="/workspace">{chunks}</a>),\n});`,
  },
  {
    label: 'ICU plurals',
    file: 'Inbox.tsx',
    title: 'Handle plural forms with ICU',
    text:
      'Use exact matches and locale-specific plural categories. Each translation can use the plural categories its language needs.',
    output: '3 unread messages',
    to: '/docs/learn/icu',
    code:
      `const unread = t.msg(\n  '{count, plural, =0 {All caught up!} one {# unread message} other {# unread messages}}',\n  { count: Number },\n);\n\nt.jsx(unread, { count });`,
  },
  {
    label: 'Typed descriptors',
    file: 'messages.ts',
    title: 'A message defined before its output',
    text:
      '`String` and `Number` describe the expected params. Define the message in a constant or shared module, then provide real values when you render it as JSX or text.',
    output: 'Welcome back, Ada!',
    to: '/docs/learn/message-workflow',
    code:
      `const welcome = t.msg('Welcome back, {name}!', {\n  name: String,\n});\n\nt.jsx(welcome, { name: 'Ada' });\nt.text(welcome, { name: 'Ada' });`,
  },
  {
    label: 'Context & notes',
    file: 'Checkout.tsx',
    title: 'Give translators the context',
    text:
      'Context distinguishes identical source messages. Notes explain usage and UI constraints without changing the message identity.',
    output: 'Continue',
    to: '/docs/learn/metadata',
    code:
      `t.context('checkout')\n  .note('Primary action below the order summary.')\n  .note('Keep it short enough for a mobile button.')\n  .jsx('Continue');`,
  },
];
