document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('calendar-nav-toggle');
  if (!button) return;
  let collapsed = false;
  try { collapsed = localStorage.getItem('trapp_calendar_nav_collapsed') === 'true'; } catch (_) {}
  function render() {
    document.body.classList.toggle('calendar-nav-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.textContent = collapsed ? '年月を表示 ▴' : '年月を隠す ▾';
  }
  button.addEventListener('click', () => {
    collapsed = !collapsed;
    try { localStorage.setItem('trapp_calendar_nav_collapsed', String(collapsed)); } catch (_) {}
    render();
  });
  render();
});
