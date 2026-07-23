/* Jindu §02 — materials-science knowledge graph (Leiden communities, clickable),
   Lab Agent workflow stepper → protocol synthesis, and extraction-pipeline animation. */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('jinduKG');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const css = getComputedStyle(document.documentElement);
  const COMM = [
    { key: 'solvent', name: 'Solvents', c: '#56b4e9' },
    { key: 'salt', name: 'Li salts', c: '#e69f00' },
    { key: 'additive', name: 'Additives', c: '#1f9e78' },
    { key: 'prop', name: 'Interphase & properties', c: '#b06fb0' }
  ];
  const commColor = k => (COMM.find(c => c.key === k) || COMM[0]).c;

  // nodes: normalized positions in [0,1]  (battery-electrolyte KG)
  const nodes = [
    { id: 'elyte', label: 'electrolyte', comm: 'solvent', x: .34, y: .32, r: 12 },
    { id: 'ec', label: 'EC', comm: 'solvent', x: .16, y: .18, r: 8 },
    { id: 'dmc', label: 'DMC', comm: 'solvent', x: .16, y: .44, r: 8 },
    { id: 'dmso', label: 'DMSO', comm: 'solvent', x: .10, y: .70, r: 6 },
    { id: 'thf', label: 'THF', comm: 'solvent', x: .24, y: .82, r: 6 },
    { id: 'lipf6', label: 'LiPF₆', comm: 'salt', x: .50, y: .14, r: 10 },
    { id: 'fec', label: 'FEC', comm: 'additive', x: .60, y: .40, r: 10 },
    { id: 'vc', label: 'VC', comm: 'additive', x: .50, y: .60, r: 9 },
    { id: 'sei', label: 'SEI film', comm: 'prop', x: .74, y: .54, r: 12 },
    { id: 'sigma', label: 'ionic σ', comm: 'prop', x: .86, y: .32, r: 8 },
    { id: 'window', label: 'stability window', comm: 'prop', x: .84, y: .74, r: 8 },
    { id: 'eis', label: 'EIS', comm: 'prop', x: .64, y: .84, r: 6 }
  ];
  const NID = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = [
    ['elyte', 'ec'], ['elyte', 'dmc'], ['elyte', 'lipf6'], ['elyte', 'dmso'], ['elyte', 'thf'],
    ['fec', 'elyte'], ['vc', 'elyte'], ['fec', 'sei'], ['vc', 'sei'],
    ['lipf6', 'sei'], ['ec', 'sei'], ['sei', 'sigma'], ['sei', 'window'],
    ['eis', 'sei'], ['eis', 'sigma'], ['lipf6', 'sigma']
  ];
  const adj = {};
  edges.forEach(([a, b]) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); });

  let sel = null, litSet = null, t = 0;

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return r;
  }
  let rect = fit();
  window.addEventListener('resize', () => { rect = fit(); }, { passive: true });
  const PX = n => 24 + n.x * (rect.width - 48);
  const PY = n => 20 + n.y * (rect.height - 40);

  function draw() {
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const active = sel ? new Set([sel, ...(adj[sel] || [])]) : null;
    // edges
    edges.forEach(([a, b]) => {
      const na = NID[a], nb = NID[b];
      const on = active ? (active.has(a) && active.has(b)) : (litSet ? (litSet.has(a) && litSet.has(b)) : false);
      ctx.beginPath(); ctx.moveTo(PX(na), PY(na)); ctx.lineTo(PX(nb), PY(nb));
      ctx.strokeStyle = on ? 'rgba(168,85,24,.55)' : 'rgba(150,160,180,.16)';
      ctx.lineWidth = on ? 1.8 : 1; ctx.stroke();
    });
    // nodes
    nodes.forEach(n => {
      const x = PX(n), y = PY(n);
      const dim = (active && !active.has(n.id)) || (litSet && !litSet.has(n.id) && !active);
      const pulse = 1 + (litSet && litSet.has(n.id) ? 0.12 * Math.sin(t * 3) : 0);
      ctx.globalAlpha = dim ? 0.28 : 1;
      ctx.beginPath(); ctx.arc(x, y, n.r * pulse, 0, 7);
      ctx.fillStyle = commColor(n.comm); ctx.fill();
      if (sel === n.id) { ctx.lineWidth = 2.4; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      // label
      ctx.globalAlpha = dim ? 0.4 : 1;
      ctx.font = (n.r >= 9 ? '11px' : '10px') + ' "IBM Plex Mono", monospace';
      ctx.fillStyle = '#ece5d6'; ctx.textAlign = 'center';
      ctx.fillText(n.label, x, y + n.r + 12);
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;
    if (!reduce) t += 0.016;
    requestAnimationFrame(draw);
  }
  draw();

  // legend
  const legend = document.getElementById('jinduLegend');
  if (legend) legend.innerHTML = COMM.map(c =>
    '<span><i style="background:' + c.c + '"></i>' + c.name + '</span>').join('');

  // click to select
  canvas.addEventListener('click', e => {
    const b = canvas.getBoundingClientRect();
    const mx = e.clientX - b.left, my = e.clientY - b.top;
    let best = null, bd = 1e9;
    nodes.forEach(n => { const dx = PX(n) - mx, dy = PY(n) - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n; } });
    if (best && bd < 900) { sel = (sel === best.id) ? null : best.id; litSet = null; }
    else sel = null;
  });

  /* ---------------- Lab Agent workflow ---------------- */
  const steps = ['analyze', 'rag', 'design', 'verify'];
  const stepEls = Object.fromEntries(steps.map(s => [s, document.querySelector('.lab-steps li[data-step="' + s + '"]')]));
  const proto = document.getElementById('labProto');
  const runBtn = document.getElementById('labRun');
  const protocol = [
    ['Prepare 3 electrolytes: LiPF₆/EC/DMC baseline, +2 wt% FEC, +2 wt% VC.', 'KG · additive → SEI film', ['fec', 'vc', 'lipf6', 'ec', 'dmc']],
    ['Assemble matched Li‖Cu half-cells; identical formation cycling.', 'literature · SEI formation protocol', ['elyte', 'sei']],
    ['Track SEI stability: Coulombic efficiency + EIS Rₛₑᵢ growth over N cycles.', 'KG · SEI → EIS, ionic σ', ['sei', 'eis', 'sigma']],
    ['Rank additives: lower Rₛₑᵢ rise + higher CE ⇒ more stable SEI.', 'property node · stability window', ['sei', 'window']]
  ];
  let running = false;
  function resetLab() {
    steps.forEach(s => stepEls[s] && stepEls[s].classList.remove('is-active', 'is-done'));
    litSet = null;
    if (proto) proto.innerHTML = '<p class="proto-idle">Run the workflow to synthesize a protocol from retrieved evidence.</p>';
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function runLab() {
    if (running) return; running = true; sel = null; resetLab();
    if (proto) proto.innerHTML = '';
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      steps.forEach(k => stepEls[k] && stepEls[k].classList.remove('is-active'));
      stepEls[s] && stepEls[s].classList.add('is-active');
      // light KG for retrieval/design/verify
      if (s === 'rag') litSet = new Set(['elyte', 'fec', 'vc', 'sei', 'lipf6', 'ec']);
      if (s === 'design' || s === 'verify') litSet = new Set(protocol.flatMap(p => p[2]));
      await sleep(760);
      // emit a protocol line when designing
      if (s === 'design' && proto) {
        for (let j = 0; j < protocol.length; j++) {
          const [txt, ev] = protocol[j];
          const row = document.createElement('div'); row.className = 'proto-step';
          row.innerHTML = '<span class="ps-n">' + (j + 1) + '</span><span class="ps-t"><b>Step ' + (j + 1) + '.</b> ' +
            txt + '<span class="ps-ev">↳ evidence: ' + ev + '</span></span>';
          proto.appendChild(row);
          requestAnimationFrame(() => row.classList.add('is-in'));
          await sleep(430);
        }
      }
      stepEls[s] && stepEls[s].classList.add('is-done');
    }
    if (proto) {
      const v = document.createElement('div'); v.className = 'proto-verdict';
      v.innerHTML = '✓ Protocol validated — all 4 claims evidence-backed, no unsupported step.';
      proto.appendChild(v); requestAnimationFrame(() => v.classList.add('is-in'));
    }
    running = false;
  }
  if (runBtn) runBtn.addEventListener('click', runLab);
  // auto-run once when scrolled into view
  if ('IntersectionObserver' in window && !reduce) {
    let fired = false;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting && !fired) { fired = true; setTimeout(runLab, 500); }
    }), { threshold: 0.4 });
    const mock = document.querySelector('.app-mock'); if (mock) io.observe(mock);
  }

  /* ---------------- extraction pipeline light-sweep ---------------- */
  const pipeNodes = Array.from(document.querySelectorAll('#jindu .pipe-node'));
  if (pipeNodes.length && !reduce) {
    let idx = 0;
    setInterval(() => {
      pipeNodes.forEach(n => n.classList.remove('is-lit'));
      pipeNodes[idx % pipeNodes.length].classList.add('is-lit');
      idx++;
    }, 900);
  }
})();
