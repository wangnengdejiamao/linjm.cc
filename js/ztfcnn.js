/* =================================================================
   ZTF eclipsing-binary CNN classifier — interactive schematic.
   Phase-folded ZTF light curve → 224×224 image → lightweight CNN →
   softmax over { EA (Algol), EW (W UMa), Non-EB }.
   Mirrors github.com/wangnengdejiamao/ztf_CNN_maoclassification
   (GhostNet 99.37% / MobileNetV2 99.57% on 1,884 test curves).
   Schematic teaching tool — the confusion matrix & costs are the real ones.
   ================================================================= */
(function () {
  const canvas = document.getElementById('cnnCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRAME_MS = 1000 / 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // palette (warm-dark theme)
  const INK = '#efe7d4', SOFT = '#b4a98e', DIM = '#7d735d', LINE = '#473d27',
        ACC = '#e0975a', WELL = '#0c0a06';
  const CCOL = { EA: '#6f8fe0', EW: '#e0975a', NonEB: '#9aa0ad' };
  const CLASSES = ['EA', 'EW', 'NonEB'];
  const CLABEL = { EA: 'EA · Algol', EW: 'EW · W UMa', NonEB: 'Non-EB' };

  const MODELS = {
    ghost:     { name: 'GhostNet',    params: '5.2M', flops: '141M', acc: '99.37%', sharp: 1.0 },
    mobilenet: { name: 'MobileNetV2', params: '3.5M', flops: '300M', acc: '99.57%', sharp: 1.18 },
  };
  // real GhostNet normalized confusion matrix (row = truth → cols EA/EW/NonEB)
  const CM = { EA: [0.78, 0.15, 0.07], EW: [0.01, 0.94, 0.04], NonEB: [0.00, 0.01, 0.99] };

  // state
  let cls = 'EW', model = 'ghost', noise = 0.12;
  let W = 0, H = 0, t = 0, visible = true, paused = false, raf = 0, timer = 0, last = 0, speed = 1;
  let dispP = [0.06, 0.88, 0.06];   // eased softmax for the bars
  let actPhase = 0;                  // travelling activation pulse 0..1 per stage

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, x) => a + (b - a) * x;
  // deterministic pseudo-noise so the scatter is stable per frame band
  function nz(i) { const s = Math.sin(i * 12.9898) * 43758.5453; return (s - Math.floor(s)) - 0.5; }

  // ---- light-curve model: flux(phase 0..1) for a class ----
  function gauss(ph, c, w) { let d = Math.abs(ph - c); d = Math.min(d, 1 - d); return Math.exp(-(d * d) / (2 * w * w)); }
  function baseFlux(c, ph) {
    if (c === 'EA') return 1 - 0.62 * gauss(ph, 0, 0.035) - 0.20 * gauss(ph, 0.5, 0.04);
    if (c === 'EW') return 1 - 0.34 * (0.5 + 0.5 * Math.cos(4 * Math.PI * ph)) - 0.015 * Math.sin(2 * Math.PI * ph);
    return 0.9; // Non-EB: no coherent signal
  }

  // ---- classifier: probabilities from (trueClass, noise, model) ----
  function predict() {
    const base = CM[cls].slice();
    let g = cls !== 'NonEB' ? clamp((noise - 0.18) / 0.62, 0, 0.92) : 0; // noise → "Non-EB"
    let p = [base[0] * (1 - g), base[1] * (1 - g), base[2] * (1 - g) + g];
    const k = MODELS[model].sharp;                       // sharper = higher-acc model
    p = p.map(v => Math.pow(Math.max(v, 1e-4), k));
    const s = p[0] + p[1] + p[2];
    return p.map(v => v / s);
  }

  // ---- layout rects ----
  let L = {};
  function layout() {
    const pad = 18, gap = 16;
    const headerH = 56;        // reserved band so "FORWARD PASS" never collides with stage labels
    const footerH = 24;
    const availH = Math.max(200, H - headerH - footerH);
    const bandH = clamp(availH, 300, 560);          // fill the plate, but stay compact
    const top = headerH + (availH - bandH) * 0.42;  // centre the pipeline, biased slightly up
    const cw = W - pad * 2;
    const w1 = cw * 0.30, w2 = cw * 0.36, w3 = cw - w1 - w2 - gap * 2;
    const x1 = pad, x2 = x1 + w1 + gap, x3 = x2 + w2 + gap;
    const curveH = Math.round(bandH * 0.46);
    const imgS = Math.min(w1 - 6, bandH - curveH - 16);
    L = {
      curve: { x: x1, y: top, w: w1, h: curveH },
      img:   { x: x1 + (w1 - imgS) / 2, y: top + curveH + 16, w: imgS, h: imgS },
      conv:  { x: x2, y: top, w: w2, h: bandH },
      soft:  { x: x3, y: top, w: w3, h: bandH },
      flowY: top + bandH * 0.42,
    };
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function label(text, x, y, color, size, align) {
    ctx.font = '500 ' + (size || 10.5) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillStyle = color || SOFT; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  // ---- stage 1: phase-folded light curve ----
  function drawCurve(b) {
    label('PHASE-FOLDED CURVE', b.x, b.y - 10, DIM, 9.5);
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; roundRect(b.x, b.y, b.w, b.h, 6); ctx.stroke();
    const px = b.x + 8, py = b.y + 8, pw = b.w - 16, ph = b.h - 18;
    const fy = f => py + ph * (1 - (f - 0.45) / 0.62);   // flux 0.45..1.07 → box
    // scatter points (data), amplitude grows with noise
    const cc = CCOL[cls];
    for (let i = 0; i < 90; i++) {
      const u = i / 90, x = px + pw * u;
      const f = baseFlux(cls, u) + nz(i + Math.floor(t * 0.6)) * (0.05 + noise * 0.5) * (cls === 'NonEB' ? 1.4 : 1);
      ctx.fillStyle = 'rgba(' + (cls === 'EW' ? '224,151,90' : cls === 'EA' ? '111,143,224' : '154,160,173') + ',.55)';
      ctx.beginPath(); ctx.arc(x, clamp(fy(f), py, py + ph), 1.5, 0, 7); ctx.fill();
    }
    // model line (clean) — hidden-ish for Non-EB
    if (cls !== 'NonEB') {
      ctx.strokeStyle = cc; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const u = i / 120, x = px + pw * u, y = fy(baseFlux(cls, u)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    // sweeping phase marker
    const mu = (t * 0.18) % 1, mx = px + pw * mu;
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, py); ctx.lineTo(mx, py + ph); ctx.stroke();
  }

  // ---- stage 2: 224×224 CNN input image ----
  function drawImage(b) {
    label('CNN INPUT · 1×224×224', b.x, b.y - 10, DIM, 9.5);
    ctx.fillStyle = WELL; roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); roundRect(b.x, b.y, b.w, b.h, 5); ctx.clip();
    // faint grid
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const gx = b.x + b.w * i / 6; ctx.beginPath(); ctx.moveTo(gx, b.y); ctx.lineTo(gx, b.y + b.h); ctx.stroke(); }
    // render the folded curve as a bright trace (= the grayscale image the CNN sees)
    const fy = f => b.y + 6 + (b.h - 12) * (1 - (f - 0.45) / 0.62);
    ctx.strokeStyle = 'rgba(240,231,212,.9)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = i / 120, x = b.x + 4 + (b.w - 8) * u;
      const f = baseFlux(cls, u) + (cls === 'NonEB' ? nz(i * 3) * 0.5 : 0);
      const y = clamp(fy(f), b.y + 3, b.y + b.h - 3); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  }

  // ---- stage 3: lightweight CNN (feature-map stacks) ----
  function drawConv(b) {
    label('LIGHTWEIGHT CNN · ' + MODELS[model].name.toUpperCase(), b.x, b.y - 10, DIM, 9.5);
    const layers = [4, 6, 8, 6];           // feature maps per block
    const n = layers.length, cy = b.y + b.h * 0.42;
    const colW = b.w / n;
    const base = clamp(b.h * 0.13, 44, 62);          // conv square size scales with plate height
    const sz = li => clamp(base - li * 6, 18, 64);
    for (let li = 0; li < n; li++) {
      const cnt = layers[li], cx = b.x + colW * (li + 0.5);
      const size = sz(li), off = 3.4;
      // activation wave: which layer is "lit" right now
      const lit = clamp(1 - Math.abs((actPhase * (n + 1)) - (li + 0.5)) * 1.4, 0, 1);
      for (let k = cnt - 1; k >= 0; k--) {
        const ox = cx - (cnt * off) / 2 + k * off, oy = cy - size / 2 - (cnt * off) / 2 + k * off;
        const a = 0.16 + 0.5 * lit * (k === 0 ? 1 : 0.5);
        ctx.fillStyle = 'rgba(224,151,90,' + a.toFixed(3) + ')';
        ctx.strokeStyle = 'rgba(224,151,90,' + (0.25 + 0.4 * lit).toFixed(3) + ')'; ctx.lineWidth = 1;
        roundRect(ox, oy, size, size, 3); ctx.fill(); ctx.stroke();
      }
      label(['conv', 'ghost', 'ghost', 'pool'][li] || 'conv', cx, cy + size / 2 + (cnt * off) / 2 + 16, lit > 0.4 ? ACC : DIM, 8.5, 'center');
      if (li < n - 1) { // connector
        const nx = b.x + colW * (li + 1.5) - sz(li + 1) / 2 - (layers[li + 1] * off) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + size / 2 + (cnt * off) / 2, cy); ctx.lineTo(nx, cy); ctx.stroke();
      }
    }
    label('global pool → FC → softmax', b.x + b.w / 2, b.y + b.h - 6, DIM, 9, 'center');
  }

  // ---- stage 4: softmax probability bars ----
  function drawSoftmax(b) {
    label('SOFTMAX · P(class)', b.x, b.y - 10, DIM, 9.5);
    const pred = dispP.indexOf(Math.max(...dispP));
    const rowH = clamp(b.h / 7.2, 44, 62), barX = b.x, barW = b.w, y0 = b.y + b.h * 0.5 - rowH * 1.5;
    for (let i = 0; i < 3; i++) {
      const c = CLASSES[i], y = y0 + i * rowH, isPred = i === pred;
      label(CLABEL[c], barX, y - 4, isPred ? INK : SOFT, 10.5);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; roundRect(barX, y, barW, 11, 5.5); ctx.fill();
      const w = Math.max(2, barW * dispP[i]);
      ctx.fillStyle = isPred ? CCOL[c] : 'rgba(' + (c === 'EW' ? '224,151,90' : c === 'EA' ? '111,143,224' : '154,160,173') + ',.45)';
      roundRect(barX, y, w, 11, 5.5); ctx.fill();
      label((dispP[i] * 100).toFixed(1) + '%', barX + barW, y - 4, isPred ? CCOL[c] : DIM, 10, 'right');
    }
    // verdict
    ctx.font = '600 13px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left'; ctx.fillStyle = CCOL[CLASSES[pred]];
    ctx.fillText('▸ ' + CLABEL[CLASSES[pred]], barX, y0 + rowH * 3 + 14);
    label('argmax', barX + barW, y0 + rowH * 3 + 14, DIM, 9.5, 'right');
  }

  // ---- travelling pulse across the pipeline ----
  function drawFlow() {
    const segs = [[L.curve.x + L.curve.w, L.conv.x], [L.conv.x + L.conv.w, L.soft.x]];
    const u = actPhase, y = L.flowY;
    segs.forEach(([a, c], si) => {
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(c, y); ctx.stroke();
      const lu = clamp(u * 2 - si, 0, 1), px = lerp(a, c, lu);
      if (lu > 0 && lu < 1) {
        const g = ctx.createRadialGradient(px, y, 0, px, y, 9);
        g.addColorStop(0, 'rgba(238,176,121,.9)'); g.addColorStop(1, 'rgba(238,176,121,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, y, 9, 0, 7); ctx.fill();
      }
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    label('FORWARD PASS', 18, 24, SOFT, 10.5);
    label(MODELS[model].name + ' · ' + MODELS[model].acc + ' test acc', W - 18, 24, DIM, 9.5, 'right');
    drawCurve(L.curve); drawImage(L.img); drawConv(L.conv); drawFlow(); drawSoftmax(L.soft);
  }

  // ---- DOM readout + confusion matrix ----
  const $ = id => document.getElementById(id);
  function refresh() {
    const p = predict(), pred = p.indexOf(Math.max(...p)), m = MODELS[model];
    if ($('cnnTrue')) $('cnnTrue').textContent = CLABEL[cls];
    if ($('cnnPred')) { $('cnnPred').textContent = CLABEL[CLASSES[pred]]; $('cnnPred').style.color = CCOL[CLASSES[pred]]; }
    if ($('cnnConf')) $('cnnConf').textContent = (p[pred] * 100).toFixed(1) + '%';
    if ($('cnnModel')) $('cnnModel').textContent = m.name;
    if ($('cnnCost')) $('cnnCost').textContent = m.params + ' · ' + m.flops;
    if ($('cnnAcc')) $('cnnAcc').textContent = m.acc;
    document.querySelectorAll('#cnnCM .cm-row').forEach((r, i) => r.classList.toggle('cm-row-on', CLASSES[i] === cls));
  }
  function buildCM() {
    const host = $('cnnCM'); if (!host) return;
    const head = ['', 'EA', 'EW', 'N-EB'];
    let html = head.map((h, i) => '<div class="' + (i ? 'cm-ch' : 'cm-cnr') + '">' + h + '</div>').join('');
    CLASSES.forEach((rc) => {
      html += '<div class="cm-rh">' + (rc === 'NonEB' ? 'N-EB' : rc) + '</div>';
      html += '<div class="cm-row" style="display:contents">';
      CM[rc].forEach((v, j) => {
        const on = j === CLASSES.indexOf(rc);
        const bg = 'rgba(224,151,90,' + (0.08 + v * 0.62).toFixed(3) + ')';
        html += '<div class="cm-cell" style="background:' + bg + (on ? ';color:#1c1408;font-weight:600' : '') + '">' + (v * 100).toFixed(0) + '</div>';
      });
      html += '</div>';
    });
    host.innerHTML = html;
  }

  // ---- loop ----
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1; last = now;
    if (!paused) { t += 0.016 * dt * speed; actPhase = (actPhase + 0.006 * dt * speed) % 1; }
    const tgt = predict();
    for (let i = 0; i < 3; i++) dispP[i] += (tgt[i] - dispP[i]) * 0.12;
    draw();
    if (alive()) start();
  }
  function alive() { return !reduce && visible && !document.hidden; }
  function start() { if (raf || timer || !alive()) return; timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(frame); }, FRAME_MS); }
  function stop() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0; last = 0; }

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }

  // ---- controls ----
  function wireChips(sel, attr, set) {
    document.querySelectorAll(sel).forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll(sel).forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); set(btn.dataset[attr]); dispP = predict(); refresh(); if (!alive()) draw();
    }));
  }
  wireChips('#cnnClassChips .chip', 'cls', v => cls = v);
  wireChips('#cnnModelChips .chip', 'model', v => model = v);
  const ns = $('cnnNoise'); if (ns) ns.addEventListener('input', e => { noise = +e.target.value; refresh(); if (!alive()) draw(); });
  const sp = $('cnnSpeed'); if (sp) sp.addEventListener('input', e => speed = +e.target.value);
  const pz = $('cnnPause'); if (pz) pz.addEventListener('click', () => { paused = !paused; pz.textContent = paused ? 'Play' : 'Pause'; pz.setAttribute('aria-pressed', String(paused)); if (!paused) start(); });

  // ---- init ----
  buildCM(); resize(); refresh(); dispP = predict(); draw();
  window.addEventListener('resize', () => { resize(); if (!alive()) draw(); else start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); else stop(); }, { threshold: 0.05 }).observe(canvas);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  if (reduce) draw(); else start();
})();
