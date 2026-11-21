import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const bin = fileURLToPath(new URL('../packages/cli/dist/bin.mjs', import.meta.url));
const core = new URL('../packages/cli/dist/index.mjs', import.meta.url).href;
const providers = new URL('../packages/cli/dist/translators.mjs', import.meta.url).href;

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'fluentic-cli-ux-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src/messages.ts'), "import { t } from '@fluentic/i18n'; t.text('Hello');");
  await writeFile(path.join(root, 'src/plain.ts'), 'export const value = 1;');
  const config = path.join(root, 'i18n.config.mjs');
  const configure = async (extra = '', before = '') =>
    writeFile(
      config,
      `
    import { defineConfig } from ${JSON.stringify(core)};
    ${before}
    export default defineConfig({
      root: ${JSON.stringify(root)}, output: ${JSON.stringify(path.join(root, 'data'))},
      languages: { source: 'en', targets: ['fr'] }, files: { includes: ['src/*.ts'] }, ${extra}
    });
  `,
    );
  await configure();
  const run = (...args) =>
    spawnSync(process.execPath, [bin, '--config', config, ...args], { cwd: root, encoding: 'utf8', timeout: 15000 });
  return { root, config, configure, run };
}

function failed(result, expected) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, expected);
  assert.doesNotMatch(result.stderr, /^\s+at\s|Node\.js v|file:\/\/.*dist\/.*:\d+/m);
}

for (const command of ['extract', 'merge', 'conflict', 'translate', 'update', 'export', 'import']) {
  test(`${command} reports missing and invalid configuration without a stack`, async (t) => {
    const f = await fixture(t);
    const args = command === 'export' || command === 'import' ? [command, 'json'] : [command];
    await rm(f.config);
    failed(f.run(...args), /Could not load config.*File or folder not found/);
    await f.configure('languages: null');
    failed(f.run(...args), /Invalid i18n config: languages must contain source and targets/);
    await writeFile(f.config, 'export default {');
    failed(f.run(...args), /Could not load config/);
  });
}

test('unknown formats include available built-ins and configured converters', async (t) => {
  const f = await fixture(t);
  await f.configure("convert: [{ name: 'vendor', export: () => ({ files: [] }) }]");
  for (const command of ['export', 'import']) {
    const result = f.run(command, 'handoff5');
    failed(result, new RegExp(`${command} failed: Unknown converter "handoff5"`));
    assert.match(result.stderr, /Available formats: json, csv, xliff, handoff, vendor/);
    assert.match(result.stderr, /config.convert/);
    assert.doesNotMatch(result.stdout, /\[done\]/);
  }
});

test('CLI usage errors are concise and help succeeds', async (t) => {
  const f = await fixture(t);
  for (const args of [['oops'], ['export'], ['extract', '--oops']]) failed(f.run(...args), /error:/);
  assert.equal(f.run('--help').status, 0);
  assert.equal(f.run('export', '--help').status, 0);
});

test('extraction reports cold, cached, changed, removed, and empty file sets', async (t) => {
  const f = await fixture(t);
  let result = f.run('extract');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 files matched; 0 cached, 1 parsed, 1 without message calls, 0 removed/);
  assert.match(result.stdout, /1 unique messages; 1 target languages/);
  assert.match(result.stdout, /Catalogs: .*data\/translations/);
  result = f.run('extract');
  assert.match(result.stdout, /2 files matched; 2 cached, 0 parsed/);
  await writeFile(
    path.join(f.root, 'src/messages.ts'),
    "import { t } from '@fluentic/i18n'; t.text('Hello'); t.text('Save');",
  );
  result = f.run('extract');
  assert.match(result.stdout, /1 cached, 1 parsed/);
  assert.match(result.stdout, /2 unique messages/);
  await rm(path.join(f.root, 'src/messages.ts'));
  result = f.run('extract');
  assert.match(result.stdout, /1 files matched; 1 cached, 0 parsed, 0 without message calls, 1 removed/);
  assert.match(result.stderr, /No translatable messages found/);
  await f.configure("files: { includes: ['missing/**/*.ts'] }");
  result = f.run('extract');
  assert.equal(result.status, 0);
  assert.match(result.stderr, /No source files matched.*Check files.includes/);
  assert.match(result.stdout, /0 files matched/);
});

test('all successful commands report outcomes and no-op translation explains why', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run('extract').status, 0);
  const skipped = f.run('translate');
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /Skipped; no translator configured/);
  for (const command of ['merge', 'conflict', 'update']) {
    const result = f.run(command);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fr: 0\/1 translated; 1 missing/);
    assert.match(result.stdout, /1 catalog files/);
  }
  assert.match(f.run('export', 'json').stdout, /1 files written/);
  assert.match(f.run('import', 'json').stdout, /1 translations imported; 1 language files updated/);
  await f.configure("translator: ({ items }) => items.map(({ id }) => ({ id, translation: 'Bonjour' }))");
  assert.match(f.run('translate').stdout, /1 messages translated; 0 still missing/);
  assert.match(f.run('translate').stdout, /up to date; no missing translations/);
});

test('translator failures and malformed results include the language pair', async (t) => {
  const f = await fixture(t);
  f.run('extract');
  for (
    const [translator, expected] of [
      ["() => { throw new Error('Service unavailable'); }", /Translation failed for en -> fr: Service unavailable/],
      ["() => { throw 'Service unavailable'; }", /Translation failed for en -> fr: Service unavailable/],
      ['() => null', /Invalid translator response/],
      [
        "{ translate: () => [], support: () => { throw new Error('Support unavailable'); } }",
        /support check failed for en -> fr/,
      ],
      ["{ translate: () => [], support: () => 'yes' }", /support must return a boolean/],
    ]
  ) {
    await f.configure(`translator: ${translator}`);
    const result = f.run('translate');
    failed(result, expected);
    assert.doesNotMatch(result.stdout, /\[done\] translate/);
  }
  for (
    const [extra, expected] of [
      ['translator: {}', /translator\[0\].*translate function/],
      ['translator: { translate: () => [], batch: 0 }', /batch.*positive integer/],
      ['convert: {}', /convert must be an array/],
      ["convert: [{ name: 'custom', export: true }]", /convert\[0\].export must be a function/],
    ]
  ) {
    await f.configure(extra);
    failed(f.run('update'), expected);
  }
});

test('provider failures explain credentials, HTTP status, network and endpoint errors', async (t) => {
  const f = await fixture(t);
  f.run('extract');
  const providerImport = `import { createGoogleTranslator, createDeepLTranslator } from ${JSON.stringify(providers)};`;
  for (const provider of ['createGoogleTranslator', 'createDeepLTranslator']) {
    await f.configure(`translator: ${provider}({ apiKeyEnv: 'FLUENTIC_TEST_MISSING_API_KEY' })`, providerImport);
    failed(f.run('translate'), /FLUENTIC_TEST_MISSING_API_KEY.*i18n.env.local/);
    for (
      const [status, expected] of [[403, /API key and service permissions/], [429, /Rate limit/], [
        503,
        /temporarily unavailable/,
      ]]
    ) {
      await f.configure(
        `translator: ${provider}({ apiKey: 'test-secret' })`,
        providerImport + `globalThis.fetch = async () => new Response('private response', { status: ${status} });`,
      );
      const result = f.run('translate');
      failed(result, expected);
      assert.doesNotMatch(result.stderr, /test-secret|private response/);
    }
  }
  await f.configure("translator: createGoogleTranslator({ apiKey: 'test', endpoint: 'bad' })", providerImport);
  failed(f.run('translate'), /Invalid translator endpoint/);
  await f.configure(
    "translator: createGoogleTranslator({ apiKey: 'test' })",
    providerImport + "globalThis.fetch = async () => { throw new TypeError('fetch failed'); };",
  );
  failed(f.run('translate'), /Could not reach the translation service/);
});

test('converter callback failures and invalid results are actionable and preserve files', async (t) => {
  const f = await fixture(t);
  f.run('extract');
  f.run('export', 'json');
  const manual = path.join(f.root, 'data/translations/fr/manual.jsonl');
  const before = await readFile(manual, 'utf8');
  for (
    const [method, implementation, expected] of [
      [
        'export',
        "() => { throw new Error('Vendor unavailable'); }",
        /Converter "json" export failed for fr: Vendor unavailable/,
      ],
      ['export', '() => null', /Invalid converter response/],
      [
        'import',
        "() => { throw new Error('Invalid vendor data'); }",
        /Invalid vendor data.*No translations were changed/,
      ],
      ['import', '() => null', /import callback must return an array/],
    ]
  ) {
    await f.configure(`convert: [{ name: 'json', ${method}: ${implementation} }]`);
    failed(f.run(method, 'json'), expected);
    assert.equal(await readFile(manual, 'utf8'), before);
  }
  await f.configure("convert: [{ name: 'json' }]");
  for (const method of ['export', 'import']) {
    failed(f.run(method, 'json'), new RegExp(`does not provide an ${method} function.*config.convert`));
  }
});

test('filesystem and catalog failures are readable; debug details are opt-in', async (t) => {
  const f = await fixture(t);
  await f.configure("root: 'does-not-exist'");
  failed(f.run('extract'), /File or folder not found/);
  await f.configure();
  f.run('extract');
  await writeFile(path.join(f.root, 'data/translations/fr/manual.jsonl'), '<<<<<<< HEAD\n');
  for (const command of ['extract', 'merge', 'conflict', 'update']) {
    failed(f.run(command), /unresolved merge conflict.*resolve it/);
  }
  await f.configure("translator: () => { throw new Error('Debug probe'); }");
  await writeFile(path.join(f.root, 'data/translations/fr/manual.jsonl'), '["Hello", ""]\n');
  const debug = f.run('--debug', 'translate');
  assert.equal(debug.status, 1);
  assert.match(debug.stderr, /\n\s+at /);
});
