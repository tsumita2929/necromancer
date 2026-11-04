import { writeFileSync, readFileSync } from 'node:fs';
const clock = JSON.parse(readFileSync('clock.json','utf8')).now;
writeFileSync('run-meta.json', JSON.stringify({
  title: 'Necromancer graveyard census, aggregate counts',
  engine: { commit: 'bfd86f123979079931c42ac6ffa4b3bcead17bd7', engineTreeHash: 'eb847e9d50141b5347c0a6c7bb1aa55873fe03ae', lastEngineChange: '5b142d0' },
  drawDate: '2026-11-03', pushedSince: '2025-11-03', seedText: 'necromancer-census-2026-11', engineClock: clock,
  scope: 'first 25 subjects of each cell in draw order (nested random half); second halves not run',
  githubPerHourCap: 55,
}, null, 1));
