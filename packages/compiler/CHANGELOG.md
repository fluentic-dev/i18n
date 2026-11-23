# @fluentic/i18n-compiler

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
