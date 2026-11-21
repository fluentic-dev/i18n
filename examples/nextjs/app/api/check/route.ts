import { t } from '@fluentic/i18n';
import { i18nFn, I18nState } from '@fluentic/i18n-nextjs/server';
const c = t.context('account');
const greeting = c.msg('Hello {name}', { name: String });

export const GET = i18nFn(async () => {
  const { languageId } = I18nState.get();
  await new Promise((resolve) => setTimeout(resolve, languageId === 'fr' ? 15 : 2));

  return Response.json({ languageId, message: t.text(greeting, { name: 'Ada' }) });
});
