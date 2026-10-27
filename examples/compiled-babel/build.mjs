import { compileCatalog } from '@fluentic/i18n/compiler';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await writeFile(
  'catalog.mjs',
  'export default ' +
    JSON.stringify(compileCatalog([{ context: 'account', source: 'Hello {name}', translation: 'Bonjour {name}' }])),
);
import { transformFileAsync } from '@babel/core';
import fluentic from '@fluentic/i18n/plugin/babel';
const result = await transformFileAsync('main.js', {
  plugins: [[fluentic, {}]],
  sourceMaps: true,
  configFile: false,
  babelrc: false,
});
await writeFile(
  'dist/main.mjs',
  result.code.replace("'./catalog.mjs'", "'../catalog.mjs'") + '\n//# sourceMappingURL=main.mjs.map',
);
await writeFile('dist/main.mjs.map', JSON.stringify(result.map));
