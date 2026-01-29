document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("month-slider");
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const goTodayBtn = document.getElementById("go-today");

  const toggleAlb = document.getElementById("toggle-niigata");
  const toggleRoa = document.getElementById("toggle-kumamoto");

  // 年切り替え（追加）
  const year2025Btn = document.getElementById("toggle-year-2025");
  const year2026Btn = document.getElementById("toggle-year-2026");
  const yearAllBtn = document.getElementById("toggle-year-all");

  // スライダー操作用
  let currentIndex = 0;
  let touchStartX = 0;

  // セクション管理
  let allSections = [];
  let visibleSections = [];
  let selectedYear = null; // null = ALL

  // メモ表示用（URLリンク化 + 改行反映）
  function parseToDisplay(text) {
    const escaped = (text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, "<br>");
  }

  function setYearButtonActive() {
    const set = (btn, on) => {
      if (!btn) return;
      btn.classList.toggle("active", on);
      // 視認性がCSS未対応でも分かるように最低限のスタイル
      btn.style.fontWeight = on ? "700" : "400";
      btn.style.opacity = on ? "1" : "0.6";
    };
    set(year2025Btn, selectedYear === 2025);
    set(year2026Btn, selectedYear === 2026);
    set(yearAllBtn, selectedYear === null);
  }

  function rebuildVisibleSections() {
    visibleSections = allSections.filter(sec => sec.style.display !== "none");
    if (visibleSections.length === 0) {
      currentIndex = 0;
      return;
    }
    currentIndex = Math.min(currentIndex, visibleSections.length - 1);
  }

  function updateSlider() {
    if (!slider || visibleSections.length === 0) return;

    const offset = -100 * currentIndex;
    slider.style.transform = `translateX(${offset}vw)`;

    const currentSection = visibleSections[currentIndex];
    const monthName = currentSection.querySelector(".month-title")?.textContent || "";
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

  function setYearFilter(year) {
    selectedYear = year; // 2025 / 2026 / null(ALL)
    setYearButtonActive();

    allSections.forEach(sec => {
      const y = parseInt(sec.dataset.year || "0", 10);
      const show = (selectedYear === null) || (y === selectedYear);
      sec.style.display = show ? "block" : "none";
    });

    rebuildVisibleSections();
    currentIndex = 0; // 年を切り替えたらその年の先頭月へ
    updateSlider();
  }

  // ★ここ：必要なら読み込みファイルを merged に変更
  // 例）fetch("schedule_2025_2026_merged_all.json")
  fetch("schedule.json")
    .then(res => res.json())
    .then(data => {
      // 日付順に整列（年をまたいでも正しく並ぶ）
      data.sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || "00:00"}`);
        const db = new Date(`${b.date}T${b.time || "00:00"}`);
        return da - db;
      });

      // 年-月でグルーピング
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
        section.dataset.ym = key;
        section.dataset.year = String(year);

        const title = document.createElement("div");
        title.className = "month-title";
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
            const tag = e.target.tagName.toLowerCase();
            if (tag === "textarea" || tag === "button" || tag === "a") return;
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

          // 編集ボタン
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

      allSections = Array.from(document.querySelectorAll(".month-section"));

      // 初期表示：今日の年（存在すれば）
      const today = new Date();
      const todayYear = today.getFullYear();
      const hasTodayYear = allSections.some(s => parseInt(s.dataset.year || "0", 10) === todayYear);
      selectedYear = hasTodayYear ? todayYear : 2025;

      // 年フィルタ適用
      setYearButtonActive();
      allSections.forEach(sec => {
        const y = parseInt(sec.dataset.year || "0", 10);
        sec.style.display = (selectedYear === null || y === selectedYear) ? "block" : "none";
      });
      rebuildVisibleSections();

      // 初期位置：今日の月（その年の中にあれば）
      const todayKey = `${todayYear}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const idx = visibleSections.findIndex(s => s.dataset.ym === todayKey);
      currentIndex = idx !== -1 ? idx : 0;

      updateSlider();

      // スワイプ操作
      slider.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
      });

      slider.addEventListener("touchend", e => {
        const touchEndX = e.changedTouches[0].screenX;
        const deltaX = touchEndX - touchStartX;
        if (deltaX > 50 && currentIndex > 0) {
          currentIndex--;
          updateSlider();
        } else if (deltaX < -50 && currentIndex < visibleSections.length - 1) {
          currentIndex++;
          updateSlider();
        }
      });

      // 前/月（実際は前の年-月 / 次の年-月）
      if (prevBtn && nextBtn) {
        prevBtn.addEventListener("click", () => {
          if (currentIndex > 0) {
            currentIndex--;
            updateSlider();
          }
        });

        nextBtn.addEventListener("click", () => {
          if (currentIndex < visibleSections.length - 1) {
            currentIndex++;
            updateSlider();
          }
        });
      }

      // 今月へ：押したら「今日の年」に自動切替 → 今日の年-月へ移動
      if (goTodayBtn) {
        goTodayBtn.addEventListener("click", () => {
          const t = new Date();
          const y = t.getFullYear();
          const key = `${y}-${String(t.getMonth() + 1).padStart(2, "0")}`;

          // 今日の年を表示対象にしてから探す
          setYearFilter(y);
          const i = visibleSections.findIndex(s => s.dataset.ym === key);
          if (i !== -1) {
            currentIndex = i;
            updateSlider();
          }
        });
      }

      // クラブ表示切替
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

      // 年切り替えボタン
      if (year2025Btn) year2025Btn.addEventListener("click", () => setYearFilter(2025));
      if (year2026Btn) year2026Btn.addEventListener("click", () => setYearFilter(2026));
      if (yearAllBtn) yearAllBtn.addEventListener("click", () => setYearFilter(null));

      // 初回のクラブ可視化
      updateClubVisibility();
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
