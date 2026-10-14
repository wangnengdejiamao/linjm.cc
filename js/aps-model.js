/* =================================================================
   aps-model.js — the tiny scheduler behind the APS figure.

   A browser-sized stand-in for the real workbench: the same shape of
   algorithm (deterministic list heuristic → improvement pass →
   independent validator), on a fictional plant small enough to solve
   in a few milliseconds. The improvement pass here is a seeded local
   search over order sequence; the real system uses OR-Tools CP-SAT
   with the same objective, 1000 × late orders + late minutes.

   Pure functions, no DOM — also loaded by tests under Node.
   ================================================================= */
(function (root) {
  'use strict';

  const RESOURCES = [
    { id: 'SAW-1', kind: 'cut' }, { id: 'CNC-1', kind: 'mill' }, { id: 'CNC-2', kind: 'mill' },
    { id: 'HT-1', kind: 'heat' }, { id: 'ASM-1', kind: 'asm' }, { id: 'QC-1', kind: 'qc' }
  ];
  /* routes: kind sequence + hours */
  const ROUTE = {
    A: [['cut', 2], ['mill', 4], ['heat', 3], ['qc', 1]],
    B: [['cut', 1], ['mill', 3], ['asm', 3], ['qc', 1]],
    C: [['mill', 5], ['heat', 2], ['asm', 2], ['qc', 1]]
  };
  const BASE_ORDERS = [
    { id: 'O-101', route: 'A', due: 14, prio: 2, mat: 0 },
    { id: 'O-102', route: 'B', due: 12, prio: 1, mat: 0 },
    { id: 'O-103', route: 'C', due: 20, prio: 2, mat: 0 },
    { id: 'O-104', route: 'A', due: 22, prio: 1, mat: 0 },
    { id: 'O-105', route: 'B', due: 18, prio: 3, mat: 6, matName: 'M-07 bearing kit' },
    { id: 'O-106', route: 'C', due: 26, prio: 2, mat: 0 },
    { id: 'O-107', route: 'A', due: 30, prio: 1, mat: 0 },
    { id: 'O-108', route: 'B', due: 24, prio: 2, mat: 0 }
  ];
  const RUSH = { id: 'O-199', route: 'B', due: 11, prio: 0, mat: 0, rush: true };
  /* calendar: planned maintenance on CNC-2 */
  const BASE_BLOCKS = [{ res: 'CNC-2', from: 8, to: 12, why: 'planned maintenance' }];
  const HORIZON = 36;

  function scenario(o) {
    o = o || {};
    const orders = BASE_ORDERS.map(x => Object.assign({}, x));
    if (o.matDelay) orders.forEach(x => { if (x.matName) x.mat = 6 + o.matDelay; });
    if (o.rush) orders.push(Object.assign({}, RUSH));
    const blocks = BASE_BLOCKS.slice();
    if (o.down) blocks.push({ res: 'CNC-1', from: 4, to: 13, why: 'unplanned stop' });
    return { orders, blocks, resources: RESOURCES };
  }

  /* place one operation: earliest start ≥ ready on an eligible resource,
     skipping calendar blocks; choose the resource with earliest finish. */
  function schedule(sc, seq) {
    const free = {};
    sc.resources.forEach(r => { free[r.id] = 0; });
    const ops = [];
    seq.forEach(oid => {
      const ord = sc.orders.find(o => o.id === oid);
      let ready = ord.mat || 0;
      ROUTE[ord.route].forEach(([kind, dur], k) => {
        let best = null;
        sc.resources.filter(r => r.kind === kind).forEach(r => {
          let s = Math.max(ready, free[r.id]);
          for (let guard = 0; guard < 5; guard++) {
            const hit = sc.blocks.find(b => b.res === r.id && s < b.to && s + dur > b.from);
            if (!hit) break;
            s = hit.to;
          }
          if (!best || s + dur < best.end) best = { res: r.id, start: s, end: s + dur };
        });
        free[best.res] = best.end;
        ready = best.end;
        ops.push({ order: oid, k, kind, dur, res: best.res, start: best.start, end: best.end, rush: !!ord.rush });
      });
    });
    return ops;
  }

  function evaluate(sc, ops) {
    let late = 0, lateMin = 0;
    const fin = {};
    ops.forEach(op => { fin[op.order] = Math.max(fin[op.order] || 0, op.end); });
    sc.orders.forEach(o => {
      const d = (fin[o.id] || 0) - o.due;
      if (d > 0) { late++; lateMin += Math.round(d * 60); }
    });
    return { late, lateMin, obj: 1000 * late + lateMin, finish: fin, makespan: Math.max(...ops.map(o => o.end)) };
  }

  /* deterministic heuristic: due date, then priority */
  function heuristicSeq(sc) {
    return sc.orders.slice().sort((a, b) => a.due - b.due || a.prio - b.prio || (a.id < b.id ? -1 : 1)).map(o => o.id);
  }

  /* improvement: seeded swap/insert local search, recording the trajectory */
  function improve(sc, seq0, iters) {
    let a = 12345;
    const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    let seq = seq0.slice(), ops = schedule(sc, seq), ev = evaluate(sc, ops);
    const pt = (i, e) => ({ i, obj: e.obj, late: e.late, lateMin: e.lateMin, makespan: e.makespan });
    const traj = [pt(0, ev)];
    for (let i = 1; i <= (iters || 400); i++) {
      const s2 = seq.slice();
      const p = Math.floor(rnd() * s2.length), q = Math.floor(rnd() * s2.length);
      if (p === q) continue;
      if (rnd() < .5) { const t = s2[p]; s2[p] = s2[q]; s2[q] = t; }
      else { const [x] = s2.splice(p, 1); s2.splice(q, 0, x); }
      const o2 = schedule(sc, s2), e2 = evaluate(sc, o2);
      if (e2.obj < ev.obj || (e2.obj === ev.obj && e2.makespan < ev.makespan)) {
        seq = s2; ops = o2; ev = e2; traj.push(pt(i, ev));
      }
    }
    traj.push(pt(iters || 400, ev));
    return { seq, ops, ev, traj };
  }

  /* independent validator — re-derives every constraint from the plan */
  function validate(sc, ops) {
    const res = { 'V-PREC': 0, 'V-CAP': 0, 'V-CAL': 0, 'V-REF': 0, 'V-MAT': 0 };
    const byOrder = {};
    ops.forEach(op => (byOrder[op.order] = byOrder[op.order] || []).push(op));
    Object.values(byOrder).forEach(list => {
      list.sort((x, y) => x.k - y.k);
      for (let i = 1; i < list.length; i++) if (list[i].start < list[i - 1].end - 1e-9) res['V-PREC']++;
    });
    const byRes = {};
    ops.forEach(op => (byRes[op.res] = byRes[op.res] || []).push(op));
    Object.values(byRes).forEach(list => {
      list.sort((x, y) => x.start - y.start);
      for (let i = 1; i < list.length; i++) if (list[i].start < list[i - 1].end - 1e-9) res['V-CAP']++;
    });
    ops.forEach(op => {
      if (sc.blocks.some(b => b.res === op.res && op.start < b.to && op.end > b.from)) res['V-CAL']++;
      const r = sc.resources.find(x => x.id === op.res);
      if (!r || r.kind !== op.kind || !sc.orders.find(o => o.id === op.order)) res['V-REF']++;
      const ord = sc.orders.find(o => o.id === op.order);
      if (op.k === 0 && ord && op.start < (ord.mat || 0)) res['V-MAT']++;
    });
    return res;
  }

  function solve(o) {
    const sc = scenario(o);
    const seq = heuristicSeq(sc);
    const hOps = schedule(sc, seq), hEv = evaluate(sc, hOps);
    const imp = improve(sc, seq, 600);
    return { sc, heuristic: { seq, ops: hOps, ev: hEv }, improved: imp, checks: validate(sc, imp.ops), HORIZON };
  }

  const api = { RESOURCES, ROUTE, HORIZON, scenario, schedule, evaluate, heuristicSeq, improve, validate, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.APS = api;
})(typeof window !== 'undefined' ? window : globalThis);
