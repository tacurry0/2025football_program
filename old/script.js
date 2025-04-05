
document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("slider");
  const monthTitle = document.getElementById("month-title");

  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  const today = new Date();
  let currentMonth = today.getMonth();
  let isDragging = false;
  let startX = 0;
  let currentTranslate = 0;

  function updateMonthTitle() {
    monthTitle.textContent = months[currentMonth];
  }

  function updateSlider() {
    currentTranslate = -currentMonth * window.innerWidth;
    slider.style.transform = `translateX(${currentTranslate}px)`;
    updateMonthTitle();
  }

  // 仮：12ヶ月分ダミーデータを入れる
  for (let i = 0; i < 12; i++) {
    const div = document.createElement("div");
    div.className = "month-page";
    div.innerHTML = `<div class="schedule-card orange">
      <div class="schedule-content">
        <div class="opponent">vs Dummy FC ${i + 1}</div>
        <div class="datetime">${i + 1}/15 Sat 14:00</div>
        <div class="stadium">Dummy Stadium</div>
      </div>
      <img class="emblem" src="https://jleague.r10s.jp/img/common/img_club_kashima.png" />
    </div>`;
    slider.appendChild(div);
  }

  updateSlider();

  slider.addEventListener("touchstart", (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
  });

  slider.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    slider.style.transform = `translateX(${currentTranslate + deltaX}px)`;
  });

  slider.addEventListener("touchend", (e) => {
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const moved = endX - startX;

    if (moved < -50 && currentMonth < 11) currentMonth++;
    else if (moved > 50 && currentMonth > 0) currentMonth--;

    updateSlider();
  });
});
