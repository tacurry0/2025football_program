const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const report = require('../match-report');
const source = JSON.parse(fs.readFileSync(__dirname+'/../data/details/2026_2027/leaguecup/2026090209.json')).data[0];
const match = {...source, ownHome:true,home_emblem:'home.png',away_emblem:'away.png'};
test('real cup record keeps chronological events and correct running scores',()=>{
 const rows=report.events(match);
 assert.deepEqual(rows.filter(r=>r.kind==='goal').map(r=>[r.minute,r.score]),[['38','1 - 0'],['56','2 - 0']]);
 assert.equal(rows.filter(r=>r.kind==='sub').length,match.home_substitutions.length+match.away_substitutions.length);
 assert.equal((report.timeline(match,true).match(/<li /g)||[]).length,4);
 assert(!report.timeline(match).includes('試合終了'));
});
test('paired starting and bench rows retain empty cells instead of shifting sides',()=>{
 const html=report.members({...match,home_starting_members:[{name:'A',position:'GK',number:1}],away_starting_members:[{name:'B'},{name:'C'}],home_bench_members:[],away_bench_members:[{name:'D'}]});
 const pairs=[...html.matchAll(/<tr>(<td class="report-player-cell[\s\S]*?)<\/tr>/g)];
 assert.equal(pairs.length,3);
 for(const pair of pairs)assert.equal((pair[1].match(/<td /g)||[]).length,2);
 assert(pairs[1][1].includes('empty'));assert(pairs[2][1].includes('empty'));
 assert(html.includes('監督'));assert(!html.includes('詳細 ON'));
});
test('player events show compact symbols and minutes, own players remain clickable on away matches',()=>{
 const html=report.members({...match,ownHome:false});
 assert(html.includes('aria-label="途中交代"'));assert(html.includes('aria-label="警告"'));
 const homeName=match.home_starting_members[0].name,awayName=match.away_starting_members[0].name;
 assert(!html.includes(`data-player="${homeName}"`));assert(html.includes(`data-player="${awayName}"`));
});
test('stoppage time ordering, incomplete goals, missing lineups and zero conditions',()=>{
 const m={...match,home_goals:[{scorer:'A',minute:'45+2'},{scorer:'B',minute:'46'}],away_goals:[],home_substitutions:[],away_substitutions:[],home_cards:[],away_cards:[],home_score:3};
 assert.deepEqual(report.events(m).map(e=>e.minute),['45+2','46']);assert(report.events(m).every(e=>e.score===''));
 assert(report.members({ownHome:true}).includes('まだ取得できていません'));
 assert(report.conditions({temperature:0,humidity:0,attendance:0}).includes('0'));
 assert(!report.header({ownHome:true,home_score:null,away_score:null}).includes('undefined'));
});
test('names and event data are escaped, not treated as markup',()=>{
 const html=report.members({...match,home_starting_members:[{name:'<img src=x>',number:1}],away_starting_members:[]});
 assert(html.includes('&lt;img src=x&gt;'));assert(!html.includes('<img src=x>'));
});
