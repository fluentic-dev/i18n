import { IntlMessageFormat } from 'intl-messageformat';
import { createFormatting } from '../shared/formatting';
const cache = new Map<string, IntlMessageFormat>();
const formatting = /* @__PURE__ */ createFormatting((message, languageId, formats, values) => {
  if (typeof message !== 'string') throw new TypeError('[i18n] compact catalogs require the compiled runtime');
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
  return formatter.formatToParts(values as Parameters<IntlMessageFormat['formatToParts']>[0]).map((part) => part.value);
});
export * from '../shared/runtime';

export const getText = (...args: Parameters<typeof formatting.getText>) => formatting.getText(...args);
export const getJsx = (...args: Parameters<typeof formatting.getJsx>) => formatting.getJsx(...args);
export const getMessageParts = (...args: Parameters<typeof formatting.getMessageParts>) =>
  formatting.getMessageParts(...args);
export const formatMessage = getText;
