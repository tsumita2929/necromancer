import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SAMPLES } from '../data/autopsy';
import { GROUP_ORDER, SORT_KEYS } from './model';

const SAMPLE = SAMPLES[0]!.id;
import {
  decodeFiles,
  defaultView,
  encodeFiles,
  formatHash,
  fromBase64Url,
  parseHash,
  toBase64Url,
  type Route,
  type ViewState,
} from './url';

describe('R9 URL state', () => {
  it('round trips a rich view', () => {
    const view: ViewState = {
      source: { kind: 'sample', id: SAMPLE },
      verdicts: ['zombie', 'dead'],
      q: 'req uest&',
      sort: 'name',
      open: 'npm:@babel/eslint-parser',
      spec: 1,
    };
    expect(parseHash(formatHash({ name: 'graveyard', view }))).toEqual({ name: 'graveyard', view });
  });

  it('R6.1 a live repository link carries the branch and keeps the owner and repository case', () => {
    const source = { kind: 'repo' as const, owner: 'ExpressJS', name: 'Express', ref: 'feature/x' };
    const hash = formatHash({ name: 'graveyard', view: defaultView(source) });
    expect(hash).toBe('#/graveyard?src=repo:ExpressJS/Express@feature/x');
    expect(parseHash(hash)).toEqual({ name: 'graveyard', view: defaultView(source) });
  });

  it('keeps the link readable', () => {
    const hash = formatHash({
      name: 'graveyard',
      view: defaultView({ kind: 'repo', owner: 'expressjs', name: 'express' }),
    });
    expect(hash).toBe('#/graveyard?src=repo:expressjs/express');
  });

  it('omits defaults and the spec index when nothing is open', () => {
    const hash = formatHash({
      name: 'graveyard',
      view: { ...defaultView({ kind: 'sample', id: SAMPLE }), spec: 2 },
    });
    expect(hash).toBe(`#/graveyard?src=sample:${SAMPLE}`);
  });

  it('R9.4 carries files through the fragment', () => {
    const files = [
      { kind: 'package.json' as const, path: 'package.json', content: '{"dependencies":{"é":"^1"}}' },
    ];
    expect(decodeFiles(encodeFiles(files))).toEqual(files);
    const back = parseHash(formatHash({ name: 'graveyard', view: defaultView({ kind: 'files', files }) }));
    expect(back).toMatchObject({ name: 'graveyard', view: { source: { kind: 'files', files } } });
  });

  it.each(['', '#', '#/nowhere', '#/about/extra'])('R9.5 an unknown address %j opens the landing page without a complaint', (hash) => {
    expect(parseHash(hash)).toEqual({ name: 'landing' });
  });

  it.each([
    '#/graveyard',
    '#/graveyard?src=',
    '#/graveyard?src=sample:nope',
    '#/graveyard?src=repo:',
    '#/graveyard?src=repo:not a repo',
    '#/graveyard?src=repo:a/b/../c',
    '#/graveyard?src=repo:a/b/c',
    '#/graveyard?src=files:%%%',
    '#/graveyard?src=files:AAAA',
    '#/graveyard?src=bogus',
    '#/graveyard?%E0%A4%A',
  ])('QA-10 a damaged result link %j opens the landing page and says the link is invalid', (hash) => {
    expect(parseHash(hash)).toEqual({ name: 'landing', notice: 'invalid-link' });
  });

  it('the basis filter survives the link, and an unknown basis is dropped', () => {
    const view = { ...defaultView({ kind: 'sample' as const, id: SAMPLE }), basis: 'heuristic' as const };
    expect(formatHash({ name: 'graveyard', view })).toBe(`#/graveyard?src=sample:${SAMPLE}&b=heuristic`);
    expect(parseHash(`#/graveyard?src=sample:${SAMPLE}&b=heuristic`)).toEqual({ name: 'graveyard', view });
    expect(parseHash(`#/graveyard?src=sample:${SAMPLE}&b=whatever`)).toMatchObject({ name: 'graveyard', view: { sort: 'urgency' } });
    expect((parseHash(`#/graveyard?src=sample:${SAMPLE}&b=whatever`) as { view: { basis?: string } }).view.basis).toBeUndefined();
  });

  it('ignores unknown verdicts, sorts and bad spec indexes', () => {
    const route = parseHash(`#/graveyard?src=sample:${SAMPLE}&v=zombie,wizard,zombie&sort=chaos&open=npm:x&spec=-4`);
    expect(route).toEqual({
      name: 'graveyard',
      view: { source: { kind: 'sample', id: SAMPLE }, verdicts: ['zombie'], q: '', sort: 'urgency', open: 'npm:x' },
    });
  });

  it('about route round trips', () => {
    expect(parseHash(formatHash({ name: 'about' }))).toEqual({ name: 'about' });
  });

  it('base64url round trips any text', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary' }), (text) => fromBase64Url(toBase64Url(text)) === text));
  });

  it('parseHash never throws and always returns a route (property)', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const route: Route = parseHash(text);
        return ['landing', 'about', 'graveyard'].includes(route.name);
      }),
    );
  });

  it('formatHash then parseHash keeps any search text and filters (property)', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 100 }),
        fc.subarray([...GROUP_ORDER]),
        fc.constantFrom(...SORT_KEYS),
        (q, verdicts, sort) => {
          const view: ViewState = { source: { kind: 'sample', id: SAMPLE }, verdicts, q, sort };
          const back = parseHash(formatHash({ name: 'graveyard', view }));
          if (back.name !== 'graveyard') return false;
          const expectedQ = q.trim() === '' ? '' : q;
          return back.view.q === expectedQ && back.view.sort === sort && back.view.verdicts.length === verdicts.length;
        },
      ),
    );
  });
});
