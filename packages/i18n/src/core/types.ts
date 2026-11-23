import type { CompactMessage } from '../shared/compact';
import { isMessageDescriptorSchema } from '../shared/message';
import type { I18nJsxConfig } from '../types';

export { isMessageDescriptor, isMessageDescriptorSchema } from '../shared/message';
export type { I18nJsxConfig } from '../types';

export type I18nJsxOutput = I18nJsxConfig extends { JSX: infer Output; } ? NonNullable<Output> : unknown;
export type I18nTagElement = I18nJsxConfig extends { Element: infer Element; } ? Element : never;
export type I18nTagValue = I18nJsxConfig extends { Value: infer Value; } ? Value : unknown;
export type PrimitiveType = string | number | boolean | null | undefined;

export type LanguageId = string;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue; };
export type MessageMeta = JsonValue;
export type MessageContext = string;

declare const FACTORY: unique symbol;
declare const MSG: unique symbol;
declare const PARAMS: unique symbol;

export type MessageDescriptorSchema = { readonly [FACTORY]: true; };
export type MessageSchemaValue =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | DateConstructor
  | MessageDescriptorSchema;
export type MessageSchema = Partial<Record<string, MessageSchemaValue>>;

export type InferMessageSchema<Schema extends MessageSchema> = {
  [Key in keyof Schema]: Schema[Key] extends StringConstructor ? string
    : Schema[Key] extends NumberConstructor ? number
    : Schema[Key] extends BooleanConstructor ? boolean
    : Schema[Key] extends DateConstructor ? Date
    : Schema[Key] extends MessageDescriptorSchema ? NestedMessageDescriptor
    : never;
};

export type MessageDescriptor<
  Text extends string = string,
  Schema extends MessageSchema | undefined = MessageSchema,
  Bound extends boolean = false,
> = {
  readonly [MSG]: Text;
  readonly [PARAMS]?: readonly [schema: Schema, bound: Bound];
};

export type AnyMessageDescriptor = MessageDescriptor<string, MessageSchema | undefined, boolean>;

// Nested messages receive no additional params: required values must already be bound.
type NestedMessageDescriptor =
  | MessageDescriptor<string, undefined>
  | MessageDescriptor<string, Record<string, never>>
  | MessageDescriptor<string, MessageSchema | undefined, true>;

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

export type DescriptorRenderArgs<Schema extends MessageSchema | undefined, Bound extends boolean = false> =
  Bound extends true ? [params?: Schema extends MessageSchema ? Partial<InferRuntimeParams<Schema>> : MessageParams]
    : Schema extends undefined ? [params?: MessageParams]
    : keyof Schema extends never ? []
    : Schema extends MessageSchema ? [params: InferRuntimeParams<Schema>]
    : never;

export type TryRenderArgs<Value> = Value extends MessageDescriptor<string, infer Schema, infer Bound>
  ? DescriptorRenderArgs<Schema, Bound>
  : [params?: MessageParams];

// Keep descriptor overloads before broad inputs so incomplete parameter objects get schema completions.
export type TextRenderer = {
  <Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
    ...args: DescriptorRenderArgs<Schema, Bound>
  ): string;
  <Text extends string>(message: Text, params?: MessageParams): string;
};

export type JsxRenderer<Output = unknown> = {
  <Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean = boolean>(
    message: MessageDescriptor<Text, Schema, Bound>,
    ...args: DescriptorRenderArgs<Schema, Bound>
  ): Output;
  (render: () => I18nTagElement): Output;
  <Text extends string>(message: Text, params?: MessageParams): Output;
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

export function isMessageTagHandler(value: unknown): value is MessageTagHandler {
  return typeof value === 'function' && '__fluenticTagHandler' in value && value.__fluenticTagHandler === true;
}

export function isMessageSchemaValue(value: unknown): value is MessageSchemaValue {
  return value === String || value === Number || value === Boolean || value === Date ||
    isMessageDescriptorSchema(value);
}
