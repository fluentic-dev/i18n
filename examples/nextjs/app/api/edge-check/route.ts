import { t } from '@fluentic/i18n';
import { i18nFn, I18nState } from '@fluentic/i18n-nextjs/server';

export const runtime = 'edge';

const account = t.context('account');
const greeting = account.msg('Hello {name}', { name: String });

export const GET = i18nFn(async () => {
  const { languageId } = I18nState.get();
  await Promise.resolve();

  return Response.json({
    languageId,
    message: t.text(greeting, { name: 'Edge' }),
  });
});
