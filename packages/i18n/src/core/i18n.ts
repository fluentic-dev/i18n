import type { CompactMessage } from '../shared/compact';
import type { Formatting } from '../shared/formatting';
import { bindMessage, cloneMessage, createMessage, markMessageFactory, normalizeMessage } from '../shared/message';
import { createTagHandler, getRuntime, noTranslate, renderJsxCallback } from '../shared/runtime';
import type { I18nJsxOutput, I18nTagElement, I18nTagValue } from './types';
import { isMessageDescriptor } from './types';
import type {
  AnyMessageDescriptor,
  DescriptorRenderArgs,
  JsxRenderer,
  MessageDescriptor,
  MessageDescriptorSchema,
  MessageInput,
  MessageMeta,
  MessageParams,
  MessageSchema,
  MessageTagHandler,
  TextRenderer,
  TryRenderArgs,
} from './types';

type MessageScope = { context: string | null; notes: string[]; meta?: MessageMeta; };

export type MessageFactory = MessageDescriptorSchema & {
  <Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
    ...args: DescriptorRenderArgs<Schema, Bound>
  ): MessageDescriptor<Text, Schema, true>;
  // Infer schema from its argument, not a contextual nested-message return type.
  <const Text extends string, const Schema extends MessageSchema | undefined = undefined>(
    message: Text,
    schema?: Schema,
  ): MessageDescriptor<Text, NoInfer<Schema>>;
};

export type MessageApi<JsxOutput = unknown> = {
  context(name: string): MessageApi<JsxOutput>;
  note(note: string): MessageApi<JsxOutput>;
  meta(meta: MessageMeta): MessageApi<JsxOutput>;
  msg: MessageFactory;
  text: TextRenderer;
  jsx: JsxRenderer<JsxOutput>;
};

export type TApi<JsxOutput = unknown, TagValue = unknown> = MessageApi<JsxOutput> & {
  clone<const Text extends string, const Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
  ): MessageDescriptor<Text, Schema, Bound>;
  params<Params extends MessageParams>(params: Params): Params;
  params(params?: null): Record<never, never>;
  params<Params extends MessageParams>(params: Params | null | undefined): Params | Record<never, never>;
  tag(element: I18nTagElement): MessageTagHandler<I18nTagValue, I18nTagElement>;
  tag<T = TagValue, R = TagValue>(handler: (chunks: Array<string | T>) => R): MessageTagHandler<T, R>;
  try<T>(
    renderer: TextRenderer,
    value: T,
    ...args: TryRenderArgs<T>
  ): T extends AnyMessageDescriptor ? string : T;
  try<T>(
    renderer: JsxRenderer<JsxOutput>,
    value: T,
    ...args: TryRenderArgs<T>
  ): T extends AnyMessageDescriptor ? JsxOutput : T;
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
      msg: markMessageFactory((message: MessageInput, schema?: MessageSchema | MessageParams) => {
        if (isMessageDescriptor(message)) return bindMessage(message, schema as MessageParams | undefined);

        return createDescriptor(message, schema as MessageSchema | undefined, scope);
      }),
      text(message: MessageInput, params?: MessageParams) {
        return getText(toFormatOptions(message, params, scope));
      },
      jsx(message: MessageInput | (() => I18nTagElement), params?: MessageParams) {
        if (typeof message === 'function') return renderJsxCallback(message);

        return getJsx(toFormatOptions(message, params, scope));
      },
    } as MessageApi;
  };

  const createDescriptor = <const Text extends string, const Schema extends MessageSchema | undefined>(
    message: Text,
    schema: Schema | undefined,
    scope: MessageScope,
  ): MessageDescriptor<Text, Schema> => {
    const payload = Array.isArray(message) ? message as unknown as readonly [string, CompactMessage] : undefined;
    return createMessage<Text, Schema>({
      text: payload ? payload[0] : normalizeMessage(message),
      ...(payload ? { compiled: payload } : {}),
      context: scope.context,
      schema: schema ?? {},
      notes: scope.notes,
      meta: scope.meta,
    });
  };

  const toFormatOptions = (message: MessageInput, params: MessageParams | undefined, scope: MessageScope) => {
    if (isMessageDescriptor(message)) return { msg: message, params };

    return { msg: createDescriptor(message, undefined, scope), params };
  };

  const rootScope = createScope({ context: null, notes: [] });

  return Object.assign(rootScope, {
    clone: cloneMessage,
    params<Params extends MessageParams>(params?: Params | null) {
      return params ?? {};
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
