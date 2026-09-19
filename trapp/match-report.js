/* Match report presentation; shared pure renderers keep home/away rows aligned. */
(function(root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list = value => Array.isArray(value) ? value : [];
  const cleanName = value => String(value || '').normalize('NFKC').replace(/[\s・･]/g, '');
  const minute = value => String(value ?? '').replace(/[’′'分\s]/g, '');
  const minuteOrder = value => { const parts = minute(value).split('+').map(Number); return Number.isFinite(parts[0]) ? parts[0] + (parts[1] || 0) / 100 : 1000; };
  const stamp = value => minute(value) ? `${esc(minute(value))}′` : '';
  const names = { 'ロアッソ熊本':'熊本', 'アルビレックス新潟':'新潟', '大分トリニータ':'大分' };
  const emblem = (url, name, className = '') => url ? `<img class="${className}" src="${esc(url)}" alt="${esc(name)}" loading="eager">` : `<span class="report-emblem-placeholder ${className}">${esc(String(name).slice(0,2))}</span>`;
  const icon = (kind, label = '') => `<span class="report-event-icon ${kind}" role="img" aria-label="${esc(label || ({goal:'得点',in:'途中出場',out:'途中交代',sub:'交代',yellow:'警告',red:'退場'}[kind] || kind))}">${({goal:'⚽',in:'↑',out:'↓',sub:'⇄',yellow:'',red:''}[kind] || '')}</span>`;
  const cloud = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 18h12a4 4 0 0 0 .5-8A6 6 0 0 0 7 8a5 5 0 0 0-1 10Z"/></svg>';
  const people = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="6" r="3"/><path d="M6 21v-5a6 6 0 0 1 12 0v5ZM3 10a3 3 0 1 0 0-6m18 6a3 3 0 1 1 0-6M2 21v-6a3 3 0 0 1 3-3m17 9v-6a3 3 0 0 0-3-3"/></svg>';
  const drop = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 2S5 11 5 15a7 7 0 0 0 14 0c0-4-7-13-7-13Z"/></svg>';
  function sides(m) {
    const ownHome = m.ownHome;
    return ['home','away'].map((side, index) => {
      const own = index === 0 ? ownHome : !ownHome;
      return {side, own, name:m[side] || '', short:names[m[side]] || m[side] || '', emblem:m[`${side}_emblem`],
        starters:list(m[`${side}_starting_members`] || (own ? m.starting_members : m.opponent_starting_members)),
        bench:list(m[`${side}_bench_members`] || (own ? m.bench_members : m.opponent_bench_members)),
        goals:list(m[`${side}_goals`] || (own ? m.goals : m.opponent_goals)),
        substitutions:list(m[`${side}_substitutions`] || (own ? m.substitutions : m.opponent_substitutions)),
        cards:list(m[`${side}_cards`] || (own ? m.warnings : m.opponent_cards)),
        manager:m[`${side}_manager`] || (own ? m.manager : m.opponent_manager) || ''};
    });
  }
  function events(m) {
    const entries = sides(m).flatMap(team => [
      ...team.goals.map(item => ({...item,kind:'goal',team})),
      ...team.substitutions.map(item => ({...item,kind:'sub',team})),
      ...team.cards.map(item => ({...item,minute:item.minute ?? item.time,kind:item.card === 'red' ? 'red' : 'yellow',team}))
    ]).sort((a,b) => minuteOrder(a.minute) - minuteOrder(b.minute));
    let home = 0, away = 0;
    // Show running scores only when the goal list accounts for the final score.
    const teams = sides(m);
    const completeGoals = teams.every(t => m[`${t.side}_score`] !== null && m[`${t.side}_score`] !== undefined && Number(m[`${t.side}_score`]) === t.goals.length);
    return entries.map(event => {
      if(event.kind === 'goal') { if(event.team.side === 'home')home++;else away++; }
      return {...event,score:event.kind === 'goal' && completeGoals ? `${home} - ${away}` : ''};
    });
  }
  function timeline(m, preview = false) {
    const all = events(m), rows = preview ? all.slice(0,4) : all;
    return `<section class="report-timeline-section"><div class="report-section-heading"><h3>試合経過</h3>${preview && all.length ? '<button type="button" data-report-all-events>すべて見る <span aria-hidden="true">→</span></button>' : ''}</div>${rows.length ? `<ol class="report-timeline">${rows.map(event => `<li class="${event.team.own ? 'own' : 'opponent'}"><time>${stamp(event.minute)}</time><span class="report-timeline-dot" aria-hidden="true"></span>${emblem(event.team.emblem,event.team.name,'report-event-emblem')}${icon(event.kind)}<div class="report-event-text">${event.kind === 'goal' ? `${esc(event.scorer || event.player || event.team.short+'の得点')}${event.own_goal ? ' <small>オウンゴール</small>' : ''}` : event.kind === 'sub' ? `${esc(event.out || '—')} <span class="report-sub-arrow">→</span> ${esc(event.in || '—')}` : `${esc(event.player || event.name || event.team.short)}<small>${event.kind === 'red' ? '退場' : '警告'}</small>`}</div>${event.score ? `<strong class="report-running-score">${event.score}</strong>` : ''}</li>`).join('')}</ol>` : '<p class="report-empty">試合経過はまだ取得できていません。</p>'}</section>`;
  }
  function conditions(m) {
    const has = v => v !== undefined && v !== null && v !== '';
    const attendance = has(m.attendance) ? Number(String(m.attendance).replace(/,/g,'')) : null;
    if(![m.weather,m.temperature,m.humidity,m.attendance].some(has))return '';
    return `<section class="report-conditions" aria-label="試合当日の天候と入場者数"><div>${has(m.weather)||has(m.temperature) ? `<p>${cloud}<span>${esc(m.weather || '気温')}</span>${has(m.temperature) ? `<strong>${esc(m.temperature)}<small>℃</small></strong>` : ''}</p>` : ''}${has(m.humidity) ? `<p>${drop}<span>湿度</span><strong>${esc(m.humidity)}<small>%</small></strong></p>` : ''}</div>${has(m.attendance) ? `<div><p>${people}<span>入場者</span><strong>${esc(Number.isFinite(attendance) ? attendance.toLocaleString('ja-JP') : m.attendance)}<small>人</small></strong></p></div>` : ''}</section>`;
  }
  function officials(m) {
    const refs = m.referees || {};
    const text = v => Array.isArray(v) ? v.join(' / ') : v;
    const varPair = String(text(refs['VAR／AVAR'] || refs['VAR/AVAR'] || refs.var_avar) || '').split(/[、,／/]/).map(v=>v.trim());
    const rows = [
      ['主審',m.referee || refs['主審']],
      ['副審',m.assistant_referees || refs['副審']],
      ['第4の審判員',m.fourth_official || refs['第4の審判員']],
      ['VAR',m.var_referee || refs.VAR || varPair[0]],
      ['AVAR',m.avar_referee || refs.AVAR || varPair[1]]
    ].filter(([,value])=>text(value));
    const url = m.j_official_url || m.source_url || '';
    const link = /^https?:\/\//i.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">公式記録 <span aria-hidden="true">↗</span></a>` : '';
    return `<div class="report-officials"><dl>${rows.length ? rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(text(value))}</dd></div>`).join('') : '<div><dt>審判</dt><dd class="report-unavailable">未取得</dd></div>'}</dl>${link}</div>`;
  }
  // One observer set per open sheet; refreshes also cover async records and font loading.
  let disposeMembers = null;
  function mountMembers(container) {
    if (disposeMembers) disposeMembers();
    const panel = container.querySelector('#detail-panel-members');
    const toggle = panel.querySelector('[data-member-details]');
    let frame = 0, disposed = false;
    const measure = () => {
      frame = 0;
      if (disposed || !panel.isConnected || panel.hidden) return;
      panel.querySelectorAll('.report-name-text').forEach(name => {
        const viewport = name.parentElement;
        const distance = panel.dataset.details === 'off' ? Math.max(0, name.scrollWidth - viewport.clientWidth) : 0;
        name.style.setProperty('--name-distance', `${-distance}px`);
        name.style.setProperty('--name-duration', `${Math.max(7, distance / 18 + 4)}s`);
        name.classList.toggle('is-overflowing', distance > 1);
      });
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure); };
    toggle.onclick = () => {
      const enabled = panel.dataset.details !== 'on';
      panel.dataset.details = enabled ? 'on' : 'off';
      toggle.setAttribute('aria-checked', String(enabled));
      toggle.querySelector('strong').textContent = enabled ? 'ON' : 'OFF';
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(panel);
    const changes = new MutationObserver(schedule);
    changes.observe(panel.querySelector('#official-members-content'), {childList:true,subtree:true});
    document.fonts?.ready.then(schedule);
    schedule();
    disposeMembers = () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); changes.disconnect(); };
  }
  function playerEvents(team, name) {
    const same = n => cleanName(n) === cleanName(name);
    return [
      ...team.goals.filter(g=>same(g.scorer || g.player)).map(g=>({kind:'goal',minute:g.minute})),
      ...team.substitutions.filter(s=>same(s.out)).map(s=>({kind:'out',minute:s.minute})),
      ...team.substitutions.filter(s=>same(s.in)).map(s=>({kind:'in',minute:s.minute})),
      ...team.cards.filter(c=>same(c.player || c.name)).map(c=>({kind:c.card==='red'?'red':'yellow',minute:c.minute ?? c.time}))
    ].sort((a,b)=>minuteOrder(a.minute)-minuteOrder(b.minute));
  }
  function memberCell(member, team) {
    if(!member)return '<td class="report-player-cell empty"><span aria-label="登録なし">—</span></td>';
    const name = typeof member === 'string' ? member : member.name || '';
    const player = team.own ? `<button type="button" class="u-player-link" data-player="${esc(name)}"><span class="report-name-text">${esc(name)}</span></button>` : `<span class="u-member-static"><span class="report-name-text">${esc(name)}</span></span>`;
    return `<td class="report-player-cell"><div class="report-player"><span class="report-position">${esc(member.position || '')}</span><strong class="report-number">${esc(member.number ?? '')}</strong><div class="report-player-name">${player}<span class="report-player-events">${playerEvents(team,name).map(event=>`<span>${icon(event.kind)}<time>${stamp(event.minute)}</time></span>`).join('')}</span></div></div></td>`;
  }
  function members(m) {
    const teams = sides(m);
    if(!teams.some(t=>t.starters.length || t.bench.length))return '<p class="report-empty">出場選手はまだ取得できていません。</p>';
    return `<section class="report-members"><table class="report-lineups"><thead><tr>${teams.map(team=>`<th scope="col" class="${team.own?'own':'opponent'}"><div>${emblem(team.emblem,team.name)}<span><strong>${esc(team.short)}</strong><small>${team.side.toUpperCase()}</small></span></div></th>`).join('')}</tr></thead>${[['先発','starters'],['控え','bench']].map(([label,key])=>`<tbody><tr class="report-lineup-label"><th colspan="2" scope="colgroup">${label}</th></tr>${Array.from({length:Math.max(...teams.map(t=>t[key].length))},(_,i)=>`<tr>${teams.map(t=>memberCell(t[key][i],t)).join('')}</tr>`).join('')}</tbody>`).join('')}<tfoot><tr>${teams.map(t=>`<td><span>監督</span> <strong>${esc(t.manager || '—')}</strong></td>`).join('')}</tr></tfoot></table><div class="report-legend">${icon('goal')} 得点 ${icon('in')}${icon('out')} 交代 ${icon('yellow')} 警告 ${icon('red')} 退場</div></section>`;
  }
  function header(m) {
    const teams = sides(m);
    const date = String(m.date || '').replace(/-/g,'.');
    return `<header class="report-hero">${m.ownHome ? emblem(m.home_emblem,"","report-watermark") : emblem(m.away_emblem,"","report-watermark")}<div class="report-title"><h2>試合詳細</h2><button type="button" id="detail-sheet-close" aria-label="試合詳細を閉じる">×</button></div><div class="report-competition">${esc(m.competitionLabel)} <span>${esc(m.roundLabel)}</span></div><div class="report-scoreboard">${teamHero(teams[0])}<div class="report-scorebox"><div class="match-detail-score"><strong>${esc(m.home_score ?? '—')}</strong><span>:</span><strong>${esc(m.away_score ?? '—')}</strong></div><small class="match-detail-pk" ${m.pkLabel?'':'hidden'}>${esc(m.pkLabel)}</small></div>${teamHero(teams[1])}</div><div class="report-match-meta"><span class="report-compact-round">${esc(m.roundLabel)} · </span><time>${esc(date)}${m.day ? ' '+esc(m.day) : ''}　${esc(m.time || '')}</time><strong>${esc(m.venue || '会場未定')}</strong></div></header>`;
  }
  function teamHero(team) {return `<div class="report-hero-team">${emblem(team.emblem,team.name)}<small>${team.side.toUpperCase()}</small><strong>${esc(team.name)}</strong></div>`;}
  const api = {sides,events,timeline,conditions,officials,members,header,mountMembers};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.TrappMatchReport=api;
})(typeof window!=='undefined' ? window : this);
