/* =================================================================
   Knowledge graph + dual-track RAG (Astro Agent).
   Renders a REAL connected subgraph of my white-dwarf knowledge graph
   (entities + typed relations extracted from the literature; data in
   js/kgdata.js). Click a query to mimic the kg_navigator: BM25/vector
   recall lands on an entity, then multi-hop graph traversal pulls in the
   connected context. Layout is precomputed; relations are real.
   ================================================================= */
(function () {
  const canvas = document.getElementById('kgCanvas');
  if (!canvas || !window.KG_DATA) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const DATA = window.KG_DATA;
  const nodes = DATA.nodes, edges = DATA.edges;
  const elCtx   = document.getElementById('kgCtx');
  const elChips = document.getElementById('kgChips');
  const elMode  = document.getElementById('kgMode');
  const elShown = document.getElementById('kgShown');

  const TYPE_COLOR = {
    paper:'#cc79a7', source:'#56b4e9', survey:'#0072b2', method:'#4fd0e3',
    parameter:'#e69f00', process:'#d55e00', concept:'#009e73',
    instrument:'#f0e442', telescope:'#f0e442'
  };
  const tcol = t => TYPE_COLOR[t] || '#9fb0d6';

  // adjacency (both directions, keep relation + orientation)
  const adj = new Map(); nodes.forEach(n => adj.set(n.id, []));
  edges.forEach((e, i) => {
    adj.get(e.s).push({ o: e.t, rel: e.rel, out: true, ei: i });
    adj.get(e.t).push({ o: e.s, rel: e.rel, out: false, ei: i });
  });
  const byId = new Map(nodes.map(n => [n.id, n]));

  let W = 0, H = 0, sel = null, visible = true, raf = 0, timer = 0, last = 0, t = 0;

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const PAD = 30;
  const X = n => PAD + n.x * (W - 2 * PAD);
  const Y = n => 16 + n.y * (H - 46);          // leave room for the legend strip
  const rad = n => 5 + Math.min(7, n.deg * 1.1);

  function activeSet() {
    if (sel == null) return null;
    const s = new Set([sel]);
    for (const a of adj.get(sel)) s.add(a.o);
    return s;
  }
  function isActiveEdge(e) { return sel != null && (e.s === sel || e.t === sel); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const act = activeSet();

    // edges
    for (const e of edges) {
      const a = byId.get(e.s), b = byId.get(e.t);
      const on = isActiveEdge(e);
      ctx.strokeStyle = on ? 'rgba(79,208,227,.8)' : (sel != null ? 'rgba(120,150,210,.10)' : 'rgba(120,150,210,.28)');
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
      if (on) {
        // travelling retrieval pulse from sel outward
        const from = e.s === sel ? a : b, to = e.s === sel ? b : a;
        const u = (t % 1);
        const px = X(from) + (X(to) - X(from)) * u, py = Y(from) + (Y(to) - Y(from)) * u;
        ctx.fillStyle = 'rgba(127,231,243,.9)';
        ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 7); ctx.fill();
        // relation label at midpoint
        const mx = (X(a) + X(b)) / 2, my = (Y(a) + Y(b)) / 2;
        ctx.font = '10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
        const w = ctx.measureText(e.rel).width + 8;
        ctx.fillStyle = 'rgba(7,11,22,.82)'; roundRect(mx - w / 2, my - 7, w, 14, 5); ctx.fill();
        ctx.fillStyle = '#9fe7f2'; ctx.textBaseline = 'middle'; ctx.fillText(e.rel, mx, my); ctx.textBaseline = 'alphabetic';
      }
    }

    // nodes
    for (const n of nodes) {
      const dim = act && !act.has(n.id);
      const r = rad(n), c = tcol(n.type);
      ctx.globalAlpha = dim ? 0.28 : 1;
      if (n.id === sel) { ctx.shadowColor = c; ctx.shadowBlur = 16; }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(n), Y(n), r, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = n.id === sel ? 2 : 1; ctx.strokeStyle = 'rgba(7,11,22,.6)'; ctx.stroke();
      // label
      ctx.font = (n.id === sel ? '600 ' : '') + '11px system-ui,sans-serif';
      ctx.fillStyle = dim ? 'rgba(159,176,214,.5)' : (n.id === sel ? '#fff' : '#cdd8f2');
      ctx.textAlign = 'center';
      ctx.fillText(n.label, X(n), Y(n) - r - 4);
      ctx.globalAlpha = 1;
    }

    // type legend strip
    const types = [...new Set(nodes.map(n => n.type))];
    let lx = 12; const ly = H - 10;
    ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (const ty of types) {
      ctx.fillStyle = tcol(ty); ctx.beginPath(); ctx.arc(lx + 4, ly - 3, 4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(170,182,212,.75)'; ctx.fillText(ty, lx + 12, ly);
      lx += 22 + ctx.measureText(ty).width;
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- RAG context panel ----
  function fillContext(id) {
    const n = byId.get(id);
    const links = adj.get(id);
    let html = '<div class="kg-ctx-head">retrieved: <b>' + esc(n.full || n.label) + '</b> '
             + '<span class="kg-type">' + n.type + '</span></div>';
    if (!links.length) html += '<div class="kg-ctx-row">— no outgoing relations in this subgraph —</div>';
    links.forEach(a => {
      const o = byId.get(a.o);
      const s = a.out ? n : o, e = a.out ? o : n;
      html += '<div class="kg-ctx-row"><span class="kg-s">' + esc(trim(s.label)) + '</span>'
            + '<span class="kg-r">' + esc(a.rel) + '</span>'
            + '<span class="kg-o">' + esc(trim(e.label)) + '</span></div>';
    });
    elCtx.innerHTML = html;
    elCtx.scrollTop = 0;
  }
  const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const trim = s => s.length > 22 ? s.slice(0, 21) + '…' : s;

  function select(id) {
    sel = id;
    [...elChips.children].forEach(c => c.classList.toggle('active', +c.dataset.id === id));
    if (elMode) elMode.textContent = 'BM25/vector → graph hop';
    fillContext(id);
    draw(); start();
  }
  function clearSel() {
    sel = null;
    [...elChips.children].forEach(c => c.classList.remove('active'));
    if (elMode) elMode.textContent = 'BM25 + graph';
    elCtx.innerHTML = '<div class="kg-ctx-row kg-ctx-hint">Pick a query → the agent retrieves an entity, then traverses the graph for connected context.</div>';
    draw(); stop();
  }

  // ---- query chips: top-degree entities ----
  function buildChips() {
    const top = [...nodes].sort((a, b) => b.deg - a.deg).slice(0, 6);
    elChips.innerHTML = '';
    top.forEach(n => {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.id = n.id;
      b.textContent = trim(n.label);
      b.title = n.full || n.label;
      b.addEventListener('click', () => select(n.id));
      elChips.appendChild(b);
    });
    const clr = document.createElement('button');
    clr.className = 'chip kg-clear'; clr.textContent = 'Clear';
    clr.addEventListener('click', clearSel);
    elChips.appendChild(clr);
  }

  // click a node directly
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = 16 * 16;
    for (const n of nodes) {
      const dx = mx - X(n), dy = my - Y(n), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n; }
    }
    if (best) select(best.id);
  });

  // ---- loop (only animates while a query is active) ----
  function canAnimate() { return !reduce && sel != null && visible && !document.hidden; }
  function loop(now) {
    raf = 0;
    if (canAnimate()) { const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1; last = now; t = (t + 0.03 * dt) % 1; }
    draw(); start();
  }
  function start() { if (!canAnimate() || raf || timer) return; timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(loop); }, FRAME_MS); }
  function stop() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = 0; timer = 0; last = 0; }

  function isVisible() {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }

  // ---- init ----
  if (elShown) elShown.textContent = DATA.stats.shown + ' of ' + DATA.stats.entities + ' entities';
  resize(); buildChips(); clearSel();
  if (reduce) { sel = [...nodes].sort((a, b) => b.deg - a.deg)[0].id; fillContext(sel); draw(); }
  else {
    window.addEventListener('resize', () => { resize(); draw(); });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 });
      io.observe(canvas);
    }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    visible = isVisible();
  }
})();
