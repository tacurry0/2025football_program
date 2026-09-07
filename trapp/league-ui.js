/* Compact J2/J3 standings; historical data remains explicitly labelled. */
window.TrappStandings = (function () {
  const columns = [ ['rank','順位'], ['team','チーム'], ['points','勝点'], ['played','試合'], ['won','勝'], ['drawn','分'], ['lost','負'], ['goals_for','得'], ['goals_against','失'], ['goal_diff','差'] ];
  const archiveColumns = [...columns.slice(0,5), ['pk_won','PK勝'], ['pk_lost','PK負'], ...columns.slice(6)];
  let league = 'j2', period = 'current', sort = { key: 'rank', dir: 1 }, ticket = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function dateLabel(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return '取得日時不明';
    return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }
  function render(container, payload, options = {}) {
    const currentTicket = ++ticket;
    const draw = async () => {
      let source = payload?.sources?.[league];
      if (period === 'archive') {
        try {
          const response = await fetch('./data/standings/archive/2026_hundred.json');
          if (!response.ok) throw new Error('archive');
          source = await response.json();
        } catch (_) { source = { data: [], error: '保存済みの順位表を読み込めませんでした' }; }
      }
      if (currentTicket !== ticket) return;
      const archive = period === 'archive', cols = archive ? archiveColumns : columns;
      const groups = {};
      (source?.data || []).forEach(row => {
        const group = archive ? row.group || '保存済み順位表' : `${league.toUpperCase()} 2026/27`;
        (groups[group] ||= []).push(row);
      });
      const table = (name, rows) => {
        const sorted = [...rows].sort((a, b) => sort.key === 'team' ? sort.dir * String(a.team).localeCompare(String(b.team), 'ja') : sort.dir * (Number(a[sort.key]) - Number(b[sort.key])));
        return `<h2 class="standings-group-title">${escape(name)}</h2><div class="league-table-scroll"><table class="standings-table"><thead><tr>${cols.map(([key,label]) => `<th scope="col" aria-sort="${key === sort.key ? sort.dir === 1 ? 'ascending' : 'descending' : 'none'}"><button type="button" data-sort="${key}">${label}${key === sort.key ? sort.dir === 1 ? ' ↑' : ' ↓' : ''}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(row => `<tr class="${String(row.team).includes('新潟') ? 'standing-niigata' : String(row.team).includes('熊本') ? 'standing-kumamoto' : ''}">${cols.map(([key]) => key === 'team' ? `<td class="standing-team"><button type="button" class="league-team-link" data-team="${escape(row.team)}">${options.getEmblem?.(row.team) ? `<img class="standing-team-emblem" alt="" src="${escape(options.getEmblem(row.team))}">` : ''}<span>${escape(row.team)}</span></button></td>` : `<td class="${key === 'points' ? 'col-pts' : key === 'rank' ? 'col-rank' : ''}">${escape(row[key] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      };
      const warning = archive ? '百年構想リーグの保存分です。最終順位ではありません。' : source?.stale ? '更新に失敗したため、保存済みデータを表示しています。' : '';
      container.innerHTML = `<div class="league-controls"><label>大会 <select id="standings-period"><option value="current" ${archive ? '' : 'selected'}>2026/27 シーズン</option><option value="archive" ${archive ? 'selected' : ''}>2026 百年構想（保存分）</option></select></label><button type="button" id="standings-refresh" ${archive ? 'disabled' : ''}>更新</button></div>${archive ? '' : `<div class="league-tabs" role="group" aria-label="リーグ選択">${['j2','j3'].map(l => `<button type="button" data-league="${l}" aria-pressed="${l === league}">${l.toUpperCase()} <span>${l === 'j2' ? '新潟' : '熊本'}</span></button>`).join('')}</div>`}<p class="league-data-status ${warning ? 'is-stale' : ''}" role="status">${escape(warning)} ${archive ? '保存日時' : 'データ取得'}: ${escape(dateLabel(source?.fetchedAt || source?.timestamp))}${!archive && source?.sourceUpdatedAt ? ` ／ 公式更新: ${escape(source.sourceUpdatedAt)}` : ''}</p>${Object.entries(groups).map(([name, rows]) => table(name, rows)).join('') || '<p class="league-empty">順位表を取得できませんでした。更新ボタンから再試行してください。</p>'}`;
      container.querySelector('#standings-period').onchange = event => { period = event.target.value; sort = { key: 'rank', dir: 1 }; render(container, payload, options); };
      container.querySelectorAll('[data-league]').forEach(button => { button.onclick = () => { league = button.dataset.league; sort = { key: 'rank', dir: 1 }; render(container, payload, options); }; });
      container.querySelectorAll('[data-sort]').forEach(button => { button.onclick = () => { const key = button.dataset.sort; sort = { key, dir: key === sort.key ? -sort.dir : key === 'team' || key === 'rank' ? 1 : -1 }; render(container, payload, options); }; });
      container.querySelectorAll('[data-team]').forEach(button => { button.onclick = event => window.openClubSite(button.dataset.team, event); });
      container.querySelector('#standings-refresh').onclick = async event => {
        const button = event.currentTarget;
        button.disabled = true; button.textContent = '更新中…';
        await options.onReload?.();
      };
    };
    void draw();
  }
  return { render };
})();
