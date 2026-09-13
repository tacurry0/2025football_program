const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('2026/27 analysis includes all checked official games and consistent appearances/goals', () => {
  for (const [club, count] of [['niigata', 7], ['kumamoto', 8]]) {
    const dir = `data/generated/${club}/2026_2027`;
    const matches = read(`${dir}/matches.json`), apps = read(`${dir}/appearances.json`), goals = read(`${dir}/goals.json`);
    const analysis = read(`${dir}/player_analysis.json`);
    assert.ok(matches.length >= count);
    const meta = read(`${dir}/metadata.json`);
    assert.equal(matches.length, meta.matches);
    assert.ok(meta.through >= '2026-09-12');
    assert.equal(read(`data/generated/${club}/all_years_player_analysis.json`).filter(r => r.season === 2027).length, analysis.length);
    for (const match of matches) {
      assert.equal(Number(match.season), 2027);
      assert.equal(match.season_id, '2026_2027');
      assert.ok(match.date >= '2026-08-01' && match.date <= meta.through);
      const record = read(`data/details/2026_2027/${match.competition_id}/${match.match_id}.json`).data[0];
      assert.equal(record.status, 'finished');
      const entries = apps.filter(a => a.match_id === match.match_id);
      assert.equal(entries.filter(a => a.starter).length, 11);
      assert.equal(new Set(entries.map(a => a.player_key)).size, entries.length);
      assert.equal(goals.filter(g => g.match_id === match.match_id).length, match.target_score);
      const ins = new Set(record[match.target_side + '_substitutions'].map(s => s.in).filter(Boolean));
      for (const app of entries.filter(a => !a.starter)) assert.equal(app.played, ins.has(app.player_name), app.player_name);
    }
    for (const player of analysis) {
      assert.equal(player.played_matches, apps.filter(a => a.player_key === player.player_key && a.played).length);
      assert.equal(player.goals, goals.filter(g => g.player_key === player.player_key && !g.is_own_goal).length);
    }
  }
  const apps = read('data/generated/kumamoto/2026_2027/appearances.json');
  assert.equal(apps.find(a => a.match_id === '2026081902' && a.player_name === '大西 遼太郎').minute_in, 91);
  assert.equal(apps.find(a => a.match_id === '2026081902' && a.player_name === '小澤 秀充').minute_in, 80);
  const last = read('data/generated/kumamoto/2026_2027/matches.json').find(r => r.date === '2026-09-12');
  assert.equal(last.date, '2026-09-12'); assert.equal(last.target_score, 2); assert.equal(last.opponent_score, 1);
});

test('fixture corrections preserve a single official date and home/away pairing', () => {
  const rows = read('data/schedule/2026_2027.json');
  const cups = rows.filter(r => r.matchweek === 'LC2');
  assert.equal(cups.length, 2);
  for (const row of cups) { assert.equal(row.date, '2026-09-29'); assert.equal(row.day, 'Tue'); assert.equal(row.time, '19:00'); }
  assert.equal(cups.find(r => r.club === 'niigata').home_away, 'A');
  assert.equal(cups.find(r => r.club === 'kumamoto').opponent, '川崎フロンターレ');
  assert.equal(rows.find(r => r.club === 'kumamoto' && r.matchweek === 'MW9').venue, 'たけびしスタジアム京都');
});

test('analysis season routing keeps 2026 history separate from 2026/27', () => {
  const code = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const c = vm.createContext({});
  for (const name of ['playerAnalysisSeasonPath', 'playerAnalysisSeasonLabel']) {
    vm.runInContext(code.match(new RegExp('function ' + name + '\\(year\\) \\{[^}]+\\}'))[0], c);
  }
  assert.equal(c.playerAnalysisSeasonPath(2026), '2026');
  assert.equal(c.playerAnalysisSeasonPath(2027), '2026_2027');
  assert.equal(c.playerAnalysisSeasonLabel('2027'), '2026/27');
});
