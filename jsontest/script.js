document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("month-slider");
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const goTodayBtn = document.getElementById("go-today");
  const toggleAlb = document.getElementById("toggle-niigata");
  const toggleRoa = document.getElementById("toggle-kumamoto");

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
  <textarea class="note-go">${savedGo}</textarea>
  <div class="note-go-view" style="display:none;"></div>

  <label>【帰り】</label>
  <textarea class="note-back">${savedBack}</textarea>
  <div class="note-back-view" style="display:none;"></div>

  <button class="save-notes">保存</button>
  </div>
            </div>
          `;

          card.addEventListener("click", (e) => {
            if (e.target.tagName.toLowerCase() === "textarea") return;
            document.querySelectorAll(".card.expanded").forEach(c => {
              if (c !== card) c.classList.remove("expanded");
            });
            card.classList.toggle("expanded");
          });

          setTimeout(() => {
            const noteGo = card.querySelector(".note-go");
            const noteBack = card.querySelector(".note-back");
            if (noteGo) noteGo.addEventListener("input", e => localStorage.setItem(`note_go_${matchId}`, e.target.value));
            if (noteBack) noteBack.addEventListener("input", e => localStorage.setItem(`note_back_${matchId}`, e.target.value));
          }, 0);
          const viewGo = card.querySelector(".note-go-view");
  const viewBack = card.querySelector(".note-back-view");
  const saveBtn = card.querySelector(".save-notes");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const valGo = noteGo.value.trim();
      const valBack = noteBack.value.trim();

      localStorage.setItem(`note_go_${matchId}`, valGo);
      localStorage.setItem(`note_back_${matchId}`, valBack);

      viewGo.innerHTML = parseToDisplay(valGo);
      viewBack.innerHTML = parseToDisplay(valBack);

      noteGo.style.display = "none";
      noteBack.style.display = "none";
      viewGo.style.display = "block";
      viewBack.style.display = "block";
      saveBtn.style.display = "none";
      editBtn.style.display = 'block';
    });
  }

// 編集ボタンの追加（新規追加）
const editBtn = document.createElement('button');
editBtn.textContent = '編集';
editBtn.className = 'edit-notes';
editBtn.style.display = 'none';

saveBtn.after(editBtn);

editBtn.addEventListener('click', () => {
  noteGo.style.display = "block";
  noteBack.style.display = "block";
  viewGo.style.display = "none";
  viewBack.style.display = "none";
  saveBtn.style.display = "block";
  editBtn.style.display = 'none';
});

// 初期表示の修正（ページ再読み込み時）
if (savedGo || savedBack) {
  editBtn.style.display = 'block';
}

  // 初期状態で保存済みなら表示モード
  if (savedGo || savedBack) {
    noteGo.style.display = "none";
    noteBack.style.display = "none";
    viewGo.innerHTML = parseToDisplay(savedGo);
    viewBack.innerHTML = parseToDisplay(savedBack);
    viewGo.style.display = "block";
    viewBack.style.display = "block";
    if (saveBtn) saveBtn.style.display = "none";
  }

          section.appendChild(card);
      });

      // ←★この直後に関数を追加！
      function parseToDisplay(text) {
        const escaped = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return escaped
          .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
          .replace(/\n/g, "<br>");
      }

      slider.appendChild(section);
      }

      const months = Array.from(document.querySelectorAll(".month-section"));
      const thisMonth = new Date().getMonth() + 1;
      const index = months.findIndex(m => parseInt(m.dataset.month) === thisMonth);
      currentMonthIndex = index !== -1 ? index : 0;

      updateSlider();

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

      if (prevBtn && nextBtn) {
        prevBtn.addEventListener("click", () => {
          if (currentMonthIndex > 0) {
            currentMonthIndex--;
            updateSlider();
          }
        });

        nextBtn.addEventListener("click", () => {
          if (currentMonthIndex < months.length - 1) {
            currentMonthIndex++;
            updateSlider();
          }
        });
      }

      if (goTodayBtn) {
        goTodayBtn.addEventListener("click", () => {
          const today = new Date().getMonth() + 1;
          const todayIndex = months.findIndex(m => parseInt(m.dataset.month) === today);
          if (todayIndex !== -1) {
            currentMonthIndex = todayIndex;
            updateSlider();
          }
        });
      }
      
      // ここにイベントリスナーを一度だけ登録
      toggleAlb.addEventListener("click", () => {
        toggleAlb.classList.toggle("active");
        updateClubVisibility();
      });

      toggleRoa.addEventListener("click", () => {
        toggleRoa.classList.toggle("active");
        updateClubVisibility();
      });

      function updateSlider() {
        const offset = -100 * currentMonthIndex;
        slider.style.transform = `translateX(${offset}vw)`;
        const currentSection = months[currentMonthIndex];
        const monthName = currentSection.querySelector(".month-title").textContent;
        const monthTitle = document.getElementById("month-title");
        if (monthTitle) monthTitle.textContent = monthName;
        updateClubVisibility();
      }

      function updateClubVisibility() {
        document.querySelectorAll(".card.niigata").forEach(card => {
          card.style.display = toggleAlb.classList.contains("active") ? "block" : "none";
        });

        document.querySelectorAll(".card.kumamoto").forEach(card => {
          card.style.display = toggleRoa.classList.contains("active") ? "block" : "none";
        });
      }
    });
// ハンバーガーメニューの動作（新規追加）
const hamburgerBtn = document.getElementById('hamburger-btn');
const sideMenu = document.getElementById('side-menu');

hamburgerBtn.addEventListener('click', () => {
  sideMenu.classList.toggle('active');
});

// メニュー外クリックで閉じる処理
document.addEventListener('click', (event) => {
  if (!sideMenu.contains(event.target) && !hamburgerBtn.contains(event.target)) {
    sideMenu.classList.remove('active');
  }
});
});
