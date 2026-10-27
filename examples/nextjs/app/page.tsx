import { t } from '@fluentic/i18n';
import { ready } from '@fluentic/i18n-nextjs/server';
import Client from './client';
const account = t.context('account');
const greeting = account.msg('Hello {name}', { name: String });
export async function generateMetadata() {
  await ready();
  return { title: t.text(greeting, { name: 'Ada' }) };
}
export default async function Page() {
  await ready();
  return (
    <main>
      <h1>{t.jsx(greeting, { name: 'Ada' })}</h1>
      <Client />
    </main>
  );
}
