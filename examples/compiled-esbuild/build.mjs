import { compileCatalog } from '@fluentic/i18n/compiler';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await writeFile(
  'catalog.mjs',
  'export default ' +
    JSON.stringify(compileCatalog([{ context: 'account', source: 'Hello {name}', translation: 'Bonjour {name}' }])),
);
import fluentic from '@fluentic/i18n/plugin/esbuild';
import { build } from 'esbuild';
await build({
  entryPoints: ['main.js'],
  outfile: 'dist/main.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  sourcemap: true,
  plugins: [fluentic()],
});
