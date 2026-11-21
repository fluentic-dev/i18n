'use server';
import { t } from '@fluentic/i18n';
import { i18nFn } from '@fluentic/i18n-nextjs/server';

const saved = t.msg('Changes saved');

export const saveExample = i18nFn(async (_previous: { message: string; } | null, _data: FormData) => {
  return { message: t.text(saved) };
});
