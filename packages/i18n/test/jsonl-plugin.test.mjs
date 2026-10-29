import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import esbuild from '../dist/plugin/esbuild.js';
import rollup from '../dist/plugin/rollup.js';
import webpackLoader from '../dist/plugin/webpack-loader.js';

const content = '{"compiled":true}\r\n["id",["Bonjour ",[0,"name"]]]\r\n';

async function moduleValue(code) {
  const module = await import(`data:text/javascript,${encodeURIComponent(code)}`);

  return module.default;
}

test('bundler adapters expose JSONL contents as text', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-jsonl-'));
  const file = path.join(directory, 'catalog.jsonl');

  try {
    await writeFile(file, content);

    const rollupResult = await rollup().load(file);
    assert.equal(await moduleValue(rollupResult.code), content);

    let jsonlLoader;
    esbuild().setup({
      initialOptions: {},
      onStart() {},
      onLoad(options, callback) {
        if (options.filter.test(file)) jsonlLoader = callback;
      },
    });
    const esbuildResult = await jsonlLoader({ path: file });
    assert.equal(esbuildResult.loader, 'text');
    assert.equal(esbuildResult.contents, content);

    let webpackCode;
    webpackLoader.call({
      resourcePath: file,
      rootContext: directory,
      getOptions: () => ({}),
      callback(error, code) {
        assert.equal(error, null);
        webpackCode = code;
      },
    }, content);
    assert.equal(await moduleValue(webpackCode), content);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
