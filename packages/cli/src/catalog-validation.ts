import { compileMessage } from '@fluentic/i18n-compiler';

// Compare semantic ICU contracts, allowing reordered text and locale-specific plural categories.
export function messageContract(message: string): string[] {
  const signatures = new Set<string>();
  function walk(value: ReturnType<typeof compileMessage>): void {
    if (typeof value === 'string') return;
    for (const part of value) {
      if (typeof part === 'string') continue;
      const type = part[0];
      if (type === 4 || type === 5) {
        const branches = type === 4 ? part[2] : part[4];
        signatures.add(JSON.stringify(
          type === 4
            ? [type, part[1], Object.keys(branches).sort()]
            : [type, part[1], part[2], part[3], Object.keys(branches).filter((key) => key.startsWith('=')).sort()],
        ));
        for (const branch of Object.values(branches)) walk(branch);
      } else if (type === 7) {
        signatures.add(JSON.stringify([type, part[1]]));
        walk(part[2]);
      } else signatures.add(JSON.stringify(part));
    }
  }
  walk(compileMessage(message));
  return [...signatures].sort();
}
