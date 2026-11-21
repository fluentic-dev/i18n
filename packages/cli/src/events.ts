import { errorMessage } from './errors';

export type RunEvent =
  | { type: 'phase:start'; phase: string; }
  | { type: 'phase:end'; phase: string; summary?: string; }
  | { type: 'file:processed'; file: string; }
  | { type: 'message:translated'; id: string; languageId: string; }
  | { type: 'info'; message: string; }
  | { type: 'warning'; message: string; }
  | { type: 'error'; error: unknown; };

export type Reporter = (event: RunEvent) => void;

export function createConsoleReporter(
  write: (text: string) => void = console.log,
  writeError: (text: string) => void = write,
): Reporter {
  return (event) => {
    switch (event.type) {
      case 'phase:start':
        write(`[${event.phase}]`);
        break;
      case 'phase:end':
        write(`[done] ${event.phase}${event.summary ? `: ${event.summary}` : ''}`);
        break;
      case 'file:processed':
        write(`[file] ${event.file}`);
        break;
      case 'message:translated':
        write(`[translated] ${event.languageId} ${event.id}`);
        break;
      case 'info':
        write(event.message);
        break;
      case 'warning':
        writeError(`[warning] ${event.message}`);
        break;
      case 'error':
        writeError(`[error] ${errorMessage(event.error)}`);
        break;
    }
  };
}
