import { displayPath } from './display-path';
import { DiagnosticError, errorMessage, GuidanceError } from './errors';

export type RunEvent =
  | { type: 'phase:start'; phase: string; separateBody?: boolean; }
  | { type: 'phase:end'; phase: string; summary?: string; details?: Record<string, string>; separateDetails?: boolean; }
  | { type: 'file:processed'; file: string; }
  | { type: 'message:translated'; id: string; languageId: string; }
  | { type: 'info'; message: string; details?: Record<string, string>; block?: string; }
  | { type: 'warning'; message: string; details?: string[]; }
  | { type: 'error'; error: unknown; context?: string; details?: Record<string, string>; };

export type Reporter = (event: RunEvent) => void;

export interface ConsoleReporterOptions {
  /** Override terminal color detection for both output streams. */
  color?: boolean;
  /** Include individual files and translated message IDs. */
  verbose?: boolean;
  /** Base directory for displayed file paths. Defaults to process.cwd(). */
  cwd?: string;
}

function supportsColor(stream: NodeJS.WriteStream): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return process.env.FORCE_COLOR !== '0';
  return Boolean(stream.isTTY) && process.env.TERM !== 'dumb';
}

export function createConsoleReporter(
  write: (text: string) => void = console.log,
  writeError: (text: string) => void = write,
  options: ConsoleReporterOptions = {},
): Reporter {
  const output = write;
  const diagnostics = writeError;
  let hasOutput = false;
  let lastBlank = true;
  let lastPhaseEnded = false;
  const remember = (text: string) => {
    hasOutput = true;
    lastBlank = text === '' || text.endsWith('\n');
  };
  write = (text) => {
    remember(text);
    output(text);
  };
  writeError = (text) => {
    remember(text);
    diagnostics(text);
  };
  const blank = (error = false) => {
    if (hasOutput && !lastBlank) (error ? writeError : write)('');
  };
  const color = options.color ?? supportsColor(process.stdout);
  const errorColor = options.color ?? supportsColor(process.stderr);
  const paint = (text: string, code: number, enabled = color) => enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
  const phases: Array<{ name: string; started: number; }> = [];
  const indent = () => '  '.repeat(phases.length);
  const detail = (label: string, value: string) => `${paint(`${label}:`.padEnd(12), 2)} ${value}`;
  const tagged = (tag: string, message: string, code: number, error = false) => {
    const column = ['INFO', 'WARN', 'GUIDE', 'FILE', 'TRANSLATED'].includes(tag) ? 13 : tag.length + 2;
    const prefix = `${indent()}${paint(tag, code, error ? errorColor : color)}${' '.repeat(column - tag.length)}`;
    const continuation = `${indent()}${' '.repeat(column)}`;
    (error ? writeError : write)(prefix + message.replace(/\n/g, `\n${continuation}`));
  };
  const block = (title: string, body: string, error = false) => {
    tagged('GUIDE', title, 36, error);
    // Keep copyable instructions free of status prefixes and ANSI sequences.
    (error ? writeError : write)(`\n${body.trimEnd()}\n`);
  };
  return (event) => {
    switch (event.type) {
      case 'phase:start':
        blank();
        write(`${indent()}${paint('RUN', 36)}  ${paint(event.phase, 1)}`);
        if (event.separateBody) blank();
        lastPhaseEnded = false;
        phases.push({ name: event.phase, started: performance.now() });
        break;
      case 'phase:end': {
        if (lastPhaseEnded || event.separateDetails) blank();
        if (event.details) {
          for (const [label, value] of Object.entries(event.details)) write(`${indent()}${detail(label, value)}`);
        }
        if (event.summary && !event.details) write(`${indent()}${event.summary.replace(/\n/g, `\n${indent()}`)}`);
        const index = phases.map((phase) => phase.name).lastIndexOf(event.phase);
        const phase = index >= 0 ? phases.splice(index, 1)[0] : undefined;
        const elapsed = phase ? performance.now() - phase.started : undefined;
        const duration = elapsed === undefined
          ? ''
          : elapsed < 1000
          ? `${Math.round(elapsed)} ms`
          : `${(elapsed / 1000).toFixed(2)} s`;
        blank();
        tagged('DONE', `${paint(event.phase, 1)}${duration ? ` ${paint(`(${duration})`, 2)}` : ''}`, 32);
        lastPhaseEnded = true;
        break;
      }
      case 'file:processed':
        if (options.verbose) tagged('FILE', displayPath(event.file, options.cwd), 2);
        break;
      case 'message:translated':
        if (options.verbose) tagged('TRANSLATED', `${event.languageId} ${event.id}`, 2);
        break;
      case 'info': {
        if (event.block !== undefined) {
          block(event.message, event.block);
          break;
        }
        if (event.details) {
          for (const [label, value] of Object.entries(event.details)) {
            write(`${indent()}${detail(label, value)}`);
          }
          break;
        }
        let separated = false;
        for (const line of event.message.split('\n')) {
          const match = /^([^:]{1,20}): (.*)$/.exec(line);
          if (match) write(`${indent()}${detail(match[1], match[2])}`);
          else {
            if (!separated) blank();
            tagged('INFO', line, 36);
            separated = true;
          }
        }
        break;
      }
      case 'warning':
        tagged('WARN', event.message, 33, true);
        if (event.details?.length) {
          if (options.verbose) {
            for (const line of event.details) writeError(`${indent()}  ${line}`);
          } else writeError(`${indent()}  Use --verbose to list affected keys.`);
        }
        break;
      case 'error': {
        blank(true);
        phases.length = 0;
        const message = event.error instanceof GuidanceError ? event.error.summary : errorMessage(event.error);
        const diagnostic = event.error instanceof DiagnosticError ? event.error.details : undefined;
        tagged('ERROR', event.context ?? (diagnostic ? 'Command failed' : message), 31, true);
        const details = { ...(diagnostic ?? (event.context ? { Reason: message } : {})), ...event.details };
        if (Object.keys(details).length) {
          blank(true);
          for (const [label, value] of Object.entries(details)) {
            const prefix = `  ${paint(`${label}:`.padEnd(12), 2, errorColor)} `;
            const continuation = ' '.repeat(15);
            const width = Math.max(20, (process.stderr.columns || 100) - 15);
            const lines = value.split('\n').flatMap((line) => {
              const wrapped: string[] = [];
              let current = '';
              for (const word of line.split(/\s+/)) {
                if (current && current.length + word.length + 1 > width) {
                  wrapped.push(current);
                  current = '';
                }
                current += (current ? ' ' : '') + word;
              }
              wrapped.push(current);
              return wrapped;
            });
            writeError(prefix + lines.join(`\n${continuation}`));
          }
        }
        if (event.error instanceof GuidanceError) block(event.error.title, event.error.body, true);
        break;
      }
    }
  };
}
