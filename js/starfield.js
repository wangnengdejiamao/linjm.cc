/* Subtle parallax starfield drawn on a fixed full-screen canvas. */
(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars = [], w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

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

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.tw += s.tws;
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(s.tw));
      const r = s.z * 1.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${190 + s.z * 40},${210 + s.z * 30},255,${a * s.z})`;
      ctx.fill();
      if (!reduce) { s.y += s.z * 0.08; if (s.y > h) s.y = 0; }
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  if (reduce) { frame(); } else { requestAnimationFrame(frame); }
})();
