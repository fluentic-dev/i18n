import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { defineTranslator, extract, filterTranslator, translateAuto } from '../packages/cli/dist/index.mjs';

import { createDeepLTranslator, createGoogleTranslator } from '../packages/cli/dist/translators.mjs';

const request = (targetLanguageId, sourceLanguageId = 'en') => ({
  sourceLanguageId,
  targetLanguageId,
  items: [],
  env: () => '',
});

test('package exports providers only through the translators subpath', async () => {
  const require = createRequire(new URL('../packages/cli/package.json', import.meta.url));
  const main = await import(pathToFileURL(require.resolve('@fluentic/i18n-cli')).href);
  const providers = await import(pathToFileURL(require.resolve('@fluentic/i18n-cli/translators')).href);
  assert.deepEqual(Object.keys(providers).sort(), [
    'createDeepLTranslator',
    'createGoogleTranslator',
  ]);
  for (const name of Object.keys(providers)) assert.equal(name in main, false);
  for (const name of ['deeplTranslate', 'googleTranslate']) {
    assert.equal(name in main, false);
    assert.equal(name in providers, false);
  }
  assert.equal(typeof main.defineTranslator, 'function');
  assert.equal(typeof main.filterTranslator, 'function');
  const converters = await import(pathToFileURL(require.resolve('@fluentic/i18n-cli/converters')).href);
  assert.deepEqual(Object.keys(converters).sort(), ['csvConverter', 'jsonConverter', 'xliffConverter']);
  for (const name of Object.keys(converters)) assert.equal(name in main, false);
  for (const converter of Object.values(converters)) {
    const input = { sourceLanguageId: 'en', languageId: 'fr', items: [] };
    const { files } = await converter.export(input);
    assert.deepEqual(await converter.import({ ...input, files }), []);
  }
});

test('filterTranslator matches exact target IDs ignoring case, with deny taking precedence', async () => {
  const google = createGoogleTranslator();
  const filtered = filterTranslator(google, { allow: ['FR', 'de', 'pt-BR'], deny: ['DE'] });
  for (const [target, expected] of [['fr', true], ['FR', true], ['de', false], ['pt-br', true], ['pt', false]]) {
    assert.equal(await filtered.support(request(target)), expected);
  }
  assert.equal(await filterTranslator(google, {}).support(request('ja')), true);
  assert.equal(await filterTranslator(google, { allow: [] }).support(request('fr')), false);
  assert.equal(await filterTranslator(google, { deny: ['FR'] }).support(request('fr')), false);
  assert.equal(await filterTranslator(google, { deny: ['FR'] }).support(request('ja')), true);
  assert.equal(await google.support(request('de')), true);
});

test('filterTranslator preserves DeepL source and target support restrictions', async () => {
  const filtered = filterTranslator(createDeepLTranslator(), { allow: ['fr', 'ga'] });
  assert.equal(await filtered.support(request('fr')), true);
  assert.equal(await filtered.support(request('ga')), false);
  assert.equal(await filtered.support(request('fr', 'ga')), false);
});

test('filterTranslator preserves async support, request data, batching, tags, and translation', async () => {
  const seen = [];
  const translate = () => [];
  const provider = defineTranslator({
    batch: false,
    tag: true,
    translate,
    support: async (input) => {
      seen.push(input);
      return input.sourceLanguageId === 'en';
    },
  });
  const filtered = filterTranslator(provider, { deny: ['de'] });
  const input = request('fr');
  assert.equal(await filtered.support(input), true);
  assert.equal(seen[0], input);
  assert.equal(await filtered.support(request('fr', 'ja')), false);
  assert.equal(await filtered.support(request('de')), false);
  assert.equal(seen.length, 2);
  assert.equal(filtered.batch, false);
  assert.equal(filtered.tag, true);
  assert.equal(filtered.translate, translate);
  assert.equal(Object.isFrozen(filtered), true);
  const callback = filterTranslator(translate, { allow: ['fr'] });
  assert.equal(await callback.support(input), true);
  assert.equal(callback.translate, translate);
  assert.equal(callback.batch, 50);
  assert.equal(callback.tag, false);
});

test('filtered translators fall through in CLI order and report targets accepted by none', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-translator-filter-'));
  try {
    await mkdir(path.join(directory, 'src'));
    await writeFile(path.join(directory, 'src/messages.ts'), "import { t } from '@fluentic/i18n'; t.text('Hello');");
    const selected = [];
    const provider = (name) => ({ items, targetLanguageId }) => {
      selected.push(`${name}:${targetLanguageId}`);
      return items.map((item) => ({ id: item.id, translation: `${name}:${targetLanguageId}` }));
    };
    const config = {
      root: directory,
      output: path.join(directory, 'data'),
      languages: { source: 'en', targets: ['fr', 'de', 'ja', 'vi'] },
      files: { includes: ['src/*.ts'] },
      translator: [
        filterTranslator(provider('first'), { allow: ['fr', 'de', 'ja'], deny: ['ja'] }),
        filterTranslator(provider('fallback'), { deny: ['vi'] }),
      ],
    };
    await extract(config);
    const events = [];
    await translateAuto(config, (event) => events.push(event));
    assert.deepEqual(selected, ['first:fr', 'first:de', 'fallback:ja']);
    assert.ok(events.some((event) => event.type === 'warning' && event.message.includes('en -> vi')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
