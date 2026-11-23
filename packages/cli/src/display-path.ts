import { realpathSync } from 'node:fs';
import path from 'node:path';

// Resolve existing ancestors too, so destinations that have not been created yet
// still display correctly when the working directory has a symlink alias.
function canonicalPath(file: string): string {
  try {
    return realpathSync.native(file);
  } catch {
    const parent = path.dirname(file);
    return parent === file ? file : path.join(canonicalPath(parent), path.basename(file));
  }
}

/** Prefer a readable path from the invocation directory, including nearby siblings. */
export function displayPath(file: string, cwd = process.cwd()): string {
  const absolute = path.resolve(cwd, file);
  let relative = path.relative(cwd, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    const canonical = path.relative(canonicalPath(cwd), canonicalPath(absolute));
    if (canonical.length < relative.length) relative = canonical;
  }
  if (!relative) return '.';
  return !path.isAbsolute(relative) && relative.length < absolute.length ? relative : absolute;
}
