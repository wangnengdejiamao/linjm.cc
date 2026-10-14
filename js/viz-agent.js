/* =================================================================
   viz-agent.js — 03 · Astronomy · Astro Agent.

   Fig A·3  The analysis_agent LangGraph run: four bands (acquire,
            plan & retrieve, model & audit, draft & review), three
            mandatory modelling iterations, a replan loop from the QA
            gate, a reflexion loop from paper QC, and an evidence gate
            that halts instead of publishing.
   Fig A·4  The delegation loop: a missing tool becomes a spec, the
            spec goes to Claude Code over A2A, and the tool is only
            registered once its tests pass and a person approves it.
   ================================================================= */
(function () {
  'use strict';
  const T = window.TV;
  if (!T) return;
  const C = T.C, F = T.font, ACC = T.DOMAIN.astro;

  /* ================================================================
     FIG A·3 — LANGGRAPH RUN
     ================================================================ */
  (function graph() {
    const root = document.getElementById('agentGraph');
    if (!root) return;
    const fig = T.mount(root, {
      domain: 'astro', height: 540, controls: true,
      kicker: 'Fig A·3 — Astro Agent · LangGraph run with replan, reflexion and an evidence gate',
      status: 'schematic replay · node names from analysis_agent',
      aria: 'Astro Agent LangGraph run. Nodes are grouped in four bands: acquire (resolve, data fetch), plan and retrieve (planner, RAG and knowledge graph, evidence), model and audit (three modelling iterations, supervisor, QA gate) and draft and review (drafter, paper QC, peer review). A replan loop runs from the QA gate back to the planner, a reflexion loop from paper QC back to the drafter, and the evidence gate can halt the run.',
      stack: ['LangGraph StateGraph', 'FS-as-memory · JSON checkpoints', 'SIMBAD · 20+ survey clients', 'BM25 + KG method transfer', 'multi-provider LLM', 'aastex LaTeX'],
      note: 'Simplified schematic · the real graph registers more nodes'
    });
    const ctx = fig.ctx;

    const BANDS = [
      { name: 'ACQUIRE', c: C.steel, x: .11 },
      { name: 'PLAN & RETRIEVE', c: C.sky, x: .36 },
      { name: 'MODEL & AUDIT', c: ACC, x: .61 },
      { name: 'DRAFT & REVIEW', c: C.plum, x: .86 }
    ];
    const N = {
      resolve: { b: 0, y: .30, label: 'resolve', d: 'SIMBAD cross-id · name ↔ RA/Dec', f: '01_resolve.json' },
      data_fetch: { b: 0, y: .58, label: 'data fetch', d: '20+ survey clients', f: '02_run_summary.json' },
      planner: { b: 1, y: .24, label: 'planner', d: 'route by class → branch', f: '03_plan.json' },
      retrieval: { b: 1, y: .47, label: 'RAG / KG', d: 'BM25 + rule tags + KG', f: '04_retrieval.json' },
      evidence: { b: 1, y: .70, label: 'evidence gate', d: 'which claims are supported?', f: '05_evidence_pack.json', gate: true },
      iterate: { b: 2, y: .24, label: 'iterate ×3', d: 'baseline → residuals → systematics', f: '06_model_iter_{k}.json' },
      supervisor: { b: 2, y: .47, label: 'supervisor', d: 'audit residuals · repair actions', f: '07_supervisor.json' },
      qa: { b: 2, y: .70, label: 'QA gate', d: 'clear_for_draft?', f: '08_qa_gate.json', gate: true },
      drafter: { b: 3, y: .24, label: 'drafter', d: '5-agent writer → aastex', f: '09_draft.tex' },
      paperqc: { b: 3, y: .47, label: 'paper QC', d: 'tables · units · citations', f: '10_paper_qc.json', gate: true },
      review: { b: 3, y: .70, label: 'peer review', d: '4 scientific questions', f: '11_review.md' },
      halted: { b: 1, y: .91, label: 'halted', d: 'no paper emitted', f: '99_abnormal.json', halt: true }
    };
    const MAIN = [['resolve', 'data_fetch'], ['data_fetch', 'planner'], ['planner', 'retrieval'], ['retrieval', 'evidence'],
      ['evidence', 'iterate'], ['iterate', 'supervisor'], ['supervisor', 'qa'], ['qa', 'drafter'],
      ['drafter', 'paperqc'], ['paperqc', 'review']];
    const ITER = ['baseline fit', 'physical residuals', 'systematics budget'];
    const head = ['resolve', 'data_fetch', 'planner', 'retrieval', 'evidence', 'iterate', 'iterate', 'iterate', 'supervisor', 'qa'];
    const tail = ['drafter', 'paperqc', 'review'];
    const SC = {
      clear: { label: 'Clear → paper', seq: [...head, ...tail], end: 'paper drafted · review notes', ok: true },
      mismatch: { label: 'Model mismatch → replan', seq: [...head, 'planner', 'retrieval', 'evidence', 'iterate', 'iterate', 'iterate', 'supervisor', 'qa', ...tail], end: 'replanned once · paper drafted', ok: true },
      reflexion: { label: 'QC fail → reflexion', seq: [...head, 'drafter', 'paperqc', 'drafter', 'paperqc', 'review'], end: 'reflexion ×1 · paper drafted', ok: true },
      blocked: { label: 'Insufficient data → halt', seq: ['resolve', 'data_fetch', 'planner', 'retrieval', 'evidence', 'halted'], end: 'halted · refuses to over-claim', ok: false }
    };
    let sc = 'clear', t0 = 0, lastT = 0, hover = null, lastIdx = -1;
    const STEP = 1.15, HOLD = 3;

    /* HUD */
    const panel = document.createElement('div');
    panel.className = 'tv-panel';
    panel.style.cssText = 'right:14px;top:14px;width:258px';
    panel.innerHTML = '<h5>Run state</h5><div class="ag-ro"></div><h5 style="margin-top:.7rem">Run log · filesystem-as-memory</h5><div class="tv-log ag-lg" style="max-height:none"></div>';
    fig.hud.append(panel);
    const ro = panel.querySelector('.ag-ro'), lg = panel.querySelector('.ag-lg');

    T.chips(fig.controls, 'Scenario', Object.keys(SC).map(k => ({ key: k, label: SC[k].label })), k => { sc = k; t0 = lastT; lastIdx = -1; loop.redraw(); }, sc);
    const gp = T.group(fig.controls);
    const pz = T.button(gp, 'Pause', () => { loop.paused = !loop.paused; pz.textContent = loop.paused ? 'Play' : 'Pause'; pz.setAttribute('aria-pressed', String(loop.paused)); }, { pressed: false });
    T.button(gp, 'Step ▸', () => {
      loop.paused = true; pz.textContent = 'Play'; pz.setAttribute('aria-pressed', 'true');
      const lt = lastT - t0, i = Math.floor(lt / STEP) + 1;
      t0 = lastT - (i * STEP + STEP * .7); loop.t = lastT;
    });
    const rg = document.createElement('label');
    rg.className = 'tv-range';
    rg.innerHTML = '<span>Speed</span><input type="range" min="0.4" max="2.5" step="0.1" value="1"><output>1.0×</output>';
    fig.controls.append(rg);
    rg.querySelector('input').addEventListener('input', e => { loop.speed = +e.target.value; rg.querySelector('output').textContent = (+e.target.value).toFixed(1) + '×'; });

    T.pointer(fig.canvas, {
      move(x, y) { hover = Object.keys(N).find(k => N[k].box && x >= N[k].box[0] && x <= N[k].box[0] + N[k].box[2] && y >= N[k].box[1] && y <= N[k].box[1] + N[k].box[3]) || null; },
      leave() { hover = null; }
    });

    function state(lt) {
      const seq = SC[sc].seq, total = seq.length * STEP + HOLD;
      lt = ((lt % total) + total) % total;
      const i = Math.min(seq.length - 1, Math.floor(lt / STEP));
      const frac = lt >= seq.length * STEP ? 1 : (lt - i * STEP) / STEP;
      const done = lt >= seq.length * STEP;
      return { seq, i, frac, done };
    }
    function iterOf(seq, i) { let k = 0; for (let j = 0; j <= i; j++) if (seq[j] === 'iterate') k++; return ((k - 1) % 3) + 1; }

    function syncHud(st) {
      if (st.i === lastIdx && !st.done) return;
      lastIdx = st.done ? -2 : st.i;
      const key = st.seq[st.i], n = N[key];
      const replans = st.seq.slice(0, st.i + 1).filter((k, j, a) => k === 'planner' && a.slice(0, j).includes('qa')).length;
      const refl = st.seq.slice(0, st.i + 1).filter((k, j, a) => k === 'drafter' && a.slice(0, j).includes('paperqc')).length;
      const its = st.seq.slice(0, st.i + 1).filter(k => k === 'iterate').length;
      const status = st.done ? (SC[sc].ok ? 'complete ✓' : 'halted') : key === 'halted' ? 'halted' : replans && key !== 'review' ? 'replanning' : refl ? 'reflexion' : 'running';
      T.readout(ro, [
        ['node', n.label],
        ['band', BANDS[n.b].name.toLowerCase()],
        ['modelling iteration', Math.min(3, its % 3 === 0 && its ? 3 : its % 3) + ' / 3'],
        ['replan · reflexion', replans + '/2 · ' + refl + '/2'],
        ['status', status, status.startsWith('complete') ? 'ok' : status === 'halted' ? 'bad' : status === 'running' ? '' : 'warn']
      ]);
      lg.innerHTML = '';
      st.seq.slice(0, st.i + 1).slice(-7).forEach((k, j, arr) => {
        const idx = st.i + 1 - arr.length + j;
        const f = N[k].f.replace('{k}', iterOf(st.seq, idx));
        const d = document.createElement('div');
        d.innerHTML = '<em>' + String(idx + 1).padStart(2, '0') + '</em> ' + f;
        lg.append(d);
      });
      if (st.done) { const d = document.createElement('div'); d.innerHTML = '<em>→</em> ' + SC[sc].end; lg.append(d); }
    }

    function draw(t) {
      lastT = t;
      const w = fig.w, h = fig.h, compact = w < 760;
      panel.style.display = compact ? 'none' : '';
      T.bg(ctx, w, h, { tint: ACC, tx: .2, ty: .1 });
      const st = state(t - t0);
      syncHud(st);
      const right = compact ? 0 : 284;
      const gw = w - right - 20;
      const bx = b => 14 + gw * BANDS[b].x;
      const bw = Math.min(170, gw * .2), bh = compact ? 40 : 48;
      const P = k => ({ x: bx(N[k].b), y: 26 + (h - 40) * N[k].y });

      /* bands */
      BANDS.forEach((b, i) => {
        const x = bx(i) - bw / 2 - 12, wd = bw + 24;
        T.rrect(ctx, x, 14, wd, h - 28, 12);
        ctx.fillStyle = T.rgba(b.c, .035); ctx.fill();
        ctx.strokeStyle = T.rgba(b.c, .14); ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
        T.label(ctx, compact ? b.name.split(' ')[0] : b.name, bx(i), 32, { size: compact ? 9 : 10.5, color: T.rgba(b.c, .9), align: 'center', weight: 500 });
      });

      const cur = st.seq[st.i], prev = st.i > 0 ? st.seq[st.i - 1] : null;
      const visited = new Set(st.seq.slice(0, st.i + (st.done ? 1 : 0)));

      /* edges */
      const edgeQ = (a, b) => {
        const A = P(a), B = P(b);
        if (N[a].b === N[b].b) return { a: { x: A.x, y: A.y + bh / 2 }, b: { x: B.x, y: B.y - bh / 2 }, c: { x: A.x, y: (A.y + B.y) / 2 } };
        return { a: { x: A.x + bw / 2, y: A.y }, b: { x: B.x - bw / 2, y: B.y }, c: { x: (A.x + B.x) / 2, y: A.y + (B.y - A.y) * .1 } };
      };
      const loopQ = (a, b) => {
        const A = P(a), B = P(b);
        if (a === 'qa') return { a: { x: A.x - bw / 2, y: A.y }, b: { x: B.x + bw / 2, y: B.y + 8 }, c: { x: (A.x + B.x) / 2 + 10, y: (A.y + B.y) / 2 + 30 } };
        return { a: { x: A.x + bw / 2, y: A.y }, b: { x: B.x + bw / 2, y: B.y }, c: { x: A.x + bw / 2 + 36, y: (A.y + B.y) / 2 } };
      };
      MAIN.forEach(([a, b]) => {
        const q = edgeQ(a, b), on = visited.has(a) && visited.has(b);
        T.strokeBez(ctx, q, on ? ACC : C.soft, on ? 1.4 : 1, on ? .5 : .16);
      });
      const loops = [['qa', 'planner', 'replan ≤2', C.gold], ['paperqc', 'drafter', 'reflexion ≤2', C.plum]];
      loops.forEach(([a, b, lab, col]) => {
        const q = loopQ(a, b);
        T.strokeBez(ctx, q, col, 1.2, .5, [4, 4]);
        const m = T.bezPt(q, a === 'qa' ? .62 : .5);
        if (!compact) T.label(ctx, lab, m.x, m.y, { size: 8.5, align: 'center', color: col, pill: 'rgba(15,13,10,.9)', border: T.rgba(col, .4) });
      });
      { const q = edgeQ('evidence', 'halted'); T.strokeBez(ctx, q, C.red, 1.2, .45, [3, 4]); const m = T.bezPt(q, .5); if (!compact) T.label(ctx, 'insufficient', m.x + 6, m.y, { size: 8.5, color: C.red, pill: 'rgba(15,13,10,.9)' }); }
      /* iterate self-loop pips */
      {
        const p = P('iterate'), its = st.seq.slice(0, st.i + 1).filter(k => k === 'iterate').length % 3 || (cur === 'iterate' || visited.has('iterate') ? 3 : 0);
        for (let k = 0; k < 3; k++) {
          const on = cur === 'iterate' ? k < iterOf(st.seq, st.i) : visited.has('iterate');
          ctx.beginPath(); ctx.arc(p.x - 14 + k * 14, p.y - bh / 2 - 9, 3.2, 0, T.TAU);
          ctx.fillStyle = on ? ACC : 'rgba(236,224,200,.15)'; ctx.fill();
        }
        void its;
      }
      /* packet on the active transition */
      if (prev && !st.done && st.frac < .55) {
        const u = st.frac / .55;
        let q;
        if (prev === 'qa' && cur === 'planner') q = loopQ('qa', 'planner');
        else if (prev === 'paperqc' && cur === 'drafter') q = loopQ('paperqc', 'drafter');
        else if (prev === cur) q = null;
        else q = edgeQ(prev, cur);
        if (q) T.flow(ctx, () => T.bezPt(q, u), 0, { n: 1, color: cur === 'halted' ? C.red : ACC, size: 3 });
      }

      /* nodes */
      Object.keys(N).forEach(k => {
        const n = N[k], p = P(k), x = p.x - bw / 2, y = p.y - bh / 2;
        n.box = [x, y, bw, bh];
        const active = k === cur && !st.done, seen = visited.has(k) || (st.done && k === cur);
        const col = n.halt ? C.red : n.gate ? C.mint : BANDS[n.b].c;
        const lvl = active ? (st.frac < .55 ? st.frac / .55 : 1) : (hover === k ? .5 : 0);
        T.card(ctx, x, y, bw, bh, { color: col, level: lvl, r: 8 });
        if (n.gate || n.halt) {
          ctx.save(); ctx.translate(x + bw - 14, y + 12); ctx.rotate(Math.PI / 4);
          ctx.strokeStyle = T.rgba(col, .8); ctx.strokeRect(-3.5, -3.5, 7, 7); ctx.restore();
        }
        T.label(ctx, k === 'iterate' && active ? 'iterate ' + iterOf(st.seq, st.i) + '/3' : n.label, x + 12, y + (compact ? bh / 2 : 17), { font: F(compact ? 10.5 : 12, 600, 'sans'), color: seen || active ? C.ink : C.soft });
        if (!compact) {
          const det = k === 'iterate' && active ? ITER[iterOf(st.seq, st.i) - 1] : n.d;
          ctx.font = F(9);
          const fitted = T.wrap(ctx, det, bw - 22)[0];
          T.label(ctx, fitted + (fitted.length < det.length ? '…' : ''), x + 12, y + 33, { size: 9, color: active ? T.rgba(col, 1) : C.dim });
        }
        if (seen && !active && !n.halt) T.label(ctx, '✓', x + bw - 10, y + bh - 11, { size: 9, color: C.mint, align: 'right' });
      });
      if (hover && !compact) {
        const n = N[hover], p = P(hover);
        const s = n.f.replace('{k}', '1..3') + ' · ' + n.d;
        ctx.font = F(10); const tw = ctx.measureText(s).width;
        T.label(ctx, s, T.clamp(p.x - tw / 2, 10, w - tw - 20), p.y - bh / 2 - 22, { size: 10, color: C.ink, pill: 'rgba(30,25,18,.96)', border: T.rgba(ACC, .6), radius: 5 });
      }
      /* compact: status line */
      if (compact) T.label(ctx, (st.done ? SC[sc].end : N[cur].label + ' · ' + N[cur].d), 14, h - 10, { size: 9, color: ACC });
      if (st.done && !compact) {
        const ok = SC[sc].ok;
        T.label(ctx, (ok ? '✓ ' : '■ ') + SC[sc].end, 14 + gw / 2, h - 14, { size: 10.5, align: 'center', color: ok ? C.mint : C.red, weight: 500, pill: 'rgba(15,13,10,.92)', border: T.rgba(ok ? C.mint : C.red, .5) });
      }
    }
    const loop = T.run(fig, { draw, still: 13.5 });
  })();

  /* ================================================================
     FIG A·4 — DELEGATION LOOP
     ================================================================ */
  (function delegate() {
    const root = document.getElementById('agentDelegate');
    if (!root) return;
    const fig = T.mount(root, {
      domain: 'astro', height: 330, controls: false,
      kicker: 'Fig A·4 — Self-evolving toolbox · orchestrator ⇄ Claude Code over A2A',
      status: 'schematic replay',
      aria: 'Delegation loop: the orchestrator collects evidence for a missing method, turns it into an algorithm spec and a task, hands it to Claude Code over an agent-to-agent channel, Claude Code implements the tool and its tests, returns the artifact, and the tool is registered as a new skill only after tests pass and a person approves.',
      stack: ['claude_code_delegate', 'A2A task spec (JSON)', 'pytest smoke tests', 'human review gate', 'skill registry'],
      note: 'A tool enters the registry only with literature evidence, passing tests and a human sign-off'
    });
    const ctx = fig.ctx;
    const PH = [
      { k: 'evidence', t: 'Collect evidence', s: 'orch', m: ['» evidence_pack', '  bibcode: 2021A&A…', '  method: Lomb–Scargle'] },
      { k: 'spec', t: 'Method → spec', s: 'orch', m: ['» algorithm_spec', '  inputs: t, mag, err', '  steps: 5 · constraints'] },
      { k: 'task', t: 'Task generation', s: 'orch', m: ['» toolbox_gap.json', '  module: period.lomb', '  accept: recover P ±1%'] },
      { k: 'delegate', t: 'Delegate', s: 'out', m: ['→ claude_code_delegate', '  spec + acceptance test'] },
      { k: 'implement', t: 'Implement + test', s: 'worker', m: ['⚙ write tool', '⚙ write unit tests', '⚙ run smoke test'] },
      { k: 'return', t: 'Return artifact', s: 'back', m: ['← artifact', '  tests_passed: true'] },
      { k: 'review', t: 'Human review', s: 'human', m: ['? reviewer approves', '  interface + evidence'] },
      { k: 'register', t: 'Register skill', s: 'orch', m: ['✓ registry += period.lomb'] }
    ];
    const D = 1.5, HOLD = 1.5, TOT = PH.length * D + HOLD;

    function station(x, y, w, h, title, sub, col, on) {
      T.card(ctx, x, y, w, h, { color: col, level: on ? .75 : .05, r: 12, bar: false });
      T.label(ctx, title, x + 16, y + 22, { font: F(13, 600, 'sans'), color: C.ink });
      T.label(ctx, sub, x + 16, y + 40, { size: 9.5, color: C.dim });
    }

    function draw(t) {
      const w = fig.w, h = fig.h, compact = w < 700;
      T.bg(ctx, w, h, { tint: ACC, tx: .5, ty: .2 });
      const lt = t % TOT, pi = Math.min(PH.length - 1, Math.floor(lt / D)), fr = lt >= PH.length * D ? 1 : (lt - pi * D) / D;
      const p = PH[pi];
      const sw = compact ? (w - 48) / 2 : Math.min(330, w * .3), sh = compact ? 150 : 170;
      const ox = 16, wx = w - sw - 16, sy = 22;
      station(ox, sy, sw, sh, 'Orchestrator', 'analysis_agent · LangGraph', ACC, ['orch', 'human'].includes(p.s));
      station(wx, sy, sw, sh, 'Worker', 'Claude Code · coding agent', C.sky, p.s === 'worker');
      /* channel */
      const cy = sy + sh / 2;
      const a = { x: ox + sw, y: cy }, b = { x: wx, y: cy };
      ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(236,224,200,.22)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 8); ctx.lineTo(b.x, b.y - 8); ctx.moveTo(a.x, a.y + 8); ctx.lineTo(b.x, b.y + 8); ctx.stroke(); ctx.setLineDash([]);
      if (!compact) T.label(ctx, 'A2A · task spec  ⇄  artifact', (a.x + b.x) / 2, cy - 24, { size: 9.5, align: 'center', color: C.dim });
      if (p.s === 'out' || p.s === 'back') {
        const go = p.s === 'out', u = T.ease.inOut(fr);
        const x = go ? T.lerp(a.x + 24, b.x - 24, u) : T.lerp(b.x - 24, a.x + 24, u), y = go ? cy - 8 : cy + 8;
        const col = go ? ACC : C.mint;
        T.glow(ctx, x, y, 26, col, .3);
        T.label(ctx, go ? '{ spec }.json' : 'tool ✓', x, y, { size: 9.5, align: 'center', color: col, pill: 'rgba(15,13,10,.95)', border: T.rgba(col, .8), radius: 4 });
      }
      /* message blocks inside stations */
      const msgIn = (x, side) => {
        const lines = side === 'worker' ? (p.s === 'worker' ? p.m : []) : (['orch', 'human', 'out', 'back'].includes(p.s) ? p.m : []);
        const shown = Math.ceil(fr * lines.length * 1.6);
        lines.slice(0, shown).forEach((s, i) => T.label(ctx, s, x + 16, sy + 66 + i * 17, { size: compact ? 8.5 : 10, color: i === 0 ? C.ink : C.soft }));
      };
      msgIn(ox, 'orch'); msgIn(wx, 'worker');
      if (p.s === 'worker') {
        const bw = sw - 32, by = sy + sh - 26;
        T.rrect(ctx, wx + 16, by, bw, 6, 3); ctx.fillStyle = 'rgba(236,224,200,.08)'; ctx.fill();
        T.rrect(ctx, wx + 16, by, bw * T.clamp(fr * 1.2, 0, 1), 6, 3); ctx.fillStyle = fr > .8 ? C.mint : C.sky; ctx.fill();
        T.label(ctx, fr > .8 ? 'smoke test passed' : 'running tests…', wx + 16, by - 9, { size: 9, color: fr > .8 ? C.mint : C.dim });
      }
      if (p.s === 'human') {
        const hx = (a.x + b.x) / 2, hy = cy + 34;
        T.node(ctx, hx, hy, 9, C.plum, { active: true });
        T.label(ctx, 'human review gate', hx, hy + 22, { size: 9.5, align: 'center', color: C.plum });
      }
      /* step rail */
      const ry = sy + sh + (compact ? 44 : 56), rx0 = 30, rx1 = w - 30, n = PH.length;
      ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.strokeStyle = 'rgba(236,224,200,.12)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx0 + (rx1 - rx0) * ((pi + fr) / (n - 1)), ry); ctx.strokeStyle = T.rgba(ACC, .7); ctx.lineWidth = 1.6; ctx.stroke();
      PH.forEach((q, i) => {
        const x = rx0 + (rx1 - rx0) * i / (n - 1), on = i === pi, done = i < pi;
        const col = q.s === 'human' ? C.plum : q.s === 'worker' ? C.sky : ACC;
        T.node(ctx, x, ry, on ? 6 : 4, col, { active: on, level: done ? .7 : .2, core: on });
        if (!compact || on) T.label(ctx, q.t, x, ry + 20, { size: compact ? 9 : 9.5, align: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center', color: on ? C.ink : done ? C.soft : C.faint, weight: on ? 500 : 400 });
      });
      /* registry */
      const gy = ry + 48, regN = 6 + (pi === n - 1 ? 1 : 0);
      if (gy + 16 < h) {
        T.label(ctx, 'SKILL REGISTRY', rx0, gy, { size: 9, color: C.dim, weight: 500 });
        for (let i = 0; i < 7; i++) {
          const x = rx0 + 110 + i * 22, on = i < regN, isNew = i === 6 && on;
          T.rrect(ctx, x, gy - 7, 16, 14, 3);
          ctx.fillStyle = isNew ? T.rgba(C.mint, .9) : on ? T.rgba(ACC, .45) : 'rgba(236,224,200,.06)'; ctx.fill();
          if (isNew) T.glow(ctx, x + 8, gy, 20, C.mint, .35);
        }
        T.label(ctx, regN + ' skills' + (regN > 6 ? ' · +period.lomb' : ''), rx0 + 110 + 7 * 22 + 6, gy, { size: 9.5, color: regN > 6 ? C.mint : C.soft });
      }
    }
    T.run(fig, { draw, still: 11.3 });
  })();
})();
