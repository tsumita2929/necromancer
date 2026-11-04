import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lexJs } from '../src/usage/lex-js.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) =>
    statSync(join(dir, n)).isDirectory()
      ? files(join(dir, n))
      : n.endsWith('.ts')
        ? [join(dir, n)]
        : [],
  );

const NODE_MODULES =
  /^(?:node:.*|fs|path|os|crypto|http|https|child_process|url|util|stream|buffer)$/;

/**
 * Findings in the code of a TypeScript file. The lexer skips strings and comments, so a generated
 * test that mentions `node:fs` inside a string literal is not a finding.
 */
function findings(text: string): string[] {
  const toks = lexJs(text);
  const out: string[] = [];
  toks.forEach((t, i) => {
    const next = toks[i + 1];
    const prev = toks[i - 1];
    if (t.kind !== 'ident') return;
    if (t.value === 'from' && next?.kind === 'string' && NODE_MODULES.test(next.value)) {
      out.push(`an import of ${next.value}`);
    }
    if (t.value === 'require' && next?.value === '(') out.push('require()');
    if (
      t.value === 'process' &&
      next?.value === '.' &&
      /^(env|argv|cwd|platform|version)$/.test(toks[i + 2]?.value ?? '')
    ) {
      out.push('process');
    }
    if (t.value === 'Buffer' && next?.value === '.') out.push('Buffer');
    if (
      t.value === 'fetch' &&
      prev?.value !== '.' &&
      next?.value === '(' &&
      (toks[i + 2]?.kind === 'string' || toks[i + 2]?.kind === 'template')
    ) {
      out.push('direct fetch');
    }
    if (t.value === 'XMLHttpRequest') out.push('XMLHttpRequest');
    if (
      /^(window|document|localStorage)$/.test(t.value) &&
      next?.value === '.' &&
      prev?.value !== '.'
    ) {
      out.push(t.value);
    }
  });
  return out;
}

describe('R3.1 and R7.1 the engine source is isomorphic', () => {
  for (const file of files(src)) {
    it(`${file.slice(src.length + 1)} uses no Node-only or browser-only API`, () => {
      expect(findings(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }

  it('the check can fail: it sees real uses and ignores strings and comments', () => {
    expect(
      findings("import fs from 'node:fs'; const x = process.env.A; fetch('https://x');"),
    ).toEqual(['an import of node:fs', 'process', 'direct fetch']);
    expect(
      findings("const s = \"import fs from 'node:fs'; process.env\"; // require('x')"),
    ).toEqual([]);
    expect(findings('const t = `from "fs" ${require("x")}`;')).toEqual(['require()']);
  });

  it('every network URL is built in a source client or the e18e loader (one door: the injected fetch)', () => {
    const offenders = files(src).filter(
      (f) =>
        /https?:\/\/(?:registry|pypi|api|raw)\./.test(
          readFileSync(f, 'utf8')
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, ''),
        ) &&
        !/sources[/\\]/.test(f) &&
        !/signals\.ts$/.test(f) &&
        !/seance[/\\]recipes[/\\]/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});
