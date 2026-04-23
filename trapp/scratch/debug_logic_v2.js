
const normalizeName = (s) => (s || "").normalize("NFKC").trim();
const cleanGas = (nm) => (nm || "").replace("の試合詳細", "").replace("の結果", "").trim();
const FULL_KWS = ["FC東京","FC大阪","FC今治","FC岐阜","FC琉球","YS横浜","京都サンガF.C.","鹿島アントラーズ","浦和レッズ","ガンバ大阪","セレッソ大阪","ヴィッセル神戸"];

const teamMatch = (gasName, kw) => {
  const c = normalizeName(cleanGas(gasName));
  const nKw = normalizeName(kw);
  if (nKw.length < 2) return false;
  if (c === nKw) return true;
  if (!c.includes(nKw)) return false;
  // "大阪" が "FC大阪" に誤爆するのを防ぐ
  for (const fkw of FULL_KWS) {
    const nf = normalizeName(fkw);
    if (nf !== nKw && nf.includes(nKw) && c.includes(nf)) return false;
  }
  return true;
};

// Test cases
console.log("新潟 vs 新潟:", teamMatch("新潟", "新潟")); // Expected: true
console.log("今治 vs FC今治:", teamMatch("今治", "FC今治")); // Expected: false (Current Bug)
console.log("FC今治 vs FC今治:", teamMatch("FC今治", "FC今治")); // Expected: true
console.log("今治の試合詳細 vs FC今治:", teamMatch("今治の試合詳細", "FC今治")); // Expected: false (Current Bug)
console.log("FC大阪 vs 大阪:", teamMatch("FC大阪", "大阪")); // Expected: false (Correct)
console.log("G大阪 vs 大阪:", teamMatch("G大阪", "大阪")); // Expected: true
