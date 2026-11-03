import { describe, expect, it } from 'vitest';
import css from './tokens.css?raw';

// R12.1: every text and UI pair in the design tokens meets WCAG 2.2 AA.

const raw = new Map<string, string>();
for (const match of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
  raw.set(match[1]!, match[2]!.trim());
}

function resolve(name: string): string {
  let value = raw.get(name);
  if (value === undefined) throw new Error(`no token ${name}`);
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  if (ref) value = resolve(ref[1]!);
  return value;
}

type Rgba = [number, number, number, number];
function parse(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  throw new Error(`cannot parse ${color}`);
}
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}
function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg: Rgba, bg: Rgba): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
const c = (name: string): Rgba => parse(resolve(name));

const SURFACES = ['ink-950', 'ink-900', 'ink-800', 'ink-700'];
const VERDICTS = ['alive', 'dying', 'dead', 'ghost', 'zombie'];

describe('R12.1 token contrast', () => {
  const text = ['bone-100', 'moon-200', 'fog-400', 'candle-300', 'candle-400', ...VERDICTS];
  for (const fg of text) {
    for (const bg of SURFACES) {
      it(`${fg} on ${bg} is at least 4.5:1`, () => {
        expect(contrast(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const v of VERDICTS) {
    it(`${v} on its own wash over ink-800 is at least 4.5:1`, () => {
      const wash = over(c(`${v}-wash`), c('ink-800'));
      expect(contrast(c(v), wash)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('dark text on the candle button is at least 4.5:1', () => {
    expect(contrast(c('ink-950'), c('candle-400'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c('ink-950'), c('candle-300'))).toBeGreaterThanOrEqual(4.5);
  });

  for (const bg of ['ink-950', 'ink-900', 'ink-800']) {
    it(`control border on ${bg} is at least 3:1`, () => {
      expect(contrast(c('border-control'), c(bg))).toBeGreaterThanOrEqual(3);
    });
    it(`focus ring on ${bg} is at least 3:1`, () => {
      expect(contrast(c('focus'), c(bg))).toBeGreaterThanOrEqual(3);
    });
  }

  for (const v of VERDICTS) {
    it(`${v} icon on ink-900 is at least 3:1`, () => {
      expect(contrast(c(v), c('ink-900'))).toBeGreaterThanOrEqual(3);
    });
  }
});
