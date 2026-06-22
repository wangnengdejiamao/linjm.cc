/* =================================================================
   Cyclotron light-curve modelling — a polar (AM Her star).
   A polar is SYNCHRONOUS: the white-dwarf spin is locked to the orbit
   (P_spin = P_orb), so the WD and the M-dwarf donor co-revolve and the
   accreting magnetic pole always faces the donor. Cyclotron emission is
   beamed perpendicular to B; as the binary turns, the observed flux is
   modulated, giving the polar's characteristic light-curve morphologies.

   Per-pole flux (dipole beaming geometry):
     cosμ = cos i cos β + sin i sin β cos(2π(φ−φ0))
     F_pole(φ) ∝ sin²μ · visibility(cosμ)
   sin²μ      -> emission beams perpendicular to B
   visibility -> the spot is dimmed when it turns behind the WD limb
   Shapes: one broad hump; double-humped beaming (μ crosses 90° twice);
   two unequal humps (two poles); + an optional sharp donor eclipse.
   ================================================================= */
(function () {
  const canvas = document.getElementById('cycCanvas');
  const lc = document.getElementById('lcCanvas');
  if (!canvas || !lc) return;
  const ctx = canvas.getContext('2d');
  const lctx = lc.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elPhase = document.getElementById('cycPhase');
  const elGeom  = document.getElementById('cycGeom');
  const elPoles = document.getElementById('cycPoles');
  const elFlux  = document.getElementById('cycFlux');
  const elSpeed = document.getElementById('cycSpeed');
  const elInc   = document.getElementById('cycInc');
  const elBeta  = document.getElementById('cycBeta');
  const elTwoPole = document.getElementById('cycTwoPole');
  const elEclipse = document.getElementById('cycEclipse');
  const elPause = document.getElementById('cycPause');
  const chips   = document.querySelectorAll('[data-morph]');

  let inc = +elInc.value * Math.PI / 180;
  let beta = +elBeta.value * Math.PI / 180;
  let speed = +elSpeed.value;
  let twoPole = false, eclipse = false;
  let phase = 0, paused = false, W = 0, H = 0, LW = 0, LH = 0;
  let visible = true, raf = 0, timer = 0, last = 0;

  const DEG = x => Math.round(x * 180 / Math.PI);
  function smooth(a, b, x){ const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function clamp1(x){ return Math.max(-1, Math.min(1, x)); }

  function poleFlux(ph, i, b, ph0) {
    const cm = clamp1(Math.cos(i)*Math.cos(b) + Math.sin(i)*Math.sin(b)*Math.cos(2*Math.PI*(ph - ph0)));
    const beam = 1 - cm * cm;                 // sin²μ
    const vis = smooth(-0.35, 0.20, cm);      // self-eclipse behind the WD limb
    return beam * vis;
  }
  function eclipseFactor(ph) {                 // sharp total donor eclipse at φ=0
    const p = ((ph % 1) + 1) % 1, d = Math.min(p, 1 - p), w = 0.05, ramp = 0.012;
    if (d > w) return 1;
    if (d > w - ramp) return (w - d) / ramp;
    return 0;
  }
  function fluxAt(ph) {
    let F = poleFlux(ph, inc, beta, 0);
    if (twoPole) F += 0.45 * poleFlux(ph, inc, Math.PI - beta, 0.5);
    F = 0.08 + 0.92 * F;                       // small residual baseline (WD photosphere + companion)
    if (eclipse) F *= eclipseFactor(ph);
    return F;
  }

  let fMin = 0, fMax = 1;
  function renorm() {
    fMin = 1e9; fMax = -1e9;
    for (let i = 0; i <= 300; i++) { const f = fluxAt(i / 300); if (f < fMin) fMin = f; if (f > fMax) fMax = f; }
    if (fMax - fMin < 1e-3) fMax = fMin + 1e-3;
  }
  function norm(f){ return (f - fMin) / (fMax - fMin); }

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

  // ---- scene: a synchronously co-rotating binary ----
  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    const R = Math.min(W, H);
    const com = { x: W * 0.45, y: H * 0.5 };
    const a = phase * 2 * Math.PI;
    const Rwd = R * 0.085, Rdon = R * 0.075;
    const orbWD = R * 0.085, orbDon = R * 0.30;
    const sqi = 0.30 + 0.62 * Math.cos(inc);          // orbit squash conveys inclination
    const f1 = poleFlux(phase, inc, beta, 0);
    const f2 = twoPole ? poleFlux(phase, inc, Math.PI - beta, 0.5) : 0;
    const ecf = eclipse ? eclipseFactor(phase) : 1;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const wd  = { x: com.x - dir.x * orbWD,  y: com.y - dir.y * orbWD * sqi };
    const don = { x: com.x + dir.x * orbDon, y: com.y + dir.y * orbDon * sqi };
    const pa = Math.atan2(don.y - wd.y, don.x - wd.x);   // WD -> donor (screen)
    const pdir = { x: Math.cos(pa), y: Math.sin(pa) };
    const pole = { x: wd.x + pdir.x * Rwd, y: wd.y + pdir.y * Rwd };

    // orbit guides (inclination-squashed)
    ctx.strokeStyle = 'rgba(120,140,200,.12)'; ctx.lineWidth = 1; ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.ellipse(com.x, com.y, orbDon, orbDon*sqi, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(com.x, com.y, orbWD, orbWD*sqi, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);

    // accretion stream donor -> primary pole
    const perp = { x: -pdir.y, y: pdir.x };
    const mid = { x: (don.x + pole.x)/2 + perp.x * R*0.12, y: (don.y + pole.y)/2 + perp.y * R*0.12 };
    const grad = ctx.createLinearGradient(don.x, don.y, pole.x, pole.y);
    grad.addColorStop(0, 'rgba(230,159,0,.85)'); grad.addColorStop(1, 'rgba(255,210,120,.3)');
    ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(don.x - pdir.x*Rdon, don.y - pdir.y*Rdon);
    ctx.quadraticCurveTo(mid.x, mid.y, pole.x, pole.y);
    ctx.stroke();
    if (!reduce) {
      for (let i = 0; i < 5; i++) {
        const t = (phase * 1.5 + i / 5) % 1, it = 1 - t;
        const sx = don.x - pdir.x*Rdon, sy = don.y - pdir.y*Rdon;
        const x = it*it*sx + 2*it*t*mid.x + t*t*pole.x;
        const y = it*it*sy + 2*it*t*mid.y + t*t*pole.y;
        ctx.fillStyle = `rgba(255,205,120,${0.85 - t*0.45})`;
        ctx.beginPath(); ctx.arc(x, y, 2.6 - t*1.2, 0, 7); ctx.fill();
      }
    }

    // donor (M dwarf)
    starGlow(don.x, don.y, Rdon, '#ffd9b0', '#d55e00');

    // dipole field lines + magnetic axis, locked to the binary axis
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      const L = Rwd * (0.6 + k * 0.7);
      ctx.strokeStyle = `rgba(110,140,210,${0.22 - k*0.03})`;
      fieldLine(wd.x, wd.y, Rwd, L, pa, 1); fieldLine(wd.x, wd.y, Rwd, L, pa, -1);
    }
    ctx.strokeStyle = 'rgba(150,170,230,.25)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(wd.x - pdir.x*Rwd*2.4, wd.y - pdir.y*Rwd*2.4);
    ctx.lineTo(wd.x + pdir.x*Rwd*2.4, wd.y + pdir.y*Rwd*2.4);
    ctx.stroke(); ctx.setLineDash([]);

    // white dwarf
    starGlow(wd.x, wd.y, Rwd, '#eafcff', '#155a69', 1.6, '#dff7fc');

    // poles: primary (with accretion column) + optional secondary
    drawPole(wd, pa, Rwd, f1 * ecf, R, true);
    if (twoPole) drawPole(wd, pa + Math.PI, Rwd, f2 * ecf, R, false);
    if (!reduce) drawElectrons(pole, pa, f1 * ecf);

    // donor eclipse: blank out the WD + pole
    if (eclipse && ecf < 1) {
      ctx.fillStyle = `rgba(7,11,22,${(1 - ecf) * 0.92})`;
      ctx.beginPath(); ctx.arc(wd.x, wd.y, Rwd * 1.9, 0, 7); ctx.fill();
      if (ecf < 0.5) {
        ctx.fillStyle = 'rgba(255,180,120,.9)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('donor eclipse', wd.x, wd.y - Rwd * 2.3);
      }
    }

    ctx.fillStyle = 'rgba(170,182,212,.8)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ to observer', W*0.45, H - 26);
    ctx.fillText('P_spin = P_orb (synchronous)', W*0.45, 22);

    elPhase.textContent = phase.toFixed(2);
    elGeom.textContent = DEG(inc) + '° / ' + DEG(beta) + '°';
    elPoles.textContent = twoPole ? 'two' : 'one';
    elFlux.textContent = Math.round(norm(fluxAt(phase)) * 100) + '%';
  }

  function drawPole(wd, ang, Rwd, bright, R, withColumn) {
    const px = wd.x + Math.cos(ang)*Rwd, py = wd.y + Math.sin(ang)*Rwd;
    if (withColumn) {
      const tx = px + Math.cos(ang)*Rwd*0.7, ty = py + Math.sin(ang)*Rwd*0.7;
      const cg = ctx.createLinearGradient(px, py, tx, ty);
      cg.addColorStop(0, 'rgba(230,159,0,.9)'); cg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.strokeStyle = cg; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
    }
    const hot = ctx.createRadialGradient(px, py, 0, px, py, Rwd*0.55);
    hot.addColorStop(0, `rgba(255,${200+(bright*55|0)},150,${0.35+0.5*bright})`); hot.addColorStop(1, 'rgba(213,94,0,0)');
    ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(px, py, Rwd*0.55, 0, 7); ctx.fill();
    const reach = R * 0.42 * (0.35 + 0.65*bright);
    for (const s of [1, -1]) {
      const d0 = ang + s * Math.PI/2, spread = 0.42;
      const g = ctx.createRadialGradient(px, py, 0, px, py, reach);
      g.addColorStop(0, `rgba(79,208,227,${0.45*bright+0.04})`); g.addColorStop(1, 'rgba(79,208,227,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, py);
      ctx.arc(px, py, reach, d0 - spread, d0 + spread); ctx.closePath(); ctx.fill();
    }
  }
  function starGlow(x, y, r, inner, outer, gmul, core) {
    const m = gmul || 1.5;
    const g = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.2, x, y, r*m);
    g.addColorStop(0, inner); g.addColorStop(0.55, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r*m, 0, 7); ctx.fill();
    ctx.fillStyle = core || inner; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  function drawElectrons(pole, a, f) {
    ctx.strokeStyle = `rgba(180,240,255,${0.4+0.4*f})`; ctx.lineWidth = 1;
    const ox = Math.cos(a), oy = Math.sin(a);
    for (let i = 0; i < 3; i++) {
      const ph = a*3 + i*2.1, rr = 5 + i*3;
      ctx.beginPath();
      for (let j = 0; j <= 16; j++) {
        const ang = ph + j*0.5;
        const x = pole.x + Math.cos(ang)*rr*0.6 + ox*(j-8)*1.2;
        const y = pole.y + Math.sin(ang)*rr*0.6 + oy*(j-8)*1.2;
        j ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
      }
      ctx.stroke();
    }
  }
  function fieldLine(cx, cy, R0, L, ang, sign) {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const th = (i/36)*Math.PI;
      const r = R0 + L*Math.sin(th);
      const lx = -Math.cos(th)*(R0+L);
      const ly = sign*r*Math.sin(th)*0.7;
      const x = cx + lx*Math.cos(ang) - ly*Math.sin(ang);
      const y = cy + lx*Math.sin(ang) + ly*Math.cos(ang);
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    }
    ctx.stroke();
  }

  // ---- light curve ----
  function drawLC() {
    lctx.clearRect(0, 0, LW, LH);
    const x0 = 6, x1 = LW - 6, y0 = LH - 14, y1 = 8;
    lctx.strokeStyle = 'rgba(255,255,255,.08)'; lctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) { const gx = x0 + (x1-x0)*g/4;
      lctx.beginPath(); lctx.moveTo(gx, y1); lctx.lineTo(gx, y0); lctx.stroke(); }
    lctx.beginPath(); lctx.moveTo(x0, y0); lctx.lineTo(x1, y0); lctx.stroke();
    lctx.strokeStyle = '#4fd0e3'; lctx.lineWidth = 2; lctx.beginPath();
    const N = 160;
    for (let i = 0; i <= N; i++) { const ph = i/N, X = x0+(x1-x0)*ph, Y = y0-(y0-y1)*norm(fluxAt(ph));
      i ? lctx.lineTo(X, Y) : lctx.moveTo(X, Y); }
    lctx.stroke();
    const cphase = phase % 1, mX = x0+(x1-x0)*cphase, mY = y0-(y0-y1)*norm(fluxAt(cphase));
    lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.arc(mX, mY, 4, 0, 7); lctx.fill();
    lctx.fillStyle = 'rgba(170,182,212,.7)'; lctx.font = '10px sans-serif';
    lctx.textAlign='left'; lctx.fillText('0', x0, LH-3);
    lctx.textAlign='right'; lctx.fillText('orbital phase  1', x1, LH-3);
  }

  function canAnimate() {
    return !reduce && !paused && speed > 0 && visible && !document.hidden;
  }
  function render() { drawScene(); drawLC(); }
  function loop(now) {
    raf = 0;
    if (canAnimate()) {
      const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      phase = (phase + 0.0016 * speed * dt) % 1;
    }
    drawScene(); drawLC();
    start();
  }
  function start() {
    if (!canAnimate() || raf || timer) return;
    timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(loop); }, FRAME_MS);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = 0; timer = 0; last = 0;
  }

  // ---- controls ----
  const MORPH = {
    single:  { i: 45, b: 18, two: false, ecl: false },
    double:  { i: 80, b: 58, two: false, ecl: false },
    twopole: { i: 60, b: 68, two: true,  ecl: false },
    eclipse: { i: 82, b: 28, two: false, ecl: true  }
  };
  function updateToggles() {
    elTwoPole.textContent = 'Second pole: ' + (twoPole ? 'on' : 'off');
    elTwoPole.setAttribute('aria-pressed', String(twoPole));
    elEclipse.textContent = 'Donor eclipse: ' + (eclipse ? 'on' : 'off');
    elEclipse.setAttribute('aria-pressed', String(eclipse));
  }
  function clearActiveChip() { chips.forEach(c => c.classList.remove('active')); }
  function setMorph(key) {
    const m = MORPH[key]; if (!m) return;
    inc = m.i * Math.PI/180; beta = m.b * Math.PI/180; twoPole = m.two; eclipse = m.ecl;
    elInc.value = m.i; elBeta.value = m.b;
    updateToggles(); clearActiveChip();
    chips.forEach(c => { if (c.dataset.morph === key) c.classList.add('active'); });
    renorm(); render(); start();
  }

  elSpeed.addEventListener('input', () => { speed = +elSpeed.value; render(); start(); });
  elInc.addEventListener('input', () => { inc = +elInc.value * Math.PI/180; clearActiveChip(); renorm(); render(); start(); });
  elBeta.addEventListener('input', () => { beta = +elBeta.value * Math.PI/180; clearActiveChip(); renorm(); render(); start(); });
  elTwoPole.addEventListener('click', () => { twoPole = !twoPole; updateToggles(); clearActiveChip(); renorm(); render(); start(); });
  elEclipse.addEventListener('click', () => { eclipse = !eclipse; updateToggles(); clearActiveChip(); renorm(); render(); start(); });
  chips.forEach(c => c.addEventListener('click', () => setMorph(c.dataset.morph)));
  elPause.addEventListener('click', () => {
    paused = !paused; elPause.textContent = paused ? 'Play' : 'Pause';
    elPause.setAttribute('aria-pressed', String(paused));
    if (paused) { stop(); render(); } else { start(); }
  });

  resize(); updateToggles(); renorm();
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
