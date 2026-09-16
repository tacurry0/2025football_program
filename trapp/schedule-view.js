/* Keep the familiar year/month controls available above the schedule, not over it. */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('ultra-header');
  const nav = document.getElementById('ultra-nav');
  const toggle = document.getElementById('calendar-nav-toggle');
  header.querySelector('.schedule-month-heading').append(toggle);
  header.append(nav);
  // Start with the compact header on first use; preserve an explicit saved choice.
  try {
    if (localStorage.getItem('trapp_calendar_nav_collapsed') === null && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
  } catch (_) {}
  const measure = () => {
    if (!['feed','calendar'].includes(document.body.dataset.mode)) return;
    document.documentElement.style.setProperty('--schedule-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  };
  if (window.ResizeObserver) new ResizeObserver(measure).observe(header);
  new MutationObserver(measure).observe(document.body, { attributes: true, attributeFilter: ['data-mode','class'] });
  window.addEventListener('resize', measure, { passive: true });
  measure();
  for (const image of header.querySelectorAll('.club-pip')) {
    image.setAttribute('role', 'button'); image.tabIndex = 0;
    const state = () => image.setAttribute('aria-pressed', String(image.classList.contains('active')));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); image.click(); }
    });
    new MutationObserver(state).observe(image, { attributes: true, attributeFilter: ['class'] });
    state();
  }
});
