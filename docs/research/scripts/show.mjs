import { readdirSync, readFileSync } from 'node:fs';
const files = readdirSync('handcheck').sort();
const [a,b] = process.argv.slice(2).map(Number);
files.slice(a,b).forEach((f,i)=>{
  const d = JSON.parse(readFileSync('handcheck/'+f,'utf8'));
  const u=d.unit, r=d.registry, p=d.repoPage;
  console.log(`#${a+i} ${u.ecosystem}:${u.name} [${u.stratum}] used=${u.version??u.spec} subjects=${u.subjects}`);
  console.log('  ENGINE:', u.evidence.map(e=>e.code+': '+e.message.slice(0,110)).join(' | '));
  const reg = {st:r.registryStatus,latest:r.latest,date:r.latestDate?.slice(0,10),age:r.latestAgeDays,dep:r.latestDeprecated?String(r.latestDeprecated).slice(0,100):null,useDep:r.versionInUseDeprecated??undefined,yanked:r.latestYanked,cls:r.statusClassifiers,ps:r.projectStatus};
  console.log('  REG:', JSON.stringify(reg));
  console.log('  REPO:', p?JSON.stringify({r:p.repo,pg:p.pageStatus,arch:p.archivedBanner,last:p.lastCommitDate?.slice(0,10),age:p.lastCommitAgeDays,maint:p.maintained}):'none linked', r.repository?'':'(no repository field)');
  if (d.osv) console.log('  OSV:', d.osv.map(v=>v.id+(v.withdrawn?'(withdrawn)':'')).join(','), ' engine:', u.advisories.join(','));
});
