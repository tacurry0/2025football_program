(() => {
  "use strict";

  const CLUBS = {
    niigata: { short: "新潟", name: "アルビレックス新潟", emblem: "../data/assets/emblems/アルビレックス新潟.png", group: "WEST-Aグループ" },
    kumamoto: { short: "熊本", name: "ロアッソ熊本", emblem: "../data/assets/emblems/ロアッソ熊本.png", group: "WEST-Bグループ" }
  };
  const viewMeta = {
    home: ["MATCHDAY HUB", "ホーム", "チーム・選手を検索"],
    schedule: ["FIXTURES & RESULTS", "日程・結果", "対戦相手・会場を検索"],
    standings: ["LEAGUE TABLE", "順位表", "クラブを検索"],
    players: ["PLAYER DATABASE", "選手データ", "選手名を検索"]
  };
  const state = { view: "home", schedule: [], standings: [], players: [], scheduleClub: "all", playerClub: "all", playerSort: "played", group: "WEST-Aグループ", query: "" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function emblem(team, fallback = "") {
    if (team === CLUBS.niigata.name || team === "新潟") return CLUBS.niigata.emblem;
    if (team === CLUBS.kumamoto.name || team === "熊本") return CLUBS.kumamoto.emblem;
    return fallback || `../data/assets/emblems/${encodeURIComponent(String(team).replace("FC", "FC"))}.png`;
  }
  function dateParts(raw = "") {
    const found = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!found) return { year: "2026", month: "--", day: raw || "未定", key: raw };
    const [, year, month, day] = found;
    const range = raw.match(/or\s+\d{4}-\d{2}-(\d{2})/);
    return { year, month, day: range ? `${Number(day)}–${Number(range[1])}` : String(Number(day)), key: `${year}-${month}` };
  }
  function dayLabel(day = "") {
    const map = { Mon: "月", Tue: "火", Wed: "水", Thu: "木", Fri: "金", Sat: "土", Sun: "日" };
    if (day.includes("or")) return "土 / 日";
    return map[day] || day || "未定";
  }
  function teamName(match) { return CLUBS[match.club]?.name || ""; }
  function isHome(match) {
    const detail = `${match.details || ""} ${match.venue || ""}`;
    return /HOME|ホーム|デンカ|えがお/.test(detail);
  }

  async function loadData() {
    try {
      const [scheduleRes, standingsRes, niigataRes, kumamotoRes] = await Promise.all([
        fetch("../data/schedule/2026_2027.json"),
        fetch("../data/standings/current.json"),
        fetch("../data/generated/niigata/2026/player_analysis.json"),
        fetch("../data/generated/kumamoto/2026/player_analysis.json")
      ]);
      if (![scheduleRes, standingsRes, niigataRes, kumamotoRes].every(res => res.ok)) throw new Error("Data request failed");
      const [schedule, standingPayload, niigata, kumamoto] = await Promise.all([scheduleRes.json(), standingsRes.json(), niigataRes.json(), kumamotoRes.json()]);
      state.schedule = schedule;
      state.standings = standingPayload.data || standingPayload;
      state.players = [
        ...niigata.map(player => ({ ...player, club: "niigata" })),
        ...kumamoto.map(player => ({ ...player, club: "kumamoto" }))
      ];
      renderAll();
      if (state.view === "home" && state.query.length >= 2) $("#global-search").dispatchEvent(new Event("input"));
    } catch (error) {
      console.error(error);
      $$(".skeleton").forEach(node => node.replaceWith(Object.assign(document.createElement("p"), { className: "empty-state", textContent: "データを読み込めませんでした。ローカルサーバーから開いてください。" })));
    }
  }

  function renderAll() {
    renderNextMatches();
    renderMiniStandings();
    renderSchedule();
    renderGroupTabs();
    renderStandings();
    renderPlayers();
  }

  function renderNextMatches() {
    const target = $("#next-match-grid");
    target.innerHTML = ["niigata", "kumamoto"].map(club => {
      const match = state.schedule.find(item => item.club === club);
      if (!match) return "";
      const info = CLUBS[club], date = dateParts(match.date), home = isHome(match);
      const own = { name: info.name, emblem: info.emblem };
      const opponent = { name: match.opponent, emblem: match.emblem?.replace("./data/", "../data/") || emblem(match.opponent) };
      const left = home ? own : opponent, right = home ? opponent : own;
      return `<article class="next-card ${club}">
        <div class="match-top"><div class="club-label"><img src="${info.emblem}" alt=""><span>${info.name}</span></div><span class="match-tag">NEXT MATCH · ${escapeHtml(match.matchweek)}</span></div>
        <p class="match-date">${date.year}.${date.month}<strong>${date.month}/${date.day} <small>(${dayLabel(match.day)})</small>${match.time ? ` · ${escapeHtml(match.time)}` : ""}</strong></p>
        <div class="match-versus">
          <div class="match-team"><img src="${left.emblem}" alt=""><strong>${escapeHtml(left.name)}</strong></div><span class="vs-mark">VS</span>
          <div class="match-team"><img src="${right.emblem}" alt=""><strong>${escapeHtml(right.name)}</strong></div>
        </div>
        <div class="match-bottom"><span>⌖ ${escapeHtml(match.venue || "会場未定")}</span><button class="match-detail-btn" type="button" data-match-club="${club}" data-match-week="${escapeHtml(match.matchweek)}">試合詳細 →</button></div>
      </article>`;
    }).join("");
  }

  function renderMiniStandings() {
    const target = $("#standing-mini");
    target.innerHTML = ["niigata", "kumamoto"].map(club => {
      const info = CLUBS[club], row = state.standings.find(item => item.team === info.name);
      return `<div class="mini-row"><span class="mini-rank">${row?.rank || "–"}<small> 位</small></span><img src="${info.emblem}" alt=""><strong>${info.name}</strong><small>${row?.points || "–"} pts</small></div>`;
    }).join("");
  }

  function visibleSchedule() {
    const query = state.query.toLowerCase();
    return state.schedule.filter(match => (state.scheduleClub === "all" || match.club === state.scheduleClub) && (!query || `${teamName(match)} ${match.opponent} ${match.venue} ${match.matchweek}`.toLowerCase().includes(query)));
  }
  function renderSchedule() {
    const target = $("#schedule-list"), matches = visibleSchedule();
    if (!matches.length) { target.innerHTML = `<p class="empty-state">条件に合う試合がありません。</p>`; return; }
    const grouped = matches.reduce((acc, match) => { const key = dateParts(match.date).key; (acc[key] ||= []).push(match); return acc; }, {});
    target.innerHTML = Object.entries(grouped).map(([key, items]) => {
      const [year, month] = key.split("-");
      return `<section class="month-group"><h3>${Number(month) || "–"}月 <span>${year} SEASON</span></h3>${items.map(match => {
        const date = dateParts(match.date), info = CLUBS[match.club];
        const opponentEmblem = match.emblem?.replace("./data/", "../data/") || emblem(match.opponent);
        return `<article class="schedule-card" tabindex="0" role="button" data-match-club="${match.club}" data-match-week="${escapeHtml(match.matchweek)}">
          <div class="date-box"><strong>${date.month}/${date.day}</strong><small>${dayLabel(match.day)} ${escapeHtml(match.time || "時間未定")}</small></div>
          <div class="schedule-club"><img src="${info.emblem}" alt=""><span>${info.short}</span></div>
          <div class="schedule-opponent"><img src="${opponentEmblem}" alt=""><div><strong>vs ${escapeHtml(match.opponent)}</strong><small>${escapeHtml(match.matchweek)} · ${isHome(match) ? "HOME" : "AWAY"}</small></div></div>
          <div class="schedule-venue">⌖ ${escapeHtml(match.venue || "会場未定")}</div><span class="schedule-arrow">›</span>
        </article>`;
      }).join("")}</section>`;
    }).join("");
  }

  function renderGroupTabs() {
    const groups = [...new Set(state.standings.map(row => row.group))];
    $("#group-tabs").innerHTML = groups.map(group => `<button type="button" class="${group === state.group ? "is-active" : ""}" data-group="${escapeHtml(group)}">${escapeHtml(group.replace("グループ", ""))}</button>`).join("");
  }
  function renderStandings() {
    const query = state.query.toLowerCase();
    let rows = state.standings.filter(row => row.group === state.group);
    if (query) rows = rows.filter(row => row.team.toLowerCase().includes(query));
    $("#standings-body").innerHTML = rows.length ? rows.map(row => {
      const isMine = Object.values(CLUBS).some(club => club.name === row.team), image = emblem(row.team);
      return `<tr class="${isMine ? "my-club" : ""}"><td class="rank-cell">${escapeHtml(row.rank)}</td><td class="team-col"><div class="table-team"><img src="${image}" alt=""><span>${escapeHtml(row.team)}${isMine ? '<b class="my-label">MY</b>' : ""}</span></div></td><td>${escapeHtml(row.played)}</td><td>${escapeHtml(row.won)}</td><td>${Number(row.goal_diff) > 0 ? "+" : ""}${escapeHtml(row.goal_diff)}</td><td class="points-cell">${escapeHtml(row.points)}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty-state">条件に合うクラブがありません。</td></tr>`;
  }

  function visiblePlayers() {
    const query = state.query.toLowerCase();
    const players = state.players.filter(player => (state.playerClub === "all" || player.club === state.playerClub) && (!query || player.player_name.toLowerCase().includes(query)));
    const sorters = {
      played: (a, b) => b.played_matches - a.played_matches,
      goals: (a, b) => b.goals - a.goals || b.played_matches - a.played_matches,
      winrate: (a, b) => b.played_win_rate - a.played_win_rate,
      name: (a, b) => a.player_name.localeCompare(b.player_name, "ja")
    };
    return players.sort(sorters[state.playerSort]).slice(0, 60);
  }
  function renderPlayers() {
    const players = visiblePlayers();
    $("#player-count").textContent = `${players.length} PLAYERS`;
    $("#player-grid").innerHTML = players.length ? players.map(player => {
      const info = CLUBS[player.club], initials = player.player_name.replace(/\s/g, "").slice(0, 1), number = player.numbers?.[0] || "–";
      const image = `../data/assets/images/player_${player.club}/${encodeURIComponent(player.player_name)}.jpg`;
      return `<article class="player-card ${player.club}"><span class="player-number">${escapeHtml(number)}</span><div class="player-card-top"><div class="player-photo"><span>${escapeHtml(initials)}</span><img src="${image}" alt="" loading="lazy" onerror="this.remove()"></div><div class="player-name"><strong>${escapeHtml(player.player_name)}</strong><span class="${player.club}">${info.short} · ${escapeHtml(player.positions?.join("/") || "–")}</span></div></div><div class="player-stats"><div><strong>${player.played_matches}</strong><small>出場</small></div><div><strong>${player.goals}</strong><small>得点</small></div><div><strong>${player.played_win_rate}<small>%</small></strong><small>出場時勝率</small></div></div><div class="stat-bar" aria-label="出場時勝率 ${player.played_win_rate}%"><span style="width:${Math.min(player.played_win_rate, 100)}%"></span></div></article>`;
    }).join("") : `<p class="empty-state">条件に合う選手がいません。</p>`;
  }

  function switchView(view, preserveQuery = false) {
    if (!viewMeta[view]) return;
    state.view = view;
    if (!preserveQuery) { state.query = ""; $("#global-search").value = ""; }
    $$("[data-view-panel]").forEach(panel => { const active = panel.dataset.viewPanel === view; panel.hidden = !active; panel.classList.toggle("is-active", active); });
    $$("[data-view]").forEach(button => { const active = button.dataset.view === view; button.classList.toggle("is-active", active); active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current"); });
    const [eyebrow, title, placeholder] = viewMeta[view]; $("#page-eyebrow").textContent = eyebrow; $("#page-title").textContent = title; $("#global-search").placeholder = placeholder;
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", `#${view}`);
    if (view === "schedule") renderSchedule(); if (view === "standings") renderStandings(); if (view === "players") renderPlayers();
  }

  function openMatch(match) {
    if (!match) return;
    const dialog = $("#match-dialog"), info = CLUBS[match.club], date = dateParts(match.date), id = `${match.club}-${match.matchweek}`;
    const saved = localStorage.getItem(`takarei_sandbox_attend_${id}`) === "1";
    $("#dialog-content").innerHTML = `<div class="dialog-hero"><small>${escapeHtml(match.matchweek)} · ${date.year} SEASON</small><div class="dialog-teams"><img src="${info.emblem}" alt="${info.name}"><span>VS</span><img src="${match.emblem?.replace("./data/", "../data/") || emblem(match.opponent)}" alt="${escapeHtml(match.opponent)}"></div></div><div class="dialog-body"><div class="detail-line"><span>開催日</span><strong>${date.month}/${date.day} (${dayLabel(match.day)}) ${escapeHtml(match.time || "時間未定")}</strong></div><div class="detail-line"><span>対戦</span><strong>${info.short} vs ${escapeHtml(match.opponent)}</strong></div><div class="detail-line"><span>会場</span><strong>${escapeHtml(match.venue || "未定")}</strong></div><div class="detail-line"><span>区分</span><strong>${isHome(match) ? "HOME" : "AWAY"}</strong></div><button class="attend-button ${saved ? "is-saved" : ""}" type="button" data-attend-id="${escapeHtml(id)}">${saved ? "✓ 観戦予定に追加済み" : "+ 観戦予定に追加"}</button></div>`;
    dialog.showModal();
  }
  function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2100); }

  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view], [data-jump]"); if (viewButton) switchView(viewButton.dataset.view || viewButton.dataset.jump);
    const clubFilter = event.target.closest("[data-club-filter]"); if (clubFilter) { state.scheduleClub = clubFilter.dataset.clubFilter; $$('[data-club-filter]').forEach(button => button.classList.toggle("is-active", button === clubFilter)); renderSchedule(); }
    const playerClub = event.target.closest("[data-player-club]"); if (playerClub) { state.playerClub = playerClub.dataset.playerClub; $$('[data-player-club]').forEach(button => button.classList.toggle("is-active", button === playerClub)); renderPlayers(); }
    const groupButton = event.target.closest("[data-group]"); if (groupButton) { state.group = groupButton.dataset.group; renderGroupTabs(); renderStandings(); }
    const matchButton = event.target.closest("[data-match-club][data-match-week]"); if (matchButton) openMatch(state.schedule.find(match => match.club === matchButton.dataset.matchClub && match.matchweek === matchButton.dataset.matchWeek));
    if (event.target.closest(".dialog-close")) $("#match-dialog").close();
    const attend = event.target.closest("[data-attend-id]"); if (attend) { const key = `takarei_sandbox_attend_${attend.dataset.attendId}`, next = localStorage.getItem(key) !== "1"; localStorage.setItem(key, next ? "1" : "0"); attend.classList.toggle("is-saved", next); attend.textContent = next ? "✓ 観戦予定に追加済み" : "+ 観戦予定に追加"; showToast(next ? "観戦予定に追加しました" : "観戦予定から外しました"); }
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#global-search").focus(); }
    const card = event.target.closest?.(".schedule-card"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); card.click(); }
    if (event.key === "Escape" && $("#match-dialog").open) $("#match-dialog").close();
  });
  $("#global-search").addEventListener("input", event => {
    state.query = event.target.value.trim();
    if (state.view === "home" && state.query.length >= 2) {
      const query = state.query.toLowerCase();
      const scheduleHits = state.schedule.filter(match => `${teamName(match)} ${match.opponent} ${match.venue}`.toLowerCase().includes(query)).length;
      const playerHits = state.players.filter(player => player.player_name.toLowerCase().includes(query)).length;
      const target = playerHits > scheduleHits ? "players" : "schedule";
      switchView(target, true);
      showToast(target === "players" ? "選手データから検索しています" : "日程から検索しています");
      return;
    }
    if (state.view === "schedule") renderSchedule();
    if (state.view === "standings") renderStandings();
    if (state.view === "players") renderPlayers();
  });
  $("#player-sort").addEventListener("change", event => { state.playerSort = event.target.value; renderPlayers(); });
  $("#match-dialog").addEventListener("click", event => { if (event.target === $("#match-dialog")) $("#match-dialog").close(); });
  window.addEventListener("hashchange", () => {
    const nextView = location.hash.slice(1);
    if (viewMeta[nextView] && nextView !== state.view) switchView(nextView);
  });

  switchView(location.hash.slice(1) || "home");
  loadData();
})();
