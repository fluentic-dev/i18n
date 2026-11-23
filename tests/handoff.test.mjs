import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import {
  defineConfig,
  exportHandoff,
  exportTranslations,
  extract,
  importHandoff,
  importTranslations,
  merge,
} from '../packages/cli/dist/index.mjs';

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'handoff-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  const source = path.join(root, 'src/messages.ts');
  await writeFile(
    source,
    `import { t } from '@fluentic/i18n';
    t.note('Payment button').text('Pay {amount, number}');
    t.context('menu').text('Open');
    t.context('door').text('Open');
    t.text('{count, plural, one {# item} other {# items}}');
    t.text('Read <link>more</link>');
  `,
  );
  const config = defineConfig({
    root,
    output: path.join(root, 'data'),
    languages: { source: 'en', targets: ['fr', 'ja'] },
    files: { includes: ['src/*.ts'] },
  });
  await extract(config);
  const directory = path.join(root, 'handoff');
  const options = { directory };
  const manual = (language) => path.join(root, 'data/translations', language, 'manual.jsonl');
  const output = (language) => path.join(directory, 'output', `${language}.json`);
  const input = (language) => path.join(directory, 'input', `${language}.json`);
  const before = await Promise.all(['fr', 'ja'].map((language) => readFile(manual(language), 'utf8')));
  const prompt = await exportHandoff(config, options);
  for (const language of ['fr', 'ja']) await writeFile(output(language), await readFile(input(language)));
  return { root, source, config, directory, options, manual, output, input, before, prompt };
}

test('minimal handoff round trip preserves contextual identities and writes manual translations', async (t) => {
  const f = await fixture(t);
  assert.ok(f.prompt.includes(path.join(f.directory, 'input')));
  const input = JSON.parse(await readFile(f.input('fr'), 'utf8'));
  assert.equal(Object.values(input).filter((source) => source === 'Open').length, 2);
  assert.ok(Object.keys(input).every((key) => /^m[0-9a-z]+$/.test(key)));
  const context = JSON.parse(await readFile(path.join(f.directory, 'context.json'), 'utf8'));
  assert.equal(Object.keys(context).length, 3);
  const translated = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === 'Open' ? `Ouvrir ${key}` : value]),
  );
  await writeFile(f.output('fr'), JSON.stringify(translated));
  await importHandoff(f.config, f.options);
  const rows = (await readFile(f.manual('fr'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.filter((row) => row.length === 3 && row[2].startsWith('Ouvrir')).length, 2);
  await merge(f.config);
  await assert.rejects(importHandoff(f.config, f.options), /stale/);
  assert.match(await exportHandoff(f.config, f.options), /No missing/);
  assert.deepEqual(await readdir(path.join(f.directory, 'input')), []);
  await importHandoff(f.config, f.options);
});

test('export replaces previous input with missing entries and preserves all output bytes', async (t) => {
  const f = await fixture(t);
  const original = await readFile(f.output('fr'), 'utf8');
  const originalInput = JSON.parse(await readFile(f.input('fr'), 'utf8'));
  const rows = f.before[0].trim().split('\n').map(JSON.parse);
  rows[0][rows[0].length - 1] = 'Translated';
  await writeFile(f.manual('fr'), rows.map(JSON.stringify).join('\n') + '\n');
  await writeFile(
    f.manual('ja'),
    rows.map((row) => JSON.stringify([...row.slice(0, -1), 'Translated'])).join('\n') + '\n',
  );
  await writeFile(path.join(f.directory, 'input/obsolete.json'), '{}');
  await mkdir(path.join(f.directory, 'input/obsolete-folder'));
  await writeFile(path.join(f.directory, 'output/keep.txt'), 'Agent scratchpad');
  const prompt = await exportHandoff(f.config, f.options);
  assert.match(prompt, /remove obsolete output keys and files/);
  assert.deepEqual(await readdir(path.join(f.directory, 'input')), ['fr.json']);
  const refreshed = JSON.parse(await readFile(f.input('fr'), 'utf8'));
  assert.equal(Object.keys(refreshed).length, 4);
  for (const [key, value] of Object.entries(refreshed)) assert.equal(originalInput[key], value);
  assert.equal(await readFile(f.output('fr'), 'utf8'), original);
  assert.equal(await readFile(f.output('ja'), 'utf8'), original);
  assert.equal(await readFile(path.join(f.directory, 'output/keep.txt'), 'utf8'), 'Agent scratchpad');
  await assert.rejects(importHandoff(f.config, f.options), /unexpected/);
  // The agent reconciles preserved output to the new input, then import succeeds.
  await writeFile(f.output('fr'), JSON.stringify(refreshed));
  await rm(f.output('ja'));
  await rm(path.join(f.directory, 'output/keep.txt'));
  await importHandoff(f.config, f.options);
});

test('refresh removes old context and never reuses retired keys, including after an empty refresh', async (t) => {
  const f = await fixture(t);
  const oldKeys = Object.keys(JSON.parse(await readFile(f.input('fr'), 'utf8')));
  const preserved = await readFile(f.output('fr'), 'utf8');
  await writeFile(f.source, "import { t } from '@fluentic/i18n'; t.text('A newly added message');");
  await extract(f.config);
  await exportHandoff(f.config, f.options);
  const input = JSON.parse(await readFile(f.input('fr'), 'utf8'));
  const key = Object.keys(input)[0];
  assert.ok(!oldKeys.includes(key));
  assert.ok(!(await readdir(f.directory)).includes('context.json'));
  assert.equal(await readFile(f.output('fr'), 'utf8'), preserved);
  for (const locale of ['fr', 'ja']) await writeFile(f.output(locale), JSON.stringify(input));
  await importHandoff(f.config, f.options);
  assert.match(await exportHandoff(f.config, f.options), /No missing/);
  assert.deepEqual(await readdir(path.join(f.directory, 'input')), []);
  assert.equal(await readFile(f.output('fr'), 'utf8'), JSON.stringify(input));
  await writeFile(f.source, "import { t } from '@fluentic/i18n'; t.text('Another new message');");
  await extract(f.config);
  await exportHandoff(f.config, f.options);
  const next = Object.keys(JSON.parse(await readFile(f.input('fr'), 'utf8')))[0];
  assert.ok(![...oldKeys, key].includes(next));
});

test('refresh failure restores prior input and manifest without touching output', async (t) => {
  const f = await fixture(t);
  const before = await readFile(f.input('fr'), 'utf8');
  const manifest = await readFile(path.join(f.directory, 'manifest.json'), 'utf8');
  const fs = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const original = fs.rename;
  let calls = 0;
  fs.rename = async (...args) => {
    if (++calls === 4) throw new Error('Simulated refresh failure');
    return original(...args);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(exportHandoff(f.config, f.options), /Simulated refresh failure/);
  } finally {
    fs.rename = original;
    syncBuiltinESMExports();
  }
  assert.equal(await readFile(f.input('fr'), 'utf8'), before);
  assert.equal(await readFile(f.output('fr'), 'utf8'), before);
  assert.equal(await readFile(path.join(f.directory, 'manifest.json'), 'utf8'), manifest);
  assert.ok(!(await readdir(f.directory)).some((name) => name.startsWith('.refresh-')));
});

for (
  const kind of [
    'invalid-json',
    'duplicate',
    'missing',
    'extra',
    'empty',
    'type',
    'placeholder',
    'tag',
    'icu',
    'extra-file',
    'symlink',
  ]
) {
  test(`import rejects ${kind} with a repair prompt and no language writes`, async (t) => {
    const f = await fixture(t);
    const input = JSON.parse(await readFile(f.input('ja'), 'utf8'));
    const key = Object.keys(input)[0];
    if (kind === 'missing') delete input[key];
    if (kind === 'extra') input.unexpected = 'Unexpected';
    if (kind === 'empty') input[key] = '';
    if (kind === 'type') input[key] = 42;
    if (kind === 'placeholder') input[Object.keys(input).find((key) => input[key].includes('{amount'))] = 'Payer';
    if (kind === 'tag') input[Object.keys(input).find((key) => input[key].includes('<link>'))] = 'Lire';
    if (kind === 'icu') input[key] = '{count, plural, one {item}}';
    await writeFile(
      f.output('ja'),
      kind === 'invalid-json' ? '{' : kind === 'duplicate' ? '{"m0":"a","m\\u0030":"b"}' : JSON.stringify(input),
    );
    if (kind === 'extra-file') await writeFile(path.join(f.directory, 'output/extra.json'), '{}');
    if (kind === 'symlink') {
      await rm(f.output('ja'));
      await symlink(f.input('ja'), f.output('ja'));
    }
    await assert.rejects(importHandoff(f.config, f.options), /Copy this to your coding agent/);
    assert.deepEqual(await Promise.all(['fr', 'ja'].map((language) => readFile(f.manual(language), 'utf8'))), f.before);
  });
}

for (const change of ['source', 'manual', 'input', 'manifest']) {
  test(`import rejects changed ${change}`, async (t) => {
    const f = await fixture(t);
    if (change === 'source') await writeFile(f.source, "import { t } from '@fluentic/i18n'; t.text('New source');");
    if (change === 'manual') await writeFile(f.manual('fr'), f.before[0] + '\n');
    if (change === 'input') await writeFile(f.input('fr'), '{}');
    if (change === 'manifest') {
      const file = path.join(f.directory, 'manifest.json');
      const manifest = JSON.parse(await readFile(file, 'utf8'));
      manifest.languages['../../escape'] = manifest.languages.fr;
      await writeFile(file, JSON.stringify(manifest));
    }
    await assert.rejects(importHandoff(f.config, f.options), /fresh handoff/i);
    assert.equal(await readFile(f.manual('ja'), 'utf8'), f.before[1]);
  });
}

test('locale-specific plural categories are allowed', async (t) => {
  const f = await fixture(t);
  const input = JSON.parse(await readFile(f.input('ja'), 'utf8'));
  const key = Object.keys(input).find((key) => input[key].includes('{count, plural'));
  input[key] = '{count, plural, other {# 個}}';
  await writeFile(f.output('ja'), JSON.stringify(input));
  await importHandoff(f.config, f.options);
});

test('CLI prints a copyable guide, imports, and reports concise repair failures', async (t) => {
  const f = await fixture(t);
  const configFile = path.join(f.root, 'i18n.config.mjs');
  await writeFile(
    configFile,
    `export default { ...${JSON.stringify(f.config)}, [Symbol.for('@fluentic/i18n-cli/config')]: true };`,
  );
  const bin = path.resolve('packages/cli/dist/bin.mjs');
  const run = (...args) => promisify(execFile)(process.execPath, [bin, '--config', configFile, ...args]);
  const target = path.join(f.root, 'cli-handoff');
  const result = await run('export', 'handoff', '--output', target);
  assert.match(result.stdout, /GUIDE\s+Copy this to your coding agent/);
  assert.match(result.stdout, /\nTranslate every JSON file/);
  assert.doesNotMatch(result.stdout, /INFO  Translate|INFO  Preserve|INFO  $/m);
  assert.match(result.stdout, /Messages:\s+\d+ missing translations/);
  assert.match(result.stdout, /\n\nDONE  export/);
  await assert.rejects(run('import', 'handoff', '--input', target), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /GUIDE\s+Copy this to your coding agent/);
    assert.match(error.stderr, /\nFix files in/);
    assert.doesNotMatch(error.stdout, /DONE  import/);
    assert.doesNotMatch(error.stderr, /at importHandoff/);
    return true;
  });
  for (const locale of ['fr', 'ja']) {
    await writeFile(
      path.join(target, 'output', `${locale}.json`),
      await readFile(path.join(target, 'input', `${locale}.json`)),
    );
  }
  const imported = await run('import', 'handoff', '--input', target);
  assert.match(imported.stdout, /Imported:\s+\d+/);
  assert.equal((imported.stderr.match(/WARN/g) ?? []).length, 2);
  assert.match(imported.stderr, /translations match the source/);
  assert.match(imported.stderr, /--verbose/);
  assert.match(imported.stdout, /Next:\s+fluentic-i18n merge\n\nDONE  import/);
  const empty = await run('export', 'handoff', '--output', target);
  assert.match(empty.stdout, /No missing translations; nothing to send/);
  assert.doesNotMatch(empty.stdout, /GUIDE|Copy this/);
  assert.match((await run('import', 'handoff', '--input', target)).stdout, /nothing to import/);
});

test('export excludes existing translations while retaining missing entries', async (t) => {
  const f = await fixture(t);
  const rows = f.before[0].trim().split('\n').map(JSON.parse);
  rows[0][rows[0].length - 1] = 'Already translated';
  await writeFile(f.manual('fr'), rows.map(JSON.stringify).join('\n') + '\n');
  const directory = path.join(f.root, 'missing-only');
  await exportHandoff(f.config, { directory });
  const fr = JSON.parse(await readFile(path.join(directory, 'input/fr.json'), 'utf8'));
  const ja = JSON.parse(await readFile(path.join(directory, 'input/ja.json'), 'utf8'));
  assert.equal(Object.keys(fr).length, 4);
  assert.equal(Object.keys(ja).length, 5);
});

test('a failed second rename rolls back the first language', async (t) => {
  const f = await fixture(t);
  const fs = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const original = fs.rename;
  let calls = 0;
  fs.rename = async (...args) => {
    if (++calls === 2) throw new Error('Simulated rename failure');
    return original(...args);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(importHandoff(f.config, f.options), /Simulated rename failure/);
  } finally {
    fs.rename = original;
    syncBuiltinESMExports();
  }
  assert.deepEqual(await Promise.all(['fr', 'ja'].map((locale) => readFile(f.manual(locale), 'utf8'))), f.before);
});

test('existing exchange API supports the built-in name without a reporter', async (t) => {
  const f = await fixture(t);
  await exportTranslations(f.config, 'handoff');
  const root = path.join(f.root, 'data/exports/handoff');
  assert.equal(JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')).format, 'handoff');
  for (const locale of ['fr', 'ja']) {
    await writeFile(
      path.join(root, 'output', `${locale}.json`),
      await readFile(path.join(root, 'input', `${locale}.json`)),
    );
  }
  await importTranslations(f.config, 'handoff');
  assert.notEqual(await readFile(f.manual('fr'), 'utf8'), f.before[0]);
});

test('preserved output cannot be remapped after the manifest is lost', async (t) => {
  const f = await fixture(t);
  const output = await readFile(f.output('fr'), 'utf8');
  await rm(path.join(f.directory, 'manifest.json'));
  await assert.rejects(exportHandoff(f.config, f.options), /Restore manifest.json/);
  assert.equal(await readFile(f.output('fr'), 'utf8'), output);
});
