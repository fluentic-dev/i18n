import { defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx,js,jsx}'] },
});
