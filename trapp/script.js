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
    const sWeather = localStorage.getItem(`weather_${mId}`) || "";
    const sTemp = localStorage.getItem(`temp_${mId}`) || "";

    const J_CLUB_ENG = {
      "北海道コンサドーレ札幌": "HOKKAIDO CONSADOLE SAPPORO", "ヴァンラーレ八戸": "VANRAURE HACHINOHE", "いわてグルージャ盛岡": "IWATE GRULLA MORIOKA", "ベガルタ仙台": "VEGALTA SENDAI", "ブラウブリッツ秋田": "BLAUBLITZ AKITA", "モンテディオ山形": "MONTEDIO YAMAGATA", "福島ユナイテッドFC": "FUKUSHIMA UNITED FC", "いわきFC": "IWAKI FC", "鹿島アントラーズ": "KASHIMA ANTLERS", "水戸ホーリーホック": "MITO HOLLYHOCK", "栃木SC": "TOCHIGI SC", "ザスパ群馬": "THESPA GUNMA", "浦和レッズ": "URAWA REDS", "大宮アルディージャ": "OMIYA ARDIJA", "RB大宮アルディージャ": "RB OMIYA ARDIJA", "ジェフユナイテッド千葉": "JEF UNITED CHIBA", "柏レイソル": "KASHIWA REYSOL", "FC東京": "FC TOKYO", "東京ヴェルディ": "TOKYO VERDY", "FC町田ゼルビア": "FC MACHIDA ZELVIA", "川崎フロンターレ": "KAWASAKI FRONTALE", "横浜F・マリノス": "YOKOHAMA F. MARINOS", "横浜FC": "YOKOHAMA FC", "Y.S.C.C.横浜": "Y.S.C.C. YOKOHAMA", "湘南ベルマーレ": "SHONAN BELLMARE", "SC相模原": "SC SAGAMIHARA", "ヴァンフォーレ甲府": "VENTFORET KOFU", "松本山雅FC": "MATSUMOTO YAMAGA FC", "AC長野パルセイロ": "AC NAGANO PARCEIRO", "アルビレックス新潟": "ALBIREX NIIGATA", "カターレ富山": "KATALLER TOYAMA", "ツエーゲン金沢": "ZWEIGEN KANAZAWA", "清水エスパルス": "SHIMIZU S-PULSE", "ジュビロ磐田": "JUBILO IWATA", "藤枝MYFC": "FUJIEDA MYFC", "アスルクラロ沼津": "AZUL CLARO NUMAZU", "名古屋グランパス": "NAGOYA GRAMPUS", "FC岐阜": "FC GIFU", "京都サンガF.C.": "KYOTO SANGA F.C.", "ガンバ大阪": "GAMBA OSAKA", "セレッソ大阪": "CEREZO OSAKA", "FC大阪": "FC OSAKA", "ヴィッセル神戸": "VISSEL KOBE", "ヴィッセル神戶": "VISSEL KOBE", "奈良クラブ": "NARA CLUB", "ガイナーレ鳥取": "GAINARE TOTTORI", "ファジアーノ岡山": "FAGIANO OKAYAMA", "サンフレッチェ広島": "SANFRECCE HIROSHIMA", "レノファ山口FC": "RENOFA YAMAGUCHI FC", "カマタマーレ讃岐": "KAMATAMARE SANUKI", "徳島ヴォルティス": "TOKUSHIMA VORTIS", "愛媛FC": "EHIME FC", "FC今治": "FC IMABARI", "アビスパ福岡": "AVISPA FUKUOKA", "ギラヴァンツ北九州": "GIRAVANZ KITAKYUSHU", "サガン鳥栖": "SAGAN TOSU", "V・ファーレン長崎": "V-VAREN NAGASAKI", "ロアッソ熊本": "ROASSO KUMAMOTO", "大分トリニータ": "OITA TRINITA", "テゲバジャーロ宮崎": "TEGEVAJARO MIYAZAKI", "鹿児島ユナイテッドFC": "KAGOSHIMA UNITED FC", "FC琉球": "FC RYUKYU", "高知ユナイテッドSC": "KOCHI UNITED SC", "レイラック滋賀FC": "REILAC SHIGA FC"
    };
    
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

    const engOpp = J_CLUB_ENG[match.opponent] || match.opponent.toUpperCase();

    sheetContent.innerHTML = `
      <div class="sheet-header club-${match.club}">
        <div class="sheet-meta">
          <span class="sheet-club">${clubName}</span>
          <span class="sheet-ha badge-${homeAway.toLowerCase()}">${homeAway}</span>
        </div>
        <span class="sheet-mw">${match.matchweek || "EX"}</span>
        <div class="sheet-opp-row" style="align-items: flex-start; margin-bottom: 5px;">
          <div style="display:flex; flex-direction:column; align-items:center; flex:1;">
            <h2 class="sheet-opp" style="margin-bottom:0;">${match.opponent}</h2>
            <div class="sheet-opp-eng" style="font-size: 0.75rem; color: #666; font-family: var(--font-kick); font-weight: 800; letter-spacing: 0.5px; margin-top: 2px;">${engOpp}</div>
          </div>
          <img class="sheet-opp-emblem" src="${match.emblem}">
        </div>
        <div class="sheet-venue-row" style="display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:8px;">
          <p class="sheet-venue-info" style="margin:0;">${match.date} | ${match.venue}</p>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.venue)}" target="_blank" style="background:#f2f2f7; color:var(--text-main); font-size:0.75rem; padding:6px 12px; border-radius:15px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> MAPで開く</a>
        </div>
      </div>
      <div id="u-auto-weather-area" style="display: none; gap: 15px; justify-content: center; margin: 15px 0;">
        <div style="display:flex; flex-direction:column; align-items:center;">
           <span style="font-size:0.65rem; color:#888; position:relative;">天気 <span id="auto-weather-badge" style="position:absolute; top:-12px; left:120%; width:max-content; background:#28a745; color:white; font-size:0.5rem; padding:1px 4px; border-radius:4px; font-weight:800; display:none;">取得済</span></span>
           <div id="u-weather-display" style="font-size: 1.5rem; margin-top: 4px;">-</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center;">
           <span style="font-size:0.65rem; color:#888;">最高気温 (℃)</span>
           <div id="u-temp-display" style="font-size: 1.2rem; font-family:var(--font-kick); font-weight:800; margin-top: 8px;">-</div>
        </div>
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

    // --- Weather Auto Fetch Logic ---
    const wArea = sheetContent.querySelector("#u-auto-weather-area");
    const wDisp = sheetContent.querySelector("#u-weather-display");
    const tDisp = sheetContent.querySelector("#u-temp-display");
    const aBadge = sheetContent.querySelector("#auto-weather-badge");

    const mDate = new Date(match.date);
    const now = new Date();
    const diffDays = (mDate - now) / (1000 * 60 * 60 * 24);
    
    // Only fetch and display for matches within -3 to 14 days
    if (diffDays >= -4 && diffDays <= 14) {
        wArea.style.display = "flex";

        const STADIUM_CITY_MAP = {
            "えがお健康スタジアム": "熊本市", "デンカビッグスワンスタジアム": "新潟市", "味の素スタジアム": "調布市",
            "豊田スタジアム": "豊田市", "パナソニックスタジアム吹田": "吹田市", "埼玉スタジアム2002": "さいたま市緑区",
            "ヨドコウ桜スタジアム": "大阪市東住吉区", "日産スタジアム": "横浜市港北区", "ニッパツ三ツ沢球技場": "横浜市神奈川区",
            "レモンガススタジアム平塚": "平塚市", "サンガスタジアム by KYOCERA": "亀岡市", "エディオンピースウイング広島": "広島市中区",
            "ベスト電器スタジアム": "福岡市博多区", "駅前不動産スタジアム": "鳥栖市", "昭和電工ドーム大分": "大分市",
            "クラサスドーム大分": "大分市", "ユアテックスタジアム仙台": "仙台市泉区", "IAIスタジアム日本平": "静岡市清水区",
            "エコパスタジアム": "袋井市", "ヤマハスタジアム": "磐田市", "トランスコスモススタジアム長崎": "諫早市",
            "PEACE STADIUM Connected by SoftBank": "長崎市", "フクダ電子アリーナ": "千葉市中央区", "三協フロンティア柏スタジアム": "柏市",
            "シティライトスタジアム": "岡山市北区", "JFE晴れの国スタジアム": "岡山市北区", "維新みらいふスタジアム": "山口市",
            "ポカリスエットスタジアム": "鳴門市", "鳴門・大塚スポーツパーク ポカリスエットスタジアム": "鳴門市",
            "ニンジニアスタジアム": "松山市", "NDソフトスタジアム山形": "天童市", "ソユースタジアム": "秋田市",
            "NACK5スタジアム大宮": "さいたま市大宮区", "ケーズデンキスタジアム水戸": "水戸市", "カンセキスタジアムとちぎ": "宇都宮市",
            "正田醤油スタジアム群馬": "前橋市", "ハワイアンズスタジアムいわき": "いわき市", "とうほう・みんなのスタジアム": "福島市",
            "プライフーズスタジアム": "八戸市", "いわぎんスタジアム": "盛岡市", "JIT リサイクルインク スタジアム": "甲府市",
            "サンプロ アルウィン": "松本市", "長野Uスタジアム": "長野市", "富山県総合運動公園陸上競技場": "富山市",
            "石川県西部緑地公園陸上競技場": "金沢市", "金沢ゴーゴーカレースタジアム": "金沢市", "藤枝総合運動公園サッカー場": "藤枝市",
            "愛鷹広域公園多目的競技場": "沼津市", "長良川競技場": "岐阜市", "東大阪市花園ラグビー場": "東大阪市",
            "ロートフィールド奈良": "奈良市", "Axisバードスタジアム": "鳥取市", "チュウブYAJINスタジアム": "米子市",
            "Pikaraスタジアム": "丸亀市", "四国化成MEGLIOスタジアム": "丸亀市", "アシックス里山スタジアム": "今治市",
            "ミクニワールドスタジアム北九州": "北九州市小倉北区", "いちご宮崎新富サッカー場": "新富町", "白波スタジアム": "鹿児島市",
            "タピック県総ひやごんスタジアム": "沖縄市", "Uvanceとどろきスタジアム by Fujitsu": "川崎市中原区",
            "大和ハウス プレミストドーム": "札幌市豊平区", "平和堂HATOスタジアム": "彦根市"
        };
        const searchLocation = STADIUM_CITY_MAP[match.venue] || match.venue;

        (async () => {
            try {
                let lat, lon;
                const cCache = localStorage.getItem('coord_' + searchLocation);
                if (cCache) {
                    const c = JSON.parse(cCache); lat = c.lat; lon = c.lon;
                } else {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchLocation)}&format=json&limit=1`);
                    const data = await res.json();
                    if (data && data[0]) {
                        lat = data[0].lat; lon = data[0].lon;
                        localStorage.setItem('coord_' + searchLocation, JSON.stringify({lat, lon}));
                    }
                }
                if (lat !== undefined && lon !== undefined) {
                    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&past_days=3&forecast_days=16`);
                    const wData = await wRes.json();
                    const dIdx = wData.daily?.time?.indexOf(match.date);
                    if (dIdx !== undefined && dIdx > -1) {
                        const code = wData.daily.weather_code[dIdx];
                        const max = wData.daily.temperature_2m_max[dIdx];
                        let emoji = "☁️";
                        if (code <= 1) emoji = "☀️";
                        else if (code <= 3) emoji = "☁️";
                        else if (code <= 69 || (code >= 80 && code <= 82) || code >= 95) emoji = "☔️";
                        else if ((code >= 70 && code <= 79) || (code >= 85 && code <= 86)) emoji = "⛄️";

                        wDisp.innerText = emoji;
                        tDisp.innerText = Math.round(max);
                    }
                }
            } catch(e) { console.warn("Auto weather fetch skipped.", e); }
        })();
    }

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
  
  function openSubPane(id) {
    document.getElementById(id).classList.add("active");
  }
  function closeSubPane(id) {
    document.getElementById(id).classList.remove("active");
  }
  document.querySelectorAll(".close-pane").forEach(btn => {
    btn.onclick = () => {
      const pane = btn.closest(".sub-pane");
      if (pane) pane.classList.remove("active");
    };
  });

  // Close menu after clicking item
  const menuItems = document.querySelectorAll(".menu-card");
  menuItems.forEach(btn => btn.addEventListener('click', () => toggleMenu(false)));

  document.getElementById("menu-feed").onclick = () => switchMode("feed");
  document.getElementById("menu-calendar").onclick = () => switchMode("calendar");
  document.getElementById("menu-links").onclick = () => openSubPane("links-overlay");
  document.getElementById("menu-chants").onclick = () => openSubPane("chants-overlay");
  document.getElementById("menu-standings").onclick = () => {
    window.open("https://www.jleague.jp/standings/j2j3/", "_blank");
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

  // 📋 Text Bulk Input Parsing (New Screen Flow)
  const openBulkPasteBtn = document.getElementById("open-bulk-paste-btn");
  const bulkPasteSaveBtn = document.getElementById("bulk-paste-save-btn");
  const bulkPasteArea = document.getElementById("bulk-paste-area-new");

  if (openBulkPasteBtn) {
    openBulkPasteBtn.onclick = () => {
      toggleMenu(false); 
      closeSubPane("data-overlay");
      openSubPane("bulk-paste-overlay");
    };
  }

  if (bulkPasteSaveBtn) {
    bulkPasteSaveBtn.onclick = () => {
      const text = bulkPasteArea.value;
      if (!text) return;
      
      const blocks = text.split(/第(\d+)節/);
      let savedCount = 0;
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
          
          for (const c of candidates) {
            const oppNameBase = c.opponent.replace(/[A-Za-zＡ-Ｚａ-ｚ\s・.()]/g, '').substring(0, 2);
            const isNameMatch = oppNameBase.length > 0 && content.includes(oppNameBase);
            const isDateMatch = mPadDate && c.date.endsWith(mPadDate);
            
            if (isNameMatch && isDateMatch) {
              target = c;
              break;
            } else if (isNameMatch && !target) {
              target = c;
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
        alert(`${savedCount}件の試合結果を反映しました。`);
        bulkPasteArea.value = "";
        closeSubPane("bulk-paste-overlay");
      } else {
        alert("該当する試合データが見つかりませんでした。入力形式を確認してください。");
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
  // =========================================================
  // 🔄 GAS API 自動同期（試合結果 + 順位表）
  // =========================================================
  const GAS_URL = "https://script.google.com/macros/s/AKfycbzK_DTYbg8Zzibe3uVutxEaRebQHvB1vZwz9A1s74PANFU4osrkFtLbfewwteRFZ_1o/exec";

  // チーム名の略称マップ（GAS結果→scheduleData の opponent に含まれる文字列）
  const TEAM_ABBR = {
    "仙台": "仙台", "湘南": "湘南", "秋田": "秋田", "新潟": "新潟", "熊本": "熊本",
    "栃木": "栃木", "群馬": "群馬", "甲府": "甲府", "金沢": "金沢", "藤枝": "藤枝",
    "宮崎": "宮崎", "鹿児島": "鹿児島", "琉球": "琉球", "高知": "高知", "滋賀": "滋賀",
    "富山": "富山", "岐阜": "岐阜", "長野": "長野", "沼津": "沼津", "今治": "今治",
    "八戸": "八戸", "盛岡": "盛岡", "山形": "山形", "福島": "福島", "水戸": "水戸",
    "千葉": "千葉", "大宮": "大宮", "相模原": "相模原", "松本": "松本", "清水": "清水",
    "磐田": "磐田", "岡山": "岡山", "山口": "山口", "讃岐": "讃岐", "徳島": "徳島",
    "愛媛": "愛媛", "北九州": "北九州", "鳥取": "鳥取", "山形": "山形",
    "栃木Ｃ": "栃木", "Ｃ大阪": "セレッソ",
  };

  function findKeyword(shortName) {
    // GASから得た略称で scheduleData の opponent を検索するキーワードを返す
    if (TEAM_ABBR[shortName]) return TEAM_ABBR[shortName];
    // 前方一致でマッチするものを検索
    return shortName.substring(0, 2);
  }

  // GAS結果をlocalStorageに同期（バックグラウンド）
  async function syncResultsFromGAS() {
    try {
      const res = await fetch(`${GAS_URL}?type=results&league=j2&nocache=1`);
      const json = await res.json();
      if (!json.data || !Array.isArray(json.data)) return;

      // 重複排除（same date+home+away）
      const seen = new Set();
      const results = json.data.filter(r => {
        const key = `${r.date}|${r.home}|${r.away}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let synced = 0;
      results.forEach(r => {
        if (!r.home_score && !r.away_score) return;
        const homeKw = findKeyword(r.home);
        const awayKw = findKeyword(r.away);

        // scheduleData から新潟 or 熊本が関わる試合をマッチング
        scheduleData.forEach(m => {
          const mDateStr = m.date; // "2026-04-04"
          if (mDateStr !== r.date) return;

          const opp = m.opponent || "";
          // 試合日が一致＋相手チームが略称に一致
          const isNiigata = m.club === "niigata";
          const myKw = isNiigata ? "新潟" : "熊本";
          const oppKw = isNiigata ? awayKw : homeKw;

          // GAS結果のhome=新潟 or niigata側がhome
          let myScore, oppScore;
          if (r.home.includes(myKw) || opp.includes(oppKw) || opp.includes(isNiigata ? homeKw : awayKw)) {
            if (opp.includes(homeKw) || opp.includes(awayKw) || 
                opp.includes(r.home.substring(0,2)) || opp.includes(r.away.substring(0,2))) {
              // スコア割り当て: 自クラブがhomeかawayか判断
              if (r.home.includes(myKw) || r.home.substring(0,2) === myKw.substring(0,2)) {
                myScore = r.home_score;
                oppScore = r.away_score;
              } else {
                myScore = r.away_score;
                oppScore = r.home_score;
              }
              const mId = `${m.date}_${m.club}_${m.opponent}`;
              // 既にスコアが入力済みの場合は上書きしない
              if (!localStorage.getItem(`score_my_${mId}`)) {
                localStorage.setItem(`score_my_${mId}`, myScore);
                localStorage.setItem(`score_opp_${mId}`, oppScore);
                if (r.pk) {
                  const pkParts = r.pk.split(" PK ");
                  if (pkParts.length === 2) {
                    const myPk = r.home.includes(myKw) ? pkParts[0] : pkParts[1];
                    const oppPk = r.home.includes(myKw) ? pkParts[1] : pkParts[0];
                    localStorage.setItem(`score_my_pk_${mId}`, myPk);
                    localStorage.setItem(`score_opp_pk_${mId}`, oppPk);
                  }
                }
                synced++;
              }
            }
          }
        });
      });

      if (synced > 0) {
        console.log(`[GAS Sync] ${synced}件の試合結果を自動同期しました`);
        // 現在の表示位置を保持したまま再描画
        const savedIdx = currentIndex;
        const savedYear = selectedYear;
        renderFeed();
        applyYearFilter(savedYear, true);
        requestAnimationFrame(() => scrollToIndex(Math.min(savedIdx, visibleSections.length - 1)));
      }
    } catch (e) {
      console.warn("[GAS Sync] 結果取得エラー:", e);
    }
  }

  // 順位表ビュー
  const menuStandingsBtn = document.getElementById("menu-standings");
  if (menuStandingsBtn) {
    menuStandingsBtn.onclick = () => {
      toggleMenu(false);
      openSubPane("standings-overlay");
      loadStandings();
    };
  }

  async function loadStandings() {
    const container = document.getElementById("standings-content");
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">読み込み中...</div>`;
    try {
      const res = await fetch(`${GAS_URL}?type=standings&league=j2&nocache=1`);
      const json = await res.json();
      if (!json.data || !Array.isArray(json.data)) throw new Error("no data");

      // グループ別に整理
      const groups = {};
      json.data.forEach(row => {
        if (!groups[row.group]) groups[row.group] = [];
        groups[row.group].push(row);
      });

      // グループ表示順: WEST-A → WEST-B → EAST-A → EAST-B
      const GROUP_ORDER = ['WEST-A', 'WEST-B', 'EAST-A', 'EAST-B'];
      const sortedGroups = Object.keys(groups).sort((a, b) => {
        const ai = GROUP_ORDER.findIndex(k => a.includes(k));
        const bi = GROUP_ORDER.findIndex(k => b.includes(k));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      // カラム定義
      const COLS = [
        { label: '順',    key: 'rank',           type: 'num' },
        { label: 'チーム', key: 'team',           type: 'str' },
        { label: '勝点',  key: 'points',          type: 'num' },
        { label: '試合',  key: 'played',          type: 'num' },
        { label: '勝',    key: 'won',             type: 'num' },
        { label: 'PK勝',  key: 'pk_won',          type: 'num' },
        { label: 'PK負',  key: 'pk_lost',         type: 'num' },
        { label: '負',    key: 'lost',            type: 'num' },
        { label: '得',    key: 'goals_for',       type: 'num' },
        { label: '失',    key: 'goals_against',   type: 'num' },
        { label: '差',    key: 'goal_diff',       type: 'num' },
      ];

      // ソート状態をグループ毎に管理
      const sortState = {};
      sortedGroups.forEach(g => { sortState[g] = { key: 'rank', dir: 'asc' }; });

      function buildGroupTable(groupName, rows) {
        const { key: sKey, dir: sDir } = sortState[groupName];
        const sorted = [...rows].sort((a, b) => {
          const col = COLS.find(c => c.key === sKey);
          if (!col) return 0;
          if (col.type === 'str') {
            const av = (a[sKey] || '').toString();
            const bv = (b[sKey] || '').toString();
            return sDir === 'asc' ? av.localeCompare(bv, 'ja') : bv.localeCompare(av, 'ja');
          }
          const av = parseFloat(a[sKey]) || 0;
          const bv = parseFloat(b[sKey]) || 0;
          return sDir === 'asc' ? av - bv : bv - av;
        });
        const thHTML = COLS.map(c => {
          const isSorted = c.key === sKey;
          const cls = isSorted ? (sDir === 'asc' ? 'sort-asc' : 'sort-desc') : '';
          return '<th class="' + cls + '" data-key="' + c.key + '" data-group="' + groupName + '">' + c.label + '</th>';
        }).join('');
        const tbodyHTML = sorted.map(row => {
          const isNiigata = (row.team || '').includes('新潟');
          const isKumamoto = (row.team || '').includes('熊本');
          const trcls = isNiigata ? 'standing-niigata' : isKumamoto ? 'standing-kumamoto' : '';
          return '<tr class="' + trcls + '">'
            + '<td class="col-rank">' + row.rank + '</td>'
            + '<td class="standing-team">' + row.team + '</td>'
            + '<td class="col-pts"><strong>' + row.points + '</strong></td>'
            + '<td>' + row.played + '</td>'
            + '<td>' + row.won + '</td>'
            + '<td>' + (row.pk_won || '-') + '</td>'
            + '<td>' + (row.pk_lost || '-') + '</td>'
            + '<td>' + row.lost + '</td>'
            + '<td>' + row.goals_for + '</td>'
            + '<td>' + row.goals_against + '</td>'
            + '<td>' + row.goal_diff + '</td>'
            + '</tr>';
        }).join('');
        return '<div class="standings-group-title">' + groupName + '</div>'
          + '<table class="standings-table" data-group="' + groupName + '">'
          + '<thead><tr>' + thHTML + '</tr></thead>'
          + '<tbody>' + tbodyHTML + '</tbody>'
          + '</table>';
      }

      function renderAll() {
        const now = new Date().toLocaleString("ja-JP");
        let html = sortedGroups.map(g => buildGroupTable(g, groups[g])).join('');
        html += '<p style="text-align:center;font-size:0.75rem;color:#999;margin-top:16px;padding-bottom:8px;">更新: ' + now + '</p>';
        container.innerHTML = html;
        // ソートクリックイベントを再バインド
        container.querySelectorAll('.standings-table th[data-key]').forEach(th => {
          th.onclick = () => {
            const group = th.dataset.group;
            const key = th.dataset.key;
            const cur = sortState[group];
            if (cur.key === key) {
              cur.dir = cur.dir === 'asc' ? 'desc' : 'asc';
            } else {
              cur.key = key;
              cur.dir = (key === 'team' || key === 'lost' || key === 'goals_against') ? 'asc' : 'desc';
            }
            renderAll();
          };
        });
      }

      renderAll();
    } catch (e) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;">取得に失敗しました。<br>再度お試しください。</div>`;
    }
  }

  // アプリ起動時にバックグラウンドで結果同期（3秒後）
  setTimeout(syncResultsFromGAS, 3000);

});


window.switchChantClub = function(club, btn) {
  // Update buttons
  const tabs = btn.closest('.standings-tabs').querySelectorAll('.u-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  // Update content visibility
  const pane = btn.closest('.u-chant-area');
  pane.querySelectorAll('.chant-club-group').forEach(group => {
    group.style.display = 'none';
  });
  pane.querySelector('#chants-' + club).style.display = 'block';
};
