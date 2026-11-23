import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
export const fingerprintVersion = 1;
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const digest = (data, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(data).digest(encoding);
function writeJson(path, value) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n');
  renameSync(path + '.tmp', path);
}
function command(bin, args, cwd = root) {
  return execFileSync(bin, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

/** Compare shipped files, independent of tar metadata and release-only manifest edits. */
export function fingerprint(directory) {
  const hash = createHash('sha256');
  const visit = (relative = '') => {
    for (const name of readdirSync(join(directory, relative)).sort()) {
      const file = relative ? `${relative}/${name}` : name;
      if (/^changelog(?:\.[^/]*)?$/i.test(file)) continue;
      const path = join(directory, file);
      const stat = lstatSync(path);
      if (stat.isDirectory()) {
        visit(file);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Unsupported packed file: ${file}`);
      let contents = readFileSync(path);
      if (file === 'package.json') {
        const manifest = JSON.parse(contents);
        delete manifest.version;
        delete manifest.devDependencies;
        contents = Buffer.from(JSON.stringify(stable(manifest)));
      }
      hash.update(JSON.stringify([file, stat.mode & 0o111, contents.length]) + '\n');
      hash.update(contents);
    }
  };
  visit();
  return hash.digest('hex');
}

/** Only workspace references are rewritten; explicit dependency ranges remain meaningful. */
export function resolveWorkspaceDependencies(packed, source, versions) {
  const result = structuredClone(packed);
  for (const field of [...dependencyFields, 'devDependencies']) {
    for (const [name, range] of Object.entries(source[field] ?? {})) {
      if (!range.startsWith('workspace:')) continue;
      if (!versions[name]) {
        if (field === 'devDependencies') continue;
        throw new Error(`No release version for workspace dependency ${name}`);
      }
      const requested = range.slice('workspace:'.length);
      if (!['*', '^', '~'].includes(requested)) throw new Error(`Unsupported workspace range: ${name}@${range}`);
      result[field][name] = (requested === '*' ? '' : requested) + versions[name];
    }
  }
  return result;
}

export function orderPackages(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  const visit = (pkg) => {
    const name = pkg.manifest.name;
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error(`Workspace dependency cycle at ${name}`);
    visiting.add(name);
    for (const field of dependencyFields) {
      for (const [dependency, range] of Object.entries(pkg.manifest[field] ?? {})) {
        if (range.startsWith('workspace:') && byName.has(dependency)) visit(byName.get(dependency));
      }
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(pkg);
  };
  packages.forEach(visit);
  return ordered;
}

function registryInfo(spec) {
  try {
    return JSON.parse(command('npm', ['view', spec, 'version', 'dist', '--json']));
  } catch (error) {
    // Authentication/network errors must never be interpreted as an unpublished package.
    let response;
    try {
      response = JSON.parse(String(error.stdout));
    } catch {}
    if (response?.error?.code === 'E404') return null;
    throw error;
  }
}
function unpack(archive, directory) {
  mkdirSync(directory, { recursive: true });
  command('tar', ['-xzf', archive, '-C', directory]);
  return join(directory, 'package');
}
function download(spec, directory) {
  mkdirSync(directory, { recursive: true });
  const [packed] = JSON.parse(
    command('npm', ['pack', spec, '--json', '--ignore-scripts', '--pack-destination', directory]),
  );
  return join(directory, packed.filename);
}
function assertIntegrity(archive, expected) {
  if (expected !== `sha512-${digest(readFileSync(archive), 'sha512', 'base64')}`) {
    throw new Error(`Registry integrity mismatch for ${archive}`);
  }
}

/** Preflight the entire release and checkpoint each success, so partial releases can resume. */
export async function publishSelected(selected, operations) {
  const existing = new Set();
  for (const pkg of selected) {
    const info = await operations.info(`${pkg.name}@${pkg.version}`);
    if (!info) continue;
    if (info.dist.integrity !== pkg.integrity) {
      throw new Error(`${pkg.name}@${pkg.version} already exists with different contents`);
    }
    existing.add(pkg.name);
  }
  for (const pkg of selected) {
    if (existing.has(pkg.name)) await operations.tag(pkg);
    else await operations.publish(pkg);
    const info = await operations.info(`${pkg.name}@${pkg.version}`);
    if (info?.dist.integrity !== pkg.integrity) {
      throw new Error(`Could not verify publication of ${pkg.name}; rerun to resume`);
    }
    await operations.record(pkg);
  }
}

export async function main(args = process.argv.slice(2)) {
  const valid = new Set(['--baseline', '--prepare', '--publish', '--dry-run']);
  if (args.some((arg) => !valid.has(arg)) || args.length !== 1) {
    throw new Error('Usage: node scripts/release.mjs --baseline|--prepare|--dry-run|--publish');
  }
  const mode = args[0];
  const pre = existsSync(join(root, '.changeset/pre.json')) ? json(join(root, '.changeset/pre.json')) : null;
  const tag = pre?.mode === 'pre' ? pre.tag : 'latest';
  // Baselines are separate per npm channel: beta publication must not suppress a stable release.
  const ledgerPath = join(root, 'release', `published-${tag}.json`);
  const packages = orderPackages(
    readdirSync(join(root, 'packages')).sort().map((directory) => {
      const path = join(root, 'packages', directory);
      return { directory: path, manifest: json(join(path, 'package.json')) };
    }).filter(({ manifest }) => !manifest.private),
  );
  const temp = mkdtempSync(join(tmpdir(), 'fluentic-release-'));
  try {
    if (mode === '--baseline') {
      if (existsSync(ledgerPath)) throw new Error(`Baseline already exists: ${ledgerPath}`);
      const ledger = { fingerprintVersion, tag, packages: {} };
      for (const { manifest } of packages) {
        const info = registryInfo(`${manifest.name}@${tag}`);
        if (!info) {
          console.log(`New package/channel: ${manifest.name}@${tag}`);
          continue;
        }
        const directory = join(temp, manifest.name.replaceAll('/', '-'));
        const archive = download(`${manifest.name}@${info.version}`, directory);
        assertIntegrity(archive, info.dist.integrity);
        ledger.packages[manifest.name] = {
          version: info.version,
          checksum: fingerprint(unpack(archive, join(directory, 'unpacked'))),
          integrity: info.dist.integrity,
        };
        console.log(`Baseline ${manifest.name}@${info.version}`);
      }
      writeJson(ledgerPath, ledger);
      return;
    }
    if (!existsSync(ledgerPath)) throw new Error(`Missing ${ledgerPath}; initialize it with --baseline first`);
    const ledger = json(ledgerPath);
    if (ledger.fingerprintVersion !== fingerprintVersion || ledger.tag !== tag) {
      throw new Error('Incompatible release baseline');
    }
    const versions = Object.fromEntries(Object.entries(ledger.packages).map(([name, pkg]) => [name, pkg.version]));
    const releaseVersions = new Set(packages.map(({ manifest }) => manifest.version));
    if (releaseVersions.size !== 1) throw new Error('Expected the coordinated workspace release version');
    const version = packages[0].manifest.version;
    if ((tag === 'latest' && version.includes('-')) || (tag !== 'latest' && !version.includes(`-${tag}.`))) {
      throw new Error(`Version ${version} does not match the ${tag} release channel`);
    }
    const output = join(root, 'release', version);
    mkdirSync(output, { recursive: true });
    const plan = { fingerprintVersion, version, tag, packages: [] };
    for (const pkg of packages) {
      const { name } = pkg.manifest;
      const directory = join(temp, name.replaceAll('/', '-'));
      mkdirSync(directory, { recursive: true });
      command('pnpm', ['pack', '--pack-destination', directory], pkg.directory);
      const archive = join(directory, readdirSync(directory).find((file) => file.endsWith('.tgz')));
      const stage = unpack(archive, join(directory, 'unpacked'));
      const manifest = resolveWorkspaceDependencies(json(join(stage, 'package.json')), pkg.manifest, versions);
      writeJson(join(stage, 'package.json'), manifest);
      const checksum = fingerprint(stage);
      const previous = ledger.packages[name];
      if (previous?.checksum === checksum) {
        plan.packages.push({ name, action: 'skip', version: previous.version, workspaceVersion: version, checksum });
        console.log(`Skip    ${name} (unchanged; stays ${previous.version})`);
        continue;
      }
      if (previous?.version === version) {
        throw new Error(`${name} changed but ${version} is already published; bump its version first`);
      }
      versions[name] = version;
      // Pack the staging directory, never mutate workspace dependencies to published versions.
      const [packed] = JSON.parse(
        command('npm', ['pack', stage, '--json', '--ignore-scripts', '--pack-destination', directory]),
      );
      const finalArchive = join(directory, packed.filename);
      // Ensure npm's repack did not omit or alter fingerprinted content.
      if (fingerprint(unpack(finalArchive, join(directory, 'verified'))) !== checksum) {
        throw new Error(`Repack changed ${name}`);
      }
      const bytes = readFileSync(finalArchive);
      writeFileSync(join(output, packed.filename), bytes);
      plan.packages.push({
        name,
        action: 'publish',
        version,
        previousVersion: previous?.version ?? null,
        checksum,
        tarball: packed.filename,
        sha256: digest(bytes),
        integrity: `sha512-${digest(bytes, 'sha512', 'base64')}`,
      });
      console.log(`Publish ${name}@${version}`);
    }
    writeJson(join(output, 'plan.json'), plan);
    const selected = plan.packages.filter((pkg) => pkg.action === 'publish');
    writeFileSync(join(output, 'SHA256SUMS'), selected.map((pkg) => `${pkg.sha256}  ${pkg.tarball}\n`).join(''));
    if (mode !== '--publish') {
      console.log(`Prepared ${selected.length} package(s); no npm publication. Plan: ${output}/plan.json`);
      return;
    }
    await publishSelected(selected, {
      info: registryInfo,
      publish: (pkg) =>
        execFileSync('npm', [
          'publish',
          join(output, pkg.tarball),
          '--access',
          'public',
          '--tag',
          tag,
          '--ignore-scripts',
        ], { cwd: root, stdio: 'inherit' }),
      tag: (pkg) =>
        execFileSync('npm', ['dist-tag', 'add', `${pkg.name}@${pkg.version}`, tag], {
          cwd: root,
          stdio: 'inherit',
        }),
      record: (pkg) => {
        ledger.packages[pkg.name] = { version: pkg.version, checksum: pkg.checksum, integrity: pkg.integrity };
        writeJson(ledgerPath, ledger);
        console.log(`Recorded ${pkg.name}@${pkg.version}`);
      },
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
