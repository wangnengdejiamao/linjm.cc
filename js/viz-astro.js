/* viz-astro.js — Fig A·2 · 星图 Astro Studio: topic → constrained plan → archives → analysis.
   Schematic replay of a platform run; target and plots are illustrative. */
(function () {
  'use strict';
  const root = document.getElementById('astroStudio');
  if (!root || !window.TV) return;
  const T = window.TV, C = T.C, TAU = T.TAU, clamp = T.clamp, ease = T.ease, rgba = T.rgba;

  const fig = T.mount(root, {
    domain: 'astro',
    kicker: 'Fig A·2 — 星图 Astro Studio · topic → constrained plan → archives → analysis',
    status: 'schematic replay · illustrative data',
    stack: ['FastAPI', 'astropy', 'astroquery', 'galpy', 'scipy', 'scikit-learn', 'ECharts', 'Aladin Lite', 'Preact + htm', 'DeepSeek planner'],
    note: 'Schematic replay of a platform run · target and plots illustrative',
    height: 580,
    aria: 'Animated schematic of the Astro Studio research workbench: a query is turned into a constrained pipeline plan, steps query astronomy archives, and result cards render as steps complete.',
    controls: true
  });
  const ctx = fig.ctx;

  /* scoped CSS */
  const st = document.createElement('style');
  st.id = 'astroStudioCss';
  st.textContent =
    '#astroStudio .tv-log{max-height:none}' +
    '#astroStudio .tv-log div{white-space:pre}' +
    '#astroStudio .as-panel{padding:.55rem .8rem}' +
    '#astroStudio .as-facts{display:flex;justify-content:space-between;gap:.5rem}' +
    '#astroStudio .as-facts b{display:block;font-family:var(--serif,Georgia,serif);font-weight:560;font-size:1.35rem;line-height:1;color:#f4eee2;letter-spacing:-.02em}' +
    '#astroStudio .as-facts span{display:block;font-size:.58rem;color:#958c77;margin-top:.3rem;letter-spacing:.02em}' +
    '#astroStudio .as-panel .tv-ro{padding:.12rem 0;font-size:.64rem}';
  document.head.appendChild(st);

  /* ---------------- static data ---------------- */
  const PIPES = ['target_dossier', 'bss_sed', 'cluster_membership', 'cluster_bss_mining', 'period_analysis', 'tess_period', 'wd_age', 'literature_scan'];
  const ARCH = [
    { k: 'gaia', n: 'Gaia DR3', s: 'Gaia', tip: 'Gaia DR3 · TAP (ADQL)' },
    { k: 'simbad', n: 'SIMBAD', s: 'SIMBAD', tip: 'SIMBAD · TAP name resolution' },
    { k: 'vizier', n: 'VizieR', s: 'VizieR', tip: 'VizieR · TAP catalogue tables' },
    { k: 'irsa', n: 'IRSA · ZTF', s: 'IRSA', tip: 'IRSA TAP · ZTF light curves (ALeRCE fallback)' },
    { k: 'xmatch', n: 'CDS XMatch', s: 'XMatch', tip: 'CDS XMatch · positional cross-match' },
    { k: 'mast', n: 'MAST · TESS', s: 'MAST', tip: 'MAST · TESS SPOC light curves' }
  ];
  const AIDX = {}; ARCH.forEach((a, i) => { AIDX[a.k] = i; });

  function st_(id, tool, r, fx, arch, lat, msg, tip) { return { id, tool, r, fx, arch: arch || [], lat, msg, tip }; }

  const SC_DEF = {
    A: {
      label: 'Target dossier', pipe: 'target_dossier',
      query: 'Give me a full dossier for target T-01. Is it periodically variable?',
      params: [['query', 'T-01']],
      steps: [
        st_('resolve', 'target.resolve', 0, .5, ['simbad'], '0.6 s', 'ICRS pos', 'target.resolve · name → ICRS position + known parameters'),
        st_('gaia', 'gaia.target', 1, .5, ['gaia'], '0.8 s', '1 source', 'gaia.target · Gaia DR3 astrometry and photometry'),
        st_('phot', 'phot.gather', 2, .12, ['vizier', 'xmatch'], '1.4 s', 'phot ready', 'phot.gather · multi-survey photometry (VizieR + XMatch)'),
        st_('ext', 'sed.extinction', 2, .37, [], '0.2 s', 'E(B−V)', 'sed.extinction · reddening along the line of sight (dust_extinction)'),
        st_('lc', 'lc.ztf', 2, .63, ['irsa'], '1.1 s', 'light curve', 'lc.ztf · ZTF light curve via IRSA (optional step)'),
        st_('cm', 'cluster.match', 2, .88, [], '0.3 s', 'best match', 'cluster.match · 5D test against published open-cluster catalogue'),
        st_('asm', 'sed.assemble', 3, .25, [], '0.1 s', 'SED points', 'sed.assemble · merge + sanity-check SED points'),
        st_('per', 'ts.periodogram', 3, .63, [], '0.4 s', 'peak found', 'ts.periodogram · Lomb–Scargle period search'),
        st_('cmdc', 'cluster.cmd', 3, .88, [], '0.5 s', 'CMD ready', 'cluster.cmd · target position on the matched cluster CMD'),
        st_('fit', 'sed.fit', 4, .25, [], '1.2 s', 'fit done', 'sed.fit · star + companion hypotheses (scipy)'),
        st_('exc', 'sed.excess', 5, .25, [], '0.1 s', 'UV/IR excess', 'sed.excess · significance of UV / IR excess'),
        st_('rep', 'report.summary', 6, .5, [], '2.0 s', 'brief done', 'report.summary · LLM brief, every number cross-checked')
      ],
      edges: [['resolve', 'gaia'], ['gaia', 'phot'], ['gaia', 'ext'], ['gaia', 'lc'], ['gaia', 'cm'], ['phot', 'asm'], ['ext', 'asm'], ['lc', 'per'], ['cm', 'cmdc'], ['asm', 'fit'], ['fit', 'exc'], ['exc', 'rep'], ['per', 'rep'], ['cmdc', 'rep']],
      cards: [
        { kind: 'foldcombo', after: 'per', title: 'period search · fold', tag: 'ts.periodogram' },
        { kind: 'cmd', after: 'cmdc', title: 'cluster CMD', tag: 'cluster.cmd' },
        { kind: 'sed', after: 'fit', exAfter: 'exc', title: 'SED · star + hot companion', tag: 'sed.fit' }
      ]
    },
    B: {
      label: 'BSS SED companion test', pipe: 'bss_sed',
      query: 'Does blue straggler BSS-07 in NGC_188 have a hot companion? Run the SED test.',
      params: [['query', 'BSS-07'], ['cluster', 'NGC_188']],
      steps: [
        st_('resolve', 'target.resolve', 0, .3, ['simbad'], '0.6 s', 'ICRS pos', 'target.resolve · name → ICRS position'),
        st_('cl', 'cluster.lookup', 0, .75, [], '0.1 s', 'adopted pars', 'cluster.lookup · adopted age / distance / E(B−V) / [M/H]'),
        st_('gaia', 'gaia.target', 1, .3, ['gaia'], '0.8 s', '1 source', 'gaia.target · Gaia DR3 astrometry and photometry'),
        st_('phot', 'phot.gather', 2, .2, ['vizier', 'xmatch'], '1.4 s', 'phot ready', 'phot.gather · multi-survey photometry (VizieR + XMatch)'),
        st_('ext', 'sed.extinction', 2, .55, [], '0.2 s', 'E(B−V)', 'sed.extinction · cluster-adopted reddening'),
        st_('asm', 'sed.assemble', 3, .35, [], '0.1 s', 'SED points', 'sed.assemble · merge + sanity-check SED points'),
        st_('fit', 'sed.fit', 4, .35, [], '1.2 s', 'fit done', 'sed.fit · single star + companion hypotheses (scipy)'),
        st_('cls', 'sed.classify', 5, .13, [], '0.1 s', 'SED class', 'sed.classify · SED class and mass (needs cluster params)'),
        st_('exc', 'sed.excess', 5, .5, [], '0.1 s', 'UV/IR excess', 'sed.excess · significance of UV / IR excess'),
        st_('cmp', 'archive.compare_live', 5, .88, [], '0.2 s', 'ok', 'archive.compare_live · compare with precomputed archive result'),
        st_('rep', 'report.summary', 6, .5, [], '2.0 s', 'brief done', 'report.summary · LLM brief, every number cross-checked')
      ],
      edges: [['resolve', 'gaia'], ['gaia', 'phot'], ['gaia', 'ext'], ['phot', 'asm'], ['ext', 'asm'], ['asm', 'fit'], ['cl', 'fit'], ['fit', 'cls'], ['fit', 'exc'], ['fit', 'cmp'], ['cls', 'rep'], ['exc', 'rep'], ['cmp', 'rep']],
      cards: [
        { kind: 'sed', after: 'fit', exAfter: 'exc', title: 'SED · single vs +hot', tag: 'sed.fit' },
        { kind: 'chi2', after: 'cls', title: 'hypotheses · χ²', tag: 'sed.classify' },
        { kind: 'excess', after: 'exc', title: 'band residuals', tag: 'sed.excess' }
      ]
    },
    C: {
      label: 'Cluster membership', pipe: 'cluster_membership',
      query: 'Is T-01 a member of an open cluster? I need the strict verdict.',
      params: [['query', 'T-01']],
      steps: [
        st_('resolve', 'target.resolve', 0, .5, ['simbad'], '0.6 s', 'ICRS pos', 'target.resolve · name → ICRS position'),
        st_('gaia', 'gaia.target', 1, .5, ['gaia'], '0.8 s', '1 source', 'gaia.target · Gaia DR3 astrometry (+RV)'),
        st_('cm', 'cluster.match', 2, .5, [], '0.3 s', 'best match', 'cluster.match · 5D test: Jacobi radius + χ²₃'),
        st_('tb', 'phys.traceback', 3, .5, [], '1.6 s', 'orbit', 'phys.traceback · backward orbit in the Galactic potential (galpy)'),
        st_('verdict', 'cluster.verdict', 4, .28, [], '0.1 s', 'strict gate', 'cluster.verdict · 4 criteria, any missing = insufficient'),
        st_('cmdc', 'cluster.cmd', 4, .78, [], '0.5 s', 'CMD ready', 'cluster.cmd · target on the cluster CMD'),
        st_('rep', 'report.summary', 5, .5, [], '2.0 s', 'brief done', 'report.summary · LLM brief, every number cross-checked')
      ],
      edges: [['resolve', 'gaia'], ['gaia', 'cm'], ['cm', 'tb'], ['tb', 'verdict'], ['cm', 'cmdc'], ['verdict', 'rep'], ['cmdc', 'rep']],
      cards: [
        { kind: 'vpd', after: 'cm', title: 'proper-motion VPD', tag: 'cluster.match' },
        { kind: 'trace', after: 'tb', title: 'orbit traceback', tag: 'phys.traceback' },
        { kind: 'gate', after: 'verdict', title: '4-criterion gate', tag: 'cluster.verdict' }
      ]
    },
    D: {
      label: 'TESS period (BLS)', pipe: 'tess_period',
      query: 'Find the transit period of WASP-18 in TESS data, use BLS.',
      params: [['query', 'WASP-18'], ['method', 'bls']],
      steps: [
        st_('resolve', 'target.resolve', 0, .5, ['simbad'], '0.6 s', 'ICRS pos', 'target.resolve · name → ICRS position'),
        st_('lc', 'lc.tess', 1, .5, ['mast'], '2.4 s', 'SPOC LC', 'lc.tess · TESS SPOC light curve via MAST'),
        st_('per', 'ts.periodogram', 2, .5, [], '0.9 s', 'BLS peak', 'ts.periodogram · BLS search + bootstrap significance'),
        st_('fold', 'ts.fold', 3, .5, [], '0.2 s', 'folded', 'ts.fold · fold on the strongest peak, test 2P'),
        st_('rep', 'report.summary', 4, .5, [], '2.0 s', 'brief done', 'report.summary · LLM brief, every number cross-checked')
      ],
      edges: [['resolve', 'lc'], ['lc', 'per'], ['per', 'fold'], ['fold', 'rep']],
      cards: [
        { kind: 'lcraw', after: 'lc', title: 'TESS light curve', tag: 'lc.tess' },
        { kind: 'pgram', after: 'per', title: 'BLS periodogram', tag: 'ts.periodogram' },
        { kind: 'fold', after: 'fold', title: 'phase-folded', tag: 'ts.fold' }
      ]
    }
  };
  const ORDER = ['A', 'B', 'C', 'D'];
  const PIPE_TO_SC = { target_dossier: 'A', bss_sed: 'B', cluster_membership: 'C', tess_period: 'D' };
  const T_START = 4.2, T_SPAN = 9.0, T_TAIL = 3.2;

  const SC = {};
  ORDER.forEach(k => {
    const d = SC_DEF[k];
    d.key = k; SC[k] = d;
    d.nr = Math.max.apply(null, d.steps.map(s => s.r)) + 1;
    const gap = T_SPAN / d.nr, cnt = {}, per = {};
    d.byId = {};
    d.steps.forEach(s => {
      cnt[s.r] = cnt[s.r] || 0;
      s.t0 = T_START + s.r * gap + cnt[s.r] * .1;
      cnt[s.r]++;
      s.dur = Math.max(1.1, gap * .95);
      s.t1 = s.t0 + s.dur;
      d.byId[s.id] = s;
      per[s.r] = (per[s.r] || 0) + 1;
    });
    d.maxPar = Math.max.apply(null, Object.keys(per).map(r => per[r]));
    d.edgeL = d.edges.map(e => [d.byId[e[0]], d.byId[e[1]]]);
    d.loop = T_START + T_SPAN + T_TAIL;
    d.pidx = PIPES.indexOf(d.pipe);
    d.cards.forEach(c => { c.step = d.byId[c.after]; c.exStep = c.exAfter ? d.byId[c.exAfter] : null; });
    d.log = [{ t: 2.7, tool: 'planner', msg: '→ ' + d.pipe }, { t: 3.9, tool: 'planner', msg: '✓ params verbatim' }];
    d.steps.forEach(s => d.log.push({ t: s.t1, tool: s.tool, msg: '✓ ' + s.msg + ' ' + s.lat.replace(' s','s') }));
    d.log.sort((a, b) => a.t - b.t);
  });

  /* ---------------- seeded sample data ---------------- */
  const R = T.rand(20261014);
  const pgNoise = Array.from({ length: 64 }, () => .06 + .12 * R());
  const foldPts = Array.from({ length: 80 }, () => ({ ph: R(), n: R() - .5 }));
  const lcPts = Array.from({ length: 170 }, () => R() - .5);
  const cmdMS = Array.from({ length: 58 }, () => ({ x: R(), s: R() - .5 }));
  const cmdGB = Array.from({ length: 11 }, () => ({ x: .72 + .2 * R(), y: .18 + .3 * R() }));
  const sedN = Array.from({ length: 10 }, () => R() - .5);
  function g2() { return (R() + R() + R() + R() - 2) / 2; }
  const vpdField = Array.from({ length: 80 }, () => ({ x: .5 + g2() * .8, y: .5 + g2() * .8 }));
  const vpdMem = Array.from({ length: 28 }, () => ({ x: .64 + g2() * .09, y: .42 + g2() * .09 }));
  const SEDX = [.04, .1, .18, .28, .4, .52, .64, .76, .88, .96];
  const gauss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
  const sedStar = x => .8 * gauss(x, .5, .2);
  const sedHot = x => .55 * gauss(x, .03, .16);

  /* ---------------- state ---------------- */
  let loop = null, sc = SC_DEF.A, base = 0, cycle = true, wide = true, mouse = null, hover = null, sel = null;
  let L = {}, stars = [], logN = -1, logSc = null, cardsTop = 236;
  const hits = [];
  let chipApi = null, pauseBtn = null, cycleBtn = null;

  /* ---------------- HUD ---------------- */
  const pFacts = document.createElement('div'); pFacts.className = 'tv-panel as-panel';
  pFacts.innerHTML = '<div class="as-facts"><div><b>12</b><span>pipelines</span></div><div><b>43</b><span>tools</span></div><div><b>562</b><span>offline tests</span></div></div>';
  const pVal = document.createElement('div'); pVal.className = 'tv-panel as-panel';
  pVal.innerHTML = '<h5>Validation</h5><div></div>';
  T.readout(pVal.lastChild, [['WASP-18 BLS', '0.94152 d', 'ok'], ['literature', '0.941453 d'], ['clusters recovered', '5 / 5', 'ok'], ['false positives', '0 / 3 empty', 'ok']]);
  const pLog = document.createElement('div'); pLog.className = 'tv-panel as-panel';
  pLog.innerHTML = '<h5>Tool-call log</h5><div class="tv-log"></div>';
  const logEl = pLog.lastChild;
  fig.hud.append(pFacts, pVal, pLog);

  function renderLog(Tt) {
    let n = 0; const lg = sc.log;
    while (n < lg.length && lg[n].t <= Tt) n++;
    if (n === logN && logSc === sc) return;
    logN = n; logSc = sc;
    logEl.textContent = '';
    for (let i = Math.max(0, n - 8); i < n; i++) {
      const d = document.createElement('div'), e = document.createElement('em');
      e.textContent = lg[i].tool;
      d.append(e, document.createTextNode(' ' + lg[i].msg));
      logEl.append(d);
    }
  }

  /* ---------------- layout ---------------- */
  function layout(w, h) {
    wide = w >= 1040;
    L = { w, h };
    if (wide) {
      L.Lx = 14; L.Lw = 236; L.Rw = 232;
      L.cx0 = L.Lx + L.Lw + 20; L.cx1 = w - L.Rw - 34;
      L.dagTop = 138; L.dagBot = h - 34; L.nh = 26; L.fs = 11;
      L.archY = 70; L.archAmp = 24; L.ax0 = L.cx0 + 26; L.ax1 = L.cx1 - 26;
    } else {
      L.cx0 = 20; L.cx1 = w - 20;
      L.nh = w < 640 ? 22 : 24; L.fs = 10.5;
      L.cardH = 150;
      L.dagTop = 160; L.dagBot = h - L.cardH - 40;
      L.archY = 108; L.archAmp = 12; L.ax0 = 34; L.ax1 = w - 34;
    }
    const sp = ['pFacts', 'pVal', 'pLog'];
    [pFacts, pVal, pLog].forEach(p => { p.style.display = wide ? '' : 'none'; });
    if (wide) {
      pFacts.style.cssText = 'right:14px;top:12px;width:' + L.Rw + 'px;min-width:0';
      pVal.style.cssText = 'right:14px;top:' + (12 + pFacts.offsetHeight + 8) + 'px;width:' + L.Rw + 'px;min-width:0';
      cardsTop = 12 + pFacts.offsetHeight + 8 + pVal.offsetHeight + 8;
      pLog.style.cssText = 'left:14px;width:' + L.Lw + 'px;min-width:0;top:' + (162 + 8 * 21 + 8 + 38 + 8) + 'px;bottom:12px;overflow:hidden';
    }
    // starfield
    const rr = T.rand(5);
    stars = [];
    for (let i = 0; i < 150; i++) stars.push({ x: rr() * w, y: rr() * h, r: rr() < .1 ? 1.3 : .75, a: .1 + rr() * .3, ph: rr() * 6 });
    place();
  }
  function place() {
    if (!L.w) return;
    const rows = sc.nr;
    const pitchMax = wide ? 82 : 66;
    const pitch = rows > 1 ? Math.min(pitchMax, (L.dagBot - L.dagTop) / (rows - 1)) : 0;
    const off = ((L.dagBot - L.dagTop) - (rows - 1) * pitch) / 2;
    const useTool = (L.cx1 - L.cx0) / sc.maxPar >= 126;
    ctx.font = T.font(L.fs, 500);
    sc.steps.forEach(s => {
      s.lab = useTool ? s.tool : s.id;
      s.x = L.cx0 + s.fx * (L.cx1 - L.cx0);
      s.y = L.dagTop + off + s.r * pitch;
      s.w = Math.ceil(ctx.measureText(s.lab).width) + (wide ? 32 : 28);
    });
  }
  function archPos(i) {
    const u = i / 5;
    return { x: L.ax0 + (L.ax1 - L.ax0) * u, y: L.archY - L.archAmp * Math.sin(Math.PI * u) };
  }

  function setScenario(key, userSet) {
    sc = SC[key]; sel = null; hover = null;
    base = loop ? loop.t : 0;
    logN = -1; place();
    fig.setStatus('schematic replay · ' + sc.pipe);
    if (chipApi) chipApi.set(key);
    if (loop && userSet && loop.paused) loop.redraw();
  }

  /* ---------------- helpers ---------------- */
  function fitText(s, maxW) {
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function star5(x, y, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function cubicPt(x0, y0, x1, y1, dy, u) {
    const v = 1 - u, c1y = y0 + dy, c2y = y1 - dy;
    return { x: v * v * v * x0 + 3 * v * v * u * x0 + 3 * v * u * u * x1 + u * u * u * x1,
             y: v * v * v * y0 + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * y1 };
  }
  function hairline(x0, y0, x1, y1, a) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = 'rgba(236,224,200,' + (a == null ? .3 : a) + ')'; ctx.lineWidth = 1; ctx.stroke();
  }
  function axes(pr, xt, xl, yl) {
    ctx.beginPath(); ctx.moveTo(pr.x + .5, pr.y); ctx.lineTo(pr.x + .5, pr.y + pr.h + .5); ctx.lineTo(pr.x + pr.w, pr.y + pr.h + .5);
    ctx.strokeStyle = 'rgba(236,224,200,.34)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = T.font(9.5, 400); ctx.fillStyle = C.dim; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    (xt || []).forEach(t => {
      const x = pr.x + pr.w * t[0];
      hairline(x, pr.y + pr.h, x, pr.y + pr.h + 3, .34);
      if (t[1]) ctx.fillText(t[1], x, pr.y + pr.h + 4);
    });
    if (xl) { ctx.textAlign = 'right'; ctx.fillStyle = C.faint; ctx.fillText(xl, pr.x + pr.w, pr.y + pr.h + 4); }
    if (yl) { ctx.textAlign = 'left'; ctx.fillStyle = C.faint; ctx.textBaseline = 'bottom'; ctx.fillText(yl, pr.x - 3, pr.y - 2); }
  }
  function dot(x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); }

  /* ---------------- mini plots ---------------- */
  function pgram(pr, rv, o) {
    o = o || {};
    axes(pr, [[0, ''], [.5, ''], [1, '']], o.xl || 'log P', 'power');
    const n = 64, k = Math.floor(clamp(rv * 1.4, 0, 1) * (n - 1));
    ctx.beginPath();
    for (let i = 0; i <= k; i++) {
      const u = i / (n - 1), v = pgNoise[i] + .85 * gauss(u, o.pk || .4, .014) + (o.alias ? .12 * gauss(u, (o.pk || .4) / 2, .012) : 0);
      const x = pr.x + u * pr.w, y = pr.y + pr.h - clamp(v, 0, 1) * pr.h * .95;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = C.soft; ctx.lineWidth = 1; ctx.stroke();
    if (rv > .75) {
      const x = pr.x + (o.pk || .4) * pr.w, a = clamp((rv - .75) / .25, 0, 1);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.setLineDash([2, 3]); hairline(x, pr.y + 2, x, pr.y + pr.h, .5); ctx.setLineDash([]);
      dot(x, pr.y + 2, 2.4, C.amber);
      ctx.font = T.font(9.5, 500); ctx.fillStyle = C.amber; ctx.textAlign = x > pr.x + pr.w * .6 ? 'right' : 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(o.label || 'P*', x + (x > pr.x + pr.w * .6 ? -5 : 5), pr.y + 6);
      ctx.restore();
    }
  }
  function foldplot(pr, rv, o) {
    o = o || {};
    axes(pr, [[0, '0'], [.5, ''], [1, '1']], 'phase', 'flux');
    const n = Math.floor(clamp(rv * 1.3, 0, 1) * foldPts.length);
    const mid = pr.y + pr.h * .5;
    const model = ph => {
      if (o.transit) { const d = Math.abs(ph - .5); return d < .06 ? -.62 * Math.min(1, (.06 - d) / .02) : 0; }
      return -.34 * Math.sin(TAU * ph);
    };
    for (let i = 0; i < n; i++) {
      const p = foldPts[i], v = model(p.ph) + p.n * (o.transit ? .12 : .28);
      dot(pr.x + p.ph * pr.w, mid - v * pr.h * .46, 1.25, rgba(C.soft, .85));
    }
    if (rv > .55) {
      ctx.save(); ctx.globalAlpha *= clamp((rv - .55) / .3, 0, 1);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const u = i / 60, x = pr.x + u * pr.w, y = mid - model(u) * pr.h * .46; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    }
  }
  function lcraw(pr, rv) {
    axes(pr, [[0, ''], [.5, ''], [1, '']], 'time', 'flux');
    const n = Math.floor(clamp(rv * 1.2, 0, 1) * lcPts.length), mid = pr.y + pr.h * .3, P = 0.16;
    for (let i = 0; i < n; i++) {
      const u = i / (lcPts.length - 1), ph = (u / P) % 1, d = Math.abs(ph - .5);
      const dip = d < .06 ? .55 * Math.min(1, (.06 - d) / .02) : 0;
      dot(pr.x + u * pr.w, mid + (dip * 1.5 + lcPts[i] * .12) * pr.h * .5, 1.1, rgba(C.soft, .8));
    }
  }
  function cmd(pr, rv, o) {
    axes(pr, [[.15, '0.5'], [.55, '1.0']], 'BP−RP', 'G');
    const n = Math.floor(clamp(rv * 1.3, 0, 1) * cmdMS.length);
    const Y = f => pr.y + f * pr.h;
    for (let i = 0; i < n; i++) {
      const p = cmdMS[i], x = p.x, yf = .12 + .78 * Math.pow(x, 1.15) + p.s * .06;
      dot(pr.x + (.06 + x * .86) * pr.w, Y(clamp(yf, .04, .96)), 1.3, rgba(C.dim, .85));
    }
    if (rv > .3) cmdGB.forEach(p => dot(pr.x + (.06 + p.x * .86) * pr.w, Y(p.y), 1.3, rgba(C.rose, .6 * clamp((rv - .3) / .3, 0, 1))));
    if (rv > .65) {
      const a = clamp((rv - .65) / .3, 0, 1), x = pr.x + (.06 + .36 * .86) * pr.w, y = Y(.12 + .78 * Math.pow(.36, 1.15) - .02);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.beginPath(); ctx.arc(x, y, 7 + 2 * Math.sin(Date.now() / 300), 0, TAU); ctx.strokeStyle = rgba(C.amber, .5); ctx.lineWidth = 1; ctx.stroke();
      star5(x, y, 5, C.amber);
      ctx.font = T.font(9.5, 500); ctx.fillStyle = C.amber; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('target', x + 11, y - 1); ctx.restore();
    }
  }
  function sed(pr, rv, o) {
    axes(pr, [[.04, 'UV'], [.5, 'opt'], [.96, 'IR']], 'λ', 'λFλ');
    const X = u => pr.x + u * pr.w, Y = v => pr.y + pr.h - v * pr.h * .9;
    const nP = Math.floor(clamp(rv / .5, 0, 1) * SEDX.length);
    if (o.ex) {
      ctx.save(); ctx.globalAlpha *= clamp(o.exA, 0, 1);
      const g = ctx.createLinearGradient(X(0), 0, X(.3), 0);
      g.addColorStop(0, rgba(C.sky, .25)); g.addColorStop(1, rgba(C.sky, 0));
      ctx.fillStyle = g; ctx.fillRect(X(0), pr.y, pr.w * .3, pr.h); ctx.restore();
    }
    for (let i = 0; i < nP; i++) {
      const u = SEDX[i], v = sedStar(u) + sedHot(u) + sedN[i] * .05, x = X(u);
      hairline(x, Y(v + .05), x, Y(v - .05), .4);
      dot(x, Y(v), 1.9, C.soft);
    }
    const draw = (fn, col, w, dash, a) => {
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) { const u = i / 50; i ? ctx.lineTo(X(u), Y(fn(u))) : ctx.moveTo(X(u), Y(fn(u))); }
      ctx.setLineDash(dash || []); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = w; ctx.stroke(); ctx.setLineDash([]);
    };
    if (rv > .4) draw(u => sedStar(u) + sedHot(u), C.ink, 1.4, null, clamp((rv - .4) / .3, 0, 1) * .9);
    if (rv > .7) {
      const a = clamp((rv - .7) / .3, 0, 1);
      draw(sedStar, C.amber, 1.2, [3, 3], a); draw(sedHot, C.sky, 1.2, [3, 3], a);
      ctx.save(); ctx.globalAlpha *= a; ctx.font = T.font(9.5, 400); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const lx = pr.x + pr.w - 2;
      ctx.fillStyle = C.amber; ctx.fillText('star', lx, pr.y + 5);
      ctx.fillStyle = C.sky; ctx.fillText('hot companion', lx, pr.y + 16);
      ctx.fillStyle = C.ink; ctx.fillText('sum', lx, pr.y + 27); ctx.restore();
    }
  }
  function chi2(pr, rv) {
    const lab = ['single', '+WD', '+hot', '+cool'], val = [.95, .62, .3, .72];
    ctx.font = T.font(9.5, 400); ctx.textBaseline = 'middle';
    const rh = pr.h / 4, lw = 40;
    for (let i = 0; i < 4; i++) {
      const a = clamp(rv * 1.5 - i * .15, 0, 1), best = i === 2, y = pr.y + rh * i + rh / 2;
      ctx.textAlign = 'left'; ctx.fillStyle = best && rv > .85 ? C.amber : C.dim; ctx.fillText(lab[i], pr.x - 14, y);
      const bw = (pr.w - lw + 6) * val[i] * a, bx = pr.x - 14 + lw;
      T.rrect(ctx, bx, y - 4, Math.max(1, bw), 8, 2);
      ctx.fillStyle = rgba(best && rv > .85 ? C.amber : C.dim, best && rv > .85 ? .9 : .45); ctx.fill();
    }
    ctx.fillStyle = C.faint; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('χ²ᵣ · lower is better', pr.x + pr.w, pr.y + pr.h + 4);
  }
  function excess(pr, rv) {
    const lab = ['FUV', 'NUV', 'opt', 'J', 'W1', 'W2'], val = [.92, .6, .06, .05, .08, .1];
    axes(pr, [], '', 'σ');
    const bw = pr.w / 6;
    ctx.setLineDash([2, 3]); hairline(pr.x, pr.y + pr.h * .45, pr.x + pr.w, pr.y + pr.h * .45, .3); ctx.setLineDash([]);
    ctx.font = T.font(9.5, 400); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i < 6; i++) {
      const a = clamp(rv * 1.5 - i * .1, 0, 1), hgt = pr.h * val[i] * a, x = pr.x + bw * i + bw * .2;
      T.rrect(ctx, x, pr.y + pr.h - hgt, bw * .6, Math.max(1, hgt), 2);
      ctx.fillStyle = rgba(i < 2 ? C.sky : C.dim, i < 2 ? .85 : .5); ctx.fill();
      ctx.fillStyle = C.dim; ctx.fillText(lab[i], pr.x + bw * i + bw / 2, pr.y + pr.h + 4);
    }
  }
  function vpd(pr, rv) {
    axes(pr, [], 'μα*', 'μδ');
    const X = u => pr.x + u * pr.w, Y = v => pr.y + pr.h - v * pr.h;
    const nF = Math.floor(clamp(rv * 1.6, 0, 1) * vpdField.length);
    for (let i = 0; i < nF; i++) { const p = vpdField[i]; if (p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1) dot(X(p.x), Y(p.y), 1.1, rgba(C.dim, .55)); }
    if (rv > .35) {
      const a = clamp((rv - .35) / .35, 0, 1), nM = Math.floor(a * vpdMem.length);
      for (let i = 0; i < nM; i++) dot(X(vpdMem[i].x), Y(vpdMem[i].y), 1.7, C.amber);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.beginPath(); ctx.ellipse(X(.64), Y(.42), pr.w * .17, pr.h * .22, -.3, 0, TAU);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(C.amber, .6); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    if (rv > .75) {
      const a = clamp((rv - .75) / .25, 0, 1), x = X(.68), y = Y(.46);
      ctx.save(); ctx.globalAlpha *= a; star5(x, y, 5, C.ember);
      ctx.font = T.font(9.5, 500); ctx.fillStyle = C.ember; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('target', x + 8, y - 8);
      ctx.fillStyle = C.amber; ctx.fillText('members', X(.02), Y(.93)); ctx.restore();
    }
  }
  function trace(pr, rv) {
    axes(pr, [[0, '0'], [1, '']], 'lookback t', 'sep');
    const X = u => pr.x + u * pr.w, Y = v => pr.y + pr.h - v * pr.h * .9;
    const f = u => .12 + 1.5 * (u - .55) * (u - .55) + .05 * Math.sin(u * 14);
    const k = Math.floor(clamp(rv * 1.3, 0, 1) * 60);
    ctx.beginPath();
    for (let i = 0; i <= k; i++) { const u = i / 60; i ? ctx.lineTo(X(u), Y(f(u))) : ctx.moveTo(X(u), Y(f(u))); }
    ctx.strokeStyle = C.soft; ctx.lineWidth = 1.3; ctx.stroke();
    if (rv > .7) {
      const a = clamp((rv - .7) / .3, 0, 1);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.setLineDash([2, 3]); hairline(X(.82), pr.y, X(.82), pr.y + pr.h, .5); ctx.setLineDash([]);
      dot(X(.55), Y(f(.55)), 2.6, C.amber);
      ctx.font = T.font(9.5, 500); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = C.amber;
      ctx.fillText('t_min', X(.55) - 6, Y(f(.55)) - 8);
      ctx.textAlign = 'left'; ctx.fillStyle = C.dim; ctx.fillText('age', X(.82) + 4, pr.y + 7);
      ctx.restore();
    }
  }
  function gate(r, rv) {
    const lab = ['χ²_spat ≤ 9', 'χ²_kin ≤ 9', '|ΔRV| ≤ 3σ', 't_back ≤ age'], val = [.42, .58, .3, .22];
    const x0 = r.x + 12, top = r.y + 26, rh = (r.h - 26 - 8) / 4, bx = x0 + 78, bw = r.w - 12 - 78 - 34;
    ctx.font = T.font(9.5, 400); ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const a = clamp(rv * 5 - i * 1, 0, 1), y = top + rh * i + rh / 2;
      ctx.textAlign = 'left'; ctx.fillStyle = C.soft; ctx.fillText(lab[i], x0, y);
      T.rrect(ctx, bx, y - 3, bw, 6, 3); ctx.fillStyle = 'rgba(236,224,200,.07)'; ctx.fill();
      T.rrect(ctx, bx, y - 3, Math.max(1, bw * .8 * val[i] * a), 6, 3); ctx.fillStyle = rgba(C.mint, .8); ctx.fill();
      hairline(bx + bw * .8, y - 6, bx + bw * .8, y + 6, .45);
      if (a >= 1) { ctx.textAlign = 'right'; ctx.fillStyle = C.mint; ctx.fillText('✓', r.x + r.w - 12, y); }
    }
    if (rv > .95) {
      ctx.textAlign = 'right'; ctx.fillStyle = C.mint; ctx.font = T.font(10, 600);
      ctx.fillText('member', r.x + r.w - 12, r.y + 12);
    }
  }

  /* ---------------- cards ---------------- */
  function drawCard(c, r, Tt) {
    const ts = c.step.t0 + c.step.dur * .7;
    const rv = clamp((Tt - ts) / 1.3, 0, 1), age = Tt - ts;
    const lvl = rv > 0 ? clamp(1 - age / 1.6, 0, 1) * .85 : 0;
    ctx.save();
    if (rv <= 0) ctx.globalAlpha = .55;
    T.card(ctx, r.x, r.y, r.w, r.h, { color: C.amber, level: lvl, r: 8, bar: rv > 0 });
    if (rv <= 0) {
      ctx.setLineDash([3, 4]); T.rrect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 6); ctx.strokeStyle = 'rgba(236,224,200,.08)'; ctx.stroke(); ctx.setLineDash([]);
      T.label(ctx, c.title, r.x + 12, r.y + 12, { size: 10, color: C.faint });
      T.label(ctx, 'awaiting ' + c.tag, r.x + r.w / 2, r.y + r.h / 2 + 6, { size: 10, color: C.faint, align: 'center' });
      ctx.restore(); return;
    }
    ctx.font = T.font(10, 500);
    T.label(ctx, c.title, r.x + 12, r.y + 12, { size: 10, weight: 500, color: C.ink });
    ctx.font = T.font(9.5, 400);
    const tw = ctx.measureText(c.tag).width;
    if (c.kind !== 'gate') T.label(ctx, c.tag, r.x + r.w - 12, r.y + 12, { size: 9.5, color: C.dim, align: 'right' });
    const pr = { x: r.x + 32, y: r.y + 28, w: r.w - 46, h: r.h - 28 - 20 };
    switch (c.kind) {
      case 'foldcombo': {
        const a = { x: pr.x, y: pr.y, w: pr.w * .4, h: pr.h }, b = { x: pr.x + pr.w * .52, y: pr.y, w: pr.w * .48, h: pr.h };
        pgram(a, rv, { pk: .4, label: 'P*' }); foldplot(b, rv, {}); break;
      }
      case 'pgram': pgram(pr, rv, { pk: .38, label: 'BLS 0.94152 d', alias: true, xl: 'period' }); break;
      case 'fold': foldplot(pr, rv, { transit: true }); if (rv > .8) T.label(ctx, 'P = 0.94152 d', pr.x + pr.w, pr.y + 6, { size: 9.5, color: C.amber, align: 'right' }); break;
      case 'lcraw': lcraw(pr, rv); break;
      case 'cmd': cmd(pr, rv); break;
      case 'sed': sed(pr, rv, { ex: c.exStep && Tt > c.exStep.t1, exA: c.exStep ? (Tt - c.exStep.t1) / .8 : 0 }); break;
      case 'chi2': chi2(pr, rv); break;
      case 'excess': excess(pr, rv); break;
      case 'vpd': vpd(pr, rv); break;
      case 'trace': trace(pr, rv); break;
      case 'gate': gate(r, rv); break;
    }
    ctx.restore();
  }

  function cardRects() {
    const n = sc.cards.length, out = [];
    if (wide) {
      const gap = 6, top = cardsTop, ch = (L.h - 12 - top - gap * (n - 1)) / n, x = L.w - L.Rw - 14;
      for (let i = 0; i < n; i++) out.push({ x, y: top + i * (ch + gap), w: L.Rw, h: ch });
    } else if (L.w >= 640) {
      const gap = 10, cw = (L.w - 24 - gap * (n - 1)) / n, y = L.h - L.cardH - 10;
      for (let i = 0; i < n; i++) out.push({ x: 12 + i * (cw + gap), y, w: cw, h: L.cardH });
    } else out.push({ x: 12, y: L.h - L.cardH - 10, w: L.w - 24, h: L.cardH });
    return out;
  }

  /* ---------------- scene pieces ---------------- */
  function drawStars(t) {
    ctx.fillStyle = C.soft;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = s.a * (.75 + .25 * Math.sin(t * .8 + s.ph));
      ctx.fillRect(s.x, s.y, s.r * 1.4, s.r * 1.4);
    }
    ctx.globalAlpha = 1;
  }

  function drawQuery(Tt) {
    const full = sc.query, n = Math.floor(clamp((Tt - .4) / 2, 0, 1) * full.length);
    const typing = Tt < 2.5;
    if (wide) {
      const x = L.Lx, y = 14, w = L.Lw, h = 82;
      T.card(ctx, x, y, w, h, { color: C.amber, level: typing ? .35 : 0, r: 8 });
      T.label(ctx, 'QUERY · 课题', x + 12, y + 12, { size: 9.5, color: C.dim });
      ctx.font = T.font(11, 400);
      const lines = T.wrap(ctx, full, w - 24);
      let rem = n, caret = null;
      lines.forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, rem)), ly = y + 32 + i * 15;
        if (part.length) {
          let drawn = part;
          if (Tt > 2.6) sc.params.forEach(p => { const k = drawn.indexOf(p[1]); if (k >= 0) drawn = drawn.slice(0, k) + ' '.repeat(p[1].length) + drawn.slice(k + p[1].length); });
          ctx.font = T.font(11, 400); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.soft; ctx.fillText(drawn, x + 12, ly);
          if (Tt > 2.6) sc.params.forEach(p => {
            const k = ln.indexOf(p[1]); if (k < 0) return;
            const px = x + 12 + ctx.measureText(ln.slice(0, k)).width, pw = ctx.measureText(p[1]).width;
            ctx.fillStyle = C.amber; ctx.fillText(p[1], px, ly); hairline(px, ly + 8, px + pw, ly + 8, .0); ctx.fillStyle = rgba(C.amber, .6); ctx.fillRect(px, ly + 8, pw, 1);
          });
          caret = { x: x + 12 + ctx.measureText(part).width + 2, y: ly };
        }
        rem -= ln.length + 1;
      });
      if (typing && caret && (Math.floor(Tt * 2.4) % 2 === 0)) { ctx.fillStyle = C.amber; ctx.fillRect(caret.x, caret.y - 6, 6, 12); }
    } else {
      const x = 12, y = 8, w = L.w - 24, h = 32;
      T.card(ctx, x, y, w, h, { color: C.amber, level: typing ? .35 : 0, r: 7, bar: false });
      T.label(ctx, 'QUERY', x + 10, y + h / 2, { size: 9.5, color: C.dim });
      ctx.font = T.font(10.5, 400);
      const part = full.slice(0, n), maxW = w - 70;
      let s = part; while (s.length > 1 && ctx.measureText(s).width > maxW) s = s.slice(1);
      if (s !== part) s = '…' + s.slice(1);
      ctx.fillStyle = C.soft; ctx.textAlign = 'left'; ctx.fillText(s, x + 56, y + h / 2);
      if (typing && (Math.floor(Tt * 2.4) % 2 === 0)) { ctx.fillStyle = C.amber; ctx.fillRect(x + 56 + ctx.measureText(s).width + 2, y + h / 2 - 6, 6, 12); }
    }
  }

  function drawPlanner(Tt) {
    const scan = Tt > 2.7 && Tt < 3.8, chosen = Tt >= 3.8;
    const lvl = Tt > 2.5 && Tt < 4.5 ? 1 : (chosen ? .15 : 0);
    const si = sc.pidx;
    if (wide) {
      const x = L.Lx, w = L.Lw;
      // query → planner
      hairline(x + w / 2, 96, x + w / 2, 110, .25);
      if (Tt > 2.4 && Tt < 3.2) T.flow(ctx, u => ({ x: x + w / 2, y: 96 + 14 * u }), Tt, { n: 1, speed: 1.6, color: C.amber, size: 1.8 });
      T.card(ctx, x, 110, w, 38, { color: C.amber, level: lvl, r: 8 });
      T.label(ctx, 'Planner · DeepSeek', x + 12, 123, { size: 11, weight: 600, color: C.ink });
      ctx.font = T.font(9.5, 400);
      const sub = chosen ? '→ ' + sc.pipe : scan ? 'choosing ∈ registry only…' : 'may only pick registered pipelines';
      T.label(ctx, fitText(sub, w - 24), x + 12, 138, { size: 9.5, color: chosen ? C.amber : C.dim });
      T.label(ctx, 'REGISTRY · 8 OF 12 PIPELINES', x + 2, 160, { size: 9.5, color: C.faint });
      // chips
      const sIdx = scan ? ((Math.floor((Tt - 2.7) * 13) * 3 + 2) % 8) : -1;
      for (let i = 0; i < 8; i++) {
        const y = 170 + i * 21, on = chosen && i === si, mapped = !!PIPE_TO_SC[PIPES[i]];
        T.rrect(ctx, x, y, w, 18, 5);
        ctx.fillStyle = on ? C.amber : (i === sIdx ? 'rgba(232,168,95,.22)' : 'rgba(236,224,200,.03)'); ctx.fill();
        ctx.strokeStyle = on ? C.amber : (i === sIdx ? rgba(C.amber, .7) : 'rgba(236,224,200,.12)'); ctx.lineWidth = 1; ctx.stroke();
        T.label(ctx, PIPES[i], x + 10, y + 9.5, { size: 10.5, weight: on ? 600 : 400, color: on ? '#15110b' : (mapped ? C.soft : C.dim) });
        if (mapped && !on) dot(x + w - 11, y + 9, 1.8, rgba(C.amber, .55));
        hits.push({ t: 'chip', id: PIPES[i], x, y, w, h: 18, tip: mapped ? 'click to replay ' + PIPES[i] : PIPES[i] + ' (registered, not shown in this replay)' });
      }
      // badge
      const by = 170 + 8 * 21 + 4;
      if (Tt > 3.4) {
        const ok = Tt > 3.9;
        T.rrect(ctx, x, by, w, 38, 7);
        ctx.fillStyle = ok ? 'rgba(108,196,160,.07)' : 'rgba(236,224,200,.03)'; ctx.fill();
        ctx.strokeStyle = ok ? rgba(C.mint, .45) : 'rgba(236,224,200,.14)'; ctx.stroke();
        T.label(ctx, 'verbatim-parameter check', x + 10, by + 12, { size: 10, weight: 500, color: ok ? C.mint : C.soft });
        ctx.font = T.font(10, 500);
        if (ok) T.label(ctx, '✓', x + w - 12, by + 12, { size: 11, weight: 600, color: C.mint, align: 'right' });
        else T.label(ctx, '···'.slice(0, 1 + Math.floor(Tt * 4) % 3), x + w - 12, by + 12, { size: 11, color: C.dim, align: 'right' });
        ctx.font = T.font(9.5, 400);
        T.label(ctx, fitText(sc.params.map(p => p[0] + '="' + p[1] + '"').join('  '), w - 20), x + 10, by + 28, { size: 9.5, color: C.dim });
      }
      // chip → first node
      if (chosen) {
        const rn = sc.byId.resolve, x0 = x + w, y0 = 170 + si * 21 + 9, x1 = rn.x - rn.w / 2, y1 = rn.y;
        const fn = u => { const v = 1 - u; return { x: v * v * v * x0 + 3 * v * v * u * (x0 + 60) + 3 * v * u * u * (x1 - 60) + u * u * u * x1, y: v * v * v * y0 + 3 * v * v * u * y0 + 3 * v * u * u * y1 + u * u * u * y1 }; };
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + 60, y0, x1 - 60, y1, x1, y1);
        ctx.strokeStyle = rgba(C.amber, Tt < 5 ? .5 : .25); ctx.lineWidth = 1; ctx.stroke();
        if (Tt < 5.2) T.flow(ctx, fn, Tt, { n: 3, speed: 1.1, color: C.amber, size: 1.9 });
      }
    } else {
      const x = 12, y = 46, w = L.w - 24, h = 26;
      T.card(ctx, x, y, w, h, { color: C.amber, level: lvl, r: 7, bar: false });
      T.label(ctx, 'Planner · DeepSeek', x + 10, y + h / 2, { size: 10, weight: 600, color: C.ink });
      ctx.font = T.font(10, 600);
      const off = ctx.measureText('Planner · DeepSeek').width + 22;
      ctx.font = T.font(10, 400);
      const txt = chosen ? '→ ' + sc.pipe + (Tt > 3.9 ? '  ✓ verbatim' : '') : (scan ? 'choosing…' : '');
      T.label(ctx, fitText(txt, w - off - 10), x + off, y + h / 2, { size: 10, color: Tt > 3.9 ? C.mint : C.amber });
      if (chosen) {
        const rn = sc.byId.resolve;
        if (Tt < 5.2) T.flow(ctx, u => ({ x: rn.x, y: y + h + (rn.y - L.nh / 2 - (y + h)) * u }), Tt, { n: 2, speed: 1, color: C.amber, size: 1.7 });
      }
    }
  }

  function drawArchives(Tt) {
    // faint arc
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const p = archPos(i / 8); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(143,179,220,.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    if (wide) T.label(ctx, 'ARCHIVES', L.cx0, 16, { size: 9.5, color: C.faint });
    const act = [0, 0, 0, 0, 0, 0], used = [0, 0, 0, 0, 0, 0];
    sc.steps.forEach(s => {
      const p = (Tt - s.t0) / s.dur;
      s.arch.forEach(k => { const i = AIDX[k]; used[i] = 1; if (p > 0 && p < 1.05) act[i] = Math.max(act[i], 1 - Math.max(0, p - .8) / .25); });
    });
    ctx.font = T.font(wide ? 10.5 : 9.5, 400);
    for (let i = 0; i < 6; i++) {
      const p = archPos(i), a = ARCH[i], on = act[i] > .05;
      T.node(ctx, p.x, p.y, wide ? 7 : 5.5, C.steel, { active: on, level: used[i] ? .28 : .12, ring: on ? Tt : 0, core: on });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = T.font(wide ? 10.5 : 9.5, 400);
      ctx.fillStyle = on ? C.ink : (used[i] ? C.dim : C.faint);
      ctx.fillText(wide || L.w >= 640 ? a.n : a.s, p.x, p.y + (wide ? 18 : 15));
      hits.push({ t: 'arch', id: a.k, x: p.x - 28, y: p.y - 12, w: 56, h: 40, tip: a.tip });
    }
    return act;
  }

  function drawEdges(Tt) {
    sc.edgeL.forEach(e => {
      const a = e[0], b = e[1], y0 = a.y + L.nh / 2, y1 = b.y - L.nh / 2, dy = (y1 - y0) * .5;
      const lit = Tt >= b.t0 - .05;
      ctx.beginPath(); ctx.moveTo(a.x, y0); ctx.bezierCurveTo(a.x, y0 + dy, b.x, y1 - dy, b.x, y1);
      ctx.strokeStyle = lit ? rgba(C.amber, Tt > b.t1 ? .38 : .7) : 'rgba(236,224,200,.13)'; ctx.lineWidth = 1; ctx.stroke();
      if (Tt >= b.t0 && Tt < b.t1) T.flow(ctx, u => cubicPt(a.x, y0, b.x, y1, dy, u), Tt, { n: 2, speed: 1 / b.dur * .9, color: C.amber, size: 1.8 });
    });
  }

  function drawNode(s, Tt) {
    const p = (Tt - s.t0) / s.dur, state = p < 0 ? 0 : p < 1 ? 1 : 2;
    const x = s.x - s.w / 2, y = s.y - L.nh / 2, w = s.w, h = L.nh;
    const isH = hover && hover.t === 'step' && hover.id === s.id, isS = sel && sel.id === s.id;
    ctx.save();
    if (state === 0) ctx.globalAlpha = .5;
    T.card(ctx, x, y, w, h, { color: C.amber, level: state === 1 ? 1 : (state === 2 ? .04 : 0), r: 6, bar: false });
    ctx.restore();
    if (state === 2) { T.rrect(ctx, x, y, w, h, 6); ctx.strokeStyle = rgba(C.amber, .5); ctx.lineWidth = 1; ctx.stroke(); }
    if (state === 1) { ctx.fillStyle = C.amber; ctx.fillRect(x + 6, y + h - 3, (w - 12) * clamp(p, 0, 1), 1.5); }
    ctx.font = T.font(L.fs, 500);
    T.label(ctx, s.lab, x + 11, s.y, { size: L.fs, weight: 500, color: state === 0 ? C.dim : state === 1 ? C.ink : C.soft, font: T.font(L.fs, 500) });
    if (state === 2) T.label(ctx, '✓', x + w - 10, s.y, { size: L.fs, color: C.mint, align: 'right', weight: 600 });
    else if (state === 1) {
      ctx.beginPath(); ctx.arc(x + w - 10, s.y, 3, Tt * 6, Tt * 6 + 4.2); ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4; ctx.stroke();
    }
    if (isH || isS) { T.rrect(ctx, x - 2, y - 2, w + 4, h + 4, 8); ctx.strokeStyle = isS ? rgba(C.sky, .85) : 'rgba(244,238,226,.5)'; ctx.setLineDash(isS ? [3, 3] : []); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
    hits.push({ t: 'step', id: s.id, x, y, w, h, tip: s.tip });
  }

  function drawPackets(Tt) {
    sc.steps.forEach(s => {
      if (!s.arch.length) return;
      const p = (Tt - s.t0) / s.dur;
      if (p < 0 || p > 1.2) return;
      s.arch.forEach((k, j) => {
        const q = T.bez({ x: s.x, y: s.y - L.nh / 2 }, archPos(AIDX[k]), .12), pp = p - j * .08, sp = archPos(AIDX[k]);
        if (pp < 0) return;
        if (pp < .9) T.strokeBez(ctx, q, C.steel, 1, .3 * (1 - pp), [2, 3]);
        let u = -1, col = C.amber;
        if (pp < .42) u = ease.inOut(pp / .42);
        else if (pp > .48 && pp < .9) { u = 1 - ease.inOut((pp - .48) / .42); col = C.sky; }
        if (u >= 0) { const pt = T.bezPt(q, u); T.glow(ctx, pt.x, pt.y, 9, col, .5); dot(pt.x, pt.y, 2.2, '#fff6e6'); }
        if (pp > .5 && pp < 1.15) T.label(ctx, s.lat, sp.x, sp.y - (wide ? 20 : 17), { size: 9.5, color: C.sky, align: 'center', pill: true, pad: 5 });
      });
    });
  }

  function drawTip(Tt) {
    const o = hover || (sel ? hits.find(h => h.t === 'step' && h.id === sel.id) : null);
    if (!o) return;
    ctx.font = T.font(10.5, 400);
    const tw = ctx.measureText(o.tip).width + 16;
    const ax = hover && mouse ? mouse[0] : o.x + o.w / 2, ay = hover && mouse ? mouse[1] - 16 : o.y + o.h + 14;
    let tx = ax - tw / 2; tx = clamp(tx, 6, L.w - tw - 6);
    const ty = clamp(ay, 14, L.h - 14);
    T.label(ctx, o.tip, tx + 8, ty, { size: 10.5, color: C.ink, pill: 'rgba(15,13,10,.94)', border: 'rgba(143,179,220,.5)', pad: 8, radius: 6 });
  }

  /* ---------------- main draw ---------------- */
  function draw(t, dt) {
    const w = fig.w, h = fig.h;
    if (!w) return;
    if (!L.w || L.w !== w || L.h !== h) layout(w, h);
    let Tt = t - base;
    if (Tt >= sc.loop) {
      const over = Tt - sc.loop;
      if (cycle) { const nx = ORDER[(ORDER.indexOf(sc.key) + 1) % ORDER.length]; sc = SC[nx]; sel = null; place(); fig.setStatus('schematic replay · ' + sc.pipe); if (chipApi) chipApi.set(nx); }
      base = t - over; Tt = over; logN = -1;
    }
    hits.length = 0;
    T.bg(ctx, w, h, { tint: C.amber, tx: .55, ty: 0, grid: 28 });
    drawStars(t);
    drawArchives(Tt);
    drawEdges(Tt);
    sc.steps.forEach(s => drawNode(s, Tt));
    drawPackets(Tt);
    drawQuery(Tt);
    drawPlanner(Tt);
    // captions
    T.label(ctx, 'PIPELINE DAG · ' + sc.pipe, wide ? L.cx0 : 14, wide ? 112 : L.dagTop - 20, { size: 9.5, color: C.faint });
    // cards
    const rects = cardRects();
    if (wide || w >= 640) sc.cards.forEach((c, i) => drawCard(c, rects[i], Tt));
    else {
      let k = 0; sc.cards.forEach((c, i) => { if (Tt >= c.step.t0 + c.step.dur * .7) k = i; });
      drawCard(sc.cards[k], rects[0], Tt);
      sc.cards.forEach((c, i) => dot(w / 2 + (i - 1) * 10, rects[0].y - 8, 2.4, i === k ? C.amber : 'rgba(236,224,200,.2)'));
    }
    drawTip(Tt);
    // fade in / out
    const fi = clamp(1 - Tt / .35, 0, 1), fo = clamp((Tt - (sc.loop - .5)) / .5, 0, 1), fa = Math.max(fi, fo);
    if (fa > 0.01) { ctx.fillStyle = rgba(C.bg, fa * .92); ctx.fillRect(0, 0, w, h); }
    if (wide) renderLog(Tt);
    // timeline hairline progress
    ctx.fillStyle = rgba(C.amber, .5); ctx.fillRect(0, h - 2, w * clamp(Tt / sc.loop, 0, 1), 2);
  }

  /* ---------------- interaction ---------------- */
  function hitAt(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) { const o = hits[i]; if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o; }
    return null;
  }
  T.pointer(fig.canvas, {
    move(x, y) { mouse = [x, y]; hover = hitAt(x, y); fig.canvas.style.cursor = hover && (hover.t !== 'arch') ? 'pointer' : 'default'; if (loop && loop.paused) loop.redraw(); },
    leave() { mouse = null; hover = null; if (loop && loop.paused) loop.redraw(); },
    click(x, y) {
      const o = hitAt(x, y);
      if (!o) { sel = null; }
      else if (o.t === 'step') sel = sel && sel.id === o.id ? null : { id: o.id };
      else if (o.t === 'chip' && PIPE_TO_SC[o.id]) { cycle = false; syncCycle(); setScenario(PIPE_TO_SC[o.id], true); return; }
      if (loop && loop.paused) loop.redraw();
    }
  });

  /* ---------------- controls ---------------- */
  chipApi = T.chips(fig.controls, 'Pipeline', ORDER.map(k => ({ key: k, label: SC_DEF[k].label })), k => { cycle = false; syncCycle(); setScenario(k, true); }, 'A');
  const gRun = T.group(fig.controls, 'Replay');
  pauseBtn = T.button(gRun, 'Pause', () => {
    loop.paused = !loop.paused; pauseBtn.textContent = loop.paused ? 'Resume' : 'Pause'; pauseBtn.classList.toggle('is-on', loop.paused);
  });
  T.button(gRun, 'Step ▸', () => {
    const Tt = loop.t - base;
    const nx = sc.steps.map(s => s.t0).filter(x => x > Tt + .05).sort((a, b) => a - b)[0];
    loop.paused = true; pauseBtn.textContent = 'Resume'; pauseBtn.classList.add('is-on');
    if (nx == null) { base = loop.t; loop.t = loop.t + .01; } else loop.t = base + nx + .75;
  }, { title: 'Jump to the next step' });
  T.button(gRun, 'Restart', () => { base = loop.t; logN = -1; loop.redraw(); });
  cycleBtn = T.button(gRun, 'Auto-cycle', () => { cycle = !cycle; syncCycle(); }, { active: true, pressed: true });
  function syncCycle() { if (!cycleBtn) return; cycleBtn.classList.toggle('is-on', cycle); cycleBtn.setAttribute('aria-pressed', String(cycle)); }
  const gSp = T.group(fig.controls, '');
  const lab = document.createElement('label'); lab.className = 'tv-range';
  lab.innerHTML = '<span>Speed</span><input type="range" min="0.5" max="2" step="0.25" value="1" aria-label="Playback speed"><output>1.0×</output>';
  const inp = lab.querySelector('input'), out = lab.querySelector('output');
  inp.addEventListener('input', () => { loop.speed = +inp.value; out.textContent = (+inp.value).toFixed(2).replace(/0$/, '') + '×'; });
  gSp.append(lab);

  loop = T.run(fig, { draw, resize: (w, h) => layout(w, h), still: 15 });
  setScenario('A');
})();
