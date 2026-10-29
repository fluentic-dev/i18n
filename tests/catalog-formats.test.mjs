import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { conflict, defineConfig, extract, merge } from '../packages/cli/dist/index.mjs';
import { createI18nManager } from '../packages/i18n/dist/adapter.js';

const require = createRequire(import.meta.url);

test('catalog formats produce line-based equivalent rows and remove obsolete outputs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-formats-'));

  try {
    await mkdir(path.join(directory, 'src'));
    await writeFile(
      path.join(directory, 'src/messages.ts'),
      "import { t } from '@fluentic/i18n'; t.text('Hello'); t.context('menu').text('Open');",
    );
    const config = defineConfig({
      root: directory,
      output: path.join(directory, 'data'),
      languages: { source: 'en', targets: ['fr'] },
      files: { includes: ['src/*.ts'] },
      catalogFormat: ['jsonl', 'json', 'cjs', 'mjs'],
      compiled: true,
    });
    await extract(config);
    await merge(config);
    const base = path.join(directory, 'data/translations/fr');
    const manualPath = path.join(base, 'manual.jsonl');
    const rows = (await readFile(manualPath, 'utf8')).trim().split('\n').map(JSON.parse);
    for (const row of rows) row.translation = row.source === 'Hello' ? 'Bonjour' : 'Ouvrir';
    await writeFile(manualPath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
    await merge(config);

    const jsonl = (await readFile(path.join(base, 'merged.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const jsonText = await readFile(path.join(base, 'merged.json'), 'utf8');
    const json = JSON.parse(jsonText);
    const cjs = require(path.join(base, 'merged.cjs'));
    const mjs = (await import(pathToFileURL(path.join(base, 'merged.mjs')).href)).default;
    assert.deepEqual(json, [...jsonl, null]);
    assert.deepEqual(cjs, jsonl);
    assert.deepEqual(mjs, jsonl);
    assert.match(jsonText, /,\n  null\n\]/);
    assert.match(await readFile(path.join(base, 'merged.cjs'), 'utf8'), /,\n\];/);
    const managed = createI18nManager();
    managed.manager.setTranslationLoader(() => json);
    await managed.manager.init();
    assert.equal(Object.keys(managed.manager.getSnapshot().translations.en).length, 2);

    await merge({ ...config, catalogFormat: 'json' });
    for (const format of ['jsonl', 'cjs', 'mjs']) await assert.rejects(access(path.join(base, `merged.${format}`)));
    assert.deepEqual(JSON.parse(await readFile(path.join(base, 'merged.json'), 'utf8')), json);

    await merge({ ...config, compiled: false, catalogFormat: 'json' });
    const uncompiled = JSON.parse(await readFile(path.join(base, 'merged.json'), 'utf8'));
    assert.deepEqual(uncompiled, [['Hello', 'Bonjour'], ['menu', 'Open', 'Ouvrir'], null]);
    const regular = createI18nManager();
    regular.manager.setTranslationLoader(() => uncompiled);
    await regular.manager.init();
    assert.equal(regular.manager.getTranslation({ context: 'menu', message: 'Open' }), 'Ouvrir');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('conflict rebuilds generated files and refuses to overwrite conflicted authoring files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-conflicts-'));

  try {
    await mkdir(path.join(directory, 'src'));
    await writeFile(path.join(directory, 'src/messages.ts'), "import { t } from '@fluentic/i18n'; t.text('Hello');");
    const config = defineConfig({
      root: directory,
      output: path.join(directory, 'data'),
      languages: { source: 'en', targets: ['fr'] },
      files: { includes: ['src/*.ts'] },
      catalogFormat: ['jsonl', 'json', 'cjs', 'mjs'],
    });
    await conflict(config);
    const base = path.join(directory, 'data/translations/fr');
    const manualPath = path.join(base, 'manual.jsonl');
    const manual = await readFile(manualPath, 'utf8');
    for (const format of ['jsonl', 'json', 'cjs', 'mjs']) {
      await writeFile(path.join(base, `merged.${format}`), '<<<<<<< ours\n=======\n>>>>>>> theirs\n');
    }
    await conflict(config);
    for (const format of ['jsonl', 'json', 'cjs', 'mjs']) {
      assert.doesNotMatch(await readFile(path.join(base, `merged.${format}`), 'utf8'), /<<<<<<< /);
    }
    const conflictText = `<<<<<<< ours\n${manual}=======\n${manual}>>>>>>> theirs\n`;
    await writeFile(manualPath, conflictText);
    await assert.rejects(conflict(config), /unresolved merge conflict/);
    await assert.rejects(merge(config), /unresolved merge conflict/);
    assert.equal(await readFile(manualPath, 'utf8'), conflictText);
    await writeFile(manualPath, '{"id":"Hello"}\n');
    await assert.rejects(conflict(config), /invalid translation file/);
    assert.equal(await readFile(manualPath, 'utf8'), '{"id":"Hello"}\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
