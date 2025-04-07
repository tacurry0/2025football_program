document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("month-slider");
  const monthHeader = document.getElementById("month-header");

  fetch("schedule.json")
    .then(res => res.json())
    .then(data => {
      const monthsMap = {};

      data.forEach(match => {
        const month = new Date(match.date).getMonth() + 1;
        if (!monthsMap[month]) monthsMap[month] = [];
        monthsMap[month].push(match);
      });

      for (const month in monthsMap) {
        const section = document.createElement("div");
        section.className = "month-section";
        section.dataset.month = month;

        const title = document.createElement("div");
        title.className = "month-title";
        title.textContent = new Date(2025, month - 1).toLocaleString("ja", { month: "long" });
        section.appendChild(title);

        monthsMap[month].forEach(match => {
          const card = document.createElement("div");
          card.className = `card ${match.club}`;
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
            <div class="match-details">${match.details || ""}</div>
          `;

          // タップで詳細開閉
          card.addEventListener("click", () => {
            card.classList.toggle("expanded");
          });

          section.appendChild(card);
        });

        slider.appendChild(section);
      }

      // スライダー表示処理
      const months = Array.from(document.querySelectorAll(".month-section"));
      let currentMonth = new Date().getMonth() + 1;
      let currentIndex = months.findIndex(m => parseInt(m.dataset.month) === currentMonth);
      if (currentIndex === -1) currentIndex = 0;

      let touchStartX = 0;

      function updateSlider() {
        const offset = -100 * currentIndex;
        slider.style.transform = `translateX(${offset}%)`;
        const currentSection = months[currentIndex];
        const monthName = currentSection.querySelector(".month-title").textContent;
        monthHeader.textContent = monthName;
      }

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

      updateSlider();

      // エンブレム切り替え
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
    });
card.addEventListener("click", () => {
  card.classList.toggle("expanded");
});
});