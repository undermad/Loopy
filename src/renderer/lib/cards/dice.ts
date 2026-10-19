export interface DiceRoll {
  notation: string;
  min: number;
  max: number;
  average: number;
}

const NOTATION = /^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/;
const TERM = /([+-]?)(\d*)(d?)(\d+)/g;
const MAX_DICE = 100;
const MAX_SIDES = 1000;

export function parseDice(text: string): DiceRoll | null {
  const notation = text.replace(/\s+/g, '').toLowerCase();
  if (!NOTATION.test(notation)) return null;
  let min = 0;
  let max = 0;
  let average = 0;
  let dice = 0;
  for (const [, sign, count, isDie, number] of notation.matchAll(TERM)) {
    const direction = sign === '-' ? -1 : 1;
    const value = Number(number);
    if (!isDie) {
      min += direction * value;
      max += direction * value;
      average += direction * value;
      continue;
    }
    const amount = count === '' ? 1 : Number(count);
    dice += amount;
    if (amount < 1 || value < 2 || value > MAX_SIDES || dice > MAX_DICE) return null;
    const low = amount;
    const high = amount * value;
    min += direction > 0 ? low : -high;
    max += direction > 0 ? high : -low;
    average += (direction * amount * (value + 1)) / 2;
  }
  return { notation, min, max, average };
}
