document.addEventListener("DOMContentLoaded", () => {
const prevBtn = document.getElementById("prev-month");
const nextBtn = document.getElementById("next-month");
const goTodayBtn = document.getElementById("go-today");


if (prevBtn && nextBtn && goTodayBtn) {
  prevBtn.addEventListener("click", () => {
    if (currentMonthIndex > 0) {
      currentMonthIndex--;
      updateSlider();
    }
  });

  nextBtn.addEventListener("click", () => {
    const months = document.querySelectorAll(".month-section");
    if (currentMonthIndex < months.length - 1) {
      currentMonthIndex++;
      updateSlider();
    }
  });

  goTodayBtn.addEventListener("click", () => {
    const thisMonth = new Date().getMonth() + 1;
    const months = Array.from(document.querySelectorAll(".month-section"));
    const index = months.findIndex(m => parseInt(m.dataset.month) === thisMonth);
    if (index !== -1) {
      currentMonthIndex = index;
      updateSlider();
    }
  });
}



document.getElementById("go-today").addEventListener("click", () => {
  const thisMonth = new Date().getMonth() + 1;
  const months = Array.from(document.querySelectorAll(".month-section"));
  const index = months.findIndex(m => parseInt(m.dataset.month) === thisMonth);
  if (index !== -1) {
    goToMonth(index); // ← ここが正しい！updateSliderは使わない！
  }
});

  const slider = document.getElementById("month-slider");
  fetch("schedule.json")
    .then(res => res.json())
    .then(data => {
      const monthsMap = {};

      data.forEach(match => {
        const month = new Date(match.date).getMonth() + 1;
        if (!monthsMap[month]) monthsMap[month] = [];
        monthsMap[month].push(match);
      });

      for (const month in monthsMap) {
        const section = document.createElement("div");
        section.className = "month-section";
        section.dataset.month = month;

        const title = document.createElement("div");
        title.className = "month-title";
        title.textContent = new Date(2025, month - 1).toLocaleString("ja", { month: "long" });
        section.appendChild(title);

        monthsMap[month].forEach(match => {
          const card = document.createElement("div");
          card.className = `card ${match.club}`;

          const matchId = `${match.date}_${match.club}_${match.opponent}`;
          const savedGo = localStorage.getItem(`note_go_${matchId}`) || "";
          const savedBack = localStorage.getItem(`note_back_${matchId}`) || "";

          card.innerHTML = `
            <div class="match-header">
              <div class="match-info">
                <div class="match-date">${match.matchweek} - ${match.date} ${match.day} ${match.time}</div>
                <div class="info-line"><span class="info-label">vs</span> <span class="opponent-name">${match.opponent}</span></div>
                <div class="venue">${match.venue}</div>
              </div>
              <div class="match-logo">
                <img class="emblem" src="${match.emblem}" alt="${match.opponent}">
              </div>
            </div>
            <div class="match-details">
              ${match.details ? `<p>${match.details}</p>` : ""}
              <div class="note-section">
                <label>【行き】</label>
                <textarea class="note-go" placeholder="">${savedGo}</textarea>
                <label>【帰り】</label>
                <textarea class="note-back" placeholder="">${savedBack}</textarea>
              </div>
            </div>
          `;

          // 詳細の開閉
          card.addEventListener("click", (e) => {
  if (e.target.tagName.toLowerCase() === "textarea") return;

  // 他のカードを閉じる
  document.querySelectorAll(".card.expanded").forEach(c => {
    if (c !== card) c.classList.remove("expanded");
  });

  // 自分は開閉トグル
  card.classList.toggle("expanded");
});

          // メモ保存
          setTimeout(() => {
            const noteGo = card.querySelector(".note-go");
            const noteBack = card.querySelector(".note-back");

            if (noteGo) {
              noteGo.addEventListener("input", e => {
                localStorage.setItem(`note_go_${matchId}`, e.target.value);
              });
            }

            if (noteBack) {
              noteBack.addEventListener("input", e => {
                localStorage.setItem(`note_back_${matchId}`, e.target.value);
              });
            }
          }, 0);

          section.appendChild(card);
        });

        slider.appendChild(section);
      }

      const months = Array.from(document.querySelectorAll(".month-section"));
      let currentMonth = new Date().getMonth() + 1;
      let currentIndex = months.findIndex(m => parseInt(m.dataset.month) === currentMonth);
      if (currentIndex === -1) currentIndex = 0;

      let touchStartX = 0;

function updateSlider() {
  const offset = -100 * currentMonthIndex;
  slider.style.transform = `translateX(${offset}%)`;
  const currentSection = months[currentMonthIndex];
  const monthName = currentSection.querySelector(".month-title").textContent;
  const monthTitle = document.getElementById("month-title");
  if (monthTitle) monthTitle.textContent = monthName;
}

      slider.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
      });

slider.addEventListener("touchend", e => {
  const touchEndX = e.changedTouches[0].screenX;
  const deltaX = touchEndX - touchStartX;
  if (deltaX > 50 && currentMonthIndex > 0) {
    currentMonthIndex--;
    updateSlider();
  } else if (deltaX < -50 && currentMonthIndex < months.length - 1) {
    currentMonthIndex++;
    updateSlider();
  }
});


      updateSlider();

      // クラブ表示切り替え
      const toggleAlb = document.getElementById("toggle-niigata");
      const toggleRoa = document.getElementById("toggle-kumamoto");

      toggleAlb.addEventListener("click", () => {
        toggleClub("niigata", toggleAlb);
      });

      toggleRoa.addEventListener("click", () => {
        toggleClub("kumamoto", toggleRoa);
      });

      function toggleClub(clubClass, icon) {
        icon.classList.toggle("active");
        const cards = document.querySelectorAll(`.card.${clubClass}`);
        cards.forEach(card => {
          card.style.display = icon.classList.contains("active") ? "block" : "none";
        });
      }
    });
});
// 必要な変数
let currentMonthIndex = 0;

// 月移動関数
function goToMonth(index) {
  const months = document.querySelectorAll(".month-section");
  const slider = document.getElementById("month-slider");
  const monthHeader = document.getElementById("month-title");

  currentMonthIndex = index;
  slider.style.transform = `translateX(-${index * 100}vw)`;

  // 月名更新
  const currentSection = months[currentMonthIndex];
  const monthName = currentSection.querySelector(".month-title")?.textContent || "";
  if (monthHeader) monthHeader.textContent = monthName;
}
