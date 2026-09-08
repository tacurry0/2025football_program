// One-time September 2026 migration. Outputs file content map; does not publish.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../..'),dir=process.argv[2];
if(!dir) throw new Error('Specify official-v6 HTML directory');
const c=vm.createContext({console,Utilities:{formatDate:(d,z,fmt)=>new Date(d.getTime()+32400000).toISOString().slice(fmt==='HH:mm'?11:0,fmt==='HH:mm'?16:10)}});
vm.runInContext(fs.readFileSync(path.join(base,'gas/JLeague.gs'),'utf8'),c);
const files={},season='2026_2027';
const inputs={leaguecup:['cup-august','cup-month'],emperor:['emperor-j1','emperor-august','emperor-j3','emperor-j1-september','emperor-september','emperor-j3-september']};
for(const [league,names] of Object.entries(inputs)) {
  const rows=new Map(),coverage={};let fetchedAt='';
  for(const name of names) {
    const file=path.join(dir,name+'.html');fetchedAt=fs.statSync(file).mtime.toISOString();
    const data=c.jlParseMatches(fs.readFileSync(file,'utf8'),league);
    for(const row of data) if(row.date<='2026-09-08')rows.set(row.match_id,row);
    coverage[name.includes('september')||name==='cup-month'?'2026-09':'2026-08']=fetchedAt;
  }
  files[`trapp/data/results/${season}/${league}.json`]={schemaVersion:2,status:200,season,league,fetchedAt,stale:false,complete:true,scope:league==='emperor'?'jleague_clubs':league,coverage,auditedMonth:0,data:[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.match_id.localeCompare(b.match_id))};
}
const details={'j2-detail':'j2/2026/090613','j3-detail':'j3/2026/090616','emperor-detail':'emperor/2026/082624','kumamoto-emperor-detail':'emperor/2026/081902','niigata-cup-detail':'leaguecup/2026/090202','kumamoto-cup-detail':'leaguecup/2026/090209'};
for(const [name,route] of Object.entries(details)) {
  const file=path.join(dir,name+'.html'),row=c.jlParseDetail(fs.readFileSync(file,'utf8'),'/match/'+route),fetchedAt=fs.statSync(file).mtime.toISOString();
  row.detail_fetched_at=fetchedAt;
  files[`trapp/data/details/${season}/${row.league}/${row.match_id}.json`]={schemaVersion:2,status:200,season,league:row.league,fetchedAt,stale:false,complete:true,data:[row]};
}
process.stdout.write(JSON.stringify(files));
