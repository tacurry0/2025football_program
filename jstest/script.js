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
});