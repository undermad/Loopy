import type { FormulaResult } from '@shared/formulas';
import {
  formatCell,
  parseCell,
  type CellError,
  type DataTable,
  type RowLookup,
  type RowOp,
  type TableCell,
  type TableCells,
  type TableColumn,
  type TableRow,
} from '@shared/tables';

export interface RangeInput {
  scrollTop: number;
  height: number;
  rowHeight: number;
  count: number;
  overscan: number;
}

export function visibleRange({ scrollTop, height, rowHeight, count, overscan }: RangeInput) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  return { start, end };
}

export interface SortState {
  columnId: string | null;
  direction: 'asc' | 'desc';
}

export type Computed = ReadonlyMap<string, Readonly<Record<string, FormulaResult>>>;

export function displayValue(column: TableColumn, row: TableRow, computed?: Computed): TableCell | undefined {
  if (column.kind === 'formula') {
    const result = computed?.get(row.id)?.[column.id];
    return result && 'value' in result ? result.value : undefined;
  }
  const value = row.cells[column.id];
  if (value === undefined && column.kind === 'checkbox') return column.defaultValue;
  return value;
}

function asText(value: TableCell | undefined): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function compareValues(a: TableCell | undefined, b: TableCell | undefined): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return asText(a).localeCompare(asText(b), undefined, { numeric: true, sensitivity: 'base' });
}

function isBlank(value: TableCell | undefined): boolean {
  return (
    value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
  );
}

export function sortRows(
  rows: readonly TableRow[],
  sort: SortState | null,
  table: DataTable,
  lookup?: RowLookup,
  computed?: Computed,
): readonly TableRow[] {
  if (!sort) return rows;
  const column = table.columns.find((candidate) => candidate.id === sort.columnId);
  const valueOf = (row: TableRow): TableCell | undefined => {
    if (!column) return row.key;
    if (column.kind === 'reference' || column.kind === 'link' || Array.isArray(row.cells[column.id]))
      return formatCell(column, row.cells[column.id], lookup);
    return displayValue(column, row, computed);
  };
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (isBlank(left) || isBlank(right)) return Number(isBlank(left)) - Number(isBlank(right));
    return sign * compareValues(left, right);
  });
}

export function filterRows(
  rows: readonly TableRow[],
  query: string,
  table: DataTable,
  lookup?: RowLookup,
  computed?: Computed,
): readonly TableRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter((row) => {
    const text = [
      row.key,
      ...table.columns.map((column) =>
        formatCell(column, displayValue(column, row, computed) ?? null, lookup),
      ),
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function nextRowKey(
  rows: readonly Pick<TableRow, 'key'>[],
  base = 'row',
  taken: ReadonlySet<string> = new Set(),
): string {
  const pattern = new RegExp(`^${base}_(\\d+)$`);
  let highest = 0;
  for (const key of [...rows.map((row) => row.key), ...taken]) {
    const match = pattern.exec(key);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${base}_${String(highest + 1)}`;
}

export interface CellRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export function copyMatrix(
  table: DataTable,
  rows: readonly TableRow[],
  range: CellRange,
  lookup?: RowLookup,
  computed?: Computed,
): string[][] {
  const matrix: string[][] = [];
  for (let index = range.top; index <= range.bottom; index += 1) {
    const row = rows[index];
    if (!row) continue;
    const line: string[] = [];
    for (let column = range.left; column <= range.right; column += 1) {
      const definition = table.columns[column - 1];
      if (column === 0) line.push(row.key);
      else if (definition)
        line.push(formatCell(definition, displayValue(definition, row, computed) ?? null, lookup));
    }
    matrix.push(line);
  }
  return matrix;
}

export interface PasteError {
  row: number;
  column: number;
  error: CellError | 'key';
}

export function pasteOps(
  table: DataTable,
  rows: readonly TableRow[],
  anchor: { row: number; column: number },
  matrix: readonly (readonly string[])[],
  lookup?: RowLookup,
): { ops: RowOp[]; errors: PasteError[] } {
  const ops: RowOp[] = [];
  const errors: PasteError[] = [];
  const taken = new Set(rows.map((row) => row.key));
  matrix.forEach((line, offset) => {
    const index = anchor.row + offset;
    const existing = rows[index];
    const cells: TableCells = {};
    let key: string | undefined;
    let refused = false;
    for (const [step, text] of line.entries()) {
      const column = anchor.column + step;
      if (column === 0) {
        const wanted = text.trim();
        if (wanted === '' || wanted === existing?.key) continue;
        if (taken.has(wanted)) {
          errors.push({ row: index, column, error: 'key' });
          refused = true;
        } else key = wanted;
        continue;
      }
      const definition = table.columns[column - 1];
      if (!definition || definition.kind === 'formula') continue;
      const parsed = parseCell(definition, text, lookup);
      if ('error' in parsed) errors.push({ row: index, column, error: parsed.error });
      else if (existing || parsed.value !== null) cells[definition.id] = parsed.value;
    }
    if (refused && !existing) return;
    if (key !== undefined) taken.add(key);
    const hasCells = Object.keys(cells).length > 0;
    if (existing) {
      if (key === undefined && !hasCells) return;
      ops.push({
        op: 'update',
        id: existing.id,
        ...(key === undefined ? {} : { key }),
        ...(hasCells ? { cells } : {}),
      });
      return;
    }
    const newKey = key ?? nextRowKey(rows, 'row', taken);
    taken.add(newKey);
    ops.push({ op: 'insert', key: newKey, cells });
  });
  return { ops, errors };
}

export function fillDownOps(table: DataTable, rows: readonly TableRow[], range: CellRange): RowOp[] {
  const source = rows[range.top];
  if (!source) return [];
  const cells: TableCells = {};
  for (let column = Math.max(1, range.left); column <= range.right; column += 1) {
    const definition = table.columns[column - 1];
    if (!definition || definition.kind === 'formula') continue;
    cells[definition.id] = source.cells[definition.id] ?? null;
  }
  if (Object.keys(cells).length === 0) return [];
  const ops: RowOp[] = [];
  for (let index = range.top + 1; index <= range.bottom; index += 1) {
    const row = rows[index];
    if (row) ops.push({ op: 'update', id: row.id, cells: { ...cells } });
  }
  return ops;
}
