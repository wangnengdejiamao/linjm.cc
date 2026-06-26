/* High-end interaction layer: scroll progress, staggered reveal-on-scroll,
   and scrollspy nav highlighting. Progressive enhancement — without JS the
   page renders fully (reveal classes are only added here). */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    ['.cyc-stage', 0], ['.spec-stage', 0],
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
