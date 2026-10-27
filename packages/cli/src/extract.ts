import { collectMessages } from '@fluentic/i18n/compiler';
import type { MessageRecord } from './types';
export type ExtractOptions = { imports?: string[]; };
export function extractMessages(code: string, fileName: string, options: ExtractOptions = {}): MessageRecord[] {
  return collectMessages(code, fileName, options.imports) as MessageRecord[];
}
