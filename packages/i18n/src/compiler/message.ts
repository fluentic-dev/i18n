import { type MessageFormatElement, parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { createHash } from 'node:crypto';
import type { CompactMessage, CompactPart } from '../shared/compact';
export { COMPACT_VERSION } from '../shared/compact';
export function messageIdentity(context: string | null, source: string): string {
  return context ? `${context}\0${source}` : source;
}
export function messageId(context: string | null, source: string): string {
  return createHash('sha256').update(messageIdentity(context, source)).digest('hex').slice(0, 24);
}
export function compileMessage(source: string): CompactMessage {
  function compact(elements: MessageFormatElement[]): CompactMessage {
    const result: CompactPart[] = elements.map((element): CompactPart => {
      switch (element.type) {
        case TYPE.literal:
          return element.value;
        case TYPE.argument:
          return [0, element.value];
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          return [
            element.type === TYPE.number ? 1 : element.type === TYPE.date ? 2 : 3,
            element.value,
            typeof element.style === 'object' && element.style
              ? element.style.parsedOptions as Record<string, unknown>
              : element.style ?? null,
          ];
        case TYPE.select:
          return [
            4,
            element.value,
            Object.fromEntries(Object.entries(element.options).map(([key, option]) => [key, compact(option.value)])),
          ];
        case TYPE.plural:
          return [
            5,
            element.value,
            element.offset,
            element.pluralType === 'ordinal' ? 1 : 0,
            Object.fromEntries(Object.entries(element.options).map(([key, option]) => [key, compact(option.value)])),
          ];
        case TYPE.pound:
          return [6];
        case TYPE.tag:
          return [7, element.value, compact(element.children)];
      }
    });
    return result.every((part) => typeof part === 'string') ? result.join('') : result;
  }
  return compact(parse(source, { captureLocation: false }));
}
export function compileCatalog(
  records: Array<{ source: string; context: string | null; translation: string; }>,
): Array<[string, CompactMessage]> {
  const seen = new Map<string, string>();
  return records.flatMap((record) => {
    const id = messageId(record.context, record.source);
    const identity = messageIdentity(record.context, record.source);
    if (seen.has(id) && seen.get(id) !== identity) throw new Error('[i18n] message hash collision: ' + id);
    seen.set(id, identity);
    return record.translation === '' ? [] : [[id, compileMessage(record.translation)] as [string, CompactMessage]];
  });
}
