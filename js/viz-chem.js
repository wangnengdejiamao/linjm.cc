/* viz-chem.js — Fig C·2 "Extraction refinery": literature -> audited triple -> community graph -> Neo4j.
   Schematic of the real PKU electrolyte pipeline; tokens and scores are illustrative. */
(function () {
  'use strict';
  const root = document.getElementById('chemRefinery');
  if (!root || !window.TV) return;
  const T = window.TV, C = T.C, clamp = T.clamp, lerp = T.lerp, rgba = T.rgba, F = T.font;
  const ACC = C.mint, PI = Math.PI;

  const fig = T.mount(root, {
    domain: 'chem',
    kicker: 'Fig C·2 — Extraction refinery · paper → audited triple → graph',
    status: 'live · illustrative stream',
    stack: ['PyMuPDF', 'schema-based LLM extraction', 'LLM-as-judge QC', 'Union-Find', 'PubChem CID · SQLite', 'graspologic Leiden', 'Neo4j', 'Graph-RAG'],
    note: 'Schematic of the real pipeline · tokens and scores are illustrative',
    height: 560,
    aria: 'Animated schematic: electrolyte papers are chunked, passed through three LLM extraction stages, scored by an LLM validation gate with threshold theta, de-duplicated by Union-Find and PubChem CID alignment, organised into Leiden communities and written to Neo4j.',
    controls: true
  });
  const ctx = fig.ctx;

  /* ---------------- data ---------------- */
  const COMM = {
    sol: { name: 'Solvents', c: C.steel, sum: 'carbonate solvent family' },
    salt: { name: 'Li salts', c: C.amber, sum: 'lithium salts in carbonates' },
    add: { name: 'Additives', c: C.mint, sum: 'SEI-forming additives' },
    itf: { name: 'Interphase', c: C.plum, sum: 'SEI chemistry & cycling' },
    met: { name: 'Methods', c: C.ember, sum: 'XPS · EIS characterisation' }
  };
  const NODES = [
    { id: 'ec', l: 'EC', cm: 'sol', fx: .10, fy: .14 }, { id: 'dmc', l: 'DMC', cm: 'sol', fx: .30, fy: .10 },
    { id: 'emc', l: 'EMC', cm: 'sol', fx: .19, fy: .31 },
    { id: 'pf6', l: 'LiPF₆', cm: 'salt', fx: .09, fy: .56 }, { id: 'fsi', l: 'LiFSI', cm: 'salt', fx: .27, fy: .74 },
    { id: 'fec', l: 'FEC', cm: 'add', fx: .46, fy: .30 }, { id: 'vc', l: 'VC', cm: 'add', fx: .57, fy: .50 },
    { id: 'dfob', l: 'LiDFOB', cm: 'add', fx: .43, fy: .58 },
    { id: 'sei', l: 'SEI', cm: 'itf', fx: .70, fy: .26 }, { id: 'li2', l: 'Li₂CO₃', cm: 'itf', fx: .88, fy: .36 },
    { id: 'cyc', l: 'cycle life', cm: 'itf', fx: .84, fy: .58 }, { id: 'res', l: 'interf. resistance', cm: 'itf', fx: .74, fy: .08 },
    { id: 'xps', l: 'XPS', cm: 'met', fx: .56, fy: .86 }, { id: 'eis', l: 'EIS', cm: 'met', fx: .80, fy: .84 }
  ];
  const NB = {}; NODES.forEach(n => { NB[n.id] = n; n.arr = -1; n.pulse = -9; n.deg = 0; n.hx = 0; n.hy = 0; });
  const G = (k, h, r, t, hn, tn, alias) => ({ k, h, r, t, hn, tn, alias, bad: false });
  const B = (h, r, t) => ({ k: 'bad-' + h + r, h, r, t, hn: null, tn: null, bad: true });
  const GOOD = [
    G('fec-sei', 'FEC', 'forms', 'LiF-rich SEI', 'fec', 'sei'), G('vc-cyc', 'VC', 'improves', 'cycle life', 'vc', 'cyc'),
    G('pf6-ec', 'LiPF₆', 'dissolved in', 'EC/DMC', 'pf6', 'ec'), G('xps-sei', 'XPS', 'characterises', 'SEI', 'xps', 'sei'),
    G('eis-res', 'EIS', 'measures', 'interfacial resistance', 'eis', 'res'), G('ec-li2', 'EC', 'decomposes to', 'Li₂CO₃', 'ec', 'li2'),
    G('ec-li2', 'EC', 'decomposes to', 'Li₂CO₃', 'ec', 'li2', 'ethylene carbonate'),
    G('dmc-ec', 'DMC', 'co-solvent of', 'EC', 'dmc', 'ec', 'dimethyl carbonate'),
    G('fsi-dmc', 'LiFSI', 'dissolved in', 'DMC', 'fsi', 'dmc'), G('dfob-sei', 'LiDFOB', 'stabilises', 'SEI', 'dfob', 'sei'),
    G('emc-dmc', 'EMC', 'blended with', 'DMC', 'emc', 'dmc'), G('fec-cyc', 'FEC', 'improves', 'cycle life', 'fec', 'cyc'),
    G('vc-sei', 'VC', 'forms', 'SEI', 'vc', 'sei'), G('sei-res', 'SEI', 'raises', 'interfacial resistance', 'sei', 'res')
  ];
  const BAD = [B('DMC', 'is', 'solid electrolyte'), B('XPS', 'dissolves', 'LiPF₆'), B('cycle life', 'decomposes to', 'EC'),
    B('FEC', 'is a', 'Li salt'), B('EIS', 'forms', 'SEI film')];
  const SCRIPT = [0, 1, -1, 2, 3, 4, 6, -2, 7, 5, 8, 9]; // opening order; -n => BAD[n-1]

  /* pipeline timing (seconds of token age): [key, travel, hold] */
  const ST = [['src', 0, .45], ['chunk', .9, .5], ['S1', 1.0, .55], ['S2', .55, .55], ['S3', .55, .6], ['gate', .9, 1.0], ['D1', .8, .8], ['D2', .95, .8], ['exit', .35, 0]];
  const ARR = [], LEV = []; (function () { let a = 0; ST.forEach((s, i) => { a += s[1]; ARR[i] = a; a += s[2]; LEV[i] = a; }); })();
  const FINAL = 1.0, VERD = .55, FALL = .55;
  const STAGE_NAME = ['source', 'PyMuPDF chunk', 'S1 entities', 'S2 relations', 'S3 attributes', 'S4 QC gate', 'Dedup ① Union-Find', 'Dedup ② PubChem CID', 'to graph'];

  /* ---------------- state ---------------- */
  let theta = .5, scen = 'steady', simT = 0, lastT = null, spawnAcc = 0, deckN = 0;
  let rnd = T.rand(20261);
  let tokens = [], packets = [], edges = {}, logs = [], act = {}, gateTok = null;
  let stats, demo, cid, hover = null, sel = null, mouse = null, hudAcc = 0, lastLogKey = '';
  const hud = { c: null, l: null };
  function resetState(full) {
    tokens = []; packets = []; edges = {}; logs = []; act = {}; gateTok = null; simT = 0; spawnAcc = .9; deckN = 0; rnd = T.rand(20261);
    stats = { ext: 0, drop: 0, merged: 0, stored: 0, buf: 0 };
    demo = { t0: -99, idx: 0 }; cid = { t0: -99, ents: {}, generic: false };
    NODES.forEach(n => { n.arr = -1; n.pulse = -9; n.deg = 0; });
    hover = null; sel = null; lastLogKey = '';
  }
  function pushLog(g, html) {
    logs.unshift([g, html]); if (logs.length > 4) logs.pop(); lastLogKey = '';
  }
  function spawn() {
    let def;
    if (deckN < SCRIPT.length) { const s = SCRIPT[deckN]; def = s >= 0 ? GOOD[s] : BAD[-s - 1]; }
    else {
      const pb = scen === 'noisy' ? .42 : .12;
      def = rnd() < pb ? BAD[Math.floor(rnd() * BAD.length)] : GOOD[Math.floor(rnd() * GOOD.length)];
    }
    deckN++;
    const noisy = scen === 'noisy', r = rnd();
    const score = def.bad ? (noisy ? .18 + r * .38 : .12 + r * .32) : (noisy ? .46 + r * .46 : .58 + r * .38);
    const sj = [(rnd() - .5) * .16, (rnd() - .5) * .16, (rnd() - .5) * .16];
    tokens.push({ def, h: def.alias || def.h, age: 0, score, sub: sj.map(j => clamp(score + j, .02, .99)), verdict: null, f: {}, id: deckN });
    act.src = 1;
  }
  function dispText(tok, mode) {
    const d = tok.def;
    if (mode === 'head') return tok.h;
    if (mode === 'rel') return tok.h + ' · ' + d.r;
    return '(' + tok.h + ', ' + d.r + ', ' + d.t + ')';
  }
  function step(dt) {
    simT += dt; spawnAcc += dt;
    const iv = scen === 'noisy' ? 1.0 : 1.25;
    while (spawnAcc >= iv) { spawnAcc -= iv; spawn(); }
    for (let i = tokens.length - 1; i >= 0; i--) {
      const k = tokens[i], f = k.f, d = k.def;
      k.age += dt;
      if (!f.s3 && k.age >= ARR[4] + .3) { f.s3 = 1; stats.ext++; }
      if (!f.v && k.age >= ARR[5] + VERD) {
        f.v = 1; k.verdict = k.score >= theta;
        if (!k.verdict) {
          stats.drop++;
          pushLog('bad', '<em style="color:#e0604a">✕</em> dropped ' + k.score.toFixed(2) + ' &lt; θ ' + theta.toFixed(2) + ' · ' + esc(dispText(k, 'full')));
        }
      }
      if (k.verdict === false) { if (k.age >= LEV[5] + FALL + .05) tokens.splice(i, 1); continue; }
      if (!f.d1 && k.age >= ARR[6] + .3) {
        f.d1 = 1;
        if (d.alias) {
          stats.merged++; demo.t0 = simT; demo.idx = d.hn === 'dmc' ? 1 : 0;
          pushLog('m', '<em>≡</em> merged ' + esc(d.alias) + ' → ' + esc(d.h)); k.h = d.h;
        }
      }
      if (!f.d2 && k.age >= ARR[7] + .3) {
        f.d2 = 1; cid.t0 = simT; cid.ents = {}; cid.ents[d.hn] = 1; cid.ents[d.tn] = 1;
        cid.generic = !(cid.ents.ec || cid.ents.dmc);
        if (cid.ents.ec || cid.ents.dmc) pushLog('c', '<em>◆</em> CID ' + (cid.ents.ec ? '7303 → EC' : '12021 → DMC'));
      }
      if (k.age >= LEV[8] + FINAL) {
        const hn = NB[d.hn], tn = NB[d.tn];
        if (hn.arr < 0) hn.arr = simT; hn.pulse = simT; hn.deg++;
        if (tn.arr < 0) tn.arr = simT + .3; tn.pulse = simT + .3; tn.deg++;
        const ek = d.k; (edges[ek] || (edges[ek] = { a: d.hn, b: d.tn, r: d.r, arr: simT, n: 0, ph: (edges.__n = (edges.__n || 0) + 1) * .37 })).arr = simT;
        edges[ek].n++;
        packets.push({ t0: simT, from: d.hn, txt: '(' + d.h + ', ' + d.r + ', ' + d.t + ')' });
        tokens.splice(i, 1);
      }
    }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (simT - p.t0 >= .9) {
        stats.stored++; stats.buf = (stats.buf + 1) % 500; act.sink = 1;
        pushLog('s', '<em>✓</em> MERGE ' + esc(p.txt)); packets.splice(i, 1);
      }
    }
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  resetState();
  (function prewarm() { const n = T.REDUCE ? 40 : 30; for (let t = 0; t < n; t += .05) step(.05); })();

  /* ---------------- layout ---------------- */
  let Lx = null, LKEY = '';
  function buildLayout(w, h) {
    const compact = w < 1040, m = 14, P = [], stops = [];
    const L = { w, h, compact, m };
    const add = (x, y, s) => { P.push({ x, y }); if (s != null) stops[s] = P.length - 1; };
    if (!compact) {
      const srcW = 104, sW = 164, gW = 184, dW = 184, gap = 22, y0 = 66;
      const xS = m + srcW + gap, xG = xS + sW + gap, xD = xG + gW + gap, xGr = xD + dW + gap;
      L.stack = { cx: m + srcW / 2, cy: y0 + 36 };
      L.srcLab = { x: m + srcW / 2, y: y0 + 82, align: 'center' };
      L.chunk = { x: m, y: y0 + 120, w: srcW, h: 90, ly: y0 + 120 + 72, lx: m + srcW / 2 };
      L.S = [0, 1, 2].map(i => ({ x: xS, y: y0 + i * 74, w: sW, h: 64, ly: y0 + i * 74 + 48, lx: xS + 118 }));
      L.gate = { x: xG, y: y0, w: gW, h: 212, lx: xG + gW / 2, ly: y0 + 160, cx: xG + 14, cw: gW - 28 };
      L.D = [{ x: xD, y: y0, w: dW, h: 92, lx: xD + dW / 2, ly: y0 + 76, t: 14, s: 28, d: 48 },
        { x: xD, y: y0 + 104, w: dW, h: 108, lx: xD + dW / 2, ly: y0 + 104 + 86, t: 14, s: 28, d: 46 }];
      L.gr = { x: xGr, y: 64, w: w - m - xGr, h: h - m - 74 - 64 - 14 };
      L.sink = { x: xGr, y: h - m - 74, w: w - m - xGr, h: 74 };
      L.hdr = [[1, 'Literature', m, 44], [2, 'Schema extraction', xS, 44], [3, 'QC gate', xG, 44], [4, 'Dedup · align', xD, 44], [5, 'Leiden · communities', xGr, 44]];
      add(L.stack.cx, L.stack.cy, 0); add(L.chunk.lx, L.chunk.ly, 1);
      add(xS - gap / 2, L.chunk.ly); add(xS - gap / 2, L.S[0].ly); add(L.S[0].lx, L.S[0].ly, 2);
      add(L.S[1].lx, L.S[1].ly, 3); add(L.S[2].lx, L.S[2].ly, 4);
      add(xG - gap / 2, L.S[2].ly); add(xG - gap / 2, L.gate.ly); add(L.gate.lx, L.gate.ly, 5);
      add(xD - gap / 2, L.gate.ly); add(xD - gap / 2, L.D[0].ly); add(L.D[0].lx, L.D[0].ly, 6);
      add(xD + dW + gap / 2, L.D[0].ly); add(xD + dW + gap / 2, L.D[1].ly); add(L.D[1].lx, L.D[1].ly, 7);
      add(xD + dW + gap / 2, L.D[1].ly, 8);
      L.schema = { x: xS, y: y0 + 3 * 74 + 6 };
    } else {
      const iw = w - 2 * m;
      L.stack = { cx: m + 30, cy: 58 };
      L.srcLab = { x: m + 68, y: 48, align: 'left' };
      const cx0 = Math.round(w * .5);
      L.chunk = { x: cx0, y: 20, w: w - m - cx0, h: 80, ly: 86, lx: cx0 + (w - m - cx0) / 2 };
      const sW = (iw - 16) / 3;
      L.S = [0, 1, 2].map(i => ({ x: m + i * (sW + 8), y: 122, w: sW, h: 62, ly: 172, lx: m + i * (sW + 8) + sW / 2 }));
      L.gate = { x: m, y: 212, w: iw, h: 150, lx: m + iw * .70, ly: 212 + 96, cx: m + 14, cw: Math.min(170, iw * .5) };
      const gapY = 375, dW = (iw - 10) / 2, dy = 388;
      L.D = [0, 1].map(i => ({ x: m + i * (dW + 10), y: dy, w: dW, h: 100, lx: m + i * (dW + 10) + dW / 2, ly: dy + 16, t: 42, s: 56, d: i ? 72 : 76 }));
      L.gr = { x: m, y: 540, w: iw, h: 250 };
      L.sink = { x: m, y: 800, w: iw, h: 58 };
      L.hdr = [[5, 'Leiden · communities', m, 524]];
      add(L.stack.cx, L.stack.cy, 0); add(L.chunk.lx, L.stack.cy); add(L.chunk.lx, L.chunk.ly, 1);
      add(L.chunk.lx, 110); add(L.S[0].lx, 110); add(L.S[0].lx, L.S[0].ly, 2);
      add(L.S[1].lx, L.S[1].ly, 3); add(L.S[2].lx, L.S[2].ly, 4);
      add(L.S[2].lx, 198); add(L.gate.lx, 198); add(L.gate.lx, L.gate.ly, 5);
      add(L.gate.lx, gapY); add(L.D[0].lx, gapY); add(L.D[0].lx, L.D[0].ly, 6);
      add(L.D[0].lx, gapY); add(L.D[1].lx, gapY); add(L.D[1].lx, L.D[1].ly, 7);
      add(L.D[1].lx, gapY); add(w - 7, gapY); add(w - 7, L.gr.y - 8, 8);
    }
    L.pts = P; L.stops = stops; L.cum = [0];
    for (let i = 1; i < P.length; i++) L.cum[i] = L.cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    L.sarc = stops.map(i => L.cum[i]);
    L.sinkPt = { x: L.sink.x + 32, y: L.sink.y + L.sink.h / 2 - (L.compact ? 0 : 2) };
    return L;
  }
  function at(s) {
    const P = Lx.pts, cum = Lx.cum;
    s = clamp(s, 0, cum[cum.length - 1]);
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const u = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    return { x: lerp(P[i - 1].x, P[i].x, u), y: lerp(P[i - 1].y, P[i].y, u) };
  }
  function nodeXY(n, t) {
    const g = Lx.gr;
    return { x: g.x + 28 + n.fx * (g.w - 56) + Math.sin(t * .6 + n.fx * 9) * 1.6, y: g.y + 42 + n.fy * (g.h - 66) + Math.cos(t * .5 + n.fy * 7) * 1.6 };
  }
  function tokenXY(k, t) {
    const a = k.age;
    if (a >= LEV[8]) {
      const u = clamp((a - LEV[8]) / FINAL, 0, 1), e = T.ease.inOut(u);
      const p0 = Lx.pts[Lx.pts.length - 1], n = nodeXY(NB[k.def.hn], t);
      const cx = (p0.x + n.x) / 2, cy = Math.min(p0.y, n.y) - 26, v = 1 - e;
      return { x: v * v * p0.x + 2 * v * e * cx + e * e * n.x, y: v * v * p0.y + 2 * v * e * cy + e * e * n.y, fin: u };
    }
    let i = 0; while (i < 8 && a >= ARR[i + 1]) i++;
    let s;
    if (a <= LEV[i] || i === 8) s = Lx.sarc[i];
    else s = lerp(Lx.sarc[i], Lx.sarc[i + 1], T.ease.inOut(clamp((a - LEV[i]) / (ARR[i + 1] - LEV[i]), 0, 1)));
    const p = at(s); p.st = i; return p;
  }

  /* ---------------- text helpers ---------------- */
  function tw(s, font) { ctx.font = font; return ctx.measureText(s).width; }
  function txt(s, x, y, col, font, align) { ctx.font = font; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y); }
  function trunc(s, font, maxW) { if (tw(s, font) <= maxW) return s; while (s.length > 1 && tw(s + '…', font) > maxW) s = s.slice(0, -1); return s + '…'; }
  function chip(s, x, y, col, o) { // left-aligned small chip, returns width
    o = o || {}; const f = F(9.5, 500), w = tw(s, f) + 10, h = 15;
    T.rrect(ctx, x, y - h / 2, w, h, 4);
    ctx.fillStyle = o.fill || rgba(col, .12 + (o.lv || 0) * .18); ctx.fill();
    ctx.strokeStyle = rgba(col, .3 + (o.lv || 0) * .5); ctx.lineWidth = 1; ctx.stroke();
    txt(s, x + 5, y + .5, o.tc || rgba(col, .75 + (o.lv || 0) * .25), f);
    return w;
  }
  function tokPill(x, y, s, st, al, o) {
    o = o || {}; const f = F(10, 500), pad = 7, h = 18, w = tw(s, f) + pad * 2;
    let x0 = x - w / 2; x0 = clamp(x0, 3, Lx.w - w - 3); if (o.maxR) x0 = Math.min(x0, o.maxR - w);
    const col = st === 'drop' ? C.red : st === 'pass' ? ACC : C.soft;
    ctx.globalAlpha = al;
    if (st === 'pass') T.glow(ctx, x0 + w / 2, y, w * .45, ACC, .13);
    T.rrect(ctx, x0, y - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(15,13,10,.95)'; ctx.fill();
    ctx.lineWidth = o.hot ? 1.6 : 1; ctx.strokeStyle = rgba(col, st === 'pre' ? .42 : .85); ctx.stroke();
    txt(s, x0 + pad, y + .5, st === 'drop' ? C.rose : st === 'pass' ? C.ink : C.soft, f);
    ctx.globalAlpha = 1;
    return { x: x0, y: y - h / 2, w, h };
  }

  /* ---------------- scene pieces ---------------- */
  function header(n, s, x, y) {
    txt(String(n), x, y, rgba(ACC, .9), F(9.5, 500));
    txt(s.toUpperCase(), x + 13, y, C.dim, F(9.5, 400));
  }
  function sheet(cx, cy, ang, a, lift) {
    ctx.save(); ctx.translate(cx, cy - lift); ctx.rotate(ang);
    T.rrect(ctx, -22, -29, 44, 58, 4);
    ctx.fillStyle = 'rgba(27,23,17,.97)'; ctx.fill();
    ctx.strokeStyle = rgba(C.soft, a); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = rgba(ACC, .5 * a / .45); ctx.fillRect(-15, -22, 14, 2.4);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba(C.soft, .17); ctx.fillRect(-15, -14 + i * 8, i % 2 ? 24 : 30, 2.4); }
    ctx.restore();
  }
  function drawSource(t) {
    const s = Lx.stack, pe = act.src || 0;
    T.glow(ctx, s.cx, s.cy, 46, ACC, .06 + .1 * pe);
    sheet(s.cx - 7, s.cy + 3, -.2, .26, 0); sheet(s.cx + 7, s.cy + 2, .18, .3, 0); sheet(s.cx, s.cy, 0, .45, 3 * pe);
    const L = Lx.srcLab, f = F(9.5, 400);
    if (Lx.compact) { txt('electrolyte', L.x, L.y, C.soft, f); txt('papers · PDF', L.x, L.y + 13, C.dim, f); }
    else { txt('electrolyte', L.x, L.y, C.soft, f, 'center'); txt('papers · PDF', L.x, L.y + 13, C.dim, f, 'center'); }
    const k = Lx.chunk;
    T.card(ctx, k.x, k.y, k.w, k.h, { color: ACC, level: (act.chunk || 0) * .7 });
    txt('PyMuPDF', k.x + 12, k.y + 16, C.ink, F(11, 500));
    txt('section-aware', k.x + 12, k.y + 31, C.dim, F(9.5, 400));
    txt('chunks', k.x + 12, k.y + 43, C.dim, F(9.5, 400));
  }
  function drawS(t) {
    const names = ['S1 entities', 'S2 relations', 'S3 attributes'], subs = ['entity_types', 'relation_types', 'attributes'];
    Lx.S.forEach((c, i) => {
      T.card(ctx, c.x, c.y, c.w, c.h, { color: ACC, level: (act['S' + (i + 1)] || 0) * .7 });
      txt(names[i], c.x + 14, c.y + 15, C.ink, F(11, 500));
      txt(subs[i], c.x + 14, c.y + 30, C.dim, F(9.5, 400));
      if (c.w > 130) txt('LLM', c.x + c.w - 10, c.y + 15, rgba(ACC, .55), F(9.5, 500), 'right');
    });
    if (!Lx.compact) {
      txt('schema: entity_types ·', Lx.schema.x + 2, Lx.schema.y + 6, C.faint, F(9.5, 400));
      txt('relation_types · attributes', Lx.schema.x + 2, Lx.schema.y + 19, C.faint, F(9.5, 400));
    }
  }
  function drawGate(t) {
    const g = Lx.gate, lv = (act.gate || 0) * .8;
    T.card(ctx, g.x, g.y, g.w, g.h, { color: C.gold, level: lv });
    txt('S4 · LLM validation', g.x + 14, g.y + 16, C.ink, F(11, 500));
    txt('LLM-as-judge', g.x + 14, g.y + 31, C.dim, F(9.5, 400));
    txt('θ ' + theta.toFixed(2), g.cx + g.cw, g.y + 31, C.gold, F(10, 500), 'right');
    // pick token shown in the gate readout
    let best = null;
    for (const k of tokens) if (k.age >= ARR[5] && k.age <= LEV[5] + FALL && (!best || k.age < best.age)) best = k;
    if (best) gateTok = best;
    const gt = gateTok, rv = gt ? clamp((gt.age - ARR[5] - .1) / .5, 0, 1) : 0;
    const names = ['accuracy', 'triple-support', 'usefulness'];
    const bx = g.cx + 90, bw = g.cw - 90;
    for (let i = 0; i < 3; i++) {
      const y = g.y + 52 + i * 14;
      txt(names[i], g.cx, y, C.dim, F(9.5, 400));
      ctx.fillStyle = rgba(C.soft, .1); ctx.fillRect(bx, y - 2, bw, 4);
      if (gt) {
        const v = gt.sub[i] * (gt.age > ARR[5] + .6 ? 1 : T.ease.out(rv));
        ctx.fillStyle = rgba(gt.verdict === false ? C.red : gt.verdict ? ACC : C.gold, .85); ctx.fillRect(bx, y - 2, bw * v, 4);
      }
    }
    const yb = g.y + 108;
    txt('score', g.cx, yb - 10, C.dim, F(9.5, 400));
    ctx.fillStyle = rgba(C.soft, .1); ctx.fillRect(g.cx, yb - 3, g.cw, 6);
    if (gt) {
      const v = gt.score * T.ease.out(rv);
      ctx.fillStyle = rgba(gt.verdict === false ? C.red : gt.verdict ? ACC : C.gold, .9); ctx.fillRect(g.cx, yb - 3, g.cw * v, 6);
      txt((gt.score * T.ease.out(rv)).toFixed(2), g.cx + g.cw, yb - 10, gt.verdict === false ? C.rose : C.ink, F(10, 500), 'right');
    }
    const tx = g.cx + g.cw * theta;
    ctx.fillStyle = C.gold; ctx.fillRect(tx - 1, yb - 8, 2, 16);
    if (gt && gt.verdict != null) {
      const bad = gt.verdict === false;
      txt(bad ? '✕ dropped · hallucination' : '✓ pass → dedup', g.cx, g.y + 130, bad ? C.red : ACC, F(9.5, 500));
    } else txt('· scoring…', g.cx, g.y + 130, C.faint, F(9.5, 400));
    // scanner rule at the lane
    if (!Lx.compact) { ctx.strokeStyle = rgba(C.gold, .12 + .2 * lv); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(g.x + 10, g.ly + 22); ctx.lineTo(g.x + g.w - 10, g.ly + 22); ctx.stroke(); ctx.setLineDash([]); }
  }
  function drawDedup(t) {
    const d1 = Lx.D[0], d2 = Lx.D[1], cp = Lx.compact;
    T.card(ctx, d1.x, d1.y, d1.w, d1.h, { color: ACC, level: (act.D1 || 0) * .7 });
    txt('① Union-Find', d1.x + 14, d1.y + d1.t, C.ink, F(11, 500));
    txt('synonyms → canonical', d1.x + 14, d1.y + d1.s, C.dim, F(9.5, 400));
    // merge demo
    const pr = demo.idx ? ['DMC', 'dimethyl carbonate'] : ['EC', 'ethylene carbonate'];
    const p = clamp((simT - demo.t0) / 1.3, 0, 1), e = T.ease.inOut(p);
    const dy = d1.y + d1.d, f = F(9.5, 500), wa = tw(pr[0], f) + 10, wb = tw(pr[1], f) + 10;
    const x0 = d1.x + 12;
    if (p < 1 || demo.t0 < -50) {
      if (demo.t0 < -50) { const cw = chip(pr[0], x0, dy, ACC, { lv: 1 }); txt(trunc('≡ ' + pr[1], F(9.5, 400), d1.w - cw - 30), x0 + cw + 6, dy, C.dim, F(9.5, 400)); }
      else {
        const total = wa + 14 + wb, sx = x0, a = lerp(sx, sx + (total - wa) / 2, e), b = lerp(sx + wa + 14, sx + (total - wb) / 2 + 2, e);
        ctx.globalAlpha = 1 - e * .85; chip(pr[1], b, dy, C.soft, { lv: 0 }); ctx.globalAlpha = 1;
        chip(pr[0], a, dy, e > .5 ? ACC : C.soft, { lv: e });
        if (p > .6) T.glow(ctx, a + wa / 2, dy, 26, ACC, .25 * (p - .6) / .4);
      }
    } else {
      const cw = chip(pr[0], x0, dy, ACC, { lv: 1 }); txt(trunc('≡ ' + pr[1], F(9.5, 400), d1.w - cw - 30), x0 + cw + 6, dy, C.dim, F(9.5, 400));
    }
    // dedup 2
    T.card(ctx, d2.x, d2.y, d2.w, d2.h, { color: ACC, level: (act.D2 || 0) * .7 });
    txt('② PubChem CID align', d2.x + 14, d2.y + d2.t, C.ink, F(11, 500));
    txt('local SQLite lookup', d2.x + 14, d2.y + d2.s, C.dim, F(9.5, 400));
    const cl = clamp(1 - (simT - cid.t0) / 2.2, 0, 1);
    const rows = [['EC', 'CID 7303', 'ec'], ['DMC', 'CID 12021', 'dmc']];
    rows.forEach((r, i) => {
      const y = d2.y + d2.d + i * 15, lv = cid.ents[r[2]] ? cl : 0;
      const w1 = chip(r[0], d2.x + 12, y, ACC, { lv });
      txt('▸', d2.x + 12 + w1 + 6, y, C.faint, F(9.5, 400));
      chip(r[1], d2.x + 12 + w1 + 16, y, C.sky, { lv });
    });
    if (!cp) txt('others: CID ✓', d2.x + d2.w - 12, d2.y + d2.d + 7, rgba(ACC, .5 + .4 * (cid.generic ? cl : 0)), F(9.5, 400), 'right');
    if (cp) { /* compact: tag text placed same row */ }
    if (!cp) {
      // headers for sections 4 are drawn by Lx.hdr
    }
  }
  function drawRails() {
    const P = Lx.pts;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(C.soft, .13); ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(ACC, .5);
    Lx.stops.forEach((si, i) => { if (i === 0 || i === 8) return; ctx.beginPath(); ctx.arc(P[si].x, P[si].y, 1.6, 0, T.TAU); ctx.fill(); });
    ctx.restore();
  }

  /* ---------------- graph ---------------- */
  function drawGraph(t) {
    const g = Lx.gr, cp = Lx.compact;
    const R = cp ? 20 : 26;
    // hulls
    const groups = {};
    NODES.forEach(n => { if (n.arr >= 0) (groups[n.cm] || (groups[n.cm] = [])).push(n); });
    let commCount = 0;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const key in groups) {
      commCount++;
      const arr = groups[key], col = COMM[key].c;
      let cx = 0, cy = 0; const ps = arr.map(n => nodeXY(n, t)); ps.forEach(p => { cx += p.x; cy += p.y; }); cx /= ps.length; cy /= ps.length;
      let pulse = 0; arr.forEach(n => { pulse = Math.max(pulse, clamp(1 - (simT - n.pulse) / 2, 0, 1)); });
      const rr = R + pulse * 3;
      ctx.beginPath();
      ps.forEach(p => { ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = rgba(col, .075 + .06 * pulse); ctx.lineWidth = rr * 2; ctx.stroke();
      ctx.strokeStyle = rgba(col, .05); ctx.lineWidth = rr * 2 - 16; ctx.stroke();
      groups[key] = { arr, ps, cx, cy, minY: Math.min.apply(null, ps.map(p => p.y)), pulse };
    }
    ctx.restore();
    // ghosts
    NODES.forEach(n => {
      if (n.arr >= 0) return; const p = nodeXY(n, t);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, T.TAU); ctx.fillStyle = rgba(COMM[n.cm].c, .16); ctx.fill();
    });
    // edges
    const hv = hover && hover.kind === 'node' ? hover.n.id : null;
    for (const k in edges) {
      if (k === '__n') continue;
      const e = edges[k], a = NB[e.a], b = NB[e.b]; if (a.arr < 0 || b.arr < 0) continue;
      const pa = nodeXY(a, t), pb = nodeXY(b, t), q = T.bez(pa, pb, .13), col = COMM[a.cm].c;
      const fr = clamp(1 - (simT - e.arr) / 3, 0, 1), hi = hv && (e.a === hv || e.b === hv) ? 1 : 0;
      T.strokeBez(ctx, q, col, 1 + fr * 1.2 + hi * .6, .22 + .5 * fr + .3 * hi);
      T.flow(ctx, q, simT + e.ph, { n: 1, speed: .2, color: col, size: 1.5 });
      if ((fr > .05 && !cp) || hi) {
        const m = T.bezPt(q, .5);
        txt(e.r, m.x, m.y - 8, rgba(C.soft, hi ? .9 : fr), F(9.5, 400), 'center');
      }
    }
    // nodes
    NODES.forEach(n => {
      if (n.arr < 0) return; const p = nodeXY(n, t); n.hx = p.x; n.hy = p.y;
      const fr = clamp(1 - (simT - n.arr) / 3, 0, 1), isH = hover && hover.kind === 'node' && hover.n === n;
      const r = 4.5 + Math.min(3, n.deg * .5), col = COMM[n.cm].c;
      T.node(ctx, p.x, p.y, r, col, { level: .38 + .62 * fr, active: fr > .6 || isH, ring: isH || (sel && sel.kind === 'node' && sel.n === n) ? t : 0 });
      txt(cp && n.id === 'res' ? 'interf. R' : n.l, p.x, p.y + r + 10, rgba(C.soft, .6 + .4 * fr), F(10, 400), 'center');
    });
    // hull labels
    for (const key in groups) {
      const h = groups[key], c = COMM[key], nm = c.name.toUpperCase(), f = F(9.5, 500);
      const wN = tw(nm, f) + 12;
      let x = clamp(h.cx, g.x + wN / 2 + 2, g.x + g.w - wN / 2 - 2), y = Math.max(g.y + 10, h.minY - R - 6);
      T.rrect(ctx, x - wN / 2, y - 8, wN, 16, 8); ctx.fillStyle = 'rgba(15,13,10,.78)'; ctx.fill();
      ctx.strokeStyle = rgba(c.c, .55); ctx.lineWidth = 1; ctx.stroke();
      txt(nm, x, y + .5, c.c, f, 'center');
      const hh2 = hover && hover.kind === 'node' && hover.n.cm === key;
      if (h.arr.length >= 2 && (g.w >= 460 || hh2 || h.pulse > .25)) {
        const s = '“' + c.sum + '”', fs = F(9.5, 400), w2 = tw(s, fs);
        const sx = clamp(x, g.x + w2 / 2 + 2, g.x + g.w - w2 / 2 - 2);
        ctx.globalAlpha = hh2 ? 1 : clamp(h.pulse * 2.2, 0, 1) * (g.w >= 460 ? 0 : 1) + (g.w >= 460 ? 1 : 0); txt(s, sx, y - 14, rgba(C.soft, .7), fs, 'center'); ctx.globalAlpha = 1;
      }
    }
    // header summary tag
    return commCount;
  }
  function drawSink(t) {
    const s = Lx.sink, lv = (act.sink || 0) * .8;
    T.card(ctx, s.x, s.y, s.w, s.h, { color: ACC, level: lv });
    const gx = Lx.sinkPt.x, gy = Lx.sinkPt.y;
    // database glyph
    ctx.save(); ctx.strokeStyle = rgba(ACC, .5 + .4 * (act.sink || 0)); ctx.lineWidth = 1.2;
    const rw = 15, rh = 4.5, top = gy - 15;
    ctx.fillStyle = rgba(ACC, .1 + .12 * (act.sink || 0));
    ctx.beginPath(); ctx.moveTo(gx - rw, top); ctx.lineTo(gx - rw, top + 30); ctx.ellipse(gx, top + 30, rw, rh, 0, PI, 0, true); ctx.lineTo(gx + rw, top); ctx.ellipse(gx, top, rw, rh, 0, 0, PI, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.ellipse(gx, top + i * 10, rw, rh, 0, 0, PI); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(gx, top, rw, rh, 0, 0, T.TAU); ctx.stroke();
    ctx.restore();
    if ((act.sink || 0) > .1) T.glow(ctx, gx, gy, 38, ACC, .16 * act.sink);
    const tx = s.x + 62, mw = s.w - 74;
    txt('6 · Neo4j', tx, s.y + 15, C.ink, F(11, 500));
    const l2 = 'MERGE (label,name)', l3 = '500 triples / txn';
    const one = l2 + ' · ' + l3;
    if (tw(one, F(9.5, 400)) <= mw) { txt(one, tx, s.y + 30, C.dim, F(9.5, 400)); }
    else { txt(l2, tx, s.y + 30, C.dim, F(9.5, 400)); txt(l3, tx, s.y + 43, C.dim, F(9.5, 400)); }
    const by = s.y + s.h - 12, bw = Math.min(mw - 70, 120);
    if (Lx.compact === false || s.h > 60) {
      ctx.fillStyle = rgba(C.soft, .1); ctx.fillRect(tx, by - 2, bw, 4);
      ctx.fillStyle = rgba(ACC, .85); ctx.fillRect(tx, by - 2, Math.max(2, bw * stats.buf / 500), 4);
      txt('txn buffer ' + stats.buf + ' / 500', tx + bw + 8, by, C.soft, F(9.5, 400));
    }
  }
  function drawPackets(t) {
    const s = Lx.sinkPt;
    packets.forEach(p => {
      const n = NB[p.from], u = clamp((simT - p.t0) / .9, 0, 1), e = T.ease.inOut(u), a = { x: n.hx, y: n.hy };
      const q = T.bez(a, s, -.12), pt = T.bezPt(q, e);
      T.strokeBez(ctx, q, ACC, 1, .12 * (1 - u), [2, 4]);
      T.glow(ctx, pt.x, pt.y, 9, ACC, .5 * (1 - u * .4));
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, T.TAU); ctx.fillStyle = rgba('#fff6e6', .9); ctx.fill();
    });
  }

  /* ---------------- tokens ---------------- */
  function drawTokens(t) {
    for (const k of tokens) {
      const p = tokenXY(k, t), a = k.age;
      let x = p.x, y = p.y, al = clamp(a / .35, 0, 1);
      k.hit = null;
      let st = k.verdict === false ? 'drop' : k.verdict ? 'pass' : 'pre';
      if (k.verdict === false && a >= LEV[5]) {
        const u = clamp((a - LEV[5]) / FALL, 0, 1);
        y += 46 * T.ease.in(u) * (Lx.compact ? .8 : 1); al *= 1 - u * u; x += Math.sin(u * 14) * 2 * (1 - u);
      }
      if (k.verdict === false && a < LEV[5] && a > ARR[5] + VERD) x += Math.sin(a * 40) * 1.2;
      const hot = (hover && hover.kind === 'tok' && hover.k === k) || (sel && sel.kind === 'tok' && sel.k === k);
      if (p.fin != null) {
        const u = p.fin;
        if (u < .3) { const r = tokPill(x, y, dispText(k, 'full'), 'pass', 1 - u / .3, { hot }); k.hit = r; }
        T.glow(ctx, x, y, 12, ACC, .45 * clamp(u * 3, 0, 1));
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, T.TAU); ctx.fillStyle = rgba('#fff6e6', .95 * clamp(u * 4, 0, 1)); ctx.fill();
        if (u < .3) continue; k.hit = { x: x - 8, y: y - 8, w: 16, h: 16 }; continue;
      }
      if (a < ARR[2]) {
        // raw text chunk glyph
        ctx.save(); ctx.globalAlpha = al; const wob = a < .5 ? (1 - a / .5) * -8 : 0;
        T.rrect(ctx, x - 8, y - 6 + wob, 16, 12, 2); ctx.fillStyle = 'rgba(27,23,17,.96)'; ctx.fill();
        ctx.strokeStyle = rgba(ACC, .75); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = rgba(C.soft, .5); ctx.fillRect(x - 5, y - 3 + wob, 10, 1.6); ctx.fillRect(x - 5, y + 1 + wob, 7, 1.6);
        ctx.restore(); k.hit = { x: x - 9, y: y - 8, w: 18, h: 16 }; continue;
      }
      const mode = a < ARR[3] ? 'head' : a < ARR[4] ? 'rel' : 'full';
      let s = dispText(k, mode);
      const inS = a < ARR[5] && !Lx.compact;
      s = trunc(s, F(10, 500), mode === 'rel' ? 78 : a < ARR[5] ? 150 : Lx.compact ? Lx.w - 40 : 196);
      const r = tokPill(x, y, s, st, al, { hot, maxR: inS ? Lx.S[0].x + Lx.S[0].w + 6 : 0 }); k.hit = r;
      // mini score bar at the gate
      if (a > ARR[5] + .05 && a < LEV[5] + FALL && !(k.verdict === false && a > LEV[5] + FALL * .6)) {
        const bw = 62, by = y + 15, bx = clamp(x - bw / 2, 3, Lx.w - bw - 3), rv = T.ease.out(clamp((a - ARR[5] - .1) / .5, 0, 1));
        ctx.globalAlpha = al;
        ctx.fillStyle = rgba(C.soft, .14); ctx.fillRect(bx, by, bw, 3);
        ctx.fillStyle = rgba(k.verdict === false ? C.red : k.verdict ? ACC : C.gold, .95); ctx.fillRect(bx, by, bw * k.score * rv, 3);
        ctx.fillStyle = C.gold; ctx.fillRect(bx + bw * theta - .5, by - 2, 1.5, 7);
        if (k.verdict === false && a > ARR[5] + VERD) txt('dropped · hallucination', x, by + 13, C.red, F(9.5, 500), 'center');
        ctx.globalAlpha = 1;
      }
      // CID tag at dedup 2
      if (a > ARR[7] + .2 && a < LEV[7] + .1 && cid.generic) {
        const f = F(9.5, 500), w = tw('CID ✓', f) + 10;
        T.rrect(ctx, r.x + r.w - w, r.y - 17, w, 14, 4); ctx.fillStyle = rgba(ACC, .18); ctx.fill();
        ctx.strokeStyle = rgba(ACC, .6); ctx.lineWidth = 1; ctx.stroke(); txt('CID ✓', r.x + r.w - w + 5, r.y - 9.5, ACC, f);
      }
    }
  }

  /* ---------------- HUD ---------------- */
  const panelC = document.createElement('div'); panelC.className = 'tv-panel'; panelC.style.cssText = 'left:14px;bottom:14px;width:214px';
  panelC.innerHTML = '<h5>Refinery counters</h5><div class="ro"></div>';
  const panelL = document.createElement('div'); panelL.className = 'tv-panel'; panelL.style.cssText = 'left:240px;bottom:14px;width:350px';
  panelL.innerHTML = '<h5>Event log</h5><div class="tv-log"></div>';
  fig.hud.append(panelC, panelL);
  hud.c = panelC.querySelector('.ro'); hud.l = panelL.querySelector('.tv-log');
  function updateHud(commCount) {
    T.readout(hud.c, [['extracted', String(stats.ext)], ['dropped by QC', String(stats.drop), stats.drop ? 'bad' : ''],
      ['merged synonyms', String(stats.merged)], ['stored triples', String(stats.stored), 'ok'], ['communities', String(commCount)]]);
    hud.l.innerHTML = '';
    logs.forEach(l => { const d = document.createElement('div'); d.innerHTML = l[1]; hud.l.append(d); });
    if (!logs.length) hud.l.innerHTML = '<div style="color:#5f584a">waiting for first triples…</div>';
  }

  /* ---------------- tooltip ---------------- */
  function tooltip() {
    const tgt = sel || hover; if (!tgt || !mouse) return;
    let l1, l2;
    if (tgt.kind === 'tok') {
      const k = tgt.k, d = k.def;
      l1 = '(' + d.h + ', ' + d.r + ', ' + d.t + ')';
      const i = Math.min(8, (function () { let j = 0; while (j < 8 && k.age >= ARR[j + 1]) j++; return j; })());
      l2 = STAGE_NAME[i] + (k.age >= ARR[5] + .3 ? ' · score ' + k.score.toFixed(2) + (k.verdict === false ? ' < θ → dropped' : k.verdict ? ' ≥ θ → pass' : '') : '') + (d.bad ? ' · likely hallucination' : '');
    } else {
      const n = tgt.n; l1 = n.l + ' · ' + COMM[n.cm].name; l2 = n.deg + ' stored triple' + (n.deg === 1 ? '' : 's') + ' · Leiden community';
    }
    const f1 = F(10.5, 500), f2 = F(9.5, 400), w = Math.max(tw(l1, f1), tw(l2, f2)) + 18, h = 38;
    let x = mouse[0] + 14, y = mouse[1] - h - 8; if (x + w > Lx.w - 4) x = mouse[0] - w - 14; if (y < 4) y = mouse[1] + 16;
    x = Math.max(4, x);
    T.rrect(ctx, x, y, w, h, 7); ctx.fillStyle = 'rgba(12,10,7,.95)'; ctx.fill(); ctx.strokeStyle = rgba(ACC, .5); ctx.lineWidth = 1; ctx.stroke();
    txt(l1, x + 9, y + 13, C.ink, f1); txt(l2, x + 9, y + 27, C.soft, f2);
  }

  /* ---------------- main draw ---------------- */
  function draw(t) {
    const w = fig.w, h = fig.h; if (w < 120) return;
    const dtS = lastT == null ? 0 : clamp(t - lastT, 0, .1); lastT = t;
    if (dtS > 0) step(dtS);
    const key = w + 'x' + h; if (key !== LKEY) { LKEY = key; Lx = buildLayout(w, h); }
    // activity (smoothed stage glow)
    const dec = Math.exp(-dtS * 2.6);
    ['src', 'chunk', 'S1', 'S2', 'S3', 'gate', 'D1', 'D2', 'sink'].forEach(k => { act[k] = (act[k] || 0) * dec; });
    for (const k of tokens) {
      if (k.verdict === false && k.age > LEV[5]) continue;
      for (let i = 1; i <= 7; i++) if (k.age >= ARR[i] - .15 && k.age <= LEV[i] + .1) act[ST[i][0]] = 1;
    }
    T.bg(ctx, w, h, { tint: ACC, tx: .85, ty: .12 });
    Lx.hdr.forEach(hh => header(hh[0], hh[1], hh[2], hh[3]));
    if (!Lx.compact) header(6, 'Neo4j sink', Lx.sink.x, Lx.sink.y - 12);
    drawRails();
    drawSource(t); drawS(t); drawGate(t); drawDedup(t);
    const cc = drawGraph(t);
    drawSink(t); drawPackets(t); drawTokens(t);
    tooltip();
    if (Lx.compact) {
      const s = 'extracted ' + stats.ext + ' · dropped ' + stats.drop + ' · merged ' + stats.merged + ' · stored ' + stats.stored + ' · comm ' + cc;
      txt(s, w / 2, h - 12, C.soft, F(9.5, 400), 'center');
    }
    panelC.style.display = panelL.style.display = Lx.compact ? 'none' : '';
    hudAcc += dtS; if (hudAcc > .2 || dtS === 0) { hudAcc = 0; updateHud(cc); }
  }

  /* ---------------- controls ---------------- */
  const ctl = fig.controls;
  const gTh = T.group(ctl, 'QC threshold');
  const lab = document.createElement('label'); lab.className = 'tv-range';
  lab.innerHTML = '<span>θ</span><input type="range" min="0.3" max="0.8" step="0.01" value="0.5" aria-label="QC threshold theta"><output>0.50</output>';
  const inp = lab.querySelector('input'), out = lab.querySelector('output');
  inp.addEventListener('input', () => { theta = +inp.value; out.textContent = theta.toFixed(2); if (loop.paused) loop.redraw(); });
  gTh.append(lab);
  T.chips(ctl, 'Scenario', [{ key: 'steady', label: 'Steady stream' }, { key: 'noisy', label: 'Noisy batch' }], k => { scen = k; }, 'steady');
  const gP = T.group(ctl, 'Run');
  const bPlay = T.button(gP, '❚❚ Pause', () => { loop.paused = !loop.paused; bPlay.textContent = loop.paused ? '▶ Play' : '❚❚ Pause'; });
  T.button(gP, '↺ Replay', () => { resetState(); if (loop.paused) loop.redraw(); }, { title: 'Clear the graph and rebuild it from the first paper' });
  T.chips(ctl, 'Speed', [{ key: '1', label: '1×' }, { key: '2', label: '2×' }], k => { loop.speed = +k; }, '1');

  /* ---------------- pointer ---------------- */
  function pick(x, y) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const r = tokens[i].hit; if (r && x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) return { kind: 'tok', k: tokens[i] };
    }
    for (const n of NODES) if (n.arr >= 0 && Math.hypot(x - n.hx, y - n.hy) < 13) return { kind: 'node', n };
    return null;
  }
  T.pointer(fig.canvas, {
    move(x, y) { mouse = [x, y]; hover = pick(x, y); fig.canvas.style.cursor = hover ? 'pointer' : ''; if (loop.paused) loop.redraw(); },
    leave() { mouse = null; hover = null; if (loop.paused) loop.redraw(); },
    click(x, y) { const p = pick(x, y); sel = p && !(sel && ((sel.k && sel.k === p.k) || (sel.n && sel.n === p.n))) ? p : null; mouse = [x, y]; if (loop.paused) loop.redraw(); }
  });

  /* ---------------- run ---------------- */
  const loop = T.run(fig, {
    still: 8,
    resize(w) {
      const want = (w < 1040 ? 890 : 560) + 'px';
      if (fig.stage.style.getPropertyValue('--tv-h') !== want) fig.stage.style.setProperty('--tv-h', want);
    },
    draw
  });
})();
