import { parseSync, transformFromAstSync, transformSync } from '@babel/core';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createI18nManager,
  defaultRuntime,
  I18nManager,
  I18nRegistry,
  setRuntimeResolver,
  validateCompact,
} from '../dist/adapter.js';
import { t } from '../dist/compiled.js';
import { collectMessages, compileCatalog, compileMessage, messageId, transform } from '../dist/compiler.js';
import { t as dynamic } from '../dist/index.js';
import babel from '../dist/plugin/babel.js';
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
    plugins: [[babel, { compiled: true }]],
    configFile: false,
    babelrc: false,
    sourceMaps: true,
  });
  assert.match(result.code, /^'use client'/);
  assert.doesNotMatch(result.code, /\.context\(/);
  assert.ok(result.map);
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
    plugins: [[babel, { compiled: true }]],
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
    restored.manager.hydrate(JSON.parse(JSON.stringify(managed.manager.getSnapshot())));
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
