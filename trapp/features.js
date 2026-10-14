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
function metricRows(items){return items.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');}
function statCard(team,games,standings,recent){
 const s=M.metrics(games),row=standingFor(standings,team);
 return `<section class="fx-team-card"><div class="fx-team-heading"><img src="${esc(app.emblem(team)||'')}" alt="" width="44" height="44"><h2>${esc(team)}</h2></div><p class="fx-standing">${row?`${esc(row.league.toUpperCase())} <b>${row.rank}<small>位</small></b> <b>${row.points}<small>勝点</small></b>`:'順位データなし'}</p><div class="fx-form">${games.slice(0,recent).map(r=>`<span class="fx-result ${r.outcome}" title="${esc(r.date+' '+r.opponent+' '+r.gf+'−'+r.ga)}">${r.outcome}</span>`).join('')||'<span>記録なし</span>'}</div><p class="fx-caption">直近${Math.min(recent,games.length)}試合・左が最新</p><div class="fx-statline"><b>${s.W}<small>勝</small></b><b>${s.D}<small>分</small></b><b>${s.L}<small>敗</small></b></div><dl class="fx-metrics">${metricRows([['対象試合',s.played],['得点 / 失点',`${s.gf} / ${s.ga}`],['得失点差',s.played?(s.gd>0?'+':'')+s.gd:'—'],['平均得点',s.avgGF],['平均失点',s.avgGA],['勝率',s.winRate],['無失点',`${s.cleanSheets} / ${s.played}`],['無失点率',s.cleanSheetRate],['無得点',`${s.scoreless} / ${s.played}`],['両チーム得点率',s.bothScore],['連続無敗',s.played?s.unbeaten:'—'],['連勝',s.played?s.winning:'—']])}</dl></section>`;
}
function gameList(games){return games.map(r=>`<li><time>${esc(r.date)}</time><span class="fx-result ${r.outcome}">${r.outcome}</span><span>${esc(r.opponent)}<small>${r.homeSide?'HOME':'AWAY'} · ${esc(r.competition||window.TrappLeague.context(r).label||'公式戦')}</small></span><b>${r.gf} − ${r.ga}</b></li>`).join('')||'<li>該当する公式記録がありません。</li>';}
function comparisonTable(own,opp,rows){return `<div class="fx-table-scroll"><table class="fx-analysis-table"><thead><tr><th scope="col">指標</th><th scope="col">${esc(own)}</th><th scope="col">${esc(opp)}</th></tr></thead><tbody>${rows.map(([label,a,b])=>`<tr><th scope="row">${esc(label)}</th><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;}
function resultSummary(games){const s=M.metrics(games);return s.played?`${s.W}勝 ${s.D}分 ${s.L}敗`:'—';}
function recentComparison(name,opponent,own,opp,count){
 const a=M.metrics(own.slice(0,count)),b=M.metrics(opp.slice(0,count));
 return `<section class="fx-card"><h2>直近${count}試合の比較</h2>${comparisonTable(name,opponent,[['集計試合',a.played,b.played],['成績',resultSummary(own.slice(0,count)),resultSummary(opp.slice(0,count))],['平均得点',a.avgGF,b.avgGF],['平均失点',a.avgGA,b.avgGA],['勝率',a.winRate,b.winRate],['無失点率',a.cleanSheetRate,b.cleanSheetRate]])}</section>`;
}
function sideComparison(name,opponent,own,opp){return `<section class="fx-card"><h2>ホーム・アウェイ別成績</h2>${comparisonTable(name,opponent,['home','away'].flatMap(side=>{const a=own.filter(r=>r.homeSide===(side==='home')),b=opp.filter(r=>r.homeSide===(side==='home')),as=M.metrics(a),bs=M.metrics(b),label=side==='home'?'ホーム':'アウェイ';return [[label+'成績',resultSummary(a),resultSummary(b)],[label+'平均得点',as.avgGF,bs.avgGF],[label+'平均失点',as.avgGA,bs.avgGA]];}))}</section>`;}
function scorersCard(records,team,scope,before,side){
 const games=M.teamGames(records.filter(r=>inScope(r,scope)),team,before,side),goals=new Map();
 for(const r of games)for(const g of r[r.homeSide?'home_goals':'away_goals']||[]){const name=g.scorer||g.name;if(!name||g.own_goal||/オウンゴール/i.test(name))continue;const key=M.norm(name);const entry=goals.get(key)||{name,count:0};entry.count++;goals.set(key,entry);}
 const rows=[...goals.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ja')).slice(0,5);
 return `<section class="fx-card"><h2>${esc(team)}の得点者</h2>${rows.length?`<ol class="fx-scorers">${rows.map(r=>`<li><span>${esc(r.name)}</span><b>${r.count}<small>得点</small></b></li>`).join('')}</ol>`:'<p class="fx-caption">対象試合の得点者情報はありません。</p>'}<p class="fx-caption">詳しい公式記録がある${games.length}試合を集計。オウンゴールは除外。</p></section>`;
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
 const token=++request,host=$('#fx-analysis-content');host.innerHTML='<p class="fx-empty" role="status">対戦データを読み込んでいます…</p>';
 try{
  const [payloads,history,standingsPayloads,details]=await loadAnalysisData(force);
  if(token!==request)return;
  const schedule=app.schedule(),name=M.names[club],scope=$('#fx-analysis-scope').value,side=$('#fx-analysis-location').value,recent=Number($('#fx-analysis-recent').value);
  const allRows=M.unique([...app.results(),...payloads.flatMap(p=>p?.data||[])]),rows=allRows.filter(r=>r.date>=seasonStart&&window.TrappLeague.context(r).season===window.TrappLeague.SEASON);
  const historical=M.unique(history?.data||[]),standings=standingsPayloads.flatMap(p=>p?.data||[]),next=M.nextMatch(schedule,rows,club,today());
  populateOpponents(rows,historical,schedule,standings,next);
  const opponent=selectedOpponents[club]||next?.opponent;
  if(!opponent){host.innerHTML='<p class="fx-empty">対戦相手を選択してください。</p>';return;}
  const match=selectedOpponents[club]?schedule.filter(m=>m.club===club&&M.same(m.opponent,opponent)&&window.TrappLeague.context(m).season===window.TrappLeague.SEASON&&m.date>=today()&&!rows.some(r=>M.completed(r)&&String(r.match_id)===String(m.match_id))).sort((a,b)=>a.date.localeCompare(b.date))[0]:next;
  const tomorrow=new Date(new Date(today()+'T12:00:00+09:00').getTime()+86400000).toISOString().slice(0,10),before=match&&match.date<tomorrow?match.date:tomorrow;
  const selected=rows.filter(r=>inScope(r,scope)),ownAll=M.teamGames(selected,name,before),oppAll=M.teamGames(selected,opponent,before);
  const own=M.teamGames(selected,name,before,side),opp=M.teamGames(selected,opponent,before,side==='home'?'away':side==='away'?'home':'all');
  const h2h=M.teamGames(M.unique([...historical,...allRows]),name,before).filter(r=>M.same(r.opponent,opponent)&&inScope(r,scope)),h=M.stats(h2h);
  const dates=payloads.map(p=>p?.fetchedAt).filter(Boolean).sort(),currentDetails=(Array.isArray(details)?details:details?.data||[]).map(window.TrappVisionData.normalize).filter(r=>r.detail_complete!==false&&r.date>=seasonStart);
  const fixture=match?`<p>${esc(match.date)} ${esc(match.time||'時刻未定')} · ${app.isHome(match)?'HOME':'AWAY'}</p><p>${esc(match.venue||'会場未定')}</p><button type="button" class="fx-button" id="fx-open-match">試合詳細 <span aria-hidden="true">↗</span></button>`:'<p>任意の対戦相手との比較</p>';
  host.innerHTML=`<div class="fx-fixture" data-club="${club}"><span class="fx-eyebrow">${match?'UPCOMING MATCH':'TEAM COMPARISON'}</span><h2>${esc(name)}<span>vs</span>${esc(opponent)}</h2>${fixture}</div><p class="fx-caption">2026–27 ${scope==='league'?'リーグ戦':'公式戦'} ／ ${esc(before)}より前の終了済み記録${side==='all'?'':side==='home'?' ／ 自クラブはホーム・相手はアウェイ':' ／ 自クラブはアウェイ・相手はホーム'}。順位・勝点は最新のリーグ順位表。</p><div class="fx-comparison">${statCard(name,own,standings,recent)}${statCard(opponent,opp,standings,recent)}</div>${!opp.length?'<p class="fx-notice">相手の対象試合データがありません。過去対戦は下で確認できます。</p>':''}${recentComparison(name,opponent,own,opp,recent)}${sideComparison(name,opponent,ownAll,oppAll)}<section class="fx-card"><h2>直近の試合</h2><h3>${esc(name)}</h3><ul class="fx-games">${gameList(own.slice(0,recent))}</ul><h3>${esc(opponent)}</h3><ul class="fx-games">${gameList(opp.slice(0,recent))}</ul></section><section class="fx-card"><span class="fx-eyebrow">HEAD TO HEAD</span><h2>過去の対戦</h2><div class="fx-statline"><b>${h.W}<small>勝</small></b><b>${h.D}<small>分</small></b><b>${h.L}<small>敗</small></b></div><p class="fx-caption">${esc(name)}から見た収録済み${h.played}試合${h2h.length?' · '+esc(h2h.at(-1).date)+'〜'+esc(h2h[0].date):''}。PK戦は引き分けとして集計。</p><dl class="fx-metrics">${metricRows([['対戦時のホーム成績',resultSummary(h2h.filter(r=>r.homeSide))],['対戦時のアウェイ成績',resultSummary(h2h.filter(r=>!r.homeSide))],['対戦時の得点 / 失点',h.played?`${h.gf} / ${h.ga}`:'—']])}</dl><ul class="fx-games">${gameList(h2h.slice(0,20))}</ul>${!history?'<p class="fx-notice">過去の対戦記録を取得できません。現在のシーズンのみ表示しています。</p>':''}</section>${scorersCard(currentDetails,name,scope,before,side)}<p class="fx-caption">公式記録の確認: ${dates.length?esc(new Date(dates[0]).toLocaleString('ja-JP')):'日時不明'} · <a href="https://www.jleague.jp/" target="_blank" rel="noopener">J.LEAGUE</a></p><button class="fx-button" id="fx-retry">データを再取得</button>${payloads.some(p=>!p)?'<p class="fx-notice">一部の大会データを取得できませんでした。取得済みの範囲を表示しています。</p>':''}`;
  if(match)$('#fx-open-match').onclick=()=>app.openMatch(match);$('#fx-retry').onclick=()=>renderAnalysis(true);
 }catch(e){if(token!==request)return;host.innerHTML='<p class="fx-empty">データを読み込めませんでした。</p><button class="fx-button" id="fx-retry">再読み込み</button>';$('#fx-retry').onclick=()=>renderAnalysis(true);}
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
 $('#fx-analysis-club').onchange=e=>{club=e.target.value;renderAnalysis();};
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
window.TrappFeatures={bind,openForClub(value){club=value;selectedOpponents[club]='';show("match-analysis");},open(mode){if(mode==='match-analysis'){$('#fx-analysis-club').value=club;renderAnalysis();}if(mode==='stadium-map')openMap();},validateVisits(raw){try{const v=JSON.parse(raw);return Array.isArray(v)&&v.every(M.validVisit)&&new Set(v.map(x=>x.id)).size===v.length;}catch(_){return false;}}};
})();
