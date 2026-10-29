import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createI18nManager } from '../packages/i18n/dist/adapter.js';
import { t } from '../packages/i18n/dist/index.js';
import { I18nProvider, useI18nRenderer } from '../packages/rn/dist/index.mjs';

const require = createRequire(new URL('../packages/i18n/package.json', import.meta.url));
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('native provider renders a translated break inside text', async () => {
  const managed = createI18nManager();
  managed.manager.configure({ languageId: 'fr' });
  managed.manager.setTranslationLoader(() => [['Hello{break}there', 'Bonjour{break}ici'], null]);
  await managed.manager.init();

  function Screen() {
    const jsx = useI18nRenderer(t.jsx);
    return React.createElement('Text', null, jsx('Hello{break}there'));
  }

  let root;
  await act(async () => {
    root = create(React.createElement(I18nProvider, { instance: managed }, React.createElement(Screen)));
  });
  assert.deepEqual(root.toJSON().children, ['Bonjour\nici']);
  await act(async () => root.unmount());
});
