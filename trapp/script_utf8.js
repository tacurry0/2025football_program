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
      alert("蜈ｬ蠑上し繧､繝医・繝・・繧ｿ縺瑚ｪｭ縺ｿ霎ｼ繧√∪縺帙ｓ縺ｧ縺励◆縲ゅΟ繝ｼ繧ｫ繝ｫ迺ｰ蠅・file://)縺ｮ蝣ｴ蜷医√ヶ繝ｩ繧ｦ繧ｶ縺ｮ繧ｻ繧ｭ繝･繝ｪ繝・ぅ險ｭ螳壹〒繝悶Ο繝・け縺輔ｌ縺ｦ縺・ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧翫∪縺吶・);
      console.error("Failed to load club sites", e);
      return;
    }
  }
  
  // Remove all spaces, dots, middle dots, hyphens, and convert full-width to half-width
  const norm = (s) => (s || "").normalize("NFKC").replace(/[\s繝ｻ\.\-\_]/g, "").toLowerCase();
  const targetNorm = norm(clubName);
  
  let club = window.clubSitesData.find(c => norm(c.club_name) === targetNorm);
  
  if (!club) {
    club = window.clubSitesData.find(c => {
      const cNorm = norm(c.club_name);
      return cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
    });
  }

  // Fallback for tricky JLeague abbreviations like "F譚ｱ莠ｬ" vs "FC譚ｱ莠ｬ"
  if (!club && targetNorm.includes("f譚ｱ莠ｬ")) club = window.clubSitesData.find(c => c.club_name.includes("FC譚ｱ莠ｬ"));
  if (!club && targetNorm.includes("c螟ｧ髦ｪ")) club = window.clubSitesData.find(c => c.club_name.includes("繧ｻ繝ｬ繝・た"));
  if (!club && targetNorm.includes("g螟ｧ髦ｪ")) club = window.clubSitesData.find(c => c.club_name.includes("繧ｬ繝ｳ繝・));
  if (!club && targetNorm.includes("譚ｱ莠ｬv")) club = window.clubSitesData.find(c => c.club_name.includes("繝ｴ繧ｧ繝ｫ繝・ぅ"));
  if (!club && targetNorm.includes("讓ｪ豬彷m")) club = window.clubSitesData.find(c => c.club_name.includes("繝槭Μ繝弱せ"));

  if (club && club.official_site) {
    window.open(club.official_site, '_blank');
  } else {
    alert("蜈ｬ蠑上し繧､繝医′隕九▽縺九ｊ縺ｾ縺帙ｓ:\n" + 
          "繧ｯ繝ｩ繝門錐蜑・ [" + clubName + "]\n" + 
          "豁｣隕丞喧: [" + targetNorm + "]");
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
    "蛹玲ｵｷ驕薙さ繝ｳ繧ｵ繝会ｿｽE繝ｬ譛ｭ蟷・: "HOKKAIDO CONSADOLE SAPPORO", "譛ｭ蟷・: "HOKKAIDO CONSADOLE SAPPORO", "繝ｴ繧｡繝ｳ繝ｩ繝ｼ繝ｬ蜈ｫ謌ｸ": "VANRAURE HACHINOHE", "蜈ｫ謌ｸ": "VANRAURE HACHINOHE", "縺・・ｽ・ｽ縺ｦ繧ｰ繝ｫ繝ｼ繧ｸ繝｣逶帛ｲ｡": "IWATE GRULLA MORIOKA", "蟯ｩ謇・: "IWATE GRULLA MORIOKA", "繝吶ぎ繝ｫ繧ｿ莉吝床": "VEGALTA SENDAI", "莉吝床": "VEGALTA SENDAI", "繝悶Λ繧ｦ繝悶Μ繝・・ｽ・ｽ遘狗伐": "BLAUBLITZ AKITA", "遘狗伐": "BLAUBLITZ AKITA", "繝｢繝ｳ繝・・ｽ・ｽ繧｣繧ｪ螻ｱ蠖｢": "MONTEDIO YAMAGATA", "螻ｱ蠖｢": "MONTEDIO YAMAGATA", "遖丞ｳｶ繝ｦ繝翫う繝・・ｽ・ｽ繝宇C": "FUKUSHIMA UNITED FC", "遖丞ｳｶ": "FUKUSHIMA UNITED FC", "縺・・ｽ・ｽ縺孝C": "IWAKI FC", "縺・・ｽ・ｽ縺・: "IWAKI FC", "鮖ｿ蟲ｶ繧｢繝ｳ繝医Λ繝ｼ繧ｺ": "KASHIMA ANTLERS", "鮖ｿ蟲ｶ": "KASHIMA ANTLERS", "豌ｴ謌ｸ繝幢ｿｽE繝ｪ繝ｼ繝帙ャ繧ｯ": "MITO HOLLYHOCK", "豌ｴ謌ｸ": "MITO HOLLYHOCK", "譬・・ｽ・ｽSC": "TOCHIGI SC", "譬・・ｽ・ｽ": "TOCHIGI SC", "繧ｶ繧ｹ繝醍ｾ､鬥ｬ": "THESPA GUNMA", "繧ｶ繧ｹ繝代け繧ｵ繝・・ｽ・ｽ鬥ｬ": "THESPAKUSATSU GUNMA", "鄒､鬥ｬ": "THESPA GUNMA", "豬ｦ蜥後Ξ繝・・ｽ・ｽ": "URAWA REDS", "豬ｦ蜥・: "URAWA REDS", "螟ｧ螳ｮ繧｢繝ｫ繝・・ｽ・ｽ繝ｼ繧ｸ繝｣": "OMIYA ARDIJA", "RB螟ｧ螳ｮ繧｢繝ｫ繝・・ｽ・ｽ繝ｼ繧ｸ繝｣": "RB OMIYA ARDIJA", "螟ｧ螳ｮ": "RB OMIYA ARDIJA", "繧ｸ繧ｧ繝輔Θ繝翫う繝・・ｽ・ｽ繝牙鴻闡・: "JEF UNITED CHIBA", "蜊・・ｽ・ｽ": "JEF UNITED CHIBA", "譟上Ξ繧､繧ｽ繝ｫ": "KASHIWA REYSOL", "譟・: "KASHIWA REYSOL", "FC譚ｱ莠ｬ": "FC TOKYO", "譚ｱ莠ｬ": "FC TOKYO", "譚ｱ莠ｬ繝ｴ繧ｧ繝ｫ繝・・ｽ・ｽ": "TOKYO VERDY", "譚ｱ莠ｬV": "TOKYO VERDY", "FC逕ｺ逕ｰ繧ｼ繝ｫ繝薙い": "FC MACHIDA ZELVIA", "逕ｺ逕ｰ": "FC MACHIDA ZELVIA", "蟾晏ｴ弱ヵ繝ｭ繝ｳ繧ｿ繝ｼ繝ｬ": "KAWASAKI FRONTALE", "蟾晏ｴ・: "KAWASAKI FRONTALE", "讓ｪ豬廡繝ｻ繝槭Μ繝弱せ": "YOKOHAMA F. MARINOS", "讓ｪ豬廡M": "YOKOHAMA F. MARINOS", "讓ｪ豬廡C": "YOKOHAMA FC", "Y.S.C.C.讓ｪ豬・: "Y.S.C.C. YOKOHAMA", "貉伜漉繝吶Ν繝橸ｿｽE繝ｬ": "SHONAN BELLMARE", "貉伜漉": "SHONAN BELLMARE", "SC逶ｸ讓｡蜴・: "SC SAGAMIHARA", "逶ｸ讓｡蜴・: "SC SAGAMIHARA", "繝ｴ繧｡繝ｳ繝輔か繝ｼ繝ｬ逕ｲ蠎・: "VENTFORET KOFU", "逕ｲ蠎・: "VENTFORET KOFU", "譚ｾ譛ｬ螻ｱ髮・C": "MATSUMOTO YAMAGA FC", "譚ｾ譛ｬ": "MATSUMOTO YAMAGA FC", "AC髟ｷ驥弱ヱ繝ｫ繧ｻ繧､繝ｭ": "AC NAGANO PARCEIRO", "髟ｷ驥・: "AC NAGANO PARCEIRO", "繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・: "ALBIREX NIIGATA", "譁ｰ貎・: "ALBIREX NIIGATA", "繧ｫ繧ｿ繝ｼ繝ｬ蟇悟ｱｱ": "KATALLER TOYAMA", "蟇悟ｱｱ": "KATALLER TOYAMA", "繝・・ｽ・ｽ繝ｼ繧ｲ繝ｳ驥第ｲ｢": "ZWEIGEN KANAZAWA", "驥第ｲ｢": "ZWEIGEN KANAZAWA", "貂・・ｽ・ｽ繧ｨ繧ｹ繝代Ν繧ｹ": "SHIMIZU S-PULSE", "貂・・ｽ・ｽ": "SHIMIZU S-PULSE", "繧ｸ繝･繝薙Ο逎千伐": "JUBILO IWATA", "逎千伐": "JUBILO IWATA", "阯､譫扨YFC": "FUJIEDA MYFC", "阯､譫・: "FUJIEDA MYFC", "繧｢繧ｹ繝ｫ繧ｯ繝ｩ繝ｭ豐ｼ豢･": "AZUL CLARO NUMAZU", "豐ｼ豢･": "AZUL CLARO NUMAZU", "蜷榊商螻九げ繝ｩ繝ｳ繝代せ": "NAGOYA GRAMPUS", "蜷榊商螻・: "NAGOYA GRAMPUS", "FC蟯撰ｿｽE": "FC GIFU", "蟯撰ｿｽE": "FC GIFU", "莠ｬ驛ｽ繧ｵ繝ｳ繧ｬF.C.": "KYOTO SANGA F.C.", "莠ｬ驛ｽ": "KYOTO SANGA F.C.", "繧ｬ繝ｳ繝仙､ｧ髦ｪ": "GAMBA OSAKA", "G螟ｧ髦ｪ": "GAMBA OSAKA", "繧ｻ繝ｬ繝・・ｽ・ｽ螟ｧ髦ｪ": "CEREZO OSAKA", "C螟ｧ髦ｪ": "CEREZO OSAKA", "FC螟ｧ髦ｪ": "FC OSAKA", "螟ｧ髦ｪ": "FC OSAKA", "繝ｴ繧｣繝・・ｽ・ｽ繝ｫ逾樊虻": "VISSEL KOBE", "繝ｴ繧｣繝・・ｽ・ｽ繝ｫ逾樊宛": "VISSEL KOBE", "逾樊虻": "VISSEL KOBE", "螂郁憶繧ｯ繝ｩ繝・: "NARA CLUB", "螂郁憶": "NARA CLUB", "繧ｬ繧､繝奇ｿｽE繝ｬ魑･蜿・: "GAINARE TOTTORI", "魑･蜿・: "GAINARE TOTTORI", "繝輔ぃ繧ｸ繧｢繝ｼ繝主ｲ｡螻ｱ": "FAGIANO OKAYAMA", "蟯｡螻ｱ": "FAGIANO OKAYAMA", "繧ｵ繝ｳ繝輔Ξ繝・・ｽ・ｽ繧ｧ蠎・・ｽ・ｽ": "SANFRECCE HIROSHIMA", "蠎・・ｽ・ｽ": "SANFRECCE HIROSHIMA", "繝ｬ繝弱ヵ繧｡螻ｱ蜿｣FC": "RENOFA YAMAGUCHI FC", "螻ｱ蜿｣": "RENOFA YAMAGUCHI FC", "繧ｫ繝槭ち繝橸ｿｽE繝ｬ隶・・ｽ・ｽE: "KAMATAMARE SANUKI", "隶・・ｽ・ｽE: "KAMATAMARE SANUKI", "蠕ｳ蟲ｶ繝ｴ繧ｩ繝ｫ繝・・ｽ・ｽ繧ｹ": "TOKUSHIMA VORTIS", "蠕ｳ蟲ｶ": "TOKUSHIMA VORTIS", "諢帛ｪ妲C": "EHIME FC", "諢帛ｪ・: "EHIME FC", "FC莉頑ｲｻ": "FC IMABARI", "莉頑ｲｻ": "FC IMABARI", "繧｢繝薙せ繝醍ｦ丞ｲ｡": "AVISPA FUKUOKA", "遖丞ｲ｡": "AVISPA FUKUOKA", "繧ｮ繝ｩ繝ｴ繧｡繝ｳ繝・・ｽ・ｽ荵晏ｷ・: "GIRAVANZ KITAKYUSHU", "蛹嶺ｹ晏ｷ・: "GIRAVANZ KITAKYUSHU", "繧ｵ繧ｬ繝ｳ魑･譬・: "SAGAN TOSU", "魑･譬・: "SAGAN TOSU", "V繝ｻ繝輔ぃ繝ｼ繝ｬ繝ｳ髟ｷ蟠・: "V-VAREN NAGASAKI", "髟ｷ蟠・: "V-VAREN NAGASAKI", "繝ｭ繧｢繝・・ｽ・ｽ辭頑悽": "ROASSO KUMAMOTO", "辭頑悽": "ROASSO KUMAMOTO", "螟ｧ蛻・・ｽ・ｽ繝ｪ繝具ｿｽE繧ｿ": "OITA TRINITA", "螟ｧ蛻・: "OITA TRINITA", "繝・・ｽ・ｽ繝舌ず繝｣繝ｼ繝ｭ螳ｮ蟠・: "TEGEVAJARO MIYAZAKI", "螳ｮ蟠・: "TEGEVAJARO MIYAZAKI", "鮖ｿ蜈仙ｳｶ繝ｦ繝翫う繝・・ｽ・ｽ繝宇C": "KAGOSHIMA UNITED FC", "鮖ｿ蜈仙ｳｶ": "KAGOSHIMA UNITED FC", "FC逅臥帥": "FC RYUKYU", "逅臥帥": "FC RYUKYU", "鬮倡衍繝ｦ繝翫う繝・・ｽ・ｽ繝唄C": "KOCHI UNITED SC", "鬮倡衍": "KOCHI UNITED SC", "繝ｬ繧､繝ｩ繝・・ｽ・ｽ貊玖ｳFC": "REILAC SHIGA FC", "貊玖ｳ": "REILAC SHIGA FC"
  };

  // --- Date/Theme Helpers ---
  function parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d || 1);
  }

  function isBeforeToday(dateStr) {
    const target = parseDate(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return target < today;
  }

    const normalizeName = (s) => (s || "").normalize("NFKC").trim();
    
    // 繝・ｿｽE繝蜷搾ｿｽE繧・・ｽ・ｽ縺弱ｒ蜷ｸ蜿弱☆繧九◆繧・ｿｽE繝槭ャ繝斐Φ繧ｰ
    const GLOBAL_TEAM_MAP = {
      "譁ｰ貎・: "譁ｰ貎・, "辭頑悽": "辭頑悽", "魑･蜿・: "魑･蜿・, "蟇悟ｱｱ": "蟇悟ｱｱ", "驥第ｲ｢": "驥第ｲ｢",
      "貂・・ｽ・ｽ": "貂・・ｽ・ｽ", "逎千伐": "逎千伐", "蜷榊商螻・: "蜷榊商螻・, "逾樊宛": "逾樊虻", "逾樊虻": "逾樊虻", "莠ｬ驛ｽ": "莠ｬ驛ｽ",
      "譛ｭ蟷・: "譛ｭ蟷・, "鮖ｿ蟲ｶ": "鮖ｿ蟲ｶ", "豬ｦ蜥・: "豬ｦ蜥・, "譟・: "譟・, "貉伜漉": "貉伜漉",
      "逕ｺ逕ｰ": "逕ｺ逕ｰ", "蟾晏ｴ・: "蟾晏ｴ・, "讓ｪ豬廡M": "讓ｪ豬廡M", "讓ｪ豬廡繝ｻ繝槭Μ繝弱せ": "讓ｪ豬廡M", "螟ｧ蛻・: "螟ｧ蛻・, "遖丞ｲ｡": "遖丞ｲ｡",
      "魑･譬・: "魑･譬・, "髟ｷ蟠・: "髟ｷ蟠・, "蟯｡螻ｱ": "蟯｡螻ｱ", "蠎・・ｽ・ｽ": "蠎・・ｽ・ｽ", "螻ｱ蜿｣": "螻ｱ蜿｣",
      "蠕ｳ蟲ｶ": "蠕ｳ蟲ｶ", "隶・・ｽ・ｽE: "隶・・ｽ・ｽE, "蛹嶺ｹ晏ｷ・: "蛹嶺ｹ晏ｷ・, "螳ｮ蟠・: "螳ｮ蟠・,
      "蜈ｫ謌ｸ": "蜈ｫ謌ｸ", "逶帛ｲ｡": "逶帛ｲ｡", "遘狗伐": "遘狗伐", "螻ｱ蠖｢": "螻ｱ蠖｢",
      "莉吝床": "莉吝床", "豌ｴ謌ｸ": "豌ｴ謌ｸ", "鄒､鬥ｬ": "鄒､鬥ｬ", "螟ｧ螳ｮ": "螟ｧ螳ｮ", "蜊・・ｽ・ｽ": "蜊・・ｽ・ｽ",
      "逕ｲ蠎・: "逕ｲ蠎・, "髟ｷ驥・: "髟ｷ驥・, "譚ｾ譛ｬ": "譚ｾ譛ｬ", "鮖ｿ蜈仙ｳｶ": "鮖ｿ蜈仙ｳｶ",
      "譬・・ｽ・ｽSC": "譬・・ｽ・ｽ", "譬・・ｽ・ｽ": "譬・・ｽ・ｽ", "譬・・ｽ・ｽC": "譬・・ｽ・ｽ", "譬・・ｽ・ｽ・ｽE・ｽ": "譬・・ｽ・ｽ",
      "繧ｻ繝ｬ繝・・ｽ・ｽ": "繧ｻ繝ｬ繝・・ｽ・ｽ", "C螟ｧ髦ｪ": "繧ｻ繝ｬ繝・・ｽ・ｽ", "・ｽE・ｽ螟ｧ髦ｪ": "繧ｻ繝ｬ繝・・ｽ・ｽ",
      "繧ｬ繝ｳ繝・: "繧ｬ繝ｳ繝・, "G螟ｧ髦ｪ": "繧ｬ繝ｳ繝・, "・ｽE・ｽ螟ｧ髦ｪ": "繧ｬ繝ｳ繝・,
      "FC譚ｱ莠ｬ": "譚ｱ莠ｬ", "譚ｱ莠ｬV": "譚ｱ莠ｬV", "譚ｱ莠ｬ繝ｴ繧ｧ繝ｫ繝・・ｽ・ｽ": "譚ｱ莠ｬV",
      "FC螟ｧ髦ｪ": "螟ｧ髦ｪ", "FC莉頑ｲｻ": "莉頑ｲｻ", "莉頑ｲｻ": "莉頑ｲｻ", "FC蟯撰ｿｽE": "蟯撰ｿｽE", "FC逅臥帥": "逅臥帥"
    };

    // 繧ｨ繝ｳ繝悶Ξ繝URL縺九ｉ繝・ｿｽE繝蜷阪ｒ迚ｹ螳壹☆繧具ｼ域枚蟄怜喧縺大ｯｾ遲厄ｼ・    const EMBLEM_MAP = {
      "niigata": "譁ｰ貎・, "kumamoto": "辭頑悽", "imabari": "莉頑ｲｻ", "tosu": "魑･譬・, "kochi": "鬮倡衍", "ehime": "諢帛ｪ・,
      "kyoto": "莠ｬ驛ｽ", "yamaguchi": "螻ｱ蜿｣", "miyazaki": "螳ｮ蟠・, "tottori": "魑･蜿・, "kagoshima": "鮖ｿ蜈仙ｳｶ",
      "ryukyu": "逅臥帥", "shiga": "貊玖ｳ", "oita": "螟ｧ蛻・, "kitakyushu": "蛹嶺ｹ晏ｷ・, "kanazawa": "驥第ｲ｢",
      "sanuki": "隶・・ｽ・ｽE, "tokushima": "蠕ｳ蟲ｶ", "toyama": "蟇悟ｱｱ", "nara": "螂郁憶", "iwaki": "縺・・ｽ・ｽ縺・,
      "gifu": "蟯撰ｿｽE", "sapporo": "譛ｭ蟷・, "matsumoto": "譚ｾ譛ｬ", "nagano": "髟ｷ驥・, "iwata": "逎千伐",
      "fukushima": "遖丞ｳｶ", "kofu": "逕ｲ蠎・, "shonan": "貉伜漉", "akita": "遘狗伐", "yamagata": "螻ｱ蠖｢",
      "yokohamafc": "讓ｪ豬廡C", "yokohamafm": "讓ｪ豬廡M", "sendai": "莉吝床", "hachinohe": "蜈ｫ謌ｸ",
      "morioka": "逶帛ｲ｡", "gunma": "鄒､鬥ｬ", "mito": "豌ｴ謌ｸ", "tochigi": "譬・・ｽ・ｽ", "omiya": "螟ｧ螳ｮ",
      "chiba": "蜊・・ｽ・ｽ", "sagamihara": "逶ｸ讓｡蜴・, "shimizu": "貂・・ｽ・ｽ", "okayama": "蟯｡螻ｱ",
      "hiroshima": "蠎・・ｽ・ｽ", "vissel": "逾樊虻", "g-osaka": "繧ｬ繝ｳ繝・, "c-osaka": "繧ｻ繝ｬ繝・・ｽ・ｽ",
      "urawa": "豬ｦ蜥・, "kashima": "鮖ｿ蟲ｶ", "kashiwa": "譟・, "tokyo": "譚ｱ莠ｬ", "tokyov": "譚ｱ莠ｬV", "machida": "逕ｺ逕ｰ",
      "fosaka": "螟ｧ髦ｪ", "f-osaka": "螟ｧ髦ｪ", "iwate": "逶帛ｲ｡", "kusatsu": "鄒､鬥ｬ", "verdy": "譚ｱ莠ｬV", "marinos": "讓ｪ豬廡M",
      "antlers": "鮖ｿ蟲ｶ", "reds": "豬ｦ蜥・, "reysol": "譟・, "frontale": "蟾晏ｴ・, "bellmare": "貉伜漉", "s-pulse": "貂・・ｽ・ｽ",
      "jubilo": "逎千伐", "grampus": "蜷榊商螻・, "sanga": "莠ｬ驛ｽ", "gambaosaka": "繧ｬ繝ｳ繝・, "cerezoosaka": "繧ｻ繝ｬ繝・・ｽ・ｽ",
      "vissel-k": "逾樊虻", "trinita": "螟ｧ蛻・, "avispa": "遖丞ｲ｡", "zelvia": "逕ｺ逕ｰ", "fagiano": "蟯｡螻ｱ", "sanfrecce": "蠎・・ｽ・ｽ",
      "renofa": "螻ｱ蜿｣", "vortis": "蠕ｳ蟲ｶ", "kamatamare": "隶・・ｽ・ｽE, "giravanz": "蛹嶺ｹ晏ｷ・, "tegevajaro": "螳ｮ蟠・
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
            showCopyToast("繧ｯ繝ｩ繝門錐繧偵さ繝費ｿｽE縺励∪縺励◆");
          } catch (error) {
            console.error(error);
            showCopyToast("繧ｳ繝費ｿｽE縺ｫ螟ｱ謨励＠縺ｾ縺励◆");
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
      const n1 = normalizeName(name1).replace("縺ｮ隧ｦ蜷郁ｩｳ邏ｰ", "").replace("縺ｮ邨先棡", "").replace("SC", "").replace("FC", "").replace("F.C.", "");
      const n2 = normalizeName(name2).replace("縺ｮ隧ｦ蜷郁ｩｳ邏ｰ", "").replace("縺ｮ邨先棡", "").replace("SC", "").replace("FC", "").replace("F.C.", "");
      
      if (n1 === n2) return true;
      if (n1.length >= 2 && n2.length >= 2 && (n1.includes(n2) || n2.includes(n1))) return true;

      // 繝槭ャ繝斐Φ繧ｰ縺ｫ繧医ｋ隗｣豎ｺ
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
      if (club === "niigata") return v.includes("繝・・ｽ・ｽ繧ｫ繝薙ャ繧ｰ繧ｹ繝ｯ繝ｳ");
      if (club === "kumamoto") return v.includes("縺医′縺雁▼蠎ｷ");
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
        "縺医′縺雁▼蠎ｷ繧ｹ繧ｿ繧ｸ繧｢繝": "辭頑悽蟶・, "繝・・ｽ・ｽ繧ｫ繝薙ャ繧ｰ繧ｹ繝ｯ繝ｳ繧ｹ繧ｿ繧ｸ繧｢繝": "譁ｰ貎溷ｸ・, "蜻ｳ縺ｮ邏繧ｹ繧ｿ繧ｸ繧｢繝": "隱ｿ蟶・・ｽ・ｽE,
        "雎顔伐繧ｹ繧ｿ繧ｸ繧｢繝": "雎顔伐蟶・, "繝代リ繧ｽ繝九ャ繧ｯ繧ｹ繧ｿ繧ｸ繧｢繝蜷ｹ逕ｰ": "蜷ｹ逕ｰ蟶・, "蝓ｼ邇峨せ繧ｿ繧ｸ繧｢繝2002": "縺輔＞縺溘∪蟶らｷ大玄",
        "繝ｨ繝峨さ繧ｦ譯懊せ繧ｿ繧ｸ繧｢繝": "螟ｧ髦ｪ蟶よ擲菴丞翠蛹ｺ", "譌･逕｣繧ｹ繧ｿ繧ｸ繧｢繝": "讓ｪ豬懷ｸよｸｯ蛹怜玄", "繝九ャ繝代ヤ荳峨ヤ豐｢逅・・ｽ・ｽ蝣ｴ": "讓ｪ豬懷ｸら･槫･亥ｷ晏玄",
        "繝ｬ繝｢繝ｳ繧ｬ繧ｹ繧ｹ繧ｿ繧ｸ繧｢繝蟷ｳ蝪・: "蟷ｳ蝪壼ｸ・, "繧ｵ繝ｳ繧ｬ繧ｹ繧ｿ繧ｸ繧｢繝 by KYOCERA": "莠蟯｡蟶・, "繧ｨ繝・・ｽ・ｽ繧ｪ繝ｳ繝費ｿｽE繧ｹ繧ｦ繧､繝ｳ繧ｰ蠎・・ｽ・ｽ": "蠎・・ｽ・ｽ蟶ゆｸｭ蛹ｺ",
        "繝吶せ繝磯崕蝎ｨ繧ｹ繧ｿ繧ｸ繧｢繝": "遖丞ｲ｡蟶ょ忽螟壼玄", "鬧・・ｽ・ｽ荳榊虚逕｣繧ｹ繧ｿ繧ｸ繧｢繝": "魑･譬門ｸ・, "譏ｭ蜥碁崕蟾･繝会ｿｽE繝螟ｧ蛻・: "螟ｧ蛻・・ｽ・ｽE,
        "繧ｯ繝ｩ繧ｵ繧ｹ繝会ｿｽE繝螟ｧ蛻・: "螟ｧ蛻・・ｽ・ｽE, "繝ｦ繧｢繝・・ｽ・ｽ繧ｯ繧ｹ繧ｿ繧ｸ繧｢繝莉吝床": "莉吝床蟶よｳ牙玄", "IAI繧ｹ繧ｿ繧ｸ繧｢繝譌･譛ｬ蟷ｳ": "髱吝ｲ｡蟶よｸ・・ｽ・ｽ蛹ｺ",
        "繧ｨ繧ｳ繝代せ繧ｿ繧ｸ繧｢繝": "陲倶ｺ募ｸ・, "繝､繝槭ワ繧ｹ繧ｿ繧ｸ繧｢繝": "逎千伐蟶・, "繝医Λ繝ｳ繧ｹ繧ｳ繧ｹ繝｢繧ｹ繧ｹ繧ｿ繧ｸ繧｢繝髟ｷ蟠・: "隲ｫ譌ｩ蟶・,
        "PEACE STADIUM Connected by SoftBank": "髟ｷ蟠主ｸ・, "繝輔け繝髮ｻ蟄舌い繝ｪ繝ｼ繝・: "蜊・・ｽ・ｽ蟶ゆｸｭ螟ｮ蛹ｺ", "荳牙鵠繝輔Ο繝ｳ繝・・ｽ・ｽ繧｢譟上せ繧ｿ繧ｸ繧｢繝": "譟丞ｸ・,
        "繧ｷ繝・・ｽ・ｽ繝ｩ繧､繝医せ繧ｿ繧ｸ繧｢繝": "蟯｡螻ｱ蟶ょ圏蛹ｺ", "JFE譎ｴ繧鯉ｿｽE蝗ｽ繧ｹ繧ｿ繧ｸ繧｢繝": "蟯｡螻ｱ蟶ょ圏蛹ｺ", "邯ｭ譁ｰ縺ｿ繧峨＞縺ｵ繧ｹ繧ｿ繧ｸ繧｢繝": "螻ｱ蜿｣蟶・,
        "繝昴き繝ｪ繧ｹ繧ｨ繝・・ｽ・ｽ繧ｹ繧ｿ繧ｸ繧｢繝": "魑ｴ髢蟶・, "魑ｴ髢繝ｻ螟ｧ蝪壹せ繝晢ｿｽE繝・・ｽ・ｽ繝ｼ繧ｯ 繝昴き繝ｪ繧ｹ繧ｨ繝・・ｽ・ｽ繧ｹ繧ｿ繧ｸ繧｢繝": "魑ｴ髢蟶・,
        "繝九Φ繧ｸ繝九い繧ｹ繧ｿ繧ｸ繧｢繝": "譚ｾ螻ｱ蟶・, "ND繧ｽ繝輔ヨ繧ｹ繧ｿ繧ｸ繧｢繝螻ｱ蠖｢": "螟ｩ遶･蟶・, "繧ｽ繝ｦ繝ｼ繧ｹ繧ｿ繧ｸ繧｢繝": "遘狗伐蟶・,
        "NACK5繧ｹ繧ｿ繧ｸ繧｢繝螟ｧ螳ｮ": "縺輔＞縺溘∪蟶ょ､ｧ螳ｮ蛹ｺ", "繧ｱ繝ｼ繧ｺ繝・・ｽ・ｽ繧ｭ繧ｹ繧ｿ繧ｸ繧｢繝豌ｴ謌ｸ": "豌ｴ謌ｸ蟶・, "繧ｫ繝ｳ繧ｻ繧ｭ繧ｹ繧ｿ繧ｸ繧｢繝縺ｨ縺｡縺・: "螳・・ｽE螳ｮ蟶・,
        "豁｣逕ｰ驢､豐ｹ繧ｹ繧ｿ繧ｸ繧｢繝鄒､鬥ｬ": "蜑肴ｩ句ｸ・, "繝上Ρ繧､繧｢繝ｳ繧ｺ繧ｹ繧ｿ繧ｸ繧｢繝縺・・ｽ・ｽ縺・: "縺・・ｽ・ｽ縺榊ｸ・, "縺ｨ縺・・ｽ・ｽ縺・・ｽE縺ｿ繧薙↑縺ｮ繧ｹ繧ｿ繧ｸ繧｢繝": "遖丞ｳｶ蟶・,
        "繝励Λ繧､繝包ｿｽE繧ｺ繧ｹ繧ｿ繧ｸ繧｢繝": "蜈ｫ謌ｸ蟶・, "縺・・ｽ・ｽ縺弱ｓ繧ｹ繧ｿ繧ｸ繧｢繝": "逶帛ｲ｡蟶・, "JIT 繝ｪ繧ｵ繧､繧ｯ繝ｫ繧､繝ｳ繧ｯ 繧ｹ繧ｿ繧ｸ繧｢繝": "逕ｲ蠎懷ｸ・,
        "繧ｵ繝ｳ繝励Ο 繧｢繝ｫ繧ｦ繧｣繝ｳ": "譚ｾ譛ｬ蟶・, "髟ｷ驥散繧ｹ繧ｿ繧ｸ繧｢繝": "髟ｷ驥主ｸ・, "蟇悟ｱｱ逵檎ｷ丞粋驕句虚蜈ｬ蝨帝匣荳顔ｫｶ謚蝣ｴ": "蟇悟ｱｱ蟶・,
        "遏ｳ蟾晉恁隘ｿ驛ｨ邱大慍蜈ｬ蝨帝匣荳顔ｫｶ謚蝣ｴ": "驥第ｲ｢蟶・, "驥第ｲ｢繧ｴ繝ｼ繧ｴ繝ｼ繧ｫ繝ｬ繝ｼ繧ｹ繧ｿ繧ｸ繧｢繝": "驥第ｲ｢蟶・, "阯､譫晉ｷ丞粋驕句虚蜈ｬ蝨偵し繝・・ｽ・ｽ繝ｼ蝣ｴ": "阯､譫晏ｸ・,
        "諢幃ｷｹ蠎・・ｽ・ｽ蜈ｬ蝨貞､夂岼逧・・ｽ・ｽ謚蝣ｴ": "豐ｼ豢･蟶・, "髟ｷ濶ｯ蟾晉ｫｶ謚蝣ｴ": "蟯撰ｿｽE蟶・, "譚ｱ螟ｧ髦ｪ蟶り干蝨偵Λ繧ｰ繝難ｿｽE蝣ｴ": "譚ｱ螟ｧ髦ｪ蟶・,
        "繝ｭ繝ｼ繝医ヵ繧｣繝ｼ繝ｫ繝牙･郁憶": "螂郁憶蟶・, "Axis繝撰ｿｽE繝峨せ繧ｿ繧ｸ繧｢繝": "魑･蜿門ｸ・, "繝√Η繧ｦ繝忘AJIN繧ｹ繧ｿ繧ｸ繧｢繝": "邀ｳ蟄仙ｸ・,
        "Pikara繧ｹ繧ｿ繧ｸ繧｢繝": "荳ｸ莠蟶・, "蝗帛嵜蛹厄ｿｽEMEGLIO繧ｹ繧ｿ繧ｸ繧｢繝": "荳ｸ莠蟶・, "繧｢繧ｷ繝・・ｽ・ｽ繧ｹ驥悟ｱｱ繧ｹ繧ｿ繧ｸ繧｢繝": "莉頑ｲｻ蟶・,
        "繝溘け繝九Ρ繝ｼ繝ｫ繝峨せ繧ｿ繧ｸ繧｢繝蛹嶺ｹ晏ｷ・: "蛹嶺ｹ晏ｷ槫ｸょｰ丞牙圏蛹ｺ", "縺・・ｽ・ｽ縺泌ｮｮ蟠取眠蟇後し繝・・ｽ・ｽ繝ｼ蝣ｴ": "譁ｰ蟇檎伴", "逋ｽ豕｢繧ｹ繧ｿ繧ｸ繧｢繝": "鮖ｿ蜈仙ｳｶ蟶・,
        "繧ｿ繝斐ャ繧ｯ逵檎ｷ擾ｿｽE繧・・ｽ・ｽ繧薙せ繧ｿ繧ｸ繧｢繝": "豐也ｸ・・ｽ・ｽE, "Uvance縺ｨ縺ｩ繧阪″繧ｹ繧ｿ繧ｸ繧｢繝 by Fujitsu": "蟾晏ｴ主ｸゆｸｭ蜴溷玄",
        "螟ｧ蜥後ワ繧ｦ繧ｹ 繝励Ξ繝溘せ繝医ラ繝ｼ繝": "譛ｭ蟷悟ｸりｱ雁ｹｳ蛹ｺ", "蟷ｳ蜥悟・ATO繧ｹ繧ｿ繧ｸ繧｢繝": "蠖ｦ譬ｹ蟶・
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
                  <span style="font-size:0.9rem; color:#999;">邃・/span>
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
        container.innerHTML = `<a href="https://www.albirex.co.jp/ticket/ngate/form/" target="_blank" class="btn-ngate-header">N繧ｲ繝ｼ繝域歓驕ｸ</a>`;
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

  // 繝斐・繝・ヨ蟷ｴ繧貞叙蠕励☆繧具ｼ・electedYear 縺・null 縺ｮ蝣ｴ蜷医・迴ｾ蝨ｨ隕九∴縺ｦ縺・ｋ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ or 莉雁ｹｴ・・
  function getPivotYear() {
    if (selectedYear !== null) return selectedYear;
    // ALL驕ｸ謚樊凾縺ｯ迴ｾ蝨ｨ繝薙Η繝ｼ繝昴・繝医↓隕九∴縺ｦ縺・ｋ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｮ蟷ｴ縲√↑縺代ｌ縺ｰ莉雁ｹｴ
    if (visibleSections[currentIndex]) {
      const ym = visibleSections[currentIndex].dataset.ym || "";
      const y = parseInt(ym.split("-")[0], 10);
      if (y) return y;
    }
    return new Date().getFullYear();
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

    // 髫｣謗･3蟷ｴ譁ｹ蠑・ 繝斐・繝・ヨ蟷ｴ縺ｮ蜑榊ｾ・蟷ｴ縺縺題｡ｨ遉ｺ
    const pivot = getPivotYear();
    const displayYears = allYears.filter(y => Math.abs(y - pivot) <= 1);

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

    // 迴ｾ蝨ｨ縺ｮ驕ｸ謚樒憾諷九ｒ蜿肴丐
    Object.keys(yearTabs).forEach(k => {
      const isActive = (k === "all" && selectedYear === null) || (Number(k) === selectedYear);
      if (yearTabs[k]) yearTabs[k].classList.toggle("active", isActive);
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
    selectedYear = year;
    // 繝斐・繝・ヨ蟷ｴ縺悟､峨ｏ繧九◆縺ｳ縺ｫ繧ｿ繝悶ｒ蜀肴ｧ狗ｯ会ｼ磯團謗･3蟷ｴ譁ｹ蠑擾ｼ・
    rebuildYearTabs();

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

      // 隕ｳ謌ｦ莠亥ｮ夲ｿｽE繝上う繝ｩ繧､繝亥愛螳・      dayMatches.forEach(m => {
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
        <span class="picker-club ${m.club}">${m.club === 'niigata' ? '譁ｰ貎・ : '辭頑悽'}</span>
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
    return String(value || "").normalize("NFKC").replace(/[\s縲繝ｻ・ｽE・ｽ.\-_]/g, "").toLowerCase();
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

  function renderOfficialInfo(match) {
    const primary = [
      ["RESULT", match.result_mark],
      ["SCORE", match.score],
      ["STAGE", match.stage || match.matchweek],
      ["COMP", match.tournament]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    const items = [
      ["螟ｩ蛟・, match.weather],
      ["豌玲ｸｩ", match.temperature !== undefined && match.temperature !== null ? `${match.temperature}邃チ : ""],
      ["貉ｿ蠎ｦ", match.humidity !== undefined && match.humidity !== null ? `${match.humidity}%` : ""],
      ["蜈･蝣ｴ閠・, match.attendance !== undefined && match.attendance !== null ? `${Number(match.attendance).toLocaleString("ja-JP")}莠ｺ` : ""],
      ["荳ｻ蟇ｩ", match.referee],
      ["蜑ｯ蟇ｩ", Array.isArray(match.assistant_referees) ? match.assistant_referees.join(" / ") : ""],
      ["逶｣逹｣", match.manager]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    if (!items.length && !match.j_official_url) return "";

    return `
      <section class="u-match-record">
        <div class="u-section-head">
          <h4>蜈ｬ蠑剰ｨ倬鹸</h4>
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

  function renderMemberList(title, members, type) {
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
      <div class="u-member-block ${type}">
        <h5>${escapeHtml(title)}</h5>
        <ul>${rows}</ul>
      </div>
    `;
  }

  function renderMatchMembers(match) {
    const starters = renderMemberList("STARTING XI", match.starting_members, "starter");
    const bench = renderMemberList("BENCH", match.bench_members, "bench");
    if (!starters && !bench) return "";

    return `
      <section class="u-match-members">
        <div class="u-section-head">
          <h4>繝｡繝ｳ繝撰ｿｽE</h4>
          <span>${(match.starting_members || []).length + (match.bench_members || []).length} PLAYERS</span>
        </div>
        <div class="u-member-columns">
          ${starters}
          ${bench}
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
        <h5>莠､莉｣</h5>
        <ul>
          ${substitutions.map(sub => `
            <li>
              <span class="u-event-minute">${escapeHtml(sub.minute || "")}'</span>
              <span class="u-sub-out">${renderPlayerButton(sub.out)}</span>
              <span class="u-sub-arrow">竊・/span>
              <span class="u-sub-in">${renderPlayerButton(sub.in)}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    ` : "";

    const warnHtml = warnings.length ? `
      <div class="u-event-block">
        <h5>隴ｦ蜻・/h5>
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
        <h4>隧ｦ蜷医う繝吶Φ繝・/h4>
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
        role: "蜈育匱" + (subOut ? ` (${subOut.minute}' OUT)` : ""),
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
      return { appeared: false, squad: true, role: "繝吶Φ繝・, number: "", position: "", name: getMemberName(benchMember) };
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
    const numbers = Array.from(profile.numbers).join(" / ") || "譛ｪ險倬鹸";
    const positions = Array.from(profile.positions).join(" / ") || "譛ｪ險倬鹸";
    const clubLabel = profile.club === "niigata" ? "ALBIREX NIIGATA" : profile.club === "kumamoto" ? "ROASSO KUMAMOTO" : "";

    const appearanceHtml = profile.appearances.length
      ? profile.appearances.map(renderPlayerMatchRow).join("")
      : `<li class="u-empty-row">蜃ｺ蝣ｴ隧ｦ蜷医・JSON繝・・繧ｿ縺ｯ隕九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆</li>`;

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
      : `<li class="u-empty-row">蠕礼せ縺励◆隧ｦ蜷医・隕九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆</li>`;

    sheetContent.innerHTML = `
      <section class="u-player-profile">
        <button type="button" class="u-player-back">竊・隧ｦ蜷郁ｩｳ邏ｰ縺ｸ謌ｻ繧・/button>
        <div class="u-player-header">
          ${clubLabel ? `<span class="u-player-club-label">${clubLabel}</span>` : ""}
          <h2>${escapeHtml(profile.playerName)}</h2>
        </div>
        <div class="u-player-card-grid">
          <div class="u-player-card">
            <span class="u-card-label">閭檎分蜿ｷ</span>
            <strong class="u-card-value">${escapeHtml(numbers)}</strong>
          </div>
          <div class="u-player-card">
            <span class="u-card-label">繝昴ず繧ｷ繝ｧ繝ｳ</span>
            <strong class="u-card-value">${escapeHtml(positions)}</strong>
          </div>
          <div class="u-player-card">
            <span class="u-card-label">蜃ｺ蝣ｴ隧ｦ蜷・/span>
            <strong class="u-card-value">${profile.appearances.length}</strong>
          </div>
          <div class="u-player-card">
            <span class="u-card-label">蠕礼せ縺励◆隧ｦ蜷・/span>
            <strong class="u-card-value">${profile.goals.length}</strong>
          </div>
        </div>
        <div class="u-player-tabs">
          <button class="u-player-tab active" data-tab="appearances">蜃ｺ蝣ｴ隧ｦ蜷・/button>
          <button class="u-player-tab" data-tab="goals">蠕礼せ縺励◆隧ｦ蜷・/button>
        </div>
        <div class="u-player-tab-panel active" data-panel="appearances">
          <ul class="u-player-scroll-list">${appearanceHtml}</ul>
        </div>
        <div class="u-player-tab-panel" data-panel="goals">
          <ul class="u-player-scroll-list">${goalHtml}</ul>
        </div>
        <button class="close-sheet-btn">髢峨§繧・/button>
      </section>
    `;

    // 繧ｿ繝門・繧頑崛縺医Ο繧ｸ繝・け
    sheetContent.querySelectorAll(".u-player-tab").forEach(tab => {
      tab.onclick = () => {
        sheetContent.querySelectorAll(".u-player-tab").forEach(t => t.classList.remove("active"));
        sheetContent.querySelectorAll(".u-player-tab-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        sheetContent.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add("active");
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
    const sMy = localStorage.getItem(`score_my_${mId}`) || "";
    const sOpp = localStorage.getItem(`score_opp_${mId}`) || "";
    const sWeather = localStorage.getItem(`weather_${mId}`) || "";
    const sTemp = localStorage.getItem(`temp_${mId}`) || "";

    const J_CLUB_ENG = {
      "蛹玲ｵｷ驕薙さ繝ｳ繧ｵ繝会ｿｽE繝ｬ譛ｭ蟷・: "HOKKAIDO CONSADOLE SAPPORO", "繝ｴ繧｡繝ｳ繝ｩ繝ｼ繝ｬ蜈ｫ謌ｸ": "VANRAURE HACHINOHE", "縺・・ｽ・ｽ縺ｦ繧ｰ繝ｫ繝ｼ繧ｸ繝｣逶帛ｲ｡": "IWATE GRULLA MORIOKA", "繝吶ぎ繝ｫ繧ｿ莉吝床": "VEGALTA SENDAI", "繝悶Λ繧ｦ繝悶Μ繝・・ｽ・ｽ遘狗伐": "BLAUBLITZ AKITA", "繝｢繝ｳ繝・・ｽ・ｽ繧｣繧ｪ螻ｱ蠖｢": "MONTEDIO YAMAGATA", "遖丞ｳｶ繝ｦ繝翫う繝・・ｽ・ｽ繝宇C": "FUKUSHIMA UNITED FC", "縺・・ｽ・ｽ縺孝C": "IWAKI FC", "鮖ｿ蟲ｶ繧｢繝ｳ繝医Λ繝ｼ繧ｺ": "KASHIMA ANTLERS", "豌ｴ謌ｸ繝幢ｿｽE繝ｪ繝ｼ繝帙ャ繧ｯ": "MITO HOLLYHOCK", "譬・・ｽ・ｽSC": "TOCHIGI SC", "繧ｶ繧ｹ繝醍ｾ､鬥ｬ": "THESPA GUNMA", "豬ｦ蜥後Ξ繝・・ｽ・ｽ": "URAWA REDS", "螟ｧ螳ｮ繧｢繝ｫ繝・・ｽ・ｽ繝ｼ繧ｸ繝｣": "OMIYA ARDIJA", "RB螟ｧ螳ｮ繧｢繝ｫ繝・・ｽ・ｽ繝ｼ繧ｸ繝｣": "RB OMIYA ARDIJA", "繧ｸ繧ｧ繝輔Θ繝翫う繝・・ｽ・ｽ繝牙鴻闡・: "JEF UNITED CHIBA", "譟上Ξ繧､繧ｽ繝ｫ": "KASHIWA REYSOL", "FC譚ｱ莠ｬ": "FC TOKYO", "譚ｱ莠ｬ繝ｴ繧ｧ繝ｫ繝・・ｽ・ｽ": "TOKYO VERDY", "FC逕ｺ逕ｰ繧ｼ繝ｫ繝薙い": "FC MACHIDA ZELVIA", "蟾晏ｴ弱ヵ繝ｭ繝ｳ繧ｿ繝ｼ繝ｬ": "KAWASAKI FRONTALE", "讓ｪ豬廡繝ｻ繝槭Μ繝弱せ": "YOKOHAMA F. MARINOS", "讓ｪ豬廡C": "YOKOHAMA FC", "Y.S.C.C.讓ｪ豬・: "Y.S.C.C. YOKOHAMA", "貉伜漉繝吶Ν繝橸ｿｽE繝ｬ": "SHONAN BELLMARE", "SC逶ｸ讓｡蜴・: "SC SAGAMIHARA", "繝ｴ繧｡繝ｳ繝輔か繝ｼ繝ｬ逕ｲ蠎・: "VENTFORET KOFU", "譚ｾ譛ｬ螻ｱ髮・C": "MATSUMOTO YAMAGA FC", "AC髟ｷ驥弱ヱ繝ｫ繧ｻ繧､繝ｭ": "AC NAGANO PARCEIRO", "繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・: "ALBIREX NIIGATA", "繧ｫ繧ｿ繝ｼ繝ｬ蟇悟ｱｱ": "KATALLER TOYAMA", "繝・・ｽ・ｽ繝ｼ繧ｲ繝ｳ驥第ｲ｢": "ZWEIGEN KANAZAWA", "貂・・ｽ・ｽ繧ｨ繧ｹ繝代Ν繧ｹ": "SHIMIZU S-PULSE", "繧ｸ繝･繝薙Ο逎千伐": "JUBILO IWATA", "阯､譫扨YFC": "FUJIEDA MYFC", "繧｢繧ｹ繝ｫ繧ｯ繝ｩ繝ｭ豐ｼ豢･": "AZUL CLARO NUMAZU", "蜷榊商螻九げ繝ｩ繝ｳ繝代せ": "NAGOYA GRAMPUS", "FC蟯撰ｿｽE": "FC GIFU", "莠ｬ驛ｽ繧ｵ繝ｳ繧ｬF.C.": "KYOTO SANGA F.C.", "繧ｬ繝ｳ繝仙､ｧ髦ｪ": "GAMBA OSAKA", "繧ｻ繝ｬ繝・・ｽ・ｽ螟ｧ髦ｪ": "CEREZO OSAKA", "FC螟ｧ髦ｪ": "FC OSAKA", "繝ｴ繧｣繝・・ｽ・ｽ繝ｫ逾樊虻": "VISSEL KOBE", "繝ｴ繧｣繝・・ｽ・ｽ繝ｫ逾樊宛": "VISSEL KOBE", "螂郁憶繧ｯ繝ｩ繝・: "NARA CLUB", "繧ｬ繧､繝奇ｿｽE繝ｬ魑･蜿・: "GAINARE TOTTORI", "繝輔ぃ繧ｸ繧｢繝ｼ繝主ｲ｡螻ｱ": "FAGIANO OKAYAMA", "繧ｵ繝ｳ繝輔Ξ繝・・ｽ・ｽ繧ｧ蠎・・ｽ・ｽ": "SANFRECCE HIROSHIMA", "繝ｬ繝弱ヵ繧｡螻ｱ蜿｣FC": "RENOFA YAMAGUCHI FC", "繧ｫ繝槭ち繝橸ｿｽE繝ｬ隶・・ｽ・ｽE: "KAMATAMARE SANUKI", "蠕ｳ蟲ｶ繝ｴ繧ｩ繝ｫ繝・・ｽ・ｽ繧ｹ": "TOKUSHIMA VORTIS", "諢帛ｪ妲C": "EHIME FC", "FC莉頑ｲｻ": "FC IMABARI", "繧｢繝薙せ繝醍ｦ丞ｲ｡": "AVISPA FUKUOKA", "繧ｮ繝ｩ繝ｴ繧｡繝ｳ繝・・ｽ・ｽ荵晏ｷ・: "GIRAVANZ KITAKYUSHU", "繧ｵ繧ｬ繝ｳ魑･譬・: "SAGAN TOSU", "V繝ｻ繝輔ぃ繝ｼ繝ｬ繝ｳ髟ｷ蟠・: "V-VAREN NAGASAKI", "繝ｭ繧｢繝・・ｽ・ｽ辭頑悽": "ROASSO KUMAMOTO", "螟ｧ蛻・・ｽ・ｽ繝ｪ繝具ｿｽE繧ｿ": "OITA TRINITA", "繝・・ｽ・ｽ繝舌ず繝｣繝ｼ繝ｭ螳ｮ蟠・: "TEGEVAJARO MIYAZAKI", "鮖ｿ蜈仙ｳｶ繝ｦ繝翫う繝・・ｽ・ｽ繝宇C": "KAGOSHIMA UNITED FC", "FC逅臥帥": "FC RYUKYU", "鬮倡衍繝ｦ繝翫う繝・・ｽ・ｽ繝唄C": "KOCHI UNITED SC", "繝ｬ繧､繝ｩ繝・・ｽ・ｽ貊玖ｳFC": "REILAC SHIGA FC"
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
              <span>${match.club === "niigata" ? "譁ｰ貎・ : "辭頑悽"}</span>
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
      const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "";
      const sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
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
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.venue)}" target="_blank" style="background:#f2f2f7; color:var(--text-main); font-size:0.75rem; padding:6px 12px; border-radius:15px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> MAP縺ｧ髢九￥</a>
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
             <span style="font-size:0.7rem; color:#888; font-weight:800; margin-right:4px;">邃・/span>
             <span style="font-size: 0.8rem; color:#ddd;">/</span>
             <span id="u-temp-min" style="font-size: 1.2rem; font-family:var(--font-kick); font-weight:800; color:#007aff; margin-left:4px;">-</span>
             <span style="font-size:0.6rem; color:#888; font-weight:800;">邃・/span>
           </div>
        </div>
      </div>

      <div class="sheet-score-area"><input type="number" class="u-score-input my-score" value="${sMy}" placeholder="-"><span class="u-score-sep">:</span><input type="number" class="u-score-input opp-score" value="${sOpp}" placeholder="-"></div>
      ${pkHtml}
      ${isBeforeToday(match.date) && match.raw_json ? `
      <button id="open-vision-preview-btn" class="u-vision-preview-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 15H3"/><path d="M7 21h10"/><path d="M12 15v6"/></svg>
        螟ｧ蝙九ン繧ｸ繝ｧ繝ｳ陦ｨ遉ｺ
      </button>` : ""}
      ${goalsHtml}
      ${officialInfoHtml}
      ${membersHtml}
      ${eventsHtml}
      <div class="u-attend-btn ${match.club} ${isAttend ? 'active' : ''}" id="attend-toggle">
        <span class="btn-icon" style="display: flex;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>
        <span class="btn-text">隕ｳ謌ｦ莠亥ｮ・/span>
      </div>
      <div class="u-note-single">
        <div class="u-note-box">
          <div class="u-note-header">
            <label>繝｡繝｢</label>
            <button class="u-note-edit-btn" id="memo-edit-btn">邱ｨ髮・/button>
          </div>
          <div class="u-memo-display" id="memo-display"></div>
          <textarea class="u-textarea memo-field hidden">${sMemo}</textarea>
        </div>
      </div>
      <button class="close-sheet-btn">菫晏ｭ倥＠縺ｦ髢峨§繧・/button>
    `;

    bindPlayerLinks(match);

    // 螟ｧ蝙九ン繧ｸ繝ｧ繝ｳ陦ｨ遉ｺ繝懊ち繝ｳ縺ｮ繧､繝吶Φ繝郁ｨｭ螳・
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
        memoEditBtn.textContent = '邱ｨ髮・;
        memoEditBtn.classList.remove('editing');
      } else {
        // Switch to edit mode
        memoDisplay.classList.add('hidden');
        memoField.classList.remove('hidden');
        memoField.focus();
        memoEditBtn.textContent = '螳御ｺ・;
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
    // localStorage縺ｫ隧ｦ蜷医ョ繝ｼ繧ｿ繧呈嶌縺崎ｾｼ繧
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

    // 繝輔Ν繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ繧ｪ繝ｼ繝舌・繝ｬ繧､繧定｡ｨ遉ｺ
    const backdrop = document.getElementById("vision-preview-backdrop");
    const overlay = document.getElementById("vision-preview-overlay");
    const iframe = document.getElementById("vision-preview-iframe");
    if (!overlay || !iframe) return;

    // iframe繧池esult繝｢繝ｼ繝峨〒隱ｭ縺ｿ霎ｼ繧
    iframe.src = "vision/preview.html?default=result&t=" + Date.now();
    overlay.style.display = "flex";
    if (backdrop) backdrop.style.display = "block";

    const closeBtn = document.getElementById("close-vision-preview");
    const doClose = () => {
      overlay.style.display = "none";
      if (backdrop) backdrop.style.display = "none";
      iframe.src = "about:blank";
    };
    if (closeBtn) closeBtn.onclick = doClose;
    if (backdrop) backdrop.onclick = doClose;
  }

  const GAS_EXEC_URL = "https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec";

  // --- Results & Data Management ---
  let officialResults = [];
  let cachedStandings = null;

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
    const myKw = match.club === "niigata" ? "譁ｰ貎・ : "辭頑悽";
    
    return officialResults.find(r => {
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
          const isHome = robustTeamMatch(r.home, m.club === "niigata" ? "譁ｰ貎・ : "辭頑悽");
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
  refreshAllData();


  // extract the city map into reusable object
  const COMMON_STADIUM_CITY_MAP = {
    "縺医′縺雁▼蠎ｷ繧ｹ繧ｿ繧ｸ繧｢繝": "辭頑悽蟶・, "繝・・ｽ・ｽ繧ｫ繝薙ャ繧ｰ繧ｹ繝ｯ繝ｳ繧ｹ繧ｿ繧ｸ繧｢繝": "譁ｰ貎溷ｸ・, "蜻ｳ縺ｮ邏繧ｹ繧ｿ繧ｸ繧｢繝": "隱ｿ蟶・・ｽ・ｽE,
    "雎顔伐繧ｹ繧ｿ繧ｸ繧｢繝": "雎顔伐蟶・, "繝代リ繧ｽ繝九ャ繧ｯ繧ｹ繧ｿ繧ｸ繧｢繝蜷ｹ逕ｰ": "蜷ｹ逕ｰ蟶・, "蝓ｼ邇峨せ繧ｿ繧ｸ繧｢繝2002": "縺輔＞縺溘∪蟶らｷ大玄",
    "繝ｨ繝峨さ繧ｦ譯懊せ繧ｿ繧ｸ繧｢繝": "螟ｧ髦ｪ蟶よ擲菴丞翠蛹ｺ", "譌･逕｣繧ｹ繧ｿ繧ｸ繧｢繝": "讓ｪ豬懷ｸよｸｯ蛹怜玄", "繝九ャ繝代ヤ荳峨ヤ豐｢逅・・ｽ・ｽ蝣ｴ": "讓ｪ豬懷ｸら･槫･亥ｷ晏玄",
    "繝ｬ繝｢繝ｳ繧ｬ繧ｹ繧ｹ繧ｿ繧ｸ繧｢繝蟷ｳ蝪・: "蟷ｳ蝪壼ｸ・, "繧ｵ繝ｳ繧ｬ繧ｹ繧ｿ繧ｸ繧｢繝 by KYOCERA": "莠蟯｡蟶・, "繧ｨ繝・・ｽ・ｽ繧ｪ繝ｳ繝費ｿｽE繧ｹ繧ｦ繧､繝ｳ繧ｰ蠎・・ｽ・ｽ": "蠎・・ｽ・ｽ蟶ゆｸｭ蛹ｺ",
    "繝吶せ繝磯崕蝎ｨ繧ｹ繧ｿ繧ｸ繧｢繝": "遖丞ｲ｡蟶ょ忽螟壼玄", "鬧・・ｽ・ｽ荳榊虚逕｣繧ｹ繧ｿ繧ｸ繧｢繝": "魑･譬門ｸ・, "譏ｭ蜥碁崕蟾･繝会ｿｽE繝螟ｧ蛻・: "螟ｧ蛻・・ｽ・ｽE,
    "繧ｯ繝ｩ繧ｵ繧ｹ繝会ｿｽE繝螟ｧ蛻・: "螟ｧ蛻・・ｽ・ｽE, "繝ｦ繧｢繝・・ｽ・ｽ繧ｯ繧ｹ繧ｿ繧ｸ繧｢繝莉吝床": "莉吝床蟶よｳ牙玄", "IAI繧ｹ繧ｿ繧ｸ繧｢繝譌･譛ｬ蟷ｳ": "髱吝ｲ｡蟶よｸ・・ｽ・ｽ蛹ｺ",
    "繧ｨ繧ｳ繝代せ繧ｿ繧ｸ繧｢繝": "陲倶ｺ募ｸ・, "繝､繝槭ワ繧ｹ繧ｿ繧ｸ繧｢繝": "逎千伐蟶・, "繝医Λ繝ｳ繧ｹ繧ｳ繧ｹ繝｢繧ｹ繧ｹ繧ｿ繧ｸ繧｢繝髟ｷ蟠・: "隲ｫ譌ｩ蟶・,
    "PEACE STADIUM Connected by SoftBank": "髟ｷ蟠主ｸ・, "繝輔け繝髮ｻ蟄舌い繝ｪ繝ｼ繝・: "蜊・・ｽ・ｽ蟶ゆｸｭ螟ｮ蛹ｺ", "荳牙鵠繝輔Ο繝ｳ繝・・ｽ・ｽ繧｢譟上せ繧ｿ繧ｸ繧｢繝": "譟丞ｸ・,
    "繧ｷ繝・・ｽ・ｽ繝ｩ繧､繝医せ繧ｿ繧ｸ繧｢繝": "蟯｡螻ｱ蟶ょ圏蛹ｺ", "JFE譎ｴ繧鯉ｿｽE蝗ｽ繧ｹ繧ｿ繧ｸ繧｢繝": "蟯｡螻ｱ蟶ょ圏蛹ｺ", "邯ｭ譁ｰ縺ｿ繧峨＞縺ｵ繧ｹ繧ｿ繧ｸ繧｢繝": "螻ｱ蜿｣蟶・,
    "繝昴き繝ｪ繧ｹ繧ｨ繝・・ｽ・ｽ繧ｹ繧ｿ繧ｸ繧｢繝": "魑ｴ髢蟶・, "魑ｴ髢繝ｻ螟ｧ蝪壹せ繝晢ｿｽE繝・・ｽ・ｽ繝ｼ繧ｯ 繝昴き繝ｪ繧ｹ繧ｨ繝・・ｽ・ｽ繧ｹ繧ｿ繧ｸ繧｢繝": "魑ｴ髢蟶・,
    "繝九Φ繧ｸ繝九い繧ｹ繧ｿ繧ｸ繧｢繝": "譚ｾ螻ｱ蟶・, "ND繧ｽ繝輔ヨ繧ｹ繧ｿ繧ｸ繧｢繝螻ｱ蠖｢": "螟ｩ遶･蟶・, "繧ｽ繝ｦ繝ｼ繧ｹ繧ｿ繧ｸ繧｢繝": "遘狗伐蟶・,
    "NACK5繧ｹ繧ｿ繧ｸ繧｢繝螟ｧ螳ｮ": "縺輔＞縺溘∪蟶ょ､ｧ螳ｮ蛹ｺ", "繧ｱ繝ｼ繧ｺ繝・・ｽ・ｽ繧ｭ繧ｹ繧ｿ繧ｸ繧｢繝豌ｴ謌ｸ": "豌ｴ謌ｸ蟶・, "繧ｫ繝ｳ繧ｻ繧ｭ繧ｹ繧ｿ繧ｸ繧｢繝縺ｨ縺｡縺・: "螳・・ｽE螳ｮ蟶・,
    "豁｣逕ｰ驢､豐ｹ繧ｹ繧ｿ繧ｸ繧｢繝鄒､鬥ｬ": "蜑肴ｩ句ｸ・, "繝上Ρ繧､繧｢繝ｳ繧ｺ繧ｹ繧ｿ繧ｸ繧｢繝縺・・ｽ・ｽ縺・: "縺・・ｽ・ｽ縺榊ｸ・, "縺ｨ縺・・ｽ・ｽ縺・・ｽE縺ｿ繧薙↑縺ｮ繧ｹ繧ｿ繧ｸ繧｢繝": "遖丞ｳｶ蟶・,
    "繝励Λ繧､繝包ｿｽE繧ｺ繧ｹ繧ｿ繧ｸ繧｢繝": "蜈ｫ謌ｸ蟶・, "縺・・ｽ・ｽ縺弱ｓ繧ｹ繧ｿ繧ｸ繧｢繝": "逶帛ｲ｡蟶・, "JIT 繝ｪ繧ｵ繧､繧ｯ繝ｫ繧､繝ｳ繧ｯ 繧ｹ繧ｿ繧ｸ繧｢繝": "逕ｲ蠎懷ｸ・,
    "繧ｵ繝ｳ繝励Ο 繧｢繝ｫ繧ｦ繧｣繝ｳ": "譚ｾ譛ｬ蟶・, "髟ｷ驥散繧ｹ繧ｿ繧ｸ繧｢繝": "髟ｷ驥主ｸ・, "蟇悟ｱｱ逵檎ｷ丞粋驕句虚蜈ｬ蝨帝匣荳顔ｫｶ謚蝣ｴ": "蟇悟ｱｱ蟶・,
    "遏ｳ蟾晉恁隘ｿ驛ｨ邱大慍蜈ｬ蝨帝匣荳顔ｫｶ謚蝣ｴ": "驥第ｲ｢蟶・, "驥第ｲ｢繧ｴ繝ｼ繧ｴ繝ｼ繧ｫ繝ｬ繝ｼ繧ｹ繧ｿ繧ｸ繧｢繝": "驥第ｲ｢蟶・, "阯､譫晉ｷ丞粋驕句虚蜈ｬ蝨偵し繝・・ｽ・ｽ繝ｼ蝣ｴ": "阯､譫晏ｸ・,
    "諢幃ｷｹ蠎・・ｽ・ｽ蜈ｬ蝨貞､夂岼逧・・ｽ・ｽ謚蝣ｴ": "豐ｼ豢･蟶・, "髟ｷ濶ｯ蟾晉ｫｶ謚蝣ｴ": "蟯撰ｿｽE蟶・, "譚ｱ螟ｧ髦ｪ蟶り干蝨偵Λ繧ｰ繝難ｿｽE蝣ｴ": "譚ｱ螟ｧ髦ｪ蟶・,
    "繝ｭ繝ｼ繝医ヵ繧｣繝ｼ繝ｫ繝牙･郁憶": "螂郁憶蟶・, "Axis繝撰ｿｽE繝峨せ繧ｿ繧ｸ繧｢繝": "魑･蜿門ｸ・, "繝√Η繧ｦ繝忘AJIN繧ｹ繧ｿ繧ｸ繧｢繝": "邀ｳ蟄仙ｸ・,
    "Pikara繧ｹ繧ｿ繧ｸ繧｢繝": "荳ｸ莠蟶・, "蝗帛嵜蛹厄ｿｽEMEGLIO繧ｹ繧ｿ繧ｸ繧｢繝": "荳ｸ莠蟶・, "繧｢繧ｷ繝・・ｽ・ｽ繧ｹ驥悟ｱｱ繧ｹ繧ｿ繧ｸ繧｢繝": "莉頑ｲｻ蟶・,
    "繝溘け繝九Ρ繝ｼ繝ｫ繝峨せ繧ｿ繧ｸ繧｢繝蛹嶺ｹ晏ｷ・: "蛹嶺ｹ晏ｷ槫ｸょｰ丞牙圏蛹ｺ", "縺・・ｽ・ｽ縺泌ｮｮ蟠取眠蟇後し繝・・ｽ・ｽ繝ｼ蝣ｴ": "譁ｰ蟇檎伴", "逋ｽ豕｢繧ｹ繧ｿ繧ｸ繧｢繝": "鮖ｿ蜈仙ｳｶ蟶・,
    "繧ｿ繝斐ャ繧ｯ逵檎ｷ擾ｿｽE繧・・ｽ・ｽ繧薙せ繧ｿ繧ｸ繧｢繝": "豐也ｸ・・ｽ・ｽE, "Uvance縺ｨ縺ｩ繧阪″繧ｹ繧ｿ繧ｸ繧｢繝 by Fujitsu": "蟾晏ｴ主ｸゆｸｭ蜴溷玄",
    "螟ｧ蜥後ワ繧ｦ繧ｹ 繝励Ξ繝溘せ繝医ラ繝ｼ繝": "譛ｭ蟷悟ｸりｱ雁ｹｳ蛹ｺ", "蟷ｳ蜥悟・ATO繧ｹ繧ｿ繧ｸ繧｢繝": "蠖ｦ譬ｹ蟶・
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
      if (!m) return `<div class="dash-card"><div style="padding:20px;text-align:center;color:#888;">莉雁ｾ鯉ｿｽE隧ｦ蜷井ｺ亥ｮ夲ｿｽE縺ゅｊ縺ｾ縺帙ｓ</div></div>`;
      const isAtt = localStorage.getItem('attend_' + m.date + '_' + m.club + '_' + m.opponent) === "true";
      const isHome = getMatchIsHome(m);
      const haBadge = isHome ? '<span class="sheet-ha badge-home" style="color:#fff; font-weight:800; font-size:1rem;">HOME</span>' : '<span class="sheet-ha badge-away" style="color:#fff; font-weight:800; font-size:1rem;">AWAY</span>';
      const myEmblem = m.club === "niigata" ? "https://jleague.r10s.jp/img/common/img_club_niigata.png" : "https://jleague.r10s.jp/img/common/img_club_kumamoto.png";
      const J_CLUB_ENG = { "蛹玲ｵｷ驕薙さ繝ｳ繧ｵ繝会ｿｽE繝ｬ譛ｭ蟷・: "HOKKAIDO CONSADOLE SAPPORO", "繝ｴ繧｡繝ｳ繝ｩ繝ｼ繝ｬ蜈ｫ謌ｸ": "VANRAURE HACHINOHE", "縺・・ｽ・ｽ縺ｦ繧ｰ繝ｫ繝ｼ繧ｸ繝｣逶帛ｲ｡": "IWATE GRULLA MORIOKA", "繝吶ぎ繝ｫ繧ｿ莉吝床": "VEGALTA SENDAI", "繝悶Λ繧ｦ繝悶Μ繝・・ｽ・ｽ遘狗伐": "BLAUBLITZ AKITA", "繝｢繝ｳ繝・・ｽ・ｽ繧｣繧ｪ螻ｱ蠖｢": "MONTEDIO YAMAGATA", "遖丞ｳｶ繝ｦ繝翫う繝・・ｽ・ｽ繝宇C": "FUKUSHIMA UNITED FC", "縺・・ｽ・ｽ縺孝C": "IWAKI FC", "鮖ｿ蟲ｶ繧｢繝ｳ繝医Λ繝ｼ繧ｺ": "KASHIMA ANTLERS", "豌ｴ謌ｸ繝幢ｿｽE繝ｪ繝ｼ繝帙ャ繧ｯ": "MITO HOLLYHOCK", "譬・・ｽ・ｽSC": "TOCHIGI SC", "繧ｶ繧ｹ繝醍ｾ､鬥ｬ": "THESPA GUNMA", "豬ｦ蜥後Ξ繝・・ｽ・ｽ": "URAWA REDS", "螟ｧ螳ｮ繧｢繝ｫ繝・・ｽ・ｽ繝ｼ繧ｸ繝｣": "OMIYA ARDIJA", "RB螟ｧ螳ｮ繧｢繝ｫ繝・・ｽ・ｽ繝ｼ繧ｸ繝｣": "RB OMIYA ARDIJA", "繧ｸ繧ｧ繝輔Θ繝翫う繝・・ｽ・ｽ繝牙鴻闡・: "JEF UNITED CHIBA", "譟上Ξ繧､繧ｽ繝ｫ": "KASHIWA REYSOL", "FC譚ｱ莠ｬ": "FC TOKYO", "譚ｱ莠ｬ繝ｴ繧ｧ繝ｫ繝・・ｽ・ｽ": "TOKYO VERDY", "FC逕ｺ逕ｰ繧ｼ繝ｫ繝薙い": "FC MACHIDA ZELVIA", "蟾晏ｴ弱ヵ繝ｭ繝ｳ繧ｿ繝ｼ繝ｬ": "KAWASAKI FRONTALE", "讓ｪ豬廡繝ｻ繝槭Μ繝弱せ": "YOKOHAMA F. MARINOS", "讓ｪ豬廡C": "YOKOHAMA FC", "Y.S.C.C.讓ｪ豬・: "Y.S.C.C. YOKOHAMA", "貉伜漉繝吶Ν繝橸ｿｽE繝ｬ": "SHONAN BELLMARE", "SC逶ｸ讓｡蜴・: "SC SAGAMIHARA", "繝ｴ繧｡繝ｳ繝輔か繝ｼ繝ｬ逕ｲ蠎・: "VENTFORET KOFU", "譚ｾ譛ｬ螻ｱ髮・C": "MATSUMOTO YAMAGA FC", "AC髟ｷ驥弱ヱ繝ｫ繧ｻ繧､繝ｭ": "AC NAGANO PARCEIRO", "繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・: "ALBIREX NIIGATA", "繧ｫ繧ｿ繝ｼ繝ｬ蟇悟ｱｱ": "KATALLER TOYAMA", "繝・・ｽ・ｽ繝ｼ繧ｲ繝ｳ驥第ｲ｢": "ZWEIGEN KANAZAWA", "貂・・ｽ・ｽ繧ｨ繧ｹ繝代Ν繧ｹ": "SHIMIZU S-PULSE", "繧ｸ繝･繝薙Ο逎千伐": "JUBILO IWATA", "阯､譫扨YFC": "FUJIEDA MYFC", "繧｢繧ｹ繝ｫ繧ｯ繝ｩ繝ｭ豐ｼ豢･": "AZUL CLARO NUMAZU", "蜷榊商螻九げ繝ｩ繝ｳ繝代せ": "NAGOYA GRAMPUS", "FC蟯撰ｿｽE": "FC GIFU", "莠ｬ驛ｽ繧ｵ繝ｳ繧ｬF.C.": "KYOTO SANGA F.C.", "繧ｬ繝ｳ繝仙､ｧ髦ｪ": "GAMBA OSAKA", "繧ｻ繝ｬ繝・・ｽ・ｽ螟ｧ髦ｪ": "CEREZO OSAKA", "FC螟ｧ髦ｪ": "FC OSAKA", "繝ｴ繧｣繝・・ｽ・ｽ繝ｫ逾樊虻": "VISSEL KOBE", "繝ｴ繧｣繝・・ｽ・ｽ繝ｫ逾樊宛": "VISSEL KOBE", "螂郁憶繧ｯ繝ｩ繝・: "NARA CLUB", "繧ｬ繧､繝奇ｿｽE繝ｬ魑･蜿・: "GAINARE TOTTORI", "繝輔ぃ繧ｸ繧｢繝ｼ繝主ｲ｡螻ｱ": "FAGIANO OKAYAMA", "繧ｵ繝ｳ繝輔Ξ繝・・ｽ・ｽ繧ｧ蠎・・ｽ・ｽ": "SANFRECCE HIROSHIMA", "繝ｬ繝弱ヵ繧｡螻ｱ蜿｣FC": "RENOFA YAMAGUCHI FC", "繧ｫ繝槭ち繝橸ｿｽE繝ｬ隶・・ｽ・ｽE: "KAMATAMARE SANUKI", "蠕ｳ蟲ｶ繝ｴ繧ｩ繝ｫ繝・・ｽ・ｽ繧ｹ": "TOKUSHIMA VORTIS", "諢帛ｪ妲C": "EHIME FC", "FC莉頑ｲｻ": "FC IMABARI", "繧｢繝薙せ繝醍ｦ丞ｲ｡": "AVISPA FUKUOKA", "繧ｮ繝ｩ繝ｴ繧｡繝ｳ繝・・ｽ・ｽ荵晏ｷ・: "GIRAVANZ KITAKYUSHU", "繧ｵ繧ｬ繝ｳ魑･譬・: "SAGAN TOSU", "V繝ｻ繝輔ぃ繝ｼ繝ｬ繝ｳ髟ｷ蟠・: "V-VAREN NAGASAKI", "繝ｭ繧｢繝・・ｽ・ｽ辭頑悽": "ROASSO KUMAMOTO", "螟ｧ蛻・・ｽ・ｽ繝ｪ繝具ｿｽE繧ｿ": "OITA TRINITA", "繝・・ｽ・ｽ繝舌ず繝｣繝ｼ繝ｭ螳ｮ蟠・: "TEGEVAJARO MIYAZAKI", "鮖ｿ蜈仙ｳｶ繝ｦ繝翫う繝・・ｽ・ｽ繝宇C": "KAGOSHIMA UNITED FC", "FC逅臥帥": "FC RYUKYU", "鬮倡衍繝ｦ繝翫う繝・・ｽ・ｽ繝唄C": "KOCHI UNITED SC", "繝ｬ繧､繝ｩ繝・・ｽ・ｽ貊玖ｳFC": "REILAC SHIGA FC" };
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
                    <img src="${myEmblem}" style="height:45px; margin-bottom:4px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.1)); cursor:pointer;" onclick="openClubSite('${myShortName === '譁ｰ貎・ ? '繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・ : '繝ｭ繧｢繝・・ｽ・ｽ辭頑悽'}', event)">
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

    html += renderCard(nextNiigata, "ALBIREX NIIGATA", "var(--albirex-orange)", "譁ｰ貎・);
    html += renderCard(nextKumamoto, "ROASSO KUMAMOTO", "var(--roasso-red)", "辭頑悽");
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

    const btnScoreboard = document.getElementById("dash-to-scoreboard");
    if (btnScoreboard) btnScoreboard.onclick = () => switchMode("scoreboard");
    const btnVision = document.getElementById("dash-to-vision");
    if (btnVision) btnVision.onclick = () => switchMode("vision");

    // Auto Fetch Weather Function inline
    const fetchWeatherForDash = async (idPrefix, clubPrefix) => {
      const wBox = document.getElementById(idPrefix);
      if (!wBox) return;
      const venue = wBox.dataset.venue;
      const dateStr = wBox.dataset.date;

      const cacheKey = `weather_html_${venue}_${dateStr}`;
      const cachedHTML = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(`${cacheKey}_time`);

      // 3譎る俣縺ｮ繧ｭ繝｣繝・・ｽ・ｽ繝･譛牙柑譛滄剞
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
              let emoji = "笘・・ｽ・ｽE;
              if (code <= 1) emoji = "笘・ｽE・ｽE;
              else if (code <= 3) emoji = "笘・・ｽ・ｽE;
              else if (code <= 69 || (code >= 80 && code <= 82) || code >= 95) emoji = "笘費ｸ・;
              else if ((code >= 70 && code <= 79) || (code >= 85 && code <= 86)) emoji = "笵・・ｽ・ｽE;
              
              const finalHTML = `${emoji} <div style="display:flex; align-items:baseline; gap:6px; font-family:var(--font-kick); font-weight:900; font-size:1.4rem;"><span style="color:#ff3b30;">${Math.round(max)}</span> <span style="font-size:1.2rem; color:#aaa;">/</span> <span style="color:#007aff;">${Math.round(min)}</span> <span style="font-size:1rem; color:#111;">邃・/span></div>`;
              wBox.querySelector(".val-weather").innerHTML = finalHTML;
              localStorage.setItem(cacheKey, finalHTML);
              localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
            }
          }
        } catch (e) { }
      } else {
        wBox.querySelector(".val-weather").innerHTML = `<span style="font-size:0.6rem;color:#999;line-height:2;">蜿門ｾ玲悄髢灘､・/span>`;
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
        const J_TEAM_KWS = ["FC譚ｱ莠ｬ", "譚ｱ莠ｬV", "讓ｪ豬廡M", "讓ｪ豬廡C", "YS讓ｪ豬・, "FC螟ｧ髦ｪ", "G螟ｧ髦ｪ", "C螟ｧ髦ｪ", "繧ｻ繝ｬ繝・・ｽ・ｽ", "FC蟯撰ｿｽE", "FC莉頑ｲｻ", "FC逅臥帥", "譛ｭ蟷・, "鮖ｿ蟲ｶ", "豬ｦ蜥・, "譟・, "逕ｺ逕ｰ", "蟾晏ｴ・, "貉伜漉", "譁ｰ貎・, "蟇悟ｱｱ", "驥第ｲ｢", "貂・・ｽ・ｽ", "阯､譫・, "豐ｼ豢･", "逎千伐", "蜷榊商螻・, "蟯撰ｿｽE", "莠ｬ驛ｽ", "逾樊虻", "螂郁憶", "魑･蜿・, "蟯｡螻ｱ", "蠎・・ｽ・ｽ", "螻ｱ蜿｣", "隶・・ｽ・ｽE, "蠕ｳ蟲ｶ", "諢帛ｪ・, "莉頑ｲｻ", "遖丞ｲ｡", "蛹嶺ｹ晏ｷ・, "魑･譬・, "髟ｷ蟠・, "辭頑悽", "螟ｧ蛻・, "螳ｮ蟠・, "鮖ｿ蜈仙ｳｶ", "逅臥帥", "鬮倡衍", "貊玖ｳ", "蜈ｫ謌ｸ", "逶帛ｲ｡", "遘狗伐", "螻ｱ蠖｢", "莉吝床", "遖丞ｳｶ", "豌ｴ謌ｸ", "鄒､鬥ｬ", "譬・・ｽ・ｽ", "螟ｧ螳ｮ", "蜊・・ｽ・ｽ", "逶ｸ讓｡蜴・, "逕ｲ蠎・, "譚ｾ譛ｬ", "髟ｷ驥・];
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
      updateStatsCard(nextNiigata, "譁ｰ貎・);
      updateStatsCard(nextKumamoto, "辭頑悽");
    };
    refreshStandings();

    // 蜑咲ｯ陦ｨ遉ｺ繧呈峩譁ｰ・ｽE・ｽ迢ｬ遶矩未謨ｰ縺ｫ蟋碑ｭｲ・ｽE・ｽE    updateDashboardPrevResults();
  }

  // --- 蜑咲ｯ陦ｨ遉ｺ譖ｴ譁ｰ・ｽE・ｽEenderDashboard蜀榊他縺ｳ蜃ｺ縺励〒繧ゅΜ繧ｻ繝・・ｽ・ｽ縺輔ｌ縺ｪ縺・・ｽ・ｽ遶矩未謨ｰ・ｽE・ｽE---
  // --- Update Previous Match Results on Dashboard ---
  function updateDashboardPrevResults() {
    if (!officialResults.length) return;

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
      const name = ((isRHome ? r.away : r.home) || "").replace(/縺ｮ隧ｦ蜷郁ｩｳ邏ｰ|縺ｮ邨先棡/g, "").trim();
      let emblem = resolveEmblemUrl(name, scheduleData.find(m => m.date === r.date && robustTeamMatch(m.opponent, name))?.emblem || "");
      if (!emblem) {
        const reversed = Object.entries(EMBLEM_MAP).find(([k, v]) => robustTeamMatch(v, name));
        if (reversed) emblem = `https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png`;
      }
      return { name, emblem };
    };

    const updateUI = (club, teamKw, match) => {
      const card = document.getElementById(`dash-card-${club}`);
      if (!card) return;
      
      const cutoff = match ? match.date : "9999-12-31";
      
      const updateHalf = (prefix, kw) => {
        const past = officialResults.filter(r => {
          const dMatch = r.date < cutoff;
          const status = (r.status || "").toLowerCase();
          const isFinished = status.includes("finish") || status.includes("ft") || status.includes("邨・);
          
          // Static JSON Support
          if (r.club && r.opponent) {
            const tMatchStatic = (kw === "譁ｰ貎・ ? r.club === "niigata" : r.club === "kumamoto");
            const hasScoreStatic = r.score !== undefined;
            return dMatch && tMatchStatic && hasScoreStatic;
          }
          
          // GAS Support
          const tMatch = robustTeamMatch(r.home, kw) || robustTeamMatch(r.away, kw);
          const hasScore = r.home_score !== "" && r.home_score !== null;
          return dMatch && tMatch && (hasScore || isFinished);
        }).sort((a,b) => b.date.localeCompare(a.date));

        if (!past.length) return;
        const last = past[0];
        
        let isHome, sM, sO, opp, symbol, badgeColor, badgeText, scoreStr;

        if (last.score !== undefined) {
           isHome = last.home_away === "H";
           const scores = last.score.split("-");
           sM = parseInt(scores[0]);
           sO = parseInt(scores[1]);
           opp = last.opponent;
        } else {
           isHome = robustTeamMatch(last.home, kw);
           sM = parseInt(isHome ? last.home_score : last.away_score);
           sO = parseInt(isHome ? last.away_score : last.home_score);
           opp = (isHome ? last.away : last.home).replace(/縺ｮ隧ｦ蜷郁ｩｳ邏ｰ|縺ｮ邨先棡/g, "").trim();
        }
        
        symbol = "DRAW";
        badgeColor = "#f1f3f4";
        badgeText = "#5f6368";
        scoreStr = `${sM} - ${sO}`;
        
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

        const resHtml = `<span style="border:1px solid ${badgeColor}; background:${badgeColor}; color:${badgeText}; border-radius:12px; padding:3px 8px; font-size:0.7rem; font-weight:800; display:inline-flex; align-items:center; gap:4px;"><span style="font-size:0.5rem;">笳・/span> ${symbol}</span>`;

        let formHtml = `<div class="dash-form-strip">`;
        const recent5 = past.slice(0, 5).reverse();
        recent5.forEach(r => {
          let rM, rO, rSym = "笆ｳ";
          if (r.score !== undefined) {
             const isRHome = r.home_away === "H";
             const rScores = r.score.split("-");
             rM = parseInt(rScores[0]);
             rO = parseInt(rScores[1]);
          } else {
             const isRHome = robustTeamMatch(r.home, kw);
             rM = parseInt(isRHome ? r.home_score : r.away_score);
             rO = parseInt(isRHome ? r.away_score : r.home_score);
          }

          if (rM > rO) { rSym = "縲・; }
          else if (rM < rO) { rSym = "笳・; }
          else if (r.pk) {
            const pkMatch = r.pk.match(/(\d+)\s*PK\s*(\d+)/i);
            if (pkMatch) {
              const isRHome = (r.score !== undefined) ? (r.home_away === "H") : robustTeamMatch(r.home, kw);
              const pkM = parseInt(isRHome ? pkMatch[1] : pkMatch[2]);
              const pkO = parseInt(isRHome ? pkMatch[2] : pkMatch[1]);
              if (pkM > pkO) { rSym = "笆ｳ"; }
              else { rSym = "笆ｲ"; }
            }
          }
          const recentOpp = getOpponentInfoFromResult(r, kw);
          const recentHA = (r.score !== undefined ? r.home_away : (robustTeamMatch(r.home, kw) ? "H" : "A")) || "";
          const emblemHtml = recentOpp.emblem
            ? `<img class="dash-form-emblem" src="${escapeAttr(recentOpp.emblem)}" alt="${escapeAttr(recentOpp.name)}">`
            : `<span class="dash-form-emblem-placeholder"></span>`;
          formHtml += `<span class="dash-form-item"><span class="dash-form-symbol">${rSym}</span>${emblemHtml}<span class="dash-form-ha">${recentHA}</span></span>`;
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

    updateUI("niigata", "譁ｰ貎・, nextNiigata);
    updateUI("kumamoto", "辭頑悽", nextKumamoto);

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
    if (timeBox) timeBox.innerText = `譛邨ょ酔譛・ ${new Date().toLocaleTimeString()} (Data: v20260424)`;
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

        card.innerHTML = `${resultHtml}<div class="match-meta"><span class="match-mw-pill">${match.matchweek || "EX"}</span><span class="match-ha-pill">${ha}</span>${isAtt ? '<span class="match-att-emoji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>' : ''}</div><div class="match-date-time">${match.date} ${match.day} - ${match.time}</div><div class="match-venue">${match.venue}</div><div class="match-row"><h3 class="opponent-name" title="髟ｷ謚ｼ縺励〒HOME/AWAY縺ｮ繧ｯ繝ｩ繝門錐繧偵さ繝費ｿｽE">${escapeHtml(match.opponent)}</h3><img class="emblem" src="${escapeHtml(emblemUrl)}"></div>`;
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
        <div class="ym-picker-years" aria-label="蟷ｴ"></div>
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
      yearLabel.textContent = `${pickerYear}蟷ｴ`;
      monthGrid.innerHTML = "";
      yearMap[pickerYear]
        .sort((a, b) => Number(a.m) - Number(b.m))
        .forEach(item => {
        const btn = document.createElement("button"); btn.className = "ym-picker-btn";
        btn.textContent = Number(item.m) + "譛・;
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
    label.textContent = "譖ｴ譁ｰ荳ｭ...";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";

    try {
      await refreshAllData(true); // Force GAS
      alert("譛譁ｰ繝・・ｽE繧ｿ繧貞叙蠕励＠縺ｦ蜿肴丐縺励∪縺励◆縲・);
    } catch (e) {
      console.error(e);
      alert("譖ｴ譁ｰ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
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
        alert("繧､繝ｳ繝晢ｿｽE繝医′螳御ｺ・・ｽ・ｽ縺ｾ縺励◆縲ゅい繝励Μ繧抵ｿｽE隱ｭ縺ｿ霎ｼ縺ｿ縺励∪縺吶・);
        location.reload();
      } catch (err) {
        alert("螟ｱ謨・ 豁｣縺励＞繝舌ャ繧ｯ繧｢繝・・ｽE繝輔ぃ繧､繝ｫ繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲・);
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

  // 搭 Export Attendance Schedule
  const exportListBtn = document.getElementById("export-list-btn");
  if (exportListBtn) {
    exportListBtn.onclick = async () => {
      let txt = "縲占ｦｳ謌ｦ莠亥ｮ壹Μ繧ｹ繝医曾n\n";
      const attMatches = scheduleData.filter(match => {
        const mId = `${match.date}_${match.club}_${match.opponent}`;
        return localStorage.getItem(`attend_${mId}`) === "true";
      }).sort((a, b) => parseDate(a.date) - parseDate(b.date));

      if (attMatches.length === 0) {
        alert("隕ｳ謌ｦ莠亥ｮ夲ｿｽE隧ｦ蜷茨ｿｽE縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ縲・);
        return;
      }
      attMatches.forEach(m => {
        const isHome = getMatchIsHome(m);
        txt += `${m.date} ${m.day} ${m.time} - vs ${m.opponent}\n`;
        txt += `桃 ${m.venue} (${isHome ? 'HOME' : 'AWAY'})\n\n`;
      });
      txt += "Powered by Match Day Ultra";
      try {
        await navigator.clipboard.writeText(txt);
        alert("隕ｳ謌ｦ莠亥ｮ壹Μ繧ｹ繝医ｒ繧ｯ繝ｪ繝・・ｽE繝懶ｿｽE繝峨↓繧ｳ繝費ｿｽE縺励∪縺励◆・ｽE・ｽ\nLINE繧・・ｽ・ｽ繝｢蟶ｳ縺ｫ雋ｼ繧贋ｻ倥￠縺ｦ蜈ｱ譛峨〒縺阪∪縺吶・);
      } catch (err) {
        alert("繧ｳ繝費ｿｽE縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲ゅ％縺ｮ繝悶Λ繧ｦ繧ｶ縺ｧ縺ｯ繧ｵ繝晢ｿｽE繝医＆繧後※縺・・ｽ・ｽ縺・・ｽ・ｽ閭ｽ諤ｧ縺後≠繧翫∪縺吶・);
      }
    };
  }

  // 笞｡ Fast Input Modal
  const fastInputBtn = document.getElementById("fast-input-btn");
  const fastInputSheet = document.getElementById("fast-input-sheet");
  const fastInputList = document.getElementById("fast-input-list");
  const saveFastInputBtn = document.getElementById("save-fast-input");
  const closeFastInputBtn = document.getElementById("close-fast-input");

  let fastSelectedYear = 2026;

  function renderFastInput() {
    fastInputList.innerHTML = "";

    // 驕ｸ謚槭＆繧後◆蟷ｴ縺ｮ隧ｦ蜷茨ｿｽE蜈ｨ莉ｶ繧貞叙蠕暦ｼ域悴譚･縺ｮ隧ｦ蜷医ｂ蜷ｫ繧√ｋ・ｽE・ｽE    const yearMatches = scheduleData.filter(m => {
      return parseDate(m.date).getFullYear() === fastSelectedYear;
    }).sort((a, b) => parseDate(a.date) - parseDate(b.date));

    if (yearMatches.length === 0) {
      fastInputList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-grey);">${fastSelectedYear}蟷ｴ縺ｮ隧ｲ蠖薙☆繧玖ｩｦ蜷茨ｿｽE縺ゅｊ縺ｾ縺帙ｓ縲・/div>`;
    } else {
      yearMatches.forEach(m => {
        const mYear = parseDate(m.date).getFullYear();
        const mId = `${m.date}_${m.club}_${m.opponent}`;
        const sMy = localStorage.getItem(`score_my_${mId}`) || "";
        const sOpp = localStorage.getItem(`score_opp_${mId}`) || "";

        const sPkM = localStorage.getItem(`score_my_pk_${mId}`) || "";
        const sPkO = localStorage.getItem(`score_opp_pk_${mId}`) || "";
        const isAttend = localStorage.getItem(`attend_${mId}`) === "true";

        // 2026蟷ｴ縺ｧ縺九▽迴ｾ蝨ｨ縺ｮ蜈･蜉帛､縺悟酔轤ｹ縺ｮ蝣ｴ蜷茨ｿｽE縺ｿPK鬆伜沺繧定｡ｨ遉ｺ縺吶ｋ
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
             
             <!-- PK蜈･蜉幃伜沺・ｽE・ｽE026蟷ｴ縺九▽蜷檎せ譎ゑｿｽE縺ｿ陦ｨ遉ｺ・ｽE・ｽE-->
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
    // 繧ｹ繧ｳ繧｢蜈･蜉帶凾縺ｮ蜍慕噪縺ｪPK鬆伜沺縺ｮ陦ｨ遉ｺ蛻・・ｽ・ｽ
    fastInputList.oninput = (e) => {
      const inp = e.target;
      if (inp.classList.contains("fast-my-score") || inp.classList.contains("fast-opp-score")) {
        const mYear = parseInt(inp.dataset.year);
        if (mYear === 2026) {
          const container = inp.closest("div").parentElement; // .flex-end 鬆伜沺
          const pkArea = container.querySelector(".fast-pk-area");
          if (pkArea) {
            const mS = container.querySelector(".fast-my-score").value;
            const oS = container.querySelector(".fast-opp-score").value;
            pkArea.style.display = (mS !== "" && oS !== "" && mS === oS) ? "flex" : "none";
          }
        }
      }
    };

    // 隕ｳ謌ｦ繝医げ繝ｫ縺ｮ繝上Φ繝峨Μ繝ｳ繧ｰ
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
        alert(`荳諡ｬ蜈･蜉幢ｿｽE蜀・・ｽ・ｽ繧剃ｿ晏ｭ倥＠縺ｾ縺励◆縲Ａ);
      }
      fastInputSheet.classList.remove("active");
    };
  }

  // 搭 Text Bulk Input Parsing (New Screen Flow)
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

      const blocks = text.split(/隨ｬ(\d+)遽/);
      let savedCount = 0;
      for (let i = 1; i < blocks.length; i += 2) {
        const mwNum = blocks[i];
        const content = blocks[i + 1];

        const scoreMatch = content.match(/(笳弓笳楯笆ｳ|[-])?\s*(\d+)-(\d+)(?:\s*PK(\d+)-(\d+))?/);
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
            const oppNameBase = c.opponent.replace(/[A-Za-z・ｽE・ｽ-・ｽE・ｽ・ｽE・ｽE・ｽE・ｽ\s繝ｻ.()]/g, '').substring(0, 2);
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
        alert(`${savedCount}莉ｶ縺ｮ隧ｦ蜷育ｵ先棡繧貞渚譏縺励∪縺励◆縲Ａ);
        bulkPasteArea.value = "";
        closeSubPane("bulk-paste-overlay");
      } else {
        alert("隧ｲ蠖薙☆繧玖ｩｦ蜷医ョ繝ｼ繧ｿ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆縲ゑｿｽE蜉帛ｽ｢蠑上ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞縲・);
      }
    };
  }

  // 討 Chants Accordion Logic
  document.querySelectorAll('.u-chant-title').forEach(title => {
    title.onclick = () => {
      const parent = title.parentElement;
      parent.classList.toggle('active');
    };
  });
  // =========================================================
  // 売 GAS API 閾ｪ蜍募酔譛滂ｼ郁ｩｦ蜷育ｵ先棡 + 鬆・・ｽ・ｽ陦ｨ・ｽE・ｽE  // =========================================================
  const gasUrl = 'https://script.google.com/macros/s/AKfycbxkYHfKA3KR_eKFFJ2Fij3_K3vTzyGtq8_Hr_vBEKslcU6B5XxodjcdmVNdTTnwtQUy/exec';


  // --- Standings View ---

  async function loadStandings() {
    const container = document.getElementById("standings-content");
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</div>`;
    try {
      const json = await fetchData("standings");
      if (!json || !json.data || !Array.isArray(json.data)) throw new Error("no data");

      // 繧ｰ繝ｫ繝ｼ繝怜挨縺ｫ謨ｴ逅・      const groups = {};
      json.data.forEach(row => {
        if (!groups[row.group]) groups[row.group] = [];
        groups[row.group].push(row);
      });

      // 繧ｰ繝ｫ繝ｼ繝苓｡ｨ遉ｺ鬆・ WEST-A 竊・WEST-B 竊・EAST-A 竊・EAST-B
      const GROUP_ORDER = ['WEST-A', 'WEST-B', 'EAST-A', 'EAST-B'];
      const sortedGroups = Object.keys(groups).sort((a, b) => {
        const ai = GROUP_ORDER.findIndex(k => a.includes(k));
        const bi = GROUP_ORDER.findIndex(k => b.includes(k));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      // 繧ｫ繝ｩ繝螳夂ｾｩ
      const COLS = [
        { label: '鬆・, key: 'rank', type: 'num' },
        { label: '繝・ｿｽE繝', key: 'team', type: 'str' },
        { label: '蜍晉せ', key: 'points', type: 'num' },
        { label: '隧ｦ蜷・, key: 'played', type: 'num' },
        { label: '蜍・, key: 'won', type: 'num' },
        { label: 'PK蜍・, key: 'pk_won', type: 'num' },
        { label: 'PK雋', key: 'pk_lost', type: 'num' },
        { label: '雋', key: 'lost', type: 'num' },
        { label: '蠕・, key: 'goals_for', type: 'num' },
        { label: '螟ｱ', key: 'goals_against', type: 'num' },
        { label: '蟾ｮ', key: 'goal_diff', type: 'num' },
      ];

      // 繧ｽ繝ｼ繝育憾諷九ｒ繧ｰ繝ｫ繝ｼ繝玲ｯ弱↓邂｡逅・      const sortState = {};
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
          const isNiigata = (row.team || '').includes('譁ｰ貎・);
          const isKumamoto = (row.team || '').includes('辭頑悽');
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
        html += '<p style="text-align:center;font-size:0.75rem;color:#999;margin-top:16px;padding-bottom:8px;">譖ｴ譁ｰ: ' + now + '</p>';
        container.innerHTML = html;
        // 繧ｽ繝ｼ繝医け繝ｪ繝・・ｽ・ｽ繧､繝吶Φ繝医ｒ蜀阪ヰ繧､繝ｳ繝・        container.querySelectorAll('.standings-table th[data-key]').forEach(th => {
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
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;">蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・br>蜀榊ｺｦ縺願ｩｦ縺励￥縺縺輔＞縲・/div>`;
    }
  }

  // --- J-League Historical Data Loader ---
  function shortenCompetition(comp) {
    if (!comp) return "J繝ｪ繝ｼ繧ｰ";
    if (comp.includes("繝・・ｽ・ｽ繝薙ず繝ｧ繝ｳ1") || comp.includes("J1")) return "J1";
    if (comp.includes("繝・・ｽ・ｽ繝薙ず繝ｧ繝ｳ2") || comp.includes("J2")) return "J2";
    if (comp.includes("J3")) return "J3";
    if (comp.includes("螟ｩ逧・・ｽ・ｽ")) return "螟ｩ逧・・ｽ・ｽ";
    if (comp.includes("繝､繝槭じ繧ｭ繝翫ン繧ｹ繧ｳ")) return "繝翫ン繧ｹ繧ｳ譚ｯ";
    if (comp.includes("繝ｫ繝ｴ繧｡繝ｳ")) return "繝ｫ繝ｴ繧｡繝ｳ譚ｯ";
    return comp.replace("J繝ｪ繝ｼ繧ｰ", "J").trim();
  }

  function decorateMatchWithJsonDetails(target, m, isHome) {
    if (!target) return;
    
    // Add referee details
    target.referee = m.referees ? m.referees["荳ｻ蟇ｩ"] : "";
    target.assistant_referees = m.referees && m.referees["蜑ｯ蟇ｩ"] ? m.referees["蜑ｯ蟇ｩ"].split(",").map(s => s.trim()) : [];
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
    
    const rawStarters = isHome ? homeDetails.starting : awayDetails.starting;
    target.starting_members = Array.isArray(rawStarters) ? rawStarters.map(p => ({
      position: p.position || "",
      number: p.number || "",
      name: p.name || ""
    })) : [];
    
    const rawBench = isHome ? homeDetails.substitutes : awayDetails.substitutes;
    target.bench_members = Array.isArray(rawBench) ? rawBench.map(p => ({
      position: p.position || "",
      number: p.number || "",
      name: p.name || ""
    })) : [];
    
    // Add substitutions
    const substitutions = [];
    const rawSubs = isHome ? homeDetails.substitutions : awayDetails.substitutions;
    if (Array.isArray(rawSubs)) {
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
    }
    target.substitutions = substitutions;
    
    // Add warnings/cards
    const warnings = [];
    const rawCards = isHome ? homeDetails.cards : awayDetails.cards;
    if (Array.isArray(rawCards)) {
      rawCards.forEach(c => {
        warnings.push({
          minute: c.time ? c.time.replace("'", "") : "",
          player: c.name
        });
      });
    }
    target.warnings = warnings;
  }

  function processHistoricalMatches(matches, year) {
    if (!Array.isArray(matches)) return;
    
    matches.forEach(m => {
      const isNiigata = m.home_team === "繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・ || m.away_team === "繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・;
      const isKumamoto = m.home_team === "繝ｭ繧｢繝・・ｽ・ｽ辭頑悽" || m.away_team === "繝ｭ繧｢繝・・ｽ・ｽ辭頑悽";
      
      if (!isNiigata && !isKumamoto) return;
      
      const club = isNiigata ? "niigata" : "kumamoto";
      const clubKeyword = isNiigata ? "繧｢繝ｫ繝薙Ξ繝・・ｽ・ｽ繧ｹ譁ｰ貎・ : "繝ｭ繧｢繝・・ｽ・ｽ辭頑悽";
      const isHome = m.home_team === clubKeyword;
      const opponent = isHome ? m.away_team : m.home_team;
      const dateStr = m.date.replace(/\//g, "-");
      
      // Check duplicate in officialResults
      const existsResult = officialResults.find(r => r.date === dateStr && r.club === club && robustTeamMatch(r.opponent || "", opponent));
      if (existsResult) {
        decorateMatchWithJsonDetails(existsResult, m, isHome);
        return;
      }
      
      // Build the officialResult
      const d = new Date(dateStr);
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const dayStr = days[d.getDay()];
      
      const hScore = parseInt(m.home_score);
      const aScore = parseInt(m.away_score);
      let resultMark = "笆ｳ";
      if (isHome) {
        if (hScore > aScore) resultMark = "笳・;
        else if (hScore < aScore) resultMark = "笳・;
      } else {
        if (hScore < aScore) resultMark = "笳・;
        else if (hScore > aScore) resultMark = "笳・;
      }
      
      const scoreStr = isHome ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`;
      const compShort = shortenCompetition(m.competition);
      const detailsStr = `${compShort} ${isHome ? "H" : "A"} ${resultMark} ${scoreStr}`;
      
      let emblem = resolveEmblemUrl(opponent, "") || "";
      if (!emblem) {
        const reversed = Object.entries(EMBLEM_MAP).find(([k,v]) => robustTeamMatch(v, opponent));
        if (reversed) emblem = `https://jleague.r10s.jp/img/common/img_club_${reversed[0]}.png`;
      }
      
      const matchweekDisplay = m.section.replace(/隨ｬ(\d+)遽.*/, "隨ｬ$1遽");
      const mwNum = m.section.replace(/\D/g, "");
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
      officialResults.push(resultObj);
      
      // Check duplicate in scheduleData
      const existsSchedule = scheduleData.find(s => s.date === dateStr && s.club === club && robustTeamMatch(s.opponent, opponent));
      if (!existsSchedule) {
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
          raw_json: m
        };
        decorateMatchWithJsonDetails(scheduleObj, m, isHome);
        scheduleData.push(scheduleObj);
      } else {
        decorateMatchWithJsonDetails(existsSchedule, m, isHome);
      }
    });
  }

  function decorateAllMatches() {
    scheduleData.forEach(m => {
      const offRes = findOfficialResult(m);
      if (offRes) {
        ["referee", "assistant_referees", "manager", "j_official_url", "weather", "temperature", "humidity", "attendance", "goals", "opponent_goals", "starting_members", "bench_members", "substitutions", "warnings"].forEach(key => {
          if (offRes[key] !== undefined && offRes[key] !== null) {
            m[key] = offRes[key];
          }
        });
      }
    });
  }

  async function loadHistoricalData() {
    const years = [];
    for (let y = 1999; y <= 2026; y++) {
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
    
    rebuildYearTabs();
    renderFeed();
    applyYearFilter(selectedYear || String(new Date().getFullYear()), true);
    if (currentMode === "dashboard") renderDashboard();
    else if (currentMode === "calendar") renderCalendar();
  }

  // 繧｢繝励Μ襍ｷ蜍墓凾縺ｫ蛻晄悄蛹・  updateHeaderAnnouncements();

  // 繧｢繝励Μ襍ｷ蜍墓凾縺ｫ繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝峨〒邨先棡蜷梧悄縺翫ｈ縺ｳ豁ｴ蜿ｲ逧・・ｽ・ｽ繝ｼ繧ｿ縺ｮ繝ｭ繝ｼ繝会ｼ・00ms蠕鯉ｼ・  setTimeout(() => {
    refreshAllData(true)
      .then(() => loadHistoricalData())
      .catch((e) => {
        console.error("refreshAllData error, starting fallback loader", e);
        loadHistoricalData();
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
