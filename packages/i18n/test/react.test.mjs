import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { t } from '../dist/index.js';
import { I18nManager, I18nState } from '../dist/react.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function record(source, translation) {
  return { id: source, translation };
}

async function reset(loader) {
  I18nManager.setStorage(null);
  I18nManager.configure({ languageId: 'en' });
  I18nManager.setTranslationLoader(loader);
  await I18nManager.init();
}

test('inline JSX and shared descriptors update without rerendering their parent', async () => {
  const greeting = t.msg('Hello, {name}', { name: String });
  let parentRenders = 0;
  await reset(({ languageId }) =>
    languageId === 'fr'
      ? [record('Hello, {name}', 'Bonjour, {name}'), record('Save', 'Enregistrer')]
      : []
  );

  function Screen() {
    parentRenders++;
    return React.createElement(
      'main',
      null,
      t.jsx('Save'),
      t.jsx(greeting, { name: 'Ada' }),
      t.context('button').note('Save action').jsx('Save'),
    );
  }

  let root;
  await act(async () => {
    root = create(React.createElement(Screen));
  });
  assert.deepEqual(root.toJSON().children, ['Save', 'Hello, Ada', 'Save']);
  await act(async () => {
    await I18nManager.setLanguageId('fr');
  });
  assert.deepEqual(root.toJSON().children, ['Enregistrer', 'Bonjour, Ada', 'Enregistrer']);
  assert.equal(parentRenders, 1);
  await act(async () => {
    await I18nManager.setLanguageId('en');
  });
  assert.deepEqual(root.toJSON().children, ['Save', 'Hello, Ada', 'Save']);
  await act(async () => {
    root.unmount();
  });
});

test('JSX updates after an asynchronous catalog arrives and preserves rich handlers and callbacks', async () => {
  let deliver;
  await reset(({ languageId }) =>
    languageId === 'fr'
      ? new Promise((resolve) => {
        deliver = resolve;
      })
      : []
  );
  const source = 'Hello <b>{name}</b>';
  const message = t.msg(source, { name: String });
  const element = t.jsx(message, {
    name: ({ languageId }) => languageId === 'fr' ? 'Amélie' : 'Ada',
    b: t.tag((chunks) => React.createElement('strong', null, ...chunks)),
  });
  let root;
  await act(async () => {
    root = create(element);
  });
  assert.deepEqual(root.toJSON(), ['Hello ', { type: 'strong', props: {}, children: ['Ada'] }]);
  let switching;
  await act(async () => {
    switching = I18nManager.setLanguageId('fr');
  });
  assert.equal(I18nState.get().isLoading, true);
  assert.deepEqual(root.toJSON(), ['Hello ', { type: 'strong', props: {}, children: ['Ada'] }]);
  await act(async () => {
    deliver([record(source, 'Bonjour <b>{name}</b>')]);
    await switching;
  });
  assert.equal(I18nState.get().isLoading, false);
  assert.deepEqual(root.toJSON(), ['Bonjour ', { type: 'strong', props: {}, children: ['Amélie'] }]);
  await act(async () => {
    root.unmount();
  });
});

test('text attributes and try values update through an explicit state subscription', async () => {
  await reset(({ languageId }) => languageId === 'fr' ? [record('Search', 'Rechercher')] : []);
  const search = t.msg('Search');
  const earlierString = t.text(search);
  function Search() {
    I18nState.use();
    return React.createElement('input', {
      placeholder: t.text(search),
      'aria-label': t.try(t.text, search),
      title: t.try(t.text, 'Server text'),
    });
  }
  let root;
  await act(async () => {
    root = create(React.createElement(Search));
  });
  assert.equal(root.toJSON().props.placeholder, 'Search');
  await act(async () => {
    await I18nManager.setLanguageId('fr');
  });
  assert.equal(earlierString, 'Search');
  assert.equal(t.text(search), 'Rechercher');
  assert.deepEqual(root.toJSON().props, {
    placeholder: 'Rechercher',
    'aria-label': 'Rechercher',
    title: 'Server text',
  });
  assert.throws(() => t.try(t.text, t.msg('Hello, {name}', { name: String })), /name/);
  assert.equal(t.try(t.text, 'Already plain'), 'Already plain');
  await act(async () => {
    root.unmount();
  });
});

test('message schemas validate required runtime values', async () => {
  await reset(() => []);
  const count = t.msg('Count: {count}', { count: Number });
  const date = t.msg('Date: {date, date, short}', { date: Date });

  assert.equal(t.text(count, { count: 3 }), 'Count: 3');
  assert.doesNotThrow(() => t.text(date, { date: new Date('2026-01-02T00:00:00Z') }));
  assert.throws(() => t.text(count), /Missing required message parameter: count/);
  assert.throws(() => t.text(count, { count: '3' }), /must be a Number/);
  assert.throws(() => t.text(date, { date: '2026-01-02' }), /must be a Date/);
  assert.throws(() => t.text(count, { count: Number }), /schemas are only valid in t.msg/);
});

test('element tag shorthand preserves props and renders translated children', async () => {
  const source = 'Hello <strong>{name}</strong>';
  await reset(({ languageId }) =>
    languageId === 'fr'
      ? [record(source, '<strong>{name}</strong>, bonjour')]
      : []
  );
  const template = React.createElement('strong', { className: 'name' }, 'placeholder');
  let root;
  await act(async () => {
    root = create(t.jsx(source, { name: 'Ada', strong: t.tag(template) }));
  });
  assert.deepEqual(root.toJSON(), ['Hello ', { type: 'strong', props: { className: 'name' }, children: ['Ada'] }]);
  await act(async () => {
    await I18nManager.setLanguageId('fr');
  });
  assert.deepEqual(root.toJSON(), [{ type: 'strong', props: { className: 'name' }, children: ['Ada'] }, ', bonjour']);
  assert.equal(template.props.children, 'placeholder');
  await act(async () => {
    root.unmount();
  });
});

test('isolated providers preserve language during SSR and snapshot replacement', async () => {
  const { I18nProvider, useI18nRenderer } = await import('../dist/react.js');
  const { createI18nManager } = await import('../dist/adapter.js');
  const first = createI18nManager();
  first.manager.configure({ languageId: 'fr' });
  first.manager.setTranslationLoader(() => [record('Search', 'Rechercher')]);
  await first.manager.init();
  const second = createI18nManager();
  second.manager.configure({ languageId: 'de' });
  second.manager.setTranslationLoader(() => [record('Search', 'Suchen')]);
  await second.manager.init();
  const descriptor = t.msg('Search');
  function Input() {
    const text = useI18nRenderer(t.text);
    return React.createElement('input', { title: text(descriptor) });
  }
  let root;
  await act(async () => {
    root = create(
      React.createElement(I18nProvider, { snapshot: first.manager.getSnapshot() }, React.createElement(Input)),
    );
  });
  assert.equal(root.toJSON().props.title, 'Rechercher');
  await act(async () => {
    root.update(
      React.createElement(I18nProvider, { snapshot: second.manager.getSnapshot() }, React.createElement(Input)),
    );
  });
  assert.equal(root.toJSON().props.title, 'Suchen');
  await act(async () => root.unmount());
});

test('{break} renders as text newline, web br, and native newline for both runtimes', async () => {
  const { createI18nManager, defaultRuntime, setRuntimeResolver } = await import('../dist/adapter.js');
  const { installReactAdapter } = await import('../dist/react.js');
  const { t: compiled } = await import('../dist/compiled.js');
  const { compileMessage, messageId } = await import('../dist/compiler.js');
  const source = 'First{break}Second';
  const payload = [messageId(null, source), compileMessage(source)];
  const web = createI18nManager();
  const native = createI18nManager();
  installReactAdapter(web.runtime);
  installReactAdapter(native.runtime, '\n');
  await Promise.all([web.manager.init(), native.manager.init()]);

  try {
    for (
      const [runtime, expected] of [
        [web.runtime, ['First', { type: 'br', props: {}, children: null }, 'Second']],
        [native.runtime, 'First\nSecond'],
      ]
    ) {
      setRuntimeResolver(() => runtime);
      assert.equal(t.text(source), 'First\nSecond');
      assert.equal(compiled.text(payload), 'First\nSecond');

      for (const element of [t.jsx(source), compiled.jsx(payload)]) {
        let root;
        await act(async () => {
          root = create(element);
        });
        assert.deepEqual(root.toJSON(), expected);
        await act(async () => {
          root.unmount();
        });
      }
    }
  } finally {
    setRuntimeResolver(() => defaultRuntime);
  }
});
