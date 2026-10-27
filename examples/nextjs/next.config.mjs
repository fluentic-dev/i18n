import withFluentic from '@fluentic/i18n-nextjs/plugin';
export default withFluentic({ requestConfig: './i18n/request.ts', config: './i18n.config.ts' })({});
