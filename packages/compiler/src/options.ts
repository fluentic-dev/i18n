import { createJiti } from 'jiti';
import { resolve } from 'node:path';

import type { TransformFilterOptions } from './filter';
import type { CompiledOptions } from './index';

export type { FilterPattern, TransformFilterOptions } from './filter';

export type PluginOptions = TransformFilterOptions & {
  /** Direct override; otherwise reuse compiled.hashLength from an explicitly selected config or the default. */
  hashLength?: number;
  /** Optional i18n config path, resolved from the plugin's working directory. */
  config?: string;
  /** Next.js client modules: bind synchronous text calls to the hydration boundary. */
  bindReactText?: boolean;
};

export function loadOptions(
  options: PluginOptions = {},
  root = process.cwd(),
): PluginOptions & { configFile?: string; } {
  if ('compiled' in options) {
    throw new TypeError('[i18n] compiler plugins always compile; use hashLength instead of compiled');
  }
  const file = options.config ? resolve(root, options.config) : undefined;

  const config = file
    ? createJiti(import.meta.url, { moduleCache: false })(file) as
      & { default?: PluginOptions & { compiled?: true | CompiledOptions; }; }
      & PluginOptions
      & { compiled?: true | CompiledOptions; }
    : {};
  const loaded = (config.default ?? config) as PluginOptions & { compiled?: true | CompiledOptions; };
  const { compiled, ...configOptions } = loaded;
  const sharedHashLength = typeof compiled === 'object' ? compiled.hashLength : undefined;

  return {
    ...configOptions,
    ...(sharedHashLength === undefined ? {} : { hashLength: sharedHashLength }),
    ...options,
    configFile: file,
  };
}
