
const matchData = {
  "アルビレックス新潟": [
    {
      "節": 1,
      "日付": "2月15日",
      "曜日": "土",
      "時間": "14:00",
      "対戦チーム": "横浜F・マリノス",
      "会場": "日産スタジアム"
    },
    {
      "節": 2,
      "日付": "3月3日",
      "曜日": "日",
      "時間": "15:00",
      "対戦チーム": "FC東京",
      "会場": "デンカビッグスワンスタジアム"
    }
  ],
  "ロアッソ熊本": [
    {
      "節": 1,
      "日付": "2月16日",
      "曜日": "日",
      "時間": "13:00",
      "対戦チーム": "徳島ヴォルティス",
      "会場": "えがお健康スタジアム"
    }
  ]
};

document.addEventListener("DOMContentLoaded", function () {
  const scheduleContainer = document.getElementById("schedule-container");
  if (!scheduleContainer) return;

  const currentMonth = new Date().getMonth() + 1;
  for (const club in matchData) {
    matchData[club].forEach(match => {
      const matchMonth = parseInt(match["日付"].match(/(\d+)/)[1]);
      if (matchMonth === currentMonth) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="match-date">MW${match["節"]} - ${match["日付"]} ${match["曜日"]} ${match["時間"]}</div>
          <div class="match-vs">vs <span class="opponent">${match["対戦チーム"]}</span></div>
          <div class="stadium">${match["会場"]}</div>
        `;
        scheduleContainer.appendChild(card);
      }
    });
  }
});
