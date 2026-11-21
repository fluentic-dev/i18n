export function serializeJsonl(items: unknown[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n') + (items.length ? '\n' : '');
}

export function parseJsonl(text: string): unknown[] {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as unknown];
    } catch {
      throw new Error(`Invalid JSON on line ${index + 1}. Fix this line and run the command again.`);
    }
  });
}
