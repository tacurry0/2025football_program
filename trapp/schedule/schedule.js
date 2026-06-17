window.scheduleData = window.scheduleData || [];

const SCHEDULE_DATA_FILE = "data/schedule/2026_2027.json";

function normalizeCriticalAscii(value) {
  return typeof value === "string"
    ? value.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    : value;
}

function normalizeCriticalMatch(match) {
  if (!match || typeof match !== "object") return match;
  ["opponent", "venue", "stadium", "home", "away", "home_team", "away_team", "team", "competition", "tournament", "league", "matchweek"].forEach(key => {
    if (typeof match[key] === "string") match[key] = normalizeCriticalAscii(match[key]);
  });
  return match;
}

function getCriticalFirstIsoDate(dateStr) {
  const match = String(dateStr || "").match(/\d{4}-\d{1,2}-\d{1,2}/);
  if (!match) return "";
  const [y, m, d] = match[0].split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getCriticalDateParts(dateStr) {
  const firstDate = getCriticalFirstIsoDate(dateStr) || String(dateStr || "");
  const [y, m, d] = firstDate.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date,
    label: `${dateStr || ""} ${days[date.getDay()] || ""}`.trim()
  };
}

function escapeCriticalHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCriticalHome(match) {
  if (match.home_away === "H") return true;
  if (match.home_away === "A") return false;
  const venue = match.venue || "";
  if (match.club === "niigata") return venue.includes("デンカ") || venue.includes("ビッグスワン");
  if (match.club === "kumamoto") return venue.includes("えがお") || venue.includes("熊本");
  return false;
}

function renderCriticalDashboard(matches) {
  if (document.body && document.body.getAttribute("data-dashboard-full-ready") === "true") return;
  const container = document.getElementById("dashboard-cards-container");
  if (!container || !Array.isArray(matches) || !matches.length) return;

  const now = new Date();
  const cutoff = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const sorted = matches
    .filter(match => match && match.date >= cutoff)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || "").localeCompare(String(b.time || "")));

  const nextNiigata = sorted.find(match => match.club === "niigata");
  const nextKumamoto = sorted.find(match => match.club === "kumamoto");
  const cardHtml = (match, title, color) => {
    if (!match) {
      return `<div class="dash-card white-theme"><div style="padding:20px;text-align:center;color:#888;">今後の試合予定がありません</div></div>`;
    }
    const ha = isCriticalHome(match) ? "HOME" : "AWAY";
    const parts = getCriticalDateParts(match.date);
    const dateText = [parts.label, match.time].filter(Boolean).join(" ");
    return `
      <div class="dash-card white-theme critical-dash-card" data-critical="true" style="background:white;">
        <div class="dash-card-header" style="background:${color}; border-bottom:none; padding:8px 15px;">
          <span class="dash-team-name" style="font-size:1.4rem; font-weight:900;">${title}</span>
          <span class="sheet-ha badge-${ha.toLowerCase()}" style="color:#fff; font-weight:800; font-size:0.85rem;">${ha}</span>
        </div>
        <div class="dash-card-body" style="background:white; color:#111; padding:14px 15px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span class="dash-mw" style="background:#e8e8ed; color:#111; padding:2px 8px; border-radius:6px; font-size:0.9rem; border:none;">${escapeCriticalHtml(match.matchweek || "EX")}</span>
            <span class="dash-date" style="color:#111; font-weight:700; font-size:0.95rem;">${escapeCriticalHtml(dateText)}</span>
          </div>
          <div class="dash-venue-row" style="color:#555; font-size:0.85rem; font-weight:700; margin-bottom:10px;">${escapeCriticalHtml(match.venue || "")}</div>
          <div style="display:flex; align-items:baseline; gap:10px; border-bottom:1px solid #f0f0f5; padding-bottom:10px;">
            <span class="dash-vs" style="color:#888; font-size:1.1rem; font-weight:800;">VS</span>
            <h3 class="dash-opp-name" style="color:#111; font-weight:900; margin:0; font-size:1.6rem; font-family:var(--font-main); letter-spacing:1px;">${escapeCriticalHtml(match.opponent || "")}</h3>
          </div>
        </div>
      </div>
    `;
  };

  container.innerHTML = [
    cardHtml(nextNiigata, "ALBIREX NIIGATA", "var(--albirex-orange)"),
    cardHtml(nextKumamoto, "ROASSO KUMAMOTO", "var(--roasso-red)")
  ].join("");
  document.body.setAttribute("data-dashboard-critical-ready", "true");
}

window.scheduleDataReady = (async () => {
  const scheduleUrl = new URL(`./${SCHEDULE_DATA_FILE}`, window.location.href);
  scheduleUrl.searchParams.set("v", Date.now().toString());
  const res = await fetch(scheduleUrl.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`${SCHEDULE_DATA_FILE} load failed: ${res.status}`);
  const items = await res.json();
  window.scheduleData = Array.isArray(items) ? items.map(normalizeCriticalMatch) : [];
  renderCriticalDashboard(window.scheduleData);
  window.scheduleDataSource = {
    file: SCHEDULE_DATA_FILE,
    count: window.scheduleData.length,
    loadedAt: new Date().toISOString()
  };
  return window.scheduleData;
})();
