import { evaluateFormula, formulaNames, parseDice, type FormulaResult } from '../formulas';
import type { RowLookup } from './cells';
import type { DataTable, TableCell, TableColumn, TableRow } from './schema';

export interface TableLookup extends RowLookup {
  tableOf: (tableId: string) => DataTable | undefined;
}

export type RowFormulas = Record<string, FormulaResult>;

export type IssueCode =
  'required' | 'unique' | 'type' | 'min' | 'max' | 'integer' | 'option' | 'reference' | 'formula';

export interface TableIssue {
  rowId: string;
  columnId: string;
  code: IssueCode;
}

type ColumnOf<K extends TableColumn['kind']> = Extract<TableColumn, { kind: K }>;

function numericValue(column: TableColumn, value: TableCell | undefined): number | undefined {
  if (column.kind === 'number') return typeof value === 'number' ? value : (column.defaultValue ?? undefined);
  if (column.kind === 'checkbox') return (typeof value === 'boolean' ? value : column.defaultValue) ? 1 : 0;
  if (column.kind === 'dice' && typeof value === 'string') return parseDice(value)?.average;
  return undefined;
}

function rowScope(table: DataTable, row: TableRow, lookup: TableLookup | undefined, depth: number) {
  const scope: Record<string, number> = {};
  for (const column of table.columns) {
    const value = numericValue(column, row.cells[column.id]);
    if (value !== undefined) scope[column.id] = value;
    if (column.kind !== 'reference' || column.multiple || column.tableId === null || !lookup || depth > 0)
      continue;
    const target = lookup.tableOf(column.tableId);
    const id = row.cells[column.id];
    const linked =
      typeof id === 'string' ? lookup.rowsOf(column.tableId).find((item) => item.id === id) : undefined;
    if (!target || !linked) continue;
    const nested = { ...rowScope(target, linked, lookup, depth + 1) };
    for (const [name, result] of Object.entries(rowFormulas(target, linked, nested))) {
      if ('value' in result) nested[name] = result.value;
    }
    for (const [name, number] of Object.entries(nested)) scope[`${column.id}.${name}`] = number;
  }
  return scope;
}

function rounded(result: FormulaResult, decimals: number | null): FormulaResult {
  if (!('value' in result) || decimals === null) return result;
  const factor = 10 ** decimals;
  return { value: Math.round(result.value * factor) / factor };
}

function rowFormulas(table: DataTable, row: TableRow, scope: Record<string, number>): RowFormulas {
  const formulas = new Map(
    table.columns
      .filter((column): column is ColumnOf<'formula'> => column.kind === 'formula')
      .map((column) => [column.id, column]),
  );
  const results: RowFormulas = {};
  const values = { ...scope };
  const resolve = (id: string, stack: Set<string>): FormulaResult => {
    const done = results[id];
    if (done) return done;
    const column = formulas.get(id);
    if (!column) return { error: 'unknown', name: id };
    if (stack.has(id)) return { error: 'cycle', name: id };
    stack.add(id);
    let result: FormulaResult | null = null;
    for (const name of formulaNames(column.expression)) {
      if (!formulas.has(name)) continue;
      const dependency = resolve(name, stack);
      if ('error' in dependency && dependency.error === 'cycle') result = { error: 'cycle', name: id };
    }
    stack.delete(id);
    result ??= rounded(evaluateFormula(column.expression, values), column.decimals);
    results[id] = result;
    if ('value' in result) values[id] = result.value;
    return result;
  };
  for (const id of formulas.keys()) resolve(id, new Set());
  return Object.fromEntries([...formulas.keys()].map((id) => [id, results[id] ?? { error: 'empty' }]));
}

export function computeTable(
  table: DataTable,
  rows: readonly TableRow[],
  lookup?: TableLookup,
): Map<string, RowFormulas> {
  const computed = new Map<string, RowFormulas>();
  if (!table.columns.some((column) => column.kind === 'formula')) return computed;
  for (const row of rows) computed.set(row.id, rowFormulas(table, row, rowScope(table, row, lookup, 0)));
  return computed;
}

const HEX = /^#[0-9a-f]{6}$/i;

function isLink(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'kind' in value;
}

function strings(value: TableCell): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function fitsType(column: TableColumn, value: TableCell): boolean {
  switch (column.kind) {
    case 'text':
    case 'date':
    case 'image':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'checkbox':
      return typeof value === 'boolean';
    case 'colour':
      return typeof value === 'string' && HEX.test(value);
    case 'dice':
      return typeof value === 'string' && parseDice(value) !== null;
    case 'choice':
    case 'reference':
      return column.multiple ? strings(value) : typeof value === 'string';
    case 'link':
      return column.multiple ? Array.isArray(value) && value.every(isLink) : isLink(value);
    case 'formula':
      return true;
  }
}

function isEmpty(value: TableCell | undefined): value is null | undefined {
  return (
    value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
  );
}

function columnIssue(
  column: TableColumn,
  value: TableCell,
  lookup: TableLookup | undefined,
): IssueCode | null {
  if (!fitsType(column, value)) return 'type';
  if (column.kind === 'number' && typeof value === 'number') {
    if (column.min !== null && value < column.min) return 'min';
    if (column.max !== null && value > column.max) return 'max';
    if (column.integer && !Number.isInteger(value)) return 'integer';
  }
  if (column.kind === 'choice') {
    const allowed = new Set(column.options.map((option) => option.value));
    const picked = Array.isArray(value) ? value : [value];
    if (picked.some((item) => typeof item !== 'string' || !allowed.has(item))) return 'option';
  }
  if (column.kind === 'reference') {
    const ids = new Set(
      column.tableId === null || !lookup ? [] : lookup.rowsOf(column.tableId).map((row) => row.id),
    );
    const picked = Array.isArray(value) ? value : [value];
    if (picked.some((item) => typeof item !== 'string' || !ids.has(item))) return 'reference';
  }
  return null;
}

export function validateTable(
  table: DataTable,
  rows: readonly TableRow[],
  lookup?: TableLookup,
): TableIssue[] {
  const counts = new Map<string, Map<string, number>>();
  for (const column of table.columns.filter((candidate) => candidate.unique)) {
    const seen = new Map<string, number>();
    for (const row of rows) {
      const value = row.cells[column.id];
      if (isEmpty(value)) continue;
      const text = JSON.stringify(value);
      seen.set(text, (seen.get(text) ?? 0) + 1);
    }
    counts.set(column.id, seen);
  }
  const formulas = computeTable(table, rows, lookup);
  const issues: TableIssue[] = [];
  for (const row of rows) {
    for (const column of table.columns) {
      const issue = (code: IssueCode) => issues.push({ rowId: row.id, columnId: column.id, code });
      if (column.kind === 'formula') {
        const result = formulas.get(row.id)?.[column.id];
        if (result && 'error' in result && result.error !== 'empty') issue('formula');
        continue;
      }
      const value = row.cells[column.id];
      if (isEmpty(value)) {
        if (column.required) issue('required');
        continue;
      }
      const found = columnIssue(column, value, lookup);
      if (found) {
        issue(found);
        continue;
      }
      if ((counts.get(column.id)?.get(JSON.stringify(value)) ?? 0) > 1) issue('unique');
    }
  }
  return issues;
}
