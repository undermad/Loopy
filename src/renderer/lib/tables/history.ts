import type { RowOp, TableCells, TableRow } from '@shared/tables';

interface Shadow {
  id: string;
  key: string;
  cells: TableCells;
}

function place(list: Shadow[], item: Shadow, after: string | null | undefined): void {
  if (after === undefined) {
    list.push(item);
    return;
  }
  const index = after === null ? 0 : list.findIndex((entry) => entry.id === after) + 1;
  list.splice(index, 0, item);
}

function previousId(list: Shadow[], id: string): string | null {
  const index = list.findIndex((entry) => entry.id === id);
  return index > 0 ? (list[index - 1]?.id ?? null) : null;
}

export function inverseOps(rows: readonly TableRow[], ops: readonly RowOp[]): RowOp[] {
  const list: Shadow[] = rows.map((row) => ({ id: row.id, key: row.key, cells: { ...row.cells } }));
  const inverse: RowOp[] = [];
  for (const op of ops) {
    if (op.op === 'insert') {
      const id = op.id ?? '';
      place(list, { id, key: op.key, cells: { ...op.cells } }, op.after);
      inverse.push({ op: 'delete', id });
      continue;
    }
    const index = list.findIndex((entry) => entry.id === op.id);
    const current = list[index];
    if (!current) continue;
    if (op.op === 'delete') {
      inverse.push({
        op: 'insert',
        id: op.id,
        key: current.key,
        cells: { ...current.cells },
        after: previousId(list, op.id),
      });
      list.splice(index, 1);
    } else if (op.op === 'move') {
      inverse.push({ op: 'move', id: op.id, after: previousId(list, op.id) });
      list.splice(index, 1);
      place(list, current, op.after);
    } else {
      const cells: TableCells = {};
      for (const name of Object.keys(op.cells ?? {})) cells[name] = current.cells[name] ?? null;
      current.cells = Object.fromEntries(
        Object.entries({ ...current.cells, ...op.cells }).filter(([, value]) => value !== null),
      );
      inverse.push({
        op: 'update',
        id: op.id,
        ...(op.key === undefined ? {} : { key: current.key }),
        ...(op.cells === undefined ? {} : { cells }),
      });
      if (op.key !== undefined) current.key = op.key;
    }
  }
  return inverse.reverse();
}
