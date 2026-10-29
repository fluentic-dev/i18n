import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Converter, JsonValue, Translator } from './types';

export type CatalogFormat = 'jsonl' | 'json' | 'cjs' | 'mjs';

export type I18nConfig = {
  /** Emit [hash, compact AST] merged rows and enable build transforms. */
  compiled?: boolean;
  /** Formats written for each merged runtime catalog. Defaults to jsonl. */
  catalogFormat?: CatalogFormat | CatalogFormat[];
  /** Environment file relative to this config file. Defaults to i18n.env and i18n.env.local. */
  env?: string | false;
  root?: string;
  output?: string;
  languages: { source: string; targets: string[]; };
  /** Ordered translation providers. The first provider supporting a language pair is used. */
  translator?: Translator | Translator[];
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
    if (value === undefined) throw new Error(`Environment variable "${name}" is not set`);
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
      if (config.env) throw new Error(`Unable to read configured env file: ${envPath}: ${String(error)}`);
    }
  }
  if (config.env && !loaded) return getConfigEnv(config);
  return (name) => {
    const processValue = process.env[name];
    if (processValue !== undefined) return processValue;
    const fileValue = fileValues[name];
    if (fileValue !== undefined) return fileValue;
    throw new Error(`Environment variable "${name}" is not set`);
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
  return {
    ...config,
    root: config.root ?? '.',
    output: config.output ?? 'i18n/data',
    dirs: {
      cache: config.dirs?.cache ?? 'cache',
      exports: config.dirs?.exports ?? 'exports',
      translations: config.dirs?.translations ?? 'translations',
    },
  };
}
