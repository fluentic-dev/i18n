import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../docs/src/worker.js';

test('asset canonicalization keeps redirects under the documentation mount', async () => {
  const request = new Request('https://fluenticstack.com/i18n/docs/runtime/nextjs?lang=en');
  for (const location of ['/docs/runtime/nextjs/?lang=en', 'https://fluenticstack.com/docs/runtime/nextjs/?lang=en']) {
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async (assetRequest) => {
          assert.equal(new URL(assetRequest.url).pathname, '/docs/runtime/nextjs');
          return new Response(null, { status: 307, headers: { Location: location } });
        },
      },
    });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('Location'), '/i18n/docs/runtime/nextjs/?lang=en');
  }
});

test('successful assets pass through and unrelated paths are rejected', async () => {
  const asset = new Response('documentation', { headers: { 'Content-Type': 'text/html' } });
  const env = { ASSETS: { fetch: async () => asset } };
  assert.equal(await worker.fetch(new Request('https://fluenticstack.com/i18n/docs/intro/'), env), asset);
  assert.equal((await worker.fetch(new Request('https://fluenticstack.com/i18n-other'), env)).status, 404);
});
