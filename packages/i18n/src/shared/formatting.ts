import { isMessageDescriptor, isMessageSchemaValue, isMessageTagHandler } from '../core/types';
import type { MessageFormatOptions, MessageParam } from '../core/types';
import type { CompactMessage } from './compact';
import { type Formats, getFormats, getRuntime, type Runtime } from './runtime';

export type Engine = (
  message: CompactMessage,
  languageId: string,
  formats: Partial<Formats>,
  values: Record<string, unknown>,
  compiled: boolean,
) => unknown[];

export type Formatting = ReturnType<typeof createFormatting>;

export function createFormatting(
  engine: Engine,
  compiled = false,
  getCompiledId?: (context: string | null, message: string) => string,
) {
  const getMessageParts = (options: MessageFormatOptions, runtime = getRuntime(), jsx = false): unknown[] => {
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
        getCompiledId: getCompiledId && !descriptor.compiled
          ? () => getCompiledId(descriptor.context, descriptor.text)
          : undefined,
      })
      : null;
    const compiledTranslation = typeof translated === 'object' && translated !== null && !Array.isArray(translated);
    if (compiled && typeof translated === 'string') {
      throw new TypeError('[i18n] compiled runtime requires compiled translations');
    }

    const message = compiledTranslation
      ? translated.compiled
      : translated ?? descriptor.compiled?.[1] ?? descriptor.text;
    const isCompiled = compiled || compiledTranslation || Array.isArray(message);
    const values: Record<string, unknown> = {};

    const resolve = (value: MessageParam): unknown => {
      if (isMessageTagHandler(value)) return value;
      if (isMessageSchemaValue(value)) {
        throw new Error('[i18n] Message parameter schemas are only valid in t.msg(); pass a real value');
      }
      if (typeof value === 'function') return resolve(value({ languageId }) as MessageParam);
      if (isMessageDescriptor(value)) return getText({ msg: value, languageId }, runtime);

      return value;
    };

    for (const [key, value] of Object.entries(options.params ?? {})) values[key] = resolve(value);
    values.break = jsx ? runtime.jsxLineBreak : '\n';

    for (const [key, expected] of Object.entries(descriptor.schema)) {
      if (key !== 'break' && (!options.params || options.params[key] === undefined)) {
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

    return engine(message, languageId, getFormats(runtime, languageId), values, isCompiled);
  };

  const getText = (options: MessageFormatOptions, runtime = getRuntime()): string => {
    const parts = getMessageParts(options, runtime);

    if (parts.some((part) => typeof part !== 'string')) {
      throw new Error('[i18n] t.text() received a non-text rich value; use t.jsx() instead');
    }

    return parts.join('');
  };

  const getJsx = (options: MessageFormatOptions): unknown => {
    const runtime = getRuntime();

    if (!runtime.jsxHandler) throw new Error('[i18n] JSX renderer is not configured; initialize a platform adapter');
    // Capture notranslate at element creation, not at React's later render.
    const enabled = runtime.translationsEnabled;

    return runtime.jsxHandler(
      options,
      (current = getRuntime()) =>
        getMessageParts(options, enabled ? current : { ...current, translationsEnabled: false }, true),
    );
  };

  return { getText, getJsx, getMessageParts, formatMessage: getText };
}
