#!/usr/bin/env node

import { Command, CommanderError } from 'commander';
import { createJiti } from 'jiti';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { isConfig, loadConfigEnv, registerConfigEnv, validateConfig } from './config';
import { contextualError, errorMessage } from './errors';
import { createConsoleReporter } from './events';
import { conflict, exportTranslations, extract, importTranslations, merge, translateAuto, update } from './run';

const program = new Command();
program.name('fluentic-i18n').description('Fluentic i18n extraction and catalog tooling.').option(
  '-c, --config <file>',
  'Config file',
).option('--debug', 'Show technical error details').exitOverride();
let commandName = 'command';
program.hook('preAction', (_parent, command) => {
  commandName = command.name();
});
const reporter = () => createConsoleReporter(console.log, console.error);

async function loadConfig() {
  const requested = program.opts().config as string | undefined;
  const configPath = requested ? path.resolve(requested) : await findDefaultConfig();
  try {
    await access(configPath);
    const config = await createJiti(import.meta.url).import(configPath, { default: true });
    if (!isConfig(config)) throw new Error('Export a default config using defineConfig(...).');
    validateConfig(config);
    registerConfigEnv(config, await loadConfigEnv(configPath, config));
    console.log(`Config: ${configPath}`);
    return config;
  } catch (error) {
    throw contextualError(`Could not load config ${configPath}`, error);
  }
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

const descriptions = {
  extract: 'Scan source files and synchronize message catalogs (uses the extraction cache)',
  merge: 'Build runtime catalogs from manual and automatic translations',
  conflict: 'Rebuild catalogs after resolving authoring-file conflicts',
  translate: 'Translate missing messages using the configured providers',
  update: 'Extract messages, translate missing entries, and rebuild catalogs',
};

for (
  const [name, action] of [
    ['extract', extract],
    ['merge', merge],
    ['conflict', conflict],
    ['translate', translateAuto],
    [
      'update',
      update,
    ],
  ] as const
) {
  program.command(name).description(descriptions[name]).action(async () => {
    const config = await loadConfig();
    await action(config, reporter());
  });
}

for (const [name, action] of [['export', exportTranslations], ['import', importTranslations]] as const) {
  program.command(`${name} <converter>`)
    .description(
      `${name === 'export' ? 'Export' : 'Import'} translations: json, csv, xliff, handoff, or a configured converter`,
    )
    .option(
      name === 'export' ? '--output <folder>' : '--input <folder>',
      'Exchange folder (default: <output>/<dirs.exports>/<converter>)',
    )
    .action(async (converter: string, options: { output?: string; input?: string; }) => {
      await action(await loadConfig(), converter, reporter(), {
        directory: options.output ?? options.input,
      });
    });
}

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    console.error(`[error] ${commandName} failed: ${errorMessage(error)}`);
    if (program.opts().debug) console.error(error);
    process.exitCode = 1;
  }
}
