import { createServerHandler } from '@fluentic/i18n-nextjs/handler/cookie/server';
import { languages } from './languages';

export const cookieServer = createServerHandler({
  ...languages,
  cookie: { name: 'language' },
});
