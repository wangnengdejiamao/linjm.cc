/* =================================================================
   techviz.js — shared kit for the "AI for X" figures on ai.html.

   Every domain figure is a dark instrument plate set into the paper
   page: a header strip (figure id + honest status), a canvas, and a
   footer that names the real stack the figure is about. This file owns
   the plate DOM, the frame loop, and the drawing primitives, so the
   four domain figures look like one system.

   Public surface: window.TV
   ================================================================= */
window.TV = (function () {
  'use strict';

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  /* ---------------- palette (on-plate) ---------------- */
  const C = {
    bg: '#0f0d0a', bg2: '#16130e',
    ink: '#f4eee2', soft: '#d6ccb4', dim: '#9a917b', faint: '#5f584a',
    line: 'rgba(236,224,200,.14)', line2: 'rgba(236,224,200,.07)',
    amber: '#e8a85f', steel: '#8fb3dc', mint: '#6cc4a0', plum: '#c08ac0',
    ember: '#e2794a', sky: '#7fc8e8', gold: '#e6c869', red: '#e0604a', rose: '#e69a86'
  };
  const DOMAIN = { chem: C.mint, biz: C.steel, astro: C.amber, mfg: C.ember, agent: C.plum };

  const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const SANS = '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif';
  const SERIF = '"Newsreader", Georgia, "Songti SC", serif';
  function font(size, weight, fam) {
    return (weight || 400) + ' ' + size + 'px ' + (fam === 'sans' ? SANS : fam === 'serif' ? SERIF : MONO);
  }

  /* ---------------- colour + math ---------------- */
  function rgba(hex, a) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t
  };
  function rand(seed) {                      // mulberry32 — deterministic layouts
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- plate DOM ----------------
     <div class="tv-fig">
       <div class="tv-head"><span class="tv-kicker">FIG …</span><span class="tv-status">…</span></div>
       <div class="tv-stage"><canvas/><div class="tv-hud"/></div>
       <div class="tv-foot"><span class="tv-stack">chips</span><span class="tv-note"/></div>
     </div>                                                             */
  function mount(root, o) {
    o = o || {};
    root.classList.add('tv-fig');
    if (o.domain) root.dataset.domain = o.domain;
    const head = document.createElement('div');
    head.className = 'tv-head';
    head.innerHTML = '<span class="tv-kicker"></span><span class="tv-status"><i></i><span></span></span>';
    head.querySelector('.tv-kicker').textContent = o.kicker || '';
    head.querySelector('.tv-status span').textContent = o.status || 'interactive · simulated data';
    const stage = document.createElement('div');
    stage.className = 'tv-stage';
    if (o.height) stage.style.setProperty('--tv-h', typeof o.height === 'number' ? o.height + 'px' : o.height);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', o.aria || o.kicker || 'Interactive figure');
    const hud = document.createElement('div');
    hud.className = 'tv-hud';
    stage.append(canvas, hud);
    root.append(head, stage);
    let controls = null;
    if (o.controls) {
      controls = document.createElement('div');
      controls.className = 'tv-controls';
      root.append(controls);
    }
    if (o.stack || o.note) {
      const foot = document.createElement('div');
      foot.className = 'tv-foot';
      const st = document.createElement('span');
      st.className = 'tv-stack';
      (o.stack || []).forEach(s => { const b = document.createElement('b'); b.textContent = s; st.append(b); });
      foot.append(st);
      if (o.note) { const n = document.createElement('span'); n.className = 'tv-note'; n.textContent = o.note; foot.append(n); }
      root.append(foot);
    }
    const ctx = canvas.getContext('2d');
    const fig = { root, head, stage, canvas, ctx, hud, controls, w: 0, h: 0, dpr: 1 };
    fig.setStatus = s => { head.querySelector('.tv-status span').textContent = s; };
    return fig;
  }

  /* button helper for .tv-controls */
  function button(parent, label, onClick, o) {
    o = o || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tv-btn' + (o.active ? ' is-on' : '') + (o.cls ? ' ' + o.cls : '');
    b.textContent = label;
    if (o.title) b.title = o.title;
    if (o.pressed != null) b.setAttribute('aria-pressed', String(!!o.pressed));
    b.addEventListener('click', onClick);
    parent.append(b);
    return b;
  }
  function group(parent, label) {
    const g = document.createElement('div');
    g.className = 'tv-group';
    if (label) { const l = document.createElement('span'); l.className = 'tv-glab'; l.textContent = label; g.append(l); }
    parent.append(g);
    return g;
  }
  /* radio-style chip set: returns {set(key)} */
  function chips(parent, label, items, onPick, initial) {
    const g = group(parent, label);
    const btns = {};
    items.forEach(it => {
      btns[it.key] = button(g, it.label, () => api.set(it.key, true), { pressed: it.key === initial, active: it.key === initial });
    });
    const api = {
      set(k, fire) {
        Object.keys(btns).forEach(x => { btns[x].classList.toggle('is-on', x === k); btns[x].setAttribute('aria-pressed', String(x === k)); });
        if (fire) onPick(k);
      }
    };
    return api;
  }

  /* ---------------- frame loop ----------------
     run(fig, {draw(t, dt), resize(w,h)}) — t in seconds since start.
     Pauses off-screen and on hidden tabs; under reduced motion it draws
     a single, representative frame (opts.still seconds) and stops.    */
  function run(fig, o) {
    let raf = 0, t = 0, last = 0, vis = true, paused = false;
    const still = o.still != null ? o.still : 6;
    function size() {
      const r = fig.canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
      if (w === fig.w && h === fig.h && dpr === fig.dpr) return false;
      fig.w = w; fig.h = h; fig.dpr = dpr;
      fig.canvas.width = Math.round(w * dpr);
      fig.canvas.height = Math.round(h * dpr);
      fig.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (o.resize) o.resize(w, h);
      return true;
    }
    function frame(now) {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      t += dt * (api.speed || 1);
      size();
      o.draw(t, dt);
      schedule();
    }
    function can() { return !REDUCE && !paused && vis && !document.hidden; }
    function schedule() { if (can() && !raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
    function redraw() { size(); o.draw(t, 0); }
    const api = {
      speed: 1,
      get t() { return t; }, set t(v) { t = v; redraw(); },
      get paused() { return paused; },
      set paused(v) { paused = v; v ? stop() : schedule(); },
      redraw, start: schedule, reduced: REDUCE
    };
    fig.root.__tv = api;                     // handle for debugging / tests
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { vis = es[0].isIntersecting; vis ? schedule() : stop(); },
        { rootMargin: '120px' }).observe(fig.canvas);
    }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : schedule());
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (size()) o.draw(t, 0); }).observe(fig.stage);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fig.w = 0; redraw(); });
    if (REDUCE) { t = still; requestAnimationFrame(redraw); }
    else schedule();
    return api;
  }

  /* ---------------- pointer ---------------- */
  function pointer(canvas, h) {
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointermove', e => { if (h.move) h.move(...pos(e)); });
    canvas.addEventListener('pointerleave', () => { if (h.leave) h.leave(); });
    canvas.addEventListener('click', e => { if (h.click) h.click(...pos(e)); });
  }

  /* ---------------- drawing primitives ---------------- */
  function bg(ctx, w, h, o) {
    o = o || {};
    const g = ctx.createRadialGradient(w * .5, h * .38, 0, w * .5, h * .5, Math.max(w, h) * .75);
    g.addColorStop(0, o.lift || '#1b1712');
    g.addColorStop(1, C.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (o.grid !== false) {
      const s = o.grid || 24;
      ctx.fillStyle = 'rgba(236,224,200,.075)';
      for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) ctx.fillRect(x - .5, y - .5, 1, 1);
    }
    if (o.tint) {
      const t = ctx.createRadialGradient(w * (o.tx || .8), h * (o.ty || .1), 0, w * (o.tx || .8), h * (o.ty || .1), Math.max(w, h) * .6);
      t.addColorStop(0, rgba(o.tint, .10));
      t.addColorStop(1, rgba(o.tint, 0));
      ctx.fillStyle = t;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a == null ? .35 : a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  /* a node: soft halo, filled core, crisp rim */
  function node(ctx, x, y, r, color, o) {
    o = o || {};
    const on = o.active ? 1 : (o.level == null ? .55 : o.level);
    if (on > .3) glow(ctx, x, y, r * (2.4 + on), color, .18 + .28 * on);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = rgba(color, o.fill == null ? .22 + .5 * on : o.fill);
    ctx.fill();
    ctx.lineWidth = o.active ? 1.6 : 1;
    ctx.strokeStyle = rgba(color, .55 + .45 * on);
    ctx.stroke();
    if (o.core !== false) {
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, r * .32), 0, TAU);
      ctx.fillStyle = rgba('#fff8ec', .35 + .55 * on);
      ctx.fill();
    }
    if (o.ring) {
      ctx.beginPath(); ctx.arc(x, y, r + 5 + 2 * Math.sin(o.ring * 4), 0, TAU);
      ctx.strokeStyle = rgba(color, .35);
      ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  /* quadratic curve helpers */
  function bez(a, b, bend) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const k = bend == null ? .18 : bend;
    return { a, b, c: { x: mx - dy / L * L * k, y: my + dx / L * L * k } };
  }
  function bezPt(q, t) {
    const u = 1 - t;
    return { x: u * u * q.a.x + 2 * u * t * q.c.x + t * t * q.b.x, y: u * u * q.a.y + 2 * u * t * q.c.y + t * t * q.b.y };
  }
  function strokeBez(ctx, q, color, w, a, dash) {
    ctx.beginPath();
    ctx.moveTo(q.a.x, q.a.y);
    ctx.quadraticCurveTo(q.c.x, q.c.y, q.b.x, q.b.y);
    ctx.strokeStyle = rgba(color, a == null ? .35 : a);
    ctx.lineWidth = w || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }
  /* luminous packets travelling a curve (or any fn t→{x,y}) */
  function flow(ctx, path, t, o) {
    o = o || {};
    const n = o.n || 3, sp = o.speed || .35, col = o.color || C.amber, sz = o.size || 2.2;
    const at = typeof path === 'function' ? path : (u => bezPt(path, u));
    for (let i = 0; i < n; i++) {
      const u = ((t * sp + i / n + (o.phase || 0)) % 1 + 1) % 1;
      const p = at(u);
      const fade = Math.sin(u * Math.PI);
      glow(ctx, p.x, p.y, sz * 4, col, .35 * fade);
      ctx.beginPath(); ctx.arc(p.x, p.y, sz * (.6 + .4 * fade), 0, TAU);
      ctx.fillStyle = rgba('#fff6e6', .85 * fade);
      ctx.fill();
    }
  }

  /* text label, optionally on a pill */
  function label(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = o.font || font(o.size || 11, o.weight || 400, o.fam);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'middle';
    if (o.pill) {
      const tw = ctx.measureText(s).width, px = o.pad || 6, h = (o.size || 11) + 8;
      const x0 = o.align === 'center' ? x - tw / 2 - px : o.align === 'right' ? x - tw - px : x - px;
      rrect(ctx, x0, y - h / 2, tw + px * 2, h, o.radius == null ? h / 2 : o.radius);
      ctx.fillStyle = o.pill === true ? 'rgba(15,13,10,.82)' : o.pill;
      ctx.fill();
      if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.fillStyle = o.color || C.soft;
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }

  /* a rounded card on the plate (pipeline stage, table row …) */
  function card(ctx, x, y, w, h, o) {
    o = o || {};
    const col = o.color || C.amber, on = o.level == null ? 0 : o.level;
    if (on > .05) {
      ctx.save();
      ctx.shadowColor = rgba(col, .45 * on);
      ctx.shadowBlur = 22 * on;
      rrect(ctx, x, y, w, h, o.r || 8);
      ctx.fillStyle = 'rgba(20,17,13,1)';
      ctx.fill();
      ctx.restore();
    }
    rrect(ctx, x, y, w, h, o.r || 8);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, rgba(col, .07 + .16 * on));
    g.addColorStop(1, rgba(col, .02 + .06 * on));
    ctx.fillStyle = 'rgba(22,19,14,.92)';
    ctx.fill();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(col, .22 + .6 * on);
    ctx.stroke();
    if (o.bar !== false) {
      rrect(ctx, x, y + 6, 2, h - 12, 1);
      ctx.fillStyle = rgba(col, .5 + .5 * on);
      ctx.fill();
    }
  }

  /* 3-D projection for graph clouds */
  function proj(p, ry, rx, cx, cy, f) {
    const cr = Math.cos(ry), sr = Math.sin(ry);
    let x = p.x * cr - p.z * sr, z = p.x * sr + p.z * cr;
    const cX = Math.cos(rx), sX = Math.sin(rx);
    const y = p.y * cX - z * sX; z = p.y * sX + z * cX;
    const s = f / (f + z);
    return { x: cx + x * s, y: cy + y * s, s, z };
  }

  /* wrap text into lines that fit maxW */
  function wrap(ctx, s, maxW) {
    const words = s.split(/(\s+)/), lines = [];
    let cur = '';
    words.forEach(w => {
      const tryS = cur + w;
      if (ctx.measureText(tryS).width > maxW && cur.trim()) { lines.push(cur.trim()); cur = w.trimStart(); }
      else cur = tryS;
    });
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }

  /* set an HTML readout list inside the HUD: rows [[k,v],…] */
  function readout(el, rows) {
    el.innerHTML = '';
    rows.forEach(([k, v, cls]) => {
      const r = document.createElement('div');
      r.className = 'tv-ro' + (cls ? ' ' + cls : '');
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('b'); b.textContent = v;
      r.append(a, b); el.append(r);
    });
  }

  return {
    C, DOMAIN, TAU, REDUCE, MONO, SANS, SERIF, font,
    rgba, clamp, lerp, ease, rand,
    mount, button, group, chips, run, pointer,
    bg, rrect, glow, node, bez, bezPt, strokeBez, flow, label, card, proj, wrap, readout
  };
})();
