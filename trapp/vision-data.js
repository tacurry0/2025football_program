/* Adapt historical records and current-season details to the same vision data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TrappVisionData=api;})(typeof window==='object'?window:null,function(){
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const names = value => Array.isArray(value) ? value : String(value || '').split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
  const score = value => value === null || value === undefined || value === '' || !/^\d+$/.test(String(value)) ? null : Number(value);
  function substitutions(value){
    const rows=list(value),out=[];
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(r.out||r.outName){out.push({minute:r.minute||r.time||'',out:r.out||r.outName,in:r.in||r.inName||''});continue;}
      if(r.in_out==='▽'){
        const incoming=rows[i+1];
        if(incoming?.in_out==='▲'){out.push({minute:r.time||r.minute||'',out:r.name,in:incoming.name});i++;}
      }
    }
    return out;
  }
  function normalize(row={}){
    const home=row.home||row.home_team||'',away=row.away||row.away_team||'';
    const own=row.club==='kumamoto'?'ロアッソ熊本':row.club==='niigata'?'アルビレックス新潟':'';
    const ownHome=own ? home===own : row.home_away==='H';
    const details=side=>row[side+'_details']||{};
    const pick=(side,key,legacy)=>list(row[side+'_'+key]).length?row[side+'_'+key]:list(details(side)[legacy]);
    const refs=row.referees||{};
    const result={...row,home,away,home_team:home,away_team:away,date:String(row.date||'').replace(/\//g,'-'),
      match_id:String(row.match_id||row.match_card_id||''),time:row.time||row.kickoff||'',venue:row.venue||row.stadium||'',
      source_url:row.source_url||row.j_official_url||row.url||'',season:row.season_id||row.season,
      home_score:score(row.home_score),away_score:score(row.away_score),
      status:row.status || (score(row.home_score)!==null && score(row.away_score)!==null?'finished':'scheduled'),
      referee:row.referee||refs['主審']||'',assistant_referees:names(row.assistant_referees||refs['副審']),
      fourth_official:row.fourth_official||refs['第4の審判員']||'',
      var_referee:row.var_referee||String(refs['VAR／AVAR']||'').split(/[／/]/)[0]||'',
      avar_referee:row.avar_referee||String(refs['VAR／AVAR']||'').split(/[／/]/)[1]||''};
    if(own&&home&&away)result.home_away=ownHome?'H':'A';
    for(const side of ['home','away']){
      const legacyOwn=side==='home'?ownHome:!ownHome;
      result[side+'_starting_members']=pick(side,'starting_members','starting');
      result[side+'_bench_members']=pick(side,'bench_members','substitutes');
      if(!result[side+'_starting_members'].length)result[side+'_starting_members']=list(row[legacyOwn?'starting_members':'opponent_starting_members']);
      if(!result[side+'_bench_members'].length)result[side+'_bench_members']=list(row[legacyOwn?'bench_members':'opponent_bench_members']);
      result[side+'_substitutions']=substitutions(pick(side,'substitutions','substitutions').length?pick(side,'substitutions','substitutions'):row[legacyOwn?'substitutions':'opponent_substitutions']);
      const cards=pick(side,'cards','cards');
      result[side+'_cards']=(cards.length?cards:list(row[legacyOwn?'warnings':'opponent_cards'])).map(c=>({player:c.player||c.name||'',minute:c.minute||c.time||'',card:/red|退場/i.test(c.card||c.type||'')?'red':'yellow'}));
      const goals=list(row[side+'_goals']);
      result[side+'_goals']=(goals.length?goals:list(row[legacyOwn?'goals':'opponent_goals'])).map(g=>({...g,scorer:g.scorer||g.name||g.player||'',name:g.scorer||g.name||g.player||'',minute:g.minute||g.time||'',time:g.minute||g.time||''}));
    }
    return result;
  }
  function halves(goals,total){
    const rows=list(goals),known=score(total);
    if(known===null)return {first:'',second:'',total:''};
    if(known===0)return {first:'0',second:'0',total:'0'};
    const minutes=rows.map(g=>parseInt(g.minute||g.time,10));
    if(rows.length!==known||minutes.some(m=>!Number.isFinite(m)))return {first:'',second:'',total:String(known)};
    const first=minutes.filter(m=>m<=45).length;
    return {first:String(first),second:String(known-first),total:String(known)};
  }
  function toHistory(row){
    const r=normalize(row),refs={...(r.referees||{}),'主審':r.referee,'副審':r.assistant_referees.join('、'),'第4の審判員':r.fourth_official,'VAR／AVAR':[r.var_referee,r.avar_referee].join('／')};
    const record={...r,kickoff:r.time,stadium:r.venue,url:r.source_url,referees:refs};
    for(const side of ['home','away'])record[side+'_details']={...(r[side+'_details']||{}),starting:r[side+'_starting_members'],substitutes:r[side+'_bench_members'],
      cards:r[side+'_cards'].map(c=>({name:c.player,time:c.minute,type:c.card==='red'?'退場':'警告'})),
      substitutions:r[side+'_substitutions'].flatMap(s=>[{name:s.out,time:s.minute,in_out:'▽'},{name:s.in,time:s.minute,in_out:'▲'}])};
    return record;
  }
  return {normalize,toHistory,halves};
});
