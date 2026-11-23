# @fluentic/i18n-compiler

## 0.1.0-beta.5

### Minor Changes

- Add `t.msg(descriptor, params)` to bind typed values without rendering. Bound descriptors preserve message identity, support deferred callbacks and nested messages, and render without repeating params. Recognize descriptor binding in compilation, extraction, and source linting.
- Add `t.msg` as an explicit schema marker requiring a message descriptor or a callback returning one. Keep `String` fields restricted to external strings and string callbacks, with matching runtime validation and source linting.

### Patch Changes

- Updated dependencies
  - @fluentic/i18n@0.1.0-beta.5

## 0.1.0-beta.4

### Minor Changes

- Add read-only `fluentic-i18n lint` checks for source parameters, ICU translation contracts, authoring catalogs, extraction drift, and coverage, with optional strict warning failures and project-specific forbidden-message rules. Add `lint.parameterChecks` to toggle parameter and schema diagnostics globally or per method/translation layer, with per-message skip match rules and predicates, and `lint.forbiddenMessages` for exact, substring, or custom callback checks. Expose structured lint results for tooling and reuse source analysis and handoff validation.

### Patch Changes

- Emit explicit relative declaration imports so TypeScript NodeNext consumers can resolve public exports and infer lint callback arguments.

- @fluentic/i18n@0.1.0-beta.4

## 0.1.0-beta.3

### Minor Changes

- Add shared file and package filtering across compiler adapters, including include/exclude globs and regular expressions, includePackages/excludePackages with exact nested package ownership, and a native Vite transform hook prefilter. Preserve includeDependencies support and reload shared filters when watched config changes.

### Patch Changes

- @fluentic/i18n@0.1.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- Preserve `t.jsx()` reactive element callbacks while extracting and compiling their nested message calls normally.
- Move all source transforms and Babel, Vite, Rollup, esbuild, webpack, and Next.js integrations into the standalone compiler package.
- Share compiled hash options consistently across CLI and bundler integrations.
- Generate package declarations directly with TypeScript 7.

## 0.1.0-beta.1

### Minor Changes

- Publish the build-time compiler and Babel, Vite, Rollup, esbuild, webpack, and Next.js integrations.
