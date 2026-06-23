/* =================================================================
   Square-wave eclipse — UPK 13-c2, a candidate disk-eclipsing binary.
   A misaligned circumbinary disk has a localized (eccentric) occulting
   edge. The binary orbits the common centre of mass; only the wider-
   orbit component swings far enough to pass behind that edge, so just
   ONE star is occulted per cycle (P = 36.71 d). It contributes ~40% of
   the light, so the floor sits near 60% — the companion stays visible.

   The slow, multi-day ingress is the key diagnostic: an extended star
   gives a sloped trapezoid; a point-like white dwarf would give near-
   vertical walls. Toggle the occulted source to compare.
   ================================================================= */
(function () {
  const canvas = document.getElementById('diskCanvas');
  const lc = document.getElementById('diskLc');
  if (!canvas || !lc) return;
  const ctx = canvas.getContext('2d');
  const lctx = lc.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elPhase = document.getElementById('diskPhase');
  const elDays  = document.getElementById('diskDays');
  const elFlux  = document.getElementById('diskFlux');
  const elSpeed = document.getElementById('diskSpeed');
  const elToggle= document.getElementById('diskToggle');
  const elPause = document.getElementById('diskPause');
  const elIncl  = document.getElementById('diskIncl');
  const elDepth = document.getElementById('diskDepth');
  const elIv    = document.getElementById('diskIv');

  const DD = window.DISK_DATA || null;                     // real folded ZTF data (js/diskdata.js)
  const P_DAYS = DD ? DD.period_days : 36.71;
  const EDGES  = DD ? DD.model_edges : [0.34, 0.42, 0.66, 0.70];  // fitted ingress/egress phases
  const DEPTH  = DD ? DD.bands.g.depth : 0.40;             // fractional flux drop (~0.40) at edge-on
  const MID    = DD ? DD.mid_phase : 0.52;
  let phase = 0, speed = 1, paused = false, extended = true;
  let iv = (elIncl ? +elIncl.value : 82) * Math.PI / 180;  // viewing angle (90°=edge-on)
  let W = 0, H = 0, LW = 0, LH = 0;
  let visible = true, raf = 0, timer = 0, last = 0;

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    LW = lc.clientWidth; LH = lc.clientHeight;
    lc.width = LW * dpr; lc.height = LH * dpr; lctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function isVisible() {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }

  // normalised dip shape (0 outside eclipse … 1 at mid-eclipse) from the fitted
  // trapezoid; a point-like WD compresses ingress/egress to near-vertical walls.
  function dip(ph, narrow) {
    let [p1, p2, p3, p4] = EDGES;
    if (narrow) { const w = 0.006; p1 = p2 - w; p4 = p3 + w; }
    ph = ((ph % 1) + 1) % 1;
    if (ph <= p1 || ph >= p4) return 0;
    if (ph < p2)  return (ph - p1) / (p2 - p1);
    if (ph <= p3) return 1;
    return (p4 - ph) / (p4 - p3);
  }
  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // a circumbinary disk only occults when viewed near edge-on; the eclipse depth
  // falls off as the system is tilted toward face-on (schematic angle dependence).
  function depthScale() { return smoothstep(52 * Math.PI / 180, 80 * Math.PI / 180, iv); }
  const refFlux   = ph => 1 - DEPTH * dip(ph, false);                  // the observed data (edge-on)
  const modelFlux = ph => 1 - DEPTH * depthScale() * dip(ph, !extended); // current viewing angle + source
  const cover1    = ph => depthScale() * dip(ph, !extended);           // fraction of the star covered

  // ---- scene ----
  function geom() {
    const R = Math.min(W, H), cx = W * 0.42, cy = H * 0.5;
    const sq = Math.max(0.05, Math.cos(iv));         // vertical squash set by the viewing angle
    const a1 = R * 0.20, a2 = R * 0.11;              // orbital radii: occulted (wide) + companion
    const rin = R * 0.30, rout = R * 0.50;           // disk cavity holds the binary; ring outside
    const clump = { x: cx - a1, y: cy, r: R * 0.05 };// localized warped inner-edge occulter
    return { R, cx, cy, sq, a1, a2, rin, rout, clump };
  }
  function orbit(cx, cy, a, sq, theta) {
    return { x: cx + a * Math.cos(theta), y: cy + a * sq * Math.sin(theta) };
  }

  function drawDisk(g) {
    const { cx, cy, sq, rin, rout } = g;
    const rxO = rout, ryO = rxO * sq, rxI = rin, ryI = rxI * sq;
    // dusty annulus (even-odd fill: outer minus inner)
    ctx.save();
    const grd = ctx.createRadialGradient(cx, cy, rxI, cx, cy, rxO);
    grd.addColorStop(0, 'rgba(70,55,40,.0)');
    grd.addColorStop(0.15, 'rgba(86,66,46,.55)');
    grd.addColorStop(0.6, 'rgba(58,46,36,.7)');
    grd.addColorStop(1, 'rgba(30,24,20,.15)');
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxO, ryO, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, rxI, ryI, 0, 0, Math.PI * 2, true);
    ctx.fillStyle = grd; ctx.fill('evenodd');
    // concentric ring texture
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, rx = rxI + (rxO - rxI) * t;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * sq, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,120,90,.10)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }
  function drawFrontRim(g) {
    // the near (front, lower) half of the disk ring, drawn on top for depth
    const { cx, cy, sq, rin, rout } = g;
    const rxO = rout, ryO = rxO * sq, rxI = rin, ryI = rxI * sq;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxO, ryO, 0, 0, Math.PI, false);     // outer lower arc
    ctx.ellipse(cx, cy, rxI, ryI, 0, Math.PI, 0, true);      // inner lower arc back
    ctx.closePath();
    const grd = ctx.createLinearGradient(0, cy, 0, cy + ryO);
    grd.addColorStop(0, 'rgba(40,31,24,.85)'); grd.addColorStop(1, 'rgba(20,15,12,.95)');
    ctx.fillStyle = grd; ctx.fill();
    ctx.restore();
  }
  function drawClump(g, glow) {
    const c = g.clump;
    if (glow) {
      const gg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 2.6);
      gg.addColorStop(0, 'rgba(120,95,70,.5)'); gg.addColorStop(1, 'rgba(60,46,34,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 2.6, 0, 7); ctx.fill();
    }
    const core = ctx.createRadialGradient(c.x - c.r*0.3, c.y - c.r*0.3, 1, c.x, c.y, c.r);
    core.addColorStop(0, 'rgba(70,54,40,1)'); core.addColorStop(1, 'rgba(22,16,12,1)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
  }
  function drawStar(x, y, r, inner, outer, alpha) {
    ctx.globalAlpha = 0.55 * alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 7); ctx.fill();
    ctx.globalAlpha = alpha;
    const c = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.2, x, y, r);
    c.addColorStop(0, inner); c.addColorStop(1, outer);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    const g = geom();
    const R = g.R;
    const th1 = phase * 2 * Math.PI;             // occulted star (wide orbit)
    const th2 = th1 + Math.PI;                   // companion (opposite phase, tighter orbit)
    const s1 = orbit(g.cx, g.cy, g.a1, g.sq, th1);
    const s2 = orbit(g.cx, g.cy, g.a2, g.sq, th2);
    const r1 = extended ? R * 0.045 : Math.max(2, R * 0.008);
    const r2 = R * 0.05;
    const cov = cover1(phase), ds = depthScale();

    drawDisk(g);                                 // tilted ring — opens/closes with the viewing angle
    drawClump(g, true);                          // dust glow (behind stars)

    // faint orbit guides (squashed by the viewing angle)
    ctx.strokeStyle = 'rgba(120,140,200,.10)'; ctx.lineWidth = 1; ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.a1, g.a1*g.sq, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.a2, g.a2*g.sq, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);

    // stars — draw the farther one first (depth z = sin i · sin θ)
    const z1 = Math.sin(iv) * Math.sin(th1), z2 = Math.sin(iv) * Math.sin(th2);
    const drawS1 = () => {
      if (extended) drawStar(s1.x, s1.y, r1, '#ffb482', '#a83c10', 1 - 0.92 * cov);
      else { ctx.globalAlpha = 1 - 0.95 * cov; drawStar(s1.x, s1.y, r1, '#eafcff', '#7fbfd0', 1); ctx.globalAlpha = 1; }
    };
    const drawS2 = () => drawStar(s2.x, s2.y, r2, '#ffd29a', '#c8631a', 1);
    if (z1 < z2) { drawS1(); drawS2(); } else { drawS2(); drawS1(); }

    drawClump(g, false);                         // localized occulter, on top of the wide-orbit star
    drawFrontRim(g);                             // near edge of the ring (3-D depth cue)

    if (!extended) {
      ctx.fillStyle = 'rgba(170,182,212,.85)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('occulted source = white dwarf (point-like)', g.cx, g.cy - R*0.34);
    }
    ctx.fillStyle = 'rgba(170,182,212,.7)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ to observer', g.cx, H - 24);
    ctx.fillText('viewing angle  i = ' + Math.round(iv*180/Math.PI) + '°' + (ds < 0.04 ? '  (near face-on — no eclipse)' : ''), g.cx, 20);

    elPhase.textContent = phase.toFixed(2);
    elDays.textContent = (phase * P_DAYS).toFixed(1) + ' d';
    elFlux.textContent = Math.round(modelFlux(phase) * 100) + '%';
    if (elDepth) elDepth.textContent = Math.round(DEPTH * ds * 100) + '%';
    if (elIv) elIv.textContent = Math.round(iv*180/Math.PI) + '°';
  }

  // ---- light curve: real folded ZTF data + fitted trapezoid + current model ----
  function drawLC() {
    lctx.clearRect(0, 0, LW, LH);
    const x0 = 22, x1 = LW - 6, y0 = LH - 14, y1 = 8;
    const lo = 1 - DEPTH - 0.12, hi = 1.07;
    const Y = f => y0 - (y0 - y1) * (Math.max(lo, Math.min(hi, f)) - lo) / (hi - lo);
    // grid + baseline
    lctx.strokeStyle = 'rgba(255,255,255,.07)'; lctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) { const gx = x0 + (x1-x0)*g/4;
      lctx.beginPath(); lctx.moveTo(gx, y1); lctx.lineTo(gx, y0); lctx.stroke(); }
    lctx.strokeStyle = 'rgba(255,255,255,.12)';
    lctx.beginPath(); lctx.moveTo(x0, y0); lctx.lineTo(x1, y0); lctx.stroke();
    // flux axis ticks (1.0 and floor)
    lctx.fillStyle = 'rgba(170,182,212,.6)'; lctx.font = '9px sans-serif'; lctx.textAlign = 'right';
    lctx.fillText('1.0', x0 - 3, Y(1.0) + 3);
    lctx.fillText((1 - DEPTH).toFixed(1), x0 - 3, Y(1 - DEPTH) + 3);
    // real folded ZTF points (g green, r vermillion)
    function pts(arr, col) {
      if (!arr) return; lctx.fillStyle = col;
      for (const p of arr) { const X = x0+(x1-x0)*p[0], YY = Y(p[1]);
        lctx.beginPath(); lctx.arc(X, YY, 1.7, 0, 7); lctx.fill(); }
    }
    if (DD) { pts(DD.bands.r && DD.bands.r.points, 'rgba(213,94,0,.85)');
              pts(DD.bands.g && DD.bands.g.points, 'rgba(0,158,115,.95)'); }
    // fitted trapezoid (dashed) — what the data say
    lctx.setLineDash([4,4]); lctx.strokeStyle = 'rgba(220,228,255,.75)'; lctx.lineWidth = 1.4;
    lctx.beginPath();
    for (let i = 0; i <= 200; i++) { const ph = i/200, X = x0+(x1-x0)*ph;
      i ? lctx.lineTo(X, Y(refFlux(ph))) : lctx.moveTo(X, Y(refFlux(ph))); }
    lctx.stroke(); lctx.setLineDash([]);
    // current model (solid) — diverges from the fit only when WD is selected
    lctx.strokeStyle = extended ? '#4fd0e3' : '#e69f00'; lctx.lineWidth = 2; lctx.beginPath();
    for (let i = 0; i <= 200; i++) { const ph = i/200, X = x0+(x1-x0)*ph;
      i ? lctx.lineTo(X, Y(modelFlux(ph))) : lctx.moveTo(X, Y(modelFlux(ph))); }
    lctx.stroke();
    const mX = x0+(x1-x0)*(phase%1);
    lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.arc(mX, Y(modelFlux(phase)), 4, 0, 7); lctx.fill();
    lctx.fillStyle = 'rgba(170,182,212,.7)'; lctx.font = '10px sans-serif';
    lctx.textAlign='left'; lctx.fillText('0', x0, LH-3);
    lctx.textAlign='center'; lctx.fillText(DD ? 'ZTF g/r folded · P = 36.711 d' : 'phase', (x0+x1)/2, LH-3);
    lctx.textAlign='right'; lctx.fillText('phase 1', x1, LH-3);
  }

  function canAnimate() {
    return !reduce && !paused && speed > 0 && visible && !document.hidden;
  }
  function render() {
    drawScene(); drawLC();
  }
  function loop(now) {
    raf = 0;
    if (canAnimate()) {
      const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      phase = (phase + 0.0011 * speed * dt) % 1;
    }
    drawScene(); drawLC();
    start();
  }
  function start() {
    if (!canAnimate() || raf || timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(loop);
    }, FRAME_MS);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = 0;
    timer = 0;
    last = 0;
  }

  elSpeed.addEventListener('input', () => { speed = +elSpeed.value; render(); start(); });
  if (elIncl) elIncl.addEventListener('input', () => { iv = +elIncl.value * Math.PI / 180; render(); start(); });
  elToggle.addEventListener('click', () => {
    extended = !extended;
    elToggle.textContent = 'Occulted source: ' + (extended ? 'M/K dwarf' : 'white dwarf');
    elToggle.setAttribute('aria-pressed', String(!extended));
    render(); start();
  });
  elPause.addEventListener('click', () => {
    paused = !paused; elPause.textContent = paused ? 'Play' : 'Pause';
    elPause.setAttribute('aria-pressed', String(paused));
    if (paused) { stop(); render(); } else { start(); }
  });

  resize();
  visible = isVisible();
  render();
  window.addEventListener('resize', () => { resize(); visible = isVisible(); render(); start(); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.05 });
    io.observe(canvas);
  }
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
})();
