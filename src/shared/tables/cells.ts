import { parseDice } from '../formulas';
import type { BoardLink } from '../board';
import type { TableCell, TableColumn, TableRow } from './schema';

export type CellError = 'number' | 'checkbox' | 'option' | 'date' | 'colour' | 'dice' | 'reference';
export type ParsedCell = { value: TableCell } | { error: CellError };

export interface RowLookup {
  rowsOf: (tableId: string) => readonly TableRow[];
}

const TRUE = new Set(['true', 'yes', 'y', '1', 'x', '✓']);
const FALSE = new Set(['false', 'no', 'n', '0', '']);
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HEX = /^#[0-9a-f]{6}$/i;

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function isDate(text: string): boolean {
  const match = DATE.exec(text);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function parseNumber(column: Extract<TableColumn, { kind: 'number' }>, text: string): ParsedCell {
  const normalised = text.replace(/\s+/g, '').replace(/^(-?\d+),(\d+)$/, '$1.$2');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalised)) return { error: 'number' };
  const value = Number(normalised);
  return { value: column.integer ? Math.round(value) : value };
}

function parseReference(
  column: Extract<TableColumn, { kind: 'reference' }>,
  text: string,
  lookup: RowLookup | undefined,
): ParsedCell {
  const keys = column.multiple ? splitList(text) : [text];
  if (!lookup || column.tableId === null) return { error: 'reference' };
  const rows = lookup.rowsOf(column.tableId);
  const ids: string[] = [];
  for (const key of keys) {
    const match =
      rows.find((row) => row.key === key) ?? rows.find((row) => row.key.toLowerCase() === key.toLowerCase());
    if (!match) return { error: 'reference' };
    ids.push(match.id);
  }
  return { value: column.multiple ? ids : (ids[0] ?? null) };
}

export function parseCell(column: TableColumn, raw: string, lookup?: RowLookup): ParsedCell {
  const text = raw.trim();
  if (column.kind === 'checkbox') {
    const lower = text.toLowerCase();
    if (TRUE.has(lower)) return { value: true };
    if (FALSE.has(lower)) return { value: false };
    return { error: 'checkbox' };
  }
  if (text === '' || column.kind === 'formula' || column.kind === 'link') return { value: null };
  switch (column.kind) {
    case 'text':
      return { value: column.maxLength === null ? text : text.slice(0, column.maxLength) };
    case 'number':
      return parseNumber(column, text);
    case 'choice': {
      const wanted = column.multiple ? splitList(text) : [text];
      const values: string[] = [];
      for (const item of wanted) {
        const option = column.options.find(
          (candidate) => candidate.value.toLowerCase() === item.toLowerCase(),
        );
        if (!option) return { error: 'option' };
        values.push(option.value);
      }
      return { value: column.multiple ? values : (values[0] ?? null) };
    }
    case 'date':
      return isDate(text) ? { value: text } : { error: 'date' };
    case 'colour':
      return HEX.test(text) ? { value: text.toLowerCase() } : { error: 'colour' };
    case 'image':
      return { value: text };
    case 'dice': {
      const dice = parseDice(text);
      return dice ? { value: dice.notation } : { error: 'dice' };
    }
    case 'reference':
      return parseReference(column, text, lookup);
  }
}

function isLink(value: unknown): value is BoardLink {
  return typeof value === 'object' && value !== null && 'kind' in value && 'id' in value;
}

function linkText(value: BoardLink): string {
  return `${value.kind}:${value.id}`;
}

export function formatCell(column: TableColumn, value: TableCell | undefined, lookup?: RowLookup): string {
  if (value === null || value === undefined) return '';
  if (column.kind === 'reference') {
    const rows = column.tableId === null || !lookup ? [] : lookup.rowsOf(column.tableId);
    const keyOf = (id: string) => rows.find((row) => row.id === id)?.key ?? '?';
    if (Array.isArray(value)) return value.map((id) => (typeof id === 'string' ? keyOf(id) : '?')).join(', ');
    return typeof value === 'string' ? keyOf(value) : '';
  }
  if (isLink(value)) return linkText(value);
  if (Array.isArray(value)) return value.map((item) => (isLink(item) ? linkText(item) : item)).join(', ');
  return String(value);
}
