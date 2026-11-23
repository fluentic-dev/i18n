import type {
  AnyMessageDescriptor,
  MessageContext,
  MessageDescriptor,
  MessageDescriptorSchema,
  MessageMeta,
  MessageParams,
  MessageSchema,
} from '../core/types';
import type { CompactMessage } from './compact';

const DATA = Symbol.for('@fluentic/i18n/message');
const FACTORY = Symbol.for('@fluentic/i18n/message-factory');

type MessageData = {
  readonly text: string;
  readonly compiled?: readonly [string, CompactMessage];
  readonly context: MessageContext | null;
  readonly schema: MessageSchema;
  readonly notes: readonly string[];
  readonly meta: MessageMeta | undefined;
  readonly boundParams?: Readonly<MessageParams>;
};
type InternalMessage = { readonly [DATA]: Readonly<MessageData>; };

export function createMessage<
  Text extends string,
  Schema extends MessageSchema | undefined,
  Bound extends boolean = false,
>(
  data: MessageData,
): MessageDescriptor<Text, Schema, Bound> {
  const internal: InternalMessage = {
    [DATA]: Object.freeze({
      ...data,
      schema: Object.freeze({ ...data.schema }),
      notes: Object.freeze([...data.notes]),
    }),
  };
  return Object.freeze(internal) as unknown as MessageDescriptor<Text, Schema, Bound>;
}

export function getMessageData(message: AnyMessageDescriptor): Readonly<MessageData> {
  return (message as unknown as InternalMessage)[DATA];
}

export function isMessageDescriptor(value: unknown): value is AnyMessageDescriptor {
  return typeof value === 'object' && value !== null && DATA in value;
}

export function markMessageFactory<Factory extends (...args: never[]) => unknown>(
  factory: Factory,
): Factory & MessageDescriptorSchema {
  Object.defineProperty(factory, FACTORY, { value: true });
  return factory as Factory & MessageDescriptorSchema;
}

export function isMessageDescriptorSchema(value: unknown): value is MessageDescriptorSchema {
  return typeof value === 'function' && FACTORY in value && value[FACTORY] === true;
}

export function cloneMessage<Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean>(
  message: MessageDescriptor<Text, Schema, Bound>,
): MessageDescriptor<Text, Schema, Bound> {
  return createMessage(getMessageData(message));
}

/** Bind values without resolving callbacks or translating until render time. */
export function bindMessage<Text extends string, Schema extends MessageSchema | undefined, Bound extends boolean>(
  message: MessageDescriptor<Text, Schema, Bound>,
  params?: MessageParams,
): MessageDescriptor<Text, Schema, true> {
  const data = getMessageData(message);
  return createMessage({
    ...data,
    boundParams: Object.freeze({ ...data.boundParams, ...params }),
  });
}

/** Treat source line wrapping as code formatting. Use `{break}` for a rendered line break. */
export function normalizeMessage(message: string): string {
  if (!/[\r\n]/.test(message)) return message;

  return message.replace(/\r\n?/g, '\n').replace(/[ \t]*\n(?:[ \t]*\n)*[ \t]*/g, ' ').trim();
}
