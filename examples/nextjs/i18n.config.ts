import { defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  env: '../i18n.local.env',
  compiled: true,
  catalogFormat: 'mjs',
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['app/**/*.{ts,tsx}'] },
});
