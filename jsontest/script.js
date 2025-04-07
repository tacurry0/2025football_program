document.addEventListener("DOMContentLoaded", () => {
  let currentMonth = new Date().getMonth() + 1;
  const slider = document.getElementById("month-slider");
  const months = Array.from(document.querySelectorAll(".month-section"));
  const monthHeader = document.getElementById("month-header");
  let currentIndex = months.findIndex(m => parseInt(m.dataset.month) === currentMonth);
  if (currentIndex === -1) currentIndex = 0;

  function mName(m) {
    const names = ["January", "February", "March", "April", "May", "June", "July",
                   "August", "September", "October", "November", "December"];
    return names[m - 1] || "Unknown";
  }

  function updateSlider() {
    const offset = -100 * currentIndex;
    slider.style.transform = `translateX(${offset}%)`;

    const currentSection = months[currentIndex];
    const monthName = currentSection.querySelector(".month-title").textContent;
    monthHeader.textContent = monthName;
  }

  let touchStartX = 0;

  slider.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  slider.addEventListener("touchend", e => {
    const touchEndX = e.changedTouches[0].screenX;
    const deltaX = touchEndX - touchStartX;

    if (deltaX > 50 && currentIndex > 0) {
      currentIndex--;
      updateSlider();
    } else if (deltaX < -50 && currentIndex < months.length - 1) {
      currentIndex++;
      updateSlider();
    }
  });

  updateSlider(); // 初期表示

  const toggleAlb = document.getElementById("toggle-niigata");
  const toggleRoa = document.getElementById("toggle-kumamoto");

  toggleAlb.addEventListener("click", () => {
    toggleClub("niigata", toggleAlb);
  });

  toggleRoa.addEventListener("click", () => {
    toggleClub("kumamoto", toggleRoa);
  });

  function toggleClub(clubClass, icon) {
    icon.classList.toggle("active");
    const cards = document.querySelectorAll(`.card.${clubClass}`);
    cards.forEach(card => {
      card.style.display = icon.classList.contains("active") ? "block" : "none";
    });
  }
  // 以下を追加
  const cards = document.querySelectorAll(".card");
  const results = [];

  cards.forEach(card => {
    const club = card.classList.contains("niigata") ? "niigata" :
                 card.classList.contains("kumamoto") ? "kumamoto" : "unknown";

    const matchDateEl = card.querySelector(".match-date");
    const infoLineEl = card.querySelector(".info-line .opponent-name");
    const venueEl = card.querySelector(".venue");
    const emblemEl = card.querySelector(".emblem");

    if (!matchDateEl || !infoLineEl || !venueEl || !emblemEl) return;

    const matchText = matchDateEl.textContent.trim(); // 例: "MW1 - 2/15 Sat 14:00"
    const matchweek = matchText.split(" - ")[0];
    const dateInfo = matchText.split(" - ")[1];       // "2/15 Sat 14:00"

    const [monthDay, day, time] = dateInfo.split(" ");
    const [month, dayNum] = monthDay.split("/");

    results.push({
      club,
      matchweek,
      date: `2025-${month.padStart(2, '0')}-${dayNum.padStart(2, '0')}`,
      day,
      time,
      opponent: infoLineEl.textContent.trim(),
      venue: venueEl.textContent.trim(),
      emblem: emblemEl.getAttribute("src"),
      details: ""
    });
  });

  // 画面に出力
  const output = document.createElement("pre");
  output.textContent = JSON.stringify(results, null, 2);
  output.style.whiteSpace = "pre-wrap";
  output.style.fontSize = "12px";
  output.style.background = "#fff3cc";
  output.style.border = "1px solid #aaa";
  output.style.padding = "1em";
  output.style.margin = "1em";
  output.style.maxHeight = "40vh";
  output.style.overflow = "auto";

  document.body.prepend(output);
});