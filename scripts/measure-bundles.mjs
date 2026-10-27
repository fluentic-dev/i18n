import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
const require = createRequire(new URL('../examples/compiled-esbuild/package.json', import.meta.url));
const { build } = require('esbuild');
const root = new URL('../', import.meta.url).pathname;
const cases = [
  ['dynamic t', `export {t} from './packages/i18n/dist/index.js';`],
  ['compiled t', `export {t} from './packages/i18n/dist/compiled.js';`],
  [
    'compiled typical React app',
    `export {t} from './packages/i18n/dist/compiled.js'; export {I18nManager,I18nState} from './packages/web/dist/index.mjs';`,
  ],
  [
    'dynamic typical React app',
    `export {t} from './packages/i18n/dist/index.js'; export {I18nManager,I18nState} from './packages/web/dist/index.mjs';`,
  ],
  [
    'compiled React app + persistence',
    `export {t,I18nRegistry} from './packages/i18n/dist/compiled.js'; export {I18nManager,I18nState,createLocalStorage} from './packages/web/dist/index.mjs';`,
  ],
  [
    'compiled Next.js client',
    `export {t} from './packages/i18n/dist/compiled.js'; export * from './packages/nextjs/dist/client.mjs';`,
  ],
  [
    'compiled RN + storage wrapper',
    `export {t,I18nRegistry} from './packages/i18n/dist/compiled.js'; export * from './packages/rn/dist/index.mjs';`,
  ],
  [
    'compiled + web adapter',
    `export {t} from './packages/i18n/dist/compiled.js'; export * from './packages/web/dist/index.mjs';`,
  ],
  ['web adapter only', `export * from './packages/web/dist/index.mjs';`],
  ['registry only', `export {I18nRegistry} from './packages/i18n/dist/index.js';`],
  ['manager', `export {createI18nManager} from './packages/i18n/dist/adapter.js';`],
];
const sizes = {};
for (const [name, contents] of cases) {
  const options = {
    stdin: { contents, resolveDir: root, sourcefile: 'measure.js' },
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    external: ['react'],
    metafile: true,
  };
  const [result, unminified] = await Promise.all([build(options), build({ ...options, minify: false })]);
  const code = result.outputFiles[0].contents;
  sizes[name] = code.length;
  if (!name.startsWith('dynamic')) {
    assert.ok(
      !Object.values(result.metafile.outputs).some((output) =>
        Object.entries(output.inputs).some(([path, info]) =>
          info.bytesInOutput > 0 && /intl-messageformat|icu-messageformat-parser|@babel|node:/.test(path)
        )
      ),
      'unexpected formatter/compiler dependency: ' + name,
    );
  }
  console.log(
    `${name}: ${unminified.outputFiles[0].contents.length} bytes unminified; ${code.length} bytes minified; ${
      gzipSync(code).length
    } bytes gzip (React and catalogs excluded)`,
  );
}
assert.ok(sizes['compiled t'] < sizes['dynamic t'] / 2);
