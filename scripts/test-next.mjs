import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout } from 'node:timers/promises';
const directory = new URL('../examples/nextjs/', import.meta.url);
const require = createRequire(new URL('package.json', directory));
const port = process.env.TEST_PORT ?? '32471';
const languageMode = process.env.TEST_LANGUAGE_MODE === 'url' ? 'url' : 'cookie';
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', port], {
  cwd: directory,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (data) => log += data);
child.stderr.on('data', (data) => log += data);
try {
  for (let i = 0;; i++) {
    if (child.exitCode !== null || i > 150) throw new Error(log || 'Next did not start');
    if (log.includes('Ready')) break;
    await setTimeout(100);
  }
  await Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const language = i % 2 ? 'fr' : 'en';
    const expected = language === 'fr' ? 'Bonjour Ada' : 'Hello Ada';
    const response = await fetch(`http://localhost:${port}`, { headers: { cookie: `language=${language}` } });
    const html = await response.text();
    assert.equal(response.status, 200, log);
    if (languageMode === 'url') assert.equal(new URL(response.url).pathname, `/${language}`);
    assert.ok(html.includes(`<title>${expected}</title>`), 'metadata: ' + expected);
    assert.ok(html.includes(`<h1>${expected}</h1>`), 'server JSX: ' + expected);
    assert.ok(html.includes(`title="${expected}"`), 'client SSR attribute: ' + expected);
    const checkHeaders = languageMode === 'url'
      ? { 'x-fluentic-language': language }
      : { cookie: `language=${language}` };
    const check = await fetch(`http://localhost:${port}/api/check`, { headers: checkHeaders });
    assert.deepEqual(await check.json(), { languageId: language, message: expected });
    const edgeCheck = await fetch(`http://localhost:${port}/api/edge-check`, { headers: checkHeaders });
    assert.deepEqual(await edgeCheck.json(), {
      languageId: language,
      message: language === 'fr' ? 'Bonjour Edge' : 'Hello Edge',
    });
  }));
  const update = await fetch(`http://localhost:${port}/api/language`, { method: 'POST', body: 'fr' });
  assert.equal(update.status, 204);
  assert.match(update.headers.get('set-cookie'), /language=fr/);
  console.log(
    `Next ${languageMode} integration passed: concurrent RSC, metadata, client SSR, Node/Edge async scopes, locale endpoint.`,
  );
} finally {
  child.kill('SIGTERM');
}
