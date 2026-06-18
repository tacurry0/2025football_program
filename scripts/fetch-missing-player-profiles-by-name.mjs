#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'trapp', 'data', 'players');
const DEFAULT_CACHE_DIR = path.join(ROOT, '.cache', 'jleague-data-site-profiles');
const DATA_SITE_BASE = 'https://data.j-league.or.jp';

const CLUB_CONFIG = {
  niigata: { label: 'アルビレックス新潟', outputFile: 'niigata.json' },
  kumamoto: { label: 'ロアッソ熊本', outputFile: 'kumamoto.json' }
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
const pageDelayMs = Number(getArg('--page-delay', '350'));
const force = hasFlag('--force');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function compactText(value) { return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim(); }
function normalizeName(value) { return compactText(value).replace(/[\s　・･.．\-ー－_'’`]/g, '').toLowerCase(); }

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
  for (const match of raw.matchAll(/[（(](.*?)[）)]/g)) add(match[1]);
  return Array.from(keys);
}

function relPath(filePath) { return path.relative(ROOT, filePath).split(path.sep).join('/'); }

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

function safeCacheName(value) {
  const converted = Array.from(String(value || ''))
    .map(ch => /[A-Za-z0-9_.-]/.test(ch) ? ch : `u${ch.codePointAt(0).toString(16)}`)
    .join('');
  return (converted || 'empty').slice(0, 160);
}

function parseHeightWeight(value) {
  const m = String(value || '').normalize('NFKC').match(/(\d{2,3})\s*(?:cm)?\s*\/\s*(\d{2,3})\s*(?:kg)?/i);
  if (!m) return { height_cm: null, weight_kg: null };
  return { height_cm: Number(m[1]), weight_kg: Number(m[2]) };
}

async function readJsonSafe(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return fallback; }
}
async function readTextSafe(filePath) { try { return await fs.readFile(filePath, 'utf8'); } catch { return null; } }
async function writeText(filePath, text) { await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, text, 'utf8'); }
async function writeJson(filePath, data) { await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`); }

async function fetchWithTimeout(url, options = {}, timeoutMs = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 missing-name-only-profile-generator/1.0',
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

function parseIndexTail(text) {
  const plain = compactText(text);
  const m = plain.match(/^(.*?)\s+(\S+)\s+(GK|DF|MF|FW)(?:\s+(\d{4}\/\d{2}\/\d{2}))?(?:\s+(\d{2,3}\/\d{2,3}))?$/);
  if (!m) return { name_en: plain, final_team: '', position: '', birth_date: '', height_cm: null, weight_kg: null };
  const hw = parseHeightWeight(m[5] || '');
  return { name_en: compactText(m[1]), final_team: compactText(m[2]), position: m[3], birth_date: m[4] || '', height_cm: hw.height_cm, weight_kg: hw.weight_kg };
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
    if (!player_id || !name) continue;
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
  const cached = await readJsonSafe(masterCachePath, null);
  if (!force && Array.isArray(cached) && cached.length) {
    return cached.map(player => ({ ...player, name_keys: Array.isArray(player.name_keys) && player.name_keys.length ? player.name_keys : createNameKeys(player.name) }));
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

function recordFromCells(cells) {
  const values = cells.map(compactText).filter(Boolean);
  const yearIndex = values.findIndex(value => /^\d{4}$/.test(value));
  if (yearIndex === -1) return null;
  const row = values.slice(yearIndex);
  if (row.length < 7) return null;
  if (!/^(J1|J2|J3|Ｊ１|Ｊ２|Ｊ３)$/.test(row[2])) return null;
  return { season: row[0], team: compactText(row[1]), league: row[2].replace('Ｊ', 'J'), league_matches: row[3] || '', league_goals: row[4] || '', cup_matches: row[5] || '', cup_goals: row[6] || '' };
}

function dedupeAnnualRecords(records) {
  const seen = new Set();
  const out = [];
  for (const record of records) {
    const key = [record.season, record.team, record.league, record.league_matches, record.league_goals, record.cup_matches, record.cup_goals].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

function parseAnnualRecords(lines) {
  const records = [];
  for (const line of lines) {
    const m = compactText(line).match(/^(\d{4})\s+(.+?)\s+(J1|J2|J3|Ｊ１|Ｊ２|Ｊ３)\s+(.+)$/);
    if (!m) continue;
    const rest = m[4].split(/\s+/).filter(Boolean);
    records.push({ season: m[1], team: compactText(m[2]), league: m[3].replace('Ｊ', 'J'), league_matches: rest[0] || '', league_goals: rest[1] || '', cup_matches: rest[2] || '', cup_goals: rest[3] || '' });
  }
  for (let i = 0; i < lines.length; i += 1) {
    const record = recordFromCells(lines.slice(i, i + 7));
    if (record) { records.push(record); i += 6; }
  }
  return dedupeAnnualRecords(records);
}

function tableRowsFromHtml(html) {
  const rows = [];
  for (const tr of String(html || '').matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [];
    for (const cell of tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      const text = stripTags(cell[1]);
      if (text) cells.push(text);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseAnnualRecordsFromHtml(html) {
  const records = [];
  for (const cells of tableRowsFromHtml(html)) {
    const record = recordFromCells(cells);
    if (record) records.push(record);
    records.push(...parseAnnualRecords([compactText(cells.join(' '))]));
  }
  return dedupeAnnualRecords(records);
}

function parseFirstRecord(lines) { return lines.filter(line => !['初出場', '初得点'].includes(line)).slice(0, 6); }

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
  const htmlAnnual = parseAnnualRecordsFromHtml(html);
  const annual_records = htmlAnnual.length ? htmlAnnual : parseAnnualRecords(annualLines);
  return {
    source: 'jleague_data_site',
    source_confidence: 'name_only',
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

async function resolveMissingByNameOnly(name, club, masterByName) {
  const candidateMap = new Map();
  for (const key of createNameKeys(name)) {
    for (const indexPlayer of masterByName.get(key) || []) candidateMap.set(indexPlayer.player_id, indexPlayer);
  }
  const profiles = [];
  for (const indexPlayer of candidateMap.values()) {
    const profile = await fetchPlayerDetail(indexPlayer);
    profiles.push({
      ...profile,
      app_player_name: name,
      club,
      supplement: {
        source_script: 'scripts/fetch-missing-player-profiles-by-name.mjs',
        match_reason: 'matched_by_name_only',
        note: 'missing.jsonの名前とJ.LEAGUE Data Site全選手一覧の名前/別名キーが一致したため、所属歴確認なしで採用。残件が少なく、名前被りリスクを許容する最終補完用。'
      },
      history_hint: {
        from_missing_json: true,
        missing_name: name,
        index_name: indexPlayer.name,
        index_final_team: indexPlayer.final_team
      }
    });
  }
  return profiles;
}

function putProfile(clubJson, playerName, profiles) {
  if (!profiles.length) return;
  clubJson[playerName] = profiles.length === 1 ? profiles[0] : profiles;
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('Node.js 18以上で実行してください。');

  const missingPath = path.join(outputDir, 'missing.json');
  const missing = await readJsonSafe(missingPath, null);
  if (!missing) throw new Error(`missing.json が見つかりません: ${relPath(missingPath)}`);

  console.log('Building J.LEAGUE Data Site player master...');
  const master = await buildPlayerMaster();
  const masterByName = new Map();
  for (const player of master) {
    for (const key of player.name_keys || createNameKeys(player.name)) {
      if (!masterByName.has(key)) masterByName.set(key, []);
      masterByName.get(key).push(player);
    }
  }
  console.log(`Master players: ${master.length}`);

  const generatedAt = new Date().toISOString();
  const newMissing = {
    _meta: {
      generated_at: generatedAt,
      source: 'J.LEAGUE Data Site SFIX03/SFIX04',
      note: 'Names only. Remaining unresolved after final name-only supplement.'
    }
  };
  const summary = {};

  for (const club of clubs) {
    const config = CLUB_CONFIG[club];
    if (!config) continue;
    const clubPath = path.join(outputDir, config.outputFile);
    const clubJson = await readJsonSafe(clubPath, { _meta: {} });
    const names = Array.isArray(missing[club]) ? missing[club] : [];
    newMissing[club] = [];
    summary[club] = { total_missing_input: names.length, added: 0, still_missing: 0, duplicate_profile_names: 0, skipped_existing: 0 };

    console.log(`\n[${club}] ${names.length} missing names`);
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      process.stdout.write(`${String(i + 1).padStart(3, ' ')}/${names.length} ${name} ... `);
      if (Object.prototype.hasOwnProperty.call(clubJson, name)) {
        summary[club].skipped_existing += 1;
        console.log('SKIP existing');
        continue;
      }
      try {
        const profiles = await resolveMissingByNameOnly(name, club, masterByName);
        if (profiles.length) {
          putProfile(clubJson, name, profiles);
          summary[club].added += 1;
          if (profiles.length > 1) summary[club].duplicate_profile_names += 1;
          console.log(profiles.length === 1 ? `ADD player_id=${profiles[0].player_id}` : `ADD ${profiles.length} profiles`);
        } else {
          newMissing[club].push(name);
          summary[club].still_missing += 1;
          console.log('STILL MISSING');
        }
      } catch (error) {
        newMissing[club].push(name);
        summary[club].still_missing += 1;
        console.log(`ERROR ${error.message}`);
      }
    }

    clubJson._meta = {
      ...(clubJson._meta || {}),
      name_only_supplemented_at: generatedAt,
      name_only_supplement_source: 'scripts/fetch-missing-player-profiles-by-name.mjs'
    };
    await writeJson(clubPath, clubJson);
  }

  newMissing._meta.summary = summary;
  await writeJson(missingPath, newMissing);

  console.log('\nSaved:');
  for (const club of clubs) {
    if (CLUB_CONFIG[club]) console.log(`- ${relPath(path.join(outputDir, CLUB_CONFIG[club].outputFile))}`);
  }
  console.log(`- ${relPath(missingPath)}`);
  console.log('\nSummary:');
  console.log(summary);
}

main().catch(error => { console.error(error); process.exit(1); });
