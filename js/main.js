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

  // hero stats — render statically (no count-up gimmick)
  document.querySelectorAll('.hero-facts .num').forEach(el => {
    el.textContent = el.dataset.count || el.textContent;
  });

  // footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
