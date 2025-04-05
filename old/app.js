
const dataUrl = "nittei2025.txt";
let currentMonth = new Date().getMonth() + 1;

function fetchData() {
  fetch(dataUrl)
    .then(res => res.json())
    .then(data => {
      window.scheduleData = parseSchedule(data);
      renderMonth(currentMonth);
    });
}

function parseSchedule(data) {
  const allGames = [];
  const monthFromDate = (dateStr) => {
    const match = dateStr.match(/(\d{1,2})月/);
    return match ? parseInt(match[1]) : null;
  };

  const dayFromDate = (dateStr) => {
    const match = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
    return match ? parseInt(match[2]) : 1;
  };

  const parseTeamData = (teamName, games, color) => {
    for (const g of games) {
      const dateStr = g["日付"] || g["日程"] || "";
      const month = monthFromDate(dateStr);
      const day = dayFromDate(dateStr);
      if (!month) continue;

      const opponent = g["対戦チーム"] || g["対戦"];
      const time = g["時間"] || g["キックオフ"] || "";
      const stadium = g["会場"];
      const opponentKey = convertToKey(opponent);

      allGames.push({
        team: teamName,
        month,
        day,
        time,
        stadium,
        opponent,
        opponentKey,
        color
      });
    }
  };

  parseTeamData("新潟", data["アルビレックス新潟"], "orange");
  parseTeamData("熊本", data["ロアッソ熊本"], "red");
  return allGames.sort((a, b) => (a.month - b.month) || (a.day - b.day));
}

function convertToKey(name) {
  const map = {
    "横浜F・マリノス": "yokohamafm",
    "セレッソ大阪": "cosaka",
    "川崎フロンターレ": "kawasakif",
    "FC東京": "ftokyo",
    "京都サンガF.C.": "kyoto",
    "鹿島アントラーズ": "kashima",
    "東京ヴェルディ": "tokyov",
    "横浜FC": "yokohamafc",
    "ガンバ大阪": "gosaka",
    "名古屋グランパス": "nagoya",
    "湘南ベルマーレ": "shonan",
    "清水エスパルス": "shimizu",
    "ヴィッセル神戸": "kobe",
    "柏レイソル": "kashiwa",
    "サンフレッチェ広島": "hiroshima",
    "浦和レッズ": "urawa",
    "ファジアーノ岡山": "okayama",
    "FC町田ゼルビア": "machida",
    "アビスパ福岡": "fukuoka",
    "V・ファーレン長崎": "nagasaki",
    "北海道コンサドーレ札幌": "sapporo",
    "RB大宮アルディージャ": "omiya",
    "徳島ヴォルティス": "tokushima",
    "モンテディオ山形": "yamagata",
    "レノファ山口FC": "yamaguchi",
    "サガン鳥栖": "tosu",
    "カターレ富山": "toyama",
    "ジュビロ磐田": "iwata",
    "ベガルタ仙台": "sendai",
    "藤枝MYFC": "fujieda",
    "ジェフユナイテッド千葉": "chiba",
    "大分トリニータ": "oita",
    "FC今治": "imabari",
    "愛媛FC": "ehime",
    "水戸ホーリーホック": "mito",
    "ブラウブリッツ秋田": "akita",
    "いわきFC": "iwaki",
    "ヴァンフォーレ甲府": "kofu"
  };
  return map[name] || "unknown";
}

function renderMonth(month) {
  document.getElementById("monthDisplay").textContent = `${month}月`;
  const container = document.getElementById("scheduleContainer");
  container.innerHTML = "";

  const games = window.scheduleData.filter(g => g.month === month);
  if (games.length === 0) {
    container.innerHTML = "<p>この月の試合はありません</p>";
    return;
  }

  for (const g of games) {
    const card = document.createElement("div");
    card.className = `card ${g.color}`;

    const content = document.createElement("div");
    content.className = "card-content";
    content.innerHTML = `
      <div class="date-time">MW - ${g.month}/${g.day}</div>
      <div class="opponent">vs ${g.opponent}</div>
      <div class="stadium">${g.stadium}</div>
      <div class="date-time">${g.time}</div>
    `;

    const emblem = document.createElement("img");
    emblem.className = "emblem";
    emblem.src = `https://jleague.r10s.jp/img/common/img_club_${g.opponentKey}.png`;
    emblem.alt = g.opponent;

    card.appendChild(content);
    card.appendChild(emblem);
    container.appendChild(card);
  }
}

function swipeHandler() {
  let startX;
  document.addEventListener("touchstart", e => startX = e.touches[0].clientX);
  document.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) {
      currentMonth = Math.min(currentMonth + 1, 12);
      renderMonth(currentMonth);
    } else if (endX - startX > 50) {
      currentMonth = Math.max(currentMonth - 1, 1);
      renderMonth(currentMonth);
    }
  });
}

fetchData();
swipeHandler();
