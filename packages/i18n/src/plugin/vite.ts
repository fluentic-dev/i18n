import type { PluginOptions } from './options';
import rollup from './rollup';
export default function fluentic(options: PluginOptions = {}) {
  return { ...rollup(options), enforce: 'pre' as const };
}
