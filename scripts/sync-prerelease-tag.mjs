import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const preState = JSON.parse(readFileSync(resolve(root, '.changeset/pre.json'), 'utf8'));

if (preState.mode !== 'pre') process.exit(0);

const dryRun = process.argv.includes('--dry-run');
const packagesDir = resolve(root, 'packages');

for (const directory of readdirSync(packagesDir).sort()) {
  const manifest = JSON.parse(readFileSync(resolve(packagesDir, directory, 'package.json'), 'utf8'));

  if (manifest.private) continue;
  if (!manifest.version.includes(`-${preState.tag}.`)) {
    throw new Error(`${manifest.name}@${manifest.version} is not a ${preState.tag} prerelease`);
  }

  const spec = `${manifest.name}@${manifest.version}`;

  if (dryRun) {
    console.log(`npm dist-tag add ${spec} ${preState.tag}`);
  } else {
    execFileSync('npm', ['dist-tag', 'add', spec, preState.tag], { stdio: 'inherit' });
  }
}
