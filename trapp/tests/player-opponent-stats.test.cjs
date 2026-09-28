const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('opponent record counts every played game even if the player scores only once', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
  const functionSource = source.slice(
    source.indexOf('  async function buildPlayerPerformanceExtras('),
    source.indexOf('  function isPlayerAppearancePlayedForCombination(')
  );
  const games = [
    { match_id: 'a', opponent: '対戦相手', result: 'win', target_side: 'home', opponent_score: 0 },
    { match_id: 'b', opponent: '対戦相手', result: 'draw', target_side: 'away', opponent_score: 1 },
    { match_id: 'c', opponent: '対戦相手', result: 'loss', target_side: 'home', opponent_score: 2 }
  ];
  const appearances = games.map(game => ({ match_id: game.match_id, player_key: 'scorer', position: 'FW', played: true }));
  appearances.push({ match_id: 'c', player_key: 'substitute', position: 'FW', played: false });
  const context = vm.createContext({
    playerAnalysisState: { matchScope: 'all' },
    getActivePlayerAnalysisCompetitionFilter: () => [],
    getPlayerTimeScopeYears: () => [2027],
    getPlayerGroupKey: player => player.player_key,
    getPlayerAnalysisKey: player => player.player_key,
    getPlayerPositions: () => ['FW'],
    getPlayerNumbers: () => [9],
    getPlayerAnalysisYearsForPlayers: () => [2027],
    loadPlayerAnalysisDatasetYear: async () => ({ matches: games, appearances, goals: [{ match_id: 'a', player_key: 'scorer' }] }),
    isPlayerAnalysisScopeMatch: () => true,
    getPlayerCanonicalIdentity: row => ({ groupKey: row.player_key }),
    normalizeOpponentClubName: value => value,
    isPlayerAppearancePlayedForCombination: row => row.played,
    calculatePlayerRate: (wins, matches) => matches ? (wins / matches) * 100 : null,
    toPlayerNumber: value => Number(value)
  });
  vm.runInContext(functionSource, context);
  const stats = await context.buildPlayerPerformanceExtras({ player_key: 'scorer' });
  const opponent = stats.opponentGoals[0];
  assert.equal(opponent.goals, 1);
  assert.equal(opponent.matches, 3);
  assert.deepEqual([opponent.wins, opponent.draws, opponent.losses], [1, 1, 1]);
  assert(Math.abs(opponent.winRate - 100 / 3) < 0.001);
  vm.runInContext(source.slice(
    source.indexOf('  function getRankedOpponentClubPlayerItems('),
    source.indexOf('  function renderPlayerOpponentControls(')
  ), context);
  const clubStats = await context.buildPlayerOpponentClubAnalysis([{ player_key: 'scorer', player_name: '選手' }]);
  const clubPlayer = clubStats.rankings.get('対戦相手')[0];
  assert.equal(clubPlayer.matches, 3);
  assert.deepEqual([clubPlayer.wins, clubPlayer.draws, clubPlayer.losses], [1, 1, 1]);
  assert.deepEqual(Array.from(clubPlayer.matchRows, row => row.goals).sort(), [0, 0, 1]);
});
