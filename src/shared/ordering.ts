const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`Keys out of order: ${a} >= ${b}`);
  if (a.endsWith('0') || b?.endsWith('0')) throw new Error('Keys must not end with 0');
  if (b !== null) {
    let shared = 0;
    while ((a[shared] ?? '0') === b[shared]) shared += 1;
    if (shared > 0) return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared));
  }
  const digitA = a ? DIGITS.indexOf(a[0] ?? '0') : 0;
  const digitB = b !== null && b.length > 0 ? DIGITS.indexOf(b[0] ?? '0') : DIGITS.length;
  if (digitB - digitA > 1) {
    const mid = Math.round(0.5 * (digitA + digitB));
    return DIGITS[mid] ?? 'i';
  }
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return (DIGITS[digitA] ?? '0') + midpoint(a.slice(1), null);
}

export function keyBetween(before: string | null, after: string | null): string {
  return midpoint(before ?? '', after);
}

export function firstKey(): string {
  return keyBetween(null, null);
}

export function keysBetween(before: string | null, after: string | null, count: number): string[] {
  const keys: string[] = [];
  let previous = before;
  for (let index = 0; index < count; index += 1) {
    const key = keyBetween(previous, after);
    keys.push(key);
    previous = key;
  }
  return keys;
}

export function byPosition<T extends { position: string }>(a: T, b: T): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}
