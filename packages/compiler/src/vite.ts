import { createTransformHookFilter } from './filter';
import type { PluginOptions } from './options';
import rollup from './rollup';

export type { PluginOptions } from './options';

export default function fluentic(options: PluginOptions = {}) {
  const adapter = rollup(options);
  return {
    ...adapter,
    enforce: 'pre' as const,
    transform: {
      // Config can change during watch mode. Keep native filtering broad in that
      // case; the adapter always checks the current authoritative shared filter.
      filter: options.config ? { id: {} } : createTransformHookFilter(options),
      handler: adapter.transform,
    },
  };
}
