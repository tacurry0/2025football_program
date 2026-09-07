/** trapp J2/J3 data service v5 — Apps Script V8 / 2026-27 */
const JL = { season: '2026_2027', sourceYear: '2026-27', start: '2026-08-01', end: '2027-06-30', ttl: 1800, version: 'v5' };

function doGet(e) {
  const p = (e && e.parameter) || {};
  const type = p.type || 'standings', league = p.league || 'j2';
  const season = p.season || JL.season;
  if (!['standings', 'results'].includes(type) || !['j2', 'j3'].includes(league) || season !== JL.season) {
    return jlJson({ status: 400, schemaVersion: 2, data: [], error: 'type / league / season の指定が不正です' });
  }
  const key = JL.version + '_' + season + '_' + league + '_' + type;
  const cache = CacheService.getScriptCache();
  const cached = p.nocache === '1' ? null : cache.get(key);
  if (cached) { try { return jlJson(Object.assign(jlUnpack(cached), { fromCache: true })); } catch (_) {} }
  const previous = jlRead(key);
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
    const cards = []; let section = null;
    f.walk(groups[groupId].children, function (p) {
      if ((p.className || '').includes('m-section-header')) {
        const m = jlNorm(f.text(p.children)).match(/第\s*(\d+)\s*節/);
        if (m) section = Number(m[1]);
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
      const row = { match_id: String(card.id), season: JL.season, league: league, competition_id: league,
        date: date, section: section, home: team('home'), away: team('away'),
        home_score: finished ? Number(score[0]) : null, away_score: finished ? Number(score[1]) : null,
        status: finished ? 'finished' : /cancel|postpon/i.test(state) ? 'postponed' : /suspend/i.test(state) ? 'suspended' : 'scheduled',
        source_url: 'https://www.jleague.jp' + link.split('#')[0] };
      if (!/^\d{10,}$/.test(row.match_id) || !row.home || !row.away || !section || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
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
    const requests = batch.map(function (month) {
      const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      return Object.assign({ url: 'https://www.jleague.jp/' + league + '/match/?startdate=' + month + '-01&enddate=' + month + '-' + end + '&category=' + league }, jlOptions());
    });
    const responses = UrlFetchApp.fetchAll(requests);
    responses.forEach(function (response, i) {
      const found = jlParseMatches(jlHtml(response), league).filter(function (r) { return r.date <= last; });
      if (found.some(function (r) { return r.date.slice(0, 7) !== batch[i]; })) throw new Error('公式サイトの期間指定が反映されていません');
      const oldFinished = Object.values(rows).filter(function (r) { return r.date.slice(0, 7) === batch[i] && r.status === 'finished'; });
      if (oldFinished.some(function (r) { return !found.some(function (n) { return n.match_id === r.match_id; }); })) throw new Error('取得件数が減少しました。前回データを保持します');
      found.forEach(function (r) { rows[r.match_id] = r; });
      coverage[batch[i]] = new Date().toISOString();
    });
  }
  return { data: Object.values(rows).sort(function (a, b) { return a.date.localeCompare(b.date) || a.match_id.localeCompare(b.match_id); }),
    coverage: coverage, auditedMonth: audit + 1, sourceUrl: 'https://www.jleague.jp/' + league + '/match/' };
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
  ['j2', 'j3'].forEach(function (league) { ['standings', 'results'].forEach(function (type) { keys.push(JL.version + '_' + JL.season + '_' + league + '_' + type); }); });
  CacheService.getScriptCache().removeAll(keys);
  console.log('短期キャッシュを削除しました。前回正常データは保持しています。');
}
function test() {
  ['j2', 'j3'].forEach(function (league) {
    ['standings', 'results'].forEach(function (type) {
      const result = JSON.parse(doGet({ parameter: { type: type, league: league, season: JL.season, nocache: '1' } }).getContent());
      console.log(league + ' ' + type + ': ' + JSON.stringify({ status: result.status, count: result.data.length, stale: result.stale, error: result.error, first: result.data[0] }));
    });
  });
}
