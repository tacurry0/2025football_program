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
      alert("\u516c\u5f0f\u30b5\u30a4\u30c8\u306e\u30c7\u30fc\u30bf\u304c\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u30ed\u30fc\u30ab\u30eb\u74b0\u5883(file://)\u306e\u5834\u5408\u3001\u30d6\u30e9\u30a6\u30b6\u306e\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u8a2d\u5b9a\u3067\u30d6\u30ed\u30c3\u30af\u3055\u308c\u3066\u3044\u308b\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\u3002");
      console.error("Failed to load club sites", e);
      return;
    }
  }
  
  // Remove all spaces, dots, middle dots, hyphens, and convert full-width to half-width
  const norm = (s) => (s || "").normalize("NFKC").replace(/[\s\u30fb\.\-\_]/g, "").toLowerCase();
  const targetNorm = norm(clubName);
  
  let club = window.clubSitesData.find(c => norm(c.club_name) === targetNorm);
  
  if (!club) {
    club = window.clubSitesData.find(c => {
      const cNorm = norm(c.club_name);
      return cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
    });
  }
  // Fallback for tricky JLeague abbreviations like "f\ufffd\ufffd\ufffd\ufffd" vs "FC\ufffd\ufffd\ufffd\ufffd"
  if (!club && targetNorm.includes("f\u6771\u4eac")) club = window.clubSitesData.find(c => c.club_name.includes("FC\u6771\u4eac"));
  if (!club && targetNorm.includes("c\u5927\u962a")) club = window.clubSitesData.find(c => c.club_name.includes("\u30bb\u30ec\u30c3\u30bd"));
  if (!club && targetNorm.includes("g\u5927\u962a")) club = window.clubSitesData.find(c => c.club_name.includes("\u30ac\u30f3\u30d0"));
  if (!club && targetNorm.includes("\u6771\u4eacv")) club = window.clubSitesData.find(c => c.club_name.includes("\u30f4\u30a7\u30eb\u30c7\u30a3"));
  if (!club && targetNorm.includes("\u6a2a\u6d5cfm")) club = window.clubSitesData.find(c => c.club_name.includes("\u30de\u30ea\u30ce\u30b9"));
  if (club && club.official_site) {
    window.open(club.official_site, '_blank');
  } else {
    alert("\u516c\u5f0f\u30b5\u30a4\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093:\n" + 
          "\u30af\u30e9\u30d6\u540d: [" + clubName + "]\n" + 
          "\u6b63\u898f\u5316: [" + targetNorm + "]");
    console.warn("No official site found for:", clubName);
  }
};
document.addEventListener("DOMContentLoaded", () => {
  const feedSlider = document.getElementById("feed-slider");
  const calendarBody = document.getElementById("calendar-body");
  const ultraFeed = document.getElementById("ultra-feed");
  const calendarView = document.getElementById("calendar-view");
  const ultraDashboard = document.getElementById("ultra-dashboard");
  const visionView = document.getElementById("vision-view");
  const prevBtn = document.getElementById("prev-month");
  const nextBtn = document.getElementById("next-month");
  const goTodayBtn = document.getElementById("go-today");
  const activeMonthTitle = document.getElementById("active-month-title");
  const toggleNiigata = document.getElementById("toggle-niigata");
  const toggleKumamoto = document.getElementById("toggle-kumamoto");
  const yearTabContainer = document.getElementById("nav-year-tabs");
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
  const ymPickerOverlay = document.getElementById("ym-picker-overlay");
  const ymPickerBackdrop = document.getElementById("ym-picker-backdrop");
  const ymPickerList = document.getElementById("ym-picker-list");
  let currentIndex = 0;
  let allSections = [];
  let visibleSections = [];
  let selectedYear = null;
  let currentMode = "dashboard"; // dashboard, feed, calendar or scoreboard
const CLUB_ENGLISH_NAMES = {
    "\u5317\u6d77\u9053\u30b3\u30f3\u30b5\u30c9\u30fc\u30ec\u672d\u5e4c": "HOKKAIDO CONSADOLE SAPPORO",
    "\u672d\u5e4c": "HOKKAIDO CONSADOLE SAPPORO",
    "\u30f4\u30a1\u30f3\u30e9\u30fc\u30ec\u516b\u6238": "VANRAURE HACHINOHE",
    "\u516b\u6238": "VANRAURE HACHINOHE",
    "\u3044\u308f\u3066\u30b0\u30eb\u30fc\u30b8\u30e3\u76db\u5ca1": "IWATE GRULLA MORIOKA",
    "\u5ca9\u624b": "IWATE GRULLA MORIOKA",
    "\u30d9\u30ac\u30eb\u30bf\u4ed9\u53f0": "VEGALTA SENDAI",
    "\u4ed9\u53f0": "VEGALTA SENDAI",
    "\u30d6\u30e9\u30a6\u30d6\u30ea\u30c3\u30c4\u79cb\u7530": "BLAUBLITZ AKITA",
    "\u79cb\u7530": "BLAUBLITZ AKITA",
    "\u30e2\u30f3\u30c6\u30c7\u30a3\u30aa\u5c71\u5f62": "MONTEDIO YAMAGATA",
    "\u5c71\u5f62": "MONTEDIO YAMAGATA",
    "\u798f\u5cf6\u30e6\u30ca\u30a4\u30c6\u30c3\u30c9FC": "FUKUSHIMA UNITED FC",
    "\u798f\u5cf6": "FUKUSHIMA UNITED FC",
    "\u3044\u308f\u304dFC": "IWAKI FC",
    "\u3044\u308f\u304d": "IWAKI FC",
    "\u9e7f\u5cf6\u30a2\u30f3\u30c8\u30e9\u30fc\u30ba": "KASHIMA ANTLERS",
    "\u9e7f\u5cf6": "KASHIMA ANTLERS",
    "\u6c34\u6238\u30db\u30fc\u30ea\u30fc\u30db\u30c3\u30af": "MITO HOLLYHOCK",
    "\u6c34\u6238": "MITO HOLLYHOCK",
    "\u6803\u6728SC": "TOCHIGI SC",
    "\u6803\u6728": "TOCHIGI SC",
    "\u30b6\u30b9\u30d1\u7fa4\u99ac": "THESPA GUNMA",
    "\u30b6\u30b9\u30d1\u30af\u30b5\u30c4\u7fa4\u99ac": "THESPAKUSATSU GUNMA",
    "\u7fa4\u99ac": "THESPA GUNMA",
    "\u6d66\u548c\u30ec\u30c3\u30ba": "URAWA REDS",
    "\u6d66\u548c": "URAWA REDS",
    "\u5927\u5bae\u30a2\u30eb\u30c7\u30a3\u30fc\u30b8\u30e3": "OMIYA ARDIJA",
    "RB\u5927\u5bae\u30a2\u30eb\u30c7\u30a3\u30fc\u30b8\u30e3": "RB OMIYA ARDIJA",
    "\u5927\u5bae": "RB OMIYA ARDIJA",
    "\u30b8\u30a7\u30d5\u30e6\u30ca\u30a4\u30c6\u30c3\u30c9\u5343\u8449": "JEF UNITED CHIBA",
    "\u5343\u8449": "JEF UNITED CHIBA",
    "\u67cf\u30ec\u30a4\u30bd\u30eb": "KASHIWA REYSOL",
    "\u67cf": "KASHIWA REYSOL",
    "FC\u6771\u4eac": "FC TOKYO",
    "\u6771\u4eac": "FC TOKYO",
    "\u6771\u4eac\u30f4\u30a7\u30eb\u30c7\u30a3": "TOKYO VERDY",
    "\u6771\u4eacV": "TOKYO VERDY",
    "FC\u753a\u7530\u30bc\u30eb\u30d3\u30a2": "FC MACHIDA ZELVIA",
    "\u753a\u7530": "FC MACHIDA ZELVIA",
    "\u5ddd\u5d0e\u30d5\u30ed\u30f3\u30bf\u30fc\u30ec": "KAWASAKI FRONTALE",
    "\u5ddd\u5d0e": "KAWASAKI FRONTALE",
    "\u6a2a\u6d5cF\u30fb\u30de\u30ea\u30ce\u30b9": "YOKOHAMA F. MARINOS",
    "\u6a2a\u6d5cFM": "YOKOHAMA F. MARINOS",
    "\u6a2a\u6d5cFC": "YOKOHAMA FC",
    "Y.S.C.C.\u6a2a\u6d5c": "Y.S.C.C. YOKOHAMA",
    "\u6e58\u5357\u30d9\u30eb\u30de\u30fc\u30ec": "SHONAN BELLMARE",
    "\u6e58\u5357": "SHONAN BELLMARE",
    "SC\u76f8\u6a21\u539f": "SC SAGAMIHARA",
    "\u76f8\u6a21\u539f": "SC SAGAMIHARA",
    "\u30f4\u30a1\u30f3\u30d5\u30a9\u30fc\u30ec\u7532\u5e9c": "VENTFORET KOFU",
    "\u7532\u5e9c": "VENTFORET KOFU",
    "\u677e\u672c\u5c71\u96c5FC": "MATSUMOTO YAMAGA FC",
    "\u677e\u672c": "MATSUMOTO YAMAGA FC",
    "AC\u9577\u91ce\u30d1\u30eb\u30bb\u30a4\u30ed": "AC NAGANO PARCEIRO",
    "\u9577\u91ce": "AC NAGANO PARCEIRO",
    "\u30a2\u30eb\u30d3\u30ec\u30c3\u30af\u30b9\u65b0\u6f5f": "ALBIREX NIIGATA",
    "\u65b0\u6f5f": "ALBIREX NIIGATA",
    "\u30ab\u30bf\u30fc\u30ec\u5bcc\u5c71": "KATALLER TOYAMA",
    "\u5bcc\u5c71": "KATALLER TOYAMA",
    "\u30c4\u30a8\u30fc\u30b2\u30f3\u91d1\u6ca2": "ZWEIGEN KANAZAWA",
    "\u91d1\u6ca2": "ZWEIGEN KANAZAWA",
    "\u6e05\u6c34\u30a8\u30b9\u30d1\u30eb\u30b9": "SHIMIZU S-PULSE",
    "\u6e05\u6c34": "SHIMIZU S-PULSE",
    "\u30b8\u30e5\u30d3\u30ed\u78d0\u7530": "JUBILO IWATA",
    "\u78d0\u7530": "JUBILO IWATA",
    "\u85e4\u679dMYFC": "FUJIEDA MYFC",
    "\u85e4\u679d": "FUJIEDA MYFC",
    "\u30a2\u30b9\u30eb\u30af\u30e9\u30ed\u6cbc\u6d25": "AZUL CLARO NUMAZU",
    "\u6cbc\u6d25": "AZUL CLARO NUMAZU",
    "\u540d\u53e4\u5c4b\u30b0\u30e9\u30f3\u30d1\u30b9": "NAGOYA GRAMPUS",
    "\u540d\u53e4\u5c4b": "NAGOYA GRAMPUS",
    "FC\u5c90\u961c": "FC GIFU",
    "\u5c90\u961c": "FC GIFU",
    "\u4eac\u90fd\u30b5\u30f3\u30acF.C.": "KYOTO SANGA F.C.",
    "\u4eac\u90fd": "KYOTO SANGA F.C.",
    "\u30ac\u30f3\u30d0\u5927\u962a": "GAMBA OSAKA",
    "G\u5927\u962a": "GAMBA OSAKA",
    "\u30bb\u30ec\u30c3\u30bd\u5927\u962a": "CEREZO OSAKA",
    "C\u5927\u962a": "CEREZO OSAKA",
    "FC\u5927\u962a": "FC OSAKA",
    "\u5927\u962a": "FC OSAKA",
    "\u30f4\u30a3\u30c3\u30bb\u30eb\u795e\u6238": "VISSEL KOBE",
    "\u30f4\u30a3\u30c3\u30bb\u30eb\u795e\u6236": "VISSEL KOBE",
    "\u795e\u6238": "VISSEL KOBE",
    "\u5948\u826f\u30af\u30e9\u30d6": "NARA CLUB",
    "\u5948\u826f": "NARA CLUB",
    "\u30ac\u30a4\u30ca\u30fc\u30ec\u9ce5\u53d6": "GAINARE TOTTORI",
    "\u9ce5\u53d6": "GAINARE TOTTORI",
    "\u30d5\u30a1\u30b8\u30a2\u30fc\u30ce\u5ca1\u5c71": "FAGIANO OKAYAMA",
    "\u5ca1\u5c71": "FAGIANO OKAYAMA",
    "\u30b5\u30f3\u30d5\u30ec\u30c3\u30c1\u30a7\u5e83\u5cf6": "SANFRECCE HIROSHIMA",
    "\u5e83\u5cf6": "SANFRECCE HIROSHIMA",
    "\u30ec\u30ce\u30d5\u30a1\u5c71\u53e3FC": "RENOFA YAMAGUCHI FC",
    "\u5c71\u53e3": "RENOFA YAMAGUCHI FC",
    "\u30ab\u30de\u30bf\u30de\u30fc\u30ec\u8b83\u5c90": "KAMATAMARE SANUKI",
    "\u8b83\u5c90": "KAMATAMARE SANUKI",
    "\u5fb3\u5cf6\u30f4\u30a9\u30eb\u30c6\u30a3\u30b9": "TOKUSHIMA VORTIS",
    "\u5fb3\u5cf6": "TOKUSHIMA VORTIS",
    "\u611b\u5a9bFC": "EHIME FC",
    "\u611b\u5a9b": "EHIME FC",
    "FC\u4eca\u6cbb": "FC IMABARI",
    "\u4eca\u6cbb": "FC IMABARI",
    "\u30a2\u30d3\u30b9\u30d1\u798f\u5ca1": "AVISPA FUKUOKA",
    "\u798f\u5ca1": "AVISPA FUKUOKA",
    "\u30ae\u30e9\u30f4\u30a1\u30f3\u30c4\u5317\u4e5d\u5dde": "GIRAVANZ KITAKYUSHU",
    "\u5317\u4e5d\u5dde": "GIRAVANZ KITAKYUSHU",
    "\u30b5\u30ac\u30f3\u9ce5\u6816": "SAGAN TOSU",
    "\u9ce5\u6816": "SAGAN TOSU",
    "V\u30fb\u30d5\u30a1\u30fc\u30ec\u30f3\u9577\u5d0e": "V-VAREN NAGASAKI",
    "\u9577\u5d0e": "V-VAREN NAGASAKI",
    "\u30ed\u30a2\u30c3\u30bd\u718a\u672c": "ROASSO KUMAMOTO",
    "\u718a\u672c": "ROASSO KUMAMOTO",
    "\u5927\u5206\u30c8\u30ea\u30cb\u30fc\u30bf": "OITA TRINITA",
    "\u5927\u5206": "OITA TRINITA",
    "\u30c6\u30b2\u30d0\u30b8\u30e3\u30fc\u30ed\u5bae\u5d0e": "TEGEVAJARO MIYAZAKI",
    "\u5bae\u5d0e": "TEGEVAJARO MIYAZAKI",
    "\u9e7f\u5150\u5cf6\u30e6\u30ca\u30a4\u30c6\u30c3\u30c9FC": "KAGOSHIMA UNITED FC",
    "\u9e7f\u5150\u5cf6": "KAGOSHIMA UNITED FC",
    "FC\u7409\u7403": "FC RYUKYU",
    "\u7409\u7403": "FC RYUKYU",
    "\u9ad8\u77e5\u30e6\u30ca\u30a4\u30c6\u30c3\u30c9SC": "KOCHI UNITED SC",
    "\u9ad8\u77e5": "KOCHI UNITED SC",
    "\u30ec\u30a4\u30e9\u30c3\u30af\u6ecb\u8cc0FC": "REILAC SHIGA FC",
    "\u6ecb\u8cc0": "REILAC SHIGA FC"
  };
  // --- Date/Theme Helpers ---
  function normalizeDateString(value) {
    return String(value || "").trim().replace(/\//g, "-");
  }
  function parseDate(s) {
    const [y, m, d] = normalizeDateString(s).split("-").map(Number);
    return new Date(y, m - 1, d || 1);
  }
  function isBeforeToday(dateStr) {
    const target = parseDate(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return target < today;
  }
    const normalizeName = (s) => (s || "").normalize("NFKC").trim();
    
    // Team name normalization mappings
const GLOBAL_TEAM_MAP = {
      "\u65b0\u6f5f": "\u65b0\u6f5f",
      "\u718a\u672c": "\u718a\u672c",
      "\u9ce5\u53d6": "\u9ce5\u53d6",
      "\u5bcc\u5c71": "\u5bcc\u5c71",
      "\u91d1\u6ca2": "\u91d1\u6ca2",
      "\u6e05\u6c34": "\u6e05\u6c34",
      "\u78d0\u7530": "\u78d0\u7530",
      "\u540d\u53e4\u5c4b": "\u540d\u53e4\u5c4b",
      "\u795e\u6236": "\u795e\u6238",
      "\u795e\u6238": "\u795e\u6238",
      "\u4eac\u90fd": "\u4eac\u90fd",
      "\u672d\u5e4c": "\u672d\u5e4c",
      "\u9e7f\u5cf6": "\u9e7f\u5cf6",
      "\u6d66\u548c": "\u6d66\u548c",
      "\u67cf": "\u67cf",
      "\u6e58\u5357": "\u6e58\u5357",
      "\u753a\u7530": "\u753a\u7530",
      "\u5ddd\u5d0e": "\u5ddd\u5d0e",
      "\u6a2a\u6d5cFM": "\u6a2a\u6d5cFM",
      "\u6a2a\u6d5cF\u30fb\u30de\u30ea\u30ce\u30b9": "\u6a2a\u6d5cFM",
      "\u5927\u5206": "\u5927\u5206",
      "\u798f\u5ca1": "\u798f\u5ca1",
      "\u9ce5\u6816": "\u9ce5\u6816",
      "\u9577\u5d0e": "\u9577\u5d0e",
      "\u5ca1\u5c71": "\u5ca1\u5c71",
      "\u5e83\u5cf6": "\u5e83\u5cf6",
      "\u5c71\u53e3": "\u5c71\u53e3",
      "\u5fb3\u5cf6": "\u5fb3\u5cf6",
      "\u8b83\u5c90": "\u8b83\u5c90",
      "\u5317\u4e5d\u5dde": "\u5317\u4e5d\u5dde",
      "\u5bae\u5d0e": "\u5bae\u5d0e",
      "\u516b\u6238": "\u516b\u6238",
      "\u76db\u5ca1": "\u76db\u5ca1",
      "\u79cb\u7530": "\u79cb\u7530",
      "\u5c71\u5f62": "\u5c71\u5f62",
      "\u4ed9\u53f0": "\u4ed9\u53f0",
      "\u6c34\u6238": "\u6c34\u6238",
      "\u7fa4\u99ac": "\u7fa4\u99ac",
      "\u5927\u5bae": "\u5927\u5bae",
      "\u5343\u8449": "\u5343\u8449",
      "\u7532\u5e9c": "\u7532\u5e9c",
      "\u9577\u91ce": "\u9577\u91ce",
      "\u677e\u672c": "\u677e\u672c",
      "\u9e7f\u5150\u5cf6": "\u9e7f\u5150\u5cf6",
      "\u6803\u6728SC": "\u6803\u6728",
      "\u6803\u6728": "\u6803\u6728",
      "\u6803\u6728C": "\u6803\u6728",
      "\u6803\u6728\u770c": "\u6803\u6728",
      "\u30bb\u30ec\u30c3\u30bd": "\u30bb\u30ec\u30c3\u30bd",
      "C\u5927\u962a": "\u30bb\u30ec\u30c3\u30bd",
      "\u30bb\u30ec\u30c3\u30bd\u5927\u962a": "\u30bb\u30ec\u30c3\u30bd",
      "\u30ac\u30f3\u30d0": "\u30ac\u30f3\u30d0",
      "G\u5927\u962a": "\u30ac\u30f3\u30d0",
      "\u30ac\u30f3\u30d0\u5927\u962a": "\u30ac\u30f3\u30d0",
      "FC\u6771\u4eac": "\u6771\u4eac",
      "\u6771\u4eacV": "\u6771\u4eacV",
      "\u6771\u4eac\u30f4\u30a7\u30eb\u30c7\u30a3": "\u6771\u4eacV",
      "FC\u5927\u962a": "\u5927\u962a",
      "FC\u4eca\u6cbb": "\u4eca\u6cbb",
      "\u4eca\u6cbb": "\u4eca\u6cbb",
      "FC\u5c90\u961c": "\u5c90\u961c",
      "FC\u7409\u7403": "\u7409\u7403"
    };
    // Emblem URL to team name mappings
const EMBLEM_MAP = {
      "niigata": "\u65b0\u6f5f",
      "kumamoto": "\u718a\u672c",
      "imabari": "\u4eca\u6cbb",
      "tosu": "\u9ce5\u6816",
      "kochi": "\u9ad8\u77e5",
      "ehime": "\u611b\u5a9b",
      "kyoto": "\u4eac\u90fd",
      "yamaguchi": "\u5c71\u53e3",
      "miyazaki": "\u5bae\u5d0e",
      "tottori": "\u9ce5\u53d6",
      "kagoshima": "\u9e7f\u5150\u5cf6",
      "ryukyu": "\u7409\u7403",
      "shiga": "\u6ecb\u8cc0",
      "oita": "\u5927\u5206",
      "kitakyushu": "\u5317\u4e5d\u5dde",
      "kanazawa": "\u91d1\u6ca2",
      "sanuki": "\u8b83\u5c90",
      "tokushima": "\u5fb3\u5cf6",
      "toyama": "\u5bcc\u5c71",
      "nara": "\u5948\u826f",
      "iwaki": "\u3044\u308f\u304d",
      "gifu": "\u5c90\u961c",
      "sapporo": "\u672d\u5e4c",
      "matsumoto": "\u677e\u672c",
      "nagano": "\u9577\u91ce",
      "iwata": "\u78d0\u7530",
      "fukushima": "\u798f\u5cf6",
      "kofu": "\u7532\u5e9c",
      "shonan": "\u6e58\u5357",
      "akita": "\u79cb\u7530",
      "yamagata": "\u5c71\u5f62",
      "yokohamafc": "\u6a2a\u6d5cFC",
      "yokohamafm": "\u6a2a\u6d5cFM",
      "sendai": "\u4ed9\u53f0",
      "hachinohe": "\u516b\u6238",
      "morioka": "\u76db\u5ca1",
      "gunma": "\u7fa4\u99ac",
      "mito": "\u6c34\u6238",
      "tochigi": "\u6803\u6728",
      "omiya": "\u5927\u5bae",
      "chiba": "\u5343\u8449",
      "sagamihara": "\u76f8\u6a21\u539f",
      "shimizu": "\u6e05\u6c34",
      "okayama": "\u5ca1\u5c71",
      "hiroshima": "\u5e83\u5cf6",
      "vissel": "\u795e\u6238",
      "g-osaka": "\u30ac\u30f3\u30d0",
      "c-osaka": "\u30bb\u30ec\u30c3\u30bd",
      "urawa": "\u6d66\u548c",
      "kashima": "\u9e7f\u5cf6",
      "kashiwa": "\u67cf",
      "tokyo": "\u6771\u4eac",
      "tokyov": "\u6771\u4eacV",
      "machida": "\u753a\u7530",
      "fosaka": "\u5927\u962a",
      "f-osaka": "\u5927\u962a",
      "iwate": "\u76db\u5ca1",
      "kusatsu": "\u7fa4\u99ac",
      "verdy": "\u6771\u4eacV",
      "marinos": "\u6a2a\u6d5cFM",
      "antlers": "\u9e7f\u5cf6",
      "reds": "\u6d66\u548c",
      "reysol": "\u67cf",
      "frontale": "\u5ddd\u5d0e",
      "bellmare": "\u6e58\u5357",
      "s-pulse": "\u6e05\u6c34",
      "jubilo": "\u78d0\u7530",
      "grampus": "\u540d\u53e4\u5c4b",
      "sanga": "\u4eac\u90fd",
      "gambaosaka": "\u30ac\u30f3\u30d0",
      "cerezoosaka": "\u30bb\u30ec\u30c3\u30bd",
      "vissel-k": "\u795e\u6238",
      "trinita": "\u5927\u5206",
      "avispa": "\u798f\u5ca1",
      "zelvia": "\u753a\u7530",
      "fagiano": "\u5ca1\u5c71",
      "sanfrecce": "\u5e83\u5cf6",
      "renofa": "\u5c71\u53e3",
      "vortis": "\u5fb3\u5cf6",
      "kamatamare": "\u8b83\u5c90",
      "giravanz": "\u5317\u4e5d\u5dde",
      "tegevajaro": "\u5bae\u5d0e"
    };
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
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.focus();
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    function bindClubNameLongPress(nameEl, card, match) {
      if (!nameEl) return;
      let timer = null;
      let startX = 0;
      let startY = 0;
      const clear = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };
      const start = (event) => {
        startX = event.clientX || 0;
        startY = event.clientY || 0;
        clear();
        timer = setTimeout(async () => {
          timer = null;
          card.dataset.suppressClick = "true";
          const text = getMatchCopyClubNames(match).join("\n");
          try {
            await copyText(text);
            showCopyToast("\u30af\u30e9\u30d6\u540d\u3092\u30b3\u30d4\ufffdE\u3057\u307e\u3057\u305f");
          } catch (error) {
            console.error(error);
            showCopyToast("\u30b3\u30d4\ufffdE\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
          }
        }, 620);
      };
      const move = (event) => {
        const dx = Math.abs((event.clientX || 0) - startX);
        const dy = Math.abs((event.clientY || 0) - startY);
        if (dx > 12 || dy > 12) clear();
      };
      nameEl.addEventListener("pointerdown", start);
      nameEl.addEventListener("pointermove", move);
      nameEl.addEventListener("pointerup", clear);
      nameEl.addEventListener("pointercancel", clear);
      nameEl.addEventListener("contextmenu", (event) => event.preventDefault());
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
        const res = await fetch("./club_emblems.json?v=20260513a");
        if (res.ok) {
          const json = await res.json();
          clubEmblemMap = { ...fromSchedule, ...json };
          return;
        }
      } catch (e) {
        console.warn("Club emblem map load failed", e);
      }
      clubEmblemMap = fromSchedule;
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
      if (mapped) return mapped;
      const direct = scheduleData.find(m => robustTeamMatch(m.opponent, teamName) || robustTeamMatch(getTeamKwFromEmblem(m.emblem), teamName));
      if (direct && direct.emblem) return direct.emblem;
      const reversed = Object.entries(EMBLEM_MAP).find(([, kw]) => robustTeamMatch(kw, teamName));
      return reversed ? `https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png` : "";
    }
    function resolveEmblemUrl(teamName, fallback = "") {
      return getEmblemUrlForTeam(teamName) || fallback || "";
    }
    function robustTeamMatch(name1, name2) {
      if (!name1 || !name2) return false;
      const n1 = normalizeName(name1).replace("\u306e\u8a66\u5408\u8a73\u7d30", "").replace("\u306e\u7d50\u679c", "").replace("SC", "").replace("FC", "").replace("F.C.", "");
      const n2 = normalizeName(name2).replace("\u306e\u8a66\u5408\u8a73\u7d30", "").replace("\u306e\u7d50\u679c", "").replace("SC", "").replace("FC", "").replace("F.C.", "");
      
      if (n1 === n2) return true;
      if (n1.length >= 2 && n2.length >= 2 && (n1.includes(n2) || n2.includes(n1))) return true;
      // \u30de\u30c3\u30d4\u30f3\u30b0\u306b\u3088\u308b\u89e3\u6c7a
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
      if (club === "niigata") return v.includes("\u30c1E\ufffdE\ufffd\ufffdE\ufffd\u30ab\u30d3\u30c3\u30b0\u30b9\u30ef\u30f3");
      if (club === "kumamoto") return v.includes("\u3048\u304c\u304a\u5065\u5eb7");
      return false;
    }
    function getMatchIsHome(match) {
      if (match && match.home_away === "H") return true;
      if (match && match.home_away === "A") return false;
      return isHomeMatch(match && match.club, match && match.venue);
    }
    async function updateWeatherUI(container, date, venue) {
      if (!container) return;
      const STADIUM_CITY_MAP = {
        "\u3048\u304c\u304a\u5065\u5eb7\u30b9\u30bf\u30b8\u30a2\u30e0": "\u718a\u672c\u5e02",
        "\u30c7\u30f3\u30ab\u30d3\u30c3\u30b0\u30b9\u30ef\u30f3\u30b9\u30bf\u30b8\u30a2\u30e0": "\u65b0\u6f5f\u5e02",
        "\u5473\u306e\u7d20\u30b9\u30bf\u30b8\u30a2\u30e0": "\u8abf\u5e03\u5e02",
        "\u8c4a\u7530\u30b9\u30bf\u30b8\u30a2\u30e0": "\u8c4a\u7530\u5e02",
        "\u30d1\u30ca\u30bd\u30cb\u30c3\u30af\u30b9\u30bf\u30b8\u30a2\u30e0\u5439\u7530": "\u5439\u7530\u5e02",
        "\u57fc\u7389\u30b9\u30bf\u30b8\u30a2\u30e02002": "\u3055\u3044\u305f\u307e\u5e02\u7dd1\u533a",
        "\u30e8\u30c9\u30b3\u30a6\u685c\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5927\u962a\u5e02\u6771\u4f4f\u5409\u533a",
        "\u65e5\u7523\u30b9\u30bf\u30b8\u30a2\u30e0": "\u6a2a\u6d5c\u5e02\u6e2f\u5317\u533a",
        "\u30cb\u30c3\u30d1\u30c4\u4e09\u30c4\u6ca2\u7403\u6280\u5834": "\u6a2a\u6d5c\u5e02\u795e\u5948\u5ddd\u533a",
        "\u30ec\u30e2\u30f3\u30ac\u30b9\u30b9\u30bf\u30b8\u30a2\u30e0\u5e73\u585a": "\u5e73\u585a\u5e02",
        "\u30b5\u30f3\u30ac\u30b9\u30bf\u30b8\u30a2\u30e0 by KYOCERA": "\u4e80\u5ca1\u5e02",
        "\u30a8\u30c7\u30a3\u30aa\u30f3\u30d4\u30fc\u30b9\u30a6\u30a4\u30f3\u30b0\u5e83\u5cf6": "\u5e83\u5cf6\u5e02\u4e2d\u533a",
        "\u30d9\u30b9\u30c8\u96fb\u5668\u30b9\u30bf\u30b8\u30a2\u30e0": "\u798f\u5ca1\u5e02\u535a\u591a\u533a",
        "\u99c5\u524d\u4e0d\u52d5\u7523\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9ce5\u6816\u5e02",
        "\u662d\u548c\u96fb\u5de5\u30c9\u30fc\u30e0\u5927\u5206": "\u5927\u5206\u5e02",
        "\u30c9\u30fc\u30e0\u5927\u5206": "\u5927\u5206\u5e02",
        "\u30e6\u30a2\u30c6\u30c3\u30af\u30b9\u30bf\u30b8\u30a2\u30e0\u4ed9\u53f0": "\u4ed9\u53f0\u5e02\u6cc9\u533a",
        "IAI\u30b9\u30bf\u30b8\u30a2\u30e0\u65e5\u672c\u5e73": "\u9759\u5ca1\u5e02\u6e05\u6c34\u533a",
        "\u30a8\u30b3\u30d1\u30b9\u30bf\u30b8\u30a2\u30e0": "\u888b\u4e95\u5e02",
        "\u30e4\u30de\u30cf\u30b9\u30bf\u30b8\u30a2\u30e0": "\u78d0\u7530\u5e02",
        "\u30c8\u30e9\u30f3\u30b9\u30b3\u30b9\u30e2\u30b9\u30b9\u30bf\u30b8\u30a2\u30e0\u9577\u5d0e": "\u8aeb\u65e9\u5e02",
        "PEACE STADIUM Connected by SoftBank": "\u9577\u5d0e\u5e02",
        "\u30d5\u30af\u30c0\u96fb\u5b50\u30a2\u30ea\u30fc\u30ca": "\u5343\u8449\u5e02\u4e2d\u592e\u533a",
        "\u4e09\u5354\u30d5\u30ed\u30f3\u30c6\u30a2\u67cf\u30b9\u30bf\u30b8\u30a2\u30e0": "\u67cf\u5e02",
        "\u30b7\u30c6\u30a3\u30e9\u30a4\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5ca1\u5c71\u5e02\u5317\u533a",
        "JFE\u6674\u308c\u3084\u304b\u56fd\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5ca1\u5c71\u5e02\u5317\u533a",
        "\u7dad\u65b0\u307f\u3089\u3044\u3075\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5c71\u53e3\u5e02",
        "\u30dd\u30ab\u30ea\u30b9\u30a8\u30c3\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9cf4\u9580\u5e02",
        "\u9cf4\u9580\u30fb\u5927\u585a\u30b9\u30dd\u30fc\u30c4\u30d1\u30fc\u30af \u30dd\u30ab\u30ea\u30b9\u30a8\u30c3\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9cf4\u9580\u5e02",
        "\u30cb\u30f3\u30b8\u30cb\u30a2\u30b9\u30bf\u30b8\u30a2\u30e0": "\u677e\u5c71\u5e02",
        "ND\u30bd\u30d5\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0\u5c71\u5f62": "\u5929\u7ae5\u5e02",
        "\u30bd\u30e6\u30fc\u30b9\u30bf\u30b8\u30a2\u30e0": "\u79cb\u7530\u5e02",
        "NACK5\u30b9\u30bf\u30b8\u30a2\u30e0\u5927\u5bae": "\u3055\u3044\u305f\u307e\u5e02\u5927\u5bae\u533a",
        "\u30b1\u30fc\u30ba\u30c7\u30f3\u30ad\u30b9\u30bf\u30b8\u30a2\u30e0\u6c34\u6238": "\u6c34\u6238\u5e02",
        "\u30ab\u30f3\u30bb\u30ad\u30b9\u30bf\u30b8\u30a2\u30e0\u3068\u3061\u304e": "\u5b87\u90fd\u5bae\u5e02",
        "\u6b63\u7530\u91a4\u6cb9\u30b9\u30bf\u30b8\u30a2\u30e0\u7fa4\u99ac": "\u524d\u6a4b\u5e02",
        "\u30cf\u30ef\u30a4\u30a2\u30f3\u30ba\u30b9\u30bf\u30b8\u30a2\u30e0\u3044\u308f\u304d": "\u3044\u308f\u304d\u5e02",
        "\u3068\u3046\u307b\u3046\u30fb\u307f\u3093\u306a\u306e\u30b9\u30bf\u30b8\u30a2\u30e0": "\u798f\u5cf6\u5e02",
        "\u30d7\u30e9\u30a4\u30d5\u30fc\u30ba\u30b9\u30bf\u30b8\u30a2\u30e0": "\u516b\u6238\u5e02",
        "\u3044\u308f\u304e\u3093\u30b9\u30bf\u30b8\u30a2\u30e0": "\u76db\u5ca1\u5e02",
        "JIT \u30ea\u30b5\u30a4\u30af\u30eb\u30a4\u30f3\u30af \u30b9\u30bf\u30b8\u30a2\u30e0": "\u7532\u5e9c\u5e02",
        "\u30b5\u30f3\u30d7\u30ed \u30a2\u30eb\u30a6\u30a3\u30f3": "\u677e\u672c\u5e02",
        "\u9577\u91ceU\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9577\u91ce\u5e02",
        "\u5bcc\u5c71\u770c\u7dcf\u5408\u904b\u52d5\u516c\u5712\u9678\u4e0a\u7af6\u6280\u5834": "\u5bcc\u5c71\u5e02",
        "\u77f3\u5ddd\u770c\u897f\u90e8\u7dd1\u5730\u516c\u5712\u9678\u4e0a\u7af6\u6280\u5834": "\u91d1\u6ca2\u5e02",
        "\u91d1\u6ca2\u30b4\u30fc\u30b4\u30fc\u30ab\u30ec\u30fc\u30b9\u30bf\u30b8\u30a2\u30e0": "\u91d1\u6ca2\u5e02",
        "\u85e4\u679d\u7dcf\u5408\u904b\u52d5\u516c\u5712\u30b5\u30c3\u30ab\u30fc\u5834": "\u85e4\u679d\u5e02",
        "\u611b\u9df9\u5e83\u57df\u516c\u5712\u591a\u76ee\u7684\u7af6\u6280\u5834": "\u6cbc\u6d25\u5e02",
        "\u9577\u826f\u5ddd\u7af6\u6280\u5834": "\u5c90\u961c\u5e02",
        "\u6771\u5927\u962a\u5e02\u82b1\u5712\u30e9\u30b0\u30d3\u30fc\u5834": "\u6771\u5927\u962a\u5e02",
        "\u30ed\u30fc\u30c8\u30d5\u30a3\u30fc\u30eb\u30c9\u5948\u826f": "\u5948\u826f\u5e02",
        "Axis\u30d0\u30fc\u30c9\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9ce5\u53d6\u5e02",
        "\u30c1\u30e5\u30a6\u30d6YAJIN\u30b9\u30bf\u30b8\u30a2\u52a0": "\u7c73\u5b50\u5e02",
        "\u30c1\u30e5\u30a6\u30d6YAJIN\u30b9\u30bf\u30b8\u30a2\u30e0": "\u7c73\u5b50\u5e02",
        "Pikara\u30b9\u30bf\u30b8\u30a2\u30e0": "\u4e38\u4e80\u5e02",
        "\u56db\u56fd\u5316\u6210MEGLIO\u30b9\u30bf\u30b8\u30a2\u30e0": "\u4e38\u4e80\u5e02",
        "\u30a2\u30b7\u30c3\u30af\u30b9\u91cc\u5c71\u30b9\u30bf\u30b8\u30a2\u30e0": "\u4eca\u6cbb\u5e02",
        "\u30df\u30af\u30cb\u30ef\u30fc\u30eb\u30c9\u30b9\u30bf\u30b8\u30a2\u30e0\u5317\u4e5d\u5dde": "\u5317\u4e5d\u5dde\u5e02\u5c0f\u5009\u5317\u533a",
        "\u3044\u3061\u3054\u5bae\u5d0e\u65b0\u5bcc\u30b5\u30c3\u30ab\u30fc\u5834": "\u65b0\u5bcc\u753a",
        "\u767d\u6ce2\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9e7f\u5150\u5cf6\u5e02",
        "\u30bf\u30d4\u30c3\u30af\u770c\u7dcf\u3072\u3084\u3054\u3093\u30b9\u30bf\u30b8\u30a2\u30e0": "\u6c96\u7e04\u5e02",
        "Uvance\u3068\u3069\u308d\u304d\u30b9\u30bf\u30b8\u30a2\u30e0 by Fujitsu": "\u5ddd\u5d0e\u5e02\u4e2d\u539f\u533a",
        "\u5927\u548c\u30cf\u30a6\u30b9 \u30d7\u30ec\u30df\u30b9\u30c8\u30c9\u30fc\u30e0": "\u672d\u5e4c\u5e02\u8c4a\u5e73\u533a",
        "\u5e73\u548c\u5802HATO\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5f66\u6839\u5e02"
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
                  <span style="font-size:0.9rem; color:#999;">\u2103</span>
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
      if (nextNiigata && getMatchIsHome(nextNiigata)) {
        const mDate = parseDate(nextNiigata.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((mDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) showNGate = true;
      }
      if (showNGate) {
        container.innerHTML = `<a href="https://www.albirex.co.jp/ticket/ngate/form/" target="_blank" class="btn-ngate-header">N\u30b2\u30fc\u30c8\u62bd\u9078</a>`;
      } else {
        container.innerHTML = "";
      }
    }
  // --- View Management ---
  function ensureVisionFrame() {
    const frame = document.querySelector("#vision-view .vision-app-frame");
    if (frame && !frame.getAttribute("src")) {
      frame.setAttribute("src", frame.dataset.src);
    }
  }
  function switchMode(mode) {
    currentMode = mode;
    document.body.setAttribute("data-mode", mode);
    if (ultraDashboard) ultraDashboard.className = mode === "dashboard" ? "active-view" : "hidden-view";
    if (ultraFeed) ultraFeed.className = mode === "feed" ? "active-view" : "hidden-view";
    if (calendarView) calendarView.className = mode === "calendar" ? "active-view" : "hidden-view";
    if (visionView) visionView.className = mode === "vision" ? "active-view" : "hidden-view";
    if (mode === "calendar") renderCalendar();
    if (mode === "dashboard") renderDashboard();
    if (mode === "vision") ensureVisionFrame();
    if (mode === "feed") {
      requestAnimationFrame(() => scrollToIndex(currentIndex));
    }
    if (hamBtn) hamBtn.innerHTML = (mode === "vision") ? ellipsisIconHtml : hamburgerIconHtml;
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
  function getPivotYear() {
    if (selectedYear !== null) return Number(selectedYear);
    if (visibleSections[currentIndex]) {
      const ym = visibleSections[currentIndex].dataset.ym || "";
      const y = parseInt(ym.split("-")[0], 10);
      if (y) return y;
    }
    return new Date().getFullYear();
  }
  function getDisplayYears(allYears, pivotYear) {
    if (!allYears.length) return [];
    const pivot = Number(pivotYear);
    const set = new Set(allYears.filter(y => Math.abs(y - pivot) <= 1));
    if (set.size < 3) {
      const pivotIndex = allYears.includes(pivot)
        ? allYears.indexOf(pivot)
        : allYears.findIndex(y => y > pivot);
      const startIndex = pivotIndex === -1 ? allYears.length - 1 : Math.max(0, pivotIndex);
      let left = startIndex - 1;
      let right = startIndex + 1;
      set.add(allYears[startIndex]);
      while (set.size < 3 && (left >= 0 || right < allYears.length)) {
        if (left >= 0) set.add(allYears[left--]);
        if (set.size >= 3) break;
        if (right < allYears.length) set.add(allYears[right++]);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }
  function rebuildYearTabs() {
    if (!yearTabContainer) return;
    yearTabContainer.innerHTML = "";
    yearTabs = {};
    const allYears = Array.from(new Set(scheduleData
      .map(m => parseDate(m.date).getFullYear())
      .filter(Boolean)))
      .sort((a, b) => a - b);
    if (!allYears.length) return;
    const displayYears = allYears;
    displayYears.forEach(y => {
      const yStr = String(y);
      const btn = document.createElement("button");
      btn.id = `toggle-year-${yStr}`;
      btn.className = "year-tab";
      btn.textContent = yStr;
      btn.onclick = () => {
        applyYearFilter(y);
      };
      yearTabContainer.appendChild(btn);
      yearTabs[yStr] = btn;
    });
    const allBtn = document.createElement("button");
    allBtn.id = "toggle-year-all";
    allBtn.className = "year-tab";
    allBtn.textContent = "ALL";
    allBtn.onclick = () => goToCurrentMonthAll();
    yearTabContainer.appendChild(allBtn);
    yearTabs.all = allBtn;
    // \u73fe\u5728\u306e\u9078\u629e\u72b6\u614b\u3092\u53cd\u6620
    Object.keys(yearTabs).forEach(k => {
      const isActive = (k === "all" && selectedYear === null) || (Number(k) === selectedYear);
      if (yearTabs[k]) yearTabs[k].classList.toggle("active", isActive);
    });
    requestAnimationFrame(() => {
      const activeTab = yearTabContainer.querySelector(".year-tab.active");
      if (activeTab && typeof activeTab.scrollIntoView === "function") {
        activeTab.scrollIntoView({ inline: "center", block: "nearest" });
      }
    });
  }
  function getCurrentMonthKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  }
  function goToCurrentMonthAll() {
    applyYearFilter(null, true);
    const idx = visibleSections.findIndex(s => s.dataset.ym === getCurrentMonthKey());
    scrollToIndex(idx !== -1 ? idx : 0);
  }
  function applyYearFilter(year, skipScroll = false) {
    selectedYear = year === null || year === undefined ? null : Number(year);
    rebuildYearTabs();
    allSections.forEach(sec => {
      const y = Number(sec.dataset.year || 0);
      sec.style.display = (selectedYear === null || y === selectedYear) ? "flex" : "none";
    });
    rebuildVisibleSections();
    if (!skipScroll) { currentIndex = 0; scrollToIndex(0); }
    if (currentMode === "calendar") renderCalendar();
  }
  if (yearTabContainer) {
    yearTabContainer.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      yearTabContainer.scrollLeft += event.deltaY;
    }, { passive: false });
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
      // \u89b3\u6226\u4e88\u5b9a / \u30cf\u30a4\u30e9\u30a4\u30c8\u5224\u5b9a
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
  function openMatchPicker(matches) {
    pickerList.innerHTML = matches.map(m => `
      <div class="picker-item" data-date="${m.date}" data-club="${m.club}" data-opp="${m.opponent}">
        <span class="picker-club ${m.club}">${m.club === 'niigata' ? '\u65b0\u6f5f' : '\u718a\u672c'}</span>
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
  function compactPlayerName(value) {
    return String(value || "").normalize("NFKC").replace(/[\s\u3000\u30fb.\-_]/g, "").toLowerCase();
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
  function parseScorePair(score) {
    const parts = String(score || "").match(/(\d+)\s*[-:]\s*(\d+)/);
    return parts ? { my: Number(parts[1]), opp: Number(parts[2]) } : null;
  }
  function getStoredOrOfficialScore(match) {
    const mId = `${match.date}_${match.club}_${match.opponent}`;
    const storedMy = localStorage.getItem(`score_my_${mId}`);
    const storedOpp = localStorage.getItem(`score_opp_${mId}`);
    const hasStored = storedMy !== null && storedOpp !== null && storedMy !== "" && storedOpp !== "";
    if (hasStored) {
      return {
        my: storedMy,
        opp: storedOpp,
        pkMy: localStorage.getItem(`score_my_pk_${mId}`) || "",
        pkOpp: localStorage.getItem(`score_opp_pk_${mId}`) || ""
      };
    }
    const official = findOfficialResult(match);
    const parsed = parseScorePair((official && official.score) || match.score || "");
    if (!parsed) return { my: "", opp: "", pkMy: "", pkOpp: "" };
    return { my: String(parsed.my), opp: String(parsed.opp), pkMy: "", pkOpp: "" };
  }
  function getScoreMetaFromValues(my, opp, pkMy = "", pkOpp = "") {
    if (my === "" || opp === "" || my === null || opp === null) return null;
    const ms = Number(my), os = Number(opp);
    if (!Number.isFinite(ms) || !Number.isFinite(os)) return null;
    if (ms === os && pkMy !== "" && pkOpp !== "") {
      const pm = Number(pkMy), po = Number(pkOpp);
      return {
        result: pm > po ? "pk-win" : "pk-lose",
        score: `(${pkMy}) ${ms} - ${os} (${pkOpp})`
      };
    }
    return {
      result: ms > os ? "win" : ms < os ? "lose" : "draw",
      score: `${ms} - ${os}`
    };
  }
  function getRefereeValues(referees) {
    const entries = referees && typeof referees === "object" ? Object.entries(referees).filter(([, value]) => value) : [];
    const findBy = (patterns, fallbackIndex) => {
      const found = entries.find(([key]) => patterns.some(pattern => String(key).includes(pattern)));
      return found ? found[1] : (entries[fallbackIndex] ? entries[fallbackIndex][1] : "");
    };
    return {
      referee: findBy(["主審", "main", "referee"], 0),
      assistants: String(findBy(["副審", "assistant"], 1) || "").split(",").map(s => s.trim()).filter(Boolean)
    };
  }
  function mapMemberList(players) {
    return Array.isArray(players) ? players.map(p => ({
      position: p.position || "",
      number: p.number || "",
      name: p.name || ""
    })) : [];
  }
  function mapSubstitutions(details) {
    const substitutions = [];
    const rawSubs = details && Array.isArray(details.substitutions) ? details.substitutions : [];
    for (let i = 0; i < rawSubs.length; i += 2) {
      const outPlayer = rawSubs[i];
      const inPlayer = rawSubs[i + 1];
      if (outPlayer && inPlayer) {
        substitutions.push({
          minute: outPlayer.time ? outPlayer.time.replace("'", "") : "",
          out: outPlayer.name,
          in: inPlayer.name
        });
      }
    }
    return substitutions;
  }
  function mapWarnings(details) {
    const rawCards = details && Array.isArray(details.cards) ? details.cards : [];
    return rawCards.map(c => ({
      minute: c.time ? c.time.replace("'", "") : "",
      player: c.name
    }));
  }
  function renderOfficialInfo(match) {
    const primary = [
      ["RESULT", match.result_mark],
      ["SCORE", match.score],
      ["STAGE", match.stage || match.matchweek],
      ["COMP", match.tournament]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    const items = [
      ["\u5929\u6c17", match.weather],
      ["\u6c17\u6e29", match.temperature !== undefined && match.temperature !== null ? `${match.temperature}\u2103` : ""],
      ["\u6e7f\u5ea6", match.humidity !== undefined && match.humidity !== null ? (String(match.humidity).includes("%") ? String(match.humidity) : `${match.humidity}%`) : ""],
      ["\u5165\u5834\u8005", match.attendance !== undefined && match.attendance !== null ? `${Number(match.attendance).toLocaleString("ja-JP")}\u4eba` : ""],
      ["\u4e3b\u5be9", match.referee],
      ["\u526f\u5be9", Array.isArray(match.assistant_referees) ? match.assistant_referees.join(" / ") : ""],
      ["\u76e3\u7763", match.manager]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    if (!primary.length && !items.length && !match.j_official_url) return "";
    return `
      <section class="u-match-record">
        <div class="u-section-head">
          <h4>\u516c\u5f0f\u8a18\u9332</h4>
          ${match.j_official_url ? `<a class="u-official-link" href="${escapeHtml(match.j_official_url)}" target="_blank" rel="noopener">DATA SITE</a>` : ""}
        </div>
        ${primary.length ? `
          <div class="u-record-primary">
            ${primary.map(([label, value]) => `
              <div class="u-record-primary-item">
                <span>${escapeHtml(label)}</span>
                <strong>${formatRecordValue(value)}</strong>
              </div>
            `).join("")}
          </div>
        ` : ""}
        <div class="u-record-pills">
          ${items.map(([label, value]) => `
            <div class="u-record-item">
              <span>${escapeHtml(label)}</span>
              <strong>${formatRecordValue(value)}</strong>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }
  function renderMemberList(title, members, type, teamClass = "") {
    if (!Array.isArray(members) || !members.length) return "";
    const rows = members.map(member => {
      const name = getMemberName(member);
      const position = typeof member === "object" && member ? member.position : "";
      const number = typeof member === "object" && member ? member.number : "";
      const hasMeta = Boolean(number || position);
      return `
        <li class="u-member-row ${type} ${hasMeta ? "" : "simple"}">
          ${hasMeta ? `
            <span class="u-member-meta">
              ${number ? `<span class="u-member-number">${escapeHtml(number)}</span>` : `<span class="u-member-number muted">-</span>`}
              ${position ? `<span class="u-member-position">${escapeHtml(position)}</span>` : ""}
            </span>
          ` : ""}
          <span class="u-member-name">${renderPlayerButton(name)}</span>
        </li>
      `;
    }).join("");
    return `
      <div class="u-member-block ${type} ${teamClass}">
        <h5>${escapeHtml(title)}</h5>
        <ul>${rows}</ul>
      </div>
    `;
  }
  function renderTeamMembers(title, starters, bench, teamClass) {
    const starterHtml = renderMemberList("STARTING XI", starters, "starter", teamClass);
    const benchHtml = renderMemberList("BENCH", bench, "bench", teamClass);
    if (!starterHtml && !benchHtml) return "";
    return `
      <div class="u-member-team ${teamClass}">
        <div class="u-member-team-title">${escapeHtml(title)}</div>
        <div class="u-member-columns">
          ${starterHtml}
          ${benchHtml}
        </div>
      </div>
    `;
  }
  function renderMatchMembers(match) {
    const ownTitle = match.club === "niigata" ? "\u65b0\u6f5f" : "\u718a\u672c";
    const opponentTitle = match.opponent || "\u76f8\u624b";
    const ownHtml = renderTeamMembers(ownTitle, match.starting_members, match.bench_members, "own");
    const opponentHtml = renderTeamMembers(opponentTitle, match.opponent_starting_members, match.opponent_bench_members, "opponent");
    if (!ownHtml && !opponentHtml) return "";
    const totalPlayers = [
      ...(match.starting_members || []),
      ...(match.bench_members || []),
      ...(match.opponent_starting_members || []),
      ...(match.opponent_bench_members || [])
    ].length;
    return `
      <section class="u-match-members">
        <div class="u-section-head">
          <h4>\u30e1\u30f3\u30d0\u30fc</h4>
          <span>${totalPlayers} PLAYERS</span>
        </div>
        <div class="u-member-team-tabs">
          ${ownHtml ? `<button type="button" class="u-member-team-tab active" data-member-team="own">${escapeHtml(ownTitle)}</button>` : ""}
          ${opponentHtml ? `<button type="button" class="u-member-team-tab ${ownHtml ? "" : "active"}" data-member-team="opponent">${escapeHtml(opponentTitle)}</button>` : ""}
        </div>
        <div class="u-member-team-panels">
          ${ownHtml}
          ${opponentHtml}
        </div>
      </section>
    `;
  }
  function renderMatchEvents(match) {
    const goals = Array.isArray(match.goals) ? match.goals : [];
    const opponentGoals = Array.isArray(match.opponent_goals) ? match.opponent_goals : [];
    const substitutions = Array.isArray(match.substitutions) ? match.substitutions : [];
    const warnings = Array.isArray(match.warnings) ? match.warnings : [];
    const opponentSubstitutions = Array.isArray(match.opponent_substitutions) ? match.opponent_substitutions : [];
    const opponentWarnings = Array.isArray(match.opponent_warnings) ? match.opponent_warnings : [];
    if (!goals.length && !opponentGoals.length && !substitutions.length && !warnings.length && !opponentSubstitutions.length && !opponentWarnings.length) return "";
    const goalHtml = (goals.length || opponentGoals.length) ? `
      <div class="u-event-block">
        <h5>\u5f97\u70b9</h5>
        <ul>
          ${goals.map(goal => `
            <li>
              <span class="u-event-minute">${escapeHtml(goal.minute || "")}'</span>
              <strong class="u-event-team">\u81ea\u30c1\u30fc\u30e0</strong>
              ${renderPlayerButton(goal.scorer)}
            </li>
          `).join("")}
          ${opponentGoals.map(goal => `
            <li>
              <span class="u-event-minute">${escapeHtml(goal.minute || "")}'</span>
              <strong class="u-event-team">\u76f8\u624b</strong>
              ${renderPlayerButton(goal.scorer)}
            </li>
          `).join("")}
        </ul>
      </div>
    ` : "";
    const subHtml = (substitutions.length || opponentSubstitutions.length) ? `
      <div class="u-event-block">
        <h5>\u4ea4\u4ee3</h5>
        <ul>
          ${substitutions.map(sub => `
            <li>
              <span class="u-event-minute">${escapeHtml(sub.minute || "")}'</span>
              <span class="u-sub-out">${renderPlayerButton(sub.out)}</span>
              <span class="u-sub-arrow">\u2192</span>
              <span class="u-sub-in">${renderPlayerButton(sub.in)}</span>
            </li>
          `).join("")}
          ${opponentSubstitutions.map(sub => `
            <li>
              <span class="u-event-minute">${escapeHtml(sub.minute || "")}'</span>
              <strong class="u-event-team">\u76f8\u624b</strong>
              <span class="u-sub-out">${renderPlayerButton(sub.out)}</span>
              <span class="u-sub-arrow">\u2192</span>
              <span class="u-sub-in">${renderPlayerButton(sub.in)}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    ` : "";
    const warnHtml = (warnings.length || opponentWarnings.length) ? `
      <div class="u-event-block">
        <h5>\u8b66\u544a</h5>
        <ul>
          ${warnings.map(warn => `
            <li>
              <span class="u-event-minute">${escapeHtml(warn.minute || "")}'</span>
              ${renderPlayerButton(warn.player)}
            </li>
          `).join("")}
          ${opponentWarnings.map(warn => `
            <li>
              <span class="u-event-minute">${escapeHtml(warn.minute || "")}'</span>
              <strong class="u-event-team">\u76f8\u624b</strong>
              ${renderPlayerButton(warn.player)}
            </li>
          `).join("")}
        </ul>
      </div>
    ` : "";
    return `
      <section class="u-match-events">
        <h4>\u8a66\u5408\u30a4\u30d9\u30f3\u30c8</h4>
        ${goalHtml}
        ${subHtml}
        ${warnHtml}
      </section>
    `;
  }
  function getPlayerRoleForMatch(match, playerKey) {
    const teams = [
      {
        label: match.club === "niigata" ? "\u65b0\u6f5f" : "\u718a\u672c",
        starters: Array.isArray(match.starting_members) ? match.starting_members : [],
        bench: Array.isArray(match.bench_members) ? match.bench_members : [],
        subs: Array.isArray(match.substitutions) ? match.substitutions : []
      },
      {
        label: match.opponent || "\u76f8\u624b",
        starters: Array.isArray(match.opponent_starting_members) ? match.opponent_starting_members : [],
        bench: Array.isArray(match.opponent_bench_members) ? match.opponent_bench_members : [],
        subs: Array.isArray(match.opponent_substitutions) ? match.opponent_substitutions : []
      }
    ];
    for (const team of teams) {
    const starters = team.starters;
    const bench = team.bench;
    const subs = team.subs;
    const starter = starters.find(member => compactPlayerName(getMemberName(member)) === playerKey);
    const benchMember = bench.find(member => compactPlayerName(getMemberName(member)) === playerKey);
    const subIn = subs.find(sub => compactPlayerName(sub.in) === playerKey);
    const subOut = subs.find(sub => compactPlayerName(sub.out) === playerKey);
    if (starter) {
      return {
        appeared: true,
        squad: true,
        role: `${team.label} \u5148\u767a` + (subOut ? ` (${subOut.minute}' OUT)` : ""),
        number: starter.number || "",
        position: starter.position || "",
        name: getMemberName(starter)
      };
    }
    if (subIn) {
      return {
        appeared: true,
        squad: true,
        role: `${team.label} ${subIn.minute}' IN`,
        number: "",
        position: "",
        name: subIn.in || ""
      };
    }
    if (benchMember) {
      return { appeared: false, squad: true, role: `${team.label} \u30d9\u30f3\u30c1`, number: "", position: "", name: getMemberName(benchMember) };
    }
    }
    return { appeared: false, squad: false, role: "", number: "", position: "", name: "" };
  }
  function getPlayerGoals(playerName) {
    const playerKey = compactPlayerName(playerName);
    const goals = [];
    getResultArray(officialResults).forEach(result => {
      (result.goals || []).forEach(goal => {
        if (compactPlayerName(goal.scorer) !== playerKey) return;
        const match = scheduleData.find(m => {
          return m.club === result.club &&
            m.date === result.date &&
            (!result.opponent || robustTeamMatch(m.opponent, result.opponent));
        });
        goals.push({ result, goal, match });
      });
    });
    return goals.sort((a, b) => parseDate(a.result.date) - parseDate(b.result.date));
  }
  function buildPlayerProfile(playerName) {
    const playerKey = compactPlayerName(playerName);
    const squadMatches = [];
    const appearances = [];
    const numbers = new Set();
    const positions = new Set();
    let displayName = playerName;
    let playerClub = "niigata";
    scheduleData
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
      .forEach(match => {
        const role = getPlayerRoleForMatch(match, playerKey);
        if (!role.squad) return;
        playerClub = match.club;
        if (role.name) displayName = role.name;
        if (role.number) numbers.add(String(role.number));
        if (role.position) positions.add(role.position);
        const row = { match, role };
        squadMatches.push(row);
        if (role.appeared) appearances.push(row);
      });
    const goals = getPlayerGoals(playerName);
    return { playerName: displayName, numbers, positions, squadMatches, appearances, goals, club: playerClub };
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
          <span>${escapeHtml(match.stage || match.matchweek || "")} ${getMatchIsHome(match) ? "HOME" : "AWAY"}</span>
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
    const profile = buildPlayerProfile(playerName);
    const numbers = Array.from(profile.numbers).join(" / ") || "\u672a\u8a18\u9332";
    const positions = Array.from(profile.positions).join(" / ") || "\u672a\u8a18\u9332";
    const clubLabel = profile.club === "niigata" ? "ALBIREX NIIGATA" : profile.club === "kumamoto" ? "ROASSO KUMAMOTO" : "";
    const years = Array.from(new Set([
      ...profile.squadMatches.map(item => parseDate(item.match.date).getFullYear()),
      ...profile.goals.map(item => parseDate(item.result.date).getFullYear())
    ].filter(Boolean))).sort((a, b) => b - a);
    const renderGoalRow = (item) => {
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
    };
    const yearTabsHtml = years.length
      ? years.map((year, index) => `<button class="u-player-year-tab ${index === 0 ? "active" : ""}" data-year="${year}">${year}</button>`).join("")
      : "";
    const yearPanelsHtml = years.length
      ? years.map((year, index) => {
        const appearances = profile.appearances.filter(item => parseDate(item.match.date).getFullYear() === year);
        const goals = profile.goals.filter(item => parseDate(item.result.date).getFullYear() === year);
        const squad = profile.squadMatches.filter(item => parseDate(item.match.date).getFullYear() === year);
        return `
          <div class="u-player-year-panel ${index === 0 ? "active" : ""}" data-year-panel="${year}">
            <div class="u-player-year-summary">
              <span>\u30e1\u30f3\u30d0\u30fc\u5165\u308a <strong>${squad.length}</strong></span>
              <span>\u51fa\u5834 <strong>${appearances.length}</strong></span>
              <span>\u5f97\u70b9 <strong>${goals.length}</strong></span>
            </div>
            <div class="u-player-list-group">
              <h4>\u51fa\u5834\u8a66\u5408</h4>
              <ul class="u-player-scroll-list">${appearances.length ? appearances.map(renderPlayerMatchRow).join("") : `<li class="u-empty-row">\u3053\u306e\u5e74\u306e\u51fa\u5834\u8a18\u9332\u306f\u3042\u308a\u307e\u305b\u3093</li>`}</ul>
            </div>
            <div class="u-player-list-group">
              <h4>\u5f97\u70b9\u3057\u305f\u8a66\u5408</h4>
              <ul class="u-player-scroll-list compact">${goals.length ? goals.map(renderGoalRow).join("") : `<li class="u-empty-row">\u3053\u306e\u5e74\u306e\u5f97\u70b9\u8a18\u9332\u306f\u3042\u308a\u307e\u305b\u3093</li>`}</ul>
            </div>
          </div>
        `;
      }).join("")
      : `<div class="u-player-year-panel active"><li class="u-empty-row">\u8a18\u9332\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f</li></div>`;
    sheetContent.innerHTML = `
      <section class="u-player-profile">
        <button type="button" class="u-player-back">\u2190 \u8a66\u5408\u8a73\u7d30\u3078\u623b\u308b</button>
        <div class="u-player-header">
          ${clubLabel ? `<span class="u-player-club-label">${clubLabel}</span>` : ""}
          <h2>${escapeHtml(profile.playerName)}</h2>
        </div>
        <div class="u-player-card-grid">
          <div class="u-player-card">
            <span class="u-card-label">\u80cc\u756a\u53f7</span>
            <strong class="u-card-value">${escapeHtml(numbers)}</strong>
          </div>
          <div class="u-player-card">
            <span class="u-card-label">\u30dd\u30b8\u30b7\u30e7\u30f3</span>
            <strong class="u-card-value">${escapeHtml(positions)}</strong>
          </div>
          <div class="u-player-card">
            <span class="u-card-label">\u51fa\u5834\u8a66\u5408</span>
            <strong class="u-card-value">${profile.appearances.length}</strong>
          </div>
          <div class="u-player-card">
            <span class="u-card-label">\u5f97\u70b9\u3057\u305f\u8a66\u5408</span>
            <strong class="u-card-value">${profile.goals.length}</strong>
          </div>
        </div>
        <div class="u-player-year-tabs">${yearTabsHtml}</div>
        <div class="u-player-year-panels">${yearPanelsHtml}</div>
        <button class="close-sheet-btn">\u9589\u3058\u308b</button>
      </section>
    `;
    sheetContent.querySelectorAll(".u-player-year-tab").forEach(tab => {
      tab.onclick = () => {
        sheetContent.querySelectorAll(".u-player-year-tab").forEach(t => t.classList.remove("active"));
        sheetContent.querySelectorAll(".u-player-year-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = sheetContent.querySelector(`[data-year-panel="${tab.dataset.year}"]`);
        if (panel) panel.classList.add("active");
      };
    });
    const backBtn = sheetContent.querySelector(".u-player-back");
    if (backBtn && sourceMatch) backBtn.onclick = () => openDetailSheet(sourceMatch);
    sheetContent.querySelector(".close-sheet-btn").onclick = () => closeDetailSheet();
  }
  function bindPlayerLinks(sourceMatch) {
    sheetContent.querySelectorAll(".u-player-link").forEach(btn => {
      btn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPlayerSheet(btn.dataset.player, sourceMatch);
      };
    });
  }
  // --- Detail Sheet & Persistence ---
  function openDetailSheet(match) {
    const mId = `${match.date}_${match.club}_${match.opponent}`;
    const sMemo = localStorage.getItem(`memo_${mId}`) || "";
    const isAttend = localStorage.getItem(`attend_${mId}`) === "true";
    const scoreData = getStoredOrOfficialScore(match);
    const sMy = scoreData.my;
    const sOpp = scoreData.opp;
    const sWeather = localStorage.getItem(`weather_${mId}`) || "";
    const sTemp = localStorage.getItem(`temp_${mId}`) || "";
    const J_CLUB_ENG = {
      "\u5317\u6d7b\u9053\u30b3\u30f3\u30b5\u30c9\u30fc\u30ec\u672d\u5e4c": "HOKKAIDO CONSADOSE SAPPORO",
      "\u30f4\u30a1\u30f3\u30e9\u30fc\u30ec\u516b\u6238": "VANRAURE HACHINOHE",
      "\u3044\u308f\u304e\u3093\u30b9\u30bf\u30b8\u30a2\u30e0\u76db\u5ca1": "IWATE GRULLA MORIOKA",
      "\u30d9\u30ac\u30eb\u30bf\u4ed9\u53f0": "VEGALTA SENDAI",
      "\u30d6\u30e9\u30a6\u30d6\u30ea\u30c3\u30c4\u79cb\u7530": "BLAUBLITZ AKITA",
      "\u30e2\u30f3\u30c6\u30c7\u30a3\u30aa\u5c71\u5f62": "MONTEDIO YAMAGATA",
      "\u798f\u5cf6\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9FC": "FUKUSHIMA UNITED FC",
      "\u3044\u308f\u304eFC": "IWAKI FC",
      "\u9e7a\u5cf6\u30a2\u30f3\u30c8\u30e9\u30fc\u30ba": "KASHIMA ANTLERS",
      "\u6c34\u6238\u30db\u30ea\u30cf\u30c3\u30af": "MITO HOLLYHOCK",
      "\u6803\u6728SC": "TOCHIGI SC",
      "\u30b6\u30b9\u30d1\u7fa4\u99ac": "THESPA GUNMA",
      "\u6d66\u548c\u30ec\u30c3\u30ba": "URAWA REDS",
      "\u5927\u5bae\u30a2\u30eb\u30c7\u30a3\u30fc\u30b8\u30e3": "OMIYA ARDIJA",
      "RB\u5927\u5bae\u30a2\u30eb\u30c7\u30a3\u30fc\u30b8\u30e3": "RB OMIYA ARDIJA",
      "\u30b8\u30a7\u30d5\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9\u5343\u8449": "JEF UNITED CHIBA",
      "\u67cf\u30ec\u30a4\u30cd\u30eb": "KASHIWA REYSOL",
      "FC\u6771\u4eac": "FC TOKYO",
      "\u6771\u4eac\u30f4\u30a1\u30fc\u30c7\u30a3": "TOKYO VERDY",
      "FC\u753a\u7530\u30bc\u30eb\u30d3\u30a2": "FC MACHIDA ZELVIA",
      "\u5ddd\u5d0e\u30d5\u30ed\u30f3\u30bf\u30fc\u30ec": "KAWASAKI FRONTALE",
      "\u6a2a\u6d5cF\u30fb\u30de\u30ea\u30ce\u30b9": "YOKOHAMA F. MARINOS",
      "\u6a2a\u6d5cFC": "YOKOHAMA FC",
      "Y.S.C.C.\u6a2a\u6d5c": "Y.S.C.C. YOKOHAMA",
      "\u6e58\u5357\u30d9\u30eb\u30de\u30fc\u30ec": "SHONAN BELLMARE",
      "SC\u76f8\u6a21\u539f": "SC SAGAMIHARA",
      "\u30f4\u30a1\u30f3\u30d5\u30a9\u30fc\u30ec\u7532\u5e9c": "VENTFORET KOFU",
      "\u677e\u672c\u5c71\u96c5FC": "MATSUMOTO YAMAGA FC",
      "AC\u9577\u91ce\u30d5\u30a3\u30eb\u30bb\u30fc\u30ed": "AC NAGANO PARCEIRO",
      "\u30a2\u30b9\u30eb\u30af\u30e9\u30ed\u6cbc\u6d25": "AZUL CLARO NUMAZU",
      "\u540d\u53e4\u5c4b\u30b0\u30e9\u30f3\u30d1\u30b9": "NAGOYA GRAMPUS",
      "FC\u5c90\u961c": "FC GIFU",
      "\u4eac\u90fd\u30b5\u30f3\u30acF.C.": "KYOTO SANGA F.C.",
      "\u30ac\u30f3\u30d0\u5927\u962a": "GAMBA OSAKA",
      "\u30bb\u30ec\u30c3\u30bd\u5927\u962a": "CEREZO OSAKA",
      "FC\u5927\u962a": "FC OSAKA",
      "\u30f4\u30a3\u30c5\u30eb\u795e\u6238": "VISSEL KOBE",
      "\u30f4\u30a3\u30c5\u30eb\u795e\u6238": "VISSEL KOBE",
      "\u5948\u826f\u30af\u30e9\u30d6": "NARA CLUB",
      "\u30ac\u30a4\u30ca\u30fc\u30ec\u9ce5\u53d6": "GAINARE TOTTORI",
      "\u30d5\u30a1\u30b8\u30a2\u30fc\u30ce\u5ca1\u5c71": "FAGIANO OKAYAMA",
      "\u30b5\u30f3\u30d5\u30ec\u30c3\u30cc\u5e83\u5cf6": "SANFRECCE HIROSHIMA",
      "\u30ec\u30ce\u30d5\u30a1\u5c71\u53e3FC": "RENOFA YAMAGUCHI FC",
      "\u30ab\u30de\u30bf\u30de\u30fc\u30ec\u8b89\u5c90": "KAMATAMARE SANUKI",
      "\u5fb3\u5cf6\u30f4\u30a9\u30eb\u30c6\u30a3\u30b9": "TOKUSHIMA VORTIS",
      "\u611b\u5a9bFC": "EHIME FC",
      "FC\u4eca\u6cbb": "FC IMABARI",
      "\u30a2\u30d3\u30b9\u30d1\u798f\u5ca1": "AVISPA FUKUOKA",
      "\u30ae\u30e9\u30f4\u30a1\u30f3\u30c4\u5317\u4e5d\u5dde": "GIRAVANZ KITAKYUSHU",
      "\u30b5\u30ac\u30f3\u9ce5\u6816": "SAGAN TOSU",
      "V\u30fb\u30d5\u30a1\u30fc\u30ec\u30f3\u9577\u5d0e": "V-VAREN NAGASAKI",
      "\u30ed\u30a2\u30c3\u30bd\u718a\u672c": "ROASSO KUMAMOTO",
      "\u5927\u5206\u30c8\u30ea\u30cb\u30bf": "OITA TRINITA",
      "\u30c6\u30b2\u30d0\u30b8\u30e3\u30fc\u30ed\u5bae\u5d0e": "TEGEVAJARO MIYAZAKI",
      "\u9e7a\u5150\u5cf6\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9FC": "KAGOSHIMA UNITED FC",
      "FC\u7409\u7403": "FC RYUKYU",
      "\u9ad8\u77e5\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9SC": "KOCHI UNITED SC",
      "\u30ec\u30a4\u30e9\u30af\u6ecb\u8cc0FC": "REILAC SHIGA FC"
    };
    let goalsHtml = "";
    const offRes = findOfficialResult(match);
    if (offRes && ((offRes.goals && offRes.goals.length) || (offRes.opponent_goals && offRes.opponent_goals.length))) {
      const ownGoals = offRes.goals || [];
      const opponentGoals = offRes.opponent_goals || [];
      goalsHtml = `
        <section class="u-goals-area">
          <h4>GOALS</h4>
          ${ownGoals.length ? `
            <div class="u-goal-team">
              <span>${match.club === "niigata" ? "\u65b0\u6f5f" : "\u718a\u672c"}</span>
              <ul>
                ${ownGoals.map(g => `
                  <li>
                    <span class="u-goal-minute">${escapeHtml(g.minute || "")}'</span>
                    ${renderPlayerButton(g.scorer, "goal-scorer")}
                  </li>
                `).join("")}
              </ul>
            </div>
          ` : ""}
          ${opponentGoals.length ? `
            <div class="u-goal-team opponent">
              <span>${escapeHtml(match.opponent)}</span>
              <ul>
                ${opponentGoals.map(g => `
                  <li>
                    <span class="u-goal-minute">${escapeHtml(g.minute || "")}'</span>
                    <strong>${escapeHtml(g.scorer || "")}</strong>
                  </li>
                `).join("")}
              </ul>
            </div>
          ` : ""}
        </section>
      `;
    }
    const officialInfoHtml = renderOfficialInfo(match);
    const membersHtml = renderMatchMembers(match);
    const eventsHtml = renderMatchEvents(match);
    let pkHtml = "";
    if (parseDate(match.date).getFullYear() === 2026) {
      const sPkM = scoreData.pkMy || "";
      const sPkO = scoreData.pkOpp || "";
      const isD = (sMy !== "" && sOpp !== "" && sMy === sOpp);
      pkHtml = `<div class="u-pk-area" style="${isD ? 'display:flex;' : 'display:none;'}"><span class="u-pk-label">PK</span><input type="number" class="u-score-input pk-my" value="${sPkM}"><span class="u-score-sep">-</span><input type="number" class="u-score-input pk-opp" value="${sPkO}"></div>`;
    }
    const homeAway = getMatchIsHome(match) ? "HOME" : "AWAY";
    const clubName = match.club === "niigata" ? "ALBIREX NIIGATA" : "ROASSO KUMAMOTO";
    const clubEmblem = match.club === "niigata" ? "https://jleague.r10s.jp/img/common/img_club_niigata.png" : "https://jleague.r10s.jp/img/common/img_club_kumamoto.png";
    const engOpp = J_CLUB_ENG[match.opponent] || match.opponent.toUpperCase();
    const opponentEmblem = resolveEmblemUrl(match.opponent, match.emblem);
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
          <img class="sheet-opp-emblem" src="${escapeHtml(opponentEmblem)}" style="cursor:pointer;" onclick="openClubSite('${match.opponent}', event)">
        </div>
        <div class="sheet-venue-row" style="display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:8px;">
          <p class="sheet-venue-info" style="margin:0;">${match.date} | ${match.venue}</p>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.venue)}" target="_blank" style="background:#f2f2f7; color:var(--text-main); font-size:0.75rem; padding:6px 12px; border-radius:15px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> MAP\u3067\u958b\u304f</a>
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
             <span style="font-size:0.7rem; color:#888; font-weight:800; margin-right:4px;">\u2103</span>
             <span style="font-size: 0.8rem; color:#ddd;">/</span>
             <span id="u-temp-min" style="font-size: 1.2rem; font-family:var(--font-kick); font-weight:800; color:#007aff; margin-left:4px;">-</span>
             <span style="font-size:0.6rem; color:#888; font-weight:800;">\u2103</span>
           </div>
        </div>
      </div>
      <div class="sheet-score-area"><input type="number" class="u-score-input my-score" value="${sMy}" placeholder="-"><span class="u-score-sep">:</span><input type="number" class="u-score-input opp-score" value="${sOpp}" placeholder="-"></div>
      ${pkHtml}
      ${isBeforeToday(match.date) && match.raw_json ? `
      <button id="open-vision-preview-btn" class="u-vision-preview-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 15H3"/><path d="M7 21h10"/><path d="M12 15v6"/></svg>
        \u5927\u578b\u30d3\u30b8\u30e7\u30f3\u8868\u793a
      </button>` : ""}
      ${goalsHtml}
      ${officialInfoHtml}
      ${membersHtml}
      ${eventsHtml}
      <div class="u-attend-btn ${match.club} ${isAttend ? 'active' : ''}" id="attend-toggle">
        <span class="btn-icon" style="display: flex;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>
        <span class="btn-text">\u89b3\u6226\u4e88\u5b9a</span>
      </div>
      <div class="u-note-single">
        <div class="u-note-box">
          <div class="u-note-header">
            <label>\u30e1\u30e2</label>
            <button class="u-note-edit-btn" id="memo-edit-btn">\u7de8\u96c6</button>
          </div>
          <div class="u-memo-display" id="memo-display"></div>
          <textarea class="u-textarea memo-field hidden">${sMemo}</textarea>
        </div>
      </div>
      <button class="close-sheet-btn">\u4fdd\u5b58\u3057\u3066\u9589\u3058\u308b</button>
    `;
    bindPlayerLinks(match);
    sheetContent.querySelectorAll(".u-member-team-tab").forEach(tab => {
      tab.onclick = () => {
        sheetContent.querySelectorAll(".u-member-team-tab").forEach(t => t.classList.remove("active"));
        sheetContent.querySelectorAll(".u-member-team").forEach(panel => panel.classList.remove("active"));
        tab.classList.add("active");
        const panel = sheetContent.querySelector(`.u-member-team.${tab.dataset.memberTeam}`);
        if (panel) panel.classList.add("active");
      };
    });
    const firstMemberPanel = sheetContent.querySelector(".u-member-team");
    if (firstMemberPanel) firstMemberPanel.classList.add("active");
    // \u5927\u578b\u30d3\u30b8\u30e7\u30f3\u8868\u793a\u30dc\u30bf\u30f3\u306e\u30a4\u30d9\u30f3\u30c8\u8a2d\u5b81E
    const visionBtn = sheetContent.querySelector("#open-vision-preview-btn");
    if (visionBtn && match.raw_json) {
      visionBtn.onclick = () => openVisionPreview(match.raw_json);
    }
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
        memoEditBtn.textContent = '\u7de8\u96c6';
        memoEditBtn.classList.remove('editing');
      } else {
        // Switch to edit mode
        memoDisplay.classList.add('hidden');
        memoField.classList.remove('hidden');
        memoField.focus();
        memoEditBtn.textContent = '\u5b8c\u4e86';
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
  function openVisionPreview(rawJsonMatchData) {
    if (!rawJsonMatchData) return;
    // localStorage\u306b\u8a66\u5408\u30c7\u30fc\u30bf\u3092\u66f8\u304d\u8fbc\u3080
    try {
      const STORAGE_KEY = "stadiumVisionApp.v2";
      const CHANNEL_NAME = "stadiumVisionAppLive";
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      current._pendingJsonMatch = rawJsonMatchData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      try {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        bc.postMessage({ type: "JSON_MATCH_PREVIEW", data: rawJsonMatchData });
        bc.close();
      } catch(e) {}
    } catch(e) {
      console.warn("Vision preview data injection failed:", e);
    }
    // \u30d5\u30eb\u30b9\u30af\u30ea\u30fc\u30f3\u30aa\u30fc\u30d0\ufffdE\u30ec\u30a4\u3092\u8868\u793a
    const backdrop = document.getElementById("vision-preview-backdrop");
    const overlay = document.getElementById("vision-preview-overlay");
    const container = overlay ? overlay.querySelector(".vision-preview-container") : null;
    const iframe = document.getElementById("vision-preview-iframe");
    if (!overlay || !iframe) return;
    const updateVisionPreviewScale = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scale = Math.max(0.05, Math.min(rect.width / 1920, rect.height / 1080));
      overlay.style.setProperty("--vision-preview-scale", String(scale));
    };
    iframe.src = "vision/display.html?t=" + Date.now();
    overlay.style.display = "flex";
    if (backdrop) {
      backdrop.style.display = "block";
      backdrop.classList.add("active");
    }
    updateVisionPreviewScale();
    requestAnimationFrame(updateVisionPreviewScale);
    window.addEventListener("resize", updateVisionPreviewScale);
    const closeBtn = document.getElementById("close-vision-preview");
    const doClose = () => {
      overlay.style.display = "none";
      if (backdrop) {
        backdrop.classList.remove("active");
        backdrop.style.display = "none";
      }
      iframe.src = "about:blank";
      window.removeEventListener("resize", updateVisionPreviewScale);
    };
    if (closeBtn) closeBtn.onclick = doClose;
    if (backdrop) backdrop.onclick = doClose;
  }
  const GAS_EXEC_URL = "https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec";
  // --- Results & Data Management ---
  let officialResults = [];
  let cachedStandings = null;
  let historicalDataLoaded = false;
  let historicalDataPromise = null;
  // Initialize data from localStorage cache
  const rSave = localStorage.getItem("trapp_results_cache");
  if (rSave) { try { officialResults = JSON.parse(rSave); } catch (e) { } }
  if (window.STATIC_RESULTS) {
    officialResults = mergeResultArrays(window.STATIC_RESULTS, officialResults);
  }
  
  const lSave = localStorage.getItem("trapp_standings_cache");
  if (lSave) { try { cachedStandings = JSON.parse(lSave); } catch (e) { } }
  function getResultArray(payload) {
    if (!payload) return [];
    return Array.isArray(payload) ? payload : (payload.data || []);
  }
  function getResultKey(result) {
    const date = result.date || "";
    if (result.club && result.opponent) {
      return ["static", date, result.club, result.matchweek || "", normalizeName(result.opponent)].join("|");
    }
    return ["gas", date, result.section || "", normalizeName(result.home), normalizeName(result.away)].join("|");
  }
  function mergeResultArrays(...sources) {
    const seen = new Set();
    const merged = [];
    sources.forEach(source => {
      getResultArray(source).forEach(result => {
        const key = getResultKey(result);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(result);
      });
    });
    return merged;
  }
  function withMergedResultsPayload(basePayload, mergedResults) {
    if (!basePayload || Array.isArray(basePayload)) return mergedResults;
    return { ...basePayload, data: mergedResults };
  }
  async function fetchLocalJson(type) {
    try {
      const res = await fetch(`./data/${type}.json?t=${Date.now()}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn(`Static load failed: ${type}`);
    }
    return null;
  }
  function commitResultsPayload(resJson) {
    const merged = mergeResultArrays(window.STATIC_RESULTS || [], officialResults, resJson);
    if (!merged.length) return;
    officialResults = merged;
    localStorage.setItem("trapp_results_cache", JSON.stringify(officialResults));
    injectResultsIntoSchedule(officialResults);
    syncResultsToLocalStorage(officialResults);
    renderFeed();
    applyYearFilter(selectedYear, true);
    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "calendar") renderCalendar();
    if (typeof updateDashboardPrevResults === "function") updateDashboardPrevResults();
  }
  function injectResultsIntoSchedule(results) {
    let added = 0;
    getResultArray(results).forEach(r => {
      if (!r.date || !r.club || !r.opponent) return;
      const exists = scheduleData.find(m => m.date === r.date && m.club === r.club && m.opponent === r.opponent);
      if (exists) return;
      const d = parseDate(r.date);
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const dayStr = r.day || days[d.getDay()];
      let emblem = resolveEmblemUrl(r.opponent, r.emblem) || "";
      if (!emblem) {
        const reversed = Object.entries(EMBLEM_MAP).find(([k,v]) => robustTeamMatch(v, r.opponent));
        if (reversed) emblem = `https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png`;
      }
      scheduleData.push({
         club: r.club,
         matchweek: r.matchweek || "EX",
         date: r.date,
         day: dayStr,
         time: r.time || "",
         opponent: r.opponent,
         venue: r.venue || "",
         home_away: r.home_away || "",
         emblem: emblem,
         details: r.details || ""
      });
      added++;
    });
    return added;
  }
  /**
   * Universal fetch with fallback and stale check
   */
  async function fetchData(type, forceGas = false) {
    if (type === "results" && window.STATIC_RESULTS) {
       const localJson = await fetchLocalJson(type);
       const localMerged = mergeResultArrays(window.STATIC_RESULTS, officialResults, localJson);
       if (!forceGas && localJson) {
         return withMergedResultsPayload(localJson, localMerged);
       }
       const gasUrl = `${GAS_EXEC_URL}?type=${type}&league=j2`;
       try {
         const gasUrlWithCacheBuster = `${gasUrl}&nocache=1&t=${Date.now()}`;
         const res = await fetch(gasUrlWithCacheBuster);
         const gasJson = await res.json();
         const gasArr = gasJson.data || (Array.isArray(gasJson) ? gasJson : []);
         if (gasArr.length > 0) {
           const merged = mergeResultArrays(window.STATIC_RESULTS, officialResults, localJson, gasJson);
           return withMergedResultsPayload(gasJson, merged);
         }
       } catch (e) { console.error(`GAS fetch failed: ${type}`); }
       return withMergedResultsPayload(localJson || window.STATIC_RESULTS, localMerged);
    }
    const gasUrl = `${GAS_EXEC_URL}?type=${type}&league=j2`;
    let staticJson = await fetchLocalJson(type);
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
    await clubEmblemMapReady;
    const resultsPromise = fetchData("results", forceGas);
    const standingsPromise = fetchData("standings", forceGas);
    const resJson = await resultsPromise;
    if (resJson) {
      commitResultsPayload(resJson);
    }
    const stdJson = await standingsPromise;
    if (stdJson && stdJson.data) {
      cachedStandings = stdJson.data;
      localStorage.setItem("trapp_standings_cache", JSON.stringify(cachedStandings));
    }
    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "calendar") renderCalendar();
    
    if (typeof updateDashboardPrevResults === "function") updateDashboardPrevResults();
  }
  /**
   * Finds official result for a specific match
   */
  function findOfficialResult(match) {
    if (!officialResults || !officialResults.length) return null;
    const myKw = match.club === "niigata" ? "\u65b0\u6f5f" : "\u718a\u672c";
    
    const candidates = officialResults.filter(r => {
      // Static JSON Format Support
      if (r.club && r.opponent) {
        if (r.date === match.date && r.club === match.club && robustTeamMatch(r.opponent, match.opponent)) return true;
      }
      // GAS Format Support
      if (!r.home || !r.away) return false;
      const dateMatch = r.date === match.date;
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
    if (!candidates.length) return null;
    const resultQuality = (r) => {
      let score = 0;
      if (r.raw_json) score += 10;
      if (r.score) score += 5;
      if (r.attendance) score += 3;
      if (r.referee) score += 3;
      if (Array.isArray(r.starting_members) && r.starting_members.length) score += 3;
      if (Array.isArray(r.goals) && r.goals.length) score += 2;
      return score;
    };
    return candidates.sort((a, b) => resultQuality(b) - resultQuality(a))[0];
  }
  /**
   * Syncs official results into individual localStorage keys (for Feed/Calendar)
   */
  function syncResultsToLocalStorage(results) {
    let changed = false;
    scheduleData.forEach(m => {
      const r = findOfficialResult(m);
      if (r) {
        let sM = null, sO = null, pkM = null, pkO = null;
        
        // Static JSON Format Support
        if (r.score !== undefined) {
          const scores = String(r.score).split("-").map(x => x.trim());
          if (scores.length === 2 && scores[0] !== "") {
            sM = scores[0];
            sO = scores[1];
            if (r.pk) {
               const pkMatch = r.pk.match(/(\d+)\s*PK\s*(\d+)/i);
               if (pkMatch) {
                 const isHome = r.home_away === "H";
                 pkM = isHome ? pkMatch[1] : pkMatch[2];
                 pkO = isHome ? pkMatch[2] : pkMatch[1];
               }
            }
          }
        }
        // GAS Format Support
        else if (r.home_score !== "" && r.home_score !== null) {
          const isHome = robustTeamMatch(r.home, m.club === "niigata" ? "\u65b0\u6f5f" : "\u718a\u672c");
          sM = isHome ? r.home_score : r.away_score;
          sO = isHome ? r.away_score : r.home_score;
          if (r.pk && r.home_score === r.away_score) {
            const pkMatch = r.pk.match(/(\d+)\s*PK\s*(\d+)/i);
            if (pkMatch) {
              pkM = isHome ? pkMatch[1] : pkMatch[2];
              pkO = isHome ? pkMatch[2] : pkMatch[1];
            }
          }
        }
        if (sM !== null && sO !== null) {
          const mId = `${m.date}_${m.club}_${m.opponent}`;
          if (localStorage.getItem(`score_my_${mId}`) !== String(sM) || 
              localStorage.getItem(`score_opp_${mId}`) !== String(sO)) {
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
        }
      }
    });
    return changed;
  }
  if (window.STATIC_RESULTS && window.STATIC_RESULTS.length) {
    officialResults = mergeResultArrays(window.STATIC_RESULTS, officialResults);
    injectResultsIntoSchedule(window.STATIC_RESULTS);
    syncResultsToLocalStorage(window.STATIC_RESULTS);
  }
  // Initial load
  loadHistoricalData().catch((e) => console.warn("historical data load failed", e));
  refreshAllData();
  // extract the city map into reusable object
  const COMMON_STADIUM_CITY_MAP = {
    "\u3048\u304c\u304a\u5065\u5eb7\u30b9\u30bf\u30b8\u30a2\u30e0": "\u718a\u672c\u5e02",
    "\u30c7\u30f3\u30ab\u30d3\u30c3\u30b0\u30b9\u30ef\u30f3\u30b9\u30bf\u30b8\u30a2\u30e0": "\u65b0\u6f5f\u5e02",
    "\u5473\u306e\u7d20\u30b9\u30bf\u30b8\u30a2\u30e0": "\u8abf\u5e03\u5e02",
    "\u8c4a\u7530\u30b9\u30bf\u30b8\u30a2\u30e0": "\u8c4a\u7530\u5e02",
    "\u30d1\u30ca\u30bd\u30cb\u30c3\u30af\u30b9\u30bf\u30b8\u30a2\u30e0\u5439\u7530": "\u5439\u7530\u5e02",
    "\u57fc\u7389\u30b9\u30bf\u30b8\u30a2\u30e02002": "\u3055\u3044\u305f\u307e\u5e02\u7dd1\u533a",
    "\u30e8\u30c9\u30b3\u30a6\u685c\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5927\u962a\u5e02\u6771\u4f4f\u5409\u533a",
    "\u65e5\u7523\u30b9\u30bf\u30b8\u30a2\u30e0": "\u6a2a\u6d5c\u5e02\u6e2f\u5317\u533a",
    "\u30cb\u30c3\u30d1\u30c4\u4e09\u30c4\u6ca2\u7403\u6280\u5834": "\u6a2a\u6d5c\u5e02\u795e\u5948\u5ddd\u533a",
    "\u30ec\u30e2\u30f3\u30ac\u30b9\u30b9\u30bf\u30b8\u30a2\u30e0\u5e73\u585a": "\u5e73\u585a\u5e02",
    "\u30b5\u30f3\u30ac\u30b9\u30bf\u30b8\u30a2\u30e0 by KYOCERA": "\u4e80\u5ca1\u5e02",
    "\u30a8\u30c7\u30a3\u30aa\u30f3\u30d4\u30fc\u30b9\u30a6\u30a4\u30f3\u30b0\u5e83\u5cf6": "\u5e83\u5cf6\u5e02\u4e2d\u533a",
    "\u30d9\u30b9\u30c8\u96fb\u5668\u30b9\u30bf\u30b8\u30a2\u30e0": "\u798f\u5ca1\u5e02\u535a\u591a\u533a",
    "\u99c5\u524d\u4e0d\u52d5\u7523\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9ce5\u6816\u5e02",
    "\u662d\u548c\u96fb\u5de5\u30c9\u30fc\u30e0\u5927\u5206": "\u5927\u5206\u5e02",
    "\u30c9\u30fc\u30e0\u5927\u5206": "\u5927\u5206\u5e02",
    "\u30e6\u30a2\u30c6\u30c3\u30af\u30b9\u30bf\u30b8\u30a2\u30e0\u4ed9\u53f0": "\u4ed9\u53f0\u5e02\u6cc9\u533a",
    "IAI\u30b9\u30bf\u30b8\u30a2\u30e0\u65e5\u672c\u5e73": "\u9759\u5ca1\u5e02\u6e05\u6c34\u533a",
    "\u30a8\u30b3\u30d1\u30b9\u30bf\u30b8\u30a2\u30e0": "\u888b\u4e95\u5e02",
    "\u30e4\u30de\u30cf\u30b9\u30bf\u30b8\u30a2\u30e0": "\u78d0\u7530\u5e02",
    "\u30c8\u30e9\u30f3\u30b9\u30b3\u30b9\u30e2\u30b9\u30b9\u30bf\u30b8\u30a2\u30e0\u9577\u5d0e": "\u8aeb\u65e9\u5e02",
    "PEACE STADIUM Connected by SoftBank": "\u9577\u5d0e\u5e02",
    "\u30d5\u30af\u30c0\u96fb\u5b50\u30a2\u30ea\u30fc\u30ca": "\u5343\u8449\u5e02\u4e2d\u592e\u533a",
    "\u4e09\u5354\u30d5\u30ed\u30f3\u30c6\u30a2\u67cf\u30b9\u30bf\u30b8\u30a2\u30e0": "\u67cf\u5e02",
    "\u30b7\u30c6\u30a3\u30e9\u30a4\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5ca1\u5c71\u5e02\u5317\u533a",
    "JFE\u6674\u308c\u3084\u304b\u56fd\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5ca1\u5c71\u5e02\u5317\u533a",
    "\u7dad\u65b0\u307f\u3089\u3044\u3075\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5c71\u53e3\u5e02",
    "\u30dd\u30ab\u30ea\u30b9\u30a8\u30c3\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9cf4\u9580\u5e02",
    "\u9cf4\u9580\u30fb\u5927\u585a\u30b9\u30dd\u30fc\u30c4\u30d1\u30fc\u30af \u30dd\u30ab\u30ea\u30b9\u30a8\u30c3\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9cf4\u9580\u5e02",
    "\u30cb\u30f3\u30b8\u30cb\u30a2\u30b9\u30bf\u30b8\u30a2\u30e0": "\u677e\u5c71\u5e02",
    "ND\u30bd\u30d5\u30c8\u30b9\u30bf\u30b8\u30a2\u30e0\u5c71\u5f62": "\u5929\u7ae5\u5e02",
    "\u30bd\u30e6\u30fc\u30b9\u30bf\u30b8\u30a2\u30e0": "\u79cb\u7530\u5e02",
    "NACK5\u30b9\u30bf\u30b8\u30a2\u30e0\u5927\u5bae": "\u3055\u3044\u305f\u307e\u5e02\u5927\u5bae\u533a",
    "\u30b1\u30fc\u30ba\u30c7\u30f3\u30ad\u30b9\u30bf\u30b8\u30a2\u30e0\u6c34\u6238": "\u6c34\u6238\u5e02",
    "\u30ab\u30f3\u30bb\u30ad\u30b9\u30bf\u30b8\u30a2\u30e0\u3068\u3061\u304e": "\u5b87\u90fd\u5bae\u5e02",
    "\u6b63\u7530\u91a4\u6cb9\u30b9\u30bf\u30b8\u30a2\u30e0\u7fa4\u99ac": "\u524d\u6a4b\u5e02",
    "\u30cf\u30ef\u30a4\u30a2\u30f3\u30ba\u30b9\u30bf\u30b8\u30a2\u30e0\u3044\u308f\u304d": "\u3044\u308f\u304d\u5e02",
    "\u3068\u3046\u307b\u3046\u30fb\u307f\u3093\u306a\u306e\u30b9\u30bf\u30b8\u30a2\u30e0": "\u798f\u5cf6\u5e02",
    "\u30d7\u30e9\u30a4\u30d5\u30fc\u30ba\u30b9\u30bf\u30b8\u30a2\u30e0": "\u516b\u6238\u5e02",
    "\u3044\u308f\u304e\u3093\u30b9\u30bf\u30b8\u30a2\u30e0": "\u76db\u5ca1\u5e02",
    "JIT \u30ea\u30b5\u30a4\u30af\u30eb\u30a4\u30f3\u30af \u30b9\u30bf\u30b8\u30a2\u30e0": "\u7532\u5e9c\u5e02",
    "\u30b5\u30f3\u30d7\u30ed \u30a2\u30eb\u30a6\u30a3\u30f3": "\u677e\u672c\u5e02",
    "\u9577\u91ceU\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9577\u91ce\u5e02",
    "\u5bcc\u5c71\u770c\u7dcf\u5408\u904b\u52d5\u516c\u5712\u9678\u4e0a\u7af6\u6280\u5834": "\u5bcc\u5c71\u5e02",
    "\u77f3\u5ddd\u770c\u897f\u90e8\u7dd1\u5730\u516c\u5712\u9678\u4e0a\u7af6\u6280\u5834": "\u91d1\u6ca2\u5e02",
    "\u91d1\u6ca2\u30b4\u30fc\u30b4\u30fc\u30ab\u30ec\u30fc\u30b9\u30bf\u30b8\u30a2\u30e0": "\u91d1\u6ca2\u5e02",
    "\u85e4\u679d\u7dcf\u5408\u904b\u52d5\u516c\u5712\u30b5\u30c3\u30ab\u30fc\u5834": "\u85e4\u679d\u5e02",
    "\u611b\u9df9\u5e83\u57df\u516c\u5712\u591a\u76ee\u7684\u7af6\u6280\u5834": "\u6cbc\u6d25\u5e02",
    "\u9577\u826f\u5ddd\u7af6\u6280\u5834": "\u5c90\u961c\u5e02",
    "\u6771\u5927\u962a\u5e02\u82b1\u5712\u30e9\u30b0\u30d3\u30fc\u5834": "\u6771\u5927\u962a\u5e02",
    "\u30ed\u30fc\u30c8\u30d5\u30a3\u30fc\u30eb\u30c9\u5948\u826f": "\u5948\u826f\u5e02",
    "Axis\u30d0\u30fc\u30c9\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9ce5\u53d6\u5e02",
    "\u30c1\u30e5\u30a6\u30d6YAJIN\u30b9\u30bf\u30b8\u30a2\u52a0": "\u7c73\u5b50\u5e02",
    "\u30c1\u30e5\u30a6\u30d6YAJIN\u30b9\u30bf\u30b8\u30a2\u30e0": "\u7c73\u5b50\u5e02",
    "Pikara\u30b9\u30bf\u30b8\u30a2\u30e0": "\u4e38\u4e80\u5e02",
    "\u56db\u56fd\u5316\u6210MEGLIO\u30b9\u30bf\u30b8\u30a2\u30e0": "\u4e38\u4e80\u5e02",
    "\u30a2\u30b7\u30c3\u30af\u30b9\u91cc\u5c71\u30b9\u30bf\u30b8\u30a2\u30e0": "\u4eca\u6cbb\u5e02",
    "\u30df\u30af\u30cb\u30ef\u30fc\u30eb\u30c9\u30b9\u30bf\u30b8\u30a2\u30e0\u5317\u4e5d\u5dde": "\u5317\u4e5d\u5dde\u5e02\u5c0f\u5009\u5317\u533a",
    "\u3044\u3061\u3054\u5bae\u5d0e\u65b0\u5bcc\u30b5\u30c3\u30ab\u30fc\u5834": "\u65b0\u5bcc\u753a",
    "\u767d\u6ce2\u30b9\u30bf\u30b8\u30a2\u30e0": "\u9e7f\u5150\u5cf6\u5e02",
    "\u30bf\u30d4\u30c3\u30af\u770c\u7dcf\u3072\u3084\u3054\u3093\u30b9\u30bf\u30b8\u30a2\u30e0": "\u6c96\u7e04\u5e02",
    "Uvance\u3068\u3069\u308d\u304d\u30b9\u30bf\u30b8\u30a2\u30e0 by Fujitsu": "\u5ddd\u5d0e\u5e02\u4e2d\u539f\u533a",
    "\u5927\u548c\u30cf\u30a6\u30b9 \u30d7\u30ec\u30df\u30b9\u30c8\u30c9\u30fc\u30e0": "\u672d\u5e4c\u5e02\u8c4a\u5e73\u533a",
    "\u5e73\u548c\u5802HATO\u30b9\u30bf\u30b8\u30a2\u30e0": "\u5f66\u6839\u5e02"
  };
async function renderDashboard() {
    const container = document.getElementById("dashboard-cards-container");
    if (!container) return;
    const now = new Date();
    const y = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const cutoffStr = `${y}-${mm}-${dd}`;
    const showNiigata = true;
    const showKumamoto = true;
    let nextNiigata = null;
    let nextKumamoto = null;
    const sorted = [...scheduleData].sort((a, b) => parseDate(a.date) - parseDate(b.date));
    for (let m of sorted) {
      if (m.date >= cutoffStr && !nextNiigata && m.club === "niigata") nextNiigata = m;
      if (m.date >= cutoffStr && !nextKumamoto && m.club === "kumamoto") nextKumamoto = m;
      if (nextNiigata && nextKumamoto) break;
    }
    let html = "";
    const renderCard = (m, clubName, mainColor, myShortName) => {
      if (!m) return `<div class="dash-card"><div style="padding:20px;text-align:center;color:#888;">\u4eca\u5f8c\u306e\u8a66\u5408\u4e88\u5b9a\u306f\u3042\u308a\u307e\u305b\u3093</div></div>`;
      const isAtt = localStorage.getItem('attend_' + m.date + '_' + m.club + '_' + m.opponent) === "true";
      const isHome = getMatchIsHome(m);
      const haBadge = isHome ? '<span class="sheet-ha badge-home" style="color:#fff; font-weight:800; font-size:1rem;">HOME</span>' : '<span class="sheet-ha badge-away" style="color:#fff; font-weight:800; font-size:1rem;">AWAY</span>';
      const myEmblem = m.club === "niigata" ? "https://jleague.r10s.jp/img/common/img_club_niigata.png" : "https://jleague.r10s.jp/img/common/img_club_kumamoto.png";
      const J_CLUB_ENG = {
        "\u5317\u6d77\u9053\u30b3\u30f3\u30b5\u30c9\u30fc\u30ec\u672d\u5e4c": "HOKKAIDO CONSADOLE SAPPORO",
        "\u30f4\u30a1\u30f3\u30e9\u30fc\u30ec\u516b\u6238": "VANRAURE HACHINOHE",
        "\u3044\u308f\u304e\u3093\u30b9\u30bf\u30b8\u30a2\u30e0\u76db\u5ca1": "IWATE GRULLA MORIOKA",
        "\u30d9\u30ac\u30eb\u30bf\u4ed9\u53f0": "VEGALTA SENDAI",
        "\u30d6\u30e9\u30a6\u30d6\u30ea\u30c3\u30c4\u79cb\u7530": "BLAUBLITZ AKITA",
        "\u30e2\u30f3\u30c6\u30c7\u30a3\u30aa\u5c71\u5f62": "MONTEDIO YAMAGATA",
        "\u798f\u5cf6\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9FC": "FUKUSHIMA UNITED FC",
        "\u3044\u308f\u304dFC": "IWAKI FC",
        "\u9e7a\u5cf6\u30a2\u30f3\u30c8\u30e9\u30fc\u30ba": "KASHIMA ANTLERS",
        "\u6c34\u6238\u30db\u30ea\u30cf\u30c3\u30af": "MITO HOLLYHOCK",
        "\u6803\u6728SC": "TOCHIGI SC",
        "\u30b6\u30b9\u30d1\u7fa4\u99ac": "THESPA GUNMA",
        "\u6d66\u548c\u30ec\u30c3\u30ba": "URAWA REDS",
        "\u5927\u5bae\u30a2\u30eb\u30c7\u30a3\u30fc\u30b8\u30e3": "OMIYA ARDIJA",
        "RB\u5927\u5bae\u30a2\u30eb\u30c7\u30a3\u30fc\u30b8\u30e3": "RB OMIYA ARDIJA",
        "\u30b8\u30a7\u30d5\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9\u5343\u8449": "JEF UNITED CHIBA",
        "\u67cf\u30ec\u30a4\u30bd\u30eb": "KASHIWA REYSOL",
        "FC\u6771\u4eac": "FC TOKYO",
        "\u6771\u4eac\u30f4\u30a1\u30fc\u30c7\u30a3": "TOKYO VERDY",
        "FC\u753a\u7530\u30bc\u30eb\u30d3\u30a2": "FC MACHIDA ZELVIA",
        "\u5ddd\u5d0e\u30d5\u30ed\u30f3\u30bf\u30fc\u30ec": "KAWASAKI FRONTALE",
        "\u6a2a\u6d5cF\u30fb\u30de\u30ea\u30ce\u30b9": "YOKOHAMA F. MARINOS",
        "\u6a2a\u6d5cFC": "YOKOHAMA FC",
        "Y.S.C.C.\u6a2a\u6d5c": "Y.S.C.C. YOKOHAMA",
        "\u6e58\u5357\u30d9\u30eb\u30de\u30fc\u30ec": "SHONAN BELLMARE",
        "SC\u76f8\u6a21\u539f": "SC SAGAMIHARA",
        "\u30f4\u30a1\u30f3\u30d5\u30a9\u30fc\u30ec\u7532\u5e9c": "VENTFORET KOFU",
        "\u677e\u672c\u5c71\u96c5FC": "MATSUMOTO YAMAGA FC",
        "AC\u9577\u91ce\u30d5\u30a3\u30eb\u30bb\u30fc\u30ed": "AC NAGANO PARCEIRO",
        "\u30a2\u30eb\u30d3\u30ec\u30c3\u30af\u30b9\u65b0\u6f5f": "ALBIREX NIIGATA",
        "\u30ab\u30bf\u30fc\u30ec\u5bc5\u5c71": "KATALLER TOYAMA",
        "\u30c4\u30a7\u30fc\u30bc\u30f3\u91d1\u6ca2": "ZWEIGEN KANAZAWA",
        "\u6e05\u6c34\u30a8\u30b9\u30d1\u30eb\ufffdX": "SHIMIZU S-PULSE",
        "\u30b8\u30e5\u30d3\u30ed\u5c36\u7530": "JUBILO IWATA",
        "\u85e4\u679dMYFC": "FUJIEDA MYFC",
        "\u30a2\u30b9\u30eb\u30af\u30e9\u30ed\u6cbc\u6d25": "AZUL CLARO NUMAZU",
        "\u540d\u53e4\u5c4b\u30b0\u30e9\u30f3\u30d1\u30b9": "NAGOYA GRAMPUS",
        "FC\u5c90\u961c": "FC GIFU",
        "\u4eac\u90fd\u30b5\u30f3\u30acF.C.": "KYOTO SANGA F.C.",
        "\u30ac\u30f3\u30d0\u5927\u962a": "GAMBA OSAKA",
        "\u30bb\u30ec\u30c3\u30bd\u5927\u962a": "CEREZO OSAKA",
        "FC\u5927\u962a": "FC OSAKA",
        "\u30f4\u30a3\u30c5\u30eb\u795e\u6238": "VISSEL KOBE",
        "\u5948\u826f\u30af\u30e9\u30d6": "NARA CLUB",
        "\u30ac\u30a4\u30ca\u30fc\u30ec\u9ce5\u53d6": "GAINARE TOTTORI",
        "\u30d5\u30a1\u30b8\u30a2\u30fc\u30ce\u5ca1\u5c71": "FAGIANO OKAYAMA",
        "\u30b5\u30f3\u30d5\u30ec\u30c3\u30cc\u5e83\u5cf6": "SANFRECCE HIROSHIMA",
        "\u30ec\u30ce\u30d5\u30a1\u5c71\u53e3FC": "RENOFA YAMAGUCHI FC",
        "\u30ab\u30de\u30bf\u30de\u30fc\u30ec\u8b89\u5c90": "KAMATAMARE SANUKI",
        "\u5fb3\u5cf6\u30f4\u30a9\u30eb\u30c6\u30a3\u30b9": "TOKUSHIMA VORTIS",
        "\u611b\u5a9bFC": "EHIME FC",
        "FC\u4eca\u6cbb": "FC IMABARI",
        "\u30a2\u30d3\u30b9\u30d1\u798f\u5ca1": "AVISPA FUKUOKA",
        "\u30ae\u30e9\u30f4\u30a1\u30f3\u30c4\u5317\u4e5d\u5dde": "GIRAVANZ KITAKYUSHU",
        "\u30b5\u30ac\u30f3\u9ce5\u6816": "SAGAN TOSU",
        "V\u30fb\u30d5\u30a1\u30fc\u30ec\u30f3\u9577\u5d0e": "V-VAREN NAGASAKI",
        "\u30ed\u30a2\u30c3\u30bd\u718a\u672c": "ROASSO KUMAMOTO",
        "\u5927\u5206\u30c8\u30ea\u30cb\u30bf": "OITA TRINITA",
        "\u30c6\u30b2\u30d0\u30b8\u30e3\u30fc\u30ed\u5bae\u5d0e": "TEGEVAJARO MIYAZAKI",
        "\u9e7a\u5150\u5cf6\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9FC": "KAGOSHIMA UNITED FC",
        "FC\u7409\u7403": "FC RYUKYU",
        "\u9ad8\u77e5\u30e5\u30ca\u30a4\u30c6\u30c3\u30c9SC": "KOCHI UNITED SC",
        "\u30ec\u30a4\u30e9\u30af\u6ecb\u8cc0FC": "REILAC SHIGA FC"
      };
      const engOpp = J_CLUB_ENG[m.opponent] || m.opponent.toUpperCase();
      return `
          <div class="dash-card white-theme" id="dash-card-${m.club}" data-mid="${m.date}_${m.club}_${m.opponent}" style="background: white;">
            <div class="dash-card-header" style="background:${mainColor}; border-bottom:none; padding:8px 15px;">
              <span class="dash-team-name" style="font-size:1.4rem; font-weight:900;">${clubName}</span>
              ${haBadge.replace('font-size:1rem;', 'font-size:0.85rem;')}
            </div>
            <div class="dash-card-body" style="background: white; color: #111; padding:10px 15px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
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
                 <div id="dash-weather-${m.club}" data-venue="${m.venue}" data-date="${m.date}" style="text-align:right;">
                    <span class="val-weather" style="font-size:1.8rem; display:flex; align-items:center; gap: 8px;"></span>
                 </div>
              </div>
              <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px; border-bottom: 1px solid #f0f0f5; padding-bottom:10px;">
                 <span class="dash-vs" style="color:#888; font-size:1.1rem; font-weight:800;">VS</span>
                 <h3 class="dash-opp-name" style="color:#111; font-weight:900; margin:0; font-size:1.6rem; font-family:var(--font-main); letter-spacing:1px;">${m.opponent}</h3>
              </div>
              <div style="display:flex; gap: 15px;">
                 <div style="flex:1; display:flex; flex-direction:column; align-items:center; text-align:center;">
                    <img src="${myEmblem}" style="height:45px; margin-bottom:4px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.1)); cursor:pointer;" onclick="openClubSite('${myShortName === '\u65b0\u6f5f' ? '\u30a2\u30eb\u30d3\u30ec\u30c3\u30af\u30b9\u65b0\u6f5f' : '\u30ed\u30a2\u30c3\u30bd\u718a\u672c'}', event)">
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
                 <div style="width:1px; background:#e8e8ed;"></div>
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
    html += renderCard(nextNiigata, "ALBIREX NIIGATA", "var(--albirex-orange)", "\u65b0\u6f5f");
    html += renderCard(nextKumamoto, "ROASSO KUMAMOTO", "var(--roasso-red)", "\u718a\u672c");
    container.innerHTML = html;
    updateHeaderAnnouncements();
    container.querySelectorAll('.dash-card').forEach(card => {
      card.onclick = () => {
        const mId = card.dataset.mid;
        if (!mId) return;
        const match = scheduleData.find(x => `${x.date}_${x.club}_${x.opponent}` === mId);
        if (match) openDetailSheet(match);
      };
    });
    const btnFeed = document.getElementById("dash-to-feed");
    const btnCal = document.getElementById("dash-to-calendar");
    if (btnFeed) btnFeed.onclick = () => switchMode("feed");
    if (btnCal) btnCal.onclick = () => switchMode("calendar");
    document.getElementById("dash-to-standings").onclick = () => {
      openSubPane("standings-overlay");
      loadStandings();
    };
    document.getElementById("dash-to-links").onclick = () => openSubPane("links-overlay");
    const btnScoreboard = document.getElementById("dash-to-scoreboard");
    if (btnScoreboard) btnScoreboard.onclick = () => switchMode("scoreboard");
    const btnVision = document.getElementById("dash-to-vision");
    if (btnVision) btnVision.onclick = () => switchMode("vision");
    const fetchWeatherForDash = async (idPrefix, clubPrefix) => {
      const wBox = document.getElementById(idPrefix);
      if (!wBox) return;
      const venue = wBox.dataset.venue;
      const dateStr = wBox.dataset.date;
      const cacheKey = `weather_html_${venue}_${dateStr}`;
      const cachedHTML = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(`${cacheKey}_time`);
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
              let emoji = "\u2601";
              if (code <= 1) emoji = "\u2600";
              else if (code <= 3) emoji = "\u2601";
              else if (code <= 69 || (code >= 80 && code <= 82) || code >= 95) emoji = "\u2614";
              else if ((code >= 70 && code <= 79) || (code >= 85 && code <= 86)) emoji = "\u2744";
              const finalHTML = `${emoji} <div style="display:flex; align-items:baseline; gap:6px; font-family:var(--font-kick); font-weight:900; font-size:1.4rem;"><span style="color:#ff3b30;">${Math.round(max)}</span> <span style="font-size:1.2rem; color:#aaa;">/</span> <span style="color:#007aff;">${Math.round(min)}</span> <span style="font-size:1rem; color:#111;">\u2103</span></div>`;
              wBox.querySelector(".val-weather").innerHTML = finalHTML;
              localStorage.setItem(cacheKey, finalHTML);
              localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
            }
          }
        } catch (e) { }
      } else {
        wBox.querySelector(".val-weather").innerHTML = `<span style="font-size:0.6rem;color:#999;line-height:2;">\u53d6\u5f97\u671f\u9593\u5916</span>`;
      }
    };
    if (nextNiigata) fetchWeatherForDash(`dash-weather-niigata`, 'niigata');
    if (nextKumamoto) fetchWeatherForDash(`dash-weather-kumamoto`, 'kumamoto');
    const refreshStandings = async () => {
      const data = cachedStandings;
      if (!data) return;
      const updateStatsCard = (m, myKeyword) => {
        if (!m) return;
        const nMyKey = normalizeName(myKeyword);
        const myData = data.find(r => r.team && normalizeName(r.team).includes(nMyKey));
        const J_TEAM_KWS = ["FC\u6771\u4eac", "\u6771\u4eacV", "\u6a2a\u6d5cF\u30fb\u30de\u30ea\u30ce\u30b9", "\u6a2a\u6d5cFC", "YS\u6a2a\u6d5c", "FC\u5927\u962a", "G\u5927\u962a", "C\u5927\u962a", "\u30bb\u30ec\u30c3\u30bd", "FC\u5c90\u961c", "FC\u4eca\u6cbb", "FC\u7409\u7403", "\u672d\u5e4c", "\u9e7a\u5cf6", "\u6d66\u548c", "\u6749", "\u753a\u753d", "\u5ddd\u5d0e", "\u6e58\u5357", "\u65b0\u6f5f", "\u5bc5\u5c71", "\u91d1\u6ca2", "\u6e05\u6c34", "\u85e4\u679d", "\u6cbc\u6d25", "\u5c36\u753d", "\u540d\u53e4\u5c4b", "\u5c90\u961c", "\u4eac\u90fd", "\u795e\u6238", "\u5948\u826f", "\u9ce5\u53d6", "\u5ca1\u5c71", "\u5e83\u5cf6", "\u5c71\u53e3", "\u8b89\u5c90", "\u5fb3\u5cf6", "\u611b\u5a9b", "\u4eca\u6cbb", "\u798f\u5ca1", "\u535d\u4e5d\u5dde", "\u9ce5\u6816", "\u9577\u5d0e", "\u718a\u672c", "\u5927\u5206", "\u5bae\u5d0e", "\u9e7a\u5150\u5cf6", "\u7409\u7403", "\u9ad8\u77e5", "\u6ecb\u8cc0", "\u516b\u6238", "\u76db\u5ca1", "\u79cb\u7530", "\u5c71\u5f62", "\u4ed9\u53f0", "\u798f\u5cf6", "\u6c34\u6238", "\u7fa4\u99ac", "\u6803\u6728", "\u5927\u5bae", "\u5343\u8449", "\u76f8\u6a21\u539f", "\u7532\u5e9c", "\u677e\u672c", "\u9577\u91ce"];
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
      updateStatsCard(nextNiigata, "\u65b0\u6f5f");
      updateStatsCard(nextKumamoto, "\u718a\u672c");
    };
    refreshStandings();
    updateDashboardPrevResults();
  }

  function updateDashboardPrevResults() {
    const now = new Date();
    const cutoffStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const sorted = [...scheduleData].sort((a, b) => normalizeDateString(a.date).localeCompare(normalizeDateString(b.date)));
    const nextNiigata = sorted.find(m => normalizeDateString(m.date) >= cutoffStr && m.club === "niigata");
    const nextKumamoto = sorted.find(m => normalizeDateString(m.date) >= cutoffStr && m.club === "kumamoto");
    const escapeAttr = (value) => String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const parseScorePair = (score) => {
      const parts = String(score || "").match(/(\d+)\s*[-:]\s*(\d+)/);
      return parts ? [Number(parts[1]), Number(parts[2])] : [NaN, NaN];
    };
    const toTeamResult = (r, kw, club) => {
      const date = normalizeDateString(r.date);
      if (!date) return null;
      if (r.club && r.opponent) {
        if (club && r.club !== club) return null;
        const [sM, sO] = parseScorePair(r.score || `${r.score_my}-${r.score_opp}`);
        if (!Number.isFinite(sM) || !Number.isFinite(sO)) return null;
        const opponent = r.opponent || "";
        return {
          date,
          isHome: r.home_away ? r.home_away === "H" : getMatchIsHome(r),
          sM,
          sO,
          opponent,
          pk: r.pk || "",
          emblem: resolveEmblemUrl(opponent, r.emblem || ""),
          key: `${date}|${club || r.club}|${normalizeName(opponent)}`
        };
      }
      if (!r.home || !r.away) return null;
      if (!robustTeamMatch(r.home, kw) && !robustTeamMatch(r.away, kw)) return null;
      const isHome = robustTeamMatch(r.home, kw);
      const sM = Number(isHome ? r.home_score : r.away_score);
      const sO = Number(isHome ? r.away_score : r.home_score);
      if (!Number.isFinite(sM) || !Number.isFinite(sO)) return null;
      const opponent = ((isHome ? r.away : r.home) || "").replace(/\u306e\u8a66\u5408\u8a73\u7d30|\u306e\u7d50\u679c/g, "").trim();
      return {
        date,
        isHome,
        sM,
        sO,
        opponent,
        pk: r.pk || "",
        emblem: resolveEmblemUrl(opponent, r.emblem || ""),
        key: `${date}|${club || kw}|${normalizeName(opponent)}`
      };
    };
    const getPastResults = (kw, club, cutoff) => {
      const seen = new Set();
      return [...officialResults, ...scheduleData]
        .map(r => toTeamResult(r, kw, club))
        .filter(Boolean)
        .filter(r => {
          if (r.date >= cutoff || seen.has(r.key)) return false;
          seen.add(r.key);
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    };
    const resultMeta = (r) => {
      let symbol = "DRAW";
      let badgeColor = "#f1f3f4";
      let badgeText = "#5f6368";
      let scoreStr = `${r.sM} - ${r.sO}`;
      if (r.sM > r.sO) { symbol = "WIN"; badgeColor = "#e6f4ea"; badgeText = "#137333"; }
      else if (r.sM < r.sO) { symbol = "LOSE"; badgeColor = "#fce8e6"; badgeText = "#c5221f"; }
      else if (r.pk) {
        const pkMatch = String(r.pk).match(/(\d+)\s*PK\s*(\d+)/i);
        if (pkMatch) {
          const pkM = Number(r.isHome ? pkMatch[1] : pkMatch[2]);
          const pkO = Number(r.isHome ? pkMatch[2] : pkMatch[1]);
          scoreStr = `(${pkM}) ${r.sM}-${r.sO} (${pkO})`;
          if (pkM > pkO) { symbol = "PK WIN"; badgeColor = "#e6f4ea"; badgeText = "#137333"; }
          else { symbol = "PK LOSE"; badgeColor = "#fce8e6"; badgeText = "#c5221f"; }
        }
      }
      return { symbol, badgeColor, badgeText, scoreStr };
    };
    const updateUI = (club, teamKw, match) => {
      const card = document.getElementById(`dash-card-${club}`);
      if (!card) return;
      const cutoff = match ? normalizeDateString(match.date) : "9999-12-31";
      const updateHalf = (prefix, kw, resultClub) => {
        const past = getPastResults(kw, resultClub, cutoff);
        if (!past.length) return;
        const last = past[0];
        const meta = resultMeta(last);
        const resHtml = `<span class="dash-result-pill" style="border-color:${meta.badgeColor}; background:${meta.badgeColor}; color:${meta.badgeText};"><span></span>${meta.symbol}</span>`;
        const formHtml = `<div class="dash-form-strip">${past.slice(0, 5).reverse().map(r => {
          const rMeta = resultMeta(r);
          const rSym = rMeta.symbol.includes("WIN") ? "\u25cb" : rMeta.symbol.includes("LOSE") ? "\u25cf" : "\u25b3";
          const emblemHtml = r.emblem
            ? `<img class="dash-form-emblem" src="${escapeAttr(r.emblem)}" alt="${escapeAttr(r.opponent)}">`
            : `<span class="dash-form-emblem-placeholder"></span>`;
          return `<span class="dash-form-item" title="${escapeAttr(r.date)} ${escapeAttr(r.opponent)} ${rMeta.scoreStr}"><span class="dash-form-symbol">${rSym}</span>${emblemHtml}<span class="dash-form-ha">${r.isHome ? "H" : "A"}</span></span>`;
        }).join("")}</div>`;
        const elDate = card.querySelector(`.val-prev-date-${prefix}`);
        const elOpp = card.querySelector(`.val-prev-opp-name-${prefix}`);
        const elHA = card.querySelector(`.val-prev-ha-${prefix}`);
        const elScore = card.querySelector(`.val-prev-score-${prefix}`);
        const elRes = card.querySelector(`.val-prev-res-${prefix}`);
        const elForm = card.querySelector(`.val-prev-form-${prefix}`);
        if (elDate) elDate.innerText = last.date.substring(5).replace("-", "/");
        if (elOpp) elOpp.innerText = last.opponent;
        if (elHA) elHA.innerText = last.isHome ? "(H)" : "(A)";
        if (elScore) elScore.innerText = meta.scoreStr;
        if (elRes) elRes.innerHTML = resHtml;
        if (elForm) elForm.innerHTML = formHtml;
      };
      updateHalf("my", teamKw, club);
      if (match) updateHalf("opp", match.opponent, null);
    };
    updateUI("niigata", "\u65b0\u6f5f", nextNiigata);
    updateUI("kumamoto", "\u718a\u672c", nextKumamoto);
    setTimeout(() => {
      const wN = document.getElementById("dash-weather-niigata");
      const wK = document.getElementById("dash-weather-kumamoto");
      if (typeof updateWeatherUI === "function") {
        if (wN && nextNiigata) updateWeatherUI(wN, nextNiigata.date, nextNiigata.venue);
        if (wK && nextKumamoto) updateWeatherUI(wK, nextKumamoto.date, nextKumamoto.venue);
      }
    }, 100);
    const dashboardContainer = document.getElementById("dashboard-cards-container");
    let timeBox = document.getElementById("dash-update-time");
    if (!timeBox && dashboardContainer) {
      timeBox = document.createElement("div");
      timeBox.id = "dash-update-time";
      dashboardContainer.appendChild(timeBox);
    }
    if (timeBox) {
      timeBox.style.cssText = "font-size:0.65rem; color:white; background:rgba(0,0,0,0.5); padding:4px 12px; border-radius:10px; margin-top:15px; display:inline-block; font-weight:700;";
      timeBox.innerText = historicalDataLoaded
        ? `\u6700\u7d42\u540c\u671f: ${new Date().toLocaleTimeString()} (Vision data 1999-${new Date().getFullYear()})`
        : "\u5c65\u6b74\u30c7\u30fc\u30bf\u8aad\u307f\u8fbc\u307f\u4e2d...";
    }
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
        const scoreData = getStoredOrOfficialScore(match);
        const sMy = scoreData.my, sOpp = scoreData.opp;
        const sPkM = scoreData.pkMy, sPkO = scoreData.pkOpp;
        let res = null;
        let scoreDisplay = "";
        const scoreMeta = getScoreMetaFromValues(sMy, sOpp, sPkM, sPkO);
        if (scoreMeta) {
          res = scoreMeta.result;
          scoreDisplay = scoreMeta.score;
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
        card.innerHTML = `${resultHtml}<div class="match-meta"><span class="match-mw-pill">${match.matchweek || "EX"}</span><span class="match-ha-pill">${ha}</span>${isAtt ? '<span class="match-att-emoji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>' : ''}</div><div class="match-date-time">${match.date} ${match.day} - ${match.time}</div><div class="match-venue">${match.venue}</div><div class="match-row"><h3 class="opponent-name" title="\u9577\u62bc\u3057\u3067HOME/AWAY\u306e\u30af\u30e9\u30d6\u540d\u3092\u30b3\u30d4\ufffdE">${escapeHtml(match.opponent)}</h3><img class="emblem" src="${escapeHtml(emblemUrl)}"></div>`;
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
    applyYearFilter(y, true);
    const i = visibleSections.findIndex(s => s.dataset.ym === k);
    if (i !== -1) scrollToIndex(i);
  };
  // YM Picker
  function openYmPicker() {
    if (!activeMonthTitle.textContent.includes("/")) return; // Not fully initialized
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
        <div class="ym-picker-years" aria-label="\u5e74"></div>
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
      yearLabel.textContent = `${pickerYear}\u5e74`;
      monthGrid.innerHTML = "";
      yearMap[pickerYear]
        .sort((a, b) => Number(a.m) - Number(b.m))
        .forEach(item => {
        const btn = document.createElement("button"); btn.className = "ym-picker-btn";
        btn.textContent = Number(item.m) + "\u6708";
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
  document.getElementById("menu-data").onclick = () => openSubPane("data-overlay");
  document.getElementById("menu-reload").onclick = async () => {
    const btn = document.getElementById("menu-reload");
    const label = btn.querySelector(".m-label");
    const originalLabel = label.textContent;
    label.textContent = "\u66f4\u65b0\u4e2d...";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";
    try {
      await refreshAllData(true); // Force GAS
      alert("\u6700\u65b0\u30c7\u30fc\u30bf\u3092\u53d6\u5f97\u3057\u3066\u53cd\u6620\u3057\u307e\u3057\u305f\u3002");
    } catch (e) {
      console.error(e);
      alert("\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
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
        alert("\u30a4\u30f3\u30dd\u30fc\u30c8\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\u3002\u30a2\u30d7\u30ea\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u307e\u3059\u3002");
        location.reload();
      } catch (err) {
        alert("\u5931\u6557: \u6b63\u3057\u3044\u30d0\u30c3\u30af\u30a2\u30c3\u30d7\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
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
  // \ud83d\udccb Export Attendance Schedule
  const exportListBtn = document.getElementById("export-list-btn");
  if (exportListBtn) {
    exportListBtn.onclick = async () => {
      let txt = "\u3010\u89b3\u6226\u4e88\u5b9a\u30ea\u30b9\u30c8\u3011\n\n";
      const attMatches = scheduleData.filter(match => {
        const mId = `${match.date}_${match.club}_${match.opponent}`;
        return localStorage.getItem(`attend_${mId}`) === "true";
      }).sort((a, b) => parseDate(a.date) - parseDate(b.date));
      if (attMatches.length === 0) {
        alert("\u89b3\u6226\u4e88\u5b9a\u306e\u8a66\u5408\u306f\u307e\u306d\u3042\u308a\u307e\u305b\u3093\u3002");
        return;
      }
      attMatches.forEach(m => {
        const isHome = getMatchIsHome(m);
        txt += `${m.date} ${m.day} ${m.time} - vs ${m.opponent}\n`;
        txt += `\ud83d\udccd ${m.venue} (${isHome ? 'HOME' : 'AWAY'})\n\n`;
      });
      txt += "Powered by Match Day Ultra";
      try {
        await navigator.clipboard.writeText(txt);
        alert("\u89b3\u6226\u4e88\u5b9a\u30ea\u30b9\u30c8\u3092\u30af\u30ea\u30c3\u30d7\u30dc\u30fc\u30c9\u306b\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f\u3002\nLINE\u3084\u30e1\u30e2\u5e33\u306b\u8cbc\u308a\u4ed8\u3051\u3066\u5171\u6709\u3067\u304d\u307e\u3059\u3002");
      } catch (err) {
        alert("\u30b3\u30d4\u30fc\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u3053\u306e\u30d6\u30e9\u30a6\u30b6\u306f\u30b5\u30dd\u30fc\u30c8\u3055\u308c\u3066\u3044\u306a\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\u3002");
      }
    };
  }
  // \u26a1 Fast Input Modal
  const fastInputBtn = document.getElementById("fast-input-btn");
  const fastInputSheet = document.getElementById("fast-input-sheet");
  const fastInputList = document.getElementById("fast-input-list");
  const saveFastInputBtn = document.getElementById("save-fast-input");
  const closeFastInputBtn = document.getElementById("close-fast-input");
  let fastSelectedYear = 2026;
  function renderFastInput() {
    fastInputList.innerHTML = "";
    // \u9078\u629e\u3055\u308c\u305f\u5e74\u306e\u8a66\u5408\u3092\u5168\u4ef6\u53d6\u5f97\uff08\u672a\u6765\u306e\u8a66\u5408\u3082\u542b\u3081\u308b\uff09
    const yearMatches = scheduleData.filter(m => {
      return parseDate(m.date).getFullYear() === fastSelectedYear;
    }).sort((a, b) => parseDate(a.date) - parseDate(b.date));
    if (yearMatches.length === 0) {
      fastInputList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-grey);">${fastSelectedYear}\u5e74\u306e\u8a72\u5f53\u3059\u308b\u8a66\u5408\u306f\u3042\u308a\u307e\u305b\u3093\u3002</div>`;
    } else {
      yearMatches.forEach(m => {
        const mYear = parseDate(m.date).getFullYear();
        const mId = `${m.date}_${m.club}_${m.opponent}`;
        const sMy = localStorage.getItem(`score_my_${mId}`) || "";
        const sOpp = localStorage.getItem(`score_opp_${mId}`) || "";
        const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "";
        const sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
        const isAttend = localStorage.getItem(`attend_${mId}`) === "true";
        // 2026\u5e74\u3067\u304b\u3064\u73fe\u5728\u306e\u5165\u529b\u5024\u304c\u540c\u70b9\u306e\u5834\u5408\ufffdE\u307fPK\u9818\u57df\u3092\u8868\u793a\u3059\u308b
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
             
             <!-- PK\u5165\u529b\u9818\u57df\ufffdE\ufffdE\ufffdE\ufffdE026\u5e74\u304b\u3064\u540c\u70b9\u6642\ufffdE\u307f\u8868\u793a\ufffdE\ufffdE\ufffdE\ufffdE-->
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
    // \u30b9\u30b3\u30a2\u5165\u529b\u6642\u306e\u52d5\u7684\u306aPK\u9818\u57df\u306e\u8868\u793a\u5201E\ufffdE\ufffd\ufffdE\ufffd
    fastInputList.oninput = (e) => {
      const inp = e.target;
      if (inp.classList.contains("fast-my-score") || inp.classList.contains("fast-opp-score")) {
        const mYear = parseInt(inp.dataset.year);
        if (mYear === 2026) {
          const container = inp.closest("div").parentElement; // .flex-end \u9818\u57df
          const pkArea = container.querySelector(".fast-pk-area");
          if (pkArea) {
            const mS = container.querySelector(".fast-my-score").value;
            const oS = container.querySelector(".fast-opp-score").value;
            pkArea.style.display = (mS !== "" && oS !== "" && mS === oS) ? "flex" : "none";
          }
        }
      }
    };
    // \u89b3\u6226\u30c8\u30b0\u30eb\u306e\u30cf\u30f3\u30c9\u30ea\u30f3\u30b0
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
        alert("\u4e00\u62ec\u5165\u529b\u306e\u5185\u5bb9\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002");
      }
      fastInputSheet.classList.remove("active");
    };
  }
  // \ud83d\udccb Text Bulk Input Parsing (New Screen Flow)
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
      const blocks = text.split(/\u7b2c(\d+)\u7bc0/);
      let savedCount = 0;
      for (let i = 1; i < blocks.length; i += 2) {
        const mwNum = blocks[i];
        const content = blocks[i + 1];
        const scoreMatch = content.match(/(\u25cb|\u25cf|\u25b3|[-])?\s*(\d+)-(\d+)(?:\s*PK(\d+)-(\d+))?/);
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
            const oppNameBase = c.opponent.replace(/[A-Za-z\uFF41-\uFF5A\uFF21-\uFF3A\s\u30fb.()]/g, '').substring(0, 2);
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
        alert(`${savedCount}\u4ef6\u306e\u8a66\u5408\u7d50\u679c\u3092\u53cd\u6620\u3057\u307e\u3057\u305f\u3002`);
        bulkPasteArea.value = "";
        closeSubPane("bulk-paste-overlay");
      } else {
        alert("\u8a66\u5408\u30c7\u30fc\u30bf\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u5165\u529b\u5f62\u5f0f\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      }
    };
  }
  // \ud83d\udce2 Chants Accordion Logic
  document.querySelectorAll('.u-chant-title').forEach(title => {
    title.onclick = () => {
      const parent = title.parentElement;
      parent.classList.toggle('active');
    };
  });
  // =========================================================
  // \ud83d\udd04 GAS API \u81ea\u52d5\u540c\u671f\uff08\u8a66\u5408\u7d50\u679c + \u9801E\ufffdE\ufffd\ufffdE\ufffd\u8868\ufffdE\ufffdE\ufffdE\ufffdE  // =========================================================
  const gasUrl = 'https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec';
  // --- Standings View ---
  async function loadStandings() {
    const container = document.getElementById("standings-content");
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">\u8aad\u307f\u8fbc\u307f\u4e2d...</div>`;
    try {
      const json = await fetchData("standings");
      if (!json || !json.data || !Array.isArray(json.data)) throw new Error("no data");
      // \u30b0\u30eb\u30fc\u30d7\u5225\u306b\u6574\u7406
      const groups = {};
      json.data.forEach(row => {
        if (!groups[row.group]) groups[row.group] = [];
        groups[row.group].push(row);
      });
      // \u30b0\u30eb\u30fc\u30d7\u8868\u793a\u9806 EAST / WEST
      const GROUP_ORDER = ['WEST-A', 'WEST-B', 'EAST-A', 'EAST-B'];
      const sortedGroups = Object.keys(groups).sort((a, b) => {
        const ai = GROUP_ORDER.findIndex(k => a.includes(k));
        const bi = GROUP_ORDER.findIndex(k => b.includes(k));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      // \u30ab\u30e9\u30e0\u5b9a\u7fa9
      const COLS = [
        { label: '\u9806\u4f4d', key: 'rank', type: 'num' },
        { label: '\u30c1\u30fc\u30e0', key: 'team', type: 'str' },
        { label: '\u52dd\u70b9', key: 'points', type: 'num' },
        { label: '\u8a66\u5408', key: 'played', type: 'num' },
        { label: '\u52dd', key: 'won', type: 'num' },
        { label: 'PK\u52dd', key: 'pk_won', type: 'num' },
        { label: 'PK\u6557', key: 'pk_lost', type: 'num' },
        { label: '\u6557', key: 'lost', type: 'num' },
        { label: '\u5f97\u70b9', key: 'goals_for', type: 'num' },
        { label: '\u5931\u70b9', key: 'goals_against', type: 'num' },
        { label: '\u5dee', key: 'goal_diff', type: 'num' },
      ];
      // \u30bd\u30fc\u30c8\u72b6\u614b\u3092\u30b0\u30eb\u30fc\u30d7\u6bce\u306b\u7ba1\u7406
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
          const isNiigata = (row.team || '').includes('\u65b0\u6f5f');
          const isKumamoto = (row.team || '').includes('\u718a\u672c');
          const trcls = isNiigata ? 'standing-niigata' : isKumamoto ? 'standing-kumamoto' : '';
          const emblemUrl = getEmblemUrlForTeam(row.team);
          const emblemHTML = emblemUrl ? '<img class="standing-team-emblem" src="' + escapeHtml(emblemUrl) + '" alt="' + escapeHtml(row.team) + '">' : '<span class="standing-team-emblem-placeholder"></span>';
          return '<tr class="' + trcls + '">'
            + '<td class="col-rank">' + row.rank + '</td>'
            + '<td class="standing-team" style="cursor:pointer;" onclick="openClubSite(\'' + row.team + '\', event)"><span class="standing-team-name">' + emblemHTML + '<span>' + row.team + '</span></span></td>'
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
        html += '<p style="text-align:center;font-size:0.75rem;color:#999;margin-top:16px;padding-bottom:8px;">\u66f4\u65b0: ' + now + '</p>';
        container.innerHTML = html;
        // \u30bd\u30fc\u30c8\u30af\u30ea\u30c3\u30af\u30a4\u30d9\u30f3\u30c8\u3092\u518d\u30d0\u30a4\u30f3\u30c9
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
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;">\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002<br>\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002</div>`;
    }
  }
  // --- J-League Historical Data Loader ---
  function shortenCompetition(comp) {
    if (!comp) return "J\u30ea\u30fc\u30b0";
    if (comp.includes("\u30c7\u30a3\u30d3\u30b8\u30e7\u30f31") || comp.includes("J1")) return "J1";
    if (comp.includes("\u30c7\u30a3\u30d3\u30b8\u30e7\u30f32") || comp.includes("J2")) return "J2";
    if (comp.includes("J3")) return "J3";
    if (comp.includes("\u5929\u7687\u676f")) return "\u5929\u7687\u676f";
    if (comp.includes("\u30e4\u30de\u30b6\u30ad\u30ca\u30d3\u30b9\u30b3") || comp.includes("\u30ca\u30d3\u30b9\u30b3")) return "\u30ca\u30d3\u30b9\u30b3\u676f";
    if (comp.includes("\u30eb\u30f4\u30a1\u30f3")) return "\u30eb\u30f4\u30a1\u30f3\u676f";
    return comp.replace("J\u30ea\u30fc\u30b0", "J").trim();
  }
  function decorateMatchWithJsonDetails(target, m, isHome) {
    if (!target) return;
    
    // Add referee details
    const refereeValues = getRefereeValues(m.referees);
    target.referee = refereeValues.referee;
    target.assistant_referees = refereeValues.assistants;
    target.manager = isHome ? (m.home_details ? m.home_details.manager : "") : (m.away_details ? m.away_details.manager : "");
    target.j_official_url = m.url || "";
    target.weather = m.weather || "";
    target.temperature = m.temperature !== undefined && m.temperature !== null ? m.temperature : "";
    target.humidity = m.humidity !== undefined && m.humidity !== null ? m.humidity : "";
    target.attendance = m.attendance !== undefined && m.attendance !== null ? m.attendance : "";
    
    // Add goals
    const rawOwnGoals = isHome ? m.home_goals : m.away_goals;
    target.goals = Array.isArray(rawOwnGoals) ? rawOwnGoals.map(g => ({
      minute: g.time ? g.time.replace("'", "") : "",
      scorer: g.name
    })) : [];
    
    const rawOppGoals = isHome ? m.away_goals : m.home_goals;
    target.opponent_goals = Array.isArray(rawOppGoals) ? rawOppGoals.map(g => ({
      minute: g.time ? g.time.replace("'", "") : "",
      scorer: g.name
    })) : [];
    
    // Add starting and bench members
    const homeDetails = m.home_details || {};
    const awayDetails = m.away_details || {};
    
    const ownDetails = isHome ? homeDetails : awayDetails;
    const opponentDetails = isHome ? awayDetails : homeDetails;
    target.starting_members = mapMemberList(ownDetails.starting);
    target.bench_members = mapMemberList(ownDetails.substitutes);
    target.opponent_starting_members = mapMemberList(opponentDetails.starting);
    target.opponent_bench_members = mapMemberList(opponentDetails.substitutes);
    
    // Add substitutions
    target.substitutions = mapSubstitutions(ownDetails);
    target.opponent_substitutions = mapSubstitutions(opponentDetails);
    
    // Add warnings/cards
    target.warnings = mapWarnings(ownDetails);
    target.opponent_warnings = mapWarnings(opponentDetails);
  }
  function processHistoricalMatches(matches, year) {
    if (!Array.isArray(matches)) return;
    
    matches.forEach(m => {
      const isNiigata = robustTeamMatch(m.home_team, "\u30a2\u30eb\u30d3\u30ec\u30c3\u30af\u30b9\u65b0\u6f5f") || robustTeamMatch(m.away_team, "\u30a2\u30eb\u30d3\u30ec\u30c3\u30af\u30b9\u65b0\u6f5f");
      const isKumamoto = robustTeamMatch(m.home_team, "\u30ed\u30a2\u30c3\u30bd\u718a\u672c") || robustTeamMatch(m.away_team, "\u30ed\u30a2\u30c3\u30bd\u718a\u672c");
      
      if (!isNiigata && !isKumamoto) return;
      
      const club = isNiigata ? "niigata" : "kumamoto";
      const clubKeyword = isNiigata ? "\u30a2\u30eb\u30d3\u30ec\u30c3\u30af\u30b9\u65b0\u6f5f" : "\u30ed\u30a2\u30c3\u30bd\u718a\u672c";
      const isHome = robustTeamMatch(m.home_team, clubKeyword);
      const opponent = isHome ? m.away_team : m.home_team;
      const dateStr = normalizeDateString(m.date);
      
      // Build the officialResult
      const d = new Date(dateStr);
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const dayStr = days[d.getDay()];
      
      const hScore = parseInt(m.home_score);
      const aScore = parseInt(m.away_score);
      let resultMark = "\u25b3";
      if (isHome) {
        if (hScore > aScore) resultMark = "\u25cb";
        else if (hScore < aScore) resultMark = "\u25cf";
      } else {
        if (aScore > hScore) resultMark = "\u25cb";
        else if (aScore < hScore) resultMark = "\u25cf";
      }
      
      const scoreStr = isHome ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`;
      const compShort = shortenCompetition(m.competition);
      const detailsStr = `${compShort} ${isHome ? "H" : "A"} ${resultMark} ${scoreStr}`;
      
      let emblem = resolveEmblemUrl(opponent, "") || "";
      if (!emblem) {
        const reversed = Object.entries(EMBLEM_MAP).find(([k,v]) => robustTeamMatch(v, opponent));
        if (reversed) emblem = `https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png`;
      }
      
      const sectionText = String(m.section || "").trim();
      const matchweekDisplay = sectionText ? sectionText.replace(/\u7b2c(\d+)\u7bc0.*/, "\u7b2c$1\u7bc0") : "\u516c\u5f0f\u6226";
      const mwNum = sectionText.replace(/\D/g, "");
      const mwToken = mwNum ? "MW" + mwNum : "EX";
      
      const resultObj = {
        club: club,
        matchweek: matchweekDisplay,
        date: dateStr,
        day: dayStr,
        time: m.kickoff || "",
        opponent: opponent,
        venue: m.stadium || "",
        emblem: emblem,
        details: detailsStr,
        home_away: isHome ? "H" : "A",
        score: scoreStr,
        result_mark: resultMark,
        stage: matchweekDisplay,
        tournament: compShort,
        raw_json: m
      };
      
      decorateMatchWithJsonDetails(resultObj, m, isHome);
      const existsResult = officialResults.find(r => r.date === dateStr && r.club === club && robustTeamMatch(r.opponent || "", opponent));
      if (existsResult) {
        Object.assign(existsResult, resultObj);
        decorateMatchWithJsonDetails(existsResult, m, isHome);
      } else {
        officialResults.push(resultObj);
      }

      const scheduleObj = {
        club: club,
        matchweek: mwToken,
        date: dateStr,
        day: dayStr,
        time: m.kickoff || "",
        opponent: opponent,
        venue: m.stadium || "",
        emblem: emblem,
        details: detailsStr,
        home_away: isHome ? "H" : "A",
        score: scoreStr,
        result_mark: resultMark,
        stage: matchweekDisplay,
        tournament: compShort,
        raw_json: m
      };
      decorateMatchWithJsonDetails(scheduleObj, m, isHome);

      const existsSchedule = scheduleData.find(s => s.date === dateStr && s.club === club && robustTeamMatch(s.opponent, opponent));
      if (existsSchedule) {
        Object.assign(existsSchedule, scheduleObj);
        decorateMatchWithJsonDetails(existsSchedule, m, isHome);
      } else {
        scheduleData.push(scheduleObj);
      }
    });
  }
  function decorateAllMatches() {
    scheduleData.forEach(m => {
      const offRes = findOfficialResult(m);
      if (offRes) {
        ["score", "result_mark", "stage", "tournament", "details", "home_away", "raw_json", "referee", "assistant_referees", "manager", "j_official_url", "weather", "temperature", "humidity", "attendance", "goals", "opponent_goals", "starting_members", "bench_members", "opponent_starting_members", "opponent_bench_members", "substitutions", "opponent_substitutions", "warnings", "opponent_warnings"].forEach(key => {
          if (offRes[key] !== undefined && offRes[key] !== null) {
            m[key] = offRes[key];
          }
        });
      }
    });
  }
  async function loadHistoricalData() {
    if (historicalDataPromise) return historicalDataPromise;
    historicalDataLoaded = false;
    historicalDataPromise = (async () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1999; y--) {
      years.push(y);
    }
    
    const promises = years.map(async (year) => {
      try {
        const res = await fetch(`vision/data/${year}.json?v=${Date.now()}`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const matches = await res.json();
        processHistoricalMatches(matches, year);
      } catch (e) {
        console.warn(`Failed to load historical matches for year ${year}:`, e);
      }
    });
    
    await Promise.all(promises);
    
    scheduleData.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    
    decorateAllMatches();
    historicalDataLoaded = true;
    
    rebuildYearTabs();
    renderFeed();
    applyYearFilter(selectedYear === null ? currentYear : selectedYear, true);
    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "calendar") renderCalendar();
    return true;
    })();
    return historicalDataPromise;
  }
  // \u30a2\u30d7\u30ea\u8d77\u52d5\u6642\u306b\u521d\u671f\u5316
  updateHeaderAnnouncements();
  // \u30a2\u30d7\u30ea\u8d77\u52d5\u6642\u306b\u30d0\u30c3\u30af\u30b0\u30e9\u30a6\u30f3\u30c9\u3067\u7d50\u679c\u540c\u671f\u304a\u3088\u3073\u6b74\u53f2\u30c7\u30fc\u30bf\u3092\u30ed\u30fc\u30c9
  setTimeout(() => {
    refreshAllData(true)
      .catch((e) => {
        console.error("refreshAllData error", e);
      })
      .finally(() => {
        loadHistoricalData().catch((e) => console.warn("historical data fallback failed", e));
      });
  }, 800);
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
