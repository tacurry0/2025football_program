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
  const saved = snapshot('standings'); saved.fetchedAt = '2026-09-08T00:00:00Z'; saved.stale = true;
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
  server = { ...snapshot('standings'), fetchedAt: '2026-09-08T00:00:00Z', stale: true, error: 'source unavailable' };
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
    Utilities: { formatDate: () => '2026-09-07', newBlob: blob, gzip: b => blob(zlib.gzipSync(b.getBytes())), ungzip: b => blob(zlib.gunzipSync(b.getBytes())), base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => Buffer.from(s,'base64') },
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

test('standings renderer exposes J2/J3 controls, real timestamps, draw column and escaped names', () => {
  const buttons = {}, container = { innerHTML:'', querySelector:s => buttons[s] ||= {}, querySelectorAll:()=>[] };
  const c=vm.createContext({window:{},Date}); vm.runInContext(read('league-ui.js'),c);
  const data=snapshot('standings'); data.data[0].team='<img onerror=bad>';
  c.window.TrappStandings.render(container,{sources:{j2:data}});
  assert.match(container.innerHTML,/data-league="j3"/); assert.match(container.innerHTML,/data-sort="drawn"/);
  assert.ok(container.innerHTML.includes('&lt;img onerror=bad&gt;')); assert.ok(!container.innerHTML.includes('<img onerror=bad>'));
  assert.ok(!container.innerHTML.includes('PK勝')); assert.ok(!container.innerHTML.includes('取得日時不明'));
});

test('all changed JS parses and cached/shared-script assets exist', () => {
  for (const file of ['script.js','league-data.js','league-ui.js','sw.js','vision/app.js','gas/JLeague.gs']) new vm.Script(read(file),{filename:file});
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
