import { SAMPLES, type AutopsyInput } from '../data/autopsy';

/** A short human name for a source, for the page title and the loading text. */
export function findSampleTitle(source: AutopsyInput): string {
  if (source.kind === 'sample') return SAMPLES.find((sample) => sample.id === source.id)?.title ?? source.id;
  if (source.kind === 'repo') return `${source.owner}/${source.name}`;
  return 'Your files';
}
