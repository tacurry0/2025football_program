let currentMonth = new Date().getMonth() + 1;
const months = Array.from(document.querySelectorAll('.month-section'));
const monthHeader = document.getElementById('month-header');
let currentIndex = months.findIndex(m => parseInt(m.dataset.month) === currentMonth);
if (currentIndex === -1) currentIndex = 0;

function showMonth(index) {
  months.forEach((m, i) => m.style.display = i === index ? 'block' : 'none');
  const monthName = mName(parseInt(months[index].dataset.month));
  monthHeader.textContent = monthName;
}

function mName(m) {
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return names[m - 1] || "Unknown";
}

showMonth(currentIndex);

window.addEventListener('touchstart', handleTouchStart, false);
window.addEventListener('touchend', handleTouchEnd, false);
let xDown = null;

function handleTouchStart(evt) {
  xDown = evt.touches[0].clientX;
}

function handleTouchEnd(evt) {
  if (!xDown) return;
  let xUp = evt.changedTouches[0].clientX;
  let xDiff = xDown - xUp;
  if (Math.abs(xDiff) > 50) {
    if (xDiff > 0 && currentIndex < months.length - 1) currentIndex++;
    else if (xDiff < 0 && currentIndex > 0) currentIndex--;
    showMonth(currentIndex);
  }
  xDown = null;
}
let currentIndex = 0;
const slider = document.getElementById("month-slider");
const totalMonths = document.querySelectorAll(".month-section").length;

function updateSlider() {
  const offset = -100 * currentIndex;
  slider.style.transform = `translateX(${offset}%)`;

  const currentSection = document.querySelectorAll(".month-section")[currentIndex];
  const monthName = currentSection.querySelector(".month-title").textContent;
  document.getElementById("month-header").textContent = monthName;
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
  } else if (deltaX < -50 && currentIndex < totalMonths - 1) {
    currentIndex++;
    updateSlider();
  }
});