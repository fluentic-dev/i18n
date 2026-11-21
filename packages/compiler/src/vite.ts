import type { PluginOptions } from './options';
import rollup from './rollup';

export default function fluentic(options: PluginOptions = {}) {
  // Vite uses the Rollup-compatible compiler adapter.
  return { ...rollup(options), enforce: 'pre' as const };
}
