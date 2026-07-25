/* =================================================================
   uikit.js — the interface kit.

   figkit.js draws *physics*: framed axes, ticks, limb-darkened discs.
   This is its sibling for the *interface* figures on the AI page —
   the phone the GUI agent drives, the knowledge graph the lab agent
   reads, the node graphs the research agent walks.

   The rule is the same one figkit follows: anything that decides
   whether a canvas reads as a real interface or as clip-art lives
   here exactly once.

     · a true superellipse, so app icons are squircles and not
       rounded squares with a circular arc bolted on
     · device metrics in iOS points, scaled to whatever box we get,
       so the grid, the dock and the home indicator are in proportion
     · drawn glyphs — a cup, a bubble, a gear — never a letter in a
       coloured box, which is the tell of a wireframe
     · the agent's own vocabulary: a grounded-element bracket, a tap
       ripple with real easing, a pointer, an "in control" banner
     · graph furniture: convex hulls with smoothed corners for
       communities, curved typed edges, decluttered labels

   Public surface: window.UI
   ================================================================= */
window.UI = (function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

  /* ---------------- type ---------------- */
  const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const SANS = '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif';
  const SERIF = '"Newsreader", Georgia, serif';
  const mono = (s, w) => (w || 400) + ' ' + s + 'px ' + MONO;
  const sans = (s, w) => (w || 400) + ' ' + s + 'px ' + SANS;
  const serif = (s, w) => (w || 400) + ' ' + s + 'px ' + SERIF;

  const CAN_TRACK = (typeof CanvasRenderingContext2D !== 'undefined') &&
                    ('letterSpacing' in CanvasRenderingContext2D.prototype);
  function track(ctx, v) { if (CAN_TRACK) ctx.letterSpacing = v || '0px'; }

  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = o.font || sans(12);
    ctx.fillStyle = o.fill || '#f4eee2';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    track(ctx, o.track);
    ctx.fillText(s, x, y);
    track(ctx, '0px');
    ctx.restore();
  }

  /* Truncate to a pixel width with a real ellipsis — labels that run
     under their neighbour are the single commonest way a generated
     interface gives itself away. */
  function fitText(ctx, s, maxW, font) {
    ctx.save();
    if (font) ctx.font = font;
    if (ctx.measureText(s).width <= maxW) { ctx.restore(); return s; }
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
    }
    ctx.restore();
    return lo > 0 ? s.slice(0, lo) + '…' : '';
  }

  /* ---------------- palette ----------------
     The page is warm paper; the plates are warm graphite. A phone
     screen inside a warm plate that renders in cold iOS blue-grey
     looks pasted in, so every neutral here carries the same warm
     bias as figkit's, and the "brand" hues are pulled toward it. */
  const C = {
    /* on-plate neutrals (shared with figkit) */
    ink: '#f4eee2', soft: '#d8ceb4', dim: '#aca287', faint: '#7f7663',
    rule: 'rgba(216,206,180,.34)', rule2: 'rgba(216,206,180,.20)',
    grid: 'rgba(216,206,180,.085)',
    plate: '#0e0c08', plateLine: '#2b2418',

    /* accents — the site's ochre, and the cool counterpart */
    amber: '#e0a45c', amberD: '#c07f36', amberL: '#f3c98f',
    steel: '#8ba9cf', steelD: '#5c7ba4',
    mint: '#63b394', ember: '#d9703c', plum: '#b07fa8',

    /* device: a warm near-black glass, not iOS graphite */
    glass: '#12100c', glass2: '#1b1710',
    chrome: '#0a0906',
    onGlass: '#f6f1e6', onGlassDim: 'rgba(246,241,230,.56)',
    onGlassFaint: 'rgba(246,241,230,.26)',
    fill: 'rgba(246,241,230,.07)',
    fill2: 'rgba(246,241,230,.12)',
    sep: 'rgba(246,241,230,.10)'
  };

  /* Typed-entity palette for graphs. Wong-derived, then warmed so it
     sits on the same plate as everything else. Six is the ceiling —
     past that a legend stops being readable and starts being a key. */
  const TYPES = {
    solvent:  { c: '#7fa8d0', name: 'Solvent' },
    salt:     { c: '#e0a45c', name: 'Li salt' },
    additive: { c: '#63b394', name: 'Additive' },
    prop:     { c: '#b98bb4', name: 'Interphase / property' },
    method:   { c: '#c98b6b', name: 'Method' },
    metric:   { c: '#cbbf94', name: 'Metric' }
  };

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function shade(hex, f) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    const b = clamp(Math.round((n & 255) * f), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------------- easing ----------------
     Named curves, so a transition is chosen rather than defaulted.
     `emphasised` is the Material 3 emphasised-decelerate shape; the
     spring is a critically-ish damped overshoot for anything that
     lands (a sheet, a pressed key, a node snapping into focus). */
  const E = {
    linear: t => t,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    emphasised: t => 1 - Math.pow(1 - t, 4.2),
    spring: t => t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 11.5),
    pulse: t => Math.sin(clamp(t, 0, 1) * Math.PI)
  };

  /* ================================================================
     GEOMETRY
     ================================================================ */

  /* An ordinary rounded rectangle, per-corner radii allowed:
     r may be a number or [tl, tr, br, bl]. */
  function rrect(ctx, x, y, w, h, r) {
    if (!(w > 0) || !(h > 0)) return;
    const a = Array.isArray(r) ? r : [r, r, r, r];
    const m = Math.min(w, h) / 2;
    const tl = clamp(a[0], 0, m), tr = clamp(a[1], 0, m),
          br = clamp(a[2], 0, m), bl = clamp(a[3], 0, m);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  /* The squircle: |x/a|^n + |y/b|^n = 1.
     n = 2 is an ellipse, n → ∞ a rectangle. Apple's icon mask sits
     near n = 5, which is why an iOS icon's corner never shows the
     seam where a circular arc meets a straight edge. Sampled rather
     than Bézier-approximated: 64 segments is under a pixel of error
     at any size we draw, and the code stays honest. */
  function squircle(ctx, x, y, w, h, n) {
    n = n || 5;
    const a = w / 2, b = h / 2, cx = x + a, cy = y + b;
    const N = 64, e = 2 / n;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N * TAU;
      const ct = Math.cos(t), st = Math.sin(t);
      const px = cx + a * Math.sign(ct) * Math.pow(Math.abs(ct), e);
      const py = cy + b * Math.sign(st) * Math.pow(Math.abs(st), e);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  /* A capsule — the shape of every pill, dock item and toast. */
  function capsule(ctx, x, y, w, h) { rrect(ctx, x, y, w, h, h / 2); }

  function snap(v) { const d = dprOf(); return Math.round(v * d - 0.5) / d + 0.5 / d; }
  function hair(ctx, alpha) {
    ctx.lineWidth = dprOf() > 1 ? 0.75 : 1;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
  }

  function fit(canvas, ctx) {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = dprOf();
    if (!(w > 0 && h > 0)) return null;
    const bw = Math.max(1, Math.round(w * d)), bh = Math.max(1, Math.round(h * d));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return { w, h, dpr: d };
  }

  /* ================================================================
     DEVICE — metrics in iOS points at a 393 pt reference width, then
     scaled to whatever box the CSS gives us. Laying the screen out in
     points rather than in fractions of the canvas is the difference
     between a phone and a diagram of a phone: the status bar does not
     grow when the plate does, and the icon grid keeps its pitch.
     ================================================================ */
  const REF_W = 393;                       // iPhone 16 logical width
  const M = {
    statusH: 54,
    islandW: 124, islandH: 36, islandTop: 12,
    islandOpenW: 214, islandOpenH: 42,     // wide enough to read, narrow
                                           // enough to leave the clock and
                                           // the battery visible beside it
    gutter: 27,                            // page side margin
    iconSize: 60, iconGapX: 26, iconGapY: 30, labelGap: 17,
    widgetTop: 98, widgetH: 178,
    gridTop: 304,                          // below the widget
    dockH: 92, dockPadX: 16, dockBottom: 72, dockR: 32,
    homeW: 140, homeH: 5, homeBottom: 9,
    navH: 50, tabH: 64
  };

  /* A screen: everything drawn through it is in points, so a figure
     can be written once and look right at 240 px or 340 px wide. */
  function screen(ctx, w, h) {
    const u = w / REF_W;                   // points → CSS px
    const S = {
      ctx, w, h, u,
      px: p => p * u,
      H: h / u,                            // screen height in points
      W: REF_W,
      /* run fn in point space */
      pts(fn) { ctx.save(); ctx.scale(u, u); fn(S); ctx.restore(); },
      /* map a point-space coordinate back to canvas px */
      toPx: (px, py) => [px * u, py * u]
    };
    return S;
  }

  /* ---- wallpaper ----
     A real home screen is never a flat fill: there is a light source,
     and the icons cast the eye toward it. Two overlaid radials and a
     vignette is all it takes, and it stops the screen reading as a
     rectangle of hex colour. */
  function wallpaper(ctx, w, h, o) {
    o = o || {};
    ctx.save();
    ctx.fillStyle = o.base || '#0d0b08';
    ctx.fillRect(0, 0, w, h);
    const g1 = ctx.createRadialGradient(w * .68, h * .16, 0, w * .68, h * .16, h * .62);
    g1.addColorStop(0, o.glow || 'rgba(224,164,92,.16)');
    g1.addColorStop(.55, 'rgba(224,164,92,.045)');
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
    const g2 = ctx.createRadialGradient(w * .14, h * .82, 0, w * .14, h * .82, h * .5);
    g2.addColorStop(0, o.glow2 || 'rgba(139,169,207,.10)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w * .5, h * .45, h * .28, w * .5, h * .5, h * .78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* ---- status bar ----
     Drawn, not typed: signal staircase, 5G, battery capsule with a
     nub. The clock is 17 pt semibold, which is the real metric. */
  function statusBar(S, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const y = 36;
      text(ctx, o.time || '9:41', 32, y, { font: sans(17, 600), fill: C.onGlass });

      let x = REF_W - 30;
      /* battery */
      const bw = 25, bh = 12;
      ctx.save();
      ctx.strokeStyle = C.onGlassDim; ctx.lineWidth = 1.1;
      rrect(ctx, x - bw, y - 9.5, bw, bh, 3.6); ctx.stroke();
      ctx.fillStyle = C.onGlassDim;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 1.2, y - 5.5, 1.8, 4, 1) : ctx.rect(x + 1.2, y - 5.5, 1.8, 4);
      ctx.fill();
      const lvl = o.battery == null ? .78 : o.battery;
      ctx.fillStyle = lvl < .2 ? C.ember : C.onGlass;
      rrect(ctx, x - bw + 2, y - 7.5, (bw - 4) * lvl, bh - 4, 2); ctx.fill();
      ctx.restore();
      x -= bw + 8;

      /* 5G */
      text(ctx, o.net || '5G', x, y, { font: sans(14, 600), fill: C.onGlassDim, align: 'right' });
      x -= ctx.measureText ? 22 : 22;

      /* signal staircase */
      ctx.save();
      const bars = o.signal == null ? 4 : o.signal;
      for (let i = 0; i < 4; i++) {
        const bh2 = 4 + i * 2.7, bx = x - (4 - i) * 5.2;
        ctx.fillStyle = i < bars ? C.onGlass : C.onGlassFaint;
        rrect(ctx, bx, y - bh2, 3.2, bh2, 1.1); ctx.fill();
      }
      ctx.restore();
    });
  }

  /* ---- Dynamic Island ----
     Present even when idle: it is the strongest single cue that this
     is a 2026 phone. When the agent takes over it expands, which is
     also how a real system-level activity announces itself. */
  function island(S, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const t = clamp(o.expand || 0, 0, 1);
      const w = lerp(M.islandW, M.islandOpenW, E.emphasised(t));
      const h = lerp(M.islandH, M.islandOpenH, E.emphasised(t));
      const x = (REF_W - w) / 2, y = M.islandTop;
      ctx.save();
      capsule(ctx, x, y, w, h);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.strokeStyle = 'rgba(246,241,230,.07)'; ctx.lineWidth = 1; ctx.stroke();
      if (t > .06 && o.label) {
        ctx.globalAlpha = clamp((t - .06) / .5, 0, 1);
        const dot = x + 17;
        ctx.fillStyle = o.color || C.amber;
        ctx.beginPath(); ctx.arc(dot, y + h / 2, 3.6, 0, TAU); ctx.fill();
        const rightW = o.right ? 46 : 0;
        text(ctx, fitText(ctx, o.label, w - 40 - rightW, sans(12, 600)), dot + 10, y + h / 2 + 4,
          { font: sans(12, 600), fill: C.onGlass });
        if (o.right) {
          text(ctx, o.right, x + w - 14, y + h / 2 + 4,
            { font: mono(11, 500), fill: o.color || C.amber, align: 'right' });
        }
      } else {
        /* the camera pinhole, so the idle island isn't a black slab */
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.beginPath(); ctx.arc(x + w - 19, y + h / 2, 5.2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(120,150,190,.22)';
        ctx.beginPath(); ctx.arc(x + w - 19, y + h / 2, 2.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
  }

  function homeIndicator(S) {
    const ctx = S.ctx;
    S.pts(S2 => {
      const y = S2.H - M.homeBottom - M.homeH;
      capsule(ctx, (REF_W - M.homeW) / 2, y, M.homeW, M.homeH);
      ctx.fillStyle = 'rgba(246,241,230,.5)'; ctx.fill();
    });
  }

  /* ================================================================
     APP ICONS — a squircle, a gradient, and a real glyph.
     The glyph set is deliberately small and drawn with the same
     stroke discipline as the rest of the site: 2 pt strokes, round
     caps, no fill unless the object is solid.
     ================================================================ */
  const GLYPH = {
    coffee(ctx, s) {                                   // cup + saucer + steam
      const k = s / 60;
      ctx.lineWidth = 2.6 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-13 * k, -8 * k); ctx.lineTo(-10.5 * k, 10 * k);
      ctx.quadraticCurveTo(-10 * k, 14 * k, -6 * k, 14 * k);
      ctx.lineTo(6 * k, 14 * k);
      ctx.quadraticCurveTo(10 * k, 14 * k, 10.5 * k, 10 * k);
      ctx.lineTo(13 * k, -8 * k); ctx.closePath(); ctx.stroke();
      ctx.beginPath();                                  // handle
      ctx.moveTo(13 * k, -3 * k);
      ctx.quadraticCurveTo(21 * k, -2 * k, 18.5 * k, 4 * k);
      ctx.quadraticCurveTo(16.5 * k, 8 * k, 11.6 * k, 7 * k);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14 * k, -8 * k); ctx.lineTo(14 * k, -8 * k); ctx.stroke();
      ctx.globalAlpha = .55;                            // steam
      ctx.lineWidth = 2 * k;
      [-5, 2].forEach((dx, i) => {
        ctx.beginPath();
        ctx.moveTo(dx * k, -14 * k);
        ctx.quadraticCurveTo((dx + 4) * k, -18 * k, dx * k, -22 * k);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    },
    chat(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.6 * k; ctx.lineJoin = 'round';
      ctx.beginPath();
      rrect(ctx, -16 * k, -13 * k, 32 * k, 23 * k, 8 * k);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8 * k, 10 * k); ctx.lineTo(-8 * k, 18 * k); ctx.lineTo(-1 * k, 10 * k);
      ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      ctx.fillStyle = ctx.strokeStyle;
      [-7, 0, 7].forEach(dx => { ctx.beginPath(); ctx.arc(dx * k, -1.5 * k, 2.1 * k, 0, TAU); ctx.fill(); });
    },
    calendar(ctx, s, o) {
      const k = s / 60;
      ctx.lineWidth = 2.4 * k;
      ctx.beginPath(); rrect(ctx, -15 * k, -14 * k, 30 * k, 29 * k, 6 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-15 * k, -5 * k); ctx.lineTo(15 * k, -5 * k); ctx.stroke();
      ctx.lineWidth = 2.8 * k;
      [-7, 7].forEach(dx => { ctx.beginPath(); ctx.moveTo(dx * k, -20 * k); ctx.lineTo(dx * k, -12 * k); ctx.stroke(); });
      text(ctx, (o && o.day) || '24', 0, 10 * k, { font: sans(15 * k, 700), fill: ctx.strokeStyle, align: 'center' });
    },
    clock(ctx, s, o) {
      const k = s / 60, t = (o && o.t) || 0;
      ctx.lineWidth = 2.4 * k;
      ctx.beginPath(); ctx.arc(0, 0, 17 * k, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.4 * k; ctx.globalAlpha = .5;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 14 * k, Math.sin(a) * 14 * k);
        ctx.lineTo(Math.cos(a) * 16 * k, Math.sin(a) * 16 * k);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.6 * k; ctx.lineCap = 'round';
      const hA = -Math.PI / 2 + t * .12, mA = -Math.PI / 2 + t * 1.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hA) * 8 * k, Math.sin(hA) * 8 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mA) * 12.5 * k, Math.sin(mA) * 12.5 * k); ctx.stroke();
    },
    map(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.4 * k; ctx.lineJoin = 'round';
      ctx.beginPath();                                   // folded map
      ctx.moveTo(-17 * k, -10 * k); ctx.lineTo(-6 * k, -14 * k);
      ctx.lineTo(6 * k, -10 * k); ctx.lineTo(17 * k, -14 * k);
      ctx.lineTo(17 * k, 12 * k); ctx.lineTo(6 * k, 16 * k);
      ctx.lineTo(-6 * k, 12 * k); ctx.lineTo(-17 * k, 16 * k);
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = .55;
      ctx.beginPath(); ctx.moveTo(-6 * k, -14 * k); ctx.lineTo(-6 * k, 12 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6 * k, -10 * k); ctx.lineTo(6 * k, 16 * k); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    photo(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.4 * k; ctx.lineJoin = 'round';
      ctx.beginPath(); rrect(ctx, -16 * k, -13 * k, 32 * k, 26 * k, 6 * k); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(-7 * k, -5 * k, 3.2 * k, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14 * k, 10 * k); ctx.lineTo(-3 * k, -1 * k);
      ctx.lineTo(5 * k, 7 * k); ctx.lineTo(10 * k, 2 * k); ctx.lineTo(14 * k, 10 * k);
      ctx.stroke();
    },
    camera(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.4 * k; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-17 * k, -6 * k); ctx.lineTo(-9 * k, -6 * k); ctx.lineTo(-6 * k, -12 * k);
      ctx.lineTo(6 * k, -12 * k); ctx.lineTo(9 * k, -6 * k); ctx.lineTo(17 * k, -6 * k);
      ctx.quadraticCurveTo(19 * k, -6 * k, 19 * k, -3 * k);
      ctx.lineTo(19 * k, 11 * k);
      ctx.quadraticCurveTo(19 * k, 14 * k, 16 * k, 14 * k);
      ctx.lineTo(-16 * k, 14 * k);
      ctx.quadraticCurveTo(-19 * k, 14 * k, -19 * k, 11 * k);
      ctx.lineTo(-19 * k, -3 * k);
      ctx.quadraticCurveTo(-19 * k, -6 * k, -17 * k, -6 * k);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 2 * k, 7.5 * k, 0, TAU); ctx.stroke();
    },
    gear(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.4 * k; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a0 = i / 8 * TAU, a1 = (i + .5) / 8 * TAU;
        const r0 = 17 * k, r1 = 12.5 * k;
        ctx.lineTo(Math.cos(a0 - .16) * r0, Math.sin(a0 - .16) * r0);
        ctx.lineTo(Math.cos(a0 + .16) * r0, Math.sin(a0 + .16) * r0);
        ctx.lineTo(Math.cos(a1 - .22) * r1, Math.sin(a1 - .22) * r1);
        ctx.lineTo(Math.cos(a1 + .22) * r1, Math.sin(a1 + .22) * r1);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 6 * k, 0, TAU); ctx.stroke();
    },
    browser(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.3 * k;
      ctx.beginPath(); ctx.arc(0, 0, 17 * k, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5 * k, 17 * k, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16 * k, -5.5 * k); ctx.lineTo(16 * k, -5.5 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16 * k, 5.5 * k); ctx.lineTo(16 * k, 5.5 * k); ctx.stroke();
    },
    notes(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.4 * k; ctx.lineJoin = 'round';
      ctx.beginPath(); rrect(ctx, -14 * k, -16 * k, 28 * k, 32 * k, 5 * k); ctx.stroke();
      ctx.lineWidth = 2 * k; ctx.globalAlpha = .7;
      [-7, 0, 7].forEach((dy, i) => {
        ctx.beginPath();
        ctx.moveTo(-8 * k, dy * k); ctx.lineTo((i === 2 ? 2 : 8) * k, dy * k); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    },
    phone(ctx, s) {                                    // handset
      const k = s / 60;
      ctx.lineWidth = 2.8 * k; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-15 * k, -14 * k);
      ctx.quadraticCurveTo(-17 * k, -8 * k, -12 * k, -3 * k);
      ctx.quadraticCurveTo(-2 * k, 8 * k, 4 * k, 12 * k);
      ctx.quadraticCurveTo(9 * k, 16 * k, 15 * k, 14 * k);
      ctx.lineTo(17 * k, 8 * k);
      ctx.quadraticCurveTo(11 * k, 3 * k, 6 * k, 5 * k);
      ctx.lineTo(-5 * k, -6 * k);
      ctx.quadraticCurveTo(-3 * k, -11 * k, -8 * k, -17 * k);
      ctx.closePath(); ctx.stroke();
    },
    music(ctx, s) {
      const k = s / 60;
      ctx.lineWidth = 2.6 * k; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6 * k, 11 * k); ctx.lineTo(-6 * k, -12 * k);
      ctx.lineTo(15 * k, -16 * k); ctx.lineTo(15 * k, 6 * k);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.ellipse(-10.5 * k, 11 * k, 5 * k, 4.2 * k, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10.5 * k, 6 * k, 5 * k, 4.2 * k, 0, 0, TAU); ctx.fill();
    }
  };

  /* Icon face: a two-stop gradient at 135°, a hairline inner rim to
     catch the light, then the glyph. The rim is what makes a flat
     fill look like a physical tile. */
  function appIcon(ctx, cx, cy, size, spec, o) {
    o = o || {};
    const half = size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (o.press) { const k = 1 - .06 * o.press; ctx.scale(k, k); }

    squircle(ctx, -half, -half, size, size, 5);
    const g = ctx.createLinearGradient(-half, -half, half, half);
    g.addColorStop(0, shade(spec.c, 1.22));
    g.addColorStop(1, shade(spec.c, .74));
    ctx.fillStyle = g; ctx.fill();

    ctx.save(); ctx.clip();
    const rim = ctx.createLinearGradient(0, -half, 0, half * .3);
    rim.addColorStop(0, 'rgba(255,255,255,.22)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rim; ctx.fillRect(-half, -half, size, size * .7);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
    squircle(ctx, -half + .5, -half + .5, size - 1, size - 1, 5); ctx.stroke();

    const draw = GLYPH[spec.g];
    if (draw) {
      ctx.strokeStyle = spec.fg || 'rgba(255,255,255,.94)';
      ctx.fillStyle = spec.fg || 'rgba(255,255,255,.94)';
      ctx.lineCap = 'round';
      draw(ctx, size * .62, o);
    }
    ctx.restore();
  }

  /* ---- the widget ----
     No phone since about 2020 has a home screen that is only icons,
     and a screen that is only icons has a hole in the middle of it.
     A date-and-weather pair is the most ordinary widget there is,
     which is exactly why it makes the screen read as somebody's. */
  function homeWidget(S, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const x = M.gutter - 7, y = M.widgetTop, w = REF_W - (M.gutter - 7) * 2, h = M.widgetH;
      rrect(ctx, x, y, w, h, 26);
      ctx.save();
      ctx.fillStyle = 'rgba(246,241,230,.085)'; ctx.fill();
      ctx.strokeStyle = 'rgba(246,241,230,.10)'; ctx.lineWidth = 1; ctx.stroke();
      rrect(ctx, x, y, w, h, 26); ctx.clip();

      /* left: the date */
      text(ctx, o.weekday || '周四 Thursday', x + 22, y + 34,
        { font: sans(12.5, 600), fill: rgba(C.ember, .95) });
      text(ctx, o.day || '24', x + 20, y + 92, { font: sans(58, 600), fill: C.onGlass });
      text(ctx, o.month || '七月 · July', x + 22, y + 116,
        { font: sans(12), fill: C.onGlassDim });

      /* a divider, then the weather */
      ctx.strokeStyle = 'rgba(246,241,230,.10)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(snap(x + w * .48), y + 24); ctx.lineTo(snap(x + w * .48), y + h - 24);
      ctx.stroke();

      const wx = x + w * .48 + 22;
      /* sun behind a cloud, drawn rather than emoji'd */
      ctx.save();
      ctx.translate(wx + 14, y + 40);
      ctx.strokeStyle = rgba(C.amber, .95); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-2, -4, 7.5, -Math.PI, .35); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI + .1 + i * (Math.PI * 1.1 / 5);
        ctx.beginPath();
        ctx.moveTo(-2 + Math.cos(a) * 10.5, -4 + Math.sin(a) * 10.5);
        ctx.lineTo(-2 + Math.cos(a) * 13.5, -4 + Math.sin(a) * 13.5);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(246,241,230,.9)';
      ctx.beginPath();
      ctx.arc(2, 8, 8, Math.PI, TAU); ctx.arc(13, 10, 6, -Math.PI / 2, TAU);
      ctx.lineTo(15, 16); ctx.lineTo(-8, 16); ctx.closePath(); ctx.fill();
      ctx.restore();

      text(ctx, o.temp || '28°', wx + 44, y + 50, { font: sans(30, 500), fill: C.onGlass });
      text(ctx, o.place || '广州 · 多云转晴', wx, y + 76, { font: sans(12), fill: C.onGlassDim });

      /* a three-hour strip, the standard weather-widget footer */
      const hrs = o.hours || [['10', 28], ['12', 31], ['14', 33], ['16', 32]];
      const bw = (w * .52 - 44) / hrs.length;
      hrs.forEach((hh, i) => {
        const bx = wx + i * bw;
        text(ctx, hh[0] + '时', bx, y + 104, { font: mono(9.5), fill: C.onGlassFaint });
        const bar = 26 * ((hh[1] - 24) / 12);
        rrect(ctx, bx, y + 142 - bar, 5, bar, 2.5);
        ctx.fillStyle = rgba(C.amber, .75); ctx.fill();
        text(ctx, hh[1] + '°', bx, y + 158, { font: mono(9.5), fill: C.onGlassDim });
      });
      ctx.restore();
    });
  }

  /* ---- the home-screen grid ---- */
  function iconCell(col, row) {
    const pitchX = (REF_W - M.gutter * 2 - M.iconSize) / 3;
    const x = M.gutter + M.iconSize / 2 + col * pitchX;
    const y = M.gridTop + M.iconSize / 2 + row * (M.iconSize + M.labelGap + M.iconGapY);
    return [x, y];
  }

  function homeGrid(S, apps, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      apps.forEach((a, i) => {
        const [x, y] = iconCell(i % 4, Math.floor(i / 4));
        const hot = o.highlight === a.id;
        appIcon(ctx, x, y, M.iconSize, a, { press: hot ? (o.press || 0) : 0, t: o.t || 0, day: o.day });
        text(ctx, a.name, x, y + M.iconSize / 2 + 15,
          { font: sans(11.5, 500), fill: hot ? C.onGlass : 'rgba(246,241,230,.82)', align: 'center' });
      });
    });
  }

  function dock(S, apps, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(S2 => {
      const h = M.dockH, w = REF_W - M.dockPadX * 2;
      const y = S2.H - M.dockBottom - h, x = M.dockPadX;
      ctx.save();
      rrect(ctx, x, y, w, h, M.dockR);
      ctx.fillStyle = 'rgba(246,241,230,.10)'; ctx.fill();
      ctx.strokeStyle = 'rgba(246,241,230,.10)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      const size = 58, pitch = (w - 32 - size) / 3;
      apps.slice(0, 4).forEach((a, i) => {
        appIcon(ctx, x + 16 + size / 2 + i * pitch, y + h / 2, size, a,
          { press: o.highlight === a.id ? (o.press || 0) : 0, t: o.t || 0 });
      });
    });
  }

  function pageDots(S, n, active) {
    const ctx = S.ctx;
    S.pts(S2 => {
      const y = S2.H - M.dockBottom - M.dockH - 20;
      const pitch = 14, x0 = REF_W / 2 - (n - 1) * pitch / 2;
      for (let i = 0; i < n; i++) {
        ctx.beginPath(); ctx.arc(x0 + i * pitch, y, 3.4, 0, TAU);
        ctx.fillStyle = i === active ? 'rgba(246,241,230,.92)' : 'rgba(246,241,230,.3)';
        ctx.fill();
      }
    });
  }

  /* ================================================================
     IN-APP CHROME
     ================================================================ */

  /* A large-title navigation bar with a back chevron, the pattern
     every phone OS converged on. */
  function navBar(S, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const y = M.statusH;
      ctx.fillStyle = o.fill || 'rgba(18,16,12,.86)';
      ctx.fillRect(0, 0, REF_W, y + M.navH);
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + M.navH); ctx.lineTo(REF_W, y + M.navH); ctx.stroke();
      if (o.back !== false) {
        ctx.strokeStyle = o.tint || C.amber; ctx.lineWidth = 2.4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const cx = 30, cy = y + M.navH / 2;
        ctx.beginPath(); ctx.moveTo(cx + 4, cy - 7); ctx.lineTo(cx - 3, cy); ctx.lineTo(cx + 4, cy + 7); ctx.stroke();
      }
      text(ctx, o.title || '', REF_W / 2, y + M.navH / 2 + 6,
        { font: sans(17, 600), fill: C.onGlass, align: 'center' });
      if (o.right) {
        text(ctx, o.right, REF_W - 26, y + M.navH / 2 + 5,
          { font: sans(15, 500), fill: o.tint || C.amber, align: 'right' });
      }
    });
  }

  /* A content card in a list: title, subtitle, trailing value, and an
     optional selected state that reads as selection rather than as a
     second button. */
  function listCard(S, y, o) {
    const ctx = S.ctx;
    o = o || {};
    S.pts(() => {
      const x = 20, w = REF_W - 40, h = o.h || 74;
      ctx.save();
      rrect(ctx, x, y, w, h, 16);
      ctx.fillStyle = o.on ? rgba(C.amber, .13) : C.fill; ctx.fill();
      if (o.on) { ctx.strokeStyle = rgba(C.amber, .75); ctx.lineWidth = 1.6; ctx.stroke(); }
      else { ctx.strokeStyle = C.sep; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();

      /* thumbnail */
      if (o.thumb) {
        const ts = h - 22;
        squircle(ctx, x + 12, y + 11, ts, ts, 4.4);
        const g = ctx.createLinearGradient(x + 12, y + 11, x + 12 + ts, y + 11 + ts);
        g.addColorStop(0, shade(o.thumb, 1.15)); g.addColorStop(1, shade(o.thumb, .7));
        ctx.fillStyle = g; ctx.fill();
        if (o.thumbGlyph && GLYPH[o.thumbGlyph]) {
          ctx.save();
          ctx.translate(x + 12 + ts / 2, y + 11 + ts / 2);
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineCap = 'round';
          GLYPH[o.thumbGlyph](ctx, ts * .6, {});
          ctx.restore();
        }
      }
      const tx = o.thumb ? x + 12 + (h - 22) + 14 : x + 16;
      const tw = x + w - tx - (o.value ? 74 : 16);
      text(ctx, fitText(ctx, o.title || '', tw, sans(15.5, 600)), tx, y + (o.sub ? 30 : h / 2 + 5),
        { font: sans(15.5, 600), fill: C.onGlass });
      if (o.sub) {
        text(ctx, fitText(ctx, o.sub, tw, sans(12.5)), tx, y + 50,
          { font: sans(12.5), fill: o.subTint || C.onGlassDim });
      }
      if (o.value) {
        text(ctx, o.value, x + w - 16, y + h / 2 + 5,
          { font: mono(14, 500), fill: o.on ? C.amberL : C.onGlass, align: 'right' });
      }
      if (o.badge) {
        const bw = 52;
        capsule(ctx, x + w - 16 - bw, y + 12, bw, 19);
        ctx.fillStyle = rgba(C.amber, .2); ctx.fill();
        text(ctx, o.badge, x + w - 16 - bw / 2, y + 25.5,
          { font: mono(9.5, 500), fill: C.amberL, align: 'center', track: '.06em' });
      }
    });
  }

  /* The primary call to action, floating above a blur. */
  function cta(S, y, label, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const x = 20, w = REF_W - 40, h = 52;
      capsule(ctx, x, y, w, h);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      const base = o.tint || C.amber;
      g.addColorStop(0, shade(base, 1.1)); g.addColorStop(1, shade(base, .86));
      ctx.fillStyle = o.disabled ? C.fill2 : g; ctx.fill();
      if (o.press) {
        ctx.fillStyle = 'rgba(0,0,0,.18)'; capsule(ctx, x, y, w, h); ctx.fill();
      }
      text(ctx, label, REF_W / 2, y + h / 2 + 6,
        { font: sans(16, 700), fill: o.disabled ? C.onGlassDim : '#20170c', align: 'center' });
    });
  }

  /* A text field with a caret, and the keyboard beneath it. Typing is
     the one interaction a GUI agent does that a tap ripple cannot
     show, so it gets real furniture. */
  function inputBar(S, y, value, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const h = 44, x = 16, w = REF_W - 32 - (o.send ? 66 : 0);
      capsule(ctx, x, y, w, h);
      ctx.fillStyle = C.fill; ctx.fill();
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1; ctx.stroke();
      const shown = fitText(ctx, value || o.placeholder || '', w - 34, sans(14.5));
      text(ctx, shown, x + 17, y + h / 2 + 5,
        { font: sans(14.5), fill: value ? C.onGlass : C.onGlassFaint });
      if (value && o.caret) {
        const cw = ctx.measureText ? (ctx.save(), ctx.font = sans(14.5), ctx.measureText(shown).width) : 0;
        if (ctx.restore) ctx.restore();
        ctx.fillStyle = C.amber;
        ctx.globalAlpha = o.caret;
        ctx.fillRect(x + 19 + cw, y + 12, 1.8, h - 24);
        ctx.globalAlpha = 1;
      }
      if (o.send) {
        const sx = REF_W - 16 - 50;
        capsule(ctx, sx, y, 50, h);
        ctx.fillStyle = o.sendOn ? C.amber : C.fill2; ctx.fill();
        text(ctx, 'Send', sx + 25, y + h / 2 + 5,
          { font: sans(13.5, 600), fill: o.sendOn ? '#20170c' : C.onGlassDim, align: 'center' });
      }
    });
  }

  function keyboard(S, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(S2 => {
      const h = 216, y = S2.H - h;
      ctx.fillStyle = 'rgba(20,18,14,.96)'; ctx.fillRect(0, y, REF_W, h);
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(REF_W, y); ctx.stroke();
      const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
      const kw = 32, kh = 40, gap = 5.5;
      rows.forEach((r, ri) => {
        const total = r.length * kw + (r.length - 1) * gap;
        const x0 = (REF_W - total) / 2;
        const ky = y + 14 + ri * (kh + 10);
        for (let i = 0; i < r.length; i++) {
          const kx = x0 + i * (kw + gap);
          const lit = o.key && o.key === r[i];
          rrect(ctx, kx, ky, kw, kh, 6);
          ctx.fillStyle = lit ? rgba(C.amber, .82) : 'rgba(246,241,230,.14)'; ctx.fill();
          text(ctx, r[i], kx + kw / 2, ky + kh / 2 + 6,
            { font: sans(16, 500), fill: lit ? '#20170c' : C.onGlass, align: 'center' });
        }
      });
      const sy = y + 14 + 3 * (kh + 10);
      rrect(ctx, 96, sy, REF_W - 192, kh, 6);
      ctx.fillStyle = 'rgba(246,241,230,.14)'; ctx.fill();
      text(ctx, 'space', REF_W / 2, sy + kh / 2 + 5,
        { font: sans(13), fill: C.onGlassDim, align: 'center' });
    });
  }

  /* A chat bubble with a real tail. */
  function bubble(S, y, str, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      ctx.save();
      ctx.font = sans(14.5);
      const maxW = REF_W * .62;
      const words = String(str).split(' ');
      const lines = []; let cur = '';
      words.forEach(word => {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > maxW - 28 && cur) { lines.push(cur); cur = word; }
        else cur = test;
      });
      if (cur) lines.push(cur);
      const tw = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
      ctx.restore();
      const w = tw + 28, h = lines.length * 20 + 20;
      const x = o.me ? REF_W - 18 - w : 18;
      rrect(ctx, x, y, w, h, o.me ? [18, 18, 5, 18] : [18, 18, 18, 5]);
      ctx.fillStyle = o.me ? rgba(C.amber, .9) : C.fill2; ctx.fill();
      lines.forEach((l, i) => text(ctx, l, x + 14, y + 25 + i * 20,
        { font: sans(14.5), fill: o.me ? '#20170c' : C.onGlass }));
    });
  }

  /* ================================================================
     AGENT OVERLAYS — the vocabulary that says "software is driving".
     ================================================================ */

  /* The grounded element. Corner brackets rather than a full box: a
     full box hides the thing it is pointing at, and every shipped
     computer-use product ends up at brackets for the same reason. */
  function groundBox(S, box, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const [x, y, w, h] = box;
      const a = clamp(o.alpha == null ? 1 : o.alpha, 0, 1);
      const col = o.color || C.amber;
      ctx.save();
      ctx.globalAlpha = a;
      rrect(ctx, x, y, w, h, o.r || 14);
      ctx.fillStyle = rgba(col, .10); ctx.fill();
      ctx.setLineDash([5, 5]); ctx.lineDashOffset = -(o.t || 0) * 22;
      ctx.strokeStyle = rgba(col, .45); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.setLineDash([]);
      const c = Math.min(16, w / 3, h / 3);
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      const corner = (cx, cy, sx, sy) => {
        ctx.beginPath();
        ctx.moveTo(cx + sx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * c);
        ctx.stroke();
      };
      corner(x, y, 1, 1); corner(x + w, y, -1, 1);
      corner(x, y + h, 1, -1); corner(x + w, y + h, -1, -1);
      if (o.label) {
        ctx.font = mono(10, 500);
        const lw = ctx.measureText(o.label).width + 16;
        const ly = y - 22 < 60 ? y + h + 6 : y - 22;
        const lx = clamp(x, 8, REF_W - lw - 8);
        capsule(ctx, lx, ly, lw, 18);
        ctx.fillStyle = rgba(col, .92); ctx.fill();
        text(ctx, o.label, lx + 8, ly + 12.5, { font: mono(10, 500), fill: '#20170c' });
      }
      ctx.restore();
    });
  }

  /* A tap: two rings on an ease-out, plus the contact disc. The two
     rings are what a single ring never manages — the sense that the
     surface answered back. */
  function tapRipple(S, x, y, t, o) {
    if (t <= 0 || t >= 1) return;
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      const col = o.color || C.amber;
      const R = o.r || 46;
      ctx.save();
      for (let i = 0; i < 2; i++) {
        const tt = clamp(t - i * .18, 0, 1);
        if (tt <= 0) continue;
        const e = E.out(tt);
        ctx.beginPath(); ctx.arc(x, y, e * R * (1 - i * .28), 0, TAU);
        ctx.strokeStyle = rgba(col, .55 * (1 - tt) * (1 - i * .35));
        ctx.lineWidth = 2 - i * .6; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, 13 * (1 - E.out(t) * .5), 0, TAU);
      ctx.fillStyle = rgba(col, .30 * (1 - t)); ctx.fill();
      ctx.restore();
    });
  }

  /* The pointer. A soft disc with a rim, sized like a fingertip
     contact patch rather than a mouse cursor. */
  function pointer(S, x, y, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(() => {
      ctx.save();
      const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
      g.addColorStop(0, 'rgba(246,241,230,.34)');
      g.addColorStop(1, 'rgba(246,241,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU);
      ctx.fillStyle = 'rgba(246,241,230,.16)'; ctx.fill();
      ctx.strokeStyle = rgba(o.color || C.amber, .9); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU);
      ctx.fillStyle = o.color || C.amber; ctx.fill();
      ctx.restore();
    });
  }

  /* A swipe: a tapering trail with a leading contact. */
  function swipeTrail(S, from, to, t) {
    const ctx = S.ctx;
    S.pts(() => {
      const e = E.out(clamp(t, 0, 1));
      const hx = lerp(from[0], to[0], e), hy = lerp(from[1], to[1], e);
      const g = ctx.createLinearGradient(from[0], from[1], hx, hy);
      g.addColorStop(0, rgba(C.amber, 0)); g.addColorStop(1, rgba(C.amber, .55));
      ctx.save();
      ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.restore();
    });
    pointer(S, lerp(from[0], to[0], E.out(clamp(t, 0, 1))), lerp(from[1], to[1], E.out(clamp(t, 0, 1))));
  }

  /* "Software is in control" — a persistent banner with a stop
     affordance. Shipped agents all have one; leaving it out is what
     makes a demo look like a mock. */
  function controlBanner(S, o) {
    o = o || {};
    const ctx = S.ctx;
    S.pts(S2 => {
      const h = 34, y = S2.H - M.homeBottom - M.homeH - h - 14;
      const w = REF_W - 32;
      capsule(ctx, 16, y, w, h);
      ctx.fillStyle = 'rgba(16,13,9,.86)'; ctx.fill();
      ctx.strokeStyle = rgba(o.color || C.amber, .38); ctx.lineWidth = 1; ctx.stroke();
      const pulse = .55 + .45 * Math.sin((o.t || 0) * 3.4);
      ctx.fillStyle = rgba(o.color || C.amber, pulse);
      ctx.beginPath(); ctx.arc(32, y + h / 2, 3.6, 0, TAU); ctx.fill();
      text(ctx, fitText(ctx, o.label || '', w - 120, mono(11, 500)), 44, y + h / 2 + 4,
        { font: mono(11, 500), fill: C.onGlass });
      const sw = 46;
      capsule(ctx, 16 + w - 8 - sw, y + 6, sw, h - 12);
      ctx.fillStyle = 'rgba(246,241,230,.14)'; ctx.fill();
      text(ctx, 'Stop', 16 + w - 8 - sw / 2, y + h / 2 + 4,
        { font: sans(11.5, 600), fill: C.onGlassDim, align: 'center' });
    });
  }

  /* A screen transition. Push (a new screen slides in from the right)
     and modal (a sheet rises) cover everything a phone agent does. */
  function pushTransition(ctx, w, h, t, drawFrom, drawTo) {
    const e = E.emphasised(clamp(t, 0, 1));
    ctx.save();
    ctx.translate(-w * .28 * e, 0);
    drawFrom();
    ctx.fillStyle = 'rgba(0,0,0,' + (.45 * e) + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(w * (1 - e), 0);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetX = -6;
    drawTo();
    ctx.restore();
  }

  /* ================================================================
     GRAPH FURNITURE
     ================================================================ */

  /* Andrew's monotone chain. Communities get a hull because a hull is
     the one shape that says "these belong together" without drawing a
     single extra edge. */
  function convexHull(pts) {
    if (pts.length < 3) return pts.slice();
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  /* Push the hull out from its centroid, then round it with two
     Chaikin passes. A raw hull has knife corners and reads as a
     polygon; a smoothed one reads as a region. */
  function smoothHull(pts, pad) {
    let h = convexHull(pts);
    if (h.length < 3) {
      /* one or two nodes: a capsule around them */
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      h = [];
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU;
        h.push([cx + Math.cos(a) * pad, cy + Math.sin(a) * pad]);
      }
      return h;
    }
    const cx = h.reduce((s, p) => s + p[0], 0) / h.length;
    const cy = h.reduce((s, p) => s + p[1], 0) / h.length;
    h = h.map(p => {
      const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
      return [p[0] + dx / d * pad, p[1] + dy / d * pad];
    });
    for (let pass = 0; pass < 2; pass++) {
      const out = [];
      for (let i = 0; i < h.length; i++) {
        const a = h[i], b = h[(i + 1) % h.length];
        out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
        out.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
      }
      h = out;
    }
    return h;
  }

  function hullPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
  }

  /* A typed edge: a shallow arc, so parallel relations separate and
     the graph stops looking like a cat's cradle. */
  function edge(ctx, a, b, o) {
    o = o || {};
    const bend = o.bend == null ? .13 : o.bend;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const cx = mx - dy * bend, cy = my + dx * bend;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(cx, cy, b[0], b[1]);
    ctx.strokeStyle = o.stroke || C.rule2;
    ctx.lineWidth = o.width || 1;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.stroke();
    ctx.restore();
    return [cx, cy];
  }

  function edgePoint(a, c, b, t) {
    const m = 1 - t;
    return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0],
            m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]];
  }

  /* A relation label, set on the plate rather than floating on the
     line, so it survives crossing edges. */
  function edgeLabel(ctx, x, y, s, o) {
    o = o || {};
    ctx.save();
    ctx.font = mono(9, 400);
    const w = ctx.measureText(s).width + 10;
    ctx.fillStyle = o.bg || 'rgba(14,12,8,.9)';
    rrect(ctx, x - w / 2, y - 8, w, 15, 3); ctx.fill();
    text(ctx, s, x, y + 3.4, { font: mono(9), fill: o.fill || C.dim, align: 'center' });
    ctx.restore();
  }

  /* A node: a filled disc with a darker rim so it separates from an
     edge passing behind it, plus an optional focus halo. */
  function node(ctx, x, y, r, color, o) {
    o = o || {};
    ctx.save();
    ctx.globalAlpha = o.dim == null ? 1 : o.dim;
    if (o.halo) {
      const g = ctx.createRadialGradient(x, y, r, x, y, r + 14 * o.halo);
      g.addColorStop(0, rgba(color, .35)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r + 14 * o.halo, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    const g2 = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g2.addColorStop(0, shade(color, 1.18)); g2.addColorStop(1, shade(color, .82));
    ctx.fillStyle = g2; ctx.fill();
    ctx.strokeStyle = o.ring ? C.ink : 'rgba(14,12,8,.75)';
    ctx.lineWidth = o.ring ? 2 : 1.2;
    ctx.stroke();
    ctx.restore();
  }

  /* ================================================================
     PLATE FURNITURE — headers, rails and readouts shared by the
     non-phone figures, so five files stop each inventing a caption.
     ================================================================ */

  /* A small uppercase mono caption; the canvas twin of .ctl-label. */
  function kicker(ctx, s, x, y, o) {
    o = o || {};
    text(ctx, String(s).toUpperCase(), x, y, {
      font: mono(o.size || 9, 500), fill: o.fill || C.faint,
      align: o.align, base: o.base, track: o.track || '.13em'
    });
  }

  /* The strip along the top of a plate: what this is, and its state. */
  function plateHead(ctx, w, o) {
    o = o || {};
    kicker(ctx, o.left || '', 14, 18);
    if (o.right) kicker(ctx, o.right, w - 14, 18, { align: 'right' });
    if (o.rule !== false) {
      ctx.save(); ctx.strokeStyle = C.rule2; hair(ctx);
      ctx.beginPath(); ctx.moveTo(14, snap(26)); ctx.lineTo(w - 14, snap(26)); ctx.stroke();
      ctx.restore();
    }
  }

  /* A vertical step rail: the spine of every agent diagram. */
  function stepRail(ctx, x, y0, y1, steps, active, o) {
    o = o || {};
    const n = steps.length;
    ctx.save();
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(snap(x), y0); ctx.lineTo(snap(x), y1); ctx.stroke();
    const pitch = n > 1 ? (y1 - y0) / (n - 1) : 0;
    /* progress */
    if (active >= 0) {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(snap(x), y0); ctx.lineTo(snap(x), y0 + pitch * active); ctx.stroke();
    }
    steps.forEach((s, i) => {
      const y = y0 + pitch * i;
      const done = i < active, on = i === active;
      ctx.beginPath(); ctx.arc(x, y, on ? 6 : 4.2, 0, TAU);
      ctx.fillStyle = done ? C.amberD : on ? C.amber : C.plate;
      ctx.fill();
      ctx.strokeStyle = done || on ? C.amber : C.rule; ctx.lineWidth = 1.3; ctx.stroke();
      text(ctx, s, x + 14, y + 4,
        { font: on ? mono(10.5, 500) : mono(10.5), fill: on ? C.ink : done ? C.soft : C.faint });
    });
    ctx.restore();
  }

  /* ================================================================
     PLUMBING — one frame loop, one resize hook, shared with figkit's
     conventions so a figure written against either behaves the same.
     ================================================================ */
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loop(canvas, step, opts) {
    opts = opts || {};
    const FRAME = 1000 / (opts.fps || 30);
    let raf = 0, timer = 0, last = 0, vis = true, paused = !!opts.paused, dead = false;
    const can = () => !dead && !paused && vis && !document.hidden && !REDUCE;
    function tick(now) {
      raf = 0;
      const dt = last ? Math.min(2.5, (now - last) / 16.667) : 1;
      last = now;
      step(dt);
      schedule();
    }
    function schedule() {
      if (!can() || raf || timer) return;
      timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(tick); }, FRAME);
    }
    function stop() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0; last = 0; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { vis = es[0].isIntersecting; vis ? schedule() : stop(); },
        { threshold: 0.02 }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : schedule());
    return {
      start: schedule, stop,
      set paused(v) { paused = v; v ? stop() : schedule(); },
      get paused() { return paused; },
      get reduced() { return REDUCE; },
      destroy() { dead = true; stop(); }
    };
  }

  function onResize(canvas, fn) {
    let w = -1, h = -1;
    const run = () => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (cw === w && ch === h) return;
      w = cw; h = ch; fn();
    };
    if ('ResizeObserver' in window) new ResizeObserver(run).observe(canvas);
    window.addEventListener('resize', () => { w = -1; run(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { w = -1; run(); fn(); });
    return run;
  }

  return {
    /* type */ MONO, SANS, SERIF, mono, sans, serif, text, fitText, kicker, track,
    /* colour */ C, TYPES, rgba, shade,
    /* math */ clamp, lerp, E, TAU, snap, hair, fit, dprOf,
    /* shapes */ rrect, squircle, capsule,
    /* device */ M, REF_W, screen, wallpaper, statusBar, island, homeIndicator,
    GLYPH, appIcon, iconCell, homeWidget, homeGrid, dock, pageDots,
    navBar, listCard, cta, inputBar, keyboard, bubble,
    /* agent */ groundBox, tapRipple, pointer, swipeTrail, controlBanner, pushTransition,
    /* graph */ convexHull, smoothHull, hullPath, edge, edgePoint, edgeLabel, node,
    /* plate */ plateHead, stepRail,
    /* plumbing */ loop, onResize, reduce: REDUCE
  };
})();
