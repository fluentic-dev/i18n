import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: [
    'src/client.ts',
    'src/server.ts',
    'src/config.ts',
    'src/language.ts',
    'src/request.ts',
    'src/unavailable.ts',
    'src/cookie-client.ts',
    'src/cookie-server.ts',
    'src/url-client.ts',
    'src/url-proxy.ts',
    'src/url-server.ts',
  ],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  banner: ({ fileName }) =>
    ['client.mjs', 'cookie-client.mjs', 'url-client.mjs'].includes(fileName)
      ? "'use client';"
      : undefined,
  deps: { neverBundle: ['@fluentic/i18n-nextjs/request', 'server-only'] },
});
