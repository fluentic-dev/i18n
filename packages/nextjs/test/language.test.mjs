import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClientHandler as createCookieClientHandler } from '../dist/cookie-client.mjs';
import { defineLanguages, requireLanguageId, resolveLanguageId } from '../dist/language.mjs';
import { createClientHandler as createUrlClientHandler, localizePathname } from '../dist/url-client.mjs';

const languages = defineLanguages({ languages: ['en', 'fr'], defaultLanguageId: 'en' });

test('language definitions validate and resolve supported IDs', () => {
  assert.equal(resolveLanguageId(languages, 'fr'), 'fr');
  assert.equal(resolveLanguageId(languages, 'de'), null);
  assert.equal(requireLanguageId(languages, 'en'), 'en');
  assert.throws(() => requireLanguageId(languages, 'de'), /unsupported language/);
  assert.throws(() => defineLanguages({ languages: [], defaultLanguageId: 'en' }), /at least one language/);
  assert.throws(
    () => defineLanguages({ languages: ['en', 'en'], defaultLanguageId: 'en' }),
    /must be unique/,
  );
});

test('URL localization replaces a known prefix and preserves the remaining path', () => {
  assert.equal(localizePathname('/', 'fr', languages), '/fr');
  assert.equal(localizePathname('/account', 'fr', languages), '/fr/account');
  assert.equal(localizePathname('/en/account', 'fr', languages), '/fr/account');
  assert.equal(localizePathname('/fr/account/settings', 'en', languages), '/en/account/settings');
});

test('URL client handler is stateless and navigates from the URL available at invocation', async () => {
  const navigations = [];
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: {
      pathname: '/en/account',
      search: '?tab=billing',
      hash: '#card',
      assign: (href) => navigations.push(['assign', href]),
      replace: (href) => navigations.push(['replace', href]),
    },
  };

  try {
    const { handler } = createUrlClientHandler(languages);
    await handler('fr');
    await handler('en', { replace: true });
    assert.deepEqual(navigations, [
      ['assign', '/fr/account?tab=billing#card'],
      ['replace', '/en/account?tab=billing#card'],
    ]);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('cookie client handler posts the requested ID and reloads without reading language state', async () => {
  const requests = [];
  let reloads = 0;
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  globalThis.fetch = async (...args) => {
    requests.push(args);
    return new Response(null, { status: 204 });
  };
  globalThis.window = { location: { reload: () => reloads++ } };

  try {
    const { handler } = createCookieClientHandler({ ...languages, endpoint: '/language' });
    await handler('fr');
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], '/language');
    assert.equal(requests[0][1].body, 'fr');
    assert.equal(reloads, 1);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});
