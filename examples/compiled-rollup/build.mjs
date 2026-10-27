import { compileCatalog } from '@fluentic/i18n/compiler';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await writeFile(
  'catalog.mjs',
  'export default ' +
    JSON.stringify(compileCatalog([{ context: 'account', source: 'Hello {name}', translation: 'Bonjour {name}' }])),
);
import fluentic from '@fluentic/i18n/plugin/rollup';
import { rollup } from 'rollup';
const bundle = await rollup({
  input: 'main.js',
  external: (id) => id.startsWith('@fluentic/') || id === 'react',
  plugins: [fluentic()],
});
await bundle.write({ file: 'dist/main.mjs', format: 'esm', sourcemap: true });
await bundle.close();
