/* =================================================================
   jindu.js — §03, the Peking University KG + experiment-design agent.

   Two things have to be true at once for this figure to be honest.

   The graph has to look like a graph a chemist would recognise: typed
   entities, named relations on the edges, and the Leiden partition
   drawn as *regions* rather than as four colours of dot. A hull says
   "these belong together" without adding a single edge; four colours
   of dot say only "there is a legend somewhere".

   And the protocol has to look like a protocol. An electronic lab
   notebook has an objective, a materials table, controls, numbered
   procedure steps, an endpoint, and — the part that matters here —
   a provenance chip on every claim plus a validation gate that can
   fail. An empty right-hand column until you press a button is not a
   product; it is a placeholder.
   ================================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('jinduKG');
  if (!canvas || !window.UI) return;
  const ctx = canvas.getContext('2d');
  const U = window.UI, C = U.C, E = U.E;

  /* ---------------------------------------------------------------
     SCHEMA — six entity types, six relation types. The schema is the
     product: everything downstream (dedup, scoring, Neo4j labels) is
     keyed off it, so it belongs on screen.
     --------------------------------------------------------------- */
  const COMM = [
    { key: 'solvent',  name: '溶剂 Solvents',        c: '#7fa8d0' },
    { key: 'salt',     name: '锂盐 Li salts',        c: '#e0a45c' },
    { key: 'additive', name: '添加剂 Additives',     c: '#63b394' },
    { key: 'prop',     name: '界面与性能 Interphase', c: '#b98bb4' },
    { key: 'method',   name: '表征 Methods',         c: '#c98b6b' }
  ];
  const commOf = k => COMM.find(c => c.key === k) || COMM[0];

  /* Normalised layout. Hand-placed rather than force-directed: a
     spring layout re-run per resize would move labels under each
     other, and a graph you cannot read is not a visualization. */
  const N = [
    /* solvents */
    { id: 'elyte', label: 'electrolyte', comm: 'solvent', x: .30, y: .46, deg: 7, papers: 214 },
    { id: 'ec',    label: 'EC',          comm: 'solvent', x: .12, y: .24, deg: 4, papers: 138 },
    { id: 'dmc',   label: 'DMC',         comm: 'solvent', x: .09, y: .47, deg: 3, papers: 96 },
    { id: 'emc',   label: 'EMC',         comm: 'solvent', x: .13, y: .70, deg: 2, papers: 61 },
    { id: 'thf',   label: 'THF',         comm: 'solvent', x: .27, y: .84, deg: 2, papers: 28 },
    /* salts */
    { id: 'lipf6', label: 'LiPF₆',       comm: 'salt',    x: .42, y: .13, deg: 5, papers: 176 },
    { id: 'lifsi', label: 'LiFSI',       comm: 'salt',    x: .60, y: .09, deg: 3, papers: 74 },
    /* additives */
    { id: 'fec',   label: 'FEC',         comm: 'additive', x: .49, y: .44, deg: 5, papers: 152 },
    { id: 'vc',    label: 'VC',          comm: 'additive', x: .47, y: .68, deg: 4, papers: 118 },
    { id: 'dfob',  label: 'LiDFOB',      comm: 'additive', x: .62, y: .60, deg: 2, papers: 39 },
    /* interphase + properties */
    { id: 'sei',   label: 'SEI film',    comm: 'prop',    x: .72, y: .40, deg: 8, papers: 231 },
    { id: 'sigma', label: 'ionic σ',     comm: 'prop',    x: .90, y: .24, deg: 3, papers: 87 },
    { id: 'win',   label: 'stability window', comm: 'prop', x: .93, y: .53, deg: 3, papers: 66 },
    { id: 'ce',    label: 'Coulombic eff.',   comm: 'prop', x: .88, y: .74, deg: 3, papers: 103 },
    /* methods */
    { id: 'eis',   label: 'EIS',         comm: 'method',  x: .69, y: .86, deg: 3, papers: 58 },
    { id: 'xps',   label: 'XPS',         comm: 'method',  x: .52, y: .90, deg: 2, papers: 44 }
  ];
  const ID = Object.fromEntries(N.map(n => [n.id, n]));

  /* Typed edges. The relation vocabulary is small on purpose — six
     verbs cover the domain, and a reader can hold six in their head. */
  const EDGE = [
    ['elyte', 'ec', 'contains'], ['elyte', 'dmc', 'contains'], ['elyte', 'emc', 'contains'],
    ['elyte', 'thf', 'contains'], ['elyte', 'lipf6', 'contains'],
    ['lifsi', 'elyte', 'substitutes'],
    ['fec', 'elyte', 'additive_of'], ['vc', 'elyte', 'additive_of'], ['dfob', 'elyte', 'additive_of'],
    ['fec', 'sei', 'forms'], ['vc', 'sei', 'forms'], ['dfob', 'sei', 'forms'],
    ['lipf6', 'sei', 'decomposes_to'], ['ec', 'sei', 'forms'],
    ['sei', 'sigma', 'limits'], ['sei', 'win', 'sets'], ['sei', 'ce', 'governs'],
    ['eis', 'sei', 'measures'], ['xps', 'sei', 'measures'], ['eis', 'sigma', 'measures'],
    ['lipf6', 'sigma', 'raises'], ['lifsi', 'sigma', 'raises']
  ];
  const adj = {};
  EDGE.forEach(([a, b]) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); });

  /* ---------------------------------------------------------------
     Layout plumbing
     --------------------------------------------------------------- */
  let box = null, t = 0;
  let hover = null, sel = null;
  let litNodes = null, litEdges = null;   // the retrieval trace
  let traceT = 0;

  const PAD = { l: 30, r: 30, t: 26, b: 30 };
  const PX = n => PAD.l + n.x * (box.w - PAD.l - PAD.r);
  const PY = n => PAD.t + n.y * (box.h - PAD.t - PAD.b);
  const rOf = n => 4.4 + Math.sqrt(n.deg) * 2.5;

  /* ---------------------------------------------------------------
     Draw
     --------------------------------------------------------------- */
  function draw() {
    box = U.fit(canvas, ctx);
    if (!box) return;
    const w = box.w, h = box.h;
    ctx.clearRect(0, 0, w, h);

    /* plate: a faint grid, so the graph sits on a surface */
    ctx.save();
    ctx.strokeStyle = C.grid; U.hair(ctx);
    for (let x = 28; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(U.snap(x), 0); ctx.lineTo(U.snap(x), h); ctx.stroke(); }
    for (let y = 28; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, U.snap(y)); ctx.lineTo(w, U.snap(y)); ctx.stroke(); }
    ctx.restore();

    const focus = sel || hover;
    const near = focus ? new Set([focus, ...(adj[focus] || [])]) : null;
    const dimOf = id => {
      if (near) return near.has(id) ? 1 : .16;
      if (litNodes) return litNodes.has(id) ? 1 : .22;
      return 1;
    };

    /* ---- community hulls ---- */
    COMM.forEach(cm => {
      const pts = N.filter(n => n.comm === cm.key).map(n => [PX(n), PY(n)]);
      if (!pts.length) return;
      const hull = U.smoothHull(pts, 22 + (pts.length > 3 ? 4 : 10));
      const active = !near || pts.some((p, i) => near.has(N.filter(n => n.comm === cm.key)[i].id));
      ctx.save();
      ctx.globalAlpha = active ? 1 : .35;
      U.hullPath(ctx, hull);
      ctx.fillStyle = U.rgba(cm.c, .055); ctx.fill();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = U.rgba(cm.c, .30); ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      /* the hull's own label, set at its topmost point */
      let top = hull[0];
      hull.forEach(p => { if (p[1] < top[1]) top = p; });
      U.text(ctx, cm.name.split(' ')[0], top[0], top[1] - 5,
        { font: U.mono(8.5, 500), fill: U.rgba(cm.c, .85), align: 'center', track: '.08em' });
      ctx.restore();
    });

    /* ---- edges ---- */
    const curves = [];
    EDGE.forEach(([a, b, rel], i) => {
      const na = ID[a], nb = ID[b];
      const pa = [PX(na), PY(na)], pb = [PX(nb), PY(nb)];
      const onFocus = near ? (near.has(a) && near.has(b)) : false;
      const onLit = litEdges ? litEdges.has(a + '>' + b) : false;
      const alpha = near ? (onFocus ? 1 : .12) : litEdges ? (onLit ? 1 : .18) : .55;
      const c = U.edge(ctx, pa, pb, {
        bend: ((i % 3) - 1) * .06 + .05,
        stroke: onLit ? U.rgba(C.amber, .8) : onFocus ? U.rgba(C.soft, .55) : U.rgba(C.soft, .18 * alpha / .55),
        width: onLit ? 1.9 : onFocus ? 1.5 : 1
      });
      curves.push({ a: pa, b: pb, c, rel, onFocus, onLit, ka: a, kb: b });
    });

    /* a packet running the retrieved path, so retrieval reads as
       traversal rather than as a colour change */
    if (litEdges) {
      curves.filter(e => e.onLit).forEach((e, i) => {
        const ph = ((traceT * .5) + i * .12) % 1;
        const p = U.edgePoint(e.a, e.c, e.b, ph);
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, U.TAU);
        ctx.fillStyle = C.amberL; ctx.fill();
      });
    }

    /* ---- relation labels, only for the focused sub-graph ----
       Showing all 22 at once is a hairball; showing none makes the
       edges meaningless. Focus is the answer. */
    if (near) {
      curves.filter(e => e.onFocus).forEach(e => {
        const p = U.edgePoint(e.a, e.c, e.b, .5);
        U.edgeLabel(ctx, p[0], p[1], e.rel, { fill: C.soft });
      });
    }

    /* ---- nodes ---- */
    N.forEach(n => {
      const x = PX(n), y = PY(n), r = rOf(n);
      const d = dimOf(n.id);
      const isFocus = focus === n.id;
      const halo = isFocus ? 1 : (litNodes && litNodes.has(n.id) ? .55 + .25 * Math.sin(t * 3) : 0);
      U.node(ctx, x, y, r, commOf(n.comm).c, { dim: d, ring: isFocus, halo });
      ctx.save();
      ctx.globalAlpha = d;
      const big = r >= 8;
      U.text(ctx, n.label, x, y + r + 11, {
        font: big ? U.sans(10.5, 600) : U.sans(9.5, 500),
        fill: isFocus ? C.ink : d < .5 ? C.faint : C.soft, align: 'center'
      });
      ctx.restore();
    });

    /* ---- hover card ---- */
    if (hover && ID[hover]) {
      const n = ID[hover];
      U.chipCard(ctx, PX(n), PY(n) - rOf(n) - 8, [
        n.label,
        commOf(n.comm).name.split(' ').slice(1).join(' ') || commOf(n.comm).name,
        'degree ' + n.deg + '  ·  ' + n.papers + ' papers'
      ], { l: 4, t: 4, r: w - 4, b: h - 4 });
    }

    /* ---- footer stats ---- */
    U.text(ctx, N.length + ' nodes · ' + EDGE.length + ' typed edges · ' + COMM.length + ' Leiden communities · Q = 0.61',
      10, h - 8, { font: U.mono(8.8), fill: C.faint, track: '.04em' });
  }

  /* A small card for the hover readout; kept here rather than in
     uikit because it is the only place a *node* needs one. */
  U.chipCard = U.chipCard || function (ctx2, x, y, lines, bounds) {
    const pad = 7, lh = 13;
    ctx2.save();
    ctx2.font = U.mono(9.5);
    let wmax = 0;
    lines.forEach((s, i) => {
      ctx2.font = i === 0 ? U.sans(11, 600) : U.mono(9.5);
      wmax = Math.max(wmax, ctx2.measureText(s).width);
    });
    const bw = wmax + pad * 2, bh = lines.length * lh + pad * 1.6;
    let bx = x - bw / 2, by = y - bh;
    if (bounds) {
      bx = U.clamp(bx, bounds.l, bounds.r - bw);
      by = U.clamp(by, bounds.t, bounds.b - bh);
    }
    U.rrect(ctx2, bx, by, bw, bh, 5);
    ctx2.fillStyle = 'rgba(18,15,9,.96)'; ctx2.fill();
    ctx2.strokeStyle = C.rule2; ctx2.lineWidth = 1; ctx2.stroke();
    lines.forEach((s, i) => U.text(ctx2, s, bx + pad, by + pad + 4 + i * lh + 5, {
      font: i === 0 ? U.sans(11, 600) : U.mono(9.5),
      fill: i === 0 ? C.ink : C.dim
    }));
    ctx2.restore();
  };

  /* ---------------------------------------------------------------
     Interaction — hover to reveal a node's neighbourhood and its
     relation names; click to pin it.
     --------------------------------------------------------------- */
  function pick(mx, my) {
    let best = null, bd = 1e9;
    N.forEach(n => {
      const dx = PX(n) - mx, dy = PY(n) - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n; }
    });
    const r = best ? rOf(best) + 12 : 0;
    return best && bd < r * r ? best.id : null;
  }
  canvas.addEventListener('mousemove', e => {
    if (!box) return;
    const b = canvas.getBoundingClientRect();
    const id = pick(e.clientX - b.left, e.clientY - b.top);
    if (id !== hover) { hover = id; canvas.style.cursor = id ? 'pointer' : 'default'; draw(); }
  });
  canvas.addEventListener('mouseleave', () => { hover = null; draw(); });
  canvas.addEventListener('click', e => {
    const b = canvas.getBoundingClientRect();
    const id = pick(e.clientX - b.left, e.clientY - b.top);
    sel = (id && id === sel) ? null : id;
    draw();
  });

  /* legend */
  const legend = document.getElementById('jinduLegend');
  if (legend) {
    legend.innerHTML = COMM.map(c =>
      '<span data-comm="' + c.key + '"><i style="background:' + c.c + '"></i>' + c.name + '</span>').join('');
  }

  /* ---------------------------------------------------------------
     THE LAB AGENT — four steps, and a protocol that fills in.
     --------------------------------------------------------------- */
  const STEPS = ['analyze', 'rag', 'design', 'verify'];
  const stepEl = Object.fromEntries(STEPS.map(s =>
    [s, document.querySelector('.lab-steps li[data-step="' + s + '"]')]));
  const proto = document.getElementById('labProto');
  const runBtn = document.getElementById('labRun');

  /* The retrieval frontier at each step: which sub-graph the agent is
     actually reading. This is what makes the graph and the protocol
     one figure instead of two. */
  const FRONTIER = {
    analyze: ['fec', 'vc', 'sei'],
    rag: ['fec', 'vc', 'sei', 'elyte', 'lipf6', 'ec', 'dmc', 'xps'],
    design: ['fec', 'vc', 'sei', 'elyte', 'lipf6', 'ec', 'dmc', 'eis', 'ce', 'xps'],
    verify: ['fec', 'vc', 'sei', 'eis', 'ce', 'xps', 'win']
  };
  function setFrontier(list) {
    litNodes = list ? new Set(list) : null;
    litEdges = list
      ? new Set(EDGE.filter(([a, b]) => list.indexOf(a) >= 0 && list.indexOf(b) >= 0).map(([a, b]) => a + '>' + b))
      : null;
  }

  /* An ELN-shaped protocol: objective, materials, procedure with a
     provenance chip per step, endpoint, then the gates. */
  const PROTOCOL = {
    objective: 'Rank FEC vs VC by the stability of the SEI they form in 1 M LiPF₆ / EC:DMC (1:1 v/v).',
    materials: [
      ['Baseline', '1 M LiPF₆, EC:DMC 1:1 v/v', 'control'],
      ['Arm A', 'baseline + 2 wt% FEC', 'variable'],
      ['Arm B', 'baseline + 2 wt% VC', 'variable']
    ],
    steps: [
      ['Assemble three matched Li‖Cu half-cells per arm (n = 3).',
        'KG · electrolyte —contains→ LiPF₆, EC, DMC', 'protocol'],
      ['Identical formation: 3 cycles at C/20, 25 °C, 0.01–1.0 V.',
        'literature · SEI formation window', 'literature'],
      ['Cycle 100× at C/2; log Coulombic efficiency every cycle.',
        'KG · SEI film —governs→ Coulombic eff.', 'graph'],
      ['EIS after cycles 1, 10, 50, 100; fit R_SEI from the mid-frequency arc.',
        'KG · EIS —measures→ SEI film', 'graph'],
      ['XPS of the harvested Cu at cycle 100: F 1s / C 1s ratio per arm.',
        'KG · XPS —measures→ SEI film', 'graph']
    ],
    endpoint: 'The arm with the lower ΔR_SEI slope and the higher mean CE over cycles 20–100 forms the more stable SEI.',
    gates: [
      ['every procedure step cites a graph edge or a paper', true],
      ['controls present and matched (n = 3 per arm)', true],
      ['endpoint is measurable with the listed instruments', true],
      ['no claim about mechanism beyond the retrieved evidence', true]
    ]
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let running = false;

  /* The idle state is a real scaffold, greyed. A product shows you
     the shape of its output before you press the button. */
  function scaffold() {
    if (!proto) return;
    proto.innerHTML =
      '<div class="pr-idle">' +
      ['Objective', 'Materials & arms', 'Procedure', 'Endpoint', 'Validation gates']
        .map(s => '<div class="pr-slot"><span>' + s + '</span><i></i></div>').join('') +
      '<p class="pr-hint">Run the workflow — every line is written from a retrieved graph edge or paper, ' +
      'and the gates below can fail.</p></div>';
  }

  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  async function emit(node) {
    proto.appendChild(node);
    await sleep(20);
    node.classList.add('is-in');
    proto.scrollTop = proto.scrollHeight;
    await sleep(180);
  }

  function reset() {
    STEPS.forEach(s => stepEl[s] && stepEl[s].classList.remove('is-active', 'is-done'));
    setFrontier(null); sel = null;
    scaffold();
    draw();
  }

  async function run() {
    if (running) return;
    running = true;
    if (runBtn) { runBtn.disabled = true; runBtn.textContent = '▪ Running…'; }
    reset();
    proto.innerHTML = '';

    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      STEPS.forEach(k => stepEl[k] && stepEl[k].classList.remove('is-active'));
      if (stepEl[s]) stepEl[s].classList.add('is-active');
      setFrontier(FRONTIER[s]);
      draw();

      if (s === 'analyze') {
        await emit(h('div', 'pr-block pr-obj',
          '<span class="pr-lab">Objective</span><p>' + PROTOCOL.objective + '</p>'));
      }

      if (s === 'rag') {
        const rows = PROTOCOL.materials.map(([k, v, kind]) =>
          '<tr class="pr-' + kind + '"><td>' + k + '</td><td>' + v + '</td><td>' + kind + '</td></tr>').join('');
        await emit(h('div', 'pr-block',
          '<span class="pr-lab">Materials &amp; arms</span>' +
          '<table class="pr-table"><tbody>' + rows + '</tbody></table>'));
        await emit(h('div', 'pr-retr',
          '<b>' + FRONTIER.rag.length + '</b> entities · <b>' +
          EDGE.filter(([a, b]) => FRONTIER.rag.indexOf(a) >= 0 && FRONTIER.rag.indexOf(b) >= 0).length +
          '</b> edges retrieved · depth = deep'));
      }

      if (s === 'design') {
        await emit(h('div', 'pr-block', '<span class="pr-lab">Procedure</span>'));
        for (let j = 0; j < PROTOCOL.steps.length; j++) {
          const [txt, ev, kind] = PROTOCOL.steps[j];
          await emit(h('div', 'pr-step',
            '<span class="pr-n">' + (j + 1) + '</span>' +
            '<span class="pr-t">' + txt +
            '<span class="pr-ev pr-ev-' + kind + '">' + ev + '</span></span>'));
        }
        await emit(h('div', 'pr-block pr-end',
          '<span class="pr-lab">Endpoint</span><p>' + PROTOCOL.endpoint + '</p>'));
      }

      if (s === 'verify') {
        await emit(h('div', 'pr-block', '<span class="pr-lab">Validation gates</span>'));
        for (const [g, ok] of PROTOCOL.gates) {
          await emit(h('div', 'pr-gate' + (ok ? ' is-ok' : ' is-bad'),
            '<i>' + (ok ? '✓' : '✕') + '</i><span>' + g + '</span>'));
        }
        await emit(h('div', 'pr-verdict',
          'Protocol accepted → queued to <b>Nanocraft</b> auto-synthesis'));
      }

      if (stepEl[s]) { stepEl[s].classList.remove('is-active'); stepEl[s].classList.add('is-done'); }
      await sleep(220);
    }
    setFrontier(FRONTIER.verify);
    draw();
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = '↻ Run again'; }
    running = false;
  }

  if (runBtn) runBtn.addEventListener('click', run);
  scaffold();

  /* ---------------------------------------------------------------
     Loop + lifecycle
     --------------------------------------------------------------- */
  const anim = U.loop(canvas, dt => { t += dt * .016; traceT += dt * .016; if (litEdges) draw(); }, { fps: 26 });
  U.onResize(canvas, draw);
  draw();
  anim.start();

  if ('IntersectionObserver' in window && !U.reduce) {
    let fired = false;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting && !fired) { fired = true; setTimeout(run, 420); }
    }), { threshold: .35 });
    const mock = document.querySelector('#jindu .app-mock');
    if (mock) io.observe(mock);
  }

  /* ---------------------------------------------------------------
     The extraction pipeline strip — a sweep that reads as a pipeline
     running, not as four cards taking turns being orange.
     --------------------------------------------------------------- */
  const pipe = Array.from(document.querySelectorAll('#jindu .pipe-node'));
  if (pipe.length && !U.reduce) {
    let i = 0;
    setInterval(() => {
      pipe.forEach((n, k) => {
        n.classList.toggle('is-lit', k === i % pipe.length);
        n.classList.toggle('is-past', k < i % pipe.length);
      });
      i++;
    }, 900);
  }
})();
