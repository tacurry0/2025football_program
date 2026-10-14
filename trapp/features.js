/* Optional views load their data/maps only after the user opens them. */
(function(){
'use strict';
const M=window.TrappFeaturesModel,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RAW='https://raw.githubusercontent.com/tacurry0/2025football_program/main/trapp/data/';
const VISITS='trapp_stadium_visits_v1';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
let app,club='niigata',request=0,map,markers,stadiums=[],mapPromise,visits=[],editing=null,photo='',selectedPoint=null;
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
async function data(file){try{return await json(RAW+file);}catch(_){return json('./data/'+file);}}
function status(text){$('#visit-status').textContent=text;}
function show(mode){app.navigate(mode);}
const selectedOpponents={},analysisCache=new Map();
const competitionOf=r=>window.TrappLeague.context(r).competition;
const isLeague=r=>['j1','j2','j3'].includes(competitionOf(r))||/ディビジョン[123]|J[123]リーグ|^Jリーグ$/.test(String(r.competition||''));
const inScope=(r,scope)=>scope==='all'||isLeague(r);
const seasonStart='2026-07-01';
function standingFor(rows,team){return rows.find(r=>M.same(r.team,team));}
const analysisUI={tab:'overview',recentTeam:'own',h2hLimit:5,historyTab:'summary',historyTeam:'own',historyMetric:'goals',historyRange:'all',playerLimit:5};
let analysisContext=null,analysisIdentity='';
const analysisTabs=[['overview','概要'],['recent','直近成績'],['history','過去対戦'],['scorers','得点者']];
const shortName=name=>({アルビレックス新潟:'新潟',ロアッソ熊本:'熊本'})[name]||name;
function resultSummary(games){const s=M.metrics(games);return s.played?`${s.W}勝 ${s.D}分 ${s.L}敗`:'—';}
function metricValue(value){return esc(value).replace(/(勝|分|敗|%)/g,'<small>$1</small>');}
function metricTable(left,right,rows,caption){
 return `<table class="ma-comparison-table"><caption>${esc(caption)}</caption><thead><tr><th scope="col">${esc(shortName(left))}</th><th scope="col">指標</th><th scope="col">${esc(shortName(right))}</th></tr></thead><tbody>${rows.map(([label,a,b])=>`<tr><td>${metricValue(a)}</td><th scope="row">${esc(label)}</th><td>${metricValue(b)}</td></tr>`).join('')}</tbody></table>`;
}
function analysisSideOrder(c){return c.match&&!app.isHome(c.match)?[{name:c.opponent,games:c.opp,all:c.oppAll},{name:c.name,games:c.own,all:c.ownAll}]:[{name:c.name,games:c.own,all:c.ownAll},{name:c.opponent,games:c.opp,all:c.oppAll}];}
function analysisEmblem(name,className=''){const src=app.emblem(name);return src?`<img class="${className}" src="${esc(src)}" alt="" decoding="async">`:'<span class="ma-emblem-empty" aria-hidden="true">—</span>';}
function analysisHero(c){
 const sides=analysisSideOrder(c),match=c.match;
 const team=(side,index)=>{const row=standingFor(c.standings,side.name);return `<div class="ma-hero-team"><span class="ma-side">${match?(index===0?'HOME':'AWAY'):index===0?'MY CLUB':'OPPONENT'}</span>${analysisEmblem(side.name,'ma-hero-emblem')}<h2>${esc(side.name)}</h2><p class="ma-standing">${row?`<span>${esc(row.league.toUpperCase())}</span> <b>${row.rank}<small>位</small></b><b>${row.points}<small>pts</small></b>`:'<span>順位未取得</span>'}</p></div>`;};
 const meta=match?`${esc(match.date.replace(/-/g,'.'))} <b>${esc(match.time||'時刻未定')}</b>`:'2026–27 <b>クラブ比較</b>';
 return `<section class="ma-hero" aria-label="${esc(c.name+'と'+c.opponent+'の比較')}"><div class="ma-hero-meta"><span>${meta}</span>${match?'<button type="button" id="fx-open-match" class="ma-detail-link">試合詳細 ↗</button>':''}</div><div class="ma-matchup">${team(sides[0],0)}<span class="ma-versus" aria-hidden="true">VS</span>${team(sides[1],1)}</div>${match?`<p class="ma-venue">${esc(match.venue||'会場未定')}</p>`:''}</section>`;
}
function overviewPanel(c){
 const [left,right]=analysisSideOrder(c),a=M.metrics(left.games),b=M.metrics(right.games);
 const main=[['成績',resultSummary(left.games),resultSummary(right.games)],['得点 / 失点',a.played?`${a.gf} / ${a.ga}`:'—',b.played?`${b.gf} / ${b.ga}`:'—'],['平均得点',a.avgGF,b.avgGF],['平均失点',a.avgGA,b.avgGA],['勝率',a.winRate,b.winRate],['無失点率',a.cleanSheetRate,b.cleanSheetRate]];
 const extra=[['得失点差',a.played?(a.gd>0?'+':'')+a.gd:'—',b.played?(b.gd>0?'+':'')+b.gd:'—'],['無失点試合',a.cleanSheets,b.cleanSheets],['無得点試合',a.scoreless,b.scoreless],['両チーム得点率',a.bothScore,b.bothScore],['連続無敗',a.played?a.unbeaten:'—',b.played?b.unbeaten:'—'],['連勝',a.played?a.winning:'—',b.played?b.winning:'—']];
 const sideRows=['home','away'].flatMap(side=>{const x=left.all.filter(r=>r.homeSide===(side==='home')),y=right.all.filter(r=>r.homeSide===(side==='home')),xs=M.metrics(x),ys=M.metrics(y),label=side==='home'?'ホーム':'アウェイ';return [[label+'成績',resultSummary(x),resultSummary(y)],[label+'平均得点',xs.avgGF,ys.avgGF],[label+'平均失点',xs.avgGA,ys.avgGA]];});
 return `<div class="ma-panel-heading"><h3>シーズン成績</h3><span>${left.games.length} / ${right.games.length}<small>集計試合</small></span></div>${metricTable(left.name,right.name,main,'選択した集計条件でのシーズン成績')}<details class="ma-disclosure"><summary>詳細指標</summary>${metricTable(left.name,right.name,extra,'詳細指標')}</details><details class="ma-disclosure"><summary>ホーム・アウェイ別</summary>${metricTable(left.name,right.name,sideRows,'ホーム・アウェイ別のシーズン成績')}</details>`;
}
function analysisGameList(games,emptyText='対象の試合はありません。',includeYear=false){
 return games.length?`<ul class="ma-games">${games.map(r=>`<li><div class="ma-game-date">${includeYear?`<small>${esc(r.date.slice(0,4))}</small>`:''}<time datetime="${esc(r.date)}">${esc(r.date.slice(5).replace('-','/'))}</time><span>${r.homeSide?'H':'A'}</span></div><span class="ma-result ${r.outcome}" aria-label="${{W:'勝利',D:'引き分け',L:'敗戦'}[r.outcome]}">${r.outcome}</span><div class="ma-game-opponent">${analysisEmblem(r.opponent)}<span>${esc(r.opponent)}<small>${esc(window.TrappLeague.context(r).label)}</small></span></div><b class="ma-game-score">${r.gf}<span>–</span>${r.ga}</b></li>`).join('')}</ul>`:`<p class="ma-empty">${esc(emptyText)}</p>`;
}
function recentPanel(c){
 const [left,right]=analysisSideOrder(c),a=M.metrics(left.games.slice(0,c.recent)),b=M.metrics(right.games.slice(0,c.recent));
 const form=side=>`<div class="ma-form-team"><span>${esc(shortName(side.name))}</span><div class="ma-form">${side.games.slice(0,c.recent).reverse().map(r=>`<span class="ma-result ${r.outcome}" title="${esc(r.date+' '+r.opponent+' '+r.gf+'–'+r.ga)}">${r.outcome}</span>`).join('')||'<span class="ma-muted">記録なし</span>'}</div></div>`;
 const selected=analysisUI.recentTeam==='opp'?c.opp:c.own;
 return `<div class="ma-panel-heading"><h3>直近の調子</h3><div class="ma-segment" aria-label="直近の集計試合数">${[5,10].map(n=>`<button type="button" data-ma-recent="${n}" aria-pressed="${n===c.recent}">${n}試合</button>`).join('')}</div></div><div class="ma-form-board">${form(left)}${form(right)}<p>右が最新</p></div>${metricTable(left.name,right.name,[['成績',resultSummary(left.games.slice(0,c.recent)),resultSummary(right.games.slice(0,c.recent))],['平均得点',a.avgGF,b.avgGF],['平均失点',a.avgGA,b.avgGA]],'直近の試合成績の比較')}<details class="ma-disclosure"><summary>直近の詳細指標</summary>${metricTable(left.name,right.name,[['集計試合',a.played,b.played],['勝率',a.winRate,b.winRate],['無失点率',a.cleanSheetRate,b.cleanSheetRate]],'直近の詳細指標')}</details><div class="ma-team-switch" role="tablist" aria-label="試合一覧のクラブ">${[['own',c.name],['opp',c.opponent]].map(([key,name])=>`<button type="button" role="tab" id="ma-team-${key}" aria-controls="ma-recent-games" aria-selected="${analysisUI.recentTeam===key}" tabindex="${analysisUI.recentTeam===key?0:-1}" data-ma-team="${key}">${esc(shortName(name))}</button>`).join('')}</div><div id="ma-recent-games" role="tabpanel" aria-labelledby="ma-team-${analysisUI.recentTeam}">${analysisGameList(selected.slice(0,c.recent))}</div>`;
}
const headDetailCache=new Map();
const headTabs=[['summary','成績'],['players','選手'],['trends','傾向'],['matches','試合']];
function ensureHeadDetails(c,force=false){
 if(c.headDetails?.status==='loading'||!force&&c.headDetails)return;
 const key=c.club,cached=headDetailCache.get(key);
 const promise=!force&&cached&&Date.now()-cached.at<300000?cached.promise:data(`insights/${key}_head_to_head.json`).then(payload=>{
  if(payload?.schemaVersion!==1||payload.club!==key||!Array.isArray(payload.data))throw Error('Invalid head-to-head details');return payload;
 });
 if(force||!cached||Date.now()-cached.at>=300000)headDetailCache.set(key,{at:Date.now(),promise});
 c.headDetails={status:'loading'};
 promise.then(payload=>{c.headDetails={status:'ready',payload};if(analysisContext===c&&analysisUI.tab==='history')renderAnalysisPanel();}).catch(()=>{c.headDetails={status:'error'};headDetailCache.delete(key);if(analysisContext===c&&analysisUI.tab==='history')renderAnalysisPanel();});
}
function headGames(c){
 let games=M.teamGames(M.unique([...c.h2h,...(c.headDetails?.payload?.data||[])]),c.name,c.before,c.side).filter(r=>M.same(r.opponent,c.opponent)&&inScope(r,c.scope));
 if(analysisUI.historyRange==='recent')games=games.slice(0,10);
 if(analysisUI.historyRange==='season')games=games.filter(r=>window.TrappLeague.context(r).season===window.TrappLeague.SEASON);
 return games;
}
function headStatus(c){return c.headDetails?.status==='loading'?'<p class="ma-caption" role="status">得点者・出場記録を読み込んでいます…</p>':c.headDetails?.status==='error'?'<p class="ma-notice">詳しい対戦記録を取得できませんでした。<button type="button" class="ma-inline-retry" data-ma-head-retry>再取得</button></p>':'';}
function headSummaryPanel(c,games){
 const h=M.headSummary(games),other=M.metrics(games.map(r=>({...r,gf:r.ga,ga:r.gf,outcome:r.outcome==='W'?'L':r.outcome==='L'?'W':'D'}))),wins=h.played?h.W/h.played*100:0,draws=h.played?h.D/h.played*100:0,losses=h.played?h.L/h.played*100:0;
 const extra=[['平均得点',h.avgGF,other.avgGF],['勝率',h.winRate,other.winRate],['無失点率',h.cleanSheetRate,other.cleanSheetRate],['複数得点',h.multiGoal,games.filter(r=>r.ga>=2).length],['連続無敗',h.played?h.unbeaten:'—',other.played?other.unbeaten:'—']];
 const record=(label,r)=>r?`<div class="ma-head-record"><span>${label}</span><b>${r.gf} – ${r.ga}</b><small>${esc(r.date)} · ${r.homeSide?'HOME':'AWAY'}</small></div>`:'';
 return `<div class="ma-h2h-summary"><div><b>${h.W}</b><span>${esc(shortName(c.name))}の勝利</span></div><div><b>${h.D}</b><span>引き分け</span></div><div><b>${h.L}</b><span>${esc(shortName(c.opponent))}の勝利</span></div></div><div class="ma-h2h-bar" aria-hidden="true"><i style="width:${wins}%"></i><i style="width:${draws}%"></i><i style="width:${losses}%"></i></div><p class="ma-caption">${games.length?esc(games.at(-1).date)+' ～ '+esc(games[0].date):'対戦記録はありません'} · PK戦は引き分け扱い</p>${metricTable(c.name,c.opponent,[['通算得点',h.played?h.gf:'—',other.played?other.gf:'—'],...extra],'直接対決での成績比較')}<details class="ma-disclosure"><summary>ホーム・アウェイ別</summary>${metricTable('HOME','AWAY',[['成績',h.home.played?`${h.home.W}勝 ${h.home.D}分 ${h.home.L}敗`:'—',h.away.played?`${h.away.W}勝 ${h.away.D}分 ${h.away.L}敗`:'—'],['平均得点',h.home.avgGF,h.away.avgGF],['平均失点',h.home.avgGA,h.away.avgGA],['無失点率',h.home.cleanSheetRate,h.away.cleanSheetRate]],esc(shortName(c.name))+'の開催区分別直接対決成績')}</details><div class="ma-head-records">${record('最大差での勝利',h.bestWin)}${record('最大差での敗戦',h.worstLoss)}</div><p class="ma-caption">最大差の記録は${esc(shortName(c.name))}から見たスコア。同じ差なら最新の試合。</p>`;
}
function headPlayersPanel(c,games){
 const team=analysisUI.historyTeam==='opp'?c.opponent:c.name,kind=analysisUI.historyMetric,ranking=M.headPlayers(games,team,kind),rows=ranking.rows.slice(0,analysisUI.playerLimit),max=ranking.rows[0]?.[kind==='goals'?'goals':'appearances']||1;
 return `<div class="ma-head-team-switch">${[['own',c.name],['opp',c.opponent]].map(([key,name])=>`<button type="button" data-ma-head-team="${key}" aria-pressed="${analysisUI.historyTeam===key}">${esc(shortName(name))}</button>`).join('')}</div><div class="ma-panel-heading"><h3>直接対決の選手ランキング</h3><div class="ma-segment" aria-label="ランキング指標">${[['goals','得点'],['appearances','出場']].map(([key,label])=>`<button type="button" data-ma-head-metric="${key}" aria-pressed="${kind===key}">${label}</button>`).join('')}</div></div>${rows.length?`<ol class="ma-scorers">${rows.map(p=>{const value=kind==='goals'?p.goals:p.appearances;return `<li><span class="ma-scorer-rank">${p.rank}</span><div><strong>${esc(p.name)}</strong><small class="ma-head-player-meta">${kind==='goals'?`${p.scored}試合で得点 · ${p.appearances?'出場記録 '+p.appearances:'出場記録未取得'}`:`先発 ${p.starts} · 得点 ${p.goals}`}</small><span class="ma-scorer-track" aria-hidden="true"><i style="width:${value/max*100}%"></i></span></div><b>${value}<small class="ma-head-unit">${kind==='goals'?'得点':'試合'}</small></b></li>`;}).join('')}</ol>`:`<p class="ma-empty">${c.headDetails?.status==='loading'?'詳しい公式記録を読み込んでいます。':'対象の選手記録はありません。'}</p>`}${ranking.rows.length>analysisUI.playerLimit?'<button type="button" class="ma-more" data-ma-head-players-more>さらに5人を表示</button>':''}<p class="ma-caption">${kind==='goals'?'得点者':'出場選手'}情報が揃う${kind==='goals'?ranking.completeGoals:ranking.completePlayers} / ${games.length}対戦。収録済みの記録のみ集計${kind==='goals'?'（オウンゴール除外）':'（出場しなかったベンチ選手は除外）'}。</p>`;
}
function headTrendsPanel(c,games){
 const h=M.headSummary(games),own=M.headTiming(games,c.name),opp=M.headTiming(games,c.opponent),firstTotal=h.firstScored.played+h.firstConceded.played;
 const timingRows=own.labels.map((label,index)=>[label,own.known||own.total===0?own.bins[index]:'—',opp.known||opp.total===0?opp.bins[index]:'—']);
 const attendance=games.filter(r=>Number.isFinite(r.attendance)&&r.attendance>=0),average=attendance.length?Math.round(attendance.reduce((sum,r)=>sum+r.attendance,0)/attendance.length).toLocaleString('ja-JP'):'—';
 const venues=new Map();for(const r of games)if(r.venue){if(!venues.has(r.venue))venues.set(r.venue,[]);venues.get(r.venue).push(r);}
 const venueRows=[...venues].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],'ja')).slice(0,5);
 return `<div class="ma-panel-heading"><h3>得点の時間帯</h3><span>得点数</span></div>${metricTable(c.name,c.opponent,timingRows,'直接対決の得点時間帯')}<p class="ma-caption">時刻が分かる得点：${esc(shortName(c.name))} ${own.known} / ${own.total}、${esc(shortName(c.opponent))} ${opp.known} / ${opp.total}。45分・90分の追加時間は各ハーフに含めます。</p><details class="ma-disclosure"><summary>先制と逆転の傾向</summary><dl class="ma-head-facts"><div><dt>先制した時の成績</dt><dd>${h.firstScored.played?`${h.firstScored.W}勝 ${h.firstScored.D}分 ${h.firstScored.L}敗`:'—'}</dd></div><div><dt>先制された時の成績</dt><dd>${h.firstConceded.played?`${h.firstConceded.W}勝 ${h.firstConceded.D}分 ${h.firstConceded.L}敗`:'—'}</dd></div><div><dt>逆転勝利</dt><dd>${firstTotal?h.comebackWins:'—'}</dd></div></dl><p class="ma-caption">${esc(shortName(c.name))}から見た記録。先制を判定できた${firstTotal}対戦を集計。</p></details><details class="ma-disclosure"><summary>シーズンごとの直接対決</summary><table class="ma-head-table"><thead><tr><th scope="col">シーズン</th><th scope="col">勝</th><th scope="col">分</th><th scope="col">敗</th><th scope="col">得点</th><th scope="col">失点</th></tr></thead><tbody>${h.seasons.map(s=>`<tr><th scope="row">${esc(String(s.season).replace('_','–'))}</th><td>${s.W}</td><td>${s.D}</td><td>${s.L}</td><td>${s.gf}</td><td>${s.ga}</td></tr>`).join('')}</tbody></table><p class="ma-caption">${esc(shortName(c.name))}から見た成績。</p></details><details class="ma-disclosure"><summary>会場・入場者数</summary><dl class="ma-head-facts"><div><dt>平均入場者数</dt><dd>${average}<small>人</small></dd></div></dl><p class="ma-caption">入場者数のある${attendance.length}対戦を集計。</p>${venueRows.length?`<ul class="ma-head-venues">${venueRows.map(([venue,rows])=>`<li><strong>${esc(venue)}</strong><span>${rows.length}対戦 · ${esc(resultSummary(rows))}</span></li>`).join('')}</ul>`:'<p class="ma-empty">会場の記録はありません。</p>'}</details>`;
}
function headMatchesPanel(c,games){
 const goals=(r,team)=>{const own=M.same(r.home,team),score=Number(r[own?'home_score':'away_score']),events=r[own?'home_goals':'away_goals']||[];return `<div class="ma-head-match-goals"><h4>${esc(shortName(team))}</h4>${events.length?events.map(g=>`<p><time>${esc(g.minute||g.time||'—')}${g.minute||g.time?'′':''}</time><span>${esc(g.name||g.scorer||'得点者不明')}${g.own_goal?'（OG）':''}</span></p>`).join(''):`<p>${score===0?'得点なし':'得点者未取得'}</p>`}</div>`;};
 return `<p class="ma-caption">${esc(shortName(c.name))}から見たスコア。試合を開くと得点者・会場を表示。</p><div class="ma-head-matches">${games.slice(0,analysisUI.h2hLimit).map(r=>`<details class="ma-head-match"><summary><time>${esc(r.date.replace(/-/g,'.'))}<small>${r.homeSide?'HOME':'AWAY'}</small></time><span class="ma-result ${r.outcome}">${r.outcome}</span><b>${r.gf} – ${r.ga}</b><span class="ma-head-expand">＋</span></summary><div class="ma-head-match-details"><p class="ma-caption">${esc(r.competition||window.TrappLeague.context(r).label)} · ${esc(r.venue||'会場未取得')}</p>${goals(r,c.name)}${goals(r,c.opponent)}${/^https?:\/\//.test(r.source_url||'')?`<a class="ma-head-official" href="${esc(r.source_url)}" target="_blank" rel="noopener">公式記録 ↗</a>`:''}</div></details>`).join('')||'<p class="ma-empty">対象の対戦記録はありません。</p>'}</div>${games.length>analysisUI.h2hLimit?`<button type="button" class="ma-more" data-ma-more>さらに5試合を表示 <span>${analysisUI.h2hLimit} / ${games.length}</span></button>`:''}`;
}
function historyPanel(c){
 ensureHeadDetails(c);
 const games=headGames(c),renderers={summary:headSummaryPanel,players:headPlayersPanel,trends:headTrendsPanel,matches:headMatchesPanel};
 return `<div class="ma-panel-heading"><h3>直接対決 <span class="ma-head-count">${games.length}対戦</span></h3><select class="ma-head-range" id="ma-h2h-range" aria-label="直接対決の集計期間">${[['all','全期間'],['recent','直近10対戦'],['season','2026–27']].map(([key,label])=>`<option value="${key}" ${analysisUI.historyRange===key?'selected':''}>${label}</option>`).join('')}</select></div><div class="ma-history-tabs" role="tablist" aria-label="直接対決の情報">${headTabs.map(([key,label])=>`<button type="button" role="tab" id="ma-head-tab-${key}" aria-controls="ma-head-subpanel" aria-selected="${analysisUI.historyTab===key}" tabindex="${analysisUI.historyTab===key?0:-1}" data-ma-head-tab="${key}">${label}</button>`).join('')}</div>${headStatus(c)}<section id="ma-head-subpanel" role="tabpanel" aria-labelledby="ma-head-tab-${analysisUI.historyTab}">${renderers[analysisUI.historyTab](c,games)}</section>`;
}
function scorersPanel(c){
 const games=M.teamGames(c.currentDetails.filter(r=>inScope(r,c.scope)),c.name,c.before,c.side),goals=new Map();
 for(const r of games)for(const goal of r[r.homeSide?'home_goals':'away_goals']||[]){const name=goal.scorer||goal.name;if(!name||goal.own_goal||/オウンゴール/i.test(name))continue;const key=M.norm(name),entry=goals.get(key)||{name,count:0};entry.count++;goals.set(key,entry);}
 const rows=[...goals.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ja')),limit=rows[0]?.count||1;
 return `<div class="ma-panel-heading"><h3>${esc(shortName(c.name))}の得点者</h3><span>2026–27</span></div>${rows.length?`<ol class="ma-scorers">${rows.map((r,index)=>`<li><span class="ma-scorer-rank">${index+1}</span><div><strong>${esc(r.name)}</strong><span class="ma-scorer-track" aria-hidden="true"><i style="width:${r.count/limit*100}%"></i></span></div><b>${r.count}</b></li>`).join('')}</ol>`:'<p class="ma-empty">対象試合の得点者情報はありません。</p>'}<p class="ma-caption">公式詳細のある${games.length}試合を集計。オウンゴールは除外。</p>`;
}
function renderAnalysisPanel(){
 if(!analysisContext)return;
 const panel=$('#ma-analysis-panel');if(!panel)return;
 const renderers={overview:overviewPanel,recent:recentPanel,history:historyPanel,scorers:scorersPanel};
 panel.setAttribute('aria-labelledby','ma-tab-'+analysisUI.tab);
 panel.innerHTML=renderers[analysisUI.tab](analysisContext);
 document.querySelectorAll('[data-ma-tab]').forEach(button=>{const active=button.dataset.maTab===analysisUI.tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
}
function bindAnalysisControls(host){
 host.onclick=event=>{
  const tab=event.target.closest('[data-ma-tab]'),team=event.target.closest('[data-ma-team]'),recent=event.target.closest('[data-ma-recent]');
  if(tab){analysisUI.tab=tab.dataset.maTab;renderAnalysisPanel();}
  if(team){analysisUI.recentTeam=team.dataset.maTeam;renderAnalysisPanel();$('#ma-team-'+analysisUI.recentTeam)?.focus({preventScroll:true});}
  if(recent){$('#fx-analysis-recent').value=recent.dataset.maRecent;renderAnalysis();}
  if(event.target.closest('[data-ma-more]')){analysisUI.h2hLimit+=5;renderAnalysisPanel();}
  const headTab=event.target.closest('[data-ma-head-tab]'),headTeam=event.target.closest('[data-ma-head-team]'),headMetric=event.target.closest('[data-ma-head-metric]');
  if(headTab){analysisUI.historyTab=headTab.dataset.maHeadTab;renderAnalysisPanel();$('#ma-head-tab-'+analysisUI.historyTab)?.focus({preventScroll:true});}
  if(headTeam){analysisUI.historyTeam=headTeam.dataset.maHeadTeam;analysisUI.playerLimit=5;renderAnalysisPanel();}
  if(headMetric){analysisUI.historyMetric=headMetric.dataset.maHeadMetric;analysisUI.playerLimit=5;renderAnalysisPanel();}
  if(event.target.closest('[data-ma-head-players-more]')){analysisUI.playerLimit+=5;renderAnalysisPanel();}
  if(event.target.closest('[data-ma-head-retry]'))ensureHeadDetails(analysisContext,true);
 };
 host.onchange=event=>{if(event.target.id==='ma-h2h-range'){analysisUI.historyRange=event.target.value;analysisUI.h2hLimit=5;analysisUI.playerLimit=5;renderAnalysisPanel();$('#ma-h2h-range')?.focus({preventScroll:true});}};
 host.onkeydown=event=>{
  const target=event.target.closest('[role="tab"]');if(!target||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const group=target.closest('[role="tablist"]'),buttons=[...group.querySelectorAll('[role="tab"]')],index=buttons.indexOf(target);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  event.preventDefault();const choice=buttons[next],id=choice.id;choice.click();document.getElementById(id)?.focus({preventScroll:true});
 };
}
function updateAnalysisFilterSummary(){
 const scope=$('#fx-analysis-scope'),side=$('#fx-analysis-location');
 $('#ma-filter-summary').textContent=[scope.selectedOptions[0].textContent,side.value==='all'?'H / A 両方':side.value==='home'?'自クラブ HOME':'自クラブ AWAY'].join(' · ');
}
function populateOpponents(current,historical,schedule,standings,next){
 const select=$('#fx-analysis-opponent'),own=M.names[club],groups=[new Map(),new Map()];
 function add(name,index){if(!name||M.same(name,own)||/未定|TBD/i.test(name))return;const key=M.norm(name);if(index&&groups[0].has(key))return;groups[index].set(key,name);}
 current.forEach(r=>{add(r.home,0);add(r.away,0);});standings.forEach(r=>add(r.team,0));schedule.filter(m=>m.club===club&&window.TrappLeague.context(m).season===window.TrappLeague.SEASON).forEach(m=>add(m.opponent,0));
 historical.forEach(r=>{add(r.home,1);add(r.away,1);});
 select.innerHTML=`<option value="">${next?'次節：'+esc(next.opponent):'対戦相手を選択'}</option>`+groups.map((group,index)=>group.size?`<optgroup label="${index?'過去の対戦相手':'今シーズンのクラブ'}">${[...group.values()].sort((a,b)=>a.localeCompare(b,'ja')).map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</optgroup>`:'').join('');
 select.value=selectedOpponents[club]||'';
}
async function loadAnalysisData(force){
 const key=club,previous=analysisCache.get(key);
 if(!force&&previous&&Date.now()-previous.at<300000)return previous.promise;
 const promise=Promise.all([Promise.all(['j1','j2','j3','leaguecup','emperor'].map(l=>data(l==='j1'?'insights/j1.json':`results/${window.TrappLeague.SEASON}/${l}.json`).catch(()=>null))),data(`insights/${key}.json`).catch(()=>null),Promise.all(['j2','j3'].map(l=>data(`standings/${window.TrappLeague.SEASON}/${l}.json`).catch(()=>null))),data(`history/${key}/${window.TrappLeague.SEASON}.json`).catch(()=>null)]);
 analysisCache.set(key,{at:Date.now(),promise});return promise;
}
async function renderAnalysis(force=false){
 if(force)headDetailCache.delete(club);
 const token=++request,host=$('#fx-analysis-content');host.innerHTML='<p class="ma-empty" role="status">対戦データを読み込んでいます…</p>';
 try{
  const [payloads,history,standingsPayloads,details]=await loadAnalysisData(force);
  if(token!==request)return;
  const schedule=app.schedule(),name=M.names[club],scope=$('#fx-analysis-scope').value,side=$('#fx-analysis-location').value,recent=Number($('#fx-analysis-recent').value);
  const allRows=M.unique([...app.results(),...payloads.flatMap(p=>p?.data||[])]),rows=allRows.filter(r=>r.date>=seasonStart&&window.TrappLeague.context(r).season===window.TrappLeague.SEASON);
  const historical=M.unique(history?.data||[]),standings=standingsPayloads.flatMap(p=>p?.data||[]),next=M.nextMatch(schedule,rows,club,today());
  populateOpponents(rows,historical,schedule,standings,next);
  const opponent=selectedOpponents[club]||next?.opponent;
  if(!opponent){host.innerHTML='<p class="ma-empty">対戦相手を選択してください。</p>';return;}
  const match=selectedOpponents[club]?schedule.filter(m=>m.club===club&&M.same(m.opponent,opponent)&&window.TrappLeague.context(m).season===window.TrappLeague.SEASON&&m.date>=today()&&!rows.some(r=>M.completed(r)&&String(r.match_id)===String(m.match_id))).sort((a,b)=>a.date.localeCompare(b.date))[0]:next;
  const tomorrow=new Date(new Date(today()+'T12:00:00+09:00').getTime()+86400000).toISOString().slice(0,10),before=match&&match.date<tomorrow?match.date:tomorrow;
  const selected=rows.filter(r=>inScope(r,scope)),ownAll=M.teamGames(selected,name,before),oppAll=M.teamGames(selected,opponent,before);
  const own=M.teamGames(selected,name,before,side),opp=M.teamGames(selected,opponent,before,side==='home'?'away':side==='away'?'home':'all');
  const h2h=M.teamGames(M.unique([...historical,...allRows]),name,before).filter(r=>M.same(r.opponent,opponent)&&inScope(r,scope));
  const dates=payloads.map(p=>p?.fetchedAt).filter(Boolean).sort(),currentDetails=(Array.isArray(details)?details:details?.data||[]).map(window.TrappVisionData.normalize).filter(r=>r.detail_complete!==false&&r.date>=seasonStart);
  const identity=club+'|'+M.norm(opponent);
  if(analysisIdentity!==identity){analysisUI.h2hLimit=5;analysisUI.recentTeam='own';analysisUI.historyTeam='own';analysisUI.playerLimit=5;analysisIdentity=identity;}
  analysisContext={club,name,opponent,match,standings,own,opp,ownAll,oppAll,h2h,scope,side,recent,before,currentDetails,historyAvailable:Boolean(history)};
  $('#match-analysis-view').dataset.club=club;
  updateAnalysisFilterSummary();
  host.innerHTML=`${analysisHero(analysisContext)}<nav class="ma-tabs" role="tablist" aria-label="対戦分析の表示">${analysisTabs.map(([key,label])=>`<button type="button" role="tab" id="ma-tab-${key}" data-ma-tab="${key}" aria-controls="ma-analysis-panel" aria-selected="${key===analysisUI.tab}" tabindex="${key===analysisUI.tab?0:-1}">${label}</button>`).join('')}</nav><section id="ma-analysis-panel" class="ma-panel" role="tabpanel" aria-labelledby="ma-tab-${analysisUI.tab}" tabindex="0"></section><details class="ma-source"><summary>データ情報・更新</summary><p>2026–27 ${scope==='league'?'リーグ戦':'公式戦'} ／ ${esc(before)}より前の終了済み試合。順位・勝点は最新のリーグ順位表。</p><p>公式記録の確認: ${dates.length?esc(new Date(dates[0]).toLocaleString('ja-JP')):'日時不明'} · <a href="https://www.jleague.jp/" target="_blank" rel="noopener">J.LEAGUE</a></p><button type="button" class="ma-more" id="fx-retry">データを再取得</button>${payloads.some(p=>!p)?'<p class="ma-notice">一部の大会データを取得できませんでした。取得済みの範囲を表示しています。</p>':''}</details>`;
  renderAnalysisPanel();bindAnalysisControls(host);
  if(match)$('#fx-open-match').onclick=()=>app.openMatch(match);$('#fx-retry').onclick=()=>renderAnalysis(true);
 }catch(e){if(token!==request)return;host.innerHTML='<p class="ma-empty">データを読み込めませんでした。</p><button type="button" class="ma-more" id="fx-retry">再読み込み</button>';$('#fx-retry').onclick=()=>renderAnalysis(true);}
}
function readVisits(){try{const v=JSON.parse(localStorage.getItem(VISITS)||'[]');if(!Array.isArray(v)||!v.every(M.validVisit))throw Error();visits=v;}catch(_){visits=[];status('訪問記録を読み込めません。データ管理からバックアップを確認してください。');}}
function persist(next){localStorage.setItem(VISITS,JSON.stringify(next));visits=next;}
function venuePoint(name){const saved=visits.find(v=>M.norm(v.venue)===M.norm(name)&&v.lat!==null);return saved||stadiums.find(s=>M.norm(s.name)===M.norm(name)||(s.aliases||[]).some(a=>M.norm(a)===M.norm(name)));}
function loadMap(){if(mapPromise)return mapPromise;mapPromise=new Promise((resolve,reject)=>{if(window.L)return resolve();const css=document.createElement('link');css.rel='stylesheet';css.href='./vendor/leaflet/leaflet.css';document.head.append(css);const script=document.createElement('script');script.src='./vendor/leaflet/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.append(script);}).then(()=>{
 map=L.map('stadium-map-canvas',{scrollWheelZoom:false}).setView([36.1,137.2],5);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map).on('tileerror',()=>{$('#map-network-status').textContent='地図を取得できません。訪問リストは引き続き利用できます。';});markers=L.layerGroup().addTo(map);map.on('click',e=>{if(!$('#visit-form').hidden){selectedPoint={lat:+e.latlng.lat.toFixed(6),lng:+e.latlng.lng.toFixed(6)};$('#visit-lat').value=selectedPoint.lat;$('#visit-lng').value=selectedPoint.lng;drawMarkers();}});drawMarkers();}).catch(()=>{mapPromise=null;$('#map-network-status').textContent='地図を読み込めません。訪問記録は下のフォームから保存できます。';});return mapPromise;}
function drawMarkers(){if(!map)return;markers.clearLayers();const groups=new Map();for(const v of visits){if(v.lat===null||$('#visit-club-filter').value!=='all'&&v.club!==$('#visit-club-filter').value)continue;const key=M.norm(v.venue);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v);}for(const group of groups.values()){const v=group[0],node=document.createElement('div');node.className='fx-map-popup';const b=document.createElement('b');b.textContent=v.venue;node.append(b,document.createElement('br'),document.createTextNode(group.length+'回訪問'));L.circleMarker([v.lat,v.lng],{radius:9,color:'#fff',weight:3,fillColor:v.club==='kumamoto'?'#b82030':'#e56b18',fillOpacity:1}).addTo(markers).bindPopup(node);}
 for(const s of stadiums){if(groups.has(M.norm(s.name)))continue;L.circleMarker([s.lat,s.lng],{radius:5,color:'#758395',weight:1,fillOpacity:.3}).addTo(markers).bindTooltip(s.name);}
 if(selectedPoint)L.circleMarker([selectedPoint.lat,selectedPoint.lng],{radius:11,color:'#135ed6',weight:3,fillOpacity:.2}).addTo(markers);
}
function renderVisits(){
 const filter=$('#visit-club-filter').value,rows=visits.filter(v=>filter==='all'||v.club===filter).sort((a,b)=>b.date.localeCompare(a.date));
 $('#visit-count').textContent=new Set(rows.map(v=>M.norm(v.venue))).size;$('#visit-total').textContent=rows.length;
 $('#visit-list').innerHTML=rows.map(v=>`<article class="fx-visit"><div class="fx-visit-meta"><time>${esc(v.date)}</time><span>${v.club==='niigata'?'新潟':v.club==='kumamoto'?'熊本':'その他'}</span></div><h3>${esc(v.venue)}</h3>${v.seat?`<p class="fx-caption">${esc(v.seat)}</p>`:''}${v.photo?`<img class="fx-visit-photo" src="${v.photo}" alt="${esc(v.venue)}の観戦写真" loading="lazy">`:''}${v.note?`<p class="fx-visit-note">${esc(v.note)}</p>`:''}<div class="fx-row"><button class="fx-button" data-edit-visit="${esc(v.id)}">編集</button>${v.lat!==null?`<button class="fx-button" data-map-visit="${esc(v.id)}">地図で見る</button>`:'<span class="fx-caption">位置未登録</span>'}</div></article>`).join('')||'<div class="fx-empty"><b>最初のスタジアムを記録しよう</b><p>訪れた日、座席、写真や思い出を残せます。</p></div>';
 const plans=app.schedule().filter(m=>localStorage.getItem('attend_'+window.TrappLeague.storageId(m))==='true'&&!visits.some(v=>v.matchKey===window.TrappLeague.storageId(m))).sort((a,b)=>b.date.localeCompare(a.date));
 $('#visit-plans').innerHTML=plans.slice(0,30).map(m=>`<button class="fx-plan" data-plan-key="${esc(window.TrappLeague.storageId(m))}"><span><time>${esc(m.date)}</time><b>${esc(m.venue||'会場未定')}</b><small>${m.club==='niigata'?'新潟':'熊本'} vs ${esc(m.opponent)}</small></span><span>${m.date<=today()?'記録する':'予定'} <span aria-hidden="true">↗</span></span></button>`).join('')||'<p class="fx-caption">試合詳細でチェックした観戦予定がここに表示されます。</p>';
 drawMarkers();
}
function editVisit(v={},match){
 editing=v.id||null;photo=v.photo||'';selectedPoint=v.lat!==undefined&&v.lat!==null?{lat:v.lat,lng:v.lng}:null;
 const f=$('#visit-form');f.reset();f.hidden=false;f.dataset.matchKey=v.matchKey||(match?window.TrappLeague.storageId(match):'');$('#visit-venue').value=v.venue||match?.venue||'';$('#visit-date').value=v.date||match?.date||today();$('#visit-date').max=today();$('#visit-club').value=v.club||match?.club||'niigata';$('#visit-seat').value=v.seat||'';$('#visit-note').value=v.note||'';$('#visit-delete').hidden=!editing;$('#visit-photo-preview').hidden=!photo;$('#visit-photo-preview').src=photo;$('#visit-photo-remove').hidden=!photo;
 const p=selectedPoint||venuePoint($('#visit-venue').value);$('#visit-lat').value=p?.lat??'';$('#visit-lng').value=p?.lng??'';if(p&&map)map.setView([p.lat,p.lng],14);status('');f.scrollIntoView({behavior:'auto',block:'start'});$('#visit-venue').focus({preventScroll:true});
}
async function openMap(){readVisits();try{stadiums=await json('./data/stadiums.json');}catch(_){stadiums=[];}const venues=[...new Set([...stadiums.map(s=>s.name),...app.schedule().map(m=>m.venue).filter(Boolean),...visits.map(v=>v.venue)])].sort((a,b)=>a.localeCompare(b,'ja'));$('#visit-venues').innerHTML=venues.map(v=>`<option value="${esc(v)}"></option>`).join('');renderVisits();await loadMap();if(map){map.invalidateSize();if(visits.some(v=>v.lat!==null))map.fitBounds(visits.filter(v=>v.lat!==null).map(v=>[v.lat,v.lng]),{padding:[35,35],maxZoom:13});}}
async function compress(file){if(file.size>20*1024*1024)throw Error('20MB以下の写真を選んでください。');if(!file.type.startsWith('image/'))throw Error('画像ファイルを選んでください。');const bitmap=await createImageBitmap(file),ratio=Math.min(1,1000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let quality=.78,result;do{result=canvas.toDataURL('image/jpeg',quality);quality-=.12;}while(result.length>380000&&quality>.15);if(result.length>400000)throw Error('写真が大きいため、別の写真を選んでください。');return result;}
function bind(api){app=api;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-feature]');if(b){e.preventDefault();e.stopPropagation();club=b.dataset.club||club;show(b.dataset.feature);}});
 $('#fx-analysis-club').onchange=e=>{club=e.target.value;$('#match-analysis-view').dataset.club=club;analysisUI.tab='overview';renderAnalysis();};
 $('#ma-analysis-back').onclick=()=>app.navigate('dashboard');
 $('#fx-analysis-opponent').onchange=e=>{selectedOpponents[club]=e.target.value;renderAnalysis();};
 for(const id of ['scope','location','recent'])$('#fx-analysis-'+id).onchange=()=>renderAnalysis();
 $('#visit-add').onclick=()=>editVisit();$('#visit-cancel').onclick=()=>{$('#visit-form').hidden=true;selectedPoint=null;drawMarkers();};$('#visit-club-filter').onchange=renderVisits;
 $('#visit-venue').onchange=()=>{const p=venuePoint($('#visit-venue').value);$('#visit-lat').value=p?.lat??'';$('#visit-lng').value=p?.lng??'';selectedPoint=p?{lat:p.lat,lng:p.lng}:null;if(p&&map)map.setView([p.lat,p.lng],14);drawMarkers();};
 $('#visit-position').onclick=()=>{$('#stadium-map-canvas').scrollIntoView({behavior:'auto',block:'center'});$('#map-network-status').textContent='地図を拡大して、スタジアムの位置をタップしてください。';};
 let photoTask=Promise.resolve();$('#visit-photo').onchange=e=>{const file=e.target.files[0];if(!file)return;$('#visit-save').disabled=true;photoTask=compress(file).then(value=>{photo=value;$('#visit-photo-preview').src=photo;$('#visit-photo-preview').hidden=false;$('#visit-photo-remove').hidden=false;}).catch(e=>status(e.message)).finally(()=>{$('#visit-save').disabled=false;});};
 $('#visit-photo-remove').onclick=()=>{photo='';$('#visit-photo').value='';$('#visit-photo-preview').hidden=true;$('#visit-photo-remove').hidden=true;};
 $('#visit-form').onsubmit=async e=>{e.preventDefault();await photoTask;const lat=$('#visit-lat').value,lng=$('#visit-lng').value;const v={id:editing||crypto.randomUUID(),venue:$('#visit-venue').value.trim(),date:$('#visit-date').value,club:$('#visit-club').value,seat:$('#visit-seat').value.trim(),note:$('#visit-note').value.trim(),photo,lat:lat===''?null:Number(lat),lng:lng===''?null:Number(lng),matchKey:$('#visit-form').dataset.matchKey||''};if(!M.validVisit(v)||v.date>today()){status('日付・スタジアム名・位置を確認してください。訪問日は今日以前の日付を指定できます。');return;}try{persist([...visits.filter(r=>r.id!==v.id),v]);$('#visit-form').hidden=true;selectedPoint=null;renderVisits();status('訪問を保存しました。');$('#visit-status').scrollIntoView({behavior:'auto',block:'center'});}catch(_){status('保存容量が足りません。写真を外すか、バックアップ後に古い記録を整理してください。');}};
 $('#visit-delete').onclick=()=>{if(!editing||!confirm('この訪問記録を削除しますか？'))return;try{persist(visits.filter(v=>v.id!==editing));$('#visit-form').hidden=true;selectedPoint=null;renderVisits();status('訪問記録を削除しました。');}catch(_){status('削除できませんでした。');}};
 $('#visit-list').onclick=e=>{const edit=e.target.closest('[data-edit-visit]'),loc=e.target.closest('[data-map-visit]');if(edit)editVisit(visits.find(v=>v.id===edit.dataset.editVisit));if(loc){const v=visits.find(v=>v.id===loc.dataset.mapVisit);if(map)map.setView([v.lat,v.lng],15);$('#stadium-map-canvas').scrollIntoView({behavior:'auto',block:'center'});}};
 $('#visit-plans').onclick=e=>{const b=e.target.closest('[data-plan-key]');if(!b)return;const m=app.schedule().find(m=>window.TrappLeague.storageId(m)===b.dataset.planKey);if(m.date>today())app.openMatch(m);else editVisit({},m);};
 window.addEventListener('storage',e=>{if(e.key===VISITS&&document.body.dataset.mode==='stadium-map'){readVisits();renderVisits();}});
}
window.TrappFeatures={bind,openForClub(value){club=value;selectedOpponents[club]='';analysisUI.tab='overview';show("match-analysis");},open(mode){if(mode==='match-analysis'){$('#fx-analysis-club').value=club;$('#match-analysis-view').dataset.club=club;renderAnalysis();}if(mode==='stadium-map')openMap();},validateVisits(raw){try{const v=JSON.parse(raw);return Array.isArray(v)&&v.every(M.validVisit)&&new Set(v.map(x=>x.id)).size===v.length;}catch(_){return false;}}};
})();
