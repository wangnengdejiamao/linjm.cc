/* Astro Agent §03 — A2A controlled auto-learning loop + multi-stack tech toolbox. */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------- tech toolbox -------- */
  const detail = document.getElementById('tbDetailText');
  const chips = Array.from(document.querySelectorAll('#toolbox .tb-chip'));
  function showTool(chip) {
    chips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    if (detail) detail.innerHTML = '<b>' + chip.textContent + '</b> — ' + (chip.dataset.d || '');
  }
  chips.forEach(c => {
    c.addEventListener('mouseenter', () => showTool(c));
    c.addEventListener('click', () => showTool(c));
    c.addEventListener('focus', () => showTool(c));
  });

  /* -------- A2A canvas + step machine -------- */
  const canvas = document.getElementById('a2aCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const ACC = (css.getPropertyValue('--accent') || '#a85518').trim();
  const AMBER = '#e69f00', BLUE = '#56b4e9', GREEN = '#27c499';

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return r;
  }
  let rect = fit();
  window.addEventListener('resize', () => { rect = fit(); }, { passive: true });

  const phases = [
    { key: 'evidence', label: 'Collect evidence', side: 'orch', tests: '—', reg: 'stable',
      msg: ['» evidence_pack', '  bibcode: 2021A&A…', '  method: Lomb–Scargle'] },
    { key: 'extract', label: 'Method → spec', side: 'orch', tests: '—', reg: 'stable',
      msg: ['» algorithm_spec', '  inputs: t, mag, err', '  steps: 5 · constraints'] },
    { key: 'taskgen', label: 'Task generation', side: 'orch', tests: '—', reg: 'stable',
      msg: ['» toolbox_gap.json', '  module: period.lomb', '  accept: recover P ±1%'] },
    { key: 'delegate', label: 'Delegate → Claude Code', side: 'transit', tests: 'pending', reg: 'stable',
      msg: ['→ A2A hand-off', '  claude_code_delegate', '  spec sent to worker'] },
    { key: 'implement', label: 'Implement + test', side: 'worker', tests: 'running…', reg: 'stable',
      msg: ['⚙ Claude Code', '  write tool + unit tests', '  run smoke test'] },
    { key: 'return', label: 'Return artifact', side: 'transit', tests: 'passed ✓', reg: 'stable',
      msg: ['← artifact', '  tests_passed: true', '  standard interface'] },
    { key: 'register', label: 'Validate & register', side: 'orch', tests: 'passed ✓', reg: '+1 skill',
      msg: ['✓ human review gate', '  register Skill', '  registry updated'] }
  ];
  const D = 1500; // ms per phase
  let t0 = null, lastPhase = -1, registered = 6, paused = false;

  const rd = {
    step: document.getElementById('a2aStep'),
    tests: document.getElementById('a2aTests'),
    reg: document.getElementById('a2aReg'),
    orch: document.getElementById('a2aOrch'),
    worker: document.getElementById('a2aWorker')
  };
  const logEl = document.getElementById('a2aMsg');
  function pushLog(p) {
    if (!logEl) return;
    p.msg.forEach(line => {
      const row = document.createElement('div'); row.className = 'ag-log-row';
      row.innerHTML = '<span class="ag-name">' + p.key + '</span><span class="ag-det">' + line + '</span>';
      logEl.appendChild(row);
    });
    while (logEl.children.length > 9) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function node(x, y, r, fill, stroke, label, sub, glow) {
    if (glow) { ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.fillStyle = 'rgba(168,85,24,.14)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#ece5d6';
    ctx.font = '600 12px "Hanken Grotesk", sans-serif'; ctx.fillText(label, x, y + 3);
    if (sub) { ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#a89e84'; ctx.fillText(sub, x, y + r + 14); }
    ctx.textAlign = 'left';
  }

  function draw(ts) {
    if (t0 === null) t0 = ts;
    const elapsed = paused ? (pausedAt - t0) : (ts - t0);
    const gp = Math.floor(elapsed / D);
    const phase = ((gp % phases.length) + phases.length) % phases.length;
    const frac = (elapsed % D) / D;
    const p = phases[phase];

    if (phase !== lastPhase) {
      lastPhase = phase;
      if (rd.step) rd.step.textContent = p.label;
      if (rd.tests) { rd.tests.textContent = p.tests; rd.tests.style.color = p.tests.indexOf('✓') >= 0 ? GREEN : (p.tests === 'running…' ? AMBER : ''); }
      if (p.key === 'register') registered++;
      if (rd.reg) rd.reg.textContent = p.key === 'register' ? (registered + ' skills') : (registered + ' skills');
      pushLog(p);
    }

    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const oy = h * 0.42, ox = w * 0.20, wx = w * 0.80, r = Math.min(46, w * 0.09);

    // connecting channel
    ctx.beginPath(); ctx.moveTo(ox + r, oy); ctx.lineTo(wx - r, oy);
    ctx.strokeStyle = 'rgba(150,160,180,.25)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#a89e84'; ctx.textAlign = 'center';
    ctx.fillText('A2A · task spec ⇄ artifact', (ox + wx) / 2, oy - 14); ctx.textAlign = 'left';

    // travelling packet during transit phases
    if (p.side === 'transit') {
      const goingRight = p.key === 'delegate';
      const px = goingRight ? (ox + r) + (wx - r - ox - r) * frac : (wx - r) - (wx - r - ox - r) * frac;
      ctx.beginPath(); ctx.rect(px - 20, oy - 9, 40, 18);
      ctx.fillStyle = 'rgba(14,12,8,.95)'; ctx.fill(); ctx.strokeStyle = goingRight ? ACC : GREEN; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = goingRight ? '#e6a23c' : GREEN; ctx.font = '8px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(goingRight ? '{ }.json' : 'tool ✓', px, oy + 3); ctx.textAlign = 'left';
    }

    // orchestrator (left) + worker (right)
    const orchGlow = (p.side === 'orch');
    const workGlow = (p.side === 'worker');
    node(ox, oy, r, '#141109', orchGlow ? ACC : 'rgba(168,85,24,.5)', 'Orchestrator', 'analysis_agent', orchGlow);
    node(wx, oy, r, '#0d1016', workGlow ? BLUE : 'rgba(86,180,233,.5)', 'Claude Code', 'worker agent', workGlow);
    if (workGlow) { // tests spinner ring
      ctx.beginPath(); ctx.arc(wx, oy, r + 7, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * frac);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 2.5; ctx.stroke();
    }

    // step rail (7 stations)
    const railY = h - 26, x0 = w * 0.08, x1 = w * 0.92;
    ctx.beginPath(); ctx.moveTo(x0, railY); ctx.lineTo(x1, railY); ctx.strokeStyle = 'rgba(150,160,180,.2)'; ctx.lineWidth = 1; ctx.stroke();
    phases.forEach((ph, i) => {
      const x = x0 + (x1 - x0) * (i / (phases.length - 1));
      const on = i === phase, done = i < phase;
      ctx.beginPath(); ctx.arc(x, railY, on ? 6 : 4, 0, 7);
      ctx.fillStyle = on ? ACC : (done ? GREEN : 'rgba(150,160,180,.35)'); ctx.fill();
      ctx.font = '8px "IBM Plex Mono", monospace'; ctx.fillStyle = on ? '#ece5d6' : '#a89e84'; ctx.textAlign = 'center';
      ctx.fillText('0' + (i + 1), x, railY - 10); ctx.textAlign = 'left';
    });
    // registry stack (top-left)
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#a89e84';
    ctx.fillText('skill registry: ' + registered, w * 0.08, 20);
    for (let i = 0; i < Math.min(registered, 12); i++) {
      ctx.fillStyle = i === registered - 1 && p.key === 'register' ? GREEN : 'rgba(39,196,153,.4)';
      ctx.fillRect(w * 0.08 + i * 9, 26, 6, 8);
    }

    requestAnimationFrame(draw);
  }
  let pausedAt = 0;
  requestAnimationFrame(draw);
})();
