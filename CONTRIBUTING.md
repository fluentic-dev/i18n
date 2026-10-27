# Contributing to Fluentic i18n

Thanks for helping improve Fluentic i18n. The project is currently pre-release, so public APIs may still change while the first npm release is prepared.

## Development setup

Requirements:

- Node.js 20 or newer
- pnpm 10.17.1 through Corepack

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:next
```

Run the browser example or documentation site while developing:

```sh
pnpm --filter @example/i18n dev
pnpm --filter @docs/app dev
```

## Pull requests

- Keep changes focused and explain the behavior they add or correct.
- Add tests for runtime, compiler, loader, or workflow behavior where applicable.
- Update documentation and examples when a public API or workflow changes.
- Do not commit generated builds, local caches, credentials, or translation-service keys.
- Run the full validation commands above before requesting review.

Use GitHub issues for bugs and feature discussions. Report security issues privately according to [SECURITY.md](SECURITY.md).
