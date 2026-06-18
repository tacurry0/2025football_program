#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'trapp', 'data', 'history');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'trapp', 'data', 'players');
const DEFAULT_CACHE_DIR = path.join(ROOT, '.cache', 'jleague-data-site-profiles');
const DATA_SITE_BASE = 'https://data.j-league.or.jp';

const CLUB_CONFIG = {
  niigata: {
    label: 'アルビレックス新潟',
    outputFile: 'niigata.json',
    dataSiteNames: ['新潟'],
    historyNames: ['新潟', 'アルビレックス新潟']
  },
  kumamoto: {
    label: 'ロアッソ熊本',
    outputFile: 'kumamoto.json',
    dataSiteNames: ['熊本'],
    historyNames: ['熊本', 'ロアッソ熊本']
  }
};

const KANA_INDEXES = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
  'は', 'ひ', 'ふ', 'へ', 'ほ',
  'ま', 'み', 'む', 'め', 'も',
  'や', 'ゆ', 'よ',
  'ら', 'り', 'る', 'れ', 'ろ',
  'わ', 'を', 'ん'
];

const EXCLUDED_PLAYER_NAMES = new Set([
  'オウンゴール', 'ＯＧ', 'OG', 'Own Goal', 'own goal', 'OWN GOAL', '不明', '-', ''
]);

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const clubs = String(getArg('--clubs', 'niigata,kumamoto')).split(',').map(v => v.trim()).filter(Boolean);
const outputDir = path.resolve(getArg('--out-dir', DEFAULT_OUTPUT_DIR));
const cacheDir = path.resolve(getArg('--cache', DEFAULT_CACHE_DIR));
const limit = Number(getArg('--limit', '0'));
const pageDelayMs = Number(getArg('--page-delay', '350'));
const force = hasFlag('--force');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compactText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return compactText(value)
    .replace(/[\s　・･.．\-ー－_'’`]/g, '')
    .toLowerCase();
}

function normalizeTeam(value) {
  return compactText(value)
    .replace(/[\s　・･.．\-ー－_'’`]/g, '')
    .replace(/Ｆ/g, 'F')
    .replace(/Ｃ/g, 'C')
    .toLowerCase();
}

function createNameKeys(name) {
  const raw = compactText(name);
  const keys = new Set();
  const add = value => {
    const key = normalizeName(value);
    if (key) keys.add(key);
  };

  add(raw);
  add(raw.replace(/[（）()]/g, ''));
  add(raw.replace(/[（(].*?[）)]/g, ''));

  for (const match of raw.matchAll(/[（(](.*?)[）)]/g)) {
    add(match[1]);
  }

  return Array.from(keys);
}

function isExcludedName(value) {
  const raw = compactText(value);
  return EXCLUDED_PLAYER_NAMES.has(raw) || EXCLUDED_PLAYER_NAMES.has(normalizeName(raw));
}

function relPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|dt|dd|tr|td|th|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToLines(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|dt|dd|tr|td|th|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n');
  return decodeHtmlEntities(text).split(/\r?\n/).map(compactText).filter(Boolean);
}

function fullUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${DATA_SITE_BASE}${url}`;
  return `${DATA_SITE_BASE}/${url.replace(/^\.\//, '')}`;
}

function parseHeightWeight(value) {
  const m = String(value || '').normalize('NFKC').match(/(\d{2,3})\s*(?:cm)?\s*\/\s*(\d{2,3})\s*(?:kg)?/i);
  if (!m) return { height_cm: null, weight_kg: null };
  return { height_cm: Number(m[1]), weight_kg: Number(m[2]) };
}

function safeCacheName(value) {
  const converted = Array.from(String(value || ''))
    .map(ch => /[A-Za-z0-9_.-]/.test(ch) ? ch : `u${ch.codePointAt(0).toString(16)}`)
    .join('');
  return (converted || 'empty').slice(0, 160);
}

async function readJsonSafe(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return fallback; }
}

async function readTextSafe(filePath) {
  try { return await fs.readFile(filePath, 'utf8'); } catch { return null; }
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
}

async function writeJson(filePath, data) {
  await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 football-profile-generator/6.0',
        'Accept-Language': 'ja,en-US;q=0.8,en;q=0.6',
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCachedText(url, cachePath) {
  if (!force) {
    const cached = await readTextSafe(cachePath);
    if (cached) return cached;
  }
  const res = await fetchWithTimeout(url, { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  await writeText(cachePath, html);
  await sleep(pageDelayMs);
  return html;
}

async function listJsonFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile() && e.name.endsWith('.json')).map(e => path.join(dirPath, e.name)).sort();
  } catch { return []; }
}

function matchSideForClub(match, club) {
  const names = CLUB_CONFIG[club]?.historyNames || [club];
  const home = String(match.home_team || match.home || match.homeName || '');
  const away = String(match.away_team || match.away || match.awayName || '');
  if (names.some(name => home.includes(name))) return 'home';
  if (names.some(name => away.includes(name))) return 'away';
  return null;
}

function ensureHistoryPlayer(map, rawName) {
  const name = compactText(rawName);
  if (!name || isExcludedName(name)) return null;
  if (!map.has(name)) map.set(name, { name, numbers: new Set(), positions: new Set(), sources: [] });
  return map.get(name);
}

function collectPlayersFromDetails(details, players, sourceInfo) {
  if (!details || typeof details !== 'object') return;
  for (const key of ['starting', 'substitutes', 'substitute', 'bench', 'members', 'reserve']) {
    const rows = Array.isArray(details[key]) ? details[key] : [];
    for (const row of rows) {
      const player = ensureHistoryPlayer(players, row?.name);
      if (!player) continue;
      if (row.number) player.numbers.add(String(row.number));
      if (row.position) player.positions.add(String(row.position));
      if (sourceInfo) player.sources.push(sourceInfo);
    }
  }
}

function collectGoalNames(goals, players, sourceInfo) {
  const rows = Array.isArray(goals) ? goals : [];
  for (const row of rows) {
    const player = ensureHistoryPlayer(players, row?.name);
    if (player && sourceInfo) player.sources.push({ ...sourceInfo, event: 'goal' });
  }
}

async function collectHistoryPlayers(club) {
  const files = await listJsonFiles(path.join(HISTORY_DIR, club));
  const players = new Map();
  for (const file of files) {
    const matches = await readJsonSafe(file, []);
    if (!Array.isArray(matches)) continue;
    for (const match of matches) {
      const side = matchSideForClub(match, club);
      if (!side) continue;
      const sourceInfo = {
        file: relPath(file),
        match_card_id: match.match_card_id || match.match_id || '',
        date: match.date || '',
        opponent: side === 'home' ? (match.away_team || '') : (match.home_team || '')
      };
      collectPlayersFromDetails(match[`${side}_details`], players, sourceInfo);
      collectGoalNames(match[`${side}_goals`], players, sourceInfo);
    }
  }
  return Array.from(players.values()).map(player => ({
    name: player.name,
    numbers: Array.from(player.numbers).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'ja')),
    positions: Array.from(player.positions).sort(),
    appearances_in_history: player.sources.length,
    sample_sources: player.sources.slice(0, 3)
  })).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

function parseIndexTail(text) {
  const plain = compactText(text);
  const m = plain.match(/^(.*?)\s+(\S+)\s+(GK|DF|MF|FW)(?:\s+(\d{4}\/\d{2}\/\d{2}))?(?:\s+(\d{2,3}\/\d{2,3}))?$/);
  if (!m) return { name_en: plain, final_team: '', position: '', birth_date: '', height_cm: null, weight_kg: null };
  const hw = parseHeightWeight(m[5] || '');
  return {
    name_en: compactText(m[1]),
    final_team: compactText(m[2]),
    position: m[3],
    birth_date: m[4] || '',
    height_cm: hw.height_cm,
    weight_kg: hw.weight_kg
  };
}

function parsePlayerIndexPage(html, kana) {
  const players = [];
  const anchorRe = /<a[^>]+href=(['"])([^'"]*SFIX04\/?\?player_id=(\d+)[^'"]*)\1[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = Array.from(String(html || '').matchAll(anchorRe));
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const nextIndex = matches[i + 1]?.index ?? html.length;
    const href = decodeHtmlEntities(match[2]);
    const player_id = match[3];
    const name = stripTags(match[4]);
    if (!player_id || !name || isExcludedName(name)) continue;
    const afterAnchor = html.slice(match.index + match[0].length, nextIndex);
    const rowText = stripTags(afterAnchor);
    const parsed = parseIndexTail(rowText);
    players.push({
      player_id,
      name,
      name_keys: createNameKeys(name),
      normalized_name: normalizeName(name),
      name_en: parsed.name_en,
      final_team: parsed.final_team,
      position: parsed.position,
      birth_date: parsed.birth_date,
      height_cm: parsed.height_cm,
      weight_kg: parsed.weight_kg,
      kana,
      links: { jleague_data: fullUrl(href) }
    });
  }
  return players;
}

async function buildPlayerMaster() {
  const masterCachePath = path.join(cacheDir, 'all_players_master.json');
  if (!force) {
    const cached = await readJsonSafe(masterCachePath, null);
    if (Array.isArray(cached) && cached.length) return cached.map(player => ({
      ...player,
      name_keys: Array.isArray(player.name_keys) && player.name_keys.length ? player.name_keys : createNameKeys(player.name)
    }));
  }

  const all = [];
  const seen = new Set();
  for (const kana of KANA_INDEXES) {
    const url = `${DATA_SITE_BASE}/SFIX03/createPlayerListInfoByFirstAlphabetList?player_name_first_alphabet=${encodeURIComponent(kana)}`;
    const cachePath = path.join(cacheDir, 'index-pages', `${safeCacheName(kana)}.html`);
    console.log(`fetch index ${kana} ...`);
    const html = await fetchCachedText(url, cachePath);
    for (const player of parsePlayerIndexPage(html, kana)) {
      if (seen.has(player.player_id)) continue;
      seen.add(player.player_id);
      all.push(player);
    }
  }
  all.sort((a, b) => a.name.localeCompare(b.name, 'ja') || Number(a.player_id) - Number(b.player_id));
  await writeJson(masterCachePath, all);
  return all;
}

function valueAfterLabel(lines, label) {
  const index = lines.findIndex(line => normalizeName(line) === normalizeName(label));
  if (index === -1) return '';
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (['最終所属', 'ポジション', '出生地', '生年月日', '身長/体重', '初出場', '初得点', 'リーグ別成績', '年度別成績'].some(x => normalizeName(line) === normalizeName(x))) return '';
    return line;
  }
  return '';
}

function collectSectionLines(lines, heading, stopHeadings = []) {
  const start = lines.findIndex(line => normalizeName(line) === normalizeName(heading));
  if (start === -1) return [];
  const stops = stopHeadings.map(normalizeName);
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const normalized = normalizeName(line);
    if (stops.some(stop => normalized === stop)) break;
    if (line) out.push(line);
  }
  return out;
}

function parseAnnualRecords(lines) {
  const records = [];
  for (const line of lines) {
    const normalized = compactText(line);
    const m = normalized.match(/^(\d{4})\s+(.+?)\s+(J1|J2|J3|Ｊ１|Ｊ２|Ｊ３)\s+(.+)$/);
    if (!m) continue;
    const rest = m[4].split(/\s+/).filter(Boolean);
    records.push({
      season: m[1],
      team: compactText(m[2]),
      league: m[3].replace('Ｊ', 'J'),
      league_matches: rest[0] || '',
      league_goals: rest[1] || '',
      cup_matches: rest[2] || '',
      cup_goals: rest[3] || ''
    });
  }
  return records;
}

function parseFirstRecord(lines) {
  return lines.filter(line => !['初出場', '初得点'].includes(line)).slice(0, 6);
}

async function fetchPlayerDetail(indexPlayer) {
  const url = indexPlayer.links.jleague_data || `${DATA_SITE_BASE}/SFIX04/?player_id=${indexPlayer.player_id}`;
  const cachePath = path.join(cacheDir, 'detail-pages', `${indexPlayer.player_id}.html`);
  const html = await fetchCachedText(url, cachePath);
  const lines = htmlToLines(html);
  const detailHeadingIndex = lines.findIndex(line => line.includes('検索結果：詳細'));
  const name = detailHeadingIndex >= 0 ? (lines[detailHeadingIndex + 1] || indexPlayer.name) : indexPlayer.name;
  const nameEn = detailHeadingIndex >= 0 ? (lines[detailHeadingIndex + 2] || indexPlayer.name_en) : indexPlayer.name_en;
  const heightWeight = valueAfterLabel(lines, '身長/体重') || `${indexPlayer.height_cm || ''}/${indexPlayer.weight_kg || ''}`;
  const hw = parseHeightWeight(heightWeight);
  const annualLines = collectSectionLines(lines, '年度別成績', ['戻る', 'HOME']);
  const firstAppearanceLines = collectSectionLines(lines, '初出場', ['初得点', 'リーグ別成績', '年度別成績']);
  const firstGoalLines = collectSectionLines(lines, '初得点', ['リーグ別成績', '年度別成績']);
  const annual_records = parseAnnualRecords(annualLines);
  return {
    source: 'jleague_data_site',
    source_confidence: 'high',
    player_id: indexPlayer.player_id,
    app_player_name: indexPlayer.name,
    name: compactText(name),
    official_name: compactText(name),
    name_en: compactText(nameEn),
    normalized_names: Array.from(new Set([...createNameKeys(indexPlayer.name), ...createNameKeys(name), normalizeName(nameEn)].filter(Boolean))),
    final_team: valueAfterLabel(lines, '最終所属') || indexPlayer.final_team,
    position: valueAfterLabel(lines, 'ポジション') || indexPlayer.position,
    birthplace: valueAfterLabel(lines, '出生地'),
    birth_date: valueAfterLabel(lines, '生年月日') || indexPlayer.birth_date,
    height_cm: hw.height_cm || indexPlayer.height_cm,
    weight_kg: hw.weight_kg || indexPlayer.weight_kg,
    first_appearances: parseFirstRecord(firstAppearanceLines),
    first_goals: parseFirstRecord(firstGoalLines),
    annual_records,
    affiliated_teams: Array.from(new Set(annual_records.map(row => row.team).filter(Boolean))),
    links: { jleague_data: url },
    fetched_at: new Date().toISOString()
  };
}

function teamMatchesClub(team, club) {
  const teamNormalized = normalizeTeam(team);
  const targets = CLUB_CONFIG[club]?.dataSiteNames || [];
  return targets.some(target => teamNormalized === normalizeTeam(target));
}

function profileBelongsToClub(profile, club) {
  return (profile.annual_records || []).some(row => teamMatchesClub(row.team, club));
}

function makeCompactProfile(profile, player, club) {
  const matchedAnnualRecords = profile.annual_records.filter(row => teamMatchesClub(row.team, club));
  return {
    ...profile,
    app_player_name: player.name,
    club,
    matched_annual_records: matchedAnnualRecords,
    history_hint: {
      numbers: player.numbers,
      positions: player.positions,
      appearances_in_history: player.appearances_in_history,
      sample_sources: player.sample_sources
    }
  };
}

async function resolvePlayer(player, club, masterByName) {
  const candidateMap = new Map();
  for (const key of createNameKeys(player.name)) {
    for (const indexPlayer of masterByName.get(key) || []) {
      candidateMap.set(indexPlayer.player_id, indexPlayer);
    }
  }

  const profiles = [];
  for (const indexPlayer of candidateMap.values()) {
    try {
      const profile = await fetchPlayerDetail(indexPlayer);
      if (profileBelongsToClub(profile, club)) {
        profiles.push(makeCompactProfile(profile, player, club));
      }
    } catch {
      // 取得できない候補は、通常JSONにもmissingにも入れない。
      // 対象クラブ所属を確認できなかった選手名だけmissingへ回す。
    }
  }

  return profiles;
}

function putProfile(clubJson, playerName, profiles) {
  if (!profiles.length) return;
  clubJson[playerName] = profiles.length === 1 ? profiles[0] : profiles;
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('Node.js 18以上で実行してください。');

  console.log('Building J.LEAGUE Data Site player master...');
  const master = await buildPlayerMaster();
  const masterByName = new Map();
  for (const player of master) {
    const keys = Array.isArray(player.name_keys) && player.name_keys.length ? player.name_keys : createNameKeys(player.name);
    for (const key of keys) {
      if (!masterByName.has(key)) masterByName.set(key, []);
      masterByName.get(key).push(player);
    }
  }
  console.log(`Master players: ${master.length}`);

  const generatedAt = new Date().toISOString();
  const missing = {
    _meta: {
      generated_at: generatedAt,
      source: 'J.LEAGUE Data Site SFIX03/SFIX04',
      note: 'Names only. These players were not confirmed as Niigata/Kumamoto affiliated by annual_records.'
    }
  };

  const summary = {};

  for (const club of clubs) {
    if (!CLUB_CONFIG[club]) { console.warn(`Unknown club skipped: ${club}`); continue; }
    const players = await collectHistoryPlayers(club);
    const targets = limit > 0 ? players.slice(0, limit) : players;
    const clubJson = {
      _meta: {
        generated_at: generatedAt,
        club,
        club_label: CLUB_CONFIG[club].label,
        source: 'J.LEAGUE Data Site SFIX03/SFIX04',
        matching_rule: 'name exact/alias match, then annual_records team includes target club; final_team is not used for adoption'
      }
    };
    missing[club] = [];
    summary[club] = { total: targets.length, matched: 0, missing: 0, duplicate_profile_names: 0 };

    console.log(`\n[${club}] ${targets.length} players`);
    for (let i = 0; i < targets.length; i += 1) {
      const player = targets[i];
      process.stdout.write(`${String(i + 1).padStart(3, ' ')}/${targets.length} ${player.name} ... `);
      const profiles = await resolvePlayer(player, club, masterByName);
      if (profiles.length) {
        putProfile(clubJson, player.name, profiles);
        summary[club].matched += 1;
        if (profiles.length > 1) summary[club].duplicate_profile_names += 1;
        console.log(profiles.length === 1 ? `OK player_id=${profiles[0].player_id}` : `OK ${profiles.length} profiles`);
      } else {
        missing[club].push(player.name);
        summary[club].missing += 1;
        console.log('MISSING');
      }
    }

    const outputPath = path.join(outputDir, CLUB_CONFIG[club].outputFile);
    await writeJson(outputPath, clubJson);
  }

  missing._meta.summary = summary;
  await writeJson(path.join(outputDir, 'missing.json'), missing);

  console.log('\nSaved:');
  for (const club of clubs) {
    if (CLUB_CONFIG[club]) console.log(`- ${relPath(path.join(outputDir, CLUB_CONFIG[club].outputFile))}`);
  }
  console.log(`- ${relPath(path.join(outputDir, 'missing.json'))}`);
  console.log('\nSummary:');
  console.log(summary);
}

main().catch(error => { console.error(error); process.exit(1); });
