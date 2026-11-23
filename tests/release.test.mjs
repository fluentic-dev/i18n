import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fingerprint, orderPackages, resolveWorkspaceDependencies } from '../scripts/release.mjs';

test('release checksum ignores version/changelog/dev tooling but detects shipped changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-test-'));
  const manifest = {
    name: '@test/rn',
    version: '1.0.0',
    devDependencies: { build: '1' },
    peerDependencies: { react: '>=18' },
  };
  const write = () => writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  try {
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist/index.js'), 'export const x = 1;');
    writeFileSync(join(dir, 'CHANGELOG.md'), '1.0.0');
    write();
    const before = fingerprint(dir);
    manifest.version = '1.0.1';
    manifest.devDependencies.build = '2';
    write();
    writeFileSync(join(dir, 'CHANGELOG.md'), '1.0.1\nUpdated dependencies');
    assert.equal(fingerprint(dir), before);
    manifest.peerDependencies.react = '>=19';
    write();
    assert.notEqual(fingerprint(dir), before);
    manifest.peerDependencies.react = '>=18';
    write();
    writeFileSync(join(dir, 'dist/index.js'), 'export const x = 2;');
    assert.notEqual(fingerprint(dir), before);
    writeFileSync(join(dir, 'dist/index.js'), 'export const x = 1;');
    writeFileSync(join(dir, 'README.md'), 'New usage');
    assert.notEqual(fingerprint(dir), before);
    rmSync(join(dir, 'README.md'));
    writeFileSync(join(dir, 'dist/index.d.ts'), 'export declare const x: number;');
    assert.notEqual(fingerprint(dir), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('skipped workspace packages resolve to published versions; changed dependencies propagate', () => {
  const source = {
    dependencies: { core: 'workspace:*', other: '^2' },
    optionalDependencies: { extra: 'workspace:^' },
    devDependencies: { core: 'workspace:*' },
  };
  const packed = {
    dependencies: { core: '1.1.0', other: '^2' },
    optionalDependencies: { extra: '^1.1.0' },
    devDependencies: { core: '1.1.0' },
  };
  const output = resolveWorkspaceDependencies(packed, source, { core: '1.0.0', extra: '1.0.1' });
  assert.equal(output.dependencies.core, '1.0.0');
  assert.equal(output.optionalDependencies.extra, '^1.0.1');
  assert.equal(output.dependencies.other, '^2');
  assert.equal(packed.dependencies.core, '1.1.0');
  assert.equal(
    resolveWorkspaceDependencies(packed, source, { core: '1.1.0', extra: '1.0.1' }).dependencies.core,
    '1.1.0',
  );
  assert.throws(() => resolveWorkspaceDependencies(packed, source, {}), /No release version/);
});

test('release orders runtime workspace dependencies before consumers and rejects cycles', () => {
  const pkg = (name, dependencies = {}) => ({ manifest: { name, dependencies } });
  assert.deepEqual(
    orderPackages([
      pkg('cli', { compiler: 'workspace:*' }),
      pkg('rn'),
      pkg('compiler', { core: 'workspace:*' }),
      pkg('core'),
    ]).map((p) => p.manifest.name),
    ['core', 'compiler', 'cli', 'rn'],
  );
  assert.throws(() => orderPackages([pkg('a', { b: 'workspace:*' }), pkg('b', { a: 'workspace:*' })]), /cycle/);
});

test('publisher preflights all versions before writes and checkpoints partial success', async () => {
  const { publishSelected } = await import('../scripts/release.mjs');
  const selected = ['compiler', 'cli'].map((name) => ({ name, version: '1.0.1', integrity: `sha512-${name}` }));
  const published = new Map();
  const records = [];
  let calls = [];
  const operations = {
    info: async (spec) => published.has(spec) ? { dist: { integrity: published.get(spec) } } : null,
    publish: async (pkg) => {
      calls.push(pkg.name);
      if (pkg.name === 'cli') throw new Error('network failure');
      published.set(`${pkg.name}@${pkg.version}`, pkg.integrity);
    },
    tag: async (pkg) => calls.push(`tag:${pkg.name}`),
    record: async (pkg) => records.push(pkg.name),
  };
  published.set('cli@1.0.1', 'sha512-wrong');
  await assert.rejects(publishSelected(selected, operations), /different contents/);
  assert.deepEqual(calls, []);
  published.clear();
  await assert.rejects(publishSelected(selected, operations), /network failure/);
  assert.deepEqual(records, ['compiler']);
  calls = [];
  operations.publish = async (pkg) => {
    calls.push(pkg.name);
    published.set(`${pkg.name}@${pkg.version}`, pkg.integrity);
  };
  await publishSelected(selected, operations);
  assert.deepEqual(calls, ['tag:compiler', 'cli']);
  assert.deepEqual(records, ['compiler', 'compiler', 'cli']);
});

test('publisher does not record an unverified upload or swallow registry errors', async () => {
  const { publishSelected } = await import('../scripts/release.mjs');
  const selected = [{ name: 'pkg', version: '1', integrity: 'sha512-test' }];
  let recorded = false;
  const operations = {
    info: () => null,
    publish() {},
    record() {
      recorded = true;
    },
  };
  await assert.rejects(publishSelected(selected, operations), /Could not verify/);
  assert.equal(recorded, false);
  operations.info = () => {
    throw new Error('registry unavailable');
  };
  await assert.rejects(publishSelected(selected, operations), /registry unavailable/);
  assert.equal(recorded, false);
});
