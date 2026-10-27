import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/client.ts', 'src/server.ts', 'src/config.ts', 'src/request.ts', 'src/plugin.ts', 'src/unavailable.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  deps: { neverBundle: ['@fluentic/i18n-nextjs/request', 'server-only'] },
});
