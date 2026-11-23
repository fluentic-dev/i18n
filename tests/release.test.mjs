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
  assert.deepEqual(records, []);
  calls = [];
  operations.publish = async (pkg) => {
    calls.push(pkg.name);
    published.set(`${pkg.name}@${pkg.version}`, pkg.integrity);
  };
  await publishSelected(selected, operations);
  assert.deepEqual(calls, ['cli', 'tag:compiler']);
  assert.deepEqual(records, ['compiler', 'cli']);
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
  await assert.rejects(publishSelected(selected, operations, { attempts: 1 }), /Could not verify/);
  assert.equal(recorded, false);
  operations.info = () => {
    throw new Error('registry unavailable');
  };
  await assert.rejects(publishSelected(selected, operations), /registry unavailable/);
  assert.equal(recorded, false);
});

test('pending uploads survive a timeout and resume without republishing', async () => {
  const { publishSelected } = await import('../scripts/release.mjs');
  const pkg = { name: 'pkg', version: '1', integrity: 'sha512-test' };
  let pending = false;
  let available = false;
  let publishes = 0;
  const events = [];
  const operations = {
    info: () => available ? { dist: { integrity: pkg.integrity } } : null,
    publish: () => publishes++,
    pending: () => pending,
    markPending: () => {
      pending = true;
    },
    clearPending: () => {
      pending = false;
    },
    tag: () => events.push('tag'),
    record: () => events.push('record'),
  };
  await assert.rejects(publishSelected([pkg], operations, { attempts: 1 }), /resume waiting/);
  assert.equal(pending, true);
  assert.deepEqual(events, []);
  await publishSelected([pkg], operations, {
    attempts: 3,
    sleep: async () => {
      available = true;
    },
  });
  assert.equal(publishes, 1);
  assert.equal(pending, false);
  assert.deepEqual(events, ['tag', 'record']);
});

test('staged E409 recovery waits for matching integrity; unrelated conflicts still fail', async () => {
  const { publishSelected, isStagedConflict } = await import('../scripts/release.mjs');
  const pkg = { name: 'pkg', version: '1', integrity: 'sha512-test' };
  const staged = Object.assign(new Error('npm publish failed'), {
    stderr: 'npm error code E409\nnpm error 409 Conflict - Cannot publish over previously staged version "1".',
  });
  assert.equal(isStagedConflict(new Error('E409 unrelated conflict')), false);
  for (const integrity of [pkg.integrity, 'sha512-wrong']) {
    let available = false;
    const events = [];
    const run = publishSelected([pkg], {
      info: () => available ? { dist: { integrity } } : null,
      publish: () => {
        throw staged;
      },
      markPending: () => events.push('pending'),
      tag: () => events.push('tag'),
      record: () => events.push('record'),
    }, {
      attempts: 2,
      sleep: async () => {
        available = true;
      },
    });
    if (integrity === pkg.integrity) {
      await run;
      assert.deepEqual(events, ['pending', 'tag', 'record']);
    } else {
      await assert.rejects(run, /different contents/);
      assert.deepEqual(events, ['pending']);
    }
  }
  await assert.rejects(
    publishSelected([pkg], {
      info: () => null,
      publish: () => {
        throw new Error('E409 unrelated conflict');
      },
    }),
    /unrelated conflict/,
  );
});

test('all uploads precede polling and visible consumers are recorded before pending dependencies', async () => {
  const { publishSelected } = await import('../scripts/release.mjs');
  const packages = ['dependency', 'consumer'].map((name) => ({ name, version: '1', integrity: name }));
  const visible = new Map();
  const events = [];
  let slept = false;
  await publishSelected(packages, {
    info: (spec) => visible.get(spec) ?? null,
    publish: (pkg) => {
      events.push(`publish:${pkg.name}`);
      if (pkg.name === 'consumer') visible.set('consumer@1', { dist: { integrity: pkg.integrity } });
    },
    record: (pkg) => events.push(`record:${pkg.name}`),
  }, {
    attempts: 2,
    sleep: async () => {
      assert.deepEqual(events, ['publish:dependency', 'publish:consumer', 'record:consumer']);
      slept = true;
      visible.set('dependency@1', { dist: { integrity: 'dependency' } });
    },
  });
  assert.equal(slept, true);
  assert.deepEqual(events, ['publish:dependency', 'publish:consumer', 'record:consumer', 'record:dependency']);
});

test('interactive commands preserve failure diagnostics for staged-conflict recovery', async () => {
  const { interactiveCommand, isStagedConflict } = await import('../scripts/release.mjs');
  await interactiveCommand(process.execPath, ['-e', 'process.exit(0)']);
  await assert.rejects(
    interactiveCommand(process.execPath, [
      '-e',
      'process.stderr.write("E409 Cannot publish over previously staged version"); process.exitCode = 1;',
    ]),
    (error) => error.code === 1 && isStagedConflict(error),
  );
});
