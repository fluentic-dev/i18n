import { displayPath } from './display-path';

/** Render failures without exposing a JavaScript stack in normal CLI output. */
export function errorMessage(error: unknown): string {
  let message: string;
  if (error instanceof Error) {
    const system = error as NodeJS.ErrnoException;
    const location = system.path ? `: ${displayPath(system.path)}` : '';
    if (system.code === 'ENOENT') {
      return `File or folder not found${location}. Check the path and run extract if catalogs have not been created.`;
    }
    if (system.code === 'EACCES' || system.code === 'EPERM') {
      return `Permission denied${location}. Check that this location is readable and writable.`;
    }
    if (system.code === 'ENOTDIR') return `Expected a folder${location}. Check the configured path.`;
    if (system.code === 'EISDIR') return `Expected a file${location}. The path points to a folder.`;
    message = error.message;
    if (message === 'fetch failed') {
      return 'Could not reach the translation service. Check your connection and the configured endpoint.';
    }
  } else if (typeof error === 'string') message = error;
  else if (error && typeof error === 'object' && 'message' in error) message = String(error.message);
  else message = 'An unexpected error occurred. Run again with --debug for technical details.';
  return message.split('\n').filter((line) => !/^\s*at\s/.test(line)).join('\n').replace(/^\[i18n\]\s*/, '').trim() ||
    'An unexpected error occurred.';
}

export function contextualError(context: string, error: unknown, details?: Record<string, string>): Error {
  if (error instanceof DiagnosticError) {
    return new DiagnosticError(`${context}: ${error.message}`, { ...details, ...error.details }, { cause: error });
  }
  return new Error(`${context}: ${errorMessage(error)}`, { cause: error });
}

/** Preserve a complete API error while rendering copyable CLI guidance separately. */
export class GuidanceError extends Error {
  constructor(readonly summary: string, readonly title: string, readonly body: string) {
    super(`${summary}\n\n${title}:\n${body}`);
  }
}

/** Human-readable API message plus structured terminal diagnostics. */
export class DiagnosticError extends Error {
  constructor(message: string, readonly details: Record<string, string>, options?: ErrorOptions) {
    super(message, options);
  }
}
