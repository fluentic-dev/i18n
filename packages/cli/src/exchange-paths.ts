import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { displayPath } from './display-path';

// Check every existing component, including parents, before following a handoff path.
export async function noSymlinks(file: string, boundary?: string): Promise<void> {
  const absolute = path.resolve(file);
  for (let current = absolute;; current = path.dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed: ${displayPath(current)}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (path.dirname(current) === current || (boundary && current === path.resolve(boundary))) break;
  }
}
