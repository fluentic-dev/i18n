import type { Formatting } from '../shared/formatting';
import { createTagHandler, getRuntime, noTranslate } from '../shared/runtime';
import type { I18nJsxOutput, I18nTagElement, I18nTagValue } from './types';
import { isMessageDescriptor } from './types';
import type {
  JsxRenderer,
  MessageDescriptor,
  MessageInput,
  MessageMeta,
  MessageParams,
  MessageSchema,
  MessageTagHandler,
  TextRenderer,
  TryRenderArgs,
} from './types';

type MessageScope = { context: string | null; notes: string[]; meta?: MessageMeta; };

export type MessageApi<JsxOutput = unknown> = {
  context(name: string): MessageApi<JsxOutput>;
  note(note: string): MessageApi<JsxOutput>;
  meta(meta: MessageMeta): MessageApi<JsxOutput>;
  msg<const Text extends string, const Schema extends MessageSchema | undefined = undefined>(
    message: Text,
    schema?: Schema,
  ): MessageDescriptor<Text, Schema>;
  text: TextRenderer;
  jsx: JsxRenderer<JsxOutput>;
};

export type TApi<JsxOutput = unknown, TagValue = unknown> = MessageApi<JsxOutput> & {
  clone<const Text extends string, const Schema extends MessageSchema | undefined>(
    message: MessageDescriptor<Text, Schema>,
  ): MessageDescriptor<Text, Schema>;
  params<Params extends MessageParams>(params?: Params | null): Params;
  tag(element: I18nTagElement): MessageTagHandler<I18nTagValue, I18nTagElement>;
  tag<T = TagValue, R = TagValue>(handler: (chunks: Array<string | T>) => R): MessageTagHandler<T, R>;
  try<T>(
    renderer: TextRenderer,
    value: T,
    ...args: TryRenderArgs<T>
  ): T extends { readonly __fluenticMessage: true; } ? string : T;
  try<T>(
    renderer: JsxRenderer<JsxOutput>,
    value: T,
    ...args: TryRenderArgs<T>
  ): T extends { readonly __fluenticMessage: true; } ? JsxOutput : T;
  notranslate: typeof noTranslate;
};

export function createT({ getText, getJsx }: Formatting): TApi<I18nJsxOutput, I18nTagValue> {
  const createScope = (scope: MessageScope): MessageApi => {
    return {
      context(name) {
        return createScope({ ...scope, context: scope.context ? `${scope.context}.${name}` : name });
      },
      note(note) {
        return createScope({ ...scope, notes: [...scope.notes, note] });
      },
      meta(meta) {
        return createScope({ ...scope, meta });
      },
      msg(message, schema) {
        return createDescriptor(message, schema, scope);
      },
      text(message: MessageInput, params?: MessageParams) {
        return getText(toFormatOptions(message, params, scope));
      },
      jsx(message: MessageInput, params?: MessageParams) {
        return getJsx(toFormatOptions(message, params, scope));
      },
    };
  };

  const createDescriptor = <const Text extends string, const Schema extends MessageSchema | undefined>(
    message: Text,
    schema: Schema | undefined,
    scope: MessageScope,
  ): MessageDescriptor<Text, Schema> => {
    return Object.freeze({
      __fluenticMessage: true,
      text: Array.isArray(message) ? message[0] : message,
      ...(Array.isArray(message) ? { compiled: message } : {}),
      context: scope.context,
      schema: schema ?? {},
      notes: scope.notes,
      meta: scope.meta,
    }) as unknown as MessageDescriptor<Text, Schema>;
  };

  const toFormatOptions = (message: MessageInput, params: MessageParams | undefined, scope: MessageScope) => {
    if (isMessageDescriptor(message)) return { msg: message, params };

    return { msg: createDescriptor(message, undefined, scope), params };
  };

  const rootScope = createScope({ context: null, notes: [] });

  return Object.assign(rootScope, {
    clone(message: MessageDescriptor) {
      return Object.freeze({ ...message });
    },
    params<Params extends MessageParams>(params?: Params | null): Params {
      return (params ?? {}) as Params;
    },
    tag<T = unknown, R = unknown>(handler: (chunks: Array<string | T>) => R) {
      if (typeof handler !== 'function') {
        const adapt = getRuntime().tagElement;

        if (!adapt) throw new Error('[i18n] element tags require a platform adapter');

        return createTagHandler(adapt(handler));
      }

      return createTagHandler(handler);
    },
    try<T>(renderer: TextRenderer | JsxRenderer, value: T, params?: MessageParams) {
      return isMessageDescriptor(value)
        ? (renderer as (message: MessageInput, params?: MessageParams) => unknown)(value, params)
        : value;
    },
    notranslate: noTranslate,
  }) as TApi<I18nJsxOutput, I18nTagValue>;
}
