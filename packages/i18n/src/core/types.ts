import type { CompactMessage } from '../shared/compact';
import type { I18nJsxConfig } from '../types';

export type { I18nJsxConfig } from '../types';

export type I18nJsxOutput = I18nJsxConfig extends { JSX: infer Output; } ? NonNullable<Output> : unknown;
export type I18nTagElement = I18nJsxConfig extends { Element: infer Element; } ? Element : never;
export type I18nTagValue = I18nJsxConfig extends { Value: infer Value; } ? Value : unknown;
export type PrimitiveType = string | number | boolean | null | undefined;

export type LanguageId = string;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue; };
export type MessageMeta = JsonValue;
export type MessageContext = string;

export type MessageSchemaValue = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
export type MessageSchema = Partial<Record<string, MessageSchemaValue>>;

export type InferMessageSchema<Schema extends MessageSchema> = {
  [Key in keyof Schema]: Schema[Key] extends StringConstructor ? string
    : Schema[Key] extends NumberConstructor ? number
    : Schema[Key] extends BooleanConstructor ? boolean
    : Schema[Key] extends DateConstructor ? Date
    : never;
};

export type MessageDescriptor<Text extends string = string, Schema extends MessageSchema | undefined = MessageSchema> =
  {
    readonly __fluenticMessage: true;
    readonly text: Text;
    readonly compiled?: readonly [string, CompactMessage];
    readonly context: MessageContext | null;
    readonly schema: Schema extends MessageSchema ? Schema : MessageSchema;
    readonly notes: readonly string[];
    readonly meta: MessageMeta | undefined;
  };

export type AnyMessageDescriptor = MessageDescriptor<string, MessageSchema | undefined>;

export type MessageValueContext = { languageId: LanguageId; };
export type MessageValueFactory<T = unknown> = (context: MessageValueContext) => T;

export type MessageTagHandler<T = unknown, R = unknown> = ((chunks: Array<string | T>) => R) & {
  readonly __fluenticTagHandler: true;
};

export type MessageRuntimeValue =
  | PrimitiveType
  | Date
  | AnyMessageDescriptor
  | MessageValueFactory
  | Pick<MessageTagHandler, '__fluenticTagHandler'>;

export type MessageParam = MessageRuntimeValue;
export type MessageParams = Record<string, MessageParam>;
export type MessageInput = string | AnyMessageDescriptor;

export type InferRuntimeParams<Schema extends MessageSchema> = {
  [Key in keyof InferMessageSchema<Schema>]:
    | InferMessageSchema<Schema>[Key]
    | MessageValueFactory<InferMessageSchema<Schema>[Key]>;
};

export type DescriptorRenderArgs<Schema extends MessageSchema | undefined> = Schema extends undefined
  ? [params?: MessageParams]
  : keyof Schema extends never ? []
  : Schema extends MessageSchema ? [params: InferRuntimeParams<Schema>]
  : never;

export type TryRenderArgs<Value> = Value extends { readonly __fluenticMessage: true; }
  ? Value extends MessageDescriptor<string, infer Schema>
    ? Schema extends MessageSchema | undefined ? DescriptorRenderArgs<Schema>
    : [params: MessageParams]
  : [params: MessageParams]
  : [params?: MessageParams];

export type TextRenderer = {
  <Text extends string>(message: Text, params?: MessageParams): string;
  <Text extends string, Schema extends MessageSchema | undefined>(
    message: MessageDescriptor<Text, Schema>,
    ...args: DescriptorRenderArgs<Schema>
  ): string;
};

export type JsxRenderer<Output = unknown> = {
  <Text extends string>(message: Text, params?: MessageParams): Output;
  <Text extends string, Schema extends MessageSchema | undefined>(
    message: MessageDescriptor<Text, Schema>,
    ...args: DescriptorRenderArgs<Schema>
  ): Output;
};

export type MessageFormatOptions = {
  msg: MessageInput;
  params?: MessageParams;
  languageId?: LanguageId;
};

export type GetJsxHandler<Output = unknown> = (options: MessageFormatOptions) => Output;

export type CompiledTranslation = { compiled: CompactMessage; };

export type TranslationGetter = (args: {
  languageId: LanguageId;
  context: MessageContext | null;
  message: string;
  getCompiledId?: () => string;
}) => CompactMessage | CompiledTranslation | null;

export function isMessageDescriptor(value: unknown): value is AnyMessageDescriptor {
  return value !== null && typeof value === 'object' && '__fluenticMessage' in value &&
    value.__fluenticMessage === true;
}

export function isMessageTagHandler(value: unknown): value is MessageTagHandler {
  return typeof value === 'function' && '__fluenticTagHandler' in value && value.__fluenticTagHandler === true;
}

export function isMessageSchemaValue(value: unknown): value is MessageSchemaValue {
  return value === String || value === Number || value === Boolean || value === Date;
}
