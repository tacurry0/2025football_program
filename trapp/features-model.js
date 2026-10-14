/* Pure, shared calculations for match previews and visit records. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrappFeaturesModel=api;})(typeof window==='object'?window:null,function(){
'use strict';
const names={niigata:'アルビレックス新潟',kumamoto:'ロアッソ熊本'};
const teamAliases={'RB大宮アルディージャ':'大宮アルディージャ','ザスパ草津':'ザスパ群馬','ザスパクサツ群馬':'ザスパ群馬','ジェフユナイテッド市原':'ジェフユナイテッド千葉','京都パープルサンガ':'京都サンガFC','ロッソ熊本':'ロアッソ熊本','FC琉球OKINAWA':'FC琉球'};
const norm=s=>{const name=String(s??'').normalize('NFKC').replace(/[\s・･.]/g,'');return teamAliases[name]||name;};
const same=(a,b)=>!!a&&!!b&&norm(a)===norm(b);
function completed(r){return r.status==='finished'&&r.home_score!==null&&r.away_score!==null&&r.home_score!==''&&r.away_score!==''&&Number.isFinite(Number(r.home_score))&&Number.isFinite(Number(r.away_score));}
function unique(rows){const out=new Map();for(const original of rows){const r={...original,date:String(original.date||'').replace(/\//g,'-')};const key=[r.date,norm(r.home),norm(r.away)].join('|');if(!out.has(key)||completed(r))out.set(key,{...out.get(key),...r});}return [...out.values()];}
function teamGames(rows,team,before='9999',side='all'){return unique(rows).filter(r=>completed(r)&&r.date<before&&(side!=='away'&&same(r.home,team)||side!=='home'&&same(r.away,team))).map(r=>{const home=same(r.home,team),gf=Number(home?r.home_score:r.away_score),ga=Number(home?r.away_score:r.home_score);return {...r,homeSide:home,gf,ga,opponent:home?r.away:r.home,outcome:gf>ga?'W':gf<ga?'L':'D'};}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.match_id).localeCompare(String(a.match_id)));}
function stats(games){return games.reduce((s,r)=>{s.played++;s[r.outcome]++;s.gf+=r.gf;s.ga+=r.ga;return s;},{played:0,W:0,D:0,L:0,gf:0,ga:0});}
function metrics(games){const s=stats(games),rate=n=>s.played?(100*n/s.played).toFixed(1)+'%':'—';return {...s,gd:s.gf-s.ga,avgGF:s.played?(s.gf/s.played).toFixed(2):'—',avgGA:s.played?(s.ga/s.played).toFixed(2):'—',ppg:s.played?((s.W*3+s.D)/s.played).toFixed(2):'—',winRate:rate(s.W),cleanSheets:games.filter(r=>r.ga===0).length,cleanSheetRate:rate(games.filter(r=>r.ga===0).length),scoreless:games.filter(r=>r.gf===0).length,bothScore:rate(games.filter(r=>r.gf>0&&r.ga>0).length),unbeaten:(games.findIndex(r=>r.outcome==='L')<0?games.length:games.findIndex(r=>r.outcome==='L')),winning:(games.findIndex(r=>r.outcome!=='W')<0?games.length:games.findIndex(r=>r.outcome!=='W'))};}
function headMinute(value){const m=String(value??'').replace(/['分\s]/g,'').match(/^(\d+)(?:\+(\d+))?$/);return m?{base:Number(m[1]),order:Number(m[1])+Number(m[2]||0)/1000}:null;}
function headGoals(game,team){return game[same(game.home,team)?'home_goals':'away_goals']||[];}
function headPlayers(games,team,kind='goals'){
 const players=new Map(),recordKey=r=>[r.date,norm(r.home),norm(r.away)].join('|');
 const get=name=>{const key=norm(name);if(!players.has(key))players.set(key,{name,goals:0,scored:new Set(),appearances:new Set(),starts:new Set()});return players.get(key);};
 let completeGoals=0,completePlayers=0,knownGoals=0;
 for(const r of games){
  const side=same(r.home,team)?'home':'away',key=recordKey(r);
  if(r[side+'_goals_complete'])completeGoals++;
  if(r[side+'_players_complete'])completePlayers++;
  for(const member of r[side+'_players']||[]){const name=Array.isArray(member)?member[0]:member.name;if(!name)continue;const p=get(name);p.appearances.add(key);if(Array.isArray(member)?member[1]:member.starter)p.starts.add(key);}
  for(const goal of headGoals(r,team)){const name=goal.name||goal.scorer;if(!name||goal.own_goal||goal.is_own_goal||/オウンゴール/.test(name))continue;const p=get(name);p.goals++;p.scored.add(key);knownGoals++;}
 }
 const rows=[...players.values()].map(p=>({...p,scored:p.scored.size,appearances:p.appearances.size,starts:p.starts.size})).filter(p=>kind==='goals'?p.goals>0:p.appearances>0).sort((a,b)=>(kind==='goals'?b.goals-a.goals:b.appearances-a.appearances)||b.goals-a.goals||a.name.localeCompare(b.name,'ja'));
 let previous=null,rank=0;rows.forEach((p,index)=>{const value=kind==='goals'?p.goals:p.appearances;if(value!==previous){rank=index+1;previous=value;}p.rank=rank;});
 return {rows,completeGoals,completePlayers,knownGoals};
}
function headSummary(games){
 const s=metrics(games),home=metrics(games.filter(r=>r.homeSide)),away=metrics(games.filter(r=>!r.homeSide));
 const bestWin=games.filter(r=>r.outcome==='W').sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga)||b.date.localeCompare(a.date))[0]||null;
 const worstLoss=games.filter(r=>r.outcome==='L').sort((a,b)=>(b.ga-b.gf)-(a.ga-a.gf)||b.date.localeCompare(a.date))[0]||null;
 const firstScored=[],firstConceded=[];
 for(const r of games){
  if(!r.home_goals_complete||!r.away_goals_complete||r.gf+r.ga===0)continue;
  const ownSide=r.homeSide?'home':'away',events=['home','away'].flatMap(side=>(r[side+'_goals']||[]).map(g=>({side,time:headMinute(g.minute||g.time)})));
  if(!events.length||events.some(g=>!g.time))continue;
  events.sort((a,b)=>a.time.order-b.time.order);
  if(events[1]&&events[0].time.order===events[1].time.order&&events[0].side!==events[1].side)continue;
  (events[0].side===ownSide?firstScored:firstConceded).push(r);
 }
 const seasons=new Map();
 for(const r of games){let season=r.season_id||r.season||r.date.slice(0,4);if(r.date>='2026-07-01'&&!String(season).includes('_')){const year=Number(r.date.slice(0,4))-(Number(r.date.slice(5,7))<7);season=year+'_'+(year+1);}if(!seasons.has(season))seasons.set(season,[]);seasons.get(season).push(r);}
 return {...s,home,away,bestWin,worstLoss,firstScored:metrics(firstScored),firstConceded:metrics(firstConceded),comebackWins:firstConceded.filter(r=>r.outcome==='W').length,multiGoal:games.filter(r=>r.gf>=2).length,seasons:[...seasons].sort((a,b)=>String(b[0]).localeCompare(String(a[0]))).map(([season,rows])=>({season,...metrics(rows)}))};
}
function headTiming(games,team){
 const bins=[0,0,0,0,0,0,0];let known=0,total=0;
 for(const r of games){const side=same(r.home,team)?'home':'away';total+=Number(r[side+'_score'])||0;for(const g of headGoals(r,team)){const minute=headMinute(g.minute||g.time);if(!minute)continue;const index=minute.base>90?6:Math.max(0,Math.ceil(minute.base/15)-1);bins[index]++;known++;}}
 return {bins,known,total,labels:['1–15','16–30','31–45+','46–60','61–75','76–90+','延長']};
}
function nextMatch(schedule,results,club,today){return schedule.filter(m=>m.club===club&&m.date>=today&&!results.some(r=>completed(r)&&(m.match_id&&String(r.match_id)===String(m.match_id)||r.date===m.date&&(same(r.home,names[club])&&same(r.away,m.opponent)||same(r.away,names[club])&&same(r.home,m.opponent))))).sort((a,b)=>(a.date+' '+(a.time||'')).localeCompare(b.date+' '+(b.time||'')))[0]||null;}
function validVisit(v){return !!v&&Number.isFinite(Date.parse(v.date))&&new Date(v.date).toISOString().slice(0,10)===v.date&&typeof v.id==='string'&&typeof v.venue==='string'&&v.venue.trim().length>0&&v.venue.length<=200&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)&&['niigata','kumamoto','other'].includes(v.club)&&typeof v.note==='string'&&v.note.length<=3000&&typeof v.seat==='string'&&v.seat.length<=100&&(!v.photo||/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.photo)&&v.photo.length<=400000)&&(v.lat===null&&v.lng===null||Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180);}
return {names,norm,same,completed,unique,teamGames,stats,metrics,headSummary,headPlayers,headTiming,nextMatch,validVisit};
});
