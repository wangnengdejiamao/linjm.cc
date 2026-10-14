/* =================================================================
   viz-mfg.js — 04 · AI for Manufacturing.

   Fig M·1  Ontology workbench: the layered build (sources → evidence →
            entity → wiki → core item → ontology → pack), the typed
            object graph it produces, and a DMN-lite decision card being
            evaluated with first-hit policy, climbing a readiness ladder
            that only a person can finish.
   Fig M·2  APS trial scheduling on a fictional plant, recomputed in the
            browser by aps-model.js: heuristic → improvement → validator,
            with what-if levers (rush order, machine down, late material).
   ================================================================= */
(function () {
  'use strict';
  const T = window.TV;
  if (!T) return;
  const C = T.C, F = T.font, ACC = T.DOMAIN.mfg;

  /* ================================================================
     FIG M·1 — ONTOLOGY WORKBENCH
     ================================================================ */
  (function ontology() {
    const root = document.getElementById('mfgOntology');
    if (!root) return;
    const fig = T.mount(root, {
      domain: 'mfg', height: 540, controls: true,
      kicker: 'Fig M·1 — Ontology workbench · source row → typed object → signed rule',
      status: 'interactive · fictional plant',
      aria: 'Ontology workbench: files flow through evidence, entity, wiki, core-item and ontology layers into a typed object graph of order, material, operation, resource, calendar and supplier; a decision card is evaluated row by row with first-hit policy and climbs a five-step readiness ladder that ends with a human signature.',
      stack: ['openpyxl · python-docx', 'Pydantic models', 'SQLite FTS5', 'YAML + Markdown ontology', 'DMN-lite decision cards', 'pytest cases', 'MCP server (read-only)', '.pkn package'],
      note: 'Fictional plant and values · mechanism mirrors the real workbench'
    });
    const ctx = fig.ctx;

    const CHAIN = [
      { k: 'Sources', t: 'xlsx · docx · md', c: C.dim },
      { k: 'Evidence', t: 'source_id @ version', c: C.sky },
      { k: 'Entity', t: 'identity resolution', c: C.steel },
      { k: 'Wiki', t: 'claims · conflicts', c: C.plum },
      { k: 'CoreItem', t: '14 typed kinds', c: C.gold },
      { k: 'Ontology', t: 'data + business', c: ACC },
      { k: 'Pack', t: '.pkn · MCP', c: C.mint }
    ];

    /* typed object graph (unit coords inside its box) */
    const OBJ = [
      { id: 'order', label: 'Order', sub: 'O-105', x: .08, y: .20, c: C.steel, src: 'orders.xlsx ! row 14 @v3' },
      { id: 'mat', label: 'Material', sub: 'M-07 kit', x: .45, y: .08, c: C.gold, src: 'bom.md § 2 @v1' },
      { id: 'sup', label: 'Supplier', sub: 'S-3', x: .86, y: .10, c: C.plum, src: 'vendors.xlsx ! row 3 @v1' },
      { id: 'op', label: 'Operation', sub: 'OP-20 mill', x: .45, y: .55, c: ACC, src: 'routing.docx ¶ 7 @v2' },
      { id: 'res', label: 'Resource', sub: 'CNC-2', x: .80, y: .78, c: C.sky, src: 'erp_export.xlsx ! WC @v5' },
      { id: 'cal', label: 'Calendar', sub: 'maint. 08–12h', x: .96, y: .44, c: C.dim, src: 'shifts.xlsx ! May @v2' },
      { id: 'card', label: 'Decision', sub: 'kit release', x: .10, y: .82, c: C.mint, src: 'decisions/kit_release.md @v4' }
    ];
    const REL = [
      ['order', 'op', 'requires'], ['mat', 'op', 'consumed by'], ['op', 'res', 'runs on'],
      ['res', 'cal', 'follows'], ['sup', 'mat', 'supplies'], ['card', 'op', 'gates'], ['card', 'order', 'reads']
    ];
    const byId = id => OBJ.find(o => o.id === id);

    /* decision card — first-hit policy */
    const COLS = ['material', 'slack (d)', 'tier', '→ decision'];
    const ROWS = [
      { cond: ['no', '< 2', '–'], out: 'Escalate · expedite supplier', c: C.red },
      { cond: ['no', '–', '–'], out: 'Hold · re-sequence', c: C.gold },
      { cond: ['partial', '–', 'A'], out: 'Partial release · split lot', c: C.sky },
      { cond: ['–', '–', '–'], out: 'Release to schedule', c: C.mint }
    ];
    const ORDERS = {
      'O-102': { inp: ['yes', '3.0', 'B'], hit: 3 },
      'O-105': { inp: ['no', '1.0', 'A'], hit: 0 },
      'O-199': { inp: ['partial', '0.5', 'A'], hit: 2 }
    };
    const LADDER = ['Draft', 'Trial-ready', 'Tests passed', 'Publishable', 'Signed'];
    let ord = 'O-105', t0 = 0, hover = null, lastT = 0;
    const L = { boxes: [] };

    T.chips(fig.controls, 'Evaluate order', Object.keys(ORDERS).map(k => ({ key: k, label: k + (k === 'O-199' ? ' · rush' : '') })),
      k => { ord = k; t0 = lastT; byId('order').sub = k; loop.redraw(); }, ord);
    const pz = T.button(T.group(fig.controls), 'Pause', () => {
      loop.paused = !loop.paused; pz.textContent = loop.paused ? 'Play' : 'Pause';
      pz.setAttribute('aria-pressed', String(loop.paused));
    }, { pressed: false });

    T.pointer(fig.canvas, {
      move(x, y) {
        const b = L.boxes.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        hover = b || null;
        fig.canvas.style.cursor = b ? 'help' : '';
      },
      leave() { hover = null; }
    });

    function draw(t) {
      lastT = t;
      const w = fig.w, h = fig.h, compact = w < 760;
      T.bg(ctx, w, h, { tint: ACC, tx: .15, ty: .05 });
      L.boxes = [];
      const lt = t - t0;                 // time since order picked

      /* ---------- chain ---------- */
      const pad = compact ? 14 : 26;
      const chainY = compact ? 22 : 30;
      const n = CHAIN.length;
      const cw = (w - pad * 2) / n;
      const capW = Math.min(cw - 14, 132), capH = compact ? 34 : 40;
      const cx = i => pad + cw * i + cw / 2;
      for (let i = 0; i < n - 1; i++) {
        const a = { x: cx(i) + capW / 2, y: chainY + capH / 2 }, b = { x: cx(i + 1) - capW / 2, y: chainY + capH / 2 };
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(236,224,200,.16)'; ctx.lineWidth = 1; ctx.stroke();
        T.flow(ctx, u => ({ x: T.lerp(a.x, b.x, u), y: a.y }), t, { n: 1, speed: .55, color: CHAIN[i + 1].c, size: 1.8, phase: i * .17 });
      }
      const pulse = (t * .55) % (n + 2);
      CHAIN.forEach((s, i) => {
        const on = Math.max(0, 1 - Math.abs(pulse - i - .5) * 1.1);
        T.card(ctx, cx(i) - capW / 2, chainY, capW, capH, { color: s.c, level: on * .8, r: 7 });
        T.label(ctx, s.k, cx(i) - capW / 2 + 10, chainY + (compact ? 12 : 14), { size: compact ? 9.5 : 11, weight: 500, color: C.ink });
        if (cw > 70) T.label(ctx, s.t, cx(i) - capW / 2 + 10, chainY + (compact ? 25 : 29), { size: compact ? 8 : 9.5, color: C.dim });
      });

      const top = chainY + capH + (compact ? 22 : 34);

      /* ---------- object graph ---------- */
      const gx = pad, gy = top + 18;
      const gw = compact ? w - pad * 2 : w * .5, gh = compact ? h * .33 : h - gy - 26;
      T.label(ctx, 'TYPED OBJECT GRAPH', gx, top + 4, { size: 9.5, color: C.dim, weight: 500 });
      T.label(ctx, 'hover an object → its source', gx + gw, top + 4, { size: 9, color: C.faint, align: 'right' });
      const P = o => ({ x: gx + 46 + o.x * (gw - 92), y: gy + 18 + o.y * (gh - 36) });
      const hitPath = ['card', 'order', 'op', 'mat'];
      const onPath = (a, b) => (a === 'card' && b === 'order') || (a === 'order' && b === 'op') || (a === 'mat' && b === 'op') || (a === 'card' && b === 'op');
      REL.forEach(([a, b, lab], i) => {
        const pa = P(byId(a)), pb = P(byId(b));
        const q = T.bez(pa, pb, .12);
        const act = onPath(a, b);
        T.strokeBez(ctx, q, act ? ACC : C.soft, act ? 1.4 : 1, act ? .55 : .18);
        if (act) T.flow(ctx, q, t, { n: 2, speed: .4, color: ACC, size: 1.8, phase: i * .3 });
        if (!compact) {
          const m = T.bezPt(q, .5);
          T.label(ctx, lab, m.x, m.y, { size: 8.5, align: 'center', color: act ? C.soft : C.faint, pill: 'rgba(15,13,10,.85)' });
        }
      });
      OBJ.forEach(o => {
        const p = P(o), isH = hover && hover.id === o.id, act = hitPath.includes(o.id);
        T.node(ctx, p.x, p.y, compact ? 7 : 9, o.c, { active: isH || (act && Math.sin(t * 2 + o.x * 6) > .2), level: act ? .7 : .4 });
        T.label(ctx, o.label, p.x, p.y + (compact ? 17 : 21), { size: compact ? 9 : 10.5, weight: 500, align: 'center', color: C.ink });
        if (!compact) T.label(ctx, o.sub, p.x, p.y + 34, { size: 9, align: 'center', color: C.dim });
        L.boxes.push({ id: o.id, x: p.x - 30, y: p.y - 14, w: 60, h: 54, o });
      });
      if (hover) {
        const p = P(hover.o);
        const s = '⟵ ' + hover.o.src;
        ctx.font = F(10);
        const tw = ctx.measureText(s).width;
        let lx = Math.min(w - tw - 20, Math.max(10, p.x - tw / 2));
        T.label(ctx, s, lx + 8, p.y - 26, { size: 10, color: C.ink, pill: 'rgba(30,25,18,.96)', border: T.rgba(hover.o.c, .6), radius: 5 });
      }

      /* ---------- decision card ---------- */
      const dx = compact ? pad : w * .55, dy = compact ? gy + gh + 18 : top;
      const dw = compact ? w - pad * 2 : w * .45 - pad;
      const inp = ORDERS[ord];
      T.label(ctx, 'DECISION CARD · kit_release.md', dx, dy + 4, { size: 9.5, color: C.dim, weight: 500 });
      T.label(ctx, 'hit_policy: first', dx + dw, dy + 4, { size: 9, color: ACC, align: 'right' });
      const ty = dy + 20, rowH = compact ? 24 : 28;
      const colW = [dw * .2, dw * .17, dw * .13, dw * .5];
      const colX = [dx]; for (let i = 1; i < 4; i++) colX[i] = colX[i - 1] + colW[i - 1];
      T.rrect(ctx, dx, ty, dw, rowH * 6 + 4, 8);
      ctx.fillStyle = 'rgba(22,19,14,.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(236,224,200,.12)'; ctx.stroke();
      COLS.forEach((c, i) => T.label(ctx, c, colX[i] + 10, ty + rowH / 2 + 2, { size: 9, color: C.dim }));
      /* input row */
      const iy = ty + rowH;
      ctx.fillStyle = T.rgba(C.steel, .08); ctx.fillRect(dx + 1, iy, dw - 2, rowH);
      inp.inp.forEach((v, i) => T.label(ctx, v, colX[i] + 10, iy + rowH / 2, { size: 10, color: C.steel, weight: 500 }));
      T.label(ctx, 'input · ' + ord, colX[3] + 10, iy + rowH / 2, { size: 9.5, color: C.steel });
      /* scan rows: one row per 0.7 s until hit */
      const scan = Math.min(inp.hit, Math.floor(lt / .7));
      const decided = lt > (inp.hit + 1) * .7;
      ROWS.forEach((r, i) => {
        const ry = ty + rowH * (i + 2);
        ctx.fillStyle = 'rgba(236,224,200,.06)'; ctx.fillRect(dx + 8, ry, dw - 16, 1);
        const isScan = i === scan && !decided, isHit = decided && i === inp.hit, skipped = i < scan || (decided && i < inp.hit);
        if (isScan || isHit) {
          ctx.save();
          T.rrect(ctx, dx + 4, ry + 2, dw - 8, rowH - 3, 5);
          ctx.fillStyle = T.rgba(isHit ? r.c : C.soft, isHit ? .16 : .07); ctx.fill();
          ctx.strokeStyle = T.rgba(isHit ? r.c : C.soft, isHit ? .8 : .3); ctx.stroke();
          ctx.restore();
        }
        const a = skipped ? C.faint : C.soft;
        r.cond.forEach((v, j) => T.label(ctx, v, colX[j] + 10, ry + rowH / 2 + 1, { size: 10, color: a }));
        T.label(ctx, r.out, colX[3] + 10, ry + rowH / 2 + 1, { size: compact ? 9 : 10, color: isHit ? r.c : a, weight: isHit ? 500 : 400 });
        T.label(ctx, String(i + 1), dx + dw - 12, ry + rowH / 2 + 1, { size: 8.5, color: C.faint, align: 'right' });
        if (skipped) T.label(ctx, '✕', colX[3] - 8, ry + rowH / 2 + 1, { size: 9, color: C.faint, align: 'center' });
        if (isHit) T.label(ctx, '●', colX[3] - 8, ry + rowH / 2 + 1, { size: 9, color: r.c, align: 'center' });
      });
      const tests = ty + rowH * 6 + 18;
      T.label(ctx, '✓ 6 positive cases   ✓ 4 negative cases   pytest · deterministic', dx, tests, { size: 9.5, color: decided ? C.mint : C.faint });

      /* ---------- readiness ladder ---------- */
      const ly = tests + (compact ? 30 : 40);
      if (ly + 40 < h) {
        T.label(ctx, 'READINESS LADDER', dx, ly - 14, { size: 9.5, color: C.dim, weight: 500 });
        const stepW = dw / LADDER.length;
        const climb = decided ? Math.min(3.999, (lt - (inp.hit + 1) * .7) * .9) : 0;
        LADDER.forEach((s, i) => {
          const x = dx + stepW * i, done = i < Math.floor(climb) + 1 && decided, cur = decided && i === Math.floor(climb) + 1;
          const human = i === LADDER.length - 1;
          const col = human ? C.plum : C.mint;
          const y = ly + 6;
          ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + stepW - 2, y);
          ctx.strokeStyle = done ? T.rgba(col, .7) : 'rgba(236,224,200,.12)'; ctx.lineWidth = 2; ctx.stroke();
          T.node(ctx, x + 6, y, 4.5, col, { active: cur, level: done ? .8 : .2, core: false });
          T.label(ctx, s, x + 2, y + 18, { size: compact ? 8 : 9.5, color: done ? C.ink : cur ? col : C.faint });
          if (human) T.label(ctx, cur ? 'awaiting a person' : 'human only', x + 2, y + 31, { size: 8.5, color: C.plum });
        });
      }

      /* ---------- agent access over MCP ---------- */
      const my = ly + (compact ? 52 : 66);
      if (my + 44 < h) {
        T.label(ctx, 'AGENT ACCESS · MCP SERVER (READ-ONLY)', dx, my, { size: 9.5, color: C.dim, weight: 500 });
        T.rrect(ctx, dx, my + 12, dw, 46, 7);
        ctx.fillStyle = 'rgba(8,7,5,.75)'; ctx.fill();
        ctx.strokeStyle = 'rgba(236,224,200,.1)'; ctx.stroke();
        const call = 'ask_decision(card="kit_release", order="' + ord + '")';
        const res = '→ ' + ROWS[inp.hit].out + '  · rule ' + (inp.hit + 1) + ' · sources 3';
        const typed = Math.floor(T.clamp((lt - .3) * 38, 0, call.length));
        T.label(ctx, '› ' + call.slice(0, typed) + (typed < call.length && Math.sin(t * 10) > 0 ? '▍' : ''), dx + 12, my + 27, { size: compact ? 8.5 : 10, color: C.soft });
        if (decided) T.label(ctx, res, dx + 12, my + 44, { size: compact ? 8.5 : 10, color: ROWS[inp.hit].c });
      }
    }
    const loop = T.run(fig, { draw, still: 5 });
  })();

  /* ================================================================
     FIG M·2 — APS TRIAL SCHEDULING
     ================================================================ */
  (function aps() {
    const root = document.getElementById('mfgAps');
    if (!root || !window.APS) return;
    const A = window.APS;
    const fig = T.mount(root, {
      domain: 'mfg', height: 540, controls: true,
      kicker: 'Fig M·2 — APS · heuristic → improvement → independent validator',
      status: 'computed live in your browser',
      aria: 'Gantt chart of a fictional six-machine plant. Operations are first placed by a due-date heuristic, then moved by an improvement pass that minimises 1000 × late orders + late minutes, and finally re-checked by an independent validator for precedence, capacity, calendar, reference and material constraints. What-if levers add a rush order, stop a machine, or delay a material.',
      stack: ['OR-Tools CP-SAT (real system)', 'greedy list heuristic', 'kit-readiness gate', 'validator · V-PREC V-CAP V-CAL V-REF', 'PEG up/down-stream', 'what-if scenarios', 'FastAPI'],
      note: 'Browser stand-in: seeded local search replaces CP-SAT · same objective'
    });
    const ctx = fig.ctx;
    const PAL = [C.steel, C.mint, C.gold, C.plum, C.sky, C.rose, '#a9b98a', '#c9a27a'];
    let opt = { rush: false, down: false, matDelay: 0 }, sol = null, t0 = 0, lastT = 0, hover = null, boxes = [];
    const colorOf = {};

    function resolve() {
      sol = A.solve(opt);
      sol.sc.orders.forEach((o, i) => { colorOf[o.id] = o.rush ? C.red : PAL[i % PAL.length]; });
      const hm = {};
      sol.heuristic.ops.forEach(op => { hm[op.order + ':' + op.k] = op; });
      sol.pairs = sol.improved.ops.map(op => ({ to: op, from: hm[op.order + ':' + op.k] }));
      sol.H = Math.max(28, Math.ceil((Math.max(sol.heuristic.ev.makespan, sol.improved.ev.makespan) + 2) / 4) * 4);
      sol.order = {};
      sol.heuristic.seq.forEach((id, i) => { sol.order[id] = i; });
      t0 = lastT;
      fig.setStatus('computed live · ' + sol.sc.orders.length + ' orders · ' + sol.pairs.length + ' operations');
    }

    /* controls */
    const gw = T.group(fig.controls, 'What-if');
    const bR = T.button(gw, '+ Rush order O-199', () => { opt.rush = !opt.rush; bR.classList.toggle('is-on', opt.rush); bR.setAttribute('aria-pressed', opt.rush); resolve(); }, { pressed: false });
    const bD = T.button(gw, 'CNC-1 down 04–13 h', () => { opt.down = !opt.down; bD.classList.toggle('is-on', opt.down); bD.setAttribute('aria-pressed', opt.down); resolve(); }, { pressed: false });
    const rg = document.createElement('label');
    rg.className = 'tv-range';
    rg.innerHTML = '<span>M-07 kit late</span><input type="range" min="0" max="12" step="1" value="0"><output>+0 h</output>';
    fig.controls.append(rg);
    const rin = rg.querySelector('input'), rout = rg.querySelector('output');
    rin.addEventListener('input', () => { opt.matDelay = +rin.value; rout.textContent = '+' + rin.value + ' h'; resolve(); });
    const gp = T.group(fig.controls);
    T.button(gp, 'Replay', () => { t0 = lastT; loop.redraw(); });

    T.pointer(fig.canvas, {
      move(x, y) { hover = boxes.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; },
      leave() { hover = null; }
    });

    const PH = { place: 3.2, improve: 3.0, check: 2.2, hold: 4.5 };
    const CYCLE = PH.place + PH.improve + PH.check + PH.hold;

    function draw(t) {
      lastT = t;
      if (!sol) resolve();
      const w = fig.w, h = fig.h, compact = w < 700;
      T.bg(ctx, w, h, { tint: ACC, tx: .9, ty: .1 });
      boxes = [];
      const lt = (t - t0) % CYCLE;
      const pPlace = T.clamp(lt / PH.place, 0, 1);
      const pImp = T.clamp((lt - PH.place) / PH.improve, 0, 1);
      const pChk = T.clamp((lt - PH.place - PH.improve) / PH.check, 0, 1);

      const labW = compact ? 50 : 74, gx = labW + 12, gwid = w - gx - (compact ? 10 : 20);
      const gy = 34, rows = A.RESOURCES.length;
      const stripH = compact ? 150 : 112;
      const rowH = Math.min(56, (h - gy - stripH - 30) / rows);
      const H = sol.H;
      const X = hr => gx + hr / H * gwid;

      /* phase banner */
      const phase = pChk > 0 ? 3 : pImp > 0 ? 2 : 1;
      const PHN = ['', 'Heuristic · due date → priority → kit gate', 'Improve · minimise 1000·late + late-min', 'Validate · independent re-check'];
      let px = gx;
      [1, 2, 3].forEach((k, i) => {
        const on = k === phase;
        const s = (i + 1) + ' ' + (compact ? ['Heuristic', 'Improve', 'Validate'][i] : PHN[k]);
        if (on) T.node(ctx, px + 3, 15, 3, ACC, { active: true, core: false });
        px += 12 + T.label(ctx, s, px + 12, 15, { size: compact ? 9 : 10, color: on ? ACC : C.faint, weight: on ? 500 : 400 }) + (compact ? 14 : 26);
      });

      /* axis */
      for (let hr = 0; hr <= H; hr += 4) {
        const x = X(hr);
        ctx.fillStyle = 'rgba(236,224,200,.06)'; ctx.fillRect(x, gy, 1, rowH * rows);
        T.label(ctx, (hr % 24 === 0 ? 'D' + (1 + hr / 24) + ' ' : '') + String(hr % 24).padStart(2, '0') + 'h', x, gy + rowH * rows + 11, { size: 8.5, color: C.faint, align: 'center' });
      }
      /* rows + calendar blocks */
      A.RESOURCES.forEach((r, i) => {
        const y = gy + i * rowH;
        ctx.fillStyle = i % 2 ? 'rgba(236,224,200,.018)' : 'rgba(236,224,200,.035)';
        ctx.fillRect(gx, y, gwid, rowH);
        T.label(ctx, r.id, gx - 10, y + rowH / 2 - (compact ? 0 : 5), { size: compact ? 9 : 10.5, color: C.soft, align: 'right', weight: 500 });
        if (!compact) T.label(ctx, r.kind, gx - 10, y + rowH / 2 + 8, { size: 8.5, color: C.faint, align: 'right' });
      });
      sol.sc.blocks.forEach(b => {
        const i = A.RESOURCES.findIndex(r => r.id === b.res), y = gy + i * rowH;
        const x0 = X(b.from), x1 = X(b.to);
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, y + 2, x1 - x0, rowH - 4); ctx.clip();
        ctx.strokeStyle = b.why === 'unplanned stop' ? 'rgba(224,96,74,.45)' : 'rgba(236,224,200,.16)';
        ctx.lineWidth = 1;
        for (let k = -rowH; k < x1 - x0 + rowH; k += 6) { ctx.beginPath(); ctx.moveTo(x0 + k, y + rowH); ctx.lineTo(x0 + k + rowH, y); ctx.stroke(); }
        ctx.restore();
        if (x1 - x0 > 50 && !compact) T.label(ctx, b.why, (x0 + x1) / 2, y + rowH - 7, { size: 8, color: b.why === 'unplanned stop' ? C.red : C.dim, align: 'center' });
      });
      /* material arrival marker */
      const mo = sol.sc.orders.find(o => o.matName);
      if (mo) {
        const x = X(mo.mat);
        ctx.setLineDash([3, 3]); ctx.strokeStyle = T.rgba(C.gold, .6);
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + rowH * rows + 18); ctx.stroke(); ctx.setLineDash([]);
        T.label(ctx, 'M-07 kit arrives ' + mo.mat + 'h → O-105 may start', x + 5, gy + rowH * rows + 24, { size: 8.5, color: C.gold });
      }

      /* operations */
      const total = sol.pairs.length;
      const fin = pImp > 0 ? sol.improved.ev.finish : sol.heuristic.ev.finish;
      sol.pairs.forEach((pr, idx) => {
        const seqIdx = sol.order[pr.to.order] * 4 + pr.to.k;
        const appear = T.clamp(pPlace * (total + 4) - seqIdx * (total / (sol.heuristic.seq.length * 4)), 0, 1);
        if (appear <= 0) return;
        const e = T.ease.inOut(T.clamp(pImp * 1.25 - (idx % 7) * .04, 0, 1));
        const src = pr.from, dst = pr.to;
        const ri = A.RESOURCES.findIndex(r => r.id === (e < .5 ? src.res : dst.res));
        const rj = A.RESOURCES.findIndex(r => r.id === dst.res);
        const s = T.lerp(src.start, dst.start, e);
        const yy = T.lerp(gy + A.RESOURCES.findIndex(r => r.id === src.res) * rowH, gy + rj * rowH, e);
        const x0 = X(s), x1 = X(s + dst.dur);
        const ord = sol.sc.orders.find(o => o.id === dst.order);
        const late = fin[dst.order] > ord.due && dst.k === 3;
        const col = colorOf[dst.order];
        const isH = hover && hover.order === dst.order;
        const bx = x0 + 1, by = yy + 5 + (1 - appear) * -8, bw = Math.max(2, x1 - x0 - 2), bh = rowH - 10;
        ctx.save();
        ctx.globalAlpha = appear * (hover && !isH ? .35 : 1);
        T.rrect(ctx, bx, by, bw, bh, 4);
        const g = ctx.createLinearGradient(bx, by, bx, by + bh);
        g.addColorStop(0, T.rgba(col, .42)); g.addColorStop(1, T.rgba(col, .2));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = late && phase > 1 ? C.red : T.rgba(col, isH ? 1 : .75);
        ctx.lineWidth = late && phase > 1 ? 1.6 : 1; ctx.stroke();
        if (bw > 38) T.label(ctx, dst.order.slice(2), bx + 5, by + bh / 2, { size: compact ? 8 : 9, color: C.ink, weight: 500 });
        ctx.restore();
        if (pChk > 0 && pChk < 1) {
          const scanX = gx + gwid * pChk;
          if (Math.abs(scanX - (bx + bw / 2)) < 30) T.glow(ctx, bx + bw / 2, by + bh / 2, 20, C.mint, .25);
        }
        boxes.push({ x: bx, y: by, w: bw, h: bh, order: dst.order, op: dst, ord });
      });
      if (pChk > 0 && pChk < 1) {
        const sx = gx + gwid * pChk;
        const g = ctx.createLinearGradient(sx - 40, 0, sx, 0);
        g.addColorStop(0, 'rgba(108,196,160,0)'); g.addColorStop(1, 'rgba(108,196,160,.18)');
        ctx.fillStyle = g; ctx.fillRect(sx - 40, gy, 40, rowH * rows);
        ctx.fillStyle = T.rgba(C.mint, .8); ctx.fillRect(sx, gy, 1.5, rowH * rows);
      }

      /* due-date ticks for hovered order */
      if (hover) {
        const dx = X(hover.ord.due);
        ctx.setLineDash([2, 3]); ctx.strokeStyle = T.rgba(colorOf[hover.order], .9);
        ctx.beginPath(); ctx.moveTo(dx, gy); ctx.lineTo(dx, gy + rowH * rows); ctx.stroke(); ctx.setLineDash([]);
        const f = fin[hover.order];
        const s = hover.order + ' · op ' + (hover.op.k + 1) + '/4 ' + hover.op.kind + ' on ' + hover.op.res +
          ' · due ' + hover.ord.due + 'h · done ' + f + 'h' + (f > hover.ord.due ? ' · LATE' : ' ✓');
        ctx.font = F(10);
        const tw = ctx.measureText(s).width;
        T.label(ctx, s, T.clamp(hover.x, 10, w - tw - 20) + 8, Math.max(12, hover.y - 12), { size: 10, color: C.ink, pill: 'rgba(30,25,18,.96)', border: T.rgba(colorOf[hover.order], .7), radius: 5 });
      }

      /* ---------- bottom strip: objective · KPIs · validator ---------- */
      const sy = h - stripH + 6;
      ctx.fillStyle = 'rgba(236,224,200,.06)'; ctx.fillRect(14, sy - 10, w - 28, 1);
      const he = sol.heuristic.ev, ie = sol.improved.ev;
      const trj = sol.improved.traj, upI = pImp * trj[trj.length - 1].i;
      const cur = pImp > 0 ? trj.filter(p => p.i <= upI).pop() : he;
      /* objective trajectory */
      const tw0 = compact ? w * .42 : Math.min(300, w * .3), th = compact ? 62 : stripH - 40;
      const tx = 18, ty = sy + 16;
      T.label(ctx, compact ? 'OBJECTIVE' : 'OBJECTIVE  1000·late + late-min', tx, sy + 2, { size: 9, color: C.dim, weight: 500 });
      const tr = sol.improved.traj, maxI = tr[tr.length - 1].i, maxO = Math.max(1, ...tr.map(p => p.obj), he.obj);
      ctx.strokeStyle = 'rgba(236,224,200,.14)'; ctx.lineWidth = 1;
      ctx.strokeRect(tx + .5, ty + .5, tw0, th);
      ctx.beginPath();
      const upto = pImp * maxI;
      tr.forEach((p, i) => {
        if (p.i > upto && i > 0) return;
        const x = tx + p.i / maxI * tw0, y = ty + th - p.obj / maxO * (th - 6) - 3;
        if (i === 0) ctx.moveTo(x, y);
        else { const prev = tr[i - 1]; ctx.lineTo(x, ty + th - prev.obj / maxO * (th - 6) - 3); ctx.lineTo(x, y); }
      });
      if (pImp > 0) {
        const last = tr.filter(p => p.i <= upto).pop();
        ctx.lineTo(tx + upto / maxI * tw0, ty + th - last.obj / maxO * (th - 6) - 3);
      }
      ctx.strokeStyle = ACC; ctx.lineWidth = 1.6; ctx.stroke();
      T.label(ctx, he.obj.toLocaleString('en-US'), tx + 4, ty + 8, { size: 8.5, color: C.faint });
      T.label(ctx, 'iterations →', tx + tw0 - 4, ty + th - 7, { size: 8, color: C.faint, align: 'right' });

      /* KPIs */
      const kx = tx + tw0 + (compact ? 14 : 34);
      const kp = [
        ['late orders', String(cur.late), cur.late ? C.red : C.mint],
        ['late minutes', String(cur.lateMin), cur.lateMin ? C.gold : C.mint],
        ['makespan', cur.makespan.toFixed(1) + ' h', C.ink]
      ];
      kp.forEach(([k, v, c], i) => {
        const x = compact ? kx : kx + i * 108, y = compact ? sy + 6 + i * 26 : sy + 30;
        T.label(ctx, v, x, y, { size: compact ? 15 : 22, color: c, fam: 'serif', weight: 560 });
        T.label(ctx, k, x + (compact ? 64 : 0), compact ? y : y + 22, { size: 8.5, color: C.dim });
      });
      /* validator */
      if (compact) {
        const checks = Object.entries(sol.checks), vy = sy + th + 36, cw = (w - 36) / checks.length;
        checks.forEach(([k, v], i) => {
          const shown = pChk >= (i + 1) / checks.length - 1e-6 || lt > PH.place + PH.improve + PH.check;
          T.label(ctx, (shown ? (v === 0 ? '✓ ' : '✕ ') : '· ') + k.replace('V-', ''), 18 + i * cw, vy, { size: 9, color: shown ? (v === 0 ? C.mint : C.red) : C.faint, weight: 500 });
        });
      } else {
        const vx = kx + 340, vw = w - vx - 18;
        T.label(ctx, 'VALIDATOR', vx, sy + 2, { size: 9, color: C.dim, weight: 500 });
        const checks = Object.entries(sol.checks);
        checks.forEach(([k, v], i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const x = vx + col * Math.max(100, vw / 3), y = sy + 22 + row * 26;
          const shown = pChk >= (i + 1) / checks.length - 1e-6 || lt > PH.place + PH.improve + PH.check;
          const ok = v === 0;
          T.label(ctx, (shown ? (ok ? '✓ ' : '✕ ') : '· ') + k, x, y, { size: 10, color: shown ? (ok ? C.mint : C.red) : C.faint, weight: 500 });
          if (shown) T.label(ctx, ok ? '0 violations' : v + ' violations', x, y + 12, { size: 8, color: C.faint });
        });
        const passed = lt > PH.place + PH.improve + PH.check && Object.values(sol.checks).every(v => v === 0);
        T.label(ctx, passed ? 'feasible proposal → human review (not yet approved)' : '', vx, sy + 82, { size: 9, color: C.plum });
      }
    }
    const loop = T.run(fig, { draw, still: 14 });
  })();
})();
