/* =================================================================
   figkit.js — the drawing kit shared by every interactive figure.

   Everything that makes a plot look like a plate from a journal
   rather than like generic web-canvas art lives here exactly once:

     · the site's own typefaces, on the canvas as well as in the DOM
     · a box frame with inward major/minor ticks on all four sides
     · a 1–2–5 tick generator and formatted tick labels
     · hairlines that stay hairlines at devicePixelRatio 2
     · limb-darkened stellar discs instead of glow blobs
     · one warm palette, so no figure invents its own colours
     · pointer helpers (hover readout, drag-to-scrub) and a frame loop

   Public surface: window.FK
   ================================================================= */
window.FK = (function () {
  'use strict';

  /* ---------------- type ---------------- */
  const MONO  = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const SANS  = '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif';
  const SERIF = '"Newsreader", Georgia, serif';
  const mono  = (s, w) => (w || 400) + ' ' + s + 'px ' + MONO;
  const sans  = (s, w) => (w || 400) + ' ' + s + 'px ' + SANS;
  const serif = (s, w) => (w || 400) + ' ' + s + 'px ' + SERIF;

  /* Optical tracking on small mono labels, the way the CSS does it.
     Guarded: Canvas letterSpacing is recent, and it must be reset. */
  const CAN_TRACK = (typeof CanvasRenderingContext2D !== 'undefined') &&
                    ('letterSpacing' in CanvasRenderingContext2D.prototype);
  function track(ctx, v) { if (CAN_TRACK) ctx.letterSpacing = v || '0px'; }

  /* ---------------- palette ----------------
     On-plate (dark graphite) values, matched to the CSS custom
     properties so the canvases and the page agree. */
  const C = {
    ink:    '#f4eee2',              // primary on-plate text
    soft:   '#d8ceb4',              // secondary text
    dim:    '#aca287',              // tertiary / units
    faint:  '#7f7663',              // barely-there
    rule:   'rgba(216,206,180,.34)',// frame + major ticks
    rule2:  'rgba(216,206,180,.20)',// minor ticks
    grid:   'rgba(216,206,180,.085)',
    fill:   'rgba(224,164,92,.10)',

    amber:  '#e0a45c',              // primary data ink
    amberD: '#c07f36',
    steel:  '#8ba9cf',              // secondary series / field lines
    ember:  '#d9703c',              // donor, M dwarf
    rose:   '#e6926c',
    wd:     '#dde9f2',              // white dwarf photosphere
    mint:   '#63b394',              // g band / "pass"
    plum:   '#b07fa8',              // i band
    dust:   '#6b5640'
  };
  const RGB = {
    donor:  [232, 158, 104],
    donorC: [255, 213, 165],
    wd:     [214, 232, 244],
    wdC:    [255, 255, 255],
    spot:   [255, 206, 138],
    kdwarf: [244, 186, 128]
  };

  /* ---------------- numeric helpers ---------------- */
  const clamp  = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp   = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const DEG    = r => r * 180 / Math.PI;
  const RAD    = d => d * Math.PI / 180;

  /* 1–2–5 ticks over [lo,hi] aiming for ~n intervals */
  function niceTicks(lo, hi, n) {
    const span = hi - lo;
    if (!(span > 0)) return { step: 1, values: [lo] };
    const raw = span / (n || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const u = raw / mag;
    const step = (u < 1.5 ? 1 : u < 3 ? 2 : u < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) {
      out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
    }
    return { step, values: out };
  }

  /* ---------------- canvas plumbing ---------------- */
  const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

  /* Size the backing store to the CSS box. Returns null while the box is
     still collapsed (fonts/layout not settled) so callers can bail out. */
  function fit(canvas, ctx) {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = dprOf();
    if (!(w > 0 && h > 0)) return null;
    const bw = Math.max(1, Math.round(w * d)), bh = Math.max(1, Math.round(h * d));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return { w, h, dpr: d };
  }

  /* snap to the device pixel grid so 1px rules stay 1px, not a 2px blur */
  function snap(v) { const d = dprOf(); return Math.round(v * d - 0.5) / d + 0.5 / d; }
  function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function hair(ctx, alpha) { ctx.lineWidth = 1 / dprOf() * (dprOf() > 1 ? 1.35 : 1); ctx.globalAlpha = alpha == null ? 1 : alpha; }

  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = o.font || mono(10);
    ctx.fillStyle = o.fill || C.dim;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    track(ctx, o.track);
    ctx.fillText(s, x, y);
    track(ctx, '0px');
    ctx.restore();
  }

  /* a small uppercase mono caption, the canvas twin of .ctl-label */
  function kicker(ctx, s, x, y, o) {
    o = o || {};
    text(ctx, s.toUpperCase(), x, y, {
      font: mono(o.size || 9, 500), fill: o.fill || C.faint,
      align: o.align, base: o.base || 'alphabetic', track: o.track || '.13em'
    });
  }

  /* ================================================================
     AXES — a framed panel with inward ticks, the journal convention.

       FK.axes(ctx, {
         l,t,r,b,                         plot box, CSS px
         x:{min,max,label,n,fmt,minor},
         y:{min,max,label,n,fmt,minor},
         grid:false, box:true, right:true, top:true
       })  ->  {X, Y, invX, invY, box}
     ================================================================ */
  function axes(ctx, cfg) {
    const l = cfg.l, t = cfg.t, r = cfg.r, b = cfg.b;
    const xs = cfg.x, ys = cfg.y;
    const X = v => l + (r - l) * (v - xs.min) / (xs.max - xs.min);
    const Y = v => b - (b - t) * (v - ys.min) / (ys.max - ys.min);
    const invX = p => xs.min + (p - l) / (r - l) * (xs.max - xs.min);
    const invY = p => ys.min + (b - p) / (b - t) * (ys.max - ys.min);

    const xt = xs.ticks || niceTicks(xs.min, xs.max, xs.n || 5);
    const yt = ys.ticks || niceTicks(ys.min, ys.max, ys.n || 4);
    const xfmt = xs.fmt || (v => String(v));
    const yfmt = ys.fmt || (v => String(v));
    const MAJ = 5, MIN = 3, sub = 4;

    ctx.save();
    ctx.lineCap = 'butt';

    if (cfg.grid) {
      ctx.strokeStyle = C.grid; hair(ctx);
      xt.values.forEach(v => { const x = snap(X(v)); if (x > l + .5 && x < r - .5) line(ctx, x, t, x, b); });
      yt.values.forEach(v => { const y = snap(Y(v)); if (y > t + .5 && y < b - .5) line(ctx, l, y, r, y); });
      ctx.globalAlpha = 1;
    }

    /* frame */
    if (cfg.box !== false) {
      ctx.strokeStyle = C.rule; hair(ctx);
      ctx.beginPath();
      ctx.rect(snap(l), snap(t), Math.round(r - l), Math.round(b - t));
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    /* ticks — major inward on every side, minor on the two data axes */
    const tickX = (v, len, side) => {
      const x = snap(X(v));
      if (x < l - .5 || x > r + .5) return;
      if (side !== 'top')    line(ctx, x, b, x, b - len);
      if (side !== 'bottom' && cfg.top !== false) line(ctx, x, t, x, t + len);
    };
    const tickY = (v, len, side) => {
      const y = snap(Y(v));
      if (y < t - .5 || y > b + .5) return;
      if (side !== 'right') line(ctx, l, y, l + len, y);
      if (side !== 'left' && cfg.right !== false) line(ctx, r, y, r - len, y);
    };

    if (xs.minor !== false) {
      ctx.strokeStyle = C.rule2; hair(ctx);
      for (const v of xt.values) for (let k = 1; k < sub; k++) tickX(v + xt.step * k / sub, MIN);
      for (let k = 1; k < sub; k++) tickX(xt.values[0] - xt.step * k / sub, MIN);
    }
    if (ys.minor !== false) {
      ctx.strokeStyle = C.rule2; hair(ctx);
      for (const v of yt.values) for (let k = 1; k < sub; k++) tickY(v + yt.step * k / sub, MIN);
      for (let k = 1; k < sub; k++) tickY(yt.values[0] - yt.step * k / sub, MIN);
    }
    ctx.strokeStyle = C.rule; hair(ctx);
    xt.values.forEach(v => tickX(v, MAJ));
    yt.values.forEach(v => tickY(v, MAJ));
    ctx.globalAlpha = 1;

    /* tick labels */
    if (xs.labels !== false) {
      xt.values.forEach(v => {
        const x = X(v); if (x < l - 1 || x > r + 1) return;
        text(ctx, xfmt(v), x, b + 13, { font: mono(9.5), fill: C.dim, align: 'center' });
      });
    }
    if (ys.labels !== false) {
      yt.values.forEach(v => {
        const y = Y(v); if (y < t - 1 || y > b + 1) return;
        text(ctx, yfmt(v), l - 6, y + 3.2, { font: mono(9.5), fill: C.dim, align: 'right' });
      });
    }

    /* axis titles */
    if (xs.label) {
      text(ctx, xs.label, (l + r) / 2, b + 27, { font: sans(10.5, 500), fill: C.soft, align: 'center' });
    }
    if (ys.label) {
      ctx.save();
      ctx.translate(l - (cfg.yTitleGap || 34), (t + b) / 2);
      ctx.rotate(-Math.PI / 2);
      text(ctx, ys.label, 0, 0, { font: sans(10.5, 500), fill: C.soft, align: 'center' });
      ctx.restore();
    }
    ctx.restore();
    return { X, Y, invX, invY, box: { l, t, r, b } };
  }

  /* clip to the plot box while drawing data */
  function inBox(ctx, box, fn) {
    ctx.save();
    ctx.beginPath(); ctx.rect(box.l, box.t, box.r - box.l, box.b - box.t); ctx.clip();
    fn(); ctx.restore();
  }

  /* polyline through f(t) sampled n times over [0,1] */
  function curve(ctx, n, f, o) {
    o = o || {};
    ctx.save();
    ctx.strokeStyle = o.stroke || C.amber;
    ctx.lineWidth = o.width || 1.75;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = f(i / n); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
    ctx.restore();
  }

  /* an inline key drawn inside the frame, journal style */
  function legend(ctx, x, y, items, o) {
    o = o || {};
    const lh = o.lh || 13, sw = 15;
    ctx.save();
    items.forEach((it, i) => {
      const yy = y + i * lh;
      ctx.strokeStyle = it.color; ctx.fillStyle = it.color;
      if (it.kind === 'dot') { ctx.beginPath(); ctx.arc(x + sw / 2, yy - 3, 2.4, 0, 7); ctx.fill(); }
      else {
        ctx.lineWidth = it.width || 1.8;
        if (it.dash) ctx.setLineDash(it.dash);
        ctx.beginPath(); ctx.moveTo(x, yy - 3.2); ctx.lineTo(x + sw, yy - 3.2); ctx.stroke();
        ctx.setLineDash([]);
      }
      text(ctx, it.label, x + sw + 6, yy, { font: mono(9.5), fill: o.fill || C.soft });
    });
    ctx.restore();
  }

  /* ================================================================
     STELLAR DISCS — a linear limb-darkening law, I(µ)/I(0) = 1−u(1−µ),
     built as gradient stops. No offset specular highlight: stars are
     not billiard balls, and the fake highlight is what makes canvas
     art read as clip-art.
     ================================================================ */
  function shade(rgb, f) {
    return 'rgb(' + clamp(Math.round(rgb[0] * f), 0, 255) + ',' +
                    clamp(Math.round(rgb[1] * f), 0, 255) + ',' +
                    clamp(Math.round(rgb[2] * f), 0, 255) + ')';
  }
  function rgba(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }

  function disc(ctx, x, y, r, rgb, o) {
    o = o || {};
    const u = o.u == null ? 0.62 : o.u;             // limb-darkening coefficient
    const core = o.core == null ? 1 : o.core;
    if (!(r > 0.2)) return;
    if (o.bloom) {                                   // a whisper of scattered light only
      const g0 = ctx.createRadialGradient(x, y, r * .92, x, y, r * (o.bloom || 1.9));
      g0.addColorStop(0, rgba(rgb, .20)); g0.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(x, y, r * (o.bloom || 1.9), 0, 7); ctx.fill();
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let k = 0; k <= 7; k++) {
      const t = k / 7, mu = Math.sqrt(Math.max(0, 1 - t * t));
      g.addColorStop(t, shade(rgb, core * (1 - u + u * mu)));
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  /* same law, applied to an arbitrary closed outline (a Roche lobe) */
  function discPath(ctx, path, cx, cy, r, rgb, o) {
    o = o || {};
    const u = o.u == null ? 0.62 : o.u, core = o.core == null ? 1 : o.core;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
    for (let k = 0; k <= 7; k++) {
      const t = k / 7, mu = Math.sqrt(Math.max(0, 1 - t * t));
      g.addColorStop(t, shade(rgb, core * (1 - u + u * mu)));
    }
    ctx.save(); ctx.fillStyle = g; ctx.fill(path); ctx.restore();
  }

  /* ---------------- pointer ----------------
     Normalises mouse + touch to CSS pixels inside the canvas and gives
     figures hover readouts and drag-to-scrub without repeating boilerplate. */
  function pointer(canvas, h) {
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top, w: r.width, h: r.height };
    };
    let down = false;
    const md = e => { down = true; if (h.down) h.down(pos(e), e); if (h.drag) { h.drag(pos(e), e); e.preventDefault(); } };
    const mm = e => { const p = pos(e); if (h.move) h.move(p, e); if (down && h.drag) { h.drag(p, e); e.preventDefault(); } };
    const mu = e => { down = false; if (h.up) h.up(e); };
    canvas.addEventListener('mousedown', md);
    canvas.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    canvas.addEventListener('mouseleave', e => { if (h.leave) h.leave(e); });
    canvas.addEventListener('touchstart', md, { passive: false });
    canvas.addEventListener('touchmove', mm, { passive: false });
    window.addEventListener('touchend', mu);
    return { isDown: () => down };
  }

  /* a tooltip chip drawn on the plate, kept inside the frame */
  function chip(ctx, x, y, lines, box) {
    const pad = 6, lh = 12.5;
    ctx.save();
    ctx.font = mono(9.5);
    let w = 0; lines.forEach(s => { w = Math.max(w, ctx.measureText(s).width); });
    const bw = w + pad * 2, bh = lines.length * lh + pad * 1.6;
    let bx = x + 10, by = y - bh - 8;
    if (box) { bx = clamp(bx, box.l + 2, box.r - bw - 2); by = clamp(by, box.t + 2, box.b - bh - 2); }
    ctx.fillStyle = 'rgba(24,20,14,.93)';
    ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 4); else ctx.rect(bx, by, bw, bh);
    ctx.fill(); ctx.stroke();
    lines.forEach((s, i) => text(ctx, s, bx + pad, by + pad + 4 + i * lh + 5,
      { font: mono(9.5), fill: i ? C.soft : C.ink }));
    ctx.restore();
  }

  /* ---------------- frame loop ----------------
     Throttled to 30 fps, paused off-screen and on hidden tabs, and
     inert under prefers-reduced-motion. Every figure shares it so the
     page never has a dozen competing rAF loops. */
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
      start: schedule,
      stop,
      set paused(v) { paused = v; v ? stop() : schedule(); },
      get paused() { return paused; },
      get reduced() { return REDUCE; },
      destroy() { dead = true; stop(); }
    };
  }

  /* run fn now and whenever the box changes size or the webfonts land */
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
    MONO, SANS, SERIF, mono, sans, serif, track, text, kicker,
    C, RGB, rgba, shade,
    clamp, lerp, smooth, DEG, RAD, niceTicks,
    fit, snap, line, hair, axes, inBox, curve, legend,
    disc, discPath, pointer, chip, loop, onResize,
    reduce: REDUCE
  };
})();
