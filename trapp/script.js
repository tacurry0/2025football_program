window.clubSitesData = null;
window.openClubSite = async function(clubName, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!window.clubSitesData) {
    try {
      const res = await fetch('jleague_club_official_sites.json');
      if (!res.ok) throw new Error("HTTP " + res.status);
      window.clubSitesData = await res.json();
    } catch(e) {
      alert("公式サイトのデータが読み込めませんでした。\nローカル環境(file://)の場合、ブラウザのセキュリティ設定でブロックされている可能性があります。");
      console.error("Failed to load club sites", e);
      return;
    }
  }
  
  // Remove all spaces, dots, middle dots, hyphens, and convert full-width to half-width
  const norm = (s) => (s || "").normalize("NFKC").replace(/[\s・\.\-\_]/g, "").toLowerCase();
  const targetNorm = norm(clubName);
  
  let club = window.clubSitesData.find(c => norm(c.club_name) === targetNorm);
  
  if (!club) {
    club = window.clubSitesData.find(c => {
      const cNorm = norm(c.club_name);
      return cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
    });
  }

  // Fallback for tricky JLeague abbreviations like "F東京" vs "FC東京"
  if (!club && targetNorm.includes("f東京")) club = window.clubSitesData.find(c => c.club_name.includes("FC東京"));
  if (!club && targetNorm.includes("c大阪")) club = window.clubSitesData.find(c => c.club_name.includes("セレッソ"));
  if (!club && targetNorm.includes("g大阪")) club = window.clubSitesData.find(c => c.club_name.includes("ガンバ"));
  if (!club && targetNorm.includes("東京v")) club = window.clubSitesData.find(c => c.club_name.includes("ヴェルディ"));
  if (!club && targetNorm.includes("横浜fm")) club = window.clubSitesData.find(c => c.club_name.includes("マリノス"));

  if (club && club.official_site) {
    window.open(club.official_site, '_blank');
  } else {
    alert("公式サイトが見つかりません:\n" + 
          "元の名前: [" + clubName + "]\n" + 
          "内部変換: [" + targetNorm + "]");
    console.warn("No official site found for:", clubName);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const feedSlider = document.getElementById("feed-slider");
  const calendarBody = document.getElementById("calendar-body");
  const ultraFeed = document.getElementById("ultra-feed");
  const calendarView = document.getElementById("calendar-view");
  const ultraDashboard = document.getElementById("ultra-dashboard");

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
  let currentMode = "dashboard"; // dashboard, feed or calendar

  // --- Date/Theme Helpers ---
  function parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d || 1);
  }

    const normalizeName = (s) => (s || "").normalize("NFKC").trim();
    
    // チーム名のゆらぎを吸収するためのマッピング
    const GLOBAL_TEAM_MAP = {
      "新潟": "新潟", "熊本": "熊本", "鳥取": "鳥取", "富山": "富山", "金沢": "金沢",
      "清水": "清水", "磐田": "磐田", "名古屋": "名古屋", "神戶": "神戸", "神戸": "神戸", "京都": "京都",
      "札幌": "札幌", "鹿島": "鹿島", "浦和": "浦和", "柏": "柏", "湘南": "湘南",
      "町田": "町田", "川崎": "川崎", "横浜FM": "横浜FM", "横浜F・マリノス": "横浜FM", "大分": "大分", "福岡": "福岡",
      "鳥栖": "鳥栖", "長崎": "長崎", "岡山": "岡山", "広島": "広島", "山口": "山口",
      "徳島": "徳島", "讃岐": "讃岐", "北九州": "北九州", "宮崎": "宮崎",
      "八戸": "八戸", "盛岡": "盛岡", "秋田": "秋田", "山形": "山形",
      "仙台": "仙台", "水戸": "水戸", "群馬": "群馬", "大宮": "大宮", "千葉": "千葉",
      "甲府": "甲府", "長野": "長野", "松本": "松本", "鹿児島": "鹿児島",
      "栃木SC": "栃木", "栃木": "栃木", "栃木C": "栃木", "栃木Ｃ": "栃木",
      "セレッソ": "セレッソ", "C大阪": "セレッソ", "Ｃ大阪": "セレッソ",
      "ガンバ": "ガンバ", "G大阪": "ガンバ", "Ｇ大阪": "ガンバ",
      "FC東京": "東京", "東京V": "東京V", "東京ヴェルディ": "東京V",
      "FC大阪": "大阪", "FC今治": "今治", "今治": "今治", "FC岐阜": "岐阜", "FC琉球": "琉球"
    };

    // エンブレムURLからチーム名を特定する（文字化け対策）
    const EMBLEM_MAP = {
      "niigata": "新潟", "kumamoto": "熊本", "imabari": "今治", "tosu": "鳥栖", "kochi": "高知", "ehime": "愛媛",
      "kyoto": "京都", "yamaguchi": "山口", "miyazaki": "宮崎", "tottori": "鳥取", "kagoshima": "鹿児島",
      "ryukyu": "琉球", "shiga": "滋賀", "oita": "大分", "kitakyushu": "北九州", "kanazawa": "金沢",
      "sanuki": "讃岐", "tokushima": "徳島", "toyama": "富山", "nara": "奈良", "iwaki": "いわき",
      "gifu": "岐阜", "sapporo": "札幌", "matsumoto": "松本", "nagano": "長野", "iwata": "磐田",
      "fukushima": "福島", "kofu": "甲府", "shonan": "湘南", "akita": "秋田", "yamagata": "山形",
      "yokohamafc": "横浜FC", "yokohamafm": "横浜FM", "sendai": "仙台", "hachinohe": "八戸",
      "morioka": "盛岡", "gunma": "群馬", "mito": "水戸", "tochigi": "栃木", "omiya": "大宮",
      "chiba": "千葉", "sagamihara": "相模原", "shimizu": "清水", "okayama": "岡山",
      "hiroshima": "広島", "vissel": "神戸", "g-osaka": "ガンバ", "c-osaka": "セレッソ",
      "urawa": "浦和", "kashima": "鹿島", "kashiwa": "柏", "tokyo": "東京", "tokyov": "東京V", "machida": "町田",
      "fosaka": "大阪", "f-osaka": "大阪", "iwate": "盛岡", "kusatsu": "群馬", "verdy": "東京V", "marinos": "横浜FM",
      "antlers": "鹿島", "reds": "浦和", "reysol": "柏", "frontale": "川崎", "bellmare": "湘南", "s-pulse": "清水",
      "jubilo": "磐田", "grampus": "名古屋", "sanga": "京都", "gambaosaka": "ガンバ", "cerezoosaka": "セレッソ",
      "vissel-k": "神戸", "trinita": "大分", "avispa": "福岡", "zelvia": "町田", "fagiano": "岡山", "sanfrecce": "広島",
      "renofa": "山口", "vortis": "徳島", "kamatamare": "讃岐", "giravanz": "北九州", "tegevajaro": "宮崎"
    };

    function getTeamKwFromEmblem(url) {
      if (!url) return null;
      const m = url.match(/img_club_([^.]+)\.png/);
      if (m && EMBLEM_MAP[m[1]]) return EMBLEM_MAP[m[1]];
      return null;
    }

    function robustTeamMatch(name1, name2) {
      if (!name1 || !name2) return false;
      const n1 = normalizeName(name1).replace("の試合詳細", "").replace("の結果", "").replace("SC", "").replace("FC", "").replace("F.C.", "");
      const n2 = normalizeName(name2).replace("の試合詳細", "").replace("の結果", "").replace("SC", "").replace("FC", "").replace("F.C.", "");
      
      if (n1 === n2) return true;
      if (n1.length >= 2 && n2.length >= 2 && (n1.includes(n2) || n2.includes(n1))) return true;

      // マッピングによる解決
      const getAlias = (n) => {
        for (let key in GLOBAL_TEAM_MAP) {
          const nk = normalizeName(key);
          if (n.includes(nk) || nk.includes(n)) return GLOBAL_TEAM_MAP[key];
        }
        return n;
      };
      const a1 = getAlias(n1);
      const a2 = getAlias(n2);
      return a1 === a2 && a1.length >= 2;
    }

    function isHomeMatch(club, venue) {
      if (!venue) return false;
      const v = normalizeName(venue);
      if (club === "niigata") return v.includes("デンカビッグスワン");
      if (club === "kumamoto") return v.includes("えがお健康");
      return false;
    }

    async function updateWeatherUI(container, date, venue) {
      if (!container) return;
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
      const loc = STADIUM_CITY_MAP[venue] || venue;
      const now = new Date();
      const mDateObj = new Date(date);
      const diffDays = (mDateObj - now) / (1000 * 60 * 60 * 24);
      if (diffDays < -4 || diffDays > 14) return;

      try {
        let lat, lon;
        const cCache = localStorage.getItem('coord_' + loc);
        if (cCache) {
          const c = JSON.parse(cCache); lat = c.lat; lon = c.lon;
        } else {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`);
          const data = await res.json();
          if (data && data[0]) {
            lat = data[0].lat; lon = data[0].lon;
            localStorage.setItem('coord_' + loc, JSON.stringify({ lat, lon }));
          }
        }
        if (lat !== undefined && lon !== undefined) {
          const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&past_days=3&forecast_days=16`);
          const wData = await wRes.json();
          const dIdx = wData.daily?.time?.indexOf(date);
          if (dIdx !== undefined && dIdx > -1) {
            const code = wData.daily.weather_code[dIdx];
            const max = Math.round(wData.daily.temperature_2m_max[dIdx]);
            const min = Math.round(wData.daily.temperature_2m_min[dIdx]);
            
            const ICONS = {
              SUNNY: `<svg viewBox="0 0 24 24" fill="none" stroke="#ff9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
              CLOUDY: `<svg viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
              RAIN: `<svg viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;"><path d="M20 16.2A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.4"></path><line x1="16" y1="18" x2="14" y2="22"></line><line x1="12" y1="18" x2="10" y2="22"></line><line x1="8" y1="18" x2="6" y2="22"></line></svg>`,
              SNOW: `<svg viewBox="0 0 24 24" fill="none" stroke="#5ac8fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"></line></svg>`
            };
            let ik = "CLOUDY";
            if (code <= 1) ik = "SUNNY";
            else if (code <= 3) ik = "CLOUDY";
            else if (code <= 69 || (code >= 80 && code <= 82) || code >= 95) ik = "RAIN";
            else if ((code >= 70 && code <= 79) || (code >= 85 && code <= 86)) ik = "SNOW";

            container.innerHTML = `
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                ${ICONS[ik]}
                <div style="display:flex; align-items:baseline; gap:4px; font-family:var(--font-kick); font-weight:900; font-size:1.3rem;">
                  <span class="w-temp-max" style="color:#ff3b30;">${max}</span>
                  <span style="font-size:1.1rem; color:#888;">/</span>
                  <span class="w-temp-min" style="color:#007aff;">${min}</span>
                  <span style="font-size:0.9rem; color:#999;">℃</span>
                </div>
              </div>
            `;
          }
        }
      } catch (e) { console.warn("Weather UI update failed", e); }
    }

    function updateHeaderAnnouncements() {
      const container = document.getElementById("header-n-gate-container");
      if (!container) return;
      let showNGate = false;
      const now = new Date();
      const cutoffStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const sorted = [...scheduleData].sort((a, b) => parseDate(a.date) - parseDate(b.date));
      const nextNiigata = sorted.find(m => m.date >= cutoffStr && m.club === "niigata");

      if (nextNiigata && isHomeMatch(nextNiigata.club, nextNiigata.venue)) {
        const mDate = parseDate(nextNiigata.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((mDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) showNGate = true;
      }

      if (showNGate) {
        container.innerHTML = `<a href="https://www.albirex.co.jp/ticket/ngate/form/" target="_blank" class="btn-ngate-header">Nゲート抽選</a>`;
      } else {
        container.innerHTML = "";
      }
    }

  // --- View Management ---
  function switchMode(mode) {
    currentMode = mode;
    document.body.setAttribute("data-mode", mode);

    if (ultraDashboard) ultraDashboard.className = mode === "dashboard" ? "active-view" : "hidden-view";
    if (ultraFeed) ultraFeed.className = mode === "feed" ? "active-view" : "hidden-view";
    if (calendarView) calendarView.className = mode === "calendar" ? "active-view" : "hidden-view";

    if (mode === "calendar") renderCalendar();
    if (mode === "dashboard") renderDashboard();
    if (mode === "feed") {
      requestAnimationFrame(() => scrollToIndex(currentIndex));
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
    if (newIdx !== currentIndex && visibleSections[newIdx]) {
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
      if (year === today.getFullYear() && month === (today.getMonth() + 1) && d === today.getDate()) cell.classList.add("today");

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
    const clubEmblem = match.club === "niigata" ? "https://jleague.r10s.jp/img/common/img_club_niigata.png" : "https://jleague.r10s.jp/img/common/img_club_kumamoto.png";

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
          <img class="sheet-opp-emblem" src="${match.emblem}" style="cursor:pointer;" onclick="openClubSite('${match.opponent}', event)">
        </div>
        <div class="sheet-venue-row" style="display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:8px;">
          <p class="sheet-venue-info" style="margin:0;">${match.date} | ${match.venue}</p>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.venue)}" target="_blank" style="background:#f2f2f7; color:var(--text-main); font-size:0.75rem; padding:6px 12px; border-radius:15px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> MAPで開く</a>
        </div>
      </div>
      <div id="u-auto-weather-area" style="display: none; gap: 20px; justify-content: center; margin: 20px 0; background: rgba(242, 242, 247, 0.5); padding: 15px; border-radius: 18px; backdrop-filter: blur(5px);">
        <div style="display:flex; flex-direction:column; align-items:center; flex: 1;">
           <span style="font-size:0.65rem; color:#888; font-weight:700; margin-bottom:6px;">FORECAST</span>
           <div id="u-weather-display" style="display:flex; flex-direction:column; align-items:center;">
             <span class="w-icon" style="font-size: 1.8rem;">-</span>
           </div>
        </div>
        <div style="width:1px; background:#ddd; height:40px; align-self:center;"></div>
        <div style="display:flex; flex-direction:column; align-items:center; flex: 1;">
           <span style="font-size:0.65rem; color:#888; font-weight:700; margin-bottom:6px;">TEMPERATURE</span>
           <div style="display:flex; align-items: baseline; gap: 4px;">
             <span id="u-temp-max" style="font-size: 1.6rem; font-family:var(--font-kick); font-weight:900; color:#ff3b30;">-</span>
             <span style="font-size:0.7rem; color:#888; font-weight:800; margin-right:4px;">℃</span>
             <span style="font-size: 0.8rem; color:#ddd;">/</span>
             <span id="u-temp-min" style="font-size: 1.2rem; font-family:var(--font-kick); font-weight:800; color:#007aff; margin-left:4px;">-</span>
             <span style="font-size:0.6rem; color:#888; font-weight:800;">℃</span>
           </div>
        </div>
      </div>

      <div class="sheet-score-area"><input type="number" class="u-score-input my-score" value="${sMy}" placeholder="-"><span class="u-score-sep">:</span><input type="number" class="u-score-input opp-score" value="${sOpp}" placeholder="-"></div>
      ${pkHtml}
      <div class="u-attend-btn ${match.club} ${isAttend ? 'active' : ''}" id="attend-toggle">
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

    // Use the unified weather helper
    const wBox = sheetContent.querySelector("#u-auto-weather-area");
    const wIconPlace = wBox.querySelector(".w-icon");
    const tMaxPlace = wBox.querySelector("#u-temp-max");
    const tMinPlace = wBox.querySelector("#u-temp-min");

    updateWeatherUI(wIconPlace, match.date, match.venue).then(() => {
      const resInner = wIconPlace.firstElementChild;
      if (resInner) {
        const svg = resInner.querySelector("svg");
        const maxVal = resInner.querySelector(".w-temp-max");
        const minVal = resInner.querySelector(".w-temp-min");
        if (svg) wIconPlace.innerHTML = svg.outerHTML;
        if (maxVal) tMaxPlace.innerText = maxVal.innerText;
        if (minVal) tMinPlace.innerText = minVal.innerText;
      }
      wBox.style.display = "flex";
    });



    // Helper: convert URLs to clickable links
    function linkifyMemo(text) {
      if (!text) return '';
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        const isDraw = (mS !== "" && oS !== "" && mS === oS);
        pkA.style.display = isDraw ? "flex" : "none";
        if (isDraw) {
          pm = sheetContent.querySelector(".pk-my").value; 
          po = sheetContent.querySelector(".pk-opp").value;
          localStorage.setItem(`score_my_pk_${mId}`, pm); 
          localStorage.setItem(`score_opp_pk_${mId}`, po);
        } else {
          localStorage.removeItem(`score_my_pk_${mId}`);
          localStorage.removeItem(`score_opp_pk_${mId}`);
        }
      }

      const card = document.querySelector(`.card[data-mid="${mId}"]`);
      if (card) {
        let res = null; if (mS !== "" && oS !== "") {
          const ms = Number(mS), os = Number(oS); if (ms > os) res = "win"; else if (ms < os) res = "lose"; else if (pm !== "" && po !== "") res = Number(pm) > Number(po) ? "pk-win" : "pk-lose"; else res = "draw";
        }
        const badge = card.querySelector(".result-badge"); badge.className = "result-badge " + (res ? "badge-" + res : "");
        badge.textContent = res ? res.replace("-", " ").toUpperCase() : "";

        // Update Attendance Emoji in Feed
        const metaDiv = card.querySelector(".match-meta");
        let attEl = metaDiv.querySelector(".match-att-emoji");
        if (isAtt) {
          if (!attEl) {
            attEl = document.createElement("span");
            attEl.className = "match-att-emoji";
            attEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
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

  const GAS_EXEC_URL = "https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec";

  // --- Results & Data Management ---
  let officialResults = [];
  let cachedStandings = null;

  // Initialize data from localStorage cache
  const rSave = localStorage.getItem("trapp_results_cache");
  if (rSave) { try { officialResults = JSON.parse(rSave); } catch (e) { } }
  
  const lSave = localStorage.getItem("trapp_standings_cache");
  if (lSave) { try { cachedStandings = JSON.parse(lSave); } catch (e) { } }

  /**
   * Universal fetch with fallback and stale check
   */
  async function fetchData(type, forceGas = false) {
    const localUrl = `./data/${type}.json`;
    const gasUrl = `${GAS_EXEC_URL}?type=${type}&league=j2`;
    let staticJson = null;
    try {
      const res = await fetch(localUrl + "?t=" + Date.now());
      if (res.ok) staticJson = await res.json();
    } catch (e) { console.warn(`Static load failed: ${type}`); }

    try {
      const gasUrlWithCacheBuster = `${gasUrl}&nocache=1&t=${Date.now()}`;
      const res = await fetch(gasUrlWithCacheBuster);
      const gasJson = await res.json();
      const gasArr = gasJson.data || (Array.isArray(gasJson) ? gasJson : []);
      const staticArr = (staticJson && staticJson.data) ? staticJson.data : (Array.isArray(staticJson) ? staticJson : []);
      if (gasArr.length >= staticArr.length && gasArr.length > 0) return gasJson;
    } catch (e) { console.error(`GAS fetch failed: ${type}`); }
    return staticJson;
  }

  /**
   * Refreshes all data and updates UI
   */
  async function refreshAllData(forceGas = false) {
    const [resJson, stdJson] = await Promise.all([
      fetchData("results", forceGas),
      fetchData("standings", forceGas)
    ]);

    if (resJson) {
      officialResults = Array.isArray(resJson) ? resJson : (resJson.data || []);
      localStorage.setItem("trapp_results_cache", JSON.stringify(officialResults));
      syncResultsToLocalStorage(officialResults);
    }

    if (stdJson && stdJson.data) {
      cachedStandings = stdJson.data;
      localStorage.setItem("trapp_standings_cache", JSON.stringify(cachedStandings));
    }

    // Update UI components
    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "feed") renderFeed();
    else if (currentMode === "calendar") renderCalendar();
    
    if (typeof updateDashboardPrevResults === "function") updateDashboardPrevResults();
  }

  /**
   * Finds official result for a specific match
   */
  function findOfficialResult(match) {
    if (!officialResults || !officialResults.length) return null;
    const myKw = match.club === "niigata" ? "新潟" : "熊本";
    
    return officialResults.find(r => {
      const dateMatch = r.date === match.date;
      const teamMatch = robustTeamMatch(r.home, myKw) || robustTeamMatch(r.away, myKw);
      if (!teamMatch) return false;
      
      const isHome = robustTeamMatch(r.home, myKw);
      const opp = isHome ? r.away : r.home;
      const oppMatch = robustTeamMatch(opp, match.opponent);
      
      // Prefer exact date + opponent match
      if (dateMatch && oppMatch) return true;
      
      // Fallback: If section matches (if provided in results)
      if (r.section && match.matchweek) {
         const rSec = parseInt(r.section);
         const mSec = parseInt(match.matchweek.replace(/\D/g, ""));
         if (rSec === mSec && oppMatch) return true;
      }
      
      return false;
    });
  }

  /**
   * Syncs official results into individual localStorage keys (for Feed/Calendar)
   */
  function syncResultsToLocalStorage(results) {
    let changed = false;
    scheduleData.forEach(m => {
      const r = findOfficialResult(m);
      if (r && r.home_score !== "" && r.home_score !== null) {
        const isHome = robustTeamMatch(r.home, m.club === "niigata" ? "新潟" : "熊本");
        const sM = isHome ? r.home_score : r.away_score;
        const sO = isHome ? r.away_score : r.home_score;
        
        const mId = `${m.date}_${m.club}_${m.opponent}`;
        if (localStorage.getItem(`score_my_${mId}`) !== String(sM) || 
            localStorage.getItem(`score_opp_${mId}`) !== String(sO)) {
          localStorage.setItem(`score_my_${mId}`, sM);
          localStorage.setItem(`score_opp_${mId}`, sO);
          
          if (r.pk && r.home_score === r.away_score) {
            const pkMatch = r.pk.match(/(\d+)\s*PK\s*(\d+)/i);
            if (pkMatch) {
              const pkM = isHome ? pkMatch[1] : pkMatch[2];
              const pkO = isHome ? pkMatch[2] : pkMatch[1];
              localStorage.setItem(`score_my_pk_${mId}`, pkM);
              localStorage.setItem(`score_opp_pk_${mId}`, pkO);
            }
          } else {
            localStorage.removeItem(`score_my_pk_${mId}`);
            localStorage.removeItem(`score_opp_pk_${mId}`);
          }
          changed = true;
        }
      }
    });
    return changed;
  }

  // Initial load
  refreshAllData();


  // extract the city map into reusable object
  const COMMON_STADIUM_CITY_MAP = {
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

  async function renderDashboard() {
    const container = document.getElementById("dashboard-cards-container");
    if (!container) return;

    // Sort logic to find "Next" Match
    const now = new Date();
    // Use today's local date as cutoff to keep today's matches visible until tomorrow
    const y = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const cutoffStr = `${y}-${mm}-${dd}`;

    // Check if toggle buttons exist, respect club visibility
    const showNiigata = true; // Dashboard shows both actively or check toggles
    const showKumamoto = true;

    let nextNiigata = null;
    let nextKumamoto = null;

    // sorted ascending array
    const sorted = [...scheduleData].sort((a, b) => parseDate(a.date) - parseDate(b.date));

    for (let m of sorted) {
      if (m.date >= cutoffStr && !nextNiigata && m.club === "niigata") nextNiigata = m;
      if (m.date >= cutoffStr && !nextKumamoto && m.club === "kumamoto") nextKumamoto = m;
      if (nextNiigata && nextKumamoto) break;
    }

    let html = "";
    const renderCard = (m, clubName, mainColor, myShortName) => {
      if (!m) return `<div class="dash-card"><div style="padding:20px;text-align:center;color:#888;">今後の試合予定はありません</div></div>`;
      const isAtt = localStorage.getItem('attend_' + m.date + '_' + m.club + '_' + m.opponent) === "true";
      const isHome = isHomeMatch(m.club, m.venue);
      const haBadge = isHome ? '<span class="sheet-ha badge-home" style="color:#fff; font-weight:800; font-size:1rem;">HOME</span>' : '<span class="sheet-ha badge-away" style="color:#fff; font-weight:800; font-size:1rem;">AWAY</span>';
      const myEmblem = m.club === "niigata" ? "https://jleague.r10s.jp/img/common/img_club_niigata.png" : "https://jleague.r10s.jp/img/common/img_club_kumamoto.png";
      const J_CLUB_ENG = { "北海道コンサドーレ札幌": "HOKKAIDO CONSADOLE SAPPORO", "ヴァンラーレ八戸": "VANRAURE HACHINOHE", "いわてグルージャ盛岡": "IWATE GRULLA MORIOKA", "ベガルタ仙台": "VEGALTA SENDAI", "ブラウブリッツ秋田": "BLAUBLITZ AKITA", "モンテディオ山形": "MONTEDIO YAMAGATA", "福島ユナイテッドFC": "FUKUSHIMA UNITED FC", "いわきFC": "IWAKI FC", "鹿島アントラーズ": "KASHIMA ANTLERS", "水戸ホーリーホック": "MITO HOLLYHOCK", "栃木SC": "TOCHIGI SC", "ザスパ群馬": "THESPA GUNMA", "浦和レッズ": "URAWA REDS", "大宮アルディージャ": "OMIYA ARDIJA", "RB大宮アルディージャ": "RB OMIYA ARDIJA", "ジェフユナイテッド千葉": "JEF UNITED CHIBA", "柏レイソル": "KASHIWA REYSOL", "FC東京": "FC TOKYO", "東京ヴェルディ": "TOKYO VERDY", "FC町田ゼルビア": "FC MACHIDA ZELVIA", "川崎フロンターレ": "KAWASAKI FRONTALE", "横浜F・マリノス": "YOKOHAMA F. MARINOS", "横浜FC": "YOKOHAMA FC", "Y.S.C.C.横浜": "Y.S.C.C. YOKOHAMA", "湘南ベルマーレ": "SHONAN BELLMARE", "SC相模原": "SC SAGAMIHARA", "ヴァンフォーレ甲府": "VENTFORET KOFU", "松本山雅FC": "MATSUMOTO YAMAGA FC", "AC長野パルセイロ": "AC NAGANO PARCEIRO", "アルビレックス新潟": "ALBIREX NIIGATA", "カターレ富山": "KATALLER TOYAMA", "ツエーゲン金沢": "ZWEIGEN KANAZAWA", "清水エスパルス": "SHIMIZU S-PULSE", "ジュビロ磐田": "JUBILO IWATA", "藤枝MYFC": "FUJIEDA MYFC", "アスルクラロ沼津": "AZUL CLARO NUMAZU", "名古屋グランパス": "NAGOYA GRAMPUS", "FC岐阜": "FC GIFU", "京都サンガF.C.": "KYOTO SANGA F.C.", "ガンバ大阪": "GAMBA OSAKA", "セレッソ大阪": "CEREZO OSAKA", "FC大阪": "FC OSAKA", "ヴィッセル神戸": "VISSEL KOBE", "ヴィッセル神戶": "VISSEL KOBE", "奈良クラブ": "NARA CLUB", "ガイナーレ鳥取": "GAINARE TOTTORI", "ファジアーノ岡山": "FAGIANO OKAYAMA", "サンフレッチェ広島": "SANFRECCE HIROSHIMA", "レノファ山口FC": "RENOFA YAMAGUCHI FC", "カマタマーレ讃岐": "KAMATAMARE SANUKI", "徳島ヴォルティス": "TOKUSHIMA VORTIS", "愛媛FC": "EHIME FC", "FC今治": "FC IMABARI", "アビスパ福岡": "AVISPA FUKUOKA", "ギラヴァンツ北九州": "GIRAVANZ KITAKYUSHU", "サガン鳥栖": "SAGAN TOSU", "V・ファーレン長崎": "V-VAREN NAGASAKI", "ロアッソ熊本": "ROASSO KUMAMOTO", "大分トリニータ": "OITA TRINITA", "テゲバジャーロ宮崎": "TEGEVAJARO MIYAZAKI", "鹿児島ユナイテッドFC": "KAGOSHIMA UNITED FC", "FC琉球": "FC RYUKYU", "高知ユナイテッドSC": "KOCHI UNITED SC", "レイラック滋賀FC": "REILAC SHIGA FC" };
      const engOpp = J_CLUB_ENG[m.opponent] || m.opponent.toUpperCase();

      return `
          <div class="dash-card white-theme" id="dash-card-${m.club}" data-mid="${m.date}_${m.club}_${m.opponent}" style="background: white;">
            <div class="dash-card-header" style="background:${mainColor}; border-bottom:none; padding:8px 15px;">
              <span class="dash-team-name" style="font-size:1.4rem; font-weight:900;">${clubName}</span>
              ${haBadge.replace('font-size:1rem;', 'font-size:0.85rem;')}
            </div>
            <div class="dash-card-body" style="background: white; color: #111; padding:10px 15px;">
              
              <!-- Top area (Date, Venue + Weather) -->
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                 <!-- Left Side: Date and Venue -->
                 <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                       <span class="dash-mw" style="background: #e8e8ed; color: #111; padding: 2px 8px; border-radius:6px; font-size:0.9rem; border:none;">${m.matchweek || "EX"}</span>
                       <span class="dash-date" style="color: #111; font-weight: 500; font-size:0.95rem;">${m.date} ${m.day} ${m.time}</span>
                    </div>
                    <div class="dash-venue-row" style="color:#555; font-size:0.85rem; align-items:center; display:flex;">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                       <span style="font-weight:700;">${m.venue}</span>
                    </div>
                 </div>

                 <!-- Right Side: Weather -->
                 <div id="dash-weather-${m.club}" data-venue="${m.venue}" data-date="${m.date}" style="text-align:right;">
                    <span class="val-weather" style="font-size:1.8rem; display:flex; align-items:center; gap: 8px;"></span>
                 </div>
              </div>
              
              <!-- Opponent Title -->
              <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px; border-bottom: 1px solid #f0f0f5; padding-bottom:10px;">
                 <span class="dash-vs" style="color:#888; font-size:1.1rem; font-weight:800;">VS</span>
                 <h3 class="dash-opp-name" style="color:#111; font-weight:900; margin:0; font-size:1.6rem; font-family:var(--font-main); letter-spacing:1px;">${m.opponent}</h3>
              </div>
              
               <!-- Split Layout -->
              <div style="display:flex; gap: 15px;">
                 <!-- Left (My Team) -->
                 <div style="flex:1; display:flex; flex-direction:column; align-items:center; text-align:center;">
                    <img src="${myEmblem}" style="height:45px; margin-bottom:4px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.1)); cursor:pointer;" onclick="openClubSite('${myShortName === '新潟' ? 'アルビレックス新潟' : 'ロアッソ熊本'}', event)">
                    <div style="display:flex; align-items:baseline; gap:4px; border-bottom:1px solid #f0f0f5; width:95%; justify-content:center; padding-bottom:6px; margin-bottom:6px;">
                       <span class="val-rank-num-my" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111;">-</span><span style="font-weight:700; font-size:0.85rem;">th</span>
                       <span style="font-size:0.85rem; color:#666; font-weight:700; margin-left:6px;"><span class="val-pts-my">-</span> pts</span>
                    </div>
                    <div style="font-size:0.75rem; color:#555; font-weight:700; margin-bottom:4px;"><span class="val-prev-date-my">-</span> <span style="color:#aaa; font-weight:500;">vs</span> <span class="val-prev-opp-name-my">-</span><span class="val-prev-ha-my" style="margin-left:2px;font-weight:900;color:#888;"></span></div>
                    <div style="display:flex; align-items:center; gap:6px;">
                       <span class="val-prev-score-my" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111; letter-spacing:1px; white-space:nowrap;">-</span>
                       <span class="val-prev-res-my">-</span>
                    </div>
                    <div class="val-prev-form-my" style="min-height:18px;"></div>
                 </div>
                 
                 <!-- Divider -->
                 <div style="width:1px; background:#e8e8ed;"></div>
                 
                 <!-- Right (Opponent) -->
                 <div style="flex:1; display:flex; flex-direction:column; align-items:center; text-align:center;">
                    <img src="${m.emblem}" class="dash-opp-emblem" style="height:45px; margin-bottom:4px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.1)); cursor:pointer;" onclick="openClubSite('${m.opponent}', event)">
                    <div style="display:flex; align-items:baseline; gap:4px; border-bottom:1px solid #f0f0f5; width:95%; justify-content:center; padding-bottom:6px; margin-bottom:6px;">
                       <span class="val-rank-num-opp" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111;">-</span><span style="font-weight:700; font-size:0.85rem;">th</span>
                       <span style="font-size:0.85rem; color:#666; font-weight:700; margin-left:6px;"><span class="val-pts-opp">-</span> pts</span>
                    </div>
                    <div style="font-size:0.75rem; color:#555; font-weight:700; margin-bottom:4px;"><span class="val-prev-date-opp">-</span> <span style="color:#aaa; font-weight:500;">vs</span> <span class="val-prev-opp-name-opp">-</span><span class="val-prev-ha-opp" style="margin-left:2px;font-weight:900;color:#888;"></span></div>
                    <div style="display:flex; align-items:center; gap:6px;">
                       <span class="val-prev-score-opp" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111; letter-spacing:1px; white-space:nowrap;">-</span>
                       <span class="val-prev-res-opp">-</span>
                    </div>
                    <div class="val-prev-form-opp" style="min-height:18px;"></div>
                 </div>
              </div>
            </div>
          </div>
        `;
    };

    html += renderCard(nextNiigata, "ALBIREX NIIGATA", "var(--albirex-orange)", "新潟");
    html += renderCard(nextKumamoto, "ROASSO KUMAMOTO", "var(--roasso-red)", "熊本");
    container.innerHTML = html;

    // Header Announcements (N Gate etc)
    updateHeaderAnnouncements();

    // Bind buttons
    container.querySelectorAll('.dash-card').forEach(card => {
      card.onclick = () => {
        const mId = card.dataset.mid;
        if (!mId) return;
        const match = scheduleData.find(x => `${x.date}_${x.club}_${x.opponent}` === mId);
        if (match) openDetailSheet(match);
      };
    });

    // Bind new quick links
    const btnFeed = document.getElementById("dash-to-feed");
    const btnCal = document.getElementById("dash-to-calendar");
    if (btnFeed) btnFeed.onclick = () => switchMode("feed");
    if (btnCal) btnCal.onclick = () => switchMode("calendar");

    document.getElementById("dash-to-standings").onclick = () => {
      openSubPane("standings-overlay");
      loadStandings();
    };
    document.getElementById("dash-to-links").onclick = () => openSubPane("links-overlay");

    // Auto Fetch Weather Function inline
    const fetchWeatherForDash = async (idPrefix, clubPrefix) => {
      const wBox = document.getElementById(idPrefix);
      if (!wBox) return;
      const venue = wBox.dataset.venue;
      const dateStr = wBox.dataset.date;

      const cacheKey = `weather_html_${venue}_${dateStr}`;
      const cachedHTML = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(`${cacheKey}_time`);

      // 3時間のキャッシュ有効期限
      if (cachedHTML && cachedTime && (Date.now() - parseInt(cachedTime) < 10800000)) {
        wBox.querySelector('.val-weather').innerHTML = cachedHTML;
        return;
      }

      const mDate = new Date(dateStr);
      const now = new Date();
      const diffDays = (mDate - now) / (1000 * 60 * 60 * 24);

      if (diffDays >= -4 && diffDays <= 14) {
        const searchLocation = COMMON_STADIUM_CITY_MAP[venue] || venue;
        try {
          let lat, lon;
          const cCache = localStorage.getItem('coord_' + searchLocation);
          if (cCache) { const c = JSON.parse(cCache); lat = c.lat; lon = c.lon; }
          else {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchLocation)}&format=json&limit=1`);
            const data = await res.json();
            if (data && data[0]) {
              lat = data[0].lat; lon = data[0].lon;
              localStorage.setItem('coord_' + searchLocation, JSON.stringify({ lat, lon }));
            }
          }
          if (lat !== undefined && lon !== undefined) {
            const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&past_days=3&forecast_days=16`);
            const wData = await wRes.json();
            const dIdx = wData.daily?.time?.indexOf(dateStr);
            if (dIdx !== undefined && dIdx > -1) {
              const code = wData.daily.weather_code[dIdx];
              const max = wData.daily.temperature_2m_max[dIdx];
              const min = wData.daily.temperature_2m_min[dIdx];
              let emoji = "☁️";
              if (code <= 1) emoji = "☀️";
              else if (code <= 3) emoji = "☁️";
              else if (code <= 69 || (code >= 80 && code <= 82) || code >= 95) emoji = "☔️";
              else if ((code >= 70 && code <= 79) || (code >= 85 && code <= 86)) emoji = "⛄️";
              
              const finalHTML = `${emoji} <div style="display:flex; align-items:baseline; gap:6px; font-family:var(--font-kick); font-weight:900; font-size:1.4rem;"><span style="color:#ff3b30;">${Math.round(max)}</span> <span style="font-size:1.2rem; color:#aaa;">/</span> <span style="color:#007aff;">${Math.round(min)}</span> <span style="font-size:1rem; color:#111;">℃</span></div>`;
              wBox.querySelector(".val-weather").innerHTML = finalHTML;
              localStorage.setItem(cacheKey, finalHTML);
              localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
            }
          }
        } catch (e) { }
      } else {
        wBox.querySelector(".val-weather").innerHTML = `<span style="font-size:0.6rem;color:#999;line-height:2;">取得期間外</span>`;
      }
    };

    if (nextNiigata) fetchWeatherForDash(`dash-weather-niigata`, 'niigata');
    if (nextKumamoto) fetchWeatherForDash(`dash-weather-kumamoto`, 'kumamoto');

    // Ensure standings are available on dashboard
    const refreshStandings = async () => {
      const data = cachedStandings;
      if (!data) return;
      
      const updateStatsCard = (m, myKeyword) => {
        if (!m) return;
        const nMyKey = normalizeName(myKeyword);
        const myData = data.find(r => r.team && normalizeName(r.team).includes(nMyKey));
        
        // Match opponent rank
        const J_TEAM_KWS = ["FC東京", "東京V", "横浜FM", "横浜FC", "YS横浜", "FC大阪", "G大阪", "C大阪", "セレッソ", "FC岐阜", "FC今治", "FC琉球", "札幌", "鹿島", "浦和", "柏", "町田", "川崎", "湘南", "新潟", "富山", "金沢", "清水", "藤枝", "沼津", "磐田", "名古屋", "岐阜", "京都", "神戸", "奈良", "鳥取", "岡山", "広島", "山口", "讃岐", "徳島", "愛媛", "今治", "福岡", "北九州", "鳥栖", "長崎", "熊本", "大分", "宮崎", "鹿児島", "琉球", "高知", "滋賀", "八戸", "盛岡", "秋田", "山形", "仙台", "福島", "水戸", "群馬", "栃木", "大宮", "千葉", "相模原", "甲府", "松本", "長野"];
        let oppData = null;
        let bestLen = 0;
        const nOpp = normalizeName(m.opponent);
        for (let kw of J_TEAM_KWS) {
           const nKw = normalizeName(kw);
           if (nOpp.includes(nKw)) {
             const found = data.find(r => r.team && normalizeName(r.team).includes(nKw));
             if (found && kw.length > bestLen) {
                oppData = found;
                bestLen = kw.length;
             }
           }
        }

        const card = document.getElementById(`dash-card-${m.club}`);
        if (card) {
          if (myData) {
            const rankEl = card.querySelector('.val-rank-num-my');
            const ptsEl = card.querySelector('.val-pts-my');
            if (rankEl) rankEl.innerText = myData.rank;
            if (ptsEl) ptsEl.innerText = myData.points;
          }
          if (oppData) {
            const rankEl = card.querySelector('.val-rank-num-opp');
            const ptsEl = card.querySelector('.val-pts-opp');
            if (rankEl) rankEl.innerText = oppData.rank;
            if (ptsEl) ptsEl.innerText = oppData.points;
          }
        }
      };
      updateStatsCard(nextNiigata, "新潟");
      updateStatsCard(nextKumamoto, "熊本");
    };
    refreshStandings();

    // 前節表示を更新（独立関数に委譲）
    updateDashboardPrevResults();
  }

  // --- 前節表示更新（renderDashboard再呼び出しでもリセットされない独立関数） ---
  // --- Update Previous Match Results on Dashboard ---
  function updateDashboardPrevResults() {
    if (!officialResults.length) return;

    const now = new Date();
    const cutoffStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // Find next matches to determine cutoff dates
    const sorted = [...scheduleData].sort((a, b) => a.date.localeCompare(b.date));
    let nextNiigata = sorted.find(m => m.date >= cutoffStr && m.club === "niigata");
    let nextKumamoto = sorted.find(m => m.date >= cutoffStr && m.club === "kumamoto");

    const updateUI = (club, teamKw, match) => {
      const card = document.getElementById(`dash-card-${club}`);
      if (!card) return;
      
      const cutoff = match ? match.date : "9999-12-31";
      
      const updateHalf = (prefix, kw) => {
        const past = officialResults.filter(r => {
          const dMatch = r.date < cutoff;
          const tMatch = robustTeamMatch(r.home, kw) || robustTeamMatch(r.away, kw);
          const hasScore = r.home_score !== "" && r.home_score !== null;
          const status = (r.status || "").toLowerCase();
          const isFinished = status.includes("finish") || status.includes("ft") || status.includes("終");
          return dMatch && tMatch && (hasScore || isFinished);
        }).sort((a,b) => b.date.localeCompare(a.date));

        if (!past.length) return;
        const last = past[0];
        const isHome = robustTeamMatch(last.home, kw);
        const sM = parseInt(isHome ? last.home_score : last.away_score);
        const sO = parseInt(isHome ? last.away_score : last.home_score);
        const opp = (isHome ? last.away : last.home).replace(/の試合詳細|の結果/g, "").trim();
        
        let symbol = "DRAW";
        let badgeColor = "#f1f3f4";
        let badgeText = "#5f6368";
        let scoreStr = `${sM} - ${sO}`;
        
        if (sM > sO) { symbol = "WIN"; badgeColor = "#e6f4ea"; badgeText = "#137333"; }
        else if (sM < sO) { symbol = "LOSE"; badgeColor = "#fce8e6"; badgeText = "#c5221f"; }
        else if (last.pk) {
          const pkMatch = last.pk.match(/(\d+)\s*PK\s*(\d+)/i);
          if (pkMatch) {
            const pkM = parseInt(isHome ? pkMatch[1] : pkMatch[2]);
            const pkO = parseInt(isHome ? pkMatch[2] : pkMatch[1]);
            scoreStr = `(${pkM}) ${sM}-${sO} (${pkO})`;
            if (pkM > pkO) { symbol = "PK WIN"; badgeColor = "#e6f4ea"; badgeText = "#137333"; }
            else { symbol = "PK LOSE"; badgeColor = "#fce8e6"; badgeText = "#c5221f"; }
          }
        }

        const resHtml = `<span style="border:1px solid ${badgeColor}; background:${badgeColor}; color:${badgeText}; border-radius:12px; padding:3px 8px; font-size:0.7rem; font-weight:800; display:inline-flex; align-items:center; gap:4px;"><span style="font-size:0.5rem;">●</span> ${symbol}</span>`;

        let formHtml = `<div style="display:flex; gap:3px; margin-top:6px; justify-content:center;">`;
        const recent5 = past.slice(0, 5).reverse();
        recent5.forEach(r => {
          const isRHome = robustTeamMatch(r.home, kw);
          const rM = parseInt(isRHome ? r.home_score : r.away_score);
          const rO = parseInt(isRHome ? r.away_score : r.home_score);
          let rSym = "△";
          if (rM > rO) { rSym = "〇"; }
          else if (rM < rO) { rSym = "●"; }
          else if (r.pk) {
            const pkMatch = r.pk.match(/(\d+)\s*PK\s*(\d+)/i);
            if (pkMatch) {
              const pkM = parseInt(isRHome ? pkMatch[1] : pkMatch[2]);
              const pkO = parseInt(isRHome ? pkMatch[2] : pkMatch[1]);
              if (pkM > pkO) { rSym = "△"; }
              else { rSym = "▲"; }
            }
          }
          formHtml += `<span style="color:#555; font-size:0.9rem; font-weight:900;">${rSym}</span>`;
        });
        formHtml += `</div>`;

        const elDate = card.querySelector(`.val-prev-date-${prefix}`);
        const elOpp = card.querySelector(`.val-prev-opp-name-${prefix}`);
        const elHA = card.querySelector(`.val-prev-ha-${prefix}`);
        const elScore = card.querySelector(`.val-prev-score-${prefix}`);
        const elRes = card.querySelector(`.val-prev-res-${prefix}`);
        const elForm = card.querySelector(`.val-prev-form-${prefix}`);
        
        if (elDate) elDate.innerText = last.date.substring(5).replace("-", "/");
        if (elOpp) elOpp.innerText = opp;
        if (elHA) elHA.innerText = isHome ? "(H)" : "(A)";
        if (elScore) elScore.innerText = scoreStr;
        if (elRes) elRes.innerHTML = resHtml;
        if (elForm) elForm.innerHTML = formHtml;
      };

      updateHalf('my', teamKw);
      if (match) updateHalf('opp', match.opponent);
    };

    updateUI("niigata", "新潟", nextNiigata);
    updateUI("kumamoto", "熊本", nextKumamoto);

    // --- Dashboard Weather Sync ---
    setTimeout(() => {
      const wN = document.getElementById("dash-weather-niigata");
      const wK = document.getElementById("dash-weather-kumamoto");
      // Use schedule.js updateWeatherUI function to inject SVG icons
      if (typeof updateWeatherUI === 'function') {
        if (wN && nextNiigata) updateWeatherUI(wN, nextNiigata.date, nextNiigata.venue);
        if (wK && nextKumamoto) updateWeatherUI(wK, nextKumamoto.date, nextKumamoto.venue);
      }
    }, 100);

    // Add update timestamp to dashboard
    let timeBox = document.getElementById("dash-update-time");
    if (!timeBox) {
      timeBox = document.createElement("div");
      timeBox.id = "dash-update-time";
      container.appendChild(timeBox);
    }
    timeBox.style.cssText = "font-size:0.65rem; color:white; background:rgba(0,0,0,0.5); padding:4px 12px; border-radius:10px; margin-top:15px; display:inline-block; font-weight:700;";
    timeBox.innerText = `最終同期: ${new Date().toLocaleTimeString()} (Data: v20260424)`;
  }


  // --- Rendering Feed ---


  // --- Rendering Feed ---


  function renderFeed() {
    feedSlider.innerHTML = "";
    scheduleData.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    const ymMap = {};
    scheduleData.forEach(m => {
      const d = parseDate(m.date), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!ymMap[key]) ymMap[key] = []; ymMap[key].push(m);
    });

    Object.keys(ymMap).sort().forEach(key => {
      const [year, month] = key.split("-").map(Number);
      const section = document.createElement("div"); section.className = "month-section"; section.dataset.ym = key; section.dataset.year = year; section.dataset.ym_title = `${year} / ${String(month).padStart(2, "0")}`;

      ymMap[key].forEach(match => {
        const mId = `${match.date}_${match.club}_${match.opponent}`;
        const isAtt = localStorage.getItem(`attend_${mId}`) === "true";
        const sMy = localStorage.getItem(`score_my_${mId}`) || "", sOpp = localStorage.getItem(`score_opp_${mId}`) || "";
        const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "", sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
        let res = null;
        let scoreDisplay = "";

        if (sMy !== "" && sOpp !== "") {
          const ms = Number(sMy), os = Number(sOpp);
          if (ms === os && sPkM !== "" && sPkO !== "") {
            scoreDisplay = `(${sPkM}) ${ms} - ${os} (${sPkO})`;
            res = Number(sPkM) > Number(sPkO) ? "pk-win" : "pk-lose";
          } else {
            scoreDisplay = `${ms} - ${os}`;
            if (ms > os) res = "win"; else if (ms < os) res = "lose"; else res = "draw";
          }
        }
        const isHome = isHomeMatch(match.club, match.venue);
        const card = document.createElement("div"); card.className = `card club-${match.club} type-${isHome ? 'home' : 'away'}`; card.dataset.mid = mId;
        const ha = isHome ? 'HOME' : 'AWAY';

        let resultHtml = "";
        if (res) {
          resultHtml = `
            <div class="result-box">
              <div class="result-badge badge-${res}">${res.replace("-", " ").toUpperCase()}</div>
              <div class="match-score-text">${scoreDisplay}</div>
            </div>`;
        }

        card.innerHTML = `${resultHtml}<div class="match-meta"><span class="match-mw-pill">${match.matchweek || "EX"}</span><span class="match-ha-pill">${ha}</span>${isAtt ? '<span class="match-att-emoji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>' : ''}</div><div class="match-date-time">${match.date} ${match.day} - ${match.time}</div><div class="match-venue">${match.venue}</div><div class="match-row"><h3 class="opponent-name">${match.opponent}</h3><img class="emblem" src="${match.emblem}"></div>`;
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
  const today = new Date(), todayY = today.getFullYear(), tKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  applyYearFilter(allSections.some(s => Number(s.dataset.year) === todayY) ? todayY : 2025, true);
  const tIdx = visibleSections.findIndex(s => s.dataset.ym === tKey);

  // Use requestAnimationFrame and small timeout to ensure layout is ready for iPhone
  requestAnimationFrame(() => {
    setTimeout(() => {
      scrollToIndex(tIdx !== -1 ? tIdx : 0);
      switchMode('dashboard');
    }, 100);
  });

  // Navigation
  prevBtn.onclick = () => { if (currentIndex > 0) scrollToIndex(currentIndex - 1); };
  nextBtn.onclick = () => { if (currentIndex < visibleSections.length - 1) scrollToIndex(currentIndex + 1); };
  goTodayBtn.onclick = () => {
    const n = new Date(), y = n.getFullYear(), k = `${y}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    applyYearFilter(y);
    const i = visibleSections.findIndex(s => s.dataset.ym === k);
    if (i !== -1) scrollToIndex(i);
  };

  yearTabs["2025"].onclick = () => applyYearFilter(2025);
  yearTabs["2026"].onclick = () => applyYearFilter(2026);
  yearTabs["all"].onclick = () => applyYearFilter(null);

  // YM Picker
  function openYmPicker() {
    if (!activeMonthTitle.textContent.includes("/")) return; // Not fully initialized
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

  document.getElementById("menu-dashboard").onclick = () => switchMode("dashboard");
  document.getElementById("menu-feed").onclick = () => switchMode("feed");
  document.getElementById("menu-calendar").onclick = () => switchMode("calendar");
  document.getElementById("menu-links").onclick = () => openSubPane("links-overlay");
  document.getElementById("menu-chants").onclick = () => openSubPane("chants-overlay");
  document.getElementById("menu-standings").onclick = () => {
    openSubPane("standings-overlay");
    loadStandings();
  };
  const dashStandingsBtn = document.getElementById("dash-to-standings");
  if (dashStandingsBtn) {
    dashStandingsBtn.onclick = () => {
      openSubPane("standings-overlay");
      loadStandings();
    };
  }
  document.getElementById("menu-data").onclick = () => openSubPane("data-overlay");
  document.getElementById("menu-reload").onclick = async () => {
    const btn = document.getElementById("menu-reload");
    const label = btn.querySelector(".m-label");
    const originalLabel = label.textContent;
    label.textContent = "更新中...";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";

    try {
      await refreshAllData(true); // Force GAS
      alert("最新データを取得して反映しました。");
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました。");
    } finally {
      label.textContent = originalLabel;
      btn.style.pointerEvents = "auto";
      btn.style.opacity = "1";
      toggleMenu(false);
    }
  };


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
    const m = scheduleData.filter(x => (x.opponent || "").toLowerCase().includes(q) || (x.venue || "").toLowerCase().includes(q)).slice(0, 10);
    if (m.length > 0) {
      searchPopup.innerHTML = m.map(x => `<div class="search-item" data-date="${x.date}" data-club="${x.club}" data-opponent="${x.opponent}"><strong>${x.opponent}</strong><br><small>${x.date} | ${x.club.toUpperCase()}</small></div>`).join("");
      searchPopup.style.display = "block";
    } else { searchPopup.style.display = "none"; }
  };
  searchPopup.onclick = (e) => {
    const item = e.target.closest(".search-item");
    if (item) {
      const { date, club, opponent } = item.dataset;
      const x = scheduleData.find(m => m.date === date && m.club === club && m.opponent === opponent);
      if (x) {
        searchPopup.style.display = "none"; searchInput.value = "";
        const d = parseDate(date), ty = d.getFullYear(), tk = `${ty}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        applyYearFilter(ty, true); const i = visibleSections.findIndex(s => s.dataset.ym === tk);
        if (i !== -1) { scrollToIndex(i); setTimeout(() => openDetailSheet(x), 500); }
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
      }).sort((a, b) => parseDate(a.date) - parseDate(b.date));

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
    }).sort((a, b) => parseDate(a.date) - parseDate(b.date));

    if (yearMatches.length === 0) {
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
        const content = blocks[i + 1];

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
  const gasUrl = 'https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec';


  // --- Standings View ---

  async function loadStandings() {
    const container = document.getElementById("standings-content");
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">読み込み中...</div>`;
    try {
      const json = await fetchData("standings");
      if (!json || !json.data || !Array.isArray(json.data)) throw new Error("no data");

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
        { label: '順', key: 'rank', type: 'num' },
        { label: 'チーム', key: 'team', type: 'str' },
        { label: '勝点', key: 'points', type: 'num' },
        { label: '試合', key: 'played', type: 'num' },
        { label: '勝', key: 'won', type: 'num' },
        { label: 'PK勝', key: 'pk_won', type: 'num' },
        { label: 'PK負', key: 'pk_lost', type: 'num' },
        { label: '負', key: 'lost', type: 'num' },
        { label: '得', key: 'goals_for', type: 'num' },
        { label: '失', key: 'goals_against', type: 'num' },
        { label: '差', key: 'goal_diff', type: 'num' },
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
            + '<td class="standing-team" style="cursor:pointer;" onclick="openClubSite(\'' + row.team + '\', event)">' + row.team + '</td>'
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
          + '<div style="border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.03); margin:10px 0 20px;">'
          + '<div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;">'
          + '<table class="standings-table" data-group="' + groupName + '" style="margin:0; box-shadow:none; border-radius:0;">'
          + '<thead><tr>' + thHTML + '</tr></thead>'
          + '<tbody>' + tbodyHTML + '</tbody>'
          + '</table></div></div>';
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

  // アプリ起動時に初期化
  updateHeaderAnnouncements();

  // アプリ起動時にバックグラウンドで結果同期（3秒後）
  setTimeout(() => refreshAllData(), 3000);

});


window.switchChantClub = function (club, btn) {
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
