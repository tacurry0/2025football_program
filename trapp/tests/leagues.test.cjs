const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const api = require('../league-data.js');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const snapshot = (type, league = 'j2') => JSON.parse(read(`data/${type}/${api.SEASON}/${league}.json`));
const clone = data => JSON.parse(JSON.stringify(data));
const response = data => ({ ok: true, json: async () => clone(data) });
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; };
const key = (type, league = 'j2') => `trapp_v2_${api.SEASON}_${league}_${type}`;

test('competition and season separate hundred-year, J2, J3 and cups across January', () => {
  assert.equal(api.context({ date: '2026-05-02', matchweek: 'MW10' }).season, api.HUNDRED);
  assert.equal(api.context({ date: '2026-09-02', league: 'J3', season: 2026 }).season, api.SEASON);
  assert.equal(api.context({ date: '2027-02-02', league: 'J2' }).season, api.SEASON);
  assert.equal(api.context({ date: '2026-09-02', competition: 'ルヴァンカップ' }).competition, 'leaguecup');
  assert.equal(api.compatible({ date: '2026-09-02', league: 'j2' }, { date: '2026-09-02', league: 'j3' }), false);
  assert.equal(api.compatible({ date: '2026-09-02', competition_id: 'j2j3' }, { date: '2026-09-02', league: 'j2' }), false);
});

test('snapshots validate and match all 40 clubs played/wins/draws/goals', () => {
  for (const league of ['j2', 'j3']) {
    const table = snapshot('standings', league), results = snapshot('results', league);
    assert.ok(api.validPayload(table, 'standings', league));
    assert.ok(api.validPayload(results, 'results', league));
    for (const row of table.data) {
      const matches = results.data.filter(m => m.status === 'finished' && [m.home,m.away].includes(row.team));
      assert.equal(matches.length, row.played, row.team);
      assert.equal(matches.filter(m => m.home === row.team ? m.home_score > m.away_score : m.away_score > m.home_score).length, row.won, row.team);
      assert.equal(matches.filter(m => m.home_score === m.away_score).length, row.drawn, row.team);
      assert.equal(matches.reduce((n,m) => n + (m.home === row.team ? m.home_score : m.away_score), 0), row.goals_for, row.team);
    }
  }
});

test('legacy, wrong league, malformed, duplicate and incomplete payloads are rejected', () => {
  const table = snapshot('standings');
  assert.equal(api.validPayload({ ...table, schemaVersion: 1 }, 'standings', 'j2'), false);
  assert.equal(api.validPayload(table, 'standings', 'j3'), false);
  table.data[0].played++;
  assert.equal(api.validPayload(table, 'standings', 'j2'), false);
  const results = snapshot('results');
  assert.equal(api.validPayload({ ...results, complete: false }, 'results', 'j2'), false);
  results.data.push(results.data[0]);
  assert.equal(api.validPayload(results, 'results', 'j2'), false);
});

test('client uses newest last-good on network failure and preserves timestamp and old keys', async () => {
  const saved = snapshot('standings'); saved.fetchedAt = new Date(Date.parse(saved.fetchedAt)+86400000).toISOString(); saved.stale = true;
  const store = storage(); store.setItem(key('standings'), JSON.stringify(saved)); store.setItem('trapp_standings_cache', 'legacy'); store.setItem('memo_match', 'my note');
  const client = api.createClient({ storage: store, fetch: async url => { if (url.startsWith('./')) return response(snapshot('standings')); throw new Error('offline'); } });
  const result = await client.load('standings', 'j2', true);
  assert.equal(result.fetchedAt, saved.fetchedAt); assert.equal(result.stale, true); assert.equal(result.source, 'cache');
  assert.equal(store.getItem('memo_match'), 'my note'); assert.equal(store.getItem('trapp_standings_cache'), 'legacy');
});

test('client deduplicates concurrent calls, scopes parameters and uses fresh cache', async () => {
  const saved = snapshot('standings'); saved.fetchedAt = new Date().toISOString();
  let gasCalls = 0; const store = storage();
  const client = api.createClient({ storage: store, fetch: async url => {
    if (url.startsWith('./')) return response(snapshot('standings'));
    gasCalls++; const u = new URL(url); assert.equal(u.searchParams.get('season'), api.SEASON); assert.equal(u.searchParams.get('league'), 'j2'); assert.equal(u.searchParams.get('nocache'), null);
    return response(saved);
  } });
  const [a,b] = await Promise.all([client.load('standings','j2'), client.load('standings','j2')]);
  assert.equal(a.fetchedAt,b.fetchedAt); assert.equal(gasCalls,1);
  assert.equal((await client.load('standings','j2')).source,'cache'); assert.equal(gasCalls,1);
});

test('old GAS format falls back; valid newer stale GAS data beats bundled data', async () => {
  let server = { status: 200, data: snapshot('standings').data };
  const client = api.createClient({ storage: storage(), fetch: async url => response(url.startsWith('./') ? snapshot('standings') : server) });
  assert.equal((await client.load('standings','j2',true)).source,'bundled');
  server = { ...snapshot('standings'), fetchedAt: new Date(Date.parse(snapshot('standings').fetchedAt)+86400000).toISOString(), stale: true, error: 'source unavailable' };
  const result = await client.load('standings','j2',true);
  assert.equal(result.source,'gas'); assert.equal(result.stale,true); assert.equal(result.fetchedAt,server.fetchedAt);
});

test('one league failing does not hide the other; empty fresh start returns 503', async () => {
  const client = api.createClient({ storage: storage(), fetch: async url => {
    if (url.includes('j3')) throw new Error('offline');
    return response(snapshot('standings'));
  } });
  const result = await client.all('standings',true);
  assert.equal(result.data.length,20); assert.equal(result.sources.j3.status,503); assert.equal(result.stale,true);
});

function gasRuntime() {
  const properties = new Map(), cache = new Map(), requests = [];
  const blob = value => { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value); return { getBytes: () => bytes, getDataAsString: () => bytes.toString('utf8') }; };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-07T03:00:00Z'])); } }
  const context = vm.createContext({ Date: Clock, console: { log() {}, error() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType() { return this; }, getContent: () => value }) },
    Utilities: { formatDate: (d,z,fmt) => new Date(d.getTime()+32400000).toISOString().slice(fmt==='HH:mm'?11:0,fmt==='HH:mm'?16:10), newBlob: blob, gzip: b => blob(zlib.gzipSync(b.getBytes())), ungzip: b => blob(zlib.gunzipSync(b.getBytes())), base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => Buffer.from(s,'base64') },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k), put: (k,v) => cache.set(k,v), removeAll: keys => keys.forEach(k => cache.delete(k)) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => properties.get(k), setProperties: data => Object.entries(data).forEach(([k,v]) => properties.set(k,v)), deleteProperty: k => properties.delete(k) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  });
  vm.runInContext(read('gas/JLeague.gs'),context);
  return { context, cache, properties, requests };
}
const call = (c, params) => JSON.parse(c.doGet({ parameter: params }).getContent());

test('GAS persists gzip snapshots, caches, validates input and keeps timestamp on failure', () => {
  const { context: c, cache, properties } = gasRuntime(); let calls=0;
  c.jlStandings = () => { calls++; return { data: snapshot('standings').data }; };
  const params = { league:'j2',type:'standings' }, first = call(c,params);
  assert.equal(first.status,200); assert.ok(properties.size > 0);
  assert.equal(call(c,params).fromCache,true); assert.equal(calls,1);
  c.clearCache(); assert.equal(cache.size,0); assert.ok(properties.size > 0);
  c.jlStandings = () => { throw new Error('structure changed'); };
  const stale = call(c,params);
  assert.equal(stale.stale,true); assert.equal(stale.fetchedAt,first.fetchedAt); assert.equal(stale.data.length,20);
  assert.equal(call(c,{ league:'all' }).status,400);
  assert.equal(call(c,{ league:'j2',season:'2026_hundred' }).status,400);
  assert.equal(call(c,{ league:'j3' }).status,503);
});

const node = (className, children, extra={}) => ['$', 'div', null, { className, children, ...extra }];
function matchHtml(status='game-over', score=['0','0']) {
  const team = side => node('m-schedule__team-'+side, node('m-schedule__team-name', side==='home'?'アルビレックス新潟':'山形', {'data-media':'pc'}));
  const card = league => node('m-schedule m-schedule--'+status, [node('', '詳細', {href:`/match/${league}/2026/090613/`}), team('home'),team('away'),...score.map(s => node('m-schedule__score',s))], {id:'2026090601'});
  const root = node('p-game-schedule__list',node('p-game-schedule__group',[node('m-section-header','第5節'), '$L2'], {id:'2026-09-06-j2'}));
  const stream = '1:'+JSON.stringify(root)+'\n2:'+JSON.stringify([card('j2'),card('leaguecup')])+'\n';
  return '<script>self.__next_f.push('+JSON.stringify([1,stream])+')</script>';
}
test('GAS decodes lazy Flight records, excludes cup matches and preserves zero draw', () => {
  const {context:c}=gasRuntime();
  const rows=c.jlParseMatches(matchHtml(),'j2'); assert.equal(rows.length,1); assert.equal(rows[0].home_score,0); assert.equal(rows[0].status,'finished');
  assert.equal(c.jlParseMatches(matchHtml('before',['','']),'j2')[0].home_score,null);
  assert.equal(c.jlParseMatches(matchHtml('postponed',['','']),'j2')[0].status,'postponed');
  assert.throws(()=>c.jlParseMatches(matchHtml('game-over',['','']),'j2'), /項目/);
  assert.throws(()=>c.jlParseMatches('<html>changed</html>','j2'), /JSON/);
});

test('main score sync preserves notes/attendance, matches competition and skips unfinished', () => {
  const code=read('script.js'), store=storage(), match={ date:'2026-09-06',club:'niigata',opponent:'山形',season:api.SEASON,competition_id:'j2' };
  const c=vm.createContext({ window:{TrappLeague:api}, localStorage:store, scheduleData:[match], renderedFeedYear:2026,
    normalizeOfficialResult:api.annotate, getResultArray:x=>x, getScheduleResultKey:(d,c,o)=>`${d}_${c}_${o}`,
    extractOwnResultScores:r=>({ownScore:r.home_score,opponentScore:r.away_score,pkOwn:null,pkOpponent:null}) });
  const start=code.indexOf('  function syncResultsToLocalStorage('), end=code.indexOf('\n  }',start)+4;
  vm.runInContext(code.slice(start,end),c);
  const id='2026-09-06_niigata_山形'; store.setItem('memo_'+id,'keep'); store.setItem('att_'+id,'true');
  const row={...match,home_score:0,away_score:0,status:'finished'};
  c.syncResultsToLocalStorage([row]); assert.equal(store.getItem('score_my_'+id),'0');
  c.syncResultsToLocalStorage([{...row,competition_id:'leaguecup',home_score:9},{...row,status:'scheduled',home_score:8}]);
  assert.equal(store.getItem('score_my_'+id),'0'); assert.equal(store.getItem('memo_'+id),'keep'); assert.equal(store.getItem('att_'+id),'true');
});

test('standings renderer exposes J2/J3 and basic/detail controls without losing records or escaping', () => {
  const buttons = {}, container = { innerHTML:'', dataset:{}, isConnected:false, classList:{toggle(){}}, querySelector:s => buttons[s] ||= {}, querySelectorAll:()=>[] };
  const c=vm.createContext({window:{},Date,fetch:async()=>({ok:true,json:async()=>({data:[]})})}); vm.runInContext(read('league-ui.js'),c);
  const data=snapshot('standings'); data.data[0].team='<img onerror=bad>';
  c.window.TrappStandings.render(container,{sources:{j2:data}});
  assert.match(container.innerHTML,/data-league="j3"/); assert.match(container.innerHTML,/data-display="detail"/); assert.match(container.innerHTML,/分/);
  assert.ok(container.innerHTML.includes('&lt;img onerror=bad&gt;')); assert.ok(!container.innerHTML.includes('<img onerror=bad>'));
  assert.ok(!container.innerHTML.includes('PK勝')); assert.ok(!container.innerHTML.includes('取得日時不明'));
});

test('all changed JS parses and cached/shared-script assets exist', () => {
  for (const file of ['script.js','league-data.js','league-ui.js','ui-v6.js','sw.js','vision/app.js','gas/JLeague.gs']) new vm.Script(read(file),{filename:file});
  const assets=read('sw.js').match(/const assetsToCache = (\[[\s\S]*?\]);/)[1];
  for(const asset of vm.runInNewContext(assets)) assert.ok(fs.existsSync(path.join(root,asset)),asset);
  for(const file of fs.readdirSync(path.join(root,'vision')).filter(f=>f.endsWith('.html'))) {
    const html=read('vision/'+file); if(!html.includes('src="app.js')) continue;
    assert.ok(html.indexOf('../league-data.js') < html.indexOf('src="app.js'),file);
  }
});

test('live saved official HTML passes exact GAS service, monthly coverage and all team totals', {skip:!process.env.TRAPP_FIXTURES}, () => {
  const {context:c,requests}=gasRuntime();
  c.UrlFetchApp = { fetch: url => {
    requests.push(url); const u=new URL(url), league=u.pathname.split('/')[1];
    const part=u.pathname.includes('standings')?'standings':u.searchParams.get('startdate').slice(5,7)==='08'?'august':'september';
    const html=fs.readFileSync(path.join(process.env.TRAPP_FIXTURES,`trapp-${league}-${part}.html`),'utf8');
    return {getResponseCode:()=>200,getContentText:()=>html};
  }, fetchAll: reqs=>reqs.map(r=>c.UrlFetchApp.fetch(r.url)) };
  for(const league of ['j2','j3']) {
    const table=call(c,{league,type:'standings'}), results=call(c,{league,type:'results'});
    assert.equal(table.status,200); assert.equal(results.status,200); assert.equal(table.data.length,20);
    assert.equal(results.data.length,league==='j2'?50:49); assert.equal(Object.keys(results.coverage).length,2);
    assert.deepEqual(results.data,snapshot('results',league).data);
    const repeat=call(c,{league,type:'results',nocache:'1'}); assert.deepEqual(repeat.data,results.data);
  }
  assert.ok(requests.some(url=>url.includes('year=2026-27')));
});

test('cup results include both followed clubs and PK, without mixing league records', async () => {
  for(const league of ['leaguecup','emperor']) {
    const p=snapshot('results',league);assert.ok(api.validPayload(p,'results',league));
    assert.ok(p.data.some(r=>[r.home,r.away].includes('アルビレックス新潟')));
    assert.ok(p.data.some(r=>[r.home,r.away].includes('ロアッソ熊本')));
    assert.ok(p.data.some(r=>r.pk));assert.ok(p.data.every(r=>r.competition_id===league));
  }
  const requested=new Set();
  const client=api.createClient({storage:storage(),fetch:async url=>{
    const league=url.startsWith('./')?url.split('/').pop().split('.')[0]:new URL(url).searchParams.get('league');
    if(!url.startsWith('./'))requested.add(league);return response(snapshot('results',league));
  }});
  const result=await client.all('results',true);
  assert.deepEqual([...requested].sort(),api.RESULT_LEAGUES.slice().sort());
  assert.equal(result.data.length,api.RESULT_LEAGUES.reduce((n,l)=>n+snapshot('results',l).data.length,0));
});

test('cup reconciliation fills pending opponents, adds missing games and preserves user IDs', () => {
  const schedule=JSON.parse(read('data/schedule/2026_2027.json'));
  const pending=schedule.find(m=>m.club==='niigata'&&m.date==='2026-08-26');
  const previousId=api.storageId(pending),count=schedule.length;
  const rows=['leaguecup','emperor'].flatMap(l=>snapshot('results',l).data);
  assert.ok(api.reconcileSchedule(schedule,rows));
  assert.equal(pending.opponent,'鹿児島ユナイテッドFC');assert.equal(api.storageId(pending),previousId);
  assert.ok(schedule.some(m=>m.club==='kumamoto'&&m.date==='2026-08-19'&&m.competition_id==='emperor'));
  assert.ok(schedule.length>count);const once=JSON.stringify(schedule);
  api.reconcileSchedule(schedule,rows);assert.equal(JSON.stringify(schedule),once);
  const homeBefore=api.storageId(pending);
  api.reconcileSchedule(schedule,[{...rows.find(r=>r.match_id===pending.match_id),date:'2026-08-27'}]);
  assert.equal(api.storageId(pending),homeBefore);assert.equal(pending.date,'2026-08-27');
});

function detailHtml(league='leaguecup') {
  const header=node('',null,{variant:'game-details',type:'post-game',tournament:league,tournamentName:league==='emperor'?'天皇杯':'ルヴァンカップ',date:'$D2026-09-06T09:00:00.000Z',section:'1回戦',homeTeam:{name:'ホーム',score:0,playerScoreList:[]},awayTeam:{name:'アウェイ',score:0,playerScoreList:[]},penalty:{homeTeamScore:4,awayTeamScore:3},stadium:{name:'競技場',weather:'晴れ',numberOfPeople:1000}});
  const player=(n,side)=>node('m-lineup-list-item',[node('m-lineup-list-item__avatar',null,{memberId:String(100+n)}),node('m-lineup-list-item__position',`MF ${n+1}`),node('m-lineup-list-item__name',`${side}選手${n}`)]);
  const starters=node('p-game-details-lineup-tab__starting-members',node('m-lineup-list__members',Array.from({length:11},(_,i)=>[player(i,'H'),player(i,'A')]).flat()));
  const bench=node('p-game-details-lineup-tab__reserve-members',node('m-lineup-list__members',[player(12,'H'),player(12,'A')]));
  const stream='1:'+JSON.stringify([header,starters,bench])+'\n';
  return '<script>self.__next_f.push('+JSON.stringify([1,stream])+')</script>';
}

test('detail API returns lineups, zero scores and PK; rejects foreign URLs; keeps last good', () => {
  const {context:c}=gasRuntime();let fetches=0;
  c.UrlFetchApp={fetch:url=>{fetches++;assert.equal(url,'https://www.jleague.jp/match/leaguecup/2026/090613/');return {getResponseCode:()=>200,getContentText:()=>detailHtml()};}};
  const params={type:'detail',path:'/match/leaguecup/2026/090613',season:api.SEASON};
  const first=call(c,params);assert.equal(first.status,200);
  assert.equal(first.data[0].home_starting_members.length,11);assert.equal(first.data[0].away_bench_members.length,1);
  assert.equal(first.data[0].home_score,0);assert.equal(first.data[0].pk,'4 PK 3');
  assert.equal(call(c,{...params,path:'https://example.com/'}).status,400);assert.equal(fetches,1);
  c.UrlFetchApp.fetch=()=>{throw new Error('source unavailable')};
  const stale=call(c,{...params,nocache:'1'});assert.equal(stale.stale,true);assert.equal(stale.fetchedAt,first.fetchedAt);
  assert.equal(stale.data[0].home_starting_members.length,11);
});

test('client detail shows bundled data before refresh, and keeps it on failure', async () => {
  const saved=JSON.parse(read('data/details/2026_2027/j2/2026090613.json'));
  let displayed=false;
  const client=api.createClient({storage:storage(),fetch:async url=>{if(url.startsWith('./'))return response(saved);assert.equal(displayed,true);throw new Error('offline');}});
  const result=await client.detail(saved.data[0],true,p=>{displayed=true;assert.equal(p.data[0].home_starting_members.length,11);});
  assert.equal(result.stale,true);assert.equal(result.fetchedAt,saved.fetchedAt);
  assert.equal(await client.detail({...saved.data[0],source_url:'https://example.com/'},true),null);
});

test('year tabs use calendar years and calendar navigation can hide, restore and persist', () => {
  const code=read('script.js');assert.ok(!code.includes('selectedSeason'));
  assert.ok(code.includes('await applyYearFilter(selectedYear || initialYear, true)'));
  assert.ok(code.includes('ensureScheduleNavigation().catch(console.error)'));
  const store=storage(),classes=new Set(),button={setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this[k]=fn;}};
  const c=vm.createContext({localStorage:store,document:{addEventListener(k,fn){fn();},getElementById:()=>button,body:{classList:{toggle(k,v){v?classes.add(k):classes.delete(k);}}}}});
  vm.runInContext(read('ui-v6.js'),c);assert.equal(button['aria-expanded'],'true');
  button.click();assert.equal(button['aria-expanded'],'false');assert.ok(classes.has('calendar-nav-collapsed'));
  assert.equal(store.getItem('trapp_calendar_nav_collapsed'),'true');
  button.click();assert.equal(button['aria-expanded'],'true');assert.ok(!classes.has('calendar-nav-collapsed'));
});

test('saved real detail records have 11 starters per team and preserve cup losses by PK', () => {
  for(const league of api.RESULT_LEAGUES) {
    const dir=path.join(root,'data/details',api.SEASON,league);
    for(const file of fs.readdirSync(dir)) {
      const p=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),r=p.data[0];
      assert.ok(api.validPayload(p,'results',league));assert.equal(r.home_starting_members.length,11);assert.equal(r.away_starting_members.length,11);
      assert.ok(r.home_bench_members.length);assert.ok(r.away_bench_members.length);assert.ok(r.referee);
      assert.equal(new Set(r.home_starting_members.map(x=>x.player_id)).size,11);
    }
  }
  const r=JSON.parse(read('data/details/2026_2027/emperor/2026081902.json')).data[0];
  assert.equal(r.pk,'6 PK 5');assert.equal(r.home_score,2);assert.equal(r.away_score,2);
});

test('live v6 official pages: monthly cup aggregation and detail parser match snapshots', {skip:!process.env.TRAPP_V6_FIXTURES}, () => {
  const {context:c}=gasRuntime(),dir=process.env.TRAPP_V6_FIXTURES;
  const files={j1:['emperor-j1','emperor-j1-september'],j2:['emperor-august','emperor-september'],j3:['emperor-j3','emperor-j3-september'],leaguecup:['cup-august','cup-month']};
  c.UrlFetchApp={fetch:url=>{const u=new URL(url),page=u.pathname.split('/')[1],index=u.searchParams.get('startdate').slice(5,7)==='08'?0:1;const html=fs.readFileSync(path.join(dir,files[page][index]+'.html'),'utf8');return {getResponseCode:()=>200,getContentText:()=>html};},fetchAll:reqs=>reqs.map(r=>c.UrlFetchApp.fetch(r.url))};
  for(const league of ['leaguecup','emperor']) {
    const p=call(c,{type:'results',league});assert.equal(p.status,200,p.error);
    assert.deepEqual(p.data,snapshot('results',league).data);
    assert.equal(call(c,{type:'results',league,nocache:'1'}).data.length,p.data.length);
  }
  const pairs={'j2-detail':'j2/2026/090613','j3-detail':'j3/2026/090616','emperor-detail':'emperor/2026/082624','kumamoto-emperor-detail':'emperor/2026/081902','niigata-cup-detail':'leaguecup/2026/090202','kumamoto-cup-detail':'leaguecup/2026/090209'};
  for(const [file,route] of Object.entries(pairs)) {
    const r=clone(c.jlParseDetail(fs.readFileSync(path.join(dir,file+'.html'),'utf8'),'/match/'+route));
    const expected=JSON.parse(read(`data/details/${api.SEASON}/${r.league}/${r.match_id}.json`)).data[0];
    delete r.detail_fetched_at;delete expected.detail_fetched_at;assert.deepEqual(r,expected,file);
  }
});
