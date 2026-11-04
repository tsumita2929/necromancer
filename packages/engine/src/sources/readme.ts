/**
 * What a project's README says about the project itself (round 5).
 *
 * A README that says "This repo is no longer maintained" or "Karma is deprecated" is the maintainers ending the
 * project's life in their own words: a hard signal, like a deprecation on the registry. Precision matters more
 * than reach, so only a statement about the project itself counts:
 *
 *   - "This package/repo/library/project ... is deprecated / unmaintained / abandoned / no longer maintained"
 *   - "<Name> is deprecated" where <Name> is the package or the repository, at the start of a sentence
 *   - a line at the very top that is only "DEPRECATED", "Unmaintained", "No longer maintained" (a banner)
 *
 * Not a statement: a deprecated API, option or version ("the `foo` option is deprecated"), "not maintained
 * by <company>", "looking for maintainers", badges, code blocks, changelog lines, a negation ("is not
 * deprecated"), a future or a condition ("will be deprecated", "if the project is deprecated"), another
 * project ("the old package is deprecated", "v1 is deprecated").
 */

import type { Http } from '../net/http.js';
import type { RepoRef } from './repo.js';
import { fail, type Fetched } from './result.js';

/** The part of a README that is read: a statement about the project is at the top. */
const HEAD_CHARS = 4000;
/** A banner (a line that is only the statement) must be this close to the top of the cleaned text. */
const BANNER_CHARS = 400;

export interface MaintainerStatement {
  /** The sentence, cleaned of Markdown, at most 200 characters. */
  sentence: string;
  /** The sentence and the one after it when that one names a way out ("Use X instead."): for successors. */
  window: string;
  kind: 'subject' | 'name' | 'banner';
}

const PROJECT_NOUN =
  '(?:git(?:hub)?\\s+)?(?:repo(?:sitory)?|project|package|library|lib|module|tool|plugin|extension|wrapper|bindings?|gem|crate|software|app(?:lication)?|code\\s?base|fork|service|adapter|driver|loader|preset|client|server|utility|framework|middleware|component|addon|add-on|sdk|cli|generator|boilerplate|uploader|launcher|reporter|linter|formatter|compiler)';
const DEAD_WORD =
  '(?:deprecated|unmaintained|abandoned|obsolete|end[\\s-]of[\\s-]life|eol|(?:no\\s+longer|not\\s+anymore|not\\s+any\\s*more)\\s+(?:being\\s+)?(?:actively\\s+)?(?:maintained|supported|developed|updated|in\\s+development)|not\\s+(?:being\\s+)?(?:actively\\s+)?(?:maintained|supported|developed)\\s+(?:anymore|any\\s*more|any\\s+longer))';
const BE = '(?:is|are|is\\s+being|got|has\\s+been|have\\s+been|has\\s+now\\s+been)';
const ADV = '(?:(?:now|officially|currently|hereby|also|very\\s+much|long|permanently)\\s+)*';

const SUBJECT = new RegExp(`\\bthis\\s+${PROJECT_NOUN}\\s+${BE}\\s+${ADV}${DEAD_WORD}\\b`, 'i');
const LEAD = '(?:(?:note|notice|warning|important|attention|update)\\s*[:!-]\\s*)?';
/** A word alone in capitals ("DEPRECATED"), or a multi-word phrase ("No longer maintained"), at the top. */
const BANNER_LOUD = new RegExp(
  `^${LEAD}(?:DEPRECATED|UNMAINTAINED|ABANDONED|OBSOLETE)(?:\\s*(?:[.!:;-]|$)|\\s+IN\\s+FAVOU?R\\b|\\s+in\\s+favou?r\\b)`,
);
const BANNER_PHRASE = new RegExp(
  `^${LEAD}(?:(?:no\\s+longer|not\\s+anymore)\\s+(?:being\\s+)?(?:actively\\s+)?(?:maintained|supported|developed|updated)|end[\\s-]of[\\s-]life)\\s*(?:[.!:;-]|$)`,
  'i',
);
/** "Deprecated: use foo instead": the word, a separator, and a way out. */
const BANNER_WITH_WAY_OUT = new RegExp(
  `^${LEAD}(?:deprecated|unmaintained|abandoned|obsolete)\\s*[:.!;-]\\s*[^]*?\\b(?:use|see|replace[ds]?|migrat\\w*|switch\\w*|instead|favou?r|successor|moved|fork)\\b`,
  'i',
);
/** Words before "this project" that make it part of a larger thought ("if this project is deprecated"). */
const LEADING_CONNECTOR =
  /\b(?:if|when|whenever|once|unless|because|since|as|of|while|although|so|then|how|what|why|whether|where|which)\b/i;
/** A version, not the project: "Version 1.x of this package". */
const VERSIONED =
  /\b(?:v\d|version\s*\d|versions?\s+(?:prior|before|older|below|<)|\d+\.(?:x|\d)|\d+\.x)\b/i;

const NEGATED =
  /\b(?:not|never|no\s+longer|isn't|aren't|hasn't|haven't|non)[\s-]+(?:yet\s+|been\s+)?(?:deprecated|unmaintained|abandoned)/i;
const FUTURE =
  /\b(?:will\s+(?:soon\s+)?be|to\s+be|going\s+to\s+be|may\s+(?:soon\s+)?be|might\s+(?:soon\s+)?be|could\s+be|would\s+be|planned\s+to\s+be|about\s+to\s+be)\b[^.]{0,30}\b(?:deprecated|unmaintained|abandoned|obsolete)/i;
const CONDITIONAL =
  /^(?:if|when|whenever|once|unless|until|since|because|although|though|in\s+case|should|whether)\b/i;
const BY_SOMEONE = /\b(?:maintained|supported|developed|updated)\s+by\b/i;
const SEEKING =
  /\b(?:looking\s+for|seeking|in\s+need\s+of|needs?|wanted|search(?:ing)?\s+for|adopt(?:ed|ion)?|take\s+over|taking\s+over|hand(?:ing)?\s+(?:off|over)|volunteers?|new)\b[^.]{0,40}\b(?:maintainers?|owners?|co-?maintainers?)\b/i;
const SEEKING_AFTER = /\b(?:maintainers?|owners?)\b[^.]{0,30}\b(?:wanted|needed|welcome|sought)\b/i;
const WAY_OUT =
  /^(?:please\s+)?(?:use|see|migrate|switch|consider|try|move|go\s+to|head\s+(?:over\s+)?to|refer|check)\b/i;

/** Markdown and reStructuredText noise removed; one line per paragraph line; the head only. */
export function cleanReadme(text: string): string {
  let t = text.slice(0, HEAD_CHARS * 2);
  t = t.replace(/\r\n?/g, '\n');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/```[\s\S]*?(?:```|$)/g, '\n');
  t = t.replace(/~~~[\s\S]*?(?:~~~|$)/g, '\n');
  t = t.replace(/<(?:pre|code)\b[\s\S]*?<\/(?:pre|code)>/gi, ' ');
  // Badges and images, linked or not, inline or by reference.
  t = t.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ');
  t = t.replace(/\[!\[[^\]]*\]\[[^\]]*\]\]\[[^\]]*\]/g, ' ');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  t = t.replace(/!\[[^\]]*\]\[[^\]]*\]/g, ' ');
  t = t.replace(/<img\b[^>]*>/gi, ' ');
  // Link definitions and reStructuredText directives, substitutions and comments.
  t = t.replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '');
  t = t.replace(/^\.\.\s.*$/gm, '');
  t = t.replace(/\|[^|\n]{1,40}\|(?:_)?/g, ' ');
  // Links keep their text; HTML tags go; emphasis, headings, quotes and emoji codes go.
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  t = t.replace(/<[^>\n]+>/g, ' ');
  t = t.replace(/:[a-z0-9_+-]{2,30}:/gi, ' ');
  t = t.replace(/[*_`~]+/g, '');
  t = t.replace(/^[ \t]*(?:#{1,6}|>+|[-=]{3,})[ \t]*/gm, '');
  t = t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F]/gu, ' ');
  return t
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')
    .slice(0, HEAD_CHARS);
}

/** Letters and digits only, lower case: `Karma`, `karma`, `@scope/karma` (the part after the slash). */
function strict(name: string): string {
  const base = name.includes('/') ? (name.split('/').pop() ?? name) : name;
  return base.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sentencesOf(cleaned: string): Array<{ text: string; offset: number; last: boolean }> {
  const out: Array<{ text: string; offset: number; last: boolean }> = [];
  let offset = 0;
  for (const line of cleaned.split('\n')) {
    const parts = line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
    let at = offset;
    parts.forEach((p, i) => {
      const text = p.trim();
      if (text !== '') out.push({ text, offset: at, last: i === parts.length - 1 });
      at += p.length + 1;
    });
    offset += line.length + 1;
  }
  return out;
}

function excluded(sentence: string): boolean {
  return (
    NEGATED.test(sentence) ||
    FUTURE.test(sentence) ||
    CONDITIONAL.test(sentence) ||
    BY_SOMEONE.test(sentence) ||
    SEEKING.test(sentence) ||
    SEEKING_AFTER.test(sentence)
  );
}

/**
 * The statement about the project itself in a README, or undefined. `names` are the package and the
 * repository, for "<Name> is deprecated". Pure and total.
 */
export function findMaintainerStatement(
  readme: string,
  names: readonly string[],
): MaintainerStatement | undefined {
  if (typeof readme !== 'string' || readme === '') return undefined;
  const cleaned = cleanReadme(readme);
  const wanted = new Set(names.map(strict).filter((n) => n.length >= 2));
  const list = sentencesOf(cleaned);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s) continue;
    // A long sentence is read up to its first 300 characters: the statement opens it.
    const text = s.text.slice(0, 300);
    if (excluded(text) || VERSIONED.test(text)) continue;
    // A neighbouring sentence that asks for maintainers makes this one a request, not an ending.
    const around = [list[i - 1], list[i + 1]].filter(
      (n) => n && Math.abs(n.offset - s.offset) < 400,
    );
    if (around.some((n) => n && (SEEKING.test(n.text) || SEEKING_AFTER.test(n.text)))) continue;
    let kind: MaintainerStatement['kind'] | undefined;
    const subject = SUBJECT.exec(text);
    if (subject) {
      if (subject.index <= 40 && !LEADING_CONNECTOR.test(text.slice(0, subject.index)))
        kind = 'subject';
    } else {
      const m = new RegExp(
        `^${LEAD}([A-Za-z0-9@][\\w.@/-]{0,60})\\s+${BE}\\s+${ADV}${DEAD_WORD}\\b`,
        'i',
      ).exec(text);
      if (m?.[1] && wanted.has(strict(m[1]))) kind = 'name';
      else if (
        s.offset <= BANNER_CHARS &&
        text.length <= 200 &&
        (BANNER_LOUD.test(text) || BANNER_PHRASE.test(text) || BANNER_WITH_WAY_OUT.test(text))
      )
        kind = 'banner';
    }
    if (!kind) continue;
    // Everything but the statement itself must not make it a statement about something else: "Karma is
    // deprecated" is checked as written; "v1 of this package is deprecated" never matches SUBJECT.
    const next = list[i + 1];
    const sentence = text.slice(0, 200);
    const window =
      next && next.offset === s.offset + s.text.length + 1 && WAY_OUT.test(next.text)
        ? `${sentence} ${next.text.slice(0, 200)}`
        : sentence;
    return { sentence, window, kind };
  }
  return undefined;
}

/**
 * The README of a repository, from raw.githubusercontent.com (not the GitHub REST API, so no use of its
 * limit): `README.md`, then `README.rst`, then `README`. Returns the text, or null when none exists.
 */
export async function getReadme(http: Http, repo: RepoRef): Promise<Fetched<string | null>> {
  for (const file of ['README.md', 'README.rst', 'README']) {
    const r = await http.request(
      `https://raw.githubusercontent.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/HEAD/${file}`,
      undefined,
      'text',
    );
    if (!r.ok) {
      if (r.kind === 'not-found') continue;
      return fail(r);
    }
    if (typeof r.data !== 'string') continue;
    return { ok: true, value: r.data.slice(0, HEAD_CHARS * 2) };
  }
  return { ok: true, value: null };
}
