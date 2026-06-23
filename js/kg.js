/* =================================================================
   Knowledge graph + dual-track RAG (Astro Agent).
   Re-styled to match my local KG frontend (graph_for_astronomy/frontend):
   a type-anchored force layout on a light viewport, polygon nodes by type
   (hexagon / rounded-square / diamond / triangle / pentagon) with centre
   glyphs, soft halos, rounded pill labels and focus-dimmed edges.
   Data: real subgraph of the white-dwarf KG (js/kgdata.js). Click a query
   to mimic the kg_navigator: BM25/vector recall lands on an entity, then
   multi-hop graph traversal pulls in the connected context.
   ================================================================= */
(function () {
  const canvas = document.getElementById('kgCanvas');
  if (!canvas || !window.KG_DATA) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elCtx   = document.getElementById('kgCtx');
  const elChips = document.getElementById('kgChips');
  const elMode  = document.getElementById('kgMode');
  const elShown = document.getElementById('kgShown');
  const wrap    = canvas.parentElement;
  const tip = document.createElement('div'); tip.className = 'kg-tip'; tip.style.display = 'none';
  wrap.appendChild(tip);

  const DATA = window.KG_DATA;
  const nodes = DATA.nodes.map(n => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
  const edges = DATA.edges;
  const byId = new Map(nodes.map(n => [n.id, n]));

  // the project's 8 KG entity types → colour / shape / glyph / short legend label
  const COLOR = { Paper:'#de5b7c', AstronomicalSource:'#0b9c8e', WhiteDwarfCategory:'#855bd7',
    Survey:'#5367dd', ObservationInstrument:'#3aa0c8', AnalysisMethod:'#2e9e6b',
    PhysicalModel:'#d5733a', PhysicalParameter:'#f2a93b' };
  const SHAPE = { Paper:'hex', AstronomicalSource:'ring', WhiteDwarfCategory:'pen',
    Survey:'tri', ObservationInstrument:'cir', AnalysisMethod:'rsq',
    PhysicalModel:'oct', PhysicalParameter:'dia' };
  const GLYPH = { Paper:'¶', WhiteDwarfCategory:'★', Survey:'◎', ObservationInstrument:'◉',
    AnalysisMethod:'∿', PhysicalModel:'◇', PhysicalParameter:'σ' };
  const ABBR  = { Paper:'paper', AstronomicalSource:'source', WhiteDwarfCategory:'WD class',
    Survey:'survey', ObservationInstrument:'instrument', AnalysisMethod:'method',
    PhysicalModel:'model', PhysicalParameter:'parameter' };
  const col = t => COLOR[t] || '#98a2b3';

  const adj = new Map(); nodes.forEach(n => adj.set(n.id, []));
  edges.forEach((e, i) => {
    adj.get(e.s).push({ o: e.t, rel: e.rel, out: true, ei: i });
    adj.get(e.t).push({ o: e.s, rel: e.rel, out: false, ei: i });
  });

  let W = 0, H = 0, sel = null, hover = null, visible = true, raf = 0, timer = 0, last = 0, alpha = 0;
  const radius = n => 10 + Math.min(13, n.deg * 1.6);

  // ---- layout: cluster each type around its own anchor, then relax ----
  function anchors() {
    const types = [...new Set(nodes.map(n => n.type))];
    const m = {};
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
    });
    alpha = 1;
  }
  function simulate() {
    const pad = 40;
    // repulsion (n is small)
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
    // springs
    edges.forEach(e => {
      const a = byId.get(e.s), b = byId.get(e.t);
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - 96) * 0.045 * alpha, ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
    });
    // anchor pull + integrate
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
    if (s === 'hex') poly(n.x, n.y, r, 6, Math.PI / 6);
    else if (s === 'rsq') rrect(n.x - r, n.y - r, r * 2, r * 2, 6);
    else if (s === 'dia') poly(n.x, n.y, r, 4, Math.PI / 4);
    else if (s === 'tri') poly(n.x, n.y + 1, r, 3, -Math.PI / 2);
    else if (s === 'pen') poly(n.x, n.y, r, 5, -Math.PI / 2);
    else if (s === 'oct') poly(n.x, n.y, r, 8, Math.PI / 8);
    else { ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); }
  }

  function drawNode(n, focused, dim) {
    const r = radius(n), c = col(n.type);
    ctx.save();
    ctx.globalAlpha = dim ? 0.32 : 1;
    // halo
    ctx.beginPath(); ctx.arc(n.x, n.y, r + (focused ? 7 : 4), 0, 7);
    ctx.fillStyle = focused ? 'rgba(18,204,185,0.22)' : 'rgba(255,255,255,0.9)'; ctx.fill();
    // body
    ctx.shadowColor = focused ? 'rgba(18,204,185,0.40)' : 'rgba(23,32,51,0.18)';
    ctx.shadowBlur = focused ? 18 : 8; ctx.shadowOffsetY = 1;
    ctx.fillStyle = c; ctx.strokeStyle = focused ? '#172033' : 'rgba(23,32,51,0.18)';
    ctx.lineWidth = focused ? 2.6 : 1.2;
    nodeShape(n, r); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // glyph
    ctx.fillStyle = '#fff';
    if ((SHAPE[n.type] || 'cir') === 'ring') {
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(3, r * 0.28), 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(6, r * 0.54), 0, 7);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      const g = GLYPH[n.type] || '•';
      ctx.font = '800 ' + Math.max(11, Math.min(18, r * 0.8)) + 'px "Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g, n.x, n.y + 1);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const act = sel != null ? new Set([sel, ...adj.get(sel).map(a => a.o)]) : null;
    const focusId = hover != null ? hover : sel;

    // panel title (echoes my local KG frontend)
    ctx.font = '600 12.5px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#3a4a66';
    ctx.fillText('source · method · model · parameter network', 14, 22);

    // edges
    edges.forEach(e => {
      const a = byId.get(e.s), b = byId.get(e.t);
      const on = focusId != null && (e.s === focusId || e.t === focusId);
      ctx.strokeStyle = on ? 'rgba(31,42,68,.55)' : 'rgba(70,90,130,.22)';
      ctx.globalAlpha = focusId != null ? (on ? 1 : 0.12) : 1;
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (on) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        ctx.font = '600 10px ui-monospace,Menlo,monospace';
        const w = ctx.measureText(e.rel).width + 8;
        ctx.fillStyle = 'rgba(255,255,255,.92)'; rrect(mx - w / 2, my - 7, w, 14, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(83,103,221,.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#5367dd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.rel, mx, my);
      }
    });
    ctx.globalAlpha = 1;

    // nodes
    nodes.forEach(n => drawNode(n, n.id === focusId, act != null && !act.has(n.id)));

    // pill labels — only papers by default, plus the focused node + its neighbours
    nodes.forEach(n => {
      const show = n.type === 'Paper' || n.id === focusId || (act && act.has(n.id));
      if (!show) return;
      const dim = act != null && !act.has(n.id);
      const text = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label;
      ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const w = Math.min(ctx.measureText(text).width + 12, 168), y = n.y + radius(n) + 6;
      ctx.globalAlpha = dim ? 0.4 : 1;
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.strokeStyle = n.id === focusId ? 'rgba(18,204,185,.6)' : 'rgba(210,222,228,.95)';
      ctx.lineWidth = 1; rrect(n.x - w / 2, y, w, 17, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#243049'; ctx.fillText(text, n.x, y + 3, w - 8);
      ctx.globalAlpha = 1;
    });

    // entity-type legend (wraps across the bottom)
    const used = [...new Set(nodes.map(n => n.type))];
    ctx.font = '10px system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let lx = 12, ly = H - 30;
    for (const ty of used) {
      const lab = ABBR[ty] || ty, tw = ctx.measureText(lab).width;
      if (lx + 16 + tw > W - 10) { lx = 12; ly += 15; }
      ctx.fillStyle = col(ty); ctx.beginPath(); ctx.arc(lx + 4, ly, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#5c6b85'; ctx.fillText(lab, lx + 12, ly + 0.5);
      lx += 18 + tw + 8;
    }
    ctx.textBaseline = 'alphabetic';
  }

  // ---- RAG context panel ----
  const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const trim = s => s.length > 22 ? s.slice(0, 21) + '…' : s;
  function fillContext(id) {
    const n = byId.get(id), links = adj.get(id);
    let html = '<div class="kg-ctx-head">retrieved: <b>' + esc(n.full || n.label) + '</b> <span class="kg-type">' + n.type + '</span></div>';
    if (!links.length) html += '<div class="kg-ctx-row">— no relations in this subgraph —</div>';
    links.forEach(a => {
      const o = byId.get(a.o), s = a.out ? n : o, e = a.out ? o : n;
      html += '<div class="kg-ctx-row"><span class="kg-s">' + esc(trim(s.label)) + '</span><span class="kg-r">' + esc(a.rel) + '</span><span class="kg-o">' + esc(trim(e.label)) + '</span></div>';
    });
    elCtx.innerHTML = html; elCtx.scrollTop = 0;
  }
  function select(id) {
    sel = id;
    [...elChips.children].forEach(c => c.classList.toggle('active', +c.dataset.id === id));
    if (elMode) elMode.textContent = 'BM25/vector → graph hop';
    fillContext(id); draw();
  }
  function clearSel() {
    sel = null; [...elChips.children].forEach(c => c.classList.remove('active'));
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
    for (const n of nodes) { const d = (mx - n.x) ** 2 + (my - n.y) ** 2; if (d < bd && d < (radius(n) + 6) ** 2) { bd = d; best = n; } }
    return best;
  }
  canvas.addEventListener('mousemove', ev => {
    const r = canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const n = nodeAt(mx, my); const id = n ? n.id : null;
    canvas.style.cursor = n ? 'pointer' : 'default';
    if (id !== hover) { hover = id; draw(); }
    if (n) {
      tip.innerHTML = '<b>' + esc(n.full || n.label) + '</b><span>' + esc(n.type) + ' · degree ' + n.deg + '</span>';
      tip.style.display = 'block';
      tip.style.left = Math.min(W - 200, mx + 14) + 'px'; tip.style.top = Math.max(6, my + 12) + 'px';
    } else tip.style.display = 'none';
  });
  canvas.addEventListener('mouseleave', () => { hover = null; tip.style.display = 'none'; draw(); });
  canvas.addEventListener('click', ev => {
    const r = canvas.getBoundingClientRect(); const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (n) select(n.id);
  });

  // ---- loop (settle, then idle) ----
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function settling() { return !reduce && alpha > 0.02 && visible && !document.hidden; }
  function loop() {
    raf = 0;
    if (settling()) { simulate(); alpha *= 0.96; }
    draw();
    if (settling()) start();
  }
  function start() { if (raf || timer || !settling()) return; timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(loop); }, FRAME_MS); }
  function stop() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = 0; timer = 0; }
  function isVisible() { const r = canvas.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }

  // ---- init ----
  if (elShown) elShown.textContent = (DATA.stats.papers || 3) + ' papers · ' + DATA.stats.entities + ' entities';
  resize(); seed(); buildChips(); clearSel();
  if (reduce) { for (let i = 0; i < 260; i++) { simulate(); alpha *= 0.99; } alpha = 0; draw(); }
  else {
    let started = false;
    window.addEventListener('resize', () => { resize(); seed(); start(); });
    const kick = () => { if (!started && visible) { started = true; alpha = 1; start(); } else start(); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); else stop(); }, { threshold: 0.05 });
      io.observe(canvas);
    } else { visible = true; kick(); }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    visible = isVisible(); if (visible) kick();
  }
})();
