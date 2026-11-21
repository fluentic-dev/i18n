import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));

test('the documented CLI workflow loads TypeScript config and produces usable catalogs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-docs-'));
  try {
    await mkdir(path.join(directory, 'src'));
    await writeFile(
      path.join(directory, 'src/Welcome.tsx'),
      `import { t } from '@fluentic/i18n';
  export const welcome = t.msg('Welcome back, {name}!', { name: String });
  export const help = t.context('checkout').note('Next step').meta({ screen: 'pay' }).msg('Continue');
  export function Welcome() { return t.jsx('Welcome back!'); }
  export function text() { return t.text(welcome, { name: 'Ada' }); }
  `,
    );
    await writeFile(
      path.join(directory, 'i18n.config.ts'),
      `import { defineConfig } from ${
        JSON.stringify(pathToFileURL(path.join(repo, 'packages/cli/dist/index.mjs')).href)
      };
  export default defineConfig({ root: ${JSON.stringify(directory)}, output: ${
        JSON.stringify(path.join(directory, 'i18n/data'))
      }, languages: { source: 'en', targets: ['fr', 'de'] }, files: { includes: ['src/**/*.{ts,tsx}'] } });`,
    );
    const cli = (command) =>
      execFileSync(process.execPath, [path.join(repo, 'packages/cli/dist/bin.mjs'), command], {
        cwd: directory,
        stdio: 'pipe',
      });
    cli('update');
    const cacheRoot = path.join(directory, 'i18n/data/cache.local');
    const extracted = JSON.parse(await readFile(path.join(cacheRoot, 'extract.json'), 'utf8'));
    const cachedMessages = Object.values(extracted.messages).flat();
    assert.equal(cachedMessages.length, 3);
    assert.equal(cachedMessages.find((item) => item.source === 'Continue').context, 'checkout');
    assert.equal(Object.keys(JSON.parse(await readFile(path.join(cacheRoot, 'hashes.json'), 'utf8')).hashes).length, 1);
    const manualPath = path.join(directory, 'i18n/data/translations/fr/manual.jsonl');
    const manual = (await readFile(manualPath, 'utf8')).trim().split('\n').map(JSON.parse);
    const source = (row) => row.length === 2 ? row[0] : row[1];
    manual.find((item) => source(item) === 'Continue')[2] = 'Continuer';
    manual.find((item) => source(item) === 'Welcome back!')[1] = 'Bon retour !';
    manual.find((item) => source(item) === 'Welcome back, {name}!')[1] = 'Bon retour, {name} !';
    await writeFile(manualPath, manual.map((item) => JSON.stringify(item)).join('\n') + '\n');
    await rm(cacheRoot, { recursive: true, force: true });
    cli('merge');
    cli('update');
    const jsonl = await readFile(path.join(directory, 'i18n/data/translations/fr/merged.jsonl'), 'utf8');
    const rows = jsonl.trim().split('\n').map(JSON.parse);
    assert.ok(rows.some((row) => JSON.stringify(row) === JSON.stringify(['checkout', 'Continue', 'Continuer'])));
    assert.ok(rows.some((row) => JSON.stringify(row) === JSON.stringify(['Welcome back!', 'Bon retour !'])));
    const { I18nRegistry, t } = await import(pathToFileURL(path.join(repo, 'packages/i18n/dist/index.js')).href);
    const { I18nManager } = await import(pathToFileURL(path.join(repo, 'packages/i18n/dist/adapter.js')).href);
    I18nManager.setStorage(null);
    I18nManager.configure({ languageId: 'en' });
    I18nManager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? jsonl : []);
    await I18nManager.init();
    assert.equal(t.text('Welcome back!'), 'Welcome back!');
    await I18nManager.setLanguageId('fr');
    assert.equal(t.text('Welcome back!'), 'Bon retour !');
    assert.equal(t.context('checkout').text('Continue'), 'Continuer');
    assert.equal(t.text(t.msg('Welcome back, {name}!', { name: String }), { name: 'Ada' }), 'Bon retour, Ada !');
    assert.equal(t.text('{name}', { name: ({ languageId }) => languageId }), 'fr');
    I18nRegistry.addNumberFormat('price', { style: 'currency', currency: 'EUR' });
    assert.match(t.text('{amount, number, price}', { amount: 29.9 }), /29,90/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('extraction caches by file and synchronizes authoring layers', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-cache-'));
  try {
    const { defineConfig, extract } = await import('../packages/cli/dist/index.mjs');
    const sourcePath = path.join(directory, 'src/messages.ts');
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, `import { t } from '@fluentic/i18n'; t.text('Hello');`);
    const config = defineConfig({
      root: directory,
      output: path.join(directory, 'data'),
      languages: { source: 'en', targets: ['fr'] },
      files: { includes: ['src/*.ts'] },
    });
    const processed = [];
    const report = (event) => {
      if (event.type === 'file:processed') processed.push(event.file);
    };
    await extract(config, report);
    assert.deepEqual(processed, ['src/messages.ts']);
    processed.length = 0;
    await extract(config, report);
    assert.deepEqual(processed, []);

    await writeFile(sourcePath, `import { t } from '@fluentic/i18n'; t.text('Hello'); t.text('Save');`);
    await extract(config, report);
    assert.deepEqual(processed, ['src/messages.ts']);
    const manualPath = path.join(directory, 'data/translations/fr/manual.jsonl');
    const manual = (await readFile(manualPath, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(manual.map((item) => item[0]), ['Hello', 'Save']);
    const meta = (await readFile(path.join(directory, 'data/translations/meta.jsonl'), 'utf8')).trim().split('\n')
      .map(JSON.parse);
    assert.deepEqual(meta.map((item) => item[0]), ['Hello', 'Save']);

    await rm(sourcePath);
    await extract(config);
    assert.equal(await readFile(manualPath, 'utf8'), '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('compiled CLI keeps review files readable and converter exports retain source identity', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-compiled-'));
  try {
    const { defineConfig, extract, merge, exportTranslations } = await import('../packages/cli/dist/index.mjs');
    await mkdir(path.join(directory, 'src'));
    await writeFile(
      path.join(directory, 'src/messages.ts'),
      `import {t as tr} from '@fluentic/i18n'; const c=tr.context('account'); export const greeting=c.msg('Hello {name}',{name:String});`,
    );
    let exported;
    const config = defineConfig({
      compiled: { hashLength: 6 },
      root: directory,
      output: path.join(directory, 'data'),
      languages: { source: 'en', targets: ['fr'] },
      files: { includes: ['src/*.ts'] },
      convert: [{
        name: 'review',
        export: ({ items }) => {
          exported = items;
          return { files: [] };
        },
      }],
    });
    await extract(config);
    await merge(config);
    const manualPath = path.join(directory, 'data/translations/fr/manual.jsonl');
    const manual = JSON.parse((await readFile(manualPath, 'utf8')).trim());
    assert.deepEqual(manual, ['account', 'Hello {name}', '']);
    manual[2] = 'Bonjour {name}';
    await writeFile(manualPath, JSON.stringify(manual) + '\n');
    await merge(config);
    const [header, row] = (await readFile(path.join(directory, 'data/translations/fr/merged.jsonl'), 'utf8')).trim()
      .split('\n').map(JSON.parse);
    assert.deepEqual(header, { compiled: true });
    assert.equal(row.length, 2);
    assert.match(row[0], /^[A-Za-z0-9_-]{6}$/);
    assert.ok(Array.isArray(row[1]));
    assert.deepEqual(JSON.parse((await readFile(manualPath, 'utf8')).trim()), manual);
    await exportTranslations(config, 'review');
    assert.equal(exported[0].context, 'account');
    assert.equal(exported[0].source, 'Hello {name}');
    assert.equal(exported[0].translation, 'Bonjour {name}');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('automatic translation selects the first provider supporting each language pair', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-translators-'));
  try {
    const {
      defineConfig,
      defineTranslator,
      extract,
      merge,
      translateAuto,
    } = await import(
      '../packages/cli/dist/index.mjs'
    );
    const { createDeepLTranslator, createGoogleTranslator } = await import(
      '../packages/cli/dist/translators.mjs'
    );
    const deepL = createDeepLTranslator({ apiKey: 'not-used-by-support' });
    const google = createGoogleTranslator({ apiKey: 'not-used-by-support' });
    const supportRequest = { sourceLanguageId: 'en', targetLanguageId: 'fr', items: [], env: () => '' };
    assert.equal(await deepL.support(supportRequest), true);
    assert.equal(await deepL.support({ ...supportRequest, targetLanguageId: 'ga' }), false);
    assert.equal(await google.support({ ...supportRequest, targetLanguageId: 'ga' }), true);
    await mkdir(path.join(directory, 'src'));
    await writeFile(path.join(directory, 'src/messages.ts'), `import { t } from '@fluentic/i18n'; t.text('Hello');`);
    const selected = [];
    const first = defineTranslator({
      support: async ({ targetLanguageId }) => targetLanguageId === 'fr',
      translate: ({ items, targetLanguageId }) => {
        selected.push(`first:${targetLanguageId}`);
        return items.map(({ id }) => ({ id, translation: 'Bonjour' }));
      },
    });
    const fallback = defineTranslator({
      support: () => true,
      translate: ({ items, targetLanguageId }) => {
        selected.push(`fallback:${targetLanguageId}`);
        return items.map(({ id }) => ({ id, translation: 'Dia dhuit' }));
      },
    });
    const config = defineConfig({
      root: directory,
      output: path.join(directory, 'data'),
      languages: { source: 'en', targets: ['fr', 'ga'] },
      translator: [first, fallback],
      files: { includes: ['src/*.ts'] },
    });
    await extract(config);
    await merge(config);
    await translateAuto(config);
    await merge(config);
    assert.deepEqual(selected, ['first:fr', 'fallback:ga']);
    const french = JSON.parse(
      (await readFile(path.join(directory, 'data/translations/fr/merged.jsonl'), 'utf8')).trim(),
    );
    const irish = JSON.parse(
      (await readFile(path.join(directory, 'data/translations/ga/merged.jsonl'), 'utf8')).trim(),
    );
    assert.deepEqual(french, ['Hello', 'Bonjour']);
    assert.deepEqual(irish, ['Hello', 'Dia dhuit']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
