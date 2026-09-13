/* Pure, shared calculations for match previews and visit records. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrappFeaturesModel=api;})(typeof window==='object'?window:null,function(){
'use strict';
const names={niigata:'アルビレックス新潟',kumamoto:'ロアッソ熊本'};
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s・･.]/g,'').replace(/^RB大宮アルディージャ$/,'大宮アルディージャ');
const same=(a,b)=>!!a&&!!b&&norm(a)===norm(b);
function completed(r){return r.status==='finished'&&r.home_score!==null&&r.away_score!==null&&r.home_score!==''&&r.away_score!==''&&Number.isFinite(Number(r.home_score))&&Number.isFinite(Number(r.away_score));}
function unique(rows){const out=new Map();for(const r of rows){const key=[r.date,norm(r.home),norm(r.away)].join('|');if(!out.has(key)||completed(r))out.set(key,r);}return [...out.values()];}
function teamGames(rows,team,before='9999',side='all'){return unique(rows).filter(r=>completed(r)&&r.date<before&&(side!=='away'&&same(r.home,team)||side!=='home'&&same(r.away,team))).map(r=>{const home=same(r.home,team),gf=Number(home?r.home_score:r.away_score),ga=Number(home?r.away_score:r.home_score);return {...r,homeSide:home,gf,ga,opponent:home?r.away:r.home,outcome:gf>ga?'W':gf<ga?'L':'D'};}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.match_id).localeCompare(String(a.match_id)));}
function stats(games){return games.reduce((s,r)=>{s.played++;s[r.outcome]++;s.gf+=r.gf;s.ga+=r.ga;return s;},{played:0,W:0,D:0,L:0,gf:0,ga:0});}
function nextMatch(schedule,results,club,today){return schedule.filter(m=>m.club===club&&m.date>=today&&!results.some(r=>completed(r)&&(m.match_id&&String(r.match_id)===String(m.match_id)||r.date===m.date&&(same(r.home,names[club])&&same(r.away,m.opponent)||same(r.away,names[club])&&same(r.home,m.opponent))))).sort((a,b)=>(a.date+' '+(a.time||'')).localeCompare(b.date+' '+(b.time||'')))[0]||null;}
function validVisit(v){return !!v&&Number.isFinite(Date.parse(v.date))&&new Date(v.date).toISOString().slice(0,10)===v.date&&typeof v.id==='string'&&typeof v.venue==='string'&&v.venue.trim().length>0&&v.venue.length<=200&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)&&['niigata','kumamoto','other'].includes(v.club)&&typeof v.note==='string'&&v.note.length<=3000&&typeof v.seat==='string'&&v.seat.length<=100&&(!v.photo||/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.photo)&&v.photo.length<=400000)&&(v.lat===null&&v.lng===null||Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180);}
return {names,norm,same,completed,unique,teamGames,stats,nextMatch,validVisit};
});
