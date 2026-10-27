export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue; };
export type MessageRecord = { id: string; source: string; context: string | null; notes: string[]; meta?: JsonValue; };
export type TranslationRecord = MessageRecord & { translation: string; origin: 'auto' | 'manual' | 'imported'; };
export type TranslationResult = { id: string; translation: string; error?: unknown; };
export type TranslationRequest = TranslationRequestBase & { env: (name: string) => string; };
export type TranslationRequestBase = { sourceLanguageId: string; targetLanguageId: string; items: TranslationItem[]; };
export type TranslationItem = MessageRecord & {
  /** The complete source message when this item is a text chunk from a tagged message. */
  originalSource?: string;
  originalId?: string;
  chunkIndex?: number;
  chunkCount?: number;
};
export type TranslateFn = (request: TranslationRequest) => Promise<TranslationResult[]> | TranslationResult[];
export type TranslatorOptions = { translate: TranslateFn; batch?: number | false; tag?: boolean; };
export type DefinedTranslator = Readonly<{ translate: TranslateFn; batch: number | false; tag: boolean; }>;
export type Translator = TranslateFn | DefinedTranslator;
export type ConverterInput = { languageId: string; items: TranslationRecord[]; filePath?: string; };
export type ConverterOutput = { files: Array<{ path: string; content: string | Uint8Array; }>; };
export type ConverterImportInput = {
  languageId: string;
  files: Array<{ path: string; content: string | Uint8Array; }>;
};
export type Converter = {
  name: string;
  import?: (input: ConverterImportInput) => Promise<TranslationRecord[]> | TranslationRecord[];
  export?: (input: ConverterInput) => Promise<ConverterOutput> | ConverterOutput;
};
