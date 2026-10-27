import type { TranslationRecord } from './types';

export function hashText(text: string): number {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return hash >>> 0;
}

export function hashTranslations(items: TranslationRecord[]): number {
  return hashText(items.map((item) => JSON.stringify([item.id, item.translation])).join('\n'));
}

export function createTranslationHash(itemsByLanguage: Record<string, TranslationRecord[]>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(itemsByLanguage).map(([languageId, items]) => [languageId, hashTranslations(items)]),
  );
}
