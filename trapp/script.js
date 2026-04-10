document.addEventListener("DOMContentLoaded", () => {
  const feedSlider = document.getElementById("feed-slider");
  const calendarBody = document.getElementById("calendar-body");
  const ultraFeed = document.getElementById("ultra-feed");
  const calendarView = document.getElementById("calendar-view");
  
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const goTodayBtn = document.getElementById("go-today");
  const activeMonthTitle = document.getElementById("active-month-title");
  
  const toggleNiigata = document.getElementById("toggle-niigata");
  const toggleKumamoto = document.getElementById("toggle-kumamoto");

  const yearTabs = {
    "2025": document.getElementById("toggle-year-2025"),
    "2026": document.getElementById("toggle-year-2026"),
    "all": document.getElementById("toggle-year-all")
  };

  const detailSheet = document.getElementById("detail-sheet");
  const sheetBackdrop = document.getElementById("detail-sheet-backdrop");
  const sheetContent = document.getElementById("sheet-content");

  const pickerOverlay = document.getElementById("match-picker-overlay");
  const pickerBackdrop = document.getElementById("match-picker-backdrop");
  const pickerList = document.getElementById("picker-list");

  const sideMenu = document.getElementById("side-menu");
  const sideMenuBackdrop = document.getElementById("side-menu-backdrop");
  const hamBtn = document.getElementById("hamburger-btn");
  const searchInput = document.getElementById("search-input");
  const searchPopup = document.getElementById("search-popup");

  const ymPickerOverlay = document.getElementById("ym-picker-overlay");
  const ymPickerBackdrop = document.getElementById("ym-picker-backdrop");
  const ymPickerList = document.getElementById("ym-picker-list");

  let currentIndex = 0;
  let allSections = [];
  let visibleSections = [];
  let selectedYear = null;
  let currentMode = "feed"; // feed or calendar

  // --- Date/Theme Helpers ---
  function parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d || 1);
  }

  function isHomeMatch(club, venue) {
    if (!venue) return false;
    if (club === "niigata") return venue.includes("デンカビッグスワン");
    if (club === "kumamoto") return venue.includes("えがお健康");
    return false;
  }

  // --- View Management ---
  function switchMode(mode) {
    currentMode = mode;
    if (mode === "feed") {
      ultraFeed.className = "active-view";
      calendarView.className = "hidden-view";
    } else {
      ultraFeed.className = "hidden-view";
      calendarView.className = "active-view";
      renderCalendar();
    }
    sideMenu.classList.remove("active");
  }

  function openSubPane(id) {
    const pane = document.getElementById(id);
    if (pane) pane.classList.add("active");
    sideMenu.classList.remove("active");
  }

  document.querySelectorAll(".close-pane").forEach(btn => {
    btn.onclick = () => btn.closest(".sub-pane").classList.remove("active");
  });

  // --- Navigation & Sync ---

  function rebuildVisibleSections() {
    visibleSections = allSections.filter(s => s.style.display !== "none");
  }

  function applyYearFilter(year, skipScroll = false) {
    selectedYear = year;
    Object.keys(yearTabs).forEach(k => {
      const isActive = (k === "all" && selectedYear === null) || (Number(k) === selectedYear);
      if (yearTabs[k]) yearTabs[k].classList.toggle("active", isActive);
    });
    
    allSections.forEach(sec => {
      const y = Number(sec.dataset.year || 0);
      sec.style.display = (selectedYear === null || y === selectedYear) ? "flex" : "none";
    });
    rebuildVisibleSections();
    if (!skipScroll) { currentIndex = 0; scrollToIndex(0); }
    if (currentMode === "calendar") renderCalendar();
  }

  function scrollToIndex(idx) {
    if (!visibleSections[idx]) return;
    currentIndex = idx;
    if (activeMonthTitle) {
      activeMonthTitle.textContent = visibleSections[idx].dataset.ym_title || "";
    }
    if (currentMode === "feed") {
      const offset = visibleSections[idx].offsetLeft;
      ultraFeed.scrollTo({ left: offset, behavior: "smooth" });
    } else {
      renderCalendar();
    }
  }

  function updateActiveUI() {
    const scrollLeft = ultraFeed.scrollLeft, width = ultraFeed.clientWidth || window.innerWidth;
    const newIdx = Math.round(scrollLeft / width);
    if(newIdx !== currentIndex && visibleSections[newIdx]) { 
      currentIndex = newIdx; 
      if (activeMonthTitle) {
        activeMonthTitle.textContent = visibleSections[newIdx].dataset.ym_title || "";
      }
      if (currentMode === "calendar") renderCalendar();
    }
  }

  function updateClubVisibility() {
    const nOn = toggleNiigata.classList.contains("active");
    const kOn = toggleKumamoto.classList.contains("active");
    document.querySelectorAll(".card.club-niigata").forEach(c => c.style.display = nOn ? "flex" : "none");
    document.querySelectorAll(".card.club-kumamoto").forEach(c => c.style.display = kOn ? "flex" : "none");
    if (currentMode === "calendar") renderCalendar();
  }

  // --- Calendar Engine ---

  function renderCalendar() {
    const activeSec = visibleSections[currentIndex];
    if (!activeSec) return;
    const [year, month] = activeSec.dataset.ym.split("-").map(Number);
    
    calendarBody.innerHTML = "";
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    days.forEach(d => {
      const el = document.createElement("div");
      el.className = "cal-day-label"; el.textContent = d;
      calendarBody.appendChild(el);
    });

    const firstDay = parseDate(`${year}-${month}-01`).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-cell empty"; calendarBody.appendChild(empty);
    }

    const nOn = toggleNiigata.classList.contains("active");
    const kOn = toggleKumamoto.classList.contains("active");

    const matchesInMonth = scheduleData.filter(m => {
      const md = parseDate(m.date);
      if (md.getFullYear() !== year || (md.getMonth() + 1) !== month) return false;
      if (m.club === "niigata" && !nOn) return false;
      if (m.club === "kumamoto" && !kOn) return false;
      return true;
    });

    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.className = "cal-cell";
      if (year === today.getFullYear() && month === (today.getMonth()+1) && d === today.getDate()) cell.classList.add("today");

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayMatches = matchesInMonth.filter(m => m.date === dateStr);

      // 観戦予定のハイライト判定
      dayMatches.forEach(m => {
        const isAttend = localStorage.getItem(`attend_${m.date}_${m.club}_${m.opponent}`) === "true";
        if (isAttend) cell.classList.add(`attending-${m.club}`);
      });

      const num = document.createElement("span");
      num.className = "cal-date-num"; num.textContent = d;
      cell.appendChild(num);

      const matchContainer = document.createElement("div");
      matchContainer.className = "cal-match-container";
      
      dayMatches.forEach(m => {
        const dot = document.createElement("div");
        const isHome = isHomeMatch(m.club, m.venue);
        dot.className = `cal-dot ${m.club} ${isHome ? 'home' : 'away'}`;
        matchContainer.appendChild(dot);
      });
      cell.appendChild(matchContainer);

      cell.onclick = () => {
        if (dayMatches.length === 1) openDetailSheet(dayMatches[0]);
        else if (dayMatches.length > 1) openMatchPicker(dayMatches);
      };

      calendarBody.appendChild(cell);
    }

    // --- Added Swipe Support for Calendar ---
    let touchStartX = 0;
    calendarBody.ontouchstart = (e) => { touchStartX = e.changedTouches[0].screenX; };
    calendarBody.ontouchend = (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < visibleSections.length - 1) scrollToIndex(currentIndex + 1);
        else if (diff < 0 && currentIndex > 0) scrollToIndex(currentIndex - 1);
      }
    };
  }

  function openMatchPicker(matches) {
    pickerList.innerHTML = matches.map(m => `
      <div class="picker-item" data-date="${m.date}" data-club="${m.club}" data-opp="${m.opponent}">
        <span class="picker-club ${m.club}">${m.club === 'niigata' ? '新潟' : '熊本'}</span>
        <span class="picker-opp">${m.opponent}</span>
      </div>
    `).join("");
    pickerOverlay.classList.add("active");
    pickerBackdrop.classList.add("active");
    
    pickerList.querySelectorAll(".picker-item").forEach(item => {
      item.onclick = () => {
        const m = matches.find(x => x.date === item.dataset.date && x.club === item.dataset.club && x.opponent === item.dataset.opp);
        if (m) { closeMatchPicker(); openDetailSheet(m); }
      };
    });
  }

  function closeMatchPicker() {
    pickerOverlay.classList.remove("active");
    pickerBackdrop.classList.remove("active");
  }

  // --- Detail Sheet & Persistence ---

  function openDetailSheet(match) {
    const mId = `${match.date}_${match.club}_${match.opponent}`;
    const sMemo = localStorage.getItem(`memo_${mId}`) || "";
    const isAttend = localStorage.getItem(`attend_${mId}`) === "true";
    const sMy = localStorage.getItem(`score_my_${mId}`) || "";
    const sOpp = localStorage.getItem(`score_opp_${mId}`) || "";
    
    let pkHtml = "";
    if (parseDate(match.date).getFullYear() === 2026) {
      const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "";
      const sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
      const isD = (sMy !== "" && sOpp !== "" && sMy === sOpp);
      pkHtml = `<div class="u-pk-area" style="${isD ? 'display:flex;' : 'display:none;'}"><span class="u-pk-label">PK</span><input type="number" class="u-score-input pk-my" value="${sPkM}"><span class="u-score-sep">-</span><input type="number" class="u-score-input pk-opp" value="${sPkO}"></div>`;
    }

    const homeAway = isHomeMatch(match.club, match.venue) ? "HOME" : "AWAY";
    const clubName = match.club === "niigata" ? "ALBIREX NIIGATA" : "ROASSO KUMAMOTO";
    const clubEmblem = match.club === "niigata" ? "https://github.com/niigatals/program/blob/main/program/niigata.png?raw=true" : "https://github.com/niigatals/program/blob/main/program/kumamoto.png?raw=true";

    sheetContent.innerHTML = `
      <div class="sheet-header club-${match.club}">
        <div class="sheet-meta">
          <span class="sheet-club">${clubName}</span>
          <span class="sheet-ha badge-${homeAway.toLowerCase()}">${homeAway}</span>
        </div>
        <span class="sheet-mw">${match.matchweek || "EX"}</span>
        <div class="sheet-opp-row">
          <h2 class="sheet-opp">${match.opponent}</h2>
          <img class="sheet-opp-emblem" src="${match.emblem}">
        </div>
        <p class="sheet-venue-info">${match.date} | ${match.venue}</p>
      </div>
      <div class="sheet-score-area"><input type="number" class="u-score-input my-score" value="${sMy}" placeholder="-"><span class="u-score-sep">:</span><input type="number" class="u-score-input opp-score" value="${sOpp}" placeholder="-"></div>
      ${pkHtml}
      <div class="u-attend-btn ${match.club} ${isAttend?'active':''}" id="attend-toggle">
        <span class="btn-icon" style="display: flex;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>
        <span class="btn-text">観戦予定</span>
      </div>
      <div class="u-note-single">
        <div class="u-note-box">
          <div class="u-note-header">
            <label>メモ</label>
            <button class="u-note-edit-btn" id="memo-edit-btn">編集</button>
          </div>
          <div class="u-memo-display" id="memo-display"></div>
          <textarea class="u-textarea memo-field hidden">${sMemo}</textarea>
        </div>
      </div>
      <button class="close-sheet-btn">保存して閉じる</button>
    `;

    // Helper: convert URLs to clickable links
    function linkifyMemo(text) {
      if (!text) return '';
      const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    }

    const memoDisplay = sheetContent.querySelector('#memo-display');
    const memoField = sheetContent.querySelector('.memo-field');
    const memoEditBtn = sheetContent.querySelector('#memo-edit-btn');

    // Initial display
    memoDisplay.innerHTML = linkifyMemo(sMemo);

    memoEditBtn.onclick = () => {
      const isEditing = memoDisplay.classList.contains('hidden');
      if (isEditing) {
        // Switch back to display mode
        const newText = memoField.value;
        memoDisplay.innerHTML = linkifyMemo(newText);
        memoDisplay.classList.remove('hidden');
        memoField.classList.add('hidden');
        memoEditBtn.textContent = '編集';
        memoEditBtn.classList.remove('editing');
      } else {
        // Switch to edit mode
        memoDisplay.classList.add('hidden');
        memoField.classList.remove('hidden');
        memoField.focus();
        memoEditBtn.textContent = '完了';
        memoEditBtn.classList.add('editing');
      }
    };

    detailSheet.classList.add("active");
    sheetBackdrop.classList.add("active");

    // Prevent touch events from leaking through to the feed slider behind
    detailSheet.ontouchstart = (e) => e.stopPropagation();
    detailSheet.ontouchmove = (e) => e.stopPropagation();

    sheetContent.querySelector(".close-sheet-btn").onclick = () => closeDetailSheet();
    sheetBackdrop.onclick = () => closeDetailSheet();
    document.querySelector(".sheet-handle").onclick = () => closeDetailSheet();

    const toggleBtn = document.getElementById("attend-toggle");
    toggleBtn.onclick = () => {
      toggleBtn.classList.toggle("active");
      saveAndRefresh();
      if (currentMode === "calendar") renderCalendar();
    };

    const saveAndRefresh = () => {
      const mS = sheetContent.querySelector(".my-score").value;
      const oS = sheetContent.querySelector(".opp-score").value;
      const mVal = sheetContent.querySelector(".memo-field").value;
      const isAtt = toggleBtn.classList.contains("active");

      localStorage.setItem(`score_my_${mId}`, mS); localStorage.setItem(`score_opp_${mId}`, oS);
      localStorage.setItem(`memo_${mId}`, mVal);
      localStorage.setItem(`attend_${mId}`, isAtt);

      let pm = "", po = "";
      const pkA = sheetContent.querySelector(".u-pk-area");
      if (pkA) {
        pkA.style.display = (mS !== "" && oS !== "" && mS === oS) ? "flex" : "none";
        pm = sheetContent.querySelector(".pk-my").value; po = sheetContent.querySelector(".pk-opp").value;
        localStorage.setItem(`score_my_pk_${mId}`, pm); localStorage.setItem(`score_opp_pk_${mId}`, po);
      }

      const card = document.querySelector(`.card[data-mid="${mId}"]`);
      if (card) {
        let res = null; if (mS !== "" && oS !== "") {
          const ms = Number(mS), os = Number(oS); if (ms > os) res = "win"; else if (ms < os) res = "lose"; else if (pm !== "" && po !== "") res = Number(pm) > Number(po) ? "pk-win" : "pk-lose"; else res = "draw";
        }
        const badge = card.querySelector(".result-badge"); badge.className = "result-badge " + (res ? "badge-" + res : "");
        badge.textContent = res ? res.replace("-"," ").toUpperCase() : "";
        
        // Update Attendance Emoji in Feed
        const metaDiv = card.querySelector(".match-meta");
        let attEl = metaDiv.querySelector(".match-att-emoji");
        if (isAtt) {
          if (!attEl) {
            attEl = document.createElement("span");
            attEl.className = "match-att-emoji";
            attEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
            metaDiv.appendChild(attEl);
          }
        } else {
          if (attEl) attEl.remove();
        }
      }
    };
    sheetContent.querySelectorAll("input, textarea").forEach(inp => inp.oninput = saveAndRefresh);
  }

  function closeDetailSheet() { detailSheet.classList.remove("active"); sheetBackdrop.classList.remove("active"); }

  // --- Rendering Feed ---

  function renderFeed() {
    feedSlider.innerHTML = "";
    scheduleData.sort((a,b) => parseDate(a.date) - parseDate(b.date));
    const ymMap = {};
    scheduleData.forEach(m => {
      const d = parseDate(m.date), key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if(!ymMap[key]) ymMap[key] = []; ymMap[key].push(m);
    });

    Object.keys(ymMap).sort().forEach(key => {
      const [year, month] = key.split("-").map(Number);
      const section = document.createElement("div"); section.className = "month-section"; section.dataset.ym = key; section.dataset.year = year; section.dataset.ym_title = `${year} / ${String(month).padStart(2,"0")}`;

      ymMap[key].forEach(match => {
        const mId = `${match.date}_${match.club}_${match.opponent}`;
        const isAtt = localStorage.getItem(`attend_${mId}`) === "true";
        const sMy = localStorage.getItem(`score_my_${mId}`) || "", sOpp = localStorage.getItem(`score_opp_${mId}`) || "";
        const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "", sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
        let res = null; if (sMy !== "" && sOpp !== "") {
          const ms = Number(sMy), os = Number(sOpp); if (ms > os) res = "win"; else if (ms < os) res = "lose"; else if (sPkM !== "" && sPkO !== "") res = Number(sPkM) > Number(sPkO) ? "pk-win" : "pk-lose"; else res = "draw";
        }
        const isHome = isHomeMatch(match.club, match.venue);
        const card = document.createElement("div"); card.className = `card club-${match.club} type-${isHome ? 'home' : 'away'}`; card.dataset.mid = mId;
        const ha = isHome ? 'HOME' : 'AWAY';
        card.innerHTML = `<div class="result-badge ${res ? 'badge-'+res : ''}">${res ? res.replace("-"," ").toUpperCase() : ""}</div><div class="match-meta"><span class="match-mw-pill">${match.matchweek || "EX"}</span><span class="match-ha-pill">${ha}</span>${isAtt ? '<span class="match-att-emoji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>' : ''}</div><div class="match-date-time">${match.date} ${match.day} - ${match.time}</div><div class="match-venue">${match.venue}</div><div class="match-row"><h3 class="opponent-name">${match.opponent}</h3><img class="emblem" src="${match.emblem}"></div>`;
        card.onclick = () => openDetailSheet(match);
        section.appendChild(card);
      });
      feedSlider.appendChild(section);
    });
    allSections = Array.from(document.querySelectorAll(".month-section"));
    updateClubVisibility();
  }

  // --- Initializing App ---
  renderFeed();
  const today = new Date(), todayY = today.getFullYear(), tKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  applyYearFilter(allSections.some(s => Number(s.dataset.year) === todayY) ? todayY : 2025, true);
  const tIdx = visibleSections.findIndex(s => s.dataset.ym === tKey);
  
  // Use requestAnimationFrame and small timeout to ensure layout is ready for iPhone
  requestAnimationFrame(() => {
    setTimeout(() => {
      scrollToIndex(tIdx !== -1 ? tIdx : 0);
    }, 100);
  });

  // Navigation
  prevBtn.onclick = () => { if(currentIndex > 0) scrollToIndex(currentIndex-1); };
  nextBtn.onclick = () => { if(currentIndex < visibleSections.length-1) scrollToIndex(currentIndex+1); };
  goTodayBtn.onclick = () => {
    const n = new Date(), y = n.getFullYear(), k = `${y}-${String(n.getMonth()+1).padStart(2,"0")}`;
    applyYearFilter(y); 
    const i = visibleSections.findIndex(s => s.dataset.ym === k);
    if(i !== -1) scrollToIndex(i);
  };

  yearTabs["2025"].onclick = () => applyYearFilter(2025);
  yearTabs["2026"].onclick = () => applyYearFilter(2026);
  yearTabs["all"].onclick = () => applyYearFilter(null);

  // YM Picker
  function openYmPicker() {
    if(!activeMonthTitle.textContent.includes("/")) return; // Not fully initialized
    ymPickerList.innerHTML = "";
    const yearMap = {};
    allSections.forEach(sec => {
      const y = sec.dataset.year;
      if (!yearMap[y]) yearMap[y] = [];
      yearMap[y].push({ ym: sec.dataset.ym, m: sec.dataset.ym.split("-")[1] });
    });

    Object.keys(yearMap).sort().forEach(y => {
      const g = document.createElement("div"); g.className = "ym-picker-group";
      g.innerHTML = `<div class="ym-picker-year-label">${y}年</div><div class="ym-picker-months"></div>`;
      const grid = g.querySelector(".ym-picker-months");
      yearMap[y].forEach(item => {
        const btn = document.createElement("button"); btn.className = "ym-picker-btn";
        btn.textContent = Number(item.m) + "月";
        if (visibleSections[currentIndex] && visibleSections[currentIndex].dataset.ym === item.ym) {
           btn.classList.add("current");
        }
        btn.onclick = () => {
          closeYmPicker();
          applyYearFilter(selectedYear === null ? null : Number(y));
          const idx = visibleSections.findIndex(s => s.dataset.ym === item.ym);
          if (idx !== -1) scrollToIndex(idx);
        };
        grid.appendChild(btn);
      });
      ymPickerList.appendChild(g);
    });
    ymPickerOverlay.classList.add("active");
    ymPickerBackdrop.classList.add("active");
  }
  function closeYmPicker() {
    ymPickerOverlay.classList.remove("active");
    ymPickerBackdrop.classList.remove("active");
  }
  activeMonthTitle.onclick = openYmPicker;
  document.getElementById("ym-picker-close").onclick = closeYmPicker;
  ymPickerBackdrop.onclick = closeYmPicker;

  // Club Filter
  toggleNiigata.onclick = () => { toggleNiigata.classList.toggle("active"); updateClubVisibility(); };
  toggleKumamoto.onclick = () => { toggleKumamoto.classList.toggle("active"); updateClubVisibility(); };

  // Menus
  const toggleMenu = (isOpen) => {
    if (isOpen) {
      sideMenu.classList.add("active");
      sideMenuBackdrop.classList.add("active");
    } else {
      sideMenu.classList.remove("active");
      sideMenuBackdrop.classList.remove("active");
    }
  };
  hamBtn.onclick = () => toggleMenu(true);
  document.getElementById("menu-close").onclick = () => toggleMenu(false);
  sideMenuBackdrop.onclick = () => toggleMenu(false);
  
  // Close menu after clicking item
  const menuItems = document.querySelectorAll(".menu-card");
  menuItems.forEach(btn => btn.addEventListener('click', () => toggleMenu(false)));

  document.getElementById("menu-feed").onclick = () => switchMode("feed");
  document.getElementById("menu-calendar").onclick = () => switchMode("calendar");
  document.getElementById("menu-links").onclick = () => openSubPane("links-overlay");
  document.getElementById("menu-chants").onclick = () => openSubPane("chants-overlay");
  document.getElementById("menu-standings").onclick = () => {
    openSubPane("standings-overlay");
    openStandingsSheet();
  };
  document.getElementById("menu-data").onclick = () => openSubPane("data-overlay");

  // Data Backup Logic
  document.getElementById("export-btn").onclick = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith("score_") || k.startsWith("memo_") || k.startsWith("attend_") || k.startsWith("note_")) {
        data[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match_day_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = document.getElementById("import-file");
  document.getElementById("import-trigger").onclick = () => importFile.click();
  importFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
        alert("インポートが完了しました。アプリを再読み込みします。");
        location.reload();
      } catch (err) {
        alert("失敗: 正しいバックアップファイルを選択してください。");
      }
    };
    reader.readAsText(file);
  };

  ultraFeed.addEventListener("scroll", updateActiveUI);

  // Search Logic
  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { searchPopup.style.display = "none"; return; }
    const m = scheduleData.filter(x => (x.opponent||"").toLowerCase().includes(q) || (x.venue||"").toLowerCase().includes(q)).slice(0, 10);
    if (m.length > 0) {
      searchPopup.innerHTML = m.map(x => `<div class="search-item" data-date="${x.date}" data-club="${x.club}" data-opponent="${x.opponent}"><strong>${x.opponent}</strong><br><small>${x.date} | ${x.club.toUpperCase()}</small></div>`).join("");
      searchPopup.style.display = "block";
    } else { searchPopup.style.display = "none"; }
  };
  searchPopup.onclick = (e) => {
    const item = e.target.closest(".search-item");
    if(item) {
      const { date, club, opponent } = item.dataset;
      const x = scheduleData.find(m => m.date === date && m.club === club && m.opponent === opponent);
      if(x) { 
        searchPopup.style.display="none"; searchInput.value=""; 
        const d = parseDate(date), ty = d.getFullYear(), tk = `${ty}-${String(d.getMonth()+1).padStart(2,"0")}`;
        applyYearFilter(ty, true); const i = visibleSections.findIndex(s => s.dataset.ym === tk);
        if(i !== -1) { scrollToIndex(i); setTimeout(() => openDetailSheet(x), 500); }
      }
    }
  };

  sheetBackdrop.onclick = () => closeDetailSheet();
  document.querySelector(".sheet-handle").onclick = () => closeDetailSheet();
  pickerBackdrop.onclick = () => closeMatchPicker();
  document.querySelector(".close-pop").onclick = () => closeMatchPicker();

  // 📋 Export Attendance Schedule
  const exportListBtn = document.getElementById("export-list-btn");
  if (exportListBtn) {
    exportListBtn.onclick = async () => {
      let txt = "【観戦予定リスト】\n\n";
      const attMatches = scheduleData.filter(match => {
        const mId = `${match.date}_${match.club}_${match.opponent}`;
        return localStorage.getItem(`attend_${mId}`) === "true";
      }).sort((a,b) => parseDate(a.date) - parseDate(b.date));
      
      if (attMatches.length === 0) {
        alert("観戦予定の試合はまだありません。");
        return;
      }
      attMatches.forEach(m => {
        const isHome = isHomeMatch(m.club, m.venue);
        txt += `${m.date} ${m.day} ${m.time} - vs ${m.opponent}\n`;
        txt += `📍 ${m.venue} (${isHome ? 'HOME' : 'AWAY'})\n\n`;
      });
      txt += "Powered by Match Day Ultra";
      try {
        await navigator.clipboard.writeText(txt);
        alert("観戦予定リストをクリップボードにコピーしました！\nLINEやメモ帳に貼り付けて共有できます。");
      } catch (err) {
        alert("コピーに失敗しました。このブラウザではサポートされていない可能性があります。");
      }
    };
  }

  // ⚡ Fast Input Modal
  const fastInputBtn = document.getElementById("fast-input-btn");
  const fastInputSheet = document.getElementById("fast-input-sheet");
  const fastInputList = document.getElementById("fast-input-list");
  const saveFastInputBtn = document.getElementById("save-fast-input");
  const closeFastInputBtn = document.getElementById("close-fast-input");

  let fastSelectedYear = 2026;

  function renderFastInput() {
    fastInputList.innerHTML = "";
    
    // 選択された年の試合の全件を取得（未来の試合も含める）
    const yearMatches = scheduleData.filter(m => {
      return parseDate(m.date).getFullYear() === fastSelectedYear;
    }).sort((a,b) => parseDate(a.date) - parseDate(b.date));

    if(yearMatches.length === 0) {
       fastInputList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-grey);">${fastSelectedYear}年の該当する試合はありません。</div>`;
    } else {
       yearMatches.forEach(m => {
         const mYear = parseDate(m.date).getFullYear();
         const mId = `${m.date}_${m.club}_${m.opponent}`;
         const sMy = localStorage.getItem(`score_my_${mId}`) || "";
         const sOpp = localStorage.getItem(`score_opp_${mId}`) || "";

         const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "";
         const sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
         const isAttend = localStorage.getItem(`attend_${mId}`) === "true";
         
         // 2026年でかつ現在の入力値が同点の場合のみPK領域を表示する
         const isDraw = sMy !== "" && sOpp !== "" && sMy === sOpp;
         const showPk = mYear === 2026 && isDraw;
         
         const div = document.createElement("div");
         div.style.cssText = "padding: 15px; border-bottom: 1px solid #e3e3e8; display: flex; align-items: center; justify-content: space-between; gap: 10px;";
         div.innerHTML = `
           <div style="flex:1;">
             <div style="font-size: 0.8rem; color: var(--text-grey); font-weight:700;">${m.date} | ${m.club.toUpperCase()}</div>
             <div style="font-size: 1.1rem; font-weight:900; font-family: var(--font-kick); margin-top:4px;">vs ${m.opponent}</div>
           </div>
           
           <div style="display: flex; flex-direction: column; gap: 5px; align-items: flex-end;">
             <div style="display: flex; gap: 4px; align-items: center;">
               <input type="number" class="fast-my-score" data-year="${mYear}" data-mid="${mId}" data-type="my" value="${sMy}" style="width:45px; height:35px; text-align:center; font-size:1.1rem; font-weight:900; background:#f2f2f7; border:none; border-radius:8px; color:var(--text-main);" placeholder="-">
               <span style="font-weight:900; color:var(--text-grey);">-</span>
               <input type="number" class="fast-opp-score" data-year="${mYear}" data-mid="${mId}" data-type="opp" value="${sOpp}" style="width:45px; height:35px; text-align:center; font-size:1.1rem; font-weight:900; background:#f2f2f7; border:none; border-radius:8px; color:var(--text-main);" placeholder="-">
             </div>
             
             <!-- PK入力領域（2026年かつ同点時のみ表示） -->
             <div class="fast-pk-area" style="display: ${showPk ? 'flex' : 'none'}; gap: 4px; align-items: center;">
               <span style="font-size:0.7rem; font-weight:700; color:var(--text-grey);">PK</span>
               <input type="number" data-mid="${mId}" data-type="pkMy" value="${sPkM}" style="width:35px; height:25px; text-align:center; font-size:0.9rem; font-weight:800; background:#fffdf5; border:1px solid #ddd; border-radius:6px; color:var(--text-main);" placeholder="-">
               <span style="font-weight:900; color:var(--text-grey);">-</span>
               <input type="number" data-mid="${mId}" data-type="pkOpp" value="${sPkO}" style="width:35px; height:25px; text-align:center; font-size:0.9rem; font-weight:800; background:#fffdf5; border:1px solid #ddd; border-radius:6px; color:var(--text-main);" placeholder="-">
             </div>
           </div>

           <button class="u-attend-btn ${isAttend ? 'active' : ''} ${m.club}" data-mid="${mId}" data-type="attend" style="width:45px; height:45px; padding:0; margin:0; display:flex; align-items:center; justify-content:center; border-radius:12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; pointer-events: none;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></button>
         `;
         fastInputList.appendChild(div);
       });
    }
    fastInputSheet.classList.add("active");
  }

  // Handle manual attend toggle and dynamic PK display in fast input
  if (fastInputList) {
    // スコア入力時の動的なPK領域の表示切替
    fastInputList.oninput = (e) => {
      const inp = e.target;
      if (inp.classList.contains("fast-my-score") || inp.classList.contains("fast-opp-score")) {
        const mYear = parseInt(inp.dataset.year);
        if (mYear === 2026) {
          const container = inp.closest("div").parentElement; // .flex-end 領域
          const pkArea = container.querySelector(".fast-pk-area");
          if (pkArea) {
             const mS = container.querySelector(".fast-my-score").value;
             const oS = container.querySelector(".fast-opp-score").value;
             pkArea.style.display = (mS !== "" && oS !== "" && mS === oS) ? "flex" : "none";
          }
        }
      }
    };
    
    // 観戦トグルのハンドリング
    fastInputList.onclick = (e) => {
      const btn = e.target.closest("button[data-type='attend']");
      if (btn) {
        btn.classList.toggle("active");
      }
    };
  }

  if (fastInputBtn) {
    fastInputBtn.onclick = () => {
      renderFastInput();
      fastInputSheet.classList.add("active");
    };
  }
  
  if (closeFastInputBtn) closeFastInputBtn.onclick = () => fastInputSheet.classList.remove("active");

  document.querySelectorAll(".fast-year-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".fast-year-tab").forEach(t => {
        t.classList.remove("active");
        t.style.background = "#f2f2f7";
        t.style.color = "var(--text-grey)";
      });
      tab.classList.add("active");
      tab.style.background = "var(--text-main)";
      tab.style.color = "white";
      fastSelectedYear = Number(tab.dataset.y);
      renderFastInput();
    };
  });

  if (saveFastInputBtn) {
    saveFastInputBtn.onclick = () => {
      const inputs = fastInputList.querySelectorAll("input[type='number']");
      let savedCount = 0;
      const scoreMap = {};
      
      inputs.forEach(inp => {
        const mId = inp.dataset.mid;
        if (!scoreMap[mId]) scoreMap[mId] = {};
        scoreMap[mId][inp.dataset.type] = inp.value;
      });

      const attendBtns = fastInputList.querySelectorAll("button[data-type='attend']");
      attendBtns.forEach(btn => {
        const mId = btn.dataset.mid;
        if (!scoreMap[mId]) scoreMap[mId] = {};
        scoreMap[mId].attend = btn.classList.contains("active");
      });

      Object.keys(scoreMap).forEach(mId => {
        const s = scoreMap[mId];
        let hasEdit = false;
        if (s.my !== undefined && s.opp !== undefined && (s.my !== "" || s.opp !== "")) {
          localStorage.setItem(`score_my_${mId}`, s.my);
          localStorage.setItem(`score_opp_${mId}`, s.opp);
          hasEdit = true;
        } else if (s.my === "" && s.opp === "") {
          localStorage.removeItem(`score_my_${mId}`);
          localStorage.removeItem(`score_opp_${mId}`);
        }
        
        if (s.pkMy !== undefined && s.pkOpp !== undefined && (s.pkMy !== "" || s.pkOpp !== "")) {
          localStorage.setItem(`score_my_pk_${mId}`, s.pkMy);
          localStorage.setItem(`score_opp_pk_${mId}`, s.pkOpp);
        } else if (s.pkMy === "" && s.pkOpp === "") {
          localStorage.removeItem(`score_my_pk_${mId}`);
          localStorage.removeItem(`score_opp_pk_${mId}`);
        }

        if (s.attend !== undefined) {
          localStorage.setItem(`attend_${mId}`, s.attend);
          hasEdit = true;
        }
        
        if (hasEdit) savedCount++;
      });

      if (savedCount > 0) {
        renderFeed();
        if (calendarView && !calendarView.classList.contains("hidden-view")) {
           switchMode("calendar");
        }
        alert(`一括入力の内容を保存しました。`);
      }
      fastInputSheet.classList.remove("active");
    };
  }

  // 📋 Text Bulk Input Parsing
  const bulkPasteBtn = document.getElementById("bulk-paste-btn");
  if (bulkPasteBtn) {
    bulkPasteBtn.onclick = () => {
      const text = document.getElementById("bulk-paste-area").value;
      if (!text) return;
      
      const blocks = text.split(/第(\d+)節/);
      let savedCount = 0;
      // blocks[0] is string before "第X節", odds are the numbers, evens are the text contents
      for (let i = 1; i < blocks.length; i += 2) {
        const mwNum = blocks[i];
        const content = blocks[i+1];
        
        const scoreMatch = content.match(/(○|●|△|[-])?\s*(\d+)-(\d+)(?:\s*PK(\d+)-(\d+))?/);
        if (scoreMatch) {
          const myScore = scoreMatch[2];
          const oppScore = scoreMatch[3];
          const pkMy = scoreMatch[4] || "";
          const pkOpp = scoreMatch[5] || "";
          const mDateMatch = content.match(/(\d{1,2})\/(\d{1,2})/);
          let mPadDate = "";
          if (mDateMatch) {
            mPadDate = `${String(mDateMatch[1]).padStart(2, '0')}-${String(mDateMatch[2]).padStart(2, '0')}`;
          }

          const candidates = scheduleData.filter(m => m.matchweek === `MW${mwNum}`);
          let target = null;
          
          // 対戦クラブ名（最低2文字）と日付を紐づけて確実に対象試合を特定する
          for (const c of candidates) {
            // 英語や記号を取り除き、純粋なクラブの頭文字2文字で判定する（FC今治などがマッチしない問題の修正）
            const oppNameBase = c.opponent.replace(/[A-Za-zＡ-Ｚａ-ｚ\s・.()]/g, '').substring(0, 2);
            const isNameMatch = oppNameBase.length > 0 && content.includes(oppNameBase);
            const isDateMatch = mPadDate && c.date.endsWith(mPadDate);
            
            if (isNameMatch && isDateMatch) {
              target = c;
              break;
            } else if (isNameMatch && !target) {
              target = c; // 代替としてクラブ名一致のみを保持
            }
          }
          if (target) {
            const mId = `${target.date}_${target.club}_${target.opponent}`;
            localStorage.setItem(`score_my_${mId}`, myScore);
            localStorage.setItem(`score_opp_${mId}`, oppScore);
            if (pkMy && pkOpp) {
              localStorage.setItem(`score_my_pk_${mId}`, pkMy);
              localStorage.setItem(`score_opp_pk_${mId}`, pkOpp);
            }
            savedCount++;
          }
        }
      }
      
      if (savedCount > 0) {
        renderFeed();
        if (calendarView && !calendarView.classList.contains("hidden-view")) {
           switchMode("calendar");
        }
        alert(`${savedCount}試合の結果をテキストから抽出して保存しました。`);
        document.getElementById("bulk-paste-area").value = "";
      } else {
        alert("結果を抽出できませんでした。形式を確認してください。");
      }
    };
  }

  // 📢 Chants Accordion Logic
  document.querySelectorAll('.u-chant-title').forEach(title => {
    title.onclick = () => {
      const parent = title.parentElement;
      parent.classList.toggle('active');
    };
  });

  //=========================================
  // Standings Logic (Scraping via CORS Proxy)
  //=========================================
  let currentStandingsLeague = 'j1';
  let standingsCache = { 'j1': null, 'j2': null };

  window.openStandingsSheet = function() {
    renderStandings(currentStandingsLeague);
  };

  document.querySelectorAll('.standings-tabs .u-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.standings-tabs .u-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentStandingsLeague = e.target.dataset.league;
      renderStandings(currentStandingsLeague);
    });
  });

  async function renderStandings(league) {
    const loading = document.getElementById('standings-loading');
    const errorEl = document.getElementById('standings-error');
    const contentEl = document.getElementById('standings-content-area');
    
    loading.style.display = 'flex';
    errorEl.style.display = 'none';
    contentEl.innerHTML = '';

    if (standingsCache[league]) {
      loading.style.display = 'none';
      contentEl.innerHTML = standingsCache[league];
      return;
    }

    try {
      // Yahooはスクレイピング対策やJS描画が多く安定しないため、最も安定しているJリーグ公式データサイトをスクレイピングする
      const targetUrl = league === 'j1' 
        ? "https://data.j-league.or.jp/SFRT01/"
        : "https://data.j-league.or.jp/SFRT01/?competitionSectionId=0&competitionId=563&yearId=2024"; // J2 fallback
        
      const proxies = [
        { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, isJson: false },
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, isJson: true },
        { url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, isJson: false }
      ];

      let htmlText = null;
      let lastErrorName = "";

      for (let p of proxies) {
        try {
          const res = await fetch(p.url, {
             // omit credentials for CORS
          });
          if (!res.ok) throw new Error("Status Error");
          
          if (p.isJson) {
            const data = await res.json();
            htmlText = data.contents;
          } else {
            htmlText = await res.text();
          }
          
          if (htmlText) break; // Success
        } catch(e) {
          lastErrorName = e.message;
          // continue to next proxy
        }
      }

      if (!htmlText) {
         throw new Error("プロキシ接続に失敗しました: " + (lastErrorName || "Failed to fetch"));
      }
      
      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      
      // Yahoo Sports table class is usually inside a container, finding <table>
      let tables = Array.from(doc.querySelectorAll('.sn-table table'));
      if(tables.length === 0) tables = Array.from(doc.querySelectorAll('table'));
      
      if(tables.length === 0) {
          throw new Error("現在オフシーズン、または特別期間中のためデータが見つかりませんでした。");
      }

      // Process tables to our format
      let outHTML = "";
      tables.forEach((tableDOM) => {
         // try to find prior header (like EAST / WEST)
         let title = "";
         let prev = tableDOM.closest('.sn-table')?.previousElementSibling;
         if (!prev) prev = tableDOM.previousElementSibling;
         
         if (prev && prev.tagName && prev.tagName.match(/^H[1-6]$/)) {
            title = prev.textContent.trim().replace(/順位表.*/, '');
         } else if (prev && prev.innerText) {
            // maybe it's inside a header tag
            let h = prev.querySelector('h1, h2, h3, h4');
            if (h) title = h.textContent.trim();
         }

         if (title) {
            outHTML += `<h4 style="margin: 16px 0 8px; color: var(--text-main); padding-left:6px; border-left:3px solid var(--primary); font-size:1.05rem;">${title}</h4>`;
         }
         outHTML += formatParsedTable(tableDOM);
      });
      
      standingsCache[league] = outHTML;
      
      loading.style.display = 'none';
      contentEl.innerHTML = outHTML;

    } catch (err) {
      loading.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.innerText = err.message || "順位表の取得に失敗しました。";
    }
  }

  function formatParsedTable(originalTable) {
      const rows = Array.from(originalTable.querySelectorAll('tr'));
      if (rows.length < 2) return "";

      const headers = Array.from(rows[0].querySelectorAll('th, td')).map(th => th.textContent.trim());
      
      // Dynamic mapping for special season columns (like PK win/loss might exist, so indexes shift)
      const idxRank = headers.findIndex(h => h.includes("順位"));
      const idxTeam = headers.findIndex(h => h.includes("チーム"));
      const idxPts  = headers.findIndex(h => h.includes("勝点"));
      const idxPlay = headers.findIndex(h => h.includes("試合"));
      const idxWin  = headers.findIndex(h => h === "勝");
      const idxDraw = headers.findIndex(h => h === "引" || h === "分" || h === "引分");
      const idxLose = headers.findIndex(h => h === "負" || h === "敗");
      const idxDiff = headers.findIndex(h => h.includes("差"));

      // Fallback if exact match isn't found
      const pRank = idxRank !== -1 ? idxRank : 0;
      const pTeam = idxTeam !== -1 ? idxTeam : 1;
      const pPts  = idxPts !== -1 ? idxPts : 2;
      const pPlay = idxPlay !== -1 ? idxPlay : 3;
      const pWin  = idxWin !== -1 ? idxWin : 4;
      const pDraw = idxDraw !== -1 ? idxDraw : 5;
      const pLose = idxLose !== -1 ? idxLose : 6;
      const pDiff = idxDiff !== -1 ? idxDiff : headers.length - 1;

      let resultHTML = `<table class="parsed-standings-table">`;
      resultHTML += `<thead><tr>
          <th>順位</th>
          <th class="col-team">チーム</th>
          <th>勝点</th>
          <th>試</th>
          <th>勝</th>
          <th>分</th>
          <th>負</th>
          <th>差</th>
      </tr></thead><tbody>`;

      for(let i = 1; i < rows.length; i++) {
          const cols = rows[i].querySelectorAll('td, th');
          if(cols.length < 4) continue; // safety check
          
          let rank = cols[pRank]?.textContent.trim().replace(/\D/g, '') || "-";
          let teamName = cols[pTeam]?.textContent.trim() || "-";
          
          // J-League data site cleanup
          teamName = teamName.replace(/[\r\n\t]/g, '').trim();
          
          let pts = cols[pPts]?.textContent.trim() || "-";
          let played = cols[pPlay]?.textContent.trim() || "-";
          let win = cols[pWin]?.textContent.trim() || "0";
          let draw = cols[pDraw]?.textContent.trim() || "0";
          let lose = cols[pLose]?.textContent.trim() || "0";
          let diff = cols[pDiff]?.textContent.trim() || "0";

          resultHTML += `<tr>
              <td class="col-rank">${rank}</td>
              <td class="col-team">${teamName}</td>
              <td class="col-pts">${pts}</td>
              <td>${played}</td>
              <td>${win}</td>
              <td>${draw}</td>
              <td>${lose}</td>
              <td>${diff}</td>
          </tr>`;
      }
      
      resultHTML += `</tbody></table>`;
      return resultHTML;
  }
});
