import { defineConfig } from '@fluentic/i18n-cli';
export default defineConfig({
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx}'] },
});
