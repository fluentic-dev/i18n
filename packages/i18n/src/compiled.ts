import { type TApi } from './core/i18n';
import { isMessageDescriptor } from './core/types';
import type {
  AnyMessageDescriptor,
  DescriptorRenderArgs,
  I18nJsxOutput,
  I18nTagElement,
  I18nTagValue,
  MessageDescriptor,
  MessageDescriptorSchema,
  MessageParams,
  MessageSchema,
  TryRenderArgs,
} from './core/types';
import type { CompactMessage } from './shared/compact';
import { createFormatting } from './shared/formatting';
import { interpret } from './shared/interpreter';
import { bindMessage, cloneMessage, createMessage, markMessageFactory } from './shared/message';
import { createTagHandler, getRuntime, noTranslate, renderJsxCallback } from './shared/runtime';

export type CompiledPayload = readonly [id: string, fallback: CompactMessage];

// Keep descriptor overloads before broad inputs so incomplete parameter objects get schema completions.
export type CompiledTextRenderer = {
  <Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
    ...args: DescriptorRenderArgs<Schema, Bound>
  ): string;
  (message: CompiledPayload, params?: MessageParams): string;
};

export type CompiledJsxRenderer = {
  <Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
    ...args: DescriptorRenderArgs<Schema, Bound>
  ): I18nJsxOutput;
  (render: () => I18nTagElement): I18nJsxOutput;
  (message: CompiledPayload, params?: MessageParams): I18nJsxOutput;
};

export type CompiledMessageFactory = MessageDescriptorSchema & {
  <Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
    ...args: DescriptorRenderArgs<Schema, Bound>
  ): MessageDescriptor<Text, Schema, true>;
  // Infer schema from its argument, not a contextual nested-message return type.
  <Schema extends MessageSchema | undefined = undefined>(
    message: CompiledPayload,
    schema?: Schema,
  ): MessageDescriptor<string, NoInfer<Schema>>;
};

export type CompiledTApi =
  & Omit<TApi<I18nJsxOutput, I18nTagValue>, 'msg' | 'text' | 'jsx' | 'try' | 'context' | 'note' | 'meta'>
  & {
    msg: CompiledMessageFactory;
    text: CompiledTextRenderer;
    jsx: CompiledJsxRenderer;
    try<T>(
      renderer: CompiledTextRenderer,
      value: T,
      ...args: TryRenderArgs<T>
    ): T extends AnyMessageDescriptor ? string
      : T;
    try<T>(
      renderer: CompiledJsxRenderer,
      value: T,
      ...args: TryRenderArgs<T>
    ): T extends AnyMessageDescriptor ? I18nJsxOutput : T;
  };

const formatting = /* @__PURE__ */ createFormatting(interpret, true);

function descriptor<Schema extends MessageSchema | undefined = undefined>(
  payload: CompiledPayload,
  schema?: Schema,
): MessageDescriptor<string, Schema> {
  if (!Array.isArray(payload) || payload.length !== 2 || typeof payload[0] !== 'string') {
    throw new TypeError('[i18n] compiled runtime requires compiled messages; enable the Fluentic plugin');
  }

  return createMessage<string, Schema>({
    text: payload[0],
    compiled: payload,
    context: null,
    schema: schema ?? {},
    notes: [],
    meta: undefined,
  });
}

function options(
  message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined, boolean>,
  params?: MessageParams,
) {
  return { msg: isMessageDescriptor(message) ? message : descriptor(message), params };
}

export const t = {
  msg: markMessageFactory(
    (
      message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined, boolean>,
      params?: MessageParams | MessageSchema,
    ) => {
      return isMessageDescriptor(message)
        ? bindMessage(message, params as MessageParams | undefined)
        : descriptor(message, params as MessageSchema | undefined);
    },
  ),
  text(
    message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined, boolean>,
    params?: MessageParams,
  ) {
    return formatting.getText(options(message, params));
  },
  jsx(
    message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined, boolean> | (() => I18nTagElement),
    params?: MessageParams,
  ) {
    if (typeof message === 'function') return renderJsxCallback(message);

    return formatting.getJsx(options(message, params));
  },
  clone: cloneMessage,
  params(params: MessageParams | null = {}) {
    return params ?? {};
  },
  tag(value: unknown) {
    if (typeof value === 'function') return createTagHandler(value as (chunks: unknown[]) => unknown);

    const adapt = getRuntime().tagElement;

    if (!adapt) throw new Error('[i18n] element tags require a platform adapter');

    return createTagHandler(adapt(value));
  },
  try(renderer: (message: unknown, params?: MessageParams) => unknown, value: unknown, params?: MessageParams) {
    return isMessageDescriptor(value) ? renderer(value, params) : value;
  },
  notranslate: noTranslate,
} as unknown as CompiledTApi;
export * from './core/types';
export type { CompactMessage, CompactPart } from './shared/compact';
export { I18nRegistry, noTranslate, setFormats } from './shared/runtime';
export { defineTranslationLoader } from './translation-manager';
