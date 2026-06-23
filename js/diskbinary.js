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
  const elAlpha = document.getElementById('diskAlpha');
  const elDepth = document.getElementById('diskDepth');
  const elIv    = document.getElementById('diskIv');
  const elAlphaR= document.getElementById('diskAlphaR');
  const elRin   = document.getElementById('diskRin');

  const DD = window.DISK_DATA || null;                     // real folded ZTF data (js/diskdata.js)
  const P_DAYS = DD ? DD.period_days : 36.71;
  const EDGES  = DD ? DD.model_edges : [0.34, 0.42, 0.66, 0.70];  // fitted ingress/egress phases
  const DEPTH  = DD ? DD.bands.g.depth : 0.40;             // fractional flux drop (~0.40) at edge-on
  const MID    = DD ? DD.mid_phase : 0.52;
  // From Lin et al. (UPK 13-c2): a≈0.24 AU≈52 R_sun (Kepler, M_tot≈1.4 M_sun, P=36.71 d);
  // tidal truncation (Artymowicz & Lubow 1994) sets the inner edge at R_in≈2–3 a.
  const RIN_OVER_A = 2.5, A_RSUN = 52, RIN_RSUN = Math.round(RIN_OVER_A * A_RSUN); // ≈130 R_sun
  const ALPHA0 = 13 * Math.PI / 180;                      // adopted misalignment (sets observed ingress)
  let phase = 0, speed = 1, paused = false, extended = true;
  let iv = (elIncl ? +elIncl.value : 82) * Math.PI / 180;  // viewing inclination (90°=edge-on)
  let alphaMis = (elAlpha ? +elAlpha.value : 13) * Math.PI / 180; // disk tilt vs binary orbit
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

  // grazing geometry (Lin+ UPK 13-c2): the perpendicular crossing speed is
  // v_perp = v_orb·sin α, so the ingress duration scales as 1/sin α — a smaller
  // disk misalignment gives the slow, multi-day ingress that rules out a WD.
  function ingressK() { return Math.sin(ALPHA0) / Math.max(0.05, Math.sin(alphaMis)); }
  // normalised dip (0…1). narrow = point-like WD; k scales the ingress/egress slope.
  function dipK(ph, narrow, k) {
    const p2 = EDGES[1], p3 = EDGES[2];
    let p1, p4;
    if (narrow) { const w = 0.006; p1 = p2 - w; p4 = p3 + w; }
    else { p1 = Math.max(0, p2 - (EDGES[1] - EDGES[0]) * k); p4 = Math.min(1, p3 + (EDGES[3] - EDGES[2]) * k); }
    ph = ((ph % 1) + 1) % 1;
    if (ph <= p1 || ph >= p4) return 0;
    if (ph < p2)  return (ph - p1) / (p2 - p1);
    if (ph <= p3) return 1;
    return (p4 - ph) / (p4 - p3);
  }
  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // the circumbinary disk only occults near edge-on; depth falls off toward face-on.
  function depthScale() { return smoothstep(52 * Math.PI / 180, 80 * Math.PI / 180, iv); }
  const refFlux   = ph => 1 - DEPTH * dipK(ph, false, 1);                                  // observed fit (α≈13°)
  const modelFlux = ph => 1 - DEPTH * depthScale() * dipK(ph, !extended, extended ? ingressK() : 1);
  const cover1    = ph => depthScale() * dipK(ph, !extended, extended ? ingressK() : 1);   // fraction covered

  // ---- scene ----
  function geom() {
    const R = Math.min(W, H), cx = W * 0.44, cy = H * 0.5;
    const sq = Math.max(0.05, Math.cos(iv));         // vertical squash set by the viewing angle
    const a1 = R * 0.085, a2 = R * 0.06;             // tight binary: orbital radii about the COM
    const a  = a1 + a2;                              // binary semi-major axis
    const rin = RIN_OVER_A * a, rout = rin * 1.5;    // tidally-truncated inner edge ≈ 2.5 a
    const clump = { x: cx - a1, y: cy, r: R * 0.05 };// localized misaligned inner-edge occulter
    return { R, cx, cy, sq, a1, a2, a, rin, rout, alpha: alphaMis, clump };
  }
  function orbit(cx, cy, a, sq, theta) {
    return { x: cx + a * Math.cos(theta), y: cy + a * sq * Math.sin(theta) };
  }

  function drawDisk(g) {
    const { cx, cy, sq, rin, rout } = g, rot = g.alpha; // ring tilted by the misalignment
    const rxO = rout, ryO = rxO * sq, rxI = rin, ryI = rxI * sq;
    // dusty annulus (even-odd fill: outer minus inner)
    ctx.save();
    const grd = ctx.createRadialGradient(cx, cy, rxI, cx, cy, rxO);
    grd.addColorStop(0, 'rgba(70,55,40,.0)');
    grd.addColorStop(0.15, 'rgba(86,66,46,.55)');
    grd.addColorStop(0.6, 'rgba(58,46,36,.7)');
    grd.addColorStop(1, 'rgba(30,24,20,.15)');
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxO, ryO, rot, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, rxI, ryI, rot, 0, Math.PI * 2, true);
    ctx.fillStyle = grd; ctx.fill('evenodd');
    // concentric ring texture
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, rx = rxI + (rxO - rxI) * t;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * sq, rot, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,120,90,.10)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // bright inner rim (the tidally truncated edge)
    ctx.beginPath(); ctx.ellipse(cx, cy, rxI, ryI, rot, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(190,150,110,.28)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  function drawFrontRim(g) {
    // the near (front, lower) half of the disk ring, drawn on top for depth
    const { cx, cy, sq, rin, rout } = g, rot = g.alpha;
    const rxO = rout, ryO = rxO * sq, rxI = rin, ryI = rxI * sq;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxO, ryO, rot, 0, Math.PI, false);   // outer lower arc
    ctx.ellipse(cx, cy, rxI, ryI, rot, Math.PI, 0, true);    // inner lower arc back
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

  // the disk's sharp (knife-edge) near edge advancing across the wide star:
  // cov=0 → edge tangent to the star; cov=1 → star fully behind the disk.
  function drawOcculter(s1, r1, cov, g) {
    if (cov <= 0.003) return;
    const Rocc = g.R * 0.42;                          // large curvature → a sharp, near-straight edge
    const dir = Math.PI / 2 + g.alpha;                // edge advances from the disk side (tilted by α)
    const ux = Math.cos(dir), uy = Math.sin(dir);
    const reach = r1 * 1.25;                          // covers the stellar disk (+ a little glow)
    const D = Rocc + reach - cov * (2 * reach);       // cov 0: tangent · cov 1: fully covering
    const ox = s1.x + ux * D, oy = s1.y + uy * D;
    ctx.save();
    ctx.beginPath(); ctx.arc(s1.x, s1.y, reach, 0, 7); ctx.clip();      // occult ONLY this star
    ctx.fillStyle = '#241a11';                        // opaque dark disk material (knife edge)
    ctx.beginPath(); ctx.arc(ox, oy, Rocc, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(210,170,120,.85)';     // bright dust along the sharp edge
    ctx.beginPath(); ctx.arc(ox, oy, Rocc, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    const g = geom();
    const R = g.R;
    const th1 = phase * 2 * Math.PI;             // occulted star (wide orbit)
    const th2 = th1 + Math.PI;                   // companion (opposite phase, tighter orbit)
    const s1 = orbit(g.cx, g.cy, g.a1, g.sq, th1);
    const s2 = orbit(g.cx, g.cy, g.a2, g.sq, th2);
    const r1 = extended ? R * 0.05 : Math.max(2.5, R * 0.012);
    const r2 = R * 0.052;
    const cov = cover1(phase), ds = depthScale();

    drawDisk(g);                                 // tilted ring; opens/closes with the viewing angle

    // faint orbit guides (binary plane)
    ctx.strokeStyle = 'rgba(120,140,200,.10)'; ctx.lineWidth = 1; ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.a1, g.a1*g.sq, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.a2, g.a2*g.sq, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);

    // companion (always visible, ~60% of the light)
    drawStar(s2.x, s2.y, r2, '#ffd9a8', '#c8631a', 1);
    // occulted star at full brightness — the advancing disk edge does the dimming
    drawStar(s1.x, s1.y, r1, extended ? '#ffd0a0' : '#eafcff', extended ? '#b8551a' : '#7fbfd0', 1);
    drawOcculter(s1, r1, cov, g);                // sharp disk edge sweeps across it
    drawFrontRim(g);                             // near edge of the ring (3-D depth cue)

    if (cov > 0.25) {
      ctx.fillStyle = 'rgba(255,190,130,.95)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('occulted by disk edge', s1.x, s1.y - r1 - 10);
    }
    if (!extended) {
      ctx.fillStyle = 'rgba(170,182,212,.85)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('occulted source = white dwarf (point-like)', g.cx, g.cy - R*0.34);
    }
    ctx.fillStyle = 'rgba(170,182,212,.7)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ to observer', g.cx, H - 24);
    ctx.fillText('binary i = ' + Math.round(iv*180/Math.PI) + '°,  disk α = ' + Math.round(alphaMis*180/Math.PI) + '°'
      + (ds < 0.04 ? '  (face-on — no eclipse)' : ''), g.cx, 20);

    elPhase.textContent = phase.toFixed(2);
    if (elDays) elDays.textContent = (phase * P_DAYS).toFixed(1) + ' d';
    elFlux.textContent = Math.round(modelFlux(phase) * 100) + '%';
    if (elDepth) elDepth.textContent = Math.round(DEPTH * ds * 100) + '%';
    if (elIv) elIv.textContent = Math.round(iv*180/Math.PI) + '°';
    if (elAlphaR) elAlphaR.textContent = Math.round(alphaMis*180/Math.PI) + '°';
    if (elRin) elRin.textContent = '≈' + RIN_OVER_A + ' a ≈ ' + RIN_RSUN + ' R⊙';
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
  if (elAlpha) elAlpha.addEventListener('input', () => { alphaMis = +elAlpha.value * Math.PI / 180; render(); start(); });
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
