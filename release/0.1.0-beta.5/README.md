# Fluentic i18n 0.1.0-beta.5

Prepared November 23, 2026. These artifacts have not been published. Preparation does not create Git tags or update the publication ledger.

## Publication plan

| Package                   | Action                  | Selected version |
| ------------------------- | ----------------------- | ---------------- |
| `@fluentic/i18n`          | Publish                 | `0.1.0-beta.5`   |
| `@fluentic/i18n-compiler` | Publish                 | `0.1.0-beta.5`   |
| `@fluentic/i18n-cli`      | Publish                 | `0.1.0-beta.5`   |
| `@fluentic/i18n-nextjs`   | Skip unchanged contents | `0.1.0-beta.2`   |
| `@fluentic/i18n-rn`       | Skip unchanged contents | `0.1.0-beta.2`   |
| `@fluentic/i18n-web`      | Skip unchanged contents | `0.1.0-beta.2`   |

All six workspace versions are beta.5. Publication selection compares packed contents against the last verified npm publications. The compiler archive depends on core beta.5, and the CLI archive depends on compiler beta.5. See [plan.json](plan.json) and [SHA256SUMS](SHA256SUMS).

## Release notes

- Bind typed parameters with `t.msg(descriptor, params)` and render the resulting descriptor later with `t.jsx(label)` or `t.text(label)`. Nested messages and deferred callbacks retain reactive translation behavior.
- Use `{ field: t.msg }` in schemas for nested message descriptors or callbacks returning descriptors. `String` continues to require external strings or string callbacks. Direct runtime parameter objects can still contain descriptors without a schema.
- Restore descriptor parameter suggestions in `t.jsx` and `t.text`, including compiled renderers. Descriptor JSX overloads precede render-callback overloads.
- Make descriptors opaque, with unique-symbol type markers and internal symbol-keyed runtime data. Preserve typed schemas, binding state, cloning, and descriptor guards.
- Require nested schema descriptors to have their required parameters bound. Preserve empty-result types for nullish `t.params` inputs and snapshot schemas and notes against caller mutation.
- Support descriptor bindings and the explicit nested-message schema marker in compilation, extraction, and CLI source linting. CLI checks static source contracts; TypeScript checks inferred descriptor parameters and binding state.

## Migration

Replace separate message and parameter properties with a bound descriptor:

```tsx
const messages = {
  revenueBy: t.msg('Revenue, by {basis}', { basis: t.msg }),
  month: t.msg('Month'),
};

const items = [
  {
    id: 'revenueBy',
    label: t.msg(messages.revenueBy, { basis: messages.month }),
  },
];

return items.map((item) => <span key={item.id}>{t.jsx(item.label)}</span>);
```

Use `String` for an external value, such as a customer name. Use `t.msg` for a value that must itself be translated. Bind any required parameters of a nested descriptor before passing it into a `t.msg` schema field. Bind changing component values when rebuilding the item collection, or use a supported deferred callback when appropriate.

Descriptor fields such as `text`, `schema`, `context`, and `__fluenticMessage` are no longer public. Use `isMessageDescriptor` for guards and `t.clone` for cloning; do not inspect or spread descriptor internals. Keep central source definitions available separately when application logic needs their source text.

## Verified

- All 203 tests pass, including runtime, React, compiler, CLI lint, editor completion, public declaration, and release workflow coverage. Bundle measurements pass.
- Workspace type checking, formatting, and the documentation production build pass.
- Next.js integration passes in cookie and URL modes, covering concurrent server rendering, metadata, client SSR, Node/Edge scopes, and locale updates.
- An isolated npm installation of all three archives passes runtime binding, cloning, opacity, compiler/CLI imports, and CLI startup checks. A strict TypeScript consumer verifies valid bindings and rejects missing values, incorrect schema values, unbound nested descriptors, and access to descriptor internals.
- All archive SHA-256 checksums match. The publication ledger remains unchanged, and all selected beta.5 versions were available on npm at preparation time.

## Publish

Follow [RELEASING.md](../../RELEASING.md). Run `pnpm release` from an interactive terminal to rebuild, verify immutable npm versions, and publish selected packages under the `beta` tag. Commit the publication ledger after successful publication. Tarballs are ignored by Git; retain or attach them separately.
