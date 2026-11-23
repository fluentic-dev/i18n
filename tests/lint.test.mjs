import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createConsoleReporter, extract, lint, validateConfig } from '../packages/cli/dist/index.mjs';
import { lintSource } from '../packages/compiler/dist/index.mjs';

const scan = (code) => lintSource(`import { t } from '@fluentic/i18n';\n${code}`, 'test.tsx');

test('source lint resolves scopes, reports parameters, and distinguishes schemas from values', () => {
  const result = scan(`
    const scoped = t.context('form'); const alias = scoped;
    alias.jsx('Hello {name}');
    t.msg('Hello {name}');
    t.text('{amount, number}', { amount: 'wrong', extra: 1 });
    t.jsx('<strong>Hello {name}</strong>', { name: String });
    t.msg('{amount, number}', { amount: String });
    t.msg('{name}', { name: 'wrong' });
  `);
  assert.deepEqual(result.diagnostics.map((d) => [d.severity, d.code]), [
    ['error', 'missing-param'],
    ['warning', 'missing-schema'],
    ['error', 'param-type'],
    ['warning', 'unused-param'],
    ['error', 'missing-param'],
    ['error', 'schema-as-value'],
    ['warning', 'schema-type'],
    ['error', 'invalid-schema'],
  ]);
  assert.equal(result.messages[0].context, 'form');
  assert.equal(result.diagnostics[0].line, 4);
  assert.ok(result.diagnostics.every((d) => d.column > 0));
});

test('source lint handles nested ICU, break, shadowing, dynamic objects, and callback renderers', () => {
  assert.deepEqual(
    scan(`
    t.text('{break}Hello {name}', { name: user.name });
    t.jsx('<strong>{name}</strong>', { strong: t.tag(chunks => chunks), name: () => 'A' });
    t.msg('<strong>{name}</strong>', { name: String });
    t.text('{n, plural, one {One} other {{name}}}', { n: 2, name: 'A' });
    t.text('{name}', dynamicParams);
    t.text('{name}', { ...dynamicParams });
    t.text('{name}', { name: String, ...dynamicParams });
    t.jsx(() => <div />);
    t.text(descriptor);
    t.msg(descriptor, { name: user.name });
    function f(t) { t.text('{name}'); }
    function g(String) { t.text('{name}', { name: String }); }
  `).diagnostics,
    [],
  );
  assert.deepEqual(scan(`t.text('{n, plural, other {{name}}}', { n: 1 });`).diagnostics.map((d) => d.code), [
    'missing-param',
  ]);
});

test('source lint continues after malformed messages and scope errors', () => {
  const result = scan(`t.text('{bad'); t.msg(dynamic); t.context(dynamic).text('Hello'); t.jsx('{missing}');`);
  assert.deepEqual(result.diagnostics.map((d) => d.code), [
    'invalid-icu',
    'extraction',
    'missing-param',
  ]);
});

async function fixture(t, source = `t.text('Hello {name}', { name: 'World' });`) {
  const root = await mkdtemp(path.join(tmpdir(), 'fluentic-lint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src/app.tsx'), `import { t } from '@fluentic/i18n';\n${source}`);
  const config = {
    root,
    output: path.join(root, 'data'),
    languages: { source: 'en', targets: ['fr'] },
    files: { includes: ['src/**/*.tsx'] },
  };
  const catalogs = path.join(root, 'data/translations');
  await extract(config);
  return { root, config, catalogs };
}
async function snapshot(root) {
  const files = await readdir(root, { recursive: true, withFileTypes: true });
  return Promise.all(
    files.filter((file) => file.isFile()).map(async (file) => {
      const full = path.join(file.parentPath, file.name);
      return [full, await readFile(full, 'utf8')];
    }),
  );
}

test('lint aggregates row diagnostics across layers and locales without changing any files', async (t) => {
  const f = await fixture(t);
  f.config.languages.targets.push('de');
  await mkdir(path.join(f.catalogs, 'de'));
  await writeFile(
    path.join(f.catalogs, 'fr/manual.jsonl'),
    [
      JSON.stringify(['Hello {name}', 'Bonjour {other}']),
      '{bad',
      JSON.stringify([null, 'Hello', 'Bonjour']),
      JSON.stringify(['Hello {name}', 'Bonjour {name}']),
    ].join('\n'),
  );
  await writeFile(path.join(f.catalogs, 'fr/auto.jsonl'), JSON.stringify(['Hello {name}', '{invalid']));
  await writeFile(path.join(f.catalogs, 'de/manual.jsonl'), JSON.stringify(['Unknown', 'Unbekannt']));
  const before = await snapshot(f.root);
  const result = await lint(f.config);
  assert.deepEqual(result.diagnostics.map((d) => d.code), [
    'translation-structure',
    'invalid-row',
    'invalid-row',
    'duplicate-message',
    'invalid-icu',
    'unknown-source',
  ]);
  assert.equal(result.errors, 6);
  assert.equal(result.diagnostics[1].line, 2);
  assert.deepEqual(await snapshot(f.root), before);
});

test('lint permits plural categories and empty translations, but checks ICU contracts', async (t) => {
  const cases = [
    [
      '{n, plural, one {# item} other {# items}}',
      '{n, plural, one {# daiktas} few {# daiktai} other {# daiktų}}',
      false,
    ],
    ['{n, select, edit {Edit} other {Other}}', '{n, select, save {Save} other {Other}}', true],
    ['{n, plural, =0 {None} other {#}}', '{n, plural, other {#}}', true],
    ['{n, plural, offset:1 other {#}}', '{n, plural, other {#}}', true],
    ['{n, selectordinal, other {#}}', '{n, plural, other {#}}', true],
    ['{n, number}', '{n}', true],
    ['<strong>{n}</strong>', '<em>{n}</em>', true],
    ['Hello {n}', '', false],
  ];
  const f = await fixture(
    t,
    cases.map(([source]) => `t.text(${JSON.stringify(source)}, { n: 2, strong: handler });`).join('\n'),
  );
  await writeFile(
    path.join(f.catalogs, 'fr/manual.jsonl'),
    cases.map(([s, target]) => JSON.stringify([s, target])).join('\n'),
  );
  const result = await lint(f.config);
  const mismatches = result.diagnostics.filter((d) => d.code === 'translation-structure');
  assert.deepEqual(mismatches.map((d) => d.line), cases.flatMap(([, , bad], i) => bad ? [i + 1] : []));
});

test('lint reports drift, optional product terms, and coverage without requiring completion', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'src/app.tsx'), `import {t} from '@fluentic/i18n'; t.text('Use Excel');`);
  const result = await lint({ ...f.config, lint: { forbiddenMessages: { match: 'contains', terms: 'Excel' } } });
  assert.equal(result.errors, 0);
  assert.deepEqual(result.diagnostics.map((d) => d.code), ['forbidden-message', 'extraction-drift']);
  assert.deepEqual(result.coverage.fr, { translated: 0, total: 1 });
  await rm(path.join(f.root, 'data'), { recursive: true });
  assert.equal((await lint(f.config)).diagnostics[0].code, 'missing-metadata');
  assert.deepEqual(await readdir(f.root), ['src']);
});

test('CLI lint fails for errors, optionally fails for warnings, and reports summary', async (t) => {
  const f = await fixture(t, `t.msg('Hello {name}');`);
  const configFile = path.join(f.root, 'i18n.config.mjs');
  const module = new URL('../packages/cli/dist/index.mjs', import.meta.url).href;
  await writeFile(
    configFile,
    `import { defineConfig } from ${JSON.stringify(module)}; export default defineConfig(${JSON.stringify(f.config)});`,
  );
  const bin = fileURLToPath(new URL('../packages/cli/dist/bin.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [bin, '-c', configFile, 'lint', ...args], { encoding: 'utf8' });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /missing-schema/);
  assert.match(result.stdout, /0 errors · 1 warnings/);
  assert.equal(run('--strict').status, 1);
  await writeFile(path.join(f.root, 'src/app.tsx'), `import {t} from '@fluentic/i18n'; t.jsx('Hello {name}');`);
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /app.tsx:1:\d+ \[missing-param\]/);
});

test('clean lint honors exclusions, reports coverage, and never calls translators', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'src/ignored.tsx'), 'invalid syntax @');
  f.config.files.excludes = ['src/ignored.tsx'];
  f.config.translator = () => {
    throw new Error('lint must not translate');
  };
  await writeFile(path.join(f.catalogs, 'fr/manual.jsonl'), JSON.stringify(['Hello {name}', 'Bonjour {name}']));
  const result = await lint(f.config);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.files, 1);
  assert.deepEqual(result.coverage.fr, { translated: 1, total: 1 });
});

test('lint continues across source parse failures and invalid metadata without misleading drift', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'src/broken.tsx'), 'const = ;');
  await writeFile(path.join(f.root, 'src/another.tsx'), `import {t} from '@fluentic/i18n'; t.text('{missing}');`);
  await writeFile(path.join(f.catalogs, 'meta.jsonl'), '{bad');
  await writeFile(path.join(f.catalogs, 'fr/auto.jsonl'), JSON.stringify(['Hello {name}', '{bad']));
  const result = await lint(f.config);
  assert.deepEqual(result.diagnostics.map((d) => d.code), [
    'missing-param',
    'extraction',
    'invalid-metadata',
    'invalid-icu',
  ]);
});

test('lint detects changed and conflicting source metadata', async (t) => {
  const f = await fixture(t, `t.note('Old note').msg('Hello');`);
  await writeFile(
    path.join(f.root, 'src/app.tsx'),
    `import {t} from '@fluentic/i18n'; t.note('New note').msg('Hello');`,
  );
  assert.match((await lint(f.config)).diagnostics[0].message, /0 new, 0 removed, 1 metadata changes/);
  await writeFile(
    path.join(f.root, 'src/another.tsx'),
    `import {t} from '@fluentic/i18n'; t.meta({ screen: 'other' }).msg('Hello');`,
  );
  assert.ok((await lint(f.config)).diagnostics.some((d) => d.code === 'conflicting-metadata'));
});

test('forbiddenMessages accepts single and multiple rules with explicit matching', async (t) => {
  const f = await fixture(t, `t.text('Acme'); t.text('Use Acme'); t.text('acme');`);
  const check = async (forbiddenMessages) => (await lint({ ...f.config, lint: { forbiddenMessages } })).diagnostics;
  assert.equal((await check({ match: 'exact', terms: 'Acme' })).length, 1);
  assert.equal((await check({ match: 'contains', terms: ['Acme'] })).length, 2);
  assert.equal((await check({ match: 'exact', terms: 'Acme', caseSensitive: false })).length, 2);
  const result = await check([
    { match: 'exact', terms: 'Acme', id: 'brand', severity: 'error', message: 'Render separately.' },
    { match: 'contains', terms: 'USE', caseSensitive: false },
  ]);
  assert.deepEqual(result.map((d) => [d.code, d.severity]), [['brand', 'error'], ['forbidden-message', 'warning']]);
  assert.match(result[0].message, /Render separately/);
});

test('forbidden callbacks receive ICU once per identity, include catalog-only sources, and isolate failures', async (t) => {
  const f = await fixture(
    t,
    `t.text('Hello {name}', { name: 'A' }); t.context('other').text('Hello {name}', { name: 'B' });`,
  );
  const calls = [];
  let result = await lint({
    ...f.config,
    lint: {
      forbiddenMessages: async (source) => {
        calls.push(source);
      },
    },
  });
  assert.deepEqual(calls, ['Hello {name}', 'Hello {name}']);
  assert.equal(result.errors, 0);
  await writeFile(path.join(f.root, 'src/app.tsx'), `import {t} from '@fluentic/i18n'; t.text('New message');`);
  result = await lint({
    ...f.config,
    lint: {
      forbiddenMessages: [
        {
          id: 'broken',
          check: () => {
            throw new Error('broken check');
          },
        },
        () => false,
        {
          id: 'custom',
          severity: 'error',
          check: async (source) => source.includes('{name}') ? ['First issue', 'Second issue'] : undefined,
        },
      ],
    },
  });
  assert.equal(result.diagnostics.filter((d) => d.code === 'forbidden-rule-error').length, 6);
  assert.equal(result.diagnostics.filter((d) => d.code === 'custom').length, 4);
  assert.ok(result.diagnostics.filter((d) => d.code === 'custom').every((d) => d.file.endsWith('meta.jsonl')));
});

test('forbiddenMessages configuration rejects malformed or ambiguous rules', () => {
  const config = { languages: { source: 'en', targets: [] } };
  for (
    const rule of [
      null,
      'Acme',
      {},
      { match: 'word', terms: 'Acme' },
      { match: 'exact', terms: [] },
      { match: 'contains', terms: [1] },
      { match: 'contains', terms: 'x', severity: 'fatal' },
      { match: 'contains', terms: 'x', caseSensitive: 'no' },
      { check: 'not a function' },
      { check: () => {}, match: 'exact' },
    ]
  ) {
    assert.throws(() => validateConfig({ ...config, lint: { forbiddenMessages: rule } }), /Invalid i18n config/);
  }
  assert.throws(() => validateConfig({ ...config, lint: { forbiddenTerms: ['old'] } }), /was replaced/);
});

test('parameterChecks supports global and per-method switches with enabled defaults', async (t) => {
  const f = await fixture(t, `t.msg('Hello {name}'); t.jsx('Hello {name}'); t.text('Hello {name}');`);
  const check = async (parameterChecks) => (await lint({ ...f.config, lint: { parameterChecks } })).diagnostics;
  for (const option of [undefined, true, {}]) {
    assert.deepEqual((await check(option)).map((d) => d.code), ['missing-schema', 'missing-param', 'missing-param']);
  }
  assert.deepEqual(await check(false), []);
  assert.deepEqual(await check({ msg: false, jsx: false, text: false }), []);
  assert.deepEqual((await check({ msg: false })).map((d) => d.code), ['missing-param', 'missing-param']);
  assert.deepEqual((await check({ jsx: false })).map((d) => d.message.split(' ')[0]), ['t.msg', 't.text']);
  assert.deepEqual((await check({ text: false })).map((d) => d.message.split(' ')[0]), ['t.msg', 't.jsx']);
});

test('parameterChecks disables all parameter diagnostics but preserves extraction and ICU checks', () => {
  const code = `import {t} from '@fluentic/i18n';
    t.text('{n, number}', { n: 'wrong', extra: 1 });
    t.jsx('{name}', { name: String });
    t.msg('{n, number}', { n: String });
    t.msg('{name}', { name: 'wrong' });
    t.text('{broken');
    t.msg(dynamic);
  `;
  const result = lintSource(code, 'test.ts', undefined, { parameterChecks: false });
  assert.deepEqual(result.diagnostics.map((d) => d.code), ['invalid-icu']);
  assert.equal(result.messages.length, 5);
});

test('disabled source parameter checks preserve translation, forbidden-message, and drift diagnostics', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.catalogs, 'fr/manual.jsonl'), JSON.stringify(['Hello {name}', 'Bonjour {other}']));
  await writeFile(
    path.join(f.root, 'src/app.tsx'),
    `import {t} from '@fluentic/i18n'; t.text('Hello {name}'); t.text('New {value}');`,
  );
  const result = await lint({
    ...f.config,
    lint: {
      parameterChecks: { msg: false, jsx: false, text: false },
      forbiddenMessages: { match: 'contains', terms: 'Hello' },
    },
  });
  assert.deepEqual(result.diagnostics.map((d) => d.code), [
    'forbidden-message',
    'extraction-drift',
    'translation-structure',
  ]);
});

test('parameterChecks validates switches and rejects unknown method names', () => {
  const config = { languages: { source: 'en', targets: [] } };
  for (const parameterChecks of [null, 'false', [], { msg: 'false' }, { jsx: 0 }, { text: null }, { typo: false }]) {
    assert.throws(() => validateConfig({ ...config, lint: { parameterChecks } }), /lint.parameterChecks/);
  }
});

for (const method of ['msg', 'jsx', 'text']) {
  test(`${method} parameter checks accept enabled and message-specific skip predicates`, () => {
    const code = `import {t} from '@fluentic/i18n'; t.${method}('Skip {name}'); t.${method}('Check {name}');`;
    const calls = [];
    const options = {
      parameterChecks: {
        [method]: {
          skip: (args) => {
            calls.push(args);
            return args.message.startsWith('Skip');
          },
        },
      },
    };
    const result = lintSource(code, 'test.ts', undefined, options);
    assert.deepEqual(calls, [{ message: 'Skip {name}' }, { message: 'Check {name}' }]);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.messages.length, 2);
    assert.deepEqual(
      lintSource(code, 'test.ts', undefined, {
        parameterChecks: {
          [method]: {
            enabled: false,
            skip: () => {
              throw new Error('must not run');
            },
          },
        },
      }).diagnostics,
      [],
    );
    for (const check of [{}, { enabled: true }, { skip: () => false }]) {
      assert.equal(
        lintSource(code, 'test.ts', undefined, { parameterChecks: { [method]: check } }).diagnostics.length,
        2,
      );
    }
  });
}

test('translation parameter checks support booleans, enabled, and message/translation skip predicates', async (t) => {
  const f = await fixture(t, `t.text('Hello {name}', { name: 'A' }); t.text('Bye {name}', { name: 'A' });`);
  await writeFile(
    path.join(f.catalogs, 'fr/manual.jsonl'),
    [
      ['Hello {name}', 'Bonjour {other}'],
      ['Bye {name}', 'Au revoir {other}'],
    ].map((row) => JSON.stringify(row)).join('\n'),
  );
  const run = (parameterChecks) => lint({ ...f.config, lint: { parameterChecks } });
  for (
    const option of [undefined, true, {}, { translation: true }, { translation: {} }, {
      translation: { enabled: true },
    }]
  ) {
    assert.equal((await run(option)).errors, 2);
  }
  for (
    const option of [false, { translation: false }, {
      translation: {
        enabled: false,
        skip: () => {
          throw new Error('must not run');
        },
      },
    }]
  ) {
    const result = await run(option);
    assert.equal(result.errors, 0);
    assert.deepEqual(result.coverage.fr, { translated: 2, total: 2 });
  }
  const calls = [];
  const result = await run({
    translation: {
      skip: (args) => {
        calls.push(args);
        return args.translation.startsWith('Bonjour');
      },
    },
  });
  assert.deepEqual(calls, [
    { message: 'Hello {name}', translation: 'Bonjour {other}' },
    { message: 'Bye {name}', translation: 'Au revoir {other}' },
  ]);
  assert.equal(result.errors, 1);
  assert.match(result.diagnostics[0].message, /Bye/);
});

test('disabled or skipped translation parameters never suppress invalid ICU or source parameter checks', async (t) => {
  const f = await fixture(t, `t.jsx('Hello {name}');`);
  await writeFile(path.join(f.catalogs, 'fr/manual.jsonl'), JSON.stringify(['Hello {name}', '{invalid']));
  for (const translation of [false, { enabled: false }, { skip: () => true }]) {
    const result = await lint({ ...f.config, lint: { parameterChecks: { translation } } });
    assert.deepEqual(result.diagnostics.map((d) => d.code), ['missing-param', 'invalid-icu']);
  }
  assert.deepEqual((await lint({ ...f.config, lint: { parameterChecks: false } })).diagnostics.map((d) => d.code), [
    'invalid-icu',
  ]);
  const result = lintSource(`import {t} from '@fluentic/i18n'; t.text('{invalid');`, 'test.ts', undefined, {
    parameterChecks: { text: { skip: () => true } },
  });
  assert.equal(result.diagnostics[0].code, 'invalid-icu');
});

test('parameter skip errors and invalid results are reported without aborting other messages', async (t) => {
  const f = await fixture(t, `t.text('Hello {name}');`);
  await writeFile(path.join(f.catalogs, 'fr/manual.jsonl'), JSON.stringify(['Hello {name}', 'Bonjour {other}']));
  for (
    const skip of [
      () => {
        throw new Error('predicate failed');
      },
      () => 'yes',
      async () => true,
      async () => {
        throw new Error('async predicate');
      },
    ]
  ) {
    const result = await lint({ ...f.config, lint: { parameterChecks: { text: { skip }, translation: { skip } } } });
    assert.deepEqual(result.diagnostics.map((d) => d.code), ['parameter-check-error', 'parameter-check-error']);
  }
});

test('nested parameter options validate callback shapes and reject top-level enabled/skip', () => {
  const config = { languages: { source: 'en', targets: [] } };
  for (
    const parameterChecks of [
      { enabled: false },
      { skip: () => true },
      { translation: null },
      { text: { enabled: 'false' } },
      { jsx: { skip: true } },
      { msg: { ignore: () => true } },
      { translation: { unknown: true } },
    ]
  ) assert.throws(() => validateConfig({ ...config, lint: { parameterChecks } }), /lint.parameterChecks/);
  validateConfig({
    ...config,
    lint: {
      parameterChecks: {
        msg: { skip: ({ message }) => message === 'x' },
        jsx: { enabled: false },
        text: true,
        translation: { skip: ({ message, translation }) => message === translation },
      },
    },
  });
});

for (const method of ['msg', 'jsx', 'text']) {
  test(`${method} skip accepts matching rules, wrapped callbacks, and mixed arrays`, () => {
    const code =
      `import {t} from '@fluentic/i18n'; t.${method}('Hello {name}'); t.${method}('HELLO {name}'); t.${method}('Bye {name}');`;
    const run = (skip) =>
      lintSource(code, 'test.ts', undefined, { parameterChecks: { [method]: { skip } } }).diagnostics;
    assert.equal(run({ match: 'exact', terms: 'Hello {name}' }).length, 2);
    assert.equal(run({ match: 'exact', terms: 'Hello' }).length, 3);
    assert.equal(run({ match: 'contains', terms: ['hello'], caseSensitive: false }).length, 1);
    assert.equal(run({ check: ({ message }) => message.startsWith('Bye') }).length, 2);
    assert.equal(run([]).length, 3);
    assert.deepEqual(
      run([
        { match: 'exact', terms: 'Hello {name}' },
        { match: 'contains', terms: ['HELLO'] },
        ({ message }) => message.startsWith('Bye'),
        {
          check: () => {
            throw new Error('short-circuited');
          },
        },
      ]),
      [],
    );
    assert.equal(run([{ match: 'contains', terms: 'unknown' }, { check: () => false }]).length, 3);
  });
}

test('translation skip matches source strings and passes both strings to wrapped callbacks', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.catalogs, 'fr/manual.jsonl'), JSON.stringify(['Hello {name}', 'Bonjour {other}']));
  const run = (skip) => lint({ ...f.config, lint: { parameterChecks: { translation: { skip } } } });
  assert.equal((await run({ match: 'contains', terms: 'Hello' })).errors, 0);
  assert.equal((await run({ match: 'contains', terms: 'Bonjour' })).errors, 1);
  assert.equal((await run({ match: 'exact', terms: ['HELLO {NAME}'], caseSensitive: false })).errors, 0);
  const calls = [];
  const result = await run([
    { match: 'exact', terms: 'No match' },
    {
      check: (args) => {
        calls.push(args);
        return args.translation.includes('{other}');
      },
    },
  ]);
  assert.deepEqual(calls, [{ message: 'Hello {name}', translation: 'Bonjour {other}' }]);
  assert.equal(result.errors, 0);
  assert.equal((await run({ check: () => 'yes' })).diagnostics[0].code, 'parameter-check-error');
});

test('skip rule validation rejects ambiguous shapes and forbidden-message-only fields', () => {
  const config = { languages: { source: 'en', targets: [] } };
  for (
    const skip of [
      'Hello',
      null,
      {},
      [[]],
      { match: 'word', terms: 'x' },
      { match: 'exact', terms: [] },
      { match: 'contains', terms: [null] },
      { match: 'exact', terms: 'x', caseSensitive: 'false' },
      { check: true },
      { check: () => true, match: 'exact', terms: 'x' },
      { match: 'exact', terms: 'x', id: 'rule' },
      { match: 'exact', terms: 'x', severity: 'warning' },
      { match: 'exact', terms: 'x', message: 'diagnostic' },
    ]
  ) {
    assert.throws(
      () => validateConfig({ ...config, lint: { parameterChecks: { text: { skip } } } }),
      /lint.parameterChecks.text.skip/,
    );
  }
  validateConfig({
    ...config,
    lint: {
      parameterChecks: {
        text: {
          skip: [
            { match: 'exact', terms: 'x' },
            ({ message }) => message === 'y',
            { check: () => true },
          ],
        },
      },
    },
  });
});

test('lint separates the heading and diagnostic summary without duplicate blank lines', async (t) => {
  const f = await fixture(t, `t.msg('Hello {name}'); t.jsx('Hello {name}');`);
  for (const verbose of [false, true]) {
    const lines = [];
    const report = createConsoleReporter((line) => lines.push(line), (line) => lines.push(line), {
      color: false,
      verbose,
    });
    const result = await lint(f.config, report);
    assert.equal(result.errors, 1);
    assert.equal(result.warnings, 1);
    assert.equal(lines[0], 'RUN  lint');
    assert.equal(lines[1], '');
    assert.notEqual(lines[2], '');
    const summaryIndex = lines.findIndex((line) => line.includes('Files:'));
    assert.equal(lines[summaryIndex - 1], '');
    assert.notEqual(lines[summaryIndex - 2], '');
    assert.match(
      lines.slice(summaryIndex).join('\n'),
      /Messages:.*1[\s\S]*fr:.*0\/1 translated[\s\S]*Result:.*1 errors · 1 warnings/,
    );
  }
});

test('t.msg schemas require descriptors and are not runtime values', () => {
  assert.deepEqual(scan(`t.msg('Revenue, by {basis}', { basis: t.msg });`).diagnostics, []);
  assert.deepEqual(scan(`t.msg('{count, number}', { count: t.msg });`).diagnostics.map((d) => d.code), ['schema-type']);
  assert.deepEqual(scan(`t.text('{basis}', { basis: t.msg });`).diagnostics.map((d) => d.code), ['schema-as-value']);
});

test('CLI lint and extraction support descriptor schemas, bindings, and direct nested values', async (t) => {
  const source = `
    const template = t.msg('Revenue, by {basis}', { basis: t.msg });
    const basis = t.msg('stay night');
    const label = t.msg(template, { basis });
    t.jsx(label);
    t.text(label);
    t.jsx('Selected: {basis}', { basis: t.msg('arrival') });
    t.jsx(() => <span title={t.text(label)} />);
  `;
  const scanResult = scan(source);
  assert.deepEqual(scanResult.diagnostics, []);
  assert.deepEqual(scanResult.messages.map(({ source }) => source), [
    'Revenue, by {basis}',
    'stay night',
    'Selected: {basis}',
    'arrival',
  ]);
  const f = await fixture(t, source);
  assert.deepEqual((await lint(f.config)).diagnostics, []);
  const configFile = path.join(f.root, 'i18n.config.mjs');
  const module = new URL('../packages/cli/dist/index.mjs', import.meta.url).href;
  await writeFile(
    configFile,
    `import { defineConfig } from ${JSON.stringify(module)}; export default defineConfig(${JSON.stringify(f.config)});`,
  );

  const bin = fileURLToPath(new URL('../packages/cli/dist/bin.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [bin, '-c', configFile, 'lint', '--strict'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /0 errors · 0 warnings/);
});
