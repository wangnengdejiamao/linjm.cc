/* Navigation, scroll state, count-up stats, footer year. */
(function () {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const links = document.querySelector('.nav-links');

  // sticky-nav border on scroll
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      links.classList.remove('open'); toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // count-up hero stats
  const nums = document.querySelectorAll('.hero-facts .num');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setFinal = el => { el.textContent = el.dataset.count || el.textContent; };
  if (reduce || !('IntersectionObserver' in window)) {
    nums.forEach(setFinal);
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target, target = +el.dataset.count; let v = 0;
        const step = Math.max(1, Math.round(target / 28));
        const tick = () => {
          v = Math.min(target, v + step);
          el.textContent = v;
          if (v < target) requestAnimationFrame(tick);
        };
        tick(); io.unobserve(el);
      });
    }, { threshold: 0.6 });
    nums.forEach(n => io.observe(n));
  }

  // footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
