/**
 * Invented reports for tests only. They are never bundled into the app: nothing under src/ui or
 * src/data imports this folder. The app shows recorded reports of real repositories.
 */
import type { AutopsyReport } from '@contract';
import { evergreenSite } from './evergreen-site';
import { pyFossil } from './py-fossil';
import { revenantApi } from './revenant-api';
import { buildSprawl } from './sprawl';

export const FIXTURE_IDS = ['revenant-api', 'py-fossil', 'evergreen-site', 'sprawl'] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

export function fixtureReport(id: string): AutopsyReport | undefined {
  switch (id) {
    case 'revenant-api':
      return revenantApi;
    case 'py-fossil':
      return pyFossil;
    case 'evergreen-site':
      return evergreenSite;
    case 'sprawl':
      return buildSprawl();
    default:
      return undefined;
  }
}
