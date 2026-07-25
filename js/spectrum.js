/* =================================================================
   CYCLOTRON SPECTRUM LAB — the same three components I fit for real.

   A polar's optical spectrum is not one curve, it is a sum:

     F(λ) = F_WD(λ)  +  F_spot(λ)  +  F_cyc(λ)

   · F_WD    a Koester-like photosphere, here a Planck function at
             T_eff ≈ 12 kK (the hydrogen lines are left out on purpose —
             this panel is about the continuum and the humps).
   · F_spot  the heated pole cap, a small-area blackbody at ~22 kK.
   · F_cyc   an isothermal, homogeneous cyclotron slab. Harmonics sit at
                 λ_n = 1.071e6 / (n · B[MG])   Å
             and the emergent intensity is proper radiative transfer,
                 I = B_λ(T_e) · [1 − exp(−Σ_n τ_n φ_n(λ))]
             with the leading Chanmugam & Dulk (1981) harmonic scaling
                 τ_n ∝ Λ · n^{2n}/(2ⁿ n!) · β^{n−1} · sin^{2n−2}θ
             and β = kT_e/m_ec².

   That last line is the whole reason the panel is worth building: τ_n
   collapses by ~β per harmonic, so low harmonics are optically thick and
   merge into a smooth blue continuum while high harmonics go thin and
   break into the resolved humps you actually measure B from. Drag Λ and
   watch the turnover harmonic move — that is the degeneracy that makes
   automated harmonic assignment hard, and it is why the paper reports
   competing branches instead of a single number.
   ================================================================= */
(function () {
  const canvas = document.getElementById('specCanvas');
  if (!canvas || !window.FK) return;
  const ctx = canvas.getContext('2d');
  const C = FK.C;

  const $ = id => document.getElementById(id);
  const sB = $('specB'), sT = $('specT'), sTh = $('specTheta'), sL = $('specLam');
  const oB = $('specBval'), oT = $('specTval'), oTh = $('specThetaval'), oL = $('specLamval');
  const oH = $('specHarm'), oTurn = $('specTurn'), oTgt = $('specTarget');
  const chips = document.querySelectorAll('.spec-presets .chip');
  const toggles = document.querySelectorAll('[data-comp]');
  if (!sB) return;

  const LAM0 = 3700, LAM1 = 9300;          // plotted band, Å — DESI/LAMOST optical coverage
  const T_WD = 11000, T_SPOT = 22000;      // K
  const NMAX = 16;
  let W = 0, H = 0, ax = null, hover = null;
  const show = { wd: true, spot: true, cyc: true };

  /* ---- physics ---- */
  const lnFact = (() => { const a = [0]; for (let i = 1; i <= NMAX + 2; i++) a[i] = a[i - 1] + Math.log(i); return a; })();
  function planck(lamA, T) {                 // B_λ, arbitrary consistent units
    const lam = lamA * 1e-8;                 // cm
    const x = 1.4387769 / (lam * T);
    return 1 / (Math.pow(lam, 5) * (Math.exp(Math.min(700, x)) - 1));
  }
  const WD_SCALE   = 1 / planck(5500, T_WD);
  const SPOT_SCALE = 0.22 / planck(5500, T_SPOT);
  /* area filling factor of the cyclotron region, folded into one constant:
     set so that a saturated harmonic reaches ~2× the photosphere at 5500 Å,
     which is the contrast real polar spectra show */
  const CYC_LEVEL = 2.0;

  function tauN(n, kT, thRad, logLam) {
    const beta = kT / 511.0;                 // kT_e / m_e c²
    const s = Math.max(1e-3, Math.sin(thRad));
    const lg = 2 * n * Math.log(n) - n * Math.LN2 - lnFact[n]
             + (n - 1) * Math.log(beta) + (2 * n - 2) * Math.log(s)
             + logLam * Math.LN10;
    const ang = (1 + Math.cos(thRad) * Math.cos(thRad)) / 2;
    return Math.exp(Math.min(60, lg)) * ang;
  }
  function state() {
    const B = +sB.value, kT = +sT.value, th = FK.RAD(+sTh.value), lg = +sL.value;
    const T_e = kT * 1.16045e7;
    const cyc = [];
    for (let n = 2; n <= NMAX; n++) {
      const lam = 1.071e6 / (n * B);
      const tau = tauN(n, kT, th, lg);
      const w = lam * (0.055 + 0.45 * n * kT / 511);
      cyc.push({ n, lam, tau, w });
    }
    const CYC_SCALE = CYC_LEVEL / planck(5500, T_e);
    return { B, kT, th, lg, T_e, cyc, CYC_SCALE };
  }
  function comps(lam, S) {
    const wd = show.wd ? WD_SCALE * planck(lam, T_WD) : 0;
    const sp = show.spot ? SPOT_SCALE * planck(lam, T_SPOT) : 0;
    let cy = 0;
    if (show.cyc) {
      let tau = 0;
      for (const h of S.cyc) {
        if (Math.abs(lam - h.lam) > 4 * h.w) continue;
        const z = (lam - h.lam) / h.w;
        tau += h.tau * Math.exp(-z * z);
      }
      cy = S.CYC_SCALE * planck(lam, S.T_e) * (1 - Math.exp(-Math.min(60, tau)));
    }
    return { wd, sp, cy, tot: wd + sp + cy };
  }

  /* approximate visible-light colour of a wavelength, for the ribbon */
  function lamRGB(lamA) {
    const nm = lamA / 10; let r = 0, g = 0, b = 0;
    if (nm < 380) { r = .18; g = .05; b = .35; }
    else if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm < 700) { r = 1; }
    else { r = Math.max(.18, 1 - (nm - 700) / 260); }
    return [r * 255 | 0, g * 255 | 0, b * 255 | 0];
  }

  function resize() { const m = FK.fit(canvas, ctx); if (m) { W = m.w; H = m.h; } }

  function draw() {
    if (!W) return;
    const S = state();
    ctx.clearRect(0, 0, W, H);

    if (oB)  oB.textContent = S.B.toFixed(1) + ' MG';
    if (oT)  oT.textContent = S.kT.toFixed(1) + ' keV';
    if (oTh) oTh.textContent = Math.round(FK.DEG(S.th)) + '°';
    if (oL)  oL.textContent = '10^' + S.lg.toFixed(1);

    /* y range from the total, with headroom */
    let ymax = 0;
    for (let lam = LAM0; lam <= LAM1; lam += 25) ymax = Math.max(ymax, comps(lam, S).tot);
    ymax = Math.max(0.6, ymax * 1.14);

    const RIB = 11;                       // spectral ribbon height under the axis
    const A = FK.axes(ctx, {
      l: 46, t: 16, r: W - 16, b: H - 44 - RIB,
      x: { min: LAM0, max: LAM1, n: 6, label: 'wavelength  λ  (Å)', fmt: v => String(v) },
      y: { min: 0, max: ymax, n: 4, label: 'F λ   (normalised to the WD at 5500 Å)', fmt: v => v.toFixed(1) },
      grid: false, yTitleGap: 30
    });
    ax = A;

    /* --- ZTF passbands, marked as brackets on the frame, not washes --- */
    const bands = [[4030, 5520, 'g', C.mint], [5620, 7310, 'r', C.ember], [6900, 8250, 'i', C.plum]];
    ctx.save();
    for (const [lo, hi, lab, col] of bands) {
      const x0 = A.X(lo), x1 = A.X(hi), y = A.box.b - 5;
      ctx.strokeStyle = col; ctx.globalAlpha = .55; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1, y - 4);
      ctx.stroke(); ctx.globalAlpha = 1;
      FK.text(ctx, lab, (x0 + x1) / 2, y - 6, { font: FK.mono(9, 500), fill: col, align: 'center' });
    }
    ctx.restore();

    /* --- components + total --- */
    FK.inBox(ctx, A.box, () => {
      const px2lam = p => LAM0 + (LAM1 - LAM0) * (p - A.box.l) / (A.box.r - A.box.l);
      const N = Math.max(120, Math.round(A.box.r - A.box.l));

      if (show.cyc) {                       // soft fill under the total
        ctx.beginPath(); ctx.moveTo(A.box.l, A.box.b);
        for (let k = 0; k <= N; k++) {
          const p = A.box.l + (A.box.r - A.box.l) * k / N;
          ctx.lineTo(p, A.Y(comps(px2lam(p), S).tot));
        }
        ctx.lineTo(A.box.r, A.box.b); ctx.closePath();
        const g = ctx.createLinearGradient(0, A.box.t, 0, A.box.b);
        g.addColorStop(0, 'rgba(224,164,92,.16)'); g.addColorStop(1, 'rgba(224,164,92,.015)');
        ctx.fillStyle = g; ctx.fill();
      }
      const comp = (key, col, dash) => FK.curve(ctx, N,
        t => { const p = A.box.l + (A.box.r - A.box.l) * t; return [p, A.Y(comps(px2lam(p), S)[key])]; },
        { stroke: col, width: 1.15, dash });
      if (show.wd)   comp('wd',  'rgba(139,169,207,.85)', [5, 3]);
      if (show.spot) comp('sp',  'rgba(230,146,108,.8)',  [2, 3]);
      if (show.cyc)  comp('cy',  'rgba(192,127,54,.85)',  [7, 4]);
      FK.curve(ctx, N, t => {
        const p = A.box.l + (A.box.r - A.box.l) * t; return [p, A.Y(comps(px2lam(p), S).tot)];
      }, { stroke: C.amber, width: 2 });
    });

    /* --- harmonic markers: only the ones that actually matter --- */
    const seen = [];
    let turn = null;
    for (const h of S.cyc) {
      if (h.tau >= 1) turn = h.n;
      if (h.lam < LAM0 || h.lam > LAM1 || h.tau < 0.015) continue;
      const first = seen.length === 0;
      seen.push(h.n);
      const x = FK.snap(A.X(h.lam));
      const y = A.Y(comps(h.lam, S).tot);
      ctx.save();
      ctx.strokeStyle = h.tau > 1 ? 'rgba(139,169,207,.35)' : 'rgba(224,164,92,.5)';
      ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(x, A.box.t + 14); ctx.lineTo(x, Math.max(A.box.t + 16, y - 5)); ctx.stroke();
      ctx.restore();
      FK.text(ctx, (first ? 'n = ' : '') + h.n, x, A.box.t + 11,
        { font: FK.mono(9.5, 500), fill: h.tau > 1 ? 'rgba(139,169,207,.9)' : '#eec18a', align: 'center' });
    }

    /* --- optical-depth ladder, inset top-right: where the humps resolve --- */
    const iw = 116, ih = 66, ix = A.box.r - iw - 12, iy = A.box.t + 24;
    ctx.save();
    ctx.fillStyle = 'rgba(20,17,12,.55)';
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ix, iy, iw, ih, 3); else ctx.rect(ix, iy, iw, ih);
    ctx.fill(); ctx.stroke();
    const lo = -3, hi = 3;
    const bY = v => iy + ih - 12 - (ih - 20) * (FK.clamp(v, lo, hi) - lo) / (hi - lo);
    ctx.strokeStyle = 'rgba(216,206,180,.30)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ix + 4, FK.snap(bY(0))); ctx.lineTo(ix + iw - 4, FK.snap(bY(0))); ctx.stroke();
    ctx.setLineDash([]);
    const nShown = 12, bw = (iw - 12) / nShown;
    for (let k = 0; k < nShown; k++) {
      const h = S.cyc[k]; if (!h) break;
      const lv = Math.log10(Math.max(1e-9, h.tau));
      const x = ix + 6 + k * bw, yv = bY(lv), y0 = bY(0);
      ctx.fillStyle = h.tau > 1 ? 'rgba(139,169,207,.75)' : 'rgba(224,164,92,.8)';
      ctx.fillRect(x, Math.min(yv, y0), Math.max(1.5, bw - 2), Math.abs(y0 - yv) + 0.8);
    }
    FK.kicker(ctx, 'log τₙ', ix + 6, iy + 10, { size: 7.5, fill: C.faint });
    FK.text(ctx, 'τ=1', ix + iw - 6, bY(0) - 3, { font: FK.mono(7.5), fill: C.faint, align: 'right' });
    ctx.restore();

    /* --- the spectral ribbon: a thin colour reference, not a wash --- */
    const ry = A.box.b + 26;
    for (let p = A.box.l; p < A.box.r; p += 2) {
      const lam = LAM0 + (LAM1 - LAM0) * (p - A.box.l) / (A.box.r - A.box.l);
      const c = lamRGB(lam);
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (lam < 3900 || lam > 7300 ? .13 : .40) + ')';
      ctx.fillRect(p, ry, 2.4, RIB);
    }
    ctx.save();
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.strokeRect(FK.snap(A.box.l), FK.snap(ry), Math.round(A.box.r - A.box.l), RIB);
    ctx.restore();

    /* --- legend, tucked into the empty red corner --- */
    FK.legend(ctx, A.box.r - 138, A.box.t + 112, [
      { label: 'total', color: C.amber, width: 2 },
      show.cyc  ? { label: 'cyclotron slab', color: 'rgba(192,127,54,.9)', dash: [7, 4] } : null,
      show.wd   ? { label: 'WD photosphere', color: 'rgba(139,169,207,.9)', dash: [5, 3] } : null,
      show.spot ? { label: 'hot spot', color: 'rgba(230,146,108,.9)', dash: [2, 3] } : null
    ].filter(Boolean));

    /* --- hover crosshair --- */
    if (hover != null && hover >= A.box.l && hover <= A.box.r) {
      const lam = LAM0 + (LAM1 - LAM0) * (hover - A.box.l) / (A.box.r - A.box.l);
      const c = comps(lam, S);
      let near = null;
      for (const h of S.cyc) if (!near || Math.abs(h.lam - lam) < Math.abs(near.lam - lam)) near = h;
      ctx.save();
      ctx.strokeStyle = 'rgba(244,238,226,.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(FK.snap(hover), A.box.t); ctx.lineTo(FK.snap(hover), A.box.b); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(hover, A.Y(c.tot), 3, 0, 7); ctx.fill();
      ctx.restore();
      FK.chip(ctx, hover, A.Y(c.tot), [
        Math.round(lam) + ' Å   F = ' + c.tot.toFixed(2),
        'nearest n = ' + near.n + '  (τ = ' + (near.tau > 99 ? '≫1' : near.tau.toFixed(2)) + ')'
      ], A.box);
    }

    if (oH) oH.textContent = seen.length ? seen.join(', ') : 'none in band';
    if (oTurn) oTurn.textContent = turn ? 'thick up to n = ' + turn : 'all harmonics thin';
  }

  /* ---- controls ---- */
  [sB, sT, sTh, sL].forEach(s => s && s.addEventListener('input', () => {
    chips.forEach(o => o.classList.remove('active'));
    if (oTgt) oTgt.textContent = '—';
    draw();
  }));
  chips.forEach(c => c.addEventListener('click', () => {
    chips.forEach(o => o.classList.remove('active'));
    c.classList.add('active');
    sB.value = c.dataset.b;
    if (c.dataset.kt && sT) sT.value = c.dataset.kt;
    if (oTgt) oTgt.textContent = c.textContent.trim() + ' · P = ' + c.dataset.p + ' min';
    draw();
  }));
  toggles.forEach(t => t.addEventListener('click', () => {
    const k = t.dataset.comp;
    show[k] = !show[k];
    t.setAttribute('aria-pressed', String(show[k]));
    t.classList.toggle('is-off', !show[k]);
    draw();
  }));

  FK.pointer(canvas, {
    move: p => { hover = p.x; draw(); },
    leave: () => { hover = null; draw(); }
  });

  resize(); draw();
  FK.onResize(canvas, () => { resize(); draw(); });
})();
