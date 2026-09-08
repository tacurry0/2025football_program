/* Shared competition metadata and versioned, last-known-good league data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TrappLeague = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const SEASON = "2026_2027";
  const HUNDRED = "2026_hundred";
  const RESULT_LEAGUES = ['j2', 'j3', 'leaguecup', 'emperor'];
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec";
  const NAMES = { j1: "明治安田J1リーグ", j2: "明治安田J2リーグ", j3: "明治安田J3リーグ", j2j3: "明治安田J2・J3 百年構想リーグ", leaguecup: "JリーグYBCルヴァンカップ", emperor: "天皇杯", friendly: "親善試合", playoff: "昇格プレーオフ", other: "その他" };
  const normalize = value => String(value ?? "").normalize("NFKC").trim();
  function context(match = {}) {
    let competition = match.competition_id || "";
    const text = normalize([match.tournament, match.competition, match.league, match.details].filter(Boolean).join(" "));
    const date = String(match.date || "").slice(0, 10);
    if (!competition) {
      if (/百年構想|100年構想/.test(text)) competition = "j2j3";
      else if (/ルヴァン|ナビスコ|YBC|YLC|leaguecup/i.test(text)) competition = "leaguecup";
      else if (/天皇杯|emperor/i.test(text)) competition = "emperor";
      else if (/昇格プレーオフ|参入プレーオフ/i.test(text)) competition = "playoff";
      else if (/親善|プレシーズン|friendly/i.test(text)) competition = "friendly";
      else {
        const league = text.match(/(?:^|[^A-Za-z0-9])(J[123])(?=$|[^A-Za-z0-9])/i);
        if (league) competition = league[1].toLowerCase();
        else if (/^2026-0[2-6]-/.test(date) && /^MW\s*\d+$/i.test(match.matchweek || "")) competition = "j2j3";
      }
    }
    let season = String(match.season || "");
    if (competition === "j2j3") season = HUNDRED;
    if ((!season || (/^\d{4}$/.test(season) && date >= "2026-07-01")) && date) {
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      season = date >= "2026-07-01" ? `${month >= 7 ? year : year - 1}_${month >= 7 ? year + 1 : year}` : String(year);
    }
    return { competition, season, label: NAMES[competition] || text || "大会未設定" };
  }
  function annotate(match) {
    const ctx = context(match);
    return { ...match, season: ctx.season, competition_id: ctx.competition || "other" };
  }
  function compatible(a, b) {
    const ca = context(a), cb = context(b);
    return (!ca.season || !cb.season || ca.season === cb.season) &&
      (!ca.competition || !cb.competition || ca.competition === "other" || cb.competition === "other" || ca.competition === cb.competition);
  }
  function fixtureKey(row) {
    const c = context(row);
    const sides = [normalize(row.home), normalize(row.away)].join("|");
    return row.match_id ? `${c.season}|${c.competition}|${row.match_id}` : `${c.season}|${c.competition}|${row.date}|${sides}`;
  }
  function storageId(match) {
    return `${match.storage_date || match.date}_${match.club}_${match.storage_opponent || match.opponent}`;
  }
  function reconcileSchedule(schedule, results, matchesTeam = (a,b) => normalize(a) === normalize(b)) {
    let changed = false;
    for (const r of results) {
      if (r.season !== SEASON || !RESULT_LEAGUES.includes(r.competition_id)) continue;
      for (const [club, own] of [['niigata','アルビレックス新潟'],['kumamoto','ロアッソ熊本']]) {
        const home = matchesTeam(r.home, own), away = matchesTeam(r.away, own);
        if (!home && !away) continue;
        const opponent = home ? r.away : r.home;
        const candidates = schedule.filter(m => m.club === club && compatible(m,r));
        let match = candidates.find(m => m.match_id === r.match_id || (m.date === r.date && matchesTeam(m.opponent,opponent)));
        if (!match) {
          const pending = candidates.filter(m => m.date === r.date && /^(未定|TBD|対戦相手未定)$/i.test(m.opponent));
          if (pending.length === 1) match = pending[0];
        }
        if (!match) {
          match = { club, date:r.date, opponent, day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(r.date+'T12:00:00+09:00').getUTCDay()], time:r.time || '', venue:r.venue || '', emblem:'', matchweek:r.section ? `MW${r.section}` : r.round || 'カップ戦' };
          schedule.push(match); changed = true;
        }
        if (match.date !== r.date) { match.storage_date ||= match.date; match.date = r.date; changed = true; }
        if (match.opponent !== opponent) { match.storage_opponent ||= match.opponent; match.opponent = opponent; changed = true; }
        const updates = {match_id:r.match_id, season:r.season, competition_id:r.competition_id, competition:NAMES[r.competition_id], home_away:home?'H':'A'};
        for (const [k,v] of Object.entries(updates)) if (match[k] !== v) { match[k]=v; changed=true; }
      }
    }
    return changed;
  }
  function validPayload(payload, type, league, season = SEASON) {
    if (!payload || payload.schemaVersion !== 2 || payload.status !== 200 || payload.league !== league || payload.season !== season || !Array.isArray(payload.data)) return false;
    if (!Number.isFinite(Date.parse(payload.fetchedAt || ""))) return false;
    if (type === "standings") {
      if (payload.data.length !== 20 || new Set(payload.data.map(r => r.team_id || r.team)).size !== 20) return false;
      return payload.data.every(r => r.league === league && r.season === season && r.team &&
        ["rank", "points", "played", "won", "drawn", "lost", "goals_for", "goals_against", "goal_diff"].every(k => Number.isFinite(r[k])) &&
        r.played === r.won + r.drawn + r.lost && r.goal_diff === r.goals_for - r.goals_against);
    }
    return payload.complete === true && new Set(payload.data.map(r => r.match_id)).size === payload.data.length && payload.data.every(r => r.league === league && r.season === season && r.match_id && r.home && r.away && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      ["finished", "scheduled", "postponed", "suspended", "in_progress"].includes(r.status) &&
      (r.status !== "finished" || (Number.isInteger(r.home_score) && Number.isInteger(r.away_score) && r.home_score >= 0 && r.away_score >= 0)));
  }
  function createClient(options = {}) {
    const fetcher = options.fetch || fetch;
    const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const inflight = new Map();
    const keyFor = (type, league) => `trapp_v2_${SEASON}_${league}_${type}`;
    const read = key => { try { return JSON.parse(storage?.getItem(key) || "null"); } catch (_) { return null; } };
    const write = (key, value) => { try { storage?.setItem(key, JSON.stringify(value)); } catch (_) {} };
    async function json(url, timeoutMs) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetcher(url, { cache: "no-store", ...(controller ? { signal: controller.signal } : {}) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } finally { if (timer) clearTimeout(timer); }
    }
    async function load(type, league, force = false) {
      const key = keyFor(type, league);
      if (inflight.has(key)) return inflight.get(key);
      const promise = (async () => {
        const previous = read(key);
        const cached = validPayload(previous, type, league) ? previous : null;
        if (!force && cached && !cached.stale && Date.now() - Date.parse(cached.fetchedAt) < 30 * 60 * 1000) return { ...cached, source: "cache" };
        let bundled = null;
        try { const p = await json(`./data/${type}/${SEASON}/${league}.json`, 12000); if (validPayload(p, type, league)) bundled = p; } catch (_) {}
        const candidates = [cached, bundled].filter(Boolean).sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt));
        try {
          const params = new URLSearchParams({ type, league, season: SEASON });
          if (force) params.set("nocache", "1");
          const fresh = await json(`${options.url || GAS_URL}?${params}`, 90000);
          if (!validPayload(fresh, type, league)) throw new Error("GASの更新が未反映、またはデータの形式が不正です");
          if (!fresh.stale && (!candidates[0] || Date.parse(fresh.fetchedAt) >= Date.parse(candidates[0].fetchedAt))) {
            write(key, fresh);
            return { ...fresh, source: "gas" };
          }
          if (fresh.stale) {
            candidates.push(fresh);
            candidates.sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt));
            if (candidates[0] === fresh) write(key, fresh);
            throw new Error(fresh.error || "公式データの更新に失敗しました");
          }
          return { ...candidates[0], stale: true, source: "saved", error: "取得データが保存済みデータより古いため、保存済みデータを表示しています" };
        } catch (error) {
          if (candidates[0]) return { ...candidates[0], stale: true, source: cached === candidates[0] ? "cache" : bundled === candidates[0] ? "bundled" : "gas", error: String(error.message || error) };
          return { schemaVersion: 2, status: 503, league, season: SEASON, data: [], stale: true, error: String(error.message || error), fetchedAt: null };
        }
      })();
      inflight.set(key, promise);
      try { return await promise; } finally { inflight.delete(key); }
    }
    async function all(type, force = false) {
      const payloads = await Promise.all((type === 'results' ? RESULT_LEAGUES : ['j2','j3']).map(league => load(type, league, force)));
      return { schemaVersion: 2, status: payloads.some(p => p.status === 200) ? 200 : 503, season: SEASON,
        data: payloads.flatMap(p => p.data), sources: Object.fromEntries(payloads.map(p => [p.league, p])), stale: payloads.some(p => p.stale) };
    }
    async function detail(match, force = false, onSaved) {
      const league = context(match).competition;
      const id = String(match.match_id || '');
      const inferred = /^\d{10}$/.test(id) ? `/match/${league}/${id.slice(0,4)}/${id.slice(4)}` : '';
      const path = String(match.source_url || match.j_official_url || inferred).replace(/^https:\/\/www\.jleague\.jp/, '').replace(/\/$/,'');
      if (!RESULT_LEAGUES.includes(league) || !/^\/match\/(j2|j3|leaguecup|emperor)\/(2026|2027)\/\d{6}$/.test(path)) return null;
      const key = `trapp_v6_detail_${path.replace(/\//g,'_')}`;
      const valid = p => validPayload(p,'results',league) && p.data.length === 1 && p.data[0].match_id === match.match_id && p.data[0].detail_complete === true;
      const saved = read(key), cached = valid(saved) ? saved : null;
      if (!force && cached && !cached.stale && Date.now()-Date.parse(cached.fetchedAt) < 1800000) return cached;
      if (inflight.has(key)) return inflight.get(key);
      const promise = (async () => {
        let bundled = null;
        try { const p = await json(`./data/details/${SEASON}/${league}/${match.match_id}.json`,12000); if (valid(p)) bundled=p; } catch (_) {}
        const previous = [cached,bundled].filter(Boolean).sort((a,b)=>Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt))[0];
        if (previous && onSaved) onSaved({...previous,stale:true});
        try {
          const params = new URLSearchParams({type:'detail',path,season:SEASON}); if(force) params.set('nocache','1');
          const p = await json(`${options.url || GAS_URL}?${params}`,60000);
          if (!valid(p)) throw new Error('出場選手情報が未公開、または詳細データを取得できませんでした');
          const chosen = previous && Date.parse(previous.fetchedAt)>Date.parse(p.fetchedAt) ? {...previous,stale:true} : p;
          write(key,chosen); return chosen;
        } catch (error) {
          return previous ? {...previous,stale:true,error:String(error.message || error)} : {status:503,data:[],stale:true,error:String(error.message || error)};
        }
      })();
      inflight.set(key,promise);
      try { return await promise; } finally { inflight.delete(key); }
    }
    return { load, all, detail };
  }
  return { SEASON, HUNDRED, RESULT_LEAGUES, NAMES, GAS_URL, context, annotate, compatible, fixtureKey, storageId, reconcileSchedule, validPayload, createClient };
});
