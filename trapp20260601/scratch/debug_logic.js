
const resultsData = {"status":200,"timestamp":"2026-04-20T08:51:48.386Z","fromCache":false,"data":[{"section":11,"date":"2026-04-18","home":"新潟","away":"今治の試合詳細","home_score":"1","away_score":"0","pk":"","status":"finished"},{"section":11,"date":"2026-04-17","home":"FC大阪","away":"愛媛の試合詳細","home_score":"0","away_score":"1","pk":"","status":"finished"}]};

const normalizeName = (s) => (s || "").normalize("NFKC").trim();
const cleanGas = (nm) => (nm || "").replace("の試合詳細", "").replace("の結果", "").trim();

const FULL_KWS = ["FC東京","FC大阪","FC今治","FC岐阜","FC琉球","YS横浜","京都サンガF.C.","鹿島アントラーズ","浦和レッズ","ガンバ大阪","セレッソ大阪","ヴィッセル神戸"];

const teamMatch = (gasName, kw) => {
  const c = normalizeName(cleanGas(gasName));
  const nKw = normalizeName(kw);
  if (nKw.length < 2) return false;
  if (c === nKw) return true;
  if (!c.includes(nKw)) return false;
  for (const fkw of FULL_KWS) {
    const nf = normalizeName(fkw);
    if (nf !== nKw && nf.includes(nKw) && c.includes(nf)) return false;
  }
  return true;
};

const findPrev = (data, teamKw, cutoff) => {
  if (!data) return "-";
  const past = data.filter(r => 
    r.date < cutoff &&
    (teamMatch(r.home, teamKw) || teamMatch(r.away, teamKw)) &&
    r.home_score !== "" && (r.status === "finished" || r.status === "FT")
  ).sort((a,b) => b.date.localeCompare(a.date));

  if (past.length === 0) return "Not Found";
  return "Found: " + past[0].home + " vs " + past[0].away;
};

console.log("Niigata:", findPrev(resultsData.data, "新潟", "2026-04-25"));
console.log("FC Osaka:", findPrev(resultsData.data, "FC大阪", "2026-04-25"));
