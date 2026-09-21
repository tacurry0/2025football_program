/* Player detail presentation and a disposable shirt-number rotation. */
(function(root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function numbers(value) {
    const items = Array.isArray(value) ? value : String(value ?? '').split(/[、,\/]/);
    return [...new Set(items.map(v=>String(v ?? '').trim()).filter(v=>/^\d+$/.test(v)))];
  }
  function numberPlan(scopes, period) {
    const scope = scopes.find(s=>s.key === period);
    const values = numbers(scope?.numbers);
    return {values:values.length ? values : ['—'], rotate:!!scope?.rotate && values.length > 1};
  }
  function cycle(plan, show, clock = root) {
    let index=0;
    show(plan.values[0]);
    const timer=plan.rotate ? clock.setInterval(()=>{index=(index+1)%plan.values.length;show(plan.values[index]);},5000) : null;
    return ()=>{if(timer !== null)clock.clearInterval(timer);};
  }
  function shell({name,english,position,photo,emblem,club,scopes,period,body}) {
    const plan=numberPlan(scopes,period);
    return `<div class="pv-shell" data-player-profile data-club="${esc(club)}" data-pv-scopes="${esc(JSON.stringify(scopes))}" data-pv-period="${esc(period)}">
      <header class="pv-hero"><span class="pv-handle" aria-hidden="true"></span><div class="pv-top"><span>選手詳細</span><button type="button" class="pv-close" data-pa-modal-close aria-label="選手詳細を閉じる">×</button></div>
      <img class="pv-watermark" src="${esc(emblem)}" alt=""><div class="pv-photo">${photo}</div>
      <div class="pv-identity"><div class="pv-shirt"><strong data-pv-number aria-label="背番号 ${esc(plan.values[0])}">${esc(plan.values[0])}</strong><span>${esc(position)}</span></div><div class="pv-name"><h2>${esc(name)}</h2><p>${esc(english)}</p></div></div>
      <button type="button" class="pv-card-button" data-pa-player-card aria-label="選手カードを作成" title="選手カードを作成"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="5" width="15" height="17" rx="2"/><path d="M3 17V4a2 2 0 0 1 2-2h11M9 16h7M9 19h5"/><circle cx="12.5" cy="10.5" r="2"/></svg></button></header>
      <div class="pa-modal-body pv-body">${body}</div></div>`;
  }
  function mount(modal, onPeriod) {
    const shell=modal.querySelector('[data-player-profile]');
    if(!shell)return ()=>{};
    const scopes=JSON.parse(shell.dataset.pvScopes),select=shell.querySelector('[data-pv-period-select]');
    const body=shell.querySelector('.pv-body'),number=shell.querySelector('[data-pv-number]');
    let stopCycle=()=>{},disposed=false,scrolled=false;
    function restart() {
      stopCycle();
      const plan=numberPlan(scopes,shell.dataset.pvPeriod);
      // No timer runs behind a hidden document or a dismissed sheet.
      if(document.hidden || !modal.classList.contains('active'))return;
      stopCycle=cycle(plan,value=>{
        if(!modal.isConnected || !modal.classList.contains('active')){dispose();return;}
        number.textContent=value;number.setAttribute('aria-label',`背番号 ${value}`);
      });
    }
    function sync() {
      const tab=shell.querySelector('.pa-profile-tab[aria-selected="true"]')?.dataset.paProfileTab || 'profile';
      shell.dataset.tab=tab;
      if(tab==='yearly' && !/^year:/.test(select.value)) {
        const year=scopes.find(s=>s.key.startsWith('year:'));
        if(year){select.value=year.key;shell.dataset.pvPeriod=year.key;onPeriod?.(year.key);restart();}
      }
      shell.querySelectorAll('[data-pv-stats]').forEach(el=>el.hidden=el.dataset.pvStats!==shell.dataset.pvPeriod);
      shell.querySelectorAll('[data-pv-year-card]').forEach(el=>el.classList.toggle('is-selected',`year:${el.dataset.pvYearCard}`===shell.dataset.pvPeriod));
      const filters=shell.querySelector('[data-pa-stats-controls]');if(filters)filters.hidden=tab!=='total';
      const picker=shell.querySelector('.pv-period-controls');if(picker)picker.hidden=tab==='profile';
      shell.classList.toggle('is-compact',tab!=='profile'||scrolled);
    }
    const change=()=>{shell.dataset.pvPeriod=select.value;onPeriod?.(select.value);restart();sync();};
    const scroll=()=>{if(body.scrollTop>70)scrolled=true;else if(body.scrollTop<8)scrolled=false;sync();};
    const visibility=()=>{if(!disposed)restart();};
    function dispose(){if(disposed)return;disposed=true;stopCycle();select.removeEventListener('change',change);body.removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',visibility);delete modal.profileSync;}
    select.addEventListener('change',change);body.addEventListener('scroll',scroll,{passive:true});document.addEventListener('visibilitychange',visibility);
    modal.profileSync=sync;restart();sync();return dispose;
  }
  const api={numbers,numberPlan,cycle,shell,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TrappPlayerProfile=api;
})(typeof window!=='undefined'?window:globalThis);
