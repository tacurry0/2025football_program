/**
 * J-League Data Auto-Scraper v4.1
 * 2026年 百年構想リーグ対応版
 * - 順位表: scoreTable01 クラスで取得、チーム名重複を除去
 * - 試合結果: テーブルなし構造に対応、h4 + /match/j2j3/ リンクから抽出
 */

const CACHE_TIME = 1800; // 30分

function doGet(e) {
  const type = e.parameter.type || 'standings';
  const league = e.parameter.league || 'j2';
  const nocache = e.parameter.nocache === '1';

  const cacheKey = 'jleague_' + type + '_' + league;
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get(cacheKey);

  if (cachedData && !nocache) {
    return createJsonResponse(JSON.parse(cachedData), true);
  }

  try {
    const data = (type === 'standings') ? fetchStandings(league) : fetchResults(league);
    if (!nocache) cache.put(cacheKey, JSON.stringify(data), CACHE_TIME);
    return createJsonResponse(data, false);
  } catch (error) {
    return createJsonResponse({ error: error.message, stack: error.stack }, false, 500);
  }
}

function test() {
  console.log("--- 順位表のテスト (J2) ---");
  try {
    const standings = fetchStandings('j2');
    console.log("取得件数: " + standings.length);
    if (standings.length > 0) {
      console.log("先頭3件:");
      console.log(JSON.stringify(standings.slice(0, 3), null, 2));
    }
  } catch (e) {
    console.error("順位表取得エラー: " + e.message);
  }

  console.log("\n--- 試合結果のテスト (J2) ---");
  try {
    const results = fetchResults('j2');
    console.log("取得件数: " + results.length);
    if (results.length > 0) {
      console.log("最新3件:");
      // ソートして最新を表示
      const sorted = results.sort((a, b) => b.section - a.section || new Date(b.date) - new Date(a.date));
      console.log(JSON.stringify(sorted.slice(0, 3), null, 2));
      
      // 重複チェック（デバッグ用）
      const keys = {};
      let dups = 0;
      results.forEach(r => {
        const k = r.date + r.home + r.away;
        if (keys[k]) dups++;
        keys[k] = true;
      });
      console.log("重複検出数: " + dups + " (0であれば正常)");
    }
  } catch (e) {
    console.error("試合結果取得エラー: " + e.message);
  }
}

// キャッシュを手動でクリアする（GASエディタで実行）
function clearCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(['jleague_standings_j2', 'jleague_results_j2',
                   'jleague_standings_j1', 'jleague_results_j1']);
  console.log('キャッシュをクリアしました');
}


// デバッグ用: 節10のHTML構造を確認
function debugSection() {
  const options = {
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }
  };
  const html = UrlFetchApp.fetch(
    'https://www.jleague.jp/match/section/j2j3/10/',
    options
  ).getContentText('UTF-8');

  // 1. 「試合終了」前後50文字を表示（最初の3件）
  var pos = 0, found = 0;
  while (found < 3) {
    var idx = html.indexOf('試合終了', pos);
    if (idx === -1) break;
    var snippet = html.substring(Math.max(0, idx - 100), idx + 100)
      .replace(/\n/g, '↵').replace(/\s+/g, ' ');
    console.log('試合終了[' + found + ']: ...' + snippet + '...');
    pos = idx + 1;
    found++;
  }

  // 2. /live/ を含む href の数と最初の例
  var liveLinks = html.match(/href="[^"]*\/live\/[^"]*"/g) || [];
  console.log('\n/live/ href数: ' + liveLinks.length);
  if (liveLinks.length > 0) console.log('例: ' + liveLinks[0]);

  // 3. <a に続く href="/..."  を探す（相対/絶対どちらか確認）
  var firstA = html.indexOf('<a ');
  if (firstA > -1) console.log('\n最初の<a>タグ: ' + html.substring(firstA, firstA + 150).replace(/\n/g,'↵'));

  // 4. HTML全体の文字数と先頭200文字
  console.log('\nHTML長さ: ' + html.length);
  console.log('先頭200: ' + html.substring(0, 200).replace(/\n/g,'↵'));
}



function createJsonResponse(data, fromCache, status) {
  status = status || 200;
  const output = JSON.stringify({
    status: status,
    timestamp: new Date().toISOString(),
    fromCache: fromCache,
    data: data
  });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 順位表スクレイパー
// ==========================================
function fetchStandings(league) {
  const isJ2J3 = (league === 'j2' || league === 'j3');
  const url = isJ2J3
    ? 'https://www.jleague.jp/standings/j2j3/'
    : ('https://www.jleague.jp/standings/' + league + '/');

  const options = {
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }
  };

  const html = UrlFetchApp.fetch(url, options).getContentText('UTF-8');
  const results = [];

  // ---- h4グループ名を収集 ----
  const h4s = [];
  const h4Regex = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  let m;
  while ((m = h4Regex.exec(html)) !== null) {
    const label = cleanHtml(m[1]);
    if (label.length > 1) h4s.push(label);
  }

  // ---- scoreTable01 テーブルを収集 ----
  const tables = [];
  const tableRegex = /<table[^>]*class="[^"]*scoreTable01[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  while ((m = tableRegex.exec(html)) !== null) {
    tables.push(m[1]);
  }

  if (tables.length === 0) {
    throw new Error('順位表テーブル(scoreTable01)が見つかりません。HTMLの先頭500文字: ' + html.substring(0, 500));
  }

  tables.forEach(function(tableBody, idx) {
    const groupName = h4s[idx] || ('Group ' + (idx + 1));
    const rows = tableBody.split(/<tr[\s>]/i);

    rows.forEach(function(row, rIdx) {
      if (rIdx === 0) return;
      if (!row.includes('<td')) return;

      const cells = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let td;
      while ((td = tdRegex.exec(row)) !== null) {
        cells.push(cleanHtml(td[1]));
      }

      if (cells.length < 5) return;

      // 最初のセルが数字(順位)かどうかでオフセット判定
      let offset = 0;
      if (isNaN(Number(cells[0])) || cells[0] === '') offset = 1;

      const rank = cells[offset];
      if (!rank || isNaN(Number(rank))) return;

      const entry = {
        group: groupName,
        rank: rank,
        team: deduplicate(cells[offset + 1] || ''),
        points: cells[offset + 2] || '',
        played: cells[offset + 3] || '',
        won: cells[offset + 4] || ''
      };

      if (isJ2J3) {
        entry.pk_won        = cells[offset + 5] || '';
        entry.pk_lost       = cells[offset + 6] || '';
        entry.lost          = cells[offset + 7] || '';
        entry.goals_for     = cells[offset + 8] || '';
        entry.goals_against = cells[offset + 9] || '';
        entry.goal_diff     = cells[offset + 10] || '';
      } else {
        entry.drawn    = cells[offset + 5] || '';
        entry.lost     = cells[offset + 6] || '';
        entry.goal_diff = cells[offset + 9] || '';
      }

      results.push(entry);
    });
  });

  if (results.length === 0) {
    throw new Error(
      'データ行が0件です。テーブル数=' + tables.length +
      ', h4数=' + h4s.length +
      '. HTMLの先頭800文字: ' + html.substring(0, 800)
    );
  }

  return results;
}

// ==========================================
// 試合結果スクレイパー
// /match/section/j2j3/NN/ ページはSSRでスコア入り
// 最新節を自動検出してから直近2節を取得
// ==========================================
function fetchResults(league) {
  const leagueParam = (league === 'j1') ? 'j1' : 'j2j3';
  const options = {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    }
  };

  // J2J3百年構想は週2節ペースの場合があるため week*2 で推定
  const seasonStart = new Date('2026-02-01');
  const today = new Date();
  const daysElapsed = Math.floor((today - seasonStart) / (24 * 60 * 60 * 1000));
  const estimatedSection = Math.max(1, Math.min(Math.ceil(daysElapsed / 3.5), 40));

  // 推定節から上に向かい、試合終了がある最大節を探す（最大7節プローブ）
  let completedSection = Math.max(1, estimatedSection - 3);
  for (var probe = estimatedSection - 3; probe <= estimatedSection + 3; probe++) {
    if (probe < 1) continue;
    const probeUrl = 'https://www.jleague.jp/match/section/' + leagueParam + '/' + probe + '/';
    const probeHtml = UrlFetchApp.fetch(probeUrl, options).getContentText('UTF-8');
    if (probeHtml.includes('試合終了')) {
      completedSection = probe;
    }
    Utilities.sleep(200);
  }
  console.log('最新完了節確定: ' + completedSection);

  // 節1から最新完了節まで全件取得
  const startSection = 1;
  const results = [];

  for (var sec = startSection; sec <= completedSection; sec++) {
    const url = 'https://www.jleague.jp/match/section/' + leagueParam + '/' + sec + '/';
    const html = UrlFetchApp.fetch(url, options).getContentText('UTF-8');
    console.log('節' + sec + 'フェッチ完了, HTML長さ: ' + html.length);
    const sectionResults = parseSectionResults(html, sec);
    console.log('節' + sec + '解析件数: ' + sectionResults.length);
    sectionResults.forEach(function(r){ results.push(r); });
    Utilities.sleep(300);
  }

  return results;
}


// 節ページHTMLからスコアを抽出
// 実測: 試合リンクは相対URL /match/j2j3/2026/MMDDNN/live/ 形式
/**
 * 指定された節のHTMLを解析して試合結果を抽出
 */
function parseSectionResults(html, sectionNum) {
  var results = [];
  var seenMatches = {}; // 最終的な重複チェック用 (date_home_away)

  // 試合詳細リンクを全て探す
  var liveRegex = /href="([^"]+\/live\/)"/g;
  var match;

  while ((match = liveRegex.exec(html)) !== null) {
    var url = match[1];
    var urlPos = match.index;

    // 不正なURLはスキップ
    if (!/\/\d{4}\/\d{4,}\/live\//.test(url)) continue;

    // URLの前後2000文字を取得（十分なコンテキストを確保）
    var win = html.substring(Math.max(0, urlPos - 1000), Math.min(html.length, urlPos + 1000));

    // 「試合終了」が含まれていない場合はスキップ
    if (!win.includes('試合終了')) continue;

    // 1. チーム名の抽出
    var homeTeam = '', awayTeam = '';
    // title属性から抽出を試みる (最も確実)
    var titleMatch = win.match(/(?:title|alt|TITLE|ALT)="\s*([^"<>]+?)\s*(?:vs|VS|vs\.|v\.s\.)\s*([^"<>]+?)(?:の試合詳細)?"/i);
    
    if (titleMatch) {
      homeTeam = titleMatch[1].trim();
      awayTeam = titleMatch[2].trim();
    } else {
      // タグをクリーニングしてテキストから抽出を試みる (フォールバック)
      var cleanWin = win.replace(/<[^>]+>/g, ' ');
      var textMatch = cleanWin.match(/([^\s()「」【】]{1,20})\s*(?:vs|VS|vs\.|v\.s\.)\s*([^\s()「」【】]{1,20})/i);
      if (textMatch) {
        homeTeam = textMatch[1].trim();
        awayTeam = textMatch[2].trim();
      }
    }

    if (!homeTeam || !awayTeam) continue;

    // 2. スコアの抽出 (「試合終了」の周辺)
    var finIdx = win.indexOf('試合終了');
    var before = win.substring(Math.max(0, finIdx - 300), finIdx);
    var after  = win.substring(finIdx, Math.min(win.length, finIdx + 300));
    
    var homeNums = before.match(/>(\d{1,2})</g) || [];
    var awayNums = after.match(/>(\d{1,2})</g) || [];
    
    var homeScore = homeNums.length > 0 ? homeNums[homeNums.length - 1].replace(/\D/g, '') : '';
    var awayScore = awayNums.length > 0 ? awayNums[0].replace(/\D/g, '') : '';

    // 3. PKの抽出
    var pk = '';
    var pkMatch = win.match(/\(\s*(\d+)\s*(?:PK|pk)\s*(\d+)\s*\)/i);
    if (pkMatch) {
      // スコアから300文字以内にある場合のみ採用
      var pkIdx = win.indexOf(pkMatch[0]);
      if (Math.abs(pkIdx - finIdx) < 300) {
        pk = pkMatch[1] + ' PK ' + pkMatch[2];
      }
    }

    // 4. 日付の抽出 (URLから)
    var dateMatch = url.match(/\/(\d{4})\/(\d{2})(\d{2})\d*\//);
    var date = dateMatch ? dateMatch[1] + '-' + dateMatch[2] + '-' + dateMatch[3] : '';

    // 重複チェック
    var matchKey = date + '_' + homeTeam + '_' + awayTeam;
    if (!seenMatches[matchKey]) {
      seenMatches[matchKey] = true;
      results.push({
        section:    sectionNum,
        date:       date,
        home:       homeTeam,
        away:       awayTeam,
        home_score: homeScore,
        away_score: awayScore,
        pk:         pk,
        status:    'finished'
      });
    }
  }

  console.log('節' + sectionNum + ' 解析完了: ' + results.length + '件');
  return results;
}




// ==========================================
// ユーティリティ
// ==========================================
function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#[0-9]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 重複テキスト除去（"仙台仙台" → "仙台"、"仙台 仙台" → "仙台"）
function deduplicate(str) {
  if (!str) return '';
  var s = str.trim();
  // スペースあり: "ABC ABC"
  var half = Math.floor(s.length / 2);
  if (s.length % 2 === 0) {
    var a = s.substring(0, half), b = s.substring(half);
    if (a === b) return a;
  }
  // スペースなし: "ABCABC"
  var mid = s.length / 2;
  if (Number.isInteger(mid) && s.substring(0, mid) === s.substring(mid)) return s.substring(0, mid);
  // 「X X」形式（スペース1つで分割）
  var spaceIdx = s.indexOf(' ');
  if (spaceIdx > 0 && s.substring(0, spaceIdx) === s.substring(spaceIdx + 1)) return s.substring(0, spaceIdx);
  return s;
}


function extractByClass(html, className) {
  const regex = new RegExp('class="[^"]*' + className + '[^"]*"', 'i');
  const parts = html.split(regex);
  if (parts.length < 2) return '';
  return parts[1].split('</td>')[0].split('>').pop() || '';
}
