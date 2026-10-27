import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineTranslationLoader } from '../dist/index.js';

test('function loaders pass through unchanged', async () => {
  const fn = ({ languageId }) => languageId;
  assert.equal(defineTranslationLoader(fn), fn);
});

test('language maps resolve supported catalogs, promises, and module defaults', async () => {
  const items = [{ id: 'Hello', translation: 'Bonjour' }];
  const wrapped = { jsonl: '' };
  const loader = defineTranslationLoader({
    fr: items,
    en: '',
    de: wrapped,
    ja: Promise.resolve(items),
    es: { default: '' },
    it: Promise.resolve({ default: wrapped }),
  });
  for (
    const [languageId, expected] of [['fr', items], ['en', ''], ['de', wrapped], ['ja', items], ['es', ''], [
      'it',
      wrapped,
    ]]
  ) {
    assert.deepEqual(await loader({ languageId }), expected);
  }
  assert.deepEqual(await loader({ languageId: 'missing' }), []);
  assert.deepEqual(await loader({ languageId: 'toString' }), []);
});

test('only the selected lazy entry runs and rejected loads can be retried', async () => {
  let calls = 0;
  const loader = defineTranslationLoader({
    en: [],
    fr: async () => {
      if (++calls === 1) throw new Error('offline');
      return { default: [{ id: 'Hello', translation: 'Bonjour' }] };
    },
    de: () => {
      throw new Error('must not load');
    },
  });
  assert.equal(calls, 0);
  await loader({ languageId: 'en' });
  assert.equal(calls, 0);
  await assert.rejects(loader({ languageId: 'fr' }), /offline/);
  assert.deepEqual(await loader({ languageId: 'fr' }), [{ id: 'Hello', translation: 'Bonjour' }]);
  assert.equal(calls, 2);
});
