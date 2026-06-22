/* Hero figure: a stylised magnetized white dwarf with a rotating dipole
   field and an accretion stream curling onto the pole. Decorative. */
(function () {
  const canvas = document.getElementById('heroOrbit');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  let w, h, dpr = Math.min(window.devicePixelRatio || 1, 2), t = 0;
  let visible = true, raf = 0, timer = 0, last = 0;

  function resize() {
    const s = canvas.clientWidth;
    w = h = s;
    canvas.width = canvas.height = s * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function dipoleLine(cx, cy, R, L, ang, sign) {
    // simple dipole-ish loop rotated by `ang`
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const th = (i / 40) * Math.PI;             // 0..pi
      const r = R + L * Math.sin(th);
      const lx = sign * r * Math.sin(th);
      const ly = -Math.cos(th) * (R + L);
      const x = cx + lx * Math.cos(ang) - ly * Math.sin(ang);
      const y = cy + lx * Math.sin(ang) + ly * Math.cos(ang);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  function isVisible() {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }

  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.52, cy = h * 0.5, R = w * 0.12;
    const spin = (t * 0.6) % (Math.PI * 2);

    // field lines
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 5; k++) {
      const L = R * (0.5 + k * 0.55);
      const a = 0.16 - k * 0.02;
      ctx.strokeStyle = `rgba(120,150,220,${a})`;
      dipoleLine(cx, cy, R, L, spin, 1);
      dipoleLine(cx, cy, R, L, spin, -1);
    }

    // white dwarf glow
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.5);
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(0.5, '#4fd0e3');
    g.addColorStop(1, 'rgba(10,79,92,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#dff7fc';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

    // accretion hot spots at the (rotating) magnetic poles
    for (const sgn of [1, -1]) {
      const px = cx + sgn * Math.sin(spin) * R;
      const py = cy - sgn * Math.cos(spin) * R;
      const hot = ctx.createRadialGradient(px, py, 0, px, py, R * 0.5);
      hot.addColorStop(0, 'rgba(230,159,0,.9)');
      hot.addColorStop(1, 'rgba(213,94,0,0)');
      ctx.fillStyle = hot;
      ctx.beginPath(); ctx.arc(px, py, R * 0.5, 0, 7); ctx.fill();
    }

    // incoming accretion stream from upper-right donor
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(230,159,0,.55)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i <= 60; i++) {
      const f = i / 60;
      const ang = -0.55 + f * 2.0;                 // fixed donor->WD arc
      const rr = w * 0.46 * (1 - f) + R * 1.05 * f;
      const x = cx + Math.cos(ang) * rr;
      const y = cy - Math.sin(ang) * rr * 0.8 - w * 0.02 * (1 - f);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();

    // gas blobs travelling along the stream
    if (!reduce) {
      for (let b = 0; b < 4; b++) {
        const f = ((t * 0.35 + b / 4) % 1);
        const ang = -0.55 + f * 2.0;
        const rr = w * 0.46 * (1 - f) + R * 1.05 * f;
        const x = cx + Math.cos(ang) * rr;
        const y = cy - Math.sin(ang) * rr * 0.8 - w * 0.02 * (1 - f);
        ctx.fillStyle = `rgba(255,210,140,${0.85 - f * 0.4})`;
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
      }
    }

    if (!reduce && visible && !document.hidden) {
      const dt = now && last ? Math.min(2.5, (now - last) / 16.67) : 1;
      if (now) last = now;
      t += 0.016 * dt;
      start();
    } else {
      raf = 0;
    }
  }

  function start() {
    if (reduce || !visible || document.hidden || raf || timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame((now) => {
        raf = 0;
        frame(now);
      });
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
  visible = isVisible();
  window.addEventListener('resize', () => {
    resize();
    visible = isVisible();
    if (reduce || !visible || document.hidden) frame(); else start();
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.05 });
    io.observe(canvas);
  }
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  if (reduce) frame(); else start();
})();
