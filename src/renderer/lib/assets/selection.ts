export interface PickModifiers {
  ctrl: boolean;
  shift: boolean;
}

export interface Picked {
  selection: string[];
  anchor: string;
}

export interface ClickRecord {
  key: string;
  time: number;
}

export const RENAME_CLICK_WINDOW = { min: 500, max: 1500 } as const;

export function pickSelection(
  order: readonly string[],
  current: readonly string[],
  anchor: string | null,
  key: string,
  modifiers: PickModifiers,
): Picked {
  if (modifiers.shift && anchor !== null) {
    const from = order.indexOf(anchor);
    const to = order.indexOf(key);
    if (from >= 0 && to >= 0) {
      return { selection: order.slice(Math.min(from, to), Math.max(from, to) + 1), anchor };
    }
  }
  if (modifiers.ctrl) {
    const selection = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    return { selection, anchor: key };
  }
  return { selection: [key], anchor: key };
}

export function recordClick(key: string, time = Date.now()): ClickRecord {
  return { key, time };
}

export function isRenameClick(previous: ClickRecord | null, key: string, time = Date.now()): boolean {
  if (previous?.key !== key) return false;
  const elapsed = time - previous.time;
  return elapsed >= RENAME_CLICK_WINDOW.min && elapsed <= RENAME_CLICK_WINDOW.max;
}
