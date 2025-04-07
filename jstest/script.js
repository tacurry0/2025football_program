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