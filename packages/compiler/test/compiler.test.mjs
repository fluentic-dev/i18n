import { parseSync, transformFromAstSync, transformSync } from '@babel/core';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createI18nManager,
  defaultRuntime,
  I18nManager,
  I18nRegistry,
  setRuntimeResolver,
  validateCompact,
} from '../../i18n/dist/adapter.js';
import { t } from '../../i18n/dist/compiled.js';
import { getSnapshot, hydrate } from '../../i18n/dist/hydration.js';
import { t as dynamic } from '../../i18n/dist/index.js';
import babel from '../dist/babel.mjs';
import esbuild from '../dist/esbuild.mjs';
import { collectMessages, compileCatalog, compileMessage, messageId, transform } from '../dist/index.mjs';
import withFluentic from '../dist/nextjs.mjs';
import rollup from '../dist/rollup.mjs';
import vite from '../dist/vite.mjs';
import webpackLoader from '../dist/webpack-loader.mjs';
import FluenticI18nPlugin from '../dist/webpack.mjs';
const source = `import { t as tr } from '@fluentic/i18n';
const account = tr.context('account');
const actions = account.context('actions');
const message = actions.msg('Hello {name}', {name: String});
export function render() { return actions.text(message, {name: 'Ada'}); }
function unrelated(tr) { return tr.text('leave alone'); }
`;
test('same-file aliases compile and extract with lexical binding provenance', () => {
  const records = collectMessages(source, 'fixture.ts');
  assert.equal(records.length, 1);
  assert.equal(records[0].context, 'account.actions');
  const result = transform(source, { filename: 'fixture.ts' });
  assert.match(result.code, /i18n\/compiled/);
  assert.ok(result.code.includes(messageId('account.actions', 'Hello {name}')));
  assert.doesNotMatch(result.code, /\.context\(/);
  assert.match(result.code, /tr.text\('leave alone'\)/);
  assert.deepEqual(result.map.sourcesContent, [source]);
  assert.equal(transform(result.code, { filename: 'fixture.ts' }), null);
});
test('namespace imports, static constants and TS wrappers compile', () => {
  const code =
    `import * as i from '@fluentic/i18n'; const c = (i.t.context('x') as typeof i.t); const S = 'Save'; export const message = c.msg(S);`;
  assert.equal(collectMessages(code, 'f.ts')[0].context, 'x');
  assert.doesNotMatch(transform(code, { filename: 'f.ts' }).code, /\.context\(/);
});
test('source line wrapping is normalized while explicit breaks remain semantic', () => {
  const code = `import {t} from '@fluentic/i18n'; t.text(\`\n  First line\n  second line{break}\n  third line\n\`);`;
  const message = 'First line second line{break} third line';
  assert.equal(collectMessages(code, 'f.ts')[0].source, message);
  assert.ok(transform(code, { filename: 'f.ts' }).code.includes(messageId(null, message)));
  assert.equal(compileMessage('First\n  second'), 'First second');
});

test('Next client text calls bind to the hydration provider without source hooks', () => {
  const code = `'use client';
import {t} from '@fluentic/i18n';
const label=t.msg('Search');
export default function Search(){return <input aria-label={t.text(label)}/>}`;
  const result = transform(code, { filename: 'Search.tsx', bindReactText: true });

  assert.match(result.code, /useI18nRenderer/);
  assert.match(result.code, /const _text = _useI18nRenderer\(_tc\.text\)/);
  assert.match(result.code, /aria-label=\{_text\(label\)\}/);
});
test('t.jsx callbacks remain reactive wrappers while nested text calls compile and extract', () => {
  const code = `'use client'; import {t} from '@fluentic/i18n';
const renderInput = () => <input placeholder={t.text('Something')}/>;
export function Field(){return t.jsx(renderInput)}`;
  const records = collectMessages(code, 'Field.tsx');
  const result = transform(code, { filename: 'Field.tsx', bindReactText: true });

  assert.deepEqual(records.map((record) => record.source), ['Something']);
  assert.match(result.code, /t\.jsx\(renderInput\)/);
  assert.ok(result.code.includes(messageId(null, 'Something')));
  assert.doesNotMatch(result.code, /useI18nRenderer/);
});
test('unrelated imports are not confused with t and unsafe scopes fail', () => {
  assert.equal(collectMessages(`import { unrelated as t } from '@fluentic/i18n'; t.text('No');`, 'f.js').length, 0);
  assert.throws(
    () => transform(`import {t} from '@fluentic/i18n'; let c=t.context('x'); c=other; c.text('Hi')`),
    /reassigned/,
  );
  assert.throws(
    () => transform(`import {t} from '@fluentic/i18n'; const c=t.context('x'); consume(c); c.text('Hi')`),
    /escapes/,
  );
  assert.throws(
    () => transform(`import {t} from '@fluentic/i18n'; t.context(window.location.href).text('Hi')`),
    /static string/,
  );
});
test('Babel adapter uses the same compilation and preserves directives', () => {
  const result = transformSync(`'use client';\n${source}`, {
    filename: 'f.ts',
    plugins: [babel],
    configFile: false,
    babelrc: false,
    sourceMaps: true,
  });
  assert.match(result.code, /^'use client'/);
  assert.doesNotMatch(result.code, /\.context\(/);
  assert.ok(result.map);
});
test('compiled hash length is shared by compiler APIs and plugins', () => {
  const code = `import {t} from '@fluentic/i18n'; t.context('account').text('Hello')`;
  const id = messageId('account', 'Hello', 6);
  assert.equal(id.length, 6);
  assert.equal(messageId('account', 'Hello').length, 8);
  assert.ok(transform(code, { hashLength: 6 }).code.includes(id));
  assert.equal(
    compileCatalog([{ context: 'account', source: 'Hello', translation: 'Bonjour' }], {
      hashLength: 6,
    })[0][0],
    id,
  );
  const babelResult = transformSync(code, {
    plugins: [[babel, { hashLength: 6 }]],
    configFile: false,
    babelrc: false,
  });
  assert.ok(babelResult.code.includes(id));
  assert.throws(
    () => transformSync(code, { plugins: [[babel, { compiled: true }]], configFile: false, babelrc: false }),
    /compiler plugins always compile/,
  );
  assert.throws(() => messageId(null, 'Hello', 5), /hashLength/);
});
test('every build plugin uses the common explicit config and direct hash options', async () => {
  const code = `import {t} from '@fluentic/i18n'; t.text('Hello')`;
  const directId = messageId(null, 'Hello', 6);
  assert.ok(rollup({ hashLength: 6 }).transform(code, 'fixture.ts').code.includes(directId));
  assert.ok(vite({ hashLength: 6 }).transform.handler(code, 'fixture.ts').code.includes(directId));

  const directory = await mkdtemp(join(tmpdir(), 'fluentic-compiler-'));
  try {
    const sourceFile = join(directory, 'fixture.ts');
    const configFile = join(directory, 'custom.config.mjs');
    await writeFile(sourceFile, code);
    await writeFile(configFile, `export default {compiled: {hashLength: 7}};`);
    const configuredId = messageId(null, 'Hello', 7);
    assert.ok(rollup({ config: configFile }).transform(code, sourceFile).code.includes(configuredId));
    assert.ok(vite({ config: configFile }).transform.handler(code, sourceFile).code.includes(configuredId));
    assert.ok(rollup({ config: configFile, hashLength: 6 }).transform(code, sourceFile).code.includes(directId));
    const babelResult = transformSync(code, {
      plugins: [[babel, { config: configFile }]],
      configFile: false,
      babelrc: false,
    });
    assert.ok(babelResult.code.includes(configuredId));

    let onStart;
    let onLoad;
    esbuild({ config: configFile }).setup({
      initialOptions: { absWorkingDir: directory },
      onStart(callback) {
        onStart = callback;
      },
      onLoad(_filter, callback) {
        onLoad = callback;
      },
    });
    await onStart();
    assert.ok((await onLoad({ path: sourceFile })).contents.includes(configuredId));

    const webpackResult = await new Promise((resolve, reject) => {
      webpackLoader.call(
        {
          cacheable() {},
          getOptions: () => ({ config: configFile }),
          rootContext: directory,
          resourcePath: sourceFile,
          addDependency: (file) => assert.equal(file, configFile),
          callback(error, result) {
            if (error) reject(error);
            else resolve(result);
          },
        },
        code,
        null,
      );
    });
    assert.ok(webpackResult.includes(configuredId));

    const nextWithConfig = withFluentic({ requestConfig: './i18n/request.ts', config: configFile })({});
    assert.equal(nextWithConfig.turbopack.rules['*.ts'][0].loaders[0].options.config, configFile);
    assert.equal(nextWithConfig.webpack({}, {}).plugins[0].options.config, configFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const compiler = { options: { module: { rules: [] } } };
  new FluenticI18nPlugin({ hashLength: 6 }).apply(compiler);
  assert.equal(compiler.options.module.rules[0].use[0].options.hashLength, 6);

  const nextConfig = withFluentic({ requestConfig: './i18n/request.ts', hashLength: 6 })({});
  assert.equal(nextConfig.turbopack.rules['*.ts'][0].loaders[0].options.hashLength, 6);
  const webpackConfig = nextConfig.webpack({}, {});
  assert.equal(webpackConfig.plugins[0].options.hashLength, 6);
});
test('compact interpreter matches dynamic ICU for representative semantics', async () => {
  I18nManager.configure({ languageId: 'en' });
  I18nManager.setTranslationLoader(null);
  await I18nManager.init();
  const cases = [
    ['Hello {name}', { name: 'Ada' }],
    ["'{literal}' and ''", {}],
    ['{n, plural, offset:1 =0 {Nobody} =1 {Only you} one {You and # other} other {You and # others}}', { n: 3 }],
    ['{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', { n: 22 }],
    ['{choice, select, yes {{n, plural, one {# item} other {# items}}} other {None}}', { choice: 'yes', n: 4 }],
    ['{price, number, ::currency/USD precision-integer}', { price: 12.5 }],
    ['{date, date, short} {date, time, short}', { date: new Date('2026-01-02T03:04:00Z') }],
    ['{n, number, percent}', { n: 0.25 }],
    ['Hello <b>{name}</b>', { name: 'Ada', b: t.tag((parts) => parts.join('').toUpperCase()) }],
    ['{value}', { value: null }],
  ];
  for (const [message, params] of cases) {
    const compiled = [messageId(null, message), compileMessage(message)];
    validateCompact(compiled[1]);
    assert.equal(t.text(compiled, params), dynamic.text(message, params), message);
  }
  assert.throws(() => t.text('not compiled'), /requires compiled/);
});
test('compiled catalog lookup and source fallback keep descriptors inert', async () => {
  const descriptor = t.msg([messageId('ctx', 'Hello {name}'), compileMessage('Hello {name}')], { name: String });
  const rows = compileCatalog([{ source: 'Hello {name}', context: 'ctx', translation: 'Bonjour {name}' }]);
  I18nManager.configure({ languageId: 'fr' });
  I18nManager.setTranslationLoader(() => [{ compiled: true }, ...rows].map((row) => JSON.stringify(row)).join('\n'));
  await I18nManager.init();
  assert.equal(t.text(descriptor, { name: 'Ada' }), 'Bonjour Ada');
  assert.equal(t.notranslate(() => t.text(descriptor, { name: 'Ada' })), 'Hello Ada');
  assert.equal(t.text([messageId(null, 'Absent'), 'Absent']), 'Absent');
  assert.notEqual(messageId('x', 'Hi'), messageId('y', 'Hi'));
});
test('manager instances are isolated and only latest completed switch commits', async () => {
  const first = createI18nManager();
  const second = createI18nManager();
  first.manager.configure({ languageId: 'fr' });
  second.manager.configure({ languageId: 'de' });
  first.manager.setTranslationLoader(() => [{ id: 'Hello', translation: 'Bonjour' }]);
  second.manager.setTranslationLoader(() => [{ id: 'Hello', translation: 'Hallo' }]);
  await Promise.all([first.manager.init(), second.manager.init()]);
  try {
    setRuntimeResolver(() => first.runtime);
    assert.equal(dynamic.text('Hello'), 'Bonjour');
    setRuntimeResolver(() => second.runtime);
    assert.equal(dynamic.text('Hello'), 'Hallo');
  } finally {
    setRuntimeResolver(() => defaultRuntime);
  }
  let deliver;
  first.manager.setTranslationLoader(({ languageId }) => languageId === 'it' ? new Promise((r) => deliver = r) : []);
  const slow = first.manager.setLanguageId('it');
  await Promise.resolve();
  await first.manager.setLanguageId('es');
  deliver([]);
  await slow;
  assert.equal(first.manager.getLanguageId(), 'es');
});
test('invalid compact catalogs fail at load time', async () => {
  const managed = createI18nManager();
  managed.manager.setTranslationLoader(() => [['id', [[99]]]]);
  await assert.rejects(managed.manager.init(), /invalid compact opcode/);
});

test('escaped inline scopes fail and descriptors can cross files', () => {
  assert.throws(() => transform(`import {t} from '@fluentic/i18n'; consume(t.context('x'));`), /escapes/);
  assert.throws(() => transform(`import {t} from '@fluentic/i18n'; export const scope=t.context('x');`), /exported/);
  assert.ok(transform(`import {t} from '@fluentic/i18n'; export const message=t.context('x').msg('Hello');`));
});

test('Babel reparses original source when Metro supplies a host AST', () => {
  const code = `import {t} from '@fluentic/i18n'; const c=t.context('host'); export const message=c.msg('Hello');`;
  const ast = parseSync(code, { configFile: false, babelrc: false });
  const result = transformFromAstSync(ast, code, {
    filename: 'host.js',
    plugins: [babel],
    configFile: false,
    babelrc: false,
    sourceMaps: true,
  });
  assert.match(result.code, /i18n\/compiled/);
  assert.doesNotMatch(result.code, /\.context\(/);
});

test('TypeScript wrappers preserve scope escape checks and alias tracing', () => {
  assert.throws(
    () => transform(`import {t} from '@fluentic/i18n'; consume(t.context('x') as unknown);`, { filename: 'f.ts' }),
    /escapes/,
  );
  const result = transform(
    `import {t} from '@fluentic/i18n'; const c=t.context('x'); const alias=(c as typeof c); export const msg=alias.msg('Hello');`,
    { filename: 'f.ts' },
  );
  assert.doesNotMatch(result.code, /\.context\(/);
});

test('regular runtime renders compiled catalogs without the source plugin', async () => {
  const managed = createI18nManager();
  const rows = compileCatalog([
    { context: 'menu', source: 'Hello {name}', translation: 'Bonjour {name}' },
    { context: null, source: 'Literal', translation: "'{name}'" },
    { context: null, source: '你好 🌍', translation: 'Salut 🌍' },
  ]);
  managed.manager.configure({ languageId: 'fr-CA', fallbackLanguageId: 'en' });
  managed.manager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? [{ compiled: true }, ...rows] : []);
  await managed.manager.init();

  try {
    setRuntimeResolver(() => managed.runtime);
    assert.equal(dynamic.context('menu').text('Hello {name}', { name: 'Ada' }), 'Bonjour Ada');
    assert.equal(dynamic.text('Literal'), '{name}');
    assert.equal(dynamic.text('你好 🌍'), 'Salut 🌍');
    assert.equal(dynamic.text('Missing'), 'Missing');

    const restored = createI18nManager();
    hydrate(restored, JSON.parse(JSON.stringify(getSnapshot(managed))));
    setRuntimeResolver(() => restored.runtime);
    assert.equal(dynamic.context('menu').text('Hello {name}', { name: 'Ada' }), 'Bonjour Ada');
    assert.equal(dynamic.text('Literal'), '{name}');
  } finally {
    setRuntimeResolver(() => defaultRuntime);
  }
});

test('compiled runtime rejects uncompiled translations and accepts compiled literals', async () => {
  const managed = createI18nManager();
  const id = messageId(null, 'Hello');
  managed.manager.configure({ languageId: 'fr' });
  managed.manager.setTranslationLoader(() => [[id, 'Bonjour {name}']]);
  await managed.manager.init();

  try {
    setRuntimeResolver(() => managed.runtime);
    assert.throws(() => t.text([id, 'Hello']), /requires compiled translations/);

    managed.manager.setTranslationLoader(() => [{ compiled: true }, [id, 'Bonjour {name}']]);
    await managed.manager.init();
    assert.equal(t.text([id, 'Hello']), 'Bonjour {name}');
  } finally {
    setRuntimeResolver(() => defaultRuntime);
  }
});

test('adapters share package precedence and skip excluded source before parsing', async () => {
  const options = {
    include: '**/src/**',
    exclude: /node_modules/,
    includePackages: ['@acme/ui', 'blocked'],
    excludePackages: 'blocked',
  };
  const allowed = '/app/node_modules/@acme/ui/card.ts';
  const blocked = '/app/node_modules/blocked/card.ts';
  for (const adapter of [rollup(options), vite(options)]) {
    const run = typeof adapter.transform === 'function' ? adapter.transform : adapter.transform.handler;
    assert.match(run(source, allowed + '#fragment').code, /i18n\/compiled/);
    assert.equal(run('invalid javascript !!!', blocked), null);
    assert.equal(run('invalid javascript !!!', '/app/other.ts'), null);
  }
  const runLoader = (filename, code, inputMap = null) => {
    let output;
    webpackLoader.call(
      {
        getOptions: () => options,
        resourcePath: filename,
        callback(error, code, map) {
          assert.equal(error, null);
          output = { code, map };
        },
      },
      code,
      inputMap,
    );
    return output;
  };
  assert.match(runLoader(allowed, source).code, /i18n\/compiled/);
  const map = { version: 3, sources: [], names: [], mappings: '' };
  assert.deepEqual(runLoader(blocked, 'invalid javascript !!!', map), { code: 'invalid javascript !!!', map });
  const compiler = { options: { module: { rules: [] } } };
  new FluenticI18nPlugin(options).apply(compiler);
  const rule = compiler.options.module.rules[0];
  assert.equal(rule.test(allowed), true);
  assert.equal(rule.test(blocked), false);
  assert.equal(rule.test('/app/image.png'), false);
  for (const filename of [allowed, blocked]) {
    const result = transformSync(source, { filename, plugins: [[babel, options]], configFile: false, babelrc: false });
    assert.equal(result.code.includes('i18n/compiled'), filename === allowed);
  }
  let onLoad;
  esbuild(options).setup({
    initialOptions: {},
    onStart() {},
    onLoad(_options, callback) {
      onLoad = callback;
    },
  });
  assert.equal(await onLoad({ path: blocked }), undefined); // Must skip before trying to read the nonexistent file.
  const next = withFluentic({ requestConfig: './request.ts', ...options })({});
  assert.deepEqual(next.turbopack.rules['*.ts'][0].loaders[0].options.includePackages, options.includePackages);
  assert.equal(next.turbopack.rules['*.ts'][0].condition, undefined);
  assert.deepEqual(next.webpack({}, {}).plugins[0].options.excludePackages, 'blocked');
});

test('config filters reload without stale Vite native exclusions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fluentic-filter-'));
  try {
    const config = join(directory, 'filter.mjs');
    const filename = join(directory, 'node_modules/shared/card.ts');
    await writeFile(config, 'export default { excludePackages: "shared" };');
    const adapters = [rollup({ config }), vite({ config })];
    assert.deepEqual(adapters[1].transform.filter, { id: {} });
    for (const adapter of adapters) {
      const run = typeof adapter.transform === 'function' ? adapter.transform : adapter.transform.handler;
      assert.equal(run('invalid !!!', filename), null);
    }
    await writeFile(config, 'export default { includePackages: "shared" };');
    for (const adapter of adapters) {
      adapter.watchChange(config);
      const run = typeof adapter.transform === 'function' ? adapter.transform : adapter.transform.handler;
      assert.match(run(source, filename).code, /i18n\/compiled/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
