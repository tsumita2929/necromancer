import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) =>
    statSync(join(dir, n)).isDirectory()
      ? files(join(dir, n))
      : n.endsWith('.ts')
        ? [join(dir, n)]
        : [],
  );

describe('R3.1 and R7.1 the engine source is isomorphic', () => {
  const forbidden: Array<[string, RegExp]> = [
    ['a node: import', /from\s+['"]node:/],
    [
      'a bare Node module import',
      /from\s+['"](?:fs|path|os|crypto|http|https|child_process|url|util|stream|buffer)['"]/,
    ],
    ['require()', /\brequire\s*\(/],
    ['process', /\bprocess\.(?:env|argv|cwd|platform|version)/],
    ['Buffer', /\bBuffer\./],
    ['direct fetch', /(?<![.\w])fetch\s*\(\s*['"`]/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['window or document', /\b(?:window|document|localStorage)\./],
  ];
  for (const file of files(src)) {
    it(`${file.slice(src.length + 1)} uses no Node-only or browser-only API`, () => {
      const text = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const [label, pattern] of forbidden) expect(pattern.test(text), label).toBe(false);
    });
  }
  it('every network URL is built in a source client or the e18e loader (one door: the injected fetch)', () => {
    const offenders = files(src).filter(
      (f) =>
        /https?:\/\/(?:registry|pypi|api|raw)\./.test(
          readFileSync(f, 'utf8')
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, ''),
        ) &&
        !/sources[/\\]/.test(f) &&
        !/signals\.ts$/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});
