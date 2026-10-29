import { createDeepLTranslator, createGoogleTranslator, defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  env: '../i18n.local.env',
  output: 'i18n',
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx,js,jsx}'] },
  translator: [createDeepLTranslator(), createGoogleTranslator()],
});
