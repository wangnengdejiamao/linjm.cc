/* =================================================================
   viz-zte.js — Fig G·2, the A2A trace under the phone demo.

   A live sequence diagram. The phone (js/zte.js) announces every beat
   with a 'zte:beat' CustomEvent; this figure turns each beat into a
   column of typed messages between five lanes (User, Planner, the
   OpenClaw bus, Worker, Device). If the phone is absent it replays a
   copy of the coffee-order script so the plate is never empty.
   ================================================================= */
(function () {
  'use strict';
  const root = document.getElementById('zteLanes');
  if (!root || !window.TV) return;
  const T = window.TV, C = T.C;

  const fig = T.mount(root, {
    domain: 'agent',
    kicker: 'Fig G·2 — A2A trace · Planner ⇄ OpenClaw bus ⇄ Worker',
    status: 'waiting for phone…',
    stack: ['OpenClaw', 'A2A protocol', '4B multimodal planner', '32B GUI-grounding worker (self-trained)',
      'Android accessibility + screenshots', 'human-in-the-loop gate'],
    note: 'Trace mirrors the phone demo above · timings illustrative',
    height: 420,
    controls: false,
    aria: 'Live swimlane trace of messages between user, planner, OpenClaw A2A bus, worker and Android device, following the phone demo above.'
  });
  const ctx = fig.ctx;

  /* ---------------- lanes ---------------- */
  const U = 0, P = 1, B = 2, W = 3, D = 4;
  const LANES = [
    { name: 'User', meta: 'human-in-the-loop', short: 'USR', col: C.ember },
    { name: 'Planner', meta: '4B multimodal', short: 'PLN', col: C.steel },
    { name: 'OpenClaw', meta: 'A2A bus', short: 'BUS', col: C.plum },
    { name: 'Worker', meta: '32B grounding', short: 'WRK', col: C.amber },
    { name: 'Device', meta: 'Android UI', short: 'DEV', col: C.mint }
  ];
  const AGENT_LANE = { human: U, planner: P, worker: W };
  const AGENT_NAME = { human: 'You · gate', planner: 'Planner · 4B', worker: 'Worker · 32B' };

  /* ---------------- fallback script (copy of zte.js coffee beats) ---------------- */
  const FALLBACK = [
    { agent: 'planner', goal: 'perceive screen + app inventory', action: 'observe', conf: null,
      bus: ['planner: screenshot → 8 icons, 4 dock', 'planner: Luckin installed ✓'] },
    { agent: 'planner', goal: 'decompose: 4 sub-goals', action: 'plan', conf: null,
      bus: ['planner: open→pick→cart→pay', 'planner→worker: sub-goal 1'] },
    { agent: 'worker', goal: 'open Luckin', action: 'tap(app: Luckin)', conf: 0.98,
      bus: ['worker: ground(Luckin) → (78, 132)', 'worker→planner: screen = menu'] },
    { agent: 'worker', goal: 'select 生椰拿铁', action: 'tap(item #1)', conf: 0.94,
      bus: ['planner→worker: pick 生椰拿铁', 'worker: tap(0.5, 0.28) conf .94'] },
    { agent: 'worker', goal: 'add to cart', action: 'tap(加入购物车)', conf: 0.96,
      bus: ['worker: tap(加入购物车 ¥18)', 'worker→planner: sheet = 确认订单'] },
    { agent: 'human', goal: 'payment gate — you confirm', action: 'await user', conf: null, hold: true,
      bus: ['policy: spend > 0 → human gate', 'user: confirm ✓'] },
    { agent: 'worker', goal: 'confirm payment', action: 'tap(确认支付)', conf: 0.99,
      bus: ['worker: tap(确认支付 ¥18)', 'worker→planner: 下单成功'] },
    { agent: 'planner', goal: 'verify against goal', action: 'done ✓', conf: null,
      bus: ['planner: 取餐码 A-2417 matches goal', 'planner: task complete ✓'] }
  ];

  /* ---------------- state ---------------- */
  let cols = [], gi = 0;              // visible columns, global column counter
  let camI = 0, headX = 0;
  let now = 0, lastBeatT = -1, lastDur = 2.6;
  let live = false, frozen = false, fbOn = false, fbNext = 0, fbIdx = 0, visT0 = -1;
  let wipe = null, scen = null;
  let curBeat = null, N = 8;
  const counts = [0, 0, 0, 0, 0];
  const laneAct = [0, 0, 0, 0, 0];
  const hits = [];
  let mouse = null, hov = null;
  let hudSig = '', compact = false, mini = false;

  /* ---------------- message construction ---------------- */
  const strip = s => (s || '').replace(/^[^:]*:\s*/, '');
  const pick = (d, re) => d.bus.find(s => re.test(s));
  const sender = { [U]: C.ember, [P]: C.steel, [B]: C.plum, [W]: C.amber, [D]: C.mint };

  function msg(lanes, a, b, label, o) {
    return Object.assign({ kind: 'msg', lanes, a, b, label, color: sender[lanes[0]], side: 0, counted: false }, o || {});
  }
  function note(lane, a, label, cap, o) {
    return Object.assign({ kind: 'note', lanes: [lane], a, b: a + .16, label, cap, color: sender[lane], counted: false }, o || {});
  }

  let lastAmt = '¥18';
  function build(d) {
    const out = [], bus = d.bus || [];
    const amt = /¥\d+/.exec(d.goal + ' ' + bus.join(' '));
    if (amt) lastAmt = amt[0];
    const act = d.action || '';
    if (d.agent === 'worker') {
      const pw = pick(d, /^planner→worker:/), wp = pick(d, /^worker→planner:/);
      const det = bus.filter(s => !/^(planner→worker|worker→planner):/.test(s)).join('  ·  ');
      out.push(msg([P, B, W], .02, .26, pw ? strip(pw) : 'sub-goal · ' + d.goal, { detail: 'planner → worker  ·  ' + (pw ? strip(pw) : d.goal) }));
      out.push(msg([W, D], .30, .50, act, { side: -1, cap: 100, conf: d.conf, detail: act + (det ? '  ·  ' + det : '') }));
      out.push(msg([D, W], .54, .70, 'screen state', { side: 1, cap: 74, detail: 'accessibility tree + screenshot returned to worker' }));
      out.push(msg([W, B, P], .74, .98, wp ? strip(wp) : 'result · ok', { detail: 'worker → planner  ·  ' + (wp ? strip(wp) : 'result ok') }));
    } else if (d.agent === 'human') {
      out.push(note(B, .06, strip(bus[0] || 'policy: spend > 0 → human gate'), .95, { detail: bus[0] }));
      out.push(msg([P, U], .04, .30, 'confirm ' + lastAmt + '?', { side: -1, cap: 118, gate: true, detail: 'planner asks the user before any spend' }));
      out.push(msg([U, P], .68, .94, strip(bus[1] || 'confirm ✓'), { side: 1, cap: 100, detail: 'user approves; trace resumes' }));
    } else if (act === 'observe') {
      const sc = pick(d, /screenshot/);
      out.push(msg([D, B, P], .03, .50, sc ? strip(sc) : 'screenshot + app inventory', { detail: 'device → planner  ·  ' + (sc || '') }));
      const rest = bus.filter(s => s !== sc)[0];
      if (rest) out.push(note(P, .6, strip(rest), .38, { detail: rest }));
    } else if (act === 'plan') {
      out.push(note(P, .03, strip(bus[0] || 'plan'), .44, { detail: bus[0] }));
      const pw = pick(d, /^planner→worker:/);
      out.push(msg([P, B, W], .50, .97, pw ? strip(pw) : 'sub-goal 1', { below: true, detail: pw }));
    } else if (/^done/.test(act)) {
      out.push(note(P, .03, strip(bus[0] || 'verify'), .44, { detail: bus[0] }));
      out.push(msg([P, U], .50, .97, strip(bus[1] || 'task complete ✓'), { side: 1, cap: 100, done: true, detail: 'planner → user  ·  ' + strip(bus[1]) }));
    } else if (/^swipe/.test(act)) {
      out.push(msg([P, B, W], .02, .30, strip(bus[0] || 'hand-off'), { detail: bus.join('  ·  ') }));
      out.push(msg([W, D], .36, .62, act, { side: -1, cap: 100, detail: bus[1] }));
      out.push(msg([D, W], .66, .98, 'screen state', { side: 1, cap: 74 }));
    } else {
      out.push(note(P, .05, strip(bus[0] || d.goal), .8, { detail: bus.join('  ·  ') }));
    }
    return out;
  }

  /* ---------------- column lifecycle ---------------- */
  function resetCounts() { for (let i = 0; i < 5; i++) counts[i] = 0; }

  function pushBeat(d, delay) {
    const prev = cols[cols.length - 1];
    if (prev) prev.done = true;
    const base = d.hold ? 1.5 : 1;
    if (lastBeatT >= 0 && !fbOn) lastDur = T.clamp((now - lastBeatT) / (prev && prev.hold ? 1.5 : 1), .8, 6);
    if (fbOn) lastDur = 2.6;
    lastBeatT = now;
    cols.push({
      i: gi++, step: d.step, n: d.n, agent: d.agent, goal: d.goal, action: d.action, conf: d.conf,
      hold: !!d.hold, t0: now + (delay || 0), dur: lastDur * base, done: false, msgs: build(d)
    });
    if (cols.length > 12) cols.shift();
    curBeat = d; N = d.n || N;
    hudSig = '';
    if (T.REDUCE) { cols.forEach(c => { c.done = true; }); }
  }

  function startWipe() {
    if (cols.length) {
      wipe = { t0: now, old: cols, cam: camI, cur: cols[cols.length - 1].i };
      wipe.old.forEach(c => { c.done = true; });
    }
    cols = []; gi = 0; camI = 0; lastBeatT = -1; resetCounts();
  }

  function onBeat(d) {
    if (frozen) return;
    if (!live) { live = true; fbOn = false; fig.setStatus('live · following phone'); startWipe(); wipe && (wipe.force = true); }
    const newRun = d.step === 0 || (scen !== null && d.scenario !== scen);
    scen = d.scenario;
    if (newRun && cols.length && !(wipe && wipe.t0 === now)) startWipe();
    pushBeat(d, wipe ? .45 : 0);
    if (T.REDUCE) loop.redraw();
  }
  document.addEventListener('zte:beat', e => { if (e.detail) onBeat(e.detail); });

  function fbStep() {
    const idx = fbIdx % FALLBACK.length;
    if (idx === 0 && cols.length) startWipe();
    const d = Object.assign({ scenario: 'coffee', step: idx, n: FALLBACK.length }, FALLBACK[idx]);
    pushBeat(d, wipe ? .45 : 0);
    fbIdx++;
    fbNext = now + (d.hold ? 3.9 : 2.6) + (wipe ? .45 : 0);
  }

  /* ---------------- geometry ---------------- */
  let gutter = 176, COLW = 230, top = 56, gap = 80, laneY = [0, 0, 0, 0, 0];
  function layout(w, h) {
    compact = w < 640;
    gutter = compact ? 46 : 176;
    top = compact ? 46 : 54;
    gap = (h - top - 26) / 4;
    for (let i = 0; i < 5; i++) laneY[i] = top + i * gap;
    const plotW = w - gutter;
    COLW = compact ? 168 : T.clamp(plotW / 4.1, 168, 236);
    headX = compact ? gutter + plotW * .5 : gutter + plotW * .54;
    mini = w < 900;
    root.classList.toggle('zl-c', compact);
    root.classList.toggle('zl-m', mini);
  }

  /* ---------------- path helpers ---------------- */
  function cubic(p0, p1, u) {
    const dx = (p1.x - p0.x) * .5, v = 1 - u;
    const c1x = p0.x + dx, c2x = p1.x - dx;
    return {
      x: v * v * v * p0.x + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * p1.x,
      y: v * v * v * p0.y + 3 * v * v * u * p0.y + 3 * v * u * u * p1.y + u * u * u * p1.y
    };
  }
  function pathPt(pts, u) {
    const n = pts.length - 1;
    const s = Math.min(n - 1, Math.floor(u * n)), l = u * n - s;
    return cubic(pts[s], pts[s + 1], T.clamp(l, 0, 1));
  }
  function strokePath(pts, prog) {
    const n = pts.length - 1, steps = Math.max(2, Math.ceil(n * 16 * prog));
    ctx.beginPath();
    for (let k = 0; k <= steps; k++) {
      const p = pathPt(pts, prog * k / steps);
      k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }
  function arrow(pts, prog, color, a) {
    const p1 = pathPt(pts, prog), p0 = pathPt(pts, Math.max(0, prog - .035));
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x), s = 5.2;
    ctx.save();
    ctx.translate(p1.x, p1.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-s, -s * .62); ctx.lineTo(-s * .55, 0); ctx.lineTo(-s, s * .62); ctx.closePath();
    ctx.fillStyle = T.rgba(color, a); ctx.fill();
    ctx.restore();
  }

  /* ---------------- text pills ---------------- */
  function ell(s, maxW) {
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function pill(text, x, y, align, color, alpha, maxW, detail, emph) {
    ctx.font = T.font(10, emph ? 500 : 400);
    const s = ell(text, maxW), tw = ctx.measureText(s).width, px = 6, ph = 17;
    const x0 = align === 'c' ? x - tw / 2 - px : align === 'r' ? x - tw - px : x - px;
    ctx.save();
    ctx.globalAlpha *= 1;
    T.rrect(ctx, x0, y - ph / 2, tw + px * 2, ph, 5);
    ctx.fillStyle = 'rgba(15,13,10,.9)'; ctx.fill();
    ctx.strokeStyle = T.rgba(color, .26 + .34 * alpha); ctx.lineWidth = 1; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = emph ? C.ink : C.soft;
    ctx.fillText(s, x0 + px, y + .5);
    ctx.restore();
    if (alpha > .3) hits.push({ x: x0, y: y - ph / 2, w: tw + px * 2, h: ph, text: detail || text, full: text });
    return tw;
  }

  /* ---------------- column drawing ---------------- */
  function drawMsg(m, col, left, pcol, ca, newest, w) {
    const mp = T.clamp((pcol - m.a) / (m.b - m.a), 0, 1);
    if (mp <= 0 && !(m.kind === 'note' && pcol >= m.a)) return false;
    if (!m.counted && newest && pcol >= m.a) {
      m.counted = true;
      if (m.lanes.length > 1) m.lanes.forEach(l => counts[l]++); else counts[m.lanes[0]]++;
    }
    const x0 = left + m.a * COLW, x1 = left + m.b * COLW;
    if (m.kind === 'note') {
      const y = laneY[m.lanes[0]], k = T.ease.out(T.clamp((pcol - m.a) / .1, 0, 1));
      ctx.save(); ctx.globalAlpha = ca * k;
      ctx.strokeStyle = T.rgba(m.color, .6); ctx.lineWidth = 1;
      const sg = m.below ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0, y + sg * 9); ctx.stroke();
      T.node(ctx, x0, y, 3.2, m.color, { active: newest && pcol < m.b + .1, core: false });
      pill(m.label, x0 - 3, y + sg * 17, 'l', m.color, ca, Math.max(60, m.cap * COLW), m.detail || m.label, false);
      ctx.restore();
      return newest && pcol < m.b + .1 ? m.lanes[0] : -1;
    }
    const pts = [];
    const n = m.lanes.length;
    for (let k = 0; k < n; k++) pts.push({ x: x0 + (x1 - x0) * k / (n - 1), y: laneY[m.lanes[k]] });
    const prog = T.ease.out(mp), inflight = newest && mp < 1;
    ctx.save();
    ctx.globalAlpha = ca;
    ctx.lineCap = 'round';
    ctx.strokeStyle = T.rgba(m.color, inflight ? .95 : newest ? .8 : .62);
    ctx.lineWidth = inflight ? 1.9 : 1.4;
    if (m.gate) ctx.setLineDash([5, 4]);
    strokePath(pts, prog);
    ctx.setLineDash([]);
    if (inflight) {
      const g = ctx.globalAlpha;
      T.flow(ctx, u => pathPt(pts, u * prog), now, { n: 2, speed: 1.1, color: m.color, size: 2.2 });
      ctx.globalAlpha = g;
    }
    // endpoints
    const tail = pathPt(pts, 0);
    T.node(ctx, tail.x, tail.y, 2.8, m.color, { active: inflight, core: false, level: .5 });
    if (prog > .985) {
      arrow(pts, 1, m.color, .95);
      const hd = pts[n - 1];
      T.node(ctx, hd.x, hd.y, 3.2, m.color, { active: newest && mp >= 1 && pcol - m.b < .12, core: false, level: .6 });
    } else if (prog > .02) arrow(pts, prog, m.color, .95);
    // bus crossing
    if (n === 3) {
      const bp = pts[1];
      if (mp > .5) {
        const fl = T.clamp((mp - .5) / .4, 0, 1);
        ctx.save();
        ctx.translate(bp.x, bp.y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = T.rgba(C.plum, .9); ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
        if (fl < 1 && newest) {
          ctx.strokeStyle = T.rgba(C.plum, .6 * (1 - fl)); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(bp.x, bp.y, 5 + fl * 16, 0, T.TAU); ctx.stroke();
        }
      }
      if (mp > .45) {
        const down = (laneY[m.lanes[2]] > laneY[m.lanes[0]]) !== !!m.below;
        ctx.globalAlpha = ca * T.clamp((mp - .45) / .15, 0, 1);
        pill(m.label, bp.x, bp.y + (down ? -13 : 13), 'c', m.color, ca, compact ? 112 : 160, m.detail || m.label, newest);
      }
    } else if (mp > .45) {
      const mid = pathPt(pts, .5), side = m.side || 1;
      ctx.globalAlpha = ca * T.clamp((mp - .45) / .15, 0, 1);
      if (!(compact && m.lanes[0] === D)) {
        pill(m.label, mid.x + side * 9, mid.y, side < 0 ? 'r' : 'l', m.color, ca, (m.cap || 110) * (compact ? .8 : 1), m.detail || m.label, newest && !!m.done);
      }
    }
    // confidence badge on worker actions
    if (m.conf != null && mp > .1) {
      const bx = x0 - 8, by = laneY[W] + 13, bw = compact ? 26 : 34;
      ctx.globalAlpha = ca * T.clamp((mp - .1) / .25, 0, 1);
      ctx.font = T.font(10, 500); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink; ctx.fillText(m.conf.toFixed(2), bx, by);
      const tw = ctx.measureText(m.conf.toFixed(2)).width;
      const rx = bx - tw - 6 - bw;
      T.rrect(ctx, rx, by - 2, bw, 4, 2); ctx.fillStyle = 'rgba(236,224,200,.12)'; ctx.fill();
      T.rrect(ctx, rx, by - 2, Math.max(3, bw * m.conf * T.ease.out(T.clamp((mp - .1) / .5, 0, 1))), 4, 2);
      ctx.fillStyle = m.conf > .95 ? C.mint : C.amber; ctx.fill();
    }
    ctx.restore();
    // gate marker at the user lane
    if (m.gate && mp > .8) gateMarker(x1, laneY[U], ca, newest);
    return inflight ? m.lanes : -1;
  }

  function gateMarker(x, y, ca, newest) {
    ctx.save();
    ctx.globalAlpha = ca;
    const r = 11, pulse = newest ? .5 + .5 * Math.sin(now * 4) : 0;
    T.glow(ctx, x, y, 30 + 6 * pulse, C.ember, newest ? .35 : .15);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#1a120c'; ctx.fill();
    ctx.strokeStyle = C.ember; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.fillStyle = C.ember;
    ctx.fillRect(x - 3.5, y - 4.5, 2.6, 9); ctx.fillRect(x + .9, y - 4.5, 2.6, 9);
    if (newest) {
      ctx.strokeStyle = T.rgba(C.ember, .45 * (1 - pulse)); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 4 + pulse * 10, 0, T.TAU); ctx.stroke();
    }
    ctx.font = T.font(9.5, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ember; ctx.fillText('GATE', x + r + 7, y);
    ctx.restore();
  }

  function drawCols(list, cam, cur, live2) {
    const h = fig.h;
    const last = list.length ? list[list.length - 1] : null;
    laneAct.forEach((_, i) => { laneAct[i] *= 1; });
    const act = [0, 0, 0, 0, 0];
    for (let c = 0; c < list.length; c++) {
      const col = list[c], newest = col === last && live2;
      const cx = headX + (col.i - cam) * COLW, left = cx - COLW / 2;
      if (left > fig.w + 10 || left + COLW < gutter - 10) continue;
      const age = cur - col.i, ca = newest ? 1 : T.clamp(1 - age * .2, .3, .9);
      const pc = col.done ? 1 : T.clamp((now - col.t0) / col.dur, 0, 1);
      const waiting = !col.done && now < col.t0;
      // band
      T.rrect(ctx, left + 3, 8, COLW - 6, h - 16, 10);
      ctx.fillStyle = newest ? 'rgba(192,138,192,.055)' : 'rgba(236,224,200,.016)'; ctx.fill();
      ctx.strokeStyle = newest ? T.rgba(C.plum, .28) : C.line2; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); ctx.globalAlpha = ca;
      // header
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = T.font(10, 500);
      const ac = col.agent === 'worker' ? C.amber : col.agent === 'human' ? C.ember : C.steel;
      const sn = String(col.step + 1).padStart(2, '0');
      ctx.fillStyle = ac; ctx.fillText(sn, left + 11, 22);
      ctx.font = T.font(10, 400); ctx.fillStyle = newest ? C.soft : C.dim;
      ctx.fillText(ell(col.goal, COLW - 44), left + 31, 22);
      ctx.restore();
      if (waiting) continue;
      // gate band
      if (col.hold) {
        const gx0 = left + .31 * COLW, gx1 = left + .67 * COLW, gt = laneY[U] + 14, gb = laneY[D] + 10;
        ctx.save(); ctx.globalAlpha = ca * T.clamp((pc - .3) / .1, 0, 1);
        ctx.beginPath(); ctx.rect(gx0, gt, gx1 - gx0, gb - gt); ctx.clip();
        ctx.fillStyle = T.rgba(C.ember, .05); ctx.fillRect(gx0, gt, gx1 - gx0, gb - gt);
        ctx.strokeStyle = T.rgba(C.ember, .16); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = gx0 - (gb - gt); x < gx1; x += 9) { ctx.moveTo(x, gb); ctx.lineTo(x + (gb - gt), gt); }
        ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.globalAlpha = ca * T.clamp((pc - .35) / .1, 0, 1);
        ctx.strokeStyle = T.rgba(C.ember, .5); ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(gx0, gt); ctx.lineTo(gx0, gb); ctx.moveTo(gx1, gt); ctx.lineTo(gx1, gb); ctx.stroke();
        ctx.setLineDash([]);
        if (!compact) {
          ctx.font = T.font(9.5, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = T.rgba(C.ember, .85);
          ctx.fillText('trace paused', (gx0 + gx1) / 2, (laneY[U] + laneY[P]) / 2 - 4);
          ctx.fillStyle = T.rgba(C.ember, .55);
          ctx.fillText('waiting for human', (gx0 + gx1) / 2, (laneY[U] + laneY[P]) / 2 + 10);
        }
        ctx.restore();
      }
      for (let k = 0; k < col.msgs.length; k++) {
        const r = drawMsg(col.msgs[k], col, left, pc, ca, newest, fig.w);
        if (newest && r !== false && r !== -1) { if (Array.isArray(r)) r.forEach(l => { act[l] = 1; }); else act[r] = 1; }
      }
      // cursor
      if (newest && pc < 1 && !frozen) {
        const gate = col.hold && pc > .3 && pc < .67;
        const x = left + pc * COLW, col2 = gate ? C.ember : C.plum;
        const g = ctx.createLinearGradient(0, 14, 0, h - 10);
        g.addColorStop(0, T.rgba(col2, 0)); g.addColorStop(.5, T.rgba(col2, gate && Math.sin(now * 10) > 0 ? .1 : .55)); g.addColorStop(1, T.rgba(col2, 0));
        ctx.fillStyle = g; ctx.fillRect(x - .5, 14, 1, h - 24);
      }
    }
    return act;
  }

  /* ---------------- lane chrome ---------------- */
  function icon(i, cx, cy, col, a) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = T.rgba(col, a); ctx.fillStyle = T.rgba(col, a);
    ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (i === U) {
      ctx.arc(0, -4, 3.4, 0, T.TAU); ctx.moveTo(-6.5, 8); ctx.arc(0, 8, 6.5, Math.PI, T.TAU);
    } else if (i === P) {
      ctx.moveTo(0, -5); ctx.lineTo(-6, 5); ctx.moveTo(0, -5); ctx.lineTo(6, 5); ctx.moveTo(-6, 5); ctx.lineTo(6, 5);
      ctx.stroke();
      [[0, -5], [-6, 5], [6, 5]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, T.TAU); ctx.fill(); });
      ctx.restore(); return;
    } else if (i === B) {
      ctx.moveTo(-8, -3.5); ctx.lineTo(8, -3.5); ctx.moveTo(4.5, -7); ctx.lineTo(8, -3.5); ctx.lineTo(4.5, 0);
      ctx.moveTo(8, 3.5); ctx.lineTo(-8, 3.5); ctx.moveTo(-4.5, 0); ctx.lineTo(-8, 3.5); ctx.lineTo(-4.5, 7);
    } else if (i === W) {
      ctx.arc(0, 0, 6, 0, T.TAU);
      ctx.moveTo(0, -9); ctx.lineTo(0, -3.5); ctx.moveTo(0, 9); ctx.lineTo(0, 3.5);
      ctx.moveTo(-9, 0); ctx.lineTo(-3.5, 0); ctx.moveTo(9, 0); ctx.lineTo(3.5, 0);
    } else {
      T.rrect(ctx, -5.5, -8.5, 11, 17, 2.6);
      ctx.moveTo(-1.8, 5.6); ctx.lineTo(1.8, 5.6);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLanes(w, h) {
    for (let i = 0; i < 5; i++) {
      const y = laneY[i], L = LANES[i], a = laneAct[i];
      if (a > .02) {
        const g = ctx.createLinearGradient(0, y - gap * .4, 0, y + gap * .4);
        g.addColorStop(0, T.rgba(L.col, 0)); g.addColorStop(.5, T.rgba(L.col, .07 * a)); g.addColorStop(1, T.rgba(L.col, 0));
        ctx.fillStyle = g; ctx.fillRect(gutter, y - gap * .4, w - gutter, gap * .8);
      }
      if (i === B) {
        // the bus: a double rail with moving ticks
        ctx.strokeStyle = T.rgba(C.plum, .2 + .2 * a); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gutter, y - 3); ctx.lineTo(w, y - 3); ctx.moveTo(gutter, y + 3); ctx.lineTo(w, y + 3); ctx.stroke();
        ctx.fillStyle = T.rgba(C.plum, .16 + .12 * a);
        const off = ((-camI * COLW) % 16 + 16) % 16;
        for (let x = gutter + off; x < w; x += 16) ctx.fillRect(x, y - 1, 6, 2);
      } else {
        ctx.strokeStyle = T.rgba(L.col, .12 + .22 * a); ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(gutter, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawGutter(w, h) {
    ctx.fillStyle = 'rgba(15,13,10,.94)'; ctx.fillRect(0, 0, gutter, h);
    const g = ctx.createLinearGradient(gutter, 0, gutter + 26, 0);
    g.addColorStop(0, 'rgba(15,13,10,.94)'); g.addColorStop(1, 'rgba(15,13,10,0)');
    ctx.fillStyle = g; ctx.fillRect(gutter, 0, 26, h);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gutter - .5, 10); ctx.lineTo(gutter - .5, h - 10); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const L = LANES[i], y = laneY[i], a = laneAct[i];
      if (a > .02) T.glow(ctx, compact ? gutter / 2 : 26, y, 30, L.col, .22 * a);
      icon(i, compact ? gutter / 2 : 26, compact ? y - 4 : y, L.col, .55 + .45 * a);
      ctx.textBaseline = 'middle';
      if (compact) {
        ctx.font = T.font(9.5, 500); ctx.textAlign = 'center';
        ctx.fillStyle = T.rgba(L.col, .6 + .4 * a); ctx.fillText(L.short, gutter / 2, y + 14);
      } else {
        ctx.textAlign = 'left';
        ctx.font = T.font(12.5, 600, 'sans'); ctx.fillStyle = a > .4 ? C.ink : C.soft;
        ctx.fillText(L.name, 48, y - 7);
        ctx.font = T.font(10, 400); ctx.fillStyle = T.rgba(L.col, .6 + .35 * a);
        ctx.fillText(L.meta, 48, y + 9);
      }
    }
  }

  /* ---------------- HUD ---------------- */
  const hud = document.createElement('div');
  hud.className = 'tv-panel zl-hud';
  hud.innerHTML = '<div class="zl-top"><h5>Trace · illustrative</h5><button type="button" class="tv-btn zl-tog" aria-pressed="false"></button></div>' +
    '<div class="zl-ro"></div><div class="zl-cnt"></div>';
  fig.hud.append(hud);
  const roEl = hud.querySelector('.zl-ro'), cntEl = hud.querySelector('.zl-cnt'), tog = hud.querySelector('.zl-tog');
  const st = document.createElement('style');
  st.id = 'zl-style';
  st.textContent = '#zteLanes .zl-hud{right:12px;top:10px;min-width:206px;padding:.55rem .75rem .6rem}' +
    '#zteLanes .zl-top{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-bottom:.35rem}' +
    '#zteLanes .zl-top h5{margin:0}' +
    '#zteLanes .zl-tog{padding:.2rem .55rem;font-size:.62rem}' +
    '#zteLanes .zl-cnt{display:grid;grid-template-columns:repeat(5,1fr);gap:.25rem;margin-top:.45rem;padding-top:.45rem;border-top:1px dashed rgba(236,224,200,.1)}' +
    '#zteLanes .zl-cnt span{display:flex;flex-direction:column;align-items:center;font-size:.55rem;letter-spacing:.08em;color:#958c77}' +
    '#zteLanes .zl-cnt b{font-weight:500;font-size:.8rem;color:#f4eee2;font-variant-numeric:tabular-nums}' +
    '#zteLanes.zl-m .zl-hud{right:8px;top:auto;bottom:8px;min-width:0;padding:.3rem .45rem}' +
    '#zteLanes.zl-m .zl-ro,#zteLanes.zl-m .zl-cnt{display:none}' +
    '#zteLanes.zl-m .zl-top{margin:0}' +
    '#zteLanes.zl-c .zl-top h5{display:none}';
  document.head.append(st);
  tog.addEventListener('click', () => {
    frozen = !frozen;
    if (!frozen && live) { /* resume: next beat re-syncs */ }
    fig.setStatus(frozen ? 'frozen · trace paused' : live ? 'live · following phone' : 'scripted · phone not detected');
    hudSig = '';
  });

  function hudUpdate() {
    const sig = [curBeat ? curBeat.step : -1, N, frozen, counts.join(','), lastDur.toFixed(1), live, mini].join('|');
    if (sig === hudSig) return;
    hudSig = sig;
    tog.textContent = frozen ? 'Follow phone' : 'Freeze';
    tog.classList.toggle('is-on', frozen);
    tog.setAttribute('aria-pressed', String(frozen));
    if (mini) hud.querySelector('h5').textContent = curBeat ? (curBeat.step + 1) + ' / ' + N + ' · ' + (AGENT_NAME[curBeat.agent] || '') : '— / —';
    else hud.querySelector('h5').textContent = 'Trace · illustrative';
    if (compact) tog.textContent = frozen ? 'Follow' : 'Freeze';
    const b = curBeat;
    T.readout(roEl, [
      ['step', b ? (b.step + 1) + ' / ' + N : '— / —'],
      ['active', b ? AGENT_NAME[b.agent] || b.agent : '—', b && b.agent === 'human' ? 'bad' : b && b.agent === 'worker' ? 'warn' : ''],
      ['budget', '≈ ' + lastDur.toFixed(1) + ' s / step'],
      ['source', live ? 'phone demo' : 'scripted copy']
    ]);
    cntEl.innerHTML = '';
    LANES.forEach((L, i) => {
      const s = document.createElement('span');
      s.style.color = L.col;
      s.innerHTML = L.short + '<b>' + counts[i] + '</b>';
      cntEl.append(s);
    });
  }

  /* ---------------- pointer ---------------- */
  T.pointer(fig.canvas, {
    move(x, y) { mouse = { x, y }; },
    leave() { mouse = null; hov = null; }
  });

  /* ---------------- frame ---------------- */
  function draw(t, dt) {
    const w = fig.w, h = fig.h;
    now = t;
    layout(w, h);
    if (visT0 < 0) visT0 = t;
    // fallback
    if (!live && !frozen) {
      if (!fbOn && t - visT0 > (document.getElementById('zteScreen') ? 4 : 1.5)) { fbOn = true; fbNext = t; fig.setStatus('scripted · phone not detected'); }
      if (fbOn && t >= fbNext) fbStep();
    }
    // camera
    const lastI = cols.length ? cols[cols.length - 1].i : 0;
    if (!frozen || T.REDUCE) {
      const k = dt ? 1 - Math.exp(-dt * 5) : 1;
      camI += (lastI - camI) * (T.REDUCE ? 1 : k);
    }
    if (T.REDUCE && !cols.length) { for (let i = 0; i < 6; i++) { fbOn = true; fbStep(); } cols.forEach(c => { c.done = true; }); camI = cols[cols.length - 1].i; }

    T.bg(ctx, w, h, { tint: C.plum, tx: .85, ty: .1, grid: 24 });
    hits.length = 0;
    drawLanes(w, h);

    ctx.save();
    let act;
    if (wipe) {
      const k = T.clamp((t - wipe.t0) / .9, 0, 1), sx = T.lerp(gutter - 10, w + 30, T.ease.inOut(k));
      ctx.save(); ctx.beginPath(); ctx.rect(gutter, 0, Math.max(0, sx - gutter), h); ctx.clip();
      act = drawCols(cols, camI, lastI, true);
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, w - sx, h); ctx.clip();
      ctx.save(); ctx.globalAlpha = 1 - k * .6;
      drawCols(wipe.old, wipe.cam, wipe.cur, false);
      ctx.restore();
      ctx.restore();
      // sweep bar
      const g = ctx.createLinearGradient(sx - 90, 0, sx, 0);
      g.addColorStop(0, T.rgba(C.plum, 0)); g.addColorStop(1, T.rgba(C.plum, .24));
      ctx.fillStyle = g; ctx.fillRect(sx - 90, 0, 90, h);
      ctx.fillStyle = T.rgba('#fff3f8', .75); ctx.fillRect(sx - .5, 10, 1, h - 20);
      T.glow(ctx, sx, h / 2, 90, C.plum, .12);
      ctx.font = T.font(9.5, 500); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = T.rgba(C.plum, .9 * (1 - k)); ctx.fillText('new run', sx - 8, 36);
      if (k >= 1) wipe = null;
    } else {
      ctx.beginPath(); ctx.rect(gutter, 0, w - gutter, h); ctx.clip();
      act = drawCols(cols, camI, lastI, true);
    }
    ctx.restore();

    for (let i = 0; i < 5; i++) {
      const tgt = act && act[i] ? 1 : 0;
      laneAct[i] += (tgt - laneAct[i]) * (dt ? 1 - Math.exp(-dt * 7) : 1);
    }
    // active lane follows the beat's agent even between messages
    if (curBeat && AGENT_LANE[curBeat.agent] != null) {
      const l = AGENT_LANE[curBeat.agent];
      laneAct[l] = Math.max(laneAct[l], .4);
    }
    drawGutter(w, h);

    // empty state
    if (!cols.length && !wipe) {
      ctx.font = T.font(11, 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.dim; ctx.fillText('waiting for first beat…', gutter + (w - gutter) / 2, h / 2);
    }

    // tooltip
    hov = null;
    if (mouse) {
      for (let i = hits.length - 1; i >= 0; i--) {
        const r = hits[i];
        if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) { hov = r; break; }
      }
      if (hov) {
        ctx.font = T.font(10.5, 400);
        const txt = ell(hov.text, Math.min(w - 24, 420)), tw = ctx.measureText(txt).width;
        const tx = T.clamp(hov.x + hov.w / 2 - tw / 2 - 8, 8, w - tw - 24), ty = hov.y + hov.h + 14 > h - 8 ? hov.y - 16 : hov.y + hov.h + 14;
        ctx.save();
        T.rrect(ctx, tx, ty - 11, tw + 16, 22, 6);
        ctx.fillStyle = 'rgba(24,20,15,.97)'; ctx.fill();
        ctx.strokeStyle = T.rgba(C.plum, .6); ctx.lineWidth = 1; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
        ctx.fillText(txt, tx + 8, ty + .5);
        ctx.restore();
        fig.canvas.style.cursor = 'help';
      } else fig.canvas.style.cursor = '';
    }
    hudUpdate();
  }

  const loop = T.run(fig, { draw, still: 6 });
})();
