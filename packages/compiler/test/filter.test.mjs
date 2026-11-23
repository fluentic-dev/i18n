import { deepStrictEqual } from 'node:assert/strict';
import { equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'vite';
import { createTransformFilter, createTransformHookFilter } from '../dist/index.mjs';
import plugin from '../dist/vite.mjs';
test('package filters override file patterns with package exclusion taking priority', () => {
  const filter = createTransformFilter({
    include: /\/src\//,
    exclude: /node_modules/,
    includePackages: ['@acme/ui', 'shared'],
    excludePackages: ['shared'],
  });
  equal(filter('/app/src/main.ts'), true);
  equal(filter('/app/other/main.ts'), false);
  equal(filter('/app/node_modules/@acme/ui/card.tsx?direct'), true);
  equal(filter('/app/node_modules/@acme/ui/card.css'), false);
  equal(filter('/app/node_modules/shared/card.ts'), false);
  equal(filter('/app/node_modules/@acme/ui-kit/card.ts'), false);
  equal(filter('/app/node_modules/other/card.ts'), false);
  equal(
    createTransformFilter({ include: /.*/, excludePackages: '@acme/ui' })(
      '/app/node_modules/@acme/ui/card.ts',
    ),
    false,
  );
});

test('package matching handles pnpm, Windows, queries and nested package ownership', () => {
  const filter = createTransformFilter({ includePackages: '@acme/ui', excludePackages: 'blocked' });
  equal(filter('/app/node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui/card.tsx'), true);
  equal(filter(String.raw`C:\app\node_modules\@acme\ui\card.tsx?direct`), true);
  equal(filter('/app/node_modules/@acme/ui/node_modules/other/file.ts'), false);
  equal(filter('/app/node_modules/blocked/node_modules/@acme/ui/file.ts'), true);
  equal(filter('/app/node_modules/@acme/ui/node_modules/blocked/file.ts'), false);
  equal(filter('/app/main.ts?path=/node_modules/blocked/file.ts'), true);
  equal(filter('/app/node_modules/@acme/ui/card.tsx#fragment'), true);
  const defaults = createTransformFilter({ includePackages: [], excludePackages: [] });
  equal(defaults('/app/main.ts'), true);
  equal(defaults('/app/node_modules/other/file.ts'), false);
  for (const name of ['react/*', '@scope', 'react@1', '../react', '']) {
    throws(() => createTransformFilter({ includePackages: name }), /Invalid package name/);
  }
});

test('native prefilter never rejects files accepted by the shared filter', () => {
  const options = [
    {},
    { includePackages: '@acme/ui' },
    { includePackages: ['@acme/ui', 'blocked'], excludePackages: 'blocked' },
    { include: '**/*.custom', includePackages: '@acme/ui', exclude: /node_modules/ },
    { include: /\.tsx?$/g, excludePackages: 'blocked' },
    { include: [], exclude: [] },
  ];
  const ids = [
    '/app/main.ts',
    '/app/main.ts?x=/node_modules/blocked/a.js',
    '/app/view.custom',
    '/app/node_modules/@acme/ui/card.tsx?x',
    '/app/node_modules/@acme/ui/card.css',
    '/app/node_modules/@acme/ui/node_modules/other/card.ts',
    '/app/node_modules/blocked/node_modules/@acme/ui/card.ts',
    '/app/node_modules/.pnpm/@acme+ui@1/node_modules/@acme/ui/card.ts',
    String.raw`C:\app\node_modules\@acme\ui\card.ts`,
  ];
  for (const option of options) {
    const shared = createTransformFilter(option);
    const native = createTransformHookFilter(option).id;
    for (const id of ids) {
      if (!shared(id)) continue;
      ok(!native.include || native.include.test(id), id);
      ok(!native.exclude.some((pattern) => pattern.test(id)), id);
    }
  }
});

test('file globs, stateful regexes, normalized IDs and legacy dependency opt-in', () => {
  const filter = createTransformFilter({ include: ['**/src/**/*.ts', /\.custom$/g], exclude: '**/*.test.ts' });
  equal(filter('/app/src/.hidden/main.ts?raw'), true);
  equal(filter(String.raw`C:\app\src\main.ts#hash`), true);
  equal(filter('/app/src/main.test.ts'), false);
  equal(filter('/app/a.custom'), true);
  equal(filter('/app/b.custom'), true);
  filter.clear();
  equal(filter('/app/a.custom'), true);
  equal(createTransformFilter({ includeDependencies: true })('/app/node_modules/other/a.js'), true);
  equal(
    createTransformFilter({ includeDependencies: true, excludePackages: 'other' })('/app/node_modules/other/a.js'),
    false,
  );
  equal(createTransformFilter({ includeDependencies: true, exclude: /other/ })('/app/node_modules/other/a.js'), false);
  equal(createTransformFilter()('/app/a.js#hash'), true);
});
test('Vite applies package filters before invoking the transform handler', async () => {
  const entry = '/fluentic-filter-test/src/main.js';
  const allowed = '/fluentic-filter-test/node_modules/@acme/ui/card.js';
  const blocked = '/fluentic-filter-test/node_modules/blocked/card.js';
  const nested = '/fluentic-filter-test/node_modules/blocked/node_modules/@acme/ui/card.js';
  const other = '/fluentic-filter-test/node_modules/other/card.js';
  const modules = new Map([
    [entry, [allowed, blocked, nested, other].map((id) => `import ${JSON.stringify(id)};`).join('\n')],
    ...[allowed, blocked, nested, other].map((id) => [id, 'console.log("module");']),
  ]);
  const hook = plugin({ includePackages: ['@acme/ui', 'blocked'], excludePackages: 'blocked' }).transform;
  ok(hook && typeof hook === 'object');
  const called = [];
  await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, rollupOptions: { input: entry } },
    plugins: [{
      name: 'package-filter-fixture',
      resolveId(id) {
        if (modules.has(id)) return id;
      },
      load(id) {
        return modules.get(id);
      },
      transform: {
        filter: hook.filter,
        handler(_code, id) {
          if (modules.has(id)) called.push(id);
          return null;
        },
      },
    }],
  });
  deepStrictEqual(called.sort(), [entry, allowed, nested].sort());
});
