/* =================================================================
   Cyclotron emission in a polar — schematic live model.
   A magnetized white dwarf accretes from an M-dwarf donor; gas threads
   onto the rotating dipole and lights up the magnetic pole. The beamed
   cyclotron flux is modulated with rotation, traced as a light curve.

   Flux model (standard dipole beaming geometry, fixed inclination i):
     cosψ = cos i cos β + sin i sin β cos(2π φ)
     F(φ) ∝ sin²ψ · visibility(cosψ)
   sin²ψ  -> cyclotron emission beams perpendicular to B
   visibility -> the accretion spot is dimmed when it rotates behind the WD
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

  const INC = 60 * Math.PI / 180;   // viewing inclination (fixed)
  let beta = +elBeta.value * Math.PI / 180;
  let speed = +elSpeed.value;
  let phase = 0, paused = false, W = 0, H = 0, LW = 0, LH = 0;

  // ---- physics-ish flux ----
  function fluxAt(ph, b) {
    const cpsi = Math.cos(INC) * Math.cos(b) + Math.sin(INC) * Math.sin(b) * Math.cos(2 * Math.PI * ph);
    const beam = 1 - cpsiClamp(cpsi) * cpsiClamp(cpsi);   // sin²ψ
    const vis = smooth(-0.25, 0.55, cpsi);                // dim the far-side pole
    return beam * (0.18 + 0.82 * vis);
  }
  function cpsiClamp(x){ return Math.max(-1, Math.min(1, x)); }
  function smooth(a, b, x){ const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // normalisation so the curve uses the full vertical range
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

  // ---- main scene ----
  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    const cx = W * 0.40, cy = H * 0.48, R = Math.min(W, H) * 0.12;
    const spin = phase * 2 * Math.PI;
    const f = fluxAt(phase, beta);

    // donor star (M dwarf) upper-right + Roche teardrop
    const dx = W * 0.86, dy = H * 0.22, dR = R * 1.25;
    const dg = ctx.createRadialGradient(dx - dR*0.3, dy - dR*0.3, dR*0.2, dx, dy, dR*1.3);
    dg.addColorStop(0, '#ffd9b0'); dg.addColorStop(0.5, '#d55e00'); dg.addColorStop(1, 'rgba(120,40,0,0)');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(dx, dy, dR*1.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8782a'; ctx.beginPath(); ctx.arc(dx, dy, dR, 0, 7); ctx.fill();

    // accretion stream: ballistic arc from L1, then channel onto the pole
    const pole = polePos(cx, cy, R, spin);
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    const grad = ctx.createLinearGradient(dx, dy, pole.x, pole.y);
    grad.addColorStop(0, 'rgba(230,159,0,.85)'); grad.addColorStop(1, 'rgba(255,210,120,.25)');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    const mx = (dx + cx) / 2 + W * 0.04, my = (dy + cy) / 2 - H * 0.16;  // ballistic apex
    ctx.moveTo(dx - dR*0.7, dy + dR*0.2);
    ctx.quadraticCurveTo(mx, my, cx + (pole.x-cx)*1.8, cy + (pole.y-cy)*1.8);
    ctx.quadraticCurveTo(pole.x + (pole.x-cx)*0.6, pole.y + (pole.y-cy)*0.6, pole.x, pole.y);
    ctx.stroke();

    // moving gas blobs along the stream
    if (!reduce) {
      for (let i = 0; i < 5; i++) {
        const tt = ((phase * 1.4 + i / 5) % 1);
        const p = streamPoint(dx-dR*0.7, dy+dR*0.2, mx, my, cx+(pole.x-cx)*1.8, cy+(pole.y-cy)*1.8, pole, tt);
        ctx.fillStyle = `rgba(255,${190+tt*40|0},120,${0.8-tt*0.4})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 - tt*1.2, 0, 7); ctx.fill();
      }
    }

    // dipole field lines (rotating with spin)
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      const L = R * (0.6 + k * 0.7);
      ctx.strokeStyle = `rgba(110,140,210,${0.22 - k*0.03})`;
      fieldLine(cx, cy, R, L, spin, 1); fieldLine(cx, cy, R, L, spin, -1);
    }
    // magnetic axis
    ctx.strokeStyle = 'rgba(150,170,230,.25)'; ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(spin-Math.PI/2)*R*2.4, cy - Math.sin(spin-Math.PI/2)*R*2.4);
    ctx.lineTo(cx + Math.cos(spin-Math.PI/2)*R*2.4, cy + Math.sin(spin-Math.PI/2)*R*2.4);
    ctx.stroke(); ctx.setLineDash([]);

    // white dwarf
    const wg = ctx.createRadialGradient(cx-R*0.3, cy-R*0.3, R*0.2, cx, cy, R*1.6);
    wg.addColorStop(0, '#eafcff'); wg.addColorStop(0.55, '#7fdfee'); wg.addColorStop(1, 'rgba(20,90,105,0)');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(cx, cy, R*1.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#dff7fc'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

    // accretion column + hot pole
    drawColumn(cx, cy, R, pole, f);

    // cyclotron beam fan (perpendicular to the column / field axis)
    drawBeam(pole, cx, cy, f);

    // gyrating electrons near the pole
    if (!reduce) drawElectrons(pole, spin, f);

    // observer marker
    ctx.fillStyle = 'rgba(170,182,212,.8)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼ to observer', W*0.40, H - 26);

    // readouts
    elPhase.textContent = phase.toFixed(2);
    const pct = Math.round(norm(f) * 100);
    elFlux.textContent = pct + '%';
  }

  function polePos(cx, cy, R, spin) {
    // primary accretion pole rides the rotating magnetic axis
    const a = spin - Math.PI/2;             // start at top
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
  }
  function drawColumn(cx, cy, R, pole, f) {
    const ox = Math.cos(pole.a), oy = Math.sin(pole.a);
    const tip = { x: pole.x + ox*R*0.7, y: pole.y + oy*R*0.7 };
    const cg = ctx.createLinearGradient(pole.x, pole.y, tip.x, tip.y);
    cg.addColorStop(0, 'rgba(230,159,0,.9)'); cg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.strokeStyle = cg; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(pole.x, pole.y); ctx.stroke();
    // hot spot
    const hot = ctx.createRadialGradient(pole.x, pole.y, 0, pole.x, pole.y, R*0.55);
    hot.addColorStop(0, `rgba(255,${200+f*55|0},150,${0.5+0.5*f})`);
    hot.addColorStop(1, 'rgba(213,94,0,0)');
    ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(pole.x, pole.y, R*0.55, 0, 7); ctx.fill();
  }
  function drawBeam(pole, cx, cy, f) {
    // emission perpendicular to the field axis (radial), i.e. tangential fan
    const radial = pole.a;
    const reach = Math.min(W, H) * 0.42 * (0.4 + 0.6*f);
    for (const s of [1, -1]) {
      const dir = radial + s * Math.PI/2;
      const spread = 0.42;
      const g = ctx.createRadialGradient(pole.x, pole.y, 0, pole.x, pole.y, reach);
      g.addColorStop(0, `rgba(79,208,227,${0.45*f+0.05})`);
      g.addColorStop(1, 'rgba(79,208,227,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pole.x, pole.y);
      ctx.arc(pole.x, pole.y, reach, dir - spread, dir + spread);
      ctx.closePath(); ctx.fill();
    }
  }
  function drawElectrons(pole, spin, f) {
    ctx.strokeStyle = `rgba(180,240,255,${0.4+0.4*f})`; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const ph = spin*3 + i*2.1;
      const rr = 5 + i*3;
      ctx.beginPath();
      for (let j = 0; j <= 16; j++) {
        const a = ph + j*0.5;
        const x = pole.x + Math.cos(a)*rr*0.6 + Math.cos(pole.a)*(j-8)*1.2;
        const y = pole.y + Math.sin(a)*rr*0.6 + Math.sin(pole.a)*(j-8)*1.2;
        j ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
      }
      ctx.stroke();
    }
  }
  function fieldLine(cx, cy, R, L, ang, sign) {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const th = (i/36)*Math.PI;
      const r = R + L*Math.sin(th);
      const lx = sign*r*Math.sin(th)*0.7;
      const ly = -Math.cos(th)*(R+L);
      const x = cx + lx*Math.cos(ang) - ly*Math.sin(ang);
      const y = cy + lx*Math.sin(ang) + ly*Math.cos(ang);
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    }
    ctx.stroke();
  }
  function streamPoint(x0,y0, mx,my, x1,y1, pole, t) {
    if (t < 0.7) { const u = t/0.7; const iu=1-u;
      return { x: iu*iu*x0 + 2*iu*u*mx + u*u*x1, y: iu*iu*y0 + 2*iu*u*my + u*u*y1 }; }
    const u=(t-0.7)/0.3, iu=1-u;
    return { x: iu*x1 + u*pole.x, y: iu*y1 + u*pole.y };
  }

  // ---- light curve ----
  function drawLC() {
    lctx.clearRect(0, 0, LW, LH);
    const padL = 6, padR = 6, padT = 8, padB = 14;
    const x0 = padL, x1 = LW - padR, y0 = LH - padB, y1 = padT;
    // baseline + grid
    lctx.strokeStyle = 'rgba(255,255,255,.08)'; lctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) { const gx = x0 + (x1-x0)*g/4;
      lctx.beginPath(); lctx.moveTo(gx, y1); lctx.lineTo(gx, y0); lctx.stroke(); }
    lctx.beginPath(); lctx.moveTo(x0, y0); lctx.lineTo(x1, y0); lctx.stroke();
    // curve over phase 0..1 (drawn around current phase for a scrolling feel)
    lctx.strokeStyle = '#4fd0e3'; lctx.lineWidth = 2; lctx.beginPath();
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const ph = i / N;
      const X = x0 + (x1-x0)*ph;
      const Y = y0 - (y0-y1) * norm(fluxAt(ph, beta));
      i ? lctx.lineTo(X, Y) : lctx.moveTo(X, Y);
    }
    lctx.stroke();
    // current marker
    const cphase = phase % 1;
    const mX = x0 + (x1-x0)*cphase;
    const mY = y0 - (y0-y1)*norm(fluxAt(cphase, beta));
    lctx.fillStyle = '#fff'; lctx.beginPath(); lctx.arc(mX, mY, 4, 0, 7); lctx.fill();
    lctx.fillStyle = 'rgba(79,208,227,.9)'; lctx.beginPath(); lctx.arc(mX, mY, 7, 0, 7); lctx.globalAlpha=.3; lctx.fill(); lctx.globalAlpha=1;
    lctx.fillStyle = 'rgba(170,182,212,.7)'; lctx.font = '10px sans-serif'; lctx.textAlign='left';
    lctx.fillText('0', x0, LH-3); lctx.textAlign='right'; lctx.fillText('phase  1', x1, LH-3);
  }

  function loop() {
    if (!paused && !reduce) phase = (phase + 0.0016 * speed) % 1;
    drawScene(); drawLC();
    requestAnimationFrame(loop);
  }

  // ---- controls ----
  elSpeed.addEventListener('input', () => speed = +elSpeed.value);
  elBeta.addEventListener('input', () => { beta = +elBeta.value * Math.PI/180; renorm(); });
  elPause.addEventListener('click', () => {
    paused = !paused;
    elPause.textContent = paused ? 'Play' : 'Pause';
    elPause.setAttribute('aria-pressed', String(paused));
  });

  resize(); renorm();
  window.addEventListener('resize', resize);
  if (reduce) { drawScene(); drawLC(); } else { requestAnimationFrame(loop); }
})();
