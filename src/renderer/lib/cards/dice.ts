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

export interface DiceParts {
  count: number;
  sides: number;
  modifier: number;
}

const SIMPLE = /^(\d*)d(\d+)([+-]\d+)?$/;

export function diceParts(notation: string): DiceParts | null {
  const match = SIMPLE.exec(notation.replace(/\s+/g, '').toLowerCase());
  if (!match) return null;
  return {
    count: match[1] ? Number(match[1]) : 1,
    sides: Number(match[2]),
    modifier: match[3] ? Number(match[3]) : 0,
  };
}

export function diceNotation({ count, sides, modifier }: DiceParts): string {
  const tail = modifier === 0 ? '' : modifier > 0 ? `+${String(modifier)}` : String(modifier);
  return `${String(count)}d${String(sides)}${tail}`;
}

export function rollDice(
  notation: string,
  random: () => number = Math.random,
): { total: number; rolls: number[] } | null {
  const roll = parseDice(notation);
  if (!roll) return null;
  let total = 0;
  const rolls: number[] = [];
  for (const [, sign, count, isDie, number] of roll.notation.matchAll(TERM)) {
    const direction = sign === '-' ? -1 : 1;
    const value = Number(number);
    if (!isDie) {
      total += direction * value;
      continue;
    }
    const amount = count === '' ? 1 : Number(count);
    for (let die = 0; die < amount; die += 1) {
      const face = Math.min(value, Math.floor(random() * value) + 1) * direction;
      rolls.push(face);
      total += face;
    }
  }
  return { total, rolls };
}
