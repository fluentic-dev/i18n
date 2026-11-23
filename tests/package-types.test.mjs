import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('public lint declarations resolve and infer callbacks under NodeNext and Bundler', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentic-types-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'node_modules/@fluentic'), { recursive: true });
  for (const name of ['cli', 'compiler']) {
    await symlink(path.join(root, 'packages', name), path.join(directory, 'node_modules/@fluentic', `i18n-${name}`));
  }
  await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
  await writeFile(
    path.join(directory, 'consumer.ts'),
    `
    import {defineConfig, type ParameterChecks, type ForbiddenMessageRule} from '@fluentic/i18n-cli';
    import {lintSource} from '@fluentic/i18n-compiler';
    const checks: ParameterChecks = {
      jsx: {skip: [{match:'exact',terms:'Legacy'}, ({message}) => message.startsWith('Test')]},
      translation: {skip: {check: ({message,translation}) => message === translation}},
    };
    const rules: ForbiddenMessageRule[] = [message => message === 'X' ? 'No X' : undefined];
    defineConfig({languages:{source:'en',targets:[]},lint:{parameterChecks:checks,forbiddenMessages:rules}});
    defineConfig({languages:{source:'en',targets:[]},lint:{
      parameterChecks:{text:{skip:({message}) => message === 'X'},translation:{skip:{check:({message,translation}) => message === translation}}},
      forbiddenMessages:{check:async message => message === 'X' ? ['No X'] : undefined},
    }});
    lintSource('', 'test.ts', undefined, {parameterChecks:checks});
    // @ts-expect-error Skip callbacks return booleans, not diagnostic strings.
    const invalid: ParameterChecks = {text:{skip:({message}) => message}};
  `,
  );
  for (const [module, moduleResolution] of [['NodeNext', 'NodeNext'], ['Preserve', 'Bundler']]) {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { module, moduleResolution, target: 'ES2022', strict: true, noEmit: true, skipLibCheck: true },
        files: ['consumer.ts'],
      }),
    );
    let failure;
    try {
      execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], {
        cwd: directory,
        encoding: 'utf8',
      });
    } catch (error) {
      failure = error.stdout || error.message;
    }
    assert.equal(failure, undefined, `${moduleResolution}: ${failure}`);
  }
});
