import { createServerHandler } from '@fluentic/i18n-nextjs/handler/url/server';
import { languages } from './languages';

export const urlServer = createServerHandler({
  ...languages,
  rememberCookie: 'language',
});
