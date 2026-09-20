/* Standings share the app chrome; compact and detailed rows use the same columns. */
(function (root) {
  'use strict';
  const columns = [['rank','順位'],['team','クラブ'],['points','勝点'],['played','試合'],['goal_diff','差']];
  const shorts = {omiya:'大宮',niigata:'新潟',sendai:'仙台',shonan:'湘南',tochigic:'栃木C',toyama:'富山',yokohamafc:'横浜FC',fujieda:'藤枝',iwata:'磐田',yamagata:'山形',akita:'秋田',tosu:'鳥栖',kofu:'甲府',tokushima:'徳島',hachinohe:'八戸',oita:'大分',iwaki:'いわき',miyazaki:'宮崎',sapporo:'札幌',imabari:'今治',kagoshima:'鹿児島',ehime:'愛媛',sagamihara:'相模原',gifu:'岐阜',fosaka:'FC大阪',ryukyu:'琉球',yamaguchi:'山口',tottori:'鳥取',kumamoto:'熊本',shiga:'滋賀',tochigi:'栃木SC',nagano:'長野',nara:'奈良',kanazawa:'金沢',kochi:'高知',fukushima:'福島',matsumoto:'松本',sanuki:'讃岐',kitakyushu:'北九州',gunma:'群馬'};
  const namedShorts = {'アルビレックス新潟':'新潟','ロアッソ熊本':'熊本','北海道コンサドーレ札幌':'札幌','RB大宮アルディージャ':'大宮','ブラウブリッツ秋田':'秋田','ベガルタ仙台':'仙台','湘南ベルマーレ':'湘南','モンテディオ山形':'山形','ヴァンフォーレ甲府':'甲府','ジュビロ磐田':'磐田','カターレ富山':'富山','徳島ヴォルティス':'徳島','大分トリニータ':'大分','サガン鳥栖':'鳥栖','ヴァンラーレ八戸':'八戸','テゲバジャーロ宮崎':'宮崎','鹿児島ユナイテッドFC':'鹿児島','レノファ山口FC':'山口','ガイナーレ鳥取':'鳥取','ツエーゲン金沢':'金沢','ギラヴァンツ北九州':'北九州','カマタマーレ讃岐':'讃岐','AC長野パルセイロ':'長野','松本山雅FC':'松本','福島ユナイテッドFC':'福島','レイラック滋賀FC':'滋賀','高知ユナイテッドSC':'高知'};
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  const value = v => number(v) === null ? '—' : String(Number(v));
  const diff = v => number(v) === null ? '—' : Number(v) > 0 ? `+${Number(v)}` : String(Number(v));
  const short = row => shorts[row.team_id] || namedShorts[row.team] || row.team;
  const club = row => row.team_id === 'niigata' || /新潟/.test(row.team) ? 'niigata' : row.team_id === 'kumamoto' || /熊本/.test(row.team) ? 'kumamoto' : '';
  const formCache = new Map();
  let league = 'j2', period = 'current', sort = {key:'rank',dir:1}, ticket = 0, expanded = false;
  let archiveCache;
  function recentForm(team, results, played) {
    const unique = new Map();
    for (const match of results || []) {
      if (match.status !== 'finished' || ![match.home,match.away].includes(team) || number(match.home_score) === null || number(match.away_score) === null) continue;
      unique.set(match.match_id || `${match.date}|${match.home}|${match.away}`,match);
    }
    let matches = [...unique.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.match_id || '').localeCompare(String(b.match_id || '')));
    // Results may already include a new round while the standings still show the previous round.
    if (number(played) !== null) matches = matches.slice(0,Math.max(0,Number(played)));
    return matches.slice(-5).map(m=>{
      const home = m.home === team;
      const own = Number(home ? m.home_score : m.away_score), opponent = Number(home ? m.away_score : m.home_score);
      return {result:own>opponent?'win':own<opponent?'loss':'draw',date:m.date,opponent:home?m.away:m.home,score:`${own} - ${opponent}`};
    });
  }
  function formMarkup(form) {
    if (!form.length) return '<span class="st-form-empty">結果未取得</span>';
    return `<span class="st-form" aria-label="直近${form.length}試合・左から古い順">${form.map(m=>{const label={win:'勝ち',draw:'引き分け',loss:'負け'}[m.result];return `<span class="st-result ${m.result}" role="img" aria-label="${esc(`${m.date} ${m.opponent} ${m.score} ${label}`)}" title="${esc(`${m.date} ${m.opponent} ${m.score} ${label}`)}">${{win:'勝',draw:'分',loss:'敗'}[m.result]}</span>`;}).join('')}</span>`;
  }
  function summary(rows, forms, getEmblem) {
    const own = rows.find(r=>club(r)===(league==='j2'?'niigata':'kumamoto'));
    if (!own) return '';
    const emblem = getEmblem?.(own.team), pts = rows.map(r=>number(r.points)).filter(v=>v!==null);
    const gap = number(own.points) === null || !pts.length ? null : Math.max(...pts)-Number(own.points);
    const label = number(own.rank) === 1 ? '首位' : gap === 0 ? '首位と同勝点' : gap === null ? '勝点差 —' : `首位と${gap}差`;
    const form = forms.get(own.team) || [];
    return `<section class="st-summary" data-club="${club(own)}" aria-label="${esc(own.team)}の順位"><span class="st-summary-light" aria-hidden="true"></span>${emblem?`<img class="st-watermark" src="${esc(emblem)}" alt="">`:''}<div class="st-summary-main">${emblem?`<img class="st-summary-crest" src="${esc(emblem)}" alt="${esc(own.team)}">`:''}<div class="st-summary-rank"><span>${esc(short(own))}</span><div><strong>${value(own.rank)}</strong><small>位</small></div></div><div class="st-summary-points"><span>勝点</span><strong>${value(own.points)}</strong></div><span class="st-summary-gap">${label}</span></div><div class="st-summary-form"><span class="st-form-label">${form.length?`直近${form.length}試合`:'直近の結果'}${form.length?'<small>右が最新</small>':''}</span>${formMarkup(form)}</div></section>`;
  }
  function tableMarkup(rows, forms, archive, getEmblem) {
    const sorted = [...rows].sort((a,b)=>sort.key==='team'?sort.dir*String(a.team).localeCompare(String(b.team),'ja'):sort.dir*((number(a[sort.key])??0)-(number(b[sort.key])??0)));
    const maxPoints = Math.max(1,...rows.map(r=>number(r.points)??0));
    return `<table class="st-table"><caption class="st-sr-only">${archive?'保存済み順位表':league.toUpperCase()+' 順位表'}</caption><colgroup><col class="st-col-rank"><col class="st-col-team"><col class="st-col-points"><col class="st-col-played"><col class="st-col-diff"></colgroup><thead><tr>${columns.map(([key,label])=>`<th scope="col" aria-sort="${sort.key===key?(sort.dir===1?'ascending':'descending'):'none'}"><button type="button" data-sort="${key}" aria-label="${label}で並べ替え">${label}${sort.key===key&&key!=='rank'?`<span aria-hidden="true">${sort.dir===1?'↑':'↓'}</span>`:''}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(row=>{
      const emblem = getEmblem?.(row.team), form=forms.get(row.team)||[];
      const details=`${value(row.won)}勝 ${archive?`${value(row.pk_won)}PK勝 ${value(row.pk_lost)}PK負`:`${value(row.drawn)}分`} ${value(row.lost)}敗`;
      return `<tr class="st-team-row ${club(row)?'st-own st-'+club(row):''}"><td class="st-rank">${value(row.rank)}</td><td class="st-team"><button type="button" class="st-team-link" data-team="${esc(row.team)}" title="${esc(row.team)}" aria-label="${esc(row.team)}の公式サイト">${emblem?`<img src="${esc(emblem)}" alt="" loading="lazy">`:''}<span>${esc(short(row))}</span></button><div class="st-detail" ${expanded?'':'hidden'}>${archive?'':`<div class="st-row-form" data-form-team="${esc(row.team)}">${formMarkup(form)}</div>`}<span class="st-record">${details}<span> · 得点${value(row.goals_for)} 失点${value(row.goals_against)}</span></span></div></td><td class="st-points"><strong style="--points-fill:${Math.max(0,Math.min(100,(number(row.points)??0)/maxPoints*100))}%">${value(row.points)}</strong></td><td class="st-number">${value(row.played)}</td><td class="st-number">${diff(row.goal_diff)}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  async function getForms(source) {
    const key = `${league}|${source?.fetchedAt || source?.timestamp || ''}`;
    if (!formCache.has(key)) {
      const selected = league;
      const promise = fetch(`./data/results/2026_2027/${selected}.json`).then(r=>{if(!r.ok)throw Error('results');return r.json();}).then(p=>Array.isArray(p.data)?p.data:[]).catch(()=>{formCache.delete(key);return [];});
      formCache.clear(); formCache.set(key,promise);
    }
    return formCache.get(key);
  }
  function render(container,payload,options={},focus='') {
    const currentTicket=++ticket;
    const archive=period==='archive';
    const draw=async()=>{
      let source=payload?.sources?.[league];
      if(archive){
        try { if(!archiveCache){const r=await fetch('./data/standings/archive/2026_hundred.json');if(!r.ok)throw Error('archive');archiveCache=await r.json();} source=archiveCache; }
        catch(_){source={data:[],error:'保存済みの順位表を読み込めませんでした。'};}
      }
      if(currentTicket!==ticket)return;
      const rows=Array.isArray(source?.data)?source.data:[], forms=new Map(),groups={};
      rows.forEach(r=>{(groups[archive?r.group||'保存済み順位表':'current'] ||= []).push(r);});
      container.dataset.club=league==='j2'?'niigata':'kumamoto';
      container.classList.toggle('st-expanded',expanded);
      const warning=archive?'百年構想リーグの保存分です。最終順位ではありません。':source?.stale?'更新できなかったため、保存済みの順位を表示しています。':source?.error?String(source.error):'';
      container.innerHTML=`<div class="st-controls"><label><span>大会</span><select id="standings-period"><option value="current" ${archive?'':'selected'}>2026/27 シーズン</option><option value="archive" ${archive?'selected':''}>2026 百年構想（保存分）</option></select></label><button type="button" class="st-refresh" id="standings-refresh" aria-label="順位表を更新" title="更新" ${archive?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 5v6h-6M20 11a8 8 0 1 0-2 7"/></svg></button></div>${archive?'':`<div class="st-leagues" role="group" aria-label="リーグ選択">${['j2','j3'].map(l=>`<button type="button" data-league="${l}" aria-pressed="${league===l}">${l.toUpperCase()}</button>`).join('')}</div><div class="st-summary-slot">${summary(rows,forms,options.getEmblem)}</div>`}<div class="st-table-toolbar"><h2>順位表</h2><div class="st-display" role="group" aria-label="順位表の表示"><button type="button" data-display="basic" aria-pressed="${!expanded}">基本</button><button type="button" data-display="detail" aria-pressed="${expanded}">詳細</button></div></div>${warning?`<p class="st-notice" role="status">${esc(warning)}</p>`:''}${Object.entries(groups).map(([name,list])=>`${archive?`<h3 class="st-group-heading">${esc(name)}</h3>`:''}${tableMarkup(list,forms,archive,options.getEmblem)}`).join('')||'<p class="st-empty" role="status">順位表を取得できませんでした。更新ボタンから再試行してください。</p>'}<p class="st-form-legend" ${expanded&&!archive?'':'hidden'}>直近の結果：勝＝勝ち　分＝引き分け　敗＝負け<br><span>左から古い順・同じリーグの試合のみ</span></p>`;
      container.querySelectorAll('[data-display]').forEach(button=>button.onclick=()=>{
        expanded=button.dataset.display==='detail';container.classList.toggle('st-expanded',expanded);
        container.querySelectorAll('[data-display]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.display==='detail')===expanded)));
        container.querySelectorAll('.st-detail').forEach(el=>el.hidden=!expanded);
        container.querySelector('.st-form-legend').hidden=!expanded||archive;
      });
      container.querySelector('#standings-period').onchange=e=>{period=e.target.value;sort={key:'rank',dir:1};render(container,payload,options,'#standings-period');};
      container.querySelectorAll('[data-league]').forEach(b=>b.onclick=()=>{league=b.dataset.league;sort={key:'rank',dir:1};render(container,payload,options,`[data-league="${league}"]`);});
      container.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.sort;sort={key,dir:key===sort.key?-sort.dir:key==='team'||key==='rank'?1:-1};render(container,payload,options,`[data-sort="${key}"]`);});
      container.querySelectorAll('[data-team]').forEach(b=>b.onclick=e=>root.openClubSite?.(b.dataset.team,e));
      container.querySelector('#standings-refresh').onclick=async e=>{
        const b=e.currentTarget;b.disabled=true;b.setAttribute('aria-label','順位表を更新中');b.classList.add('is-loading');formCache.clear();
        try { await options.onReload?.(); }
        catch (_) { if(b.isConnected){let notice=container.querySelector('.st-notice');if(!notice){notice=document.createElement('p');notice.className='st-notice';notice.setAttribute('role','status');container.querySelector('.st-table-toolbar').after(notice);}notice.textContent='更新できませんでした。通信状況をご確認ください。';} }
        finally { if(b.isConnected){b.disabled=false;b.classList.remove('is-loading');b.setAttribute('aria-label','順位表を更新');} }
      };
      if(focus)container.querySelector(focus)?.focus({preventScroll:true});
      if(!archive&&rows.length){
        const results=await getForms(source);
        if(currentTicket!==ticket||!container.isConnected)return;
        rows.forEach(row=>forms.set(row.team,recentForm(row.team,results,row.played)));
        container.querySelector('.st-summary-slot').innerHTML=summary(rows,forms,options.getEmblem);
        container.querySelectorAll('[data-form-team]').forEach(el=>el.innerHTML=formMarkup(forms.get(el.dataset.formTeam)||[]));
      }
    };
    void draw();
  }
  const api={render,recentForm,formMarkup,tableMarkup};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TrappStandings=api;
})(typeof window!=='undefined'?window:this);
