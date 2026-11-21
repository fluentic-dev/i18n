import type { RequestConfigFactory } from './config';
const missing: RequestConfigFactory = () => {
  throw new Error('[i18n] configure @fluentic/i18n-compiler/nextjs with requestConfig pointing to your request module');
};
export default missing;
