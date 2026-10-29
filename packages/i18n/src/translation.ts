import { type CompactMessage, validateCompact } from './shared/compact';

export type TranslationItem = { id: string; translation: string; };
export type TranslationRow = [id: string, translation: string] | [context: string, id: string, translation: string];
export type CompiledTranslationItem = [id: string, message: CompactMessage];
export type CompiledCatalogHeader = { compiled: true; };
export type TranslationJsonl = string;

export type TranslationData =
  | unknown[]
  | TranslationJsonl
  | { jsonl: TranslationJsonl; };

export type Catalog = Record<string, CompactMessage>;

type TranslationItemRaw = {
  id?: string;
  source?: string;
  context?: string;
  message?: string | [string, string];
  translation?: string;
};

export function normalizeCatalog(data: TranslationData): Catalog {
  return parseCatalog(data).catalog;
}

export function parseCatalog(data: TranslationData): { catalog: Catalog; compiled: boolean; } {
  const catalog: Catalog = Object.create(null);
  const rows = parseRows(data);
  const header = rows[0];
  const hasHeader = isCompiledHeader(header);
  const compiled = hasHeader ||
    (Array.isArray(data) && rows.some((row) => Array.isArray(row) && row.length === 2 && Array.isArray(row[1])));

  if (hasHeader) rows.shift();
  if (Array.isArray(data) && rows.at(-1) === null) rows.pop();

  for (const row of rows) {
    if (Array.isArray(row)) {
      const [id, message] = compiled ? parseCompiledRow(row) : parseTranslationRow(row, Array.isArray(data));

      if (compiled || message !== '') catalog[id] = message;
    } else {
      if (compiled) throw new TypeError('[i18n] invalid compiled catalog row');

      const item = parseTranslationItem(row);

      if (item.translation !== '') catalog[item.id] = item.translation;
    }
  }

  return { catalog, compiled };
}

function parseRows(data: TranslationData): unknown[] {
  if (Array.isArray(data)) return [...data];

  const jsonl = typeof data === 'string' ? data : data.jsonl;

  return jsonl.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
}

function isCompiledHeader(row: unknown): row is CompiledCatalogHeader {
  return typeof row === 'object' && row !== null && !Array.isArray(row) &&
    'compiled' in row && row.compiled === true;
}

function parseCompiledRow(row: unknown[]): CompiledTranslationItem {
  if (row.length !== 2 || typeof row[0] !== 'string') {
    throw new TypeError('[i18n] invalid compiled catalog row');
  }

  validateCompact(row[1]);

  return [row[0], row[1]];
}

function parseTranslationRow(row: unknown[], allowCompact: boolean): [string, CompactMessage] {
  if (row.length === 2 && typeof row[0] === 'string') {
    // Programmatic compileCatalog() results can be passed directly as arrays.
    if (allowCompact) validateCompact(row[1]);
    else if (typeof row[1] !== 'string') throw new TypeError('[i18n] invalid translation row');

    return [row[0], row[1]];
  }
  if (row.length === 3 && row.every((value) => typeof value === 'string')) {
    return [`${row[0]}\0${row[1]}`, row[2] as string];
  }

  throw new TypeError('[i18n] invalid translation row');
}

function parseTranslationItem(row: unknown): TranslationItem {
  const item = row as TranslationItemRaw;

  if (!item || typeof item.translation !== 'string') throw new TypeError('[i18n] invalid translation item');

  const source = item.source ?? (Array.isArray(item.message) ? item.message[1] : item.message);
  const context = Array.isArray(item.message) ? item.message[0] : item.context;
  const id = item.id ?? (source === undefined ? undefined : context ? `${context}\0${source}` : source);

  if (typeof id !== 'string') throw new TypeError('[i18n] translation id is missing');

  return { id, translation: item.translation };
}
