/** trapp league/cup/detail service v6 — Apps Script V8 / 2026-27 */
const JL = { season: '2026_2027', sourceYear: '2026-27', start: '2026-08-01', end: '2027-06-30', ttl: 1800, version: 'v6' };

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.type === 'detail') return jlDetailGet(p);
  const type = p.type || 'standings', league = p.league || 'j2';
  const season = p.season || JL.season;
  if (!['standings', 'results'].includes(type) || !(type === 'standings' ? ['j2', 'j3'] : ['j2', 'j3', 'leaguecup', 'emperor']).includes(league) || season !== JL.season) {
    return jlJson({ status: 400, schemaVersion: 2, data: [], error: 'type / league / season の指定が不正です' });
  }
  const key = JL.version + '_' + season + '_' + league + '_' + type;
  const cache = CacheService.getScriptCache();
  const cached = p.nocache === '1' ? null : cache.get(key);
  if (cached) { try { return jlJson(Object.assign(jlUnpack(cached), { fromCache: true })); } catch (_) {} }
  const previous = jlRead(key) || jlRead(key.replace('v6_', 'v5_'));
  try {
    const result = type === 'standings' ? jlStandings(league) : jlResults(league, previous);
    const data = Object.assign({ status: 200, schemaVersion: 2, season: season, league: league,
      fetchedAt: new Date().toISOString(), stale: false, fromCache: false, complete: true }, result);
    jlWrite(key, data);
    const packed = jlPack(data);
    if (packed.length < 95000) cache.put(key, packed, JL.ttl);
    return jlJson(data);
  } catch (error) {
    console.error(String(error.stack || error));
    if (previous) return jlJson(Object.assign({}, previous, { stale: true, fromCache: true,
      error: '更新に失敗したため前回の正常データを返します: ' + error.message }));
    return jlJson({ status: 503, schemaVersion: 2, season: season, league: league, data: [],
      fetchedAt: null, stale: true, error: error.message });
  }
}
function jlJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function jlOptions() {
  return { muteHttpExceptions: true, followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' } };
}
function jlHtml(response) {
  if (response.getResponseCode() !== 200) throw new Error('公式サイト HTTP ' + response.getResponseCode());
  const html = response.getContentText('UTF-8');
  if (!html.includes('self.__next_f.push')) throw new Error('公式サイトのデータ構造を確認できません');
  return html;
}
function jlNorm(value) { return String(value == null ? '' : value).normalize('NFKC').trim(); }

/* Decode the page's JSON records, never execute downloaded JavaScript. */
function jlFlight(html) {
  let stream = '', match;
  const regex = /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  while ((match = regex.exec(html))) {
    try { const a = JSON.parse(match[1]); if (a[0] === 1 && typeof a[1] === 'string') stream += a[1]; } catch (_) {}
  }
  const records = {};
  stream.split('\n').forEach(function (line) {
    const m = line.match(/^([a-f0-9]+):(.*)$/);
    if (m) { try { records[m[1]] = JSON.parse(m[2]); } catch (_) {} }
  });
  if (!Object.keys(records).length) throw new Error('公式ページ内のJSONを解析できません');
  function resolve(value, depth) {
    depth = depth || 0;
    if (depth > 60) return null;
    if (typeof value !== 'string') return value;
    const m = value.match(/^\$(?:L)?([a-f0-9]+)((?::[^:]+)*)$/);
    if (!m || !(m[1] in records)) return value;
    let found = records[m[1]];
    m[2].split(':').filter(Boolean).forEach(function (key) {
      found = resolve(found, depth + 1);
      found = key === 'props' && Array.isArray(found) && found[0] === '$' ? found[3] : found && found[key];
    });
    return resolve(found, depth + 1);
  }
  function walk(value, fn, depth) {
    depth = depth || 0;
    if (depth > 70) return;
    value = resolve(value);
    if (!Array.isArray(value)) return;
    if (value[0] === '$' && value[3] && typeof value[3] === 'object') {
      if (fn(value[3]) !== false) walk(value[3].children, fn, depth + 1);
    } else value.forEach(function (v) { walk(v, fn, depth + 1); });
  }
  function text(value, depth) {
    depth = depth || 0;
    if (depth > 60) return '';
    value = resolve(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value[0] === '$' ? '' : value;
    if (!Array.isArray(value)) return '';
    return value[0] === '$' ? text(value[3] && value[3].children, depth + 1) : value.map(function (v) { return text(v, depth + 1); }).join(' ');
  }
  return { records: records, resolve: resolve, walk: walk, text: text };
}

function jlParseStandings(html, league) {
  const f = jlFlight(html);
  let sourceRows = null, sourceUpdatedAt = '', year = '';
  Object.values(f.records).forEach(function (root) {
    f.walk(root, function (p) {
      if (p.standingList) sourceRows = f.resolve(p.standingList);
      if (p.leagueName === league && p.year) year = p.year;
      if (p.updatedAt) sourceUpdatedAt = f.text(p.updatedAt) || String(p.updatedAt);
      if ((p.className || '').includes('p-basic-page-header__updated-date')) {
        const date = f.text(p.children).match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/);
        if (date) sourceUpdatedAt = date[0];
      }
    });
  });
  if (year !== JL.sourceYear) throw new Error('順位表のシーズンが一致しません: ' + year);
  if (!Array.isArray(sourceRows) || sourceRows.length !== 20) throw new Error('順位表が20クラブではありません');
  const data = sourceRows.map(function (r) {
    const row = { season: JL.season, league: league, competition_id: league,
      team_id: String(r.club.href || '').split('/').filter(Boolean).pop(), team: jlNorm(r.club.name),
      rank: r.ranking.value, points: r.point, played: r.match, won: r.win, drawn: r.draw, lost: r.loss,
      goals_for: r.goalScored, goals_against: r.goalLost, goal_diff: r.goalDifference };
    if (!row.team_id || !row.team || !['rank','points','played','won','drawn','lost','goals_for','goals_against','goal_diff'].every(function (k) { return Number.isFinite(row[k]); }) ||
      row.played !== row.won + row.drawn + row.lost || row.goal_diff !== row.goals_for - row.goals_against) throw new Error('順位表の項目が不正です');
    return row;
  });
  if (new Set(data.map(function (r) { return r.team_id; })).size !== 20) throw new Error('順位表に重複があります');
  return { data: data, sourceUpdatedAt: sourceUpdatedAt || null };
}
function jlStandings(league) {
  const url = 'https://www.jleague.jp/' + league + '/standings/?year=' + JL.sourceYear;
  return Object.assign(jlParseStandings(jlHtml(UrlFetchApp.fetch(url, jlOptions())), league), { sourceUrl: url });
}

function jlParseMatches(html, league) {
  const f = jlFlight(html), groups = {}, rows = {};
  let hasList = false;
  Object.values(f.records).forEach(function (root) {
    f.walk(root, function (p) {
      if ((p.className || '').split(' ').includes('p-game-schedule__list')) hasList = true;
      if (p.className === 'p-game-schedule__group') { groups[p.id] = p; return false; }
    });
  });
  if (!hasList) throw new Error('日程一覧の構造を確認できません');
  Object.keys(groups).forEach(function (groupId) {
    const cards = []; let section = null, round = '';
    f.walk(groups[groupId].children, function (p) {
      if ((p.className || '').includes('m-section-header')) {
        const m = jlNorm(f.text(p.children)).match(/第\s*(\d+)\s*節/);
        if (m) section = Number(m[1]);
        const cupRound = jlNorm(f.text(p.children)).match(/(?:第?\s*\d+\s*回戦|準々決勝|準決勝|決勝|プレーオフ)(?:\s*第\s*\d+\s*戦)?/);
        if (cupRound) round = cupRound[0];
      }
      if ((p.className || '').split(' ').includes('m-schedule')) { cards.push(p); return false; }
    });
    cards.forEach(function (card) {
      const props = [];
      f.walk(card.children, function (p) { props.push(p); });
      const select = function (cls) { return props.filter(function (p) { return (p.className || '').split(' ').includes(cls); }); };
      const links = props.map(function (p) { return p.href || (p.linkProps && p.linkProps.href) || ''; });
      const link = links.find(function (url) { return url.indexOf('/match/' + league + '/') === 0; });
      if (!link) return; // League pages also contain cup fixtures.
      const team = function (side) {
        const parent = select('m-schedule__team-' + side)[0], names = [];
        if (parent) f.walk(parent.children, function (p) {
          if ((p.className || '').includes('m-schedule__team-name') && p['data-media'] === 'pc') names.push(jlNorm(f.text(p.children)));
        });
        return names[0] || '';
      };
      const state = card.className || '';
      const finished = /(?:^|\s)m-schedule--game-over(?:\s|$)/.test(state);
      const score = select('m-schedule__score').map(function (p) { return f.text(p.children).trim(); });
      const date = groupId.slice(0, 10);
      const penalty = select('m-schedule__penalty').map(function (p) { return jlNorm(f.text(p.children)); }).find(function (s) { return /\d+\s*PK\s*\d+/.test(s); }) || '';
      const row = { match_id: String(card.id), season: JL.season, league: league, competition_id: league,
        date: date, section: section, home: team('home'), away: team('away'),
        home_score: finished ? Number(score[0]) : null, away_score: finished ? Number(score[1]) : null,
        status: finished ? 'finished' : /cancel|postpon/i.test(state) ? 'postponed' : /suspend/i.test(state) ? 'suspended' : 'scheduled',
        source_url: 'https://www.jleague.jp' + link.split('#')[0] };
      if (round) row.round = round.trim();
      if (penalty) row.pk = penalty;
      if (!/^\d{10,}$/.test(row.match_id) || !row.home || !row.away || (['j2', 'j3'].includes(league) && !section) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        (finished && (score.length !== 2 || !score.every(function (s) { return /^\d+$/.test(s); })))) throw new Error('試合データの項目が不正です: ' + card.id);
      if (date >= JL.start && date <= JL.end) rows[row.match_id] = row;
    });
  });
  if (Object.keys(rows).length >= 250) throw new Error('公式サイトの表示上限に達しています。取得期間を短くしてください');
  return Object.values(rows);
}

function jlResults(league, previous) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const last = today < JL.end ? today : JL.end;
  if (last < JL.start) return { data: [], coverage: {}, auditedMonth: 0 };
  const months = [];
  for (let d = new Date(JL.start + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= last; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 7));
  const coverage = Object.assign({}, previous && previous.coverage), rows = {};
  ((previous && previous.data) || []).forEach(function (r) { rows[r.match_id] = r; });
  const pendingMonths = new Set(Object.values(rows).filter(function (r) { return r.status !== 'finished'; }).map(function (r) { return r.date.slice(0, 7); }));
  const older = months.slice(0, -2);
  const audit = previous ? Number(previous.auditedMonth || 0) : 0;
  const selected = months.filter(function (m, i) { return !coverage[m] || i >= months.length - 2 || pendingMonths.has(m) || (older.length && m === older[audit % older.length]); });
  // Bounded batches; past completed months are retained and audited in rotation.
  for (let start = 0; start < selected.length; start += 3) {
    const batch = selected.slice(start, start + 3);
    const pages = league === 'emperor' ? ['j1', 'j2', 'j3'].map(function (l) { return l + '/match/search-list/'; }) : [league + '/match/'];
    const requests = batch.flatMap(function (month) {
      const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      return pages.map(function (page) { return Object.assign({ url: 'https://www.jleague.jp/' + page + '?startdate=' + month + '-01&enddate=' + month + '-' + end + '&category=' + league }, jlOptions()); });
    });
    const responses = UrlFetchApp.fetchAll(requests);
    batch.forEach(function (month, i) {
      const found = responses.slice(i * pages.length, (i + 1) * pages.length).flatMap(function (response) { return jlParseMatches(jlHtml(response), league); }).filter(function (r) { return r.date <= last; });
      if (found.some(function (r) { return r.date.slice(0, 7) !== batch[i]; })) throw new Error('公式サイトの期間指定が反映されていません');
      const oldFinished = Object.values(rows).filter(function (r) { return r.date.slice(0, 7) === batch[i] && r.status === 'finished'; });
      if (oldFinished.some(function (r) { return !found.some(function (n) { return n.match_id === r.match_id; }); })) throw new Error('取得件数が減少しました。前回データを保持します');
      found.forEach(function (r) { rows[r.match_id] = r; });
      coverage[batch[i]] = new Date().toISOString();
    });
  }
  return { data: Object.values(rows).sort(function (a, b) { return a.date.localeCompare(b.date) || a.match_id.localeCompare(b.match_id); }),
    coverage: coverage, auditedMonth: audit + 1, sourceUrl: 'https://www.jleague.jp/' + (league === 'emperor' ? 'j2/match/search-list/?category=emperor' : league + '/match/'), scope: league === 'emperor' ? 'jleague_clubs' : league };
}

// Compress persisted snapshots; chunk below the per-property size limit.
function jlPack(data) { return Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(data))).getBytes()); }
function jlUnpack(value) { return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(value))).getDataAsString('UTF-8')); }
function jlRead(key) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return null;
  try {
    const p = PropertiesService.getScriptProperties(), count = Number(p.getProperty(key + '_count'));
    if (!count) return null;
    let packed = ''; for (let i = 0; i < count; i++) packed += p.getProperty(key + '_' + i) || '';
    return jlUnpack(packed);
  } catch (_) { return null; }
  finally { lock.releaseLock(); }
}
function jlWrite(key, value) {
  const packed = jlPack(value), lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('データ保存が混雑しています。再度お試しください');
  try {
    const p = PropertiesService.getScriptProperties(), old = Number(p.getProperty(key + '_count'));
    const count = Math.ceil(packed.length / 7000), updates = {};
    for (let i = 0; i < count; i++) updates[key + '_' + i] = packed.slice(i * 7000, (i + 1) * 7000);
    updates[key + '_count'] = String(count);
    p.setProperties(updates, false);
    for (let i = count; i < old; i++) p.deleteProperty(key + '_' + i);
  } finally { lock.releaseLock(); }
}
function clearCache() {
  const keys = [];
  ['j2', 'j3', 'leaguecup', 'emperor'].forEach(function (league) { ['standings', 'results'].forEach(function (type) { keys.push(JL.version + '_' + JL.season + '_' + league + '_' + type); }); });
  CacheService.getScriptCache().removeAll(keys);
  console.log('短期キャッシュを削除しました。前回正常データは保持しています。');
}
function test() {
  ['j2', 'j3', 'leaguecup', 'emperor'].forEach(function (league) {
    (['j2', 'j3'].includes(league) ? ['standings', 'results'] : ['results']).forEach(function (type) {
      const result = JSON.parse(doGet({ parameter: { type: type, league: league, season: JL.season, nocache: '1' } }).getContent());
      console.log(league + ' ' + type + ': ' + JSON.stringify({ status: result.status, count: result.data.length, stale: result.stale, error: result.error, first: result.data[0] }));
    });
  });
}

function testDetail() {
  const results = JSON.parse(doGet({ parameter: { type: 'results', league: 'j2' } }).getContent());
  const row = (results.data || []).filter(function (r) { return r.status === 'finished' && /新潟/.test(r.home + r.away); }).pop();
  if (!row) throw new Error('新潟の終了済み試合がありません。先にtestを実行してください');
  const result = JSON.parse(doGet({ parameter: { type: 'detail', path: row.source_url.replace('https://www.jleague.jp', ''), nocache: '1' } }).getContent());
  console.log(JSON.stringify(result));
}

// One official match per request; never accept arbitrary fetch URLs.
function jlDetailGet(p) {
  const path = String(p.path || '').replace(/\/$/, '');
  const m = path.match(/^\/match\/(j2|j3|leaguecup|emperor)\/(2026|2027)\/(\d{6})$/);
  const date = m ? m[2] + '-' + m[3].slice(0, 2) + '-' + m[3].slice(2, 4) : '';
  if (!m || date < JL.start || date > JL.end || (p.season && p.season !== JL.season)) return jlJson({ status: 400, schemaVersion: 2, data: [], error: '試合URLまたはシーズンが不正です' });
  const key = 'v6_detail_' + m[1] + '_' + m[2] + m[3];
  const cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  let previous = null;
  try { const packed = cache.get(key) || props.getProperty(key); if (packed) previous = jlUnpack(packed); } catch (_) {}
  if (p.nocache !== '1' && previous && Date.now() - Date.parse(previous.fetchedAt) < JL.ttl * 1000) return jlJson(Object.assign({}, previous, { fromCache: true }));
  try {
    const row = jlParseDetail(jlHtml(UrlFetchApp.fetch('https://www.jleague.jp' + path + '/', jlOptions())), path);
    if (previous && previous.data[0].detail_complete && !row.detail_complete) throw new Error('出場選手情報が欠落したため前回データを保持します');
    const data = { schemaVersion: 2, status: 200, season: JL.season, league: m[1], fetchedAt: new Date().toISOString(), stale: false, complete: true, data: [row] };
    const packed = jlPack(data);
    if (packed.length < 95000) cache.put(key, packed, JL.ttl);
    // Bound durable detail storage to 32 records; keep large payloads in short cache only.
    if (packed.length < 8500) {
      const lock = LockService.getScriptLock();
      if (lock.tryLock(5000)) {
        try {
          let index = JSON.parse(props.getProperty('v6_detail_index') || '[]').filter(function (k) { return k !== key; });
          index.push(key);
          while (index.length > 32) props.deleteProperty(index.shift());
          const updates = {}; updates[key] = packed; updates.v6_detail_index = JSON.stringify(index);
          props.setProperties(updates, false);
        } finally { lock.releaseLock(); }
      }
    }
    return jlJson(data);
  } catch (error) {
    if (previous) return jlJson(Object.assign({}, previous, { stale: true, error: String(error.message || error) }));
    return jlJson({ schemaVersion: 2, status: 503, season: JL.season, league: m[1], data: [], stale: true, error: String(error.message || error) });
  }
}

function jlParseDetail(html, path) {
  const f = jlFlight(html), sections = {}, widgets = new Set(), badges = [];
  const has = function (p, name) { return String(p.className || '').split(' ').includes(name); };
  const nodes = function (value, name) { const out = []; f.walk(value, function (p) { if (has(p, name)) { out.push(p); return false; } }); return out; };
  const text = function (value, name) { const p = nodes(value, name)[0]; return p ? jlNorm(f.text(p.children)) : ''; };
  let header = null;
  Object.values(f.records).forEach(function (root) {
    f.walk(root, function (p) {
      if (p.variant === 'game-details' && p.homeTeam && p.awayTeam) header = p;
      ['starting', 'reserve', 'director'].forEach(function (kind) { if (has(p, 'p-game-details-lineup-tab__' + kind + '-members')) sections[kind] = p; });
      if (has(p, 'p-game-details-lineup-tab__info')) sections.info = p;
      if (has(p, 'o-widget__container')) widgets.add(p);
    });
  });
  const m = path.match(/^\/match\/([^/]+)\/(\d{4})\/(\d{6})/);
  if (!header || !m || (header.tournament || (/天皇杯/.test(header.tournamentName) ? 'emperor' : '')) !== m[1]) throw new Error('試合詳細の大会情報を確認できません');
  const stadium = header.stadium || {}, finished = header.type === 'post-game';
  const date = m[2] + '-' + m[3].slice(0, 2) + '-' + m[3].slice(2, 4);
  const instant = new Date(String(header.date).replace(/^\$D/, ''));
  if (!Number.isFinite(instant.getTime()) || Utilities.formatDate(instant, 'Asia/Tokyo', 'yyyy-MM-dd') !== date) throw new Error('試合詳細の日付が一致しません');
  const row = { match_id: m[2] + m[3], season: JL.season, league: m[1], competition_id: m[1], competition: jlNorm(header.tournamentName),
    date: date, time: Utilities.formatDate(instant, 'Asia/Tokyo', 'HH:mm'), round: jlNorm(header.section),
    home: jlNorm(header.homeTeam.name), away: jlNorm(header.awayTeam.name),
    home_score: finished ? header.homeTeam.score : null, away_score: finished ? header.awayTeam.score : null,
    status: finished ? 'finished' : 'scheduled', venue: jlNorm(stadium.name), attendance: stadium.numberOfPeople == null ? '' : stadium.numberOfPeople,
    weather: jlNorm(stadium.weather), temperature: stadium.temperature == null ? '' : stadium.temperature, humidity: stadium.humidity == null ? '' : stadium.humidity,
    source_url: 'https://www.jleague.jp' + path, j_official_url: 'https://www.jleague.jp' + path,
    detail_fetched_at: new Date().toISOString() };
  if (!row.home || !row.away || (finished && (![row.home_score, row.away_score].every(Number.isInteger)))) throw new Error('試合詳細の得点またはクラブ名が不正です');
  ['home', 'away'].forEach(function (side) {
    row[side + '_starting_members'] = []; row[side + '_bench_members'] = [];
    row[side + '_substitutions'] = []; row[side + '_cards'] = [];
    row[side + '_goals'] = (header[side + 'Team'].playerScoreList || []).map(function (g) { return { scorer: jlNorm(g.name), minute: String(g.scoreTime || '').replace(/['’]/g, ''), own_goal: !!g.ownGoal }; });
  });
  Object.keys(sections).filter(function (k) { return k !== 'info'; }).forEach(function (kind) {
    const list = nodes(sections[kind].children, 'm-lineup-list__members')[0];
    const children = list && f.resolve(list.children);
    if (!Array.isArray(children)) throw new Error('出場選手一覧を解析できません');
    children.forEach(function (child, i) {
      const items = nodes(child, 'm-lineup-list-item');
      if (!items.length) return; // Empty opposite-side cell keeps its column index.
      const side = i % 2 ? 'away' : 'home', item = items[0];
      const name = text(item.children, 'm-lineup-list-item__name');
      if (!name) throw new Error('選手名を解析できません');
      if (kind === 'director') { row[side + '_manager'] = name; return; }
      const position = text(item.children, 'm-lineup-list-item__position').match(/^(GK|DF|MF|FW)\s*(\d+)$/);
      const avatar = nodes(item.children, 'm-lineup-list-item__avatar')[0] || {};
      if (!position) throw new Error('ポジションまたは背番号を解析できません');
      row[side + (kind === 'starting' ? '_starting_members' : '_bench_members')].push({ name: name, position: position[1], number: position[2], player_id: String(avatar.memberId || '') });
      nodes(item.children, 'm-lineup-list__badge--sub').forEach(function (badge) {
        const minute = jlNorm(f.text(badge.children)).replace(/['’]/g, '').trim();
        f.walk(badge.children, function (p) { if (['in', 'out'].includes(p.variant)) badges.push({ side: side, name: name, minute: minute, kind: p.variant }); });
      });
      nodes(item.children, 'm-lineup-list__badge--card').forEach(function (badge) {
        f.walk(badge.children, function (p) { if (p.variant && /yellow|red/i.test(p.variant)) badges.push({ side: side, name: name, minute: '', kind: /red/i.test(p.variant) ? 'red' : 'yellow' }); });
      });
    });
  });
  row.detail_complete = row.home_starting_members.length === 11 && row.away_starting_members.length === 11;
  if (sections.starting && !row.detail_complete) throw new Error('先発選手が両チーム11人ではありません');
  if (sections.info) nodes(sections.info.children, 'm-additional-info__info-item').forEach(function (p) {
    const label = text(p.children, 'm-additional-info__item-label'), value = text(p.children, 'm-additional-info__item-value');
    const key = { '主審': 'referee', '副審': 'assistant_referees', '第4の審判員': 'fourth_official', 'VAR': 'var_referee', 'AVAR': 'avar_referee' }[label];
    if (key) row[key] = value;
  });
  widgets.forEach(function (widget) {
    const minute = text(widget.children, 'o-widget__header').replace(/['’]/g, '');
    f.walk(widget.children, function (p) {
      const team = jlNorm(p.teamName || (p.club && p.club.name));
      const side = team === row.home ? 'home' : team === row.away ? 'away' : '';
      if (!side) return;
      if (p.subInPlayer && p.subOutPlayer) row[side + '_substitutions'].push({ minute: minute, in: jlNorm(p.subInPlayer.name), out: jlNorm(p.subOutPlayer.name) });
      if (p.cardType && p.playerName) row[side + '_cards'].push({ minute: minute, player: jlNorm(p.playerName), card: /red|second/i.test(p.cardType) ? 'red' : 'yellow' });
    });
  });
  badges.forEach(function (b) {
    if (['in', 'out'].includes(b.kind)) {
      const list = row[b.side + '_substitutions'];
      if (!list.some(function (r) { return r[b.kind] === b.name; })) {
        const sub = { minute: b.minute, in: '', out: '' }; sub[b.kind] = b.name; list.push(sub);
      }
    } else {
      const cards = row[b.side + '_cards'];
      if (!cards.some(function (r) { return r.player === b.name && r.card === b.kind; })) cards.push({ minute: b.minute, player: b.name, card: b.kind });
    }
  });
  ['home', 'away'].forEach(function (side) { ['substitutions', 'cards'].forEach(function (field) {
    row[side + '_' + field] = Array.from(new Map(row[side + '_' + field].map(function (r) { return [JSON.stringify(r), r]; })).values());
  }); });
  // PK scores are shown independently from regulation/extra-time totals.
  const pk = header.penalty ? [header.penalty.homeTeamScore, header.penalty.awayTeamScore] : null;
  if (pk && pk.every(Number.isInteger)) row.pk = pk[0] + ' PK ' + pk[1];
  return row;
}
