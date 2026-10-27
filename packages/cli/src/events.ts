export type RunEvent =
  | { type: 'phase:start'; phase: string; }
  | { type: 'phase:end'; phase: string; }
  | { type: 'file:processed'; file: string; }
  | { type: 'message:translated'; id: string; languageId: string; }
  | { type: 'warning'; message: string; }
  | { type: 'error'; error: unknown; };

export type Reporter = (event: RunEvent) => void;

export function createConsoleReporter(write: (text: string) => void = console.log): Reporter {
  return (event) => {
    switch (event.type) {
      case 'phase:start':
        write(`[${event.phase}]`);
        break;
      case 'phase:end':
        write(`[done] ${event.phase}`);
        break;
      case 'file:processed':
        write(`[file] ${event.file}`);
        break;
      case 'message:translated':
        write(`[translated] ${event.languageId} ${event.id}`);
        break;
      case 'warning':
        write(`[warning] ${event.message}`);
        break;
      case 'error':
        write(`[error] ${String(event.error)}`);
        break;
    }
  };
}
