'use client';
import { t } from '@fluentic/i18n';
import { I18nState, useI18nRenderer } from '@fluentic/i18n-nextjs';
import { useRouter } from 'next/navigation';
const account = t.context('account');
const greeting = account.msg('Hello {name}', { name: String });
export default function Client() {
  const router = useRouter();
  const state = I18nState.use();
  // Bind synchronous attributes to this provider during client SSR as well as hydration.
  const text = useI18nRenderer(t.text);
  return (
    <section title={text(greeting, { name: 'Ada' })}>
      <p>{t.jsx(greeting, { name: 'Ada' })}</p>
      <button
        onClick={async () => {
          await fetch('/api/language', { method: 'POST', body: state.languageId === 'fr' ? 'en' : 'fr' });
          router.refresh();
        }}
      >
        Switch language
      </button>
    </section>
  );
}
