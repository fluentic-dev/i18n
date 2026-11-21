import { DOMParser, type Element } from '@xmldom/xmldom';
import { createHash } from 'node:crypto';
import type { I18nConfig } from './config';
import type { Reporter } from './events';
import { parseExchangeJson } from './exchange-json';
import { exportHandoff, importHandoff } from './handoff';
import { recordId } from './store';
import type { Converter, ConverterImportInput, ExchangeOptions, TranslationRecord } from './types';

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function record(value: unknown): TranslationRecord {
  if (
    !isObject(value) || typeof value.source !== 'string' || typeof value.translation !== 'string' ||
    !(value.context === null || typeof value.context === 'string')
  ) {
    throw new Error('Expected records with source and translation strings and a string or null context');
  }
  const id = recordId(value.context, value.source);
  if (value.id !== undefined && value.id !== id) {
    throw new Error(`Source/context does not match record id: ${JSON.stringify(value.source)}`);
  }
  if (
    value.notes !== undefined && (!Array.isArray(value.notes) || !value.notes.every((note) => typeof note === 'string'))
  ) {
    throw new Error('Record notes must be an array of strings');
  }
  return {
    id,
    source: value.source,
    context: value.context,
    translation: value.translation,
    notes: (value.notes ?? []) as string[],
    origin: 'imported',
  };
}

function fileText(input: ConverterImportInput, name: string): string {
  if (input.files.length !== 1 || input.files[0].path !== name) {
    throw new Error(`Expected exactly ${name}; re-export this locale or remove unexpected files`);
  }
  const content = input.files[0].content;
  return (typeof content === 'string' ? content : new TextDecoder('utf-8', { fatal: true }).decode(content)).replace(
    /^\uFEFF/,
    '',
  );
}

const json: Converter = {
  name: 'json',
  export: ({ items }) => ({ files: [{ path: 'messages.json', content: JSON.stringify(items, null, 2) + '\n' }] }),
  import: (input) => {
    const value = parseExchangeJson(fileText(input, 'messages.json'));
    if (!Array.isArray(value)) throw new Error('Expected a JSON array of translation records');
    return value.map(record);
  },
};

// RFC 4180 quoted fields, including embedded newlines and doubled quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(value);
      value = '';
      closed = false;
      if (char !== ',') {
        rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !value && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error(`Invalid CSV quoting near character ${i + 1}`);
      value += char;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (row.length || value || closed) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

const csv: Converter = {
  name: 'csv',
  export: ({ items }) => ({
    files: [{
      path: 'messages.csv',
      content: [
        ['context', 'source', 'translation'],
        ...items.map((item) => [item.context ?? '', item.source, item.translation]),
      ]
        .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n',
    }],
  }),
  import: (input) => {
    const [header, ...rows] = parseCsv(fileText(input, 'messages.csv'));
    if (
      !header || header.length !== 3 || new Set(header).size !== 3 ||
      !['context', 'source', 'translation'].every((column) => header.includes(column))
    ) {
      throw new Error('CSV header must contain context,source,translation (each exactly once)');
    }
    return rows.map((row, index) => {
      if (row.length !== header.length) throw new Error(`CSV row ${index + 2}: expected 3 fields`);
      const field = (name: string) => row[header.indexOf(name)];
      return record({ context: field('context') || null, source: field('source'), translation: field('translation') });
    });
  },
};

const namespace = 'urn:oasis:names:tc:xliff:document:1.2';
function xml(value: string): string {
  if (/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(value)) {
    throw new Error('Text contains a character not representable in XML 1.0');
  }
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('\r', '&#13;').replaceAll('\n', '&#10;').replaceAll(
      '\t',
      '&#9;',
    );
}
function children(element: Element, name: string): Element[] {
  return Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1)
    .filter((node) => node.localName === name && node.namespaceURI === namespace);
}
function one(element: Element, name: string): Element {
  const matches = children(element, name);
  if (matches.length !== 1) throw new Error(`XLIFF ${element.tagName}: expected exactly one ${name}`);
  return matches[0];
}
function textOnly(element: Element): string {
  if (Array.from(element.childNodes).some((node) => ![3, 4, 8].includes(node.nodeType))) {
    throw new Error(
      `XLIFF ${element.tagName}: inline XML codes are not supported; preserve message markup as escaped text or use a custom converter`,
    );
  }
  return element.textContent ?? '';
}
const xliff: Converter = {
  name: 'xliff',
  export: ({ sourceLanguageId, languageId, items }) => {
    if (!sourceLanguageId) throw new Error('XLIFF export requires sourceLanguageId');
    const units = items.map((item) => {
      const id = createHash('sha256').update(item.id).digest('hex');
      return `      <trans-unit id="${id}" xml:space="preserve">\n` +
        `        <source>${xml(item.source)}</source>\n        <target>${xml(item.translation)}</target>\n` +
        (item.context !== null
          ? `        <context-group purpose="information"><context context-type="x-fluentic-context">${
            xml(item.context)
          }</context></context-group>\n`
          : '') +
        item.notes.map((note) => `        <note>${xml(note)}</note>\n`).join('') +
        '      </trans-unit>';
    }).join('\n');
    return {
      files: [{
        path: 'messages.xlf',
        content: '<?xml version="1.0" encoding="UTF-8"?>\n' +
          `<xliff xmlns="${namespace}" version="1.2">\n` +
          `  <file original="fluentic" datatype="plaintext" source-language="${
            xml(sourceLanguageId)
          }" target-language="${xml(languageId)}">\n` +
          `    <body>\n${units}\n    </body>\n  </file>\n</xliff>\n`,
      }],
    };
  },
  import: (input) => {
    const text = fileText(input, 'messages.xlf');
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XLIFF DTD and entity declarations are not supported');
    const document = new DOMParser({
      onError: (_level, message) => {
        throw new Error(message);
      },
    }).parseFromString(text, 'application/xml');
    const root = document.documentElement;
    if (
      !root || root.localName !== 'xliff' || root.namespaceURI !== namespace || root.getAttribute('version') !== '1.2'
    ) {
      throw new Error('Expected an XLIFF 1.2 document');
    }
    const file = one(root, 'file');
    if (
      file.getAttribute('target-language') !== input.languageId ||
      (input.sourceLanguageId && file.getAttribute('source-language') !== input.sourceLanguageId)
    ) {
      throw new Error('XLIFF source-language or target-language does not match configuration');
    }
    const body = one(file, 'body');
    const units = children(body, 'trans-unit');
    if (Array.from(body.childNodes).some((node) => node.nodeType === 1 && !units.includes(node as Element))) {
      throw new Error('XLIFF body must contain trans-unit elements directly; groups require a custom converter');
    }
    const ids = new Set<string>();
    return units.map((unit) => {
      const id = unit.getAttribute('id');
      if (!id || ids.has(id)) throw new Error('XLIFF trans-unit IDs must be present and unique');
      ids.add(id);
      const contexts = children(unit, 'context-group').flatMap((group) => children(group, 'context'))
        .filter((context) => context.getAttribute('context-type') === 'x-fluentic-context');
      if (contexts.length > 1) throw new Error(`XLIFF unit ${id}: duplicate Fluentic context`);
      return record({
        source: textOnly(one(unit, 'source')),
        translation: textOnly(one(unit, 'target')),
        context: contexts.length ? textOnly(contexts[0]) : null,
        notes: children(unit, 'note').map(textOnly),
      });
    });
  },
};

type FolderConverter = {
  kind: 'folder';
  export: (config: I18nConfig, options: ExchangeOptions, report?: Reporter) => Promise<void>;
  import: (config: I18nConfig, options: ExchangeOptions, report?: Reporter) => Promise<void>;
};
type ResolvedConverter = { kind: 'records'; converter: Converter; builtin: boolean; } | FolderConverter;
const builtins = new Map<string, ResolvedConverter>([
  ...[json, csv, xliff].map((converter) =>
    [converter.name, { kind: 'records', converter, builtin: true }] as [string, ResolvedConverter]
  ),
  ['handoff', {
    kind: 'folder',
    export: async (config, options, report) => {
      const guide = await exportHandoff(config, options);
      report?.({ type: 'info', message: 'Copy this to your coding agent:\n\n' + guide });
    },
    import: importHandoff,
  }],
]);

export function resolveConverter(config: I18nConfig, name: string): ResolvedConverter {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name)) throw new Error(`Invalid converter name: ${JSON.stringify(name)}`);
  const configured = config.convert?.find((converter) => converter.name === name);
  if (configured) return { kind: 'records', converter: configured, builtin: false };
  const builtin = builtins.get(name);
  if (!builtin) {
    throw new Error(
      `Unknown converter "${name}".\nAvailable formats: ${
        [...new Set([...builtins.keys(), ...(config.convert ?? []).map((item) => item.name)])].join(', ')
      }.\nChoose one of these formats, or register "${name}" in config.convert.`,
    );
  }
  return builtin;
}

export { csv as csvConverter, json as jsonConverter, xliff as xliffConverter };
