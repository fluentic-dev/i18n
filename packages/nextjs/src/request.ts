import type { RequestConfigFactory } from './config';
const missing: RequestConfigFactory = () => {
  throw new Error('[i18n] configure @fluentic/i18n-nextjs/plugin with requestConfig pointing to your request module');
};
export default missing;
