/* Interaction layer: scroll progress, staggered reveal-on-scroll, scrollspy,
   and the live value + filled track on every slider. Progressive enhancement —
   without JS the page still renders fully. */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- sliders: filled track + a formatted readout in the label ---- */
  document.querySelectorAll('input[type=range]').forEach(r => {
    const ctl = r.closest('.ctl');
    const outEl = ctl && ctl.querySelector('output');
    const dp = +(r.dataset.dp || 0);
    const paint = () => {
      const min = +r.min, max = +r.max;
      const p = max > min ? ((+r.value - min) / (max - min)) * 100 : 0;
      r.style.setProperty('--p', p.toFixed(2) + '%');
      if (outEl) outEl.textContent = (r.dataset.prefix || '') + (+r.value).toFixed(dp) + (r.dataset.unit || '');
    };
    r.addEventListener('input', paint);
    paint();
  });

  /* ---- scroll progress bar ---- */
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- reveal-on-scroll (skip the hero so it shows instantly) ---- */
  const groups = [
    ['.section-head'],
    ['.cards .card', 80],
    ['.fig', 0], ['.cyc-stage', 0], ['.spec-stage', 0],
    ['.ag-cards .card', 70],
    ['.kg-block'],
    ['.pub', 50],
    ['.about-grid > *', 90],
    ['.cv-block'],
    ['.skill', 70],
  ];
  const revealEls = [];
  groups.forEach(([sel, stagger]) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (el.closest('.hero')) return;
      el.classList.add('reveal');
      if (stagger) el.style.transitionDelay = Math.min(i * stagger, 360) + 'ms';
      revealEls.push(el);
    });
  });

  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* ---- scrollspy: highlight the nav link for the section in view ---- */
  const links = [...document.querySelectorAll('.nav-links a')];
  const map = new Map();
  links.forEach(a => {
    const id = (a.getAttribute('href') || '').replace('#', '');
    const sec = id && document.getElementById(id);
    if (sec) map.set(sec, a);
  });
  if (map.size && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(l => l.classList.remove('active'));
        const a = map.get(e.target);
        if (a) a.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    map.forEach((_, sec) => spy.observe(sec));
  }
})();
