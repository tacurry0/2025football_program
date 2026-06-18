#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const HISTORY_DIR = path.join(ROOT, "trapp", "data", "history");
const DEFAULT_OUTPUT = path.join(ROOT, "trapp", "data", "players", "profiles.json");
const DEFAULT_REPORT = path.join(ROOT, "trapp", "data", "players", "profile_resolution_report.json");
const DEFAULT_CACHE_DIR = path.join(ROOT, ".cache", "jleague-player-profiles");

const CLUB_CONFIG = {
  niigata: {
    label: "アルビレックス新潟",
    shortLabels: ["新潟", "アルビレックス新潟", "ALBIREX", "Albirex"]
  },
  kumamoto: {
    label: "ロアッソ熊本",
    shortLabels: ["熊本", "ロアッソ熊本", "ROASSO", "Roasso"]
  }
};

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const clubs = String(getArg("--clubs", "niigata,kumamoto"))
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);
const outputPath = path.resolve(getArg("--out", DEFAULT_OUTPUT));
const reportPath = path.resolve(getArg("--report", DEFAULT_REPORT));
const cacheDir = path.resolve(getArg("--cache", DEFAULT_CACHE_DIR));
const limit = Number(getArg("--limit", "0"));
const searchDelayMs = Number(getArg("--search-delay", "1200"));
const pageDelayMs = Number(getArg("--page-delay", "600"));
const acceptScore = Number(getArg("--accept-score", "105"));
const maxCandidates = Number(getArg("--max-candidates", "6"));
const force = hasFlag("--force");
const noSearch = hasFlag("--no-search");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\s　・･.．\-ー－_]/g, "")
    .toLowerCase()
    .trim();
}

function compactText(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function htmlToLines(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|dt|dd|tr|td|th|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");

  return decodeHtmlEntities(text)
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function valueAfterLabel(lines, label) {
  const normalizedLabel = normalizeName(label);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const normalizedLine = normalizeName(line);
    if (!normalizedLine.startsWith(normalizedLabel)) continue;

    const sameLine = line.replace(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), "").trim();
    if (sameLine && normalizeName(sameLine) !== normalizedLabel) return sameLine;

    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j]) return lines[j];
    }
  }
  return "";
}

function valueAfterHeading(lines, heading, stopHeadings = []) {
  const target = normalizeName(heading);
  const start = lines.findIndex(line => normalizeName(line) === target || normalizeName(line).startsWith(target));
  if (start === -1) return "";

  const stopSet = stopHeadings.map(normalizeName);
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const normalized = normalizeName(line);
    if (stopSet.some(stop => normalized === stop || normalized.startsWith(stop))) return "";
    return line;
  }
  return "";
}

function toIsoDate(value) {
  const match = String(value || "").match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function parseHeightWeight(value) {
  const match = String(value || "").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { height_cm: null, weight_kg: null };
  return { height_cm: Number(match[1]), weight_kg: Number(match[2]) };
}

function splitPreviousTeams(value) {
  if (!value) return [];
  const protectedText = String(value)
    .replace(/([UＵ])[-－ー](12|15|18|23)/g, "$1§$2")
    .replace(/Ｊ[-－ー](22|３|3)/g, "Ｊ§$1");

  return protectedText
    .split(/\s*[-－]\s*/g)
    .map(team => team.replace(/§/g, "-").trim())
    .filter(Boolean);
}

function extractOgImage(html) {
  const source = String(html || "");
  const match = source.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || source.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? decodeHtmlEntities(match[1]) : "";
}

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? compactText(decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ""))) : "";
}

function parseJleagueProfile(html, id, appPlayerName, club) {
  const lines = htmlToLines(html);
  const title = extractTitle(html);
  const posIndex = lines.findIndex(line => /^(GK|DF|MF|FW)\s+\d+/.test(line));

  let position = "";
  let number = "";
  let officialName = appPlayerName;
  let nameEn = "";

  if (posIndex !== -1) {
    const posMatch = lines[posIndex].match(/^(GK|DF|MF|FW)\s+(\d+)/);
    if (posMatch) {
      position = posMatch[1];
      number = posMatch[2];
    }
    const maybeName = lines[posIndex + 1] || "";
    const maybeEn = lines[posIndex + 2] || "";
    if (maybeName && !maybeName.includes("生年月日")) officialName = maybeName.replace(/^#+\s*/, "").trim();
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]+$/.test(maybeEn)) nameEn = maybeEn.trim();
  }

  if (officialName === appPlayerName) {
    const h1Match = lines.find(line => line.includes(" | ") && normalizeName(line).includes(normalizeName(appPlayerName)));
    if (h1Match) officialName = h1Match.split("|")[0].replace(/^#+\s*/, "").trim() || officialName;
  }

  const birthDateRaw = valueAfterLabel(lines, "生年月日");
  const heightWeightRaw = valueAfterLabel(lines, "身長/体重");
  const birthplace = valueAfterLabel(lines, "出生地※") || valueAfterLabel(lines, "出生地");
  const firstMatchRaw = valueAfterLabel(lines, "Ｊリーグ初出場");
  const firstGoalRaw = valueAfterLabel(lines, "Ｊリーグ初得点");
  const previousTeamsRaw = valueAfterHeading(lines, "前所属チーム", ["選手スタッツ", "選手リンク", "最新フォト", "最新動画"]);
  const previousTeams = splitPreviousTeams(previousTeamsRaw);
  const { height_cm, weight_kg } = parseHeightWeight(heightWeightRaw);
  const sourceUpdatedAt = valueAfterLabel(lines, "更新日：") || valueAfterLabel(lines, "更新日");

  const profile = {
    app_player_name: appPlayerName,
    official_name: officialName,
    name: officialName,
    name_en: nameEn,
    normalized_names: Array.from(new Set([
      normalizeName(appPlayerName),
      normalizeName(officialName),
      normalizeName(nameEn)
    ].filter(Boolean))),
    club,
    jleague_id: String(id),
    position,
    number,
    birth_date: birthDateRaw,
    birth_date_iso: toIsoDate(birthDateRaw),
    height_cm,
    weight_kg,
    birthplace,
    first_jleague_match: firstMatchRaw,
    first_jleague_match_iso: toIsoDate(firstMatchRaw),
    first_jleague_goal: firstGoalRaw,
    first_jleague_goal_iso: toIsoDate(firstGoalRaw),
    previous_teams: previousTeams,
    previous_teams_raw: previousTeamsRaw,
    image_url: extractOgImage(html),
    links: {
      jleague: `https://www.jleague.jp/player/${id}`
    },
    source: "jleague",
    source_url: `https://www.jleague.jp/player/${id}`,
    source_title: title,
    source_updated_at: sourceUpdatedAt,
    fetched_at: new Date().toISOString()
  };

  return profile;
}

function extractJleagueIdsFromText(text) {
  const ids = new Set();
  const source = decodeHtmlEntities(String(text || ""));

  const decodedCandidates = [source];
  for (const match of source.matchAll(/[?&]uddg=([^&]+)/g)) {
    try {
      decodedCandidates.push(decodeURIComponent(match[1]));
    } catch {}
  }

  for (const candidate of decodedCandidates) {
    for (const match of candidate.matchAll(/https?:\/\/(?:www\.)?jleague\.jp\/player\/(\d+)/g)) {
      ids.add(match[1]);
    }
    for (const match of candidate.matchAll(/\/player\/(\d+)/g)) {
      ids.add(match[1]);
    }
  }

  return Array.from(ids);
}

async function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readTextSafe(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

async function listJsonFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => path.join(dirPath, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function matchSideForClub(match, club) {
  const labels = CLUB_CONFIG[club]?.shortLabels || [club];
  const home = String(match.home_team || match.home || match.homeName || "");
  const away = String(match.away_team || match.away || match.awayName || "");

  if (labels.some(label => home.includes(label))) return "home";
  if (labels.some(label => away.includes(label))) return "away";
  return null;
}

function collectPlayersFromDetails(details, players, sourceInfo) {
  if (!details || typeof details !== "object") return;
  const keys = ["starting", "substitutes", "substitute", "bench", "members", "reserve"];
  for (const key of keys) {
    const rows = Array.isArray(details[key]) ? details[key] : [];
    for (const row of rows) {
      if (!row || !row.name) continue;
      const name = compactText(row.name);
      if (!name) continue;
      if (!players.has(name)) {
        players.set(name, {
          name,
          numbers: new Set(),
          positions: new Set(),
          sources: []
        });
      }
      const player = players.get(name);
      if (row.number) player.numbers.add(String(row.number));
      if (row.position) player.positions.add(String(row.position));
      if (sourceInfo) player.sources.push(sourceInfo);
    }
  }
}

function collectGoalNames(goals, players, sourceInfo) {
  const rows = Array.isArray(goals) ? goals : [];
  for (const row of rows) {
    if (!row || !row.name) continue;
    const name = compactText(row.name);
    if (!name) continue;
    if (!players.has(name)) {
      players.set(name, {
        name,
        numbers: new Set(),
        positions: new Set(),
        sources: []
      });
    }
    if (sourceInfo) players.get(name).sources.push({ ...sourceInfo, event: "goal" });
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
        file: path.relative(ROOT, file).replaceAll("\\", "/"),
        match_card_id: match.match_card_id || match.match_id || "",
        date: match.date || "",
        opponent: side === "home" ? (match.away_team || "") : (match.home_team || "")
      };
      collectPlayersFromDetails(match[`${side}_details`], players, sourceInfo);
      collectGoalNames(match[`${side}_goals`], players, sourceInfo);
    }
  }

  return Array.from(players.values()).map(player => ({
    name: player.name,
    numbers: Array.from(player.numbers).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "ja")),
    positions: Array.from(player.positions).sort(),
    appearances_in_history: player.sources.length,
    sample_sources: player.sources.slice(0, 3)
  })).sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 jleague-profile-json-generator/2.0",
        "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function safeCacheName(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, "_");
}

async function searchCandidateIds(playerName, club) {
  const cachePath = path.join(cacheDir, "search", `${safeCacheName(club)}_${safeCacheName(playerName)}.html`);
  if (!force) {
    const cached = await readTextSafe(cachePath);
    if (cached) return extractJleagueIdsFromText(cached);
  }

  if (noSearch) return [];

  const clubLabel = CLUB_CONFIG[club]?.label || club;
  const query = `site:jleague.jp/player/ "${playerName}" "${clubLabel}"`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=jp-jp`;

  const res = await fetchWithTimeout(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const html = await res.text();
  await writeText(cachePath, html);
  await sleep(searchDelayMs);

  let ids = extractJleagueIdsFromText(html);

  if (!ids.length) {
    const fallbackQuery = `site:jleague.jp/player/ "${playerName}"`;
    const fallbackUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(fallbackQuery)}&kl=jp-jp`;
    const fallbackRes = await fetchWithTimeout(fallbackUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    if (fallbackRes.ok) {
      const fallbackHtml = await fallbackRes.text();
      await writeText(cachePath.replace(/\.html$/, ".fallback.html"), fallbackHtml);
      ids = extractJleagueIdsFromText(fallbackHtml);
      await sleep(searchDelayMs);
    }
  }

  return ids;
}

async function fetchJleaguePage(id) {
  const cachePath = path.join(cacheDir, "pages", `${id}.html`);
  if (!force) {
    const cached = await readTextSafe(cachePath);
    if (cached) return cached;
  }

  const url = `https://www.jleague.jp/player/${id}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) throw new Error(`player HTTP ${res.status}: ${url}`);

  const html = await res.text();
  await writeText(cachePath, html);
  await sleep(pageDelayMs);
  return html;
}

function scoreCandidate(profile, player, club) {
  const target = normalizeName(player.name);
  const official = normalizeName(profile.name || profile.official_name);
  const app = normalizeName(profile.app_player_name);
  const en = normalizeName(profile.name_en);
  const title = normalizeName(profile.source_title);
  const previousTeams = Array.isArray(profile.previous_teams) ? profile.previous_teams : [];
  const previousNormalized = previousTeams.map(normalizeName);
  const clubLabels = CLUB_CONFIG[club]?.shortLabels || [club];
  const clubNormalized = clubLabels.map(normalizeName);

  let score = 0;
  const reasons = [];

  if (official && official === target) {
    score += 100;
    reasons.push("official_name_exact");
  } else if (app && app === target) {
    score += 90;
    reasons.push("app_name_exact");
  } else if (official && (official.includes(target) || target.includes(official))) {
    score += 55;
    reasons.push("official_name_partial");
  } else if (en && en === target) {
    score += 40;
    reasons.push("english_name_exact");
  }

  if (title && title.includes(target)) {
    score += 20;
    reasons.push("title_contains_name");
  }

  const clubHit = clubNormalized.some(label => {
    if (!label) return false;
    if (normalizeName(profile.source_title).includes(label)) return true;
    if (previousNormalized.some(team => team.includes(label) || label.includes(team))) return true;
    return false;
  });

  if (clubHit) {
    score += 25;
    reasons.push("club_or_career_match");
  }

  const numberHit = player.numbers.some(number => profile.number && String(profile.number) === String(number));
  if (numberHit) {
    score += 8;
    reasons.push("number_match");
  }

  const positionHit = player.positions.some(position => profile.position && String(profile.position) === String(position));
  if (positionHit) {
    score += 6;
    reasons.push("position_match");
  }

  if (profile.birth_date_iso) {
    score += 3;
    reasons.push("has_birthdate");
  }

  return { score, reasons };
}

async function resolvePlayer(player, club) {
  const ids = Array.from(new Set((await searchCandidateIds(player.name, club)).slice(0, maxCandidates)));
  const candidates = [];

  for (const id of ids) {
    try {
      const html = await fetchJleaguePage(id);
      const profile = parseJleagueProfile(html, id, player.name, club);
      const scored = scoreCandidate(profile, player, club);
      candidates.push({
        id,
        score: scored.score,
        reasons: scored.reasons,
        profile
      });
    } catch (error) {
      candidates.push({
        id,
        score: 0,
        reasons: ["fetch_or_parse_failed"],
        error: error.message
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  const best = candidates[0] || null;
  const second = candidates[1] || null;
  const ambiguous = best && second && best.score === second.score && best.score >= acceptScore;

  if (best && best.profile && best.score >= acceptScore && !ambiguous) {
    return {
      status: "matched",
      profile: {
        ...best.profile,
        resolver: {
          status: "matched",
          score: best.score,
          reasons: best.reasons,
          candidates: candidates.map(candidate => ({
            id: candidate.id,
            score: candidate.score,
            reasons: candidate.reasons,
            name: candidate.profile?.name || "",
            title: candidate.profile?.source_title || "",
            url: `https://www.jleague.jp/player/${candidate.id}`
          }))
        },
        history_hint: {
          numbers: player.numbers,
          positions: player.positions,
          appearances_in_history: player.appearances_in_history,
          sample_sources: player.sample_sources
        }
      },
      candidates
    };
  }

  return {
    status: candidates.length ? "needs_review" : "not_found",
    profile: null,
    candidates
  };
}

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18以上で実行してください。Node 18未満は fetch がありません。");
  }

  const output = {
    _meta: {
      generated_at: new Date().toISOString(),
      source: "J.LEAGUE.jp player pages discovered by web search",
      script: "scripts/fetch-jleague-player-profiles-auto.mjs",
      accept_score: acceptScore
    }
  };

  const report = {
    generated_at: new Date().toISOString(),
    clubs: {},
    summary: {
      total_players: 0,
      matched: 0,
      needs_review: 0,
      not_found: 0
    }
  };

  for (const club of clubs) {
    if (!CLUB_CONFIG[club]) {
      console.warn(`Unknown club skipped: ${club}`);
      continue;
    }

    const players = await collectHistoryPlayers(club);
    const targets = limit > 0 ? players.slice(0, limit) : players;
    output[club] = {};
    report.clubs[club] = {
      label: CLUB_CONFIG[club].label,
      total_players: targets.length,
      matched: [],
      needs_review: [],
      not_found: []
    };
    report.summary.total_players += targets.length;

    console.log(`\n[${club}] ${targets.length} players`);

    for (let i = 0; i < targets.length; i += 1) {
      const player = targets[i];
      process.stdout.write(`${String(i + 1).padStart(3, " ")}/${targets.length} ${player.name} ... `);

      try {
        const resolved = await resolvePlayer(player, club);
        if (resolved.status === "matched") {
          output[club][player.name] = resolved.profile;
          report.clubs[club].matched.push({
            name: player.name,
            jleague_id: resolved.profile.jleague_id,
            score: resolved.profile.resolver.score,
            url: resolved.profile.source_url
          });
          report.summary.matched += 1;
          console.log(`OK ${resolved.profile.jleague_id} score=${resolved.profile.resolver.score}`);
        } else {
          const row = {
            name: player.name,
            history_hint: player,
            candidates: resolved.candidates.map(candidate => ({
              id: candidate.id,
              score: candidate.score,
              reasons: candidate.reasons,
              name: candidate.profile?.name || "",
              title: candidate.profile?.source_title || "",
              url: `https://www.jleague.jp/player/${candidate.id}`,
              error: candidate.error || undefined
            }))
          };
          report.clubs[club][resolved.status].push(row);
          report.summary[resolved.status] += 1;
          console.log(resolved.status === "needs_review" ? "REVIEW" : "NOT FOUND");
        }
      } catch (error) {
        report.clubs[club].not_found.push({
          name: player.name,
          history_hint: player,
          error: error.message
        });
        report.summary.not_found += 1;
        console.log(`ERROR ${error.message}`);
      }
    }
  }

  await writeJson(outputPath, output);
  await writeJson(reportPath, report);

  console.log("\nSaved:");
  console.log(`- ${path.relative(ROOT, outputPath).replaceAll("\\", "/")}`);
  console.log(`- ${path.relative(ROOT, reportPath).replaceAll("\\", "/")}`);
  console.log("\nSummary:");
  console.log(report.summary);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
