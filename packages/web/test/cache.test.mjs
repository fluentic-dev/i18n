import { createI18nManager } from '@fluentic/i18n/adapter';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranslationCacheLoader } from '../dist/index.mjs';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    read(key = 'fluentic:i18n:translation-cache') {
      return JSON.parse(values.get(key));
    },
  };
}

test('reuses cached loader data while the language hash is unchanged', async () => {
  const storage = createStorage();
  let calls = 0;
  const { loader } = createTranslationCacheLoader(
    async ({ languageId }) => {
      calls++;
      return `[["Hello","${languageId}-${calls}"]]`;
    },
    { hash: { fr: 10 }, storage },
  );

  assert.equal(await loader({ languageId: 'fr' }), '[["Hello","fr-1"]]');
  assert.equal(await loader({ languageId: 'fr' }), '[["Hello","fr-1"]]');
  assert.equal(calls, 1);
  assert.deepEqual(storage.read().entries.fr, { hash: 10, data: '[["Hello","fr-1"]]' });
});

test('reloads and replaces cached data when a lazy hash manifest changes', async () => {
  const storage = createStorage();
  let hash = 'first';
  let calls = 0;
  const { loader } = createTranslationCacheLoader(
    () => [{ id: 'Hello', translation: `Bonjour ${++calls}` }],
    { hash: async () => ({ default: { fr: hash } }), storage },
  );

  assert.deepEqual(await loader({ languageId: 'fr' }), [{ id: 'Hello', translation: 'Bonjour 1' }]);
  hash = 'second';
  assert.deepEqual(await loader({ languageId: 'fr' }), [{ id: 'Hello', translation: 'Bonjour 2' }]);
  assert.equal(storage.read().entries.fr.hash, 'second');
});

test('isolates languages and bypasses caching when the manifest has no hash', async () => {
  const storage = createStorage();
  const calls = { en: 0, fr: 0 };
  const { loader } = createTranslationCacheLoader(
    ({ languageId }) => ({ jsonl: `${languageId}-${++calls[languageId]}` }),
    { hash: { fr: 1 }, storage },
  );

  assert.deepEqual(await loader({ languageId: 'fr' }), { jsonl: 'fr-1' });
  assert.deepEqual(await loader({ languageId: 'fr' }), { jsonl: 'fr-1' });
  assert.deepEqual(await loader({ languageId: 'en' }), { jsonl: 'en-1' });
  assert.deepEqual(await loader({ languageId: 'en' }), { jsonl: 'en-2' });
});

test('recovers from corrupt cache data and treats storage writes as best effort', async () => {
  let calls = 0;
  const storage = {
    getItem: () => '{bad json',
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {},
  };
  const { loader } = createTranslationCacheLoader(() => `catalog-${++calls}`, { hash: { fr: 1 }, storage });

  assert.equal(await loader({ languageId: 'fr' }), 'catalog-1');
  assert.equal(calls, 1);
});

test('deduplicates concurrent lazy manifest resolution across locale fallbacks', async () => {
  const storage = createStorage();
  let manifestCalls = 0;
  let resolveManifest;
  const { loader } = createTranslationCacheLoader(
    ({ languageId }) => [languageId],
    {
      hash: () => {
        manifestCalls++;
        return new Promise((resolve) => {
          resolveManifest = resolve;
        });
      },
      storage,
    },
  );

  const french = loader({ languageId: 'fr' });
  const canadian = loader({ languageId: 'fr-CA' });
  assert.equal(manifestCalls, 1);
  resolveManifest({ fr: 1, 'fr-CA': 2 });
  assert.deepEqual(await Promise.all([french, canadian]), [['fr'], ['fr-CA']]);
});

test('persists across manager instances and reloads after a deployment hash changes', async () => {
  const storage = createStorage();
  let hash = 1;
  let calls = 0;

  const initialize = async () => {
    const instance = createI18nManager();
    instance.manager.configure({ languageId: 'fr' });
    instance.manager.setTranslationLoader(
      createTranslationCacheLoader(
        () => `["Hello","Bonjour ${++calls}"]`,
        { hash: () => ({ fr: hash }), storage },
      ).loader,
    );
    await instance.manager.init();
    return instance;
  };

  const first = await initialize();
  const second = await initialize();
  assert.equal(first.manager.getTranslation({ message: 'Hello' }), 'Bonjour 1');
  assert.equal(second.manager.getTranslation({ message: 'Hello' }), 'Bonjour 1');
  assert.equal(calls, 1);

  hash = 2;
  const third = await initialize();
  assert.equal(third.manager.getTranslation({ message: 'Hello' }), 'Bonjour 2');
  assert.equal(calls, 2);
});

test('removes one language or clears the complete persistent cache', async () => {
  const storage = createStorage();
  let calls = 0;
  const cache = createTranslationCacheLoader(
    ({ languageId }) => `${languageId}-${++calls}`,
    { hash: { fr: 1, de: 2 }, storage },
  );

  await cache.loader({ languageId: 'fr' });
  await cache.loader({ languageId: 'de' });
  cache.remove('fr');
  assert.deepEqual(Object.keys(storage.read().entries), ['de']);
  assert.equal(await cache.loader({ languageId: 'fr' }), 'fr-3');
  assert.equal(await cache.loader({ languageId: 'de' }), 'de-2');

  cache.clear();
  assert.equal(storage.getItem('fluentic:i18n:translation-cache'), null);
});

for (const storageMode of [undefined, 'all']) {
  test(`storageMode ${storageMode ?? '(default)'} retains every loaded language`, async () => {
    const storage = createStorage();
    const cache = createTranslationCacheLoader(({ languageId }) => languageId, {
      hash: { fr: 1, de: 2 },
      storage,
      storageMode,
    });
    await cache.loader({ languageId: 'fr' });
    await cache.loader({ languageId: 'de' });
    assert.deepEqual(Object.keys(storage.read().entries), ['fr', 'de']);
  });
}

test('last mode replaces previous languages only after a successful load and refetches evicted data', async () => {
  const storage = createStorage({ unrelated: 'keep me' });
  let calls = 0;
  const cache = createTranslationCacheLoader(({ languageId }) => {
    if (languageId === 'broken') throw new Error('Network failure');
    return `${languageId}-${++calls}`;
  }, { hash: { fr: 1, de: 2, broken: 3 }, storage, storageMode: 'last' });
  assert.equal(await cache.loader({ languageId: 'fr' }), 'fr-1');
  await assert.rejects(cache.loader({ languageId: 'broken' }), /Network failure/);
  assert.deepEqual(Object.keys(storage.read().entries), ['fr']);
  assert.equal(await cache.loader({ languageId: 'de' }), 'de-2');
  assert.deepEqual(Object.keys(storage.read().entries), ['de']);
  assert.equal(await cache.loader({ languageId: 'fr' }), 'fr-3');
  assert.deepEqual(Object.keys(storage.read().entries), ['fr']);
  assert.equal(storage.getItem('unrelated'), 'keep me');
  cache.remove('fr');
  assert.equal(storage.getItem('fluentic:i18n:translation-cache'), null);
});

test('last mode prunes an existing all-mode cache on a cache hit without fetching', async () => {
  const storage = createStorage();
  const all = createTranslationCacheLoader(({ languageId }) => languageId, {
    hash: { fr: 1, de: 2 },
    storage,
    storageKey: 'custom',
  });
  await all.loader({ languageId: 'fr' });
  await all.loader({ languageId: 'de' });
  const last = createTranslationCacheLoader(() => {
    throw new Error('Should hit cache');
  }, { hash: { fr: 1, de: 2 }, storage, storageKey: 'custom', storageMode: 'last' });
  assert.equal(await last.loader({ languageId: 'fr' }), 'fr');
  assert.deepEqual(Object.keys(storage.read('custom').entries), ['fr']);
  last.clear();
  assert.equal(storage.getItem('custom'), null);
});

test('last mode prevents a slow older load from replacing a newer successful request', async () => {
  const storage = createStorage();
  let finishFrench;
  let startedFrench;
  const started = new Promise((resolve) => {
    startedFrench = resolve;
  });
  const cache = createTranslationCacheLoader(({ languageId }) => {
    if (languageId === 'fr') {
      startedFrench();
      return new Promise((resolve) => {
        finishFrench = resolve;
      });
    }
    return 'German';
  }, { hash: { fr: 1, de: 2 }, storage, storageMode: 'last' });
  const french = cache.loader({ languageId: 'fr' });
  await started;
  await cache.loader({ languageId: 'de' });
  finishFrench('French');
  assert.equal(await french, 'French');
  assert.deepEqual(Object.keys(storage.read().entries), ['de']);
});

test('last mode bypasses storage without a hash and clears old catalogs only on success', async () => {
  const storage = createStorage();
  const cache = createTranslationCacheLoader(({ languageId }) => {
    if (languageId === 'broken') throw new Error('Failed');
    return languageId;
  }, { hash: { fr: 1 }, storage, storageMode: 'last' });
  await cache.loader({ languageId: 'fr' });
  await assert.rejects(cache.loader({ languageId: 'broken' }));
  assert.deepEqual(Object.keys(storage.read().entries), ['fr']);
  assert.equal(await cache.loader({ languageId: 'en' }), 'en');
  assert.equal(storage.getItem('fluentic:i18n:translation-cache'), null);
});

test('last mode still invalidates hashes and tolerates unavailable storage', async () => {
  const storage = createStorage();
  let hash = 1;
  let calls = 0;
  const cache = createTranslationCacheLoader(() => `catalog-${++calls}`, {
    hash: () => ({ fr: hash }),
    storage,
    storageMode: 'last',
  });
  await cache.loader({ languageId: 'fr' });
  hash = 2;
  assert.equal(await cache.loader({ languageId: 'fr' }), 'catalog-2');
  assert.equal(storage.read().entries.fr.hash, 2);
  for (
    const unavailable of [null, {
      getItem() {
        throw new Error('Unavailable');
      },
      setItem() {
        throw new Error('Quota');
      },
      removeItem() {
        throw new Error('Unavailable');
      },
    }]
  ) {
    const wrapped = createTranslationCacheLoader(() => 'translation', {
      hash: { fr: 1 },
      storage: unavailable,
      storageMode: 'last',
    });
    assert.equal(await wrapped.loader({ languageId: 'fr' }), 'translation');
    assert.equal(await wrapped.loader({ languageId: 'en' }), 'translation');
  }
});

test('last mode follows selected locales, not fallbacks, including switches to in-memory catalogs', async () => {
  const storage = createStorage();
  let calls = 0;
  const cache = createTranslationCacheLoader(({ languageId }) => {
    calls++;
    return [['Hello', languageId]];
  }, { hash: { 'fr-CA': 1, fr: 2, de: 3, en: 4 }, storage, storageMode: 'last' });
  const instance = createI18nManager();
  instance.manager.configure({ languageId: 'fr-CA', fallbackLanguageId: 'en' });
  instance.manager.setTranslationLoader(cache.loader);
  await instance.manager.init();
  assert.deepEqual(Object.keys(storage.read().entries), ['fr-CA']);
  assert.equal(calls, 3);
  await instance.manager.setLanguageId('de');
  assert.deepEqual(Object.keys(storage.read().entries), ['de']);
  assert.equal(calls, 4);
  await instance.manager.setLanguageId('fr-CA');
  assert.deepEqual(Object.keys(storage.read().entries), ['fr-CA']);
  assert.equal(calls, 4, 'the manager reused its in-memory catalog');
});

test('last mode leaves persistence unchanged when a selected locale or its fallback fails', async () => {
  const storage = createStorage();
  const cache = createTranslationCacheLoader(({ languageId }) => {
    if (languageId === 'fr') throw new Error('Fallback failed');
    return [['Hello', languageId]];
  }, { hash: { de: 1, 'fr-CA': 2, fr: 3 }, storage, storageMode: 'last' });
  const instance = createI18nManager();
  instance.manager.configure({ languageId: 'de' });
  instance.manager.setTranslationLoader(cache.loader);
  await instance.manager.init();
  const before = storage.getItem('fluentic:i18n:translation-cache');
  await assert.rejects(instance.manager.setLanguageId('fr-CA'), /Fallback failed/);
  assert.equal(instance.manager.getLanguageId(), 'de');
  assert.equal(storage.getItem('fluentic:i18n:translation-cache'), before);
});

test('last mode ignores superseded manager selections finishing later', async () => {
  const storage = createStorage();
  let resolveFrench;
  let startedFrench;
  const started = new Promise((resolve) => {
    startedFrench = resolve;
  });
  const cache = createTranslationCacheLoader(({ languageId }) => {
    if (languageId === 'fr') {
      startedFrench();
      return new Promise((resolve) => {
        resolveFrench = resolve;
      });
    }
    return [['Hello', languageId]];
  }, { hash: { en: 1, de: 2, fr: 3 }, storage, storageMode: 'last' });
  const instance = createI18nManager();
  instance.manager.configure({ languageId: 'en' });
  instance.manager.setTranslationLoader(cache.loader);
  await instance.manager.init();
  const french = instance.manager.setLanguageId('fr');
  await started;
  await instance.manager.setLanguageId('de');
  resolveFrench([['Hello', 'fr']]);
  await french;
  assert.equal(instance.manager.getLanguageId(), 'de');
  assert.deepEqual(Object.keys(storage.read().entries), ['de']);
});
