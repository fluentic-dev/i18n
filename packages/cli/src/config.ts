import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { displayPath } from './display-path';
import { contextualError } from './errors';
import type { Converter, JsonValue, Translator } from './types';

export type CatalogFormat = 'jsonl' | 'json' | 'cjs' | 'mjs';
export type CompiledOptions = { hashLength?: number; };

export type I18nConfig = {
  /** Emit [hash, compact AST] merged rows and enable build transforms. */
  compiled?: true | CompiledOptions;
  /** Formats written for each merged runtime catalog. Defaults to jsonl. */
  catalogFormat?: CatalogFormat | CatalogFormat[];
  /** Environment file relative to this config file. Defaults to i18n.env and i18n.env.local. */
  env?: string | false;
  root?: string;
  output?: string;
  languages: { source: string; targets: string[]; };
  /** Ordered translation providers. The first provider supporting a language pair is used. */
  translator?: Translator | Translator[];
  /** Named exchange converters. A matching name replaces the built-in converter entirely. */
  convert?: Converter[];
  hashes?: boolean;
  dirs?: { cache?: string; exports?: string; translations?: string; };
  files?: { includes?: string[]; excludes?: string[]; };
  meta?: JsonValue;
};

const configSymbol = Symbol.for('@fluentic/i18n-cli/config');
const configEnv = new WeakMap<object, (name: string) => string>();

export function defineConfig<const Config extends I18nConfig>(config: Config): Config {
  return Object.freeze({ ...config, [configSymbol]: true }) as Config;
}

export function isConfig(value: unknown): value is I18nConfig {
  return value !== null && typeof value === 'object' && configSymbol in value;
}

export function registerConfigEnv(config: I18nConfig, env: (name: string) => string): void {
  configEnv.set(config, env);
}

export function getConfigEnv(config: I18nConfig): (name: string) => string {
  return configEnv.get(config) ?? ((name) => {
    const value = process.env[name];
    if (value === undefined) {
      throw new Error(`Environment variable "${name}" is not set. Add it to your environment or i18n.env.local.`);
    }
    return value;
  });
}

export async function loadConfigEnv(configPath: string, config: I18nConfig): Promise<(name: string) => string> {
  if (config.env === false) return getConfigEnv(config);
  const envPaths = config.env
    ? [path.resolve(path.dirname(configPath), config.env)]
    : ['i18n.env', 'i18n.env.local'].map((name) => path.resolve(path.dirname(configPath), name));
  const fileValues: Record<string, string> = {};
  let loaded = false;
  for (const envPath of envPaths) {
    try {
      Object.assign(fileValues, parseEnv(await readFile(envPath, 'utf8')));
      loaded = true;
    } catch (error) {
      if (config.env || (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw contextualError(`Unable to read env file ${displayPath(envPath)}`, error);
      }
    }
  }
  if (config.env && !loaded) return getConfigEnv(config);
  return (name) => {
    const processValue = process.env[name];
    if (processValue !== undefined) return processValue;
    const fileValue = fileValues[name];
    if (fileValue !== undefined) return fileValue;
    throw new Error(`Environment variable "${name}" is not set. Add it to your environment or i18n.env.local.`);
  };
}

function parseEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[match[1]] = value;
  }
  return values;
}

export function prepareConfig(config: I18nConfig) {
  validateConfig(config);
  return {
    ...config,
    root: config.root ?? '.',
    output: config.output ?? 'i18n/data',
    dirs: {
      cache: config.dirs?.cache ?? 'cache.local',
      exports: config.dirs?.exports ?? 'exports',
      translations: config.dirs?.translations ?? 'translations',
    },
  };
}

/** Validate runtime config loaded from JavaScript or external tools. */
export function validateConfig(config: I18nConfig): void {
  const fail = (field: string, expected: string): never => {
    throw new Error(`Invalid i18n config: ${field} ${expected}. Check your config file.`);
  };
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  if (!object(config)) fail('configuration', 'must be an object');
  if (!object(config.languages)) fail('languages', 'must contain source and targets');
  const locale = (value: unknown) => text(value) && /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(value);
  if (!locale(config.languages.source)) fail('languages.source', 'must be a language ID such as "en"');
  if (!Array.isArray(config.languages.targets)) {
    fail('languages.targets', 'must be an array of language IDs, such as ["fr", "de"]');
  }
  for (const id of config.languages.targets) {
    if (!locale(id)) {
      throw new Error(
        `Unsafe target locale in languages.targets: ${JSON.stringify(id)}. Use language IDs such as "fr" or "pt-BR".`,
      );
    }
  }
  if (new Set(config.languages.targets.map((id) => id.toLowerCase())).size !== config.languages.targets.length) {
    fail('languages.targets', 'must not contain duplicate language IDs');
  }
  for (const field of ['root', 'output'] as const) {
    if (config[field] !== undefined && !text(config[field])) fail(field, 'must be a non-empty path');
  }
  if (config.env !== undefined && config.env !== false && !text(config.env)) fail('env', 'must be a path or false');
  if (config.files !== undefined) {
    if (!object(config.files)) fail('files', 'must be an object');
    for (const key of ['includes', 'excludes'] as const) {
      const values = config.files[key];
      if (values !== undefined && (!Array.isArray(values) || !values.every(text))) {
        fail(`files.${key}`, 'must be an array of glob patterns');
      }
    }
  }
  if (config.dirs !== undefined) {
    if (!object(config.dirs)) fail('dirs', 'must be an object');
    for (const [key, value] of Object.entries(config.dirs)) {
      if (!text(value)) fail(`dirs.${key}`, 'must be a non-empty path');
    }
  }
  if (config.catalogFormat !== undefined) {
    const formats = Array.isArray(config.catalogFormat) ? config.catalogFormat : [config.catalogFormat];
    if (!formats.length || formats.some((format) => !['jsonl', 'json', 'cjs', 'mjs'].includes(format))) {
      fail('catalogFormat', 'must contain jsonl, json, cjs, or mjs');
    }
  }
  if (config.translator !== undefined) {
    const providers = Array.isArray(config.translator) ? config.translator : [config.translator];
    for (const [index, provider] of providers.entries()) {
      if (typeof provider === 'function') continue;
      const field = `translator[${index}]`;
      if (!object(provider) || typeof provider.translate !== 'function') {
        fail(field, 'must be a callback or a translator with a translate function');
      }
      if (provider.support !== undefined && typeof provider.support !== 'function') {
        fail(`${field}.support`, 'must be a function');
      }
      if (
        provider.batch !== undefined && provider.batch !== false &&
        (!Number.isInteger(provider.batch) || provider.batch < 1)
      ) fail(`${field}.batch`, 'must be a positive integer or false');
      if (provider.tag !== undefined && typeof provider.tag !== 'boolean') fail(`${field}.tag`, 'must be a boolean');
    }
  }
  if (config.convert !== undefined) {
    if (!Array.isArray(config.convert)) fail('convert', 'must be an array of named converters');
    const names = new Set<string>();
    for (const [index, converter] of config.convert.entries()) {
      if (!object(converter) || !text(converter.name) || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(converter.name)) {
        fail(`convert[${index}].name`, 'must be a converter name such as "json"');
      }
      if (names.has(converter.name)) fail(`convert[${index}].name`, `duplicates "${converter.name}"`);
      names.add(converter.name);
      for (const method of ['import', 'export'] as const) {
        if (converter[method] !== undefined && typeof converter[method] !== 'function') {
          fail(`convert[${index}].${method}`, 'must be a function');
        }
      }
    }
  }
}
