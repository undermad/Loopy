import type { CSSProperties } from 'react';
import { CARD_COLUMNS, CARD_MAX_FIELD_HEIGHT, CARD_MIN_FIELD_HEIGHT, type CardField } from '@shared/cards';

const HEIGHT_STEP = 4;

export function clampSpan(span: number): number {
  if (!Number.isFinite(span)) return 1;
  return Math.min(CARD_COLUMNS, Math.max(1, Math.round(span)));
}

export function spanFromPixels(width: number, gridWidth: number, gap: number): number {
  const column = (gridWidth - gap * (CARD_COLUMNS - 1)) / CARD_COLUMNS;
  if (column <= 0) return CARD_COLUMNS;
  return clampSpan((width + gap) / (column + gap));
}

export function snapHeight(height: number, snap = true): number | null {
  const value = snap ? Math.round(height / HEIGHT_STEP) * HEIGHT_STEP : Math.round(height);
  if (value < CARD_MIN_FIELD_HEIGHT) return null;
  return Math.min(CARD_MAX_FIELD_HEIGHT, value);
}

export function fieldGridStyle(field: CardField): CSSProperties {
  const span = `span ${String(field.span)}`;
  return {
    gridColumn: field.newRow ? `1 / ${span}` : span,
    ...(field.height === null ? {} : { minHeight: field.height }),
  };
}

export interface FieldDropTarget {
  zone: CardField['zone'];
  beforeId: string | null;
}

export function moveFieldTo(fields: CardField[], id: string, target: FieldDropTarget): CardField[] {
  const moving = fields.find((field) => field.id === id);
  if (!moving || target.beforeId === id) return fields;
  const rest = fields.filter((field) => field.id !== id);
  const placed = { ...moving, zone: target.zone };
  const at = target.beforeId === null ? -1 : rest.findIndex((field) => field.id === target.beforeId);
  return at < 0 ? [...rest, placed] : [...rest.slice(0, at), placed, ...rest.slice(at)];
}

export function updateFields(
  fields: CardField[],
  ids: readonly string[],
  change: (field: CardField) => CardField,
): CardField[] {
  return fields.map((field) => (ids.includes(field.id) ? change(field) : field));
}

export function dropField(fields: CardField[], activeId: string, overId: string | null): CardField[] {
  if (!overId || overId === activeId) return fields;
  if (overId.startsWith('zone:')) {
    return moveFieldTo(fields, activeId, { zone: overId.slice(5) as CardField['zone'], beforeId: null });
  }
  const from = fields.findIndex((field) => field.id === activeId);
  const target = fields.find((field) => field.id === overId);
  if (from < 0 || !target) return fields;
  if (fields[from]?.zone !== target.zone) {
    return moveFieldTo(fields, activeId, { zone: target.zone, beforeId: target.id });
  }
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(fields.indexOf(target), 0, moved);
  return next;
}
