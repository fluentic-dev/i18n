import { transformFileAsync } from '@babel/core';
import fluentic from '@fluentic/i18n-rn/plugin/babel';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await transformFileAsync('App.tsx', {
  configFile: false,
  babelrc: false,
  presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
  plugins: [[fluentic, { compiled: true }]],
  sourceMaps: true,
});
await mkdir('dist', { recursive: true });
await writeFile('dist/App.js', result.code);
await writeFile('dist/App.js.map', JSON.stringify(result.map));
