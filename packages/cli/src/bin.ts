#!/usr/bin/env node

import { Command } from 'commander';
import { createJiti } from 'jiti';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { isConfig, loadConfigEnv, registerConfigEnv } from './config';
import { createConsoleReporter } from './events';
import { exportTranslations, extract, importTranslations, merge, translateAuto, update } from './run';

const program = new Command();
program.name('fluentic-i18n').description('Fluentic i18n extraction and catalog tooling.').option(
  '-c, --config <file>',
  'Config file',
);

async function loadConfig() {
  const requested = program.opts().config as string | undefined;
  const configPath = requested ? path.resolve(requested) : await findDefaultConfig();
  const config = await createJiti(import.meta.url).import(configPath, { default: true });
  if (!isConfig(config)) throw new Error('Invalid i18n config: use defineConfig(...)');
  registerConfigEnv(config, await loadConfigEnv(configPath, config));
  return config;
}

async function findDefaultConfig(): Promise<string> {
  for (const name of ['i18n.config.ts', 'i18n.config.js']) {
    const candidate = path.resolve(name);
    try {
      await access(candidate);
      return candidate;
    } catch { /* try the next supported extension */ }
  }
  throw new Error('No i18n.config.ts or i18n.config.js found. Pass --config <file>.');
}

for (
  const [name, action] of [['extract', extract], ['merge', merge], ['translate', translateAuto], [
    'update',
    update,
  ]] as const
) {
  program.command(name).action(async () => {
    const config = await loadConfig();
    await action(config, createConsoleReporter());
  });
}

for (const [name, action] of [['export', exportTranslations], ['import', importTranslations]] as const) {
  program.command(`${name} <converter>`).action(async (converter: string) => {
    const config = await loadConfig();
    await action(config, converter, createConsoleReporter());
  });
}

await program.parseAsync();
