window.clubSitesData = null;
window.openClubSite = async function(clubName, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!window.clubSitesData) {
    try {
      const res = await fetch('data/clubs/official_sites.json');
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

document.addEventListener("DOMContentLoaded", async () => {
  const waitForScheduleReady = () => {
    if (!window.scheduleDataReady) return Promise.resolve();
    const timeout = new Promise(resolve => setTimeout(resolve, 1200));
    return Promise.race([window.scheduleDataReady, timeout]);
  };

  const ASCII_NORMALIZE_FIELDS = new Set([
    "opponent", "venue", "stadium", "source_venue",
    "home", "away", "home_team", "away_team", "homeName", "awayName",
    "team", "club_name", "competition", "tournament", "league", "section",
    "matchweek", "round", "group"
  ]);

  function normalizeAsciiText(value) {
    return typeof value === "string"
      ? value.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      : value;
  }

  function normalizeAsciiFieldsInPlace(value, key = "") {
    if (typeof value === "string") {
      return ASCII_NORMALIZE_FIELDS.has(key) ? normalizeAsciiText(value) : value;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        value[index] = normalizeAsciiFieldsInPlace(item, key);
      });
      return value;
    }
    if (value && typeof value === "object") {
      Object.keys(value).forEach(childKey => {
        value[childKey] = normalizeAsciiFieldsInPlace(value[childKey], childKey);
      });
    }
    return value;
  }

  async function loadScheduleFallback() {
    if (Array.isArray(window.scheduleData) && window.scheduleData.length) return window.scheduleData;
    const urls = ["./data/schedule/2026_2027.json"];
    for (const url of urls) {
      try {
        const res = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) continue;
        const items = await res.json();
        if (Array.isArray(items) && items.length) {
          window.scheduleData = normalizeAsciiFieldsInPlace(items);
          return items;
        }
      } catch (error) {
        console.warn(`schedule fallback failed: ${url}`, error);
      }
    }
    window.scheduleData = window.scheduleData || [];
    return window.scheduleData;
  }

  if (window.scheduleDataReady) {
    try {
      await waitForScheduleReady();
    } catch (error) {
      console.error(error);
      window.scheduleData = window.scheduleData || [];
    }
  }
  await loadScheduleFallback();

  var scheduleData = window.scheduleData = normalizeAsciiFieldsInPlace(window.scheduleData || []);
  const feedSlider = document.getElementById("feed-slider");
  const calendarBody = document.getElementById("calendar-body");
  const ultraFeed = document.getElementById("ultra-feed");
  const calendarView = document.getElementById("calendar-view");
  const ultraDashboard = document.getElementById("ultra-dashboard");
  const visionView = document.getElementById("vision-view");
  const playerAnalysisView = document.getElementById("player-analysis-view");

  const prevYearBtn = document.getElementById("prev-year");
  const nextYearBtn = document.getElementById("next-year");
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const goTodayBtn = document.getElementById("go-today");
  const activeMonthTitle = document.getElementById("active-month-title");

  const toggleNiigata = document.getElementById("toggle-niigata");
  const toggleKumamoto = document.getElementById("toggle-kumamoto");

  const yearTabContainer = document.getElementById("nav-year-tabs");
  const navMonthTabs = document.getElementById("nav-month-tabs");
  let yearTabs = {};

  const detailSheet = document.getElementById("detail-sheet");
  const sheetBackdrop = document.getElementById("detail-sheet-backdrop");
  const sheetContent = document.getElementById("sheet-content");

  const pickerOverlay = document.getElementById("match-picker-overlay");
  const pickerBackdrop = document.getElementById("match-picker-backdrop");
  const pickerList = document.getElementById("picker-list");

  const sideMenu = document.getElementById("side-menu");
  const sideMenuBackdrop = document.getElementById("side-menu-backdrop");
  const hamBtn = document.getElementById("hamburger-btn");
  const hamburgerIconHtml = hamBtn ? hamBtn.innerHTML : "";
  const ellipsisIconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="5.01" y2="12"></line><line x1="12" y1="12" x2="12.01" y2="12"></line><line x1="19" y1="12" x2="19.01" y2="12"></line></svg>';
  const searchInput = document.getElementById("search-input");
  const searchPopup = document.getElementById("search-popup");
  const scheduleCompetitionFilter = document.getElementById("schedule-competition-filter");
  const scheduleCompetitionOptions = document.getElementById("schedule-competition-options");

  const ymPickerOverlay = document.getElementById("ym-picker-overlay");
  const ymPickerBackdrop = document.getElementById("ym-picker-backdrop");
  const ymPickerList = document.getElementById("ym-picker-list");

  let currentIndex = 0;
  let allSections = [];
  let visibleSections = [];
  let selectedYear = null;
  let renderedFeedYear = undefined;
  let currentMode = "dashboard"; // dashboard, feed, calendar, player-analysis or vision
  let lineupDetailExpanded = false;
  const scheduleCompetitionFilterState = {
    active: false,
    selected: [],
    available: []
  };
  const SCHEDULE_COMPETITION_FILTER_OPTIONS = ["リーグ", "カップ", "その他"];
  const PLAYER_ANALYSIS_YEAR_START = 1994;
  const PLAYER_ANALYSIS_YEAR_END = 2026;
  const PLAYER_ANALYSIS_CLUBS = {
    niigata: {
      key: "niigata",
      dataDir: "niigata",
      name: "アルビレックス新潟",
      shortName: "新潟",
      englishName: "ALBIREX NIIGATA",
      yearStart: 1994
    },
    kumamoto: {
      key: "kumamoto",
      dataDir: "kumamoto",
      name: "ロアッソ熊本",
      shortName: "熊本",
      englishName: "ROASSO KUMAMOTO",
      yearStart: 2008
    }
  };
  const playerAnalysisCache = new Map();
  const playerAnalysisScopedCache = new Map();
  const playerAnalysisDatasetCache = new Map();
  const playerAnalysisHistoryCache = new Map();
  const playerAnalysisRankingMetricsCache = new Map();
  const playerAnalysisAllPromises = new Map();
  const playerAnalysisAllYearRowsCache = new Map();
  const playerAnalysisSupplementCache = new Map();
  const playerProfileCache = new Map();
  const playerAnalysisSeasonMetaCache = new Map();
  const playerAnalysisMonthlyMetaCache = new Map();
  const playerAnalysisSpecialAvailabilityCache = new Map();
  const playerAnalysisPlayedSetsCache = new Map();
  const playerChantAvailabilityCache = new Map();
  const PLAYER_CHANT_AUDIO_DIR = "./data/assets/chants";
  const PLAYER_CHANT_MAX_INDEX = 20;
  const playerAnalysisState = {
    selectedClub: "niigata",
    year: 2026,
    matchScope: "all",
    data: [],
    filtered: [],
    sortKey: "played_matches",
    sortDirection: "desc",
    listDetail: false,
    selectedKey: null,
    query: "",
    positions: [],
    positionMode: "or",
    numberFilter: "",
    playedMin: "",
    playedMax: "",
    startsMin: "",
    goalsMin: "",
    playedRateMin: "",
    scoredRateMin: "",
    scoredPpmMin: "",
    monthFilter: "",
    monthGoalsMin: "",
    monthPlayedRateMin: "",
    yellowMin: "",
    redMin: "",
    seasonsMin: "",
    seasonsMax: "",
    heightMin: "",
    heightMax: "",
    weightMin: "",
    weightMax: "",
    birthYearMin: "",
    birthYearMax: "",
    compactFilterType: "",
    compactFilterValue: "",
    compactFilterMonth: "5",
    advancedFilterLogic: "and",
    advancedFilters: [{ type: "", value: "", month: "5" }],
    scorersOnly: false,
    playedOnly: false,
    katakanaOnly: false,
    competitionFilterActive: false,
    selectedCompetitions: [],
    availableCompetitions: [],
    initialized: false,
    loadedOnce: false,
    profileTab: "profile",
    modalPlayer: null,
    modalView: "profile",
    modalCategories: [],
    modalYearRows: [],
    modalMatchYear: null,
    modalMatchYearRow: null,
    modalMatchItems: [],
    modalRankingRows: [],
    activeScreen: "analysis",
    timeMode: "year",
    rangeStartYear: "",
    rangeEndYear: "",
    compareTimeMode: "year",
    compareYear: "",
    compareStartYear: "",
    compareEndYear: "",
    compareKeys: ["", "", ""],
    compareScopeRows: [],
    compareChoiceYears: ["", "", ""],
    compareChoiceRows: [[], [], []],
    compareRenderToken: 0,
    opponentTimeMode: "year",
    opponentYear: "",
    opponentStartYear: "",
    opponentEndYear: "",
    opponentPlayerKey: "",
    opponentClub: "",
    opponentClubs: [],
    opponentPlayerDetail: false,
    opponentScopeRows: [],
    opponentChoiceRows: [],
    opponentRenderToken: 0,
    playerOpponentRenderToken: 0
  };

  // Keep this single-page app in sync with the browser's Back/Forward buttons.
  // Each visible screen owns a history entry and knows how to restore itself.
  const APP_HISTORY_ID = "trappHistoryId";
  const appHistoryEntries = new Map();
  let appHistoryId = 0;
  let activeAppHistoryId = 0;
  let appHistoryRestoring = false;

  function getActiveAppHistoryEntry() {
    return appHistoryEntries.get(activeAppHistoryId) || null;
  }

  function addAppHistoryEntry(kind, restore, options = {}) {
    if (appHistoryRestoring || options.history === false) return;
    const previousEntry = getActiveAppHistoryEntry();
    const shouldReplace = options.replace === true || previousEntry?.kind === "side-menu";
    const id = shouldReplace ? activeAppHistoryId : ++appHistoryId;
    const parentId = shouldReplace ? (previousEntry?.parentId ?? 0) : activeAppHistoryId;
    const entry = { id, parentId, kind, restore };
    appHistoryEntries.set(id, entry);
    activeAppHistoryId = id;
    const nextState = { ...(window.history.state || {}), [APP_HISTORY_ID]: id, trappKind: kind };
    if (shouldReplace) {
      window.history.replaceState(nextState, "");
    } else {
      window.history.pushState(nextState, "");
    }
  }

  function closeAppHistoryEntry(kind, closeDirect) {
    const entry = getActiveAppHistoryEntry();
    const kinds = Array.isArray(kind) ? kind : [kind];
    if (!appHistoryRestoring && entry && kinds.includes(entry.kind)) {
      window.history.back();
      return;
    }
    closeDirect();
  }

  function closeAppHistoryGroup(predicate, closeDirect) {
    if (!appHistoryRestoring) {
      let entry = getActiveAppHistoryEntry();
      let distance = 0;
      while (entry && predicate(entry.kind)) {
        distance += 1;
        entry = appHistoryEntries.get(entry.parentId) || null;
      }
      if (distance > 0) {
        window.history.go(-distance);
        return;
      }
    }
    closeDirect();
  }

  function hideNavigableLayers() {
    detailSheet?.classList.remove("active");
    sheetBackdrop?.classList.remove("active");
    pickerOverlay?.classList.remove("active");
    pickerBackdrop?.classList.remove("active");
    ymPickerOverlay?.classList.remove("active");
    ymPickerBackdrop?.classList.remove("active");
    sideMenu?.classList.remove("active");
    sideMenuBackdrop?.classList.remove("active");
    document.querySelectorAll(".sub-pane.active").forEach(pane => pane.classList.remove("active"));
    document.getElementById("vision-preview-backdrop")?.classList.remove("active");
    document.getElementById("vision-preview-modal")?.classList.remove("active");
    document.getElementById("pa-modal-backdrop")?.classList.remove("active");
    document.getElementById("pa-modal")?.classList.remove("active");
    document.body.classList.remove("pa-modal-open");
    document.body.classList.remove("pa-filter-open");
    const filterPanel = document.getElementById("pa-filter-panel");
    const filterBackdrop = document.getElementById("pa-filter-backdrop");
    filterPanel?.classList.remove("active");
    if (filterBackdrop) {
      filterBackdrop.hidden = true;
      filterBackdrop.classList.remove("active");
    }
    delete document.body.dataset.paModalOriginMode;
    document.body.setAttribute("data-mode", currentMode);
  }

  appHistoryEntries.set(0, {
    id: 0,
    parentId: null,
    kind: "mode:dashboard",
    restore: () => switchMode("dashboard", { history: false })
  });
  window.history.replaceState(
    { ...(window.history.state || {}), [APP_HISTORY_ID]: 0, trappKind: "mode:dashboard" },
    ""
  );

  window.addEventListener("popstate", async event => {
    const id = Number(event.state?.[APP_HISTORY_ID]);
    activeAppHistoryId = Number.isInteger(id) && appHistoryEntries.has(id) ? id : 0;
    const entry = getActiveAppHistoryEntry() || appHistoryEntries.get(0);
    appHistoryRestoring = true;
    hideNavigableLayers();
    try {
      await entry.restore();
    } catch (error) {
      console.error("Failed to restore app history", error);
      switchMode("dashboard", { history: false });
    } finally {
      appHistoryRestoring = false;
    }
  });
  const PLAYER_POSITION_ORDER = ["GK", "DF", "MF", "FW"];
  const KATAKANA_PLAYER_RE = /[ァ-ヴー]/;

  const CLUB_ENGLISH_NAMES = {
    "北海道コンサドーレ札幌": "HOKKAIDO CONSADOLE SAPPORO", "札幌": "HOKKAIDO CONSADOLE SAPPORO", "ヴァンラーレ八戸": "VANRAURE HACHINOHE", "八戸": "VANRAURE HACHINOHE", "いわてグルージャ盛岡": "IWATE GRULLA MORIOKA", "岩手": "IWATE GRULLA MORIOKA", "ベガルタ仙台": "VEGALTA SENDAI", "仙台": "VEGALTA SENDAI", "ブラウブリッツ秋田": "BLAUBLITZ AKITA", "秋田": "BLAUBLITZ AKITA", "モンテディオ山形": "MONTEDIO YAMAGATA", "山形": "MONTEDIO YAMAGATA", "福島ユナイテッドFC": "FUKUSHIMA UNITED FC", "福島": "FUKUSHIMA UNITED FC", "いわきFC": "IWAKI FC", "いわき": "IWAKI FC", "鹿島アントラーズ": "KASHIMA ANTLERS", "鹿島": "KASHIMA ANTLERS", "水戸ホーリーホック": "MITO HOLLYHOCK", "水戸": "MITO HOLLYHOCK", "栃木SC": "TOCHIGI SC", "栃木": "TOCHIGI SC", "ザスパ群馬": "THESPA GUNMA", "ザスパクサツ群馬": "THESPAKUSATSU GUNMA", "群馬": "THESPA GUNMA", "浦和レッズ": "URAWA REDS", "浦和": "URAWA REDS", "大宮アルディージャ": "OMIYA ARDIJA", "RB大宮アルディージャ": "RB OMIYA ARDIJA", "大宮": "RB OMIYA ARDIJA", "ジェフユナイテッド千葉": "JEF UNITED CHIBA", "千葉": "JEF UNITED CHIBA", "柏レイソル": "KASHIWA REYSOL", "柏": "KASHIWA REYSOL", "FC東京": "FC TOKYO", "東京": "FC TOKYO", "東京ヴェルディ": "TOKYO VERDY", "東京V": "TOKYO VERDY", "FC町田ゼルビア": "FC MACHIDA ZELVIA", "町田": "FC MACHIDA ZELVIA", "川崎フロンターレ": "KAWASAKI FRONTALE", "川崎": "KAWASAKI FRONTALE", "横浜F・マリノス": "YOKOHAMA F. MARINOS", "横浜FM": "YOKOHAMA F. MARINOS", "横浜FC": "YOKOHAMA FC", "Y.S.C.C.横浜": "Y.S.C.C. YOKOHAMA", "湘南ベルマーレ": "SHONAN BELLMARE", "湘南": "SHONAN BELLMARE", "SC相模原": "SC SAGAMIHARA", "相模原": "SC SAGAMIHARA", "ヴァンフォーレ甲府": "VENTFORET KOFU", "甲府": "VENTFORET KOFU", "松本山雅FC": "MATSUMOTO YAMAGA FC", "松本": "MATSUMOTO YAMAGA FC", "AC長野パルセイロ": "AC NAGANO PARCEIRO", "長野": "AC NAGANO PARCEIRO", "アルビレックス新潟": "ALBIREX NIIGATA", "新潟": "ALBIREX NIIGATA", "カターレ富山": "KATALLER TOYAMA", "富山": "KATALLER TOYAMA", "ツエーゲン金沢": "ZWEIGEN KANAZAWA", "金沢": "ZWEIGEN KANAZAWA", "清水エスパルス": "SHIMIZU S-PULSE", "清水": "SHIMIZU S-PULSE", "ジュビロ磐田": "JUBILO IWATA", "磐田": "JUBILO IWATA", "藤枝MYFC": "FUJIEDA MYFC", "藤枝": "FUJIEDA MYFC", "アスルクラロ沼津": "AZUL CLARO NUMAZU", "沼津": "AZUL CLARO NUMAZU", "名古屋グランパス": "NAGOYA GRAMPUS", "名古屋": "NAGOYA GRAMPUS", "FC岐阜": "FC GIFU", "岐阜": "FC GIFU", "京都サンガF.C.": "KYOTO SANGA F.C.", "京都": "KYOTO SANGA F.C.", "ガンバ大阪": "GAMBA OSAKA", "G大阪": "GAMBA OSAKA", "セレッソ大阪": "CEREZO OSAKA", "C大阪": "CEREZO OSAKA", "FC大阪": "FC OSAKA", "大阪": "FC OSAKA", "ヴィッセル神戸": "VISSEL KOBE", "ヴィッセル神戶": "VISSEL KOBE", "神戸": "VISSEL KOBE", "奈良クラブ": "NARA CLUB", "奈良": "NARA CLUB", "ガイナーレ鳥取": "GAINARE TOTTORI", "鳥取": "GAINARE TOTTORI", "ファジアーノ岡山": "FAGIANO OKAYAMA", "岡山": "FAGIANO OKAYAMA", "サンフレッチェ広島": "SANFRECCE HIROSHIMA", "広島": "SANFRECCE HIROSHIMA", "レノファ山口FC": "RENOFA YAMAGUCHI FC", "山口": "RENOFA YAMAGUCHI FC", "カマタマーレ讃岐": "KAMATAMARE SANUKI", "讃岐": "KAMATAMARE SANUKI", "徳島ヴォルティス": "TOKUSHIMA VORTIS", "徳島": "TOKUSHIMA VORTIS", "愛媛FC": "EHIME FC", "愛媛": "EHIME FC", "FC今治": "FC IMABARI", "今治": "FC IMABARI", "アビスパ福岡": "AVISPA FUKUOKA", "福岡": "AVISPA FUKUOKA", "ギラヴァンツ北九州": "GIRAVANZ KITAKYUSHU", "北九州": "GIRAVANZ KITAKYUSHU", "サガン鳥栖": "SAGAN TOSU", "鳥栖": "SAGAN TOSU", "V・ファーレン長崎": "V-VAREN NAGASAKI", "長崎": "V-VAREN NAGASAKI", "ロアッソ熊本": "ROASSO KUMAMOTO", "熊本": "ROASSO KUMAMOTO", "大分トリニータ": "OITA TRINITA", "大分": "OITA TRINITA", "テゲバジャーロ宮崎": "TEGEVAJARO MIYAZAKI", "宮崎": "TEGEVAJARO MIYAZAKI", "鹿児島ユナイテッドFC": "KAGOSHIMA UNITED FC", "鹿児島": "KAGOSHIMA UNITED FC", "FC琉球": "FC RYUKYU", "琉球": "FC RYUKYU", "高知ユナイテッドSC": "KOCHI UNITED SC", "高知": "KOCHI UNITED SC", "レイラック滋賀FC": "REILAC SHIGA FC", "滋賀": "REILAC SHIGA FC"
  };

  // --- Date/Theme Helpers ---
  function getFirstIsoDateText(dateText) {
    const m = String(dateText || "").trim().match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (!m) return "";
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }

  function parseDate(s) {
    const [y, m, d] = (getFirstIsoDateText(s) || String(s || "")).split("-").map(Number);
    return new Date(y, m - 1, d || 1);
  }

  function isBeforeToday(dateStr) {
    const target = parseDate(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return target < today;
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

    const TEAM_ALIAS_OVERRIDES = {
      "アルビレックス新潟": "新潟", "新潟": "新潟",
      "ロアッソ熊本": "熊本", "熊本": "熊本",
      "鹿児島ユナイテッドFC": "鹿児島", "鹿児島": "鹿児島",
      "愛媛FC": "愛媛", "愛媛": "愛媛",
      "レノファ山口FC": "山口", "山口": "山口",
      "カターレ富山": "富山", "富山": "富山",
      "ツエーゲン金沢": "金沢", "金沢": "金沢",
      "徳島ヴォルティス": "徳島", "徳島": "徳島",
      "高知ユナイテッドSC": "高知", "高知": "高知",
      "奈良クラブ": "奈良", "奈良": "奈良",
      "カマタマーレ讃岐": "讃岐", "讃岐": "讃岐",
      "FC今治": "今治", "今治": "今治",
      "FC大阪": "FC大阪", "F大阪": "FC大阪",
      "ガンバ大阪": "G大阪", "G大阪": "G大阪",
      "セレッソ大阪": "C大阪", "C大阪": "C大阪",
      "テゲバジャーロ宮崎": "宮崎", "宮崎": "宮崎",
      "サガン鳥栖": "鳥栖", "鳥栖": "鳥栖",
      "ガイナーレ鳥取": "鳥取", "鳥取": "鳥取",
      "大分トリニータ": "大分", "大分": "大分",
      "レイラック滋賀FC": "滋賀", "レイラック滋賀": "滋賀", "滋賀": "滋賀",
      "ギラヴァンツ北九州": "北九州", "北九州": "北九州",
      "FC琉球": "琉球", "琉球": "琉球",
      "ベガルタ仙台": "仙台", "仙台": "仙台",
      "ブラウブリッツ秋田": "秋田", "秋田": "秋田",
      "湘南ベルマーレ": "湘南", "湘南": "湘南",
      "横浜FC": "横浜FC",
      "SC相模原": "相模原", "相模原": "相模原",
      "ザスパ群馬": "群馬", "ザスパクサツ群馬": "群馬", "群馬": "群馬",
      "モンテディオ山形": "山形", "山形": "山形",
      "栃木シティ": "栃木シティ", "栃木C": "栃木シティ",
      "栃木SC": "栃木SC",
      "ヴァンラーレ八戸": "八戸", "八戸": "八戸",
      "ヴァンフォーレ甲府": "甲府", "甲府": "甲府",
      "北海道コンサドーレ札幌": "札幌", "札幌": "札幌",
      "いわきFC": "いわき", "いわき": "いわき",
      "RB大宮アルディージャ": "大宮", "大宮アルディージャ": "大宮", "大宮": "大宮",
      "藤枝MYFC": "藤枝", "藤枝": "藤枝",
      "FC岐阜": "岐阜", "岐阜": "岐阜",
      "松本山雅FC": "松本", "松本": "松本",
      "ジュビロ磐田": "磐田", "磐田": "磐田",
      "福島ユナイテッドFC": "福島", "福島ユナイテッド": "福島", "福島": "福島",
      "AC長野パルセイロ": "長野", "長野": "長野",
      "FC東京": "FC東京",
      "東京ヴェルディ": "東京V", "東京V": "東京V"
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

    const LOCAL_EMBLEM_BY_SLUG = {
      niigata: "アルビレックス新潟.png", kumamoto: "ロアッソ熊本.png", imabari: "FC今治.png", tosu: "サガン鳥栖.png",
      kochi: "高知ユナイテッドSC.png", ehime: "愛媛FC.png", kyoto: "京都サンガF.C..png", yamaguchi: "レノファ山口FC.png",
      miyazaki: "テゲバジャーロ宮崎.png", tottori: "ガイナーレ鳥取.png", kagoshima: "鹿児島ユナイテッドFC.png",
      ryukyu: "FC琉球.png", shiga: "レイラック滋賀.png", oita: "大分トリニータ.png", kitakyushu: "ギラヴァンツ北九州.png",
      kanazawa: "ツエーゲン金沢.png", sanuki: "カマタマーレ讃岐.png", tokushima: "徳島ヴォルティス.png",
      toyama: "カターレ富山.png", nara: "奈良クラブ.png", iwaki: "いわきFC.png", gifu: "FC岐阜.png",
      sapporo: "北海道コンサドーレ札幌.png", matsumoto: "松本山雅FC.png", nagano: "AC長野パルセイロ.png",
      iwata: "ジュビロ磐田.png", fukushima: "福島ユナイテッド.png", kofu: "ヴァンフォーレ甲府.png",
      shonan: "湘南ベルマーレ.png", akita: "ブラウブリッツ秋田.png", yamagata: "モンテディオ山形.png",
      yokohamafc: "横浜FC.png", yokohamafm: "横浜F・マリノス.png", sendai: "ベガルタ仙台.png",
      hachinohe: "ヴァンラーレ八戸.png", morioka: "いわてグルージャ盛岡.png", iwate: "いわてグルージャ盛岡.png",
      gunma: "ザスパ群馬.png", kusatsu: "ザスパ群馬.png", mito: "水戸ホーリーホック.png", tochigi: "栃木SC.png",
      omiya: "大宮アルディージャ.png", chiba: "ジェフユナイテッド千葉.png", sagamihara: "SC相模原.png",
      shimizu: "清水エスパルス.png", okayama: "ファジアーノ岡山.png", hiroshima: "サンフレッチェ広島.png",
      kobe: "ヴィッセル神戸.png", vissel: "ヴィッセル神戸.png", gosaka: "ガンバ大阪.png", "g-osaka": "ガンバ大阪.png",
      cosaka: "セレッソ大阪.png", "c-osaka": "セレッソ大阪.png", urawa: "浦和レッズ.png",
      kashima: "鹿島アントラーズ.png", kashiwa: "柏レイソル.png", ftokyo: "FC東京.png", tokyo: "FC東京.png",
      tokyov: "東京ヴェルディ.png", machida: "FC町田ゼルビア.png", fosaka: "FC大阪.png", "f-osaka": "FC大阪.png",
      fujieda: "藤枝MYFC.png", nagoya: "名古屋グランパス.png", nagasaki: "V・ファーレン長崎.png",
      fukuoka: "アビスパ福岡.png", ysyokohama: "Y.S.C.C.横浜.png", numazu: "アスルクラロ沼津.png"
    };

    function localizeEmblemUrl(url) {
      if (!url) return "";
      const value = String(url);
      if (value.startsWith("./data/assets/emblems/")) return value;
      if (value.startsWith("data/assets/emblems/")) return `./${value}`;
      if (value.startsWith("./emblems/")) return value.replace("./emblems/", "./data/assets/emblems/");
      if (value.startsWith("emblems/")) return `./data/assets/${value}`;
      if (value.startsWith("/emblems/")) return `./data/assets${value}`;
      if (value.includes("/emblem/2026/shiga.svg")) return "./data/assets/emblems/レイラック滋賀.png";
      const m = value.match(/img_club_([^.\/]+)\.png/);
      if (m && LOCAL_EMBLEM_BY_SLUG[m[1]]) return `./data/assets/emblems/${LOCAL_EMBLEM_BY_SLUG[m[1]]}`;
      return value;
    }

    function getTeamKwFromEmblem(url) {
      if (!url) return null;
      const m = url.match(/img_club_([^.]+)\.png/);
      if (m && EMBLEM_MAP[m[1]]) return EMBLEM_MAP[m[1]];
      return null;
    }

    function escapeHtml(value) {
      return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function getOwnClubEnglish(club) {
      if (club === "niigata") return "ALBIREX NIIGATA";
      if (club === "kumamoto") return "ROASSO KUMAMOTO";
      return String(club || "").normalize("NFKC").toUpperCase();
    }

    function getClubEnglishName(name) {
      const normalized = String(name || "").normalize("NFKC").trim();
      return CLUB_ENGLISH_NAMES[normalized] || CLUB_ENGLISH_NAMES[name] || normalized.toUpperCase();
    }

    function getMatchCopyClubNames(match) {
      const own = getOwnClubEnglish(match.club);
      const opponent = getClubEnglishName(match.opponent);
      return getMatchIsHome(match) ? [own, opponent] : [opponent, own];
    }

    function showCopyToast(message) {
      let toast = document.getElementById("copy-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "copy-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(showCopyToast.timer);
      showCopyToast.timer = setTimeout(() => toast.classList.remove("show"), 1400);
    }

    async function copyText(text) {
      let clipboardError = null;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch (error) {
          clipboardError = error;
        }
      }
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      area.style.top = "0";
      document.body.appendChild(area);
      area.focus({ preventScroll: true });
      area.select();
      area.setSelectionRange(0, area.value.length);
      const copied = document.execCommand && document.execCommand("copy");
      area.remove();
      if (!copied) throw clipboardError || new Error("copy command failed");
    }

    function bindClubNameLongPress(nameEl, card, match) {
      if (!nameEl) return;
      let timer = null;
      let startX = 0;
      let startY = 0;
      let armed = false;
      let copying = false;
      let copied = false;
      const clear = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };
      const reset = () => {
        clear();
        armed = false;
        nameEl.classList.remove("longpress-ready");
      };
      const runCopy = async () => {
        if (copying || copied) return;
        copying = true;
        card.dataset.suppressClick = "true";
        const text = getMatchCopyClubNames(match).join("\n");
        try {
          await copyText(text);
          copied = true;
          showCopyToast("クラブ名をコピーしました");
        } catch (error) {
          console.error(error);
          showCopyToast("コピーに失敗しました");
        } finally {
          copying = false;
          nameEl.classList.remove("longpress-ready");
        }
      };
      const start = (event) => {
        if (event.button && event.button !== 0) return;
        startX = event.clientX || 0;
        startY = event.clientY || 0;
        armed = false;
        copying = false;
        copied = false;
        clear();
        timer = setTimeout(() => {
          timer = null;
          armed = true;
          card.dataset.suppressClick = "true";
          nameEl.classList.add("longpress-ready");
          if (navigator.vibrate) navigator.vibrate(12);
        }, 620);
      };
      const move = (event) => {
        const dx = Math.abs((event.clientX || 0) - startX);
        const dy = Math.abs((event.clientY || 0) - startY);
        if (!armed && (dx > 12 || dy > 12)) reset();
      };
      const end = (event) => {
        clear();
        if (!armed) return;
        event.preventDefault();
        runCopy();
        armed = false;
      };
      nameEl.addEventListener("pointerdown", start);
      nameEl.addEventListener("pointermove", move);
      nameEl.addEventListener("pointerup", end);
      nameEl.addEventListener("pointercancel", reset);
      nameEl.addEventListener("pointerleave", () => { if (!armed) reset(); });
      nameEl.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (armed) runCopy();
      });
    }

    let clubEmblemMap = {};

    async function loadClubEmblemMap() {
      const fromSchedule = {};
      scheduleData.forEach(m => {
        if (/^202[456]-/.test(m.date) && m.opponent && m.emblem && !fromSchedule[m.opponent]) {
          fromSchedule[m.opponent] = m.emblem;
        }
      });

      try {
        const res = await fetch("./data/clubs/club_emblems.json?v=20260601data1");
        if (res.ok) {
          const json = await res.json();
          clubEmblemMap = { ...fromSchedule, ...json };
          Object.keys(clubEmblemMap).forEach(key => {
            clubEmblemMap[key] = localizeEmblemUrl(clubEmblemMap[key]);
          });
          return;
        }
      } catch (e) {
        console.warn("Club emblem map load failed", e);
      }
      clubEmblemMap = fromSchedule;
      Object.keys(clubEmblemMap).forEach(key => {
        clubEmblemMap[key] = localizeEmblemUrl(clubEmblemMap[key]);
      });
    }

    const clubEmblemMapReady = loadClubEmblemMap();

    function getClubEmblemFromMap(teamName) {
      if (!teamName) return "";
      if (clubEmblemMap[teamName]) return clubEmblemMap[teamName];
      const found = Object.entries(clubEmblemMap).find(([name]) => robustTeamMatch(name, teamName));
      return found ? found[1] : "";
    }

    function getEmblemUrlForTeam(teamName) {
      if (!teamName) return "";
      const mapped = getClubEmblemFromMap(teamName);
      if (mapped) return localizeEmblemUrl(mapped);
      const direct = scheduleData.find(m => robustTeamMatch(m.opponent, teamName) || robustTeamMatch(getTeamKwFromEmblem(m.emblem), teamName));
      if (direct && direct.emblem) return localizeEmblemUrl(direct.emblem);
      const reversed = Object.entries(EMBLEM_MAP).find(([, kw]) => robustTeamMatch(kw, teamName));
      return reversed ? localizeEmblemUrl(`https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png`) : "";
    }

    function resolveEmblemUrl(teamName, fallback = "") {
      return getEmblemUrlForTeam(teamName) || localizeEmblemUrl(fallback) || "";
    }

    function cleanResultTeamName(value) {
      return normalizeName(value).replace(/の試合詳細|の結果/g, "").trim();
    }

    function compactTeamKey(value) {
      return cleanResultTeamName(value).replace(/[・\.\s_\-]/g, "");
    }

    function canonicalTeamName(value) {
      const key = compactTeamKey(value);
      if (!key) return "";

      for (const [alias, canonical] of Object.entries(TEAM_ALIAS_OVERRIDES)) {
        if (compactTeamKey(alias) === key) return canonical;
      }

      for (const [alias, canonical] of Object.entries(TEAM_ALIAS_OVERRIDES)) {
        const aliasKey = compactTeamKey(alias);
        if (aliasKey.length >= 4 && (key.includes(aliasKey) || aliasKey.includes(key))) {
          return canonical;
        }
      }

      for (const [alias, canonical] of Object.entries(GLOBAL_TEAM_MAP)) {
        if (compactTeamKey(alias) === key) return canonical;
      }

      return key;
    }

    function robustTeamMatch(name1, name2) {
      if (!name1 || !name2) return false;
      const n1 = compactTeamKey(name1);
      const n2 = compactTeamKey(name2);
      const c1 = canonicalTeamName(name1);
      const c2 = canonicalTeamName(name2);
      
      if (c1 && c1 === c2) return true;
      if (n1 === n2) return true;

      // Known ambiguous location-only names must not be matched by substring.
      const ambiguous = new Set(["大阪", "東京", "栃木", "横浜"]);
      if (ambiguous.has(c1) || ambiguous.has(c2) || ambiguous.has(n1) || ambiguous.has(n2)) return false;

      return n1.length >= 4 && n2.length >= 4 && (n1.includes(n2) || n2.includes(n1));
    }

    function isHomeMatch(club, venue) {
      if (!venue) return false;
      const v = normalizeName(venue);
      if (club === "niigata") return v.includes("デンカビッグスワン");
      if (club === "kumamoto") return v.includes("えがお健康");
      return false;
    }

    function getMatchIsHome(match) {
      if (match && match.home_away === "H") return true;
      if (match && match.home_away === "A") return false;
      return isHomeMatch(match && match.club, match && match.venue);
    }

    const HISTORY_START_YEAR = 1999;
    const HISTORY_END_YEAR = Math.max(2026, new Date().getFullYear());
    const loadedHistoryYears = new Set();
    const loadingHistoryYears = new Map();

    function getHistoryYears() {
      const years = [];
      for (let y = HISTORY_START_YEAR; y <= HISTORY_END_YEAR; y++) years.push(y);
      return years;
    }

    function toIsoDate(dateText) {
      return getFirstIsoDateText(dateText) || String(dateText || "");
    }

    function getHistoryMatchweek(section) {
      const text = String(section || "");
      const m = text.match(/第\d+節|第\d+回戦/);
      return m ? m[0] : (text || "EX");
    }

    function getCompetitionShort(competition) {
      const text = String(competition || "");
      if (text.includes("J1")) return "J1";
      if (text.includes("J2") || text.includes("ディビジョン2")) return "J2";
      if (text.includes("J3")) return "J3";
      if (text.includes("天皇杯")) return "EC";
      if (text.includes("ルヴァン") || text.includes("Ｊリーグカップ")) return "LC";
      return text;
    }

    function normalizeMinute(value) {
      return String(value || "").replace(/'$/, "");
    }

    function mapHistoryMembers(members) {
      return Array.isArray(members) ? members.map(member => ({
        position: member.position || "",
        number: member.number || "",
        name: member.name || ""
      })) : [];
    }

    function mapHistoryGoals(goals) {
      return Array.isArray(goals) ? goals.map(goal => ({
        minute: normalizeMinute(goal.time),
        scorer: goal.name || ""
      })) : [];
    }

    function mapHistoryWarnings(cards) {
      return Array.isArray(cards) ? cards
        .filter(card => String(card.type || "").includes("警告") || String(card.type || "").includes("退場"))
        .map(card => ({
          minute: normalizeMinute(card.time),
          player: card.name || "",
          card: String(card.type || "").includes("退場") ? "red" : "yellow",
          label: card.type || "警告"
        })) : [];
    }

    function splitOfficialNames(value) {
      if (Array.isArray(value)) return value.filter(Boolean).map(name => String(name).trim()).filter(Boolean);
      return String(value || "")
        .split(/[、,／/]/)
        .map(name => name.trim())
        .filter(Boolean);
    }

    function mapHistorySubs(subs) {
      if (!Array.isArray(subs)) return [];
      const mapped = [];
      subs.forEach((row, index) => {
        if (row.in_out !== "▽") return;
        const nextIn = subs.slice(index + 1).find(next => next.in_out === "▲" || next.in_out === "▽");
        if (!nextIn || nextIn.in_out !== "▲") return;
        mapped.push({ minute: normalizeMinute(row.time), out: row.name || "", in: nextIn.name || "" });
      });
      return mapped;
    }

    function historyItemToMatch(item, club, ownName) {
      const isHome = item.home_team === ownName;
      const opponent = isHome ? item.away_team : item.home_team;
      const ownScore = Number(isHome ? item.home_score : item.away_score);
      const opponentScore = Number(isHome ? item.away_score : item.home_score);
      const pkHomeScore = parsePkScore(item.pk_home_score);
      const pkAwayScore = parsePkScore(item.pk_away_score);
      const hasPkResult = pkHomeScore !== null && pkAwayScore !== null;
      const ownPkScore = hasPkResult ? (isHome ? pkHomeScore : pkAwayScore) : null;
      const opponentPkScore = hasPkResult ? (isHome ? pkAwayScore : pkHomeScore) : null;
      const resultMark = hasPkResult
        ? (ownPkScore > opponentPkScore ? "○" : ownPkScore < opponentPkScore ? "●" : "△")
        : (ownScore > opponentScore ? "○" : ownScore < opponentScore ? "●" : "△");
      const pkText = hasPkResult ? `${pkHomeScore} PK ${pkAwayScore}` : "";
      const date = toIsoDate(item.date);
      const d = parseDate(date);
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const ownDetails = isHome ? item.home_details : item.away_details;
      const opponentDetails = isHome ? item.away_details : item.home_details;
      const ownGoals = isHome ? item.home_goals : item.away_goals;
      const opponentGoals = isHome ? item.away_goals : item.home_goals;
      const comp = getCompetitionShort(item.competition);
      const referees = item.referees || {};
      const assistantReferees = splitOfficialNames(referees["副審"] || referees.assistant_referees);
      const varAvar = splitOfficialNames(referees["VAR／AVAR"] || referees["VAR/AVAR"] || referees.var_avar);

      return {
        club,
        matchweek: getHistoryMatchweek(item.section),
        date,
        day: days[d.getDay()],
        time: item.kickoff || "",
        opponent,
        venue: item.stadium || "",
        emblem: resolveEmblemUrl(opponent, ""),
        details: [comp, isHome ? "H" : "A", resultMark, `${ownScore}-${opponentScore}`].filter(Boolean).join(" "),
        home_away: isHome ? "H" : "A",
        result_mark: resultMark,
        score: `${ownScore}-${opponentScore}`,
        pk: pkText,
        tournament: item.competition || "",
        stage: item.section || "",
        weather: item.weather || "",
        temperature: item.temperature || "",
        humidity: String(item.humidity || "").replace(/%$/, ""),
        attendance: item.attendance || "",
        manager: ownDetails && ownDetails.manager || "",
        j_official_url: item.url || "",
        match_card_id: item.match_card_id || "",
        home: item.home_team || "",
        away: item.away_team || "",
        home_score: item.home_score || "",
        away_score: item.away_score || "",
        pk_home_score: item.pk_home_score || "",
        pk_away_score: item.pk_away_score || "",
        referees,
        referee: referees["主審"] || referees.referee || "",
        assistant_referees: assistantReferees,
        fourth_official: referees["第4の審判員"] || referees.fourth_official || "",
        var_referee: referees.VAR || varAvar[0] || "",
        avar_referee: referees.AVAR || varAvar[1] || "",
        home_manager: item.home_details && item.home_details.manager || "",
        away_manager: item.away_details && item.away_details.manager || "",
        home_starting_members: mapHistoryMembers(item.home_details && item.home_details.starting),
        home_bench_members: mapHistoryMembers(item.home_details && item.home_details.substitutes),
        away_starting_members: mapHistoryMembers(item.away_details && item.away_details.starting),
        away_bench_members: mapHistoryMembers(item.away_details && item.away_details.substitutes),
        home_substitutions: mapHistorySubs(item.home_details && item.home_details.substitutions),
        away_substitutions: mapHistorySubs(item.away_details && item.away_details.substitutions),
        home_cards: mapHistoryWarnings(item.home_details && item.home_details.cards),
        away_cards: mapHistoryWarnings(item.away_details && item.away_details.cards),
        home_goals: mapHistoryGoals(item.home_goals),
        away_goals: mapHistoryGoals(item.away_goals),
        opponent_manager: opponentDetails && opponentDetails.manager || "",
        opponent_starting_members: mapHistoryMembers(opponentDetails && opponentDetails.starting),
        opponent_bench_members: mapHistoryMembers(opponentDetails && opponentDetails.substitutes),
        opponent_substitutions: mapHistorySubs(opponentDetails && opponentDetails.substitutions),
        opponent_cards: mapHistoryWarnings(opponentDetails && opponentDetails.cards),
        goals: mapHistoryGoals(ownGoals),
        opponent_goals: mapHistoryGoals(opponentGoals),
        starting_members: mapHistoryMembers(ownDetails && ownDetails.starting),
        bench_members: mapHistoryMembers(ownDetails && ownDetails.substitutes),
        substitutions: mapHistorySubs(ownDetails && ownDetails.substitutions),
        warnings: mapHistoryWarnings(ownDetails && ownDetails.cards)
      };
    }

    async function fetchHistoryFile(path) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        const options = controller ? { signal: controller.signal } : undefined;
        const res = await fetch(`${path}?v=20260527source`, options);
        if (!res.ok) return [];
        return normalizeAsciiFieldsInPlace(await res.json());
      } catch (error) {
        console.warn(`history fetch failed: ${path}`, error);
        return [];
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    async function ensureHistoryYearLoaded(year) {
      year = Number(year);
      if (!year || year > HISTORY_END_YEAR || year < HISTORY_START_YEAR || loadedHistoryYears.has(year)) return;
      if (loadingHistoryYears.has(year)) return loadingHistoryYears.get(year);

      const promise = (async () => {
        const files = [`./data/history/niigata/${year}.json`, `./data/history/kumamoto/${year}.json`];
        const payloads = await Promise.all(files.map(fetchHistoryFile));
        const seen = new Set(scheduleData.map(m => getScheduleResultKey(m.date, m.club, m.opponent)));
        const resultSeen = new Set(getResultArray(officialResults).map(r => getResultKey(r)));
        const ownTeams = [
          ["niigata", "アルビレックス新潟"],
          ["kumamoto", "ロアッソ熊本"]
        ];

        payloads.flat().forEach(item => {
          if (!item || !item.date || item.home_score === "" || item.away_score === "") return;
          ownTeams.forEach(([club, ownName]) => {
            if (item.home_team !== ownName && item.away_team !== ownName) return;
            const match = historyItemToMatch(item, club, ownName);
            const key = getScheduleResultKey(match.date, match.club, match.opponent);
            if (!seen.has(key)) {
              scheduleData.push(match);
              seen.add(key);
            } else {
              const existing = scheduleData.find(m => getScheduleResultKey(m.date, m.club, m.opponent) === key);
              if (existing) {
                const keep = {
                  matchweek: existing.matchweek || match.matchweek,
                  day: existing.day || match.day,
                  time: existing.time || match.time,
                  opponent: existing.opponent || match.opponent,
                  emblem: existing.emblem || match.emblem,
                  venue: existing.venue || match.venue
                };
                Object.assign(existing, match, keep);
              }
            }
            const resultKey = getResultKey(match);
            if (!resultSeen.has(resultKey)) {
              officialResults.push(match);
              resultSeen.add(resultKey);
            }
          });
        });
        rebuildOfficialResultIndex();
        syncResultsToLocalStorage(officialResults);
        loadedHistoryYears.add(year);
      })();

      loadingHistoryYears.set(year, promise);
      try {
        await promise;
      } finally {
        loadingHistoryYears.delete(year);
      }
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
      const now = new Date();
      const cutoffStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const sorted = [...scheduleData].sort((a, b) => parseDate(a.date) - parseDate(b.date));
      const todayNiigataHome = sorted.find(m => m.date === cutoffStr && m.club === "niigata" && getMatchIsHome(m));
      const showNGate = Boolean(todayNiigataHome);

      if (showNGate) {
        container.innerHTML = `<a href="https://www.albirex.co.jp/ticket/ngate/form/" target="_blank" class="btn-ngate-header">Nゲート抽選</a>`;
      } else {
        container.innerHTML = "";
      }
    }

  // --- Albirex Player Analysis ---
  function getPlayerAnalysisElements() {
    return {
      yearSelect: document.getElementById("pa-year-select"),
      mainTimeControls: document.getElementById("pa-main-time-controls"),
      mainPeriodToggle: document.getElementById("pa-main-period-toggle"),
      mainPeriodFields: document.getElementById("pa-main-period-fields"),
      mainPeriodStart: document.getElementById("pa-main-period-start"),
      mainPeriodEnd: document.getElementById("pa-main-period-end"),
      clubSelect: document.getElementById("pa-club-select"),
      clubName: document.getElementById("pa-title"),
      clubMenu: document.getElementById("pa-club-menu"),
      status: document.getElementById("pa-status"),
      summary: document.getElementById("pa-summary-cards"),
      rankings: document.getElementById("pa-rankings"),
      scopeButtons: document.querySelectorAll(".pa-scope-btn"),
      competitionDetails: document.getElementById("pa-competition-details"),
      competitionOptions: document.getElementById("pa-competition-options"),
      search: document.getElementById("pa-player-search"),
      filterPanel: document.getElementById("pa-filter-panel"),
      filterFab: document.getElementById("pa-filter-fab"),
      filterBackdrop: document.getElementById("pa-filter-backdrop"),
      filterClose: document.getElementById("pa-filter-close"),
      positionOptions: document.getElementById("pa-position-options"),
      positionModeButtons: document.querySelectorAll(".pa-position-mode-btn"),
      compactFilterType: document.getElementById("pa-filter-type-select"),
      compactFilterValue: document.getElementById("pa-filter-value-input"),
      compactFilterMonth: document.getElementById("pa-filter-month-select"),
      detailFilterModeButtons: document.querySelectorAll(".pa-detail-filter-mode-btn"),
      advancedFilterRows: document.getElementById("pa-advanced-filter-rows"),
      addFilterCondition: document.getElementById("pa-add-filter-condition"),
      numberFilter: document.getElementById("pa-number-filter"),
      playedMin: document.getElementById("pa-played-min"),
      playedMax: document.getElementById("pa-played-max"),
      startsMin: document.getElementById("pa-starts-min"),
      goalsMin: document.getElementById("pa-goals-min"),
      playedRateMin: document.getElementById("pa-played-rate-min"),
      scoredRateMin: document.getElementById("pa-scored-rate-min"),
      scoredPpmMin: document.getElementById("pa-scored-ppm-min"),
      monthFilter: document.getElementById("pa-month-filter"),
      monthGoalsMin: document.getElementById("pa-month-goals-min"),
      monthPlayedRateMin: document.getElementById("pa-month-played-rate-min"),
      yellowMin: document.getElementById("pa-yellow-min"),
      redMin: document.getElementById("pa-red-min"),
      seasonsMin: document.getElementById("pa-seasons-min"),
      seasonsMax: document.getElementById("pa-seasons-max"),
      heightMin: document.getElementById("pa-height-min"),
      heightMax: document.getElementById("pa-height-max"),
      weightMin: document.getElementById("pa-weight-min"),
      weightMax: document.getElementById("pa-weight-max"),
      birthYearMin: document.getElementById("pa-birth-year-min"),
      birthYearMax: document.getElementById("pa-birth-year-max"),
      scorersOnly: document.getElementById("pa-scorers-only"),
      playedOnly: document.getElementById("pa-played-only"),
      katakanaOnly: document.getElementById("pa-katakana-only"),
      filterReset: document.getElementById("pa-filter-reset"),
      tableHead: document.getElementById("pa-table-head"),
      tableBody: document.getElementById("pa-table-body"),
      tableCount: document.getElementById("pa-table-count"),
      sortSelect: document.getElementById("pa-sort-select"),
      sortKeySelect: document.getElementById("pa-sort-key-select"),
      sortDirectionSelect: document.getElementById("pa-sort-direction-select"),
      sortSummary: document.getElementById("pa-sort-summary"),
      listDetailToggle: document.getElementById("pa-list-detail-toggle"),
      screens: document.querySelectorAll(".pa-screen[data-pa-screen]"),
      bottomTabs: document.getElementById("pa-bottom-tabs"),
      bottomTabButtons: document.querySelectorAll(".pa-bottom-tab[data-pa-screen-target]"),
      comparePanel: document.getElementById("pa-compare-panel"),
      compareYearSelects: document.querySelectorAll("[data-pa-compare-year-index]"),
      compareControls: document.getElementById("pa-compare-controls"),
      compareResult: document.getElementById("pa-compare-result"),
      opponentPanel: document.getElementById("pa-opponent-panel"),
      opponentYearSelect: document.getElementById("pa-opponent-selection-year"),
      opponentSearch: document.getElementById("pa-opponent-club-search"),
      opponentDatalist: document.getElementById("pa-opponent-club-suggestions"),
      opponentSelect: document.getElementById("pa-opponent-club-select"),
      opponentResult: document.getElementById("pa-opponent-result"),
      playerOpponentPanel: document.getElementById("pa-player-opponent-panel"),
      playerOpponentYearSelect: document.getElementById("pa-player-opponent-selection-year"),
      playerOpponentSearch: document.getElementById("pa-player-opponent-search"),
      playerOpponentDatalist: document.getElementById("pa-player-opponent-suggestions"),
      playerOpponentSelect: document.getElementById("pa-player-opponent-select"),
      playerOpponentResult: document.getElementById("pa-player-opponent-result"),
      scrollTopFab: document.getElementById("pa-scroll-top-fab"),
      mobileList: document.getElementById("pa-mobile-list"),
      detail: document.getElementById("pa-detail-card")
    };
  }

  function setPlayerAnalysisFilterPanel(open, options = {}) {
    const els = getPlayerAnalysisElements();
    if (!els.filterPanel) return;
    const active = Boolean(open);
    els.filterPanel.classList.toggle("active", active);
    if (els.filterFab) els.filterFab.setAttribute("aria-expanded", active ? "true" : "false");
    if (els.filterBackdrop) {
      els.filterBackdrop.hidden = !active;
      els.filterBackdrop.classList.toggle("active", active);
    }
    document.body.classList.toggle("pa-filter-open", active);
    if (active) {
      addAppHistoryEntry("pa-filter", () => setPlayerAnalysisFilterPanel(true, { history: false }), options);
    } else if (options.history !== false && getActiveAppHistoryEntry()?.kind === "pa-filter") {
      window.history.back();
    }
  }

  function updatePlayerAnalysisScrollTopButton() {
    const { scrollTopFab } = getPlayerAnalysisElements();
    if (!scrollTopFab) return;
    const visible = currentMode === "player-analysis" && playerAnalysisView && playerAnalysisView.scrollTop > 80;
    scrollTopFab.hidden = !visible;
    scrollTopFab.classList.toggle("visible", visible);
  }

  function scrollPlayerAnalysisToTop(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (playerAnalysisView) {
      try {
        playerAnalysisView.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        playerAnalysisView.scrollTop = 0;
      }
      playerAnalysisView.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    requestAnimationFrame(updatePlayerAnalysisScrollTopButton);
    setTimeout(updatePlayerAnalysisScrollTopButton, 320);
  }

  function hasPlayerValue(value) {
    return value !== null && value !== undefined && value !== "";
  }

  function toPlayerNumber(value) {
    if (!hasPlayerValue(value)) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function formatPlayerList(value) {
    if (Array.isArray(value)) {
      const items = value.map(item => String(item || "").trim()).filter(Boolean);
      return items.length ? items.join(", ") : "-";
    }
    const text = String(value || "").trim();
    return text || "-";
  }

  function normalizePlayerNumberValues(value) {
    const raw = Array.isArray(value)
      ? value
      : String(value || "").split(/[、,\/]/);
    return raw.map(number => String(number || "").trim()).filter(Boolean);
  }

  function formatPlayerNumber(value) {
    const n = toPlayerNumber(value);
    return n === null ? "-" : String(n);
  }

  function formatPlayerRate(value) {
    const n = toPlayerNumber(value);
    return n === null ? "-" : `${n.toFixed(1)}%`;
  }

  function formatPlayerDecimal(value) {
    const n = toPlayerNumber(value);
    return n === null ? "-" : n.toFixed(2).replace(/\.?0+$/, "");
  }

  function formatPlayerSignedNumber(value) {
    const n = toPlayerNumber(value);
    if (n === null) return "-";
    return n > 0 ? `+${n}` : String(n);
  }

  function formatPlayerRecord(wins, draws, losses) {
    if (!hasPlayerValue(wins) && !hasPlayerValue(draws) && !hasPlayerValue(losses)) return "-";
    return `${formatPlayerNumber(wins)}勝 ${formatPlayerNumber(draws)}分 ${formatPlayerNumber(losses)}敗`;
  }

  function getPlayerAnalysisClub(club = playerAnalysisState.selectedClub) {
    return PLAYER_ANALYSIS_CLUBS[club] ? club : "niigata";
  }

  function getPlayerAnalysisClubInfo(club = playerAnalysisState.selectedClub) {
    return PLAYER_ANALYSIS_CLUBS[getPlayerAnalysisClub(club)] || PLAYER_ANALYSIS_CLUBS.niigata;
  }

  function normalizePlayerImageName(name) {
    return String(name || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getPlayerImageAliasNames(baseName, player = null) {
    const compact = normalizePlayerIdentityText(baseName);
    const groupKey = player ? getPlayerGroupKey(player) : "";
    const aliases = [];
    if (compact === "ディビッドソン純マーカス") {
      aliases.push("ディビッドソン 純 マーカス");
    }
    if (compact === "ブーダ") {
      aliases.push("アブデルラフマン・ブーダ・サイディ", "アブデルラフマン ブーダ サイディ");
    }
    if (compact === "ソンジュフン" || compact === "宋株熏") {
      aliases.push("宋 株熏", "ソン ジュフン");
    }
    if (groupKey === "アンデルソン-2011") {
      aliases.push("アンデルソン-2011");
    }
    if (groupKey === "シルビーニョ-2019-2020") {
      aliases.push("シルビーニョ-2019-2020");
    }
    return aliases;
  }

  function getPlayerImageNameVariants(name) {
    const baseName = normalizePlayerImageName(name);
    if (!baseName) return [];
    const variants = [
      baseName,
      baseName.replace(/[・･]/g, " ").replace(/\s+/g, " ").trim(),
      baseName.replace(/[・･]/g, "・").replace(/\s+/g, "・").replace(/・+/g, "・").trim(),
      baseName.replace(/\s*[・･]\s*/g, "・").replace(/・+/g, "・").trim(),
      baseName.replace(/\s*[・･]\s*/g, " ").replace(/\s+/g, " ").trim(),
      baseName.replace(/[\s・･]+/g, "")
    ];
    return Array.from(new Set(variants.filter(Boolean)));
  }

  function shouldUseGenericPlayerImageName(name, player = null) {
    if (!player) return true;
    const compact = normalizePlayerIdentityText(name);
    const groupKey = getPlayerGroupKey(player);
    if (compact === "アンデルソン" && groupKey !== "アンデルソン-2003-2004") return false;
    if (compact === "シルビーニョ" && groupKey !== "シルビーニョ-2006-2007") return false;
    return true;
  }

  function getPlayerImageDirectories(club = playerAnalysisState.selectedClub) {
    const key = getPlayerAnalysisClub(club);
    return [
      `./data/assets/images/player_${key}`,
      `./data/assets/player_${key}`
    ];
  }

  function getPlayerImageSources(playerName, club = playerAnalysisState.selectedClub, player = null) {
    const aliasNames = getPlayerImageAliasNames(playerName, player);
    const baseNames = shouldUseGenericPlayerImageName(playerName, player) ? [playerName] : [];
    const names = [...aliasNames, ...baseNames].flatMap(getPlayerImageNameVariants);
    if (!names.length) return [];
    const directories = getPlayerImageDirectories(club);
    return Array.from(new Set(names)).flatMap(name => {
      const filename = `${encodeURIComponent(name)}.jpg`;
      return directories.map(dir => `${dir}/${filename}`);
    });
  }

  const PLAYER_ENGLISH_NAME_OVERRIDES = {
    "アウグスト": "AUGUSTO",
    "アランミネイロ": "ALAN MINEIRO",
    "アブデルラフマンブーダサイディ": "ABDULRAHMAN BUDA SAIDI",
    "ブーダ": "ABDULRAHMAN BUDA SAIDI",
    "アレクサンドレゲデス": "ALEXANDRE GUEDES",
    "アレッサンドロ": "ALESSANDRO",
    "アンデルソン": "ANDERSON",
    "アンデルソンリマ": "ANDERSON LIMA",
    "アンドラジーニャ": "ANDRADINHA",
    "イッペイシノヅカ": "IPPEI SHINOZUKA",
    "イムジンウ": "IM JIN-WOO",
    "ウーゴ": "HUGO",
    "エヴェルトンサントス": "EVERTON SANTOS",
    "エジミウソン": "EDMILSON",
    "オゼアス": "OSEAS",
    "カウエ": "CAUE",
    "カリウ": "CARIU",
    "カレンロバート": "ROBERT CULLEN",
    "キムジョンソク": "KIM JONG-SEOK",
    "キムテヨン": "KIM TAE-YEON",
    "キムビョンヨン": "KIM BYEONG-YEON",
    "クォンソックン": "KWON SEOK-GEUN",
    "クォンハンジン": "KWON HAN-JIN",
    "グスタボ": "GUSTAVO",
    "グスタボネスカウ": "GUSTAVO NESCAU",
    "コルテース": "CORTEZ",
    "ゴンサロゴンザレス": "GONZALO GONZALEZ",
    "サウロ": "SAULO",
    "サムエルサントス": "SAMUEL SANTOS",
    "ジウトン": "GILTON",
    "ジェイウソン": "JAILSON",
    "ジャンパトリック": "JEAN PATRICK",
    "ジュニオール": "JUNIOR",
    "シュミットダニエル": "DANIEL SCHMIDT",
    "ジョンパウロ": "JOAO PAULO",
    "シルビーニョ": "SILVINHO",
    "セルジオ": "SERGIO",
    "ソンイニョン": "SONG IN-YOUNG",
    "ターレス": "THALES",
    "ダヴィ": "DAVI",
    "チアゴガリャルド": "THIAGO GALHARDO",
    "チャジホ": "CHA JI-HO",
    "チョソンジン": "CHO SUNG-JIN",
    "チョヨンチョル": "CHO YOUNG-CHEOL",
    "ドゥグラス": "DOUGLAS",
    "ドウグラスタンキ": "DOUGLAS TANQUE",
    "トーマスデン": "THOMAS DENG",
    "ナシメント": "NASCIMENTO",
    "ネット": "NETO",
    "バウマン": "BAUMANN",
    "パウロン": "PAULAO",
    "ファグネル": "FAGNER",
    "ファビーニョ": "FABINHO",
    "ファビオ": "FABIO",
    "フランシス": "FRANCIS",
    "ブルーノカスタニェイラ": "BRUNO CASTANHEIRA",
    "ブルーノメネゲウ": "BRUNO MENEGHEL",
    "ブルーノロペス": "BRUNO LOPES",
    "ベジョンミン": "BAE JEONG-MIN",
    "ヘイス": "REIS",
    "ベット": "BETO",
    "ペドロジュニオール": "PEDRO JUNIOR",
    "ペドロマンジー": "PEDRO MANZI",
    "ホージェルガウーショ": "ROGER GAUCHO",
    "ホニ": "RONI",
    "ホベルト": "ROBERTO",
    "マイケルジェームズ": "MICHAEL JAMES",
    "舞行龍ジェームズ": "MICHAEL JAMES",
    "マウロ": "MAURO",
    "マルキーニョ": "MARQUINHOS",
    "マルクス": "MARCUS",
    "マルコ": "MARCO",
    "マルシオリシャルデス": "MARCIO RICHARDES",
    "ミシェウ": "MICHEL",
    "モルベッキ": "MORBECK",
    "ラファエルシルバ": "RAFAEL SILVA",
    "リカルド": "RICARDO",
    "リンドマール": "LINDOMAR",
    "レオシルバ": "LEO SILVA",
    "レオナルド": "LEONARDO",
    "ロメロフランク": "FRANK ROMERO",
    "ディビッドソン純マーカス": "JUN MARQUES DAVIDSON",
    "宋株熏": "SONG JU-HUN",
    "ソンジュフン": "SONG JU-HUN",
    "シマブクカズヨシ": "KAZUYOSHI SHIMABUKU",
    "ジェイソンゲリア": "JASON GERIA",
    "マテウスモラエス": "MATHEUS MORAES",
    "ダニーロゴメス": "DANILO GOMES",
    "ミゲルシルヴェイラ": "MIGUEL SILVEIRA",
    "アレックスムラーリャ": "ALEX MURALHA",
    "笠井佳祐": "KEISUKE KASAI",
    "若月大和": "YAMATO WAKATSUKI",
    "藤原奏哉": "SOYA FUJIWARA",
    "大西悠介": "YUSUKE ONISHI",
    "白井永地": "EIJI SHIRAI",
    "舩木翔": "SHO FUNAKI",
    "奥村仁": "JIN OKUMURA",
    "落合陸": "RIKU OCHIAI",
    "佐藤海宏": "MIHIRO SATO",
    "新井泰貴": "TAIKI ARAI",
    "島村拓弥": "TAKUYA SHIMAMURA",
    "加藤徹也": "TETSUYA KATO",
    "小野裕二": "YUJI ONO",
    "早川史哉": "FUMIYA HAYAKAWA",
    "森璃太": "RITA MORI",
    "石山青空": "SORA ISHIYAMA",
    "藤原優大": "YUDAI FUJIWARA",
    "森昂大": "KODAI MORI",
    "吉満大介": "DAISUKE YOSHIMITSU",
    "大竹優心": "YUSHIN OTAKE",
    "内山翔太": "SHOTA UCHIYAMA",
    "松岡敏也": "TOSHIYA MATSUOKA",
    "星雄次": "YUJI HOSHI",
    "吉田陣平": "JINPEI YOSHIDA",
    "田代琉我": "RYUGA TASHIRO",
    "上村周平": "SHUHEI KAMIMURA",
    "半代将都": "MASATO HANDAI",
    "大本祐槻": "YUZUKI OMOTO",
    "藤井皓也": "KOYA FUJII",
    "李泰河": "TAEHA LEE",
    "青木俊輔": "SHUNSUKE AOKI",
    "松田詠太郎": "EITARO MATSUDA",
    "岩下航": "WATARU IWASHITA",
    "佐藤史騎": "FUMIKI SATO",
    "根岸恵汰": "KEITA NEGISHI",
    "鹿取勇斗": "YUTO KATORI",
    "那須健一": "KENICHI NASU",
    "小林慶太": "KEITA KOBAYASHI",
    "薬師田澪": "REI YAKUSHIDA",
    "三島頌平": "SHOHEI MISHIMA",
    "飯星明良": "AKIRA IIBOSHI",
    "石原央羅": "ORA ISHIHARA",
    "永井颯太": "SOTA NAGAI",
    "渡邉怜歩": "REO WATANABE",
    "戸田峻平": "SHUNPEI TODA",
    "佐藤優也": "YUYA SATO",
    "伊藤颯真": "SOMA ITO",
    "黒木晃平": "KOHEI KUROKI",
    "大西遼太郎": "RYOTARO ONISHI"
  };

  const PLAYER_ENGLISH_NAME_AUTO_OVERRIDES = {
  "イヨハ理ヘンリー": "OSAMU HENRY IYOHA",
  "三島康平": "KOHEI MISHIMA",
  "三戸舜介": "SHUNSUKE MITO",
  "三田光": "HIKARU MITA",
  "三門雄大": "YTA MIKADO",
  "三鬼海": "UMI SANKI",
  "上原拓郎": "TAKUROU UEHARA",
  "上村健一": "KEN'ICHI KAMIMURA",
  "上里一将": "ISSHOU UESATO",
  "上野優作": "YUUSAKU UENO",
  "中原貴之": "TAKAYUKI NAKAHARA",
  "中原輝": "TERU NAKAHARA",
  "中山悟志": "SATOSHI NAKAYAMA",
  "中山雄登": "OSU TOU NAKAYAMA",
  "中島元彦": "MOTOHIKO NAKAJIMA",
  "中村太亮": "TA AKIRA NAKAMURA",
  "中村幸聖": "SACHI HIJIRI NAKAMURA",
  "中野圭一郎": "KEIICHIROU NAKANO",
  "中野洋司": "YOUJI NAKANO",
  "丸山壮大": "SOUDAI MARUYAMA",
  "丸山嵩大": "KASA DAI MARUYAMA",
  "丸山皓己": "KOU ONORE MARUYAMA",
  "丸山良明": "YOSHIAKI MARUYAMA",
  "五十嵐新": "SHIN IGARASHI",
  "五領淳樹": "ATSUSHI KI GO RYOU",
  "井上公平": "KOUHEI INOUE",
  "井畑翔太郎": "SHOTARO IHATA",
  "仲間隼斗": "HAYATO NAKAMA",
  "伊東俊": "SHUN ITO",
  "伊藤優汰": "YUTA ITO",
  "伊藤涼太郎": "RYOTARO ITO",
  "似鳥康太": "KOTA NITADORI",
  "佐藤優平": "YUHEI SATO",
  "佐藤慎之介": "SHINNOSUKE SATO",
  "佐藤昭大": "AKIHIRO SATO",
  "佐野翼": "TSUBASA SANO",
  "光永祐也": "YUUYA MITSUNAGA",
  "八久保颯": "SATSU HACHI KUBO",
  "六車拓也": "TAKUYA MUGURUMA",
  "内山圭": "KEI UCHIYAMA",
  "内田潤": "JUN UCHIDA",
  "前田信弘": "NOBUHIRO MAEDA",
  "前野貴徳": "TAKANORI MAENO",
  "加藤健太": "KENTA KATOU",
  "加藤大": "DAI KATOU",
  "加藤悠馬": "YUUMA KATOU",
  "加藤竜二": "RYUUJI KATOU",
  "北嶋秀朗": "HIDEO KITAJIMA",
  "北川佳男": "YOSHIO KITAGAWA",
  "北村知也": "TOMOYA KITAMURA",
  "北野貴之": "TAKAYUKI KITANO",
  "千代反田充": "JUU CHIYO TANDA",
  "千葉和彦": "KAZUHIKO CHIBA",
  "千葉真也": "SHINYA CHIBA",
  "南雄太": "YUUTA MINAMI",
  "原一樹": "KAZUKI HARA",
  "原田拓": "TAKU HARADA",
  "原裕太郎": "YUUTAROU HARA",
  "原輝綺": "TERU KI HARA",
  "古長谷千博": "CHIHIRO FURUNAGA TANI",
  "吉井孝輔": "TAKASUKE YOSHII",
  "吉原慎也": "SHINYA YOSHIHARA",
  "吉原秀祐": "SHUU SUKE YOSHIHARA",
  "吉田光希": "MIKI YOSHIDA",
  "吉田智志": "SATOSHI YOSHIDA",
  "唐山翔自": "SHOU JI TOUZAN",
  "喜名哲裕": "AKIHIRO KI MEI",
  "喜多靖": "YASUSHI KITA",
  "園田拓也": "TAKUYA SONODA",
  "土信田悠生": "YUU NAMA TSUCHI SHINODA",
  "坂井大将": "TAISHOU SAKAI",
  "坂元大希": "TAIKI SAKAMOTO",
  "坂本亘基": "KOU MOTO SAKAMOTO",
  "坂本將貴": "MASAKI SAKAMOTO",
  "坂本広大": "KOUDAI SAKAMOTO",
  "坂田良太": "RYOUTA SAKATA",
  "坪内秀介": "HIDEYUKI TSUBOUCHI",
  "城定信次": "SHINJI SHIRO TEI",
  "堀米勇輝": "YUUKI HORIGOME",
  "堀米悠斗": "YUUTO HORIGOME",
  "堂森勝利": "SHOURI DOU MORI",
  "堤俊輔": "SHUNSUKE TSUTSUMI",
  "塩浜遼": "RYOU SHIOHAMA",
  "増田卓也": "TAKUYA MASUDA",
  "増田繁人": "SHIGETO MASUDA",
  "多々良敦斗": "ATSUSHI TO TATARA",
  "大井健太郎": "KENTAROU OOI",
  "大島秀夫": "HIDEO OOSHIMA",
  "大崎舜": "SHUN OOSAKI",
  "大橋正博": "MASAHIRO OOHASHI",
  "大武峻": "SHUN OOTAKE",
  "大西昌之": "MASAYUKI OONISHI",
  "大谷尚輝": "NAOKI OOTANI",
  "大谷幸輝": "YUKITERU OOTANI",
  "大谷昌司": "SHOUJI OOTANI",
  "大迫希": "MARE OOSAKO",
  "大野和成": "KAZUNARI OONO",
  "大﨑舜": "SHUN DAI DAI",
  "太洋一": "YOUICHI TA",
  "太田修介": "SHUUSUKE OOTA",
  "奥山武宰士": "TAKESHI SAI SAMURAI OKUYAMA",
  "宇留野純": "JUN URUNO",
  "守田達弥": "TATSUYA MORITA",
  "安柄俊": "GARA SHUN AN",
  "安田理大": "RIDAI YASUDA",
  "安英学": "EIGAKU AN",
  "宮㟢海斗": "KAITO MIYA",
  "宮原愛輝": "AI TERU MIYAHARA",
  "宮崎大志郎": "TAISHI ROU MIYAZAKI",
  "宮崎幾笑": "KI WARAI MIYAZAKI",
  "宮本英治": "EIJI MIYAMOTO",
  "宮沢克行": "KATSUYUKI MIYAZAWA",
  "富山貴光": "TAKAMITSU TOYAMA",
  "富澤清太郎": "SEITAROU TOMIZAWA",
  "寺川能人": "NOU NIN TERAKAWA",
  "小原基樹": "MOTOKI KOHARA",
  "小塚和季": "WA KI KOZUKA",
  "小島亨介": "TOORU SUKE KOJIMA",
  "小島圭巽": "KEI TATSUMI KOJIMA",
  "小川佳純": "YOSHIZUMI OGAWA",
  "小枇ランディーエメカ": "SHOU BI RANDII EMEKA",
  "小林弘記": "HIROSHI KI KOBAYASHI",
  "小林悟": "SATOSHI KOBAYASHI",
  "小林慶行": "YOSHI GYOU KOBAYASHI",
  "小林裕紀": "HIROKI KOBAYASHI",
  "小林陽介": "YOUSUKE KOBAYASHI",
  "小林高道": "TAKA MICHI KOBAYASHI",
  "小森田友明": "TOMOAKI KOMORIDA",
  "小泉慶": "YOSHI KOIZUMI",
  "小澤英明": "HIDEAKI OZAWA",
  "小牧成亘": "SEI KOU KOMAKI",
  "小笠原佳祐": "KEISUKE OGASAWARA",
  "小見洋太": "YOUTA OMI",
  "小谷祐喜": "YUUKI KOTANI",
  "小谷野顕治": "KENJI KOYANO",
  "尾崎瑛一郎": "EIICHI ROU OZAKI",
  "山下訓広": "KUN KOU YAMASHITA",
  "山内祐一": "YUUICHI YAMAUCHI",
  "山口武士": "BUSHI YAMAGUCHI",
  "山口素弘": "MOTOHIRO YAMAGUCHI",
  "山崎亮平": "RYOUHEI YAMAZAKI",
  "山崎侑輝": "YUU TERU YAMAZAKI",
  "山形辰徳": "TATSUNORI YAMAGATA",
  "山本康裕": "YASUHIRO YAMAMOTO",
  "山本海人": "AMA YAMAMOTO",
  "山本翔平": "SHOUHEI YAMAMOTO",
  "山根成陽": "SEIYOU YAMANE",
  "岡山哲也": "TETSUYA OKAYAMA",
  "岡崎慎": "SHIN OKAZAKI",
  "岡本將成": "SHOU SEI OKAMOTO",
  "岡本知剛": "CHI TSUYOSHI OKAMOTO",
  "岡本英也": "HIDEYA OKAMOTO",
  "岡本賢明": "KENMEI OKAMOTO",
  "岡村和哉": "KAZUYA OKAMURA",
  "岡﨑亮平": "RYOUHEI OKA OKA",
  "岩丸史也": "FUMIYA IWAMARU",
  "岩﨑陽平": "YOUHEI IWA IWA",
  "島田周輔": "SHUU SUKE SHIMADA",
  "島田譲": "YUZURU SHIMADA",
  "崔根植": "NE SHOKU SAI",
  "嶋田慎太郎": "SHINTAROU SHIMADA",
  "川又堅碁": "KEN GO KAWAMATA",
  "川口尚紀": "NAOKI KAWAGUCHI",
  "川浪吾郎": "GOROU KAWANAMI",
  "巻誠一郎": "SEIICHIROU KAN",
  "市村篤司": "ATSUSHI ICHIMURA",
  "常盤聡": "SATOSHI TOKIWA",
  "平井将生": "SHOKI HIRAI",
  "平川怜": "REI HIRAKAWA",
  "平木良樹": "YOSHIKI HIRAKI",
  "平松宗": "SHU HIRAMATSU",
  "平繁龍一": "RYUICHI HIRASHIGE",
  "平間智和": "TOMOKAZU HIRAMA",
  "広瀬健太": "KENTA HIROSE",
  "廣井友信": "TOMONOBU HIROI",
  "式田高義": "TAKAYOSHI SHIKIDA",
  "恒松伴典": "TOMONORI TSUNEMATSU",
  "成岡翔": "SHO NARUOKA",
  "戸嶋祥郎": "SHOU ROU TOSHIMA",
  "押久保汐音": "SHIONE OU KUBO",
  "指宿洋史": "HIROSHI IBUSUKI",
  "斉藤紀由": "KI YU SAITOU",
  "新井健二": "KENJI ARAI",
  "新井直人": "NAOTO ARAI",
  "明堂和也": "KAZUYA MYOUDOU",
  "曺永哲": "EI SATOSHI SOU",
  "有村光史": "MITSUFUMI ARIMURA",
  "服部浩紀": "HIROKI HATTORI",
  "木下正貴": "MASATAKA KINOSHITA",
  "木寺浩一": "KOUICHI KITERA",
  "木島良輔": "RYOUSUKE KIJIMA",
  "木暮郁哉": "IKUYA KOGURE",
  "木村祐志": "YUUJI KIMURA",
  "木澤正徳": "MASANORI KISAWA",
  "末岡龍二": "RYUUJI SUEOKA",
  "本間勲": "ISAO HONMA",
  "本間至恩": "SHION HONMA",
  "杉山弘一": "KOUICHI SUGIYAMA",
  "杉山直宏": "NAOHIRO SUGIYAMA",
  "李明載": "MEI SAI SUMOMO",
  "村上佑介": "YUUSUKE MURAKAMI",
  "村上巧": "KOU MURAKAMI",
  "東出壮太": "SOUTA HIGASHIDE",
  "東口順昭": "JUNSHOU HIGASHIGUCHI",
  "東山達稀": "TOORU MARE HIGASHIYAMA",
  "東野広太郎": "KOUTAROU HIGASHINO",
  "松下年宏": "TOSHIHIRO MATSUSHITA",
  "松原健": "TAKESHI MATSUBARA",
  "松尾直人": "NAOTO MATSUO",
  "松岡康暢": "YASUSHI NOBU MATSUOKA",
  "松岡瑠夢": "RU YUME MATSUOKA",
  "松橋章太": "SHOUTA MATSUHASHI",
  "林祥太": "SHOUTA HAYASHI",
  "林裕煥": "HIROSHI KAN HAYASHI",
  "柳育崇": "IKU SUU YANAGI",
  "柴暢彦": "NOBUHIKO SHIBA",
  "栗原圭介": "KEISUKE KURIHARA",
  "根占真伍": "MAKOTO GO NEJIME",
  "桑原裕義": "HIROYOSHI KUWAHARA",
  "梅山修": "OSAMU UMEYAMA",
  "梶山陽平": "YOUHEI KAJIYAMA",
  "森俊介": "SHUNSUKE MORI",
  "森川泰臣": "YASUTAKA MORIKAWA",
  "森田浩史": "HIROSHI MORITA",
  "植村洋斗": "HIROSHI TO UEMURA",
  "植田龍仁朗": "RYUUJIN AKIRA UEDA",
  "樋口叶": "KANOU HIGUCHI",
  "横山知伸": "TOMONOBU YOKOYAMA",
  "橋本健人": "TAKETO HASHIMOTO",
  "橋本拳人": "KOBUSHI NIN HASHIMOTO",
  "橋本陸斗": "RIKU TO HASHIMOTO",
  "武富孝介": "KOUSUKE TAKETOMI",
  "武田洋平": "YOUHEI TAKEDA",
  "武田直隆": "NAOTAKA TAKEDA",
  "武者大夢": "TAIMU MUSHA",
  "氏原良二": "RYOUJI UJIHARA",
  "水越潤": "JUN MIZUKOSHI",
  "水野晃樹": "KOUKI MIZUNO",
  "水野泰輔": "TAISUKE MIZUNO",
  "永井建成": "KENSEI NAGAI",
  "永田充": "JUU NAGATA",
  "江﨑巧朗": "KOU AKIRA KOU KOU",
  "池田誠": "MAKOTO IKEDA",
  "池谷友喜": "TOMOKI IKETANI",
  "河原創": "SOU KAWARA",
  "河原和寿": "KAZUTOSHI KAWARA",
  "河原塚毅": "TSUYOSHI KAWARA TSUKA",
  "河田波大": "NAMI DAI KAWATA",
  "河田篤秀": "ATSUSHI SHUU KAWATA",
  "河端和哉": "KAZUYA KAWABATA",
  "河野健一": "KEN'ICHI KOUNO",
  "浅倉廉": "REN ASAKURA",
  "浅川隼人": "HAYATO ASAKAWA",
  "海本幸治郎": "KOUJIROU UMI HON",
  "海本慶治": "KEIJI UMI HON",
  "深井正樹": "MASAKI FUKAI",
  "深澤仁博": "HITOSHI HIROSHI FUKAZAWA",
  "清武功暉": "KOU KI KIYOTAKE",
  "渡辺匠": "TAKUMI WATANABE",
  "渡辺泰広": "YASUHIRO WATANABE",
  "渡邉新太": "SHINTA WATANABE",
  "渡邊凌磨": "RYOU MA WATANABE",
  "渡邊泰基": "YASUSHI MOTO WATANABE",
  "澤田崇": "SUU SAWADA",
  "濱田水輝": "MIZUKI HAMADA",
  "瀬口拓弥": "TAKUMI SEGUCHI",
  "瀬戸春樹": "HARUKI SETO",
  "熊谷雅彦": "MASAHIKO KUMAGAYA",
  "熱田眞": "MAKOTO ATSUTA",
  "營田一燈": "ITTOU EI TA",
  "片山奨典": "SHOU TEN KATAYAMA",
  "片渕浩一郎": "KOUICHIROU KATABUCHI",
  "生方繁": "HAN UBUKATA",
  "田上大地": "DAICHI TAGAMI",
  "田中亜土夢": "ADO YUME TANAKA",
  "田中俊一": "TOSHIKAZU TANAKA",
  "田中秀哉": "SHUUYA TANAKA",
  "田中達也": "TATSUYA TANAKA",
  "田口潤人": "JUN NIN TAGUCHI",
  "田尻康晴": "YASUHARU TAJIRI",
  "田村翔太": "SHOUTA TAMURA",
  "田畑輝樹": "TERUKI TAHATA",
  "田辺圭佑": "KEISUKE TANABE",
  "町田多聞": "TABUN MACHIDA",
  "畑実": "MI HATAKE",
  "白谷建人": "TAKERU SHIRATANI",
  "皆川佑介": "YUUSUKE MINAGAWA",
  "相澤佑哉": "YUU YA AIZAWA",
  "相澤祥太": "SHOUTA AIZAWA",
  "矢村健": "TAKESHI YAMURA",
  "矢野大輔": "DAISUKE YANO",
  "矢野貴章": "TAKAAKI YANO",
  "石井俊也": "TOSHIYA ISHII",
  "石川啓人": "KEI NIN ISHIKAWA",
  "石川大地": "DAICHI ISHIKAWA",
  "石川直樹": "NAOKI ISHIKAWA",
  "磯村亮太": "RYOUTA ISOMURA",
  "神代慶人": "KEITO KAMISHIRO",
  "神田勝夫": "KATSUO KANDA",
  "福王忠世": "TADAYO FUKUOU",
  "福田晃斗": "AKIRA TO FUKUDA",
  "秋山裕紀": "HIROKI AKIYAMA",
  "秋葉忠宏": "TADAHIRO AKIBA",
  "稲川碧希": "HEKI MARE INAGAWA",
  "稲村隼翔": "HAYABUSA SHOU INAMURA",
  "稲田康志": "YASUSHI INEDA",
  "端山豪": "GOU HAYAMA",
  "竹本雄飛": "YUUHI TAKEMOTO",
  "竹重安希彦": "AN MARE HIKO TAKESHIGE",
  "笹垣拓也": "TAKUYA SASA KAKI",
  "筑城和人": "KAZUHITO TSUKU SHIRO",
  "筒井紀章": "KISHOU TSUTSUI",
  "篠原弘次郎": "KOUJIROU SHINOHARA",
  "米原秀亮": "SHUU AKIRA YONEHARA",
  "粟飯原尚平": "SHOUHEI AIHARA",
  "網田慎": "SHIN AMITA",
  "船越優蔵": "YUU KURA FUNAKOSHI",
  "芹澤飛勇": "HI ISAMI SERIZAWA",
  "若杉拓哉": "TAKUYA WAKASUGI",
  "荻原拓也": "TAKUYA OGIWARA",
  "菅沼実": "MI SUGENUMA",
  "菅沼駿哉": "SHUN YA SUGENUMA",
  "菅田真啓": "MASAHIRO SUGATA",
  "菊地直哉": "NAOYA KIKUCHI",
  "萩村滋則": "SHIGENORI HAGIMURA",
  "薗田淳": "ATSUSHI SONODA",
  "藏川洋平": "YOUHEI KURA KAWA",
  "藤井大輔": "DAISUKE FUJII",
  "藤川虎太朗": "TORATA AKIRA FUJIKAWA",
  "藤本主税": "CHIKARA FUJIMOTO",
  "藤本大": "DAI FUJIMOTO",
  "藤田一途": "ICHIZU FUJITA",
  "藤田俊哉": "TOSHIYA FUJITA",
  "藤田和輝": "KAZUTERU FUJITA",
  "藤田征也": "SEI YA FUJITA",
  "藤田慎一": "SHIN'ICHI FUJITA",
  "衛藤幹弥": "MIKIYA ETO",
  "袴田裕太郎": "YUUTAROU HAKAMADA",
  "西ヶ谷隆之": "TAKAYUKI NISHIGAYA",
  "西大伍": "DAIGO NISHI",
  "西弘則": "HIRONORI NISHI",
  "西村竜馬": "RYOMA NISHIMURA",
  "西村遥己": "HARUKI NISHIMURA",
  "西森正明": "MASAAKI NISHIMORI",
  "諏訪雄大": "YUDAI SUWA",
  "谷口海斗": "KAITO TANIGUCHI",
  "谷山湧人": "YUTO TANIYAMA",
  "豊田歩": "AYUMU TOYODA",
  "車智鎬": "SATORU KOU KURUMA",
  "道脇豊": "YUTAKA MICHIWAKI",
  "遠藤凌": "RYOU ENDOU",
  "鄭大世": "HARUTOSHI TEI",
  "酒井匠": "TAKUMI SAKAI",
  "酒井宣福": "SEN FUKU SAKAI",
  "酒井崇一": "SUU ICHI SAKAI",
  "酒井高徳": "TAKANORI SAKAI",
  "酒井高聖": "TAKA HIJIRI SAKAI",
  "野村政孝": "MASATAKA NOMURA",
  "野津田岳人": "GAKUJIN NOZUTA",
  "野澤洋輔": "YOUSUKE NOZAWA",
  "野田裕喜": "HIROKI NODA",
  "金井大樹": "TAIJU KANAI",
  "金根煥": "KONKAN KIN",
  "金永根": "EI NE KIN",
  "金珍洙": "CHIN SHU KIN",
  "鈴木健太郎": "KENTAROU SUZUKI",
  "鈴木大輔": "DAISUKE SUZUKI",
  "鈴木孝司": "TAKASHI SUZUKI",
  "鈴木慎吾": "SHINGO SUZUKI",
  "鈴木武蔵": "MUSASHI SUZUKI",
  "鈴木祐輔": "YUUSUKE SUZUKI",
  "鈴木翔登": "SHOU TOU SUZUKI",
  "鏑木享": "KYOU KABURAKI",
  "長倉幹樹": "KAN KI NAGAKURA",
  "長沢駿": "SHUN NAGASAWA",
  "長谷川元希": "MOTO MARE HASEGAWA",
  "長谷川太一": "TAICHI HASEGAWA",
  "長谷川太郎": "TAROU HASEGAWA",
  "長谷川巧": "KOU HASEGAWA",
  "長谷川紡": "BOU HASEGAWA",
  "長谷部彩翔": "SAI SHOU HASEBE",
  "関光博": "MITSUHIRO KAN",
  "阿部敏之": "TOSHIYUKI ABE",
  "阿部海斗": "KAITO ABE",
  "阿部航斗": "KOU TO ABE",
  "青木剛": "TSUYOSHI AOKI",
  "青木良太": "RYOUTA AOKI",
  "青野大介": "DAISUKE AONO",
  "養父雄仁": "KATSUHITO YOUFU",
  "高宇洋": "U HIROSHI TAKA",
  "高木善朗": "YOSHIROU TAKAGI",
  "高橋泰": "YASUSHI TAKAHASHI",
  "高橋直樹": "NAOKI TAKAHASHI",
  "高橋祐太郎": "YUUTAROU TAKAHASHI",
  "高瀬優孝": "YUUKOU TAKASE",
  "髙柳一誠": "ISSEI",
  "髙橋利樹": "TOSHIKI",
  "髙澤優也": "YUUYA",
  "鳴尾直軌": "CHOKU KI NARUO",
  "黒崎久志": "HISASHI KUROSAKI",
  "黒河貴矢": "TAKASHI YA KUROKAWA",
  "齊藤和樹": "KAZUKI SAITOU",
  "齋藤恵太": "KEITA SAITOU"
  };

  const PLAYER_ENGLISH_NAME_LOOKUP = {
    ...PLAYER_ENGLISH_NAME_AUTO_OVERRIDES,
    ...PLAYER_ENGLISH_NAME_OVERRIDES
  };

  const KATAKANA_ROMAJI_DIGRAPHS = {
    "キャ": "KYA", "キュ": "KYU", "キョ": "KYO",
    "シャ": "SHA", "シュ": "SHU", "ショ": "SHO",
    "チャ": "CHA", "チュ": "CHU", "チョ": "CHO",
    "ニャ": "NYA", "ニュ": "NYU", "ニョ": "NYO",
    "ヒャ": "HYA", "ヒュ": "HYU", "ヒョ": "HYO",
    "ミャ": "MYA", "ミュ": "MYU", "ミョ": "MYO",
    "リャ": "RYA", "リュ": "RYU", "リョ": "RYO",
    "ギャ": "GYA", "ギュ": "GYU", "ギョ": "GYO",
    "ジャ": "JA", "ジュ": "JU", "ジョ": "JO",
    "ビャ": "BYA", "ビュ": "BYU", "ビョ": "BYO",
    "ピャ": "PYA", "ピュ": "PYU", "ピョ": "PYO",
    "ファ": "FA", "フィ": "FI", "フェ": "FE", "フォ": "FO",
    "ティ": "TI", "ディ": "DI", "デュ": "DU",
    "トゥ": "TU", "ドゥ": "DU",
    "ウィ": "WI", "ウェ": "WE", "ウォ": "WO",
    "ヴァ": "VA", "ヴィ": "VI", "ヴ": "VU", "ヴェ": "VE", "ヴォ": "VO"
  };

  const KATAKANA_ROMAJI = {
    "ア": "A", "イ": "I", "ウ": "U", "エ": "E", "オ": "O",
    "カ": "KA", "キ": "KI", "ク": "KU", "ケ": "KE", "コ": "KO",
    "サ": "SA", "シ": "SHI", "ス": "SU", "セ": "SE", "ソ": "SO",
    "タ": "TA", "チ": "CHI", "ツ": "TSU", "テ": "TE", "ト": "TO",
    "ナ": "NA", "ニ": "NI", "ヌ": "NU", "ネ": "NE", "ノ": "NO",
    "ハ": "HA", "ヒ": "HI", "フ": "FU", "ヘ": "HE", "ホ": "HO",
    "マ": "MA", "ミ": "MI", "ム": "MU", "メ": "ME", "モ": "MO",
    "ヤ": "YA", "ユ": "YU", "ヨ": "YO",
    "ラ": "RA", "リ": "RI", "ル": "RU", "レ": "RE", "ロ": "RO",
    "ワ": "WA", "ヲ": "O", "ン": "N",
    "ガ": "GA", "ギ": "GI", "グ": "GU", "ゲ": "GE", "ゴ": "GO",
    "ザ": "ZA", "ジ": "JI", "ズ": "ZU", "ゼ": "ZE", "ゾ": "ZO",
    "ダ": "DA", "ヂ": "JI", "ヅ": "ZU", "デ": "DE", "ド": "DO",
    "バ": "BA", "ビ": "BI", "ブ": "BU", "ベ": "BE", "ボ": "BO",
    "パ": "PA", "ピ": "PI", "プ": "PU", "ペ": "PE", "ポ": "PO",
    "ァ": "A", "ィ": "I", "ゥ": "U", "ェ": "E", "ォ": "O",
    "ャ": "YA", "ュ": "YU", "ョ": "YO"
  };

  function romanizeKatakana(text) {
    const input = String(text || "").normalize("NFKC");
    let output = "";
    for (let index = 0; index < input.length; index += 1) {
      const pair = input.slice(index, index + 2);
      if (KATAKANA_ROMAJI_DIGRAPHS[pair]) {
        output += KATAKANA_ROMAJI_DIGRAPHS[pair];
        index += 1;
        continue;
      }
      const char = input[index];
      if (char === "ッ") {
        const nextPair = input.slice(index + 1, index + 3);
        const next = KATAKANA_ROMAJI_DIGRAPHS[nextPair] || KATAKANA_ROMAJI[input[index + 1]] || "";
        if (next) output += next[0];
        continue;
      }
      if (char === "ー") {
        const vowel = (output.match(/[AEIOU](?!.*[AEIOU])/) || [""])[0];
        output += vowel;
        continue;
      }
      output += KATAKANA_ROMAJI[char] || char;
    }
    return output;
  }

  function getPlayerEnglishName(player) {
    const rawName = String((player && player.player_name) || player || "").normalize("NFKC").trim();
    const compact = normalizePlayerIdentityText(rawName);
    const override = PLAYER_ENGLISH_NAME_LOOKUP[compact];
    if (override) return override;
    if (/^[\u30A0-\u30FF\s・･ー]+$/.test(rawName)) {
      return rawName.split(/[\s・･]+/).filter(Boolean).map(romanizeKatakana).join(" ").toUpperCase();
    }
    if (/[\u3400-\u9FFF]/.test(rawName)) return rawName.replace(/[\s　]+/g, " ").toUpperCase();
    return rawName.toUpperCase();
  }

  function renderPlayerPhoto(playerName, club = playerAnalysisState.selectedClub, className = "", player = null, options = {}) {
    const resolvedClub = getPlayerAnalysisClub(club);
    const sources = getPlayerImageSources(playerName, resolvedClub, player);
    if (!sources.length) return "";
    const fallbackSources = sources.slice(1);
    const altName = normalizePlayerImageName(playerName);
    const classes = ["player-photo", `club-${resolvedClub}`, className].filter(Boolean).join(" ");
    const tagName = options.inline ? "span" : "figure";
    return `
      <${tagName} class="${escapeHtml(classes)}">
        <img
          src="${escapeHtml(sources[0])}"
          ${fallbackSources.length ? `data-fallback-srcs="${escapeHtml(fallbackSources.join("|"))}"` : ""}
          data-player-photo
          alt="${escapeHtml(`${altName}の写真`)}"
          loading="eager"
          decoding="async"
        >
      </${tagName}>
    `;
  }

  function setupPlayerPhotos(root = document) {
    if (!root) return;
    root.querySelectorAll("img[data-player-photo]").forEach(img => {
      if (img.dataset.playerPhotoBound === "true") return;
      img.dataset.playerPhotoBound = "true";
      const frame = img.closest(".player-photo");
      const show = () => frame?.classList.add("is-loaded");
      const hide = () => frame?.remove();
      const checkCurrentSource = () => {
        window.setTimeout(() => {
          if (!img.isConnected || frame?.classList.contains("is-loaded")) return;
          if (!img.complete) return;
          if (img.naturalWidth > 0) show();
          else tryNextSource();
        }, 80);
      };
      const tryNextSource = () => {
        const fallbacks = String(img.dataset.fallbackSrcs || img.dataset.fallbackSrc || "")
          .split("|")
          .map(src => src.trim())
          .filter(Boolean);
        const index = Number(img.dataset.fallbackIndex || 0);
        if (index < fallbacks.length) {
          img.dataset.fallbackIndex = String(index + 1);
          img.src = fallbacks[index];
          checkCurrentSource();
          return;
        }
        hide();
      };
      img.addEventListener("load", show);
      img.addEventListener("error", tryNextSource);
      if (img.complete) {
        if (img.naturalWidth > 0) show();
        else tryNextSource();
      }
    });
  }

  function getPlayerChantNameCandidates(playerName, player = null) {
    const identity = player ? getPlayerCanonicalIdentity(player, getPlayerYearValue(player)) : null;
    const rawNames = [
      playerName,
      player && player.player_name,
      player && player.player_key,
      identity && identity.name,
      identity && identity.key
    ];
    if (playerName) rawNames.push(...getPlayerImageAliasNames(playerName, player));
    return Array.from(new Set(rawNames
      .filter(Boolean)
      .flatMap(name => {
        const baseName = normalizePlayerImageName(name);
        if (!baseName) return [];
        return [
          baseName,
          baseName.replace(/\s*[・･]\s*/g, "・").replace(/\s+/g, " ").trim(),
          baseName.replace(/\s*[・･]\s*/g, " ").replace(/\s+/g, " ").trim(),
          normalizePlayerIdentityText(baseName)
        ];
      })
      .map(name => String(name || "").trim())
      .filter(Boolean)));
  }

  function renderPlayerChantAudioSlot(playerName, player = null) {
    const candidates = getPlayerChantNameCandidates(playerName, player);
    if (!candidates.length) return "";
    return `<div class="player-chant-slot" data-player-chant-slot data-player-chant-candidates="${escapeHtml(candidates.join("|"))}" hidden></div>`;
  }

  function getPlayerChantAudioUrl(baseName, type, index) {
    const suffix = type === "call" ? `_コール${index}` : `_${index}`;
    return `${PLAYER_CHANT_AUDIO_DIR}/${encodeURIComponent(`${baseName}${suffix}`)}.mp3`;
  }

  async function playerChantAssetExists(url) {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (response.ok) return true;
      if (response.status !== 405 && response.status !== 501) return false;
    } catch (error) {
      return false;
    }

    try {
      const response = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
      return response.ok || response.status === 206;
    } catch (error) {
      return false;
    }
  }

  async function findPlayerChantTrack(candidates, type, index) {
    for (const candidate of candidates) {
      const url = getPlayerChantAudioUrl(candidate, type, index);
      if (await playerChantAssetExists(url)) {
        return { type, index, url };
      }
    }
    return null;
  }

  async function findPlayerChantTracksByType(candidates, type) {
    const tracks = [];
    for (let index = 1; index <= PLAYER_CHANT_MAX_INDEX; index += 1) {
      const track = await findPlayerChantTrack(candidates, type, index);
      if (!track) break;
      tracks.push(track);
    }
    return tracks;
  }

  function loadPlayerChantTracks(candidates) {
    const cleanCandidates = Array.from(new Set((candidates || []).map(name => String(name || "").trim()).filter(Boolean)));
    const cacheKey = cleanCandidates.join("|");
    if (!cacheKey) return Promise.resolve({ calls: [], chants: [] });
    if (!playerChantAvailabilityCache.has(cacheKey)) {
      playerChantAvailabilityCache.set(cacheKey, (async () => {
        const [calls, chants] = await Promise.all([
          findPlayerChantTracksByType(cleanCandidates, "call"),
          findPlayerChantTracksByType(cleanCandidates, "chant")
        ]);
        return {
          calls,
          chants
        };
      })());
    }
    return playerChantAvailabilityCache.get(cacheKey);
  }

  function renderPlayerChantTrackGroup(title, tracks) {
    if (!tracks.length) return "";
    return `
      <div class="player-chant-group">
        <h3>${escapeHtml(title)}</h3>
        <div class="player-chant-list">
          ${tracks.map(track => {
            const label = `${title}${track.index}`;
            return `
              <div class="player-chant-track">
                <button type="button" class="player-chant-toggle" data-player-chant-toggle aria-expanded="false">
                  <span>${escapeHtml(label)}</span>
                  <b aria-hidden="true">+</b>
                </button>
                <div class="player-chant-panel" hidden>
                  <audio controls preload="none" src="${escapeHtml(track.url)}" data-player-chant-audio aria-label="${escapeHtml(label)}"></audio>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderPlayerChantAudioContent(groups) {
    const calls = groups && Array.isArray(groups.calls) ? groups.calls : [];
    const chants = groups && Array.isArray(groups.chants) ? groups.chants : [];
    const count = calls.length + chants.length;
    if (!count) return "";
    return `
      <section class="player-chant-player" aria-label="コールとチャント">
        <div class="player-chant-head">
          <span>CALL & CHANT</span>
          <strong>コール / チャント</strong>
        </div>
        ${renderPlayerChantTrackGroup("コール", calls)}
        ${renderPlayerChantTrackGroup("チャント", chants)}
      </section>
    `;
  }

  function bindPlayerChantAudios(root = document) {
    if (!root) return;
    root.querySelectorAll("[data-player-chant-toggle]").forEach(button => {
      if (button.dataset.playerChantToggleBound === "true") return;
      button.dataset.playerChantToggleBound = "true";
      button.addEventListener("click", () => {
        const track = button.closest(".player-chant-track");
        const player = button.closest(".player-chant-player");
        const panel = track && track.querySelector(".player-chant-panel");
        const nextOpen = !track?.classList.contains("active");
        if (!track || !panel || !player) return;
        player.querySelectorAll(".player-chant-track.active").forEach(openTrack => {
          if (openTrack === track) return;
          openTrack.classList.remove("active");
          const openButton = openTrack.querySelector("[data-player-chant-toggle]");
          const openPanel = openTrack.querySelector(".player-chant-panel");
          const openIcon = openButton && openButton.querySelector("b");
          const openAudio = openTrack.querySelector("audio[data-player-chant-audio]");
          if (openButton) openButton.setAttribute("aria-expanded", "false");
          if (openIcon) openIcon.textContent = "+";
          if (openPanel) openPanel.hidden = true;
          if (openAudio) openAudio.pause();
        });
        track.classList.toggle("active", nextOpen);
        panel.hidden = !nextOpen;
        button.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        const icon = button.querySelector("b");
        if (icon) icon.textContent = nextOpen ? "-" : "+";
        if (!nextOpen) {
          const audio = track.querySelector("audio[data-player-chant-audio]");
          if (audio) audio.pause();
        }
      });
    });
    root.querySelectorAll("audio[data-player-chant-audio]").forEach(audio => {
      if (audio.dataset.playerChantBound === "true") return;
      audio.dataset.playerChantBound = "true";
      audio.addEventListener("play", () => {
        document.querySelectorAll("audio[data-player-chant-audio]").forEach(other => {
          if (other !== audio) other.pause();
        });
      });
    });
  }

  function setupPlayerChantAudio(root = document) {
    if (!root) return;
    root.querySelectorAll("[data-player-chant-slot]").forEach(slot => {
      const candidateKey = String(slot.dataset.playerChantCandidates || "");
      if (!candidateKey || slot.dataset.playerChantHydrated === candidateKey) return;
      slot.dataset.playerChantHydrated = candidateKey;
      const candidates = candidateKey.split("|").map(name => name.trim()).filter(Boolean);
      loadPlayerChantTracks(candidates)
        .then(groups => {
          if (!slot.isConnected || slot.dataset.playerChantHydrated !== candidateKey) return;
          const content = renderPlayerChantAudioContent(groups);
          if (!content) {
            slot.hidden = true;
            slot.innerHTML = "";
            return;
          }
          slot.innerHTML = content;
          slot.hidden = false;
          bindPlayerChantAudios(slot);
        })
        .catch(error => {
          console.warn("Failed to load player chant audio", error);
          if (!slot.isConnected || slot.dataset.playerChantHydrated !== candidateKey) return;
          slot.hidden = true;
          slot.innerHTML = "";
        });
    });
  }

  function getPlayerAnalysisYears(club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    const years = [];
    for (let year = info.yearStart || PLAYER_ANALYSIS_YEAR_START; year <= PLAYER_ANALYSIS_YEAR_END; year++) {
      years.push(year);
    }
    return years;
  }

  function normalizePlayerAnalysisYearForClub(year, club = playerAnalysisState.selectedClub) {
    if (year === "all") return "all";
    const normalizedYear = Number(year);
    const years = getPlayerAnalysisYears(club);
    if (years.includes(normalizedYear)) return normalizedYear;
    return years.includes(PLAYER_ANALYSIS_YEAR_END) ? PLAYER_ANALYSIS_YEAR_END : (years[years.length - 1] || PLAYER_ANALYSIS_YEAR_END);
  }

  function renderPlayerAnalysisClubControl() {
    const { clubSelect, clubName, clubMenu } = getPlayerAnalysisElements();
    const info = getPlayerAnalysisClubInfo();
    document.body.setAttribute("data-pa-club", info.key);
    if (clubName) clubName.textContent = info.englishName;
    if (clubSelect) {
      clubSelect.setAttribute("aria-label", `${info.name}を選択中`);
      clubSelect.setAttribute("aria-expanded", clubMenu && !clubMenu.hidden ? "true" : "false");
    }
    if (clubMenu) {
      clubMenu.querySelectorAll("[data-pa-club]").forEach(button => {
        const active = getPlayerAnalysisClub(button.dataset.paClub) === info.key;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
  }

  function closePlayerAnalysisClubMenu() {
    const { clubSelect, clubMenu } = getPlayerAnalysisElements();
    if (clubMenu) clubMenu.hidden = true;
    if (clubSelect) clubSelect.setAttribute("aria-expanded", "false");
  }

  function togglePlayerAnalysisClubMenu() {
    const { clubSelect, clubMenu } = getPlayerAnalysisElements();
    if (!clubMenu) return;
    const nextOpen = clubMenu.hidden;
    clubMenu.hidden = !nextOpen;
    if (clubSelect) clubSelect.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  }

  async function changePlayerAnalysisClub(club) {
    const nextClub = getPlayerAnalysisClub(club);
    closePlayerAnalysisClubMenu();
    if (nextClub === playerAnalysisState.selectedClub) return;
    playerAnalysisState.selectedClub = nextClub;
    playerAnalysisState.year = normalizePlayerAnalysisYearForClub(playerAnalysisState.year, nextClub);
    playerAnalysisState.timeMode = "year";
    playerAnalysisState.rangeStartYear = "";
    playerAnalysisState.rangeEndYear = "";
    playerAnalysisState.selectedKey = null;
    playerAnalysisState.compareKeys = ["", "", ""];
    playerAnalysisState.compareChoiceYears = ["", "", ""];
    playerAnalysisState.compareChoiceRows = [[], [], []];
    playerAnalysisState.compareScopeRows = [];
    playerAnalysisState.compareYear = "";
    playerAnalysisState.compareStartYear = "";
    playerAnalysisState.compareEndYear = "";
    playerAnalysisState.compareTimeMode = "year";
    playerAnalysisState.opponentPlayerKey = "";
    playerAnalysisState.opponentChoiceRows = [];
    playerAnalysisState.opponentYear = "";
    playerAnalysisState.opponentStartYear = "";
    playerAnalysisState.opponentEndYear = "";
    playerAnalysisState.opponentTimeMode = "year";
    playerAnalysisState.opponentClub = "";
    playerAnalysisState.opponentClubs = [];
    playerAnalysisState.opponentPlayerDetail = false;
    playerAnalysisState.opponentScopeRows = [];
    playerAnalysisState.profileTab = "profile";
    playerAnalysisState.modalPlayer = null;
    closePlayerAnalysisModal({ history: false });
    playerAnalysisState.competitionFilterActive = false;
    playerAnalysisState.selectedCompetitions = [];
    renderPlayerAnalysisClubControl();
    renderPlayerAnalysisYears();
    await renderPlayerAnalysisYear(playerAnalysisState.year);
  }

  function getPlayerYearValue(player) {
    const year = Number(player && (player.season || player.__paSourceYear));
    return Number.isInteger(year) ? year : null;
  }

  function normalizePlayerIdentityText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s・･]+/g, "")
      .trim();
  }

  function getPlayerCanonicalIdentity(source, sourceYear) {
    const year = Number(sourceYear || (source && (source.season || source.__paSourceYear)));
    const rawName = String((source && (source.player_name || source.player_key)) || "").normalize("NFKC").trim();
    const rawKey = String((source && (source.player_key || source.player_name)) || rawName).normalize("NFKC").trim();
    const compact = normalizePlayerIdentityText(rawName || rawKey);
    const identity = {
      key: rawKey || rawName,
      name: rawName || rawKey || "-",
      groupKey: compact.toLowerCase()
    };

    if (compact === "曺永哲" || compact === "チョヨンチョル") {
      return { key: "曺 永哲", name: "曺 永哲", groupKey: "曺永哲" };
    }
    if (compact === "マイケルジェームズ" || compact === "舞行龍ジェームズ") {
      return { key: "舞行龍ジェームズ", name: "舞行龍ジェームズ", groupKey: "舞行龍ジェームズ" };
    }
    if (compact === "宋株熏" || compact === "ソンジュフン") {
      return { key: "宋 株熏", name: "宋 株熏", groupKey: "宋株熏" };
    }
    if (compact === "アンデルソン") {
      const era = Number.isInteger(year) && year >= 2011 ? "2011" : "2003-2004";
      return { key: `アンデルソン-${era}`, name: "アンデルソン", groupKey: `アンデルソン-${era}` };
    }
    if (compact === "シルビーニョ") {
      const era = Number.isInteger(year) && year >= 2019 ? "2019-2020" : "2006-2007";
      return { key: `シルビーニョ-${era}`, name: "シルビーニョ", groupKey: `シルビーニョ-${era}` };
    }
    return identity;
  }

  function getPlayerGroupKey(player) {
    if (player && player.__paGroupKey) return player.__paGroupKey;
    const identity = getPlayerCanonicalIdentity(player, getPlayerYearValue(player));
    if (identity.groupKey) return identity.groupKey;
    return String((player && (player.player_key || player.player_name)) || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function getPlayerAnalysisKey(player) {
    return player.__paKey || `${player.player_key || player.player_name || "player"}-${player.__paIndex || 0}`;
  }

  function normalizePlayerAnalysisRows(payload, sourceYear) {
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload && payload.players)
        ? payload.players
        : Array.isArray(payload && payload.data)
          ? payload.data
          : [];
    return rows
      .filter(row => row && typeof row === "object")
      .map((row, index) => {
        const season = Number(row.season || sourceYear);
        const identity = getPlayerCanonicalIdentity(row, Number.isInteger(season) ? season : sourceYear);
        const keyBase = identity.groupKey || row.player_key || row.player_name || `player-${index}`;
        return {
          ...row,
          player_key: identity.key || row.player_key,
          player_name: identity.name || row.player_name,
          season: Number.isInteger(season) ? season : row.season,
          __paSourceYear: Number.isInteger(season) ? season : sourceYear,
          __paIndex: index,
          __paGroupKey: identity.groupKey,
          __paKey: `${keyBase}-${index}`
        };
      });
  }

  async function loadPlayerAnalysisSupplementPlayers(club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    const supplementClubCodes = {
      niigata: "albirex_niigata",
      kumamoto: "roasso_kumamoto"
    };
    const supplementClubCode = supplementClubCodes[info.key];
    if (!supplementClubCode) return [];
    if (!playerAnalysisSupplementCache.has(info.key)) {
      playerAnalysisSupplementCache.set(info.key, (async () => {
        try {
          const res = await fetch("./data/generated/players_niigata_kumamoto.json");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const payload = await res.json();
          const items = Array.isArray(payload && payload.players) ? payload.players : [];
          const supplements = new Map();
          const addUnique = (list, value) => {
            const text = String(value ?? "").trim();
            if (text && !list.includes(text)) list.push(text);
          };
          items.forEach(item => {
            const playerName = String(item && (item.name || item.player_name) || "")
              .normalize("NFKC")
              .replace(/\s+/g, " ")
              .trim();
            if (!playerName) return;
            (Array.isArray(item.affiliations) ? item.affiliations : []).forEach(affiliation => {
              if (!affiliation || affiliation.club !== supplementClubCode) return;
              const registrations = Array.isArray(affiliation.registrations) ? affiliation.registrations : [];
              registrations.forEach(registration => {
                if (!registration) return;
                const year = Number(registration.year);
                if (!Number.isInteger(year)) return;
                if (!supplements.has(playerName)) {
                  supplements.set(playerName, {
                    player_name: playerName,
                    seasons: [],
                    numbers: [],
                    positions: [],
                    seasonDetails: {},
                    season_texts: []
                  });
                }
                const meta = supplements.get(playerName);
                if (!meta.seasons.includes(year)) meta.seasons.push(year);
                const detailKey = String(year);
                if (!meta.seasonDetails[detailKey]) {
                  meta.seasonDetails[detailKey] = { numbers: [], positions: [] };
                }
                const detail = meta.seasonDetails[detailKey];
                addUnique(meta.numbers, registration.number);
                addUnique(detail.numbers, registration.number);
                addUnique(meta.positions, registration.position);
                addUnique(detail.positions, registration.position);
              });
            });
          });
          return Array.from(supplements.values()).map(meta => ({
            ...meta,
            seasons: meta.seasons.sort((a, b) => a - b),
            numbers: meta.numbers.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "ja")),
            positions: sortPlayerPositions(meta.positions)
          }));
        } catch (error) {
          console.warn(`Failed to load supplemental players for ${info.key}`, error);
          return [];
        }
      })());
    }
    return playerAnalysisSupplementCache.get(info.key);
  }

  function formatPlayerAnalysisSupplementName(name) {
    const value = String(name || "").normalize("NFKC").replace(/\s+/g, " ").trim();
    const overrides = {
      "古長谷千博": "古長谷 千博",
      "松浦大翔": "松浦 大翔",
      "佐藤海宏": "佐藤 海宏",
      "松岡敏也": "松岡 敏也",
      "藤原優大": "藤原 優大",
      "吉田陣平": "吉田 陣平",
      "森璃太": "森 璃太",
      "内山翔太": "内山 翔太"
    };
    if (overrides[value]) return overrides[value];
    if (/[\s　・･]/.test(value) || /[ァ-ヴー]/.test(value)) return value;
    if (/^[一-龥々〆ヵヶ]{4}$/.test(value)) return `${value.slice(0, 2)} ${value.slice(2)}`;
    return value;
  }

  function createPlayerAnalysisSupplementRow(meta, sourceYear, index = 0, club = playerAnalysisState.selectedClub, absenceMatches = null) {
    const year = Number(sourceYear);
    const info = getPlayerAnalysisClubInfo(club);
    const identity = getPlayerCanonicalIdentity(meta, year);
    const groupKey = identity.groupKey || normalizePlayerIdentityText(meta.player_name).toLowerCase();
    const seasonDetail = meta && meta.seasonDetails ? meta.seasonDetails[String(year)] : null;
    const numbers = seasonDetail && Array.isArray(seasonDetail.numbers) ? seasonDetail.numbers : meta.numbers;
    const positions = seasonDetail && Array.isArray(seasonDetail.positions) ? seasonDetail.positions : meta.positions;
    const absenceCounter = Array.isArray(absenceMatches)
      ? createPlayerAnalysisCounterFromMatches(absenceMatches)
      : createPlayerAnalysisCounter();
    const row = {
      season: year,
      team: info.name,
      player_key: identity.key || meta.player_name,
      player_name: identity.name || meta.player_name,
      numbers: Array.isArray(numbers) ? [...numbers] : [],
      positions: sortPlayerPositions(Array.isArray(positions) ? [...positions] : []),
      played_matches: 0,
      played_wins: 0,
      played_draws: 0,
      played_losses: 0,
      played_win_rate: null,
      played_points_per_match: null,
      played_goals_against: 0,
      played_goals_against_avg: null,
      played_clean_sheets: 0,
      starter_matches: 0,
      starter_wins: 0,
      starter_draws: 0,
      starter_losses: 0,
      starter_win_rate: null,
      starter_points_per_match: null,
      non_starter_matches: absenceCounter.matches,
      non_starter_wins: absenceCounter.wins,
      non_starter_draws: absenceCounter.draws,
      non_starter_losses: absenceCounter.losses,
      non_starter_win_rate: calculatePlayerRate(absenceCounter.wins, absenceCounter.matches),
      non_starter_points_per_match: calculatePlayerPointsPerMatch(absenceCounter.wins, absenceCounter.draws, absenceCounter.matches),
      sub_matches: 0,
      sub_wins: 0,
      sub_draws: 0,
      sub_losses: 0,
      sub_win_rate: null,
      sub_points_per_match: null,
      bench_only_matches: 0,
      non_played_matches: absenceCounter.matches,
      non_played_wins: absenceCounter.wins,
      non_played_draws: absenceCounter.draws,
      non_played_losses: absenceCounter.losses,
      non_played_win_rate: calculatePlayerRate(absenceCounter.wins, absenceCounter.matches),
      non_played_points_per_match: calculatePlayerPointsPerMatch(absenceCounter.wins, absenceCounter.draws, absenceCounter.matches),
      goals: 0,
      scored_matches: 0,
      scored_wins: 0,
      scored_draws: 0,
      scored_losses: 0,
      scored_win_rate: null,
      scored_points_per_match: null,
      yellow_cards: 0,
      red_cards: 0,
      carded_matches: 0,
      carded_wins: 0,
      carded_draws: 0,
      carded_losses: 0,
      carded_win_rate: null,
      __paSourceYear: year,
      __paIndex: `supplement-${index}`,
      __paGroupKey: groupKey,
      __paSupplemental: true,
      __paNoAppearance: true,
      __paSeasonText: Array.isArray(meta.season_texts) ? meta.season_texts.join(" / ") : ""
    };
    assignPlayerAnalysisCounterFields(row, "played", createPlayerAnalysisCounter());
    row.played_goals_against_avg = null;
    row.played_clean_sheets = 0;
    assignPlayerAnalysisCounterFields(row, "starter", createPlayerAnalysisCounter());
    assignPlayerAnalysisCounterFields(row, "non_starter", absenceCounter);
    assignPlayerAnalysisCounterFields(row, "sub", createPlayerAnalysisCounter());
    assignPlayerAnalysisCounterFields(row, "non_played", absenceCounter);
    row.__paKey = `${groupKey || row.player_key || row.player_name}-supplement-${year}-${index}`;
    return row;
  }

  async function mergePlayerAnalysisSupplementRows(rows, sourceYear, club = playerAnalysisState.selectedClub, absenceMatches = null) {
    const info = getPlayerAnalysisClubInfo(club);
    const year = Number(sourceYear);
    if (!Number.isInteger(year) || !getPlayerAnalysisYears(info.key).includes(year)) {
      return rows;
    }
    const supplements = await loadPlayerAnalysisSupplementPlayers(info.key);
    if (!supplements.length) return rows;
    const existing = new Set((rows || []).map(getPlayerGroupKey).filter(Boolean));
    const nextRows = [...(rows || [])];
    supplements.forEach((meta, index) => {
      if (!meta.seasons.includes(year)) return;
      const row = createPlayerAnalysisSupplementRow(meta, year, index, info.key, absenceMatches);
      const key = getPlayerGroupKey(row);
      if (!key || existing.has(key)) return;
      existing.add(key);
      nextRows.push(row);
    });
    return nextRows.sort((a, b) => (toPlayerNumber(b.played_matches) || 0) - (toPlayerNumber(a.played_matches) || 0)
      || (toPlayerNumber(b.goals) || 0) - (toPlayerNumber(a.goals) || 0)
      || String(a.player_name || "").localeCompare(String(b.player_name || ""), "ja"));
  }

  async function mergePlayerAnalysisSupplementAggregateRows(rows, club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    const supplements = await loadPlayerAnalysisSupplementPlayers(info.key);
    if (!supplements.length) return rows;
    const years = new Set(getPlayerAnalysisYears(info.key));
    const existing = new Set((rows || []).map(getPlayerGroupKey).filter(Boolean));
    const nextRows = [...(rows || [])];
    supplements.forEach((meta, index) => {
      const activeYears = meta.seasons.filter(year => years.has(year));
      if (!activeYears.length) return;
      const sample = createPlayerAnalysisSupplementRow(meta, activeYears[0], index, info.key);
      const key = getPlayerGroupKey(sample);
      if (!key || existing.has(key)) return;
      existing.add(key);
      const aggregate = aggregatePlayerAnalysisRows(activeYears.map(year => createPlayerAnalysisSupplementRow(meta, year, index, info.key)))[0];
      if (aggregate) nextRows.push(aggregate);
    });
    return nextRows;
  }

  function setPlayerAnalysisStatus(message, isActive = true) {
    const { status } = getPlayerAnalysisElements();
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("active", Boolean(isActive && message));
  }

  async function loadPlayerAnalysisYear(year, club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    const normalizedYear = Number(year);
    if (!Number.isInteger(normalizedYear) || !getPlayerAnalysisYears(info.key).includes(normalizedYear)) {
      return { rows: [], missing: true };
    }
    const cacheKey = `${info.key}:${normalizedYear}`;
    if (playerAnalysisCache.has(cacheKey)) {
      return playerAnalysisCache.get(cacheKey);
    }

    const entry = { rows: [], missing: false };
    try {
      const res = await fetch(`./data/generated/${info.dataDir}/${normalizedYear}/player_analysis.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      entry.rows = await mergePlayerAnalysisSupplementRows(normalizePlayerAnalysisRows(payload, normalizedYear), normalizedYear, info.key);
      entry.missing = entry.rows.length === 0;
    } catch (error) {
      console.error(`Failed to load player analysis for ${info.key} ${normalizedYear}`, error);
      entry.rows = [];
      entry.missing = true;
      entry.error = error;
    }
    playerAnalysisCache.set(cacheKey, entry);
    return entry;
  }

  async function loadAllPlayerAnalysisYearRows(club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    if (!playerAnalysisAllYearRowsCache.has(info.key)) {
      playerAnalysisAllYearRowsCache.set(info.key, (async () => {
      const entry = { rows: [], missing: false };
      try {
        const res = await fetch(`./data/generated/${info.dataDir}/all_years_player_analysis.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        entry.rows = await mergePlayerAnalysisSupplementAggregateRows(normalizePlayerAnalysisRows(payload, null), info.key);
        entry.missing = entry.rows.length === 0;
      } catch (error) {
        console.error(`Failed to load all years player analysis for ${info.key}`, error);
        entry.rows = [];
        entry.missing = true;
        entry.error = error;
      }
      return entry;
      })());
    }
    return playerAnalysisAllYearRowsCache.get(info.key);
  }

  function getPlayerAnalysisScopeLabel(scope = playerAnalysisState.matchScope) {
    if (String(scope || "").startsWith("cat:")) {
      const categories = getPlayerAnalysisCategoriesForScope(scope);
      if (!categories.length) return "対象なし";
      return categories.map(getPlayerAnalysisCategoryLabel).join(" / ");
    }
    if (scope === "special") return "特別試合";
    return scope === "league" ? "リーグ戦のみ" : "カップ含む全試合";
  }

  function getPlayerAnalysisCompetition(match) {
    return `${String((match && (match.competition || match.tournament)) || "")} ${String((match && (match.section || match.stage)) || "")}`.normalize("NFKC");
  }

  function getPlayerAnalysisCompetitionName(match) {
    return String((match && (match.competition || match.tournament)) || "").normalize("NFKC").trim();
  }

  function isPlayerAnalysisBlankCompetitionMatch(match) {
    return !getPlayerAnalysisCompetitionName(match);
  }

  function isPlayerAnalysisSpecialMatch(match) {
    return isPlayerAnalysisBlankCompetitionMatch(match)
      || /エリート|サテライト|ELITE|SATELLITE/i.test(getPlayerAnalysisCompetition(match));
  }

  function isPlayerAnalysisNamedSpecialMatch(match) {
    return /エリート|サテライト|ELITE|SATELLITE/i.test(getPlayerAnalysisCompetition(match));
  }

  function isPlayerAnalysisCupMatch(match) {
    const competition = getPlayerAnalysisCompetition(match);
    if (!competition || isPlayerAnalysisNamedSpecialMatch(match)) return false;
    return /百年構想|100年構想|カップ|ナビスコ|ルヴァン|天皇杯|スーパーカップ|ACL/i.test(competition);
  }

  function isPlayerAnalysisLeagueMatch(match) {
    if (isPlayerAnalysisNamedSpecialMatch(match) || isPlayerAnalysisBlankCompetitionMatch(match)) return false;
    const competition = getPlayerAnalysisCompetition(match).trim();
    if (/百年構想|100年構想|カップ|ナビスコ|ルヴァン|天皇杯|スーパーカップ|プレシーズン|親善/.test(competition)) return false;
    return /リーグ|ディビジョン|J1|J2|J3|Ｊ1|Ｊ2|Ｊ3/.test(competition);
  }

  function getPlayerAnalysisMatchCategory(match) {
    if (isPlayerAnalysisSpecialMatch(match)) return "special";
    if (isPlayerAnalysisCupMatch(match)) return "cup";
    if (isPlayerAnalysisLeagueMatch(match)) return "league";
    return "special";
  }

  function getPlayerAnalysisCategoryLabel(category) {
    if (category === "league") return "リーグ";
    if (category === "cup") return "カップ";
    if (category === "special") return "特別試合";
    return category || "";
  }

  function getPlayerAnalysisCategoriesForScope(scope = playerAnalysisState.matchScope) {
    const text = String(scope || "all");
    if (text.startsWith("cat:")) {
      return text.slice(4).split(",").map(item => item.trim()).filter(Boolean);
    }
    if (text === "league") return ["league"];
    if (text === "special") return ["special"];
    return ["league", "cup"];
  }

  function getPlayerAnalysisCategoryScope(categories) {
    const allowed = ["league", "cup", "special"];
    const unique = Array.from(new Set((categories || []).filter(category => allowed.includes(category))));
    return `cat:${unique.join(",")}`;
  }

  function isPlayerAnalysisScopeMatch(match, scope = playerAnalysisState.matchScope, competitionNames = null) {
    const category = getPlayerAnalysisMatchCategory(match);
    if (!getPlayerAnalysisCategoriesForScope(scope).includes(category)) return false;
    if (!Array.isArray(competitionNames)) return true;
    return competitionNames.includes(getPlayerAnalysisCompetitionFilterName(match));
  }

  function getPlayerAnalysisCompetitionFilterName(match) {
    const name = getPlayerAnalysisCompetitionName(match);
    return name || "特別試合";
  }

  function normalizePlayerAnalysisCompetitionFilter(names) {
    if (!Array.isArray(names)) return null;
    return Array.from(new Set(names.map(name => String(name || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja"));
  }

  function getActivePlayerAnalysisCompetitionFilter() {
    return playerAnalysisState.competitionFilterActive
      ? normalizePlayerAnalysisCompetitionFilter(playerAnalysisState.selectedCompetitions) || []
      : null;
  }

  function getPlayerAnalysisCompetitionFilterKey(competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    if (!Array.isArray(competitionNames)) return "all";
    if (!competitionNames.length) return "none";
    return normalizePlayerAnalysisCompetitionFilter(competitionNames).join("\u001f");
  }

  function getPlayerAnalysisFilterCacheKey(scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    return `${getPlayerAnalysisClub()}:${scope}:${getPlayerAnalysisCompetitionFilterKey(competitionNames)}`;
  }

  async function getPlayerAnalysisAvailableCompetitions(year = playerAnalysisState.year, scope = playerAnalysisState.matchScope) {
    const years = Array.isArray(year) ? year.map(Number).filter(Number.isInteger) : (year === "all" ? getPlayerAnalysisYears() : [Number(year)]);
    const names = new Set();
    for (const targetYear of years) {
      if (!Number.isInteger(targetYear)) continue;
      const dataset = await loadPlayerAnalysisDatasetYear(targetYear);
      if (dataset.missing) continue;
      (dataset.matches || []).forEach(match => {
        if (isPlayerAnalysisScopeMatch(match, scope, null)) {
          names.add(getPlayerAnalysisCompetitionFilterName(match));
        }
      });
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
  }

  function renderPlayerAnalysisCompetitionOptions(available = playerAnalysisState.availableCompetitions) {
    const { competitionOptions } = getPlayerAnalysisElements();
    if (!competitionOptions) return;
    playerAnalysisState.availableCompetitions = available;
    const activeFilter = getActivePlayerAnalysisCompetitionFilter();
    const selected = Array.isArray(activeFilter) ? activeFilter : available;
    if (!available.length) {
      competitionOptions.innerHTML = `<span class="pa-position-empty">大会データなし</span>`;
      return;
    }
    competitionOptions.innerHTML = available.map(name => {
      const checked = selected.includes(name);
      return `
        <label class="pa-competition-check">
          <input type="checkbox" value="${escapeHtml(name)}" ${checked ? "checked" : ""}>
          <span>${escapeHtml(name)}</span>
        </label>
      `;
    }).join("");
  }

  function readPlayerAnalysisCompetitionOptions() {
    const { competitionOptions } = getPlayerAnalysisElements();
    if (!competitionOptions) return;
    playerAnalysisState.competitionFilterActive = true;
    playerAnalysisState.selectedCompetitions = Array.from(competitionOptions.querySelectorAll("input[type='checkbox']:checked"))
      .map(input => input.value)
      .filter(Boolean);
  }

  async function loadPlayerAnalysisDatasetYear(year, club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    const normalizedYear = Number(year);
    if (!Number.isInteger(normalizedYear) || !getPlayerAnalysisYears(info.key).includes(normalizedYear)) {
      return { matches: [], appearances: [], goals: [], cards: [], missing: true };
    }
    const cacheKey = `${info.key}:${normalizedYear}`;
    if (playerAnalysisDatasetCache.has(cacheKey)) {
      return playerAnalysisDatasetCache.get(cacheKey);
    }

    const loadPart = async (name) => {
      const res = await fetch(`./data/generated/${info.dataDir}/${normalizedYear}/${name}.json`);
      if (!res.ok) throw new Error(`${name}.json HTTP ${res.status}`);
      const payload = normalizeAsciiFieldsInPlace(await res.json());
      return Array.isArray(payload) ? payload : [];
    };

    const entry = { matches: [], appearances: [], goals: [], cards: [], missing: false };
    try {
      const [matches, appearances, goals, cards] = await Promise.all([
        loadPart("matches"),
        loadPart("appearances"),
        loadPart("goals"),
        loadPart("cards")
      ]);
      entry.matches = matches;
      entry.appearances = appearances;
      entry.goals = goals;
      entry.cards = cards;
      entry.missing = matches.length === 0;
    } catch (error) {
      console.error(`Failed to load generated player datasets for ${info.key} ${normalizedYear}`, error);
      entry.missing = true;
      entry.error = error;
    }

    playerAnalysisDatasetCache.set(cacheKey, entry);
    return entry;
  }

  async function loadPlayerAnalysisHistoryYear(year, club = playerAnalysisState.selectedClub) {
    const info = getPlayerAnalysisClubInfo(club);
    const normalizedYear = Number(year);
    if (!Number.isInteger(normalizedYear) || !getPlayerAnalysisYears(info.key).includes(normalizedYear)) return [];
    const cacheKey = `${info.key}:${normalizedYear}`;
    if (playerAnalysisHistoryCache.has(cacheKey)) return playerAnalysisHistoryCache.get(cacheKey);
    const promise = (async () => {
      try {
        const res = await fetch(`./data/history/${info.dataDir}/${normalizedYear}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = normalizeAsciiFieldsInPlace(await res.json());
        return Array.isArray(payload) ? payload : [];
      } catch (error) {
        console.warn(`Failed to load player analysis history for ${info.key} ${normalizedYear}`, error);
        return [];
      }
    })();
    playerAnalysisHistoryCache.set(cacheKey, promise);
    return promise;
  }

  function findPlayerAnalysisHistoryMatch(historyMatches, match) {
    if (!match) return null;
    const matchId = String(match.match_id || "");
    const date = toIsoDate(match.date || "");
    const homeTeam = String(match.home_team || "").normalize("NFKC");
    const awayTeam = String(match.away_team || "").normalize("NFKC");
    return (historyMatches || []).find(item => String(item.match_card_id || item.match_id || "") === matchId)
      || (historyMatches || []).find(item => {
        if (toIsoDate(item.date || "") !== date) return false;
        const historyHome = String(item.home_team || "").normalize("NFKC");
        const historyAway = String(item.away_team || "").normalize("NFKC");
        return (!homeTeam || robustTeamMatch(historyHome, homeTeam))
          && (!awayTeam || robustTeamMatch(historyAway, awayTeam));
      })
      || null;
  }

  function parsePlayerGoalEventMinute(goal) {
    const raw = String((goal && (goal.time || goal.minute_text || goal.minute)) || "").normalize("NFKC");
    const add = raw.match(/(\d+)\s*['’′]?\s*\+\s*(\d+)/);
    if (add) return Number(add[1]) + Number(add[2]);
    const minute = toPlayerNumber(goal && goal.minute);
    if (minute !== null) return minute;
    const direct = raw.match(/\d+/);
    return direct ? Number(direct[0]) : null;
  }

  function getPlayerAnalysisGoalEventsForMatch(match, historyMatch, datasetGoals = []) {
    if (!match) return [];
    if (historyMatch) {
      const ownSide = match.target_side === "home" ? "home" : "away";
      const goalsFor = Array.isArray(historyMatch[`${ownSide}_goals`]) ? historyMatch[`${ownSide}_goals`] : [];
      const opponentGoals = Array.isArray(historyMatch[ownSide === "home" ? "away_goals" : "home_goals"])
        ? historyMatch[ownSide === "home" ? "away_goals" : "home_goals"]
        : [];
      return [
        ...goalsFor.map(goal => ({ side: "for", minute: parsePlayerGoalEventMinute(goal) })),
        ...opponentGoals.map(goal => ({ side: "against", minute: parsePlayerGoalEventMinute(goal) }))
      ].filter(event => event.minute !== null);
    }
    return (datasetGoals || [])
      .filter(goal => String(goal.match_id) === String(match.match_id) && !goal.is_own_goal)
      .map(goal => ({ side: "for", minute: parsePlayerGoalEventMinute(goal) }))
      .filter(event => event.minute !== null);
  }

  function createPlayerAnalysisCounter() {
    return { matches: 0, wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
  }

  function addPlayerAnalysisResult(counter, result, points, match = null) {
    if (!counter) return;
    counter.matches += 1;
    if (result === "win") counter.wins += 1;
    else if (result === "draw") counter.draws += 1;
    else if (result === "loss") counter.losses += 1;
    counter.points += toPlayerNumber(points) || (result === "win" ? 3 : result === "draw" ? 1 : 0);
    if (match) {
      const goalsFor = toPlayerNumber(match.target_score) || 0;
      const goalsAgainst = toPlayerNumber(match.opponent_score) || 0;
      counter.goalsFor += goalsFor;
      counter.goalsAgainst += goalsAgainst;
      counter.goalDiff += goalsFor - goalsAgainst;
    }
  }

  function createPlayerAnalysisCounterFromMatches(matches = []) {
    const counter = createPlayerAnalysisCounter();
    (Array.isArray(matches) ? matches : []).forEach(match => {
      addPlayerAnalysisResult(counter, match && match.result, match && match.points, match);
    });
    return counter;
  }

  function assignPlayerAnalysisCounterFields(target, prefix, counter) {
    const source = counter || createPlayerAnalysisCounter();
    target[`${prefix}_matches`] = source.matches;
    target[`${prefix}_wins`] = source.wins;
    target[`${prefix}_draws`] = source.draws;
    target[`${prefix}_losses`] = source.losses;
    target[`${prefix}_points`] = source.points;
    target[`${prefix}_win_rate`] = calculatePlayerRate(source.wins, source.matches);
    target[`${prefix}_points_per_match`] = calculatePlayerPointsPerMatch(source.wins, source.draws, source.matches);
    target[`${prefix}_goals_for`] = source.goalsFor;
    target[`${prefix}_goals_against`] = source.goalsAgainst;
    target[`${prefix}_goal_diff`] = source.goalDiff;
  }

  function sortPlayerPositions(values) {
    return [...values].sort((a, b) => {
      const ai = PLAYER_POSITION_ORDER.indexOf(String(a || "").trim());
      const bi = PLAYER_POSITION_ORDER.indexOf(String(b || "").trim());
      const ao = ai === -1 ? PLAYER_POSITION_ORDER.length : ai;
      const bo = bi === -1 ? PLAYER_POSITION_ORDER.length : bi;
      return ao - bo || String(a || "").localeCompare(String(b || ""), "ja");
    });
  }

  function ensureScopedPlayer(map, source) {
    const identity = getPlayerCanonicalIdentity(source, source && source.season);
    const key = String(identity.groupKey || (source && (source.player_key || source.player_name)) || "").trim();
    if (!key) return null;
    if (!map.has(key)) {
      const clubInfo = getPlayerAnalysisClubInfo();
      map.set(key, {
        season: source.season,
        team: clubInfo.name,
        player_key: identity.key || source.player_key || source.player_name || key,
        player_name: identity.name || source.player_name || source.player_key || key,
        group_key: identity.groupKey || key,
        numbers: new Set(),
        positions: new Set(),
        played: createPlayerAnalysisCounter(),
        playedMatchIds: new Set(),
        starterMatchIds: new Set(),
        played_goals_against: 0,
        played_clean_sheets: 0,
        starter: createPlayerAnalysisCounter(),
        non_starter: createPlayerAnalysisCounter(),
        sub: createPlayerAnalysisCounter(),
        bench_only: createPlayerAnalysisCounter(),
        non_played: createPlayerAnalysisCounter(),
        scored: createPlayerAnalysisCounter(),
        scoredMatchIds: new Set(),
        carded: createPlayerAnalysisCounter(),
        cardedMatchIds: new Set(),
        goals: 0,
        yellow_cards: 0,
        red_cards: 0
      });
    }
    const player = map.get(key);
    if (identity.name) player.player_name = identity.name;
    if (identity.key) player.player_key = identity.key;
    if (source.number) player.numbers.add(String(source.number));
    if (source.position) player.positions.add(String(source.position));
    return player;
  }

  function finalizeScopedPlayerRows(playersMap, sourceYear) {
    const clubInfo = getPlayerAnalysisClubInfo();
    return Array.from(playersMap.values()).map((player, index) => {
      const row = {
        season: Number(sourceYear),
        team: clubInfo.name,
        player_key: player.player_key,
        player_name: player.player_name,
        numbers: Array.from(player.numbers).filter(Boolean).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "ja")),
        positions: sortPlayerPositions(Array.from(player.positions).filter(Boolean)),
        played_matches: player.played.matches,
        played_wins: player.played.wins,
        played_draws: player.played.draws,
        played_losses: player.played.losses,
        played_win_rate: calculatePlayerRate(player.played.wins, player.played.matches),
        played_points_per_match: calculatePlayerPointsPerMatch(player.played.wins, player.played.draws, player.played.matches),
        played_goals_against: player.played_goals_against,
        played_goals_against_avg: calculatePlayerAveragePerMatch(player.played_goals_against, player.played.matches),
        played_clean_sheets: player.played_clean_sheets,
        starter_matches: player.starter.matches,
        starter_wins: player.starter.wins,
        starter_draws: player.starter.draws,
        starter_losses: player.starter.losses,
        starter_win_rate: calculatePlayerRate(player.starter.wins, player.starter.matches),
        starter_points_per_match: calculatePlayerPointsPerMatch(player.starter.wins, player.starter.draws, player.starter.matches),
        non_starter_matches: player.non_starter.matches,
        non_starter_wins: player.non_starter.wins,
        non_starter_draws: player.non_starter.draws,
        non_starter_losses: player.non_starter.losses,
        non_starter_win_rate: calculatePlayerRate(player.non_starter.wins, player.non_starter.matches),
        non_starter_points_per_match: calculatePlayerPointsPerMatch(player.non_starter.wins, player.non_starter.draws, player.non_starter.matches),
        sub_matches: player.sub.matches,
        sub_wins: player.sub.wins,
        sub_draws: player.sub.draws,
        sub_losses: player.sub.losses,
        sub_win_rate: calculatePlayerRate(player.sub.wins, player.sub.matches),
        sub_points_per_match: calculatePlayerPointsPerMatch(player.sub.wins, player.sub.draws, player.sub.matches),
        bench_only_matches: player.bench_only.matches,
        non_played_matches: player.non_played.matches,
        non_played_wins: player.non_played.wins,
        non_played_draws: player.non_played.draws,
        non_played_losses: player.non_played.losses,
        non_played_win_rate: calculatePlayerRate(player.non_played.wins, player.non_played.matches),
        non_played_points_per_match: calculatePlayerPointsPerMatch(player.non_played.wins, player.non_played.draws, player.non_played.matches),
        goals: player.goals,
        scored_matches: player.scoredMatchIds.size,
        scored_wins: player.scored.wins,
        scored_draws: player.scored.draws,
        scored_losses: player.scored.losses,
        scored_win_rate: calculatePlayerRate(player.scored.wins, player.scored.matches),
        scored_points_per_match: calculatePlayerPointsPerMatch(player.scored.wins, player.scored.draws, player.scored.matches),
        yellow_cards: player.yellow_cards,
        red_cards: player.red_cards,
        carded_matches: player.cardedMatchIds.size,
        carded_wins: player.carded.wins,
        carded_draws: player.carded.draws,
        carded_losses: player.carded.losses,
        carded_win_rate: calculatePlayerRate(player.carded.wins, player.carded.matches),
        __paSourceYear: Number(sourceYear),
        __paIndex: index,
        __paGroupKey: player.group_key || getPlayerCanonicalIdentity(player, sourceYear).groupKey
      };
      assignPlayerAnalysisCounterFields(row, "played", player.played);
      row.played_goals_against_avg = calculatePlayerAveragePerMatch(player.played_goals_against, player.played.matches);
      row.played_clean_sheets = player.played_clean_sheets;
      assignPlayerAnalysisCounterFields(row, "starter", player.starter);
      assignPlayerAnalysisCounterFields(row, "non_starter", player.non_starter);
      assignPlayerAnalysisCounterFields(row, "sub", player.sub);
      assignPlayerAnalysisCounterFields(row, "non_played", player.non_played);
      assignPlayerAnalysisCounterFields(row, "scored", player.scored);
      assignPlayerAnalysisCounterFields(row, "carded", player.carded);
      row.__paKey = `${row.__paGroupKey || row.player_key || row.player_name || "player"}-${index}`;
      return row;
    }).sort((a, b) => (toPlayerNumber(b.played_matches) || 0) - (toPlayerNumber(a.played_matches) || 0)
      || (toPlayerNumber(b.goals) || 0) - (toPlayerNumber(a.goals) || 0)
      || String(a.player_name || "").localeCompare(String(b.player_name || ""), "ja"));
  }

  function buildScopedPlayerAnalysisRows(dataset, sourceYear, scope, competitionNames = null) {
    const targetMatches = (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
    const matchMap = new Map(targetMatches.map(match => [String(match.match_id), match]));
    const players = new Map();

    (dataset.appearances || []).forEach(appearance => {
      const match = matchMap.get(String(appearance.match_id));
      if (!match) return;
      const player = ensureScopedPlayer(players, appearance);
      if (!player) return;
      if (appearance.played) {
        const matchId = String(appearance.match_id);
        const opponentScore = toPlayerNumber(match.opponent_score) || 0;
        player.playedMatchIds.add(matchId);
        if (appearance.starter) player.starterMatchIds.add(matchId);
        player.played_goals_against += opponentScore;
        if (opponentScore === 0) player.played_clean_sheets += 1;
        addPlayerAnalysisResult(player.played, match.result, match.points, match);
        if (appearance.starter) addPlayerAnalysisResult(player.starter, match.result, match.points, match);
        else if (appearance.sub_in) addPlayerAnalysisResult(player.sub, match.result, match.points, match);
      } else if (appearance.bench) {
        addPlayerAnalysisResult(player.bench_only, match.result, match.points, match);
      }
    });

    players.forEach(player => {
      targetMatches.forEach(match => {
        const matchId = String(match.match_id);
        if (!player.playedMatchIds.has(matchId)) {
          addPlayerAnalysisResult(player.non_played, match.result, match.points, match);
        }
        if (!player.starterMatchIds.has(matchId)) {
          addPlayerAnalysisResult(player.non_starter, match.result, match.points, match);
        }
      });
    });

    const scoredOnce = new Set();
    (dataset.goals || []).forEach(goal => {
      const match = matchMap.get(String(goal.match_id));
      if (!match || goal.is_own_goal || !goal.player_key) return;
      const player = ensureScopedPlayer(players, goal);
      if (!player) return;
      player.goals += 1;
      player.scoredMatchIds.add(String(goal.match_id));
      const scoredKey = `${goal.player_key}|${goal.match_id}`;
      if (!scoredOnce.has(scoredKey)) {
        addPlayerAnalysisResult(player.scored, match.result, match.points, match);
        scoredOnce.add(scoredKey);
      }
    });

    const cardedOnce = new Set();
    (dataset.cards || []).forEach(card => {
      const match = matchMap.get(String(card.match_id));
      if (!match || !card.player_key) return;
      const player = ensureScopedPlayer(players, card);
      if (!player) return;
      const type = String(card.type || "");
      if (type.includes("退場")) player.red_cards += 1;
      else if (type.includes("警告")) player.yellow_cards += 1;
      player.cardedMatchIds.add(String(card.match_id));
      const cardKey = `${card.player_key}|${card.match_id}`;
      if (!cardedOnce.has(cardKey)) {
        addPlayerAnalysisResult(player.carded, match.result, match.points, match);
        cardedOnce.add(cardKey);
      }
    });

    return finalizeScopedPlayerRows(players, sourceYear);
  }

  async function loadScopedPlayerAnalysisYear(year, scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const normalizedYear = Number(year);
    const cacheKey = `${normalizedYear}:${getPlayerAnalysisFilterCacheKey(scope, competitionNames)}`;
    if (playerAnalysisScopedCache.has(cacheKey)) return playerAnalysisScopedCache.get(cacheKey);
    const dataset = await loadPlayerAnalysisDatasetYear(normalizedYear);
    const scopedRows = dataset.missing ? [] : buildScopedPlayerAnalysisRows(dataset, normalizedYear, scope, competitionNames);
    const absenceMatches = dataset.missing
      ? []
      : (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
    const rows = await mergePlayerAnalysisSupplementRows(scopedRows, normalizedYear, playerAnalysisState.selectedClub, absenceMatches);
    const entry = {
      rows,
      missing: rows.length === 0
    };
    playerAnalysisScopedCache.set(cacheKey, entry);
    return entry;
  }

  async function hasPlayerAnalysisSpecialMatches(year = playerAnalysisState.year) {
    const cacheKey = `${getPlayerAnalysisClub()}:${Array.isArray(year) ? year.join("-") : year}`;
    if (playerAnalysisSpecialAvailabilityCache.has(cacheKey)) {
      return playerAnalysisSpecialAvailabilityCache.get(cacheKey);
    }
    const years = Array.isArray(year) ? year.map(Number).filter(Number.isInteger) : (year === "all" ? getPlayerAnalysisYears() : [Number(year)]);
    const availability = (async () => {
      for (const targetYear of years) {
        if (!Number.isInteger(targetYear)) continue;
        const dataset = await loadPlayerAnalysisDatasetYear(targetYear);
        if (!dataset.missing && (dataset.matches || []).some(isPlayerAnalysisSpecialMatch)) return true;
      }
      return false;
    })();
    playerAnalysisSpecialAvailabilityCache.set(cacheKey, availability);
    return availability;
  }

  function calculatePlayerRate(wins, matches) {
    const winCount = toPlayerNumber(wins);
    const matchCount = toPlayerNumber(matches);
    if (winCount === null || !matchCount) return null;
    return Math.round((winCount / matchCount) * 1000) / 10;
  }

  function calculatePlayerPointsPerMatch(wins, draws, matches) {
    const winCount = toPlayerNumber(wins) || 0;
    const drawCount = toPlayerNumber(draws) || 0;
    const matchCount = toPlayerNumber(matches);
    if (!matchCount) return null;
    return Math.round(((winCount * 3 + drawCount) / matchCount) * 100) / 100;
  }

  function calculatePlayerAveragePerMatch(total, matches) {
    const totalValue = toPlayerNumber(total) || 0;
    const matchCount = toPlayerNumber(matches);
    if (!matchCount) return null;
    return Math.round((totalValue / matchCount) * 100) / 100;
  }

  function formatPlayerFixed(value, digits = 2) {
    const n = toPlayerNumber(value);
    return n === null ? "-" : n.toFixed(digits);
  }

  function calculatePlayerGoalRate(player) {
    const goals = toPlayerNumber(player && player.goals) || 0;
    const matches = toPlayerNumber(player && player.played_matches) || 0;
    return matches ? goals / matches : null;
  }

  function clampPlayerImpactScore(value) {
    const n = toPlayerNumber(value);
    if (n === null) return null;
    return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
  }

  function getPlayerImpactScales(rows = playerAnalysisState.data) {
    const players = Array.isArray(rows) ? rows : [];
    const maxGoals = Math.max(0, ...players.map(player => toPlayerNumber(player && player.goals) || 0));
    const maxGoalRate = Math.max(0, ...players.map(player => calculatePlayerGoalRate(player) || 0));
    const maxImportantGoalPoints = Math.max(0, ...players.map(player => {
      const metrics = player && player.__paRankingMetrics ? player.__paRankingMetrics : {};
      return toPlayerNumber(metrics.important_goal_points) || 0;
    }));
    const goalsAgainstAverages = players
      .map(player => toPlayerNumber(player && player.__paRankingMetrics && player.__paRankingMetrics.played_goals_against_avg))
      .filter(value => value !== null);
    const maxGoalsAgainstAvg = goalsAgainstAverages.length ? Math.max(...goalsAgainstAverages) : null;
    const minGoalsAgainstAvg = goalsAgainstAverages.length ? Math.min(...goalsAgainstAverages) : null;
    return { maxGoals, maxGoalRate, maxImportantGoalPoints, maxGoalsAgainstAvg, minGoalsAgainstAvg };
  }

  function normalizePlayerImpactPart(value, maxValue, points) {
    const n = toPlayerNumber(value);
    const max = toPlayerNumber(maxValue);
    if (n === null || max === null || max <= 0) return 0;
    return Math.max(0, Math.min(points, (n / max) * points));
  }

  function calculatePlayerImpactScores(player, scales = getPlayerImpactScales()) {
    const playedMatches = toPlayerNumber(player && player.played_matches) || 0;
    if (!playedMatches) {
      return { attack: null, defense: null, total: null };
    }
    const metrics = player && player.__paRankingMetrics ? player.__paRankingMetrics : {};
    const goals = toPlayerNumber(player && player.goals) || 0;
    const goalRate = calculatePlayerGoalRate(player) || 0;
    const importantGoalPoints = toPlayerNumber(metrics.important_goal_points) || 0;
    const scoredWinRate = (toPlayerNumber(player && player.scored_win_rate) || 0) / 100;
    const appearanceCorrection = Math.min(playedMatches / 30, 1);
    const attack = clampPlayerImpactScore(
      normalizePlayerImpactPart(goals, scales.maxGoals, 25)
      + normalizePlayerImpactPart(goalRate, scales.maxGoalRate, 20)
      + normalizePlayerImpactPart(importantGoalPoints, scales.maxImportantGoalPoints, 30)
      + (scoredWinRate * 15)
      + (appearanceCorrection * 10)
    );

    const goalsAgainstAvg = toPlayerNumber(hasPlayerValue(metrics.played_goals_against_avg)
      ? metrics.played_goals_against_avg
      : player && player.played_goals_against_avg);
    let goalsAgainstScore = null;
    if (goalsAgainstAvg !== null && scales.maxGoalsAgainstAvg !== null) {
      goalsAgainstScore = scales.maxGoalsAgainstAvg === scales.minGoalsAgainstAvg
        ? 40
        : ((scales.maxGoalsAgainstAvg - goalsAgainstAvg) / (scales.maxGoalsAgainstAvg - scales.minGoalsAgainstAvg)) * 40;
    }
    const cleanSheets = hasPlayerValue(metrics.played_clean_sheets)
      ? metrics.played_clean_sheets
      : player && player.played_clean_sheets;
    const cleanSheetRate = playedMatches ? (toPlayerNumber(cleanSheets) || 0) / playedMatches : null;
    const nonLossRate = playedMatches ? ((toPlayerNumber(player && player.played_wins) || 0) + (toPlayerNumber(player && player.played_draws) || 0)) / playedMatches : null;
    const defense = goalsAgainstScore === null
      ? null
      : clampPlayerImpactScore(
        goalsAgainstScore
        + ((cleanSheetRate || 0) * 30)
        + ((nonLossRate || 0) * 20)
        + (appearanceCorrection * 10)
      );

    const total = attack === null || defense === null ? null : clampPlayerImpactScore((attack + defense) / 2);
    return { attack, defense, total };
  }

  function ensurePlayerImpactScores(rows) {
    const targets = Array.isArray(rows) ? rows : [];
    const scales = getPlayerImpactScales(targets);
    targets.forEach(player => {
      player.__paImpact = calculatePlayerImpactScores(player, scales);
    });
  }

  function getPlayerImpactValue(player, type = "total") {
    const key = type === "attack" ? "attack" : type === "defense" ? "defense" : "total";
    if (player && player.__paImpact && hasPlayerValue(player.__paImpact[key])) return player.__paImpact[key];
    return calculatePlayerImpactScores(player)[key];
  }

  function formatPlayerImpactScore(player, type = "total") {
    const score = getPlayerImpactValue(player, type);
    return score === null ? "データ不足" : score.toFixed(1);
  }

  function getPlayerAnalysisYearsForPlayers(players, yearRows = null) {
    const years = new Set();
    const rows = Array.isArray(yearRows) ? yearRows : [];
    rows.forEach(row => {
      const year = getPlayerYearValue(row);
      if (year) years.add(year);
    });
    (players || []).forEach(player => {
      if (Array.isArray(player && player.__paYearRows)) {
        player.__paYearRows.forEach(row => {
          const year = getPlayerYearValue(row);
          if (year) years.add(year);
        });
      }
      if (Array.isArray(player && player.seasons)) {
        player.seasons.forEach(year => {
          const n = Number(year);
          if (Number.isInteger(n)) years.add(n);
        });
      }
      const directYear = getPlayerYearValue(player);
      if (directYear) years.add(directYear);
    });
    if (!years.size) {
      if (playerAnalysisState.timeMode === "range" || playerAnalysisState.year === "all") {
        getPlayerAnalysisTimeYears().forEach(year => years.add(year));
      } else {
        const year = Number(playerAnalysisState.year);
        if (Number.isInteger(year)) years.add(year);
      }
    }
    return Array.from(years).sort((a, b) => a - b);
  }

  function normalizeOpponentClubName(name) {
    const normalized = String(name || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
    const compact = normalized.replace(/[\s　・･.]/g, "").toLowerCase();
    const aliases = new Map([
      ["コンサドーレ札幌", "北海道コンサドーレ札幌"],
      ["北海道コンサドーレ札幌", "北海道コンサドーレ札幌"],
      ["札幌", "北海道コンサドーレ札幌"],
      ["東京ヴェルディ1969", "東京ヴェルディ"],
      ["東京ヴェルディ", "東京ヴェルディ"],
      ["ヴェルディ川崎", "東京ヴェルディ"],
      ["東京v", "東京ヴェルディ"],
      ["京都パープルサンガ", "京都サンガF.C."],
      ["京都サンガfc", "京都サンガF.C."],
      ["京都サンガf.c.", "京都サンガF.C."],
      ["京都サンガ", "京都サンガF.C."],
      ["京都", "京都サンガF.C."],
      ["名古屋グランパスエイト", "名古屋グランパス"],
      ["名古屋グランパス", "名古屋グランパス"],
      ["名古屋", "名古屋グランパス"],
      ["ジェフユナイテッド市原", "ジェフユナイテッド千葉"],
      ["ジェフユナイテッド市原千葉", "ジェフユナイテッド千葉"],
      ["ジェフユナイテッド千葉", "ジェフユナイテッド千葉"],
      ["ジェフ千葉", "ジェフユナイテッド千葉"],
      ["市原", "ジェフユナイテッド千葉"],
      ["千葉", "ジェフユナイテッド千葉"]
    ]);
    return aliases.get(compact) || normalized;
  }

  function createPlayerMatchStats() {
    return { matches: 0, wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
  }

  function addMatchToPlayerStats(stats, match) {
    if (!stats || !match) return;
    stats.matches += 1;
    if (match.result === "win") stats.wins += 1;
    else if (match.result === "draw") stats.draws += 1;
    else if (match.result === "loss") stats.losses += 1;
    stats.points += toPlayerNumber(match.points) || (match.result === "win" ? 3 : match.result === "draw" ? 1 : 0);
    const goalsFor = toPlayerNumber(match.target_score) || 0;
    const goalsAgainst = toPlayerNumber(match.opponent_score) || 0;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    stats.goalDiff += goalsFor - goalsAgainst;
  }

  function finalizePlayerMatchStats(stats) {
    const matches = toPlayerNumber(stats && stats.matches) || 0;
    return {
      ...stats,
      winRate: calculatePlayerRate(stats && stats.wins, matches),
      pointsPerMatch: matches ? Math.round(((stats.points || 0) / matches) * 100) / 100 : null,
      goalsForAvg: matches ? Math.round(((stats.goalsFor || 0) / matches) * 100) / 100 : null,
      goalsAgainstAvg: matches ? Math.round(((stats.goalsAgainst || 0) / matches) * 100) / 100 : null
    };
  }

  async function buildPlayerAnalysisTeamStats(yearValue = getPlayerAnalysisTimeValue(), scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const years = Array.isArray(yearValue)
      ? yearValue.map(Number).filter(Number.isInteger)
      : (yearValue === "all" ? getPlayerAnalysisYears() : [Number(yearValue)].filter(Number.isInteger));
    const stats = { ...createPlayerMatchStats(), cleanSheets: 0 };
    for (const year of years) {
      const dataset = await loadPlayerAnalysisDatasetYear(year);
      if (dataset.missing) continue;
      (dataset.matches || []).forEach(match => {
        if (!isPlayerAnalysisScopeMatch(match, scope, competitionNames)) return;
        addMatchToPlayerStats(stats, match);
        if ((toPlayerNumber(match.opponent_score) || 0) === 0) stats.cleanSheets += 1;
      });
    }
    return finalizePlayerMatchStats(stats);
  }

  async function buildPlayerPerformanceExtras(player, yearRows = null, scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const groupKey = getPlayerGroupKey(player);
    const opponentMap = new Map();
    const gkOpponentMap = new Map();
    const years = getPlayerAnalysisYearsForPlayers([player], yearRows);
    let homeGoals = 0;
    let awayGoals = 0;

    for (const year of years) {
      const dataset = await loadPlayerAnalysisDatasetYear(year);
      if (dataset.missing) continue;
      const matches = (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
      const matchMap = new Map(matches.map(match => [String(match.match_id), match]));
      (dataset.goals || []).forEach(goal => {
        if (goal.is_own_goal || getPlayerCanonicalIdentity(goal, year).groupKey !== groupKey) return;
        const match = matchMap.get(String(goal.match_id));
        if (!match) return;
        if (match.target_side === "home") homeGoals += 1;
        else if (match.target_side === "away") awayGoals += 1;
        const opponent = normalizeOpponentClubName(match.opponent) || "-";
        if (!opponentMap.has(opponent)) {
          opponentMap.set(opponent, {
            opponent,
            goals: 0,
            scoredMatchIds: new Set(),
            wins: 0,
            draws: 0,
            losses: 0
          });
        }
        const stats = opponentMap.get(opponent);
        stats.goals += 1;
        const matchId = String(match.match_id);
        if (!stats.scoredMatchIds.has(matchId)) {
          stats.scoredMatchIds.add(matchId);
          if (match.result === "win") stats.wins += 1;
          else if (match.result === "draw") stats.draws += 1;
          else if (match.result === "loss") stats.losses += 1;
        }
      });

      (dataset.appearances || []).forEach(appearance => {
        if (getPlayerCanonicalIdentity(appearance, year).groupKey !== groupKey) return;
        if (String(appearance.position || "").trim() !== "GK") return;
        if (!isPlayerAppearancePlayedForCombination(appearance)) return;
        const match = matchMap.get(String(appearance.match_id));
        if (!match) return;
        const opponent = normalizeOpponentClubName(match.opponent) || "-";
        if (!gkOpponentMap.has(opponent)) {
          gkOpponentMap.set(opponent, {
            opponent,
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsAgainst: 0
          });
        }
        const stats = gkOpponentMap.get(opponent);
        stats.matches += 1;
        stats.goalsAgainst += toPlayerNumber(match.opponent_score) || 0;
        if (match.result === "win") stats.wins += 1;
        else if (match.result === "draw") stats.draws += 1;
        else if (match.result === "loss") stats.losses += 1;
      });
    }

    const opponentGoals = Array.from(opponentMap.values()).map(stats => {
      const scoredMatches = stats.scoredMatchIds.size;
      return {
        opponent: stats.opponent,
        goals: stats.goals,
        scoredMatches,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        winRate: calculatePlayerRate(stats.wins, scoredMatches)
      };
    }).sort((a, b) => b.goals - a.goals
      || b.scoredMatches - a.scoredMatches
      || a.opponent.localeCompare(b.opponent, "ja"));

    const opponentDefense = Array.from(gkOpponentMap.values()).map(stats => ({
      opponent: stats.opponent,
      matches: stats.matches,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      goalsAgainst: stats.goalsAgainst,
      goalsAgainstAvg: stats.matches ? Math.round((stats.goalsAgainst / stats.matches) * 100) / 100 : null,
      winRate: calculatePlayerRate(stats.wins, stats.matches)
    })).sort((a, b) => {
      const aAvg = toPlayerNumber(a.goalsAgainstAvg);
      const bAvg = toPlayerNumber(b.goalsAgainstAvg);
      if (aAvg !== bAvg) return (aAvg ?? Number.POSITIVE_INFINITY) - (bAvg ?? Number.POSITIVE_INFINITY);
      return b.matches - a.matches || a.opponent.localeCompare(b.opponent, "ja");
    });

    return { opponentGoals, opponentDefense, homeGoals, awayGoals, winningGoals: 0 };
  }

  function isPlayerAppearancePlayedForCombination(appearance) {
    if (!appearance || appearance.bench || appearance.played === false) return false;
    const hasMinute = hasPlayerValue(appearance.minute_in) || hasPlayerValue(appearance.minute_out);
    if (hasMinute) return calculatePlayerAppearanceMinutes(appearance) >= 1;
    if (appearance.played === true) return true;
    const type = String(appearance.appearance_type || "").normalize("NFKC").toLowerCase();
    if (type.includes("bench")) return false;
    return Boolean(appearance.player_key || appearance.player_name);
  }

  async function getPlayerPlayedMatchEntries(scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter(), yearOverride = playerAnalysisState.year) {
    const targetYearValue = yearOverride || playerAnalysisState.year;
    const yearKey = Array.isArray(targetYearValue) ? targetYearValue.join("-") : targetYearValue;
    const cacheKey = `${getPlayerAnalysisFilterCacheKey(scope, competitionNames)}:${yearKey}`;
    if (playerAnalysisPlayedSetsCache.has(cacheKey)) return playerAnalysisPlayedSetsCache.get(cacheKey);
    const entriesPromise = (async () => {
      const entries = [];
      const years = Array.isArray(targetYearValue)
        ? targetYearValue.map(Number).filter(Number.isInteger)
        : targetYearValue === "all"
          ? getPlayerAnalysisYears()
          : [Number(targetYearValue)];
      for (const year of years) {
        if (!Number.isInteger(year)) continue;
        const dataset = await loadPlayerAnalysisDatasetYear(year);
        if (dataset.missing) continue;
        const matches = (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
        const matchMap = new Map(matches.map(match => [String(match.match_id), match]));
        const playedByMatch = new Map();
        (dataset.appearances || []).forEach(appearance => {
          const matchId = String(appearance.match_id);
          if (!matchMap.has(matchId) || !isPlayerAppearancePlayedForCombination(appearance)) return;
          const groupKey = getPlayerCanonicalIdentity(appearance, year).groupKey;
          if (!groupKey) return;
          if (!playedByMatch.has(matchId)) playedByMatch.set(matchId, new Set());
          playedByMatch.get(matchId).add(groupKey);
        });
        matches.forEach(match => {
          entries.push({
            match,
            playedSet: playedByMatch.get(String(match.match_id)) || new Set()
          });
        });
      }
      return entries;
    })();
    playerAnalysisPlayedSetsCache.set(cacheKey, entriesPromise);
    return entriesPromise;
  }

  function hasSharedPlayerAppearance(candidateGroupKey, requiredGroupKeys, entries) {
    if (!candidateGroupKey) return false;
    const required = (requiredGroupKeys || []).filter(Boolean);
    if (!required.length) return true;
    return (entries || []).some(entry => {
      const playedSet = entry.playedSet || new Set();
      return playedSet.has(candidateGroupKey) && required.every(key => playedSet.has(key));
    });
  }

  function getCommonPlayerYears(players, baseYears = getPlayerAnalysisYears()) {
    const selected = (players || []).filter(Boolean);
    const base = new Set((baseYears || []).map(Number).filter(Number.isInteger));
    if (!selected.length) return Array.from(base).sort((a, b) => a - b);
    selected.forEach(player => {
      const years = new Set(getPlayerAnalysisYearsForPlayers([player]).map(Number).filter(Number.isInteger));
      Array.from(base).forEach(year => {
        if (!years.has(year)) base.delete(year);
      });
    });
    return Array.from(base).sort((a, b) => a - b);
  }

  async function buildPlayerCombinationAnalysis(players, scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter(), yearsOverride = null) {
    const selected = (players || []).filter(Boolean).slice(0, 3);
    const keys = selected.map(getPlayerGroupKey).filter(Boolean);
    const years = getCommonPlayerYears(selected, yearsOverride || getPlayerTimeScopeYears("compare"));
    const patternStats = new Map();
    const maxMask = Math.max(0, (1 << keys.length) - 1);
    for (let mask = 0; mask <= maxMask; mask += 1) {
      patternStats.set(mask, createPlayerMatchStats());
    }
    const entries = await getPlayerPlayedMatchEntries(scope, competitionNames, years);
    entries.forEach(entry => {
      let mask = 0;
      keys.forEach((key, index) => {
        if ((entry.playedSet || new Set()).has(key)) mask |= (1 << index);
      });
      addMatchToPlayerStats(patternStats.get(mask), entry.match);
    });
    const finalizedPatterns = new Map(Array.from(patternStats.entries()).map(([mask, stats]) => [mask, finalizePlayerMatchStats(stats)]));

    return {
      players: selected,
      patterns: finalizedPatterns,
      together: finalizedPatterns.get(maxMask) || finalizePlayerMatchStats(createPlayerMatchStats()),
      onlyA: finalizedPatterns.get(1) || finalizePlayerMatchStats(createPlayerMatchStats()),
      onlyB: finalizedPatterns.get(2) || finalizePlayerMatchStats(createPlayerMatchStats()),
      neither: finalizedPatterns.get(0) || finalizePlayerMatchStats(createPlayerMatchStats()),
      years
    };
  }

  function aggregatePlayerAnalysisRows(rows) {
    const groups = new Map();
    const sumFields = [
      "played_matches", "played_wins", "played_draws", "played_losses",
      "played_points", "played_goals_for", "played_goals_against", "played_goal_diff", "played_clean_sheets",
      "starter_matches", "starter_wins", "starter_draws", "starter_losses",
      "starter_points", "starter_goals_for", "starter_goals_against", "starter_goal_diff",
      "non_starter_matches", "non_starter_wins", "non_starter_draws", "non_starter_losses",
      "non_starter_points", "non_starter_goals_for", "non_starter_goals_against", "non_starter_goal_diff",
      "sub_matches", "sub_wins", "sub_draws", "sub_losses",
      "sub_points", "sub_goals_for", "sub_goals_against", "sub_goal_diff",
      "bench_only_matches", "non_played_matches", "non_played_wins",
      "non_played_draws", "non_played_losses", "non_played_points",
      "non_played_goals_for", "non_played_goals_against", "non_played_goal_diff",
      "goals", "scored_matches", "scored_wins",
      "scored_draws", "scored_losses", "yellow_cards", "red_cards",
      "carded_matches", "carded_wins", "carded_draws", "carded_losses"
    ];

    rows.forEach(row => {
      const groupKey = getPlayerGroupKey(row);
      if (!groupKey) return;
      const identity = getPlayerCanonicalIdentity(row, getPlayerYearValue(row));
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          season: "全期間",
          player_key: identity.key || row.player_key || row.player_name || groupKey,
          player_name: identity.name || row.player_name || row.player_key || "-",
          numbers: [],
          positions: [],
          seasons: [],
          __paYearRows: [],
          __paGroupKey: groupKey
        });
      }
      const aggregate = groups.get(groupKey);
      const year = getPlayerYearValue(row);
      aggregate.__paYearRows.push(row);
      if (year && !aggregate.seasons.includes(year)) aggregate.seasons.push(year);
      if (identity.name) aggregate.player_name = identity.name;
      if (identity.key) aggregate.player_key = identity.key;
      const numbers = Array.isArray(row.numbers) ? row.numbers : [row.numbers];
      numbers.map(value => String(value || "").trim()).filter(Boolean).forEach(number => {
        if (!aggregate.numbers.includes(number)) aggregate.numbers.push(number);
      });
      const positions = Array.isArray(row.positions) ? row.positions : String(row.positions || "").split(",");
      positions.map(value => String(value || "").trim()).filter(Boolean).forEach(position => {
        if (!aggregate.positions.includes(position)) aggregate.positions.push(position);
      });
      sumFields.forEach(field => {
        const value = toPlayerNumber(row[field]);
        if (value !== null) aggregate[field] = (aggregate[field] || 0) + value;
      });
    });

    return Array.from(groups.values()).map((player, index) => {
      player.seasons.sort((a, b) => a - b);
      player.positions = sortPlayerPositions(player.positions);
      player.numbers.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "ja"));
      player.__paYearRows.sort((a, b) => (getPlayerYearValue(b) || 0) - (getPlayerYearValue(a) || 0));
      player.played_win_rate = calculatePlayerRate(player.played_wins, player.played_matches);
      player.played_goals_against_avg = calculatePlayerAveragePerMatch(player.played_goals_against, player.played_matches);
      player.played_goal_diff = (toPlayerNumber(player.played_goals_for) || 0) - (toPlayerNumber(player.played_goals_against) || 0);
      player.starter_win_rate = calculatePlayerRate(player.starter_wins, player.starter_matches);
      player.starter_goal_diff = (toPlayerNumber(player.starter_goals_for) || 0) - (toPlayerNumber(player.starter_goals_against) || 0);
      player.non_starter_win_rate = calculatePlayerRate(player.non_starter_wins, player.non_starter_matches);
      player.non_starter_goal_diff = (toPlayerNumber(player.non_starter_goals_for) || 0) - (toPlayerNumber(player.non_starter_goals_against) || 0);
      player.sub_win_rate = calculatePlayerRate(player.sub_wins, player.sub_matches);
      player.sub_goal_diff = (toPlayerNumber(player.sub_goals_for) || 0) - (toPlayerNumber(player.sub_goals_against) || 0);
      player.scored_win_rate = calculatePlayerRate(player.scored_wins, player.scored_matches);
      player.played_points_per_match = calculatePlayerPointsPerMatch(player.played_wins, player.played_draws, player.played_matches);
      player.starter_points_per_match = calculatePlayerPointsPerMatch(player.starter_wins, player.starter_draws, player.starter_matches);
      player.non_starter_points_per_match = calculatePlayerPointsPerMatch(player.non_starter_wins, player.non_starter_draws, player.non_starter_matches);
      player.sub_points_per_match = calculatePlayerPointsPerMatch(player.sub_wins, player.sub_draws, player.sub_matches);
      player.non_played_win_rate = calculatePlayerRate(player.non_played_wins, player.non_played_matches);
      player.non_played_goal_diff = (toPlayerNumber(player.non_played_goals_for) || 0) - (toPlayerNumber(player.non_played_goals_against) || 0);
      player.non_played_points_per_match = calculatePlayerPointsPerMatch(player.non_played_wins, player.non_played_draws, player.non_played_matches);
      player.scored_points_per_match = calculatePlayerPointsPerMatch(player.scored_wins, player.scored_draws, player.scored_matches);
      player.carded_win_rate = calculatePlayerRate(player.carded_wins, player.carded_matches);
      player.__paIndex = index;
      player.__paKey = `all-${player.__paGroupKey}`;
      return player;
    });
  }

  async function loadAllPlayerAnalysisYears(scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const cacheKey = getPlayerAnalysisFilterCacheKey(scope, competitionNames);
    if (!playerAnalysisAllPromises.has(cacheKey)) {
      const promise = Promise.all(getPlayerAnalysisYears().map(year => loadScopedPlayerAnalysisYear(year, scope, competitionNames)))
        .then(entries => {
          const rows = entries.flatMap(entry => entry.rows || []);
          return { rows: aggregatePlayerAnalysisRows(rows), missing: rows.length === 0 };
        });
      playerAnalysisAllPromises.set(cacheKey, promise);
    }
    return playerAnalysisAllPromises.get(cacheKey);
  }

  async function getPlayerAnalysisYearRowsForPlayer(player, scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const groupKey = getPlayerGroupKey(player);
    if (!groupKey) return [];
    await loadAllPlayerAnalysisYears(scope, competitionNames);
    const filterKey = getPlayerAnalysisFilterCacheKey(scope, competitionNames);
    return getPlayerAnalysisYears()
      .flatMap(year => playerAnalysisScopedCache.get(`${year}:${filterKey}`)?.rows || [])
      .filter(row => getPlayerGroupKey(row) === groupKey)
      .sort((a, b) => (getPlayerYearValue(b) || 0) - (getPlayerYearValue(a) || 0));
  }

  function normalizePlayerAnalysisTimeState() {
    const years = getPlayerAnalysisYears();
    const latestYear = years[years.length - 1] || PLAYER_ANALYSIS_YEAR_END;
    const earliestYear = years[0] || latestYear;
    if (playerAnalysisState.timeMode !== "range") playerAnalysisState.timeMode = "year";
    if (playerAnalysisState.year !== "all") {
      playerAnalysisState.year = normalizePlayerAnalysisYearForClub(playerAnalysisState.year);
    }
    if (!years.includes(Number(playerAnalysisState.rangeStartYear))) {
      playerAnalysisState.rangeStartYear = String(earliestYear);
    }
    if (!years.includes(Number(playerAnalysisState.rangeEndYear))) {
      playerAnalysisState.rangeEndYear = String(Number.isInteger(Number(playerAnalysisState.year)) ? playerAnalysisState.year : latestYear);
    }
    const start = Number(playerAnalysisState.rangeStartYear);
    const end = Number(playerAnalysisState.rangeEndYear);
    if (Number.isInteger(start) && Number.isInteger(end) && start > end) {
      playerAnalysisState.rangeStartYear = String(end);
      playerAnalysisState.rangeEndYear = String(start);
    }
  }

  function getPlayerAnalysisTimeYears() {
    normalizePlayerAnalysisTimeState();
    if (playerAnalysisState.timeMode === "range") {
      const start = Number(playerAnalysisState.rangeStartYear);
      const end = Number(playerAnalysisState.rangeEndYear);
      return getPlayerAnalysisYears().filter(year => year >= start && year <= end);
    }
    if (playerAnalysisState.year === "all") return getPlayerAnalysisYears();
    const year = Number(playerAnalysisState.year);
    return Number.isInteger(year) ? [year] : [];
  }

  function getPlayerAnalysisTimeValue() {
    return playerAnalysisState.timeMode === "range"
      ? getPlayerAnalysisTimeYears()
      : playerAnalysisState.year;
  }

  function getPlayerAnalysisTimeLabel() {
    if (playerAnalysisState.timeMode === "range") {
      const years = getPlayerAnalysisTimeYears();
      if (!years.length) return "-";
      return years[0] === years[years.length - 1] ? `${years[0]}年` : `${years[0]}年〜${years[years.length - 1]}年`;
    }
    return playerAnalysisState.year === "all" ? "全期間" : `${playerAnalysisState.year}年`;
  }

  function renderPlayerAnalysisPeriodOptions(select, selectedYear) {
    if (!select) return;
    select.innerHTML = getPlayerAnalysisYears().slice().reverse().map(year => (
      `<option value="${escapeHtml(String(year))}" ${String(year) === String(selectedYear) ? "selected" : ""}>${escapeHtml(`${year}`)}</option>`
    )).join("");
  }

  function renderPlayerAnalysisMainTimeControls() {
    const { mainPeriodToggle, mainPeriodFields, mainPeriodStart, mainPeriodEnd } = getPlayerAnalysisElements();
    normalizePlayerAnalysisTimeState();
    const range = playerAnalysisState.timeMode === "range";
    if (mainPeriodToggle) {
      mainPeriodToggle.classList.toggle("active", range);
      mainPeriodToggle.setAttribute("aria-pressed", range ? "true" : "false");
    }
    if (mainPeriodFields) mainPeriodFields.hidden = !range;
    renderPlayerAnalysisPeriodOptions(mainPeriodStart, playerAnalysisState.rangeStartYear);
    renderPlayerAnalysisPeriodOptions(mainPeriodEnd, playerAnalysisState.rangeEndYear);
  }

  function renderPlayerAnalysisYears() {
    const { yearSelect } = getPlayerAnalysisElements();
    if (!yearSelect) return;
    yearSelect.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "全期間";
    yearSelect.appendChild(allOption);
    getPlayerAnalysisYears().slice().reverse().forEach(year => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = `${year}`;
      yearSelect.appendChild(option);
    });
    yearSelect.value = String(playerAnalysisState.year);
    renderPlayerAnalysisMainTimeControls();
  }

  function updatePlayerAnalysisScopeButtons(specialAvailable = true) {
    const { scopeButtons } = getPlayerAnalysisElements();
    scopeButtons.forEach(button => {
      if (button.dataset.paScope === "special") {
        button.hidden = !specialAvailable;
        button.setAttribute("aria-hidden", specialAvailable ? "false" : "true");
      }
      const active = button.dataset.paScope === playerAnalysisState.matchScope;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function getPlayerPositions(player) {
    const raw = Array.isArray(player && player.positions)
      ? player.positions
      : String((player && player.positions) || "").split(",");
    return raw.map(pos => String(pos || "").trim()).filter(Boolean);
  }

  function isPlayerGoalkeeper(player) {
    return getPlayerPositions(player).includes("GK");
  }

  function renderPlayerAnalysisPositionModes() {
    const { positionModeButtons } = getPlayerAnalysisElements();
    positionModeButtons.forEach(button => {
      const active = button.dataset.paPositionMode === playerAnalysisState.positionMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderPlayerAnalysisPositions(rows) {
    const { positionOptions } = getPlayerAnalysisElements();
    if (!positionOptions) return;
    const positions = sortPlayerPositions(Array.from(new Set(rows.flatMap(getPlayerPositions))));
    playerAnalysisState.positions = playerAnalysisState.positions.filter(pos => positions.includes(pos));

    if (!positions.length) {
      positionOptions.innerHTML = `<span class="pa-position-empty">ポジションデータなし</span>`;
      renderPlayerAnalysisPositionModes();
      return;
    }

    positionOptions.innerHTML = positions.map(pos => {
      const active = playerAnalysisState.positions.includes(pos);
      return `<button type="button" class="pa-position-chip ${active ? "active" : ""}" data-pa-position="${escapeHtml(pos)}">${escapeHtml(pos)}</button>`;
    }).join("");
    renderPlayerAnalysisPositionModes();
  }

  function parsePlayerFilterNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function getPlayerNumbers(player) {
    return normalizePlayerNumberValues(player && player.numbers);
  }

  function getPlayerSeasonCount(player) {
    if (Array.isArray(player && player.seasons) && player.seasons.length) return player.seasons.length;
    if (Array.isArray(player && player.__paYearRows) && player.__paYearRows.length) {
      return new Set(player.__paYearRows.map(getPlayerYearValue).filter(Boolean)).size;
    }
    const meta = playerAnalysisSeasonMetaCache.get(getPlayerAnalysisFilterCacheKey());
    const seasons = meta && meta.get(getPlayerGroupKey(player));
    return seasons ? seasons.size : 1;
  }

  async function ensurePlayerAnalysisSeasonMeta(scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const cacheKey = getPlayerAnalysisFilterCacheKey(scope, competitionNames);
    if (playerAnalysisSeasonMetaCache.has(cacheKey)) return playerAnalysisSeasonMetaCache.get(cacheKey);
    const rowsByYear = await Promise.all(getPlayerAnalysisYears().map(async year => {
      const entry = await loadScopedPlayerAnalysisYear(year, scope, competitionNames);
      return entry.rows || [];
    }));
    const meta = new Map();
    rowsByYear.flat().forEach(row => {
      const key = getPlayerGroupKey(row);
      const year = getPlayerYearValue(row);
      if (!key || !year) return;
      if (!meta.has(key)) meta.set(key, new Set());
      meta.get(key).add(year);
    });
    playerAnalysisSeasonMetaCache.set(cacheKey, meta);
    return meta;
  }

  function needsPlayerSeasonMeta() {
    return playerAnalysisState.sortKey === "season_count"
      || parsePlayerFilterNumber(playerAnalysisState.seasonsMin) !== null
      || parsePlayerFilterNumber(playerAnalysisState.seasonsMax) !== null
      || getActivePlayerAnalysisAdvancedFilters().some(filter => filter.type === "seasons-min" || filter.type === "seasons-max");
  }

  function normalizePlayerMonthFilter(value) {
    const month = Number(value);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
  }

  function getPlayerMatchMonth(match) {
    const text = String((match && match.date) || "");
    const found = text.match(/^\s*\d{4}[/-](\d{1,2})[/-]\d{1,2}/);
    return found ? Number(found[1]) : null;
  }

  function needsPlayerMonthlyMeta() {
    return (normalizePlayerMonthFilter(playerAnalysisState.monthFilter) !== null
      && (parsePlayerFilterNumber(playerAnalysisState.monthGoalsMin) !== null
        || parsePlayerFilterNumber(playerAnalysisState.monthPlayedRateMin) !== null))
      || getActivePlayerAnalysisAdvancedFilters().some(filter => isPlayerAnalysisMonthCompactFilter(filter.type));
  }

  function getPlayerMonthlyCacheKey(year = playerAnalysisState.year, scope = playerAnalysisState.matchScope, month = normalizePlayerMonthFilter(playerAnalysisState.monthFilter), competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    return `${getPlayerAnalysisFilterCacheKey(scope, competitionNames)}:${year}:${month || "none"}`;
  }

  function ensureMonthlyPlayerStats(map, source, sourceYear) {
    const identity = getPlayerCanonicalIdentity(source, sourceYear);
    const key = identity.groupKey;
    if (!key) return null;
    if (!map.has(key)) map.set(key, { played: 0, wins: 0, draws: 0, losses: 0, goals: 0 });
    return map.get(key);
  }

  async function ensurePlayerAnalysisMonthlyMeta(year = playerAnalysisState.year, scope = playerAnalysisState.matchScope, month = normalizePlayerMonthFilter(playerAnalysisState.monthFilter), competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    if (!month) return new Map();
    const cacheKey = getPlayerMonthlyCacheKey(year, scope, month, competitionNames);
    const cached = playerAnalysisMonthlyMetaCache.get(cacheKey);
    if (cached instanceof Map) return cached;
    if (cached) return cached;

    const promise = (async () => {
      const meta = new Map();
        const years = Array.isArray(year) ? year.map(Number).filter(Number.isInteger) : (year === "all" ? getPlayerAnalysisYears() : [Number(year)]);
      for (const targetYear of years) {
        if (!Number.isInteger(targetYear)) continue;
        const dataset = await loadPlayerAnalysisDatasetYear(targetYear);
        if (dataset.missing) continue;
        const targetMatches = (dataset.matches || [])
          .filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames) && getPlayerMatchMonth(match) === month);
        if (!targetMatches.length) continue;
        const matchMap = new Map(targetMatches.map(match => [String(match.match_id), match]));

        (dataset.appearances || []).forEach(appearance => {
          const match = matchMap.get(String(appearance.match_id));
          if (!match || !appearance.played) return;
          const stats = ensureMonthlyPlayerStats(meta, appearance, targetYear);
          if (!stats) return;
          stats.played += 1;
          if (match.result === "win") stats.wins += 1;
          else if (match.result === "draw") stats.draws += 1;
          else if (match.result === "loss") stats.losses += 1;
        });

        (dataset.goals || []).forEach(goal => {
          if (goal.is_own_goal || !matchMap.has(String(goal.match_id))) return;
          const stats = ensureMonthlyPlayerStats(meta, goal, targetYear);
          if (stats) stats.goals += 1;
        });
      }
      return meta;
    })();

    playerAnalysisMonthlyMetaCache.set(cacheKey, promise);
    const meta = await promise;
    playerAnalysisMonthlyMetaCache.set(cacheKey, meta);
    return meta;
  }

  function getPlayerMonthlyStats(player) {
    const month = normalizePlayerMonthFilter(playerAnalysisState.monthFilter);
    return getPlayerMonthlyStatsForMonth(player, month);
  }

  function getPlayerMonthlyStatsForMonth(player, month) {
    if (!month) return { played: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
    const meta = playerAnalysisMonthlyMetaCache.get(getPlayerMonthlyCacheKey(getPlayerAnalysisTimeValue(), playerAnalysisState.matchScope, month));
    if (!(meta instanceof Map)) return { played: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
    return meta.get(getPlayerGroupKey(player)) || { played: 0, wins: 0, draws: 0, losses: 0, goals: 0 };
  }

  function getActivePlayerAnalysisAdvancedFilters() {
    return (playerAnalysisState.advancedFilters || [])
      .map(filter => ({
        type: String(filter && filter.type || ""),
        value: String(filter && filter.value || "").trim(),
        month: String(filter && filter.month || "5")
      }))
      .filter(filter => filter.type && filter.value !== "");
  }

  function getPlayerAnalysisAdvancedFilterOptions() {
    return [
      { label: "基本", options: [["", "条件なし"], ["number", "背番号"]] },
      { label: "出場", options: [
        ["played-min", "出場試合数 以上"], ["played-max", "出場試合数 以下"],
        ["starts-min", "先発数 以上"], ["starts-max", "先発数 以下"]
      ] },
      { label: "得点・成績", options: [
        ["goals-min", "得点数 以上"], ["goals-max", "得点数 以下"],
        ["played-rate-min", "出場時勝率 %以上"], ["played-rate-max", "出場時勝率 %以下"],
        ["scored-rate-min", "ゴール試合勝率 %以上"], ["scored-rate-max", "ゴール試合勝率 %以下"],
        ["scored-ppm-min", "ゴール試合平均勝ち点 以上"], ["scored-ppm-max", "ゴール試合平均勝ち点 以下"]
      ] },
      { label: "月別", options: [
        ["month-goals-min", "対象月の得点数 以上"], ["month-goals-max", "対象月の得点数 以下"],
        ["month-played-rate-min", "対象月の出場時勝率 %以上"], ["month-played-rate-max", "対象月の出場時勝率 %以下"]
      ] },
      { label: "カード", options: [
        ["yellow-min", "警告数 以上"], ["yellow-max", "警告数 以下"],
        ["red-min", "退場数 以上"], ["red-max", "退場数 以下"]
      ] },
      { label: "プロフィール", options: [
        ["seasons-min", "所属年数 以上"], ["seasons-max", "所属年数 以下"],
        ["height-min", "身長 cm以上"], ["height-max", "身長 cm以下"],
        ["weight-min", "体重 kg以上"], ["weight-max", "体重 kg以下"],
        ["birth-year-min", "生まれ年 以降"], ["birth-year-max", "生まれ年 以前"]
      ] }
    ];
  }

  function createPlayerAnalysisAdvancedFilter() {
    return { type: "", value: "", month: "5" };
  }

  function matchesPlayerAnalysisAdvancedFilter(player, filter) {
    const value = parsePlayerFilterNumber(filter.value);
    if (value === null) return true;
    const numbers = getPlayerNumbers(player);
    const played = toPlayerNumber(player.played_matches) || 0;
    const starts = toPlayerNumber(player.starter_matches) || 0;
    const goals = toPlayerNumber(player.goals) || 0;
    const playedRate = toPlayerNumber(player.played_win_rate);
    const scoredRate = toPlayerNumber(player.scored_win_rate);
    const scoredPpm = toPlayerNumber(player.scored_points_per_match);
    const yellow = toPlayerNumber(player.yellow_cards) || 0;
    const red = toPlayerNumber(player.red_cards) || 0;
    const seasonCount = getPlayerSeasonCount(player);
    const height = toPlayerNumber(player.profile_height_cm);
    const weight = toPlayerNumber(player.profile_weight_kg);
    const birthYear = toPlayerNumber(player.profile_birth_year);

    if (filter.type === "number") return numbers.some(number => Number(number) === value || number === String(filter.value).trim());
    if (filter.type === "played-min") return played >= value;
    if (filter.type === "played-max") return played <= value;
    if (filter.type === "starts-min") return starts >= value;
    if (filter.type === "starts-max") return starts <= value;
    if (filter.type === "goals-min") return goals >= value;
    if (filter.type === "goals-max") return goals <= value;
    if (filter.type === "played-rate-min") return playedRate !== null && playedRate >= value;
    if (filter.type === "played-rate-max") return playedRate !== null && playedRate <= value;
    if (filter.type === "scored-rate-min") return scoredRate !== null && scoredRate >= value;
    if (filter.type === "scored-rate-max") return scoredRate !== null && scoredRate <= value;
    if (filter.type === "scored-ppm-min") return scoredPpm !== null && scoredPpm >= value;
    if (filter.type === "scored-ppm-max") return scoredPpm !== null && scoredPpm <= value;
    if (filter.type === "yellow-min") return yellow >= value;
    if (filter.type === "yellow-max") return yellow <= value;
    if (filter.type === "red-min") return red >= value;
    if (filter.type === "red-max") return red <= value;
    if (filter.type === "seasons-min") return seasonCount >= value;
    if (filter.type === "seasons-max") return seasonCount <= value;
    if (filter.type === "height-min") return height !== null && height >= value;
    if (filter.type === "height-max") return height !== null && height <= value;
    if (filter.type === "weight-min") return weight !== null && weight >= value;
    if (filter.type === "weight-max") return weight !== null && weight <= value;
    if (filter.type === "birth-year-min") return birthYear !== null && birthYear >= value;
    if (filter.type === "birth-year-max") return birthYear !== null && birthYear <= value;
    if (isPlayerAnalysisMonthCompactFilter(filter.type)) {
      const month = normalizePlayerMonthFilter(filter.month);
      const monthlyStats = getPlayerMonthlyStatsForMonth(player, month);
      if (filter.type === "month-goals-min") return monthlyStats.goals >= value;
      if (filter.type === "month-goals-max") return monthlyStats.goals <= value;
      const monthlyPlayedRate = calculatePlayerRate(monthlyStats.wins, monthlyStats.played);
      if (monthlyPlayedRate === null) return false;
      return filter.type === "month-played-rate-min" ? monthlyPlayedRate >= value : monthlyPlayedRate <= value;
    }
    return true;
  }

  function getPlayerAnalysisFilteredRows() {
    const query = playerAnalysisState.query.normalize("NFKC").toLowerCase().trim();
    const selectedPositions = playerAnalysisState.positions || [];
    const activeFilters = getActivePlayerAnalysisAdvancedFilters();
    const advancedFilterLogic = playerAnalysisState.advancedFilterLogic === "or" ? "or" : "and";
    const heightMin = parsePlayerFilterNumber(playerAnalysisState.heightMin);
    const heightMax = parsePlayerFilterNumber(playerAnalysisState.heightMax);
    const weightMin = parsePlayerFilterNumber(playerAnalysisState.weightMin);
    const weightMax = parsePlayerFilterNumber(playerAnalysisState.weightMax);
    const birthYearMin = parsePlayerFilterNumber(playerAnalysisState.birthYearMin);
    const birthYearMax = parsePlayerFilterNumber(playerAnalysisState.birthYearMax);
    return playerAnalysisState.data.filter(player => {
      const name = String(player.player_name || "").normalize("NFKC").toLowerCase();
      const englishName = String(player.profile_name_en || "").normalize("NFKC").toLowerCase();
      const positions = getPlayerPositions(player);
      const played = toPlayerNumber(player.played_matches) || 0;
      const goals = toPlayerNumber(player.goals) || 0;
      const height = toPlayerNumber(player.profile_height_cm);
      const weight = toPlayerNumber(player.profile_weight_kg);
      const birthYear = toPlayerNumber(player.profile_birth_year);
      if (query && !name.includes(query) && !englishName.includes(query)) return false;
      if (heightMin !== null && (height === null || height < heightMin)) return false;
      if (heightMax !== null && (height === null || height > heightMax)) return false;
      if (weightMin !== null && (weight === null || weight < weightMin)) return false;
      if (weightMax !== null && (weight === null || weight > weightMax)) return false;
      if (birthYearMin !== null && (birthYear === null || birthYear < birthYearMin)) return false;
      if (birthYearMax !== null && (birthYear === null || birthYear > birthYearMax)) return false;
      if (selectedPositions.length) {
        const matchesPosition = playerAnalysisState.positionMode === "and"
          ? selectedPositions.every(pos => positions.includes(pos))
          : selectedPositions.some(pos => positions.includes(pos));
        if (!matchesPosition) return false;
      }
      if (activeFilters.length) {
        const matchesAdvanced = advancedFilterLogic === "or"
          ? activeFilters.some(filter => matchesPlayerAnalysisAdvancedFilter(player, filter))
          : activeFilters.every(filter => matchesPlayerAnalysisAdvancedFilter(player, filter));
        if (!matchesAdvanced) return false;
      }
      if (playerAnalysisState.scorersOnly && goals <= 0) return false;
      if (playerAnalysisState.playedOnly && played <= 0) return false;
      if (playerAnalysisState.katakanaOnly && !KATAKANA_PLAYER_RE.test(String(player.player_name || ""))) return false;
      return true;
    });
  }

  function sortPlayerAnalysisRows(rows) {
    const { sortKey, sortDirection } = playerAnalysisState;
    return [...rows].sort((a, b) => {
      const aValue = getPlayerAnalysisSortValue(a, sortKey);
      const bValue = getPlayerAnalysisSortValue(b, sortKey);
      const aMissing = !hasPlayerValue(aValue);
      const bMissing = !hasPlayerValue(bValue);
      if (aMissing && bMissing) return a.__paIndex - b.__paIndex;
      if (aMissing) return 1;
      if (bMissing) return -1;

      const aNumber = toPlayerNumber(aValue);
      const bNumber = toPlayerNumber(bValue);
      let result;
      if (aNumber !== null && bNumber !== null) {
        result = aNumber - bNumber;
      } else {
        const locale = sortKey === "player_name" ? "en" : "ja";
        result = String(aValue).localeCompare(String(bValue), locale, { numeric: true, sensitivity: "base" });
      }
      if (result === 0) result = a.__paIndex - b.__paIndex;
      return sortDirection === "asc" ? result : -result;
    });
  }

  function getPlayerAnalysisSortValue(player, sortKey = playerAnalysisState.sortKey) {
    if (sortKey === "number") {
      const numbers = getPlayerNumbers(player).map(number => Number(number)).filter(Number.isFinite);
      return numbers.length ? Math.min(...numbers) : null;
    }
    if (sortKey === "played_minutes") {
      return player && player.__paRankingMetrics ? player.__paRankingMetrics.played_minutes : null;
    }
    if (sortKey === "played_goals_against_avg" || sortKey === "played_clean_sheets") {
      const directValue = player ? player[sortKey] : null;
      if (hasPlayerValue(directValue)) return directValue;
      return player && player.__paRankingMetrics ? player.__paRankingMetrics[sortKey] : null;
    }
    if (sortKey === "on_pitch_goals_for" || sortKey === "on_pitch_goals_against" || sortKey === "on_pitch_goal_diff") {
      return player && player.__paRankingMetrics ? player.__paRankingMetrics[sortKey] : null;
    }
    if (sortKey === "impact_score" || sortKey === "total_impact") return getPlayerImpactValue(player, "total");
    if (sortKey === "attack_impact") return getPlayerImpactValue(player, "attack");
    if (sortKey === "defense_impact") return getPlayerImpactValue(player, "defense");
    if (sortKey === "season_count") {
      return getPlayerSeasonCount(player);
    }
    if (sortKey === "position_order") {
      const positions = getPlayerPositions(player);
      if (!positions.length) return null;
      return Math.min(...positions.map(position => {
        const index = PLAYER_POSITION_ORDER.indexOf(position);
        return index === -1 ? PLAYER_POSITION_ORDER.length : index;
      }));
    }
    if (sortKey === "player_name") {
      return player && (player.profile_name_sort || getPlayerGojūonSortKey(player.profile_name_en || getPlayerEnglishName(player)));
    }
    return player ? player[sortKey] : null;
  }

  function shouldPlayerAnalysisSortAscByDefault(sortKey) {
    if (["number", "position_order", "player_name", "played_goals_against_avg"].includes(sortKey)) return true;
    return String(sortKey || "").endsWith("_goals_against");
  }

  function getPlayerAnalysisSortInfo(sortKey = playerAnalysisState.sortKey) {
    const info = {
      number: { label: "背番号", shortLabel: "背番号", type: "number", noAverage: true },
      position_order: { label: "ポジション順", shortLabel: "位置", type: "text", noAverage: true },
      player_name: { label: "名前（50音 / A-Z）", shortLabel: "名前順", type: "text", noAverage: true },
      season_count: { label: "所属年数", shortLabel: "所属年数", type: "number" },
      profile_height_cm: { label: "身長", shortLabel: "身長", type: "cm" },
      profile_weight_kg: { label: "体重", shortLabel: "体重", type: "kg" },
      profile_birth_year: { label: "生まれ年", shortLabel: "生まれ年", type: "year", noAverage: true },
      played_matches: { label: "出場試合数", shortLabel: "出場", type: "number", teamMetric: "matches", teamLabel: "チーム試合数" },
      played_minutes: { label: "出場時間", shortLabel: "出場時間", type: "minutes" },
      played_wins: { label: "出場時勝利数", shortLabel: "出場時勝利", type: "number", teamMetric: "wins", teamLabel: "チーム勝利数" },
      played_draws: { label: "出場時引分数", shortLabel: "出場時引分", type: "number", teamMetric: "draws", teamLabel: "チーム引分数" },
      played_losses: { label: "出場時敗戦数", shortLabel: "出場時敗戦", type: "number", teamMetric: "losses", teamLabel: "チーム敗戦数" },
      played_points: { label: "出場時勝ち点", shortLabel: "出場時勝ち点", type: "number", teamMetric: "points", teamLabel: "チーム勝ち点" },
      played_win_rate: { label: "出場時勝率", shortLabel: "出場時勝率", type: "rate", teamMetric: "winRate", teamLabel: "チーム勝率" },
      played_points_per_match: { label: "出場時平均勝ち点", shortLabel: "出場時平均勝ち点", type: "decimal", teamMetric: "pointsPerMatch", teamLabel: "シーズン平均勝ち点" },
      played_goals_for: { label: "出場時得点数", shortLabel: "出場時得点", type: "number", teamMetric: "goalsFor", teamLabel: "チーム得点" },
      played_goals_against: { label: "出場時失点数", shortLabel: "出場時失点", type: "number", teamMetric: "goalsAgainst", teamLabel: "チーム失点" },
      played_goal_diff: { label: "出場時得失点差", shortLabel: "出場時得失点差", type: "signed", teamMetric: "goalDiff", teamLabel: "チーム得失点差" },
      played_goals_against_avg: { label: "出場試合失点率", shortLabel: "出場時失点率", type: "goalsAgainstAverage", teamMetric: "goalsAgainstAvg", teamLabel: "シーズン失点率" },
      played_clean_sheets: { label: "出場時無失点試合数", shortLabel: "出場時無失点", type: "number", teamMetric: "cleanSheets", teamLabel: "チーム無失点試合" },
      on_pitch_goals_for: { label: "出場時間中得点数", shortLabel: "時間中得点", type: "number", teamMetric: "goalsFor", teamLabel: "チーム得点" },
      on_pitch_goals_against: { label: "出場時間中失点数", shortLabel: "時間中失点", type: "number", teamMetric: "goalsAgainst", teamLabel: "チーム失点" },
      on_pitch_goal_diff: { label: "出場時間中得失点差", shortLabel: "時間中得失点差", type: "signed", teamMetric: "goalDiff", teamLabel: "チーム得失点差" },
      starter_matches: { label: "先発数", shortLabel: "先発", type: "number", teamMetric: "matches", teamLabel: "チーム試合数" },
      starter_points: { label: "先発時勝ち点", shortLabel: "先発勝ち点", type: "number", teamMetric: "points", teamLabel: "チーム勝ち点" },
      starter_win_rate: { label: "先発時勝率", shortLabel: "先発勝率", type: "rate", teamMetric: "winRate", teamLabel: "チーム勝率" },
      starter_points_per_match: { label: "先発時平均勝ち点", shortLabel: "先発平均勝ち点", type: "decimal", teamMetric: "pointsPerMatch", teamLabel: "シーズン平均勝ち点" },
      starter_goals_for: { label: "先発時得点数", shortLabel: "先発得点", type: "number", teamMetric: "goalsFor", teamLabel: "チーム得点" },
      starter_goals_against: { label: "先発時失点数", shortLabel: "先発失点", type: "number", teamMetric: "goalsAgainst", teamLabel: "チーム失点" },
      starter_goal_diff: { label: "先発時得失点差", shortLabel: "先発得失点差", type: "signed", teamMetric: "goalDiff", teamLabel: "チーム得失点差" },
      non_starter_matches: { label: "非スタメン時試合数", shortLabel: "非スタメン", type: "number", teamMetric: "matches", teamLabel: "チーム試合数" },
      non_starter_points: { label: "非スタメン時勝ち点", shortLabel: "非スタメン勝ち点", type: "number", teamMetric: "points", teamLabel: "チーム勝ち点" },
      non_starter_win_rate: { label: "非スタメン時勝率", shortLabel: "非スタメン勝率", type: "rate", teamMetric: "winRate", teamLabel: "チーム勝率" },
      non_starter_points_per_match: { label: "非スタメン時平均勝ち点", shortLabel: "非スタメン平均勝ち点", type: "decimal", teamMetric: "pointsPerMatch", teamLabel: "シーズン平均勝ち点" },
      non_starter_goals_for: { label: "非スタメン時得点数", shortLabel: "非スタメン得点", type: "number", teamMetric: "goalsFor", teamLabel: "チーム得点" },
      non_starter_goals_against: { label: "非スタメン時失点数", shortLabel: "非スタメン失点", type: "number", teamMetric: "goalsAgainst", teamLabel: "チーム失点" },
      non_starter_goal_diff: { label: "非スタメン時得失点差", shortLabel: "非スタメン得失点差", type: "signed", teamMetric: "goalDiff", teamLabel: "チーム得失点差" },
      sub_matches: { label: "途中出場数", shortLabel: "途中", type: "number" },
      sub_points: { label: "途中出場時勝ち点", shortLabel: "途中勝ち点", type: "number", teamMetric: "points", teamLabel: "チーム勝ち点" },
      sub_win_rate: { label: "途中出場時勝率", shortLabel: "途中勝率", type: "rate", teamMetric: "winRate", teamLabel: "チーム勝率" },
      sub_points_per_match: { label: "途中出場時平均勝ち点", shortLabel: "途中平均勝ち点", type: "decimal", teamMetric: "pointsPerMatch", teamLabel: "シーズン平均勝ち点" },
      sub_goals_for: { label: "途中出場時得点数", shortLabel: "途中得点", type: "number", teamMetric: "goalsFor", teamLabel: "チーム得点" },
      sub_goals_against: { label: "途中出場時失点数", shortLabel: "途中失点", type: "number", teamMetric: "goalsAgainst", teamLabel: "チーム失点" },
      sub_goal_diff: { label: "途中出場時得失点差", shortLabel: "途中得失点差", type: "signed", teamMetric: "goalDiff", teamLabel: "チーム得失点差" },
      bench_only_matches: { label: "ベンチ入りのみ", shortLabel: "ベンチのみ", type: "number" },
      non_played_matches: { label: "未出場試合数", shortLabel: "未出場", type: "number", teamMetric: "matches", teamLabel: "チーム試合数" },
      non_played_points: { label: "未出場時勝ち点", shortLabel: "未出場勝ち点", type: "number", teamMetric: "points", teamLabel: "チーム勝ち点" },
      non_played_win_rate: { label: "未出場時勝率", shortLabel: "未出場勝率", type: "rate", teamMetric: "winRate", teamLabel: "チーム勝率" },
      non_played_points_per_match: { label: "未出場時平均勝ち点", shortLabel: "未出場平均勝ち点", type: "decimal", teamMetric: "pointsPerMatch", teamLabel: "シーズン平均勝ち点" },
      non_played_goals_for: { label: "未出場時得点数", shortLabel: "未出場得点", type: "number", teamMetric: "goalsFor", teamLabel: "チーム得点" },
      non_played_goals_against: { label: "未出場時失点数", shortLabel: "未出場失点", type: "number", teamMetric: "goalsAgainst", teamLabel: "チーム失点" },
      non_played_goal_diff: { label: "未出場時得失点差", shortLabel: "未出場得失点差", type: "signed", teamMetric: "goalDiff", teamLabel: "チーム得失点差" },
      goals: { label: "得点数", shortLabel: "得点", type: "number" },
      scored_matches: { label: "ゴール試合数", shortLabel: "ゴール試合", type: "number" },
      scored_win_rate: { label: "ゴール試合勝率", shortLabel: "ゴール勝率", type: "rate" },
      scored_points_per_match: { label: "ゴール試合平均勝ち点", shortLabel: "ゴール平均勝ち点", type: "decimal" },
      yellow_cards: { label: "警告数", shortLabel: "警告", type: "number" },
      red_cards: { label: "退場数", shortLabel: "退場", type: "number" },
      carded_matches: { label: "カードを受けた試合数", shortLabel: "カード試合", type: "number" },
      carded_win_rate: { label: "カード時勝率", shortLabel: "カード時勝率", type: "rate" },
      attack_impact: { label: "攻撃インパクト", shortLabel: "攻撃インパクト", type: "impact" },
      defense_impact: { label: "守備インパクト", shortLabel: "守備インパクト", type: "impact" },
      total_impact: { label: "総合インパクト", shortLabel: "総合インパクト", type: "impact" },
      impact_score: { label: "総合インパクト", shortLabel: "総合インパクト", type: "impact" }
    };
    return info[sortKey] || null;
  }

  function formatPlayerAnalysisMetricValue(value, type = "number") {
    if (type === "rate") return formatPlayerRate(value);
    if (type === "decimal") return formatPlayerDecimal(value);
    if (type === "minutes") return formatPlayerMinutes(value);
    if (type === "goalsAgainstAverage") return formatPlayerGoalsAgainstAverage(value);
    if (type === "signed") return formatPlayerSignedNumber(value);
    if (type === "impact") return value === null ? "データ不足" : formatPlayerFixed(value, 1);
    if (type === "text") return formatPlayerList(value);
    if (type === "cm") return hasPlayerValue(value) ? `${formatPlayerNumber(value)}cm` : "-";
    if (type === "kg") return hasPlayerValue(value) ? `${formatPlayerNumber(value)}kg` : "-";
    if (type === "year") return hasPlayerValue(value) ? `${formatPlayerNumber(value)}年` : "-";
    return formatPlayerNumber(value);
  }

  function formatPlayerAnalysisSortValue(player, sortKey = playerAnalysisState.sortKey) {
    const info = getPlayerAnalysisSortInfo(sortKey);
    if (sortKey === "number") return formatPlayerList(player && player.numbers);
    if (sortKey === "position_order") return formatPlayerList(player && player.positions);
    if (sortKey === "player_name") return player && player.profile_name_en ? player.profile_name_en : (player && player.player_name ? player.player_name : "-");
    if (sortKey === "season_count") return formatPlayerNumber(getPlayerSeasonCount(player));
    if (sortKey === "attack_impact") return formatPlayerImpactScore(player, "attack");
    if (sortKey === "defense_impact") return formatPlayerImpactScore(player, "defense");
    if (sortKey === "impact_score" || sortKey === "total_impact") return formatPlayerImpactScore(player, "total");
    return formatPlayerAnalysisMetricValue(getPlayerAnalysisSortValue(player, sortKey), info && info.type);
  }

  function getPlayerAnalysisSortMetric(player) {
    const sortKey = playerAnalysisState.sortKey;
    const info = getPlayerAnalysisSortInfo(sortKey);
    if (info) return [info.shortLabel || info.label, formatPlayerAnalysisSortValue(player, sortKey)];
    if (sortKey === "number") return ["背番号", formatPlayerList(player.numbers)];
    if (sortKey === "played_minutes") return ["出場時間", formatPlayerMinutes(getPlayerAnalysisSortValue(player, sortKey))];
    if (sortKey === "played_wins") return ["出場時勝利", formatPlayerNumber(player.played_wins)];
    if (sortKey === "played_draws") return ["出場時引分", formatPlayerNumber(player.played_draws)];
    if (sortKey === "played_losses") return ["出場時敗戦", formatPlayerNumber(player.played_losses)];
    if (sortKey === "played_points_per_match") return ["出場時平均勝ち点", formatPlayerDecimal(player.played_points_per_match)];
    if (sortKey === "played_goals_against_avg") return ["出場時失点率", formatPlayerGoalsAgainstAverage(getPlayerAnalysisSortValue(player, sortKey))];
    if (sortKey === "played_clean_sheets") return ["出場時無失点", formatPlayerNumber(getPlayerAnalysisSortValue(player, sortKey))];
    if (sortKey === "starter_matches") return ["先発", formatPlayerNumber(player.starter_matches)];
    if (sortKey === "starter_win_rate") return ["先発勝率", formatPlayerRate(player.starter_win_rate)];
    if (sortKey === "starter_points_per_match") return ["先発平均勝ち点", formatPlayerDecimal(player.starter_points_per_match)];
    if (sortKey === "non_starter_win_rate") return ["非スタメン勝率", formatPlayerRate(player.non_starter_win_rate)];
    if (sortKey === "non_starter_points_per_match") return ["非スタメン平均勝ち点", formatPlayerDecimal(player.non_starter_points_per_match)];
    if (sortKey === "sub_matches") return ["途中", formatPlayerNumber(player.sub_matches)];
    if (sortKey === "sub_win_rate") return ["途中勝率", formatPlayerRate(player.sub_win_rate)];
    if (sortKey === "sub_points_per_match") return ["途中平均勝ち点", formatPlayerDecimal(player.sub_points_per_match)];
    if (sortKey === "bench_only_matches") return ["ベンチのみ", formatPlayerNumber(player.bench_only_matches)];
    if (sortKey === "non_played_win_rate") return ["未出場勝率", formatPlayerRate(player.non_played_win_rate)];
    if (sortKey === "non_played_points_per_match") return ["未出場平均勝ち点", formatPlayerDecimal(player.non_played_points_per_match)];
    if (sortKey === "goals") return ["得点", formatPlayerNumber(player.goals)];
    if (sortKey === "scored_matches") return ["ゴール試合", formatPlayerNumber(player.scored_matches)];
    if (sortKey === "played_win_rate") return ["勝率", formatPlayerRate(player.played_win_rate)];
    if (sortKey === "scored_win_rate") return ["ゴール勝率", formatPlayerRate(player.scored_win_rate)];
    if (sortKey === "scored_points_per_match") return ["ゴール平均勝ち点", formatPlayerDecimal(player.scored_points_per_match)];
    if (sortKey === "impact_score" || sortKey === "total_impact") return ["総合インパクト", formatPlayerImpactScore(player, "total")];
    if (sortKey === "attack_impact") return ["攻撃インパクト", formatPlayerImpactScore(player, "attack")];
    if (sortKey === "defense_impact") return ["守備インパクト", formatPlayerImpactScore(player, "defense")];
    if (sortKey === "yellow_cards") return ["警告", formatPlayerNumber(player.yellow_cards)];
    if (sortKey === "red_cards") return ["退場", formatPlayerNumber(player.red_cards)];
    if (sortKey === "carded_matches") return ["カード試合", formatPlayerNumber(player.carded_matches)];
    if (sortKey === "carded_win_rate") return ["カード時勝率", formatPlayerRate(player.carded_win_rate)];
    if (sortKey === "season_count") return ["所属年数", formatPlayerNumber(getPlayerSeasonCount(player))];
    if (sortKey === "position_order") return ["位置", formatPlayerList(player.positions)];
    if (sortKey === "player_name") return ["名前順", formatPlayerList(player.positions)];
    return ["出場", formatPlayerNumber(player.played_matches)];
  }

  function formatPlayerAnalysisAverageValue(value, type = "number") {
    const n = toPlayerNumber(value);
    if (n === null) return "-";
    if (type === "rate") return formatPlayerRate(n);
    if (type === "minutes") return formatPlayerMinutes(n);
    if (type === "signed") return n > 0 ? `+${formatPlayerDecimal(n)}` : formatPlayerDecimal(n);
    if (type === "impact") return formatPlayerFixed(n, 1);
    return formatPlayerDecimal(n);
  }

  function getPlayerAnalysisTeamSortValue(sortKey, teamStats = playerAnalysisState.teamStats) {
    const info = getPlayerAnalysisSortInfo(sortKey);
    if (!info || !info.teamMetric || !teamStats) return null;
    if (info.teamMetric === "goalDiff") {
      return (toPlayerNumber(teamStats.goalsFor) || 0) - (toPlayerNumber(teamStats.goalsAgainst) || 0);
    }
    if (info.teamMetric === "cleanSheets") return teamStats.cleanSheets;
    return teamStats[info.teamMetric];
  }

  function renderPlayerAnalysisSortSummary(rows = playerAnalysisState.filtered || []) {
    const { sortSummary } = getPlayerAnalysisElements();
    if (!sortSummary) return;
    const sortKey = playerAnalysisState.sortKey;
    const info = getPlayerAnalysisSortInfo(sortKey);
    if (!info) {
      sortSummary.innerHTML = "";
      return;
    }
    const values = (rows || [])
      .map(player => getPlayerAnalysisSortValue(player, sortKey))
      .map(toPlayerNumber)
      .filter(value => value !== null);
    const average = !info.noAverage && values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    const teamValue = getPlayerAnalysisTeamSortValue(sortKey);
    const cards = [
      {
        label: `${info.label} 選手平均`,
        value: average === null ? "-" : formatPlayerAnalysisAverageValue(average, info.type),
        hidden: info.noAverage
      },
      {
        label: info.teamLabel || "チーム数値",
        value: formatPlayerAnalysisMetricValue(teamValue, info.type),
        hidden: teamValue === null
      }
    ].filter(card => !card.hidden);
    if (!cards.length) {
      sortSummary.innerHTML = `<span>${escapeHtml(info.label)}</span>`;
      return;
    }
    sortSummary.innerHTML = cards.map(card => `
      <div>
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
      </div>
    `).join("");
  }

  function updatePlayerAnalysisSortIndicators() {
    const { tableHead, sortSelect, sortKeySelect, sortDirectionSelect, listDetailToggle } = getPlayerAnalysisElements();
    if (!tableHead) return;
    tableHead.querySelectorAll("th[data-sort]").forEach(th => {
      const active = th.dataset.sort === playerAnalysisState.sortKey;
      th.classList.toggle("sort-asc", active && playerAnalysisState.sortDirection === "asc");
      th.classList.toggle("sort-desc", active && playerAnalysisState.sortDirection === "desc");
      th.setAttribute("aria-sort", active ? (playerAnalysisState.sortDirection === "asc" ? "ascending" : "descending") : "none");
    });
    if (sortSelect) {
      const value = `${playerAnalysisState.sortKey}:${playerAnalysisState.sortDirection}`;
      const hasOption = Array.from(sortSelect.options).some(option => option.value === value);
      if (hasOption) sortSelect.value = value;
    }
    if (sortKeySelect) sortKeySelect.value = playerAnalysisState.sortKey;
    if (sortDirectionSelect) sortDirectionSelect.value = playerAnalysisState.sortDirection;
    if (listDetailToggle) {
      listDetailToggle.setAttribute("aria-pressed", playerAnalysisState.listDetail ? "true" : "false");
      listDetailToggle.textContent = `詳細 ${playerAnalysisState.listDetail ? "ON" : "OFF"}`;
    }
  }

  function resetPlayerAnalysisNumericState() {
    playerAnalysisState.numberFilter = "";
    playerAnalysisState.playedMin = "";
    playerAnalysisState.playedMax = "";
    playerAnalysisState.startsMin = "";
    playerAnalysisState.goalsMin = "";
    playerAnalysisState.playedRateMin = "";
    playerAnalysisState.scoredRateMin = "";
    playerAnalysisState.scoredPpmMin = "";
    playerAnalysisState.monthFilter = "";
    playerAnalysisState.monthGoalsMin = "";
    playerAnalysisState.monthPlayedRateMin = "";
    playerAnalysisState.yellowMin = "";
    playerAnalysisState.redMin = "";
    playerAnalysisState.seasonsMin = "";
    playerAnalysisState.seasonsMax = "";
  }

  function getPlayerAnalysisCompactFilterMap() {
    return {
      "number": "numberFilter",
      "played-min": "playedMin",
      "played-max": "playedMax",
      "starts-min": "startsMin",
      "goals-min": "goalsMin",
      "played-rate-min": "playedRateMin",
      "scored-rate-min": "scoredRateMin",
      "scored-ppm-min": "scoredPpmMin",
      "month-goals-min": "monthGoalsMin",
      "month-played-rate-min": "monthPlayedRateMin",
      "yellow-min": "yellowMin",
      "red-min": "redMin",
      "seasons-min": "seasonsMin",
      "seasons-max": "seasonsMax"
    };
  }

  function isPlayerAnalysisMonthCompactFilter(type) {
    return type === "month-goals-min" || type === "month-goals-max"
      || type === "month-played-rate-min" || type === "month-played-rate-max";
  }

  function updatePlayerAnalysisCompactFilterControls(els = getPlayerAnalysisElements()) {
    if (!els.compactFilterMonth) return;
    const isMonthFilter = isPlayerAnalysisMonthCompactFilter(els.compactFilterType ? els.compactFilterType.value : playerAnalysisState.compactFilterType);
    const field = els.compactFilterMonth.closest(".pa-filter-month-field");
    const container = els.compactFilterMonth.closest(".pa-compact-number-filter");
    if (container) container.classList.toggle("month-active", isMonthFilter);
    if (field) field.hidden = !isMonthFilter;
    els.compactFilterMonth.disabled = !isMonthFilter;
  }

  function applyPlayerAnalysisCompactFilterState(els) {
    const type = els.compactFilterType ? els.compactFilterType.value : "";
    const value = els.compactFilterValue ? els.compactFilterValue.value : "";
    const month = els.compactFilterMonth ? els.compactFilterMonth.value : playerAnalysisState.compactFilterMonth;
    playerAnalysisState.compactFilterType = type;
    playerAnalysisState.compactFilterValue = value;
    playerAnalysisState.compactFilterMonth = month || "5";
    resetPlayerAnalysisNumericState();
    const targetKey = getPlayerAnalysisCompactFilterMap()[type];
    if (targetKey && String(value).trim() !== "") {
      playerAnalysisState[targetKey] = value;
      if (isPlayerAnalysisMonthCompactFilter(type)) {
        playerAnalysisState.monthFilter = playerAnalysisState.compactFilterMonth;
      }
    }
    updatePlayerAnalysisCompactFilterControls(els);
    [
      "numberFilter", "playedMin", "playedMax", "startsMin", "goalsMin",
      "playedRateMin", "scoredRateMin", "scoredPpmMin", "monthFilter",
      "monthGoalsMin", "monthPlayedRateMin", "yellowMin", "redMin",
      "seasonsMin", "seasonsMax"
    ].forEach(key => {
      const inputKey = key === "numberFilter" ? "numberFilter" : key.charAt(0).toLowerCase() + key.slice(1);
      if (els[inputKey]) els[inputKey].value = playerAnalysisState[key] || "";
    });
  }

  function applyPlayerAnalysisSortSelection(value) {
    const [key, direction] = String(value || "").split(":");
    if (!key) return;
    playerAnalysisState.sortKey = key;
    playerAnalysisState.sortDirection = direction === "asc" ? "asc" : "desc";
    renderPlayerAnalysisTable();
  }

  function renderPlayerAnalysisDetailFilterModes() {
    const { detailFilterModeButtons } = getPlayerAnalysisElements();
    detailFilterModeButtons.forEach(button => {
      const active = button.dataset.paDetailFilterMode === playerAnalysisState.advancedFilterLogic;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderPlayerAnalysisAdvancedFilterRows() {
    const { advancedFilterRows } = getPlayerAnalysisElements();
    if (!advancedFilterRows) return;
    const filters = playerAnalysisState.advancedFilters && playerAnalysisState.advancedFilters.length
      ? playerAnalysisState.advancedFilters
      : [createPlayerAnalysisAdvancedFilter()];
    const optionGroups = getPlayerAnalysisAdvancedFilterOptions();
    advancedFilterRows.innerHTML = filters.map((filter, index) => {
      const type = String(filter.type || "");
      const monthActive = isPlayerAnalysisMonthCompactFilter(type);
      return `
        <div class="pa-filter-condition-row ${monthActive ? "month-active" : ""}" data-pa-filter-index="${index}">
          <label class="pa-select-field">
            <span>条件 ${index + 1}</span>
            <select data-pa-filter-type>
              ${optionGroups.map(group => `
                <optgroup label="${escapeHtml(group.label)}">
                  ${group.options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === type ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
                </optgroup>
              `).join("")}
            </select>
          </label>
          <label class="pa-select-field pa-filter-month-field" ${monthActive ? "" : "hidden"}>
            <span>月</span>
            <select data-pa-filter-month ${monthActive ? "" : "disabled"}>
              ${Array.from({ length: 12 }, (_, itemIndex) => {
                const month = String(itemIndex + 1);
                return `<option value="${month}" ${String(filter.month || "5") === month ? "selected" : ""}>${month}月</option>`;
              }).join("")}
            </select>
          </label>
          <label class="pa-number-field compact">
            <span>数値</span>
            <input type="number" data-pa-filter-value min="0" inputmode="decimal" value="${escapeHtml(String(filter.value || ""))}" placeholder="例: 10">
          </label>
          <button type="button" class="pa-filter-condition-remove" data-pa-filter-remove="${index}" aria-label="条件 ${index + 1} を削除">×</button>
        </div>
      `;
    }).join("");
  }

  function readPlayerAnalysisAdvancedFilterRows() {
    const { advancedFilterRows } = getPlayerAnalysisElements();
    if (!advancedFilterRows) return;
    const rows = Array.from(advancedFilterRows.querySelectorAll(".pa-filter-condition-row"));
    playerAnalysisState.advancedFilters = rows.map(row => ({
      type: row.querySelector("[data-pa-filter-type]")?.value || "",
      value: row.querySelector("[data-pa-filter-value]")?.value || "",
      month: row.querySelector("[data-pa-filter-month]")?.value || "5"
    }));
    if (!playerAnalysisState.advancedFilters.length) {
      playerAnalysisState.advancedFilters = [createPlayerAnalysisAdvancedFilter()];
    }
  }

  async function applyPlayerAnalysisSortControls() {
    const { sortKeySelect, sortDirectionSelect } = getPlayerAnalysisElements();
    const previousKey = playerAnalysisState.sortKey;
    if (sortKeySelect) playerAnalysisState.sortKey = sortKeySelect.value || "played_matches";
    if (sortDirectionSelect) {
      if (shouldPlayerAnalysisSortAscByDefault(playerAnalysisState.sortKey) && previousKey !== playerAnalysisState.sortKey) {
        playerAnalysisState.sortDirection = "asc";
        sortDirectionSelect.value = "asc";
      } else {
        playerAnalysisState.sortDirection = sortDirectionSelect.value === "asc" ? "asc" : "desc";
      }
    }
    if (needsPlayerSeasonMeta() && !playerAnalysisSeasonMetaCache.has(getPlayerAnalysisFilterCacheKey())) {
      setPlayerAnalysisStatus("所属年数を集計中...");
      await ensurePlayerAnalysisSeasonMeta(playerAnalysisState.matchScope, getActivePlayerAnalysisCompetitionFilter());
      setPlayerAnalysisStatus("", false);
    }
    renderPlayerAnalysisTable();
  }

  function renderPlayerAnalysisSummary(rows) {
    const { summary } = getPlayerAnalysisElements();
    if (!summary) return;
    if (!rows.length) {
      summary.innerHTML = "";
      return;
    }
    const playedPlayers = rows.filter(row => (toPlayerNumber(row.played_matches) || 0) > 0).length;
    const totalGoals = rows.reduce((sum, row) => sum + (toPlayerNumber(row.goals) || 0), 0);
    const topAppearance = [...rows].sort((a, b) => (toPlayerNumber(b.played_matches) || 0) - (toPlayerNumber(a.played_matches) || 0))[0];
    const topScorer = [...rows].sort((a, b) => (toPlayerNumber(b.goals) || 0) - (toPlayerNumber(a.goals) || 0))[0];
    const topStarter = [...rows].sort((a, b) => (toPlayerNumber(b.starter_matches) || 0) - (toPlayerNumber(a.starter_matches) || 0))[0];
    const topWinRate = [...rows]
      .filter(row => (toPlayerNumber(row.played_matches) || 0) > 0 && toPlayerNumber(row.played_win_rate) !== null)
      .sort((a, b) => (toPlayerNumber(b.played_win_rate) || 0) - (toPlayerNumber(a.played_win_rate) || 0)
        || (toPlayerNumber(b.played_matches) || 0) - (toPlayerNumber(a.played_matches) || 0))[0];
    const yearLabel = getPlayerAnalysisTimeLabel();
    const scopeLabel = getPlayerAnalysisScopeLabel();
    const totals = [
      { label: "登録選手", value: rows.length, unit: "名" },
      { label: "出場選手", value: playedPlayers, unit: "名" },
      { label: "チーム総得点", value: totalGoals, unit: "得点" }
    ];
    const leaders = [
      { label: "最多出場", value: formatPlayerNumber(topAppearance && topAppearance.played_matches), unit: "試合", name: topAppearance ? topAppearance.player_name : "-" },
      { label: "最多先発", value: formatPlayerNumber(topStarter && topStarter.starter_matches), unit: "試合", name: topStarter ? topStarter.player_name : "-" },
      { label: "得点王", value: formatPlayerNumber(topScorer && topScorer.goals), unit: "得点", name: topScorer ? topScorer.player_name : "-" },
      { label: "最高出場勝率", value: formatPlayerRate(topWinRate && topWinRate.played_win_rate), unit: "", name: topWinRate ? topWinRate.player_name : "-" }
    ];
    summary.innerHTML = `
      <section class="pa-summary-overview" aria-label="分析対象と主要数値">
        <header class="pa-summary-scope">
          <span><small>ANALYSIS SCOPE</small><strong>${escapeHtml(yearLabel)}</strong></span>
          <em>${escapeHtml(scopeLabel)}</em>
        </header>
        <div class="pa-summary-totals">
          ${totals.map(item => `
            <article>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(String(item.value))}<small>${escapeHtml(item.unit)}</small></strong>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="pa-summary-leaders" aria-label="トップ選手">
        <header><span>TOP PERFORMERS</span><small>対象期間のリーダー</small></header>
        <div class="pa-summary-leader-grid">
          ${leaders.map((item, index) => `
            <article>
              <i aria-hidden="true">${String(index + 1).padStart(2, "0")}</i>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(String(item.value))}${item.unit ? `<small>${escapeHtml(item.unit)}</small>` : ""}</strong>
              <b>${escapeHtml(item.name)}</b>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function createPlayerRankingMetric() {
    return {
      played_minutes: 0,
      played_metric_matches: 0,
      sub_goals: 0,
      first_half_goals: 0,
      second_half_goals: 0,
      additional_time_goals: 0,
      extra_time_goals: 0,
      hat_tricks: 0,
      important_goal_points: 0,
      played_goals_against: 0,
      played_goals_against_avg: null,
      played_clean_sheets: 0,
      played_non_losses: 0,
      on_pitch_goals_for: 0,
      on_pitch_goals_against: 0,
      on_pitch_goal_diff: 0,
      gk_matches: 0,
      gk_goals_against: 0,
      gk_goals_against_avg: null,
      gk_clean_sheets: 0
    };
  }

  function getPlayerRankingValue(player, config) {
    if (!player || !config) return null;
    if (typeof config.valueGetter === "function") {
      return toPlayerNumber(config.valueGetter(player));
    }
    if (config.metricKey) {
      const metrics = player.__paRankingMetrics || {};
      return toPlayerNumber(metrics[config.metricKey]);
    }
    return toPlayerNumber(player[config.sortKey]);
  }

  function formatPlayerMinutes(value) {
    const n = toPlayerNumber(value);
    return n === null ? "-" : `${Math.round(n).toLocaleString("ja-JP")}分`;
  }

  function formatPlayerGoalsAgainstAverage(value) {
    const n = toPlayerNumber(value);
    return n === null ? "-" : n.toFixed(2);
  }

  function parsePlayerMinuteInfo(source) {
    const raw = String((source && (source.time || source.minute_text || source.minute)) || "");
    const fromRaw = raw.match(/\d+/);
    const fromMinute = toPlayerNumber(source && source.minute);
    const minute = fromMinute !== null ? fromMinute : (fromRaw ? Number(fromRaw[0]) : null);
    return {
      minute,
      isAdditional: /\+/.test(raw),
      isExtra: minute !== null && minute > 90 && !/\+/.test(raw)
    };
  }

  function parsePlayerGoalMinute(goal) {
    return parsePlayerMinuteInfo(goal);
  }

  function comparePlayerGoalOrder(a, b) {
    const aMinute = parsePlayerGoalMinute(a).minute;
    const bMinute = parsePlayerGoalMinute(b).minute;
    const aOrder = aMinute === null ? Number.POSITIVE_INFINITY : aMinute;
    const bOrder = bMinute === null ? Number.POSITIVE_INFINITY : bMinute;
    return aOrder - bOrder || String(a.player_key || a.player_name || "").localeCompare(String(b.player_key || b.player_name || ""), "ja");
  }

  function estimatePlayerGoalImportance(goalIndex, match, teamGoalCount) {
    const targetScore = toPlayerNumber(match && match.target_score) || 0;
    const opponentScore = toPlayerNumber(match && match.opponent_score) || 0;
    if (!teamGoalCount || goalIndex < 1) return 0.3;

    if (targetScore > opponentScore && goalIndex === opponentScore + 1) return 1.0;
    if (targetScore === opponentScore && goalIndex === teamGoalCount) return 0.8;
    if (goalIndex === 1 && opponentScore === 0) return 0.7;
    if (targetScore < opponentScore && opponentScore - goalIndex === 1) return 0.5;
    if (goalIndex >= opponentScore + 4) return 0.1;
    return 0.3;
  }

  function isPlayerRedCard(card) {
    const text = String((card && (card.type || card.card || card.label)) || "").normalize("NFKC").toLowerCase();
    return text.includes("退場") || text.includes("red");
  }

  function parsePlayerCardMinute(card) {
    return parsePlayerMinuteInfo(card).minute;
  }

  function getPlayerRedCardMinuteFromCards(cards) {
    const minutes = (Array.isArray(cards) ? cards : [])
      .filter(isPlayerRedCard)
      .map(parsePlayerCardMinute)
      .filter(minute => minute !== null);
    return minutes.length ? Math.min(...minutes) : null;
  }

  function buildPlayerRedCardMinuteMap(cards, sourceYear) {
    const map = new Map();
    (Array.isArray(cards) ? cards : []).forEach(card => {
      if (!card || !card.match_id || !isPlayerRedCard(card)) return;
      const identity = getPlayerCanonicalIdentity(card, sourceYear);
      const groupKey = identity.groupKey;
      const minute = parsePlayerCardMinute(card);
      if (!groupKey || minute === null) return;
      const key = `${String(card.match_id)}|${groupKey}`;
      const current = map.get(key);
      if (current === undefined || minute < current) map.set(key, minute);
    });
    return map;
  }

  function getPlayerMatchEndMinute(match, appearances = [], goals = [], cards = []) {
    const year = toPlayerNumber(match && match.season) || toPlayerNumber((goals[0] || appearances[0] || cards[0] || {}).season);
    const extraSubMinutes = (Array.isArray(appearances) ? appearances : [])
      .flatMap(appearance => [toPlayerNumber(appearance && appearance.minute_in), toPlayerNumber(appearance && appearance.minute_out)])
      .filter(minute => minute !== null && minute > 90);
    const extraGoalMinutes = (Array.isArray(goals) ? goals : [])
      .map(parsePlayerGoalMinute)
      .filter(info => info.isExtra)
      .map(info => info.minute)
      .filter(minute => minute !== null);
    const hasExtraGoal = extraGoalMinutes.length > 0;
    const hasExtraCard = (Array.isArray(cards) ? cards : [])
      .map(parsePlayerMinuteInfo)
      .some(info => info.isExtra);
    const hasExtraSub = extraSubMinutes.some(minute => minute > 105);
    if (!hasExtraGoal && !hasExtraCard && !hasExtraSub) return 90;
    if (year === 1999) {
      if (extraGoalMinutes.length) return Math.min(...extraGoalMinutes);
      const targetScore = toPlayerNumber(match && match.target_score);
      const opponentScore = toPlayerNumber(match && match.opponent_score);
      if (targetScore !== null && opponentScore !== null && targetScore !== opponentScore && extraSubMinutes.length) {
        return Math.max(...extraSubMinutes);
      }
    }
    return 120;
  }

  function buildPlayerMatchEndMinuteMap(matches = [], appearances = [], goals = [], cards = []) {
    const matchMap = new Map((matches || []).map(match => [String(match.match_id), match]));
    const appearancesByMatch = new Map();
    const goalsByMatch = new Map();
    const cardsByMatch = new Map();
    (Array.isArray(appearances) ? appearances : []).forEach(appearance => {
      const key = String(appearance && appearance.match_id);
      if (!matchMap.has(key)) return;
      if (!appearancesByMatch.has(key)) appearancesByMatch.set(key, []);
      appearancesByMatch.get(key).push(appearance);
    });
    (Array.isArray(goals) ? goals : []).forEach(goal => {
      const key = String(goal && goal.match_id);
      if (!matchMap.has(key)) return;
      if (!goalsByMatch.has(key)) goalsByMatch.set(key, []);
      goalsByMatch.get(key).push(goal);
    });
    (Array.isArray(cards) ? cards : []).forEach(card => {
      const key = String(card && card.match_id);
      if (!matchMap.has(key)) return;
      if (!cardsByMatch.has(key)) cardsByMatch.set(key, []);
      cardsByMatch.get(key).push(card);
    });
    return new Map(Array.from(matchMap.entries()).map(([matchId, match]) => [
      matchId,
      getPlayerMatchEndMinute(match, appearancesByMatch.get(matchId) || [], goalsByMatch.get(matchId) || [], cardsByMatch.get(matchId) || [])
    ]));
  }

  function calculatePlayerAppearanceMinutes(appearance, forcedEndMinute = null, matchEndMinute = 90) {
    if (!appearance || !appearance.played) return 0;
    const start = toPlayerNumber(appearance.minute_in) || 0;
    const endValue = toPlayerNumber(appearance.minute_out);
    const forcedEnd = toPlayerNumber(forcedEndMinute);
    const defaultEnd = toPlayerNumber(matchEndMinute) || 90;
    const endCandidates = [];
    if (endValue !== null) endCandidates.push(endValue);
    if (forcedEnd !== null) endCandidates.push(forcedEnd);
    const end = endCandidates.length ? Math.min(...endCandidates) : defaultEnd;
    return Math.max(0, end - start);
  }

  function isPlayerGoalEventDuringAppearance(eventMinute, appearance, forcedEndMinute = null, matchEndMinute = 90) {
    const minute = toPlayerNumber(eventMinute);
    if (!appearance || !appearance.played || minute === null) return false;
    const start = toPlayerNumber(appearance.minute_in) || 0;
    const endValue = toPlayerNumber(appearance.minute_out);
    const forcedEnd = toPlayerNumber(forcedEndMinute);
    const defaultEnd = toPlayerNumber(matchEndMinute) || 90;
    const endCandidates = [];
    if (endValue !== null) endCandidates.push(endValue);
    if (forcedEnd !== null) endCandidates.push(forcedEnd);
    const end = endCandidates.length ? Math.min(...endCandidates) : defaultEnd;
    return minute >= start && minute <= end;
  }

  function ensurePlayerRankingMetric(metrics, source, sourceYear) {
    const identity = getPlayerCanonicalIdentity(source, sourceYear);
    const key = identity.groupKey;
    if (!key) return null;
    if (!metrics.has(key)) metrics.set(key, createPlayerRankingMetric());
    return metrics.get(key);
  }

  async function buildPlayerAnalysisRankingMetrics(year = playerAnalysisState.year, scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const metrics = new Map();
    const years = Array.isArray(year) ? year.map(Number).filter(Number.isInteger) : (year === "all" ? getPlayerAnalysisYears() : [Number(year)]);

    for (const targetYear of years) {
      if (!Number.isInteger(targetYear)) continue;
      const dataset = await loadPlayerAnalysisDatasetYear(targetYear);
      if (dataset.missing) continue;
      const targetMatches = (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
      if (!targetMatches.length) continue;

      const matchMap = new Map(targetMatches.map(match => [String(match.match_id), match]));
      const historyMatches = await loadPlayerAnalysisHistoryYear(targetYear);
      const goalEventsByMatchId = new Map(targetMatches.map(match => {
        const historyMatch = findPlayerAnalysisHistoryMatch(historyMatches, match);
        return [
          String(match.match_id),
          getPlayerAnalysisGoalEventsForMatch(match, historyMatch, dataset.goals)
        ];
      }));
      const matchEndMinuteById = buildPlayerMatchEndMinuteMap(targetMatches, dataset.appearances, dataset.goals, dataset.cards);
      const appearanceByMatchPlayer = new Map();
      const redCardMinuteByMatchPlayer = buildPlayerRedCardMinuteMap(
        (dataset.cards || []).filter(card => matchMap.has(String(card.match_id))),
        targetYear
      );

      (dataset.appearances || []).forEach(appearance => {
        const match = matchMap.get(String(appearance.match_id));
        if (!match) return;
        const identity = getPlayerCanonicalIdentity(appearance, targetYear);
        const groupKey = identity.groupKey;
        if (!groupKey) return;
        if (appearance.played) {
          const matchPlayerKey = `${String(appearance.match_id)}|${groupKey}`;
          appearanceByMatchPlayer.set(matchPlayerKey, appearance);
          const metric = ensurePlayerRankingMetric(metrics, appearance, targetYear);
          if (!metric) return;
          const opponentScore = toPlayerNumber(match.opponent_score) || 0;
          metric.played_metric_matches += 1;
          metric.played_minutes += calculatePlayerAppearanceMinutes(
            appearance,
            redCardMinuteByMatchPlayer.get(matchPlayerKey),
            matchEndMinuteById.get(String(appearance.match_id))
          );
          metric.played_goals_against += opponentScore;
          if (opponentScore === 0) metric.played_clean_sheets += 1;
          if (match.result !== "loss") metric.played_non_losses += 1;
          const goalEvents = goalEventsByMatchId.get(String(appearance.match_id)) || [];
          goalEvents.forEach(event => {
            if (!isPlayerGoalEventDuringAppearance(
              event.minute,
              appearance,
              redCardMinuteByMatchPlayer.get(matchPlayerKey),
              matchEndMinuteById.get(String(appearance.match_id))
            )) return;
            if (event.side === "against") metric.on_pitch_goals_against += 1;
            else metric.on_pitch_goals_for += 1;
          });
          if (String(appearance.position || "").trim() === "GK") {
            metric.gk_matches += 1;
            metric.gk_goals_against += opponentScore;
            if (opponentScore === 0) metric.gk_clean_sheets += 1;
          }
        }
      });

      const goalsByMatchPlayer = new Map();
      const targetGoalsByMatch = new Map();
      (dataset.goals || []).forEach(goal => {
        const match = matchMap.get(String(goal.match_id));
        if (!match || goal.is_own_goal || !goal.player_key) return;
        const matchId = String(goal.match_id);
        if (!targetGoalsByMatch.has(matchId)) targetGoalsByMatch.set(matchId, []);
        targetGoalsByMatch.get(matchId).push(goal);
      });
      targetGoalsByMatch.forEach(goals => goals.sort(comparePlayerGoalOrder));

      Array.from(targetGoalsByMatch.values()).flat().forEach(goal => {
        const match = matchMap.get(String(goal.match_id));
        if (!match) return;
        const identity = getPlayerCanonicalIdentity(goal, targetYear);
        const groupKey = identity.groupKey;
        const metric = ensurePlayerRankingMetric(metrics, goal, targetYear);
        if (!metric || !groupKey) return;
        const matchPlayerKey = `${String(goal.match_id)}|${groupKey}`;
        const appearance = appearanceByMatchPlayer.get(matchPlayerKey);
        if (appearance && (appearance.sub_in || String(appearance.appearance_type || "") === "sub")) {
          metric.sub_goals += 1;
        }
        const goalMinute = parsePlayerGoalMinute(goal);
        if (goalMinute.isExtra) metric.extra_time_goals += 1;
        else if (goalMinute.isAdditional) metric.additional_time_goals += 1;
        else if (goalMinute.minute !== null && goalMinute.minute <= 45) metric.first_half_goals += 1;
        else metric.second_half_goals += 1;

        const orderedGoals = targetGoalsByMatch.get(String(goal.match_id)) || [];
        const goalIndex = orderedGoals.indexOf(goal) + 1;
        metric.important_goal_points += estimatePlayerGoalImportance(goalIndex, match, orderedGoals.length);
        goalsByMatchPlayer.set(matchPlayerKey, (goalsByMatchPlayer.get(matchPlayerKey) || 0) + 1);
      });

      goalsByMatchPlayer.forEach((goalCount, matchPlayerKey) => {
        if (goalCount < 3) return;
        const groupKey = String(matchPlayerKey).split("|").pop();
        const metric = metrics.get(groupKey);
        if (metric) metric.hat_tricks += 1;
      });
    }

    metrics.forEach(metric => {
      metric.played_goals_against_avg = metric.played_metric_matches
        ? Math.round((metric.played_goals_against / metric.played_metric_matches) * 100) / 100
        : null;
      metric.important_goal_points = Math.round((metric.important_goal_points || 0) * 10) / 10;
      metric.gk_goals_against_avg = metric.gk_matches
        ? Math.round((metric.gk_goals_against / metric.gk_matches) * 100) / 100
        : null;
      metric.on_pitch_goal_diff = (toPlayerNumber(metric.on_pitch_goals_for) || 0) - (toPlayerNumber(metric.on_pitch_goals_against) || 0);
    });

    return metrics;
  }

  async function ensurePlayerAnalysisRankingMetrics(rows, yearValue = getPlayerAnalysisTimeValue()) {
    const yearKey = Array.isArray(yearValue) ? yearValue.join("-") : yearValue;
    const cacheKey = `${getPlayerAnalysisFilterCacheKey()}:${yearKey}`;
    let metrics = playerAnalysisRankingMetricsCache.get(cacheKey);
    if (!metrics) {
      metrics = await buildPlayerAnalysisRankingMetrics(yearValue, playerAnalysisState.matchScope, getActivePlayerAnalysisCompetitionFilter());
      playerAnalysisRankingMetricsCache.set(cacheKey, metrics);
    }
    (rows || []).forEach(row => {
      row.__paRankingMetrics = metrics.get(getPlayerGroupKey(row)) || createPlayerRankingMetric();
    });
  }

  function getPlayerAnalysisRankingConfigs() {
    return [
      {
        id: "goals",
        title: "ゴール数ランキング",
        sortKey: "goals",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (toPlayerNumber(player.goals) || 0) > 0
      },
      {
        id: "attack-impact",
        title: "攻撃インパクトランキング",
        valueGetter: player => getPlayerImpactValue(player, "attack"),
        valueFormatter: (_, player) => formatPlayerImpactScore(player, "attack"),
        keepEmpty: true
      },
      {
        id: "defense-impact",
        title: "守備インパクトランキング",
        valueGetter: player => getPlayerImpactValue(player, "defense"),
        valueFormatter: (_, player) => formatPlayerImpactScore(player, "defense"),
        keepEmpty: true
      },
      {
        id: "total-impact",
        title: "総合インパクトランキング",
        valueGetter: player => getPlayerImpactValue(player, "total"),
        valueFormatter: (_, player) => formatPlayerImpactScore(player, "total"),
        keepEmpty: true
      },
      {
        id: "played-minutes",
        title: "出場時間ランキング",
        metricKey: "played_minutes",
        valueFormatter: formatPlayerMinutes,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "played_minutes" }) || 0) > 0
      },
      {
        id: "played-matches",
        title: "出場試合数ランキング",
        sortKey: "played_matches",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (toPlayerNumber(player.played_matches) || 0) > 0
      },
      {
        id: "starts",
        title: "スタメン数ランキング",
        sortKey: "starter_matches",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (toPlayerNumber(player.starter_matches) || 0) > 0
      },
      {
        id: "subs",
        title: "途中出場数ランキング",
        sortKey: "sub_matches",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (toPlayerNumber(player.sub_matches) || 0) > 0
      },
      {
        id: "sub-goals",
        title: "途中出場でのゴール数ランキング",
        metricKey: "sub_goals",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "sub_goals" }) || 0) > 0
      },
      {
        id: "first-half-goals",
        title: "前半ゴール数ランキング",
        metricKey: "first_half_goals",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "first_half_goals" }) || 0) > 0
      },
      {
        id: "second-half-goals",
        title: "後半ゴール数ランキング",
        metricKey: "second_half_goals",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "second_half_goals" }) || 0) > 0
      },
      {
        id: "additional-time-goals",
        title: "アディショナルタイムゴール数ランキング",
        metricKey: "additional_time_goals",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "additional_time_goals" }) || 0) > 0
      },
      {
        id: "extra-time-goals",
        title: "延長ゴール数ランキング",
        metricKey: "extra_time_goals",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "extra_time_goals" }) || 0) > 0
      },
      {
        id: "hat-tricks",
        title: "ハットトリック数ランキング",
        metricKey: "hat_tricks",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "hat_tricks" }) || 0) > 0
      },
      {
        id: "gk-goals-against-average",
        title: "GK出場時失点平均ランキング",
        metricKey: "gk_goals_against_avg",
        sortDirection: "asc",
        valueFormatter: formatPlayerGoalsAgainstAverage,
        filterFn: player => {
          const metrics = player.__paRankingMetrics || {};
          return (toPlayerNumber(metrics.gk_matches) || 0) > 0 && toPlayerNumber(metrics.gk_goals_against_avg) !== null;
        }
      },
      {
        id: "gk-clean-sheets",
        title: "GK出場時無失点試合数ランキング",
        metricKey: "gk_clean_sheets",
        valueFormatter: formatPlayerNumber,
        filterFn: player => (getPlayerRankingValue(player, { metricKey: "gk_clean_sheets" }) || 0) > 0
      },
      {
        id: "played-win-rate",
        title: "出場時勝率ランキング",
        sortKey: "played_win_rate",
        valueFormatter: formatPlayerRate,
        filterFn: player => (toPlayerNumber(player.played_matches) || 0) > 0 && toPlayerNumber(player.played_win_rate) !== null
      },
      {
        id: "scored-win-rate",
        title: "ゴールした試合の勝率ランキング",
        sortKey: "scored_win_rate",
        valueFormatter: formatPlayerRate,
        filterFn: player => (toPlayerNumber(player.scored_matches) || 0) > 0 && toPlayerNumber(player.scored_win_rate) !== null
      }
    ];
  }

  function getPlayerRankingRows(rows, config) {
    return rows
      .filter(config.filterFn || (() => true))
      .sort((a, b) => {
        const aValue = getPlayerRankingValue(a, config);
        const bValue = getPlayerRankingValue(b, config);
        const aMissing = aValue === null;
        const bMissing = bValue === null;
        if (aMissing && bMissing) return a.__paIndex - b.__paIndex;
        if (aMissing) return 1;
        if (bMissing) return -1;
        const diff = config.sortDirection === "asc" ? aValue - bValue : bValue - aValue;
        return diff || ((toPlayerNumber(b.played_matches) || 0) - (toPlayerNumber(a.played_matches) || 0)) || a.__paIndex - b.__paIndex;
      });
  }

  function getRankedPlayerRankingItems(rows, config) {
    let previousValue = null;
    let currentRank = 0;
    return getPlayerRankingRows(rows, config).map((player, index) => {
      const value = getPlayerRankingValue(player, config);
      const valueKey = value === null ? null : String(value);
      if (valueKey === null) {
        currentRank = null;
      } else if (valueKey !== previousValue) {
        currentRank = index + 1;
      }
      previousValue = valueKey;
      return { player, value, rank: currentRank };
    });
  }

  function buildPlayerRanking(rows, config) {
    const items = getRankedPlayerRankingItems(rows, config).filter(item => item.rank !== null).slice(0, 5);
    if (!items.length && !config.keepEmpty) return "";
    return `
      <section class="pa-rank-card" data-pa-ranking="${escapeHtml(config.id)}" role="button" tabindex="0" aria-label="${escapeHtml(config.title)}を全順位で表示">
        <div class="pa-rank-card-head">
          <h3>${escapeHtml(config.title)}</h3>
          <span>全順位</span>
        </div>
        ${items.length ? `<ol class="pa-rank-list">
          ${items.map(item => `
            <li>
              <b>${escapeHtml(formatPlayerNumber(item.rank))}</b>
              <span>${escapeHtml(item.player.player_name || "-")}</span>
              <em>${escapeHtml(config.valueFormatter(item.value, item.player))}</em>
            </li>
          `).join("")}
        </ol>` : `<div class="pa-rank-empty">${escapeHtml(config.emptyMessage || "データがありません")}</div>`}
      </section>
    `;
  }

  function renderPlayerAnalysisRankings(rows) {
    const { rankings } = getPlayerAnalysisElements();
    if (!rankings) return;
    if (!rows.length) {
      rankings.innerHTML = "";
      return;
    }
    rankings.innerHTML = getPlayerAnalysisRankingConfigs()
      .map(config => buildPlayerRanking(rows, config))
      .join("");
  }

  function ensurePlayerAnalysisModal() {
    let backdrop = document.getElementById("pa-modal-backdrop");
    let modal = document.getElementById("pa-modal");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "pa-modal-backdrop";
      backdrop.className = "pa-modal-backdrop";
      document.body.appendChild(backdrop);
    }
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pa-modal";
      modal.className = "pa-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      document.body.appendChild(modal);
    }
    backdrop.onclick = closePlayerAnalysisModal;
    return { backdrop, modal };
  }

  function closePlayerAnalysisModal(options = {}) {
    const closeDirect = () => {
      document.getElementById("pa-modal-backdrop")?.classList.remove("active");
      document.getElementById("pa-modal")?.classList.remove("active");
      document.body.classList.remove("pa-modal-open");
      const originMode = document.body.dataset.paModalOriginMode;
      if (originMode) {
        document.body.setAttribute("data-mode", originMode);
        delete document.body.dataset.paModalOriginMode;
      }
    };
    if (options.history === false) {
      closeDirect();
      return;
    }
    closeAppHistoryGroup(kind => kind.startsWith("pa-modal:"), closeDirect);
  }

  function setPlayerAnalysisModalContent(html) {
    const { backdrop, modal } = ensurePlayerAnalysisModal();
    if (currentMode !== "player-analysis" && !document.body.dataset.paModalOriginMode) {
      document.body.dataset.paModalOriginMode = document.body.getAttribute("data-mode") || currentMode;
      document.body.setAttribute("data-mode", "player-analysis");
    }
    modal.innerHTML = html;
    setupPlayerPhotos(modal);
    setupPlayerChantAudio(modal);
    backdrop.classList.add("active");
    modal.classList.add("active");
    document.body.classList.add("pa-modal-open");
  }

  function renderPlayerAnalysisModalShell(kicker, title, body, metaHtml = "") {
    return `
      <div class="pa-modal-head">
        <div class="pa-modal-title">
          <span class="pa-kicker">${escapeHtml(kicker)}</span>
          <h2>${escapeHtml(title || "-")}</h2>
        </div>
        <button type="button" class="pa-modal-close" data-pa-modal-close aria-label="閉じる">×</button>
      </div>
      ${metaHtml ? `<div class="pa-modal-meta">${metaHtml}</div>` : ""}
      <div class="pa-modal-body">${body}</div>
    `;
  }

  function findPlayerAnalysisRowByKey(key) {
    return [...playerAnalysisState.data, ...playerAnalysisState.filtered, ...playerAnalysisState.modalRankingRows]
      .find(row => getPlayerAnalysisKey(row) === key);
  }

  function openPlayerAnalysisRankingModal(rankingId, options = {}) {
    const config = getPlayerAnalysisRankingConfigs().find(item => item.id === rankingId);
    if (!config) return;
    const items = getRankedPlayerRankingItems(playerAnalysisState.data, config);
    const rows = items.map(item => item.player);
    playerAnalysisState.modalRankingRows = rows;
    const yearLabel = getPlayerAnalysisTimeLabel();
    const body = `
      ${rows.length ? `
      <ol class="pa-ranking-modal-list">
        ${items.map(item => {
          const player = item.player;
          const key = getPlayerAnalysisKey(player);
          return `
            <li>
              <b>${escapeHtml(item.rank === null ? "-" : formatPlayerNumber(item.rank))}</b>
              <button type="button" class="pa-modal-player-link" data-pa-key="${escapeHtml(key)}">${escapeHtml(player.player_name || "-")}</button>
              <span>${escapeHtml(formatPlayerList(player.positions))}</span>
              <em>${escapeHtml(config.valueFormatter(item.value, player))}</em>
            </li>
          `;
        }).join("")}
      </ol>
      ` : `<div class="pa-muted" style="padding:18px;text-align:center;">データがありません</div>`}
    `;
    const meta = `
      <span class="pa-chip">${escapeHtml(yearLabel)}</span>
      <span class="pa-chip scope">${escapeHtml(getPlayerAnalysisScopeLabel())}</span>
      <span class="pa-chip">${rows.length}人</span>
    `;
    setPlayerAnalysisModalContent(renderPlayerAnalysisModalShell("PLAYER RANKING", config.title, body, meta));
    addAppHistoryEntry(
      "pa-modal:ranking",
      () => openPlayerAnalysisRankingModal(rankingId, { history: false }),
      options
    );
  }

  function setPlayerAnalysisScreen(screen, options = {}) {
    const nextScreen = ["analysis", "compare", "opponents", "player-opponents"].includes(screen) ? screen : "analysis";
    playerAnalysisState.activeScreen = nextScreen;
    const { screens, bottomTabButtons } = getPlayerAnalysisElements();
    const page = document.querySelector(".player-analysis-page");
    if (page) page.dataset.paActiveScreen = nextScreen;
    screens.forEach(panel => {
      const active = panel.dataset.paScreen === nextScreen;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    bottomTabButtons.forEach(button => {
      const active = button.dataset.paScreenTarget === nextScreen;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (nextScreen === "compare") renderPlayerComparisonPanel();
    if (nextScreen === "opponents") renderPlayerOpponentPanel();
    if (nextScreen === "player-opponents") renderPlayerOpponentPlayerPanel();
    updatePlayerAnalysisScrollTopButton();
    if (options.history === true) {
      addAppHistoryEntry(
        `pa-screen:${nextScreen}`,
        () => setPlayerAnalysisScreen(nextScreen, { history: false }),
        options
      );
    }
  }

  function getPlayerSortedRows(rows = playerAnalysisState.data || []) {
    return [...(rows || [])].sort((a, b) => {
      const pos = getPlayerAnalysisSortValue(a, "position_order") - getPlayerAnalysisSortValue(b, "position_order");
      return pos || String(a.player_name || "").localeCompare(String(b.player_name || ""), "ja");
    });
  }

  function getPlayerSelectLabel(player) {
    return player.player_name || "-";
  }

  function getPlayerTimeScopeYears(scope) {
    return getPlayerAnalysisTimeYears();
  }

  function mergePlayerRankingMetric(target, source) {
    if (!target || !source) return;
    [
      "played_minutes", "played_metric_matches", "sub_goals", "first_half_goals",
      "second_half_goals", "additional_time_goals", "extra_time_goals", "hat_tricks",
      "important_goal_points", "played_goals_against", "played_clean_sheets",
      "played_non_losses", "on_pitch_goals_for", "on_pitch_goals_against",
      "on_pitch_goal_diff", "gk_matches", "gk_goals_against", "gk_clean_sheets"
    ].forEach(field => {
      target[field] = (toPlayerNumber(target[field]) || 0) + (toPlayerNumber(source[field]) || 0);
    });
  }

  function finalizeMergedPlayerRankingMetric(metric) {
    metric.played_goals_against_avg = metric.played_metric_matches
      ? Math.round((metric.played_goals_against / metric.played_metric_matches) * 100) / 100
      : null;
    metric.gk_goals_against_avg = metric.gk_matches
      ? Math.round((metric.gk_goals_against / metric.gk_matches) * 100) / 100
      : null;
    metric.important_goal_points = Math.round((metric.important_goal_points || 0) * 10) / 10;
    metric.on_pitch_goal_diff = (toPlayerNumber(metric.on_pitch_goals_for) || 0) - (toPlayerNumber(metric.on_pitch_goals_against) || 0);
    return metric;
  }

  async function buildPlayerRowsForYears(years, scope = playerAnalysisState.matchScope, competitionNames = getActivePlayerAnalysisCompetitionFilter()) {
    const targetYears = (years || []).map(Number).filter(Number.isInteger);
    if (!targetYears.length) return [];
    const entries = await Promise.all(targetYears.map(year => loadScopedPlayerAnalysisYear(year, scope, competitionNames)));
    const rows = aggregatePlayerAnalysisRows(entries.flatMap(entry => entry.rows || []));
    const metricsByGroup = new Map();
    for (const year of targetYears) {
      const metrics = await buildPlayerAnalysisRankingMetrics(year, scope, competitionNames);
      metrics.forEach((metric, groupKey) => {
        if (!metricsByGroup.has(groupKey)) metricsByGroup.set(groupKey, createPlayerRankingMetric());
        mergePlayerRankingMetric(metricsByGroup.get(groupKey), metric);
      });
    }
    metricsByGroup.forEach(finalizeMergedPlayerRankingMetric);
    rows.forEach(row => {
      row.__paRankingMetrics = metricsByGroup.get(getPlayerGroupKey(row)) || createPlayerRankingMetric();
    });
    ensurePlayerImpactScores(rows);
    return getPlayerSortedRows(rows);
  }

  async function getPlayerRowsForTimeScope(scope) {
    const years = getPlayerTimeScopeYears(scope);
    return buildPlayerRowsForYears(years);
  }

  function normalizePlayerCompareSelectionYear(index = 0) {
    const years = getPlayerAnalysisYears();
    const targetIndex = Number.isInteger(index) && index >= 0 && index < 3 ? index : 0;
    if (!Array.isArray(playerAnalysisState.compareChoiceYears)) {
      playerAnalysisState.compareChoiceYears = ["", "", ""];
    }
    while (playerAnalysisState.compareChoiceYears.length < 3) playerAnalysisState.compareChoiceYears.push("");
    const selected = Number(playerAnalysisState.compareChoiceYears[targetIndex]);
    if (Number.isInteger(selected) && years.includes(selected)) return String(selected);
    const activeYear = Number(playerAnalysisState.year);
    const fallback = Number.isInteger(activeYear) && years.includes(activeYear)
      ? activeYear
      : (years[years.length - 1] || PLAYER_ANALYSIS_YEAR_END);
    playerAnalysisState.compareChoiceYears[targetIndex] = String(fallback);
    return playerAnalysisState.compareChoiceYears[targetIndex];
  }

  function renderPlayerCompareSelectionYearOptions(select, index = 0) {
    if (!select) return;
    const selectedYear = normalizePlayerCompareSelectionYear(index);
    select.innerHTML = getPlayerAnalysisYears().slice().reverse().map(year => (
      `<option value="${escapeHtml(String(year))}" ${String(year) === selectedYear ? "selected" : ""}>${escapeHtml(`${year}`)}</option>`
    )).join("");
    select.value = selectedYear;
  }

  async function getPlayerCompareChoiceRows(index = 0) {
    const year = Number(normalizePlayerCompareSelectionYear(index));
    if (!Number.isInteger(year)) return [];
    const entry = await loadScopedPlayerAnalysisYear(year, "all", null);
    return getPlayerSortedRows(entry.rows || []);
  }

  function normalizeOpponentSearchText(value) {
    return normalizeOpponentClubName(value)
      .replace(/[\s　・･.・]/g, "")
      .toLowerCase();
  }

  function getRankedOpponentClubPlayerItems(items = []) {
    let previous = null;
    let rank = 0;
    return [...items]
      .sort((a, b) => b.goals - a.goals
        || b.scoredMatches - a.scoredMatches
        || String(a.playerName || "").localeCompare(String(b.playerName || ""), "ja"))
      .map((item, index) => {
        if (!previous || item.goals !== previous.goals) rank = index + 1;
        previous = item;
        return { ...item, rank };
      });
  }

  async function buildPlayerOpponentClubAnalysis(rows = []) {
    const scope = playerAnalysisState.matchScope;
    const competitionNames = getActivePlayerAnalysisCompetitionFilter();
    const years = getPlayerTimeScopeYears("opponents");
    const playerByGroup = new Map((rows || []).map(player => [getPlayerGroupKey(player), player]).filter(([key]) => key));
    const opponents = new Set();
    const rankingSource = new Map();

    for (const year of years) {
      if (!Number.isInteger(Number(year))) continue;
      const dataset = await loadPlayerAnalysisDatasetYear(year);
      if (dataset.missing) continue;
      const targetMatches = (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
      const matchMap = new Map(targetMatches.map(match => [String(match.match_id), match]));
      targetMatches.forEach(match => {
        const opponent = normalizeOpponentClubName(match.opponent) || "-";
        opponents.add(opponent);
        if (!rankingSource.has(opponent)) rankingSource.set(opponent, new Map());
      });
      (dataset.goals || []).forEach(goal => {
        if (!goal || goal.is_own_goal || !goal.player_key) return;
        const match = matchMap.get(String(goal.match_id));
        if (!match) return;
        const groupKey = getPlayerCanonicalIdentity(goal, year).groupKey;
        const player = playerByGroup.get(groupKey);
        if (!player) return;
        const opponent = normalizeOpponentClubName(match.opponent) || "-";
        opponents.add(opponent);
        if (!rankingSource.has(opponent)) rankingSource.set(opponent, new Map());
        const byPlayer = rankingSource.get(opponent);
        if (!byPlayer.has(groupKey)) {
          byPlayer.set(groupKey, {
            player,
            groupKey,
            playerKey: getPlayerAnalysisKey(player),
            playerName: player.player_name || goal.player_name || "-",
            positions: getPlayerPositions(player),
            numbers: getPlayerNumbers(player),
            goals: 0,
            scoredMatchIds: new Set(),
            scoredMatches: new Map(),
            wins: 0,
            draws: 0,
            losses: 0
          });
        }
        const stats = byPlayer.get(groupKey);
        stats.goals += 1;
        const matchId = String(match.match_id);
        if (!stats.scoredMatches.has(matchId)) {
          stats.scoredMatches.set(matchId, { match, goals: 0 });
        }
        stats.scoredMatches.get(matchId).goals += 1;
        if (!stats.scoredMatchIds.has(matchId)) {
          stats.scoredMatchIds.add(matchId);
          if (match.result === "win") stats.wins += 1;
          else if (match.result === "draw") stats.draws += 1;
          else if (match.result === "loss") stats.losses += 1;
        }
      });
    }

    const rankings = new Map();
    rankingSource.forEach((byPlayer, opponent) => {
      const items = Array.from(byPlayer.values()).map(stats => {
        const scoredMatches = stats.scoredMatchIds.size;
        return {
          ...stats,
          scoredMatches,
          matchRows: Array.from(stats.scoredMatches.values()).sort((a, b) => String(b.match.date || "").localeCompare(String(a.match.date || ""))),
          winRate: calculatePlayerRate(stats.wins, scoredMatches)
        };
      }).filter(item => item.goals > 0);
      rankings.set(opponent, getRankedOpponentClubPlayerItems(items));
    });
    const clubs = Array.from(opponents).sort((a, b) => a.localeCompare(b, "ja"));
    return { clubs, rankings };
  }

  function renderPlayerOpponentControls(clubs = []) {
    const { opponentSearch, opponentDatalist, opponentSelect } = getPlayerAnalysisElements();
    playerAnalysisState.opponentClubs = clubs;
    if (!clubs.includes(playerAnalysisState.opponentClub)) {
      playerAnalysisState.opponentClub = clubs[0] || "";
    }
    if (opponentSelect) {
      opponentSelect.innerHTML = clubs.length
        ? clubs.map(club => `<option value="${escapeHtml(club)}" ${club === playerAnalysisState.opponentClub ? "selected" : ""}>${escapeHtml(club)}</option>`).join("")
        : `<option value="">-</option>`;
      opponentSelect.value = playerAnalysisState.opponentClub;
    }
    if (opponentDatalist) {
      opponentDatalist.innerHTML = clubs.map(club => `<option value="${escapeHtml(club)}"></option>`).join("");
    }
    if (opponentSearch) {
      opponentSearch.value = playerAnalysisState.opponentClub || "";
    }
  }

  function renderOpponentClubPlayerMatchRows(item, expanded = false) {
    const rows = Array.isArray(item && item.matchRows) ? item.matchRows : [];
    if (!rows.length) return "";
    return `
      <div class="pa-opponent-player-matches" ${expanded ? "" : "hidden"}>
        ${rows.map(({ match, goals }) => {
          const score = `${formatPlayerNumber(match && match.target_score)}-${formatPlayerNumber(match && match.opponent_score)}`;
          const result = match && match.result === "win" ? "○" : match && match.result === "draw" ? "△" : match && match.result === "loss" ? "●" : "-";
          const matchId = match && match.match_id !== undefined ? String(match.match_id) : "";
          const matchYear = Number(toIsoDate(match && match.date || "").slice(0, 4)) || "";
          return `
            <button type="button" class="pa-opponent-player-match" data-pa-opponent-match-detail data-pa-match-id="${escapeHtml(matchId)}" data-pa-match-year="${escapeHtml(String(matchYear))}">
              <span>${escapeHtml(formatPlayerMatchDate(match))}</span>
              <b>${escapeHtml(result)} ${escapeHtml(score)}</b>
              <small>${escapeHtml([match && (match.competition || match.tournament), match && (match.target_side === "home" ? "H" : "A")].filter(Boolean).join(" / "))}</small>
              <strong>${escapeHtml(formatPlayerNumber(goals))}得点</strong>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderPlayerOpponentClubResult(opponent, items = []) {
    if (!opponent) return `<div class="pa-compare-empty">対戦クラブを選択してください。</div>`;
    if (!items.length) {
      return `
        <section class="pa-profile-section pa-opponent-section">
          <div class="pa-profile-section-head">
            <h4>${escapeHtml(opponent)}に強い選手</h4>
          </div>
          <div class="pa-compare-empty">このクラブへの得点データがありません。</div>
        </section>
      `;
    }
    const detailOn = !!playerAnalysisState.opponentPlayerDetail;
    return `
      <section class="pa-profile-section pa-opponent-section">
        <div class="pa-profile-section-head">
          <h4>${escapeHtml(opponent)}に強い選手</h4>
          <button type="button" class="pa-opponent-detail-toggle ${detailOn ? "active" : ""}" data-pa-opponent-detail-toggle aria-pressed="${detailOn ? "true" : "false"}">
            詳細 ${detailOn ? "ON" : "OFF"}
          </button>
        </div>
        <div class="pa-opponent-player-card-list">
          ${items.map(item => `
            <article class="pa-opponent-player-card" data-pa-opponent-player-card>
              <div class="pa-opponent-player-card-main">
                <span class="pa-opponent-player-rank">${escapeHtml(String(item.rank))}</span>
                <span class="pa-opponent-player-info">
                  <small>${escapeHtml(formatPlayerList(item.positions))}</small>
                  <button type="button" class="pa-player-link pa-opponent-player-name" data-pa-key="${escapeHtml(item.playerKey || "")}" data-pa-group-key="${escapeHtml(item.groupKey || "")}">${escapeHtml(item.playerName || "-")}</button>
                </span>
                <span class="pa-opponent-player-metric">
                  <small>得点</small>
                  <b>${escapeHtml(formatPlayerNumber(item.goals))}</b>
                </span>
              </div>
              <div class="pa-opponent-player-sub">
                <span>${escapeHtml(formatPlayerNumber(item.scoredMatches))}試合</span>
                <span>${escapeHtml(formatPlayerRecord(item.wins, item.draws, item.losses))}</span>
                <span>勝率 ${escapeHtml(formatPlayerRate(item.winRate))}</span>
              </div>
              ${renderOpponentClubPlayerMatchRows(item, detailOn)}
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  async function renderPlayerOpponentPanel() {
    const { opponentResult } = getPlayerAnalysisElements();
    if (!opponentResult) return;
    const token = playerAnalysisState.opponentRenderToken + 1;
    playerAnalysisState.opponentRenderToken = token;
    opponentResult.innerHTML = `<div class="pa-profile-loading"><strong>対戦クラブ別</strong><small>集計中...</small></div>`;
    const rows = await getPlayerRowsForTimeScope("opponents");
    playerAnalysisState.opponentScopeRows = rows;
    const analysis = await buildPlayerOpponentClubAnalysis(rows);
    if (playerAnalysisState.opponentRenderToken !== token) return;
    renderPlayerOpponentControls(analysis.clubs);
    const opponent = playerAnalysisState.opponentClub;
    opponentResult.innerHTML = renderPlayerOpponentClubResult(opponent, analysis.rankings.get(opponent) || []);
  }

  function getPlayerCompareSelectedPlayers() {
    const rows = playerAnalysisState.compareScopeRows || [];
    const choices = (Array.isArray(playerAnalysisState.compareChoiceRows) ? playerAnalysisState.compareChoiceRows : [])
      .flat()
      .filter(Boolean);
    const dataByKey = new Map(rows.map(row => [getPlayerGroupKey(row), row]));
    const choiceByKey = new Map(choices.map(row => [getPlayerGroupKey(row), row]));
    return (playerAnalysisState.compareKeys || [])
      .map(key => dataByKey.get(key) || createPlayerComparisonEmptyRow(choiceByKey.get(key)))
      .filter(Boolean);
  }

  function createPlayerComparisonEmptyRow(player) {
    if (!player) return null;
    const row = {
      ...player,
      played_matches: 0,
      played_wins: 0,
      played_draws: 0,
      played_losses: 0,
      played_win_rate: null,
      played_points_per_match: null,
      played_goals_against: 0,
      played_goals_against_avg: null,
      played_clean_sheets: 0,
      starter_matches: 0,
      starter_wins: 0,
      starter_draws: 0,
      starter_losses: 0,
      starter_win_rate: null,
      starter_points_per_match: null,
      non_starter_matches: 0,
      non_starter_wins: 0,
      non_starter_draws: 0,
      non_starter_losses: 0,
      non_starter_win_rate: null,
      non_starter_points_per_match: null,
      sub_matches: 0,
      sub_wins: 0,
      sub_draws: 0,
      sub_losses: 0,
      sub_win_rate: null,
      sub_points_per_match: null,
      non_played_matches: 0,
      non_played_wins: 0,
      non_played_draws: 0,
      non_played_losses: 0,
      non_played_win_rate: null,
      non_played_points_per_match: null,
      goals: 0,
      scored_matches: 0,
      scored_wins: 0,
      scored_draws: 0,
      scored_losses: 0,
      scored_win_rate: null,
      scored_points_per_match: null,
      __paYearRows: [],
      __paRankingMetrics: createPlayerRankingMetric(),
      __paNoCompareData: true
    };
    assignPlayerAnalysisCounterFields(row, "played", createPlayerAnalysisCounter());
    row.played_goals_against_avg = null;
    row.played_clean_sheets = 0;
    assignPlayerAnalysisCounterFields(row, "starter", createPlayerAnalysisCounter());
    assignPlayerAnalysisCounterFields(row, "non_starter", createPlayerAnalysisCounter());
    assignPlayerAnalysisCounterFields(row, "sub", createPlayerAnalysisCounter());
    assignPlayerAnalysisCounterFields(row, "non_played", createPlayerAnalysisCounter());
    ensurePlayerImpactScores([row]);
    return row;
  }

  function getPlayerCompareLabel(player) {
    return player.player_name || "-";
  }

  function normalizePlayerOpponentSelectionYear() {
    const years = getPlayerAnalysisYears();
    const selected = Number(playerAnalysisState.opponentYear);
    if (Number.isInteger(selected) && years.includes(selected)) return String(selected);
    const activeYear = Number(playerAnalysisState.year);
    const fallback = Number.isInteger(activeYear) && years.includes(activeYear)
      ? activeYear
      : (years[years.length - 1] || PLAYER_ANALYSIS_YEAR_END);
    playerAnalysisState.opponentYear = String(fallback);
    return playerAnalysisState.opponentYear;
  }

  function renderPlayerOpponentSelectionYearOptions(select) {
    if (!select) return;
    const selectedYear = normalizePlayerOpponentSelectionYear();
    select.innerHTML = getPlayerAnalysisYears().slice().reverse().map(year => (
      `<option value="${escapeHtml(String(year))}" ${String(year) === selectedYear ? "selected" : ""}>${escapeHtml(`${year}`)}</option>`
    )).join("");
    select.value = selectedYear;
  }

  async function getPlayerOpponentChoiceRows() {
    const year = Number(normalizePlayerOpponentSelectionYear());
    if (!Number.isInteger(year)) return [];
    const entry = await loadScopedPlayerAnalysisYear(year, "all", null);
    return getPlayerSortedRows(entry.rows || []);
  }

  function normalizePlayerSearchText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s　・･.]/g, "")
      .toLowerCase();
  }

  function findPlayerOpponentSearchMatch(value, rows = []) {
    const text = String(value || "").trim();
    const normalized = normalizePlayerSearchText(text);
    if (!normalized) return null;
    const exact = rows.find(row => {
      const label = getPlayerSelectLabel(row);
      return label === text
        || String(row.player_name || "").trim() === text
        || normalizePlayerSearchText(row.player_name) === normalized
        || normalizePlayerSearchText(label) === normalized;
    });
    if (exact) return exact;
    const partial = normalized.length >= 2
      ? rows.filter(row => normalizePlayerSearchText(row.player_name).includes(normalized)
        || normalizePlayerSearchText(getPlayerSelectLabel(row)).includes(normalized))
      : [];
    return partial.length === 1 ? partial[0] : null;
  }

  async function renderPlayerOpponentPlayerControls() {
    const { playerOpponentYearSelect, playerOpponentSearch, playerOpponentDatalist, playerOpponentSelect } = getPlayerAnalysisElements();
    renderPlayerOpponentSelectionYearOptions(playerOpponentYearSelect);
    const rows = await getPlayerRowsForTimeScope("player-opponents");
    const choiceRows = await getPlayerOpponentChoiceRows();
    playerAnalysisState.opponentScopeRows = rows;
    playerAnalysisState.opponentChoiceRows = choiceRows;
    const validKeys = new Set(choiceRows.map(getPlayerGroupKey));
    if (!validKeys.has(playerAnalysisState.opponentPlayerKey)) {
      const selectedGroupKey = playerAnalysisState.selectedKey
        ? getPlayerGroupKey(findPlayerAnalysisRowByKey(playerAnalysisState.selectedKey))
        : "";
      playerAnalysisState.opponentPlayerKey = selectedGroupKey && validKeys.has(selectedGroupKey)
        ? selectedGroupKey
        : (choiceRows[0] ? getPlayerGroupKey(choiceRows[0]) : "");
    }
    if (playerOpponentSelect) {
      playerOpponentSelect.innerHTML = choiceRows.length
        ? choiceRows.map(player => {
          const key = getPlayerGroupKey(player);
          return `<option value="${escapeHtml(key)}" ${key === playerAnalysisState.opponentPlayerKey ? "selected" : ""}>${escapeHtml(getPlayerSelectLabel(player))}</option>`;
        }).join("")
        : `<option value="">-</option>`;
      playerOpponentSelect.value = playerAnalysisState.opponentPlayerKey;
    }
    if (playerOpponentDatalist) {
      playerOpponentDatalist.innerHTML = choiceRows.map(player => `<option value="${escapeHtml(getPlayerSelectLabel(player))}"></option>`).join("");
    }
    if (playerOpponentSearch) {
      const selected = choiceRows.find(row => getPlayerGroupKey(row) === playerAnalysisState.opponentPlayerKey);
      playerOpponentSearch.value = selected ? getPlayerSelectLabel(selected) : "";
    }
    return rows;
  }

  async function renderPlayerOpponentPlayerPanel() {
    const { playerOpponentResult } = getPlayerAnalysisElements();
    const rows = await renderPlayerOpponentPlayerControls();
    if (!playerOpponentResult) return;
    const choices = playerAnalysisState.opponentChoiceRows || [];
    const player = rows.find(row => getPlayerGroupKey(row) === playerAnalysisState.opponentPlayerKey)
      || createPlayerComparisonEmptyRow(choices.find(row => getPlayerGroupKey(row) === playerAnalysisState.opponentPlayerKey));
    if (!player) {
      playerOpponentResult.innerHTML = `<div class="pa-compare-empty">選手データがありません。</div>`;
      return;
    }
    const token = playerAnalysisState.playerOpponentRenderToken + 1;
    playerAnalysisState.playerOpponentRenderToken = token;
    playerOpponentResult.innerHTML = `<div class="pa-profile-loading"><strong>選手別対戦クラブ</strong><small>集計中...</small></div>`;
    const extras = await buildPlayerPerformanceExtras(player, player.__paYearRows || [player], playerAnalysisState.matchScope, getActivePlayerAnalysisCompetitionFilter());
    if (playerAnalysisState.playerOpponentRenderToken !== token) return;
    const mode = isPlayerGoalkeeper(player) ? "defense" : "attack";
    playerOpponentResult.innerHTML = renderPlayerOpponentGoalSection(
      player.player_name || "-",
      mode === "defense" ? extras.opponentDefense : extras.opponentGoals,
      { mode }
    );
  }

  function updatePlayerCompareSelection(index, key) {
    if (!Number.isInteger(index)) return;
    const nextKeys = [...(playerAnalysisState.compareKeys || ["", "", ""])];
    nextKeys[index] = key || "";
    if (index === 0) {
      nextKeys[1] = "";
      nextKeys[2] = "";
    } else if (index === 1) {
      nextKeys[2] = "";
    }
    const seen = new Set();
    playerAnalysisState.compareKeys = nextKeys.map(item => {
      if (!item || seen.has(item)) return "";
      seen.add(item);
      return item;
    });
    renderPlayerComparisonPanel();
  }

  async function getCompareCandidateRows(index, rows = (playerAnalysisState.compareChoiceRows || [])[index] || []) {
    const selectedOtherKeys = new Set((playerAnalysisState.compareKeys || []).filter((key, keyIndex) => key && keyIndex !== index));
    const requiredKeys = (playerAnalysisState.compareKeys || [])
      .slice(0, index)
      .filter(Boolean);
    const years = getPlayerAnalysisYears();
    const entries = requiredKeys.length
      ? await getPlayerPlayedMatchEntries("all", null, years)
      : [];
    return rows.filter(player => {
      const key = getPlayerGroupKey(player);
      if (selectedOtherKeys.has(key)) return false;
      if (!requiredKeys.length) return true;
      return hasSharedPlayerAppearance(getPlayerGroupKey(player), requiredKeys, entries);
    });
  }

  async function renderPlayerCompareControls() {
    const { compareControls, compareYearSelects } = getPlayerAnalysisElements();
    if (!compareControls) return;
    compareYearSelects.forEach(select => {
      renderPlayerCompareSelectionYearOptions(select, Number(select.dataset.paCompareYearIndex));
    });
    const rows = await getPlayerRowsForTimeScope("compare");
    const choiceRowsByIndex = await Promise.all([0, 1, 2].map(index => getPlayerCompareChoiceRows(index)));
    playerAnalysisState.compareScopeRows = rows;
    playerAnalysisState.compareChoiceRows = choiceRowsByIndex;
    playerAnalysisState.compareKeys = (playerAnalysisState.compareKeys || ["", "", ""])
      .slice(0, 3)
      .map((key, index) => {
        const validKeys = new Set((choiceRowsByIndex[index] || []).map(getPlayerGroupKey));
        return validKeys.has(key) ? key : "";
      });
    while (playerAnalysisState.compareKeys.length < 3) playerAnalysisState.compareKeys.push("");

    await Promise.all([0, 1, 2].map(async index => {
      const select = compareControls.querySelector(`select[data-pa-compare-index="${index}"]`);
      if (!select) return;
      const candidates = await getCompareCandidateRows(index, choiceRowsByIndex[index] || []);
      const selectedKey = playerAnalysisState.compareKeys[index] || "";
      if (selectedKey && !candidates.some(player => getPlayerGroupKey(player) === selectedKey)) {
        playerAnalysisState.compareKeys[index] = "";
      }
      select.innerHTML = `
        <option value="">選択してください</option>
        ${candidates.map(player => {
          const key = getPlayerGroupKey(player);
          return `<option value="${escapeHtml(key)}" ${key === playerAnalysisState.compareKeys[index] ? "selected" : ""}>${escapeHtml(getPlayerCompareLabel(player))}</option>`;
        }).join("")}
      `;
    }));
  }

  function formatPlayerTopOpponents(opponentGoals = []) {
    const top = opponentGoals.slice(0, 3);
    return top.length
      ? top.map(item => `${item.opponent}: ${formatPlayerNumber(item.goals)}得点`).join(" / ")
      : "-";
  }

  function renderPlayerCompareTable(players, extrasByKey) {
    const metrics = [
      ["出場試合数", player => formatPlayerNumber(player.played_matches)],
      ["先発数", player => formatPlayerNumber(player.starter_matches)],
      ["途中出場数", player => formatPlayerNumber(player.sub_matches)],
      ["得点数", player => formatPlayerNumber(player.goals)],
      ["1試合あたり得点率", player => formatPlayerFixed(calculatePlayerGoalRate(player), 2)],
      ["出場時の勝利数", player => formatPlayerNumber(player.played_wins)],
      ["出場時の引分数", player => formatPlayerNumber(player.played_draws)],
      ["出場時の敗戦数", player => formatPlayerNumber(player.played_losses)],
      ["出場時勝率", player => formatPlayerRate(player.played_win_rate)],
      ["出場時平均勝点", player => formatPlayerFixed(player.played_points_per_match, 2)],
      ["得点した試合数", player => formatPlayerNumber(player.scored_matches)],
      ["得点した試合の勝率", player => formatPlayerRate(player.scored_win_rate)],
      ["ホーム得点", player => formatPlayerNumber(extrasByKey.get(getPlayerAnalysisKey(player))?.homeGoals)],
      ["アウェイ得点", player => formatPlayerNumber(extrasByKey.get(getPlayerAnalysisKey(player))?.awayGoals)],
      ["攻撃インパクト", player => formatPlayerImpactScore(player, "attack")],
      ["守備インパクト", player => formatPlayerImpactScore(player, "defense")],
      ["総合インパクト", player => formatPlayerImpactScore(player, "total")]
    ];

    const mobileCards = players.map(player => `
      <article class="pa-compare-player-card">
        <h4>${escapeHtml(player.player_name || "-")}</h4>
        <dl>
          ${metrics.map(([label, formatter]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(formatter(player))}</dd>
            </div>
          `).join("")}
        </dl>
      </article>
    `).join("");

    return `
      <div class="pa-compare-table-wrap">
        <table class="pa-compare-table pa-compare-metrics-table">
          <thead>
            <tr>
              <th>指標</th>
              ${players.map(player => `<th>${escapeHtml(player.player_name || "-")}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${metrics.map(([label, formatter]) => `
              <tr>
                <th>${escapeHtml(label)}</th>
                ${players.map(player => `<td>${escapeHtml(formatter(player))}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="pa-compare-mobile-cards">
        ${mobileCards}
      </div>
    `;
  }

  function renderCombinationStatsRow(label, stats) {
    const sampleNote = stats.matches > 0 && stats.matches < 5 ? `<span class="pa-sample-note">サンプル少</span>` : "";
    return `
      <tr>
        <th>${escapeHtml(label)}${sampleNote}</th>
        <td>${escapeHtml(formatPlayerNumber(stats.matches))}</td>
        <td>${escapeHtml(formatPlayerRecord(stats.wins, stats.draws, stats.losses))}</td>
        <td>${escapeHtml(formatPlayerRate(stats.winRate))}</td>
        <td>${escapeHtml(formatPlayerFixed(stats.pointsPerMatch, 2))}</td>
        <td>${escapeHtml(formatPlayerNumber(stats.goalsFor))}</td>
        <td>${escapeHtml(formatPlayerNumber(stats.goalsAgainst))}</td>
        <td>${escapeHtml(formatPlayerFixed(stats.goalsForAvg, 2))}</td>
        <td>${escapeHtml(formatPlayerFixed(stats.goalsAgainstAvg, 2))}</td>
      </tr>
    `;
  }

  function getPlayerFamilyNameLabel(player) {
    const name = String((player && player.player_name) || "-").normalize("NFKC").trim();
    if (!name || name === "-") return "-";
    const parts = name.split(/[\s　]+/).filter(Boolean);
    return parts[0] || name;
  }

  function renderPlayerCombinationAnalysis(analysis) {
    if (!analysis || !analysis.players || analysis.players.length < 2) return "";
    const players = analysis.players;
    const shortNames = players.map(getPlayerFamilyNameLabel);
    const patternStats = analysis.patterns || new Map();
    const title = players.length === 3
      ? `${players.map(player => player.player_name || "-").join(" × ")} トリオ分析`
      : `${players[0].player_name || "-"} × ${players[1].player_name || "-"} コンビ分析`;
    const rows = players.length === 3
      ? [
          ["3人同時出場", patternStats.get(7) || analysis.together],
          [`${shortNames[0]} + ${shortNames[1]}のみ出場`, patternStats.get(3)],
          [`${shortNames[0]} + ${shortNames[2]}のみ出場`, patternStats.get(5)],
          [`${shortNames[1]} + ${shortNames[2]}のみ出場`, patternStats.get(6)],
          [`${shortNames[0]}のみ出場`, patternStats.get(1)],
          [`${shortNames[1]}のみ出場`, patternStats.get(2)],
          [`${shortNames[2]}のみ出場`, patternStats.get(4)],
          ["全員非出場", patternStats.get(0)]
        ]
      : [
          ["同時出場", patternStats.get(3) || analysis.together],
          [`${shortNames[0]}のみ出場`, patternStats.get(1) || analysis.onlyA],
          [`${shortNames[1]}のみ出場`, patternStats.get(2) || analysis.onlyB],
          ["両方非出場", patternStats.get(0) || analysis.neither]
        ];
    return `
      <section class="pa-combo-analysis">
        <h4>${escapeHtml(title)}</h4>
        <div class="pa-compare-table-wrap">
          <table class="pa-compare-table compact">
            <thead>
              <tr>
                <th>条件</th>
                <th>試合</th>
                <th>勝敗</th>
                <th>勝率</th>
                <th>平均勝点</th>
                <th>得点</th>
                <th>失点</th>
                <th>平均得点</th>
                <th>平均失点</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(([label, stats]) => renderCombinationStatsRow(label, stats || finalizePlayerMatchStats(createPlayerMatchStats()))).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  async function renderPlayerComparisonPanel() {
    const { compareResult } = getPlayerAnalysisElements();
    await renderPlayerCompareControls();
    if (!compareResult) return;
    const token = playerAnalysisState.compareRenderToken + 1;
    playerAnalysisState.compareRenderToken = token;
    const players = getPlayerCompareSelectedPlayers();
    if (players.length < 2) {
      compareResult.innerHTML = `
        <div class="pa-compare-empty">比較する選手を2人以上選択してください。</div>
      `;
      return;
    }
    compareResult.innerHTML = `<div class="pa-profile-loading"><strong>比較データ</strong><small>集計中...</small></div>`;
    const scope = playerAnalysisState.matchScope;
    const competitionFilter = getActivePlayerAnalysisCompetitionFilter();
    const years = getPlayerTimeScopeYears("compare");
    const extrasList = await Promise.all(players.map(player => buildPlayerPerformanceExtras(player, player.__paYearRows || [player], scope, competitionFilter)));
    const combo = await buildPlayerCombinationAnalysis(players, scope, competitionFilter, years);
    if (playerAnalysisState.compareRenderToken !== token) return;
    const extrasByKey = new Map(players.map((player, index) => [getPlayerAnalysisKey(player), extrasList[index]]));
    compareResult.innerHTML = `
      ${renderPlayerCompareTable(players, extrasByKey)}
      ${renderPlayerCombinationAnalysis(combo)}
    `;
  }

  function setupPlayerAnalysisNumberCycles(container) {
    if (!container) return;
    const cycles = Array.from(container.querySelectorAll(".pa-mobile-number-cycle"));
    cycles.forEach(cycle => {
      cycle.dataset.paNumberIndex = "0";
      Array.from(cycle.querySelectorAll("span")).forEach((span, index) => {
        span.classList.toggle("is-active", index === 0);
      });
    });
  }

  function handlePlayerProfileSectionToggle(event) {
    const sectionButton = event.target.closest("[data-pa-profile-section-toggle]");
    if (sectionButton) {
      const section = sectionButton.closest("[data-pa-profile-section]");
      if (!section) return true;
      const collapsed = !section.classList.contains("is-collapsed");
      section.classList.toggle("is-collapsed", collapsed);
      sectionButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
      const icon = sectionButton.querySelector("b");
      if (icon) icon.textContent = collapsed ? "+" : "−";
      return true;
    }
    const allButton = event.target.closest("[data-pa-profile-sections-toggle]");
    if (allButton) {
      const root = allButton.closest(".pa-modal-body, .pa-detail-card, .pa-profile-panel") || document;
      const collapse = allButton.dataset.paProfileSectionsToggle === "hide";
      root.querySelectorAll("[data-pa-profile-section]").forEach(section => {
        section.classList.toggle("is-collapsed", collapse);
        const button = section.querySelector("[data-pa-profile-section-toggle]");
        if (button) button.setAttribute("aria-expanded", collapse ? "false" : "true");
        const icon = button && button.querySelector("b");
        if (icon) icon.textContent = collapse ? "+" : "−";
        if (section.matches("[data-pa-opponent-section]")) {
          section.classList.remove("is-expanded");
          const opponentButton = section.querySelector("[data-pa-opponent-toggle]");
          if (opponentButton) opponentButton.textContent = "すべて表示";
        }
      });
      return true;
    }
    return false;
  }

  function renderPlayerAnalysisMobileList(rows) {
    const { mobileList } = getPlayerAnalysisElements();
    if (!mobileList) return;
    if (!rows.length) {
      mobileList.innerHTML = `<div class="pa-mobile-empty">データがありません</div>`;
      setupPlayerAnalysisNumberCycles(mobileList);
      return;
    }
    const getPlayedMinutes = player => toPlayerNumber(player && player.__paRankingMetrics && player.__paRankingMetrics.played_minutes) || 0;
    const maxPlayedMinutes = Math.max(1, ...rows.map(player => getPlayedMinutes(player) || (toPlayerNumber(player.played_matches) || 0)));
    const maxGoals = Math.max(1, ...rows.map(player => toPlayerNumber(player.goals) || 0));
    mobileList.innerHTML = rows.map(player => {
      const key = getPlayerAnalysisKey(player);
      const selected = key === playerAnalysisState.selectedKey;
      const name = player.player_name || "-";
      const played = toPlayerNumber(player.played_matches) || 0;
      const playedMinutes = getPlayedMinutes(player);
      const starts = toPlayerNumber(player.starter_matches) || 0;
      const goals = toPlayerNumber(player.goals) || 0;
      const playedRate = toPlayerNumber(player.played_win_rate);
      const playedPpm = toPlayerNumber(player.played_points_per_match);
      const yellow = toPlayerNumber(player.yellow_cards) || 0;
      const red = toPlayerNumber(player.red_cards) || 0;
      const seasonCount = getPlayerSeasonCount(player);
      const englishName = String(player.profile_name_en || "").toUpperCase();
      const height = toPlayerNumber(player.profile_height_cm);
      const weight = toPlayerNumber(player.profile_weight_kg);
      const birthYear = toPlayerNumber(player.profile_birth_year);
      const playedBarSource = playedMinutes || played;
      const playedBar = Math.max(0, Math.min(100, (playedBarSource / maxPlayedMinutes) * 100));
      const startBar = played ? Math.max(0, Math.min(100, (starts / played) * 100)) : 0;
      const goalBar = Math.max(0, Math.min(100, (goals / maxGoals) * 100));
      const numbers = getPlayerNumbers(player);
      const isGoalkeeper = getPlayerPositions(player).includes("GK");
      const displayNumbers = numbers.length ? numbers : ["-"];
      const numberCount = Math.max(1, displayNumbers.length);
      const numberAnimation = `paNumberFade${Math.min(numberCount, 8)}`;
      const numberCycle = displayNumbers.map((number, index) => {
        const animationStyle = numberCount > 1
          ? ` style="animation-name:${numberAnimation};animation-duration:${numberCount * 5}s;animation-delay:${index * 5}s;"`
          : "";
        return `<span class="${index === 0 ? "is-active" : ""}"${animationStyle}>${escapeHtml(number)}</span>`;
      }).join("");
      if (!playerAnalysisState.listDetail) {
        const [metricLabel, metricValue] = getPlayerAnalysisSortMetric(player);
        return `
          <button type="button" class="pa-mobile-player-card compact ${selected ? "selected" : ""}" data-pa-key="${escapeHtml(key)}" style="--pa-number-count:${numberCount};--pa-number-duration:${numberCount * 5}s;">
            <span class="pa-mobile-shirt ${isGoalkeeper ? "gk" : ""}" aria-label="背番号 ${escapeHtml(formatPlayerList(player.numbers))}">
              <span class="pa-mobile-number-cycle" data-pa-number-count="${numberCount}">${numberCycle}</span>
            </span>
            ${renderPlayerPhoto(name, playerAnalysisState.selectedClub, "pa-mobile-list-photo", player, { inline: true })}
            <span class="pa-mobile-compact-name">
               <small>${escapeHtml(formatPlayerList(player.positions))}</small>
               <strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
            </span>
            <span class="pa-mobile-compact-metric">
              <small>${escapeHtml(metricLabel)}</small>
              <b>${escapeHtml(metricValue)}</b>
            </span>
          </button>
        `;
      }
      return `
        <button type="button" class="pa-mobile-player-card ${selected ? "selected" : ""}" data-pa-key="${escapeHtml(key)}" style="--pa-played-bar:${playedBar}%;--pa-start-bar:${startBar}%;--pa-goal-bar:${goalBar}%;--pa-number-count:${numberCount};--pa-number-duration:${numberCount * 5}s;">
          <span class="pa-mobile-identity">
            <span class="pa-mobile-shirt ${isGoalkeeper ? "gk" : ""}" aria-label="背番号 ${escapeHtml(formatPlayerList(player.numbers))}">
              <span class="pa-mobile-number-cycle" data-pa-number-count="${numberCount}">${numberCycle}</span>
            </span>
            <span class="pa-mobile-title">
              <span class="pa-mobile-title-row">
                <span class="pa-mobile-position">${escapeHtml(formatPlayerList(player.positions))}</span>
                <small>${escapeHtml(formatPlayerNumber(seasonCount))}年</small>
              </span>
              <strong class="pa-mobile-name" title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
              ${englishName ? `<span class="pa-mobile-english-name">${escapeHtml(englishName)}</span>` : ""}
            </span>
          </span>
          ${height !== null || weight !== null || birthYear !== null ? `
            <span class="pa-mobile-profile-meta">
              ${height !== null ? `<span><small>HEIGHT</small><b>${escapeHtml(formatPlayerNumber(height))}<em>cm</em></b></span>` : ""}
              ${weight !== null ? `<span><small>WEIGHT</small><b>${escapeHtml(formatPlayerNumber(weight))}<em>kg</em></b></span>` : ""}
              ${birthYear !== null ? `<span><small>BORN</small><b>${escapeHtml(formatPlayerNumber(birthYear))}</b></span>` : ""}
            </span>
          ` : ""}
          <span class="pa-mobile-focus-row">
            <span><small>出場</small><b>${escapeHtml(formatPlayerNumber(played))}</b></span>
            <span><small>先発</small><b>${escapeHtml(formatPlayerNumber(starts))}</b></span>
            <span class="time"><small>出場時間</small><b>${escapeHtml(formatPlayerMinutes(playedMinutes))}</b></span>
            <span><small>得点</small><b>${escapeHtml(formatPlayerNumber(goals))}</b></span>
            <span><small>勝率</small><b>${escapeHtml(formatPlayerRate(playedRate))}</b></span>
            <span><small>PPM</small><b>${escapeHtml(formatPlayerDecimal(playedPpm))}</b></span>
            <span><small>警告</small><b>${escapeHtml(formatPlayerNumber(yellow))}</b></span>
            <span><small>退場</small><b>${escapeHtml(formatPlayerNumber(red))}</b></span>
          </span>
          <span class="pa-mobile-bars" aria-hidden="true">
            <span><small>出場時間</small><em><i class="played"></i></em></span>
            <span><small>先発率</small><em><i class="starts"></i></em></span>
            <span><small>得点数</small><em><i class="goals"></i></em></span>
          </span>
        </button>
      `;
    }).join("");
    setupPlayerAnalysisNumberCycles(mobileList);
    setupPlayerPhotos(mobileList);
  }

  function renderPlayerAnalysisTable() {
    const { tableBody, tableCount } = getPlayerAnalysisElements();
    if (!tableBody) return;
    const filtered = sortPlayerAnalysisRows(getPlayerAnalysisFilteredRows());
    playerAnalysisState.filtered = filtered;
    if (tableCount) tableCount.textContent = `${filtered.length}人`;

    if (!filtered.length) {
      tableBody.innerHTML = `<tr><td colspan="12" class="pa-muted" style="text-align:center;padding:24px;">データがありません</td></tr>`;
      renderPlayerAnalysisMobileList(filtered);
      renderPlayerAnalysisDetail(null);
      updatePlayerAnalysisSortIndicators();
      renderPlayerAnalysisSortSummary(filtered);
      return;
    }

    if (!filtered.some(player => getPlayerAnalysisKey(player) === playerAnalysisState.selectedKey)) {
      playerAnalysisState.selectedKey = getPlayerAnalysisKey(filtered[0]);
    }

    tableBody.innerHTML = filtered.map(player => {
      const key = getPlayerAnalysisKey(player);
      const selected = key === playerAnalysisState.selectedKey;
      return `
        <tr data-pa-key="${escapeHtml(key)}" class="${selected ? "selected" : ""}" tabindex="0">
          <td class="pa-player-name"><button type="button" class="pa-player-link" data-pa-key="${escapeHtml(key)}"><span>${escapeHtml(player.player_name || "-")}</span>${player.profile_name_en ? `<small>${escapeHtml(player.profile_name_en)}</small>` : ""}</button></td>
          <td>${escapeHtml(formatPlayerList(player.numbers))}</td>
          <td>${escapeHtml(formatPlayerList(player.positions))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerNumber(player.played_matches))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerNumber(player.starter_matches))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerNumber(player.sub_matches))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerNumber(player.goals))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerNumber(player.scored_matches))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerRate(player.scored_win_rate))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerRate(player.played_win_rate))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerRate(player.starter_win_rate))}</td>
          <td class="pa-num">${escapeHtml(formatPlayerRate(player.sub_win_rate))}</td>
        </tr>
      `;
    }).join("");

    renderPlayerAnalysisMobileList(filtered);
    renderPlayerAnalysisDetail(null);
    updatePlayerAnalysisSortIndicators();
    renderPlayerAnalysisSortSummary(filtered);
  }

  function buildPlayerAnalysisDetailItems(player) {
    const playedRecord = formatPlayerRecord(player.played_wins, player.played_draws, player.played_losses);
    const starterRecord = formatPlayerRecord(player.starter_wins, player.starter_draws, player.starter_losses);
    const nonStarterRecord = formatPlayerRecord(player.non_starter_wins, player.non_starter_draws, player.non_starter_losses);
    const subRecord = formatPlayerRecord(player.sub_wins, player.sub_draws, player.sub_losses);
    const nonPlayedRecord = formatPlayerRecord(player.non_played_wins, player.non_played_draws, player.non_played_losses);
    const scoredRecord = formatPlayerRecord(player.scored_wins, player.scored_draws, player.scored_losses);
    return {
      playedRecord,
      starterRecord,
      nonStarterRecord,
      subRecord,
      nonPlayedRecord,
      scoredRecord,
      items: [
        ["出場試合数", formatPlayerNumber(player.played_matches)],
        ["出場時の勝敗", playedRecord],
        ["出場時勝率", formatPlayerRate(player.played_win_rate)],
        ["出場時平均勝ち点", formatPlayerDecimal(player.played_points_per_match)],
        ["出場試合失点率", formatPlayerGoalsAgainstAverage(getPlayerAnalysisSortValue(player, "played_goals_against_avg"))],
        ["出場時無失点試合数", formatPlayerNumber(getPlayerAnalysisSortValue(player, "played_clean_sheets"))],
        ["出場時得点数", formatPlayerNumber(player.played_goals_for)],
        ["出場時失点数", formatPlayerNumber(player.played_goals_against)],
        ["出場時得失点差", formatPlayerSignedNumber(player.played_goal_diff)],
        ["出場時間中得点数", formatPlayerNumber(getPlayerAnalysisSortValue(player, "on_pitch_goals_for"))],
        ["出場時間中失点数", formatPlayerNumber(getPlayerAnalysisSortValue(player, "on_pitch_goals_against"))],
        ["出場時間中得失点差", formatPlayerSignedNumber(getPlayerAnalysisSortValue(player, "on_pitch_goal_diff"))],
        ["先発時の勝敗", starterRecord],
        ["先発時勝率", formatPlayerRate(player.starter_win_rate)],
        ["先発時得点数", formatPlayerNumber(player.starter_goals_for)],
        ["先発時失点数", formatPlayerNumber(player.starter_goals_against)],
        ["先発時得失点差", formatPlayerSignedNumber(player.starter_goal_diff)],
        ["非スタメン時の勝敗", nonStarterRecord],
        ["非スタメン時勝率", formatPlayerRate(player.non_starter_win_rate)],
        ["非スタメン時平均勝ち点", formatPlayerDecimal(player.non_starter_points_per_match)],
        ["非スタメン時得点数", formatPlayerNumber(player.non_starter_goals_for)],
        ["非スタメン時失点数", formatPlayerNumber(player.non_starter_goals_against)],
        ["非スタメン時得失点差", formatPlayerSignedNumber(player.non_starter_goal_diff)],
        ["途中出場時の勝敗", subRecord],
        ["途中出場時勝率", formatPlayerRate(player.sub_win_rate)],
        ["途中出場時得点数", formatPlayerNumber(player.sub_goals_for)],
        ["途中出場時失点数", formatPlayerNumber(player.sub_goals_against)],
        ["途中出場時得失点差", formatPlayerSignedNumber(player.sub_goal_diff)],
        ["未出場時の勝敗", nonPlayedRecord],
        ["未出場時勝率", formatPlayerRate(player.non_played_win_rate)],
        ["未出場時平均勝ち点", formatPlayerDecimal(player.non_played_points_per_match)],
        ["未出場時得点数", formatPlayerNumber(player.non_played_goals_for)],
        ["未出場時失点数", formatPlayerNumber(player.non_played_goals_against)],
        ["未出場時得失点差", formatPlayerSignedNumber(player.non_played_goal_diff)],
        ["得点数", formatPlayerNumber(player.goals)],
        ["ゴールした試合数", formatPlayerNumber(player.scored_matches)],
        ["ゴールした試合の勝敗", scoredRecord],
        ["ゴールした試合の勝率", formatPlayerRate(player.scored_win_rate)],
        ["ゴールした試合の平均勝ち点", formatPlayerDecimal(player.scored_points_per_match)],
        ["警告数", formatPlayerNumber(player.yellow_cards)],
        ["退場数", formatPlayerNumber(player.red_cards)]
      ]
    };
  }

  function renderPlayerAnalysisDetailGrid(items) {
    return `
      <div class="pa-detail-grid">
        ${items.map(([label, value]) => `
          <div class="pa-detail-item">
            <span class="pa-detail-label">${escapeHtml(label)}</span>
            <span class="pa-detail-value">${escapeHtml(value)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderPlayerAnalysisDetailSections(player) {
    if (!player) return "";
    const detail = buildPlayerAnalysisDetailItems(player);
    const sections = [
      {
        title: "出場",
        items: [
          ["出場", formatPlayerNumber(player.played_matches), "試合"],
          ["勝敗", detail.playedRecord, ""],
          ["勝率", formatPlayerRate(player.played_win_rate), ""],
          ["平均勝ち点", formatPlayerDecimal(player.played_points_per_match), "Pts"],
          ["得点", formatPlayerNumber(player.played_goals_for), "点"],
          ["失点", formatPlayerNumber(player.played_goals_against), "点"],
          ["得失点差", formatPlayerSignedNumber(player.played_goal_diff), ""],
          ["失点率", formatPlayerGoalsAgainstAverage(getPlayerAnalysisSortValue(player, "played_goals_against_avg")), "失点/試合"],
          ["無失点", formatPlayerNumber(getPlayerAnalysisSortValue(player, "played_clean_sheets")), "試合"]
        ]
      },
      {
        title: "出場時間中",
        items: [
          ["得点", formatPlayerNumber(getPlayerAnalysisSortValue(player, "on_pitch_goals_for")), "点"],
          ["失点", formatPlayerNumber(getPlayerAnalysisSortValue(player, "on_pitch_goals_against")), "点"],
          ["得失点差", formatPlayerSignedNumber(getPlayerAnalysisSortValue(player, "on_pitch_goal_diff")), ""]
        ]
      },
      {
        title: "起用",
        items: [
          ["先発", formatPlayerNumber(player.starter_matches), "試合"],
          ["先発勝敗", detail.starterRecord, ""],
          ["先発勝率", formatPlayerRate(player.starter_win_rate), ""],
          ["先発得点", formatPlayerNumber(player.starter_goals_for), "点"],
          ["先発失点", formatPlayerNumber(player.starter_goals_against), "点"],
          ["先発得失点差", formatPlayerSignedNumber(player.starter_goal_diff), ""],
          ["非スタメン", formatPlayerNumber(player.non_starter_matches), "試合"],
          ["非スタメン勝敗", detail.nonStarterRecord, ""],
          ["非スタメン勝率", formatPlayerRate(player.non_starter_win_rate), ""],
          ["非スタメン平均勝ち点", formatPlayerDecimal(player.non_starter_points_per_match), "Pts"],
          ["非スタメン得点", formatPlayerNumber(player.non_starter_goals_for), "点"],
          ["非スタメン失点", formatPlayerNumber(player.non_starter_goals_against), "点"],
          ["非スタメン得失点差", formatPlayerSignedNumber(player.non_starter_goal_diff), ""],
          ["途中出場", formatPlayerNumber(player.sub_matches), "試合"],
          ["途中勝敗", detail.subRecord, ""],
          ["途中勝率", formatPlayerRate(player.sub_win_rate), ""],
          ["途中得点", formatPlayerNumber(player.sub_goals_for), "点"],
          ["途中失点", formatPlayerNumber(player.sub_goals_against), "点"],
          ["途中得失点差", formatPlayerSignedNumber(player.sub_goal_diff), ""],
          ["未出場", formatPlayerNumber(player.non_played_matches), "試合"],
          ["未出場勝敗", detail.nonPlayedRecord, ""],
          ["未出場勝率", formatPlayerRate(player.non_played_win_rate), ""],
          ["未出場平均勝ち点", formatPlayerDecimal(player.non_played_points_per_match), "Pts"],
          ["未出場得点", formatPlayerNumber(player.non_played_goals_for), "点"],
          ["未出場失点", formatPlayerNumber(player.non_played_goals_against), "点"],
          ["未出場得失点差", formatPlayerSignedNumber(player.non_played_goal_diff), ""]
        ]
      },
      {
        title: "得点 / カード",
        items: [
          ["得点", formatPlayerNumber(player.goals), "点"],
          ["得点試合勝敗", detail.scoredRecord, ""],
          ["得点試合平均勝ち点", formatPlayerDecimal(player.scored_points_per_match), "Pts"],
          ["警告", formatPlayerNumber(player.yellow_cards), "枚"],
          ["退場", formatPlayerNumber(player.red_cards), "枚"]
        ]
      },
      {
        title: "インパクト",
        items: [
          ["攻撃インパクト", formatPlayerImpactScore(player, "attack"), "/100"],
          ["守備インパクト", formatPlayerImpactScore(player, "defense"), "/100"],
          ["総合インパクト", formatPlayerImpactScore(player, "total"), "/100"],
          ["得点率", formatPlayerFixed(calculatePlayerGoalRate(player), 2), "点/試合"],
          ["得点試合勝率", formatPlayerRate(player.scored_win_rate), ""]
        ]
      }
    ];

    return `
      <div class="pa-profile-section-toolbar">
        <button type="button" data-pa-profile-sections-toggle="show">すべて表示</button>
        <button type="button" data-pa-profile-sections-toggle="hide">すべて非表示</button>
      </div>
      <div class="pa-profile-sections">
        ${sections.map(section => `
          <section class="pa-profile-section" data-pa-profile-section>
            <button type="button" class="pa-profile-section-toggle" data-pa-profile-section-toggle aria-expanded="true">
              <span>${escapeHtml(section.title)}</span>
              <b aria-hidden="true">−</b>
            </button>
            <div class="pa-profile-section-body">
            <div class="pa-profile-stat-grid">
              ${section.items.map(([label, value, unit]) => `
                <div class="pa-profile-stat">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                  ${unit ? `<small>${escapeHtml(unit)}</small>` : ""}
                </div>
              `).join("")}
            </div>
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function getPlayerSeasonSpan(rows) {
    const years = rows.map(getPlayerYearValue).filter(Boolean).sort((a, b) => a - b);
    if (!years.length) return "-";
    const first = years[0];
    const last = years[years.length - 1];
    return first === last ? `${first}` : `${first}-${last}`;
  }

  function renderPlayerProfileKpis(player, yearRows) {
    const kpis = [
      ["期間", getPlayerSeasonSpan(yearRows), `${yearRows.length}シーズン`],
      ["出場", formatPlayerNumber(player.played_matches), "試合"],
      ["先発", formatPlayerNumber(player.starter_matches), "試合"],
      ["得点", formatPlayerNumber(player.goals), "点"],
      ["出場勝率", formatPlayerRate(player.played_win_rate), "出場した試合"],
      ["平均勝ち点", formatPlayerDecimal(player.played_points_per_match), "出場した試合"]
    ];
    return `
      <div class="pa-profile-kpis">
        ${kpis.map(([label, value, caption]) => `
          <div class="pa-profile-kpi">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(caption)}</small>
          </div>
        `).join("")}
      </div>
    `;
  }

  function getRankedOpponentItems(items = [], mode = "attack") {
    let previousValue = null;
    let currentRank = 0;
    return items.map((item, index) => {
      const value = mode === "defense" ? toPlayerNumber(item.goalsAgainstAvg) : toPlayerNumber(item.goals);
      const valueKey = value === null ? null : String(value);
      if (valueKey === null) {
        currentRank = null;
      } else if (valueKey !== previousValue) {
        currentRank = index + 1;
      }
      previousValue = valueKey;
      return { ...item, rank: currentRank };
    });
  }

  function renderPlayerOpponentGoalSection(playerName, opponentItems = [], options = {}) {
    const mode = options.mode === "defense" ? "defense" : "attack";
    const rankedItems = getRankedOpponentItems(opponentItems, mode);
    const emptyText = mode === "defense" ? "GK出場データがありません" : "得点データがありません";
    const valueLabel = mode === "defense" ? "平均失点" : "得点";
    const hiddenCount = Math.max(0, rankedItems.length - 5);
    if (!rankedItems.length) {
      return `
        <section class="pa-profile-section pa-opponent-section" data-pa-profile-section>
          <button type="button" class="pa-profile-section-toggle" data-pa-profile-section-toggle aria-expanded="true">
            <span>${escapeHtml(playerName || "選手")}が得意な相手</span>
            <b aria-hidden="true">-</b>
          </button>
          <div class="pa-profile-section-body">
            <div class="pa-muted pa-profile-empty">${escapeHtml(emptyText)}</div>
          </div>
        </section>
      `;
    }
    return `
      <section class="pa-profile-section pa-opponent-section ${hiddenCount ? "has-more" : ""}" data-pa-opponent-section data-pa-profile-section>
        <button type="button" class="pa-profile-section-toggle" data-pa-profile-section-toggle aria-expanded="true">
          <span>${escapeHtml(playerName || "選手")}が得意な相手</span>
          <b aria-hidden="true">-</b>
        </button>
        <div class="pa-profile-section-body">
          <ol class="pa-opponent-rank-list">
            ${rankedItems.map((item, index) => `
              <li class="${index >= 5 ? "pa-opponent-extra" : ""}">
                <b>${escapeHtml(item.rank === null ? "-" : formatPlayerNumber(item.rank))}</b>
                <span>${escapeHtml(item.opponent)}</span>
                <strong>${mode === "defense"
                  ? `${escapeHtml(formatPlayerGoalsAgainstAverage(item.goalsAgainstAvg))}${escapeHtml(valueLabel)}`
                  : `${escapeHtml(formatPlayerNumber(item.goals))}${escapeHtml(valueLabel)}`}</strong>
                <small>${escapeHtml(formatPlayerNumber(mode === "defense" ? item.matches : item.scoredMatches))}試合 / ${escapeHtml(formatPlayerRecord(item.wins, item.draws, item.losses))} / 勝率 ${escapeHtml(formatPlayerRate(item.winRate))}</small>
              </li>
            `).join("")}
          </ol>
          ${hiddenCount ? `<button type="button" class="pa-opponent-more" data-pa-opponent-toggle>すべて表示</button>` : ""}
        </div>
      </section>
    `;
  }

  function getMatchResultLabel(result) {
    if (result === "win") return "勝";
    if (result === "draw") return "分";
    if (result === "loss") return "敗";
    return "-";
  }

  function getMatchResultClass(result) {
    if (result === "win") return "win";
    if (result === "draw") return "draw";
    if (result === "loss") return "loss";
    return "pending";
  }

  function formatPlayerMatchDate(match) {
    return String(match && match.date || "").replace(/\//g, "-") || "-";
  }

  function formatPlayerMatchSection(section) {
    return formatRoundDisplayLabel(section, "");
  }

  function formatPlayerMatchCompetitionLine(match) {
    const competition = getPlayerAnalysisCompetitionName(match);
    const section = formatPlayerMatchSection(match && match.section);
    if (!competition) return ["特別試合", section].filter(Boolean).join(" ");
    return [competition, section].filter(Boolean).join(" ");
  }

  function formatPlayerAppearanceRole(appearance) {
    if (!appearance) return "-";
    if (appearance.starter) return "先発";
    if (appearance.sub_in) return "途中出場";
    if (appearance.bench) return "ベンチ";
    return appearance.appearance_type || "-";
  }

  function isPlayerGoalkeeper(player) {
    return getPlayerPositions(player).includes("GK");
  }

  function renderPlayerNumberBadge(numbers, className = "", player = null) {
    const classTokens = String(className || "").split(/\s+/).filter(Boolean);
    const isGoalkeeper = isPlayerGoalkeeper(player);
    if (classTokens.includes("modal")) {
      const displayNumbers = normalizePlayerNumberValues(numbers);
      const badgeNumbers = displayNumbers.length ? displayNumbers : ["-"];
      const wrapperClasses = ["pa-player-number-badge-set", ...classTokens, isGoalkeeper ? "gk" : ""]
        .filter(Boolean)
        .join(" ");
      const itemClasses = ["pa-player-number-badge", "modal-box", isGoalkeeper ? "gk" : ""]
        .filter(Boolean)
        .join(" ");
      return `
        <span class="${escapeHtml(wrapperClasses)}" aria-label="背番号 ${escapeHtml(formatPlayerList(badgeNumbers))}">
          ${badgeNumbers.map(number => `<span class="${escapeHtml(itemClasses)}">${escapeHtml(number)}</span>`).join("")}
        </span>
      `;
    }
    const classes = ["pa-player-number-badge", ...classTokens, isGoalkeeper ? "gk" : ""]
      .filter(Boolean)
      .join(" ");
    return `<span class="${escapeHtml(classes)}">${escapeHtml(formatPlayerList(numbers))}</span>`;
  }

  function getActivePlayerAnalysisModalCategories() {
    return Array.isArray(playerAnalysisState.modalCategories)
      ? playerAnalysisState.modalCategories
      : getPlayerAnalysisCategoriesForScope(playerAnalysisState.matchScope);
  }

  function getActivePlayerAnalysisModalScope() {
    return getPlayerAnalysisCategoryScope(getActivePlayerAnalysisModalCategories());
  }

  function renderPlayerAnalysisCategoryChecklist() {
    const selected = new Set(getActivePlayerAnalysisModalCategories());
    const options = ["league", "cup", "special"];
    const selectedLabel = options
      .filter(category => selected.has(category))
      .map(getPlayerAnalysisCategoryLabel)
      .join(" / ") || "未選択";
    return `
      <details class="pa-category-filter" aria-label="試合カテゴリの選択">
        <summary>
          <span>対象試合</span>
          <strong>${escapeHtml(selectedLabel)}</strong>
          <b aria-hidden="true">+</b>
        </summary>
        <div class="pa-category-options">
          ${options.map(category => `
            <label class="pa-category-check">
              <input type="checkbox" data-pa-category="${escapeHtml(category)}" ${selected.has(category) ? "checked" : ""}>
              <span>${escapeHtml(getPlayerAnalysisCategoryLabel(category))}</span>
            </label>
          `).join("")}
        </div>
      </details>
    `;
  }

  function readPlayerAnalysisModalCategories(modal) {
    const categories = Array.from((modal || document).querySelectorAll("[data-pa-category]:checked"))
      .map(input => input.dataset.paCategory)
      .filter(Boolean);
    playerAnalysisState.modalCategories = categories;
    return categories;
  }

  async function getPlayerYearMatchDetails(player, year, scope = playerAnalysisState.matchScope, competitionNames = null) {
    const normalizedYear = Number(year);
    if (!Number.isInteger(normalizedYear)) return [];
    const groupKey = getPlayerGroupKey(player);
    const dataset = await loadPlayerAnalysisDatasetYear(normalizedYear);
    if (dataset.missing) return [];
    const targetMatches = (dataset.matches || []).filter(match => isPlayerAnalysisScopeMatch(match, scope, competitionNames));
    const matchMap = new Map(targetMatches.map(match => [String(match.match_id), match]));
    const matchEndMinuteById = buildPlayerMatchEndMinuteMap(targetMatches, dataset.appearances, dataset.goals, dataset.cards);
    const appearances = (dataset.appearances || [])
      .filter(appearance => appearance.played && matchMap.has(String(appearance.match_id)) && getPlayerCanonicalIdentity(appearance, normalizedYear).groupKey === groupKey);

    const goalsByMatch = new Map();
    (dataset.goals || []).forEach(goal => {
      if (goal.is_own_goal || getPlayerCanonicalIdentity(goal, normalizedYear).groupKey !== groupKey) return;
      const key = String(goal.match_id);
      if (!matchMap.has(key)) return;
      if (!goalsByMatch.has(key)) goalsByMatch.set(key, []);
      goalsByMatch.get(key).push(goal);
    });

    const cardsByMatch = new Map();
    (dataset.cards || []).forEach(card => {
      if (getPlayerCanonicalIdentity(card, normalizedYear).groupKey !== groupKey) return;
      const key = String(card.match_id);
      if (!matchMap.has(key)) return;
      if (!cardsByMatch.has(key)) cardsByMatch.set(key, []);
      cardsByMatch.get(key).push(card);
    });

    return appearances.map(appearance => {
      const match = matchMap.get(String(appearance.match_id));
      return {
        appearance,
        match,
        matchEndMinute: matchEndMinuteById.get(String(appearance.match_id)) || 90,
        goals: goalsByMatch.get(String(appearance.match_id)) || [],
        cards: cardsByMatch.get(String(appearance.match_id)) || []
      };
    }).sort((a, b) => String(a.match.date || "").localeCompare(String(b.match.date || "")));
  }

  function renderPlayerYearMatchList(player, year, items, yearRow) {
    const playerName = player.player_name || "-";
    const summaryHtml = yearRow ? `
      <section class="pa-year-match-summary">
        <div class="pa-year-match-summary-head">
          <span>${escapeHtml(String(year))}年データ</span>
          <div class="pa-year-match-summary-meta">
            ${renderPlayerNumberBadge(yearRow.numbers, "summary", yearRow)}
            <strong>${escapeHtml(formatPlayerList(yearRow.positions))}</strong>
          </div>
        </div>
        ${renderPlayerProfileKpis(yearRow, [yearRow])}
        ${renderPlayerAnalysisDetailSections(yearRow)}
      </section>
    ` : "";
    const listHtml = items.length ? `
      <div class="pa-match-list">
        ${items.map(item => {
          const match = item.match || {};
          const matchId = String(match.match_id || item.appearance?.match_id || "");
          const score = `${formatPlayerNumber(match.target_score)}-${formatPlayerNumber(match.opponent_score)}`;
          const events = [
            ...item.goals.map(goal => `<span class="pa-event-chip goal">GOAL ${escapeHtml(goal.time || "")}</span>`),
            ...item.cards.map(card => `<span class="pa-event-chip ${String(card.type || "").includes("退場") ? "red" : "yellow"}">${escapeHtml(card.type || "カード")} ${escapeHtml(card.time || "")}</span>`)
          ].join("");
          return `
            <article class="pa-match-row" data-pa-match-id="${escapeHtml(matchId)}" role="button" tabindex="0" aria-label="${escapeHtml(formatPlayerMatchDate(match))} ${escapeHtml(match.opponent || "")} の試合詳細">
              <div class="pa-match-main">
                <span>${escapeHtml(formatPlayerMatchDate(match))}</span>
                <strong>vs ${escapeHtml(match.opponent || "-")}</strong>
                <small>${escapeHtml(formatPlayerMatchCompetitionLine(match))}</small>
              </div>
              <div class="pa-match-score">
                <span class="${escapeHtml(getMatchResultClass(match.result))}">${escapeHtml(getMatchResultLabel(match.result))}</span>
                <strong>${escapeHtml(score)}</strong>
                <small>${escapeHtml(match.target_side === "home" ? "HOME" : "AWAY")}</small>
              </div>
              <div class="pa-match-role">
                <span>${escapeHtml(formatPlayerAppearanceRole(item.appearance))}</span>
                ${events ? `<div class="pa-match-events">${events}</div>` : ""}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    ` : `<div class="pa-muted" style="padding:18px;text-align:center;">出場した試合データがありません</div>`;
    const body = `
      <button type="button" class="pa-modal-back-btn" data-pa-profile-back>プロフィールに戻る</button>
      ${renderPlayerAnalysisCategoryChecklist()}
      ${summaryHtml}
      <div class="pa-match-list-title">
        <strong>出場試合</strong>
        <span>${escapeHtml(String(items.length))}試合</span>
      </div>
      ${listHtml}
    `;
    const meta = `
      <span class="pa-chip">${escapeHtml(String(year))}</span>
      <span class="pa-chip">${items.length}試合</span>
      <span class="pa-chip scope">${escapeHtml(getPlayerAnalysisScopeLabel(getActivePlayerAnalysisModalScope()))}</span>
    `;
    return renderPlayerAnalysisModalShell("MATCH LOG", `${playerName} / ${year}年`, body, meta);
  }

  function formatPlayerAttendance(value) {
    if (!hasPlayerValue(value)) return "-";
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? `${n.toLocaleString("ja-JP")}人` : String(value);
  }

  function formatPlayerAppearanceMinutes(appearance, cards = [], matchEndMinute = 90) {
    if (!appearance) return "-";
    const from = hasPlayerValue(appearance.minute_in) ? `${appearance.minute_in}分` : "";
    const redMinute = getPlayerRedCardMinuteFromCards(cards);
    const fallbackEnd = appearance.played ? (toPlayerNumber(matchEndMinute) || 90) : "";
    const minuteOut = hasPlayerValue(appearance.minute_out) ? appearance.minute_out : (redMinute !== null ? redMinute : fallbackEnd);
    const to = hasPlayerValue(minuteOut) ? `${minuteOut}分` : "";
    if (from && to) return `${from} - ${to}`;
    if (from) return `${from}から`;
    if (to) return `${to}まで`;
    return "-";
  }

  function renderPlayerMatchDetail(player, year, item, yearRow) {
    const match = item && item.match ? item.match : {};
    const appearance = item && item.appearance ? item.appearance : null;
    const score = `${formatPlayerNumber(match.target_score)}-${formatPlayerNumber(match.opponent_score)}`;
    const eventChips = [
      ...(item?.goals || []).map(goal => `<span class="pa-event-chip goal">GOAL ${escapeHtml(goal.time || "")}</span>`),
      ...(item?.cards || []).map(card => `<span class="pa-event-chip ${String(card.type || "").includes("退場") ? "red" : "yellow"}">${escapeHtml(card.type || "カード")} ${escapeHtml(card.time || "")}</span>`)
    ].join("");
    const detailRows = [
      ["大会", formatPlayerMatchCompetitionLine(match)],
      ["節", formatPlayerMatchSection(match.section) || "-"],
      ["開催", match.target_side === "home" ? "HOME" : "AWAY"],
      ["会場", match.stadium || "-"],
      ["天候", match.weather || "-"],
      ["入場者", formatPlayerAttendance(match.attendance)]
    ];
    const playerRows = [
      ["出場", formatPlayerAppearanceRole(appearance)],
      ["時間", formatPlayerAppearanceMinutes(appearance, item?.cards || [], item?.matchEndMinute || 90)],
      ["得点", formatPlayerNumber((item?.goals || []).length)],
      ["カード", (item?.cards || []).length ? `${(item?.cards || []).length}枚` : "-"]
    ];

    const body = `
      <button type="button" class="pa-modal-back-btn" data-pa-match-log-back>試合一覧に戻る</button>
      ${renderPlayerAnalysisCategoryChecklist()}
      <section class="pa-match-detail-panel">
        <div class="pa-match-detail-scoreboard">
          <div class="pa-match-detail-side">
            <span>${escapeHtml(formatPlayerMatchDate(match))}</span>
            <strong>vs ${escapeHtml(match.opponent || "-")}</strong>
            <small>${escapeHtml(formatPlayerMatchCompetitionLine(match))}</small>
          </div>
          <div class="pa-match-detail-result">
            <span class="${escapeHtml(getMatchResultClass(match.result))}">${escapeHtml(getMatchResultLabel(match.result))}</span>
            <strong>${escapeHtml(score)}</strong>
          </div>
        </div>
        <div class="pa-match-detail-grid">
          ${detailRows.map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="pa-match-detail-actions">
          <button type="button" class="pa-match-detail-open-btn" data-pa-open-schedule-match data-pa-match-id="${escapeHtml(String(match.match_id || appearance?.match_id || ""))}">試合詳細</button>
          <span class="pa-match-detail-link-status" aria-live="polite"></span>
        </div>
      </section>
      <section class="pa-match-detail-panel">
        <div class="pa-match-detail-player">
          ${renderPlayerNumberBadge(yearRow?.numbers || player.numbers, "detail", yearRow || player)}
          <div>
            <span>${escapeHtml(player.player_name || "-")}</span>
            <strong>${escapeHtml(formatPlayerList(yearRow?.positions || player.positions))}</strong>
          </div>
        </div>
        <div class="pa-match-detail-grid player">
          ${playerRows.map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `).join("")}
        </div>
        ${eventChips ? `<div class="pa-match-detail-events">${eventChips}</div>` : ""}
      </section>
    `;
    const meta = `
      <span class="pa-chip">${escapeHtml(String(year))}</span>
      <span class="pa-chip scope">${escapeHtml(getPlayerAnalysisScopeLabel(getActivePlayerAnalysisModalScope()))}</span>
    `;
    return renderPlayerAnalysisModalShell("MATCH DETAIL", `${player.player_name || "-"} / ${formatPlayerMatchDate(match)}`, body, meta);
  }

  function findScheduleMatchForPlayerAnalysisMatch(match) {
    if (!match) return null;
    const date = toIsoDate(match.date || "");
    const opponent = match.opponent || "";
    return scheduleData.find(item => {
      if (!item || item.club !== "niigata") return false;
      if (toIsoDate(item.date || "") !== date) return false;
      if (opponent && !robustTeamMatch(item.opponent, opponent)) return false;
      return true;
    }) || scheduleData.find(item => {
      if (!item || item.club !== "niigata") return false;
      if (toIsoDate(item.date || "") !== date) return false;
      const stadiumMatch = match.stadium && item.venue && String(item.venue).normalize("NFKC") === String(match.stadium).normalize("NFKC");
      return stadiumMatch || !opponent;
    }) || null;
  }

  async function openScheduleMatchFromPlayerAnalysis(match) {
    if (!match || !match.date) return false;
    const year = Number(toIsoDate(match.date).slice(0, 4));
    if (Number.isInteger(year)) {
      await ensureHistoryYearLoaded(year);
    }
    const scheduleMatch = findScheduleMatchForPlayerAnalysisMatch(match);
    if (!scheduleMatch) return false;
    closePlayerAnalysisModal({ history: false });
    openDetailSheet(scheduleMatch);
    return true;
  }

  function renderOpponentClubMatchFallback(match) {
    const result = match && match.result === "win" ? "○" : match && match.result === "draw" ? "△" : match && match.result === "loss" ? "●" : "-";
    const score = `${formatPlayerNumber(match && match.target_score)}-${formatPlayerNumber(match && match.opponent_score)}`;
    const body = `
      <section class="pa-profile-section">
        <div class="pa-match-detail-summary">
          <span>${escapeHtml(formatPlayerMatchDate(match))}</span>
          <strong>${escapeHtml(result)} ${escapeHtml(score)}</strong>
          <small>${escapeHtml([match && (match.competition || match.tournament), match && match.section, match && (match.target_side === "home" ? "HOME" : "AWAY")].filter(Boolean).join(" / "))}</small>
        </div>
      </section>
    `;
    return renderPlayerAnalysisModalShell("MATCH DETAIL", match && match.opponent ? `vs ${match.opponent}` : "試合詳細", body);
  }

  async function openOpponentClubMatchResultDetail(matchId, matchYear, options = {}) {
    const sourceNavigationId = activeAppHistoryId;
    const year = Number(matchYear);
    if (!matchId || !Number.isInteger(year)) return;
    const dataset = await loadPlayerAnalysisDatasetYear(year);
    if (activeAppHistoryId !== sourceNavigationId) return;
    const match = (dataset.matches || []).find(item => String(item.match_id) === String(matchId));
    if (!match) return;
    const opened = await openScheduleMatchFromPlayerAnalysis(match);
    if (!opened) {
      setPlayerAnalysisModalContent(renderOpponentClubMatchFallback(match));
      addAppHistoryEntry(
        "pa-modal:opponent-match",
        () => openOpponentClubMatchResultDetail(matchId, matchYear, { history: false }),
        options
      );
    }
  }

  async function loadPlayerProfiles(club = playerAnalysisState.selectedClub) {
    const clubKey = getPlayerAnalysisClub(club);
    if (!playerProfileCache.has(clubKey)) {
      playerProfileCache.set(clubKey, (async () => {
        const exact = new Map();
        const normalized = new Map();
        try {
          const response = await fetch(`./data/players/${clubKey}.json?v=20260618profiles`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          Object.entries(payload || {}).forEach(([key, profile]) => {
            if (key === "_meta" || !profile || typeof profile !== "object" || Array.isArray(profile)) return;
            const names = [key, profile.app_player_name, profile.name, profile.official_name]
              .filter(Boolean)
              .map(normalizePlayerImageName);
            names.forEach(name => {
              if (!name) return;
              if (!exact.has(name)) exact.set(name, profile);
              const compact = normalizePlayerIdentityText(name);
              if (compact && !normalized.has(compact)) normalized.set(compact, profile);
            });
          });
        } catch (error) {
          console.warn(`Player profiles unavailable for ${clubKey}`, error);
        }
        return { exact, normalized };
      })());
    }
    return playerProfileCache.get(clubKey);
  }

  async function getPlayerProfile(player, club = playerAnalysisState.selectedClub) {
    const clubKey = getPlayerAnalysisClub(club);
    const profiles = await loadPlayerProfiles(clubKey);
    const primary = findPlayerProfile(profiles, player);
    if (primary) return primary;
    const fallbackClub = clubKey === "niigata" ? "kumamoto" : "niigata";
    return findPlayerProfile(await loadPlayerProfiles(fallbackClub), player);
  }

  function findPlayerProfile(profiles, player) {
    const name = normalizePlayerImageName(player && player.player_name);
    if (!name) return null;
    return profiles.exact.get(name) || profiles.normalized.get(normalizePlayerIdentityText(name)) || null;
  }

  function getPlayerProfileBirthYear(profile) {
    const match = String(profile && profile.birth_date || "").match(/^(\d{4})[\/-]/);
    return match ? Number(match[1]) : null;
  }

  const PLAYER_GOJUON_MORA_ORDER = [
    "A", "I", "U", "E", "O",
    "KA", "GA", "KYA", "GYA", "KI", "GI", "KYU", "GYU", "KU", "GU", "KYO", "GYO", "KE", "GE", "KO", "GO",
    "SA", "ZA", "SYA", "ZYA", "SI", "ZI", "SYU", "ZYU", "SU", "ZU", "SYO", "ZYO", "SE", "ZE", "SO", "ZO",
    "TA", "DA", "TYA", "DYA", "TI", "DI", "TYU", "DYU", "TU", "DU", "TYO", "DYO", "TE", "DE", "TO", "DO",
    "NA", "NYA", "NI", "NYU", "NU", "NYO", "NE", "NO",
    "HA", "BA", "PA", "HYA", "BYA", "PYA", "HI", "BI", "PI", "HYU", "BYU", "PYU", "HU", "BU", "PU", "HYO", "BYO", "PYO", "HE", "BE", "PE", "HO", "BO", "PO",
    "MA", "MYA", "MI", "MYU", "MU", "MYO", "ME", "MO",
    "YA", "YU", "YO",
    "RA", "RYA", "RI", "RYU", "RU", "RYO", "RE", "RO",
    "WA", "WO", "N"
  ];
  const PLAYER_GOJUON_MORA_RANK = new Map(PLAYER_GOJUON_MORA_ORDER.map((mora, index) => [mora, String(index).padStart(3, "0")]));
  const PLAYER_GOJUON_MORA_TOKENS = [...PLAYER_GOJUON_MORA_ORDER].sort((a, b) => b.length - a.length);

  function getPlayerGojūonSortKey(value) {
    const input = String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/SHA/g, "SYA").replace(/SHU/g, "SYU").replace(/SHO/g, "SYO").replace(/SHI/g, "SI")
      .replace(/CHA/g, "TYA").replace(/CHU/g, "TYU").replace(/CHO/g, "TYO").replace(/CHI/g, "TI")
      .replace(/JA/g, "ZYA").replace(/JU/g, "ZYU").replace(/JO/g, "ZYO").replace(/JI/g, "ZI")
      .replace(/TSU/g, "TU").replace(/FU/g, "HU")
      .replace(/[^A-Z]/g, "");
    const ranks = [];
    for (let index = 0; index < input.length;) {
      const token = PLAYER_GOJUON_MORA_TOKENS.find(candidate => input.startsWith(candidate, index));
      if (token) {
        ranks.push(PLAYER_GOJUON_MORA_RANK.get(token));
        index += token.length;
      } else {
        ranks.push(`9${String(input.charCodeAt(index)).padStart(3, "0")}`);
        index += 1;
      }
    }
    return `${ranks.join("-")}|${input}`;
  }

  function applyPlayerProfileToRow(player, profile) {
    if (!player || !profile) return player;
    player.__paProfile = profile;
    player.profile_height_cm = toPlayerNumber(profile.height_cm);
    player.profile_weight_kg = toPlayerNumber(profile.weight_kg);
    player.profile_birth_year = getPlayerProfileBirthYear(profile);
    player.profile_name_en = String(profile.name_en || "").normalize("NFKC").trim().toUpperCase();
    const rawName = String(player.player_name || "").normalize("NFKC").trim();
    const katakanaReading = /^[\u30A0-\u30FF\s・･ー]+$/.test(rawName)
      ? rawName.split(/[\s・･]+/).filter(Boolean).map(romanizeKatakana).join(" ")
      : "";
    player.profile_name_sort = getPlayerGojūonSortKey(katakanaReading || player.profile_name_en || rawName);
    player.profile_birthplace = String(profile.birthplace || "").trim();
    return player;
  }

  async function attachPlayerProfilesToRows(rows, club = playerAnalysisState.selectedClub) {
    const clubKey = getPlayerAnalysisClub(club);
    const profiles = await loadPlayerProfiles(clubKey);
    const items = Array.isArray(rows) ? rows : [];
    const missing = [];
    items.forEach(player => {
      const profile = findPlayerProfile(profiles, player);
      if (profile) applyPlayerProfileToRow(player, profile);
      else missing.push(player);
    });
    if (missing.length) {
      const fallbackClub = clubKey === "niigata" ? "kumamoto" : "niigata";
      const fallbackProfiles = await loadPlayerProfiles(fallbackClub);
      missing.forEach(player => applyPlayerProfileToRow(player, findPlayerProfile(fallbackProfiles, player)));
    }
    return rows;
  }

  function hasPlayerProfileValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim() !== "-";
  }

  function formatPlayerProfileDate(value) {
    if (!hasPlayerProfileValue(value)) return "-";
    const match = String(value).trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : String(value);
  }

  function getPlayerProfileEnglishName(profile, player) {
    const name = hasPlayerProfileValue(profile && profile.name_en)
      ? String(profile.name_en).trim()
      : getPlayerEnglishName(player);
    return String(name || "").normalize("NFKC").toUpperCase();
  }

  function normalizePlayerProfileMilestones(items) {
    const rows = [];
    let pendingLabel = "";
    (Array.isArray(items) ? items : []).forEach(rawItem => {
      const item = String(rawItem || "").normalize("NFKC").trim();
      if (!item || item === "大会別成績" || /合計$/.test(item)) return;
      const labelOnly = item.match(/^(.+戦)[：:]$/);
      if (labelOnly) {
        pendingLabel = labelOnly[1];
        return;
      }
      const inline = item.match(/^(.+戦)[：:]\s*(.+)$/);
      if (inline) {
        rows.push({ label: inline[1], event: inline[2], date: "" });
        pendingLabel = "";
        return;
      }
      if (/^\d{2,4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(item) && rows.length) {
        rows[rows.length - 1].date = item;
        return;
      }
      rows.push({ label: pendingLabel, event: item, date: "" });
      pendingLabel = "";
    });
    return rows;
  }

  function renderPlayerProfileMilestone(title, items) {
    const rows = normalizePlayerProfileMilestones(items);
    if (!rows.length) return "";
    return `
      <div class="pa-bio-milestone">
        <h4>${escapeHtml(title)}</h4>
        ${rows.map(row => `
          <div class="pa-bio-milestone-row">
            ${row.label ? `<span>${escapeHtml(row.label)}</span>` : ""}
            <strong>${escapeHtml(row.event)}</strong>
            ${row.date ? `<time>${escapeHtml(row.date)}</time>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderPlayerProfileSeasonHistory(records) {
    const rows = (Array.isArray(records) ? records : []).filter(record => record && typeof record === "object");
    if (!rows.length) return "";
    return `
      <details class="pa-bio-history" ${rows.length <= 6 ? "open" : ""}>
        <summary>
          <span>シーズン別所属歴</span>
          <small>${escapeHtml(String(rows.length))}シーズン</small>
        </summary>
        <div class="pa-bio-season-list">
          ${rows.map(record => {
            const leagueStats = hasPlayerProfileValue(record.league_matches)
              ? `<span>リーグ <b>${escapeHtml(record.league_matches)}</b>試合 <b>${escapeHtml(hasPlayerProfileValue(record.league_goals) ? record.league_goals : "0")}</b>得点</span>`
              : "";
            const cupStats = hasPlayerProfileValue(record.cup_matches)
              ? `<span>カップ <b>${escapeHtml(record.cup_matches)}</b>試合 <b>${escapeHtml(hasPlayerProfileValue(record.cup_goals) ? record.cup_goals : "0")}</b>得点</span>`
              : "";
            return `
              <article class="pa-bio-season-row">
                <time>${escapeHtml(record.season || "-")}</time>
                <div class="pa-bio-season-club">
                  <strong>${escapeHtml(record.team || "-")}</strong>
                  <small>${escapeHtml(record.league || "-")}</small>
                </div>
                <div class="pa-bio-season-stats">${leagueStats}${cupStats}</div>
              </article>
            `;
          }).join("")}
        </div>
      </details>
    `;
  }

  function renderPlayerProfileBio(profile, player) {
    const playerName = String((player && player.player_name) || (profile && profile.app_player_name) || "-");
    const photo = renderPlayerPhoto(playerName, playerAnalysisState.selectedClub, "pa-player-photo", player);
    if (!profile) {
      return `
        <div class="pa-bio-hero no-profile">
          <div class="pa-bio-visual"><span class="pa-bio-monogram">${escapeHtml(Array.from(playerName)[0] || "P")}</span>${photo}</div>
          <div class="pa-bio-empty">
            <strong>${escapeHtml(playerName)}</strong>
            <span>プロフィール情報はまだ登録されていません</span>
          </div>
        </div>
        ${renderPlayerChantAudioSlot(playerName, player)}
      `;
    }

    const birthYear = getPlayerProfileBirthYear(profile);
    const vitals = [
      ["HEIGHT", profile.height_cm, "cm"],
      ["WEIGHT", profile.weight_kg, "kg"],
      ["BORN", birthYear, ""]
    ].filter(([, value]) => hasPlayerProfileValue(value));
    const details = [
      ["生年月日", formatPlayerProfileDate(profile.birth_date)],
      ["出身地", profile.birthplace],
      ["最終所属", profile.final_team]
    ].filter(([, value]) => hasPlayerProfileValue(value));
    const teams = Array.from(new Set((Array.isArray(profile.affiliated_teams) ? profile.affiliated_teams : []).filter(hasPlayerProfileValue)));
    const milestoneHtml = [
      renderPlayerProfileMilestone("Jリーグ初出場", profile.first_appearances),
      renderPlayerProfileMilestone("Jリーグ初得点", profile.first_goals)
    ].filter(Boolean).join("");
    const sourceUrl = String(profile.links && profile.links.jleague_data || "");
    const officialName = hasPlayerProfileValue(profile.official_name) && normalizePlayerImageName(profile.official_name) !== normalizePlayerImageName(playerName)
      ? `<span class="pa-bio-official-name">登録名 ${escapeHtml(profile.official_name)}</span>`
      : "";

    return `
      <section class="pa-bio-hero">
        <div class="pa-bio-visual">
          <span class="pa-bio-monogram">${escapeHtml(Array.from(playerName)[0] || "P")}</span>
          ${photo}
        </div>
        <div class="pa-bio-overview">
          <span class="pa-bio-kicker">PROFILE DATA</span>
          <h3>基本プロフィール</h3>
          ${officialName}
          ${hasPlayerProfileValue(profile.position) ? `<span class="pa-bio-position-chip">${escapeHtml(profile.position)}</span>` : ""}
          <div class="pa-bio-vitals">
            ${vitals.map(([label, value, unit]) => `
              <div class="pa-bio-vital">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}${unit ? `<small>${escapeHtml(unit)}</small>` : ""}</strong>
              </div>
            `).join("")}
          </div>
          <dl class="pa-bio-details">
            ${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>
        </div>
      </section>
      ${renderPlayerChantAudioSlot(playerName, player)}
      ${teams.length ? `
        <section class="pa-bio-section">
          <div class="pa-bio-section-head">
            <span>CLUB HISTORY</span>
            <h3>所属クラブ</h3>
          </div>
          <div class="pa-bio-club-route">
            ${teams.map(team => `<span>${escapeHtml(team)}</span>`).join("")}
          </div>
        </section>
      ` : ""}
      ${milestoneHtml ? `
        <section class="pa-bio-section">
          <div class="pa-bio-section-head">
            <span>FIRST RECORD</span>
            <h3>初記録</h3>
          </div>
          <div class="pa-bio-milestones">${milestoneHtml}</div>
        </section>
      ` : ""}
      ${renderPlayerProfileSeasonHistory(profile.annual_records)}
      ${/^https:\/\//.test(sourceUrl) ? `
        <a class="pa-bio-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">
          <span>出典</span>
          <strong>J.LEAGUE Data Site</strong>
          <b aria-hidden="true">↗</b>
        </a>
      ` : ""}
    `;
  }

  function renderPlayerProfileYearTable(yearRows) {
    if (!yearRows.length) {
      return `<div class="pa-muted" style="padding:16px;text-align:center;">データがありません</div>`;
    }
    return `
      <div class="pa-yearly-table-wrap">
        <table class="pa-yearly-table">
          <thead>
            <tr>
              <th>年度</th>
              <th>背番号</th>
              <th>ポジション</th>
              <th class="pa-num">出場</th>
              <th class="pa-num">先発</th>
              <th class="pa-num">途中</th>
              <th class="pa-num">得点</th>
              <th class="pa-num">出場勝率</th>
              <th class="pa-num">平均勝ち点</th>
              <th class="pa-num">警告</th>
              <th class="pa-num">退場</th>
            </tr>
          </thead>
          <tbody>
            ${yearRows.map(row => `
              <tr>
                <td><button type="button" class="pa-year-detail-btn" data-pa-year-detail="${escapeHtml(formatPlayerNumber(getPlayerYearValue(row)))}">${escapeHtml(formatPlayerNumber(getPlayerYearValue(row)))}</button></td>
                <td><span class="pa-yearly-number ${isPlayerGoalkeeper(row) ? "gk" : ""}">${escapeHtml(formatPlayerList(row.numbers))}</span></td>
                <td>${escapeHtml(formatPlayerList(row.positions))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerNumber(row.played_matches))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerNumber(row.starter_matches))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerNumber(row.sub_matches))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerNumber(row.goals))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerRate(row.played_win_rate))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerDecimal(row.played_points_per_match))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerNumber(row.yellow_cards))}</td>
                <td class="pa-num">${escapeHtml(formatPlayerNumber(row.red_cards))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function setPlayerProfileTab(tabName) {
    const modal = document.getElementById("pa-modal");
    if (!modal) return;
    playerAnalysisState.profileTab = tabName || "profile";
    modal.querySelectorAll(".pa-profile-tab").forEach(button => {
      const active = button.dataset.paProfileTab === playerAnalysisState.profileTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    modal.querySelectorAll(".pa-profile-panel").forEach(panel => {
      panel.hidden = panel.dataset.paPanel !== playerAnalysisState.profileTab;
    });
    modal.querySelectorAll("[data-pa-stats-controls]").forEach(controls => {
      controls.hidden = playerAnalysisState.profileTab === "profile";
    });
  }

  function renderPlayerAnalysisProfile(player, yearRows, insights = {}, profile = null) {
    const aggregate = aggregatePlayerAnalysisRows(yearRows)[0] || player;
    const stateAggregate = (playerAnalysisState.data || []).find(row => getPlayerGroupKey(row) === getPlayerGroupKey(aggregate));
    const shouldUseStateMetrics = stateAggregate
      && yearRows.length <= 1
      && (toPlayerNumber(stateAggregate.played_matches) || 0) === (toPlayerNumber(aggregate.played_matches) || 0)
      && (toPlayerNumber(stateAggregate.goals) || 0) === (toPlayerNumber(aggregate.goals) || 0);
    if (shouldUseStateMetrics) {
      aggregate.__paImpact = stateAggregate.__paImpact;
      aggregate.__paRankingMetrics = stateAggregate.__paRankingMetrics;
    }
    if (insights.totalMetrics) aggregate.__paRankingMetrics = insights.totalMetrics;
    if (insights.currentMetrics) player.__paRankingMetrics = insights.currentMetrics;
    const totalInsights = insights.total || { opponentGoals: [] };
    const currentInsights = insights.current || { opponentGoals: [] };
    const totalOpponentMode = isPlayerGoalkeeper(aggregate) || isPlayerGoalkeeper(player) ? "defense" : "attack";
    const currentOpponentMode = isPlayerGoalkeeper(player) ? "defense" : "attack";
    const yearLabel = getPlayerAnalysisTimeLabel();
    const showCurrentTab = playerAnalysisState.timeMode === "range" || playerAnalysisState.year !== "all";
    const allowedTabs = showCurrentTab ? ["profile", "total", "yearly", "current"] : ["profile", "total", "yearly"];
    const activeTab = allowedTabs.includes(playerAnalysisState.profileTab) ? playerAnalysisState.profileTab : "profile";

    const meta = `
      ${renderPlayerNumberBadge(aggregate.numbers || player.numbers, "modal", aggregate)}
      <span class="pa-player-position-text">${escapeHtml(formatPlayerList(aggregate.positions || player.positions))}</span>
    `;
    const body = `
      <div class="pa-profile-tabs" role="tablist" aria-label="選手データ表示切り替え">
        <button type="button" class="pa-profile-tab" data-pa-profile-tab="profile" role="tab">プロフィール</button>
        <button type="button" class="pa-profile-tab" data-pa-profile-tab="total" role="tab">累計</button>
        <button type="button" class="pa-profile-tab" data-pa-profile-tab="yearly" role="tab">年別</button>
        ${showCurrentTab ? `<button type="button" class="pa-profile-tab" data-pa-profile-tab="current" role="tab">${escapeHtml(yearLabel)}</button>` : ""}
      </div>
      <div class="pa-profile-stat-controls" data-pa-stats-controls>
        ${renderPlayerAnalysisCategoryChecklist()}
      </div>
      <div class="pa-profile-panel" data-pa-panel="profile" role="tabpanel">
        ${renderPlayerProfileBio(profile, aggregate || player)}
      </div>
      <div class="pa-profile-panel" data-pa-panel="total" role="tabpanel">
        ${renderPlayerProfileKpis(aggregate, yearRows)}
        ${renderPlayerAnalysisDetailSections(aggregate)}
        ${renderPlayerOpponentGoalSection(aggregate.player_name || player.player_name || "-", totalOpponentMode === "defense" ? totalInsights.opponentDefense : totalInsights.opponentGoals, { mode: totalOpponentMode })}
      </div>
      <div class="pa-profile-panel" data-pa-panel="yearly" role="tabpanel">
        ${renderPlayerProfileYearTable(yearRows)}
      </div>
      ${showCurrentTab ? `
        <div class="pa-profile-panel" data-pa-panel="current" role="tabpanel">
          ${renderPlayerProfileKpis(player, [player])}
          ${renderPlayerAnalysisDetailSections(player)}
          ${renderPlayerOpponentGoalSection(player.player_name || "-", currentOpponentMode === "defense" ? currentInsights.opponentDefense : currentInsights.opponentGoals, { mode: currentOpponentMode })}
        </div>
      ` : ""}
    `;
    setPlayerAnalysisModalContent(renderPlayerAnalysisModalShell(getPlayerProfileEnglishName(profile, aggregate || player), aggregate.player_name || player.player_name || "-", body, meta));
    setPlayerProfileTab(activeTab);
  }

  async function openPlayerAnalysisProfile(player, options = {}) {
    if (!player) return;
    addAppHistoryEntry(
      "pa-modal:profile",
      () => openPlayerAnalysisProfile(player, { ...options, history: false }),
      options
    );
    const profileNavigationId = activeAppHistoryId;
    if (options.resetCategories !== false) {
      playerAnalysisState.modalCategories = getPlayerAnalysisCategoriesForScope(playerAnalysisState.matchScope);
    }
    playerAnalysisState.modalPlayer = player;
    playerAnalysisState.modalView = "profile";
    playerAnalysisState.modalMatchYear = null;
    playerAnalysisState.modalMatchYearRow = null;
    playerAnalysisState.modalMatchItems = [];
    setPlayerAnalysisModalContent(renderPlayerAnalysisModalShell(
      getPlayerProfileEnglishName(player.__paProfile || null, player),
      player.player_name || "-",
      `<div class="pa-profile-loading"><strong>${escapeHtml(player.player_name || "-")}</strong><small>プロフィールを読み込み中...</small></div>`
    ));
    const modalScope = getActivePlayerAnalysisModalScope();
    const activeYears = new Set(getPlayerAnalysisTimeYears());
    const [yearRows, profile] = await Promise.all([
      getPlayerAnalysisYearRowsForPlayer(player, modalScope, null),
      getPlayerProfile(player)
    ]);
    const currentRows = yearRows.filter(row => !activeYears.size || activeYears.has(getPlayerYearValue(row)));
    const currentPlayer = currentRows.length === 1 ? currentRows[0] : (currentRows.length ? aggregatePlayerAnalysisRows(currentRows)[0] || player : player);
    const groupKey = getPlayerGroupKey(player);
    const totalMetricYears = getPlayerAnalysisYearsForPlayers([player], yearRows);
    const currentMetricYears = getPlayerAnalysisYearsForPlayers([player], currentRows.length ? currentRows : [player]);
    const totalMetricMap = await buildPlayerAnalysisRankingMetrics(totalMetricYears, modalScope, null);
    const currentMetricMap = (playerAnalysisState.timeMode === "range" || playerAnalysisState.year !== "all")
      ? await buildPlayerAnalysisRankingMetrics(currentMetricYears, modalScope, null)
      : null;
    const insights = {
      total: await buildPlayerPerformanceExtras(player, yearRows, modalScope, null),
      current: (playerAnalysisState.timeMode === "range" || playerAnalysisState.year !== "all")
        ? await buildPlayerPerformanceExtras(player, currentRows.length ? currentRows : [player], modalScope, null)
        : null,
      totalMetrics: totalMetricMap.get(groupKey) || null,
      currentMetrics: currentMetricMap ? currentMetricMap.get(groupKey) || null : null
    };
    if (activeAppHistoryId !== profileNavigationId || getActiveAppHistoryEntry()?.kind !== "pa-modal:profile") return;
    playerAnalysisState.modalYearRows = yearRows;
    renderPlayerAnalysisProfile(currentPlayer, yearRows, insights, profile);
  }

  async function refreshPlayerAnalysisModalForCategories() {
    const player = playerAnalysisState.modalPlayer;
    if (!player) return;
    const modalScope = getActivePlayerAnalysisModalScope();
    if (playerAnalysisState.modalView === "match-list" && playerAnalysisState.modalMatchYear) {
      const year = playerAnalysisState.modalMatchYear;
      setPlayerAnalysisModalContent(renderPlayerAnalysisModalShell(
        "MATCH LOG",
        `${player.player_name || "-"} / ${year}年`,
        `<div class="pa-profile-loading"><strong>${escapeHtml(String(year))}年</strong><small>出場試合を集計中...</small></div>`
      ));
      const items = await getPlayerYearMatchDetails(player, year, modalScope, null);
      const yearRows = await getPlayerAnalysisYearRowsForPlayer(player, modalScope, null);
      const yearRow = yearRows.find(row => getPlayerYearValue(row) === year);
      playerAnalysisState.modalYearRows = yearRows;
      playerAnalysisState.modalMatchItems = items;
      playerAnalysisState.modalMatchYearRow = yearRow || null;
      setPlayerAnalysisModalContent(renderPlayerYearMatchList(player, year, items, yearRow));
      return;
    }
    if (playerAnalysisState.modalView === "match-detail" && playerAnalysisState.modalMatchYear) {
      playerAnalysisState.modalView = "match-list";
      await refreshPlayerAnalysisModalForCategories();
      return;
    }
    await openPlayerAnalysisProfile(player, { resetCategories: false, history: false });
  }

  function renderPlayerAnalysisDetail(player) {
    const { detail } = getPlayerAnalysisElements();
    if (!detail) return;
    if (!player) {
      detail.classList.remove("active");
      detail.innerHTML = "";
      return;
    }

    detail.classList.add("active");
    detail.innerHTML = `
      ${renderPlayerPhoto(player.player_name || "", playerAnalysisState.selectedClub, "pa-detail-photo", player)}
      ${renderPlayerChantAudioSlot(player.player_name || "", player)}
      <div class="pa-detail-header">
        <div>
          <span class="pa-kicker">PLAYER DETAIL</span>
          <h2>${escapeHtml(player.player_name || "-")}</h2>
        </div>
        <div class="pa-detail-meta">
          ${renderPlayerNumberBadge(player.numbers, "modal", player)}
          <span class="pa-player-position-text">${escapeHtml(formatPlayerList(player.positions))}</span>
        </div>
      </div>
      ${renderPlayerAnalysisDetailSections(player)}
    `;
    setupPlayerPhotos(detail);
    setupPlayerChantAudio(detail);
  }

  async function applyPlayerAnalysisFilters() {
    const els = getPlayerAnalysisElements();
    playerAnalysisState.query = els.search ? els.search.value : "";
    readPlayerAnalysisAdvancedFilterRows();
    resetPlayerAnalysisNumericState();
    playerAnalysisState.heightMin = els.heightMin ? els.heightMin.value : "";
    playerAnalysisState.heightMax = els.heightMax ? els.heightMax.value : "";
    playerAnalysisState.weightMin = els.weightMin ? els.weightMin.value : "";
    playerAnalysisState.weightMax = els.weightMax ? els.weightMax.value : "";
    playerAnalysisState.birthYearMin = els.birthYearMin ? els.birthYearMin.value : "";
    playerAnalysisState.birthYearMax = els.birthYearMax ? els.birthYearMax.value : "";
    playerAnalysisState.scorersOnly = Boolean(els.scorersOnly && els.scorersOnly.checked);
    playerAnalysisState.playedOnly = Boolean(els.playedOnly && els.playedOnly.checked);
    playerAnalysisState.katakanaOnly = Boolean(els.katakanaOnly && els.katakanaOnly.checked);
    if (needsPlayerSeasonMeta() && !playerAnalysisSeasonMetaCache.has(getPlayerAnalysisFilterCacheKey())) {
      setPlayerAnalysisStatus("所属年数を集計中...");
      await ensurePlayerAnalysisSeasonMeta(playerAnalysisState.matchScope, getActivePlayerAnalysisCompetitionFilter());
      setPlayerAnalysisStatus("", false);
    }
    if (needsPlayerMonthlyMeta()) {
      setPlayerAnalysisStatus("月別条件を集計中...");
      const timeValue = getPlayerAnalysisTimeValue();
      const months = Array.from(new Set(getActivePlayerAnalysisAdvancedFilters()
        .filter(filter => isPlayerAnalysisMonthCompactFilter(filter.type))
        .map(filter => normalizePlayerMonthFilter(filter.month))
        .filter(Boolean)));
      if (!months.length) {
        await ensurePlayerAnalysisMonthlyMeta(timeValue, playerAnalysisState.matchScope);
      } else {
        await Promise.all(months.map(month => ensurePlayerAnalysisMonthlyMeta(timeValue, playerAnalysisState.matchScope, month)));
      }
      setPlayerAnalysisStatus("", false);
    }
    renderPlayerAnalysisTable();
  }

  function resetPlayerAnalysisFilters() {
    const els = getPlayerAnalysisElements();
    playerAnalysisState.query = "";
    playerAnalysisState.positions = [];
    playerAnalysisState.positionMode = "or";
    playerAnalysisState.numberFilter = "";
    playerAnalysisState.playedMin = "";
    playerAnalysisState.playedMax = "";
    playerAnalysisState.startsMin = "";
    playerAnalysisState.goalsMin = "";
    playerAnalysisState.playedRateMin = "";
    playerAnalysisState.scoredRateMin = "";
    playerAnalysisState.scoredPpmMin = "";
    playerAnalysisState.monthFilter = "";
    playerAnalysisState.monthGoalsMin = "";
    playerAnalysisState.monthPlayedRateMin = "";
    playerAnalysisState.yellowMin = "";
    playerAnalysisState.redMin = "";
    playerAnalysisState.seasonsMin = "";
    playerAnalysisState.seasonsMax = "";
    playerAnalysisState.heightMin = "";
    playerAnalysisState.heightMax = "";
    playerAnalysisState.weightMin = "";
    playerAnalysisState.weightMax = "";
    playerAnalysisState.birthYearMin = "";
    playerAnalysisState.birthYearMax = "";
    playerAnalysisState.compactFilterType = "";
    playerAnalysisState.compactFilterValue = "";
    playerAnalysisState.compactFilterMonth = "5";
    playerAnalysisState.advancedFilterLogic = "and";
    playerAnalysisState.advancedFilters = [createPlayerAnalysisAdvancedFilter()];
    playerAnalysisState.scorersOnly = false;
    playerAnalysisState.playedOnly = false;
    playerAnalysisState.katakanaOnly = false;
    if (els.search) els.search.value = "";
    if (els.numberFilter) els.numberFilter.value = "";
    if (els.playedMin) els.playedMin.value = "";
    if (els.playedMax) els.playedMax.value = "";
    if (els.startsMin) els.startsMin.value = "";
    if (els.goalsMin) els.goalsMin.value = "";
    if (els.playedRateMin) els.playedRateMin.value = "";
    if (els.scoredRateMin) els.scoredRateMin.value = "";
    if (els.scoredPpmMin) els.scoredPpmMin.value = "";
    if (els.monthFilter) els.monthFilter.value = "";
    if (els.monthGoalsMin) els.monthGoalsMin.value = "";
    if (els.monthPlayedRateMin) els.monthPlayedRateMin.value = "";
    if (els.yellowMin) els.yellowMin.value = "";
    if (els.redMin) els.redMin.value = "";
    if (els.seasonsMin) els.seasonsMin.value = "";
    if (els.seasonsMax) els.seasonsMax.value = "";
    if (els.heightMin) els.heightMin.value = "";
    if (els.heightMax) els.heightMax.value = "";
    if (els.weightMin) els.weightMin.value = "";
    if (els.weightMax) els.weightMax.value = "";
    if (els.birthYearMin) els.birthYearMin.value = "";
    if (els.birthYearMax) els.birthYearMax.value = "";
    if (els.compactFilterType) els.compactFilterType.value = "";
    if (els.compactFilterValue) els.compactFilterValue.value = "";
    if (els.compactFilterMonth) els.compactFilterMonth.value = playerAnalysisState.compactFilterMonth;
    updatePlayerAnalysisCompactFilterControls(els);
    renderPlayerAnalysisDetailFilterModes();
    renderPlayerAnalysisAdvancedFilterRows();
    if (els.scorersOnly) els.scorersOnly.checked = false;
    if (els.playedOnly) els.playedOnly.checked = false;
    if (els.katakanaOnly) els.katakanaOnly.checked = false;
    renderPlayerAnalysisPositions(playerAnalysisState.data);
    renderPlayerAnalysisTable();
  }

  async function renderPlayerAnalysisYear(year = playerAnalysisState.year) {
    if (playerAnalysisState.timeMode !== "range") {
      playerAnalysisState.year = normalizePlayerAnalysisYearForClub(year);
    }
    normalizePlayerAnalysisTimeState();
    renderPlayerAnalysisClubControl();
    const {
      yearSelect, search, numberFilter, playedMin, playedMax, startsMin, goalsMin,
      playedRateMin, scoredRateMin, scoredPpmMin, monthFilter, monthGoalsMin, monthPlayedRateMin,
      yellowMin, redMin, seasonsMin, seasonsMax,
      heightMin, heightMax, weightMin, weightMax, birthYearMin, birthYearMax,
      compactFilterType, compactFilterValue, compactFilterMonth,
      scorersOnly, playedOnly, katakanaOnly
    } = getPlayerAnalysisElements();
    renderPlayerAnalysisYears();
    if (yearSelect) yearSelect.value = String(playerAnalysisState.year);
    const timeValue = getPlayerAnalysisTimeValue();
    const activeYears = getPlayerAnalysisTimeYears();
    const specialAvailable = await hasPlayerAnalysisSpecialMatches(timeValue);
    if (!specialAvailable && playerAnalysisState.matchScope === "special") {
      playerAnalysisState.matchScope = "all";
    }
    updatePlayerAnalysisScopeButtons(specialAvailable);
    const availableCompetitions = await getPlayerAnalysisAvailableCompetitions(timeValue, playerAnalysisState.matchScope);
    if (playerAnalysisState.competitionFilterActive) {
      playerAnalysisState.selectedCompetitions = playerAnalysisState.selectedCompetitions.filter(name => availableCompetitions.includes(name));
    } else {
      playerAnalysisState.selectedCompetitions = availableCompetitions.slice();
    }
    renderPlayerAnalysisCompetitionOptions(availableCompetitions);
    const loadingLabel = getPlayerAnalysisTimeLabel();
    setPlayerAnalysisStatus(`${loadingLabel} / ${getPlayerAnalysisScopeLabel()} の選手分析データを読み込み中...`);
    const competitionFilter = getActivePlayerAnalysisCompetitionFilter();

    const entry = playerAnalysisState.timeMode === "range"
      ? {
        rows: await buildPlayerRowsForYears(activeYears, playerAnalysisState.matchScope, competitionFilter),
        missing: !activeYears.length
      }
      : playerAnalysisState.year === "all"
        ? await loadAllPlayerAnalysisYears(playerAnalysisState.matchScope, competitionFilter)
        : await loadScopedPlayerAnalysisYear(playerAnalysisState.year, playerAnalysisState.matchScope, competitionFilter);
    playerAnalysisState.teamStats = await buildPlayerAnalysisTeamStats(timeValue, playerAnalysisState.matchScope, competitionFilter);
    entry.missing = entry.missing || !entry.rows.length;
    await attachPlayerProfilesToRows(entry.rows);
    playerAnalysisState.data = entry.rows;
    playerAnalysisState.selectedKey = null;
    if (search) search.value = playerAnalysisState.query;
    if (numberFilter) numberFilter.value = playerAnalysisState.numberFilter;
    if (playedMin) playedMin.value = playerAnalysisState.playedMin;
    if (playedMax) playedMax.value = playerAnalysisState.playedMax;
    if (startsMin) startsMin.value = playerAnalysisState.startsMin;
    if (goalsMin) goalsMin.value = playerAnalysisState.goalsMin;
    if (playedRateMin) playedRateMin.value = playerAnalysisState.playedRateMin;
    if (scoredRateMin) scoredRateMin.value = playerAnalysisState.scoredRateMin;
    if (scoredPpmMin) scoredPpmMin.value = playerAnalysisState.scoredPpmMin;
    if (monthFilter) monthFilter.value = playerAnalysisState.monthFilter;
    if (monthGoalsMin) monthGoalsMin.value = playerAnalysisState.monthGoalsMin;
    if (monthPlayedRateMin) monthPlayedRateMin.value = playerAnalysisState.monthPlayedRateMin;
    if (yellowMin) yellowMin.value = playerAnalysisState.yellowMin;
    if (redMin) redMin.value = playerAnalysisState.redMin;
    if (seasonsMin) seasonsMin.value = playerAnalysisState.seasonsMin;
    if (seasonsMax) seasonsMax.value = playerAnalysisState.seasonsMax;
    if (heightMin) heightMin.value = playerAnalysisState.heightMin;
    if (heightMax) heightMax.value = playerAnalysisState.heightMax;
    if (weightMin) weightMin.value = playerAnalysisState.weightMin;
    if (weightMax) weightMax.value = playerAnalysisState.weightMax;
    if (birthYearMin) birthYearMin.value = playerAnalysisState.birthYearMin;
    if (birthYearMax) birthYearMax.value = playerAnalysisState.birthYearMax;
    if (compactFilterType) compactFilterType.value = playerAnalysisState.compactFilterType;
    if (compactFilterValue) compactFilterValue.value = playerAnalysisState.compactFilterValue;
    if (compactFilterMonth) compactFilterMonth.value = playerAnalysisState.compactFilterMonth;
    updatePlayerAnalysisCompactFilterControls(getPlayerAnalysisElements());
    renderPlayerAnalysisDetailFilterModes();
    renderPlayerAnalysisAdvancedFilterRows();
    if (scorersOnly) scorersOnly.checked = playerAnalysisState.scorersOnly;
    if (playedOnly) playedOnly.checked = playerAnalysisState.playedOnly;
    if (katakanaOnly) katakanaOnly.checked = playerAnalysisState.katakanaOnly;

    renderPlayerAnalysisPositions(entry.rows);
    renderPlayerAnalysisSummary(entry.rows);
    await ensurePlayerAnalysisRankingMetrics(entry.rows, timeValue);
    ensurePlayerImpactScores(entry.rows);
    renderPlayerAnalysisRankings(entry.rows);
    if (needsPlayerSeasonMeta() && !playerAnalysisSeasonMetaCache.has(getPlayerAnalysisFilterCacheKey())) {
      setPlayerAnalysisStatus("所属年数を集計中...");
      await ensurePlayerAnalysisSeasonMeta(playerAnalysisState.matchScope, competitionFilter);
      setPlayerAnalysisStatus("", false);
    }

    if (entry.missing) {
      setPlayerAnalysisStatus(playerAnalysisState.timeMode === "range" || playerAnalysisState.year === "all" ? "選手分析データはまだありません" : "この年度の選手分析データはまだありません");
    } else {
      setPlayerAnalysisStatus("", false);
    }
    if (needsPlayerMonthlyMeta()) {
      setPlayerAnalysisStatus("月別条件を集計中...");
      const months = Array.from(new Set(getActivePlayerAnalysisAdvancedFilters()
        .filter(filter => isPlayerAnalysisMonthCompactFilter(filter.type))
        .map(filter => normalizePlayerMonthFilter(filter.month))
        .filter(Boolean)));
      if (!months.length) {
        await ensurePlayerAnalysisMonthlyMeta(timeValue, playerAnalysisState.matchScope);
      } else {
        await Promise.all(months.map(month => ensurePlayerAnalysisMonthlyMeta(timeValue, playerAnalysisState.matchScope, month)));
      }
      setPlayerAnalysisStatus("", false);
    }
    renderPlayerAnalysisTable();
    await renderPlayerComparisonPanel();
    if (playerAnalysisState.activeScreen === "opponents") await renderPlayerOpponentPanel();
    if (playerAnalysisState.activeScreen === "player-opponents") await renderPlayerOpponentPlayerPanel();
    setPlayerAnalysisScreen(playerAnalysisState.activeScreen);
    playerAnalysisState.loadedOnce = true;
  }

  function initializePlayerAnalysisView() {
    if (playerAnalysisState.initialized) return;
    const els = getPlayerAnalysisElements();
    if (!els.yearSelect || !els.tableBody || !els.tableHead) return;
    renderPlayerAnalysisClubControl();
    renderPlayerAnalysisYears();
    updatePlayerAnalysisScopeButtons(false);
    setPlayerAnalysisScreen(playerAnalysisState.activeScreen);

    els.yearSelect.onchange = () => {
      playerAnalysisState.timeMode = "year";
      playerAnalysisState.year = normalizePlayerAnalysisYearForClub(els.yearSelect.value);
      playerAnalysisState.competitionFilterActive = false;
      playerAnalysisState.selectedCompetitions = [];
      renderPlayerAnalysisYear(playerAnalysisState.year);
    };
    if (els.mainPeriodToggle) {
      els.mainPeriodToggle.onclick = () => {
        playerAnalysisState.timeMode = playerAnalysisState.timeMode === "range" ? "year" : "range";
        playerAnalysisState.competitionFilterActive = false;
        playerAnalysisState.selectedCompetitions = [];
        renderPlayerAnalysisYear(playerAnalysisState.year);
      };
    }
    if (els.mainPeriodStart) {
      els.mainPeriodStart.onchange = () => {
        playerAnalysisState.timeMode = "range";
        playerAnalysisState.rangeStartYear = els.mainPeriodStart.value;
        playerAnalysisState.competitionFilterActive = false;
        playerAnalysisState.selectedCompetitions = [];
        renderPlayerAnalysisYear(playerAnalysisState.year);
      };
    }
    if (els.mainPeriodEnd) {
      els.mainPeriodEnd.onchange = () => {
        playerAnalysisState.timeMode = "range";
        playerAnalysisState.rangeEndYear = els.mainPeriodEnd.value;
        playerAnalysisState.competitionFilterActive = false;
        playerAnalysisState.selectedCompetitions = [];
        renderPlayerAnalysisYear(playerAnalysisState.year);
      };
    }
    let clubPointerAt = 0;
    const toggleClubMenuFromEvent = (event) => {
      if (event.type === "click" && Date.now() - clubPointerAt < 450) return;
      if (event.type === "pointerdown") clubPointerAt = Date.now();
      event.preventDefault();
      event.stopPropagation();
      togglePlayerAnalysisClubMenu();
    };
    const selectClubFromEvent = (event) => {
      const button = event.target.closest("[data-pa-club]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      changePlayerAnalysisClub(button.dataset.paClub);
    };
    if (els.clubSelect) {
      els.clubSelect.onpointerdown = toggleClubMenuFromEvent;
      els.clubSelect.onclick = toggleClubMenuFromEvent;
    }
    if (els.clubMenu) {
      els.clubMenu.onpointerdown = selectClubFromEvent;
      els.clubMenu.onclick = selectClubFromEvent;
    }
    document.addEventListener("click", (event) => {
      if (event.target.closest("#pa-club-select") || event.target.closest("#pa-club-menu")) return;
      closePlayerAnalysisClubMenu();
    });
    if (els.filterFab) els.filterFab.onclick = () => setPlayerAnalysisFilterPanel(true);
    if (els.filterClose) els.filterClose.onclick = () => setPlayerAnalysisFilterPanel(false);
    if (els.filterBackdrop) els.filterBackdrop.onclick = () => setPlayerAnalysisFilterPanel(false);
    if (els.scrollTopFab) {
      els.scrollTopFab.onclick = scrollPlayerAnalysisToTop;
      els.scrollTopFab.addEventListener("click", scrollPlayerAnalysisToTop);
    }
    if (playerAnalysisView) {
      playerAnalysisView.addEventListener("scroll", updatePlayerAnalysisScrollTopButton, { passive: true });
      updatePlayerAnalysisScrollTopButton();
    }
    if (els.bottomTabs) {
      els.bottomTabs.onclick = (event) => {
        const button = event.target.closest("[data-pa-screen-target]");
        if (!button) return;
        setPlayerAnalysisScreen(button.dataset.paScreenTarget, { history: true });
      };
    }
    if (els.opponentSelect) {
      const selectOpponentClub = () => {
        playerAnalysisState.opponentClub = els.opponentSelect.value || "";
        playerAnalysisState.opponentPlayerDetail = false;
        renderPlayerOpponentPanel();
      };
      els.opponentSelect.onchange = selectOpponentClub;
      els.opponentSelect.oninput = selectOpponentClub;
    }
    if (els.opponentYearSelect) {
      els.opponentYearSelect.onchange = () => {
        playerAnalysisState.opponentYear = els.opponentYearSelect.value || "";
        playerAnalysisState.opponentPlayerKey = "";
        renderPlayerOpponentPanel();
      };
    }
    if (els.opponentSearch) {
      const selectOpponentFromSearch = () => {
        const value = String(els.opponentSearch.value || "").trim();
        const clubs = playerAnalysisState.opponentClubs || [];
        const normalized = normalizeOpponentSearchText(value);
        const exact = clubs.find(club => club === value || normalizeOpponentSearchText(club) === normalized);
        const partial = !exact && normalized.length >= 2
          ? clubs.filter(club => normalizeOpponentSearchText(club).includes(normalized))
          : [];
        const selected = exact || (partial.length === 1 ? partial[0] : "");
        if (!selected || selected === playerAnalysisState.opponentClub) return;
        playerAnalysisState.opponentClub = selected;
        playerAnalysisState.opponentPlayerDetail = false;
        if (els.opponentSelect) els.opponentSelect.value = selected;
        renderPlayerOpponentPanel();
      };
      els.opponentSearch.onchange = selectOpponentFromSearch;
      els.opponentSearch.oninput = selectOpponentFromSearch;
    }
    if (els.playerOpponentSelect) {
      const selectPlayerOpponent = () => {
        playerAnalysisState.opponentPlayerKey = els.playerOpponentSelect.value || "";
        renderPlayerOpponentPlayerPanel();
      };
      els.playerOpponentSelect.onchange = selectPlayerOpponent;
      els.playerOpponentSelect.oninput = selectPlayerOpponent;
    }
    if (els.playerOpponentYearSelect) {
      els.playerOpponentYearSelect.onchange = () => {
        playerAnalysisState.opponentYear = els.playerOpponentYearSelect.value || "";
        playerAnalysisState.opponentPlayerKey = "";
        renderPlayerOpponentPlayerPanel();
      };
    }
    if (els.playerOpponentSearch) {
      const selectPlayerOpponentFromSearch = () => {
        const match = findPlayerOpponentSearchMatch(els.playerOpponentSearch.value, playerAnalysisState.opponentChoiceRows || []);
        if (!match) return;
        const key = getPlayerGroupKey(match);
        if (!key || key === playerAnalysisState.opponentPlayerKey) return;
        playerAnalysisState.opponentPlayerKey = key;
        if (els.playerOpponentSelect) els.playerOpponentSelect.value = key;
        renderPlayerOpponentPlayerPanel();
      };
      els.playerOpponentSearch.onchange = selectPlayerOpponentFromSearch;
      els.playerOpponentSearch.oninput = selectPlayerOpponentFromSearch;
    }
    els.compareYearSelects.forEach(select => {
      select.onchange = () => {
        const index = Number(select.dataset.paCompareYearIndex);
        if (!Number.isInteger(index)) return;
        if (!Array.isArray(playerAnalysisState.compareChoiceYears)) {
          playerAnalysisState.compareChoiceYears = ["", "", ""];
        }
        playerAnalysisState.compareChoiceYears[index] = select.value || "";
        playerAnalysisState.compareKeys = (playerAnalysisState.compareKeys || ["", "", ""]).map((key, keyIndex) => keyIndex >= index ? "" : key);
        renderPlayerComparisonPanel();
      };
    });
    [els.opponentPanel, els.playerOpponentPanel].filter(Boolean).forEach(panel => {
      panel.onclick = (event) => {
        const detailToggle = event.target.closest("[data-pa-opponent-detail-toggle]");
        if (detailToggle) {
          playerAnalysisState.opponentPlayerDetail = !playerAnalysisState.opponentPlayerDetail;
          renderPlayerOpponentPanel();
          return;
        }
        const matchDetailButton = event.target.closest("[data-pa-opponent-match-detail]");
        if (matchDetailButton) {
          openOpponentClubMatchResultDetail(matchDetailButton.dataset.paMatchId || "", matchDetailButton.dataset.paMatchYear || "")
            .catch(error => console.warn("Failed to open opponent match detail", error));
          return;
        }
        const profileButton = event.target.closest(".pa-player-link");
        if (profileButton) {
          const key = profileButton.dataset.paKey;
          const groupKey = profileButton.dataset.paGroupKey;
          const player = (playerAnalysisState.opponentScopeRows || []).find(row => getPlayerAnalysisKey(row) === key)
            || (playerAnalysisState.opponentScopeRows || []).find(row => groupKey && getPlayerGroupKey(row) === groupKey);
          if (player) openPlayerAnalysisProfile(player);
          return;
        }
        const button = event.target.closest("[data-pa-opponent-toggle]");
        if (!button) return;
        const section = button.closest("[data-pa-opponent-section]");
        if (!section) return;
        section.classList.toggle("is-expanded");
        button.textContent = section.classList.contains("is-expanded") ? "閉じる" : "すべて表示";
      };
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setPlayerAnalysisFilterPanel(false);
    });
    els.scopeButtons.forEach(button => {
      button.onclick = () => {
        if (button.hidden) return;
        const nextScope = ["all", "league", "special"].includes(button.dataset.paScope) ? button.dataset.paScope : "all";
        if (playerAnalysisState.matchScope === nextScope) return;
        playerAnalysisState.matchScope = nextScope;
        playerAnalysisState.profileTab = "profile";
        playerAnalysisState.competitionFilterActive = false;
        playerAnalysisState.selectedCompetitions = [];
        updatePlayerAnalysisScopeButtons();
        renderPlayerAnalysisYear(playerAnalysisState.year);
      };
    });
    if (els.competitionOptions) {
      els.competitionOptions.onchange = (event) => {
        if (!event.target.closest("input[type='checkbox']")) return;
        readPlayerAnalysisCompetitionOptions();
        renderPlayerAnalysisYear(playerAnalysisState.year);
      };
    }
    if (els.search) els.search.oninput = applyPlayerAnalysisFilters;
    [
      els.numberFilter, els.playedMin, els.playedMax, els.startsMin, els.goalsMin,
      els.playedRateMin, els.scoredRateMin, els.scoredPpmMin, els.monthFilter,
      els.monthGoalsMin, els.monthPlayedRateMin, els.yellowMin, els.redMin,
      els.seasonsMin, els.seasonsMax,
      els.heightMin, els.heightMax, els.weightMin, els.weightMax,
      els.birthYearMin, els.birthYearMax
    ].forEach(input => {
      if (input) input.oninput = applyPlayerAnalysisFilters;
    });
    if (els.positionOptions) {
      els.positionOptions.onclick = (event) => {
        const chip = event.target.closest(".pa-position-chip");
        if (!chip) return;
        const position = chip.dataset.paPosition;
        if (!position) return;
        if (playerAnalysisState.positions.includes(position)) {
          playerAnalysisState.positions = playerAnalysisState.positions.filter(item => item !== position);
        } else {
          playerAnalysisState.positions = [...playerAnalysisState.positions, position];
        }
        renderPlayerAnalysisPositions(playerAnalysisState.data);
        renderPlayerAnalysisTable();
      };
    }
    els.positionModeButtons.forEach(button => {
      button.onclick = () => {
        const mode = button.dataset.paPositionMode === "and" ? "and" : "or";
        playerAnalysisState.positionMode = mode;
        renderPlayerAnalysisPositionModes();
        renderPlayerAnalysisTable();
      };
    });
    if (els.scorersOnly) els.scorersOnly.onchange = applyPlayerAnalysisFilters;
    if (els.playedOnly) els.playedOnly.onchange = applyPlayerAnalysisFilters;
    if (els.katakanaOnly) els.katakanaOnly.onchange = applyPlayerAnalysisFilters;
    if (els.filterReset) els.filterReset.onclick = resetPlayerAnalysisFilters;
    els.detailFilterModeButtons.forEach(button => {
      button.onclick = () => {
        playerAnalysisState.advancedFilterLogic = button.dataset.paDetailFilterMode === "or" ? "or" : "and";
        renderPlayerAnalysisDetailFilterModes();
        applyPlayerAnalysisFilters();
      };
    });
    if (els.advancedFilterRows) {
      els.advancedFilterRows.onchange = (event) => {
        readPlayerAnalysisAdvancedFilterRows();
        if (event.target.closest("[data-pa-filter-type]")) {
          renderPlayerAnalysisAdvancedFilterRows();
        }
        applyPlayerAnalysisFilters();
      };
      els.advancedFilterRows.oninput = (event) => {
        if (!event.target.closest("[data-pa-filter-value]")) return;
        applyPlayerAnalysisFilters();
      };
      els.advancedFilterRows.onclick = (event) => {
        const removeButton = event.target.closest("[data-pa-filter-remove]");
        if (!removeButton) return;
        const index = Number(removeButton.dataset.paFilterRemove);
        if (!Number.isInteger(index)) return;
        readPlayerAnalysisAdvancedFilterRows();
        playerAnalysisState.advancedFilters.splice(index, 1);
        if (!playerAnalysisState.advancedFilters.length) {
          playerAnalysisState.advancedFilters = [createPlayerAnalysisAdvancedFilter()];
        }
        renderPlayerAnalysisAdvancedFilterRows();
        applyPlayerAnalysisFilters();
      };
    }
    if (els.addFilterCondition) {
      els.addFilterCondition.onclick = () => {
        readPlayerAnalysisAdvancedFilterRows();
        playerAnalysisState.advancedFilters.push(createPlayerAnalysisAdvancedFilter());
        renderPlayerAnalysisAdvancedFilterRows();
      };
    }
    if (els.sortSelect) els.sortSelect.onchange = () => applyPlayerAnalysisSortSelection(els.sortSelect.value);
    if (els.sortKeySelect) els.sortKeySelect.onchange = applyPlayerAnalysisSortControls;
    if (els.sortDirectionSelect) els.sortDirectionSelect.onchange = applyPlayerAnalysisSortControls;
    if (els.compareControls) {
      els.compareControls.onchange = (event) => {
        const select = event.target.closest("select[data-pa-compare-index]");
        if (!select) return;
        updatePlayerCompareSelection(Number(select.dataset.paCompareIndex), select.value || "");
      };
    }
    if (els.listDetailToggle) {
      els.listDetailToggle.onclick = () => {
        playerAnalysisState.listDetail = !playerAnalysisState.listDetail;
        renderPlayerAnalysisTable();
      };
    }
    if (els.rankings) {
      els.rankings.onclick = (event) => {
        const card = event.target.closest(".pa-rank-card[data-pa-ranking]");
        if (!card) return;
        openPlayerAnalysisRankingModal(card.dataset.paRanking);
      };
      els.rankings.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".pa-rank-card[data-pa-ranking]");
        if (!card) return;
        event.preventDefault();
        openPlayerAnalysisRankingModal(card.dataset.paRanking);
      };
    }

    els.tableHead.onclick = (event) => {
      const th = event.target.closest("th[data-sort]");
      if (!th) return;
      const nextKey = th.dataset.sort;
      if (playerAnalysisState.sortKey === nextKey) {
        playerAnalysisState.sortDirection = playerAnalysisState.sortDirection === "asc" ? "desc" : "asc";
      } else {
        playerAnalysisState.sortKey = nextKey;
        playerAnalysisState.sortDirection = shouldPlayerAnalysisSortAscByDefault(nextKey) ? "asc" : "desc";
      }
      renderPlayerAnalysisTable();
    };

    els.tableBody.onclick = (event) => {
      const profileButton = event.target.closest(".pa-player-link");
      if (profileButton) {
        const key = profileButton.dataset.paKey;
        const player = playerAnalysisState.filtered.find(row => getPlayerAnalysisKey(row) === key);
        if (!player) return;
        playerAnalysisState.selectedKey = key;
        els.tableBody.querySelectorAll("tr[data-pa-key]").forEach(row => {
          row.classList.toggle("selected", row.dataset.paKey === key);
        });
        openPlayerAnalysisProfile(player);
        return;
      }
      const row = event.target.closest("tr[data-pa-key]");
      if (!row) return;
      playerAnalysisState.selectedKey = row.dataset.paKey;
      renderPlayerAnalysisTable();
    };
    els.tableBody.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("tr[data-pa-key]");
      if (!row) return;
      event.preventDefault();
      playerAnalysisState.selectedKey = row.dataset.paKey;
      renderPlayerAnalysisTable();
    };
    if (els.mobileList) {
      els.mobileList.onclick = (event) => {
        const card = event.target.closest(".pa-mobile-player-card");
        if (!card) return;
        const key = card.dataset.paKey;
        const player = playerAnalysisState.filtered.find(row => getPlayerAnalysisKey(row) === key);
        if (!player) return;
        playerAnalysisState.selectedKey = key;
        renderPlayerAnalysisMobileList(playerAnalysisState.filtered);
        openPlayerAnalysisProfile(player);
      };
    }
    if (els.detail) {
      els.detail.onclick = (event) => {
        if (handlePlayerProfileSectionToggle(event)) return;
      };
    }
    const { modal } = ensurePlayerAnalysisModal();
    modal.onclick = async (event) => {
      if (event.target.closest("[data-pa-modal-close]")) {
        closePlayerAnalysisModal();
        return;
      }
      if (handlePlayerProfileSectionToggle(event)) return;
      const tabButton = event.target.closest(".pa-profile-tab");
      if (tabButton) {
        setPlayerProfileTab(tabButton.dataset.paProfileTab);
        return;
      }
      const opponentToggle = event.target.closest("[data-pa-opponent-toggle]");
      if (opponentToggle) {
        const section = opponentToggle.closest("[data-pa-opponent-section]");
        if (!section) return;
        section.classList.toggle("is-expanded");
        opponentToggle.textContent = section.classList.contains("is-expanded") ? "閉じる" : "すべて表示";
        return;
      }
      const rankingPlayerButton = event.target.closest(".pa-modal-player-link[data-pa-key]");
      if (rankingPlayerButton) {
        const player = findPlayerAnalysisRowByKey(rankingPlayerButton.dataset.paKey);
        if (player) openPlayerAnalysisProfile(player);
        return;
      }
      const categoryCheckbox = event.target.closest("[data-pa-category]");
      if (categoryCheckbox) {
        readPlayerAnalysisModalCategories(modal);
        await refreshPlayerAnalysisModalForCategories();
        return;
      }
      const yearButton = event.target.closest(".pa-year-detail-btn[data-pa-year-detail]");
      if (yearButton && playerAnalysisState.modalPlayer) {
        const sourceNavigationId = activeAppHistoryId;
        const year = Number(yearButton.dataset.paYearDetail);
        if (!Number.isInteger(year)) return;
        playerAnalysisState.modalView = "match-list";
        setPlayerAnalysisModalContent(renderPlayerAnalysisModalShell(
          "MATCH LOG",
          `${playerAnalysisState.modalPlayer.player_name || "-"} / ${year}年`,
          `<div class="pa-profile-loading"><strong>${escapeHtml(String(year))}年</strong><small>出場試合を集計中...</small></div>`
        ));
        const modalScope = getActivePlayerAnalysisModalScope();
        const items = await getPlayerYearMatchDetails(playerAnalysisState.modalPlayer, year, modalScope, null);
        const yearRows = await getPlayerAnalysisYearRowsForPlayer(playerAnalysisState.modalPlayer, modalScope, null);
        if (activeAppHistoryId !== sourceNavigationId) return;
        const yearRow = yearRows.find(row => getPlayerYearValue(row) === year);
        playerAnalysisState.modalYearRows = yearRows;
        playerAnalysisState.modalMatchYear = year;
        playerAnalysisState.modalMatchYearRow = yearRow || null;
        playerAnalysisState.modalMatchItems = items;
        setPlayerAnalysisModalContent(renderPlayerYearMatchList(playerAnalysisState.modalPlayer, year, items, yearRow));
        const modalPlayer = playerAnalysisState.modalPlayer;
        addAppHistoryEntry("pa-modal:match-list", () => {
          playerAnalysisState.modalPlayer = modalPlayer;
          playerAnalysisState.modalView = "match-list";
          playerAnalysisState.modalMatchYear = year;
          playerAnalysisState.modalMatchYearRow = yearRow || null;
          playerAnalysisState.modalMatchItems = items;
          setPlayerAnalysisModalContent(renderPlayerYearMatchList(modalPlayer, year, items, yearRow));
        });
        return;
      }
      const scheduleMatchButton = event.target.closest("[data-pa-open-schedule-match]");
      if (scheduleMatchButton && playerAnalysisState.modalPlayer) {
        const matchId = String(scheduleMatchButton.dataset.paMatchId || "");
        const item = (playerAnalysisState.modalMatchItems || []).find(entry => String(entry.match?.match_id || entry.appearance?.match_id || "") === matchId);
        if (!item) return;
        scheduleMatchButton.disabled = true;
        const status = modal.querySelector(".pa-match-detail-link-status");
        if (status) status.textContent = "日程詳細を開いています...";
        const opened = await openScheduleMatchFromPlayerAnalysis(item.match);
        if (!opened) {
          scheduleMatchButton.disabled = false;
          if (status) status.textContent = "日程側の試合詳細が見つかりません";
        }
        return;
      }
      const matchRow = event.target.closest(".pa-match-row[data-pa-match-id]");
      if (matchRow && playerAnalysisState.modalPlayer) {
        const matchId = String(matchRow.dataset.paMatchId || "");
        const item = (playerAnalysisState.modalMatchItems || []).find(entry => String(entry.match?.match_id || entry.appearance?.match_id || "") === matchId);
        if (!item) return;
        playerAnalysisState.modalView = "match-detail";
        setPlayerAnalysisModalContent(renderPlayerMatchDetail(
          playerAnalysisState.modalPlayer,
          playerAnalysisState.modalMatchYear,
          item,
          playerAnalysisState.modalMatchYearRow
        ));
        const modalPlayer = playerAnalysisState.modalPlayer;
        const modalYear = playerAnalysisState.modalMatchYear;
        const modalYearRow = playerAnalysisState.modalMatchYearRow;
        addAppHistoryEntry("pa-modal:match-detail", () => {
          playerAnalysisState.modalPlayer = modalPlayer;
          playerAnalysisState.modalView = "match-detail";
          playerAnalysisState.modalMatchYear = modalYear;
          playerAnalysisState.modalMatchYearRow = modalYearRow;
          playerAnalysisState.modalMatchItems = playerAnalysisState.modalMatchItems || [];
          setPlayerAnalysisModalContent(renderPlayerMatchDetail(modalPlayer, modalYear, item, modalYearRow));
        });
        return;
      }
      if (event.target.closest("[data-pa-match-log-back]") && playerAnalysisState.modalPlayer) {
        if (getActiveAppHistoryEntry()?.kind === "pa-modal:match-detail") {
          window.history.back();
        } else {
          playerAnalysisState.modalView = "match-list";
          setPlayerAnalysisModalContent(renderPlayerYearMatchList(
            playerAnalysisState.modalPlayer,
            playerAnalysisState.modalMatchYear,
            playerAnalysisState.modalMatchItems || [],
            playerAnalysisState.modalMatchYearRow
          ));
        }
        return;
      }
      if (event.target.closest("[data-pa-profile-back]") && playerAnalysisState.modalPlayer) {
        if (getActiveAppHistoryEntry()?.kind === "pa-modal:match-list") {
          window.history.back();
        } else {
          openPlayerAnalysisProfile(playerAnalysisState.modalPlayer, { resetCategories: false });
        }
      }
    };

    updatePlayerAnalysisSortIndicators();
    renderPlayerAnalysisDetailFilterModes();
    renderPlayerAnalysisAdvancedFilterRows();
    updatePlayerAnalysisCompactFilterControls(els);
    playerAnalysisState.initialized = true;
  }

  // --- View Management ---
  function ensureVisionFrame() {
    const frame = document.querySelector("#vision-view .vision-app-frame");
    if (frame && !frame.getAttribute("src")) {
      frame.setAttribute("src", frame.dataset.src);
    }
  }

  function switchMode(mode, options = {}) {
    const previousMode = currentMode;
    currentMode = mode;
    document.body.setAttribute("data-mode", mode);

    if (ultraDashboard) ultraDashboard.className = mode === "dashboard" ? "active-view" : "hidden-view";
    if (ultraFeed) ultraFeed.className = mode === "feed" ? "active-view" : "hidden-view";
    if (calendarView) calendarView.className = mode === "calendar" ? "active-view" : "hidden-view";
    if (playerAnalysisView) playerAnalysisView.className = mode === "player-analysis" ? "active-view" : "hidden-view";
    if (visionView) visionView.className = mode === "vision" ? "active-view" : "hidden-view";
    if (mode !== "player-analysis") setPlayerAnalysisFilterPanel(false);
    updatePlayerAnalysisScrollTopButton();

    if (mode === "calendar") {
      renderCalendar();
      updateYearTabState();
      rebuildMonthTabs();
    }
    if (mode === "dashboard") renderDashboard();
    if (mode === "player-analysis") {
      initializePlayerAnalysisView();
      renderPlayerAnalysisClubControl();
      if (!playerAnalysisState.loadedOnce) {
        renderPlayerAnalysisYear(playerAnalysisState.year);
      } else {
        renderPlayerAnalysisTable();
      }
      requestAnimationFrame(updatePlayerAnalysisScrollTopButton);
    }
    if (mode === "vision") ensureVisionFrame();
    if (mode === "feed") {
      if (renderedFeedYear !== selectedYear) renderFeed(selectedYear);
      requestAnimationFrame(() => {
        scrollToIndex(currentIndex);
        updateYearTabState();
        rebuildMonthTabs();
      });
    }
    if (hamBtn) hamBtn.innerHTML = mode === "vision" ? ellipsisIconHtml : hamburgerIconHtml;
    sideMenu.classList.remove("active");
    if (options.history !== false && (previousMode !== mode || getActiveAppHistoryEntry()?.kind === "side-menu")) {
      const activeScreen = playerAnalysisState.activeScreen;
      addAppHistoryEntry(`mode:${mode}`, () => {
        switchMode(mode, { history: false });
        if (mode === "player-analysis") setPlayerAnalysisScreen(activeScreen, { history: false });
      }, options);
    }
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

  function scrollActiveNavItem(container, selector) {
    if (!container) return;
    const centerActive = () => {
      const active = container.querySelector(selector);
      if (!active || !container.clientWidth) return;
      const left = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: "auto" });
    };
    requestAnimationFrame(centerActive);
    setTimeout(centerActive, 80);
    setTimeout(centerActive, 240);
  }

  function getAvailableYears() {
    return Array.from(new Set([
      ...getHistoryYears(),
      ...scheduleData.map(m => {
        if (!m || !m.date) return null;
        const d = parseDate(m.date);
        return Number.isNaN(d.getTime()) ? null : d.getFullYear();
      }).filter(Boolean)
    ]))
      .sort((a, b) => a - b);
  }

  function getVisibleYearWindow(year) {
    const years = getAvailableYears();
    if (!years.length) return [];
    const target = Number(year) || years[years.length - 1];
    let index = years.indexOf(target);
    if (index === -1) {
      index = years.findIndex(y => y > target);
      if (index === -1) index = years.length - 1;
    }
    const start = Math.max(0, Math.min(index - 1, years.length - 3));
    return years.slice(start, start + 3);
  }

  function updateYearTabState() {
    Object.keys(yearTabs).forEach(k => {
      if (yearTabs[k]) yearTabs[k].classList.toggle("active", Number(k) === selectedYear);
    });
    scrollActiveNavItem(yearTabContainer, ".year-tab.active");
  }

  function getMonthItemsForYear(year) {
    const monthMap = new Map();
    scheduleData.forEach(m => {
      if (!m || !m.date) return;
      const d = parseDate(m.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== Number(year)) return;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(ym)) {
        monthMap.set(ym, { ym, month: d.getMonth() + 1 });
      }
    });
    return Array.from(monthMap.values()).sort((a, b) => a.month - b.month);
  }

  function rebuildMonthTabs() {
    if (!navMonthTabs) return;
    navMonthTabs.innerHTML = "";
    visibleSections.forEach((sec, idx) => {
      const ym = sec.dataset.ym || "";
      const month = Number(ym.split("-")[1]);
      const btn = document.createElement("button");
      btn.className = "month-tab";
      btn.textContent = `${month}\u6708`;
      btn.classList.toggle("active", idx === currentIndex);
      btn.onclick = () => scrollToIndex(idx);
      navMonthTabs.appendChild(btn);
    });
    scrollActiveNavItem(navMonthTabs, ".month-tab.active");
  }

  function rebuildYearTabs() {
    if (!yearTabContainer) return;
    yearTabContainer.innerHTML = "";
    yearTabs = {};

    getAvailableYears().forEach(y => {
      const key = String(y);
      const btn = document.createElement("button");
      btn.id = `toggle-year-${key}`;
      btn.className = "year-tab";
      btn.textContent = key;
      btn.onclick = async () => {
        await applyYearFilter(Number(key));
      };
      yearTabContainer.appendChild(btn);
      yearTabs[key] = btn;
    });
    updateYearTabState();
  }

  function getCurrentMonthKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  }

  async function goToCurrentMonthAll() {
    const n = new Date();
    await applyYearFilter(n.getFullYear(), true);
    const idx = visibleSections.findIndex(s => s.dataset.ym === getCurrentMonthKey());
    scrollToIndex(idx !== -1 ? idx : 0);
  }

  async function shiftYear(delta) {
    const years = getAvailableYears();
    if (!years.length) return;
    let index = years.indexOf(Number(selectedYear));
    if (index === -1) {
      const now = new Date().getFullYear();
      index = years.indexOf(now);
      if (index === -1) index = years.length - 1;
    }
    const nextIndex = Math.max(0, Math.min(years.length - 1, index + delta));
    if (nextIndex !== index) await applyYearFilter(years[nextIndex]);
  }

  async function applyYearFilter(year, skipScroll = false) {
    const normalizedYear = year === null || year === undefined || year === "" ? null : Number(year);
    selectedYear = Number.isFinite(normalizedYear) && normalizedYear > 0 ? normalizedYear : null;
    const shouldLoadHistory = selectedYear && selectedYear <= HISTORY_END_YEAR;
    const shouldForceRender = shouldLoadHistory && !loadedHistoryYears.has(selectedYear);

    if (shouldLoadHistory) {
      feedSlider.innerHTML = `<div class="month-section" style="display:flex;align-items:center;justify-content:center;color:#888;font-weight:800;">${year} 読み込み中...</div>`;
      try {
        await ensureHistoryYearLoaded(selectedYear);
      } catch (error) {
        console.error(`history ${selectedYear} load failed`, error);
      }
    }
    if (renderedFeedYear !== selectedYear || shouldForceRender || !feedSlider.querySelector(".month-section[data-ym]")) {
      renderFeed(selectedYear);
    }

    updateYearTabState();

    allSections.forEach(sec => { sec.style.display = "flex"; });
    rebuildVisibleSections();
    if (!skipScroll) {
      currentIndex = 0;
      scrollToIndex(0);
    } else {
      rebuildMonthTabs();
    }
    if (currentMode === "calendar") renderCalendar();
    if (currentMode === "dashboard") renderDashboard();
    updateHeaderAnnouncements();
  }

  function scrollToIndex(idx) {
    if (!visibleSections[idx]) return;
    currentIndex = idx;
    if (activeMonthTitle) {
      activeMonthTitle.textContent = visibleSections[idx].dataset.ym_title || "";
    }
    rebuildMonthTabs();
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
      rebuildMonthTabs();
      if (currentMode === "calendar") renderCalendar();
    }
  }

  function updateClubVisibility() {
    const nOn = toggleNiigata.classList.contains("active");
    const kOn = toggleKumamoto.classList.contains("active");
    document.querySelectorAll(".card.club-niigata").forEach(c => c.style.display = nOn ? "flex" : "none");
    document.querySelectorAll(".card.club-kumamoto").forEach(c => c.style.display = kOn ? "flex" : "none");
    [document.getElementById("menu-vision"), document.getElementById("dash-to-vision")].forEach((control) => {
      if (!control) return;
      control.hidden = !nOn;
      control.setAttribute("aria-hidden", nOn ? "false" : "true");
    });
    if (!nOn && currentMode === "vision") switchMode("dashboard");
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

    const matchesInMonth = filterScheduleMatchesByCompetition(scheduleData.filter(m => {
      const md = parseDate(m.date);
      if (md.getFullYear() !== year || (md.getMonth() + 1) !== month) return false;
      if (m.club === "niigata" && !nOn) return false;
      if (m.club === "kumamoto" && !kOn) return false;
      return true;
    }));

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
        const isHome = getMatchIsHome(m);
        const emblemUrl = resolveEmblemUrl(m.opponent, m.emblem);
        const item = document.createElement("div");
        item.className = `cal-match-chip ${m.club} ${isHome ? 'home' : 'away'}`;
        item.innerHTML = `<span class="cal-ha">${isHome ? 'H' : 'A'}</span><img class="cal-emblem" src="${escapeHtml(emblemUrl)}" alt="${escapeHtml(m.opponent)}">`;
        matchContainer.appendChild(item);
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

  function openMatchPicker(matches, options = {}) {
    pickerList.innerHTML = matches.map(m => `
      <div class="picker-item" data-date="${m.date}" data-club="${m.club}" data-opp="${m.opponent}">
        <span class="picker-club ${m.club}">${m.club === 'niigata' ? '新潟' : '熊本'}</span>
        <span class="picker-opp">${m.opponent}</span>
      </div>
    `).join("");
    pickerOverlay.classList.add("active");
    pickerBackdrop.classList.add("active");
    addAppHistoryEntry("match-picker", () => openMatchPicker(matches, { history: false }), options);

    pickerList.querySelectorAll(".picker-item").forEach(item => {
      item.onclick = () => {
        const m = matches.find(x => x.date === item.dataset.date && x.club === item.dataset.club && x.opponent === item.dataset.opp);
        if (m) { closeMatchPicker({ history: false }); openDetailSheet(m); }
      };
    });
  }

  function closeMatchPicker(options = {}) {
    const closeDirect = () => {
      pickerOverlay.classList.remove("active");
      pickerBackdrop.classList.remove("active");
    };
    if (options.history === false) closeDirect();
    else closeAppHistoryEntry("match-picker", closeDirect);
  }

  function compactPlayerName(value) {
    return String(value || "").normalize("NFKC").replace(/[\s　・･.\-_]/g, "").toLowerCase();
  }

  function formatRecordValue(value, suffix = "") {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "number") return value.toLocaleString("ja-JP") + suffix;
    return escapeHtml(value) + suffix;
  }

  function getMemberName(member) {
    return typeof member === "string" ? member : (member && member.name) || "";
  }

  function renderPlayerButton(name, className = "") {
    if (!name) return "";
    return `<button type="button" class="u-player-link ${className}" data-player="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
  }

  function setupScrollablePlayerNames(root = sheetContent) {
    if (!root) return;
    requestAnimationFrame(() => {
      const targets = root.querySelectorAll(
        ".u-member-name .u-player-link, .u-member-name .u-member-static, .lineup-name .u-player-link, .lineup-name .u-member-static"
      );
      targets.forEach(element => {
        element.classList.remove("name-scroll");
        element.style.removeProperty("--name-scroll-distance");
        element.style.removeProperty("--name-scroll-duration");
        const overflow = element.scrollWidth > element.clientWidth + 2;
        if (!overflow) return;
        const distance = Math.ceil(element.scrollWidth - element.clientWidth + 16);
        const duration = Math.max(6, Math.min(12, distance / 10 + 6));
        element.style.setProperty("--name-scroll-distance", `${distance}px`);
        element.style.setProperty("--name-scroll-duration", `${duration}s`);
        element.classList.add("name-scroll");
      });
    });
  }

  function getMatchCompetitionText(match) {
    return [
      match && match.tournament,
      match && match.competition,
      match && match.league,
      match && match.details,
      match && match.stage,
      match && match.section,
      match && match.matchweek
    ].filter(Boolean).join(" ").normalize("NFKC");
  }

  function getScheduleCompetitionFilterName(match) {
    const text = getMatchCompetitionText(match);
    const year = Number(toIsoDate(match && match.date || "").slice(0, 4));
    const matchweek = String((match && match.matchweek) || "").normalize("NFKC").trim();
    if (/百年構想|100年構想/.test(text) || (year === 2026 && /^MW\s*\d+$/i.test(matchweek))) return "カップ";
    if (/カップ|ナビスコ|ルヴァン|天皇杯|スーパーカップ|ACL|YBC/i.test(text)) return "カップ";
    if (/^PO\s*\d+$/i.test(matchweek) || /昇格プレーオフ|J1参入プレーオフ|J1昇格|サテライト|エリート|SATELLITE|ELITE|プレシーズン|親善/i.test(text)) return "その他";
    if (/リーグ|ディビジョン|J1|J2|J3|Ｊ1|Ｊ2|Ｊ3/i.test(text)) return "リーグ";
    const detailHead = String((match && match.details) || "").normalize("NFKC").trim().split(/\s+/)[0] || "";
    if (/^(J1|J2|J3)$/i.test(detailHead)) return "リーグ";
    if (/^(LC|EC)$/i.test(detailHead)) return "カップ";
    return "その他";
  }

  function normalizeScheduleCompetitionFilter(names) {
    if (!Array.isArray(names)) return null;
    return Array.from(new Set(names.map(name => String(name || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja"));
  }

  function getActiveScheduleCompetitionFilter() {
    return scheduleCompetitionFilterState.active
      ? normalizeScheduleCompetitionFilter(scheduleCompetitionFilterState.selected) || []
      : null;
  }

  function renderScheduleCompetitionOptions(available = scheduleCompetitionFilterState.available) {
    if (!scheduleCompetitionOptions) return;
    const normalizedAvailable = SCHEDULE_COMPETITION_FILTER_OPTIONS.slice();
    scheduleCompetitionFilterState.available = normalizedAvailable;
    const activeFilter = getActiveScheduleCompetitionFilter();
    const selected = Array.isArray(activeFilter)
      ? activeFilter.filter(name => normalizedAvailable.includes(name))
      : normalizedAvailable.slice();
    if (scheduleCompetitionFilterState.active) scheduleCompetitionFilterState.selected = selected;
    const summary = scheduleCompetitionFilter && scheduleCompetitionFilter.querySelector("summary");
    if (summary) {
      summary.textContent = scheduleCompetitionFilterState.active
        ? `種別 ${selected.length}/${SCHEDULE_COMPETITION_FILTER_OPTIONS.length}`
        : "種別";
    }
    if (!normalizedAvailable.length) {
      scheduleCompetitionOptions.innerHTML = `<span class="schedule-competition-empty">大会データなし</span>`;
      return;
    }
    scheduleCompetitionOptions.innerHTML = normalizedAvailable.map(name => `
      <label class="schedule-competition-check">
        <input type="checkbox" value="${escapeHtml(name)}" ${selected.includes(name) ? "checked" : ""}>
        <span>${escapeHtml(name)}</span>
      </label>
    `).join("");
  }

  function rebuildScheduleCompetitionFilterOptions(matches) {
    const available = SCHEDULE_COMPETITION_FILTER_OPTIONS.slice();
    if (scheduleCompetitionFilterState.active) {
      scheduleCompetitionFilterState.selected = scheduleCompetitionFilterState.selected.filter(name => available.includes(name));
    } else {
      scheduleCompetitionFilterState.selected = available.slice();
    }
    renderScheduleCompetitionOptions(available);
  }

  function readScheduleCompetitionOptions() {
    if (!scheduleCompetitionOptions) return;
    scheduleCompetitionFilterState.active = true;
    scheduleCompetitionFilterState.selected = Array.from(scheduleCompetitionOptions.querySelectorAll("input[type='checkbox']:checked"))
      .map(input => input.value)
      .filter(Boolean);
    renderScheduleCompetitionOptions(scheduleCompetitionFilterState.available);
  }

  function filterScheduleMatchesByCompetition(matches) {
    const activeFilter = getActiveScheduleCompetitionFilter();
    if (!Array.isArray(activeFilter)) return matches;
    const selected = new Set(activeFilter);
    return (matches || []).filter(match => selected.has(getScheduleCompetitionFilterName(match)));
  }

  function refreshScheduleCompetitionFilteredViews() {
    readScheduleCompetitionOptions();
    renderedFeedYear = undefined;
    renderFeed(selectedYear);
    if (currentMode === "calendar") renderCalendar();
    if (currentMode === "feed") {
      currentIndex = Math.max(0, Math.min(currentIndex, visibleSections.length - 1));
      if (visibleSections.length) scrollToIndex(currentIndex);
      else rebuildMonthTabs();
    }
  }

  function getRoundDisplayClass(match, baseClass = "") {
    const text = getMatchCompetitionText(match);
    const year = Number(toIsoDate(match && match.date || "").slice(0, 4));
    const inferredHundredConcept = year === 2026 && /^MW\s*\d+$/i.test(String(match && match.matchweek || ""));
    const isPromotionPlayoff = /^PO\s*\d+$/i.test(String(match && match.matchweek || ""))
      || /昇格プレーオフ|プレーオフラウンド|プレイオフラウンド/i.test(text);
    const classes = [baseClass].filter(Boolean);
    if (!isPromotionPlayoff && (/百年構想|100年構想/.test(text) || inferredHundredConcept)) {
      classes.push("round-hundred");
    } else if (/ナビスコ|ルヴァン|YBC|Jリーグカップ|Ｊリーグカップ/i.test(text)) {
      classes.push("round-levain");
    } else if (/サテライト|エリート|SATELLITE|ELITE/i.test(text)) {
      classes.push("round-special");
    }
    return classes.join(" ");
  }

  function renderRoundPill(match, baseClass = "match-mw-pill") {
    const label = formatRoundDisplayLabel([
      match && match.matchweek,
      match && match.stage,
      match && match.section,
      match && match.round
    ], "EX");
    return `<span class="${escapeHtml(getRoundDisplayClass(match, baseClass))}">${escapeHtml(label)}</span>`;
  }

  function formatRoundDisplayLabel(values, fallback = "EX") {
    const candidates = Array.isArray(values) ? values : [values];
    for (const value of candidates) {
      if (value === undefined || value === null || value === "") continue;
      const raw = String(value).trim();
      if (!raw) continue;
      const normalized = raw
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim();
      const dayOnly = normalized.match(/^第?\s*(\d+)\s*日$/);
      if (dayOnly) return `DAY${dayOnly[1]}`;
      const clean = normalized
        .replace(/\s*第\s*\d+\s*日\s*/g, "")
        .trim();
      if (!clean) continue;
      if (/準々決勝|Quarter[-\s]?final/i.test(clean)) return "QF";
      if (/準決勝|Semi[-\s]?final/i.test(clean)) return "SF";
      if (/決勝|Final/i.test(clean)) return "FINAL";
      const mw = clean.match(/^MW\s*(\d+)$/i);
      if (mw) return `MW${mw[1]}`;
      const section = clean.match(/第?\s*(\d+)\s*節/);
      if (section) return `MW${section[1]}`;
      const round = clean.match(/第?\s*(\d+)\s*回戦/);
      if (round) return `R${round[1]}`;
      if (/^\d+$/.test(clean)) return `MW${clean}`;
      if (/^PO\s*\d+$/i.test(clean)) return clean.replace(/\s+/g, "").toUpperCase();
      if (!/^EX$/i.test(clean) && !/^MATCH$/i.test(clean)) {
        return clean || fallback;
      }
    }
    return fallback;
  }

  function renderOfficialInfo(match) {
    const refs = match.referees || {};
    const varAvar = splitOfficialNames(refs["VAR／AVAR"] || refs["VAR/AVAR"] || refs.var_avar);
    const assistantReferees = Array.isArray(match.assistant_referees)
      ? match.assistant_referees.join(" / ")
      : (match.assistant_referees || refs["副審"] || "");
    const temperature = match.temperature !== undefined && match.temperature !== null && match.temperature !== "" ? `${match.temperature}℃` : "";
    const humidity = match.humidity !== undefined && match.humidity !== null && match.humidity !== "" ? `${match.humidity}%` : "";
    const attendanceNumber = Number(String(match.attendance || "").replace(/,/g, ""));
    const attendance = match.attendance !== undefined && match.attendance !== null && match.attendance !== ""
      ? `${Number.isFinite(attendanceNumber) ? attendanceNumber.toLocaleString("ja-JP") : String(match.attendance)}人`
      : "";

    const conditionItems = [
      ["天候", match.weather],
      ["気温", temperature],
      ["湿度", humidity],
      ["入場者", attendance]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    const officialItems = [
      ["主審", match.referee || refs["主審"]],
      ["副審", assistantReferees],
      ["第4の審判員", match.fourth_official || refs["第4の審判員"]],
      ["VAR", match.var_referee || refs.VAR || varAvar[0]],
      ["AVAR", match.avar_referee || refs.AVAR || varAvar[1]]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    const groups = [
      ["CONDITION", conditionItems],
      ["OFFICIALS", officialItems]
    ].filter(([, items]) => items.length);

    if (!groups.length && !match.j_official_url) return "";

    return `
      <section class="match-facts-strip">
        <div class="match-facts-head">
          <h4>公式記録</h4>
          ${match.j_official_url ? `<a class="u-official-link" href="${escapeHtml(match.j_official_url)}" target="_blank" rel="noopener">J.LEAGUE DATA</a>` : ""}
        </div>
        <div class="match-facts-groups">
          ${groups.map(([groupLabel, items]) => `
            <div class="match-facts-group">
              <span class="match-facts-group-label">${escapeHtml(groupLabel)}</span>
              <div class="match-facts-row">
                ${items.map(([label, value]) => `
                  <div class="match-fact-item">
                    <span>${escapeHtml(label)}</span>
                    <strong>${formatRecordValue(value)}</strong>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderMemberList(title, members, type, clickable = true) {
    if (!Array.isArray(members) || !members.length) return "";
    const rows = members.map(member => {
      const name = getMemberName(member);
      const position = typeof member === "object" && member ? member.position : "";
      const number = typeof member === "object" && member ? member.number : "";
      const hasMeta = Boolean(number || position);
      const nameHtml = clickable
        ? renderPlayerButton(name)
        : `<span class="u-member-static">${escapeHtml(name)}</span>`;
      return `
        <li class="u-member-row ${type} ${hasMeta ? "" : "simple"}">
          ${hasMeta ? `
            <span class="u-member-meta">
              ${number ? `<span class="u-member-number">${escapeHtml(number)}</span>` : `<span class="u-member-number muted">-</span>`}
              ${position ? `<span class="u-member-position">${escapeHtml(position)}</span>` : ""}
            </span>
          ` : ""}
          <span class="u-member-name">${nameHtml}</span>
        </li>
      `;
    }).join("");
    return `
      <div class="u-member-block ${type}">
        <h5>${escapeHtml(title)}</h5>
        <ul>${rows}</ul>
      </div>
    `;
  }

  function renderMatchMembers(match) {
    const isOwnHome = getMatchIsHome(match);
    const sideData = {
      home: {
        label: "HOME",
        teamName: match.home || (isOwnHome ? getOwnJapaneseClubName(match.club) : match.opponent) || "",
        starters: match.home_starting_members || (isOwnHome ? match.starting_members : match.opponent_starting_members) || [],
        bench: match.home_bench_members || (isOwnHome ? match.bench_members : match.opponent_bench_members) || [],
        substitutions: match.home_substitutions || (isOwnHome ? match.substitutions : match.opponent_substitutions) || [],
        cards: match.home_cards || (isOwnHome ? match.warnings : match.opponent_cards) || [],
        goals: match.home_goals || (isOwnHome ? match.goals : match.opponent_goals) || [],
        manager: match.home_manager || (isOwnHome ? match.manager : match.opponent_manager) || "",
        own: isOwnHome
      },
      away: {
        label: "AWAY",
        teamName: match.away || (!isOwnHome ? getOwnJapaneseClubName(match.club) : match.opponent) || "",
        starters: match.away_starting_members || (!isOwnHome ? match.starting_members : match.opponent_starting_members) || [],
        bench: match.away_bench_members || (!isOwnHome ? match.bench_members : match.opponent_bench_members) || [],
        substitutions: match.away_substitutions || (!isOwnHome ? match.substitutions : match.opponent_substitutions) || [],
        cards: match.away_cards || (!isOwnHome ? match.warnings : match.opponent_cards) || [],
        goals: match.away_goals || (!isOwnHome ? match.goals : match.opponent_goals) || [],
        manager: match.away_manager || (!isOwnHome ? match.manager : match.opponent_manager) || "",
        own: !isOwnHome
      }
    };

    const makeEventMap = (side) => {
      const map = new Map();
      const add = (name, event) => {
        const key = compactPlayerName(name);
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
      };
      const minuteText = minute => {
        const clean = String(minute || "")
          .trim()
          .replace(/[’′']/g, "")
          .replace(/分/g, "")
          .replace(/\s+/g, "");
        return clean ? `${clean}'` : "";
      };
      (side.goals || []).forEach(goal => {
        add(goal.scorer, { type: "goal", minute: goal.minute, text: minuteText(goal.minute) });
      });
      (side.substitutions || []).forEach(sub => {
        add(sub.out, { type: "sub-out", minute: sub.minute, text: `${minuteText(sub.minute)}→${sub.in || ""}` });
        add(sub.in, { type: "sub-in", minute: sub.minute, text: `${minuteText(sub.minute)}←${sub.out || ""}` });
      });
      (side.cards || []).forEach(card => {
        add(card.player || card.name, { type: card.card === "red" ? "card-red" : "card-yellow", minute: card.minute || card.time, text: minuteText(card.minute || card.time) });
      });
      return map;
    };

    const renderEvents = (events) => {
      if (!events || !events.length) return "";
      return `
        <span class="lineup-events">
          ${events.map(event => event.type === "card-yellow" || event.type === "card-red"
            ? `<span class="lineup-event ${event.type}"><i></i>${escapeHtml(event.text)}</span>`
            : `<span class="lineup-event ${event.type}">${escapeHtml(event.text)}</span>`
          ).join(" ")}
        </span>
      `;
    };

    const renderPlayerRow = (member, events, clickable) => {
      const name = getMemberName(member);
      const position = typeof member === "object" && member ? member.position : "";
      const number = typeof member === "object" && member ? member.number : "";
      const nameLength = Array.from(String(name || "").replace(/\s+/g, "")).length;
      const nameClass = nameLength >= 10 ? " very-long" : nameLength >= 7 ? " long" : "";
      const nameHtml = clickable ? renderPlayerButton(name) : `<span class="u-member-static">${escapeHtml(name)}</span>`;
      return `
        <li class="lineup-player-row ${events && events.length ? "has-events" : ""}">
          <span class="lineup-pos">${escapeHtml(position || "-")}</span>
          <span class="lineup-num">${escapeHtml(number || "-")}</span>
          <span class="lineup-name${nameClass}">${nameHtml}</span>
          ${renderEvents(events)}
        </li>
      `;
    };

    const renderSide = (sideKey) => {
      const side = sideData[sideKey];
      const starters = Array.isArray(side.starters) ? side.starters : [];
      const bench = Array.isArray(side.bench) ? side.bench : [];
      if (!starters.length && !bench.length) return "";
      const eventMap = makeEventMap(side);
      const rows = (members) => members.map(member => {
        const events = eventMap.get(compactPlayerName(getMemberName(member))) || [];
        return renderPlayerRow(member, events, side.own);
      }).join("");
      return `
        <div class="lineup-team ${sideKey} ${side.own ? "own" : "opponent"}">
          ${starters.length ? `
            <div class="lineup-block">
              <h5>STARTING XI</h5>
              <ul class="lineup-list starters">${rows(starters)}</ul>
            </div>
          ` : ""}
          ${bench.length ? `
            <div class="lineup-block bench-block">
              <h5>BENCH</h5>
              <ul class="lineup-list bench">${rows(bench)}</ul>
              ${side.manager ? `<div class="lineup-manager-row"><span>監督</span><strong>${escapeHtml(side.manager)}</strong></div>` : ""}
            </div>
          ` : ""}
        </div>
      `;
    };

    const homeHtml = renderSide("home");
    const awayHtml = renderSide("away");
    if (!homeHtml && !awayHtml) return "";

    return `
      <section class="lineup-summary ${lineupDetailExpanded ? "show-events" : ""}">
        <div class="lineup-summary-head">
          <h4>LINEUPS</h4>
          <button type="button" class="lineup-detail-toggle" aria-pressed="${lineupDetailExpanded ? "true" : "false"}">
            詳細 ${lineupDetailExpanded ? "ON" : "OFF"}
          </button>
        </div>
        <div class="lineup-grid">
          ${homeHtml}
          ${awayHtml}
        </div>
      </section>
    `;
  }

  function renderMatchEvents(match) {
    const substitutions = Array.isArray(match.substitutions) ? match.substitutions : [];
    const warnings = Array.isArray(match.warnings) ? match.warnings : [];
    if (!substitutions.length && !warnings.length) return "";

    const subHtml = substitutions.length ? `
      <div class="u-event-block">
        <h5>交代</h5>
        <ul>
          ${substitutions.map(sub => `
            <li>
              <span class="u-event-minute">${escapeHtml(sub.minute || "")}'</span>
              <span class="u-sub-out">${renderPlayerButton(sub.out)}</span>
              <span class="u-sub-arrow">→</span>
              <span class="u-sub-in">${renderPlayerButton(sub.in)}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    ` : "";

    const warnHtml = warnings.length ? `
      <div class="u-event-block">
        <h5>警告</h5>
        <ul>
          ${warnings.map(warn => `
            <li>
              <span class="u-event-minute">${escapeHtml(warn.minute || "")}'</span>
              ${renderPlayerButton(warn.player)}
            </li>
          `).join("")}
        </ul>
      </div>
    ` : "";

    return `
      <section class="u-match-events">
        <h4>試合イベント</h4>
        ${subHtml}
        ${warnHtml}
      </section>
    `;
  }

  function getPlayerRoleForMatch(match, playerKey) {
    const starters = Array.isArray(match.starting_members) ? match.starting_members : [];
    const bench = Array.isArray(match.bench_members) ? match.bench_members : [];
    const subs = Array.isArray(match.substitutions) ? match.substitutions : [];
    const starter = starters.find(member => compactPlayerName(getMemberName(member)) === playerKey);
    const benchMember = bench.find(member => compactPlayerName(getMemberName(member)) === playerKey);
    const subIn = subs.find(sub => compactPlayerName(sub.in) === playerKey);
    const subOut = subs.find(sub => compactPlayerName(sub.out) === playerKey);

    if (starter) {
      return {
        appeared: true,
        squad: true,
        role: "先発" + (subOut ? ` (${subOut.minute}' OUT)` : ""),
        number: starter.number || "",
        position: starter.position || "",
        name: getMemberName(starter)
      };
    }

    if (subIn) {
      return {
        appeared: true,
        squad: true,
        role: `${subIn.minute}' IN`,
        number: "",
        position: "",
        name: subIn.in || ""
      };
    }

    if (benchMember) {
      return { appeared: false, squad: true, role: "ベンチ", number: "", position: "", name: getMemberName(benchMember) };
    }

    return { appeared: false, squad: false, role: "", number: "", position: "", name: "" };
  }

  function getPlayerGoals(playerName, club = playerAnalysisState.selectedClub) {
    const ownClub = getPlayerAnalysisClub(club);
    const playerKey = compactPlayerName(playerName);
    const goals = [];

    getResultArray(officialResults).forEach(result => {
      if (result.club && result.club !== ownClub) return;
      (result.goals || []).forEach(goal => {
        if (compactPlayerName(goal.scorer) !== playerKey) return;
        const match = scheduleData.find(m => {
          return m.club === ownClub &&
            m.date === result.date &&
            (!result.opponent || robustTeamMatch(m.opponent, result.opponent));
        });
        goals.push({ result, goal, match });
      });
    });

    return goals.sort((a, b) => parseDate(a.result.date) - parseDate(b.result.date));
  }

  function buildPlayerProfile(playerName, club = playerAnalysisState.selectedClub) {
    const ownClub = getPlayerAnalysisClub(club);
    const playerKey = compactPlayerName(playerName);
    const squadMatches = [];
    const appearances = [];
    const numbers = new Set();
    const positions = new Set();
    let displayName = playerName;

    scheduleData
      .filter(match => match.club === ownClub)
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
      .forEach(match => {
        const role = getPlayerRoleForMatch(match, playerKey);
        if (!role.squad) return;

        if (role.name) displayName = role.name;
        if (role.number) numbers.add(String(role.number));
        if (role.position) positions.add(role.position);

        const row = { match, role };
        squadMatches.push(row);
        if (role.appeared) appearances.push(row);
      });

    const goals = getPlayerGoals(playerName, ownClub);
    return { playerName: displayName, numbers, positions, squadMatches, appearances, goals };
  }

  function renderPlayerMatchRow(item) {
    const match = item.match;
    const result = findOfficialResult(match);
    const score = match.score || (result && result.score) || "";
    const scoreText = score ? `<span class="u-player-match-score">${escapeHtml(score)}</span>` : "";
    return `
      <li class="u-player-match-row">
        <div>
          <strong>${escapeHtml(match.date)}</strong>
          <span>${escapeHtml(formatRoundDisplayLabel([match.stage, match.matchweek], ""))} ${getMatchIsHome(match) ? "HOME" : "AWAY"}</span>
          <span>vs ${escapeHtml(match.opponent)}</span>
        </div>
        <div>
          ${scoreText}
          <span class="u-player-role">${escapeHtml(item.role.role)}</span>
        </div>
      </li>
    `;
  }

  function openPlayerSheet(playerName, sourceMatch) {
    const club = sourceMatch && sourceMatch.club ? sourceMatch.club : playerAnalysisState.selectedClub;
    const profile = buildPlayerProfile(playerName, club);
    const clubInfo = getPlayerAnalysisClubInfo(club);
    const numbers = Array.from(profile.numbers).join(" / ") || "未記録";
    const positions = Array.from(profile.positions).join(" / ") || "未記録";

    const appearanceHtml = profile.appearances.length
      ? profile.appearances.map(renderPlayerMatchRow).join("")
      : `<li class="u-empty-row">出場試合はJSON内では見つかりませんでした。</li>`;

    const goalHtml = profile.goals.length
      ? profile.goals.map(item => {
        const match = item.match;
        const opponent = match ? match.opponent : item.result.opponent || "";
        const score = match ? (match.score || item.result.score || "") : item.result.score || "";
        return `
          <li class="u-player-match-row">
            <div>
              <strong>${escapeHtml(item.result.date)}</strong>
              <span>vs ${escapeHtml(opponent)}</span>
            </div>
            <div>
              ${score ? `<span class="u-player-match-score">${escapeHtml(score)}</span>` : ""}
              <span class="u-player-role">${escapeHtml(item.goal.minute || "")}' GOAL</span>
            </div>
          </li>
        `;
      }).join("")
      : `<li class="u-empty-row">得点した試合は見つかりませんでした。</li>`;

    sheetContent.innerHTML = `
      <section class="u-player-profile">
        ${renderPlayerPhoto(profile.playerName, club, "u-player-photo")}
        ${renderPlayerChantAudioSlot(profile.playerName)}
        <button type="button" class="u-player-back">← 試合詳細へ戻る</button>
        <div class="u-player-header">
          <span>${escapeHtml(clubInfo.englishName)}</span>
          <h2>${escapeHtml(profile.playerName)}</h2>
        </div>
        <div class="u-player-stats">
          <div><span>背番号</span><strong>${escapeHtml(numbers)}</strong></div>
          <div><span>ポジション</span><strong>${escapeHtml(positions)}</strong></div>
          <div><span>出場</span><strong>${profile.appearances.length}</strong></div>
          <div><span>得点</span><strong>${profile.goals.length}</strong></div>
          <div><span>メンバー入り</span><strong>${profile.squadMatches.length}</strong></div>
        </div>
        <div class="u-player-section">
          <h4>出場試合</h4>
          <ul>${appearanceHtml}</ul>
        </div>
        <div class="u-player-section">
          <h4>得点した試合</h4>
          <ul>${goalHtml}</ul>
        </div>
        <button class="close-sheet-btn">閉じる</button>
      </section>
    `;

    setupPlayerPhotos(sheetContent);
    setupPlayerChantAudio(sheetContent);
    const backBtn = sheetContent.querySelector(".u-player-back");
    if (backBtn && sourceMatch) backBtn.onclick = () => openDetailSheet(sourceMatch);
    sheetContent.querySelector(".close-sheet-btn").onclick = () => closeDetailSheet();
  }

  function findPlayerAnalysisRowByIdentity(rows, playerName, year) {
    const identity = getPlayerCanonicalIdentity({ player_name: playerName, player_key: playerName, season: year }, year);
    const targetKey = String(identity.groupKey || "").trim();
    return (rows || []).find(row => {
      if (targetKey && getPlayerGroupKey(row) === targetKey) return true;
      const rowIdentity = getPlayerCanonicalIdentity(row, getPlayerYearValue(row) || year);
      return targetKey && rowIdentity.groupKey === targetKey;
    }) || null;
  }

  async function openPlayerAnalysisProfileFromSchedule(playerName, sourceMatch) {
    if (!playerName || !sourceMatch || !PLAYER_ANALYSIS_CLUBS[sourceMatch.club]) return false;
    const sourceNavigationId = activeAppHistoryId;
    initializePlayerAnalysisView();
    const sourceClub = getPlayerAnalysisClub(sourceMatch.club);
    const matchYear = Number(toIsoDate(sourceMatch.date || "").slice(0, 4));
    const rawTargetYear = Number.isInteger(matchYear) && matchYear > 0 ? matchYear : playerAnalysisState.year;
    const targetYear = normalizePlayerAnalysisYearForClub(rawTargetYear, sourceClub);
    playerAnalysisState.selectedClub = sourceClub;
    playerAnalysisState.matchScope = "all";
    playerAnalysisState.competitionFilterActive = false;
    playerAnalysisState.selectedCompetitions = [];
    playerAnalysisState.year = targetYear;
    playerAnalysisState.profileTab = "profile";
    renderPlayerAnalysisClubControl();
    renderPlayerAnalysisYears();

    const scheduleModalScope = getPlayerAnalysisCategoryScope(["league", "cup", "special"]);
    let entry = await loadScopedPlayerAnalysisYear(targetYear, scheduleModalScope, null);
    let player = findPlayerAnalysisRowByIdentity(entry.rows, playerName, targetYear);
    if (!player) {
      const allRowsEntry = await loadAllPlayerAnalysisYearRows(sourceClub);
      const matchingRows = (allRowsEntry.rows || []).filter(row => {
        const identity = getPlayerCanonicalIdentity({ player_name: playerName, player_key: playerName, season: targetYear }, targetYear);
        return getPlayerGroupKey(row) === identity.groupKey;
      });
      player = aggregatePlayerAnalysisRows(matchingRows)[0] || findPlayerAnalysisRowByIdentity(allRowsEntry.rows, playerName, targetYear);
    }
    if (!player) {
      player = buildScheduleFallbackPlayerAnalysisRow(playerName, sourceClub);
    }
    if (activeAppHistoryId !== sourceNavigationId) return false;
    openPlayerAnalysisProfile(player);
    return true;
  }

  function buildScheduleFallbackPlayerAnalysisRow(playerName, club = playerAnalysisState.selectedClub) {
    const profile = buildPlayerProfile(playerName, club);
    const appearances = profile.appearances || [];
    const starters = appearances.filter(item => String(item.role && item.role.role || "").includes("先発")).length;
    const subs = Math.max(0, appearances.length - starters);
    const identity = getPlayerCanonicalIdentity({ player_name: profile.playerName || playerName, player_key: playerName, season: playerAnalysisState.year }, playerAnalysisState.year);
    const row = {
      season: playerAnalysisState.year,
      player_key: identity.key || playerName,
      player_name: identity.name || profile.playerName || playerName,
      numbers: Array.from(profile.numbers || []),
      positions: sortPlayerPositions(Array.from(profile.positions || [])),
      played_matches: appearances.length,
      played_wins: 0,
      played_draws: 0,
      played_losses: 0,
      played_win_rate: null,
      played_points_per_match: null,
      starter_matches: starters,
      starter_wins: 0,
      starter_draws: 0,
      starter_losses: 0,
      starter_win_rate: null,
      starter_points_per_match: null,
      sub_matches: subs,
      sub_wins: 0,
      sub_draws: 0,
      sub_losses: 0,
      sub_win_rate: null,
      sub_points_per_match: null,
      bench_only_matches: Math.max(0, (profile.squadMatches || []).length - appearances.length),
      goals: (profile.goals || []).length,
      scored_matches: new Set((profile.goals || []).map(item => item.result && item.result.date).filter(Boolean)).size,
      scored_wins: 0,
      scored_draws: 0,
      scored_losses: 0,
      scored_win_rate: null,
      scored_points_per_match: null,
      yellow_cards: 0,
      red_cards: 0,
      __paIndex: 0,
      __paGroupKey: identity.groupKey
    };
    row.__paKey = `schedule-${row.__paGroupKey || compactPlayerName(playerName)}`;
    return row;
  }

  function bindPlayerLinks(sourceMatch) {
    sheetContent.querySelectorAll(".u-player-link").forEach(btn => {
      btn.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await openPlayerAnalysisProfileFromSchedule(btn.dataset.player, sourceMatch);
      };
    });
    setupScrollablePlayerNames(sheetContent);
  }

  function bindLineupDetailToggle() {
    const toggle = sheetContent.querySelector(".lineup-detail-toggle");
    if (!toggle) return;
    const summary = toggle.closest(".lineup-summary");
    const update = () => {
      if (summary) summary.classList.toggle("show-events", lineupDetailExpanded);
      toggle.setAttribute("aria-pressed", lineupDetailExpanded ? "true" : "false");
      toggle.textContent = `詳細 ${lineupDetailExpanded ? "ON" : "OFF"}`;
    };
    update();
    toggle.onclick = () => {
      lineupDetailExpanded = !lineupDetailExpanded;
      update();
      setupScrollablePlayerNames(sheetContent);
    };
  }

  function getOwnJapaneseClubName(club) {
    if (club === "niigata") return "アルビレックス新潟";
    if (club === "kumamoto") return "ロアッソ熊本";
    return club || "";
  }

  function getDetailMatchData(match) {
    const official = findOfficialResult(match);
    return official ? { ...match, ...official } : match;
  }

  function getHomeAwayDisplay(match, fallbackOwnScore = "", fallbackOpponentScore = "") {
    const isOwnHome = getMatchIsHome(match);
    const ownName = getOwnJapaneseClubName(match.club);
    let homeName = match.home || (isOwnHome ? ownName : match.opponent);
    let awayName = match.away || (isOwnHome ? match.opponent : ownName);
    const opponentName = match.opponent || "";

    if (robustTeamMatch(homeName, ownName)) homeName = ownName;
    if (robustTeamMatch(awayName, ownName)) awayName = ownName;
    if (opponentName && robustTeamMatch(homeName, opponentName)) homeName = opponentName;
    if (opponentName && robustTeamMatch(awayName, opponentName)) awayName = opponentName;
    let homeScore = match.home_score !== undefined && match.home_score !== null ? String(match.home_score) : "";
    let awayScore = match.away_score !== undefined && match.away_score !== null ? String(match.away_score) : "";

    if ((!homeScore || !awayScore) && match.score) {
      const scores = String(match.score).split("-").map(value => value.trim());
      if (scores.length === 2) {
        if (isOwnHome) {
          homeScore = scores[0];
          awayScore = scores[1];
        } else {
          homeScore = scores[1];
          awayScore = scores[0];
        }
      }
    }

    if ((!homeScore || !awayScore) && fallbackOwnScore !== "" && fallbackOpponentScore !== "") {
      if (isOwnHome) {
        homeScore = fallbackOwnScore;
        awayScore = fallbackOpponentScore;
      } else {
        homeScore = fallbackOpponentScore;
        awayScore = fallbackOwnScore;
      }
    }

    return {
      homeName,
      awayName,
      homeScore: homeScore || "-",
      awayScore: awayScore || "-",
      homeEmblem: robustTeamMatch(homeName, ownName) ? (match.club === "niigata" ? "./data/assets/emblems/アルビレックス新潟.png" : "./data/assets/emblems/ロアッソ熊本.png") : resolveEmblemUrl(homeName, ""),
      awayEmblem: robustTeamMatch(awayName, ownName) ? (match.club === "niigata" ? "./data/assets/emblems/アルビレックス新潟.png" : "./data/assets/emblems/ロアッソ熊本.png") : resolveEmblemUrl(awayName, "")
    };
  }

  function getLineupPair(match) {
    const isOwnHome = getMatchIsHome(match);
    return {
      home: isOwnHome
        ? (match.starting_members || match.home_starting_members || [])
        : (match.opponent_starting_members || match.home_starting_members || []),
      away: isOwnHome
        ? (match.opponent_starting_members || match.away_starting_members || [])
        : (match.starting_members || match.away_starting_members || [])
    };
  }

  function getBenchPair(match) {
    const isOwnHome = getMatchIsHome(match);
    return {
      home: isOwnHome
        ? (match.bench_members || match.home_bench_members || [])
        : (match.opponent_bench_members || match.home_bench_members || []),
      away: isOwnHome
        ? (match.opponent_bench_members || match.away_bench_members || [])
        : (match.bench_members || match.away_bench_members || [])
    };
  }

  function formatVisionJapaneseRoundValue(value) {
    if (value === undefined || value === null || value === "") return "";
    const normalized = String(value)
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized || /^EX$/i.test(normalized) || /^MATCH$/i.test(normalized)) return "";
    const clean = normalized
      .replace(/\s*第\s*\d+\s*日\s*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return "";

    const playoffRound = clean.match(/(?:プレーオフラウンド|プレイオフラウンド)\s*第?\s*(\d+)\s*戦/i);
    if (playoffRound) return `プレーオフラウンド第${playoffRound[1]}戦`;
    const playoffCode = clean.match(/^PO\s*(\d+)$/i);
    if (playoffCode) return `プレーオフラウンド第${playoffCode[1]}戦`;
    const promotionPlayoff = clean.match(/(?:昇格プレーオフ|J1参入プレーオフ|J1昇格プレーオフ).*?第?\s*(\d+)\s*戦/i);
    if (promotionPlayoff) return `昇格プレーオフ第${promotionPlayoff[1]}戦`;

    const matchweek = clean.match(/^MW\s*(\d+)$/i);
    if (matchweek) return `第${matchweek[1]}節`;
    const section = clean.match(/第?\s*(\d+)\s*節/);
    if (section) return `第${section[1]}節`;
    const cupRound = clean.match(/第?\s*(\d+)\s*回戦/);
    if (cupRound) return `第${cupRound[1]}回戦`;
    const knockoutLeg = clean.match(/(準々決勝|準決勝|決勝)\s*第?\s*(\d+)\s*戦/);
    if (knockoutLeg) return `${knockoutLeg[1]}第${knockoutLeg[2]}戦`;
    if (/準々決勝/.test(clean)) return "準々決勝";
    if (/準決勝/.test(clean)) return "準決勝";
    if (/決勝/.test(clean)) return "決勝";
    if (/^\d+$/.test(clean)) return `第${clean}節`;

    return clean.replace(/\s+/g, "");
  }

  function formatVisionRoundLabel(match) {
    const candidates = [
      match && match.matchweek,
      match && match.stage,
      match && match.section,
      match && match.round,
      match && match.tournament,
      match && match.competition
    ];
    for (const value of candidates) {
      const label = formatVisionJapaneseRoundValue(value);
      if (label) return label;
    }
    return "特別試合";
  }

  function splitVisionPlayerName(name) {
    const clean = String(name || "").normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!clean) return { family: "", given: "", half: false };
    if (/^舞行龍\s*ジェームズ$/.test(clean)) {
      return { family: "舞行龍", given: "ジェームズ", half: true };
    }
    const parts = clean.split(" ");
    const family = parts.shift() || "";
    const given = parts.join(" ");
    const kanaOnly = /^[ァ-ヶーA-Za-z0-9・.\-\s]+$/.test(clean);
    return { family, given, half: kanaOnly && clean.length > 4 };
  }

  function mapVisionPlayer(member) {
    const parsed = splitVisionPlayerName(getMemberName(member));
    return {
      pos: String(member && member.position || ""),
      no: String(member && member.number || ""),
      family: parsed.family,
      given: parsed.given,
      half: parsed.half,
      yellow: Boolean(member && member.yellow)
    };
  }

  function fillVisionPlayers(players, count) {
    const list = (Array.isArray(players) ? players : []).slice(0, count).map(mapVisionPlayer);
    while (list.length < count) {
      list.push({ pos: "", no: "", family: "", given: "", half: false, yellow: false });
    }
    return list;
  }

  function cloneVisionMember(member) {
    if (!member) return { position: "", number: "", name: "" };
    if (typeof member === "string") return { position: "", number: "", name: member };
    return {
      position: member.position || "",
      number: member.number || "",
      name: getMemberName(member),
      yellow: Boolean(member.yellow)
    };
  }

  function findVisionMemberByName(members, name) {
    const key = compactPlayerName(name);
    if (!key) return null;
    return (Array.isArray(members) ? members : []).find(member => compactPlayerName(getMemberName(member)) === key) || null;
  }

  function normalizeVisionCard(card) {
    return {
      player: card && (card.player || card.name) || "",
      card: String(card && (card.card || card.type) || "").includes("退場") || String(card && card.card || "").toLowerCase() === "red" ? "red" : "yellow"
    };
  }

  function applyVisionCards(members, cards) {
    const normalizedCards = (Array.isArray(cards) ? cards : []).map(normalizeVisionCard);
    const redKeys = new Set(normalizedCards.filter(card => card.card === "red").map(card => compactPlayerName(card.player)).filter(Boolean));
    const yellowKeys = new Set(normalizedCards.filter(card => card.card !== "red").map(card => compactPlayerName(card.player)).filter(Boolean));
    return members.map(member => {
      const key = compactPlayerName(getMemberName(member));
      if (redKeys.has(key)) return { position: "", number: "", name: "" };
      return { ...member, yellow: yellowKeys.has(key) || Boolean(member.yellow) };
    });
  }

  function buildVisionFinalMembers(starters, bench, substitutions, cards) {
    const finalMembers = (Array.isArray(starters) ? starters : []).map(cloneVisionMember);
    (Array.isArray(substitutions) ? substitutions : []).forEach(sub => {
      const outName = sub && (sub.out || sub.outName);
      const inName = sub && (sub.in || sub.inName);
      const outKey = compactPlayerName(outName);
      if (!outKey) return;
      const outIndex = finalMembers.findIndex(member => compactPlayerName(getMemberName(member)) === outKey);
      if (outIndex === -1) return;
      const incoming = findVisionMemberByName(bench, inName) || { position: "", number: "", name: inName || "" };
      finalMembers[outIndex] = cloneVisionMember(incoming);
    });
    return applyVisionCards(finalMembers, cards);
  }

  function getVisionSideSource(match, sideKey) {
    const isOwnHome = getMatchIsHome(match);
    if (sideKey === "home") {
      return {
        starters: match.home_starting_members || (isOwnHome ? match.starting_members : match.opponent_starting_members) || [],
        bench: match.home_bench_members || (isOwnHome ? match.bench_members : match.opponent_bench_members) || [],
        substitutions: match.home_substitutions || (isOwnHome ? match.substitutions : match.opponent_substitutions) || [],
        cards: match.home_cards || (isOwnHome ? match.warnings : match.opponent_cards) || [],
        goals: match.home_goals || (isOwnHome ? match.goals : match.opponent_goals) || []
      };
    }
    return {
      starters: match.away_starting_members || (!isOwnHome ? match.starting_members : match.opponent_starting_members) || [],
      bench: match.away_bench_members || (!isOwnHome ? match.bench_members : match.opponent_bench_members) || [],
      substitutions: match.away_substitutions || (!isOwnHome ? match.substitutions : match.opponent_substitutions) || [],
      cards: match.away_cards || (!isOwnHome ? match.warnings : match.opponent_cards) || [],
      goals: match.away_goals || (!isOwnHome ? match.goals : match.opponent_goals) || []
    };
  }

  function countVisionGoals(goals) {
    const counts = { first: 0, second: 0 };
    (Array.isArray(goals) ? goals : []).forEach(goal => {
      const minute = Number.parseInt(String(goal.minute || goal.time || "").replace(/\D.*$/, ""), 10);
      if (!Number.isFinite(minute)) return;
      if (minute <= 45) counts.first += 1;
      else counts.second += 1;
    });
    return counts;
  }

  function getVisionScores(match, phase, scoreBoard) {
    if (phase === "pre") {
      return { firstHome: "", firstAway: "", secondHome: "", secondAway: "", totalHome: "", totalAway: "" };
    }

    const isOwnHome = getMatchIsHome(match);
    const ownGoals = countVisionGoals(match.goals);
    const opponentGoals = countVisionGoals(match.opponent_goals);
    const homeGoalCounts = isOwnHome ? ownGoals : opponentGoals;
    const awayGoalCounts = isOwnHome ? opponentGoals : ownGoals;

    return {
      firstHome: String(homeGoalCounts.first),
      firstAway: String(awayGoalCounts.first),
      secondHome: String(homeGoalCounts.second),
      secondAway: String(awayGoalCounts.second),
      totalHome: scoreBoard.homeScore === "-" ? "" : String(scoreBoard.homeScore),
      totalAway: scoreBoard.awayScore === "-" ? "" : String(scoreBoard.awayScore)
    };
  }

  function getVisionLeagueLogo(match) {
    const year = parseDate(match.date).getFullYear();
    const text = `${match.tournament || ""} ${match.competition || ""} ${match.league || ""}`;
    if (year === 2026 || /百年構想/.test(text)) return "../data/assets/icons/100l.png?v=20260601assets1";
    if (/J1|Ｊ１/.test(text)) return "../data/assets/icons/j1.png?v=20260601assets1";
    if (/J2|Ｊ２/.test(text)) return "../data/assets/icons/j2.png?v=20260601assets1";
    return "../data/assets/icons/100l.png?v=20260601assets1";
  }

  function normalizeVisionClubName(name) {
    return String(name || "")
      .normalize("NFKC")
      .replace(/[\s・.．\-ー]/g, "")
      .toUpperCase();
  }

  const VISION_CLUB_COLOR_LIST = [
    ["北海道コンサドーレ札幌", "#d6001c"], ["札幌", "#d6001c"],
    ["ヴァンラーレ八戸", "#0f8a4b"], ["八戸", "#0f8a4b"],
    ["いわてグルージャ盛岡", "#d71920"], ["岩手", "#d71920"], ["盛岡", "#d71920"],
    ["ベガルタ仙台", "#f5d000"], ["仙台", "#f5d000"],
    ["ブラウブリッツ秋田", "#004098"], ["秋田", "#004098"],
    ["モンテディオ山形", "#0068b7"], ["山形", "#0068b7"],
    ["福島ユナイテッドFC", "#e60012"], ["福島", "#e60012"],
    ["いわきFC", "#d6001c"], ["いわき", "#d6001c"],
    ["鹿島アントラーズ", "#b51e3a"], ["鹿島", "#b51e3a"],
    ["水戸ホーリーホック", "#005bac"], ["水戸", "#005bac"],
    ["栃木SC", "#ffd900"], ["栃木", "#ffd900"], ["栃木C", "#e60012"],
    ["ザスパ群馬", "#003f8f"], ["群馬", "#003f8f"],
    ["浦和レッズ", "#e60012"], ["浦和", "#e60012"],
    ["RB大宮アルディージャ", "#f58220"], ["大宮アルディージャ", "#f58220"], ["大宮", "#f58220"],
    ["ジェフユナイテッド千葉", "#ffd800"], ["千葉", "#ffd800"],
    ["柏レイソル", "#fff100"], ["柏", "#fff100"],
    ["FC東京", "#003f8f"], ["東京", "#003f8f"],
    ["東京ヴェルディ", "#00843d"], ["東京V", "#00843d"],
    ["FC町田ゼルビア", "#005bac"], ["町田", "#005bac"],
    ["川崎フロンターレ", "#00a0e9"], ["川崎F", "#00a0e9"], ["川崎", "#00a0e9"],
    ["横浜F・マリノス", "#005bac"], ["横浜FM", "#005bac"],
    ["横浜FC", "#00a3e0"],
    ["湘南ベルマーレ", "#7ab800"], ["湘南", "#7ab800"],
    ["SC相模原", "#00a650"], ["相模原", "#00a650"],
    ["ヴァンフォーレ甲府", "#005bac"], ["甲府", "#005bac"],
    ["松本山雅FC", "#00843d"], ["松本", "#00843d"],
    ["AC長野パルセイロ", "#f58220"], ["長野", "#f58220"],
    ["アルビレックス新潟", "#ff6600"], ["新潟", "#ff6600"],
    ["カターレ富山", "#005bac"], ["富山", "#005bac"],
    ["ツエーゲン金沢", "#e60012"], ["金沢", "#e60012"],
    ["清水エスパルス", "#f58220"], ["清水", "#f58220"],
    ["ジュビロ磐田", "#62b5e5"], ["磐田", "#62b5e5"],
    ["藤枝MYFC", "#6f2da8"], ["藤枝", "#6f2da8"],
    ["アスルクラロ沼津", "#00a0e9"], ["沼津", "#00a0e9"],
    ["名古屋グランパス", "#e60012"], ["名古屋", "#e60012"],
    ["FC岐阜", "#005bac"], ["岐阜", "#005bac"],
    ["京都サンガF.C.", "#6f2da8"], ["京都", "#6f2da8"],
    ["ガンバ大阪", "#005bac"], ["G大阪", "#005bac"],
    ["セレッソ大阪", "#e91e63"], ["C大阪", "#e91e63"],
    ["FC大阪", "#005bac"],
    ["ヴィッセル神戸", "#a50034"], ["神戸", "#a50034"],
    ["奈良クラブ", "#003f8f"], ["奈良", "#003f8f"],
    ["ガイナーレ鳥取", "#78be20"], ["鳥取", "#78be20"],
    ["ファジアーノ岡山", "#b00020"], ["岡山", "#b00020"],
    ["サンフレッチェ広島", "#51318f"], ["広島", "#51318f"],
    ["レノファ山口FC", "#f58220"], ["山口", "#f58220"],
    ["カマタマーレ讃岐", "#77bc1f"], ["讃岐", "#77bc1f"],
    ["徳島ヴォルティス", "#004098"], ["徳島", "#004098"],
    ["愛媛FC", "#f58220"], ["愛媛", "#f58220"],
    ["FC今治", "#003f8f"], ["今治", "#003f8f"],
    ["アビスパ福岡", "#003f8f"], ["福岡", "#003f8f"],
    ["ギラヴァンツ北九州", "#f5d000"], ["北九州", "#f5d000"],
    ["サガン鳥栖", "#00a0e9"], ["鳥栖", "#00a0e9"],
    ["V・ファーレン長崎", "#f58220"], ["長崎", "#f58220"],
    ["ロアッソ熊本", "#cc0000"], ["熊本", "#cc0000"],
    ["大分トリニータ", "#005bac"], ["大分", "#005bac"],
    ["テゲバジャーロ宮崎", "#e60012"], ["宮崎", "#e60012"],
    ["鹿児島ユナイテッドFC", "#005bac"], ["鹿児島", "#005bac"],
    ["FC琉球", "#8a1538"], ["琉球", "#8a1538"],
    ["高知ユナイテッドSC", "#b51e3a"], ["高知", "#b51e3a"],
    ["レイラック滋賀FC", "#005bac"], ["レイラック滋賀", "#005bac"], ["滋賀", "#005bac"]
  ];

  const VISION_CLUB_COLOR_MAP = VISION_CLUB_COLOR_LIST.reduce((map, [name, color]) => {
    map.set(normalizeVisionClubName(name), color);
    return map;
  }, new Map());

  function getVisionClubColor(name, fallback) {
    const key = normalizeVisionClubName(name);
    if (!key) return fallback;
    if (VISION_CLUB_COLOR_MAP.has(key)) return VISION_CLUB_COLOR_MAP.get(key);
    const found = Array.from(VISION_CLUB_COLOR_MAP.entries()).find(([candidate]) => (
      candidate.length >= 2 && (key.includes(candidate) || candidate.includes(key))
    ));
    return found ? found[1] : fallback;
  }

  function buildVisionStateForMatch(match, phase) {
    const detail = getDetailMatchData(match);
    const scoreBoard = getHomeAwayDisplay(detail);
    const homeSource = getVisionSideSource(detail, "home");
    const awaySource = getVisionSideSource(detail, "away");
    const useFinalMembers = phase === "final";
    const homeVisibleMembers = useFinalMembers
      ? buildVisionFinalMembers(homeSource.starters, homeSource.bench, homeSource.substitutions, homeSource.cards)
      : homeSource.starters;
    const awayVisibleMembers = useFinalMembers
      ? buildVisionFinalMembers(awaySource.starters, awaySource.bench, awaySource.substitutions, awaySource.cards)
      : awaySource.starters;
    const scores = getVisionScores(detail, phase, scoreBoard);

    return {
      colors: {
        home: getVisionClubColor(scoreBoard.homeName, "#ff6600"),
        away: getVisionClubColor(scoreBoard.awayName, "#ffe600"),
        center: "#d83618"
      },
      textColors: {
        homeClub: "#ffffff",
        awayClub: "#ffffff",
        homeNumber: "#ffffff",
        awayNumber: "#ffffff"
      },
      images: {
        league: getVisionLeagueLogo(detail),
        bottom: ""
      },
      image: "",
      home: {
        club: scoreBoard.homeName,
        players: fillVisionPlayers(homeVisibleMembers, 11),
        startingPlayers: fillVisionPlayers(homeSource.starters, 11),
        reserves: fillVisionPlayers(homeSource.bench, 9)
      },
      away: {
        club: scoreBoard.awayName,
        players: fillVisionPlayers(awayVisibleMembers, 11),
        startingPlayers: fillVisionPlayers(awaySource.starters, 11),
        reserves: fillVisionPlayers(awaySource.bench, 9)
      },
      match: {
        phase: phase === "pre" ? "kickoff" : "fulltime",
        league: parseDate(detail.date).getFullYear() === 2026 ? "明治安田\nJ2・J3 百年構想リーグ" : (detail.tournament || ""),
        round: formatVisionRoundLabel(detail),
        firstHome: scores.firstHome,
        firstAway: scores.firstAway,
        secondHome: scores.secondHome,
        secondAway: scores.secondAway,
        totalHome: scores.totalHome,
        totalAway: scores.totalAway
      },
      result: {
        homeScorers: [],
        awayScorers: []
      },
      attendance: {
        title: "本日の来場者数",
        count: detail.attendance || "",
        message: "ご来場ありがとうございました"
      },
      top: {
        year: detail.date ? String(parseDate(detail.date).getFullYear()) : "",
        kickoff: detail.time ? `${detail.time}K.O.` : "",
        eventName: "",
        homeEnglish: getClubEnglishName(scoreBoard.homeName),
        awayEnglish: getClubEnglishName(scoreBoard.awayName)
      },
      referees: [
        { role: "主　審", name: detail.referee || "" },
        { role: "副　審", name: Array.isArray(detail.assistant_referees) ? detail.assistant_referees[0] || "" : "" },
        { role: "副　審", name: Array.isArray(detail.assistant_referees) ? detail.assistant_referees[1] || "" : "" },
        { role: "第4の審判員", name: detail.fourth_official || "" },
        { role: "VAR", name: detail.var_referee || "" },
        { role: "AVAR", name: detail.avar_referee || "" }
      ],
      announcements: {
        startingSide: "home",
        reserveSide: "home"
      }
    };
  }

  function fitVisionPreviewFrame(frame) {
    const shell = frame && frame.closest(".vision-display-shell");
    if (!shell) return;
    const scale = Math.max(0.1, shell.clientWidth / 1920);
    frame.style.width = "1920px";
    frame.style.height = "1080px";
    frame.style.transform = `scale(${scale})`;
    shell.style.height = `${1080 * scale}px`;
  }

  function applyVisionStateToFrame(frame, state, attempt = 0) {
    try {
      const vision = frame && frame.contentWindow && frame.contentWindow.scoreboardVision;
      if (vision && typeof vision.applyState === "function") {
        const apply = () => vision.applyState(state);
        if (typeof vision.whenReady === "function") {
          Promise.resolve(vision.whenReady()).then(apply).catch(apply);
        } else {
          apply();
        }
        return;
      }
    } catch (error) {
      // Same-origin localhost preview can be briefly unavailable while the iframe boots.
    }
    if (attempt < 45) {
      window.setTimeout(() => applyVisionStateToFrame(frame, state, attempt + 1), 100);
    }
  }

  function ensureVisionPreviewModal() {
    let backdrop = document.getElementById("vision-preview-backdrop");
    let modal = document.getElementById("vision-preview-modal");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "vision-preview-backdrop";
      backdrop.className = "vision-preview-backdrop";
      document.body.appendChild(backdrop);
    }
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "vision-preview-modal";
      modal.className = "vision-preview-modal";
      document.body.appendChild(modal);
    }
    backdrop.onclick = closeVisionPreviewModal;
    return { backdrop, modal };
  }

  function closeVisionPreviewModal(options = {}) {
    const closeDirect = () => {
      document.getElementById("vision-preview-backdrop")?.classList.remove("active");
      document.getElementById("vision-preview-modal")?.classList.remove("active");
    };
    if (options.history === false) closeDirect();
    else closeAppHistoryGroup(kind => kind.startsWith("vision-preview:"), closeDirect);
  }

  const VISION_PHASES = {
    pre: { label: "試合前", english: "STARTING LINEUP", button: "試合前", description: "スタメン表示" },
    post: { label: "試合後", english: "FULL TIME", button: "試合後", description: "結果入りスタメン" },
    final: { label: "試合終了時点", english: "FINAL ON PITCH", button: "終了時点", description: "交代・警告反映" }
  };

  function visionPlayerDisplayName(player) {
    return [player && player.family, player && player.given].filter(Boolean).join(" ").trim();
  }

  function isVisionKanaPlayer(player) {
    const name = visionPlayerDisplayName(player);
    return /[ァ-ヶー]/.test(name);
  }

  function collectVisionKanaPlayers(state) {
    const rows = [];
    ["home", "away"].forEach(side => {
      const players = state && state[side] && Array.isArray(state[side].players) ? state[side].players : [];
      players.forEach((player, index) => {
        const name = visionPlayerDisplayName(player);
        if (!name || !isVisionKanaPlayer(player)) return;
        rows.push({ side, index, name, half: Boolean(player.half) });
      });
    });
    return rows;
  }

  function renderVisionKanaControls(state) {
    const kanaPlayers = collectVisionKanaPlayers(state);
    if (!kanaPlayers.length) return "";
    return `
      <div class="vision-kana-panel">
        <div class="vision-kana-head">
          <span>カタカナ名</span>
          <strong>半角表示</strong>
        </div>
        <div class="vision-kana-list">
          ${kanaPlayers.map(player => `
            <button
              type="button"
              class="vision-kana-toggle ${player.half ? "active" : ""}"
              data-vision-kana-toggle="true"
              data-side="${player.side}"
              data-index="${player.index}"
            >
              <span>${escapeHtml(player.name)}</span>
              <strong>${player.half ? "半角ON" : "半角OFF"}</strong>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function bindVisionKanaControls(modal, frame, visionState) {
    modal.querySelectorAll("[data-vision-kana-toggle]").forEach(button => {
      button.onclick = () => {
        const side = button.dataset.side;
        const index = Number(button.dataset.index);
        const player = visionState && visionState[side] && visionState[side].players && visionState[side].players[index];
        if (!player) return;
        player.half = !player.half;
        button.classList.toggle("active", player.half);
        const label = button.querySelector("strong");
        if (label) label.textContent = player.half ? "半角ON" : "半角OFF";
        applyVisionStateToFrame(frame, visionState);
      };
    });
  }

  function renderVisionPreview(match, phase, options = {}) {
    const { backdrop, modal } = ensureVisionPreviewModal();
    const detail = getDetailMatchData(match);
    const score = getHomeAwayDisplay(detail);
    const phaseKey = VISION_PHASES[phase] ? phase : "pre";
    const visionState = buildVisionStateForMatch(detail, phaseKey);
    const phaseMeta = VISION_PHASES[phaseKey];

    modal.innerHTML = `
      <div class="vision-preview-header">
        <div>
          <span>${phaseMeta.label}</span>
          <strong>大型ビジョン / ${phaseMeta.english}</strong>
        </div>
        <button type="button" class="vision-preview-close" aria-label="閉じる">×</button>
      </div>
      <div class="vision-preview-subhead">
        <span>${escapeHtml(formatVisionRoundLabel(detail))}</span>
        <strong>${escapeHtml(score.homeName)} vs ${escapeHtml(score.awayName)}</strong>
      </div>
      <div class="vision-display-shell">
        <iframe
          class="vision-display-frame"
          src="./vision/display.html?v=20260601vision3"
          title="大型ビジョン スタメンプレビュー"
          aria-label="大型ビジョン スタメンプレビュー"
        ></iframe>
      </div>
      ${renderVisionKanaControls(visionState)}
      <div class="vision-preview-actions">
        ${Object.entries(VISION_PHASES).map(([key, item]) => `
          <button type="button" data-phase="${key}" class="${phaseKey === key ? "active" : ""}">${item.button}</button>
        `).join("")}
      </div>
    `;
    modal.classList.add("actual-vision");
    backdrop.classList.add("active");
    modal.classList.add("active");
    addAppHistoryEntry(
      `vision-preview:${phaseKey}`,
      () => renderVisionPreview(match, phaseKey, { history: false }),
      options
    );

    const frame = modal.querySelector(".vision-display-frame");
    const resize = () => fitVisionPreviewFrame(frame);
    frame.addEventListener("load", () => {
      resize();
      applyVisionStateToFrame(frame, visionState);
    });
    window.setTimeout(() => {
      resize();
      applyVisionStateToFrame(frame, visionState);
    }, 120);
    window.addEventListener("resize", resize, { once: true });
    modal.querySelector(".vision-preview-close").onclick = closeVisionPreviewModal;
    bindVisionKanaControls(modal, frame, visionState);
    modal.querySelectorAll(".vision-preview-actions [data-phase]").forEach(btn => {
      btn.onclick = () => renderVisionPreview(match, btn.dataset.phase);
    });
  }

  function openVisionPreviewPicker(match, options = {}) {
    const { backdrop, modal } = ensureVisionPreviewModal();
    modal.classList.remove("actual-vision");
    modal.innerHTML = `
      <div class="vision-preview-header">
        <div>
          <span>大型ビジョン</span>
          <strong>スタメン画面プレビュー</strong>
        </div>
        <button type="button" class="vision-preview-close" aria-label="閉じる">×</button>
      </div>
      <div class="vision-preview-subhead">
        <span>${escapeHtml(formatVisionRoundLabel(match))}</span>
        <strong>${escapeHtml((getHomeAwayDisplay(match).homeName || "") + " vs " + (getHomeAwayDisplay(match).awayName || ""))}</strong>
      </div>
      <div class="vision-phase-picker">
        ${Object.entries(VISION_PHASES).map(([key, item]) => `
          <button type="button" data-phase="${key}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.description)}</strong>
          </button>
        `).join("")}
      </div>
    `;
    backdrop.classList.add("active");
    modal.classList.add("active");
    addAppHistoryEntry(
      "vision-preview:picker",
      () => openVisionPreviewPicker(match, { history: false }),
      options
    );
    modal.querySelector(".vision-preview-close").onclick = closeVisionPreviewModal;
    modal.querySelectorAll("[data-phase]").forEach(btn => {
      btn.onclick = () => renderVisionPreview(match, btn.dataset.phase);
    });
  }

  // --- Detail Sheet & Persistence ---

  function openDetailSheet(match, options = {}) {
    const mId = `${match.date}_${match.club}_${match.opponent}`;
    const offRes = findOfficialResult(match);
    const sMemo = localStorage.getItem(`memo_${mId}`) || "";
    const isAttend = localStorage.getItem(`attend_${mId}`) === "true";
    let sMy = "";
    let sOpp = "";
    let sPkM = "";
    let sPkO = "";
    const sWeather = localStorage.getItem(`weather_${mId}`) || "";
    const sTemp = localStorage.getItem(`temp_${mId}`) || "";
    const officialScores = extractOwnResultScores(offRes, match);
    if (officialScores) {
      sMy = String(officialScores.ownScore);
      sOpp = String(officialScores.opponentScore);
      if (officialScores.pkOwn !== null && officialScores.pkOpponent !== null) {
        sPkM = String(officialScores.pkOwn);
        sPkO = String(officialScores.pkOpponent);
      }
    } else if (match.score) {
      const scores = String(match.score).split("-").map(value => value.trim());
      if (scores.length === 2) {
        sMy = scores[0];
        sOpp = scores[1];
      }
    }

    const J_CLUB_ENG = {
      "北海道コンサドーレ札幌": "HOKKAIDO CONSADOLE SAPPORO", "ヴァンラーレ八戸": "VANRAURE HACHINOHE", "いわてグルージャ盛岡": "IWATE GRULLA MORIOKA", "ベガルタ仙台": "VEGALTA SENDAI", "ブラウブリッツ秋田": "BLAUBLITZ AKITA", "モンテディオ山形": "MONTEDIO YAMAGATA", "福島ユナイテッドFC": "FUKUSHIMA UNITED FC", "いわきFC": "IWAKI FC", "鹿島アントラーズ": "KASHIMA ANTLERS", "水戸ホーリーホック": "MITO HOLLYHOCK", "栃木SC": "TOCHIGI SC", "ザスパ群馬": "THESPA GUNMA", "浦和レッズ": "URAWA REDS", "大宮アルディージャ": "OMIYA ARDIJA", "RB大宮アルディージャ": "RB OMIYA ARDIJA", "ジェフユナイテッド千葉": "JEF UNITED CHIBA", "柏レイソル": "KASHIWA REYSOL", "FC東京": "FC TOKYO", "東京ヴェルディ": "TOKYO VERDY", "FC町田ゼルビア": "FC MACHIDA ZELVIA", "川崎フロンターレ": "KAWASAKI FRONTALE", "横浜F・マリノス": "YOKOHAMA F. MARINOS", "横浜FC": "YOKOHAMA FC", "Y.S.C.C.横浜": "Y.S.C.C. YOKOHAMA", "湘南ベルマーレ": "SHONAN BELLMARE", "SC相模原": "SC SAGAMIHARA", "ヴァンフォーレ甲府": "VENTFORET KOFU", "松本山雅FC": "MATSUMOTO YAMAGA FC", "AC長野パルセイロ": "AC NAGANO PARCEIRO", "アルビレックス新潟": "ALBIREX NIIGATA", "カターレ富山": "KATALLER TOYAMA", "ツエーゲン金沢": "ZWEIGEN KANAZAWA", "清水エスパルス": "SHIMIZU S-PULSE", "ジュビロ磐田": "JUBILO IWATA", "藤枝MYFC": "FUJIEDA MYFC", "アスルクラロ沼津": "AZUL CLARO NUMAZU", "名古屋グランパス": "NAGOYA GRAMPUS", "FC岐阜": "FC GIFU", "京都サンガF.C.": "KYOTO SANGA F.C.", "ガンバ大阪": "GAMBA OSAKA", "セレッソ大阪": "CEREZO OSAKA", "FC大阪": "FC OSAKA", "ヴィッセル神戸": "VISSEL KOBE", "ヴィッセル神戶": "VISSEL KOBE", "奈良クラブ": "NARA CLUB", "ガイナーレ鳥取": "GAINARE TOTTORI", "ファジアーノ岡山": "FAGIANO OKAYAMA", "サンフレッチェ広島": "SANFRECCE HIROSHIMA", "レノファ山口FC": "RENOFA YAMAGUCHI FC", "カマタマーレ讃岐": "KAMATAMARE SANUKI", "徳島ヴォルティス": "TOKUSHIMA VORTIS", "愛媛FC": "EHIME FC", "FC今治": "FC IMABARI", "アビスパ福岡": "AVISPA FUKUOKA", "ギラヴァンツ北九州": "GIRAVANZ KITAKYUSHU", "サガン鳥栖": "SAGAN TOSU", "V・ファーレン長崎": "V-VAREN NAGASAKI", "ロアッソ熊本": "ROASSO KUMAMOTO", "大分トリニータ": "OITA TRINITA", "テゲバジャーロ宮崎": "TEGEVAJARO MIYAZAKI", "鹿児島ユナイテッドFC": "KAGOSHIMA UNITED FC", "FC琉球": "FC RYUKYU", "高知ユナイテッドSC": "KOCHI UNITED SC", "レイラック滋賀FC": "REILAC SHIGA FC"
    };

    const detailData = offRes ? { ...match, ...offRes } : match;
    const officialInfoHtml = renderOfficialInfo(detailData);
    const membersHtml = renderMatchMembers(detailData);

    const homeAway = getMatchIsHome(detailData) ? "HOME" : "AWAY";
    const clubName = match.club === "niigata" ? "ALBIREX NIIGATA" : "ROASSO KUMAMOTO";
    const scoreBoard = getHomeAwayDisplay(detailData, sMy, sOpp);
    const homeEnglish = J_CLUB_ENG[scoreBoard.homeName] || getClubEnglishName(scoreBoard.homeName);
    const awayEnglish = J_CLUB_ENG[scoreBoard.awayName] || getClubEnglishName(scoreBoard.awayName);
    const detailRound = formatVisionRoundLabel(detailData);
    const resultStatusLabel = scoreBoard.homeScore !== "-" || scoreBoard.awayScore !== "-" ? "MATCH RESULT" : "MATCH PREVIEW";
    const visionButtonHtml = match.club === "niigata" && getMatchIsHome(match)
      ? `<button type="button" class="u-vision-open-btn" id="detail-vision-preview">ビジョンプレビュー</button>`
      : "";
    const hasOwnScore = sMy !== "" && sOpp !== "";
    const ownScoreNumber = Number(sMy);
    const oppScoreNumber = Number(sOpp);
    const pkOwnNumber = Number(sPkM);
    const pkOppNumber = Number(sPkO);
    let outcomeLabel = resultStatusLabel;
    let outcomeClass = "pending";
    if (hasOwnScore && Number.isFinite(ownScoreNumber) && Number.isFinite(oppScoreNumber)) {
      if (ownScoreNumber === oppScoreNumber && sPkM !== "" && sPkO !== "" && Number.isFinite(pkOwnNumber) && Number.isFinite(pkOppNumber)) {
        outcomeLabel = pkOwnNumber > pkOppNumber ? "PK WIN" : "PK LOSE";
        outcomeClass = pkOwnNumber > pkOppNumber ? "win" : "lose";
      } else if (ownScoreNumber > oppScoreNumber) {
        outcomeLabel = "WIN";
        outcomeClass = "win";
      } else if (ownScoreNumber < oppScoreNumber) {
        outcomeLabel = "LOSE";
        outcomeClass = "lose";
      } else {
        outcomeLabel = "DRAW";
        outcomeClass = "draw";
      }
    }
    const pkDisplay = hasOwnScore && ownScoreNumber === oppScoreNumber && sPkM !== "" && sPkO !== "" ? `PK ${sPkM} - ${sPkO}` : "";
    const matchDateText = [detailData.date || match.date, detailData.day || match.day].filter(Boolean).join(" ");
    const matchTimeText = detailData.time || match.time || "";
    const venueText = detailData.venue || match.venue || "-";
    const detailRoundClass = getRoundDisplayClass(detailData, "match-detail-round");

    sheetContent.innerHTML = `
      <section class="match-detail-card match-detail-compact club-${match.club}">
        <div class="match-detail-top">
          <div>
            <span>ROUND</span>
            <strong class="${escapeHtml(detailRoundClass)}">${escapeHtml(detailRound)}</strong>
          </div>
          <div class="match-detail-chips">
            <span class="sheet-ha badge-${homeAway.toLowerCase()}">${homeAway}</span>
          </div>
        </div>
        <div class="match-detail-board">
          <div class="match-detail-team">
            <img src="${escapeHtml(scoreBoard.homeEmblem)}" alt="${escapeHtml(scoreBoard.homeName)}">
            <span>HOME</span>
            <strong>${escapeHtml(scoreBoard.homeName)}</strong>
            <small>${escapeHtml(homeEnglish)}</small>
          </div>
          <div class="match-detail-scorebox">
            <span class="match-detail-outcome ${outcomeClass}">${escapeHtml(outcomeLabel)}</span>
            <div class="match-detail-score">
              <strong>${escapeHtml(scoreBoard.homeScore)}</strong>
              <span>:</span>
              <strong>${escapeHtml(scoreBoard.awayScore)}</strong>
            </div>
            ${pkDisplay ? `<small>${escapeHtml(pkDisplay)}</small>` : ""}
          </div>
          <div class="match-detail-team away">
            <img src="${escapeHtml(scoreBoard.awayEmblem)}" alt="${escapeHtml(scoreBoard.awayName)}">
            <span>AWAY</span>
            <strong>${escapeHtml(scoreBoard.awayName)}</strong>
            <small>${escapeHtml(awayEnglish)}</small>
          </div>
        </div>
        <div class="match-detail-info">
          <div>
            <span>DATE</span>
            <strong>${escapeHtml(matchDateText || "-")}${matchTimeText ? ` <em>${escapeHtml(matchTimeText)}</em>` : ""}</strong>
          </div>
          <div>
            <span>VENUE</span>
            <strong>${escapeHtml(venueText)}</strong>
          </div>
        </div>
        ${visionButtonHtml ? `<div class="match-detail-actions">${visionButtonHtml}</div>` : ""}
      </section>

      <section id="u-auto-weather-area" class="u-weather-card" style="display:none;">
        <div>
           <span>FORECAST</span>
           <div id="u-weather-display">
             <span class="w-icon" style="font-size: 1.8rem;">-</span>
           </div>
        </div>
        <div class="u-weather-divider"></div>
        <div>
           <span>TEMPERATURE</span>
           <div class="u-weather-temps">
             <span id="u-temp-max">-</span>
             <small>℃</small>
             <em>/</em>
             <span id="u-temp-min">-</span>
             <small>℃</small>
           </div>
        </div>
      </section>

      ${officialInfoHtml}
      ${membersHtml}
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

    const visionPreviewBtn = sheetContent.querySelector("#detail-vision-preview");
    if (visionPreviewBtn) {
      visionPreviewBtn.onclick = () => openVisionPreviewPicker(detailData);
    }
    bindPlayerLinks(match);
    bindLineupDetailToggle();

    // Use the unified weather helper
    const wBox = sheetContent.querySelector("#u-auto-weather-area");
    const wIconPlace = wBox.querySelector(".w-icon");
    const tMaxPlace = wBox.querySelector("#u-temp-max");
    const tMinPlace = wBox.querySelector("#u-temp-min");

    if (isBeforeToday(match.date)) {
      wBox.remove();
    } else {
      updateWeatherUI(wIconPlace, match.date, match.venue).then(() => {
        const resInner = wIconPlace.firstElementChild;
        if (!resInner) {
          wBox.remove();
          return;
        }
        const svg = resInner.querySelector("svg");
        const maxVal = resInner.querySelector(".w-temp-max");
        const minVal = resInner.querySelector(".w-temp-min");
        if (!svg && !maxVal && !minVal) {
          wBox.remove();
          return;
        }
        if (svg) wIconPlace.innerHTML = svg.outerHTML;
        if (maxVal) tMaxPlace.innerText = maxVal.innerText;
        if (minVal) tMinPlace.innerText = minVal.innerText;
        wBox.style.display = "flex";
      });
    }



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
    addAppHistoryEntry("match-detail", () => openDetailSheet(match, { history: false }), options);

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
      const mVal = sheetContent.querySelector(".memo-field").value;
      const isAtt = toggleBtn.classList.contains("active");

      localStorage.setItem(`memo_${mId}`, mVal);
      localStorage.setItem(`attend_${mId}`, isAtt);

      const card = document.querySelector(`.card[data-mid="${mId}"]`);
      if (card) {
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
      updateDashboardPrevResults();
    };
    sheetContent.querySelectorAll("input, textarea").forEach(inp => inp.oninput = saveAndRefresh);
  }

  function closeDetailSheet(options = {}) {
    const closeDirect = () => {
      detailSheet.classList.remove("active");
      sheetBackdrop.classList.remove("active");
    };
    if (options.history === false) closeDirect();
    else closeAppHistoryEntry("match-detail", closeDirect);
  }

  const GAS_EXEC_URL = "https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec";

  // --- Results & Data Management ---
  let officialResults = [];
  let cachedStandings = null;
  let cachedLeagueResults = [];
  let officialResultIndex = new Map();
  const STANDINGS_CACHE_MAX_AGE = 5 * 60 * 1000;
  const RESULTS_CACHE_MAX_AGE = 6 * 60 * 60 * 1000;
  const RESULT_GAS_SOURCE_PARAMS = [
    { league: "j2" },
    { league: "playoff" },
    { league: "all" },
    { league: "playoff", competition_years: "20261", competition_frame_ids: "36" },
    { league: "playoff", competition_years: "20261", competition_frame_ids: "28" },
    { league: "playoff", competition_years: "20261", competition_frame_ids: "20" },
    { league: "playoff", competition_years: "20261", competition_frame_ids: "33" },
    { league: "playoff", competition_years: "20261", competition_frame_ids: "26" },
    { league: "j2", stage: "playoff" },
    { league: "j2", competition: "playoff" }
  ];

  function readTimedCache(key, maxAgeMs) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      if (!parsed || !Array.isArray(parsed.data)) return null;
      const savedAt = Number(parsed.savedAt || 0);
      if (!savedAt || Date.now() - savedAt > maxAgeMs) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeTimedCache(key, data) {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  }

  // Initialize data from localStorage cache
  cachedStandings = normalizeAsciiFieldsInPlace(readTimedCache("trapp_standings_cache", STANDINGS_CACHE_MAX_AGE));
  cachedLeagueResults = normalizeAsciiFieldsInPlace(readTimedCache("trapp_results_cache", RESULTS_CACHE_MAX_AGE) || []);

  function getResultArray(payload) {
    if (!payload) return [];
    return Array.isArray(payload) ? payload : (payload.data || []);
  }

  function getResultKey(result) {
    const date = toIsoDate(result.date || "");
    if (result.home || result.away) {
      return [
        "match",
        date,
        canonicalTeamName(result.home),
        canonicalTeamName(result.away),
        result.home_score || "",
        result.away_score || ""
      ].join("|");
    }
    if (result.club && result.opponent) {
      const own = result.club === "niigata" ? "新潟" : result.club === "kumamoto" ? "熊本" : result.club;
      const sides = [canonicalTeamName(own), canonicalTeamName(result.opponent)].sort().join(":");
      return ["match", date, sides, result.score || ""].join("|");
    }
    return ["match", date, result.section || "", canonicalTeamName(result.home), canonicalTeamName(result.away)].join("|");
  }

  function getScheduleResultKey(date, club, opponent) {
    return [toIsoDate(date || ""), club || "", canonicalTeamName(opponent || "")].join("|");
  }

  function resultMatchesScheduleMatch(result, match) {
    if (!result || !match) return false;
    const resultDate = toIsoDate(result.date || "");
    const matchDate = toIsoDate(match.date || "");
    if (resultDate && matchDate && resultDate !== matchDate) return false;

    if (result.club && result.opponent) {
      return result.club === match.club && robustTeamMatch(result.opponent, match.opponent);
    }

    if (result.home || result.away) {
      const ownName = getOwnJapaneseClubName(match.club);
      const ownShortName = match.club === "niigata" ? "新潟" : match.club === "kumamoto" ? "熊本" : match.club;
      const home = cleanResultTeamName(result.home || "");
      const away = cleanResultTeamName(result.away || "");
      const ownIsHome = robustTeamMatch(home, ownName) || robustTeamMatch(home, ownShortName);
      const ownIsAway = robustTeamMatch(away, ownName) || robustTeamMatch(away, ownShortName);
      const opponentIsHome = robustTeamMatch(home, match.opponent);
      const opponentIsAway = robustTeamMatch(away, match.opponent);
      return (ownIsHome && opponentIsAway) || (ownIsAway && opponentIsHome);
    }

    return false;
  }

  function findScheduleMatchForResult(result) {
    const normalized = normalizeOfficialResult(result);
    if (!normalized || !normalized.date) return null;
    return scheduleData.find(match => resultMatchesScheduleMatch(normalized, match)) || null;
  }

  function rebuildOfficialResultIndex() {
    officialResultIndex = new Map();
    getResultArray(officialResults).forEach(result => {
      const normalized = normalizeOfficialResult(result);
      if (!normalized || !normalized.date) return;
      if (normalized.club && normalized.opponent) {
        officialResultIndex.set(getScheduleResultKey(normalized.date, normalized.club, normalized.opponent), normalized);
      }
      const match = findScheduleMatchForResult(normalized);
      if (match) {
        officialResultIndex.set(getScheduleResultKey(match.date, match.club, match.opponent), normalized);
      }
    });
  }

  function normalizeOfficialResult(result) {
    if (!result) return null;
    const normalized = { ...result };
    normalizeAsciiFieldsInPlace(normalized);
    if (normalized.date) normalized.date = toIsoDate(normalized.date);
    if (normalized.home) normalized.home = cleanResultTeamName(normalized.home);
    if (normalized.away) normalized.away = cleanResultTeamName(normalized.away);
    if (normalized.opponent) normalized.opponent = cleanResultTeamName(normalized.opponent);
    return normalized;
  }

  function getResultFixtureKey(result) {
    if (!result) return "";
    const date = toIsoDate(result.date || "");
    if (result.home || result.away) {
      const sides = [canonicalTeamName(result.home || ""), canonicalTeamName(result.away || "")].sort().join(":");
      return ["fixture", date, sides].join("|");
    }
    if (result.club && result.opponent) {
      const own = result.club === "niigata" ? "新潟" : result.club === "kumamoto" ? "熊本" : result.club;
      const sides = [canonicalTeamName(own), canonicalTeamName(result.opponent)].sort().join(":");
      return ["fixture", date, sides].join("|");
    }
    return ["fixture", date, canonicalTeamName(result.section || "")].join("|");
  }

  function parseScorePair(value) {
    const match = String(value ?? "").match(/(\d+)\s*[-:]\s*(\d+)/);
    if (!match) return null;
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    return Number.isFinite(first) && Number.isFinite(second) ? [first, second] : null;
  }

  function parsePkScore(value) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const score = parseInt(text, 10);
    return Number.isFinite(score) ? score : null;
  }

  function parsePkPair(value) {
    const match = String(value || "").match(/(\d+)\s*PK\s*(\d+)/i);
    if (!match) return null;
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    return Number.isFinite(first) && Number.isFinite(second) ? [first, second] : null;
  }

  function extractOwnResultScores(result, match) {
    const normalized = normalizeOfficialResult(result);
    if (!normalized || !match) return null;

    const ownName = getOwnJapaneseClubName(match.club);
    const ownShortName = match.club === "niigata" ? "新潟" : match.club === "kumamoto" ? "熊本" : match.club;
    let isOwnHome = getMatchIsHome(match);
    let ownScore = NaN;
    let opponentScore = NaN;

    if (normalized.home || normalized.away) {
      const homeMatchesOwn = robustTeamMatch(normalized.home, ownName) || robustTeamMatch(normalized.home, ownShortName);
      const awayMatchesOwn = robustTeamMatch(normalized.away, ownName) || robustTeamMatch(normalized.away, ownShortName);
      if (!homeMatchesOwn && !awayMatchesOwn) return null;
      isOwnHome = homeMatchesOwn;

      const homeScore = parseInt(normalized.home_score, 10);
      const awayScore = parseInt(normalized.away_score, 10);
      if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
        ownScore = isOwnHome ? homeScore : awayScore;
        opponentScore = isOwnHome ? awayScore : homeScore;
      }
    }

    if ((!Number.isFinite(ownScore) || !Number.isFinite(opponentScore)) && normalized.score !== undefined) {
      const pair = parseScorePair(normalized.score);
      if (pair) {
        if (normalized.home || normalized.away) {
          ownScore = isOwnHome ? pair[0] : pair[1];
          opponentScore = isOwnHome ? pair[1] : pair[0];
        } else {
          ownScore = pair[0];
          opponentScore = pair[1];
        }
      }
    }

    if (!Number.isFinite(ownScore) || !Number.isFinite(opponentScore)) return null;

    let pkPair = parsePkPair(normalized.pk);
    if (!pkPair) {
      const homePk = parsePkScore(normalized.pk_home_score ?? normalized.pkHomeScore);
      const awayPk = parsePkScore(normalized.pk_away_score ?? normalized.pkAwayScore);
      if (homePk !== null && awayPk !== null) pkPair = [homePk, awayPk];
    }
    return {
      ownScore,
      opponentScore,
      pkOwn: pkPair ? (isOwnHome ? pkPair[0] : pkPair[1]) : null,
      pkOpponent: pkPair ? (isOwnHome ? pkPair[1] : pkPair[0]) : null
    };
  }

  function buildStoredResultFromMatch(match) {
    if (!match || !match.date || !match.club || !match.opponent) return null;
    const mId = `${match.date}_${match.club}_${match.opponent}`;
    const myRaw = localStorage.getItem(`score_my_${mId}`);
    const oppRaw = localStorage.getItem(`score_opp_${mId}`);
    if (myRaw === null || oppRaw === null || myRaw === "" || oppRaw === "") return null;

    const myScore = parseInt(myRaw, 10);
    const opponentScore = parseInt(oppRaw, 10);
    if (!Number.isFinite(myScore) || !Number.isFinite(opponentScore)) return null;

    const ownName = getOwnJapaneseClubName(match.club);
    const isOwnHome = getMatchIsHome(match);
    const homeScore = isOwnHome ? myScore : opponentScore;
    const awayScore = isOwnHome ? opponentScore : myScore;
    const pkMy = localStorage.getItem(`score_my_pk_${mId}`);
    const pkOpp = localStorage.getItem(`score_opp_pk_${mId}`);

    const result = normalizeOfficialResult({
      date: match.date,
      club: match.club,
      opponent: match.opponent,
      home_away: isOwnHome ? "H" : "A",
      home: isOwnHome ? ownName : match.opponent,
      away: isOwnHome ? match.opponent : ownName,
      home_score: String(homeScore),
      away_score: String(awayScore),
      score: `${myScore}-${opponentScore}`,
      status: "finished",
      emblem: match.emblem || "",
      _source: "localStorage"
    });

    if (pkMy !== null && pkOpp !== null && pkMy !== "" && pkOpp !== "") {
      result.pk = `${isOwnHome ? pkMy : pkOpp} PK ${isOwnHome ? pkOpp : pkMy}`;
    }

    return result;
  }

  function getStoredMatchResults() {
    return scheduleData.map(buildStoredResultFromMatch).filter(Boolean);
  }

  function getDashboardResults() {
    const merged = [];
    const seenFixtures = new Set();

    getResultArray(officialResults).forEach(raw => {
      const result = normalizeOfficialResult(raw);
      if (!result || !result.date) return;
      const key = getResultFixtureKey(result);
      if (key && seenFixtures.has(key)) return;
      merged.push(result);
      if (key) seenFixtures.add(key);
    });

    return merged;
  }

  function mergeOfficialResults(results) {
    const resultSeen = new Set(getResultArray(officialResults).map(r => getResultKey(r)));
    let changed = false;

    getResultArray(results).forEach(raw => {
      const result = normalizeOfficialResult(raw);
      if (!result || !result.date) return;
      const key = getResultKey(result);
      if (resultSeen.has(key)) return;
      officialResults.push(result);
      resultSeen.add(key);
      changed = true;
    });

    if (changed) rebuildOfficialResultIndex();
    if (changed) renderedFeedYear = undefined;
    return changed;
  }

  function mergeResultPayloads(payloads) {
    const rowsByFixture = new Map();
    const order = [];

    payloads.forEach(payload => {
      getResultArray(payload).forEach(raw => {
        const result = normalizeOfficialResult(raw);
        if (!result || !result.date) return;
        const fixtureKey = getResultFixtureKey(result) || getResultKey(result);
        if (!rowsByFixture.has(fixtureKey)) order.push(fixtureKey);
        rowsByFixture.set(fixtureKey, result);
      });
    });

    return {
      data: order.map(key => rowsByFixture.get(key))
    };
  }

  function buildGasUrl(type, params = {}) {
    const query = new URLSearchParams({ type, ...params });
    if (!query.has("league")) query.set("league", "j2");
    query.set("nocache", "1");
    query.set("t", String(Date.now()));
    return `${GAS_EXEC_URL}?${query.toString()}`;
  }

  async function fetchGasJson(type, params = {}, timeoutMs = 12000) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(buildGasUrl(type, params), controller ? { signal: controller.signal } : undefined);
      if (!res.ok) throw new Error(`GAS ${type} HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function fetchGasResults(forceGas = false) {
    const timeoutMs = forceGas ? 45000 : 6500;
    const sourceParams = forceGas ? RESULT_GAS_SOURCE_PARAMS : RESULT_GAS_SOURCE_PARAMS.slice(0, 3);
    const settled = await Promise.allSettled(
      sourceParams.map(params => fetchGasJson("results", params, timeoutMs))
    );
    const payloads = settled
      .filter(item => item.status === "fulfilled" && getResultArray(item.value).length)
      .map(item => item.value);
    return payloads.length ? mergeResultPayloads(payloads) : null;
  }

  async function refreshLeagueResults(forceGas = false) {
    const json = await fetchData("results", forceGas);
    const results = getResultArray(json);

    if (results.length) {
      cachedLeagueResults = results.map(normalizeOfficialResult).filter(Boolean);
      writeTimedCache("trapp_results_cache", cachedLeagueResults);
      mergeOfficialResults(cachedLeagueResults);
      syncResultsToLocalStorage(cachedLeagueResults);
      return cachedLeagueResults;
    }

    if (cachedLeagueResults.length) {
      mergeOfficialResults(cachedLeagueResults);
      syncResultsToLocalStorage(cachedLeagueResults);
    }
    return cachedLeagueResults;
  }

  async function fetchLocalJson(type) {
    const paths = {
      standings: ["./data/standings/current.json"],
      results: ["./data/results/playoffs.json", "./data/results/current.json", "./data/results/results.json", "./data/results.json"]
    }[type] || [`./data/${type}.json`];

    if (type === "results") {
      const payloads = [];
      for (const path of paths) {
        try {
          const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
          if (res.ok) payloads.push(normalizeAsciiFieldsInPlace(await res.json()));
        } catch (e) {
          console.warn(`Static load failed: ${path}`);
        }
      }
      return payloads.length ? mergeResultPayloads(payloads) : null;
    }

    for (const path of paths) {
      try {
        const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) return normalizeAsciiFieldsInPlace(await res.json());
      } catch (e) {
        console.warn(`Static load failed: ${path}`);
      }
    }
    return null;
  }

  function standingsHaveDashboardTeams(rows) {
    if (!Array.isArray(rows)) return false;
    const hasNiigata = rows.some(row => robustTeamMatch(row.team, "アルビレックス新潟") || robustTeamMatch(row.team, "新潟"));
    const hasKumamoto = rows.some(row => robustTeamMatch(row.team, "ロアッソ熊本") || robustTeamMatch(row.team, "熊本"));
    return hasNiigata && hasKumamoto;
  }

  /**
   * Universal fetch with fallback and stale check
   */
  async function fetchData(type, forceGas = false) {
    let staticJson = await fetchLocalJson(type);

    if (type === "results") {
      try {
        const gasJson = normalizeAsciiFieldsInPlace(await fetchGasResults(forceGas));
        const payloads = [staticJson, gasJson].filter(Boolean);
        if (payloads.length) return mergeResultPayloads(payloads);
      } catch (e) {
        console.warn(`GAS fetch failed, using local fallback: ${type}`);
      }
      return staticJson;
    }

    try {
      const gasJson = normalizeAsciiFieldsInPlace(await fetchGasJson(type, { league: "j2" }, forceGas ? 45000 : 12000));
      const gasArr = gasJson.data || (Array.isArray(gasJson) ? gasJson : []);
      const staticArr = (staticJson && staticJson.data) ? staticJson.data : (Array.isArray(staticJson) ? staticJson : []);
      if (type === "standings" && standingsHaveDashboardTeams(staticArr) && !standingsHaveDashboardTeams(gasArr)) {
        return staticJson;
      }
      if (gasArr.length >= staticArr.length && gasArr.length > 0) return gasJson;
    } catch (e) { console.warn(`GAS fetch failed, using local fallback: ${type}`); }
    return staticJson;
  }

  /**
   * Refreshes all data and updates UI
   */
  async function refreshAllData(forceGas = false) {
    await clubEmblemMapReady;

    const standingsPromise = fetchData("standings", forceGas);
    const resultsPromise = refreshLeagueResults(forceGas);

    const stdJson = await standingsPromise;
    if (stdJson && stdJson.data) {
      cachedStandings = stdJson.data;
      writeTimedCache("trapp_standings_cache", cachedStandings);
    }

    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "calendar") renderCalendar();

    await resultsPromise;
    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "feed") renderFeed();
    else if (currentMode === "calendar") renderCalendar();
    else if (typeof updateDashboardPrevResults === "function") updateDashboardPrevResults();
  }

  /**
   * Finds official result for a specific match
   */
  function findOfficialResult(match) {
    if (!officialResults || !officialResults.length) return null;
    const indexed = officialResultIndex.get(getScheduleResultKey(match.date, match.club, match.opponent));
    if (indexed) return indexed;

    const myKw = match.club === "niigata" ? "新潟" : "熊本";
    
    return officialResults.map(normalizeOfficialResult).filter(Boolean).find(r => {
      if (resultMatchesScheduleMatch(r, match)) return true;

      // Static JSON Format Support
      if (r.club && r.opponent) {
        if (toIsoDate(r.date) === toIsoDate(match.date) && r.club === match.club && robustTeamMatch(r.opponent, match.opponent)) return true;
      }

      // GAS Format Support
      if (!r.home || !r.away) return false;
      const dateMatch = toIsoDate(r.date) === toIsoDate(match.date);
      const teamMatch = robustTeamMatch(r.home, myKw) || robustTeamMatch(r.away, myKw);
      if (!teamMatch) return false;
      
      const isHome = robustTeamMatch(r.home, myKw);
      const opp = isHome ? r.away : r.home;
      const oppMatch = robustTeamMatch(opp, match.opponent);
      
      if (dateMatch && oppMatch) return true;
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
    const matchByKey = new Map();
    scheduleData.forEach(m => {
      matchByKey.set(getScheduleResultKey(m.date, m.club, m.opponent), m);
    });

    getResultArray(results).forEach(r => {
      r = normalizeOfficialResult(r);
      if (!r || !r.date) return;
      const m = r.club && r.opponent
        ? matchByKey.get(getScheduleResultKey(r.date, r.club, r.opponent))
        : findScheduleMatchForResult(r);
      if (!m) return;

      const scores = extractOwnResultScores(r, m);
      if (!scores) return;

      const mId = `${m.date}_${m.club}_${m.opponent}`;
      const sM = String(scores.ownScore);
      const sO = String(scores.opponentScore);
      const pkM = scores.pkOwn !== null ? String(scores.pkOwn) : null;
      const pkO = scores.pkOpponent !== null ? String(scores.pkOpponent) : null;
      const scoreChanged = localStorage.getItem(`score_my_${mId}`) !== sM ||
        localStorage.getItem(`score_opp_${mId}`) !== sO;
      const pkChanged = pkM !== null && pkO !== null
        ? (localStorage.getItem(`score_my_pk_${mId}`) !== pkM || localStorage.getItem(`score_opp_pk_${mId}`) !== pkO)
        : (localStorage.getItem(`score_my_pk_${mId}`) !== null || localStorage.getItem(`score_opp_pk_${mId}`) !== null);

      if (scoreChanged || pkChanged) {
        localStorage.setItem(`score_my_${mId}`, sM);
        localStorage.setItem(`score_opp_${mId}`, sO);
        if (pkM !== null && pkO !== null) {
          localStorage.setItem(`score_my_pk_${mId}`, pkM);
          localStorage.setItem(`score_opp_pk_${mId}`, pkO);
        } else {
          localStorage.removeItem(`score_my_pk_${mId}`);
          localStorage.removeItem(`score_opp_pk_${mId}`);
        }
        changed = true;
      }
    });
    if (changed) renderedFeedYear = undefined;
    return changed;
  }

  // ホーム画面に必要な順位表とリーグ全体の直近結果を後から更新する。
  setTimeout(async () => {
    fetchData("standings").then(stdJson => {
      if (stdJson && stdJson.data) {
        cachedStandings = stdJson.data;
        writeTimedCache("trapp_standings_cache", cachedStandings);
        if (currentMode === "dashboard") renderDashboard();
      }
    });
    refreshLeagueResults().then(() => {
      if (currentMode === "dashboard") renderDashboard();
      else if (currentMode === "feed") renderFeed();
      else if (currentMode === "calendar") renderCalendar();
    });
  }, 0);


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
    document.body.setAttribute("data-dashboard-full-ready", "true");

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
      const isHome = getMatchIsHome(m);
      const haBadge = isHome ? '<span class="sheet-ha badge-home" style="color:#fff; font-weight:800; font-size:1rem;">HOME</span>' : '<span class="sheet-ha badge-away" style="color:#fff; font-weight:800; font-size:1rem;">AWAY</span>';
      const myEmblem = m.club === "niigata" ? "./data/assets/emblems/アルビレックス新潟.png" : "./data/assets/emblems/ロアッソ熊本.png";
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
                       ${renderRoundPill(m, "dash-mw")}
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
              <div class="dash-card-split" style="display:flex; gap: 15px;">
                 <!-- Left (My Team) -->
                 <div class="dash-side-panel" style="flex:1; display:flex; flex-direction:column; align-items:center; text-align:center;">
                    <img src="${myEmblem}" style="height:45px; margin-bottom:4px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.1)); cursor:pointer;" onclick="openClubSite('${myShortName === '新潟' ? 'アルビレックス新潟' : 'ロアッソ熊本'}', event)">
                    <div style="display:flex; align-items:baseline; gap:4px; border-bottom:1px solid #f0f0f5; width:95%; justify-content:center; padding-bottom:6px; margin-bottom:6px;">
                       <span class="val-rank-num-my" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111;">-</span><span style="font-weight:700; font-size:0.85rem;">th</span>
                       <span style="font-size:0.85rem; color:#666; font-weight:700; margin-left:6px;"><span class="val-pts-my">-</span> pts</span>
                    </div>
                    <div class="dash-prev-meta"><span class="val-prev-date-my">-</span><span class="dash-prev-vs">vs</span><img class="dash-prev-opp-emblem val-prev-opp-emblem-my" alt=""><span class="val-prev-ha-my dash-prev-ha">-</span></div>
                    <div class="dash-prev-score-row" style="display:flex; align-items:center; gap:6px;">
                       <span class="val-prev-score-my" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111; letter-spacing:1px; white-space:nowrap;">-</span>
                       <span class="val-prev-res-my">-</span>
                    </div>
                    <div class="val-prev-form-my" style="min-height:18px;"></div>
                 </div>
                 
                 <!-- Divider -->
                 <div style="width:1px; background:#e8e8ed;"></div>
                 
                 <!-- Right (Opponent) -->
                 <div class="dash-side-panel" style="flex:1; display:flex; flex-direction:column; align-items:center; text-align:center;">
                    <img src="${escapeHtml(resolveEmblemUrl(m.opponent, m.emblem))}" class="dash-opp-emblem" style="height:45px; margin-bottom:4px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.1)); cursor:pointer;" onclick="openClubSite('${m.opponent}', event)">
                    <div style="display:flex; align-items:baseline; gap:4px; border-bottom:1px solid #f0f0f5; width:95%; justify-content:center; padding-bottom:6px; margin-bottom:6px;">
                       <span class="val-rank-num-opp" style="font-family:var(--font-main); font-size:1.4rem; font-weight:900; color:#111;">-</span><span style="font-weight:700; font-size:0.85rem;">th</span>
                       <span style="font-size:0.85rem; color:#666; font-weight:700; margin-left:6px;"><span class="val-pts-opp">-</span> pts</span>
                    </div>
                    <div class="dash-prev-meta"><span class="val-prev-date-opp">-</span><span class="dash-prev-vs">vs</span><img class="dash-prev-opp-emblem val-prev-opp-emblem-opp" alt=""><span class="val-prev-ha-opp dash-prev-ha">-</span></div>
                    <div class="dash-prev-score-row" style="display:flex; align-items:center; gap:6px;">
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
      const mId = card.dataset.mid;
      const match = scheduleData.find(x => `${x.date}_${x.club}_${x.opponent}` === mId);
      const opponentName = card.querySelector('.dash-opp-name');
      if (match) bindClubNameLongPress(opponentName, card, match);
      card.onclick = () => {
        if (card.dataset.suppressClick === "true") {
          delete card.dataset.suppressClick;
          return;
        }
        if (!mId) return;
        if (match) openDetailSheet(match);
      };
    });

    // Bind new quick links
    const btnFeed = document.getElementById("dash-to-feed");
    const btnCal = document.getElementById("dash-to-calendar");
    const btnPlayerAnalysis = document.getElementById("dash-to-player-analysis");
    if (btnFeed) btnFeed.onclick = () => switchMode("feed");
    if (btnCal) btnCal.onclick = () => switchMode("calendar");
    if (btnPlayerAnalysis) btnPlayerAnalysis.onclick = () => switchMode("player-analysis");

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

      const findStandingRow = (teamName) => {
        if (!teamName) return null;
        return data.find(row => row.team && robustTeamMatch(row.team, teamName)) || null;
      };
      
      const updateStatsCard = (m, myKeyword) => {
        if (!m) return;
        const myData = findStandingRow(myKeyword);
        const oppData = findStandingRow(m.opponent);

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
    const dashboardResults = getDashboardResults();
    if (!dashboardResults.length) return;

    const now = new Date();
    const cutoffStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // Find next matches to determine cutoff dates
    const sorted = [...scheduleData].sort((a, b) => a.date.localeCompare(b.date));
    let nextNiigata = sorted.find(m => m.date >= cutoffStr && m.club === "niigata");
    let nextKumamoto = sorted.find(m => m.date >= cutoffStr && m.club === "kumamoto");

    const escapeAttr = (value) => String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const getOpponentInfoFromResult = (r, kw) => {
      if (r.score !== undefined) {
        return {
          name: r.opponent || "",
          emblem: resolveEmblemUrl(r.opponent, r.emblem || (scheduleData.find(m => m.date === r.date && m.club === r.club && robustTeamMatch(m.opponent, r.opponent))?.emblem || ""))
        };
      }

      const isRHome = robustTeamMatch(r.home, kw);
      const name = ((isRHome ? r.away : r.home) || "").replace(/の試合詳細|の結果/g, "").trim();
      let emblem = resolveEmblemUrl(name, scheduleData.find(m => m.date === r.date && robustTeamMatch(m.opponent, name))?.emblem || "");
      if (!emblem) {
        const reversed = Object.entries(EMBLEM_MAP).find(([k, v]) => robustTeamMatch(v, name));
        if (reversed) emblem = localizeEmblemUrl(`https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png`);
      }
      return { name, emblem };
    };

    const ownKeywordForClub = (club) => {
      if (club === "niigata") return "新潟";
      if (club === "kumamoto") return "熊本";
      return club || "";
    };

    const getResultInfoForTeam = (result, teamName) => {
      if (!result || !teamName) return null;
      result = normalizeOfficialResult(result);
      if (!result) return null;
      const date = toIsoDate(result.date || "");
      let isHome = false;
      let opponent = "";
      let scoreMine = NaN;
      let scoreOpponent = NaN;

      if (result.home || result.away) {
        const home = result.home || "";
        const away = result.away || "";
        const matchesHome = robustTeamMatch(home, teamName);
        const matchesAway = robustTeamMatch(away, teamName);
        if (!matchesHome && !matchesAway) return null;
        isHome = matchesHome;
        opponent = isHome ? away : home;
        const homeScore = parseInt(result.home_score, 10);
        const awayScore = parseInt(result.away_score, 10);
        if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
          scoreMine = isHome ? homeScore : awayScore;
          scoreOpponent = isHome ? awayScore : homeScore;
        }
      } else if (result.club && result.opponent) {
        const ownKeyword = ownKeywordForClub(result.club);
        const matchesOwnClub = robustTeamMatch(ownKeyword, teamName);
        const matchesOpponent = robustTeamMatch(result.opponent, teamName);
        if (!matchesOwnClub && !matchesOpponent) return null;
        isHome = matchesOwnClub ? result.home_away === "H" : result.home_away === "A";
        opponent = matchesOwnClub ? result.opponent : ownKeyword;
      } else {
        return null;
      }

      if ((!Number.isFinite(scoreMine) || !Number.isFinite(scoreOpponent)) && result.score !== undefined) {
        const scores = String(result.score).split("-").map(value => parseInt(value.trim(), 10));
        if (scores.length === 2 && Number.isFinite(scores[0]) && Number.isFinite(scores[1])) {
          const ownKeyword = ownKeywordForClub(result.club);
          const targetIsOwnClub = result.club && robustTeamMatch(ownKeyword, teamName);
          scoreMine = targetIsOwnClub ? scores[0] : scores[1];
          scoreOpponent = targetIsOwnClub ? scores[1] : scores[0];
        }
      }

      return {
        date,
        isHome,
        ha: isHome ? "H" : "A",
        opponent: String(opponent || "").replace(/の試合詳細|の結果/g, "").trim(),
        scoreMine,
        scoreOpponent,
        pk: result.pk || ""
      };
    };

    const updateUI = (club, teamKw, match) => {
      const card = document.getElementById(`dash-card-${club}`);
      if (!card) return;
      
      const cutoff = match ? match.date : "9999-12-31";
      
      const updateHalf = (prefix, kw) => {
        const candidates = dashboardResults.map(r => ({
          result: r,
          info: getResultInfoForTeam(r, kw)
        })).filter(({ result, info }) => {
          if (!info) return false;
          const dMatch = info.date < cutoff;
          const status = (result.status || "").toLowerCase();
          const isFinished = status.includes("finish") || status.includes("ft") || status.includes("終");
          const hasScore = Number.isFinite(info.scoreMine) && Number.isFinite(info.scoreOpponent);
          const opponentIsSelf = robustTeamMatch(info.opponent, kw);
          return dMatch && !opponentIsSelf && (hasScore || isFinished);
        }).sort((a,b) => b.info.date.localeCompare(a.info.date));

        const past = [];
        const seenMatches = new Set();
        candidates.forEach(item => {
          const own = canonicalTeamName(kw);
          const opponent = canonicalTeamName(item.info.opponent);
          const sides = [own, opponent].sort().join(":");
          const key = [
            item.info.date,
            sides,
            item.info.scoreMine,
            item.info.scoreOpponent
          ].join("|");
          if (seenMatches.has(key)) return;
          seenMatches.add(key);
          past.push(item);
        });

        if (!past.length) return;
        const last = past[0].result;
        const lastInfo = past[0].info;
        if (!lastInfo) return;
        if (!Number.isFinite(lastInfo.scoreMine) || !Number.isFinite(lastInfo.scoreOpponent)) return;
        
        let isHome, sM, sO, opp, symbol, badgeColor, badgeText, scoreStr;

        isHome = lastInfo.isHome;
        sM = lastInfo.scoreMine;
        sO = lastInfo.scoreOpponent;
        opp = lastInfo.opponent;
        
        symbol = "DRAW";
        badgeColor = "#f1f3f4";
        badgeText = "#5f6368";
        scoreStr = `${sM} - ${sO}`;
        
        if (sM > sO) { symbol = "WIN"; badgeColor = "#e6f4ea"; badgeText = "#137333"; }
        else if (sM < sO) { symbol = "LOSE"; badgeColor = "#fce8e6"; badgeText = "#c5221f"; }
        else if (lastInfo.pk) {
          const pkMatch = parsePkPair(lastInfo.pk);
          if (pkMatch) {
            const pkM = isHome ? pkMatch[0] : pkMatch[1];
            const pkO = isHome ? pkMatch[1] : pkMatch[0];
            scoreStr = `(${pkM}) ${sM}-${sO} (${pkO})`;
            if (pkM > pkO) { symbol = "PK"; badgeColor = "#e6f4ea"; badgeText = "#137333"; }
            else { symbol = "PK"; badgeColor = "#fce8e6"; badgeText = "#c5221f"; }
          }
        }

        const resHtml = `<span style="border:1px solid ${badgeColor}; background:${badgeColor}; color:${badgeText}; border-radius:12px; padding:3px 8px; font-size:0.7rem; font-weight:800; display:inline-flex; align-items:center; gap:4px;"><span style="font-size:0.5rem;">●</span> ${symbol}</span>`;

        let formHtml = `<div class="dash-form-strip">`;
        const recent5 = past.slice(0, 5).reverse();
        recent5.forEach(({ result: r, info: rInfo }) => {
          if (!rInfo) return;
          let rM = rInfo.scoreMine;
          let rO = rInfo.scoreOpponent;
          if (!Number.isFinite(rM) || !Number.isFinite(rO)) return;
          let rSym = "△";

          if (rM > rO) { rSym = "〇"; }
          else if (rM < rO) { rSym = "●"; }
          else if (rInfo.pk) {
            const pkMatch = parsePkPair(rInfo.pk);
            if (pkMatch) {
              const isRHome = rInfo.isHome;
              const pkM = isRHome ? pkMatch[0] : pkMatch[1];
              const pkO = isRHome ? pkMatch[1] : pkMatch[0];
              if (pkM > pkO) { rSym = "△"; }
              else { rSym = "▲"; }
            }
          }
          const recentOpp = {
            name: rInfo.opponent,
            emblem: resolveEmblemUrl(rInfo.opponent, "")
          };
          const recentHA = rInfo.ha || "";
          const itemTitle = `${rInfo.date.substring(5).replace("-", "/")} vs ${recentOpp.name} ${rM}-${rO} ${recentHA}`;
          const emblemHtml = recentOpp.emblem
            ? `<img class="dash-form-emblem" src="${escapeAttr(recentOpp.emblem)}" alt="${escapeAttr(recentOpp.name)}">`
            : `<span class="dash-form-emblem-placeholder"></span>`;
          formHtml += `<span class="dash-form-item" title="${escapeAttr(itemTitle)}" aria-label="${escapeAttr(itemTitle)}"><span class="dash-form-symbol">${rSym}</span>${emblemHtml}<span class="dash-form-ha">${recentHA}</span></span>`;
        });
        formHtml += `</div>`;

        const elDate = card.querySelector(`.val-prev-date-${prefix}`);
        const elOpp = card.querySelector(`.val-prev-opp-name-${prefix}`);
        const elHA = card.querySelector(`.val-prev-ha-${prefix}`);
        const elScore = card.querySelector(`.val-prev-score-${prefix}`);
        const elRes = card.querySelector(`.val-prev-res-${prefix}`);
        const elForm = card.querySelector(`.val-prev-form-${prefix}`);
        const elPrevEmblem = card.querySelector(`.val-prev-opp-emblem-${prefix}`);
        const prevOppEmblem = resolveEmblemUrl(opp, "");
        
        if (elDate) elDate.innerText = lastInfo.date.substring(5).replace("-", "/");
        if (elOpp) elOpp.innerText = opp;
        if (elHA) elHA.innerText = isHome ? "H" : "A";
        if (elScore) elScore.innerText = scoreStr;
        if (elRes) elRes.innerHTML = resHtml;
        if (elForm) elForm.innerHTML = formHtml;
        if (elPrevEmblem) {
          if (prevOppEmblem) {
            elPrevEmblem.src = prevOppEmblem;
            elPrevEmblem.alt = opp;
            elPrevEmblem.title = opp;
            elPrevEmblem.style.visibility = "visible";
          } else {
            elPrevEmblem.removeAttribute("src");
            elPrevEmblem.alt = "";
            elPrevEmblem.style.visibility = "hidden";
          }
        }
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
    const dashboardContainer = document.getElementById("dashboard-cards-container");
    let timeBox = document.getElementById("dash-update-time");
    if (!timeBox && dashboardContainer) {
      timeBox = document.createElement("div");
      timeBox.id = "dash-update-time";
      dashboardContainer.appendChild(timeBox);
    }
    if (timeBox) timeBox.style.cssText = "font-size:0.65rem; color:white; background:rgba(0,0,0,0.5); padding:4px 12px; border-radius:10px; margin-top:15px; display:inline-block; font-weight:700;";
    if (timeBox) timeBox.innerText = `最終同期: ${new Date().toLocaleTimeString()} (Data: GAS最新)`;
  }


  // --- Rendering Feed ---


  // --- Rendering Feed ---


  function renderFeed(year = selectedYear) {
    renderedFeedYear = year;
    feedSlider.innerHTML = "";
    scheduleData.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    const ymMap = {};
    const yearMatches = year === null
      ? scheduleData
      : scheduleData.filter(m => parseDate(m.date).getFullYear() === Number(year));
    rebuildScheduleCompetitionFilterOptions(yearMatches);
    const sourceMatches = filterScheduleMatchesByCompetition(yearMatches);

    sourceMatches.forEach(m => {
      const d = parseDate(m.date), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!ymMap[key]) ymMap[key] = []; ymMap[key].push(m);
    });

    Object.keys(ymMap).sort().forEach(key => {
      const [year, month] = key.split("-").map(Number);
      const section = document.createElement("div"); section.className = "month-section"; section.dataset.ym = key; section.dataset.year = year; section.dataset.ym_title = `${year} / ${String(month).padStart(2, "0")}`;

      ymMap[key].forEach(match => {
        const mId = `${match.date}_${match.club}_${match.opponent}`;
        const isAtt = localStorage.getItem(`attend_${mId}`) === "true";
        let sMy = "", sOpp = "";
        let sPkM = "", sPkO = "";
        let res = null;
        let scoreDisplay = "";
        const officialScores = extractOwnResultScores(findOfficialResult(match), match);

        if (officialScores) {
          sMy = String(officialScores.ownScore);
          sOpp = String(officialScores.opponentScore);
          if (officialScores.pkOwn !== null && officialScores.pkOpponent !== null) {
            sPkM = String(officialScores.pkOwn);
            sPkO = String(officialScores.pkOpponent);
          }
        } else if (match.score) {
          const scores = String(match.score).split("-").map(x => x.trim());
          if (scores.length === 2) {
            sMy = scores[0];
            sOpp = scores[1];
          }
        }

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
        const isHome = getMatchIsHome(match);
        const card = document.createElement("div"); card.className = `card club-${match.club} type-${isHome ? 'home' : 'away'}`; card.dataset.mid = mId;
        const ha = isHome ? 'HOME' : 'AWAY';
        const emblemUrl = resolveEmblemUrl(match.opponent, match.emblem);

        let resultHtml = "";
        if (res) {
          resultHtml = `
            <div class="result-box">
              <div class="result-badge badge-${res}">${res.replace("-", " ").toUpperCase()}</div>
              <div class="match-score-text">${scoreDisplay}</div>
            </div>`;
        }

        card.innerHTML = `${resultHtml}<div class="match-meta">${renderRoundPill(match, "match-mw-pill")}<span class="match-ha-pill">${ha}</span>${isAtt ? '<span class="match-att-emoji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>' : ''}</div><div class="match-date-time">${match.date} ${match.day} - ${match.time}</div><div class="match-venue">${match.venue}</div><div class="match-row"><h3 class="opponent-name" title="長押しでHOME/AWAYのクラブ名をコピー">${escapeHtml(match.opponent)}</h3><img class="emblem" src="${escapeHtml(emblemUrl)}"></div>`;
        bindClubNameLongPress(card.querySelector(".opponent-name"), card, match);
        card.onclick = () => {
          if (card.dataset.suppressClick === "true") {
            delete card.dataset.suppressClick;
            return;
          }
          openDetailSheet(match);
        };
        section.appendChild(card);
      });
      feedSlider.appendChild(section);
    });
    allSections = Array.from(document.querySelectorAll(".month-section"));
    rebuildYearTabs();
    rebuildVisibleSections();
    updateClubVisibility();
    rebuildMonthTabs();
  }

  // --- Initializing App ---
  const today = new Date(), todayY = today.getFullYear(), tKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const initialYear = todayY >= HISTORY_START_YEAR && todayY <= HISTORY_END_YEAR ? todayY : 2025;
  selectedYear = initialYear;
  if (cachedLeagueResults.length) {
    mergeOfficialResults(cachedLeagueResults);
    syncResultsToLocalStorage(cachedLeagueResults);
  }
  if (!cachedStandings || !standingsHaveDashboardTeams(cachedStandings)) {
    const localStandings = await fetchLocalJson("standings");
    const localRows = localStandings && localStandings.data ? localStandings.data : (Array.isArray(localStandings) ? localStandings : []);
    if (localRows.length) {
      cachedStandings = localRows;
      writeTimedCache("trapp_standings_cache", cachedStandings);
    }
  }
  await ensureHistoryYearLoaded(initialYear);
  document.body.setAttribute("data-mode", "dashboard");
  if (ultraDashboard) ultraDashboard.className = "active-view";
  if (ultraFeed) ultraFeed.className = "hidden-view";
  if (calendarView) calendarView.className = "hidden-view";
  if (playerAnalysisView) playerAnalysisView.className = "hidden-view";
  if (visionView) visionView.className = "hidden-view";
  renderDashboard();

  // Build the heavier feed/calendar navigation after the must-show dashboard cards.
  requestAnimationFrame(() => {
    setTimeout(async () => {
      await applyYearFilter(initialYear, true);
      const tIdx = visibleSections.findIndex(s => s.dataset.ym === tKey);
      scrollToIndex(tIdx !== -1 ? tIdx : 0);
    }, 0);
  });

  if (scheduleCompetitionOptions) {
    scheduleCompetitionOptions.onchange = (event) => {
      if (!event.target.closest("input[type='checkbox']")) return;
      refreshScheduleCompetitionFilteredViews();
    };
  }

  // Navigation
  if (prevYearBtn) prevYearBtn.onclick = () => shiftYear(-1);
  if (nextYearBtn) nextYearBtn.onclick = () => shiftYear(1);
  prevBtn.onclick = () => { if (currentIndex > 0) scrollToIndex(currentIndex - 1); };
  nextBtn.onclick = () => { if (currentIndex < visibleSections.length - 1) scrollToIndex(currentIndex + 1); };
  goTodayBtn.onclick = async () => {
    const n = new Date(), y = n.getFullYear(), k = `${y}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    await applyYearFilter(y, true);
    const i = visibleSections.findIndex(s => s.dataset.ym === k);
    if (i !== -1) scrollToIndex(i);
  };

  // YM Picker
  function openYmPicker(options = {}) {
    if (!activeMonthTitle.textContent.includes("/")) return; // Not fully initialized
    const pickerYearsAll = getAvailableYears().map(String);
    if (!pickerYearsAll.length) return;

    const activePickerSection = visibleSections[currentIndex] || allSections[currentIndex] || allSections[0];
    let selectedPickerYear = String(activePickerSection?.dataset.year || selectedYear || pickerYearsAll[pickerYearsAll.length - 1]);
    if (!pickerYearsAll.includes(selectedPickerYear)) selectedPickerYear = pickerYearsAll[pickerYearsAll.length - 1];

    ymPickerList.innerHTML = `
      <div class="ym-picker-columns">
        <div class="ym-picker-years" aria-label="year"></div>
        <div class="ym-picker-month-panel">
          <div class="ym-picker-year-label"></div>
          <div class="ym-picker-months"></div>
        </div>
      </div>
    `;

    const pickerYearCol = ymPickerList.querySelector(".ym-picker-years");
    const pickerYearLabel = ymPickerList.querySelector(".ym-picker-year-label");
    const pickerMonthGrid = ymPickerList.querySelector(".ym-picker-months");

    const drawPickerYears = () => {
      pickerYearCol.innerHTML = "";
      pickerYearsAll.forEach(yearOption => {
        const btn = document.createElement("button");
        btn.className = "ym-picker-year-btn";
        btn.textContent = yearOption;
        btn.classList.toggle("active", yearOption === selectedPickerYear);
        btn.onclick = async () => {
          selectedPickerYear = yearOption;
          drawPickerYears();
          await drawPickerMonths();
        };
        pickerYearCol.appendChild(btn);
      });
      scrollActiveNavItem(pickerYearCol, ".ym-picker-year-btn.active");
    };

    const drawPickerMonths = async () => {
      const requestedYear = selectedPickerYear;
      const yearNumber = Number(requestedYear);
      pickerYearLabel.textContent = `${requestedYear}\u5e74`;
      pickerMonthGrid.innerHTML = "";

      if (yearNumber && yearNumber <= HISTORY_END_YEAR && !loadedHistoryYears.has(yearNumber)) {
        pickerYearLabel.textContent = `${requestedYear}\u5e74 loading...`;
        await ensureHistoryYearLoaded(yearNumber);
        if (requestedYear !== selectedPickerYear) return;
        pickerYearLabel.textContent = `${requestedYear}\u5e74`;
      }

      const monthItems = getMonthItemsForYear(yearNumber);
      if (!monthItems.length) {
        const empty = document.createElement("button");
        empty.className = "ym-picker-btn disabled";
        empty.textContent = "-";
        pickerMonthGrid.appendChild(empty);
        return;
      }

      monthItems.forEach(item => {
        const btn = document.createElement("button");
        btn.className = "ym-picker-btn";
        btn.textContent = `${item.month}\u6708`;
        if (visibleSections[currentIndex] && visibleSections[currentIndex].dataset.ym === item.ym) {
          btn.classList.add("current");
        }
        btn.onclick = async () => {
          closeYmPicker();
          await applyYearFilter(yearNumber, true);
          const idx = visibleSections.findIndex(sec => sec.dataset.ym === item.ym);
          if (idx !== -1) scrollToIndex(idx);
        };
        pickerMonthGrid.appendChild(btn);
      });
    };

    drawPickerYears();
    void drawPickerMonths();
    ymPickerOverlay.classList.add("active");
    ymPickerBackdrop.classList.add("active");
    addAppHistoryEntry("ym-picker", () => openYmPicker({ history: false }), options);
    return;

    const yearMap = {};
    allSections.forEach(sec => {
      const y = sec.dataset.year;
      if (!yearMap[y]) yearMap[y] = [];
      yearMap[y].push({ ym: sec.dataset.ym, m: sec.dataset.ym.split("-")[1] });
    });

    const years = Object.keys(yearMap).sort((a, b) => Number(a) - Number(b));
    if (!years.length) return;

    const activeSec = visibleSections[currentIndex] || allSections[currentIndex] || allSections[0];
    let pickerYear = activeSec?.dataset.year || String(selectedYear || years[years.length - 1]);
    if (!yearMap[pickerYear]) pickerYear = years[years.length - 1];

    ymPickerList.innerHTML = `
      <div class="ym-picker-columns">
        <div class="ym-picker-years" aria-label="年"></div>
        <div class="ym-picker-month-panel">
          <div class="ym-picker-year-label"></div>
          <div class="ym-picker-months"></div>
        </div>
      </div>
    `;

    const yearCol = ymPickerList.querySelector(".ym-picker-years");
    const yearLabel = ymPickerList.querySelector(".ym-picker-year-label");
    const monthGrid = ymPickerList.querySelector(".ym-picker-months");

    const renderYears = () => {
      yearCol.innerHTML = "";
      years.forEach(y => {
        const btn = document.createElement("button");
        btn.className = "ym-picker-year-btn";
        btn.textContent = y;
        btn.classList.toggle("active", y === pickerYear);
        btn.onclick = () => {
          pickerYear = y;
          renderYears();
          renderMonths();
        };
        yearCol.appendChild(btn);
      });
    };

    const renderMonths = () => {
      yearLabel.textContent = `${pickerYear}年`;
      monthGrid.innerHTML = "";
      yearMap[pickerYear]
        .sort((a, b) => Number(a.m) - Number(b.m))
        .forEach(item => {
        const btn = document.createElement("button"); btn.className = "ym-picker-btn";
        btn.textContent = Number(item.m) + "月";
        if (visibleSections[currentIndex] && visibleSections[currentIndex].dataset.ym === item.ym) {
          btn.classList.add("current");
        }
        btn.onclick = () => {
          closeYmPicker();
          applyYearFilter(Number(pickerYear), true);
          const idx = visibleSections.findIndex(s => s.dataset.ym === item.ym);
          if (idx !== -1) scrollToIndex(idx);
        };
        monthGrid.appendChild(btn);
      });
    };

    renderYears();
    renderMonths();
    ymPickerOverlay.classList.add("active");
    ymPickerBackdrop.classList.add("active");
  }
  function closeYmPicker(options = {}) {
    const closeDirect = () => {
      ymPickerOverlay.classList.remove("active");
      ymPickerBackdrop.classList.remove("active");
    };
    if (options.history === false) closeDirect();
    else closeAppHistoryEntry("ym-picker", closeDirect);
  }
  activeMonthTitle.onclick = openYmPicker;
  document.getElementById("ym-picker-close").onclick = closeYmPicker;
  ymPickerBackdrop.onclick = closeYmPicker;

  // Club Filter
  toggleNiigata.onclick = () => { toggleNiigata.classList.toggle("active"); updateClubVisibility(); };
  toggleKumamoto.onclick = () => { toggleKumamoto.classList.toggle("active"); updateClubVisibility(); };

  // Menus
  const toggleMenu = (isOpen, options = {}) => {
    if (isOpen) {
      sideMenu.classList.add("active");
      sideMenuBackdrop.classList.add("active");
      addAppHistoryEntry("side-menu", () => toggleMenu(true, { history: false }), options);
    } else {
      const closeDirect = () => {
        sideMenu.classList.remove("active");
        sideMenuBackdrop.classList.remove("active");
      };
      if (options.history === false) closeDirect();
      else closeAppHistoryEntry("side-menu", closeDirect);
    }
  };
  hamBtn.onclick = () => toggleMenu(true);
  document.getElementById("menu-close").onclick = () => toggleMenu(false);
  sideMenuBackdrop.onclick = () => toggleMenu(false);

  function openSubPane(id, options = {}) {
    document.getElementById(id).classList.add("active");
    addAppHistoryEntry(`sub-pane:${id}`, () => openSubPane(id, { history: false }), options);
  }
  function closeSubPane(id, options = {}) {
    const closeDirect = () => document.getElementById(id).classList.remove("active");
    if (options.history === false) closeDirect();
    else closeAppHistoryEntry(`sub-pane:${id}`, closeDirect);
  }
  document.querySelectorAll(".close-pane").forEach(btn => {
    btn.onclick = () => {
      const pane = btn.closest(".sub-pane");
      if (pane) closeSubPane(pane.id);
    };
  });

  // Close menu after clicking item
  const menuItems = document.querySelectorAll(".menu-card");
  // Selecting a destination replaces the menu's history entry below. Closing
  // it with history.back() here would race that transition and restore the
  // previous screen immediately.
  menuItems.forEach(btn => btn.addEventListener('click', () => toggleMenu(false, { history: false })));

  document.getElementById("menu-dashboard").onclick = () => switchMode("dashboard");
  document.getElementById("menu-feed").onclick = () => switchMode("feed");
  document.getElementById("menu-calendar").onclick = () => switchMode("calendar");
  const menuPlayerAnalysis = document.getElementById("menu-player-analysis");
  if (menuPlayerAnalysis) {
    menuPlayerAnalysis.onclick = () => switchMode("player-analysis");
  }
  document.getElementById("menu-links").onclick = () => openSubPane("links-overlay");
  document.getElementById("menu-chants").onclick = () => openSubPane("chants-overlay");
  document.getElementById("menu-standings").onclick = () => {
    openSubPane("standings-overlay");
    loadStandings();
  };
  const menuVision = document.getElementById("menu-vision");
  if (menuVision) {
    menuVision.onclick = () => switchMode("vision");
  }
  const dashStandingsBtn = document.getElementById("dash-to-standings");
  if (dashStandingsBtn) {
    dashStandingsBtn.onclick = () => {
      openSubPane("standings-overlay");
      loadStandings();
    };
  }
  const dashVisionBtn = document.getElementById("dash-to-vision");
  if (dashVisionBtn) {
    dashVisionBtn.onclick = () => switchMode("vision");
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
  searchPopup.onclick = async (e) => {
    const item = e.target.closest(".search-item");
    if (item) {
      const { date, club, opponent } = item.dataset;
      const x = scheduleData.find(m => m.date === date && m.club === club && m.opponent === opponent);
      if (x) {
        searchPopup.style.display = "none"; searchInput.value = "";
        const d = parseDate(date), ty = d.getFullYear(), tk = `${ty}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        await applyYearFilter(ty, true); const i = visibleSections.findIndex(s => s.dataset.ym === tk);
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
        const isHome = getMatchIsHome(m);
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
        updateDashboardPrevResults();
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
          const teamName = normalizeAsciiText(row.team || '');
          const isNiigata = teamName.includes('新潟');
          const isKumamoto = teamName.includes('熊本');
          const trcls = isNiigata ? 'standing-niigata' : isKumamoto ? 'standing-kumamoto' : '';
          const emblemUrl = getEmblemUrlForTeam(teamName);
          const emblemHTML = emblemUrl ? '<img class="standing-team-emblem" src="' + escapeHtml(emblemUrl) + '" alt="' + escapeHtml(teamName) + '">' : '<span class="standing-team-emblem-placeholder"></span>';
          return '<tr class="' + trcls + '">'
            + '<td class="col-rank">' + row.rank + '</td>'
            + '<td class="standing-team" style="cursor:pointer;" onclick="openClubSite(\'' + teamName + '\', event)"><span class="standing-team-name">' + emblemHTML + '<span>' + teamName + '</span></span></td>'
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

  // 最新データが必要な場合はメニューの再読み込みから同期する

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
