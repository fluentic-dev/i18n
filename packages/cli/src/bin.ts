#!/usr/bin/env node

import { Command, CommanderError } from 'commander';
import { createJiti } from 'jiti';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { inspect } from 'node:util';
import { isConfig, loadConfigEnv, registerConfigEnv, validateConfig } from './config';
import { displayPath } from './display-path';
import { contextualError } from './errors';
import { createConsoleReporter, type Reporter } from './events';
import { lint } from './lint';
import { conflict, exportTranslations, extract, importTranslations, merge, translateAuto, update } from './run';

const program = new Command();
program.name('fluentic-i18n').description('Fluentic i18n extraction and catalog tooling.').option(
  '-c, --config <file>',
  'Config file',
).option('--debug', 'Show technical error details')
  .option('-v, --verbose', 'Show individual files and translated message IDs')
  .option('--no-color', 'Disable colored output')
  .exitOverride();
let commandName = 'command';
program.hook('preAction', (_parent, command) => {
  commandName = command.name();
});
let lastOutput: { error: boolean; text: string; } | undefined;
function writeOutput(text: string, error = false): void {
  (error ? process.stderr : process.stdout).write(text);
  lastOutput = { error, text: ((lastOutput?.text ?? '') + text).slice(-2) };
}
let activeReporter: Reporter | undefined;
const reporter = () =>
  activeReporter ??= createConsoleReporter(
    (line) => writeOutput(line + '\n'),
    (line) => writeOutput(line + '\n', true),
    {
      verbose: program.opts().verbose,
      color: program.opts().color === false ? false : undefined,
    },
  );

async function loadConfig() {
  const requested = program.opts().config as string | undefined;
  const configPath = requested ? path.resolve(requested) : await findDefaultConfig();
  try {
    await access(configPath);
    const config = await createJiti(import.meta.url).import(configPath, { default: true });
    if (!isConfig(config)) throw new Error('Export a default config using defineConfig(...).');
    validateConfig(config);
    registerConfigEnv(config, await loadConfigEnv(configPath, config));
    reporter()({ type: 'info', message: `Config: ${displayPath(configPath)}` });
    return config;
  } catch (error) {
    throw contextualError(`Could not load config ${displayPath(configPath)}`, error);
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

program.command('lint')
  .description('Check source messages, parameters, extraction drift, and translation catalogs without writing files')
  .option('--strict', 'Exit with a failure when warnings are reported')
  .action(async (options: { strict?: boolean; }) => {
    const result = await lint(await loadConfig(), reporter());
    if (result.errors || (options.strict && result.warnings)) process.exitCode = 1;
  });

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

for (const command of [program, ...program.commands]) {
  command.configureOutput({
    writeOut: (text) => writeOutput(text),
    writeErr: (text) => writeOutput(text, true),
    outputError: (message) => {
      const name = command.name();
      const invocation = command === program ? program.name() : `${program.name()} ${name}`;
      const exchange = name === 'import' || name === 'export';
      const explanation = exchange && /^error: too many arguments/.test(message)
        ? `${name} accepts one converter. Run import and export as separate commands.`
        : message.replace(/^error:\s*/, '').trim().replace(/^./, (character) => character.toUpperCase());
      reporter()({
        type: 'error',
        error: explanation,
        details: {
          Usage: `${invocation} ${command.usage()}`,
          ...(exchange ? { Example: `${invocation} handoff` } : {}),
          Help: `${invocation} --help`,
        },
      });
    },
  });
}

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    reporter()({ type: 'error', error, context: `${commandName} failed` });
    if (program.opts().debug) writeOutput(inspect(error) + '\n', true);
    process.exitCode = 1;
  }
} finally {
  // Finish the entire invocation, including help and debug output, exactly once.
  // Nested phase completion never owns this final separator.
  if (lastOutput && !lastOutput.text.endsWith('\n\n')) {
    writeOutput(lastOutput.text.endsWith('\n') ? '\n' : '\n\n', lastOutput.error);
  }
}
