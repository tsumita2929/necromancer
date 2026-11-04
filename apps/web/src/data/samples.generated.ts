// Written by scripts/record-samples.mjs and scripts/reindex-samples.mjs. Do not edit by hand.
import type { SourceId, Verdict } from '@contract';

export interface RecordedSample {
  id: string;
  /** owner/name on GitHub. */
  repository: string;
  ecosystem: 'npm' | 'pypi' | 'both';
  /** ISO date of the engine run. */
  recordedAt: string;
  total: number;
  summary: Record<Verdict, number>;
  /** Sources that could not be used for this report; empty when it is complete. */
  unavailable: SourceId[];
  /** Set when the engine was handed only these root files (a repository whose lockfile would be too large for a sample). */
  onlyFiles?: string[];
}

export const RECORDED_SAMPLES: readonly RecordedSample[] = [
  {
    "id": "appsecco-dvna",
    "repository": "appsecco/dvna",
    "ecosystem": "npm",
    "recordedAt": "2026-11-04T11:23:39.608Z",
    "total": 19,
    "summary": {
      "alive": 8,
      "dying": 5,
      "dead": 5,
      "ghost": 0,
      "zombie": 1
    },
    "unavailable": []
  },
  {
    "id": "miguelgrinberg-microblog",
    "repository": "miguelgrinberg/microblog",
    "ecosystem": "pypi",
    "recordedAt": "2026-11-04T11:25:05.292Z",
    "total": 54,
    "summary": {
      "alive": 43,
      "dying": 8,
      "dead": 3,
      "ghost": 0,
      "zombie": 0
    },
    "unavailable": [
      "github"
    ]
  },
  {
    "id": "sickchill-sickchill",
    "repository": "SickChill/sickchill",
    "ecosystem": "both",
    "recordedAt": "2026-11-04T00:06:20.919Z",
    "total": 105,
    "summary": {
      "alive": 64,
      "dying": 28,
      "dead": 13,
      "ghost": 0,
      "zombie": 0
    },
    "unavailable": [
      "github"
    ]
  }
];
