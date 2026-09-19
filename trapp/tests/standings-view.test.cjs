const test=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../league-ui');
const match=(id,date,h,a,hs,as,status='finished')=>({match_id:id,date,home:h,away:a,home_score:hs,away_score:as,status});
test('form uses team perspective, completed scores and chronological order without duplicates',()=>{
 const games=[match('3','2026-09-03','B','A',1,2),match('1','2026-09-01','A','B',0,1),match('2','2026-09-02','A','C',0,0),match('3','2026-09-03','B','A',1,2),match('4','2026-09-04','A','B',null,null),match('5','2026-09-05','A','B',3,0,'live'),match('6','2026-09-06','C','B',1,0)];
 assert.deepEqual(ui.recentForm('A',games,3).map(m=>m.result),['loss','draw','win']);
 assert.deepEqual(ui.recentForm('A',games,2).map(m=>m.result),['loss','draw']);
 assert.deepEqual(ui.recentForm('A',games,0),[]);
});
test('last five results remain oldest to newest and incomplete result feeds do not fabricate matches',()=>{
 const games=Array.from({length:7},(_,i)=>match(String(i),`2026-09-0${i+1}`,'A','B',i,0));
 assert.deepEqual(ui.recentForm('A',games,7).map(m=>m.date),['2026-09-03','2026-09-04','2026-09-05','2026-09-06','2026-09-07']);
 assert.equal(ui.recentForm('A',games.slice(0,2),7).length,2);
});
test('archived rows retain PK record, missing values remain unknown, club names are escaped',()=>{
 const table=ui.tableMarkup([{team:'<b>クラブ</b>',rank:1,points:0,played:0,won:0,pk_won:2,pk_lost:1,lost:0,goal_diff:-2}],new Map(),true);
 assert(table.includes('2PK勝 1PK負'));
 assert(table.includes('&lt;b&gt;クラブ&lt;/b&gt;'));
 assert(table.includes('得点— 失点—'));
 assert(!table.includes('data-form-team='));
 assert.equal((table.match(/<col class=/g)||[]).length,5);
 assert(!table.includes('NaN'));
});
