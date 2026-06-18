#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'trapp', 'data', 'history');
const DEFAULT_OUTPUT = path.join(ROOT, 'trapp', 'data', 'players', 'profiles.json');
const DEFAULT_REPORT = path.join(ROOT, 'trapp', 'data', 'players', 'profile_resolution_report.json');
const DEFAULT_CACHE_DIR = path.join(ROOT, '.cache', 'jleague-player-profiles');

const CLUB_CONFIG = {
  niigata: {
    label: 'アルビレックス新潟',
    jleagueSlug: 'niigata',
    shortLabels: ['新潟', 'アルビレックス新潟', 'Albirex Niigata', 'ALBIREX']
  },
  kumamoto: {
    label: 'ロアッソ熊本',
    jleagueSlug: 'kumamoto',
    shortLabels: ['熊本', 'ロアッソ熊本', 'Roasso Kumamoto', 'ROASSO']
  }
};

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
const outputPath = path.resolve(getArg('--out', DEFAULT_OUTPUT));
const reportPath = path.resolve(getArg('--report', DEFAULT_REPORT));
const cacheDir = path.resolve(getArg('--cache', DEFAULT_CACHE_DIR));
const limit = Number(getArg('--limit', '0'));
const acceptScore = Number(getArg('--accept-score', '88'));
const pageDelayMs = Number(getArg('--page-delay', '500'));
const searchDelayMs = Number(getArg('--search-delay', '900'));
const force = hasFlag('--force');
const noSearch = hasFlag('--no-search');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compactText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return compactText(value).replace(/[\s　・･.．\-ー－_'’`]/g, '').toLowerCase();
}

function isExcludedName(value) {
  const raw = compactText(value);
  return EXCLUDED_PLAYER_NAMES.has(raw) || EXCLUDED_PLAYER_NAMES.has(normalizeName(raw));
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

function htmlToLines(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|dt|dd|tr|td|th|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n');
  return decodeHtmlEntities(text).split(/\r?\n/).map(compactText).filter(Boolean);
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function toIsoDate(value) {
  const raw = String(value || '').normalize('NFKC');
  const direct = raw.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (direct) return `${direct[1]}-${String(direct[2]).padStart(2, '0')}-${String(direct[3]).padStart(2, '0')}`;
  const tpl = raw.match(/\{\{\s*(?:birth date(?: and age)?|生年月日と年齢)\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i);
  if (tpl) return `${tpl[1]}-${String(tpl[2]).padStart(2, '0')}-${String(tpl[3]).padStart(2, '0')}`;
  return '';
}

function formatJapaneseDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(y)}/${Number(m)}/${Number(d)}`;
}

function parseHeightCm(value) {
  const raw = String(value || '').normalize('NFKC');
  let m = raw.match(/m\s*=\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) return Math.round(Number(m[1]) * 100);
  m = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*m\b/i);
  if (m) return Math.round(Number(m[1]) * 100);
  m = raw.match(/(\d{2,3})\s*cm/i);
  if (m) return Number(m[1]);
  m = raw.match(/身長\s*[:：]?\s*(\d{2,3})/);
  if (m) return Number(m[1]);
  return null;
}

function parseWeightKg(value) {
  const raw = String(value || '').normalize('NFKC');
  const m = raw.match(/(\d{2,3})\s*kg/i);
  return m ? Number(m[1]) : null;
}

function splitPreviousTeams(value) {
  if (!value) return [];
  const protectedText = String(value)
    .replace(/([UＵ])[-－ー](12|15|18|23)/g, '$1§$2')
    .replace(/J[-－ー](22|3)/gi, 'J§$1')
    .replace(/Ｊ[-－ー](22|３|3)/g, 'Ｊ§$1');
  return protectedText.split(/\s*[-－]\s*/g).map(v => v.replace(/§/g, '-').trim()).filter(Boolean);
}

function extractOgImage(html) {
  const source = String(html || '');
  const match = source.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || source.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? decodeHtmlEntities(match[1]) : '';
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : '';
}

function valueAfterLabel(lines, label) {
  const target = normalizeName(label);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!normalizeName(line).startsWith(target)) continue;
    const sameLine = line.replace(label, '').replace(/[：:]/, '').trim();
    if (sameLine && normalizeName(sameLine) !== target) return sameLine;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j]) return lines[j];
    }
  }
  return '';
}

function valueAfterHeading(lines, heading, stopHeadings = []) {
  const target = normalizeName(heading);
  const start = lines.findIndex(line => normalizeName(line) === target || normalizeName(line).startsWith(target));
  if (start === -1) return '';
  const stops = stopHeadings.map(normalizeName);
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const normalized = normalizeName(line);
    if (stops.some(stop => normalized === stop || normalized.startsWith(stop))) return '';
    return line;
  }
  return '';
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

async function listJsonFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile() && e.name.endsWith('.json')).map(e => path.join(dirPath, e.name)).sort();
  } catch { return []; }
}

function matchSideForClub(match, club) {
  const labels = CLUB_CONFIG[club]?.shortLabels || [club];
  const home = String(match.home_team || match.home || match.homeName || '');
  const away = String(match.away_team || match.away || match.awayName || '');
  if (labels.some(label => home.includes(label))) return 'home';
  if (labels.some(label => away.includes(label))) return 'away';
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
        file: path.relative(ROOT, file).replaceAll('\\', '/'),
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 football-profile-generator/3.0 (contact: local-script)',
        'Accept-Language': 'ja,en-US;q=0.8,en;q=0.6',
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function safeCacheName(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 140);
}

function decodeMaybeUrl(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function extractCandidateUrlsFromText(text) {
  const urls = new Set();
  const source = decodeHtmlEntities(String(text || ''));
  const chunks = [source];
  for (const match of source.matchAll(/[?&]uddg=([^&"']+)/g)) chunks.push(decodeMaybeUrl(match[1]));
  for (const chunk of chunks) {
    for (const match of chunk.matchAll(/https?:\/\/(?:www\.)?jleague\.jp\/(?:player\/\d+|club\/[a-z0-9_-]+\/player\/detail\/\d+\/?)/gi)) urls.add(match[0]);
    for (const match of chunk.matchAll(/https?:\/\/(?:ja|en)\.wikipedia\.org\/wiki\/[^\s"'<>]+/gi)) urls.add(match[0]);
  }
  return Array.from(urls).map(url => url.replace(/\?.*$/, '').replace(/#.*$/, ''));
}

function normalizeJleagueCandidate(url) {
  const id = String(url).match(/\/(\d+)\/?$/)?.[1] || '';
  if (!id) return null;
  const legacy = /\/club\/[^/]+\/player\/detail\//.test(url);
  return { type: 'jleague', kind: legacy ? 'jleague_legacy' : 'jleague_current', id, url };
}

function normalizeWikiCandidate(url) {
  const match = String(url).match(/^https?:\/\/(ja|en)\.wikipedia\.org\/wiki\/(.+)$/i);
  if (!match) return null;
  return { type: 'wikipedia', lang: match[1].toLowerCase(), title: decodeMaybeUrl(match[2]).replace(/_/g, ' '), url };
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (!c) continue;
    const key = c.type === 'jleague' ? `${c.type}:${c.url}` : `${c.type}:${c.lang}:${normalizeName(c.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

async function duckSearch(playerName, club) {
  if (noSearch) return [];
  const clubInfo = CLUB_CONFIG[club] || {};
  const queries = [
    `site:jleague.jp/club/${clubInfo.jleagueSlug}/player/detail "${playerName}"`,
    `site:jleague.jp/player "${playerName}" "${clubInfo.label}"`,
    `site:ja.wikipedia.org/wiki "${playerName}" サッカー`,
    `site:en.wikipedia.org/wiki "${playerName}" footballer`,
    `"${playerName}" "${clubInfo.label}" サッカー 選手`
  ];
  const candidates = [];
  for (const query of queries) {
    const cachePath = path.join(cacheDir, 'search', `${safeCacheName(club)}_${safeCacheName(playerName)}_${safeCacheName(query)}.html`);
    let html = !force ? await readTextSafe(cachePath) : null;
    if (!html) {
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=jp-jp`;
      const res = await fetchWithTimeout(url, { headers: { Accept: 'text/html,application/xhtml+xml' } });
      if (!res.ok) continue;
      html = await res.text();
      await writeText(cachePath, html);
      await sleep(searchDelayMs);
    }
    for (const url of extractCandidateUrlsFromText(html)) {
      candidates.push(normalizeJleagueCandidate(url) || normalizeWikiCandidate(url));
    }
  }
  return uniqueCandidates(candidates);
}

async function mediaWikiSearch(playerName, club) {
  const clubInfo = CLUB_CONFIG[club] || {};
  const jobs = [
    { lang: 'ja', query: `${playerName} サッカー` },
    { lang: 'ja', query: `${playerName} ${clubInfo.label}` },
    { lang: 'en', query: `${playerName} footballer` },
    { lang: 'en', query: `${playerName} ${clubInfo.shortLabels?.find(x => /[A-Za-z]/.test(x)) || ''}`.trim() }
  ];
  const candidates = [];
  for (const job of jobs) {
    const cachePath = path.join(cacheDir, 'wiki-search', `${job.lang}_${safeCacheName(job.query)}.json`);
    let data = !force ? await readJsonSafe(cachePath, null) : null;
    if (!data) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: job.query,
        srnamespace: '0',
        srlimit: '6',
        format: 'json',
        origin: '*'
      });
      const res = await fetchWithTimeout(`https://${job.lang}.wikipedia.org/w/api.php?${params}`);
      if (!res.ok) continue;
      data = await res.json();
      await writeJson(cachePath, data);
      await sleep(250);
    }
    for (const item of data?.query?.search || []) {
      if (!item?.title) continue;
      candidates.push({ type: 'wikipedia', lang: job.lang, title: item.title, url: `https://${job.lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(' ', '_'))}` });
    }
  }
  return uniqueCandidates(candidates);
}

async function fetchJleaguePage(candidate) {
  const cachePath = path.join(cacheDir, 'pages', `jleague_${candidate.id}_${safeCacheName(candidate.kind)}.html`);
  if (!force) {
    const cached = await readTextSafe(cachePath);
    if (cached) return cached;
  }
  const res = await fetchWithTimeout(candidate.url, { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (!res.ok) throw new Error(`JLeague HTTP ${res.status}: ${candidate.url}`);
  const html = await res.text();
  await writeText(cachePath, html);
  await sleep(pageDelayMs);
  return html;
}

function parseJleagueProfile(html, candidate, appPlayerName, club) {
  const lines = htmlToLines(html);
  const title = extractTitle(html);
  const posIndex = lines.findIndex(line => /^(GK|DF|MF|FW)\s+\d+/.test(line));
  let position = '';
  let number = '';
  let officialName = appPlayerName;
  let nameEn = '';
  if (posIndex !== -1) {
    const posMatch = lines[posIndex].match(/^(GK|DF|MF|FW)\s+(\d+)/);
    if (posMatch) { position = posMatch[1]; number = posMatch[2]; }
    const maybeName = lines[posIndex + 1] || '';
    const maybeEn = lines[posIndex + 2] || '';
    if (maybeName && !maybeName.includes('生年月日')) officialName = maybeName.replace(/^#+\s*/, '').trim();
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]+$/.test(maybeEn)) nameEn = maybeEn.trim();
  }
  const birthDateRaw = valueAfterLabel(lines, '生年月日');
  const heightWeightRaw = valueAfterLabel(lines, '身長/体重');
  const birthplace = valueAfterLabel(lines, '出生地※') || valueAfterLabel(lines, '出生地');
  const firstMatchRaw = valueAfterLabel(lines, 'Ｊリーグ初出場');
  const firstGoalRaw = valueAfterLabel(lines, 'Ｊリーグ初得点');
  const previousTeamsRaw = valueAfterHeading(lines, '前所属チーム', ['選手スタッツ', '選手リンク', '最新フォト', '最新動画']);
  const hw = String(heightWeightRaw).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  return {
    app_player_name: appPlayerName,
    official_name: officialName,
    name: officialName,
    name_en: nameEn,
    normalized_names: Array.from(new Set([normalizeName(appPlayerName), normalizeName(officialName), normalizeName(nameEn)].filter(Boolean))),
    club,
    jleague_id: candidate.id,
    position,
    number,
    birth_date: birthDateRaw,
    birth_date_iso: toIsoDate(birthDateRaw),
    height_cm: hw ? Number(hw[1]) : null,
    weight_kg: hw ? Number(hw[2]) : null,
    birthplace,
    first_jleague_match: firstMatchRaw,
    first_jleague_match_iso: toIsoDate(firstMatchRaw),
    first_jleague_goal: firstGoalRaw,
    first_jleague_goal_iso: toIsoDate(firstGoalRaw),
    previous_teams: splitPreviousTeams(previousTeamsRaw),
    previous_teams_raw: previousTeamsRaw,
    image_url: extractOgImage(html),
    links: { jleague: candidate.url },
    sources: [{ type: candidate.kind, url: candidate.url }],
    source: candidate.kind,
    source_url: candidate.url,
    source_title: title,
    source_confidence: 'high',
    fetched_at: new Date().toISOString()
  };
}

async function fetchWikiPage(candidate) {
  const cachePath = path.join(cacheDir, 'wiki-pages', `${candidate.lang}_${safeCacheName(candidate.title)}.json`);
  if (!force) {
    const cached = await readJsonSafe(cachePath, null);
    if (cached) return cached;
  }
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions|pageprops|extracts',
    rvprop: 'content',
    rvslots: 'main',
    exintro: '1',
    explaintext: '1',
    titles: candidate.title,
    formatversion: '2',
    format: 'json',
    origin: '*'
  });
  const res = await fetchWithTimeout(`https://${candidate.lang}.wikipedia.org/w/api.php?${params}`);
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}: ${candidate.url}`);
  const data = await res.json();
  await writeJson(cachePath, data);
  await sleep(250);
  return data;
}

function fieldMapFromInfobox(wikitext) {
  const lines = String(wikitext || '').split(/\r?\n/);
  const fields = new Map();
  let inBox = false;
  for (const line of lines) {
    if (!inBox && /\{\{\s*Infobox/i.test(line)) { inBox = true; continue; }
    if (!inBox) continue;
    if (/^\}\}/.test(line)) break;
    const m = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (m) fields.set(normalizeName(m[1]), m[2].trim());
  }
  return fields;
}

function cleanWikiValue(value) {
  return stripTags(String(value || '')
    .replace(/<!--.*?-->/g, '')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{flagicon\|[^}]+\}\}/gi, '')
    .replace(/\{\{nowrap\|([^}]+)\}\}/gi, '$1')
    .replace(/\{\{small\|([^}]+)\}\}/gi, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, ''));
}

function parseWikiClubs(fields) {
  const career = [];
  for (let i = 1; i <= 40; i += 1) {
    const club = cleanWikiValue(fields.get(`clubs${i}`) || fields.get(`club${i}`) || '');
    const years = cleanWikiValue(fields.get(`years${i}`) || '');
    if (club) career.push({ years, club });
  }
  for (let i = 1; i <= 30; i += 1) {
    const club = cleanWikiValue(fields.get(`youthclubs${i}`) || '');
    const years = cleanWikiValue(fields.get(`youthyears${i}`) || '');
    if (club) career.unshift({ years, club, type: 'youth' });
  }
  return career;
}

function parseWikiProfile(data, candidate, appPlayerName, club) {
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`Wikipedia page missing: ${candidate.title}`);
  const wikitext = page.revisions?.[0]?.slots?.main?.content || '';
  const extract = page.extract || '';
  const fields = fieldMapFromInfobox(wikitext);
  const rawName = cleanWikiValue(fields.get('name') || fields.get('fullname') || page.title || appPlayerName);
  const birthRaw = fields.get('birthdate') || fields.get('dateofbirth') || '';
  const birthIso = toIsoDate(birthRaw);
  const heightRaw = fields.get('height') || '';
  const weightRaw = fields.get('weight') || '';
  const career = parseWikiClubs(fields);
  const jleagueUrls = Array.from(new Set(extractCandidateUrlsFromText(wikitext).filter(url => url.includes('jleague.jp'))));
  return {
    app_player_name: appPlayerName,
    official_name: rawName,
    name: rawName,
    name_en: candidate.lang === 'en' ? rawName : '',
    normalized_names: Array.from(new Set([normalizeName(appPlayerName), normalizeName(rawName), normalizeName(page.title)].filter(Boolean))),
    club,
    position: cleanWikiValue(fields.get('position') || ''),
    number: cleanWikiValue(fields.get('clubnumber') || ''),
    birth_date: formatJapaneseDate(birthIso),
    birth_date_iso: birthIso,
    height_cm: parseHeightCm(heightRaw),
    weight_kg: parseWeightKg(weightRaw),
    birthplace: cleanWikiValue(fields.get('birthplace') || fields.get('placeofbirth') || ''),
    first_jleague_match: '',
    first_jleague_match_iso: '',
    first_jleague_goal: '',
    first_jleague_goal_iso: '',
    previous_teams: career.map(row => row.years ? `${row.years} ${row.club}` : row.club),
    career,
    image_url: '',
    links: {
      wikipedia: candidate.url,
      ...(jleagueUrls[0] ? { jleague: jleagueUrls[0] } : {})
    },
    wikidata_id: page.pageprops?.wikibase_item || '',
    sources: [{ type: `wikipedia_${candidate.lang}`, url: candidate.url }],
    source: `wikipedia_${candidate.lang}`,
    source_url: candidate.url,
    source_title: page.title,
    source_extract: extract,
    source_confidence: 'medium',
    fetched_at: new Date().toISOString()
  };
}

async function fetchWikidataEntity(qid) {
  if (!qid) return null;
  const cachePath = path.join(cacheDir, 'wikidata', `${qid}.json`);
  if (!force) {
    const cached = await readJsonSafe(cachePath, null);
    if (cached) return cached;
  }
  const res = await fetchWithTimeout(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  await writeJson(cachePath, data);
  await sleep(200);
  return data;
}

function firstClaimValue(entity, prop) {
  const claim = entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  return claim || null;
}

function mergeWikidata(profile, entityData) {
  const entity = entityData?.entities?.[profile.wikidata_id];
  if (!entity) return profile;
  const birth = firstClaimValue(entity, 'P569');
  if (!profile.birth_date_iso && birth?.time) {
    const iso = birth.time.replace(/^\+/, '').slice(0, 10);
    profile.birth_date_iso = iso;
    profile.birth_date = formatJapaneseDate(iso);
  }
  const height = firstClaimValue(entity, 'P2048');
  if (!profile.height_cm && height?.amount) {
    const n = Math.abs(Number(height.amount));
    profile.height_cm = n < 3 ? Math.round(n * 100) : Math.round(n);
  }
  profile.sources = [...(profile.sources || []), { type: 'wikidata', url: `https://www.wikidata.org/wiki/${profile.wikidata_id}` }];
  profile.links = { ...(profile.links || {}), wikidata: `https://www.wikidata.org/wiki/${profile.wikidata_id}` };
  return profile;
}

function scoreProfile(profile, player, club) {
  const target = normalizeName(player.name);
  const names = [profile.app_player_name, profile.official_name, profile.name, profile.name_en, profile.source_title, ...(profile.normalized_names || [])].map(normalizeName).filter(Boolean);
  const clubLabels = (CLUB_CONFIG[club]?.shortLabels || []).map(normalizeName);
  const careerText = normalizeName([...(profile.previous_teams || []), ...(profile.career || []).map(row => row.club || '')].join(' '));
  const titleText = normalizeName(profile.source_title || '');
  const extractText = normalizeName(profile.source_extract || '');
  let score = 0;
  const reasons = [];
  if (names.some(name => name === target)) { score += 82; reasons.push('name_exact'); }
  else if (names.some(name => name.includes(target) || target.includes(name))) { score += 48; reasons.push('name_partial'); }
  if (clubLabels.some(label => label && (careerText.includes(label) || titleText.includes(label) || extractText.includes(label)))) { score += 28; reasons.push('club_or_career_match'); }
  if ((profile.links?.jleague || profile.jleague_id) && profile.source?.startsWith('jleague')) { score += 12; reasons.push('jleague_source'); }
  if (profile.source?.startsWith('wikipedia')) { score += 6; reasons.push('wikipedia_source'); }
  if (profile.birth_date_iso) { score += 4; reasons.push('has_birthdate'); }
  if (profile.height_cm) { score += 4; reasons.push('has_height'); }
  if (player.positions.some(position => profile.position && normalizeName(profile.position).includes(normalizeName(position)))) { score += 5; reasons.push('position_match'); }
  if (player.numbers.some(number => profile.number && String(profile.number) === String(number))) { score += 5; reasons.push('number_match'); }
  if (/footballer|サッカー|soccer/.test(String(profile.source_extract || profile.source_title || '').toLowerCase())) { score += 5; reasons.push('football_context'); }
  return { score, reasons };
}

function attachResolver(profile, player, status, score, reasons, candidates) {
  return {
    ...profile,
    resolver: {
      status,
      score,
      reasons,
      candidates: candidates.map(c => ({
        type: c.type,
        kind: c.kind,
        lang: c.lang,
        title: c.title,
        id: c.id,
        url: c.url,
        score: c.score,
        name: c.profile?.name || '',
        source: c.profile?.source || '',
        error: c.error || undefined
      }))
    },
    history_hint: {
      numbers: player.numbers,
      positions: player.positions,
      appearances_in_history: player.appearances_in_history,
      sample_sources: player.sample_sources
    }
  };
}

async function resolvePlayer(player, club) {
  const discovered = uniqueCandidates([...(await duckSearch(player.name, club)), ...(await mediaWikiSearch(player.name, club))]);
  const evaluated = [];

  for (const candidate of discovered) {
    try {
      if (candidate.type === 'jleague') {
        const html = await fetchJleaguePage(candidate);
        const profile = parseJleagueProfile(html, candidate, player.name, club);
        const scored = scoreProfile(profile, player, club);
        evaluated.push({ ...candidate, score: scored.score, reasons: scored.reasons, profile });
      } else if (candidate.type === 'wikipedia') {
        const data = await fetchWikiPage(candidate);
        let profile = parseWikiProfile(data, candidate, player.name, club);
        if (profile.wikidata_id) profile = mergeWikidata(profile, await fetchWikidataEntity(profile.wikidata_id));
        const wikiJleagueCandidates = (profile.links?.jleague ? [normalizeJleagueCandidate(profile.links.jleague)] : []).filter(Boolean);
        for (const jl of wikiJleagueCandidates) {
          try {
            const html = await fetchJleaguePage(jl);
            const jlProfile = parseJleagueProfile(html, jl, player.name, club);
            const scored = scoreProfile(jlProfile, player, club);
            evaluated.push({ ...jl, score: scored.score + 4, reasons: [...scored.reasons, 'found_from_wikipedia'], profile: jlProfile });
          } catch {}
        }
        const scored = scoreProfile(profile, player, club);
        evaluated.push({ ...candidate, score: scored.score, reasons: scored.reasons, profile });
      }
    } catch (error) {
      evaluated.push({ ...candidate, score: 0, reasons: ['fetch_or_parse_failed'], error: error.message });
    }
  }

  evaluated.sort((a, b) => (b.score || 0) - (a.score || 0));
  const best = evaluated[0] || null;
  const second = evaluated[1] || null;
  if (best?.profile && best.score >= acceptScore && !(second && second.score === best.score)) {
    const status = best.profile.source?.startsWith('wikipedia') ? 'matched_wikipedia' : 'matched';
    return { status, profile: attachResolver(best.profile, player, status, best.score, best.reasons, evaluated), candidates: evaluated };
  }
  return { status: evaluated.length ? 'needs_review' : 'not_found', profile: null, candidates: evaluated };
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('Node.js 18以上で実行してください。');
  const output = {
    _meta: {
      generated_at: new Date().toISOString(),
      source: 'JLeague current/legacy pages + Wikipedia/Wikidata',
      script: 'scripts/fetch-jleague-player-profiles-auto.mjs',
      accept_score: acceptScore
    }
  };
  const report = { generated_at: new Date().toISOString(), clubs: {}, summary: { total_players: 0, matched: 0, matched_wikipedia: 0, needs_review: 0, not_found: 0 } };

  for (const club of clubs) {
    if (!CLUB_CONFIG[club]) { console.warn(`Unknown club skipped: ${club}`); continue; }
    const players = await collectHistoryPlayers(club);
    const targets = limit > 0 ? players.slice(0, limit) : players;
    output[club] = {};
    report.clubs[club] = { label: CLUB_CONFIG[club].label, total_players: targets.length, matched: [], matched_wikipedia: [], needs_review: [], not_found: [] };
    report.summary.total_players += targets.length;
    console.log(`\n[${club}] ${targets.length} players`);

    for (let i = 0; i < targets.length; i += 1) {
      const player = targets[i];
      process.stdout.write(`${String(i + 1).padStart(3, ' ')}/${targets.length} ${player.name} ... `);
      try {
        const resolved = await resolvePlayer(player, club);
        if (resolved.profile) {
          output[club][player.name] = resolved.profile;
          report.clubs[club][resolved.status].push({ name: player.name, source: resolved.profile.source, score: resolved.profile.resolver.score, url: resolved.profile.source_url || resolved.profile.links?.wikipedia || '' });
          report.summary[resolved.status] += 1;
          console.log(`OK ${resolved.profile.source} score=${resolved.profile.resolver.score}`);
        } else {
          const row = { name: player.name, history_hint: player, candidates: resolved.candidates.map(c => ({ type: c.type, kind: c.kind, lang: c.lang, title: c.title, id: c.id, url: c.url, score: c.score, name: c.profile?.name || '', source: c.profile?.source || '', reasons: c.reasons, error: c.error || undefined })) };
          report.clubs[club][resolved.status].push(row);
          report.summary[resolved.status] += 1;
          console.log(resolved.status === 'needs_review' ? 'REVIEW' : 'NOT FOUND');
        }
      } catch (error) {
        report.clubs[club].not_found.push({ name: player.name, history_hint: player, error: error.message });
        report.summary.not_found += 1;
        console.log(`ERROR ${error.message}`);
      }
    }
  }

  await writeJson(outputPath, output);
  await writeJson(reportPath, report);
  console.log('\nSaved:');
  console.log(`- ${path.relative(ROOT, outputPath).replaceAll('\\', '/')}`);
  console.log(`- ${path.relative(ROOT, reportPath).replaceAll('\\', '/')}`);
  console.log('\nSummary:');
  console.log(report.summary);
}

main().catch(error => { console.error(error); process.exit(1); });
