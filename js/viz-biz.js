/* =================================================================
   viz-biz.js — Fig B·1 "Crystal Ball": business plan → evidence →
   expert criteria → screen.  Two views: evidence graph / pipeline.
   Illustrative figure; corpus counts from the project's internal report.
   ================================================================= */
(function () {
  'use strict';
  const root = document.getElementById('bizReasoning');
  if (!root || !window.TV) return;
  const T = window.TV, C = T.C, TAU = T.TAU, ACC = C.steel;
  const clamp = T.clamp, lerp = T.lerp, rgba = T.rgba, F = T.font;

  const fig = T.mount(root, {
    domain: 'biz',
    kicker: 'Fig B·1 — Crystal Ball · business plan → evidence → expert criteria → screen',
    status: 'live · illustrative data',
    stack: ['Python 3.12', 'FastAPI', 'PostgreSQL 17', 'pgvector', 'OpenSearch BM25', 'RRF + BGE rerank',
      'Neo4j projection', 'Vue 3 + TS', 'Qwen / DeepSeek', 'Docker Compose'],
    note: 'Fictional company; corpus counts from the project’s internal report (2026-09).',
    height: 580,
    aria: 'Crystal Ball due-diligence system: a rotating evidence graph of facts, slots, rules, expert decision cards and cases, and the 14-stage reasoning pipeline that ends in a three-tier screening verdict.',
    controls: true
  });
  const ctx = fig.ctx;

  /* ---------------- scoped css ---------------- */
  const st = document.createElement('style');
  st.id = 'viz-biz-css';
  st.textContent =
    '#bizReasoning .bz-a{left:14px;top:14px;width:330px}' +
    '#bizReasoning .bz-b{right:14px;top:14px;width:310px}' +
    '#bizReasoning[data-bz="pipe"] .bz-a,#bizReasoning[data-bz="pipe"] .bz-b{top:auto;bottom:14px}' +
    '#bizReasoning .bz-p{transition:opacity .26s}' +
    '#bizReasoning[data-bz="pipe"] .bz-r i{display:none}' +
    '#bizReasoning[data-bz="pipe"] .bz-r{padding:.2rem .5rem}' +
    '#bizReasoning .bz-p.bz-out{opacity:0}' +
    '#bizReasoning[data-bzc="1"] .bz-p{display:none}' +
    '#bizReasoning .bz-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.28rem .45rem}' +
    '#bizReasoning .bz-c{padding:.18rem .3rem;border-radius:5px;border:1px solid transparent;transition:background .25s,border-color .25s}' +
    '#bizReasoning .bz-c.wide{grid-column:1/-1}' +
    '#bizReasoning .bz-c b{display:block;font-size:.8rem;font-weight:500;color:#f4eee2;font-variant-numeric:tabular-nums;line-height:1.25}' +
    '#bizReasoning .bz-c span{font-size:.6rem;color:#958c77;line-height:1.2;display:block}' +
    '#bizReasoning .bz-c.on{border-color:rgba(143,179,220,.6);background:rgba(143,179,220,.12)}' +
    '#bizReasoning .bz-r{padding:.26rem .5rem;border-left:2px solid rgba(236,224,200,.1);opacity:.5;transition:opacity .25s,border-color .25s,background .25s}' +
    '#bizReasoning .bz-r b{display:block;font-weight:500;color:#f4eee2;font-size:.66rem}' +
    '#bizReasoning .bz-r i{display:block;font-style:normal;color:#8a826d;font-size:.6rem}' +
    '#bizReasoning .bz-r.on{opacity:1;border-left-color:#8fb3dc;background:rgba(143,179,220,.1)}';
  document.head.appendChild(st);

  /* ---------------- HUD panels ---------------- */
  const COUNTS = [
    ['experts', '30', 'experts'], ['cards', '1,067', 'decision cards'], ['rules', '557', 'IF-THEN rules'],
    ['cases', '111', 'cases'], ['edges', '2,774', 'graph edges'], ['criteria', '393', 'criteria'],
    ['statements', '641', 'statements'], ['slots', '268', 'slots'], ['facts', '1,244', 'facts · 12 BPs'],
    ['links', '391', 'case links · 336 supporting / 55 counter-ex.', true]
  ];
  const RULES = [
    ['missing ≠ no', 'absent evidence stays UNKNOWN'],
    ['self-reported ≠ verified', 'tagged when the plan is read'],
    ['machine-compiled ≠ expert-confirmed', 'needs an expert card'],
    ['preference ratio ≠ funding probability', 'a count, not odds']
  ];
  const pA = document.createElement('div');
  pA.className = 'tv-panel bz-p bz-a';
  const hA = document.createElement('h5'); hA.textContent = 'Corpus · 2026-09 report';
  const grid = document.createElement('div'); grid.className = 'bz-grid';
  const cEl = {};
  COUNTS.forEach(c => {
    const d = document.createElement('div'); d.className = 'bz-c' + (c[3] ? ' wide' : '');
    const b = document.createElement('b'); b.textContent = c[1];
    const s = document.createElement('span'); s.textContent = c[2];
    d.append(b, s); grid.append(d); cEl[c[0]] = d;
  });
  pA.append(hA, grid);
  const pB = document.createElement('div');
  pB.className = 'tv-panel bz-p bz-b';
  const hB = document.createElement('h5'); hB.textContent = 'Design rules';
  pB.append(hB);
  const rEl = RULES.map(r => {
    const d = document.createElement('div'); d.className = 'bz-r';
    const b = document.createElement('b'); b.textContent = r[0];
    const i = document.createElement('i'); i.textContent = r[1];
    d.append(b, i); pB.append(d); return d;
  });
  fig.hud.append(pA, pB);
  let hlKey = '', hlRule = -2;
  function setHL(keys, rule) {
    const k = keys.join(',');
    if (k !== hlKey) { hlKey = k; Object.keys(cEl).forEach(x => cEl[x].classList.toggle('on', keys.indexOf(x) >= 0)); }
    if (rule !== hlRule) { hlRule = rule; rEl.forEach((e, i) => e.classList.toggle('on', i === rule)); }
  }

  /* ================================================================
     DATA — five dimensions (five_dim.yaml), graph, stages
     ================================================================ */
  const DIMS = [
    { k: 'team', en: 'Team', zh: '团队', slots: ['founder_background', 'ceo_equity_pct', 'fulltime', 'ip_ownership_cleared', 'completeness', 'equity_structure'],
      facts: ['founder domain experience', 'core members full-time', 'equity structure disclosed', 'IP assigned from institute'] },
    { k: 'tech', en: 'Tech & Product', zh: '技术', slots: ['trl', 'pilot_line', 'key_metric', 'third_party_report', 'cte_list', 'patent_count'],
      facts: ['pilot line running', 'TRL self-assessed', 'efficiency metric claimed', 'third-party report pending'] },
    { k: 'market', en: 'Market', zh: '市场', slots: ['contracts', 'tam', 'competition', 'sizing_method', 'policy_momentum', 'som'],
      facts: ['pilot with 2 customers', 'bottom-up TAM estimate', 'two competitors named', 'policy tailwind cited'] },
    { k: 'finance', en: 'Finance', zh: '财务', slots: ['revenue', 'unit_gross_margin', 'runway_months', 'burn_rate', 'pre_money', 'revenue_forecast_growth'],
      facts: ['revenue forecast growth', 'gross margin estimate', 'runway months stated', 'round valuation sought'] },
    { k: 'compliance', en: 'Risk & Compliance', zh: '合规', slots: ['litigation', 'ip_dispute', 'equity_defect', 'exit_path', 'alternative_supply', 'policy_alignment'],
      facts: ['no litigation disclosed', 'patent filings listed', 'single supply source', 'export-control note'] }
  ];
  const TYPES = {
    fact: { col: C.amber, r: 3.5, name: 'BP fact', leg: 'BP fact' },
    slot: { col: C.sky, r: 3.4, name: 'Slot', leg: 'slot' },
    rule: { col: C.gold, r: 3.6, name: 'IF-THEN rule', leg: 'rule' },
    card: { col: C.steel, r: 3.3, name: 'Decision card', leg: 'decision card' },
    case: { col: C.mint, r: 3.8, name: 'Case · supporting', leg: 'case' },
    counter: { col: C.rose, r: 3.8, name: 'Case · counter-example', leg: 'counter-example' },
    expert: { col: C.plum, r: 5, name: 'Expert', leg: 'expert' },
    para: { col: C.dim, r: 2.4, name: 'Source paragraph', leg: 'source ¶' },
    hub: { col: ACC, r: 8, name: 'Dimension', leg: 'dimension' },
    gap: { col: C.ember, r: 5.2, name: 'Evidence gap', leg: 'evidence gap' }
  };
  const LEG = ['fact', 'slot', 'rule', 'card', 'case', 'counter', 'expert', 'para'];

  const R = T.rand(20260929);
  const gs = () => (R() + R() + R() - 1.5) * .26;
  const N = [], E = [];
  function add(type, hub, x, y, z, label) {
    const n = { type, hub, x, y, z, label, col: TYPES[type].col, r: TYPES[type].r, adj: [], sx: 0, sy: 0, ss: 1, sz: 0, tstep: -1 };
    N.push(n); return n;
  }
  const addE = (a, b, k) => { E.push({ a, b, k: k || '' }); a.adj.push(b); b.adj.push(a); };
  const hubPos = DIMS.map((d, i) => {
    const a = i / 5 * TAU - Math.PI / 2;
    return { x: Math.cos(a) * .82, y: [.12, -.16, .2, -.12, .04][i], z: Math.sin(a) * .62 };
  });
  const EXPERT_IDS = [1, 3, 5, 7, 9, 11, 12, 14, 18, 22, 25, 29];
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const experts = EXPERT_IDS.map((id, e) => {
    const h1 = hubPos[e % 5], h2 = hubPos[(e + 2) % 5];
    return add('expert', e % 5, (h1.x + h2.x) * .3 + gs() * .3, (h1.y + h2.y) * .3 + gs() * .3, (h1.z + h2.z) * .3 + gs() * .3, 'E' + pad2(id));
  });
  const hubExperts = DIMS.map((d, h) => experts.filter((n, e) => e % 5 === h || (e + 2) % 5 === h));
  const SC = { fact: 1.15, para: 1.3, card: 1, rule: .85, slot: .7, case: 1.1 };
  let pageN = 3, cardN = 0, ruleN = 0, caseN = 0;
  const byHub = DIMS.map((d, h) => {
    const hp = hubPos[h], g = { fact: [], slot: [], rule: [], card: [], case: [], para: [] };
    d.node = add('hub', h, hp.x, hp.y, hp.z, d.en + ' · ' + d.zh);
    [['para', 5], ['fact', 8], ['slot', 6], ['rule', 7], ['card', 10], ['case', 5]].forEach(([ty, n]) => {
      for (let i = 0; i < n; i++) {
        const s = SC[ty];
        let label;
        pageN = 2 + ((pageN * 7 + 5) % 17);
        if (ty === 'para') label = 'source ¶ p.' + pageN;
        else if (ty === 'fact') label = 'BP fact · Company A · ' + d.facts[i % 4] + ' · p.' + pageN;
        else if (ty === 'slot') label = 'slot · ' + d.k + '.' + d.slots[i % d.slots.length];
        else if (ty === 'rule') label = 'IF-THEN rule R-' + (100 + ++ruleN) + ' · ' + d.k;
        else if (ty === 'card') label = 'decision card D-' + (1000 + ++cardN) + ' · ' + d.k;
        else label = 'case C-' + (10 + ++caseN);
        const nd = add(ty, h, hp.x + gs() * s, hp.y + gs() * s * .8, hp.z + gs() * s, label);
        if (ty === 'card') nd.expert = hubExperts[h][i % hubExperts[h].length];
        g[ty].push(nd);
      }
    });
    return g;
  });
  // counter-examples: a few per graph, one inside the Market cluster for the trace
  [[0, 4], [1, 2], [3, 3], [3, 4], [4, 1], [2, 3]].forEach(([h, i]) => {
    const c = byHub[h].case[i]; c.type = 'counter'; c.col = TYPES.counter.col;
    c.label = c.label + ' · counter-example';
  });
  byHub.forEach((g, h) => {
    g.slot.forEach(s => addE(DIMS[h].node, s));
    g.fact.forEach((f, i) => { addE(f, g.slot[i % g.slot.length]); addE(g.para[i % g.para.length], f, 'p'); });
    g.slot.forEach((s, i) => addE(s, g.rule[i % g.rule.length]));
    g.rule.forEach((r, i) => { addE(r, g.card[i % 10]); addE(r, g.card[(i + 3) % 10]); });
    g.card.forEach(c => addE(c, c.expert));
    g.case.forEach((c, i) => addE(g.card[(i * 2) % 10], c));
  });
  for (let i = 0; i < 18; i++) {
    const a = byHub[i % 5], b = byHub[(i * 2 + 1) % 5];
    if (a === b) continue;
    addE(a.rule[Math.floor(R() * 7)], b.rule[Math.floor(R() * 7)], 'x');
  }
  // ---- the query trace (inside the Market cluster)
  const gM = byHub[2];
  const TR = {
    fact: gM.fact[0], para: gM.para[0], slot: gM.slot[0], rule: gM.rule[0],
    cards: [gM.card[0], gM.card[3], gM.card[6]], caseS: gM.case[0], caseC: gM.case[3]
  };
  TR.fact.label = 'BP fact · Company A · pilot with 2 customers (self-reported, p.4)';
  TR.para.label = 'source ¶ p.4';
  TR.slot.label = 'slot · market.contracts';
  TR.rule.label = 'IF-THEN rule · pilot needs acceptance evidence → UNKNOWN';
  TR.caseC.type = 'counter'; TR.caseC.col = TYPES.counter.col;
  TR.caseC.label = 'case C-counter · counter-example';
  TR.caseS.label = 'case C-support · supporting';
  TR.gap = add('gap', 2, hubPos[2].x + .02, hubPos[2].y - .27, hubPos[2].z + .05, 'evidence gap → follow-up question');
  TR.gap.label = 'evidence gap → follow-up question';
  addE(TR.rule, TR.cards[2]); addE(TR.caseS, TR.gap); addE(TR.caseC, TR.gap); addE(TR.rule, TR.gap, 'g');
  (function () {
    const hp = hubPos[2], L = Math.hypot(hp.x, hp.z), dx = -hp.x / L, dz = -hp.z / L, px = -dz, pz = dx;
    const put = (n, a, l, u) => { n.x = hp.x + dx * a + px * l; n.z = hp.z + dz * a + pz * l; n.y = hp.y + u; };
    put(TR.para, -.1, .24, .1); put(TR.fact, .0, .12, -.05); put(TR.slot, .14, -.02, .07); put(TR.rule, .3, .05, -.07);
    put(TR.cards[0], .46, .26, .1); put(TR.cards[1], .5, -.18, .04); put(TR.cards[2], .4, .04, .24);
    put(TR.caseS, .64, .24, -.08); put(TR.caseC, .68, -.22, -.06); put(TR.gap, .8, .0, .1);
  })();
  TR.fact.tstep = 0; TR.para.tstep = 0; TR.slot.tstep = 1; TR.rule.tstep = 2;
  TR.cards.forEach(c => { c.tstep = 3; c.expert.tstep = 3; });
  TR.caseS.tstep = 4; TR.caseC.tstep = 4; TR.gap.tstep = 5;
  const TE = [  // trace edges: [a, b, step, dashed]
    [TR.para, TR.fact, 0, true], [TR.fact, TR.slot, 1], [TR.slot, TR.rule, 2],
    [TR.rule, TR.cards[0], 3], [TR.rule, TR.cards[1], 3], [TR.rule, TR.cards[2], 3],
    [TR.cards[0], TR.cards[0].expert, 3], [TR.cards[1], TR.cards[1].expert, 3], [TR.cards[2], TR.cards[2].expert, 3],
    [TR.cards[0], TR.caseS, 4], [TR.cards[2], TR.caseC, 4],
    [TR.caseS, TR.gap, 5], [TR.caseC, TR.gap, 5], [TR.rule, TR.gap, 5, true]
  ];
  const STEPS = [
    { rule: 1, hl: ['facts'], txt: () => 'BP fact “Company A · pilot with 2 customers” (self-reported, p.4) lights up; provenance → source ¶ p.4' },
    { rule: 2, hl: ['slots'], txt: () => 'Fact binds slot market.contracts — the machine-compiled binding is not yet expert-confirmed' },
    { rule: 0, hl: ['rules'], txt: () => 'IF-THEN rule fires in three-valued logic: acceptance evidence is missing → UNKNOWN, not FALSE' },
    { rule: 3, hl: ['cards', 'experts'], txt: () => 'Rule reaches decision cards of three experts: ' + TR.cards.map(c => c.expert.label).join(' · ') },
    { rule: 2, hl: ['cases', 'links'], txt: () => 'Case links: one supporting case and one counter-example are attached to those cards' },
    { rule: 0, hl: ['criteria'], txt: () => 'Evidence gap → follow-up question: “Request customer acceptance report for both pilots”' }
  ];
  const TR_T0 = 1.0, TR_STEP = 1.8, TR_LEN = 14;

  /* ---------------- pipeline stages ---------------- */
  const LANES = [
    { t: 'DETERMINISTIC · no LLM', col: ACC },
    { t: 'PARALLEL · 4 MODEL STAGES', col: C.amber },
    { t: 'LINK · SYNTHESIZE · VERIFY', col: C.mint },
    { t: 'PREFERENCE · SENSITIVITY · CARDS', col: C.gold }
  ];
  const S = [
    { n: 'Freeze facts', tech: 'fact pool · page + quote', ts: 'fact pool', lane: 0, rule: 1, hl: ['facts'], note: 'pilot: 2 customers → self-reported',
      desc: 'Freeze the BP facts, each with page and quote; tag self-reported / forecast / conflict / derived' },
    { n: 'Execute rules', tech: 'rule engine · 3-valued', ts: 'rules · 3-valued', lane: 0, rule: 0, hl: ['rules', 'slots'], note: 'R-pilot → UNKNOWN (no acceptance)',
      desc: 'Run expert and industry rules in three-valued logic; missing, conflicting or forecast-only facts stay UNKNOWN' },
    { n: 'Policy context', tech: 'policy library · background only', ts: 'policy · background', lane: 0, rule: 2, hl: [], note: 'context only, never a conclusion',
      desc: 'Attach policy context as background — “policy-related” is never treated as “company benefits”' },
    { n: 'Expert criteria · 5 dims', tech: 'Qwen flash · atomic questions', ts: 'Qwen flash', lane: 1, rule: 3, hl: ['criteria', 'statements', 'cards'], note: '393 criteria, cited by fact ID',
      desc: 'Match the plan against 393 expert criteria; the model answers atomic questions and must cite fact IDs' },
    { n: 'Analogous cases', tech: 'pgvector + BM25 → RRF · rerank', ts: 'pgvector+BM25→RRF', lane: 1, rule: 2, hl: ['cases', 'links'], note: 'supporting + counter-example',
      desc: 'Retrieve analogous cases: BM25 + pgvector (bge-m3) → RRF fusion → reranker' },
    { n: 'Out-of-dimension tags', tech: 'Qwen flash · open tags', ts: 'Qwen flash', lane: 1, rule: 0, hl: [], note: 'signals outside the 5 dims',
      desc: 'Keep information that falls outside the 5 × 25 framework as open candidate tags' },
    { n: 'Knock-out / strong signal', tech: 'Qwen max · R01–R12 · H01–H05', ts: 'Qwen max', lane: 1, rule: 0, hl: ['criteria'], note: 'hits re-checked by a 2nd model',
      desc: 'Screen 12 knock-out reasons and 5 strong signals; every hit is re-checked by the verifier' },
    { n: 'Link cases', tech: 'case links · deterministic', ts: 'case links', lane: 2, rule: 2, hl: ['cases', 'links'], note: 'support + counter-example',
      desc: 'Attach supporting cases and counter-examples to each judgement' },
    { n: 'Synthesis', tech: 'Qwen max · frozen evidence IDs', ts: 'Qwen max', lane: 2, rule: 1, hl: [], note: 'cites frozen IDs only · no score',
      desc: 'Write highlights, weaknesses, risks, gaps and diligence questions — citing only frozen evidence IDs' },
    { n: 'Cross-verify', tech: 'ID & number checks → DeepSeek → ×1 rewrite', ts: 'checks → DeepSeek', lane: 2, rule: 1, hl: [], note: 'partly supported → toned down',
      desc: 'Program checks (IDs exist, numbers sourced, wording) then a different model family verifies; partly supported claims are rewritten once and re-checked' },
    { n: 'Expert preference', tech: 'S / O / U / A · open N, D, A', ts: 'S/O/U/A count', lane: 3, rule: 3, hl: ['experts', 'cards'], note: 'not a funding probability',
      desc: 'Count de-duplicated experts as Support / Oppose / Unknown / N-A, with the denominators shown' },
    { n: 'Evidence sensitivity', tech: 'one fact → how many rules', ts: 'sensitivity', lane: 3, rule: 0, hl: ['rules'], note: 'ask next: acceptance report',
      desc: 'Rank the missing facts by how many rules each would decide — the next diligence question' },
    { n: 'Expert reasoning cards', tech: 'conflicts · missing thresholds', ts: 'reasoning cards', lane: 3, rule: 2, hl: ['experts'], note: 'back to experts to confirm',
      desc: 'Surface rule conflicts and missing thresholds as cards for experts to confirm' },
    { n: 'Coverage map', tech: '25 sub-dims · covered / thin / blind', ts: 'coverage map', lane: 3, rule: 0, hl: ['criteria'], note: 'blind spots made visible',
      desc: 'Show which of the 25 sub-dimensions are covered, thin or blind for this plan' }
  ];
  const TIERS = [
    { en: 'Follow up', zh: '值得继续跟进', col: C.mint },
    { en: 'Verify first', zh: '先核实关键问题', col: C.gold },
    { en: 'Can wait', zh: '可暂缓', col: C.rose }
  ];
  const PSTEPS = [[0, 1.0], [1, .8], [2, 1.2], [[3, 4, 5, 6], 2.0], [7, 1.1], [8, 1.0], [9, 1.2], [10, 1.0], [11, 1.0], [12, 1.2], [13, 1.2], [-1, 2.2]]
    .map(a => ({ st: Array.isArray(a[0]) ? a[0] : a[0] < 0 ? [] : [a[0]], d: a[1] }));
  let PLEN = 0;
  PSTEPS.forEach(s => { s.t0 = PLEN; PLEN += s.d; });
  const stepOf = new Array(14);
  PSTEPS.forEach((s, i) => s.st.forEach(x => { stepOf[x] = i; }));
  const EDGES_P = [[0, 1], [1, 2], [2, 3], [2, 4], [2, 5], [2, 6], [3, 7], [4, 7], [5, 7], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14]];

  /* ---------------- state ---------------- */
  let mode = 'graph', mix = 0, paused = false;
  let gc = T.REDUCE ? 9.2 : 0, pc = 0, rot = .5;
  let dragRY = 0, dragRX = 0, dragging = false, dragMoved = false, lastPX = 0, lastPY = 0;
  let mx = -1, my = -1, sel = null, hoverStage = -1;
  const lv = new Array(14).fill(0);
  let vLv = 0;
  const order = N.slice();
  let compact = false, vertical = false;
  let pipeH = 740, rects = [], vRect = null, pedges = [], lanesGeom = [];

  /* ---------------- helpers ---------------- */
  function fit(s, maxW, font) {
    ctx.font = font;
    if (ctx.measureText(s).width <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
    return s.slice(0, lo) + '…';
  }
  const sm = x => x * x * (3 - 2 * x);

  /* ---------------- controls ---------------- */
  const modeChips = T.chips(fig.controls, 'View', [
    { key: 'graph', label: 'Evidence graph' }, { key: 'pipe', label: 'Reasoning pipeline' }
  ], setMode, 'graph');
  const gPlay = T.group(fig.controls, 'Playback');
  const btnPause = T.button(gPlay, 'Pause', () => { paused = !paused; btnPause.textContent = paused ? 'Play' : 'Pause'; });
  T.button(gPlay, 'Step ▸', stepNext, { title: 'Jump to the next step and pause' });
  T.button(gPlay, 'Restart', () => { gc = 0; pc = 0; paused = false; btnPause.textContent = 'Pause'; });
  const hint = document.createElement('span');
  hint.className = 'tv-glab';
  hint.textContent = 'drag to rotate · hover for provenance';
  fig.controls.append(hint);

  function setMode(k) {
    if (k === mode) return;
    mode = k; modeChips.set(k, false);
    pA.classList.add('bz-out'); pB.classList.add('bz-out');
    setTimeout(() => { root.dataset.bz = mode; pA.classList.remove('bz-out'); pB.classList.remove('bz-out'); }, 280);
    hint.textContent = mode === 'graph' ? 'drag to rotate · hover for provenance' : 'hover a stage · click to jump';
    fig.canvas.style.touchAction = mode === 'graph' ? 'pan-y' : 'manipulation';
    sel = null; applyHeight();
    if (T.REDUCE) loop.redraw();
  }
  function stepNext() {
    paused = true; btnPause.textContent = 'Play';
    if (mode === 'graph') {
      const u = gc % TR_LEN, base = gc - u;
      const cur = u < TR_T0 ? -1 : Math.min(5, Math.floor((u - TR_T0) / TR_STEP));
      gc = cur >= 5 ? base + TR_LEN + TR_T0 + .9 : base + TR_T0 + (cur + 1) * TR_STEP + .9;
    } else {
      const u = pc % PLEN; let cur = 0;
      PSTEPS.forEach((s, i) => { if (u >= s.t0) cur = i; });
      pc = (pc - u) + (cur + 1 >= PSTEPS.length ? PLEN : PSTEPS[cur + 1].t0) + .02;
    }
    if (T.REDUCE) loop.redraw();
  }
  function applyHeight() {
    const wantVert = fig.w && fig.w < 900;
    const h = mode === 'pipe' ? (wantVert ? pipeH : 580) : (fig.w && fig.w < 640 ? 540 : 580);
    fig.stage.style.setProperty('--tv-h', h + 'px');
  }

  /* ---------------- pointer ---------------- */
  T.pointer(fig.canvas, {
    move(x, y) { mx = x; my = y; },
    leave() { mx = my = -1; },
    click(x, y) {
      if (dragMoved) return;
      if (mode === 'graph') { sel = pickNode(x, y); }
      else { const i = stageAt(x, y); if (i >= 0) { pc = PSTEPS[stepOf[i]].t0 + .05; } }
    }
  });
  fig.canvas.addEventListener('pointerdown', e => {
    if (mode !== 'graph') return;
    dragging = true; dragMoved = false; lastPX = e.clientX; lastPY = e.clientY;
    try { fig.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  fig.canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    dragRY += dx * .008; dragRX = clamp(dragRX + dy * .006, -.7, .7);
    lastPX = e.clientX; lastPY = e.clientY;
    if (T.REDUCE) loop.redraw();
  });
  const endDrag = () => { dragging = false; setTimeout(() => { dragMoved = false; }, 0); };
  fig.canvas.addEventListener('pointerup', endDrag);
  fig.canvas.addEventListener('pointercancel', endDrag);

  /* ================================================================
     GRAPH
     ================================================================ */
  let GS = 1, GF = 1, GZ = 1, GCX = 0, GCY = 0, GRY = 0, GRX = .3;
  function project() {
    for (let i = 0; i < N.length; i++) {
      const n = N[i];
      const q = T.proj({ x: n.x * GS, y: n.y * GS, z: n.z * GS }, GRY, GRX, GCX, GCY, GF);
      n.sx = q.x; n.sy = q.y; n.ss = q.s; n.sz = q.z;
    }
    order.sort((a, b) => b.sz - a.sz);
  }
  const depth = n => clamp((n.sz + GZ) / (2 * GZ), 0, 1);
  function pickNode(x, y) {
    let best = null, bd = 1e9;
    for (let i = order.length - 1; i >= 0; i--) {
      const n = order[i], d = Math.hypot(n.sx - x, n.sy - y), th = n.r * n.ss + 7;
      if (d < th && d < bd) { bd = d; best = n; }
    }
    return best;
  }
  function traceState() {
    const u = gc % TR_LEN;
    const focus = clamp((u - .3) / .7, 0, 1) * clamp((TR_LEN - u) / .8, 0, 1);
    const step = u < TR_T0 ? -1 : Math.min(5, Math.floor((u - TR_T0) / TR_STEP));
    return { u, focus, step, el: step < 0 ? 0 : (u - TR_T0) - step * TR_STEP };
  }

  let placed = [];
  function place(text, x, y, o) {
    o = o || {};
    const font = F(o.size || 10.5, o.weight || 400);
    ctx.font = font;
    const maxW = o.maxW || Math.max(80, fig.w - 24);
    text = fit(text, maxW - 14, font);
    const tw = ctx.measureText(text).width + 14, h = 20;
    let px = x + (o.dx == null ? 12 : o.dx);
    if (px + tw > fig.w - 8) px = x - (o.dx == null ? 12 : o.dx) - tw;
    px = clamp(px, 6, Math.max(6, fig.w - tw - 6));
    let py = y - 10 + (o.dy || 0);
    for (let k = 0; k < 8; k++) {
      let hit = false;
      for (const r of placed) if (px < r.x + r.w + 2 && px + tw + 2 > r.x && py < r.y + r.h + 2 && py + h + 2 > r.y) { hit = true; py = r.y + r.h + 3; break; }
      if (!hit) break;
    }
    py = clamp(py, 4, fig.h - h - 4);
    placed.push({ x: px, y: py, w: tw, h });
    T.rrect(ctx, px, py, tw, h, 10);
    ctx.fillStyle = 'rgba(15,13,10,.88)'; ctx.fill();
    ctx.strokeStyle = rgba(o.color || ACC, o.bo == null ? .55 : o.bo); ctx.lineWidth = 1; ctx.stroke();
    ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = o.tc || C.ink;
    ctx.fillText(text, px + 7, py + h / 2 + .5);
    return { x: px, y: py, w: tw, h };
  }

  function drawGraph(A, t, dt) {
    const w = fig.w, h = fig.h;
    compact = w < 640;
    GS = Math.min(w * (compact ? .43 : .36), h * (compact ? .52 : .74));
    GF = GS * 2.6; GZ = GS * .85; GCX = w / 2; GCY = h / 2 + (compact ? -6 : -4);
    GRY = rot + dragRY; GRX = .5 + dragRX;
    project();
    placed.length = 0;
    const ts = traceState();
    const focus = ts.focus;
    const step = ts.step;
    const hov = (mix < .5 && mx >= 0 && !dragging) ? pickNode(mx, my) : null;
    const act = sel || hov;

    // edges in three depth buckets
    ctx.lineWidth = 1;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        const d = (depth(e.a) + depth(e.b)) / 2, bk = d < .38 ? 0 : d < .62 ? 1 : 2;
        if (bk !== b) continue;
        ctx.moveTo(e.a.sx, e.a.sy); ctx.lineTo(e.b.sx, e.b.sy);
      }
      ctx.strokeStyle = 'rgba(236,224,200,1)';
      ctx.globalAlpha = A * (b === 0 ? .15 : b === 1 ? .09 : .05) * (1 - .55 * focus);
      ctx.stroke();
    }
    if (act) {
      ctx.beginPath();
      act.adj.forEach(n => { ctx.moveTo(act.sx, act.sy); ctx.lineTo(n.sx, n.sy); });
      ctx.strokeStyle = rgba(act.col, 1); ctx.globalAlpha = A * .7; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;
    }

    // trace edges (under nodes)
    if (focus > .01 && step >= 0) {
      for (let i = 0; i < TE.length; i++) {
        const e = TE[i];
        if (step < e[2]) continue;
        const cur = step === e[2];
        const p = cur ? T.ease.out(clamp(ts.el / .7, 0, 1)) : 1;
        const x2 = lerp(e[0].sx, e[1].sx, p), y2 = lerp(e[0].sy, e[1].sy, p);
        ctx.beginPath(); ctx.moveTo(e[0].sx, e[0].sy); ctx.lineTo(x2, y2);
        const dash = !!e[3];
        if (dash) ctx.setLineDash([4, 4]);
        const colr = e[1] === TR.gap || e[0] === TR.gap ? C.ember : ACC;
        ctx.strokeStyle = rgba(colr, 1); ctx.globalAlpha = A * focus * (cur ? .95 : .55); ctx.lineWidth = cur ? 1.8 : 1.3; ctx.stroke();
        ctx.setLineDash([]); ctx.lineWidth = 1;
        if (cur && ts.el < 1.6) {
          ctx.globalAlpha = A * focus;
          const a = e[0], b = e[1];
          T.flow(ctx, u => ({ x: lerp(a.sx, b.sx, u), y: lerp(a.sy, b.sy, u) }), t, { n: 2, speed: .8, color: colr, size: 2.1 });
        }
      }
    }

    // nodes, far → near
    for (let i = 0; i < order.length; i++) {
      const n = order[i], d = depth(n);
      const trace = n.tstep >= 0;
      let lit = false, lev = 0;
      if (trace && focus > .01 && step >= n.tstep) {
        lit = true; lev = step > n.tstep ? 1 : clamp((ts.el - .35) / .35, 0, 1);
      }
      const isAct = n === act;
      let al = lerp(1, .38, d) * (1 - .6 * focus * (trace ? 0 : 1));
      const r = n.r * n.ss * (n.type === 'hub' ? 1 : 1);
      ctx.globalAlpha = A;
      if (lit && lev > .02) {
        const cur = step === n.tstep && ts.el < 1.7;
        T.node(ctx, n.sx, n.sy, Math.max(6, r * 1.9), n.col, { active: lev > .6, level: .35 + .65 * lev, ring: cur ? t : 0 });
      } else if (isAct) {
        T.node(ctx, n.sx, n.sy, Math.max(4.5, r * 1.4), n.col, { active: true });
      } else if (n.type === 'hub') {
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, TAU);
        ctx.fillStyle = rgba(ACC, .22 * al + .05); ctx.fill();
        ctx.strokeStyle = rgba('#f4eee2', .75 * al); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r * .38, 0, TAU); ctx.fillStyle = rgba('#f4eee2', .85 * al); ctx.fill();
        ctx.lineWidth = 1;
      } else {
        ctx.beginPath();
        if (n.type === 'gap') { ctx.moveTo(n.sx, n.sy - r * 1.1); ctx.lineTo(n.sx + r * 1.1, n.sy); ctx.lineTo(n.sx, n.sy + r * 1.1); ctx.lineTo(n.sx - r * 1.1, n.sy); ctx.closePath(); }
        else ctx.arc(n.sx, n.sy, r, 0, TAU);
        ctx.fillStyle = rgba(n.col, .5 * al); ctx.fill();
        ctx.strokeStyle = rgba(n.col, .9 * al); ctx.stroke();
      }
    }

    // hub + expert labels
    ctx.globalAlpha = A;
    for (let i = 0; i < DIMS.length; i++) {
      const n = DIMS[i].node, d = depth(n);
      const a = lerp(1, .4, d) * (1 - .35 * focus);
      ctx.globalAlpha = A * a;
      const txt = compact ? DIMS[i].en.replace('Risk & Compliance', 'Risk') .replace('Tech & Product', 'Tech') : DIMS[i].en + ' · ' + DIMS[i].zh;
      T.label(ctx, txt, n.sx, n.sy + 17 * Math.max(.8, n.ss), { align: 'center', size: compact ? 10 : 11, weight: 500, color: C.ink, pill: 'rgba(15,13,10,.72)', border: rgba(ACC, .4), pad: 6 });
    }
    if (!compact) {
      ctx.font = F(9.5, 400);
      for (let i = 0; i < experts.length; i++) {
        const n = experts[i], d = depth(n);
        if (d > .8) continue;
        ctx.globalAlpha = A * lerp(.9, .35, d) * (n.tstep >= 0 && focus > .1 && step >= 3 ? 0 : 1) * (1 - .4 * focus);
        ctx.fillStyle = C.plum; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(n.label, n.sx + n.r * n.ss + 4, n.sy + .5);
      }
    }
    ctx.globalAlpha = A;

    // trace call-outs
    if (focus > .02 && step >= 0) {
      ctx.globalAlpha = A * focus;
      const full = !compact;
      const L = (n, short, fullTxt, o) => {
        if (step < n.tstep) return;
        const curStep = step === n.tstep;
        if (curStep && ts.el < .5) return;
        place(curStep && full ? fullTxt : short, n.sx, n.sy, Object.assign({ color: n.col, bo: curStep ? .8 : .35, tc: curStep ? C.ink : C.dim, maxW: Math.min(fig.w - 20, 470) }, o || {}));
      };
      L(TR.fact, 'BP fact', 'BP fact · Company A · pilot with 2 customers (self-reported, p.4)', { dy: -18 });
      L(TR.para, 'source ¶ p.4', 'source ¶ p.4', { dy: 8 });
      L(TR.slot, 'slot', 'slot · market.contracts');
      if (step >= 2 && !(step === 2 && ts.el < .5)) {
        // three-valued pill
        const n = TR.rule, cur = step === 2, x = n.sx + 14, y = n.sy - 12;
        const segs = ['TRUE', 'FALSE', 'UNKNOWN'];
        ctx.font = F(9.5, 500);
        const wd = segs.map(s => ctx.measureText(s).width + 12);
        const total = wd[0] + wd[1] + wd[2] + 4;
        const px = x + total > fig.w - 6 ? n.sx - 14 - total : x;
        let ox = px;
        placed.push({ x: px, y: y - 2, w: total, h: 22 });
        segs.forEach((s, i) => {
          const on = i === 2;
          T.rrect(ctx, ox, y, wd[i], 18, 9);
          ctx.fillStyle = on ? rgba(C.gold, cur ? .95 : .75) : 'rgba(15,13,10,.85)'; ctx.fill();
          ctx.strokeStyle = rgba(C.gold, on ? 1 : .3); ctx.stroke();
          ctx.fillStyle = on ? '#15110b' : C.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(s, ox + wd[i] / 2, y + 9.5);
          ox += wd[i] + 2;
        });
      }
      TR.cards.forEach(c => L(c, c.expert.label, c.expert.label + ' · decision card'));
      L(TR.caseS, 'supporting', 'supporting case', { dy: -6 });
      L(TR.caseC, 'counter-ex.', 'counter-example case', { dy: 6 });
      L(TR.gap, 'evidence gap', 'evidence gap → follow-up question', { color: C.ember, dy: -8 });
      ctx.globalAlpha = A;
    }

    // hover / selection tooltip
    if (act) {
      const ty = TYPES[act.type];
      const txt = ty.name.toUpperCase() + '  ·  ' + act.label;
      const font = F(10.5, 400);
      const maxW = Math.min(fig.w - 16, 460);
      place(txt, act.sx, act.sy, { color: act.col, bo: .9, tc: C.ink, dy: -22, maxW });
    }

    // legend + caption
    ctx.globalAlpha = A;
    if (w >= 900) {
      ctx.font = F(10, 400);
      LEG.forEach((k, i) => {
        const y = h - 16 - (LEG.length - 1 - i) * 17;
        ctx.beginPath(); ctx.arc(22, y, 3.4, 0, TAU); ctx.fillStyle = rgba(TYPES[k].col, .85); ctx.fill();
        ctx.fillStyle = C.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(TYPES[k].leg, 34, y + .5);
      });
    }
    drawCaption(A, step >= 0 && focus > .1 ? STEPS[step].txt() : 'Evidence graph · ~' + N.length + ' nodes shown, clustered around the five dimensions · a query trace replays every ' + TR_LEN + ' s', step >= 0 ? STEPS[step].rule : -1, step >= 0 ? step + 1 : 0, 6);
    if (focus > .1 && step >= 0) setHL(STEPS[step].hl, STEPS[step].rule); else setHL([], -1);
  }

  /* caption bar used by the graph view (bottom centre) */
  function drawCaption(A, text, rule, k, n) {
    const w = fig.w, h = fig.h;
    const bw = Math.min(w - 24, w >= 900 ? 780 : 640);
    const x = (w - bw) / 2;
    ctx.font = F(11, 400);
    const lines = T.wrap(ctx, text, bw - 24).slice(0, 3);
    const bh = 36 + lines.length * 15 + (compact && rule >= 0 ? 16 : 0);
    const y = h - bh - 12;
    ctx.globalAlpha = A;
    T.rrect(ctx, x, y, bw, bh, 8);
    ctx.fillStyle = 'rgba(15,13,10,.86)'; ctx.fill();
    ctx.strokeStyle = rgba(ACC, .28); ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let hx = x + 12;
    if (k > 0) {
      for (let i = 0; i < n; i++) {
        T.rrect(ctx, hx + i * 11, y + 12, 8, 3, 1.5);
        ctx.fillStyle = i < k ? rgba(ACC, i === k - 1 ? 1 : .55) : rgba(C.faint, .5); ctx.fill();
      }
      hx += n * 11 + 6;
    }
    ctx.font = F(9.5, 500); ctx.fillStyle = ACC;
    ctx.fillText(k > 0 ? 'QUERY TRACE \u00b7 STEP ' + k + '/' + n : 'EVIDENCE GRAPH', hx, y + 14);
    ctx.font = F(11, 400); ctx.fillStyle = C.soft;
    lines.forEach((ln, i) => ctx.fillText(ln, x + 12, y + 34 + i * 15));
    if (compact && rule >= 0) {
      ctx.font = F(9.5, 400); ctx.fillStyle = C.dim;
      ctx.fillText('rule \u00b7 ' + RULES[rule][0], x + 12, y + bh - 11);
    }
  }

  /* ================================================================
     PIPELINE
     ================================================================ */
  function layoutPipe(w, h) {
    vertical = w < 900;
    rects = []; lanesGeom = []; pedges = []; vRect = null;
    if (vertical) {
      const pad = 14, rw = Math.min(w - 2 * pad, 640), x0 = (w - rw) / 2;
      let y = 12;
      for (let l = 0; l < 4; l++) {
        const idx = S.map((s, i) => i).filter(i => S[i].lane === l);
        const lh = 22 + idx.length * 35 + (l === 3 ? 50 : 0) + 4;
        lanesGeom.push({ x: x0, y, w: rw, h: lh, lane: l });
        let yy = y + 24;
        idx.forEach(i => { rects[i] = { x: x0 + 8, y: yy, w: rw - 16, h: 31 }; yy += 35; });
        if (l === 3) vRect = { x: x0 + 8, y: yy, w: rw - 16, h: 44 };
        y += lh + 8;
      }
      pipeH = Math.ceil(y + 72 + 6);
      return;
    }
    const pad = 22, gap = w < 1100 ? 28 : 44, lw = (w - 2 * pad - 3 * gap) / 4;
    const top = 12, laneH = h - 206 - top, y0 = top + 38, avail = laneH - 38 - 8, gy = 10;
    const ch = clamp((avail - 3 * gy) / 4, 64, 90), ins = 10;
    const cols = [[0, 1, 2], [3, 4, 5, 6], [7, 8, 9, 10], [11, 12, 13]];
    for (let l = 0; l < 4; l++) {
      const x = pad + l * (lw + gap);
      lanesGeom.push({ x, y: top, w: lw, h: laneH, lane: l });
      const off = l === 0 ? .5 : 0;
      cols[l].forEach((si, k) => { rects[si] = { x: x + ins, y: y0 + (k + off) * (ch + gy), w: lw - 2 * ins, h: ch }; });
      if (l === 3) vRect = { x: x + ins, y: y0 + 3 * (ch + gy), w: lw - 2 * ins, h: ch };
    }
    EDGES_P.forEach(([a, b]) => {
      const ra = rects[a], rb = b === 14 ? vRect : rects[b];
      let q;
      if (Math.abs(ra.x - rb.x) < 2) {                      // same lane: straight down
        const x = ra.x + ra.w / 2, y1 = ra.y + ra.h, y2 = rb.y;
        q = { x1: x, y1, x2: x, y2, c1x: x, c1y: y1 + (y2 - y1) / 3, c2x: x, c2y: y1 + (y2 - y1) * 2 / 3, dir: 'v' };
      } else {
        const x1 = ra.x + ra.w, y1 = ra.y + ra.h / 2, x2 = rb.x, y2 = rb.y + rb.h / 2, dx = (x2 - x1) * .5;
        q = { x1, y1, x2, y2, c1x: x1 + dx, c1y: y1, c2x: x2 - dx, c2y: y2, dir: 'h' };
      }
      pedges.push({ a, b, q });
    });
  }
  function cubPt(q, u) {
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return { x: a * q.x1 + b * q.c1x + c * q.c2x + d * q.x2, y: a * q.y1 + b * q.c1y + c * q.c2y + d * q.y2 };
  }
  function stageAt(x, y) {
    if (mode !== 'pipe') return -1;
    for (let i = 0; i < rects.length; i++) { const r = rects[i]; if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; }
    return -1;
  }

  function pipeState() {
    const u = pc % PLEN; let cur = 0;
    for (let i = 0; i < PSTEPS.length; i++) if (u >= PSTEPS[i].t0) cur = i;
    return { cur, el: u - PSTEPS[cur].t0 };
  }

  function drawPipe(A, t, dt) {
    const w = fig.w, h = fig.h;
    const ps = pipeState(), cur = ps.cur;
    hoverStage = (mix > .5 && mx >= 0) ? stageAt(mx, my) : -1;
    const active = [];
    for (let i = 0; i < 14; i++) {
      const state = cur > stepOf[i] ? 2 : cur === stepOf[i] ? 1 : 0;
      const target = state === 1 ? 1 : state === 2 ? .16 : 0;
      lv[i] = dt === 0 ? target : lv[i] + (target - lv[i]) * Math.min(1, dt * 9);
      S[i].state = state;
      if (state === 1) active.push(i);
    }
    const fin = cur === PSTEPS.length - 1;
    vLv = dt === 0 ? (fin ? 1 : 0) : vLv + ((fin ? 1 : 0) - vLv) * Math.min(1, dt * 7);

    // lanes
    ctx.globalAlpha = A;
    lanesGeom.forEach(g => {
      const col = LANES[g.lane].col;
      T.rrect(ctx, g.x, g.y, g.w, g.h, 12);
      ctx.fillStyle = rgba(col, .035); ctx.fill();
      ctx.strokeStyle = rgba(col, .16); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = F(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(col, .9);
      ctx.fillText(fit(LANES[g.lane].t, g.w - 24, F(10, 500)), g.x + 12, g.y + 17);
    });

    // edges (desktop)
    if (!vertical) {
      pedges.forEach(e => {
        const q = e.q, bAct = e.b === 14 ? fin : S[e.b].state === 1, aDone = S[e.a].state >= 1;
        ctx.beginPath(); ctx.moveTo(q.x1, q.y1); ctx.bezierCurveTo(q.c1x, q.c1y, q.c2x, q.c2y, q.x2, q.y2);
        ctx.strokeStyle = rgba(ACC, 1);
        ctx.globalAlpha = A * (bAct ? .85 : aDone ? .45 : .14);
        ctx.lineWidth = bAct ? 1.6 : 1.1; ctx.stroke(); ctx.lineWidth = 1;
        // arrow head
        ctx.globalAlpha = A * (bAct ? .9 : aDone ? .55 : .25);
        ctx.beginPath();
        if (q.dir === 'v') { ctx.moveTo(q.x2 - 3.5, q.y2 - 6); ctx.lineTo(q.x2 + 3.5, q.y2 - 6); ctx.lineTo(q.x2, q.y2 - 0.5); }
        else { ctx.moveTo(q.x2 - 6, q.y2 - 3.5); ctx.lineTo(q.x2 - 6, q.y2 + 3.5); ctx.lineTo(q.x2 - .5, q.y2); }
        ctx.closePath(); ctx.fillStyle = rgba(ACC, 1); ctx.fill();
        if (bAct) { ctx.globalAlpha = A; T.flow(ctx, u => cubPt(q, u), t, { n: 3, speed: .7, color: ACC, size: 2.2 }); }
      });
      ctx.globalAlpha = A;
    } else {
      // vertical rail
      ctx.globalAlpha = A * .5;
    }

    // stage cards
    for (let i = 0; i < 14; i++) {
      const r = rects[i], s = S[i], col = LANES[s.lane].col;
      const lev = clamp(lv[i] + (hoverStage === i ? .28 : 0), 0, 1);
      ctx.globalAlpha = A;
      if (vertical) drawRow(i, r, s, col, lev);
      else drawStageCard(i, r, s, col, lev);
    }
    drawVerdict(A, vLv, vertical);
    ctx.globalAlpha = A;

    // "now" panel
    const idx = active.length ? active[0] : 13;
    const rule = fin ? 2 : S[idx].rule;
    if (!vertical) drawNow(A, cur, fin, active, idx);
    else drawNowCompact(A, cur, fin, active, idx, rule);
    if (cur < PSTEPS.length) {
      let hl = [];
      active.forEach(a => { hl = hl.concat(S[a].hl); });
      if (fin) hl = ['experts'];
      setHL(hl, rule);
    }

    // hover tooltip
    if (hoverStage >= 0) {
      const r = rects[hoverStage];
      ctx.globalAlpha = A;
      place(S[hoverStage].desc, r.x + r.w * .5, r.y + r.h + 8, { dx: -r.w * .5 + 6, dy: 0, color: LANES[S[hoverStage].lane].col, bo: .8, maxW: Math.min(w - 16, 560), tc: C.ink });
    }
  }

  function drawStageCard(i, r, s, col, lev) {
    T.card(ctx, r.x, r.y, r.w, r.h, { color: col, level: lev });
    const done = s.state === 2, on = lev > .5;
    // badge
    ctx.font = F(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(col, .6 + .4 * lev);
    ctx.fillText('S' + (i + 1), r.x + 14, r.y + 17);
    ctx.font = F(12.5, 600, 'sans'); ctx.fillStyle = on ? C.ink : (done ? C.soft : C.soft);
    ctx.fillText(fit(s.n, r.w - 60, F(12.5, 600, 'sans')), r.x + 38, r.y + 17);
    if (done) {
      ctx.strokeStyle = rgba(C.mint, .8); ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(r.x + r.w - 20, r.y + 17); ctx.lineTo(r.x + r.w - 16.5, r.y + 20.5); ctx.lineTo(r.x + r.w - 11, r.y + 13.5); ctx.stroke(); ctx.lineWidth = 1;
    }
    ctx.font = F(10.5, 400); ctx.fillStyle = on ? rgba(col, 1) : C.dim;
    ctx.fillText(fit(s.tech, r.w - 28, F(10.5, 400)), r.x + 14, r.y + 38);
    if (r.h >= 66) {
      const vis = clamp(lv[i] * 3 + (done ? 1 : 0), 0, 1);
      if (vis > .02) {
        ctx.globalAlpha *= vis;
        ctx.font = F(10, 400); ctx.fillStyle = on ? C.soft : C.dim;
        ctx.fillText(fit(s.note, r.w - 28, F(10, 400)), r.x + 14, r.y + 57);
        ctx.globalAlpha /= vis;
      }
    }
  }
  function drawRow(i, r, s, col, lev) {
    T.card(ctx, r.x, r.y, r.w, r.h, { color: col, level: lev, r: 7 });
    const on = lev > .5, done = s.state === 2;
    ctx.font = F(10, 500); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(col, .6 + .4 * lev);
    ctx.fillText('S' + (i + 1), r.x + 12, r.y + r.h / 2 + .5);
    const tf = F(12, 600, 'sans');
    ctx.font = tf; const tw = Math.min(ctx.measureText(S[i].n).width, r.w - 120);
    ctx.fillStyle = on ? C.ink : C.soft;
    ctx.fillText(fit(s.n, r.w - 100, tf), r.x + 40, r.y + r.h / 2 + .5);
    const x2 = r.x + 40 + tw + 12, room = r.x + r.w - 12 - x2;
    if (room > 60) {
      ctx.font = F(9.5, 400); ctx.fillStyle = on ? rgba(col, 1) : C.dim; ctx.textAlign = 'right';
      ctx.fillText(fit(s.ts, room, F(9.5, 400)), r.x + r.w - 12, r.y + r.h / 2 + .5);
      ctx.textAlign = 'left';
    }
    if (done) {
      ctx.strokeStyle = rgba(C.mint, .8); ctx.lineWidth = 1.4; ctx.beginPath();
      const cx = r.x + r.w - 6, cy = r.y + 6;
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx - 2.5, cy + 2.5); ctx.lineTo(cx + 1, cy - 2.5); ctx.stroke(); ctx.lineWidth = 1;
    }
  }
  function drawVerdict(A, lev, vert) {
    const r = vRect; if (!r) return;
    const col = C.gold;
    T.card(ctx, r.x, r.y, r.w, r.h, { color: col, level: lev * .8, bar: false, r: vert ? 7 : 8 });
    const rowH = (r.h - (vert ? 8 : 14)) / 3, y0 = r.y + (vert ? 4 : 7);
    ctx.textBaseline = 'middle';
    TIERS.forEach((tr, i) => {
      const y = y0 + i * rowH + rowH / 2, hit = i === 1;
      const al = hit ? .4 + .6 * lev : .3;
      if (hit && lev > .05) {
        T.rrect(ctx, r.x + 6, y - rowH / 2 + 1, r.w - 12, rowH - 2, 5);
        ctx.fillStyle = rgba(tr.col, .16 * lev); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(r.x + 15, y, 3.2, 0, TAU);
      ctx.fillStyle = rgba(tr.col, al); ctx.fill();
      ctx.font = F(vert ? 10 : 10.5, hit ? 500 : 400); ctx.textAlign = 'left';
      ctx.fillStyle = hit && lev > .3 ? C.ink : C.dim;
      const zf = F(10, 400);
      ctx.font = zf; const zw = ctx.measureText(tr.zh).width;
      const room = r.w - 30 - zw - 12;
      ctx.font = F(vert ? 10 : 10.5, hit ? 500 : 400);
      ctx.fillText(fit(tr.en, room, ctx.font), r.x + 26, y + .5);
      ctx.font = zf; ctx.fillStyle = rgba(hit ? C.soft : C.faint, hit ? .8 : 1); ctx.textAlign = 'right';
      ctx.fillText(tr.zh, r.x + r.w - 10, y + .5);
    });
    ctx.textAlign = 'left';
  }

  function drawNow(A, cur, fin, active, idx) {
    const w = fig.w, h = fig.h;
    const x0 = 14 + 330 + 20, x1 = w - 14 - 310 - 20, bw = x1 - x0;
    if (bw < 180) return;
    const y0 = h - 14 - 168, bh = 168;
    ctx.globalAlpha = A;
    T.rrect(ctx, x0, y0, bw, bh, 10);
    ctx.fillStyle = 'rgba(18,15,11,.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(236,224,200,.1)'; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = F(9.5, 500); ctx.fillStyle = ACC;
    ctx.fillText(fin ? 'OUTPUT' : active.length > 1 ? 'NOW RUNNING · ' + active.length + ' IN PARALLEL' : 'NOW RUNNING', x0 + 14, y0 + 16);
    let title, tech, note;
    if (fin) { title = 'Screening verdict: Verify key issues first'; tech = 'three tiers · no numeric score'; note = 'A triage for the diligence team — not an investment decision. Asks for the acceptance report first.'; }
    else if (active.length > 1) { title = 'S4–S7 · expert criteria, cases, tags, knock-outs'; tech = 'Qwen flash / max · pgvector + BM25 → RRF → BGE rerank'; note = 'Four model stages read the same frozen evidence at the same time.'; }
    else { const s = S[idx]; title = 'S' + (idx + 1) + ' · ' + s.n; tech = s.tech; note = s.desc; }
    ctx.font = F(14, 600, 'sans'); ctx.fillStyle = C.ink;
    ctx.fillText(fit(title, bw - 28, F(14, 600, 'sans')), x0 + 14, y0 + 40);
    ctx.font = F(11, 400); ctx.fillStyle = ACC;
    ctx.fillText(fit(tech, bw - 28, F(11, 400)), x0 + 14, y0 + 62);
    ctx.font = F(11, 400); ctx.fillStyle = C.soft;
    const lines = T.wrap(ctx, note, bw - 28).slice(0, 3);
    lines.forEach((ln, i) => ctx.fillText(ln, x0 + 14, y0 + 86 + i * 16));
    // 12 step ticks
    const n = PSTEPS.length, tw = (bw - 28 - (n - 1) * 3) / n;
    for (let i = 0; i < n; i++) {
      T.rrect(ctx, x0 + 14 + i * (tw + 3), y0 + bh - 20, tw, 4, 2);
      ctx.fillStyle = i < cur ? rgba(ACC, .5) : i === cur ? rgba(ACC, 1) : rgba(C.faint, .5); ctx.fill();
    }
  }
  function drawNowCompact(A, cur, fin, active, idx, rule) {
    const w = fig.w, h = fig.h, bw = Math.min(w - 24, 616), x = (w - bw) / 2, bh = 62, y = h - bh - 10;
    ctx.globalAlpha = A;
    T.rrect(ctx, x, y, bw, bh, 8);
    ctx.fillStyle = 'rgba(15,13,10,.9)'; ctx.fill(); ctx.strokeStyle = rgba(ACC, .3); ctx.stroke();
    let title, note;
    if (fin) { title = 'Verdict: Verify key issues first'; note = 'three tiers, no numeric score'; }
    else if (active.length > 1) { title = 'S4–S7 in parallel'; note = 'four model stages, same frozen evidence'; }
    else { title = 'S' + (idx + 1) + ' · ' + S[idx].n; note = S[idx].desc; }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = F(12, 600, 'sans'); ctx.fillStyle = C.ink; ctx.fillText(fit(title, bw - 24, F(12, 600, 'sans')), x + 12, y + 15);
    ctx.font = F(10, 400); ctx.fillStyle = C.soft; ctx.fillText(fit(note, bw - 24, F(10, 400)), x + 12, y + 33);
    ctx.fillStyle = C.dim; ctx.fillText(fit('rule · ' + RULES[rule][0], bw - 24, F(10, 400)), x + 12, y + 50);
  }

  /* ================================================================
     LOOP
     ================================================================ */
  let lastMode = '';
  const loop = T.run(fig, {
    still: 9.2,
    resize(w, h) {
      root.dataset.bzc = ((mode === 'graph' && w < 760) || (mode === 'pipe' && w < 900)) ? '1' : '0';
      layoutPipe(w, h);
      applyHeight();
    },
    draw(t, dt) {
      frame(t, dt);
    }
  });
  function frame(t, dt) {
      const w = fig.w, h = fig.h;
      if (!T.REDUCE) {
        rot += dt * .1;
        if (!paused) { gc += dt; pc += dt; }
      }
      const tgt = mode === 'pipe' ? 1 : 0;
      mix = dt === 0 ? tgt : clamp(mix + Math.sign(tgt - mix) * dt / .55, Math.min(mix, tgt), Math.max(mix, tgt));
      const bzc = ((mode === 'graph' && w < 760) || (mode === 'pipe' && w < 900)) ? '1' : '0';
      if (root.dataset.bzc !== bzc) root.dataset.bzc = bzc;
      if (root.dataset.bz === undefined) root.dataset.bz = mode;
      if ((w < 900) !== vertical) { layoutPipe(w, h); applyHeight(); }
      T.bg(ctx, w, h, { tint: ACC, tx: .85, ty: .1 });
      ctx.textAlign = 'left';
      if (mix < .999) drawGraph(1 - mix, t, dt);
      if (mix > .001) drawPipe(mix, t, dt);
      ctx.globalAlpha = 1;
      fig.canvas.style.cursor = mode === 'graph' ? (dragging ? 'grabbing' : 'grab') : (hoverStage >= 0 ? 'pointer' : 'default');
  }
})();
