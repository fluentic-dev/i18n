import { type TApi } from './core/i18n';
import { isMessageDescriptor } from './core/types';
import type {
  DescriptorRenderArgs,
  I18nJsxOutput,
  I18nTagValue,
  MessageDescriptor,
  MessageParams,
  MessageSchema,
  TryRenderArgs,
} from './core/types';
import type { CompactMessage } from './shared/compact';
import { createFormatting } from './shared/formatting';
import { interpret } from './shared/interpreter';
import { createTagHandler, getRuntime, noTranslate } from './shared/runtime';
export type CompiledPayload = readonly [id: string, fallback: CompactMessage];
export type CompiledTextRenderer = {
  (message: CompiledPayload, params?: MessageParams): string;
  <Text extends string, Schema extends MessageSchema | undefined>(
    message: MessageDescriptor<Text, Schema>,
    ...args: DescriptorRenderArgs<Schema>
  ): string;
};
export type CompiledJsxRenderer = {
  (message: CompiledPayload, params?: MessageParams): I18nJsxOutput;
  <Text extends string, Schema extends MessageSchema | undefined>(
    message: MessageDescriptor<Text, Schema>,
    ...args: DescriptorRenderArgs<Schema>
  ): I18nJsxOutput;
};
export type CompiledTApi =
  & Omit<TApi<I18nJsxOutput, I18nTagValue>, 'msg' | 'text' | 'jsx' | 'try' | 'context' | 'note' | 'meta'>
  & {
    msg<Schema extends MessageSchema | undefined = undefined>(
      message: CompiledPayload,
      schema?: Schema,
    ): MessageDescriptor<string, Schema>;
    text: CompiledTextRenderer;
    jsx: CompiledJsxRenderer;
    try<T>(
      renderer: CompiledTextRenderer,
      value: T,
      ...args: TryRenderArgs<T>
    ): T extends { readonly __fluenticMessage: true; } ? string
      : T;
    try<T>(
      renderer: CompiledJsxRenderer,
      value: T,
      ...args: TryRenderArgs<T>
    ): T extends { readonly __fluenticMessage: true; } ? I18nJsxOutput : T;
  };
const formatting = /* @__PURE__ */ createFormatting(interpret, true);
function descriptor<Schema extends MessageSchema | undefined = undefined>(
  payload: CompiledPayload,
  schema?: Schema,
): MessageDescriptor<string, Schema> {
  if (!Array.isArray(payload) || payload.length !== 2 || typeof payload[0] !== 'string') {
    throw new TypeError('[i18n] compiled runtime requires compiled messages; enable the Fluentic plugin');
  }
  return Object.freeze({
    __fluenticMessage: true,
    text: payload[0],
    compiled: payload,
    context: null,
    schema: schema ?? {},
    notes: [],
    meta: undefined,
  }) as unknown as MessageDescriptor<string, Schema>;
}
function options(
  message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined>,
  params?: MessageParams,
) {
  return { msg: isMessageDescriptor(message) ? message : descriptor(message), params };
}
export const t = {
  msg: descriptor,
  text(message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined>, params?: MessageParams) {
    return formatting.getText(options(message, params));
  },
  jsx(message: CompiledPayload | MessageDescriptor<string, MessageSchema | undefined>, params?: MessageParams) {
    return formatting.getJsx(options(message, params));
  },
  clone(message: MessageDescriptor) {
    return Object.freeze({ ...message });
  },
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
