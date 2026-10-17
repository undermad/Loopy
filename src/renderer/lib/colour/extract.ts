import { hsvToHex, rgbToHex, rgbToHsv, type Rgb } from './convert';

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Cluster {
  colour: Rgb;
  weight: number;
}

export const MOODS = ['colourful', 'bright', 'muted', 'deep', 'dark'] as const;
export type Mood = (typeof MOODS)[number];

const MAX_SAMPLES = 4096;
const ITERATIONS = 10;

function samplePixels(pixels: Pixels): Rgb[] {
  const total = pixels.width * pixels.height;
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES));
  const result: Rgb[] = [];
  for (let index = 0; index < total; index += step) {
    const offset = index * 4;
    const alpha = pixels.data[offset + 3] ?? 255;
    if (alpha < 128) continue;
    result.push({
      r: pixels.data[offset] ?? 0,
      g: pixels.data[offset + 1] ?? 0,
      b: pixels.data[offset + 2] ?? 0,
    });
  }
  return result;
}

function squaredDistance(a: Rgb, b: Rgb): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function initialCentres(samples: Rgb[], count: number): Rgb[] {
  const random = seededRandom(samples.length * 7919);
  const centres: Rgb[] = [];
  const first = samples[Math.floor(random() * samples.length)];
  if (!first) return centres;
  centres.push(first);
  while (centres.length < count) {
    const distances = samples.map((sample) =>
      Math.min(...centres.map((centre) => squaredDistance(sample, centre))),
    );
    const total = distances.reduce((sum, distance) => sum + distance, 0);
    if (total === 0) break;
    let threshold = random() * total;
    let chosen = samples[samples.length - 1];
    for (let index = 0; index < samples.length; index += 1) {
      threshold -= distances[index] ?? 0;
      if (threshold <= 0) {
        chosen = samples[index];
        break;
      }
    }
    if (chosen) centres.push(chosen);
  }
  return centres;
}

export function clusterPixels(pixels: Pixels, count = 16): Cluster[] {
  const samples = samplePixels(pixels);
  if (samples.length === 0) return [];
  const centres = initialCentres(samples, Math.min(count, samples.length));
  let assignments = new Array<number>(samples.length).fill(0);
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    assignments = samples.map((sample) => {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centres.forEach((centre, index) => {
        const distance = squaredDistance(sample, centre);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    });
    const sums = centres.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    samples.forEach((sample, index) => {
      const bucket = sums[assignments[index] ?? 0];
      if (!bucket) return;
      bucket.r += sample.r;
      bucket.g += sample.g;
      bucket.b += sample.b;
      bucket.n += 1;
    });
    sums.forEach((bucket, index) => {
      if (bucket.n > 0)
        centres[index] = { r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n };
    });
  }
  const counts = centres.map(() => 0);
  for (const assignment of assignments) counts[assignment] = (counts[assignment] ?? 0) + 1;
  return centres
    .map((colour, index) => ({ colour, weight: (counts[index] ?? 0) / samples.length }))
    .filter((cluster) => cluster.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

function moodScore(cluster: Cluster, mood: Mood): number {
  const { s, v } = rgbToHsv(cluster.colour);
  const presence = Math.sqrt(cluster.weight);
  switch (mood) {
    case 'colourful':
      return s * v * (0.5 + presence);
    case 'bright':
      return v * (0.6 + 0.4 * s) * (0.5 + presence);
    case 'muted':
      return (1 - s) * (0.4 + 0.6 * v) * (0.5 + presence);
    case 'deep':
      return s * (1 - Math.abs(v - 0.45)) * (0.5 + presence);
    case 'dark':
      return (1 - v) * (0.5 + presence);
  }
}

function tooClose(candidate: Rgb, chosen: Rgb[], threshold: number): boolean {
  return chosen.some((colour) => squaredDistance(colour, candidate) < threshold * threshold);
}

export function pickMood(clusters: Cluster[], mood: Mood, count = 5): string[] {
  const ranked = [...clusters].sort((a, b) => moodScore(b, mood) - moodScore(a, mood));
  const chosen: Rgb[] = [];
  for (const threshold of [48, 24, 0]) {
    for (const cluster of ranked) {
      if (chosen.length >= count) break;
      if (chosen.includes(cluster.colour)) continue;
      if (!tooClose(cluster.colour, chosen, threshold)) chosen.push(cluster.colour);
    }
    if (chosen.length >= count) break;
  }
  return chosen.slice(0, count).map(rgbToHex);
}

export function extractPalette(pixels: Pixels, mood: Mood, count = 5): string[] {
  const clusters = clusterPixels(pixels, Math.max(12, count * 3));
  const picked = pickMood(clusters, mood, count);
  while (picked.length < count && picked.length > 0) picked.push(picked[picked.length - 1] ?? '#000000');
  return picked;
}

export function extractGradient(pixels: Pixels, stops: number): string[] {
  const clusters = clusterPixels(pixels, Math.max(8, stops * 2));
  if (clusters.length === 0) return [];
  const byValue = [...clusters]
    .sort((a, b) => rgbToHsv(a.colour).v - rgbToHsv(b.colour).v)
    .map((cluster) => cluster.colour);
  const chosen: Rgb[] = [];
  const wanted = Math.max(2, Math.min(stops, byValue.length));
  for (let index = 0; index < wanted; index += 1) {
    const position = Math.round((index * (byValue.length - 1)) / Math.max(1, wanted - 1));
    const colour = byValue[position];
    if (colour) chosen.push(colour);
  }
  return chosen.map(rgbToHex);
}

export function sampleAt(pixels: Pixels, x: number, y: number): string {
  const column = Math.min(pixels.width - 1, Math.max(0, Math.round(x)));
  const row = Math.min(pixels.height - 1, Math.max(0, Math.round(y)));
  const offset = (row * pixels.width + column) * 4;
  return rgbToHex({
    r: pixels.data[offset] ?? 0,
    g: pixels.data[offset + 1] ?? 0,
    b: pixels.data[offset + 2] ?? 0,
  });
}

export interface Marker {
  x: number;
  y: number;
}

export function markersFor(pixels: Pixels, colours: string[]): Marker[] {
  const samples: { x: number; y: number; rgb: Rgb }[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((pixels.width * pixels.height) / 2048)));
  for (let y = 0; y < pixels.height; y += step) {
    for (let x = 0; x < pixels.width; x += step) {
      const offset = (y * pixels.width + x) * 4;
      samples.push({
        x,
        y,
        rgb: {
          r: pixels.data[offset] ?? 0,
          g: pixels.data[offset + 1] ?? 0,
          b: pixels.data[offset + 2] ?? 0,
        },
      });
    }
  }
  return colours.map((hex) => {
    const target = hexToRgbLocal(hex);
    let best = samples[0] ?? { x: 0, y: 0, rgb: target };
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const sample of samples) {
      const distance = squaredDistance(sample.rgb, target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = sample;
      }
    }
    return { x: best.x / Math.max(1, pixels.width - 1), y: best.y / Math.max(1, pixels.height - 1) };
  });
}

function hexToRgbLocal(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function gradientCss(colours: string[], angle = 90): string {
  if (colours.length === 0) return 'transparent';
  if (colours.length === 1) return colours[0] ?? 'transparent';
  const stops = colours.map(
    (hex, index) => `${hex} ${String(Math.round((index / (colours.length - 1)) * 100))}%`,
  );
  return `linear-gradient(${String(angle)}deg, ${stops.join(', ')})`;
}

export function syntheticPixels(colours: string[], width = 8, height = 8): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const hex = colours[index % Math.max(1, colours.length)] ?? '#000000';
    const { r, g, b } = hexToRgbLocal(hex);
    data.set([r, g, b, 255], index * 4);
  }
  return { data, width, height };
}

export function hueToHex(hue: number): string {
  return hsvToHex({ h: hue, s: 1, v: 1 });
}
