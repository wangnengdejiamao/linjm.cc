/* =================================================================
   Astro Agent — auditable LangGraph research pipeline (schematic).
   My open-source AI project: a state machine that resolves a target,
   pulls multi-survey data, models it through THREE mandatory iterations
   (baseline -> residuals -> systematics), audits every claim against the
   evidence, and only when the QA gate clears drafts an ApJ-style paper
   with peer-review notes. The two self-healing loops are the point:
     - qa_gate  -> structure_planner   (model-mismatch REPLAN, capped at 2)
     - paper_qc -> drafter             (QC-driven REFLEXION, capped at 2)
   and an evidence gate that HALTS rather than publish under-supported claims.
   This canvas animates a run flowing through that graph. Schematic node
   layout; the node names mirror the real analysis_agent graph.
   ================================================================= */
(function () {
  const canvas = document.getElementById('agentCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const elNode   = document.getElementById('agNode');
  const elStage  = document.getElementById('agStage');
  const elIter   = document.getElementById('agIter');
  const elStatus = document.getElementById('agStatus');
  const elSpeed  = document.getElementById('agSpeed');
  const elPause  = document.getElementById('agPause');
  const elStep   = document.getElementById('agStep');
  const elLog    = document.getElementById('agLog');
  const chips    = document.querySelectorAll('[data-scenario]');

  // ---- node graph: serpentine 4×3 grid (every step is grid-adjacent) ----
  const COLS = 4, ROWS = 3;
  const NODE = {
    resolve:          { c:0, r:0, label:'resolve',     kind:'io'    },
    data_fetch:       { c:1, r:0, label:'data fetch',  kind:'io'    },
    structure_planner:{ c:2, r:0, label:'planner',     kind:'plan'  },
    retrieval:        { c:3, r:0, label:'RAG / KG',    kind:'plan'  },
    source_research:  { c:3, r:1, label:'evidence',    kind:'gate'  },
    model_iter:       { c:2, r:1, label:'iterate ×3',  kind:'model' },
    model_supervisor: { c:1, r:1, label:'supervisor',  kind:'model' },
    qa_gate:          { c:0, r:1, label:'QA gate',     kind:'dec'   },
    drafter:          { c:0, r:2, label:'drafter',     kind:'draft' },
    paper_qc:         { c:1, r:2, label:'paper QC',    kind:'dec'   },
    peer_review:      { c:2, r:2, label:'peer review', kind:'done'  },
    abnormal:         { c:3, r:2, label:'halted',      kind:'abort' }
  };
  const MAIN = ['resolve','data_fetch','structure_planner','retrieval','source_research',
    'model_iter','model_supervisor','qa_gate','drafter','paper_qc','peer_review'];
  // curved / branch edges drawn on top of the straight main chain
  const LOOPS = [
    { from:'qa_gate',         to:'structure_planner', kind:'replan'    },
    { from:'paper_qc',        to:'drafter',           kind:'reflexion' },
    { from:'source_research', to:'abnormal',          kind:'blocked'   }
  ];

  const KIND_COLOR = {
    io:'#7088e0', plan:'#52a8cb', gate:'#3bb07e', model:'#2bab9b',
    dec:'#e0975a', draft:'#9a7adf', done:'#3bb07e', abort:'#e07145'
  };
  const STAGE = {
    resolve:'Acquire', data_fetch:'Acquire',
    structure_planner:'Plan & retrieve', retrieval:'Plan & retrieve', source_research:'Plan & retrieve',
    model_iter:'Model & audit', model_supervisor:'Model & audit',
    qa_gate:'QA gate', drafter:'Draft & QC', paper_qc:'Draft & QC',
    peer_review:'Peer review', abnormal:'Halted'
  };
  const DETAIL = {
    resolve:'SIMBAD cross-id  name ↔ RA/Dec',
    data_fetch:'20+ survey clients → run_summary.json',
    structure_planner:'route by class → modelling branch',
    retrieval:'BM25 + rule-tags + KG method transfer',
    source_research:'evidence pack: which claims are supported',
    model_iter:'baseline → residuals → systematics',
    model_supervisor:'audit residuals, emit repair actions',
    qa_gate:'clear_for_draft?',
    drafter:'PaperOrchestra 5-agent → aastex LaTeX',
    paper_qc:'ApJ checklist: tables · units · citations',
    peer_review:'4 scientific-question review notes',
    abnormal:'insufficient evidence — no paper emitted'
  };

  // ordered run sequences (loop-backs written out explicitly)
  const head   = ['resolve','data_fetch','structure_planner','retrieval','source_research',
                  'model_iter','model_iter','model_iter','model_supervisor','qa_gate'];
  const finish = ['drafter','paper_qc','peer_review'];
  const SCENARIOS = {
    clear:     [...head, ...finish],
    mismatch:  [...head, 'structure_planner','retrieval','source_research',
                'model_iter','model_iter','model_iter','model_supervisor','qa_gate', ...finish],
    reflexion: [...head, 'drafter','paper_qc','drafter','paper_qc','peer_review'],
    blocked:   ['resolve','data_fetch','structure_planner','retrieval','source_research','abnormal']
  };

  let scenario = 'clear', seq = SCENARIOS.clear;
  let idx = 0, p = 0, iter = 0, line = 0;
  let speed = +elSpeed.value, paused = false;
  let W = 0, H = 0, visible = true, raf = 0, timer = 0, last = 0;
  let T = 0, holdUntil = -1;
  const visited = new Set();

  function pos(key) {
    const n = NODE[key];
    const padX = W * 0.11, padY = H * 0.15;
    const gx = (W - 2 * padX) / (COLS - 1);
    const gy = (H - 2 * padY) / (ROWS - 1);
    return { x: padX + n.c * gx, y: padY + n.r * gy };
  }
  function box() {
    const padX = W * 0.11, padY = H * 0.15;
    const gx = (W - 2 * padX) / (COLS - 1);
    const gy = (H - 2 * padY) / (ROWS - 1);
    return { w: Math.min(gx * 0.78, 124), h: Math.min(gy * 0.52, 50) };
  }

  // path a travelling pulse follows from one node to the next
  function pathPoint(fromKey, toKey, t) {
    const a = pos(fromKey), b = pos(toKey);
    const lp = LOOPS.find(l => l.from === fromKey && l.to === toKey);
    if (lp && lp.kind === 'replan') {           // big arc over the top
      const cx = (a.x + b.x) / 2, cy = H * 0.03;
      return bez(a, { x: cx, y: cy }, b, t);
    }
    if (lp && lp.kind === 'reflexion') {         // small bow below
      const cx = (a.x + b.x) / 2, cy = a.y + H * 0.17;
      return bez(a, { x: cx, y: cy }, b, t);
    }
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function bez(a, c, b, t) {
    const it = 1 - t;
    return {
      x: it * it * a.x + 2 * it * t * c.x + t * t * b.x,
      y: it * it * a.y + 2 * it * t * c.y + t * t * b.y
    };
  }

  // ---- drawing ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function arrow(a, b, color) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang - 0.4) * 8, b.y - Math.sin(ang - 0.4) * 8);
    ctx.lineTo(b.x - Math.cos(ang + 0.4) * 8, b.y - Math.sin(ang + 0.4) * 8);
    ctx.closePath();
    ctx.fill();
  }
  function trimToBox(from, to, bw, bh) {
    // shorten a centre-to-centre segment so it stops at the node border
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const tx = Math.abs(ux) > 1e-3 ? (bw / 2) / Math.abs(ux) : 1e9;
    const ty = Math.abs(uy) > 1e-3 ? (bh / 2) / Math.abs(uy) : 1e9;
    const cut = Math.min(tx, ty) + 4;
    return {
      a: { x: from.x + ux * cut, y: from.y + uy * cut },
      b: { x: to.x - ux * cut, y: to.y - uy * cut }
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const b = box();
    const curFrom = seq[idx], curTo = seq[Math.min(idx + 1, seq.length - 1)];

    // straight main edges
    ctx.lineWidth = 1.6;
    for (let i = 0; i < MAIN.length - 1; i++) {
      const seg = trimToBox(pos(MAIN[i]), pos(MAIN[i + 1]), b.w, b.h);
      ctx.strokeStyle = 'rgba(190,180,150,.24)';
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(seg.a.x, seg.a.y); ctx.lineTo(seg.b.x, seg.b.y); ctx.stroke();
      arrow(seg.a, seg.b, 'rgba(190,180,150,.42)');
    }

    // curved / branch edges
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    for (const lp of LOOPS) {
      const col = lp.kind === 'blocked' ? 'rgba(213,94,0,.55)' : 'rgba(230,159,0,.55)';
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (let k = 0; k <= 28; k++) {
        const pt = pathPoint(lp.from, lp.to, k / 28);
        k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y);
      }
      ctx.stroke();
      const tip = pathPoint(lp.from, lp.to, 1), pre = pathPoint(lp.from, lp.to, 0.92);
      arrow(pre, tip, col.replace('.55', '.8'));
    }
    ctx.setLineDash([]);

    // edge labels for the loops
    ctx.font = '600 10px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.textAlign = 'center';
    label('replan', pathPoint('qa_gate', 'structure_planner', 0.5), '#e69f00');
    label('reflexion', pathPoint('paper_qc', 'drafter', 0.5), '#e69f00');
    label('insufficient', pathPoint('source_research', 'abnormal', 0.5), '#d55e00');

    // nodes
    const activeKey = (idx >= seq.length - 1) ? seq[idx] : (p > 0 ? curTo : seq[idx]);
    for (const key in NODE) {
      const n = NODE[key], c = pos(key), col = KIND_COLOR[n.kind];
      const isActive = key === activeKey;
      const done = visited.has(key);
      if (isActive) {
        const pulse = 0.5 + 0.5 * Math.sin(T * 3.2), ring = 5 + 3 * pulse;
        ctx.fillStyle = hexA(col, 0.13 + 0.11 * pulse);
        roundRect(c.x - b.w / 2 - ring, c.y - b.h / 2 - ring, b.w + 2 * ring, b.h + 2 * ring, 14);
        ctx.fill();
      }
      roundRect(c.x - b.w / 2, c.y - b.h / 2, b.w, b.h, 10);
      const g = ctx.createLinearGradient(0, c.y - b.h / 2, 0, c.y + b.h / 2);
      g.addColorStop(0, 'rgba(42,35,21,.97)'); g.addColorStop(1, 'rgba(22,18,10,.97)');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = isActive ? 2.4 : 1.3;
      ctx.strokeStyle = isActive ? col : (done ? hexA(col, .55) : 'rgba(190,180,150,.32)');
      if (isActive) { ctx.shadowColor = col; ctx.shadowBlur = 16; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // accent bar
      ctx.fillStyle = isActive ? col : hexA(col, done ? .8 : .5);
      ctx.fillRect(c.x - b.w / 2 + 3, c.y - b.h / 2 + 6, 3, b.h - 12);
      // label
      ctx.fillStyle = isActive ? '#fff' : (done ? '#e6dcc6' : '#8c8474');
      ctx.font = '600 12px var(--font, system-ui), system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, c.x + 3, c.y);
      ctx.textBaseline = 'alphabetic';
    }

    // travelling pulse
    if (idx < seq.length - 1) {
      const pt = pathPoint(curFrom, curTo, easeIO(p));
      const isLoop = LOOPS.find(l => l.from === curFrom && l.to === curTo);
      const pc = isLoop ? (isLoop.kind === 'blocked' ? '#ef9152' : '#f3bd62') : '#eeb079';
      const halo = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 16);
      halo.addColorStop(0, hexA(pc, .85)); halo.addColorStop(1, hexA(pc, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(pt.x, pt.y, 16, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.4, 0, 7); ctx.fill();
    }

    // caption corner
    ctx.fillStyle = 'rgba(180,169,142,.6)';
    ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.textAlign = 'left';
    ctx.fillText('analysis_agent · LangGraph state machine', 14, H - 14);
  }
  function label(text, pt, color) {
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(24,21,13,.9)';
    roundRect(pt.x - w / 2, pt.y - 8, w, 15, 6); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, pt.x, pt.y); ctx.textBaseline = 'alphabetic';
  }
  function hexA(hex, a) {
    const v = hex.replace('#', '');
    const r = parseInt(v.substring(0, 2), 16), g = parseInt(v.substring(2, 4), 16), b = parseInt(v.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function easeIO(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // ---- run log ----
  function logLine(node, tag) {
    line++;
    const num = String(line).padStart(2, '0');
    const row = document.createElement('div');
    row.className = 'ag-log-row' + (tag ? ' ag-log-' + tag : '');
    const mark = tag === 'replan' || tag === 'reflexion' ? '↺ ' : tag === 'blocked' ? '✕ ' : tag === 'done' ? '✓ ' : '';
    row.innerHTML = '<span class="ag-num">' + num + '</span>' +
      '<span class="ag-name">' + mark + NODE[node].label + '</span>' +
      '<span class="ag-det">' + DETAIL[node] + '</span>';
    elLog.appendChild(row);
    elLog.scrollTop = elLog.scrollHeight;
  }
  function clearLog() { elLog.innerHTML = ''; line = 0; }

  function arrive(node, prev) {
    visited.add(node);
    let tag = '';
    if (prev === 'qa_gate' && node === 'structure_planner') { tag = 'replan'; iter = 0; }
    else if (prev === 'paper_qc' && node === 'drafter') tag = 'reflexion';
    else if (node === 'abnormal') tag = 'blocked';
    else if (node === 'peer_review') tag = 'done';
    if (node === 'structure_planner') iter = 0;
    if (node === 'model_iter') iter = Math.min(3, iter + 1);
    logLine(node, tag);
    elNode.textContent = node;
    elStage.textContent = STAGE[node];
    elIter.textContent = iter + ' / 3';
    if (node === 'peer_review') setStatus('done · paper drafted', 'ok');
    else if (node === 'abnormal') setStatus('blocked · halted', 'halt');
    else setStatus('running', 'run');
  }
  function setStatus(text, cls) {
    elStatus.textContent = text;
    elStatus.className = 'ag-status ag-' + cls;
  }

  function reset(keepScenario) {
    if (!keepScenario) seq = SCENARIOS[scenario];
    idx = 0; p = 0; iter = 0; holdUntil = -1; visited.clear(); clearLog();
    arrive(seq[0], null);
  }

  // ---- loop (never freezes: active node breathes, run auto-replays) ----
  function running() { return !reduce && !paused && speed > 0 && visible && !document.hidden; }
  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
    last = now;
    T += dt / 60;
    if (running()) {
      if (idx < seq.length - 1) {
        // status hint while travelling a special edge
        const f = seq[idx], t = seq[idx + 1];
        if (f === 'qa_gate' && t === 'structure_planner') setStatus('replanning…', 'loop');
        else if (f === 'paper_qc' && t === 'drafter') setStatus('reflexion…', 'loop');
        else if (t === 'abnormal') setStatus('halting…', 'halt');
        p += dt * 0.020 * speed;
        if (p >= 1) { p = 0; idx++; arrive(seq[idx], seq[idx - 1]); if (idx >= seq.length - 1) holdUntil = T + 2.6; }
      } else if (holdUntil >= 0 && T >= holdUntil) {
        holdUntil = -1; reset(true);     // perpetual: replay the same scenario
      }
    }
    draw();
    if (running()) start();
  }
  function start() {
    if (!running() || raf || timer) return;
    timer = window.setTimeout(() => { timer = 0; raf = requestAnimationFrame(loop); }, FRAME_MS);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = 0; timer = 0; last = 0; }

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function isVisible() {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }

  // static frame for reduced motion: full clear-path run, log filled
  function staticFrame() {
    scenario = 'clear'; seq = SCENARIOS.clear; idx = seq.length - 1; p = 0;
    visited.clear(); clearLog(); iter = 3;
    SCENARIOS.clear.forEach(k => visited.add(k));
    elNode.textContent = 'peer_review'; elStage.textContent = 'Peer review';
    elIter.textContent = '3 / 3'; setStatus('done · paper drafted', 'ok');
    ['resolve','data_fetch','structure_planner','retrieval','source_research',
     'model_iter','model_supervisor','qa_gate','drafter','paper_qc','peer_review']
      .forEach(k => logLine(k, k === 'peer_review' ? 'done' : ''));
    draw();
  }

  // ---- controls ----
  function setScenario(key) {
    if (!SCENARIOS[key]) return;
    scenario = key;
    chips.forEach(c => c.classList.toggle('active', c.dataset.scenario === key));
    paused = false; elPause.textContent = 'Pause'; elPause.setAttribute('aria-pressed', 'false');
    reset();
    draw(); start();
  }
  chips.forEach(c => c.addEventListener('click', () => setScenario(c.dataset.scenario)));
  elSpeed.addEventListener('input', () => { speed = +elSpeed.value; start(); });
  elPause.addEventListener('click', () => {
    paused = !paused;
    elPause.textContent = paused ? 'Play' : 'Pause';
    elPause.setAttribute('aria-pressed', String(paused));
    paused ? stop() : start();
  });
  elStep.addEventListener('click', () => {
    paused = true; elPause.textContent = 'Play'; elPause.setAttribute('aria-pressed', 'true'); stop();
    if (idx < seq.length - 1) { idx++; p = 0; arrive(seq[idx], seq[idx - 1]); draw(); }
  });

  // ---- init ----
  resize();
  if (reduce) { staticFrame(); }
  else {
    reset(); visible = isVisible(); draw();
    window.addEventListener('resize', () => { resize(); visible = isVisible(); draw(); start(); });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 });
      io.observe(canvas);
    }
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    start();
  }
})();
