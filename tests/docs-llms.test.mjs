import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const staticRoot = path.resolve('docs/static');

test('llms.txt routes every focused guide to a real static asset', async () => {
  const index = await readFile(path.join(staticRoot, 'llms.txt'), 'utf8');
  const routes = [...index.matchAll(/https:\/\/fluenticstack\.com\/i18n\/(llms(?:\.txt|\/[^\s)]+\.txt))/g)]
    .map((match) => match[1]);

  assert.deepEqual(routes, [
    'llms/messages.txt',
    'llms/setup-vite.txt',
    'llms/react-runtime.txt',
    'llms/translation-flow.txt',
    'llms/compiler.txt',
    'llms/react-vite-example.txt',
    'llms/api.txt',
  ]);
  await Promise.all(routes.map((route) => access(path.join(staticRoot, route))));
});

test('LLM guides cover message marking, setup, reactivity, catalogs, and compilation compactly', async () => {
  const files = [
    'llms.txt',
    'llms/messages.txt',
    'llms/setup-vite.txt',
    'llms/react-runtime.txt',
    'llms/translation-flow.txt',
    'llms/compiler.txt',
    'llms/react-vite-example.txt',
    'llms/api.txt',
  ];
  const content = (await Promise.all(files.map((file) => readFile(path.join(staticRoot, file), 'utf8')))).join('\n');

  for (
    const required of [
      't.msg(',
      't.text(',
      't.jsx(',
      't.jsx(() =>',
      'I18nState.use()',
      'I18nState.subscribe',
      't.context(',
      't.note(',
      't.meta(',
      'createTranslationCacheLoader',
      'fluentic-i18n --config',
    ]
  ) assert.match(content, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const sizes = await Promise.all(files.map((file) => stat(path.join(staticRoot, file))));
  assert.ok(sizes.every((entry) => entry.size < 16_000), 'each guide should remain cheap to load independently');
  assert.ok(sizes.reduce((total, entry) => total + entry.size, 0) < 70_000, 'the complete LLM set should stay compact');
});
