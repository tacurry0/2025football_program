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
  const selectors = '.poster-curtain,.poster-header,.poster-date-line,.poster-venue,.poster-opponent,.poster-team-summary,.poster-previous,.dash-form-item,.fx-dashboard-analysis';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let lastMode = document.body.dataset.mode;
  let depthFrame = 0;
  let frame = 0;
  const enabled = () => !reduced.matches && !document.hidden && document.body.dataset.mode === 'dashboard' && !document.getElementById('home-loading-reveal');
  function enter(element, info) {
    if (!info.visible || played.has(info.key)) return;
    played.add(info.key);
    let keyframes = [
      { opacity: 0, transform: 'translate3d(0,32px,0)' },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ];
    let duration = 850;
    let delay = info.delay;
    if (element.matches('.poster-curtain')) {
      keyframes = [
        { transform: 'translateX(-110%) skewX(-20deg)', offset: 0 },
        { transform: 'translateX(0) skewX(-20deg)', offset: .3 },
        { transform: 'translateX(110%) skewX(-20deg)', offset: 1 }
      ];
      duration = 1050; delay = 0;
    } else if (element.matches('.poster-date-line')) {
      keyframes = [
        { opacity: 0, transform: 'translate3d(-45px,28px,0) scale(1.35) rotate(-5deg)' },
        { opacity: 1, transform: 'translate3d(3px,-2px,0) scale(.98) rotate(.5deg)', offset: .75 },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(1) rotate(0deg)' }
      ];
      duration = 1000; delay = 180;
    } else if (element.matches('.poster-opponent')) {
      keyframes = [{ opacity: 0, transform: 'translateX(65px)', clipPath: 'inset(0 0 0 100%)' },
        { opacity: 1, transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)' }];
      delay = 340;
    } else if (element.matches('.poster-team-summary,.dash-form-item')) {
      keyframes = [{ opacity: 0, transform: 'translateY(30px) scale(.65) rotate(-7deg)' },
        { opacity: 1, transform: 'translateY(-3px) scale(1.05) rotate(1deg)', offset: .72 },
        { opacity: 1, transform: 'translateY(0) scale(1) rotate(0)' }];
      duration = 720;
    }
    const animation = element.animate(keyframes,
      { duration, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    entrances.add(animation);
    const done = () => entrances.delete(animation);
    animation.onfinish = done;
    animation.oncancel = done;
  }
  function sync() {
    const active = enabled();
    const mode = document.body.dataset.mode;
    if (mode !== lastMode) {
      if (mode === 'dashboard') played.clear();
      lastMode = mode;
    }
    for (const [card, visible] of cards) card.classList.toggle('poster-motion-running', active && visible);
    for (const animation of entrances) {
      if (reduced.matches) animation.cancel();
      else if (active && animation.playState === 'paused') animation.play();
      else if (!active && animation.playState === 'running') animation.pause();
    }
    if (active) {
      for (const [element, info] of parts) {
        // The curtain rests outside the hero, so observe its card rather than its offscreen box.
        if (element.matches('.poster-curtain')) info.visible = cards.get(element.closest('.poster-card'));
        enter(element, info);
      }
      scheduleDepth();
    } else {
      for (const card of cards.keys()) {
        card.style.removeProperty('--poster-depth-x');
        card.style.removeProperty('--poster-depth-y');
        card.style.removeProperty('--poster-tilt-x');
        card.style.removeProperty('--poster-tilt-y');
      }
    }
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
        if (hero) {
          for (const name of ['atmosphere', 'curtain', 'ripple']) {
            if (hero.querySelector('.poster-' + name)) continue;
            const layer = document.createElement('span');
            layer.className = 'poster-' + name;
            layer.setAttribute('aria-hidden', 'true');
            if (name === 'atmosphere') for (let i = 0; i < 4; i++) layer.append(document.createElement('i'));
            hero.prepend(layer);
          }
        }
        observer.observe(card);
      }
      card.querySelectorAll(selectors).forEach((element, index) => {
        if (parts.has(element)) return;
        parts.set(element, {
          key: `${card.id}:${card.dataset.mid}:${element.className}:${element.closest('.poster-report-team')?.getAttribute('aria-label') || ''}:${element.matches('.dash-form-item') ? [...element.parentElement.children].indexOf(element) : ''}`,
          visible: false,
          delay: element.matches('.dash-form-item') ? [...element.parentElement.children].indexOf(element) * 95 : Math.min(index, 5) * 85
        });
        if (!element.matches('.poster-curtain')) observer.observe(element);
      });
    });
    sync();
  }
  function scheduleDepth() {
    if (!enabled() || depthFrame) return;
    depthFrame = requestAnimationFrame(() => {
      depthFrame = 0;
      if (!enabled()) return;
      for (const [card, visible] of cards) {
        if (!visible) continue;
        const hero = card.querySelector('.poster-hero');
        const rect = hero?.getBoundingClientRect();
        if (!rect) continue;
        const progress = Math.max(-1, Math.min(1, (innerHeight * .45 - rect.top - rect.height / 2) / (innerHeight * .55)));
        card.style.setProperty('--poster-depth-y', `${progress * 35}px`);
      }
    });
  }
  document.addEventListener('scroll', scheduleDepth, { capture: true, passive: true });
  window.addEventListener('resize', scheduleDepth, { passive: true });
  let pointerFrame = 0;
  let pointer = null;
  container.addEventListener('pointermove', event => {
    if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
    const hero = event.target.closest('.poster-hero');
    if (!hero) return;
    pointer = { hero, x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!pointer || !enabled()) return;
      const { hero, x, y } = pointer;
      const rect = hero.getBoundingClientRect();
      const card = hero.closest('.poster-card');
      const dx = (x - rect.left) / rect.width - .5;
      const dy = (y - rect.top) / rect.height - .5;
      card.style.setProperty('--poster-tilt-x', `${-dy * 7}deg`);
      card.style.setProperty('--poster-tilt-y', `${dx * 7}deg`);
      card.style.setProperty('--poster-depth-x', `${dx * 32}px`);
    });
  }, { passive: true });
  container.addEventListener('pointerout', event => {
    const hero = event.target.closest('.poster-hero');
    if (!hero || hero.contains(event.relatedTarget)) return;
    pointer = null;
    const card = hero.closest('.poster-card');
    card.style.removeProperty('--poster-tilt-x');
    card.style.removeProperty('--poster-tilt-y');
    card.style.removeProperty('--poster-depth-x');
  });
  container.addEventListener('pointerdown', event => {
    if (!enabled()) return;
    const hero = event.target.closest('.poster-hero');
    const ripple = hero?.querySelector('.poster-ripple');
    if (!ripple) return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--poster-touch-x', `${event.clientX - rect.left}px`);
    hero.style.setProperty('--poster-touch-y', `${event.clientY - rect.top}px`);
    for (const animation of ripple.getAnimations()) animation.cancel();
    const animation = ripple.animate([
      { opacity: .9, transform: 'translate(-50%,-50%) scale(.1)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(4)' }
    ], { duration: 650, easing: 'cubic-bezier(.1,.6,.2,1)' });
    entrances.add(animation);
    animation.onfinish = animation.oncancel = () => entrances.delete(animation);
  }, { passive: true });
  function scheduleRefresh() { if (!frame) frame = requestAnimationFrame(refresh); }
  new MutationObserver(scheduleRefresh).observe(container, { childList: true, subtree: true });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-dashboard-startup-reveal'] });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  refresh();
})();
