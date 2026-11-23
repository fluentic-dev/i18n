import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { isMessageDescriptor, t } from '../dist/index.js';
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

test('t.jsx callback reruns translated text attributes without rerendering its parent', async () => {
  await reset(({ languageId }) => languageId === 'fr' ? [record('Something', 'Quelque chose')] : []);
  let parentRenders = 0;
  let callbackRenders = 0;

  function Form() {
    parentRenders++;
    return t.jsx(() => {
      callbackRenders++;
      return React.createElement('input', { placeholder: t.text('Something') });
    });
  }

  let root;
  await act(async () => {
    root = create(React.createElement(Form));
  });
  assert.equal(root.toJSON().props.placeholder, 'Something');
  assert.equal(parentRenders, 1);
  assert.equal(callbackRenders, 1);

  await act(async () => {
    await I18nManager.setLanguageId('fr');
  });
  assert.equal(root.toJSON().props.placeholder, 'Quelque chose');
  assert.equal(parentRenders, 1);
  assert.equal(callbackRenders, 2);

  await act(async () => root.unmount());
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
  const { getSnapshot, hydrate } = await import('../dist/hydration.js');
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
  const hydratedFirst = createI18nManager();
  hydrate(hydratedFirst, getSnapshot(first));
  await act(async () => {
    root = create(
      React.createElement(I18nProvider, { instance: hydratedFirst }, React.createElement(Input)),
    );
  });
  assert.equal(root.toJSON().props.title, 'Rechercher');
  const hydratedSecond = createI18nManager();
  hydrate(hydratedSecond, getSnapshot(second));
  await act(async () => {
    root.update(
      React.createElement(I18nProvider, { instance: hydratedSecond }, React.createElement(Input)),
    );
  });
  assert.equal(root.toJSON().props.title, 'Suchen');
  await act(async () => root.unmount());
});

test('{break} renders as text newline, web br, and native newline for both runtimes', async () => {
  const { createI18nManager, defaultRuntime, setRuntimeResolver } = await import('../dist/adapter.js');
  const { installReactAdapter } = await import('../dist/react.js');
  const { t: compiled } = await import('../dist/compiled.js');
  const source = 'First{break}Second';
  const payload = ['break-test', ['First', [0, 'break'], 'Second']];
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

test('source and translation line wrapping render as spaces', async () => {
  await reset(() => [record('First second', 'Premier\n  deuxième')]);
  assert.equal(t.text(`\n    First\n    second\n  `), 'Premier deuxième');
  assert.equal(t.text('First\nsecond{break}third'), 'First second\nthird');
});

test('Message schema fields resolve nested descriptors and factories in both runtimes', async () => {
  const { t: compiled } = await import('../dist/compiled.js');
  for (
    const [api, outer, inner] of [
      [t, t.msg('Revenue, by {basis}', { basis: t.msg }), t.msg('Stay night')],
      [
        compiled,
        compiled.msg(['revenue', ['Revenue, by ', [0, 'basis']]], { basis: t.msg }),
        compiled.msg(['basis', 'Stay night']),
      ],
    ]
  ) {
    await reset(({ languageId }) =>
      languageId === 'fr'
        ? api === compiled
          ? [{ compiled: true }, ['basis', 'Nuit']]
          : [record('Stay night', 'Nuit')]
        : []
    );
    let root;
    await act(async () => {
      root = create(
        React.createElement('div', null, api.jsx(outer, { basis: inner }), api.jsx(outer, { basis: () => inner })),
      );
    });
    assert.equal(api.text(outer, { basis: inner }), 'Revenue, by Stay night');
    assert.deepEqual(root.toJSON().children, ['Revenue, by Stay night', 'Revenue, by Stay night']);
    await act(async () => {
      await I18nManager.setLanguageId('fr');
    });
    assert.equal(api.text(outer, { basis: () => inner }), 'Revenue, by Nuit');
    assert.deepEqual(root.toJSON().children, ['Revenue, by Nuit', 'Revenue, by Nuit']);
    await act(async () => root.unmount());
  }
});

test('bound descriptors defer values, preserve identity, and react to language changes', async () => {
  const { t: compiled } = await import('../dist/compiled.js');
  for (const api of [t, compiled]) {
    const original = api === t
      ? t.context('metrics').note('Revenue metric').meta({ screen: 'report' }).msg('Revenue, by {basis}', {
        basis: t.msg,
      })
      : compiled.msg(['revenue', ['Revenue, by ', [0, 'basis']]], { basis: t.msg });
    const nestedTemplate = api === t
      ? t.msg('Stay {unit}', { unit: String })
      : compiled.msg(['stay', ['Stay ', [0, 'unit']]], { unit: String });
    let calls = 0;
    const nested = api.msg(nestedTemplate, {
      unit: ({ languageId }) => {
        calls++;
        return languageId === 'fr' ? 'nuit' : 'night';
      },
    });
    const params = { basis: nested };
    const bound = api.msg(original, params);
    params.basis = 'mutated';
    assert.equal(calls, 0);
    assert.notEqual(bound, original);
    assert.deepEqual(Object.keys(bound), []);
    assert.equal(isMessageDescriptor(bound), true);
    assert.equal(isMessageDescriptor({ __fluenticMessage: true }), false);
    assert.ok(Object.isFrozen(bound));
    await reset(({ languageId }) =>
      languageId === 'fr'
        ? api === compiled
          ? [{ compiled: true }, ['revenue', ['Revenu, par ', [0, 'basis']]], ['stay', ['Séjour ', [0, 'unit']]]]
          : [
            { id: 'metrics\0Revenue, by {basis}', translation: 'Revenu, par {basis}' },
            record('Stay {unit}', 'Séjour {unit}'),
          ]
        : []
    );
    assert.equal(api.text(bound), 'Revenue, by Stay night');
    assert.equal(api.text(api.clone(bound)), 'Revenue, by Stay night');
    assert.equal(api.try(api.text, bound), 'Revenue, by Stay night');
    assert.equal(
      api.text(bound, { basis: api === t ? t.msg('arrival') : compiled.msg(['arrival', 'arrival']) }),
      'Revenue, by arrival',
    );
    const rebound = api.msg(bound, {
      basis: api === t ? t.msg('departure') : compiled.msg(['departure', 'departure']),
    });
    assert.equal(api.text(rebound), 'Revenue, by departure');
    assert.equal(api.text(bound), 'Revenue, by Stay night');
    assert.throws(() => api.text(api.msg(original, {})), /Missing required message parameter/);
    assert.throws(() => api.text(api.msg(original, { basis: 42 })), /must be a MessageDescriptor/);
    let root;
    await act(async () => {
      root = create(api.jsx(bound));
    });
    assert.equal(root.toJSON(), 'Revenue, by Stay night');
    await act(async () => {
      await I18nManager.setLanguageId('fr');
    });
    assert.equal(root.toJSON(), 'Revenu, par Séjour nuit');
    await act(async () => root.unmount());
  }
});

test('String and t.msg schema fields validate distinct runtime values', async () => {
  const { t: compiled } = await import('../dist/compiled.js');
  await reset(() => []);
  for (const api of [t, compiled]) {
    const payload = api === t ? '{value}' : ['value', [[0, 'value']]];
    const external = api.msg(payload, { value: String });
    const translated = api.msg(payload, { value: api.msg });
    const nested = api.msg(api === t ? 'Stay night' : ['night', 'Stay night']);
    assert.equal(api.text(external, { value: 'External' }), 'External');
    assert.equal(api.text(external, { value: () => 'External' }), 'External');
    assert.equal(api.text(translated, { value: nested }), 'Stay night');
    assert.equal(api.text(translated, { value: () => nested }), 'Stay night');
    for (const value of [nested, () => nested]) {
      assert.throws(() => api.text(external, { value }), /must be a String/);
    }
    for (const value of ['External', () => 'External', 42, {}, null]) {
      assert.throws(() => api.text(translated, { value }), /must be a MessageDescriptor/);
    }
    assert.throws(() => api.text(translated, { value: api.msg }), /schemas are only valid in t.msg/);
    assert.throws(() => api.text(translated), /Missing required message parameter/);
  }
});

test('descriptors snapshot schemas while params preserves supplied objects', async () => {
  const { t: compiled } = await import('../dist/compiled.js');
  await reset(() => []);
  for (const api of [t, compiled]) {
    const schema = { name: String };
    const descriptor = api.msg(api === t ? 'Hello {name}' : ['hello', ['Hello ', [0, 'name']]], schema);
    const bound = api.msg(descriptor, { name: 'Ada' });
    schema.name = Number;
    schema.extra = Boolean;
    assert.equal(api.text(descriptor, { name: 'Grace' }), 'Hello Grace');
    assert.equal(api.text(bound), 'Hello Ada');
    assert.equal(api.text(api.clone(descriptor), { name: 'Grace' }), 'Hello Grace');
    assert.throws(() => api.text(descriptor, { name: 42 }), /must be a String/);
    const params = { name: 'Ada' };
    assert.equal(api.params(params), params);
    assert.deepEqual(api.params(), {});
    assert.deepEqual(api.params(undefined), {});
    assert.deepEqual(api.params(null), {});
  }
});
