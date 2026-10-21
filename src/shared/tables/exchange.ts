import { z } from 'zod';
import { exchangeEnvelopeSchema, wrapExchange } from '../exchange';
import { formatCell, parseCell } from './cells';
import { computeTable, type TableLookup } from './compute';
import { parseDelimited, toDelimited, type Delimiter } from './delimited';
import {
  columnIdFrom,
  dataTableInputSchema,
  tableColumnSchema,
  type TableCell,
  type TableCells,
  type TableColumn,
  type TableRow,
  type TableSnapshot,
  tableSnapshotSchema,
} from './schema';

export const TABLE_EXPORT_FORMATS = [
  'csv',
  'tsv',
  'json',
  'jsonKeyed',
  'markdown',
  'jsonSchema',
  'loopy',
] as const;
export const TABLE_IMPORT_FORMATS = ['csv', 'tsv', 'json', 'loopy'] as const;
export const TABLE_EXCHANGE_VERSION = 1;

export const tableExportFormatSchema = z.enum(TABLE_EXPORT_FORMATS);
export type TableExportFormat = z.infer<typeof tableExportFormatSchema>;
export type TableImportFormat = (typeof TABLE_IMPORT_FORMATS)[number];
export type ImportedTable = z.infer<typeof dataTableInputSchema>;

export interface ExportedTable {
  text: string;
  extension: string;
  mime: string;
}

export interface ExportOptions {
  lookup?: TableLookup;
  app?: string;
}

const FILES: Record<TableExportFormat, { extension: string; mime: string }> = {
  csv: { extension: 'csv', mime: 'text/csv' },
  tsv: { extension: 'tsv', mime: 'text/tab-separated-values' },
  json: { extension: 'json', mime: 'application/json' },
  jsonKeyed: { extension: 'json', mime: 'application/json' },
  markdown: { extension: 'md', mime: 'text/markdown' },
  jsonSchema: { extension: 'schema.json', mime: 'application/schema+json' },
  loopy: { extension: 'loopy-table.json', mime: 'application/json' },
};

class NotATable extends Error {
  constructor() {
    super('Not a table file');
  }
}

function isMultiple(column: TableColumn): boolean {
  return (
    (column.kind === 'choice' || column.kind === 'reference' || column.kind === 'link') && column.multiple
  );
}

function keysOf(column: TableColumn, value: TableCell | undefined, lookup?: TableLookup): string[] {
  if (column.kind !== 'reference' || column.tableId === null) return [];
  const rows = lookup?.rowsOf(column.tableId) ?? [];
  const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return ids.flatMap((id) => {
    const found = rows.find((row) => row.id === id);
    return found ? [found.key] : [];
  });
}

function exportValue(
  column: TableColumn,
  row: TableRow,
  computed: ReturnType<typeof computeTable>,
  lookup?: TableLookup,
): unknown {
  const value = row.cells[column.id];
  if (column.kind === 'formula') {
    const result = computed.get(row.id)?.[column.id];
    return result && 'value' in result ? result.value : null;
  }
  if (column.kind === 'checkbox') return typeof value === 'boolean' ? value : column.defaultValue;
  if (column.kind === 'reference') {
    const keys = keysOf(column, value, lookup);
    return column.multiple ? keys : (keys[0] ?? null);
  }
  if (isMultiple(column)) return Array.isArray(value) ? value : [];
  return value ?? null;
}

function textValue(
  column: TableColumn,
  row: TableRow,
  computed: ReturnType<typeof computeTable>,
  lookup?: TableLookup,
): string {
  const value = exportValue(column, row, computed, lookup);
  if (column.kind === 'reference')
    return Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';
  return formatCell(column, value as TableCell, lookup);
}

function delimited(snapshot: TableSnapshot, delimiter: Delimiter, lookup?: TableLookup): string {
  const { table, rows } = snapshot;
  const computed = computeTable(table, rows, lookup);
  return toDelimited(
    [
      [table.keyName, ...table.columns.map((column) => column.id)],
      ...rows.map((row) => [
        row.key,
        ...table.columns.map((column) => textValue(column, row, computed, lookup)),
      ]),
    ],
    delimiter,
  );
}

function records(snapshot: TableSnapshot, lookup?: TableLookup): [string, Record<string, unknown>][] {
  const { table, rows } = snapshot;
  const computed = computeTable(table, rows, lookup);
  return rows.map((row) => [
    row.key,
    Object.fromEntries(
      table.columns.map((column) => [column.id, exportValue(column, row, computed, lookup)]),
    ),
  ]);
}

function markdown(snapshot: TableSnapshot, lookup?: TableLookup): string {
  const { table, rows } = snapshot;
  const computed = computeTable(table, rows, lookup);
  const escape = (text: string) => text.replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
  const line = (cells: string[]) => `| ${cells.map(escape).join(' | ')} |`;
  return [
    line([table.keyName, ...table.columns.map((column) => column.label || column.id)]),
    line([table.keyName, ...table.columns].map(() => '---')),
    ...rows.map((row) =>
      line([row.key, ...table.columns.map((column) => textValue(column, row, computed, lookup))]),
    ),
  ].join('\n');
}

function nullable(type: string, required: boolean): string | string[] {
  return required ? type : [type, 'null'];
}

function columnSchema(column: TableColumn): Record<string, unknown> {
  const base = column.description ? { description: column.description } : {};
  switch (column.kind) {
    case 'number':
      return {
        ...base,
        type: nullable(column.integer ? 'integer' : 'number', column.required),
        ...(column.min === null ? {} : { minimum: column.min }),
        ...(column.max === null ? {} : { maximum: column.max }),
      };
    case 'checkbox':
      return { ...base, type: 'boolean' };
    case 'choice': {
      const values = column.options.map((option) => option.value);
      return column.multiple
        ? { ...base, type: 'array', items: { enum: values } }
        : {
            ...base,
            type: nullable('string', column.required),
            enum: [...values, ...(column.required ? [] : [null])],
          };
    }
    case 'reference':
      return column.multiple
        ? { ...base, type: 'array', items: { type: 'string' } }
        : { ...base, type: nullable('string', column.required) };
    case 'link': {
      const link = { type: 'object', properties: { kind: { type: 'string' }, id: { type: 'string' } } };
      return column.multiple
        ? { ...base, type: 'array', items: link }
        : { ...base, anyOf: [link, { type: 'null' }] };
    }
    case 'formula':
      return { ...base, type: ['number', 'null'], readOnly: true };
    case 'date':
      return { ...base, type: nullable('string', column.required), format: 'date' };
    case 'colour':
      return { ...base, type: nullable('string', column.required), pattern: '^#[0-9a-fA-F]{6}$' };
    default:
      return { ...base, type: nullable('string', column.required) };
  }
}

function jsonSchema(snapshot: TableSnapshot): string {
  const { table } = snapshot;
  return JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: table.name,
      type: 'array',
      items: {
        type: 'object',
        properties: {
          [table.keyName]: { type: 'string' },
          ...Object.fromEntries(table.columns.map((column) => [column.id, columnSchema(column)])),
        },
        required: [
          table.keyName,
          ...table.columns.filter((column) => column.required).map((column) => column.id),
        ],
        additionalProperties: false,
      },
    },
    null,
    2,
  );
}

export function exportTable(
  snapshot: TableSnapshot,
  format: TableExportFormat,
  options: ExportOptions = {},
): ExportedTable {
  const { lookup } = options;
  const file = FILES[format];
  switch (format) {
    case 'csv':
      return { ...file, text: delimited(snapshot, ',', lookup) };
    case 'tsv':
      return { ...file, text: delimited(snapshot, '\t', lookup) };
    case 'json':
      return {
        ...file,
        text: JSON.stringify(
          records(snapshot, lookup).map(([key, values]) => ({ [snapshot.table.keyName]: key, ...values })),
          null,
          2,
        ),
      };
    case 'jsonKeyed':
      return { ...file, text: JSON.stringify(Object.fromEntries(records(snapshot, lookup)), null, 2) };
    case 'markdown':
      return { ...file, text: markdown(snapshot, lookup) };
    case 'jsonSchema':
      return { ...file, text: jsonSchema(snapshot) };
    case 'loopy': {
      const { table, rows } = snapshot;
      const data = {
        name: table.name,
        keyName: table.keyName,
        columns: table.columns,
        rows: rows.map((row) => ({ key: row.key, cells: row.cells })),
      };
      return {
        ...file,
        text: JSON.stringify(
          wrapExchange('table', TABLE_EXCHANGE_VERSION, options.app ?? 'loopy', data),
          null,
          2,
        ),
      };
    }
  }
}

export function importFormatOf(name: string): TableImportFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.loopy-table.json')) return 'loopy';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.tsv') || lower.endsWith('.txt')) return 'tsv';
  if (lower.endsWith('.json')) return 'json';
  return null;
}

const BOOLEAN = /^(true|false|yes|no|y|n|x)$/i;
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHOICE_LIMIT = 12;
const CHOICE_ROWS = 4;

function guessColumn(id: string, label: string, values: readonly string[]): TableColumn {
  const filled = values.map((value) => value.trim()).filter((value) => value !== '');
  const every = (test: (value: string) => boolean) => filled.length > 0 && filled.every(test);
  const base = { id, label };
  if (every((value) => BOOLEAN.test(value) && !NUMBER.test(value)))
    return tableColumnSchema.parse({ ...base, kind: 'checkbox' });
  if (every((value) => NUMBER.test(value.replace(/^(-?\d+),(\d+)$/, '$1.$2'))))
    return tableColumnSchema.parse({
      ...base,
      kind: 'number',
      integer: filled.every((value) => Number.isInteger(Number(value.replace(',', '.')))),
    });
  if (every((value) => HEX.test(value))) return tableColumnSchema.parse({ ...base, kind: 'colour' });
  if (
    every(
      (value) =>
        DATE.test(value) && 'value' in parseCell(tableColumnSchema.parse({ id, kind: 'date' }), value),
    )
  )
    return tableColumnSchema.parse({ ...base, kind: 'date' });
  const distinct = [...new Set(filled)];
  if (
    filled.length >= CHOICE_ROWS &&
    distinct.length <= CHOICE_LIMIT &&
    distinct.length * 2 <= filled.length &&
    distinct.every((value) => value.length <= 40)
  )
    return tableColumnSchema.parse({ ...base, kind: 'choice', options: distinct });
  return tableColumnSchema.parse({ ...base, kind: 'text' });
}

function uniqueKeys(raw: readonly string[]): string[] {
  const used = new Set<string>();
  let counter = 0;
  return raw.map((value) => {
    let key = value.trim().slice(0, 120);
    if (key === '') {
      do {
        counter += 1;
        key = `row_${String(counter)}`;
      } while (used.has(key));
    } else if (used.has(key)) {
      let index = 2;
      while (used.has(`${key}_${String(index)}`)) index += 1;
      key = `${key}_${String(index)}`;
    }
    used.add(key);
    return key;
  });
}

function fromMatrix(name: string, matrix: string[][]): ImportedTable {
  const [header, ...body] = matrix;
  if (!header || header.every((cell) => cell.trim() === '')) throw new NotATable();
  const keyIndex = Math.max(
    0,
    header.findIndex((cell) => /^(id|key)$/i.test(cell.trim())),
  );
  const keyName = columnIdFrom(header[keyIndex] ?? 'id', []);
  const ids: string[] = [];
  const columns: { index: number; column: TableColumn }[] = [];
  header.forEach((label, index) => {
    if (index === keyIndex) return;
    const id = columnIdFrom(label, ids, [keyName]);
    ids.push(id);
    columns.push({
      index,
      column: guessColumn(
        id,
        label.trim(),
        body.map((line) => line[index] ?? ''),
      ),
    });
  });
  const keys = uniqueKeys(body.map((line) => line[keyIndex] ?? ''));
  const rows = body.map((line, position) => {
    const cells: TableCells = {};
    for (const { index, column } of columns) {
      const parsed = parseCell(column, line[index] ?? '');
      if ('value' in parsed && parsed.value !== null) cells[column.id] = parsed.value;
    }
    return { key: keys[position] ?? `row_${String(position + 1)}`, cells };
  });
  return dataTableInputSchema.parse({ name, keyName, columns: columns.map((entry) => entry.column), rows });
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object'))
    return value.map(String).join(', ');
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function fromObjects(
  name: string,
  keyName: string,
  entries: [string, Record<string, unknown>][],
): ImportedTable {
  const fields: string[] = [];
  for (const [, values] of entries)
    for (const field of Object.keys(values)) if (!fields.includes(field)) fields.push(field);
  const ids: string[] = [];
  const columns = fields.map((field) => {
    const id = columnIdFrom(field, ids, [keyName]);
    ids.push(id);
    const values = entries
      .map(([, record]) => record[field])
      .filter((value) => value !== null && value !== undefined);
    let column: TableColumn;
    if (values.length > 0 && values.every((value) => typeof value === 'boolean'))
      column = tableColumnSchema.parse({ id, label: field, kind: 'checkbox' });
    else if (values.length > 0 && values.every((value) => typeof value === 'number'))
      column = tableColumnSchema.parse({
        id,
        label: field,
        kind: 'number',
        integer: values.every(Number.isInteger),
      });
    else if (values.every((value) => typeof value === 'string')) column = guessColumn(id, field, values);
    else column = tableColumnSchema.parse({ id, label: field, kind: 'text' });
    return { field, column };
  });
  const keys = uniqueKeys(entries.map(([key]) => key));
  const rows = entries.map(([, record], position) => {
    const cells: TableCells = {};
    for (const { field, column } of columns) {
      const value = record[field];
      if (value === null || value === undefined) continue;
      if (typeof value === 'boolean' && column.kind === 'checkbox') cells[column.id] = value;
      else if (typeof value === 'number' && column.kind === 'number') cells[column.id] = value;
      else {
        const parsed = parseCell(column, asText(value));
        if ('value' in parsed && parsed.value !== null) cells[column.id] = parsed.value;
      }
    }
    return { key: keys[position] ?? `row_${String(position + 1)}`, cells };
  });
  return dataTableInputSchema.parse({ name, keyName, columns: columns.map((entry) => entry.column), rows });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fromJson(name: string, text: string): ImportedTable {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new NotATable();
  }
  if (Array.isArray(data) && data.length > 0 && data.every(isRecord)) {
    const first = data[0] ?? {};
    const keyField = Object.keys(first).find((field) => /^(id|key)$/i.test(field));
    const entries = data.map((record): [string, Record<string, unknown>] => {
      if (keyField === undefined) return ['', record];
      const { [keyField]: key, ...rest } = record;
      return [asText(key), rest];
    });
    return fromObjects(name, keyField === undefined ? 'id' : columnIdFrom(keyField, []), entries);
  }
  if (isRecord(data) && Object.keys(data).length > 0 && Object.values(data).every(isRecord))
    return fromObjects(name, 'id', Object.entries(data as Record<string, Record<string, unknown>>));
  throw new NotATable();
}

function fromLoopy(text: string): ImportedTable {
  try {
    const envelope = exchangeEnvelopeSchema.parse(JSON.parse(text));
    if (envelope.loopy.kind !== 'table') throw new NotATable();
    return dataTableInputSchema.parse(envelope.data);
  } catch {
    throw new NotATable();
  }
}

export function importTable(text: string, format: TableImportFormat, name: string): ImportedTable {
  switch (format) {
    case 'csv':
      return fromMatrix(name, parseDelimited(text, ','));
    case 'tsv':
      return fromMatrix(name, parseDelimited(text, '\t'));
    case 'json':
      return fromJson(name, text);
    case 'loopy':
      return fromLoopy(text);
  }
}

export const tableImportResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), snapshot: z.lazy(() => tableSnapshotSchema) }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('invalid'), name: z.string() }),
]);
export type TableImportResult = z.infer<typeof tableImportResultSchema>;

export function tableFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? 'table' : cleaned;
}

export function tableNameFromFile(file: string): string {
  const base = file.split(/[\\/]/).pop() ?? file;
  const name = base
    .replace(/\.loopy-table\.json$/i, '')
    .replace(/\.[^.]+$/, '')
    .trim();
  return (name === '' ? 'Imported table' : name).slice(0, 80);
}
