import { isMessageDescriptor, isMessageSchemaValue, isMessageTagHandler } from '../core/types';
import type { MessageFormatOptions, MessageParam } from '../core/types';
import type { CompactMessage } from './compact';
import { type Formats, getFormats, getRuntime, type Runtime } from './runtime';
export type Engine = (
  message: CompactMessage,
  languageId: string,
  formats: Partial<Formats>,
  values: Record<string, unknown>,
) => unknown[];
export type Formatting = ReturnType<typeof createFormatting>;
export function createFormatting(engine: Engine, compiled = false) {
  function getMessageParts(options: MessageFormatOptions, runtime = getRuntime()): unknown[] {
    if (!runtime.ready) throw new Error('[i18n] runtime is not ready; await adapter initialization before rendering');
    const languageId = options.languageId ?? runtime.languageId;
    const descriptor = isMessageDescriptor(options.msg)
      ? options.msg
      : { text: options.msg, context: null, schema: {}, compiled: undefined };
    if (compiled && !descriptor.compiled) {
      throw new TypeError('[i18n] compiled runtime requires compiled messages; enable the Fluentic plugin');
    }
    const key = descriptor.compiled?.[0] ?? descriptor.text;
    const translated = runtime.translationsEnabled
      ? runtime.translationGetter?.({
        languageId,
        context: descriptor.compiled ? null : descriptor.context,
        message: key,
      })
      : null;
    const message = translated ?? descriptor.compiled?.[1] ?? descriptor.text;
    const values: Record<string, unknown> = {};
    function resolve(value: MessageParam): unknown {
      if (isMessageTagHandler(value)) return value;
      if (isMessageSchemaValue(value)) {
        throw new Error('[i18n] Message parameter schemas are only valid in t.msg(); pass a real value');
      }
      if (typeof value === 'function') return resolve(value({ languageId }) as MessageParam);
      if (isMessageDescriptor(value)) return getText({ msg: value, languageId }, runtime);
      return value;
    }
    for (const [key, value] of Object.entries(options.params ?? {})) values[key] = resolve(value);
    for (const [key, expected] of Object.entries(descriptor.schema)) {
      if (!options.params || options.params[key] === undefined) {
        throw new Error('[i18n] Missing required message parameter: ' + key);
      }
      const value = values[key];
      const valid = expected === String
        ? typeof value === 'string'
        : expected === Number
        ? typeof value === 'number'
        : expected === Boolean
        ? typeof value === 'boolean'
        : expected === Date
        ? value instanceof Date && !Number.isNaN(value.getTime())
        : true;
      if (!valid) {
        throw new Error('[i18n] Message parameter "' + key + '" must be a ' + (expected as { name: string; }).name);
      }
    }
    return engine(message, languageId, getFormats(runtime, languageId), values);
  }
  function getText(options: MessageFormatOptions, runtime = getRuntime()): string {
    const parts = getMessageParts(options, runtime);
    if (parts.some((part) => typeof part !== 'string')) {
      throw new Error('[i18n] t.text() received a non-text rich value; use t.jsx() instead');
    }
    return parts.join('');
  }
  function getJsx(options: MessageFormatOptions): unknown {
    const runtime = getRuntime();
    if (!runtime.jsxHandler) throw new Error('[i18n] JSX renderer is not configured; initialize a platform adapter');
    // Capture notranslate at element creation, not at React's later render.
    const enabled = runtime.translationsEnabled;
    return runtime.jsxHandler(
      options,
      (current = getRuntime()) =>
        getMessageParts(options, enabled ? current : { ...current, translationsEnabled: false }),
    );
  }
  return { getText, getJsx, getMessageParts, formatMessage: getText };
}
