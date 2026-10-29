import { defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  env: false,
  output: 'i18n',
  catalogFormat: 'json',
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['App.tsx'] },
});
