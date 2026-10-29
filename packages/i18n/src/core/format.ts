import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { IntlMessageFormat } from 'intl-messageformat';
import { createFormatting } from '../shared/formatting';
import { interpret } from '../shared/interpreter';

const cache = new Map<string, IntlMessageFormat>();
const formatting = /* @__PURE__ */ createFormatting(
  (message, languageId, formats, values, compiled) => {
    if (compiled) return interpret(message, languageId, formats, values, true);
    if (typeof message !== 'string') throw new TypeError('[i18n] invalid translation');

    const key = JSON.stringify([message, languageId, formats]);

    let formatter = cache.get(key);

    if (!formatter) {
      formatter = new IntlMessageFormat(
        message,
        languageId,
        formats as ConstructorParameters<typeof IntlMessageFormat>[2],
      );
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(key, formatter);
    }

    return formatter.formatToParts(values as Parameters<IntlMessageFormat['formatToParts']>[0]).map((part) =>
      part.value
    );
  },
  false,
  (context, message) => bytesToHex(sha256(context ? `${context}\0${message}` : message)).slice(0, 24),
);
export * from '../shared/runtime';

export const getText = (...args: Parameters<typeof formatting.getText>) => formatting.getText(...args);
export const getJsx = (...args: Parameters<typeof formatting.getJsx>) => formatting.getJsx(...args);
export const getMessageParts = (...args: Parameters<typeof formatting.getMessageParts>) =>
  formatting.getMessageParts(...args);
export const formatMessage = getText;
