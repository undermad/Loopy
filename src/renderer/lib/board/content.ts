import { TABLE_MAX_COLUMNS, TABLE_MAX_ROWS, type ChecklistStep } from '@shared/board';

function stepId(taken: readonly ChecklistStep[]): string {
  let id = crypto.randomUUID().slice(0, 8);
  while (taken.some((step) => step.id === id)) id = crypto.randomUUID().slice(0, 8);
  return id;
}

export function addStep(steps: readonly ChecklistStep[], text: string): ChecklistStep[] {
  const trimmed = text.trim().slice(0, 200);
  if (trimmed === '') return steps as ChecklistStep[];
  return [...steps, { id: stepId(steps), text: trimmed, done: false }];
}

export function toggleStep(steps: readonly ChecklistStep[], id: string): ChecklistStep[] {
  return steps.map((step) => (step.id === id ? { ...step, done: !step.done } : step));
}

export function removeStep(steps: readonly ChecklistStep[], id: string): ChecklistStep[] {
  return steps.filter((step) => step.id !== id);
}

export function stepProgress(steps: readonly ChecklistStep[]): { done: number; total: number } {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

export function tableSize(rows: readonly (readonly string[])[]): { rows: number; columns: number } {
  return { rows: rows.length, columns: Math.max(0, ...rows.map((row) => row.length)) };
}

export function resizeTable(
  rows: readonly (readonly string[])[],
  rowCount: number,
  columnCount: number,
): string[][] {
  const height = Math.min(TABLE_MAX_ROWS, Math.max(1, Math.round(rowCount)));
  const width = Math.min(TABLE_MAX_COLUMNS, Math.max(1, Math.round(columnCount)));
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, column) => rows[row]?.[column] ?? ''),
  );
}

export function setCell(rows: string[][], row: number, column: number, text: string): string[][] {
  if (rows[row]?.[column] === undefined) return rows;
  return rows.map((cells, at) =>
    at === row ? cells.map((cell, index) => (index === column ? text.slice(0, 200) : cell)) : cells,
  );
}
