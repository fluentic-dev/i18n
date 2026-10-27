import type { TranslationRecord } from './types';

export function serializeJsonl(items: TranslationRecord[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n') + (items.length ? '\n' : '');
}

export function parseJsonl(text: string): TranslationRecord[] {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as TranslationRecord);
}
