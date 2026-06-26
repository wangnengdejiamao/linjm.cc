/* =================================================================
   Knowledge graph + dual-track RAG (Astro Agent) — animated.
   A type-anchored force layout that NEVER freezes: after it settles it
   keeps a gentle idle drift and ambient "thinking" pulses. Picking a
   query plays the retrieval out — BM25/vector recall lands on an entity
   (ripple), then multi-hop graph traversal sends pulses hop-by-hop along
   the edges, lighting up neighbours in sequence with a breathing focus
   halo, while the RAG context rows reveal in step.
   Data: real subgraph of the white-dwarf KG (js/kgdata.js).
   ================================================================= */
(function () {
  const canvas = document.getElementById('kgCanvas');
  if (!canvas || !window.KG_DATA) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 60;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elCtx   = document.getElementById('kgCtx');
  const elChips = document.getElementById('kgChips');
  const elMode  = document.getElementById('kgMode');
  const elShown = document.getElementById('kgShown');
  const wrap    = canvas.parentElement;
  const tip = document.createElement('div'); tip.className = 'kg-tip'; tip.style.display = 'none';
  wrap.appendChild(tip);

  const DATA = window.KG_DATA;
  const nodes = DATA.nodes.map(n => ({
    ...n, x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, rx: 0, ry: 0,
    fa: 1, pop: 1, ph: Math.random() * Math.PI * 2
  }));
  const edges = DATA.edges.map(e => ({ ...e, fa: 1, prog: 0, t0: -1 }));
  const byId = new Map(nodes.map(n => [n.id, n]));

  const COLOR = { Paper:'#d96a86', AstronomicalSource:'#2bab9b', WhiteDwarfCategory:'#9a7adf',
    Survey:'#7088e0', ObservationInstrument:'#52a8cb', AnalysisMethod:'#3bb07e',
    PhysicalModel:'#df8a4f', PhysicalParameter:'#ecb14e' };
  const SHAPE = { Paper:'hex', AstronomicalSource:'ring', WhiteDwarfCategory:'pen',
    Survey:'tri', ObservationInstrument:'cir', AnalysisMethod:'rsq',
    PhysicalModel:'oct', PhysicalParameter:'dia' };
  const GLYPH = { Paper:'¶', WhiteDwarfCategory:'★', Survey:'◎', ObservationInstrument:'◉',
    AnalysisMethod:'∿', PhysicalModel:'◇', PhysicalParameter:'σ' };
  const ABBR  = { Paper:'paper', AstronomicalSource:'source', WhiteDwarfCategory:'WD class',
    Survey:'survey', ObservationInstrument:'instrument', AnalysisMethod:'method',
    PhysicalModel:'model', PhysicalParameter:'parameter' };
  const col = t => COLOR[t] || '#98a2b3';
  const ACC = [224, 151, 90];                   // --accent rgb
  const accs = a => 'rgba(' + ACC[0] + ',' + ACC[1] + ',' + ACC[2] + ',' + a + ')';

  const adj = new Map(); nodes.forEach(n => adj.set(n.id, []));
  edges.forEach((e, i) => {
    adj.get(e.s).push({ o: e.t, rel: e.rel, out: true, ei: i });
    adj.get(e.t).push({ o: e.s, rel: e.rel, out: false, ei: i });
  });

  let W = 0, H = 0, sel = null, hover = null, visible = true, raf = 0, timer = 0;
  let mode = 'settle', alpha = 0, T = 0, last = 0, selStart = -1;
  const arrived = new Set();          // neighbour ids whose pulse has landed (this selection)
  let ambient = [];                   // idle "thinking" pulses
  let nextAmbient = 1.4;
  const radius = n => 10 + Math.min(13, n.deg * 1.6);
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;

  // ---- layout: cluster each type around its own anchor, then relax ----
  function anchors() {
    const types = [...new Set(nodes.map(n => n.type))], m = {};
    types.forEach((ty, i) => {
      const a = (i / types.length) * Math.PI * 2 - Math.PI / 2;
      m[ty] = [W * 0.5 + Math.cos(a) * W * 0.27, H * 0.46 + Math.sin(a) * H * 0.30];
    });
    return m;
  }
  let ANCH = {};
  function seed() {
    ANCH = anchors();
    nodes.forEach((n, i) => {
      const a = ANCH[n.type] || [W / 2, H / 2];
      const ang = i * 2.39996, sp = 30 + (i % 6) * 9;
      n.x = a[0] + Math.cos(ang) * sp; n.y = a[1] + Math.sin(ang) * sp; n.vx = n.vy = 0;
      n.rx = n.x; n.ry = n.y;
    });
    alpha = 1; mode = 'settle';
  }
  function simulate() {
    const pad = 40;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 1;
        const d = Math.sqrt(d2), min = radius(a) + radius(b) + 26;
        const f = (3400 / d2 + (d < min ? (min - d) * 0.9 : 0)) * alpha;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
      }
    }
    edges.forEach(e => {
      const a = byId.get(e.s), b = byId.get(e.t);
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - 96) * 0.045 * alpha, ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
    });
    nodes.forEach(n => {
      const a = ANCH[n.type] || [W / 2, H / 2];
      n.vx += (a[0] - n.x) * 0.012 * alpha; n.vy += (a[1] - n.y) * 0.012 * alpha;
      n.vx += (W / 2 - n.x) * 0.004 * alpha; n.vy += (H / 2 - n.y) * 0.004 * alpha;
      n.x += (n.vx *= 0.84); n.y += (n.vy *= 0.84);
      n.x = Math.max(pad, Math.min(W - pad, n.x));
      n.y = Math.max(pad, Math.min(H - pad - 14, n.y));
    });
  }

  // ---- shapes ----
  function poly(x, y, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + i * Math.PI * 2 / sides, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function nodeShape(n, r) {
    const s = SHAPE[n.type] || 'cir';
    if (s === 'hex') poly(n.rx, n.ry, r, 6, Math.PI / 6);
    else if (s === 'rsq') rrect(n.rx - r, n.ry - r, r * 2, r * 2, 6);
    else if (s === 'dia') poly(n.rx, n.ry, r, 4, Math.PI / 4);
    else if (s === 'tri') poly(n.rx, n.ry + 1, r, 3, -Math.PI / 2);
    else if (s === 'pen') poly(n.rx, n.ry, r, 5, -Math.PI / 2);
    else if (s === 'oct') poly(n.rx, n.ry, r, 8, Math.PI / 8);
    else { ctx.beginPath(); ctx.arc(n.rx, n.ry, r, 0, 7); }
  }

  function drawNode(n, focused) {
    const r = radius(n) * n.pop, c = col(n.type);
    ctx.save();
    ctx.globalAlpha = n.fa;
    // breathing halo on the focused node
    const halo = focused ? r + 5 + Math.sin(T * 3) * 2.4 : r + 4;
    ctx.beginPath(); ctx.arc(n.rx, n.ry, halo, 0, 7);
    ctx.fillStyle = focused ? accs(0.22 + 0.06 * (0.5 + 0.5 * Math.sin(T * 3))) : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.shadowColor = focused ? accs(0.5) : 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = focused ? 20 : 9; ctx.shadowOffsetY = 1;
    ctx.fillStyle = c; ctx.strokeStyle = focused ? '#f3ecdd' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = focused ? 2.6 : 1.2;
    nodeShape(n, r); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    if ((SHAPE[n.type] || 'cir') === 'ring') {
      ctx.beginPath(); ctx.arc(n.rx, n.ry, Math.max(3, r * 0.28), 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(n.rx, n.ry, Math.max(6, r * 0.54), 0, 7);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      const g = GLYPH[n.type] || '•';
      ctx.font = '800 ' + Math.max(11, Math.min(18, r * 0.8)) + 'px "Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g, n.rx, n.ry + 1);
    }
    ctx.restore();
  }

  // a dot travelling along an edge at fraction f (0=s … 1=t)
  function pulseDot(e, f, r, c) {
    const a = byId.get(e.s), b = byId.get(e.t);
    const x = a.rx + (b.rx - a.rx) * f, y = a.ry + (b.ry - a.ry) * f;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, c); g.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const focusId = hover != null ? hover : sel;
    const active = focusId != null ? new Set([focusId, ...adj.get(focusId).map(a => a.o)]) : null;

    ctx.font = '600 12.5px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(180,169,142,0.85)';
    ctx.fillText('source · method · model · parameter network', 14, 22);

    // ---- edges ----
    edges.forEach(e => {
      const a = byId.get(e.s), b = byId.get(e.t);
      const incident = focusId != null && (e.s === focusId || e.t === focusId);
      ctx.globalAlpha = e.fa;
      ctx.strokeStyle = 'rgba(190,180,150,.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.rx, a.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke();

      // bright "drawing" wipe + travelling pulse along the selected entity's edges
      if (incident && sel != null && (e.s === sel || e.t === sel)) {
        const fromS = e.s === sel;
        const sx = fromS ? a.rx : b.rx, sy = fromS ? a.ry : b.ry;
        const ex = fromS ? b.rx : a.rx, ey = fromS ? b.ry : a.ry;
        const p = easeOut(e.prog);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accs(.55); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (ex - sx) * p, sy + (ey - sy) * p); ctx.stroke();
        // pulse: wavefront while arriving, then a continuous outward flow
        const f = e.prog < 1 ? p : ((T - e.t0) * 0.55) % 1;
        const dir = fromS ? f : 1 - f;
        pulseDot(e, dir, 2.6, accs(.95));
        // relation label at midpoint, fading in with progress
        const mx = (a.rx + b.rx) / 2, my = (a.ry + b.ry) / 2;
        ctx.globalAlpha = e.prog;
        ctx.font = '600 10px ui-monospace,Menlo,monospace';
        const w = ctx.measureText(e.rel).width + 8;
        ctx.fillStyle = 'rgba(24,21,13,.95)'; rrect(mx - w / 2, my - 7, w, 14, 5); ctx.fill();
        ctx.strokeStyle = accs(.4); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e0975a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.rel, mx, my);
      } else if (incident && sel == null) {
        // hover: simple brighten, no traversal
        ctx.globalAlpha = 1; ctx.strokeStyle = accs(.4); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(a.rx, a.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke();
      }
    });

    // ---- ambient idle pulses ----
    ctx.globalAlpha = 1;
    ambient.forEach(p => {
      const f = clamp01((T - p.t0) / 1.25);
      pulseDot(edges[p.ei], p.dir ? f : 1 - f, 1.7, accs(.34 * Math.sin(f * Math.PI)));
    });

    // ---- nodes + labels ----
    ctx.globalAlpha = 1;
    nodes.forEach(n => drawNode(n, n.id === focusId));
    nodes.forEach(n => {
      const show = n.type === 'Paper' || n.id === focusId || (active && active.has(n.id));
      if (!show) return;
      const text = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label;
      ctx.globalAlpha = n.fa;
      ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const w = Math.min(ctx.measureText(text).width + 12, 168), y = n.ry + radius(n) * n.pop + 6;
      ctx.fillStyle = 'rgba(24,21,13,.92)';
      ctx.strokeStyle = n.id === focusId ? accs(.65) : 'rgba(255,255,255,.16)';
      ctx.lineWidth = 1; rrect(n.rx - w / 2, y, w, 17, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#efe7d4'; ctx.fillText(text, n.rx, y + 3, w - 8);
    });
    ctx.globalAlpha = 1;

    // ---- legend ----
    const used = [...new Set(nodes.map(n => n.type))];
    ctx.font = '10px system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let lx = 12, ly = H - 30;
    for (const ty of used) {
      const lab = ABBR[ty] || ty, tw = ctx.measureText(lab).width;
      if (lx + 16 + tw > W - 10) { lx = 12; ly += 15; }
      ctx.fillStyle = col(ty); ctx.beginPath(); ctx.arc(lx + 4, ly, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(180,169,142,.85)'; ctx.fillText(lab, lx + 12, ly + 0.5);
      lx += 18 + tw + 8;
    }
    ctx.textBaseline = 'alphabetic';
  }

  // ---- per-frame animation state (eased targets, bob, traversal, ambient) ----
  function animate(dt) {
    const live = mode === 'live';
    const focusId = hover != null ? hover : sel;
    const active = focusId != null ? new Set([focusId, ...adj.get(focusId).map(a => a.o)]) : null;

    nodes.forEach(n => {
      const bx = live ? Math.sin(T * 0.7 + n.ph) * 2.1 : 0;
      const by = live ? Math.cos(T * 0.9 + n.ph * 1.3) * 2.1 : 0;
      n.rx = (live ? n.hx : n.x) + bx; n.ry = (live ? n.hy : n.y) + by;
      const tgt = active ? (active.has(n.id) ? 1 : 0.28) : 1;
      n.fa += (tgt - n.fa) * Math.min(1, dt * 9);
      n.pop += (1 - n.pop) * Math.min(1, dt * 8);   // settle pops back to 1
    });

    edges.forEach((e, i) => {
      const incident = focusId != null && (e.s === focusId || e.t === focusId);
      const tgt = active ? (incident ? 1 : 0.1) : 1;
      e.fa += (tgt - e.fa) * Math.min(1, dt * 9);
      // traversal progress for edges incident to the *selected* entity
      if (sel != null && (e.s === sel || e.t === sel)) {
        if (e.t0 < 0) e.t0 = selStart + 0.18 + i % 7 * 0.02;  // tiny variation
        e.prog = clamp01((T - e.t0) / 0.5);
        const nb = e.s === sel ? e.t : e.s;
        if (e.prog > 0.82 && !arrived.has(nb)) { arrived.add(nb); const m = byId.get(nb); if (m) m.pop = 1.42; }
      } else { e.t0 = -1; e.prog = 0; }
    });

    // ambient "thinking" pulses while idle
    if (live && sel == null && T > nextAmbient && edges.length) {
      ambient.push({ ei: (Math.random() * edges.length) | 0, t0: T, dir: Math.random() < 0.5 });
      nextAmbient = T + 1.6 + Math.random() * 1.8;
    }
    ambient = ambient.filter(p => T - p.t0 < 1.25);
  }

  // ---- RAG context panel ----
  const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const trim = s => s.length > 22 ? s.slice(0, 21) + '…' : s;
  function fillContext(id) {
    const n = byId.get(id), links = adj.get(id);
    let html = '<div class="kg-ctx-head">retrieved: <b>' + esc(n.full || n.label) + '</b> <span class="kg-type">' + n.type + '</span></div>';
    if (!links.length) html += '<div class="kg-ctx-row">— no relations in this subgraph —</div>';
    links.forEach((a, i) => {
      const o = byId.get(a.o), s = a.out ? n : o, e = a.out ? o : n;
      html += '<div class="kg-ctx-row kg-ctx-step" style="transition-delay:' + (0.16 + i * 0.09).toFixed(2) + 's">'
        + '<span class="kg-s">' + esc(trim(s.label)) + '</span><span class="kg-r">' + esc(a.rel)
        + '</span><span class="kg-o">' + esc(trim(e.label)) + '</span></div>';
    });
    elCtx.innerHTML = html; elCtx.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      elCtx.querySelectorAll('.kg-ctx-step').forEach(r => r.classList.add('is-in'));
    }));
  }
  function select(id) {
    sel = id; selStart = T; arrived.clear();
    edges.forEach(e => { e.t0 = -1; e.prog = 0; });
    const m = byId.get(id); if (m) m.pop = 1.4;
    [...elChips.children].forEach(c => c.classList.toggle('active', +c.dataset.id === id));
    if (elMode) elMode.textContent = 'BM25/vector → graph hop';
    fillContext(id); draw(); kick();
  }
  function clearSel() {
    sel = null; arrived.clear();
    [...elChips.children].forEach(c => c.classList.remove('active'));
    if (elMode) elMode.textContent = 'BM25 + graph';
    elCtx.innerHTML = '<div class="kg-ctx-row kg-ctx-hint">Pick a query → the agent retrieves an entity, then traverses the graph for connected context.</div>';
    draw();
  }
  function buildChips() {
    const top = [...nodes].sort((a, b) => b.deg - a.deg).slice(0, 6);
    elChips.innerHTML = '';
    top.forEach(n => {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.id = n.id; b.textContent = trim(n.label);
      b.title = n.full || n.label; b.addEventListener('click', () => select(n.id));
      elChips.appendChild(b);
    });
    const clr = document.createElement('button');
    clr.className = 'chip kg-clear'; clr.textContent = 'Clear';
    clr.addEventListener('click', clearSel); elChips.appendChild(clr);
  }

  // ---- pointer ----
  function nodeAt(mx, my) {
    let best = null, bd = 1e9;
    for (const n of nodes) { const d = (mx - n.rx) ** 2 + (my - n.ry) ** 2; if (d < bd && d < (radius(n) + 7) ** 2) { bd = d; best = n; } }
    return best;
  }
  canvas.addEventListener('mousemove', ev => {
    const r = canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const n = nodeAt(mx, my), id = n ? n.id : null;
    canvas.style.cursor = n ? 'pointer' : 'default';
    if (id !== hover) { hover = id; kick(); }
    if (n) {
      tip.innerHTML = '<b>' + esc(n.full || n.label) + '</b><span>' + esc(n.type) + ' · degree ' + n.deg + '</span>';
      tip.style.display = 'block';
      tip.style.left = Math.min(W - 200, mx + 14) + 'px'; tip.style.top = Math.max(6, my + 12) + 'px';
    } else tip.style.display = 'none';
  });
  canvas.addEventListener('mouseleave', () => { hover = null; tip.style.display = 'none'; });
  canvas.addEventListener('click', ev => {
    const r = canvas.getBoundingClientRect(); const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (n) select(n.id);
  });

  // ---- loop (always animates while visible) ----
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    T += dt;
    if (mode === 'settle') {
      simulate(); alpha *= 0.95;
      if (alpha < 0.03) { nodes.forEach(n => { n.hx = n.x; n.hy = n.y; }); mode = 'live'; }
    }
    animate(dt); draw();
    if (running()) start();
  }
  function running() { return !reduce && visible && !document.hidden; }
  function start() { if (raf || timer || !running()) return; timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(loop); }, FRAME_MS); }
  function kick() { if (!raf && !timer) { last = 0; start(); } }
  function stop() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = 0; timer = 0; last = 0; }
  function onScreen() { const r = canvas.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }

  // ---- init ----
  if (elShown) elShown.textContent = (DATA.stats.papers || 3) + ' papers · ' + DATA.stats.entities + ' entities';
  function relayout() {
    resize(); seed();
    for (let i = 0; i < 220; i++) { simulate(); alpha *= 0.97; }
    nodes.forEach(n => { n.hx = n.x; n.hy = n.y; n.rx = n.x; n.ry = n.y; });
    mode = 'live'; alpha = 0;
  }
  buildChips(); clearSel(); relayout(); draw();
  if (!reduce) {
    let pw = canvas.clientWidth, ph = canvas.clientHeight;
    window.addEventListener('resize', () => {
      const ow = canvas.clientWidth, oh = canvas.clientHeight;
      if (ow !== pw || oh !== ph) { pw = ow; ph = oh; relayout(); } else { resize(); }
      draw(); kick();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); else stop(); }, { threshold: 0.05 }).observe(canvas);
    } else { visible = true; kick(); }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : kick());
    visible = onScreen(); kick();
  }
})();
