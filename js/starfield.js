/* Subtle parallax starfield drawn on a fixed full-screen canvas. */
(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  let stars = [], w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let raf = 0, timer = 0, last = 0;

  function resize() {
    w = canvas.clientWidth = window.innerWidth;
    h = canvas.clientHeight = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 9000);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,          // depth -> size & speed
      tw: Math.random() * Math.PI * 2,        // twinkle phase
      tws: Math.random() * 0.02 + 0.004
    }));
  }

  function draw(animate, dt) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (animate) s.tw += s.tws * dt;
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(s.tw));
      const r = s.z * 1.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${190 + s.z * 40},${210 + s.z * 30},255,${a * s.z})`;
      ctx.fill();
      if (animate) { s.y += s.z * 0.08 * dt; if (s.y > h) s.y = 0; }
    }
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
    last = now;
    draw(true, dt);
    start();
  }

  function start() {
    if (reduce || document.hidden || raf || timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(frame);
    }, FRAME_MS);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = 0;
    timer = 0;
    last = 0;
  }

  resize();
  draw(false, 1);
  window.addEventListener('resize', () => { resize(); draw(false, 1); start(); });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
})();
