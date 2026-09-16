/* Motion is decorative; all content stays visible if this controller is unavailable. */
(() => {
  'use strict';
  const container = document.getElementById('dashboard-cards-container');
  if (!container || !window.IntersectionObserver || !Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = new Map();
  const parts = new Map();
  const played = new Set();
  const entrances = new Set();
  const selectors = '.poster-header,.poster-date-line,.poster-venue,.poster-opponent,.poster-team-summary,.poster-previous,.poster-recent,.fx-dashboard-analysis';
  let frame = 0;
  const enabled = () => !reduced.matches && !document.hidden && document.body.dataset.mode === 'dashboard' && !document.getElementById('home-loading-reveal');
  function enter(element, info) {
    if (!info.visible || played.has(info.key)) return;
    played.add(info.key);
    const animation = element.animate([
      { opacity: 0, transform: 'translate3d(0,18px,0)' },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { duration: 680, delay: info.delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    entrances.add(animation);
    const done = () => entrances.delete(animation);
    animation.onfinish = done;
    animation.oncancel = done;
  }
  function sync() {
    const active = enabled();
    for (const [card, visible] of cards) card.classList.toggle('poster-motion-running', active && visible);
    for (const animation of entrances) {
      if (reduced.matches) animation.cancel();
      else if (active && animation.playState === 'paused') animation.play();
      else if (!active && animation.playState === 'running') animation.pause();
    }
    if (active) for (const [element, info] of parts) enter(element, info);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (cards.has(entry.target)) cards.set(entry.target, entry.isIntersecting);
      const info = parts.get(entry.target);
      if (info) info.visible = entry.isIntersecting;
    }
    sync();
  }, { threshold: 0 });
  function refresh() {
    frame = 0;
    for (const map of [cards, parts]) for (const element of map.keys()) {
      if (!container.contains(element)) { observer.unobserve(element); map.delete(element); }
    }
    // Cancel entrances belonging to replaced cards after an asynchronous data refresh.
    for (const animation of entrances) if (!animation.effect?.target?.isConnected) animation.cancel();
    container.querySelectorAll('.poster-card').forEach(card => {
      if (!cards.has(card)) {
        cards.set(card, false);
        const hero = card.querySelector('.poster-hero');
        if (hero && !hero.querySelector('.poster-light')) {
          const light = document.createElement('span');
          light.className = 'poster-light';
          light.setAttribute('aria-hidden', 'true');
          hero.prepend(light);
        }
        observer.observe(card);
      }
      card.querySelectorAll(selectors).forEach((element, index) => {
        if (parts.has(element)) return;
        parts.set(element, {
          key: `${card.id}:${card.dataset.mid}:${index}`,
          visible: false,
          delay: Math.min(index, 4) * 65 + (card.id.endsWith('kumamoto') ? 100 : 0)
        });
        observer.observe(element);
      });
    });
    sync();
  }
  function scheduleRefresh() { if (!frame) frame = requestAnimationFrame(refresh); }
  new MutationObserver(scheduleRefresh).observe(container, { childList: true, subtree: true });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-dashboard-startup-reveal'] });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  refresh();
})();
