import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// tsc emits extensionless specifiers from our Bundler-mode source imports.
// Resolve declaration-to-declaration links explicitly so NodeNext consumers can follow them too.
const directory = path.resolve(process.argv[2] ?? 'dist');
for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.d.ts')) continue;
  const file = path.join(entry.parentPath ?? entry.path, entry.name);
  const before = readFileSync(file, 'utf8');
  const after = before.replace(
    /\b(from\s*|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g,
    (match, prefix, quote, specifier) => {
      if (path.extname(specifier)) return match;
      const target = path.resolve(path.dirname(file), specifier);
      const suffix = existsSync(target + '.d.ts')
        ? '.js'
        : existsSync(path.join(target, 'index.d.ts'))
        ? '/index.js'
        : null;
      if (!suffix) throw new Error(`Cannot resolve declaration import ${specifier} in ${file}`);
      return `${prefix}${quote}${specifier}${suffix}${quote}`;
    },
  );
  if (before !== after) writeFileSync(file, after);
}
