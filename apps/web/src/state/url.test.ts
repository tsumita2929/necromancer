import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { GROUP_ORDER, SORT_KEYS } from './model';
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
      source: { kind: 'sample', id: 'revenant-api' },
      verdicts: ['zombie', 'dead'],
      q: 'req uest&',
      sort: 'name',
      open: 'npm:@babel/eslint-parser',
      spec: 1,
    };
    expect(parseHash(formatHash({ name: 'graveyard', view }))).toEqual({ name: 'graveyard', view });
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
      view: { ...defaultView({ kind: 'sample', id: 'py-fossil' }), spec: 2 },
    });
    expect(hash).toBe('#/graveyard?src=sample:py-fossil');
  });

  it('R9.4 carries files through the fragment', () => {
    const files = [
      { kind: 'package.json' as const, path: 'package.json', content: '{"dependencies":{"é":"^1"}}' },
    ];
    expect(decodeFiles(encodeFiles(files))).toEqual(files);
    const back = parseHash(formatHash({ name: 'graveyard', view: defaultView({ kind: 'files', files }) }));
    expect(back).toMatchObject({ name: 'graveyard', view: { source: { kind: 'files', files } } });
  });

  it.each([
    '',
    '#',
    '#/nowhere',
    '#/graveyard',
    '#/graveyard?src=',
    '#/graveyard?src=sample:nope',
    '#/graveyard?src=repo:not a repo',
    '#/graveyard?src=files:%%%',
    '#/graveyard?src=files:AAAA',
    '#/graveyard?src=bogus',
    '#/graveyard?%E0%A4%A',
  ])('R9.5 falls back to the landing page for %j', (hash) => {
    expect(parseHash(hash)).toEqual({ name: 'landing' });
  });

  it('ignores unknown verdicts, sorts and bad spec indexes', () => {
    const route = parseHash('#/graveyard?src=sample:py-fossil&v=zombie,wizard,zombie&sort=chaos&open=npm:x&spec=-4');
    expect(route).toEqual({
      name: 'graveyard',
      view: { source: { kind: 'sample', id: 'py-fossil' }, verdicts: ['zombie'], q: '', sort: 'urgency', open: 'npm:x' },
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
          const view: ViewState = { source: { kind: 'sample', id: 'sprawl' }, verdicts, q, sort };
          const back = parseHash(formatHash({ name: 'graveyard', view }));
          if (back.name !== 'graveyard') return false;
          const expectedQ = q.trim() === '' ? '' : q;
          return back.view.q === expectedQ && back.view.sort === sort && back.view.verdicts.length === verdicts.length;
        },
      ),
    );
  });
});
