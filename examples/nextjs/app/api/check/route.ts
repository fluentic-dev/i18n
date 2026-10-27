import { t } from '@fluentic/i18n';
import { runWithI18n } from '@fluentic/i18n-nextjs/server';
import french from '../../../i18n/fr.jsonl';
const c = t.context('account');
const greeting = c.msg('Hello {name}', { name: String });
export async function GET(request: Request) {
  const languageId = new URL(request.url).searchParams.get('language') === 'fr' ? 'fr' : 'en';
  return runWithI18n({ languageId, translationLoader: () => languageId === 'fr' ? french : [] }, async () => {
    await new Promise((resolve) => setTimeout(resolve, languageId === 'fr' ? 15 : 2));
    return Response.json({ languageId, message: t.text(greeting, { name: 'Ada' }) });
  });
}
