/* =================================================================
   UPK 13-c2 — a candidate disk-eclipsing binary in a ~316 Myr cluster.

   Every 36.710719 d the system drops into a flat-bottomed "square
   wave". A misaligned circumbinary disk presents a localized, sharp
   inner edge; only the wider-orbit component swings behind it, so ONE
   star is occulted while its companion keeps shining — which is why
   the floor sits near 60 % instead of going to zero.

   Two angles do all the work:
     · the binary inclination i sets how much of the star the edge can
       cover at all (and therefore the depth),
     · the disk misalignment α sets the perpendicular crossing speed
           v⊥ = v_orb sin α
       and hence the ingress slope. The observed ingress takes ~2.5 d,
       far too slow for a point-like white dwarf: switch the occulted
       source and the walls snap vertical. That single comparison is
       the argument that rules a WD out.

   The light curve is real: ZTF g/r photometry folded on the period,
   with the χ²-fitted trapezoid from fit_squarewave.py drawn behind the
   live model. Stellar radii in the scene are exaggerated ~15× — at true
   scale the stars would be sub-pixel — hence the magnified inset, which
   is where the ingress geometry actually lives.
   ================================================================= */
(function () {
  const canvas = document.getElementById('diskCanvas');
  const lcEl = document.getElementById('diskLc');
  if (!canvas || !lcEl || !window.FK) return;
  const ctx = canvas.getContext('2d');
  const lctx = lcEl.getContext('2d');
  const C = FK.C, RGB = FK.RGB;

  const $ = id => document.getElementById(id);
  const out = {
    phase: $('diskPhase'), days: $('diskDays'), flux: $('diskFlux'), depth: $('diskDepth'),
    iv: $('diskIv'), alpha: $('diskAlphaR'), rin: $('diskRin'), ing: $('diskIngress')
  };
  const inp = {
    incl: $('diskIncl'), alpha: $('diskAlpha'), speed: $('diskSpeed'),
    toggle: $('diskToggle'), pause: $('diskPause')
  };

  const DD = window.DISK_DATA || null;
  const P_DAYS = DD ? DD.period_days : 36.710719;
  const EDGES = DD ? DD.model_edges : [0.24, 0.37, 0.67, 0.70];
  const DEPTH = DD ? DD.bands.g.depth : 0.40;
  const RIN_OVER_A = 2.5, A_RSUN = 52, RIN_RSUN = Math.round(RIN_OVER_A * A_RSUN);
  const ALPHA0 = FK.RAD(13);

  let phase = 0, speed = +(inp.speed && inp.speed.value || 1), extended = true;
  let iv = FK.RAD(+(inp.incl && inp.incl.value || 82));
  let alphaMis = FK.RAD(+(inp.alpha && inp.alpha.value || 13));
  let W = 0, H = 0, LW = 0, LH = 0, lcAx = null, hover = null;

  /* ---- flux model (unchanged: this is what the data constrain) ---- */
  const ingressK = () => Math.sin(ALPHA0) / Math.max(0.05, Math.sin(alphaMis));
  function dipK(ph, narrow, k) {
    const p2 = EDGES[1], p3 = EDGES[2];
    let p1, p4;
    if (narrow) { const w = 0.006; p1 = p2 - w; p4 = p3 + w; }
    else { p1 = Math.max(0, p2 - (EDGES[1] - EDGES[0]) * k); p4 = Math.min(1, p3 + (EDGES[3] - EDGES[2]) * k); }
    ph = ((ph % 1) + 1) % 1;
    if (ph <= p1 || ph >= p4) return 0;
    if (ph < p2) return (ph - p1) / (p2 - p1);
    if (ph <= p3) return 1;
    return (p4 - ph) / (p4 - p3);
  }
  const depthScale = () => FK.smooth(FK.RAD(52), FK.RAD(80), iv);
  const refFlux = ph => 1 - DEPTH * dipK(ph, false, 1);
  const modelFlux = ph => 1 - DEPTH * depthScale() * dipK(ph, !extended, extended ? ingressK() : 1);
  const cover1 = ph => depthScale() * dipK(ph, !extended, extended ? ingressK() : 1);
  function ingressDays() {
    const k = extended ? ingressK() : 0;
    const w = extended ? (EDGES[1] - EDGES[0]) * k : 0.006;
    return w * P_DAYS;
  }

  /* ================= scene ================= */
  function geom() {
    const cx = W * 0.5, cy = H * 0.53;
    const a = Math.min(W * 0.112, H * 0.20);        // orbital separation, px
    const sq = Math.max(0.045, Math.cos(iv));       // vertical squash from the viewing angle
    const a1 = a * 0.58, a2 = a * 0.42;             // orbital radii about the COM
    const rin = RIN_OVER_A * a, rout = rin * 1.5;
    const rs = a * 0.20;                            // exaggerated stellar radius
    return { cx, cy, a, a1, a2, sq, rin, rout, rs, rot: alphaMis };
  }
  const orbit = (g, r, th) => ({ x: g.cx + r * Math.cos(th), y: g.cy + r * g.sq * Math.sin(th) });

  function ringPath(g, rx, half) {
    /* half: +1 near (lower) arc, -1 far (upper) arc, 0 full */
    const p = new Path2D();
    const A = half === 0 ? [0, Math.PI * 2] : half > 0 ? [0, Math.PI] : [Math.PI, Math.PI * 2];
    p.ellipse(g.cx, g.cy, rx, rx * g.sq, g.rot, A[0], A[1]);
    return p;
  }

  function drawDisk(g, near) {
    const { cx, cy, sq, rin, rout, rot } = g;
    ctx.save();
    if (near) {
      /* the near half of the annulus, drawn over the stars: this is the
         material that does the occulting, so it reads as opaque dust */
      const p = new Path2D();
      p.ellipse(cx, cy, rout, rout * sq, rot, 0, Math.PI);
      p.ellipse(cx, cy, rin, rin * sq, rot, Math.PI, 0, true);
      p.closePath();
      const gr = ctx.createLinearGradient(cx, cy - rout * sq, cx, cy + rout * sq);
      gr.addColorStop(0, 'rgba(46,35,26,.94)');
      gr.addColorStop(1, 'rgba(22,17,13,.99)');
      ctx.fillStyle = gr; ctx.fill(p);
      ctx.strokeStyle = 'rgba(198,158,112,.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, rin, rin * sq, rot, 0, Math.PI); ctx.stroke();
    } else {
      /* far half: dust lit from the inside, fading outward */
      const p = new Path2D();
      p.ellipse(cx, cy, rout, rout * sq, rot, Math.PI, Math.PI * 2);
      p.ellipse(cx, cy, rin, rin * sq, rot, Math.PI * 2, Math.PI, true);
      p.closePath();
      const gr = ctx.createRadialGradient(cx, cy, rin * 0.95, cx, cy, rout);
      gr.addColorStop(0, 'rgba(126,96,66,.62)');
      gr.addColorStop(0.45, 'rgba(84,64,46,.45)');
      gr.addColorStop(1, 'rgba(40,31,24,.10)');
      ctx.fillStyle = gr; ctx.fill(p);
      for (let k = 1; k <= 4; k++) {
        const rx = rin + (rout - rin) * k / 5;
        ctx.strokeStyle = 'rgba(176,142,102,.09)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * sq, rot, Math.PI, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(206,168,120,.34)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rin, rin * sq, rot, Math.PI, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  /* the sharp inner edge sweeping across the star.
     cov = 0 → edge tangent to the limb;  cov = 1 → star fully behind. */
  function occult(x, y, r, cov, g, scale) {
    if (cov <= 0.003) return;
    const Rocc = r * 26 * (scale || 1);              // huge radius ⇒ an effectively straight edge
    const dir = Math.PI / 2 + g.rot;
    const ux = Math.cos(dir), uy = Math.sin(dir);
    const reach = r * 1.28;
    const D = Rocc + reach - cov * 2 * reach;
    const ox = x + ux * D, oy = y + uy * D;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, reach, 0, 7); ctx.clip();
    ctx.fillStyle = '#1d160f';
    ctx.beginPath(); ctx.arc(ox, oy, Rocc, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(214,172,120,.85)'; ctx.lineWidth = Math.max(1, r * 0.10);
    ctx.beginPath(); ctx.arc(ox, oy, Rocc, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function drawScene() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const g = geom();
    const th1 = phase * 2 * Math.PI, th2 = th1 + Math.PI;
    const s1 = orbit(g, g.a1, th1);
    const s2 = orbit(g, g.a2, th2);
    const r1 = extended ? g.rs : Math.max(1.6, g.rs * 0.14);
    const r2 = g.rs * 1.04;
    const cov = cover1(phase), ds = depthScale();

    drawDisk(g, false);

    /* binary orbits */
    ctx.save();
    ctx.strokeStyle = 'rgba(139,169,207,.14)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.a1, g.a1 * g.sq, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.a2, g.a2 * g.sq, 0, 0, 7); ctx.stroke();
    ctx.restore();

    /* stars, far one first */
    const far = Math.sin(th1) < Math.sin(th2);
    const drawS1 = () => {
      FK.disc(ctx, s1.x, s1.y, r1, extended ? RGB.kdwarf : RGB.wd,
        { u: 0.68, core: extended ? 0.95 : 1, bloom: extended ? 1.7 : 2.6 });
      occult(s1.x, s1.y, r1, cov, g, 1);
    };
    const drawS2 = () => FK.disc(ctx, s2.x, s2.y, r2, RGB.donorC, { u: 0.66, core: 0.92, bloom: 1.7 });
    if (far) { drawS1(); drawS2(); } else { drawS2(); drawS1(); }

    drawDisk(g, true);

    /* --- magnified inset: the ingress geometry, 4× --- */
    const iw = Math.min(178, W * 0.34), ih = iw * 0.62;
    const ix = W - iw - 14, iy = 14, M = Math.min(4.2, (ih * 0.34) / Math.max(1.2, r1));
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ix, iy, iw, ih, 4); else ctx.rect(ix, iy, iw, ih);
    ctx.fillStyle = 'rgba(18,15,10,.82)'; ctx.fill();
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1; ctx.stroke();
    ctx.clip();
    const mx = ix + iw * 0.5, my = iy + ih * 0.56;
    FK.disc(ctx, mx, my, r1 * M, extended ? RGB.kdwarf : RGB.wd, { u: 0.68, core: 1, bloom: 1.5 });
    occult(mx, my, r1 * M, cov, g, 1);
    ctx.restore();
    FK.kicker(ctx, '×' + M.toFixed(1) + '  ingress ' + ingressDays().toFixed(1) + ' d',
      ix + 7, iy + 13, { size: 8, fill: C.faint });
    ctx.save();
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(ix, iy + ih); ctx.stroke();
    ctx.restore();

    /* --- annotation --- */
    FK.kicker(ctx, 'to observer', W * 0.5, H - 13, { align: 'center', size: 8.5 });
    ctx.save();
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * 0.5, H - 33); ctx.lineTo(W * 0.5, H - 21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.5 - 3.5, H - 25); ctx.lineTo(W * 0.5, H - 20); ctx.lineTo(W * 0.5 + 3.5, H - 25);
    ctx.stroke(); ctx.restore();

    FK.kicker(ctx, 'circumbinary disk  ·  R_in ≈ 2.5 a', 14, 20, { size: 8.5 });
    FK.text(ctx, 'i = ' + Math.round(FK.DEG(iv)) + '°   α = ' + Math.round(FK.DEG(alphaMis)) + '°' +
      (ds < 0.04 ? '   face-on — no eclipse' : ''),
      14, 34, { font: FK.mono(9.5), fill: ds < 0.04 ? '#e0a45c' : C.dim });

    if (!extended) {
      FK.text(ctx, 'occulted source = white dwarf (point-like)', W * 0.5, H - 46,
        { font: FK.mono(10), fill: '#dbe8f2', align: 'center' });
    } else if (cov > 0.3) {
      FK.text(ctx, 'occulted by the disk edge', s1.x, s1.y - r1 - 12,
        { font: FK.mono(10), fill: '#f0bd86', align: 'center' });
    }

    /* scale bar */
    const bx = 14, by = H - 14;
    ctx.save(); ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + g.a, by);
    ctx.moveTo(bx, by - 3); ctx.lineTo(bx, by + 3);
    ctx.moveTo(bx + g.a, by - 3); ctx.lineTo(bx + g.a, by + 3); ctx.stroke(); ctx.restore();
    FK.text(ctx, 'a ≈ 0.24 AU', bx + g.a / 2, by - 5,
      { font: FK.mono(9), fill: C.dim, align: 'center' });

    /* readouts */
    if (out.phase) out.phase.textContent = phase.toFixed(3);
    if (out.days)  out.days.textContent = (phase * P_DAYS).toFixed(1) + ' d';
    if (out.flux)  out.flux.textContent = Math.round(modelFlux(phase) * 100) + '%';
    if (out.depth) out.depth.textContent = Math.round(DEPTH * ds * 100) + '%';
    if (out.iv)    out.iv.textContent = Math.round(FK.DEG(iv)) + '°';
    if (out.alpha) out.alpha.textContent = Math.round(FK.DEG(alphaMis)) + '°';
    if (out.rin)   out.rin.textContent = '≈' + RIN_OVER_A + ' a ≈ ' + RIN_RSUN + ' R⊙';
    if (out.ing)   out.ing.textContent = ingressDays().toFixed(1) + ' d';
  }

  /* ================= light curve ================= */
  function drawLC() {
    if (!LW) return;
    lctx.clearRect(0, 0, LW, LH);
    const lo = 1 - DEPTH - 0.13, hi = 1.08;
    const A = FK.axes(lctx, {
      l: 36, t: 10, r: LW - 8, b: LH - 26,
      x: { min: 0, max: 1, n: 4, label: 'phase  (P = 36.7107 d)', fmt: v => v.toFixed(2) },
      y: { min: lo, max: hi, n: 3, label: 'relative flux', fmt: v => v.toFixed(1) },
      grid: false, yTitleGap: 29
    });
    lcAx = A;
    FK.inBox(lctx, A.box, () => {
      const pts = (arr, col) => {
        if (!arr) return;
        lctx.fillStyle = col;
        for (const p of arr) {
          lctx.beginPath(); lctx.arc(A.X(p[0]), A.Y(p[1]), 1.8, 0, 7); lctx.fill();
        }
      };
      if (DD) {
        pts(DD.bands.r && DD.bands.r.points, 'rgba(217,112,60,.85)');
        pts(DD.bands.g && DD.bands.g.points, 'rgba(99,179,148,.95)');
      }
      FK.curve(lctx, 240, t => [A.X(t), A.Y(refFlux(t))],
        { stroke: 'rgba(216,206,180,.62)', width: 1.2, dash: [4, 3] });
      FK.curve(lctx, 300, t => [A.X(t), A.Y(modelFlux(t))],
        { stroke: extended ? C.amber : '#8ba9cf', width: 1.9 });
    });
    const ph = ((phase % 1) + 1) % 1;
    lctx.save();
    lctx.strokeStyle = 'rgba(244,238,226,.30)'; lctx.lineWidth = 1;
    lctx.beginPath(); lctx.moveTo(FK.snap(A.X(ph)), A.box.t); lctx.lineTo(FK.snap(A.X(ph)), A.box.b); lctx.stroke();
    lctx.fillStyle = C.ink;
    lctx.beginPath(); lctx.arc(A.X(ph), A.Y(modelFlux(ph)), 3.4, 0, 7); lctx.fill();
    lctx.restore();
    FK.legend(lctx, A.box.l + 8, A.box.t + 13, [
      { label: 'ZTF g', color: 'rgba(99,179,148,.95)', kind: 'dot' },
      { label: 'ZTF r', color: 'rgba(217,112,60,.9)', kind: 'dot' }
    ]);
    if (hover != null) {
      FK.chip(lctx, A.X(hover), A.Y(modelFlux(hover)),
        [(hover * P_DAYS).toFixed(1) + ' d   φ = ' + hover.toFixed(3),
         'model F = ' + modelFlux(hover).toFixed(3)], A.box);
    }
  }

  /* ================= plumbing ================= */
  function resize() {
    const a = FK.fit(canvas, ctx); if (a) { W = a.w; H = a.h; }
    const b = FK.fit(lcEl, lctx); if (b) { LW = b.w; LH = b.h; }
  }
  function render() { drawScene(); drawLC(); }

  resize(); render();
  const anim = FK.loop(canvas, dt => { phase = (phase + 0.0011 * speed * dt) % 1; render(); });
  FK.onResize(canvas, () => { resize(); render(); });
  FK.onResize(lcEl, () => { resize(); render(); });

  FK.pointer(canvas, { drag: p => { phase = ((p.x / Math.max(1, p.w)) % 1 + 1) % 1; render(); } });
  FK.pointer(lcEl, {
    move: p => { hover = lcAx ? FK.clamp(lcAx.invX(p.x), 0, 1) : null; drawLC(); },
    leave: () => { hover = null; drawLC(); },
    drag: p => { if (lcAx) { phase = FK.clamp(lcAx.invX(p.x), 0, 1); render(); } }
  });

  const on = (el, fn) => el && el.addEventListener('input', () => { fn(); render(); });
  on(inp.speed, () => { speed = +inp.speed.value; });
  on(inp.incl, () => { iv = FK.RAD(+inp.incl.value); });
  on(inp.alpha, () => { alphaMis = FK.RAD(+inp.alpha.value); });
  if (inp.toggle) inp.toggle.addEventListener('click', () => {
    extended = !extended;
    inp.toggle.textContent = 'Occulted source: ' + (extended ? 'M/K dwarf' : 'white dwarf');
    inp.toggle.setAttribute('aria-pressed', String(!extended));
    render();
  });
  if (inp.pause) inp.pause.addEventListener('click', () => {
    anim.paused = !anim.paused;
    inp.pause.textContent = anim.paused ? 'Play' : 'Pause';
    inp.pause.setAttribute('aria-pressed', String(anim.paused));
    render();
  });
  anim.start();
})();
