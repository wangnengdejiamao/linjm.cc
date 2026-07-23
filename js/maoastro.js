/* maoAstro §01 — AttnRes depth-attention visualization + weight heatmap + eval bars.
   Schematic: 32 layers grouped into 8 blocks. A knowledge signal injected at a block
   decays under standard residual, but survives under AttnRes (learnable depth-attention). */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NBLOCK = 8;

  function fitCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return r;
    };
    let rect = fit();
    window.addEventListener('resize', () => { rect = fit(); }, { passive: true });
    return { ctx, get w() { return rect.width; }, get h() { return rect.height; } };
  }

  const css = getComputedStyle(document.documentElement);
  const C = {
    accent: (css.getPropertyValue('--accent') || '#a85518').trim(),
    accentSoft: (css.getPropertyValue('--accent-soft') || '#c2722a').trim(),
    cyan: (css.getPropertyValue('--cyan') || '#2c83c4').trim(),
    green: (css.getPropertyValue('--green') || '#1f9e78').trim(),
    odDim: '#8c8470'
  };

  const stage = {
    mode: 'attnres',       // 'std' | 'attnres'
    inject: 1,             // 1..4 (block index, 1-based)
    speed: 1, paused: false, t: 0
  };

  const attnCanvas = document.getElementById('attnresCanvas');
  const heat = document.getElementById('attnHeat');
  if (!attnCanvas) return;
  const A = fitCanvas(attnCanvas);
  const H = heat ? fitCanvas(heat) : null;

  const el = {
    mode: document.getElementById('attnMode'),
    retain: document.getElementById('attnRetain'),
    params: document.getElementById('attnParams')
  };

  // retained signal at each block (0..1), given mode + injection block
  function retained(blockIdx) { // blockIdx 0-based, from injection upward
    const inj = stage.inject - 1;
    if (blockIdx < inj) return 0.12;        // below injection: baseline
    const up = blockIdx - inj;
    if (stage.mode === 'std') return Math.max(0.06, Math.pow(0.8, up));
    // attnres: depth-attention reads injected block directly → near-flat retention
    return Math.min(1, 0.9 - 0.015 * up + 0.02 * Math.sin(stage.t * 1.4 + blockIdx));
  }

  function topRetain() {
    const inj = stage.inject - 1, up = (NBLOCK - 1) - inj;
    return stage.mode === 'std' ? Math.pow(0.8, up) : 0.90 + 0.008 * stage.inject;
  }

  function updateReadout() {
    if (el.mode) el.mode.textContent = stage.mode === 'std' ? 'Standard residual' : 'AttnRes (depth-attention)';
    if (el.retain) {
      const v = Math.round(topRetain() * 100);
      el.retain.textContent = v + '%';
      el.retain.style.color = v >= 70 ? C.green : (v < 40 ? '#c0532b' : '');
    }
    if (el.params) el.params.textContent = stage.mode === 'std'
      ? 'base residual (fixed = 1)' : '~10K (pseudo-query)';
  }

  // rising particles
  const parts = Array.from({ length: 26 }, (_, i) => ({ b: Math.random() * NBLOCK, x: Math.random(), off: Math.random() }));

  function drawMain() {
    const ctx = A.ctx, w = A.w, h = A.h;
    ctx.clearRect(0, 0, w, h);
    const padT = 30, padB = 26, padL = w * 0.10, colW = w * 0.34;
    const bh = (h - padT - padB) / NBLOCK;      // band height
    const yOf = (b) => padT + (NBLOCK - 1 - b) * bh; // b=0 bottom
    const inj = stage.inject - 1;

    // title labels
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = C.odDim; ctx.textBaseline = 'alphabetic';
    ctx.fillText('input ↑ output', padL - 4, 16);
    ctx.textAlign = 'right';
    ctx.fillText('32 layers · 8 blocks', w - 10, 16);
    ctx.textAlign = 'left';

    // skip arcs (attnres): injected block → each higher block, on the right of the column
    if (stage.mode === 'attnres') {
      const ax = padL + colW + 6;
      for (let b = inj + 1; b < NBLOCK; b++) {
        const y0 = yOf(inj) + bh / 2, y1 = yOf(b) + bh / 2;
        const bulge = 26 + (b - inj) * 10;
        ctx.beginPath();
        ctx.moveTo(ax, y0);
        ctx.quadraticCurveTo(ax + bulge, (y0 + y1) / 2, ax, y1);
        const a = 0.28 + 0.4 * (0.5 + 0.5 * Math.sin(stage.t * 2 - b));
        ctx.strokeStyle = 'rgba(79,208,227,' + a.toFixed(3) + ')';
        ctx.lineWidth = 1.4; ctx.stroke();
        // travelling dot along arc
        const ph = (stage.t * 0.5 + b * 0.2) % 1;
        const mx = (1 - ph) * (1 - ph) * ax + 2 * (1 - ph) * ph * (ax + bulge) + ph * ph * ax;
        const my = (1 - ph) * (1 - ph) * y0 + 2 * (1 - ph) * ph * ((y0 + y1) / 2) + ph * ph * y1;
        ctx.beginPath(); ctx.arc(mx, my, 2.4, 0, 7); ctx.fillStyle = '#4fd0e3'; ctx.fill();
      }
    }

    // blocks
    for (let b = 0; b < NBLOCK; b++) {
      const y = yOf(b), ret = retained(b);
      const isInj = b === inj;
      // band base
      roundRect(ctx, padL, y + 3, colW, bh - 6, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.lineWidth = isInj ? 2 : 1;
      ctx.strokeStyle = isInj ? C.accent : 'rgba(188,179,156,.28)';
      ctx.stroke();
      // retained-signal fill (width proportional to retained strength)
      const fw = (colW - 12) * ret;
      roundRect(ctx, padL + 6, y + bh / 2 - 5, Math.max(4, fw), 10, 4);
      const col = ret >= 0.6 ? C.green : (ret >= 0.3 ? C.accentSoft : '#8a5a3a');
      const grad = ctx.createLinearGradient(padL, 0, padL + colW, 0);
      grad.addColorStop(0, col); grad.addColorStop(1, isInj ? C.accent : col);
      ctx.fillStyle = grad; ctx.fill();
      // label
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillStyle = isInj ? C.accentSoft : C.odDim;
      ctx.fillText('block ' + (b + 1), padL + 10, y + 13);
      ctx.textAlign = 'right';
      ctx.fillStyle = ret >= 0.6 ? '#9fe6c8' : C.odDim;
      ctx.fillText(Math.round(ret * 100) + '%', padL + colW - 8, y + 13);
      ctx.textAlign = 'left';
      if (isInj) {
        ctx.fillStyle = C.accent; ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.fillText('◀ knowledge injected', padL + colW + (stage.mode === 'attnres' ? 60 : 8), y + bh / 2 + 3);
      }
    }

    // rising particles inside the column
    parts.forEach(p => {
      const yb = padT + (h - padT - padB) * (1 - ((p.x))); // bottom→top
      const strength = retained(Math.min(NBLOCK - 1, Math.floor((1 - p.x) * NBLOCK)));
      const x = padL + 14 + p.off * (colW - 28);
      ctx.beginPath(); ctx.arc(x, yb, 1.6, 0, 7);
      ctx.fillStyle = 'rgba(79,208,227,' + (0.15 + 0.5 * strength).toFixed(3) + ')'; ctx.fill();
      if (!reduce && !stage.paused) { p.x += 0.0026 * stage.speed * (0.5 + strength); if (p.x > 1) { p.x = 0; p.off = Math.random(); } }
    });

    // caption at bottom
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillStyle = C.odDim;
    ctx.fillText(stage.mode === 'std'
      ? 'standard residual: fixed add → deep-knowledge forgetting'
      : 'AttnRes: learnable depth-attention → knowledge preserved', padL, h - 8);
  }

  function drawHeat() {
    if (!H) return;
    const ctx = H.ctx, w = H.w, h = H.h;
    ctx.clearRect(0, 0, w, h);
    const pad = 16, gap = 3;
    const cell = (Math.min(w, h) - pad * 2 - gap * (NBLOCK - 1)) / NBLOCK;
    const x0 = pad, y0 = pad;
    const inj = stage.inject - 1;
    const qRow = Math.floor((stage.t * 0.8) % NBLOCK); // animated query highlight
    for (let r = 0; r < NBLOCK; r++) {
      for (let c = 0; c <= r; c++) {
        let wgt;
        if (stage.mode === 'std') {
          wgt = (c === r) ? 0.45 : (c === r - 1 ? 1 : 0.0);
        } else {
          // learned-looking: emphasis on previous block, self, and the injected block
          wgt = 0.18 + 0.5 * Math.exp(-(r - c) * 0.5);
          if (c === inj) wgt = Math.max(wgt, 0.85);
          if (c === r) wgt = Math.max(wgt, 0.5);
        }
        const x = x0 + c * (cell + gap), y = y0 + r * (cell + gap);
        ctx.fillStyle = wgt <= 0.02
          ? 'rgba(255,255,255,.03)'
          : 'rgba(' + mix(wgt) + ',' + (0.15 + 0.8 * wgt).toFixed(3) + ')';
        roundRect(ctx, x, y, cell, cell, 2); ctx.fill();
        if (r === qRow && c <= r) { ctx.strokeStyle = 'rgba(168,85,24,.9)'; ctx.lineWidth = 1.4; ctx.stroke(); }
      }
    }
    // axis labels
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = C.odDim;
    ctx.fillText('key blocks →', x0, y0 - 5);
    ctx.save(); ctx.translate(x0 - 6, y0 + cell * 3); ctx.rotate(-Math.PI / 2);
    ctx.fillText('query →', 0, 0); ctx.restore();
  }

  function mix(w) { // teal→amber gradient rgb by weight
    const a = [44, 131, 196], b = [200, 133, 40];
    return a.map((v, i) => Math.round(v + (b[i] - v) * w)).join(',');
  }
  function roundRect(ctx, x, y, w, h, r) {
    if (!(w > 0) || !(h > 0)) return;        // guard: skip degenerate rects
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop() {
    if (!reduce && !stage.paused) stage.t += 0.016 * stage.speed;
    try { drawMain(); drawHeat(); } catch (e) { /* transient layout frame — retry next tick */ }
    requestAnimationFrame(loop);
  }
  updateReadout();
  requestAnimationFrame(loop);   // start after first layout frame is settled

  // ---- controls ----
  document.querySelectorAll('[data-attn]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-attn]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); stage.mode = btn.dataset.attn; updateReadout();
  }));
  const inj = document.getElementById('attnInject');
  if (inj) inj.addEventListener('input', e => { stage.inject = +e.target.value; updateReadout(); });
  const sp = document.getElementById('attnSpeed');
  if (sp) sp.addEventListener('input', e => { stage.speed = +e.target.value; });
  const pause = document.getElementById('attnPause');
  if (pause) pause.addEventListener('click', () => {
    stage.paused = !stage.paused;
    pause.setAttribute('aria-pressed', String(stage.paused));
    pause.textContent = stage.paused ? 'Play' : 'Pause';
  });

  /* ---------------- Eval bars ---------------- */
  const evalData = {
    domain: { label: 'Domain-QA accuracy — higher is better', max: 100, unit: '%',
      rows: [['maoAstro', 89.2, true], ['GPT-4o', 82, false], ['AstroSage-8B', 80.9, false]] },
    halluc: { label: 'Hallucination rate — lower is better', max: 20, unit: '%', invert: true,
      rows: [['maoAstro', 6, true], ['GPT-4o', 18, false], ['AstroSage-8B', 12, false]] },
    reason: { label: 'Complex-reasoning accuracy — higher is better', max: 100, unit: '%',
      rows: [['maoAstro', 83, true], ['GPT-4o', 76, false], ['AstroSage-8B', 78, false]] }
  };
  const barsEl = document.getElementById('evalBars');
  function renderBars(metric) {
    if (!barsEl) return;
    const d = evalData[metric];
    barsEl.innerHTML = '';
    const cap = document.createElement('div');
    cap.className = 'eb-cap'; cap.style.cssText = 'font-family:var(--mono);font-size:.7rem;color:var(--ink-dim);margin-bottom:.2rem';
    cap.textContent = d.label; barsEl.appendChild(cap);
    d.rows.forEach(([name, val, me]) => {
      const row = document.createElement('div'); row.className = 'eb-row';
      const pct = Math.min(100, (val / d.max) * 100);
      row.innerHTML =
        '<span class="eb-name' + (me ? ' eb-me' : '') + '">' + name + '</span>' +
        '<div class="eb-track"><div class="eb-fill' + (me ? ' eb-fill-me' : '') + '"></div></div>' +
        '<span class="eb-val">' + val + d.unit + '</span>';
      barsEl.appendChild(row);
      requestAnimationFrame(() => { row.querySelector('.eb-fill').style.width = pct + '%'; });
    });
  }
  const evalSwitch = document.getElementById('evalSwitch');
  if (evalSwitch) evalSwitch.addEventListener('click', e => {
    const btn = e.target.closest('[data-metric]'); if (!btn) return;
    evalSwitch.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active'); renderBars(btn.dataset.metric);
  });
  renderBars('domain');
})();
