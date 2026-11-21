'use client';
import { t } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-nextjs';
import { useActionState } from 'react';
import { languageHandler } from '../i18n/language.client';
import type { LanguageId } from '../i18n/languages';
import { saveExample } from './actions';
const account = t.context('account');
const greeting = account.msg('Hello {name}', { name: String });
export default function Client({ languageId }: { languageId: LanguageId; }) {
  const nextLanguageId = languageId === 'fr' ? 'en' : 'fr';
  const [saveResult, saveAction, isSaving] = useActionState(saveExample, null);
  return (
    <section title={t.text(greeting, { name: 'Ada' })}>
      <p>{t.jsx(greeting, { name: 'Ada' })}</p>
      <button onClick={() => I18nManager.setLanguageId(nextLanguageId, languageHandler)}>
        Switch to {nextLanguageId}
      </button>
      <form action={saveAction}>
        <button disabled={isSaving}>Save example</button>
        {saveResult && <output>{saveResult.message}</output>}
      </form>
    </section>
  );
}
