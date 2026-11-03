import { createHash } from 'node:crypto';

/** File name of a recorded GET response. The recorder script uses the same rule. */
export function fixtureFileName(method: string, url: string): string {
  const slug = `${method}_${url.replace(/^https?:\/\//, '')}`.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 120);
  const hash = createHash('sha1').update(`${method} ${url}`).digest('hex').slice(0, 8);
  return `${slug}_${hash}.json`;
}
