/** Compact message format v1. Strings are literal messages or literal parts. */
export type CompactMessage = string | CompactPart[];
export type CompactPart =
  | string
  | [0, string]
  | [1, string, string | Record<string, unknown> | null]
  | [2 | 3, string, string | Record<string, unknown> | null]
  | [4, string, Record<string, CompactMessage>]
  | [5, string, number, 0 | 1, Record<string, CompactMessage>]
  | [6]
  | [7, string, CompactMessage];
export const COMPACT_VERSION = 1;
export function validateCompact(value: unknown, depth = 0): asserts value is CompactMessage {
  if (depth > 100) throw new TypeError('[i18n] compact message nesting exceeds 100');
  if (typeof value === 'string') return;
  if (!Array.isArray(value)) throw new TypeError('[i18n] invalid compact message');
  for (const part of value) {
    if (typeof part === 'string') continue;
    if (!Array.isArray(part)) throw new TypeError('[i18n] invalid compact instruction');
    const [op, name] = part;
    const lengths: Record<number, number> = { 0: 2, 1: 3, 2: 3, 3: 3, 4: 3, 5: 5, 6: 1, 7: 3 };
    if (
      !Object.prototype.hasOwnProperty.call(lengths, op) || part.length !== lengths[op] ||
      (op !== 6 && typeof name !== 'string')
    ) throw new TypeError('[i18n] invalid compact opcode');
    if (
      op >= 1 && op <= 3 && part[2] !== null && typeof part[2] !== 'string' &&
      (typeof part[2] !== 'object' || Array.isArray(part[2]))
    ) throw new TypeError('[i18n] invalid compact format');
    if (op === 5 && (typeof part[2] !== 'number' || !Number.isFinite(part[2]) || ![0, 1].includes(part[3]))) {
      throw new TypeError('[i18n] invalid compact plural');
    }
    if (op === 4 || op === 5) {
      const branches = part[op === 4 ? 2 : 4];
      if (
        !branches || typeof branches !== 'object' || Array.isArray(branches) ||
        !Object.prototype.hasOwnProperty.call(branches, 'other')
      ) throw new TypeError('[i18n] missing other branch');
      for (const child of Object.values(branches)) validateCompact(child, depth + 1);
    }
    if (op === 7) validateCompact(part[2], depth + 1);
  }
}
