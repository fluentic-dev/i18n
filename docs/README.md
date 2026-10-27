# Fluentic i18n docs

The site uses Docusaurus with a custom light/dark theme and React homepage. Its main learning path is intentionally short:

1. `docs/intro.md`: define and render messages with `t`.
2. `docs/cli/overview.md`: extract, translate, and merge catalogs.
3. `docs/runtime/manager.md`: load translations and switch language.
4. `docs/learn/formatting.md`: formats, callbacks, and composition.

The other pages expand specific workflows. `sidebars.ts` controls reading order. Removed URLs use the not-found page with a link to the homepage.

```sh
pnpm --filter @docs/app dev
pnpm --filter @docs/app typecheck
pnpm --filter @docs/app build
pnpm --filter @docs/app serve --port 4174 --no-open
```

The build checks internal links. Runtime reactivity regression checks live in `packages/i18n/test/react.test.mjs`:

```sh
pnpm --filter @fluentic/i18n test
pnpm test:docs-workflow
```

When editing examples, verify them against the implementation and explain behavior in practical terms. For `t.text()` inside a component, show `I18nState.use()` when the text should update on language changes. `t.jsx()` handles those changes itself.

Write for developers using familiar terms such as rendering, interpolation, descriptors, loaders, and callbacks. Lead sections with the task and explain API behavior through concrete examples. Keep the progressive guide structure; avoid marketing slogans and unnecessary implementation details.

Manual translations are first-class, and automatic providers are optional. Use “tags” for JSX tag handlers and “params” for message values. Keep extraction, translation, review, merge, and runtime loading distinct. Update internal links when guide URLs change; do not add legacy aliases or “guide moved” pages.

The documentation typecheck checks site TypeScript, not fenced Markdown examples. Check example snippets against the package types separately and run the runtime and CLI workflow tests for behavioral validation.
