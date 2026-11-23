import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const bin = fileURLToPath(new URL('../packages/cli/dist/bin.mjs', import.meta.url));
const core = new URL('../packages/cli/dist/index.mjs', import.meta.url).href;
const providers = new URL('../packages/cli/dist/translators.mjs', import.meta.url).href;

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'fluentic-cli-ux-')));
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
  assert.match(result.stderr.replace(/\r?\n\s*/g, ' '), expected);
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
    failed(result, new RegExp(`${command} failed.*Unknown converter "handoff5"`));
    assert.match(result.stderr, /Available formats: json, csv, xliff, handoff, vendor/);
    assert.match(result.stderr, /config.convert/);
    assert.doesNotMatch(result.stdout, /DONE/);
  }
});

test('CLI usage errors are concise and help succeeds', async (t) => {
  const f = await fixture(t);
  for (const args of [['oops'], ['export'], ['extract', '--oops']]) failed(f.run(...args), /ERROR  /);
  assert.equal(f.run('--help').status, 0);
  assert.equal(f.run('export', '--help').status, 0);
});

test('extraction reports cold, cached, changed, removed, and empty file sets', async (t) => {
  const f = await fixture(t);
  let result = f.run('extract');
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Files:\s+2 matched · 0 cached · 1 parsed\n\s+Skipped:\s+1 file with no translatable messages · 0 removed/,
  );
  assert.match(result.stdout, /Messages:\s+1 unique · 1 target language/);
  assert.match(result.stdout, /Catalogs: .*data\/translations/);
  result = f.run('extract');
  assert.match(result.stdout, /Files:\s+2 matched · 2 cached · 0 parsed/);
  await writeFile(
    path.join(f.root, 'src/messages.ts'),
    "import { t } from '@fluentic/i18n'; t.text('Hello'); t.text('Save');",
  );
  result = f.run('extract');
  assert.match(result.stdout, /1 cached · 1 parsed/);
  assert.match(result.stdout, /Messages:\s+2 unique/);
  await rm(path.join(f.root, 'src/messages.ts'));
  result = f.run('extract');
  assert.match(
    result.stdout,
    /Files:\s+1 matched · 1 cached · 0 parsed\n\s+Skipped:\s+0 files with no translatable messages · 1 removed/,
  );
  assert.match(result.stderr, /No translatable messages found/);
  await f.configure("files: { includes: ['missing/**/*.ts'] }");
  result = f.run('extract');
  assert.equal(result.status, 0);
  assert.match(result.stderr, /No source files matched.*Check files.includes/);
  assert.match(result.stdout, /Files:\s+0 matched/);
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
    assert.match(result.stdout, /fr:\s+0\/1 translated · 1 missing/);
    assert.match(result.stdout, /Files:\s+1 written/);
    assert.match(result.stdout, /\n\n\s*DONE  merge/);
    assert.doesNotMatch(result.stdout, /[^\n]\n *DONE/);
  }
  assert.match(f.run('export', 'json').stdout, /Files:\s+1 written/);
  assert.match(f.run('import', 'json').stdout, /Imported:\s+1\n\s+Files:\s+1 updated/);
  await f.configure("translator: ({ items }) => items.map(({ id }) => ({ id, translation: 'Bonjour' }))");
  assert.match(f.run('translate').stdout, /Translated:\s+1\n\s+Missing:\s+0/);
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
    assert.doesNotMatch(result.stdout, /DONE  translate/);
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

test('command output uses relative paths and keeps per-file details opt-in', async (t) => {
  const f = await fixture(t);
  const result = f.run('--no-color', 'extract');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Config:\s+i18n\.config\.mjs/m);
  assert.match(result.stdout, /Source:\s+\./);
  assert.match(result.stdout, /Catalogs:\s+data\/translations/);
  assert.match(result.stdout, /RUN  extract/);
  assert.match(result.stdout, /DONE  extract \(\d+ ms\)/);
  assert.doesNotMatch(result.stdout, /\x1b\[|FILE|TRANSLATED/);
  assert.ok(!result.stdout.includes(f.root));
  await writeFile(path.join(f.root, 'src/messages.ts'), "import { t } from '@fluentic/i18n'; t.text('Save');");
  const verbose = f.run('--no-color', '--verbose', 'extract');
  assert.match(verbose.stdout, /FILE\s+src\/messages\.ts/);
  assert.ok(!verbose.stdout.includes(f.root));
  const exported = f.run('--no-color', 'export', 'json');
  assert.ok(!exported.stdout.includes(f.root));
  assert.match(exported.stdout, /data\/exports\/json/);
});

test('console reporter preserves nested phases, multiline errors and verbose paths', async () => {
  const { createConsoleReporter } = await import(core);
  const output = [];
  const errors = [];
  const report = createConsoleReporter((line) => output.push(line), (line) => errors.push(line), {
    color: false,
    verbose: true,
    cwd: '/workspace/project',
  });
  report({ type: 'phase:start', phase: 'update' });
  report({ type: 'phase:start', phase: 'extract' });
  report({ type: 'file:processed', file: '/workspace/project/src/a.ts' });
  report({ type: 'file:processed', file: '/workspace/shared/a.ts' });
  report({ type: 'warning', message: 'Check config.\nTry again.' });
  report({ type: 'phase:end', phase: 'extract', details: { Messages: '3 unique' }, summary: 'legacy summary' });
  report({ type: 'phase:end', phase: 'update', summary: 'All complete.' });
  report({ type: 'error', error: new Error('Failed.\nCheck credentials.') });
  assert.deepEqual(output.map((line) => line.replace(/\(\d+ ms\)/g, '(time)')), [
    'RUN  update',
    '',
    '  RUN  extract',
    '    FILE         src/a.ts',
    '    FILE         ../shared/a.ts',
    '    Messages:    3 unique',
    '',
    '  DONE  extract (time)',
    '',
    '  All complete.',
    '',
    'DONE  update (time)',
  ]);
  assert.deepEqual(errors, [
    '    WARN         Check config.\n                 Try again.',
    '',
    'ERROR  Failed.\n       Check credentials.',
  ]);
});

test('color respects forced color, NO_COLOR, and the CLI override', async (t) => {
  const f = await fixture(t);
  await f.configure("files: { includes: ['missing/**/*.ts'] }");
  const run = (env, ...args) =>
    spawnSync(process.execPath, [bin, '--config', f.config, ...args, 'extract'], {
      cwd: f.root,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, FORCE_COLOR: '1', ...env },
    });
  const colored = run({ NO_COLOR: undefined });
  assert.equal(colored.status, 0, colored.stderr);
  assert.match(colored.stdout, /\x1b\[36mRUN\x1b\[0m/);
  assert.match(colored.stderr, /\x1b\[33mWARN\x1b\[0m/);
  for (const result of [run({ NO_COLOR: '1' }), run({}, '--no-color'), run({ FORCE_COLOR: '0' })]) {
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /\x1b\[/);
  }
});

test('next steps precede completion and are omitted for no-op imports and update stages', async (t) => {
  const f = await fixture(t);
  await f.configure("translator: ({ items }) => items.map(({ id }) => ({ id, translation: 'Bonjour' }))");
  const updated = f.run('update');
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /fr:\s+translating 1 message \(en -> fr\)/);
  assert.doesNotMatch(updated.stdout, /Next:.*merge/);
  assert.match(updated.stdout, /\n\nDONE  update[^\n]+\n\n$/);
  assert.equal(f.run('export', 'json').status, 0);
  const imported = f.run('import', 'json');
  assert.equal(imported.status, 0, imported.stderr);
  assert.match(imported.stdout, /Next:\s+fluentic-i18n merge\n\nDONE  import[^\n]+\n\n$/);
  assert.equal(f.run('export', 'handoff').status, 0);
  const empty = f.run('import', 'handoff');
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /Imported:\s+0/);
  assert.doesNotMatch(empty.stdout, /Next:/);
  await f.configure("convert: [{ name: 'vendor', import: () => [] }]");
  const skipped = f.run('import', 'vendor');
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.match(skipped.stdout, /Status:\s+No files imported/);
  assert.doesNotMatch(skipped.stdout, /Next:/);
});

test('warning summaries keep all affected keys available in verbose output', async () => {
  const { createConsoleReporter } = await import(core);
  const event = {
    type: 'warning',
    message: 'fr.json: 2 translations match the source',
    details: ['fr.json / m0', 'fr.json / m1'],
  };
  for (const verbose of [false, true]) {
    const errors = [];
    const report = createConsoleReporter(() => {}, (line) => errors.push(line), { color: false, verbose });
    report(event);
    assert.equal(errors.filter((line) => line.startsWith('WARN')).length, 1);
    if (verbose) assert.deepEqual(errors.slice(1), ['  fr.json / m0', '  fr.json / m1']);
    else assert.deepEqual(errors.slice(1), ['  Use --verbose to list affected keys.']);
  }
});

test('excess command arguments show structured usage and converter examples', async (t) => {
  const f = await fixture(t);
  for (const command of ['import', 'export']) {
    const result = f.run('--no-color', command, command === 'import' ? 'export' : 'import', 'handoff');
    failed(result, new RegExp(`ERROR  ${command} accepts one converter`));
    assert.match(result.stderr, new RegExp(`\\n\\n  Usage: +fluentic-i18n ${command} \\[options\\] <converter>`));
    assert.match(result.stderr, new RegExp(`Example: +fluentic-i18n ${command} handoff`));
    assert.match(result.stderr, new RegExp(`Help: +fluentic-i18n ${command} --help\\n\\n$`));
    assert.doesNotMatch(result.stdout + result.stderr, /Config:|RUN |DONE |^error:|\x1b\[/m);
  }
  const extra = f.run('extract', 'extra');
  failed(extra, /ERROR  Too many arguments/);
  assert.match(extra.stderr, /Usage: +fluentic-i18n extract \[options\]/);
  assert.doesNotMatch(extra.stderr, /Example:/);
});

test('each invocation ends with exactly one empty line, including help and failures', async (t) => {
  const f = await fixture(t);
  await f.configure("translator: ({ items }) => items.map(({ id }) => ({ id, translation: 'Bonjour' }))");
  for (
    const args of [
      ['extract'],
      ['merge'],
      ['conflict'],
      ['translate'],
      ['update'],
      ['export', 'json'],
      ['import', 'json'],
      ['export', 'handoff'],
      ['import', 'handoff'],
      ['--help'],
      ['import', '--help'],
      ['import', 'export', 'handoff'],
      ['oops'],
      ['--config', 'missing.config.mjs', 'extract'],
    ]
  ) {
    const result = f.run('--no-color', ...args);
    const output = result.status ? result.stderr : result.stdout;
    assert.match(output, /[^\n]\n\n$/, args.join(' ') + '\n' + output);
    assert.doesNotMatch(output, /\n{3,}/, args.join(' '));
  }
  await f.configure("translator: () => { throw new Error('Debug newline probe') }");
  await writeFile(path.join(f.root, 'data/translations/fr/auto.jsonl'), '["Hello", ""]\n');
  await writeFile(path.join(f.root, 'data/translations/fr/manual.jsonl'), '["Hello", ""]\n');
  const debug = f.run('--debug', 'update');
  assert.equal(debug.status, 1);
  assert.match(debug.stderr, /[^\n]\n\n$/);
});

test('nested provider quota failures have a short heading and aligned diagnostics', async (t) => {
  const f = await fixture(t);
  await f.configure(
    "translator: createDeepLTranslator({ apiKey: 'test-secret' })",
    `import { createDeepLTranslator } from ${
      JSON.stringify(providers)
    }; globalThis.fetch = async () => new Response('private response', {status:456});`,
  );
  const result = f.run('--no-color', 'update');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /DONE  extract/);
  assert.doesNotMatch(result.stdout, /DONE  (translate|update)/);
  assert.equal(
    result.stderr,
    '\nERROR  update failed\n\n' +
      '  Step:        translate\n' +
      '  Languages:   en -> fr\n' +
      '  Provider:    DeepL\n' +
      '  HTTP:        456\n' +
      '  Reason:      Translation quota exceeded\n' +
      '  Next:        Check your plan and usage.\n\n',
  );
});

test('INFO text aligns with detail values at every phase depth', async () => {
  const { createConsoleReporter } = await import(core);
  const output = [];
  const report = createConsoleReporter((line) => output.push(line), undefined, { color: false });
  report({ type: 'phase:start', phase: 'update' });
  report({ type: 'phase:start', phase: 'export' });
  report({ type: 'info', message: 'Output: folder' });
  report({ type: 'info', message: 'Nothing to send.' });
  assert.equal(output.at(-3), '    Output:      folder');
  assert.equal(output.at(-2), '');
  assert.equal(output.at(-1), '    INFO         Nothing to send.');
  assert.equal(output.at(-3).indexOf('folder'), output.at(-1).indexOf('Nothing'));
});

test('conflict separates its introductory INFO and final Status from phase headings', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run('extract').status, 0);
  const result = f.run('--no-color', 'conflict');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RUN  conflict\n\n  INFO         Rebuilding catalogs/);
  assert.match(result.stdout, /DONE  merge \([^\n]+\)\n\n  Status:      Catalogs rebuilt/);
  assert.match(result.stdout, /\n\nDONE  conflict \([^\n]+\)\n\n$/);
  assert.doesNotMatch(result.stdout, /\n{3}/);
});
