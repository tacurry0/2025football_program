/* Usage: node trapp/data/scripts/build_league_snapshots.cjs /path/to/official-html
 * Outputs an artifact map. Uses the exact Apps Script parser without executing page scripts.
 * Expected files: trapp-j{2,3}-{standings,august,september}.html.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../..');
const dir = process.argv[2];
if (!dir) throw new Error('HTML保存ディレクトリを指定してください');
const context = { console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(base, 'gas/JLeague.gs'), 'utf8'), context);
const api = require(path.join(base, 'league-data.js'));
const files = {}, fullMatches = [];
const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
for (const league of ['j2', 'j3']) {
  const rankingPath = path.join(dir, `trapp-${league}-standings.html`);
  const ranking = context.jlParseStandings(fs.readFileSync(rankingPath, 'utf8'), league);
  const common = { schemaVersion: 2, status: 200, season: api.SEASON, league, stale: false, fromCache: false, complete: true };
  const standings = { ...common, fetchedAt: fs.statSync(rankingPath).mtime.toISOString(), sourceUrl: `https://www.jleague.jp/${league}/standings/`, ...ranking };
  files[`trapp/data/standings/${api.SEASON}/${league}.json`] = standings;
  const rows = [], coverage = {};
  let fetchedAt = '';
  for (const month of ['august', 'september']) {
    const file = path.join(dir, `trapp-${league}-${month}.html`);
    const parsed = context.jlParseMatches(fs.readFileSync(file, 'utf8'), league);
    fullMatches.push(...parsed);
    rows.push(...parsed.filter(row => row.date <= day));
    fetchedAt = fs.statSync(file).mtime.toISOString();
    coverage[month === 'august' ? '2026-08' : '2026-09'] = fetchedAt;
  }
  const results = { ...common, fetchedAt, sourceUrl: `https://www.jleague.jp/${league}/match/`, coverage, auditedMonth: 0,
    data: [...new Map(rows.map(r => [r.match_id, r])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.match_id.localeCompare(b.match_id)) };
  if (!api.validPayload(standings, 'standings', league) || !api.validPayload(results, 'results', league)) throw new Error('snapshot validation failed');
  for (const r of standings.data) {
    const teamMatches = results.data.filter(m => m.status === 'finished' && (m.home === r.team || m.away === r.team));
    const won = teamMatches.filter(m => m.home === r.team ? m.home_score > m.away_score : m.away_score > m.home_score).length;
    const drawn = teamMatches.filter(m => m.home_score === m.away_score).length;
    if (teamMatches.length !== r.played || won !== r.won || drawn !== r.drawn) throw new Error(`結果と順位表が一致しません: ${r.team}`);
  }
  files[`trapp/data/results/${api.SEASON}/${league}.json`] = results;
}
const old = JSON.parse(fs.readFileSync(path.join(base, 'data/standings/current.json'), 'utf8'));
if (!old.schemaVersion) files['trapp/data/standings/archive/2026_hundred.json'] = { ...old, season: api.HUNDRED, archived: true, final: false };
const schedule = JSON.parse(fs.readFileSync(path.join(base, 'data/schedule/2026_2027.json'), 'utf8'));
files['trapp/data/schedule/2026_2027.json'] = schedule.map(m => {
  const competition = /^MW\d+$/.test(m.matchweek) ? (m.club === 'niigata' ? 'j2' : 'j3') : /^LC/.test(m.matchweek) ? 'leaguecup' : /^EC/.test(m.matchweek) ? 'emperor' : m.matchweek === 'PM' ? 'friendly' : 'other';
  const clubName = m.club === 'niigata' ? 'アルビレックス新潟' : 'ロアッソ熊本';
  const fixture = fullMatches.find(r => r.league === competition && r.date === m.date &&
    ((r.home === clubName && r.away === m.opponent) || (r.away === clubName && r.home === m.opponent)));
  return { ...m, season: api.SEASON, competition_id: competition, competition: api.NAMES[competition],
    section: /^MW\d+$/.test(m.matchweek) ? Number(m.matchweek.slice(2)) : null,
    ...(fixture ? { match_id: fixture.match_id, home_away: fixture.home === clubName ? 'H' : 'A' } : {}) };
});
files['trapp/data/standings/current.json'] = { schemaVersion: 2, status: 200, season: api.SEASON,
  data: ['j2','j3'].flatMap(l => files[`trapp/data/standings/${api.SEASON}/${l}.json`].data),
  sources: Object.fromEntries(['j2','j3'].map(l => [l, files[`trapp/data/standings/${api.SEASON}/${l}.json`]])) };
process.stdout.write(JSON.stringify(files));
