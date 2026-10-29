import { createJiti } from 'jiti';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type PluginOptions = { compiled?: boolean; config?: string; includeDependencies?: boolean; };

export function loadOptions(
  options: PluginOptions = {},
  root = process.cwd(),
): PluginOptions & { configFile?: string; } {
  const file = options.config
    ? resolve(root, options.config)
    : ['i18n.config.ts', 'i18n.config.js', 'i18n.config.mjs'].map((name) => resolve(root, name)).find(existsSync);

  const config = file
    ? createJiti(import.meta.url, { moduleCache: false })(file) as { default?: PluginOptions; } & PluginOptions
    : {};

  return { ...((config.default ?? config) as PluginOptions), ...options, configFile: file };
}

export function accepts(id: string, options: PluginOptions) {
  return /\.[cm]?[jt]sx?$/.test(id.split('?')[0]) && (options.includeDependencies || !id.includes('/node_modules/'));
}
