/* =================================================================
   Cyclotron emission in a polar (AM Her star) — schematic live model.
   A polar is SYNCHRONOUS: the white-dwarf spin is locked to the orbit
   (P_spin = P_orb), so the WD and the M-dwarf donor co-revolve as a
   rigid system and the accreting magnetic pole always faces the donor.
   Gas leaves the donor, threads onto the dipole, and lights up that
   pole; as the whole binary turns, the beamed cyclotron flux is
   modulated and traced as a light curve.

   Flux model (standard dipole beaming geometry, fixed inclination i):
     cosψ = cos i cos β + sin i sin β cos(2π φ)        (φ = orbital phase)
     F(φ) ∝ sin²ψ · visibility(cosψ)
   sin²ψ -> cyclotron emission beams perpendicular to B
   visibility -> the accretion pole is dimmed when it turns behind the WD
   ================================================================= */
(function () {
  const canvas = document.getElementById('cycCanvas');
  const lc = document.getElementById('lcCanvas');
  if (!canvas || !lc) return;
  const ctx = canvas.getContext('2d');
  const lctx = lc.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elPhase = document.getElementById('cycPhase');
  const elFlux  = document.getElementById('cycFlux');
  const elSpeed = document.getElementById('cycSpeed');
  const elBeta  = document.getElementById('cycBeta');
  const elPause = document.getElementById('cycPause');

  const INC = 60 * Math.PI / 180;     // viewing inclination (fixed)
  let beta = +elBeta.value * Math.PI / 180;
  let speed = +elSpeed.value;
  let phase = 0, paused = false, W = 0, H = 0, LW = 0, LH = 0;

  function smooth(a, b, x){ const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function clamp1(x){ return Math.max(-1, Math.min(1, x)); }
  function fluxAt(ph, b) {
    const cpsi = Math.cos(INC) * Math.cos(b) + Math.sin(INC) * Math.sin(b) * Math.cos(2 * Math.PI * ph);
    const beam = 1 - clamp1(cpsi) * clamp1(cpsi);   // sin²ψ
    const vis = smooth(-0.25, 0.55, cpsi);          // dim the far-side pole
    return beam * (0.18 + 0.82 * vis);
  }

  let fMin = 0, fMax = 1;
  function renorm() {
    fMin = 1e9; fMax = -1e9;
    for (let i = 0; i <= 200; i++) { const f = fluxAt(i / 200, beta); if (f < fMin) fMin = f; if (f > fMax) fMax = f; }
    if (fMax - fMin < 1e-3) fMax = fMin + 1e-3;
  }
  function norm(f){ return (f - fMin) / (fMax - fMin); }

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    LW = lc.clientWidth; LH = lc.clientHeight;
    lc.width = LW * dpr; lc.height = LH * dpr; lctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ---- scene: a synchronously co-rotating binary ----
  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    const R = Math.min(W, H);
    const com = { x: W * 0.45, y: H * 0.5 };          // centre of mass
    const a = phase * 2 * Math.PI;                    // orientation of the binary (donor azimuth)
    const Rwd = R * 0.085, Rdon = R * 0.075;          // stellar radii
    const orbWD = R * 0.085, orbDon = R * 0.30;       // orbital radii (WD heavier -> smaller orbit)
    const f = fluxAt(phase, beta);
    const dir = { x: Math.cos(a), y: Math.sin(a) };   // COM -> donor

    const wd  = { x: com.x - dir.x * orbWD,  y: com.y - dir.y * orbWD };
    const don = { x: com.x + dir.x * orbDon, y: com.y + dir.y * orbDon };
    const pole = { x: wd.x + dir.x * Rwd, y: wd.y + dir.y * Rwd, a };   // active pole faces donor

    // faint orbit guides
    ctx.strokeStyle = 'rgba(120,140,200,.12)'; ctx.lineWidth = 1; ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.arc(com.x, com.y, orbDon, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(com.x, com.y, orbWD, 0, 7); ctx.stroke();
    ctx.setLineDash([]);

    // accretion stream: donor -> ballistic arc -> magnetic pole (co-rotating)
    const perp = { x: -dir.y, y: dir.x };
    const mid = { x: (don.x + pole.x)/2 + perp.x * R*0.12, y: (don.y + pole.y)/2 + perp.y * R*0.12 };
    const grad = ctx.createLinearGradient(don.x, don.y, pole.x, pole.y);
    grad.addColorStop(0, 'rgba(230,159,0,.85)'); grad.addColorStop(1, 'rgba(255,210,120,.3)');
    ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(don.x - dir.x*Rdon, don.y - dir.y*Rdon);
    ctx.quadraticCurveTo(mid.x, mid.y, pole.x, pole.y);
    ctx.stroke();
    if (!reduce) {
      for (let i = 0; i < 5; i++) {
        const t = (phase * 1.5 + i / 5) % 1, it = 1 - t;
        const sx = don.x - dir.x*Rdon, sy = don.y - dir.y*Rdon;
        const x = it*it*sx + 2*it*t*mid.x + t*t*pole.x;
        const y = it*it*sy + 2*it*t*mid.y + t*t*pole.y;
        ctx.fillStyle = `rgba(255,205,120,${0.85 - t*0.45})`;
        ctx.beginPath(); ctx.arc(x, y, 2.6 - t*1.2, 0, 7); ctx.fill();
      }
    }

    // donor (M dwarf)
    starGlow(don.x, don.y, Rdon, '#ffd9b0', '#d55e00');

    // dipole field lines, locked to the binary axis (synchronous)
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      const L = Rwd * (0.6 + k * 0.7);
      ctx.strokeStyle = `rgba(110,140,210,${0.22 - k*0.03})`;
      fieldLine(wd.x, wd.y, Rwd, L, a, 1); fieldLine(wd.x, wd.y, Rwd, L, a, -1);
    }
    // magnetic axis (dashed) through the WD toward the donor
    ctx.strokeStyle = 'rgba(150,170,230,.25)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(wd.x - dir.x*Rwd*2.4, wd.y - dir.y*Rwd*2.4);
    ctx.lineTo(wd.x + dir.x*Rwd*2.4, wd.y + dir.y*Rwd*2.4);
    ctx.stroke(); ctx.setLineDash([]);

    // white dwarf
    starGlow(wd.x, wd.y, Rwd, '#eafcff', '#155a69', 1.6, '#dff7fc');

    // accretion column + hot pole
    const tip = { x: pole.x + dir.x*Rwd*0.7, y: pole.y + dir.y*Rwd*0.7 };
    const cg = ctx.createLinearGradient(pole.x, pole.y, tip.x, tip.y);
    cg.addColorStop(0, 'rgba(230,159,0,.9)'); cg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.strokeStyle = cg; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(pole.x, pole.y); ctx.stroke();
    const hot = ctx.createRadialGradient(pole.x, pole.y, 0, pole.x, pole.y, Rwd*0.55);
    hot.addColorStop(0, `rgba(255,${200+f*55|0},150,${0.5+0.5*f})`); hot.addColorStop(1, 'rgba(213,94,0,0)');
    ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(pole.x, pole.y, Rwd*0.55, 0, 7); ctx.fill();

    // cyclotron beam fan (perpendicular to the field axis), brightness ∝ flux
    const reach = R * 0.42 * (0.4 + 0.6*f);
    for (const s of [1, -1]) {
      const d0 = a + s * Math.PI/2, spread = 0.42;
      const g = ctx.createRadialGradient(pole.x, pole.y, 0, pole.x, pole.y, reach);
      g.addColorStop(0, `rgba(79,208,227,${0.45*f+0.05})`); g.addColorStop(1, 'rgba(79,208,227,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pole.x, pole.y);
      ctx.arc(pole.x, pole.y, reach, d0 - spread, d0 + spread); ctx.closePath(); ctx.fill();
    }
    if (!reduce) drawElectrons(pole, a, f);

    ctx.fillStyle = 'rgba(170,182,212,.8)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ to observer', W*0.45, H - 26);
    ctx.fillText('P_spin = P_orb (synchronous)', W*0.45, 22);

    elPhase.textContent = phase.toFixed(2);
    elFlux.textContent = Math.round(norm(f) * 100) + '%';
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
      const lx = -Math.cos(th)*(R0+L);                 // along the magnetic axis
      const ly = sign*r*Math.sin(th)*0.7;              // perpendicular spread
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
    const N = 120;
    for (let i = 0; i <= N; i++) { const ph = i/N, X = x0+(x1-x0)*ph, Y = y0-(y0-y1)*norm(fluxAt(ph, beta));
      i ? lctx.lineTo(X, Y) : lctx.moveTo(X, Y); }
    lctx.stroke();
    const cphase = phase % 1, mX = x0+(x1-x0)*cphase, mY = y0-(y0-y1)*norm(fluxAt(cphase, beta));
    lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.arc(mX, mY, 4, 0, 7); lctx.fill();
    lctx.fillStyle = 'rgba(170,182,212,.7)'; lctx.font = '10px sans-serif';
    lctx.textAlign='left'; lctx.fillText('0', x0, LH-3);
    lctx.textAlign='right'; lctx.fillText('orbital phase  1', x1, LH-3);
  }

  function loop() {
    if (!paused && !reduce) phase = (phase + 0.0016 * speed) % 1;
    drawScene(); drawLC();
    requestAnimationFrame(loop);
  }

  elSpeed.addEventListener('input', () => speed = +elSpeed.value);
  elBeta.addEventListener('input', () => { beta = +elBeta.value * Math.PI/180; renorm(); });
  elPause.addEventListener('click', () => {
    paused = !paused; elPause.textContent = paused ? 'Play' : 'Pause';
    elPause.setAttribute('aria-pressed', String(paused));
  });

  resize(); renorm();
  window.addEventListener('resize', resize);
  if (reduce) { drawScene(); drawLC(); } else { requestAnimationFrame(loop); }
})();
