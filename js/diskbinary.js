/* =================================================================
   Square-wave eclipse — UPK 13-c2, a candidate disk-eclipsing binary.
   A misaligned circumbinary dust disk sweeps a sharp edge across a
   late-K/early-M binary every P = 36.71 d, dimming it ~40% almost
   achromatically. The slow, multi-day ingress is the key diagnostic:
   an extended star gives a sloped trapezoid, while a point-like white
   dwarf would give near-vertical walls. Toggle the source to see it.

   Sharp-edge model: a dust band of width Wb sweeps at fixed speed V;
   each star's flux is reduced by the fraction of its diameter behind
   the band, so ingress slope ∝ stellar size.
   ================================================================= */
(function () {
  const canvas = document.getElementById('diskCanvas');
  const lc = document.getElementById('diskLc');
  if (!canvas || !lc) return;
  const ctx = canvas.getContext('2d');
  const lctx = lc.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elPhase = document.getElementById('diskPhase');
  const elDays  = document.getElementById('diskDays');
  const elFlux  = document.getElementById('diskFlux');
  const elSpeed = document.getElementById('diskSpeed');
  const elToggle= document.getElementById('diskToggle');
  const elPause = document.getElementById('diskPause');

  const P_DAYS = 36.71, DEPTH = 0.40, ING = 2.5 / 36.71;  // ingress as fraction of period
  let phase = 0, speed = 1, paused = false, extended = true;
  let W = 0, H = 0, LW = 0, LH = 0;

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    LW = lc.clientWidth; LH = lc.clientHeight;
    lc.width = LW * dpr; lc.height = LH * dpr; lctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ---- geometry shared by the scene and the flux model ----
  function geom() {
    const R = Math.min(W, H), cx = W * 0.42, cy = H * 0.5;
    const sep = R * 0.07, RK = R * 0.055, RM = R * 0.038;
    const Eref = 2 * sep + RK + RM;          // reference binary extent
    const V = Eref / ING;                    // band sweep speed (fixed; physical disk edge)
    const Wb = 3.7 * Eref;                   // band width (gives flat floor)
    const stars = extended
      ? [{ x: cx - sep, y: cy, r: RK, L: 1.0, c: '#ffd9a0' },
         { x: cx + sep, y: cy, r: RM, L: 0.42, c: '#ff9a6a' }]
      : [{ x: cx, y: cy, r: Math.max(2, R * 0.007), L: 1.0, c: '#eafcff' }];  // WD point
    return { R, cx, cy, V, Wb, stars };
  }

  function coverAndFlux(ph, g) {
    const xc = g.cx + (0.5 - ph) * g.V;       // band centre at this phase
    let num = 0, den = 0;
    const covs = g.stars.map(s => {
      const lo = Math.max(s.x - s.r, xc - g.Wb / 2);
      const hi = Math.min(s.x + s.r, xc + g.Wb / 2);
      const cov = Math.max(0, hi - lo) / (2 * s.r);
      num += s.L * Math.min(1, cov); den += s.L;
      return Math.min(1, cov);
    });
    return { xc, covs, flux: 1 - DEPTH * (num / den) };
  }
  // observed reference trapezoid = the extended-binary model
  function refFlux(ph) {
    const sav = extended; extended = true;
    const g = geom(); const f = coverAndFlux(ph, g).flux; extended = sav; return f;
  }

  // ---- scene ----
  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    const g = geom();
    const { xc, covs, flux } = coverAndFlux(phase, g);

    // misaligned circumbinary disk (context): a tilted, faint ellipse
    ctx.save();
    ctx.translate(g.cx, g.cy); ctx.rotate(-0.32);
    for (let k = 3; k >= 1; k--) {
      ctx.beginPath();
      ctx.ellipse(0, 0, g.R * 0.40 * (k/3), g.R * 0.085 * (k/3), 0, 0, 7);
      ctx.strokeStyle = `rgba(150,130,100,${0.10 + 0.05*k})`; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    // stars (dimmed by their coverage)
    for (let i = 0; i < g.stars.length; i++) {
      const s = g.stars[i], dim = 1 - 0.85 * covs[i];
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.4);
      glow.addColorStop(0, s.c); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55 * dim; ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.4, 0, 7); ctx.fill();
      ctx.globalAlpha = dim; ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (!extended) {
      ctx.fillStyle = 'rgba(170,182,212,.85)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('white dwarf (point-like)', g.cx, g.cy + g.R * 0.12);
    }

    // sweeping circumbinary dust band (optically thick lobe)
    const x0 = xc - g.Wb / 2, x1 = xc + g.Wb / 2;
    const band = ctx.createLinearGradient(x0, 0, x1, 0);
    band.addColorStop(0,    'rgba(40,30,22,0)');
    band.addColorStop(0.12, 'rgba(60,46,34,.92)');
    band.addColorStop(0.5,  'rgba(28,22,18,.97)');
    band.addColorStop(0.88, 'rgba(60,46,34,.92)');
    band.addColorStop(1,    'rgba(40,30,22,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x0, g.cy - g.R * 0.30, g.Wb, g.R * 0.60);
    // dust texture flecks
    ctx.fillStyle = 'rgba(120,95,70,.25)';
    for (let i = 0; i < 60; i++) {
      const fx = x0 + ((i * 53.7) % g.Wb);
      const fy = g.cy + (((i * 97.3) % (g.R * 0.6)) - g.R * 0.30);
      ctx.fillRect(fx, fy, 1.4, 1.4);
    }

    // observer arrow
    ctx.fillStyle = 'rgba(170,182,212,.7)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ to observer', g.cx, H - 26);

    elPhase.textContent = phase.toFixed(2);
    elDays.textContent = (phase * P_DAYS).toFixed(1) + ' d';
    elFlux.textContent = Math.round(flux * 100) + '%';
  }

  // ---- light curve ----
  function drawLC() {
    lctx.clearRect(0, 0, LW, LH);
    const x0 = 6, x1 = LW - 6, y0 = LH - 14, y1 = 8;
    const Y = f => y0 - (y0 - y1) * (f - (1 - DEPTH) + 0.06) / (DEPTH + 0.12);
    // grid
    lctx.strokeStyle = 'rgba(255,255,255,.07)'; lctx.lineWidth = 1;
    for (let gg = 0; gg <= 4; gg++) { const gx = x0 + (x1-x0)*gg/4;
      lctx.beginPath(); lctx.moveTo(gx, y1); lctx.lineTo(gx, y0); lctx.stroke(); }
    lctx.strokeStyle = 'rgba(255,255,255,.12)';
    lctx.beginPath(); lctx.moveTo(x0, y0); lctx.lineTo(x1, y0); lctx.stroke();
    // observed reference (dashed)
    lctx.setLineDash([4,4]); lctx.strokeStyle = 'rgba(170,182,212,.55)'; lctx.lineWidth = 1.4;
    lctx.beginPath();
    for (let i = 0; i <= 160; i++) { const ph = i/160; const X = x0+(x1-x0)*ph;
      i ? lctx.lineTo(X, Y(refFlux(ph))) : lctx.moveTo(X, Y(refFlux(ph))); }
    lctx.stroke(); lctx.setLineDash([]);
    // current model (solid)
    const g = geom();
    lctx.strokeStyle = extended ? '#4fd0e3' : '#e69f00'; lctx.lineWidth = 2;
    lctx.beginPath();
    for (let i = 0; i <= 160; i++) { const ph = i/160; const X = x0+(x1-x0)*ph;
      const f = coverAndFlux(ph, g).flux; i ? lctx.lineTo(X, Y(f)) : lctx.moveTo(X, Y(f)); }
    lctx.stroke();
    // marker
    const f0 = coverAndFlux(phase % 1, g).flux, mX = x0+(x1-x0)*(phase%1);
    lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.arc(mX, Y(f0), 4, 0, 7); lctx.fill();
    lctx.fillStyle = 'rgba(170,182,212,.7)'; lctx.font = '10px sans-serif';
    lctx.textAlign='left'; lctx.fillText('0', x0, LH-3);
    lctx.textAlign='right'; lctx.fillText('phase 1', x1, LH-3);
  }

  function loop() {
    if (!paused && !reduce) phase = (phase + 0.0011 * speed) % 1;
    drawScene(); drawLC();
    requestAnimationFrame(loop);
  }

  // ---- controls ----
  elSpeed.addEventListener('input', () => speed = +elSpeed.value);
  elToggle.addEventListener('click', () => {
    extended = !extended;
    elToggle.textContent = 'Occulted source: ' + (extended ? 'K+M binary' : 'white dwarf');
    elToggle.setAttribute('aria-pressed', String(!extended));
  });
  elPause.addEventListener('click', () => {
    paused = !paused; elPause.textContent = paused ? 'Play' : 'Pause';
    elPause.setAttribute('aria-pressed', String(paused));
  });

  resize();
  window.addEventListener('resize', resize);
  if (reduce) { drawScene(); drawLC(); } else { requestAnimationFrame(loop); }
})();
