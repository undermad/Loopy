import type { CardValue } from '@shared/board';
import type { CardField, FieldOf } from '@shared/cards';
import { symbolCount } from './values';

const WORDS = ['Ember', 'Frost', 'Gale', 'Stone', 'Tide', 'Thorn', 'Dusk', 'Spark'];
const SENTENCES = [
  'Strikes first when the moon is full.',
  'Guards the old bridge and asks a riddle of every traveller.',
  'Grows stronger for each ally beside it.',
];
const STEPS = ['Find the key', 'Open the gate', 'Speak to the keeper'];
const DICE = ['1d6', '2d6+1', '3d4', '1d20'];
const COLOURS = ['#e85d75', '#3b82f6', '#22c55e', '#f59e0b'];

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleNumber(field: FieldOf<'number'>, between: (low: number, high: number) => number): CardValue {
  if (field.display === 'symbols' && !field.range) return between(1, symbolCount(field));
  const bar = field.display === 'bar' && !field.range;
  const low = field.min ?? (bar ? 0 : 1);
  const high = Math.max(low, field.max ?? (bar ? 100 : 20));
  if (!field.range) return between(low, high);
  const first = between(low, high);
  const second = between(low, high);
  return { min: Math.min(first, second), max: Math.max(first, second) };
}

export function sampleValues(fields: readonly CardField[], seed = 1): Record<string, CardValue> {
  const next = random(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const between = (low: number, high: number) => Math.round(low + next() * (high - low));
  const values: Record<string, CardValue> = {};
  for (const field of fields) {
    const value = sampleOf(field);
    if (value !== null) values[field.id] = value;
  }
  return values;

  function sampleOf(field: CardField): CardValue {
    switch (field.kind) {
      case 'text':
        if (field.fixed) return null;
        return field.lines === 'multi' ? pick(SENTENCES) : `${pick(WORDS)} ${field.label || 'Sample'}`.trim();
      case 'number':
        return sampleNumber(field, between);
      case 'choice': {
        const options = field.options.map((option) => option.value);
        const pool = options.length > 0 ? options : field.allowNew ? WORDS : [];
        if (pool.length === 0) return null;
        if (!field.multiple) return pick(pool);
        return [...new Set([pick(pool), pick(pool)])];
      }
      case 'date':
        return `2026-${String(between(1, 9)).padStart(2, '0')}-${String(between(10, 28))}`;
      case 'checkbox':
        return next() > 0.5;
      case 'checklist':
        return STEPS.slice(0, 2).map((text, index) => ({ text, done: index === 0 }));
      case 'dice':
        return pick(DICE);
      case 'colour':
        return pick(COLOURS);
      case 'attributes':
        return field.rows.length > 0
          ? Object.fromEntries(field.rows.map((row) => [row.id, between(1, 10)]))
          : null;
      default:
        return null;
    }
  }
}
