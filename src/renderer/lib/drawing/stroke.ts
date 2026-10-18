import type { BrushSettings } from '@shared/brushes';

export interface Sample {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
}

export interface Dab {
  x: number;
  y: number;
  diameter: number;
  angle: number;
  roundness: number;
  alpha: number;
}

type Dynamic = BrushSettings['sizeJitter'];

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function controlValue(dynamic: Dynamic, sample: Sample): number {
  if (dynamic.control === 'pressure') return sample.pressure;
  if (dynamic.control === 'tilt') return Math.min(1, Math.hypot(sample.tiltX, sample.tiltY) / 90);
  return 1;
}

function mix(a: Sample, b: Sample, t: number): Sample {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    tiltX: a.tiltX + (b.tiltX - a.tiltX) * t,
    tiltY: a.tiltY + (b.tiltY - a.tiltY) * t,
  };
}

function quadratic(from: Sample, control: Sample, to: Sample, t: number): Sample {
  return mix(mix(from, control, t), mix(control, to, t), t);
}

export interface StrokeSampler {
  add: (sample: Sample) => Dab[];
  finish: () => Dab[];
}

export function createStroke(settings: BrushSettings, scale: number, seed = Date.now()): StrokeSampler {
  const random = seededRandom(seed);
  const base = settings.size * scale;
  const follow = 1 - settings.smoothing * 0.92;
  const points: Sample[] = [];
  let smoothed: Sample | null = null;
  let raw: Sample | null = null;
  let tail: Sample | null = null;
  let carry = 0;
  let started = false;

  function diameterAt(sample: Sample): number {
    const control = controlValue(settings.sizeJitter, sample);
    const shaped =
      settings.sizeJitter.control === 'off' ? 1 : settings.minSize + (1 - settings.minSize) * control;
    return Math.max(0.25, base * shaped);
  }

  function dabsAt(sample: Sample): Dab[] {
    const dabs: Dab[] = [];
    const diameter = diameterAt(sample);
    for (let index = 0; index < settings.count; index += 1) {
      const size = diameter * (1 - settings.sizeJitter.amount * random());
      let x = sample.x;
      let y = sample.y;
      if (settings.scatter.amount > 0) {
        const reach = settings.scatter.amount * diameter * Math.sqrt(random()) * 0.5;
        const turn = random() * Math.PI * 2;
        x += Math.cos(turn) * reach;
        y += Math.sin(turn) * reach;
      }
      const opacityControl =
        settings.opacityJitter.control === 'off' ? 1 : controlValue(settings.opacityJitter, sample);
      const alpha = settings.flow * opacityControl * (1 - settings.opacityJitter.amount * random());
      const tilt =
        settings.angleJitter.control === 'tilt'
          ? (Math.atan2(sample.tiltY, sample.tiltX) * 180) / Math.PI
          : 0;
      const angle =
        (((settings.angle + tilt + settings.angleJitter.amount * random() * 360) % 360) + 360) % 360;
      if (size > 0 && alpha > 0)
        dabs.push({ x, y, diameter: size, angle, roundness: settings.roundness, alpha });
    }
    return dabs;
  }

  function walk(from: Sample, to: Sample, out: Dab[]): void {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) return;
    let travelled = 0;
    for (;;) {
      const step = Math.max(0.5, settings.spacing * diameterAt(mix(from, to, travelled / length)));
      const needed = step - carry;
      if (travelled + needed > length) {
        carry += length - travelled;
        return;
      }
      travelled += needed;
      carry = 0;
      out.push(...dabsAt(mix(from, to, travelled / length)));
    }
  }

  function curve(from: Sample, control: Sample, to: Sample, out: Dab[]): void {
    const length =
      Math.hypot(control.x - from.x, control.y - from.y) + Math.hypot(to.x - control.x, to.y - control.y);
    const pieces = Math.max(1, Math.min(32, Math.ceil(length / 4)));
    let previous = from;
    for (let index = 1; index <= pieces; index += 1) {
      const next = quadratic(from, control, to, index / pieces);
      walk(previous, next, out);
      previous = next;
    }
  }

  function push(point: Sample, out: Dab[]): void {
    points.push(point);
    if (points.length === 1) return;
    const a = points[points.length - 3];
    const b = points[points.length - 2];
    const c = points[points.length - 1];
    if (!b || !c) return;
    const end = mix(b, c, 0.5);
    if (!a) {
      walk(b, end, out);
    } else {
      curve(mix(a, b, 0.5), b, end, out);
    }
    tail = end;
    if (points.length > 3) points.shift();
  }

  return {
    add(sample) {
      const out: Dab[] = [];
      raw = sample;
      if (!started) {
        started = true;
        smoothed = sample;
        points.push(sample);
        tail = sample;
        out.push(...dabsAt(sample));
        return out;
      }
      const previous = smoothed ?? sample;
      smoothed = mix(previous, sample, follow);
      push(smoothed, out);
      return out;
    },
    finish() {
      const out: Dab[] = [];
      if (raw && smoothed && (raw.x !== smoothed.x || raw.y !== smoothed.y)) push(raw, out);
      const last = points[points.length - 1];
      if (tail && last) walk(tail, last, out);
      tail = last ?? null;
      return out;
    },
  };
}
