export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

export function normaliseHex(value: string): string | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match) return null;
  const digits = match[1] ?? '';
  const full = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  return `#${full.toLowerCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const normalised = normaliseHex(hex) ?? '#000000';
  const value = Number.parseInt(normalised.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function channel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hue = (((h % 360) + 360) % 360) / 60;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const m = v - chroma;
  const sector = Math.floor(hue);
  const table: [number, number, number][] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  const [red, green, blue] = table[sector] ?? [0, 0, 0];
  return { r: (red + m) * 255, g: (green + m) * 255, b: (blue + m) * 255 };
}

export function hexToHsv(hex: string): Hsv {
  return rgbToHsv(hexToRgb(hex));
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const { h, s, v } = rgbToHsv({ r, g, b });
  const l = v * (1 - s / 2);
  const saturation = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s: saturation, l };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

function linear(value: number): number {
  const channelValue = value / 255;
  return channelValue <= 0.03928 ? channelValue / 12.92 : ((channelValue + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const [light, dark] = first >= second ? [first, second] : [second, first];
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastLevels {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export function contrastLevels(foreground: string, background: string): ContrastLevels {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

export function isLightColour(hex: string): boolean {
  return relativeLuminance(hex) > 0.4;
}

export function readableTextColour(hex: string): string {
  return isLightColour(hex) ? '#1a1a1a' : '#ffffff';
}

export function colourDistance(a: string, b: string): number {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  return Math.max(Math.abs(first.r - second.r), Math.abs(first.g - second.g), Math.abs(first.b - second.b));
}

export function mixHex(a: string, b: string, amount: number): string {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  const t = Math.min(1, Math.max(0, amount));
  return rgbToHex({
    r: first.r + (second.r - first.r) * t,
    g: first.g + (second.g - first.g) * t,
    b: first.b + (second.b - first.b) * t,
  });
}

export function formatRgb(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

export function formatHsl(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `hsl(${String(Math.round(h))}, ${String(Math.round(s * 100))}%, ${String(Math.round(l * 100))}%)`;
}
