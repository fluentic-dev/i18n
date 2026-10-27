import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-web';
import React from 'react';
import { createRoot } from 'react-dom/client';
import french from './fr.jsonl';
const c = t.context('account');
const greeting = c.msg('Hello {name}', { name: String });
I18nManager.configure({ languageId: 'fr' });
I18nManager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? french : []);
function App() {
  const state = I18nState.use();
  return (
    <main>
      <h1>{t.jsx(greeting, { name: 'Ada' })}</h1>
      <button
        disabled={state.isLoading}
        onClick={() => I18nManager.setLanguageId(state.languageId === 'fr' ? 'en' : 'fr')}
      >
        Switch language
      </button>
    </main>
  );
}
I18nManager.init().then(() => createRoot(document.getElementById('root')!).render(<App />));
