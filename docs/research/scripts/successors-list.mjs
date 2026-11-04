import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = '/home/ec2-user/.kiro/crew/kiroween2026/scratch/census/results';
const m = new Map();
let deps = 0, withSucc = 0;
for (const f of readdirSync(dir)) {
  const r = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const d of r.report.diagnoses) {
    if (!d.dependency.direct || !['dead', 'ghost', 'zombie'].includes(d.verdict)) continue;
    deps++; if (d.successors.length) withSucc++;
    const k = `${d.dependency.ecosystem}|${d.dependency.name}`;
    const u = m.get(k) ?? { ecosystem: d.dependency.ecosystem, name: d.dependency.name, verdict: d.verdict, instances: 0, subjects: new Set(), scopes: new Set(), decisive: d.evidence[0].code, codes: d.evidence.map((e) => e.code), deprecation: d.evidence.find((e) => e.code === 'npm-deprecated')?.message ?? null, repoUrl: d.evidence.find((e) => e.code === 'repo-archived' || e.code === 'repo-inactive')?.url ?? null, latest: d.latest ?? null, engineSuccessors: d.successors.map((s) => `${s.kind}:${s.name}`), advisories: d.advisories };
    u.instances++; u.subjects.add(r.subject.id); u.scopes.add(d.dependency.scope);
    m.set(k, u);
  }
}
const out = [...m.values()].map((u) => ({ ...u, subjects: u.subjects.size, scopes: [...u.scopes] }));
out.sort((a, b) => (b.subjects >= 2) - (a.subjects >= 2) || (b.verdict === 'zombie') - (a.verdict === 'zombie') || (b.ecosystem === 'pypi') - (a.ecosystem === 'pypi') || b.subjects - a.subjects || a.name.localeCompare(b.name));
writeFileSync('/home/ec2-user/.kiro/crew/kiroween2026/scratch/successors/packages.json', JSON.stringify(out, null, 1));
console.log('deps', deps, 'withSucc', withSucc, 'distinct', out.length, 'distinct with engine succ', out.filter((u) => u.engineSuccessors.length).length, 'multi', out.filter((u) => u.subjects >= 2).length);
for (const u of out) console.log(u.ecosystem, u.name, u.verdict, u.subjects, u.instances, u.decisive, u.engineSuccessors.join(',') || '-');
