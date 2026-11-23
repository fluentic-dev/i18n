import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { defineConfig, exportTranslations, extract, importTranslations } from '../packages/cli/dist/index.mjs';

const extensions = { json: 'json', csv: 'csv', xliff: 'xlf' };
async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'fluentic-exchange-')));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(
    path.join(root, 'src/messages.ts'),
    `import {t} from '@fluentic/i18n';
    t.context('button').note('Click, "here"').meta({screen:'home'}).text('Open');
    t.context('door').text('Open');
    t.text('Hello, "friend" & <b>{name}</b>');
  `,
  );
  const config = defineConfig({
    root,
    output: path.join(root, 'data'),
    languages: { source: 'en', targets: ['fr', 'ja'] },
    files: { includes: ['src/*.ts'] },
  });
  await extract(config);
  const manual = (locale) => path.join(root, 'data/translations', locale, 'manual.jsonl');
  const before = await Promise.all(['fr', 'ja'].map((locale) => readFile(manual(locale), 'utf8')));
  const rows = before[0].trim().split('\n').map(JSON.parse);
  const translations = rows.map((row, index) => `Traduction ${index}, "oui" & <b>{name}</b>\n次`);
  for (const locale of ['fr', 'ja']) {
    await writeFile(
      manual(locale),
      rows.map((row, index) => JSON.stringify([...row.slice(0, -1), translations[index]])).join('\n') + '\n',
    );
  }
  const directory = path.join(root, 'exchange');
  const file = (format, locale = 'fr') => path.join(directory, locale, `messages.${extensions[format]}`);
  const reset = async () => {
    for (const [index, locale] of ['fr', 'ja'].entries()) await writeFile(manual(locale), before[index]);
  };
  return { root, config, manual, before, directory, file, reset, translations };
}

for (const format of Object.keys(extensions)) {
  test(`${format} round trip preserves contexts, Unicode, quotes, markup, and multiline translations`, async (t) => {
    const f = await fixture(t);
    const events = [];
    await exportTranslations(f.config, format, (event) => events.push(event), { directory: f.directory });
    assert.match(
      events.find((event) => event.type === 'info' && event.message.startsWith('Exchange folder:')).message,
      new RegExp(f.directory),
    );
    assert.doesNotMatch(
      events.find((event) => event.type === 'info' && event.message.startsWith('Exchange folder:')).message,
      /\(default\)/,
    );
    const text = await readFile(f.file(format), 'utf8');
    if (format === 'xliff') assert.match(text, /version="1.2"/);
    await f.reset();
    await importTranslations(f.config, format, undefined, { directory: f.directory });
    const rows = (await readFile(f.manual('fr'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows.map((row) => row.at(-1)), f.translations);
    assert.equal(rows.filter((row) => row.length === 3 && row[1] === 'Open').length, 2);
  });
  test(`${format} reports default paths and needs no config converter`, async (t) => {
    const f = await fixture(t);
    const events = [];
    await exportTranslations(f.config, format, (event) => events.push(event));
    assert.match(
      events.find((event) => event.type === 'info' && event.message.startsWith('Exchange folder:')).message,
      /\(default\)$/,
    );
    assert.ok(
      events.find((event) => event.type === 'info' && event.message.startsWith('Exchange folder:')).message.includes(
        path.join(f.root, 'data/exports', format),
      ),
    );
    await importTranslations(f.config, format);
  });
  test(`${format} validates every locale before writing`, async (t) => {
    const f = await fixture(t);
    await exportTranslations(f.config, format, undefined, { directory: f.directory });
    await f.reset();
    await writeFile(
      f.file(format, 'ja'),
      format === 'json' ? '[{"source":4}]' : format === 'csv' ? 'context,source,translation\n"unclosed' : '<xliff>',
    );
    await assert.rejects(
      importTranslations(f.config, format, undefined, { directory: f.directory }),
      /No translations were changed/,
    );
    assert.deepEqual(await Promise.all(['fr', 'ja'].map((locale) => readFile(f.manual(locale), 'utf8'))), f.before);
  });
  test(`${format} rejects missing files and symlinks`, async (t) => {
    const f = await fixture(t);
    await exportTranslations(f.config, format, undefined, { directory: f.directory });
    await rm(f.file(format));
    await assert.rejects(
      importTranslations(f.config, format, undefined, { directory: f.directory }),
      /Expected exactly/,
    );
    await symlink(f.manual('fr'), f.file(format));
    await assert.rejects(importTranslations(f.config, format, undefined, { directory: f.directory }), /Symbolic links/);
  });
}

for (const name of ['json', 'csv', 'xliff', 'handoff']) {
  test(`config.convert overrides ${name} for both operations and custom paths`, async (t) => {
    const f = await fixture(t);
    const calls = [];
    const config = {
      ...f.config,
      convert: [{
        name,
        export: ({ languageId, sourceLanguageId }) => {
          calls.push(`export:${sourceLanguageId}:${languageId}`);
          return { files: [{ path: 'custom.txt', content: 'custom' }] };
        },
        import: ({ languageId, files }) => {
          calls.push(`import:${languageId}`);
          assert.equal(files[0].path, 'custom.txt');
          return [];
        },
      }],
    };
    await exportTranslations(config, name, undefined, { directory: f.directory });
    await importTranslations(config, name, undefined, { directory: f.directory });
    assert.deepEqual(calls, ['export:en:fr', 'export:en:ja', 'import:fr', 'import:ja']);
    assert.equal(await readFile(path.join(f.directory, 'fr/custom.txt'), 'utf8'), 'custom');
  });
  test(`${name} configured override does not fall back for absent methods`, async (t) => {
    const f = await fixture(t);
    const config = { ...f.config, convert: [{ name }] };
    await assert.rejects(exportTranslations(config, name), /does not provide an export function/);
    await assert.rejects(importTranslations(config, name), /does not provide an import function/);
  });
}

test('JSON rejects duplicate records, unknown sources, changed IDs, and duplicate fields', async (t) => {
  const f = await fixture(t);
  await exportTranslations(f.config, 'json', undefined, { directory: f.directory });
  const original = JSON.parse(await readFile(f.file('json'), 'utf8'));
  for (
    const content of [
      JSON.stringify([...original, original[0]]),
      JSON.stringify([{ source: 'unknown', translation: 'x', context: null }]),
      JSON.stringify([{ ...original[0], source: 'changed' }]),
      '[{"source":"a","source":"b","context":null,"translation":"x"}]',
    ]
  ) {
    await writeFile(f.file('json'), content);
    await assert.rejects(
      importTranslations(f.config, 'json', undefined, { directory: f.directory }),
      /duplicate|unknown|does not match|Duplicate/,
    );
  }
});

test('CSV accepts reordered headers, CRLF, BOM, escaped quotes and empty translations', async (t) => {
  const f = await fixture(t);
  await exportTranslations(f.config, 'csv', undefined, { directory: f.directory });
  await writeFile(
    f.file('csv'),
    '\uFEFFtranslation,source,context\r\n"",Open,button\r\n"Bonjour, ""ami""\r\n次",Open,door\r\n',
  );
  await importTranslations(f.config, 'csv', undefined, { directory: f.directory });
  const rows = (await readFile(f.manual('fr'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.find((row) => row[0] === 'button').at(-1), '');
  assert.equal(rows.find((row) => row[0] === 'door').at(-1), 'Bonjour, "ami"\r\n次');
});

test('XLIFF rejects wrong locales, malformed XML, DTD, duplicate units and unsupported inline XML', async (t) => {
  const f = await fixture(t);
  await exportTranslations(f.config, 'xliff', undefined, { directory: f.directory });
  const original = await readFile(f.file('xliff'), 'utf8');
  for (
    const content of [
      original.replace('target-language="fr"', 'target-language="de"'),
      original.replace('</source>', '</bad>'),
      original.replace('<xliff ', '<!DOCTYPE xliff [<!ENTITY x "hello">]><xliff '),
      original.replace('</body>', original.match(/<trans-unit[\s\S]*?<\/trans-unit>/)[0] + '</body>'),
      original.replace('<target>', '<target><g>inline</g>'),
    ]
  ) {
    await writeFile(f.file('xliff'), content);
    await assert.rejects(importTranslations(f.config, 'xliff', undefined, { directory: f.directory }));
  }
});

test('path traversal and converter output symlinks are rejected', async (t) => {
  const f = await fixture(t);
  await assert.rejects(exportTranslations(f.config, '../escape'), /Invalid converter name/);
  await assert.rejects(
    exportTranslations({ ...f.config, languages: { source: 'en', targets: ['../escape'] } }, 'json'),
    /Unsafe/,
  );
  await mkdir(f.directory);
  await symlink(path.dirname(f.manual('fr')), path.join(f.directory, 'fr'));
  await assert.rejects(exportTranslations(f.config, 'json', undefined, { directory: f.directory }), /Symbolic links/);
  await assert.rejects(
    exportTranslations({
      ...f.config,
      convert: [{ name: 'custom', export: () => ({ files: [{ path: '../../escape', content: 'no' }] }) }],
    }, 'custom'),
    /invalid or duplicate path/,
  );
});

test('CLI routes built-ins and overrides with custom and default path reporting', async (t) => {
  const f = await fixture(t);
  const configFile = path.join(f.root, 'i18n.config.mjs');
  const bin = path.resolve('packages/cli/dist/bin.mjs');
  const run = (...args) => promisify(execFile)(process.execPath, [bin, '--config', configFile, ...args]);
  await writeFile(
    configFile,
    `export default {...${JSON.stringify(f.config)},[Symbol.for('@fluentic/i18n-cli/config')]:true};`,
  );
  for (const name of ['json', 'csv', 'xliff']) {
    const directory = path.join(f.root, 'cli', name);
    const result = await run('export', name, '--output', directory);
    assert.ok(result.stdout.includes(`Exchange:    ${directory}\n`));
    assert.match((await run('import', name, '--input', directory)).stdout, /Imported:/);
    assert.match((await run('export', name)).stdout, /\(default\)/);
  }
  await writeFile(
    configFile,
    `export default {...${
      JSON.stringify(f.config)
    },[Symbol.for('@fluentic/i18n-cli/config')]:true,convert:[{name:'handoff',export:()=>({files:[{path:'override.txt',content:'overridden'}]}),import:()=>[]}]};`,
  );
  assert.match(
    (await run('--verbose', 'export', 'handoff', '--output', path.join(f.root, 'override'))).stdout,
    /override.txt/,
  );
  assert.match((await run('import', 'handoff', '--input', path.join(f.root, 'override'))).stdout, /Imported:/);
});
