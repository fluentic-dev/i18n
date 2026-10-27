import { compileCatalog } from '@fluentic/i18n/compiler';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await writeFile(
  'catalog.mjs',
  'export default ' +
    JSON.stringify(compileCatalog([{ context: 'account', source: 'Hello {name}', translation: 'Bonjour {name}' }])),
);
import Fluentic from '@fluentic/i18n/plugin/webpack';
import { resolve } from 'node:path';
import webpack from 'webpack';
const compiler = webpack({
  mode: 'production',
  target: 'node',
  entry: './main.js',
  output: { path: resolve('dist'), filename: 'main.mjs', module: true },
  experiments: { outputModule: true },
  externalsType: 'module',
  externals: [({ request }, callback) => request?.startsWith('@fluentic/') ? callback(null, request) : callback()],
  devtool: 'source-map',
  plugins: [new Fluentic()],
});
await new Promise((resolve, reject) =>
  compiler.run((error, stats) =>
    compiler.close(() => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString())) : resolve())
  )
);
