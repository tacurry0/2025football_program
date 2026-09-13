const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../features-model');
const row=(id,date,home,away,hs,as,status='finished')=>({match_id:id,date,home,away,home_score:hs,away_score:as,status});
test('preview excludes live scores, deduplicates snapshots and never leaks future results',()=>{
 const rows=[row('1','2026-09-01','A','B',0,0),row('1','2026-09-01','A','B',0,0),row('2','2026-09-02','B','A',1,2),row('3','2026-09-03','A','B',2,0,'scheduled'),row('4','2026-09-06','A','B',9,0),row('5','2026-09-04','A','B',null,null)];
 const games=M.teamGames(rows,'A','2026-09-05');assert.equal(games.length,2);assert.deepEqual(M.stats(games),{played:2,W:1,D:1,L:0,gf:2,ga:1});assert.equal(M.teamGames(rows,'A','2026-09-05','home').length,1);assert.equal(M.teamGames(rows,'A','2026-09-05','away')[0].gf,2);
});
test('next match skips finished matches today and retains a zero-score scheduled match',()=>{
 const name=M.names.niigata,schedule=[{match_id:'1',date:'2026-09-13',club:'niigata',opponent:'B'},{match_id:'2',date:'2026-09-20',club:'niigata',opponent:'C'}];
 assert.equal(M.nextMatch(schedule,[row('1','2026-09-13',name,'B',1,0)],'niigata','2026-09-13').match_id,'2');
 assert.equal(M.nextMatch(schedule,[row('1','2026-09-13',name,'B',0,0,'scheduled')],'niigata','2026-09-13').match_id,'1');
 assert.ok(M.same('ＲＢ大宮アルディージャ','大宮アルディージャ'));
});
test('visit records permit unlocated entries, reject partial/invalid coordinates and unsafe photos',()=>{
 const v={id:'x',venue:'スタジアム',date:'2026-09-13',club:'niigata',seat:'',note:'',lat:null,lng:null};
 assert.ok(M.validVisit(v));assert.ok(M.validVisit({...v,lat:37,lng:139}));assert.ok(!M.validVisit({...v,lat:37}));assert.ok(!M.validVisit({...v,lat:100,lng:139}));assert.ok(!M.validVisit({...v,photo:'javascript:alert(1)'}));assert.ok(!M.validVisit({...v,note:'x'.repeat(3001)}));
});
test('published manifest hashes match all complete current datasets',()=>{
 const root=path.resolve(__dirname,'../data'),m=JSON.parse(fs.readFileSync(path.join(root,'generated/update.json')));
 assert.equal(m.season,'2026_2027');assert.equal(Object.keys(m.files).length,16);
 for(const [file,hash] of Object.entries(m.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
 for(const club of ['niigata','kumamoto']){const h=JSON.parse(fs.readFileSync(path.join(root,'insights',club+'.json')));assert.ok(h.data.length>100);assert.ok(h.data.every(M.completed));}
});
