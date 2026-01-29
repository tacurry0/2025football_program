document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("month-slider");
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const goTodayBtn = document.getElementById("go-today");
  const toggleAlb = document.getElementById("toggle-niigata");
  const toggleRoa = document.getElementById("toggle-kumamoto");

  // スライダー操作用
  let currentMonthIndex = 0;
  let touchStartX = 0;

  // メモ表示用（URLリンク化 + 改行反映）
  function parseToDisplay(text) {
    const escaped = (text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, "<br>");
  }

  fetch("schedule.json")
    .then(res => res.json())
    .then(data => {
      // まず日付順に整列（年をまたいでも正しく並ぶ）
      data.sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || "00:00"}`);
        const db = new Date(`${b.date}T${b.time || "00:00"}`);
        return da - db;
      });

      // 年-月でグルーピング（★ここが2025/2026混在対策）
      const ymMap = {}; // key: "YYYY-MM"
      data.forEach(match => {
        const d = new Date(match.date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (!ymMap[key]) ymMap[key] = [];
        ymMap[key].push(match);
      });

      // キー（YYYY-MM）を昇順で回す
      const keys = Object.keys(ymMap).sort((a, b) => a.localeCompare(b, "en"));

      keys.forEach(key => {
        const [yearStr, monthStr] = key.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        const section = document.createElement("div");
        section.className = "month-section";
        section.dataset.ym = key; // 例: 2026-02

        const title = document.createElement("div");
        title.className = "month-title";
        // 年＋月を表示（例: 2026年2月）
        title.textContent = new Date(year, month - 1, 1).toLocaleString("ja", { year: "numeric", month: "long" });
        section.appendChild(title);

        ymMap[key].forEach(match => {
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

          // カード開閉
          card.addEventListener("click", (e) => {
            if (e.target.tagName.toLowerCase() === "textarea" || e.target.tagName.toLowerCase() === "button" || e.target.tagName.toLowerCase() === "a") return;
            document.querySelectorAll(".card.expanded").forEach(c => {
              if (c !== card) c.classList.remove("expanded");
            });
            card.classList.toggle("expanded");
          });

          const noteGo = card.querySelector(".note-go");
          const noteBack = card.querySelector(".note-back");
          const viewGo = card.querySelector(".note-go-view");
          const viewBack = card.querySelector(".note-back-view");
          const saveBtn = card.querySelector(".save-notes");

          // 編集ボタンを作成して後ろに追加
          const editBtn = document.createElement("button");
          editBtn.textContent = "編集";
          editBtn.className = "edit-notes";
          editBtn.style.display = "none";
          saveBtn.after(editBtn);

          // 入力した内容をリアルタイム保存
          noteGo.addEventListener("input", e => localStorage.setItem(`note_go_${matchId}`, e.target.value));
          noteBack.addEventListener("input", e => localStorage.setItem(`note_back_${matchId}`, e.target.value));

          // 保存ボタン
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
            editBtn.style.display = "block";
          });

          // 編集ボタン
          editBtn.addEventListener("click", () => {
            noteGo.style.display = "block";
            noteBack.style.display = "block";
            viewGo.style.display = "none";
            viewBack.style.display = "none";
            saveBtn.style.display = "block";
            editBtn.style.display = "none";
          });

          // 最初から保存済みデータがあれば表示モード
          if (savedGo || savedBack) {
            noteGo.style.display = "none";
            noteBack.style.display = "none";
            viewGo.innerHTML = parseToDisplay(savedGo);
            viewBack.innerHTML = parseToDisplay(savedBack);
            viewGo.style.display = "block";
            viewBack.style.display = "block";
            saveBtn.style.display = "none";
            editBtn.style.display = "block";
          }

          section.appendChild(card);
        });

        slider.appendChild(section);
      });

      const sections = Array.from(document.querySelectorAll(".month-section"));

      // 今日の「年-月」に移動できるようにする
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const index = sections.findIndex(s => s.dataset.ym === todayKey);
      currentMonthIndex = index !== -1 ? index : 0;

      updateSlider();

      // スワイプ操作
      slider.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
      });

      slider.addEventListener("touchend", e => {
        const touchEndX = e.changedTouches[0].screenX;
        const deltaX = touchEndX - touchStartX;
        if (deltaX > 50 && currentMonthIndex > 0) {
          currentMonthIndex--;
          updateSlider();
        } else if (deltaX < -50 && currentMonthIndex < sections.length - 1) {
          currentMonthIndex++;
          updateSlider();
        }
      });

      // 前月/次月（※実際は「前の年-月」「次の年-月」）
      if (prevBtn && nextBtn) {
        prevBtn.addEventListener("click", () => {
          if (currentMonthIndex > 0) {
            currentMonthIndex--;
            updateSlider();
          }
        });

        nextBtn.addEventListener("click", () => {
          if (currentMonthIndex < sections.length - 1) {
            currentMonthIndex++;
            updateSlider();
          }
        });
      }

      // 今日へ
      if (goTodayBtn) {
        goTodayBtn.addEventListener("click", () => {
          const t = new Date();
          const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
          const idx = sections.findIndex(s => s.dataset.ym === key);
          if (idx !== -1) {
            currentMonthIndex = idx;
            updateSlider();
          }
        });
      }

      // ここにイベントリスナーを一度だけ登録
      if (toggleAlb) {
        toggleAlb.addEventListener("click", () => {
          toggleAlb.classList.toggle("active");
          updateClubVisibility();
        });
      }

      if (toggleRoa) {
        toggleRoa.addEventListener("click", () => {
          toggleRoa.classList.toggle("active");
          updateClubVisibility();
        });
      }

      function updateSlider() {
        const offset = -100 * currentMonthIndex;
        slider.style.transform = `translateX(${offset}vw)`;
        const currentSection = sections[currentMonthIndex];
        const monthName = currentSection.querySelector(".month-title").textContent;
        const monthTitle = document.getElementById("month-title");
        if (monthTitle) monthTitle.textContent = monthName;
        updateClubVisibility();
      }

      function updateClubVisibility() {
        if (toggleAlb) {
          document.querySelectorAll(".card.niigata").forEach(card => {
            card.style.display = toggleAlb.classList.contains("active") ? "block" : "none";
          });
        }
        if (toggleRoa) {
          document.querySelectorAll(".card.kumamoto").forEach(card => {
            card.style.display = toggleRoa.classList.contains("active") ? "block" : "none";
          });
        }
      }
    });

  // ハンバーガーメニューの動作
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const sideMenu = document.getElementById("side-menu");

  if (hamburgerBtn && sideMenu) {
    hamburgerBtn.addEventListener("click", () => {
      sideMenu.classList.toggle("active");
    });

    // メニュー外クリックで閉じる処理
    document.addEventListener("click", (event) => {
      if (!sideMenu.contains(event.target) && !hamburgerBtn.contains(event.target)) {
        sideMenu.classList.remove("active");
      }
    });
  }
});
