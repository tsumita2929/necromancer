// Written by scripts/record-samples.mjs. Do not edit by hand.
import type { Verdict } from '@contract';

export interface RecordedSample {
  id: string;
  /** owner/name on GitHub. */
  repository: string;
  ecosystem: 'npm' | 'pypi' | 'both';
  /** ISO date of the engine run. */
  recordedAt: string;
  total: number;
  summary: Record<Verdict, number>;
}

export const RECORDED_SAMPLES: readonly RecordedSample[] = [
  {
    "id": "appsecco-dvna",
    "repository": "appsecco/dvna",
    "ecosystem": "npm",
    "recordedAt": "2026-11-03T14:14:40.549Z",
    "total": 19,
    "summary": {
      "alive": 6,
      "dying": 7,
      "dead": 5,
      "ghost": 0,
      "zombie": 1
    }
  },
  {
    "id": "miguelgrinberg-microblog",
    "repository": "miguelgrinberg/microblog",
    "ecosystem": "pypi",
    "recordedAt": "2026-11-03T14:14:42.127Z",
    "total": 54,
    "summary": {
      "alive": 36,
      "dying": 15,
      "dead": 3,
      "ghost": 0,
      "zombie": 0
    }
  },
  {
    "id": "sickchill-sickchill",
    "repository": "SickChill/sickchill",
    "ecosystem": "both",
    "recordedAt": "2026-11-03T14:14:44.192Z",
    "total": 105,
    "summary": {
      "alive": 64,
      "dying": 28,
      "dead": 13,
      "ghost": 0,
      "zombie": 0
    }
  }
];
