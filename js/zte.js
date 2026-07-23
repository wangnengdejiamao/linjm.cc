/* ZTE §02 — mobile GUI agent demo: an animated phone screen driven by a
   Planner (4B, plans) ↔ Worker (32B, operates) A2A loop on OpenClaw. Schematic. */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('zteScreen');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const el = {
    task: document.getElementById('zteTask'), agent: document.getElementById('zteAgent'),
    goal: document.getElementById('zteGoal'), action: document.getElementById('zteAction'),
    step: document.getElementById('zteStep'), bus: document.getElementById('zteBus')
  };

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return r;
  }
  let rect = fit();
  window.addEventListener('resize', () => { rect = fit(); }, { passive: true });
  const W = () => rect.width, H = () => rect.height;

  function rr(x, y, w, h, r) {
    if (!(w > 0) || !(h > 0)) return;
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- app catalogue for the home grid ----------
  const APPS = [
    { id: 'luckin', name: 'Luckin', c: '#1f5fd8' }, { id: 'wechat', name: 'WeChat', c: '#3fae57' },
    { id: 'calendar', name: 'Calendar', c: '#e0544e' }, { id: 'clock', name: 'Clock', c: '#2b2b33' },
    { id: 'maps', name: 'Maps', c: '#3d8f6b' }, { id: 'photos', name: 'Photos', c: '#d98a2b' },
    { id: 'camera', name: 'Camera', c: '#6b6f7a' }, { id: 'settings', name: 'Settings', c: '#8a8f99' }
  ];
  const appIndex = id => APPS.findIndex(a => a.id === id);
  function appXY(id) { // center of an app icon in screen coords
    const i = appIndex(id); if (i < 0) return null;
    const cols = 4, m = W() * 0.09, gap = (W() - 2 * m) / cols;
    const top = H() * 0.20, rowH = H() * 0.17;
    const col = i % cols, row = Math.floor(i / cols);
    return [m + gap * col + gap / 2, top + row * rowH + rowH * 0.36];
  }

  // ---------- screens ----------
  function statusBar() {
    ctx.fillStyle = '#0c1220'; ctx.fillRect(0, 0, W(), H() * 0.06);
    ctx.fillStyle = '#cfe0f2'; ctx.font = '600 ' + (H() * 0.026) + 'px "Hanken Grotesk",sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('9:41', W() * 0.06, H() * 0.043);
    ctx.textAlign = 'right'; ctx.fillText('▪ ▪ ▪  5G  ▮', W() * 0.94, H() * 0.043); ctx.textAlign = 'left';
  }
  function drawHome(hi) {
    ctx.fillStyle = '#0a1424'; ctx.fillRect(0, 0, W(), H());
    // wallpaper glow
    const g = ctx.createRadialGradient(W() * .5, H() * .3, 10, W() * .5, H() * .3, W() * .8);
    g.addColorStop(0, 'rgba(56,189,248,.14)'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W(), H());
    statusBar();
    ctx.textAlign = 'center'; ctx.fillStyle = '#eaf3fb';
    ctx.font = '600 ' + (H() * 0.03) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText('Home', W() * .5, H() * .13);
    const s = Math.min(W(), H()) * 0.115;
    APPS.forEach(a => {
      const p = appXY(a.id); const on = hi === a.id;
      if (on) { ctx.beginPath(); ctx.arc(p[0], p[1], s * .95, 0, 7); ctx.fillStyle = 'rgba(224,164,92,.22)'; ctx.fill(); }
      rr(p[0] - s / 2, p[1] - s / 2, s, s, s * .28); ctx.fillStyle = a.c; ctx.fill();
      if (on) { ctx.lineWidth = 2; ctx.strokeStyle = '#e0a45c'; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = '700 ' + (s * .42) + 'px "Hanken Grotesk",sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(a.name[0], p[0], p[1] + s * .15);
      ctx.fillStyle = '#b9cbdd'; ctx.font = (H() * .02) + 'px "Hanken Grotesk",sans-serif';
      ctx.fillText(a.name, p[0], p[1] + s * .82);
    });
    ctx.textAlign = 'left';
  }
  function appHeader(title, color) {
    ctx.fillStyle = '#0a1424'; ctx.fillRect(0, 0, W(), H());
    ctx.fillStyle = color; ctx.fillRect(0, 0, W(), H() * 0.135);
    statusBar();
    ctx.fillStyle = '#fff'; ctx.font = '600 ' + (H() * .032) + 'px "Hanken Grotesk",sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('‹  ' + title, W() * .06, H() * .108);
  }
  function listRow(y, h, label, sub, hi, accent) {
    rr(W() * .06, y, W() * .88, h, 10);
    ctx.fillStyle = hi ? 'rgba(224,164,92,.14)' : '#101c30'; ctx.fill();
    if (hi) { ctx.lineWidth = 2; ctx.strokeStyle = '#e0a45c'; ctx.stroke(); }
    ctx.fillStyle = '#eaf3fb'; ctx.textAlign = 'left';
    ctx.font = '600 ' + (H() * .026) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText(label, W() * .1, y + h * .42);
    if (sub) { ctx.fillStyle = accent || '#8fb0cc'; ctx.font = (H() * .022) + 'px "Hanken Grotesk",sans-serif'; ctx.fillText(sub, W() * .1, y + h * .74); }
  }
  function primaryBtn(y, label, hi) {
    rr(W() * .06, y, W() * .88, H() * .075, 12);
    ctx.fillStyle = hi ? '#e0a45c' : '#1f5fd8'; ctx.fill();
    ctx.fillStyle = hi ? '#04121a' : '#fff'; ctx.textAlign = 'center';
    ctx.font = '700 ' + (H() * .028) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText(label, W() * .5, y + H() * .05); ctx.textAlign = 'left';
  }
  function drawLuckin(stage, hi) {
    appHeader('Luckin Coffee', '#1f5fd8');
    ctx.fillStyle = '#8fb0cc'; ctx.font = (H() * .024) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText('Menu · 招牌', W() * .06, H() * .195);
    listRow(H() * .225, H() * .1, '生椰拿铁 Coconut Latte', '¥ 18   ★ your usual', hi === 'item', '#e0a45c');
    listRow(H() * .345, H() * .1, '美式 Americano', '¥ 15', false);
    listRow(H() * .465, H() * .1, '丝绒拿铁 Velvet Latte', '¥ 19', false);
    if (stage === 'cart') primaryBtn(H() * .8, '立即购买 · Order  ¥18', hi === 'order');
  }
  function drawWeChat(typed, hi) {
    appHeader('Mom', '#3fae57');
    // incoming bubble
    rr(W() * .06, H() * .2, W() * .5, H() * .07, 12); ctx.fillStyle = '#101c30'; ctx.fill();
    ctx.fillStyle = '#dbe7f2'; ctx.font = (H() * .024) + 'px "Hanken Grotesk",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Are you coming?', W() * .1, H() * .245);
    if (typed) { // outgoing
      rr(W() * .42, H() * .32, W() * .52, H() * .07, 12); ctx.fillStyle = '#1f5fd8'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('On my way 🚗', W() * .46, H() * .365);
    }
    // input bar
    rr(W() * .06, H() * .82, W() * .66, H() * .07, 20); ctx.fillStyle = '#101c30'; ctx.fill();
    ctx.fillStyle = '#8fb0cc'; ctx.fillText(typed ? 'On my way' : 'Message…', W() * .1, H() * .862);
    rr(W() * .76, H() * .82, W() * .18, H() * .07, 14); ctx.fillStyle = hi === 'send' ? '#e0a45c' : '#1f5fd8'; ctx.fill();
    ctx.fillStyle = hi === 'send' ? '#04121a' : '#fff'; ctx.textAlign = 'center'; ctx.fillText('Send', W() * .85, H() * .862); ctx.textAlign = 'left';
  }
  function drawClock(set, hi) {
    appHeader('Clock · Timer', '#2b2b33');
    ctx.textAlign = 'center';
    ctx.fillStyle = set ? '#e0a45c' : '#eaf3fb'; ctx.font = '700 ' + (H() * .09) + 'px "IBM Plex Mono",monospace';
    ctx.fillText(set ? '30:00' : '00:00', W() * .5, H() * .42);
    ctx.fillStyle = '#8fb0cc'; ctx.font = (H() * .024) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText(set ? 'counting down' : 'set duration', W() * .5, H() * .5); ctx.textAlign = 'left';
    primaryBtn(H() * .8, set ? 'Running ✓' : 'Start 30-min timer', hi === 'start');
  }
  function drawDone(msg) {
    ctx.fillStyle = '#08131f'; ctx.fillRect(0, 0, W(), H()); statusBar();
    ctx.beginPath(); ctx.arc(W() * .5, H() * .4, W() * .13, 0, 7);
    ctx.fillStyle = 'rgba(74,222,128,.16)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#4ade80';
    ctx.beginPath(); ctx.moveTo(W() * .43, H() * .4); ctx.lineTo(W() * .48, H() * .45); ctx.lineTo(W() * .58, H() * .34); ctx.stroke();
    ctx.fillStyle = '#eaf3fb'; ctx.textAlign = 'center'; ctx.font = '600 ' + (H() * .032) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText('Task complete', W() * .5, H() * .58);
    ctx.fillStyle = '#8fb0cc'; ctx.font = (H() * .024) + 'px "Hanken Grotesk",sans-serif';
    ctx.fillText(msg || '', W() * .5, H() * .64); ctx.textAlign = 'left';
  }

  // ---------- scenarios: sequences of beats ----------
  // beat: {ag:'planner'|'worker', goal, action, screen:fn, tap:[rx,ry]|null, bus:[...]}
  const scenarios = {
    coffee: {
      task: '"Order my coconut latte"',
      beats: [
        { ag: 'planner', goal: 'perceive screen + apps', action: '—', screen: () => drawHome(null), tap: null,
          bus: ['planner: read screen + installed apps', 'sees Luckin, Calendar, Clock…'] },
        { ag: 'planner', goal: 'plan: open Luckin', action: 'delegate', screen: () => drawHome('luckin'), tap: () => appXY('luckin'),
          bus: ['planner→worker: open「Luckin」'] },
        { ag: 'worker', goal: 'open Luckin', action: 'tap app icon', screen: () => drawLuckin('menu', null), tap: () => [0.5, 0.27],
          bus: ['worker: tap(app: Luckin)', 'worker→planner: screen = menu'] },
        { ag: 'worker', goal: 'select 生椰拿铁', action: 'tap product', screen: () => drawLuckin('menu', 'item'), tap: () => [0.5, 0.275],
          bus: ['planner→worker: pick 生椰拿铁', 'worker: tap(item)'] },
        { ag: 'worker', goal: 'place order', action: 'tap Order', screen: () => drawLuckin('cart', 'order'), tap: () => [0.5, 0.837],
          bus: ['worker: tap(Order ¥18)', 'worker→planner: order placed'] },
        { ag: 'planner', goal: 'verify done', action: '✓', screen: () => drawDone('Coconut latte ordered · ¥18'), tap: null,
          bus: ['planner: goal satisfied ✓'] }
      ]
    },
    message: {
      task: '"Tell Mom I\'m on my way, set a 30-min timer"',
      beats: [
        { ag: 'planner', goal: 'perceive + plan 2 sub-goals', action: '—', screen: () => drawHome(null), tap: null,
          bus: ['planner: 2 sub-goals — reply, timer', 'apps: WeChat, Clock'] },
        { ag: 'worker', goal: 'open WeChat', action: 'tap app', screen: () => drawHome('wechat'), tap: () => appXY('wechat'),
          bus: ['planner→worker: open WeChat', 'worker: tap(app: WeChat)'] },
        { ag: 'worker', goal: 'reply to Mom', action: 'type + send', screen: () => drawWeChat(true, 'send'), tap: () => [0.85, 0.855],
          bus: ['worker: type「On my way」', 'worker: tap(Send)', 'worker→planner: sent ✓'] },
        { ag: 'planner', goal: 'sub-goal 2: timer', action: 'delegate', screen: () => drawHome('clock'), tap: () => appXY('clock'),
          bus: ['planner→worker: open Clock'] },
        { ag: 'worker', goal: 'set 30-min timer', action: 'tap Start', screen: () => drawClock(true, 'start'), tap: () => [0.5, 0.837],
          bus: ['worker: set 30:00, tap(Start)', 'worker→planner: timer running'] },
        { ag: 'planner', goal: 'verify done', action: '✓', screen: () => drawDone('Replied + 30-min timer set'), tap: null,
          bus: ['planner: both sub-goals ✓'] }
      ]
    }
  };

  let scen = 'coffee', clock = 0, lastTs = null, lastBeat = -1, speed = 1, paused = false;
  let finger = { x: 0, y: 0 }, ripple = 0;
  const BEAT = 2100;

  function setScenario(k) {
    scen = k; clock = 0; lastBeat = -1; if (el.bus) el.bus.innerHTML = '';
    if (el.task) el.task.textContent = scenarios[k].task;
    finger = { x: W() * 0.5, y: H() * 0.6 };
  }
  function pushBus(b, ag) {
    if (!el.bus) return;
    b.bus.forEach(line => {
      const worker = line.startsWith('worker');
      const name = worker ? 'worker' : 'planner';
      const row = document.createElement('div');
      row.className = 'ag-log-row ' + (worker ? 'zte-w' : 'zte-p');
      row.innerHTML = '<span class="ag-name">' + name + '</span><span class="ag-det">' + line + '</span>';
      el.bus.appendChild(row);
    });
    while (el.bus.children.length > 9) el.bus.removeChild(el.bus.firstChild);
    el.bus.scrollTop = el.bus.scrollHeight;
  }

  function draw(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = ts - lastTs; lastTs = ts;
    if (!paused && !reduce) clock += dt * speed;
    const beats = scenarios[scen].beats;
    const gi = Math.floor(clock / BEAT);
    const idx = ((gi % beats.length) + beats.length) % beats.length;
    const frac = (clock % BEAT) / BEAT;
    const beat = beats[idx];

    if (idx !== lastBeat) {
      lastBeat = idx;
      if (el.agent) { el.agent.textContent = beat.ag === 'worker' ? 'Worker · 32B' : 'Planner · 4B'; el.agent.style.color = beat.ag === 'worker' ? '#e0a45c' : '#8ba9cf'; }
      if (el.goal) el.goal.textContent = beat.goal;
      if (el.action) el.action.textContent = beat.action;
      if (el.step) el.step.textContent = (idx + 1) + ' / ' + beats.length;
      pushBus(beat, beat.ag);
    }

    // draw current screen
    try { beat.screen(); } catch (e) { }

    // finger animation toward tap target
    const tgt = beat.tap ? beat.tap() : null;
    if (tgt) {
      const tx = (Array.isArray(tgt) && tgt.length === 2 && tgt[0] <= 1) ? tgt[0] * W() : tgt[0];
      const ty = (Array.isArray(tgt) && tgt.length === 2 && tgt[1] <= 1) ? tgt[1] * H() : tgt[1];
      const k = Math.min(1, frac * 1.8);
      finger.x += (tx - finger.x) * 0.18; finger.y += (ty - finger.y) * 0.18;
      ripple = frac > 0.55 ? (frac - 0.55) / 0.45 : 0;
      if (ripple > 0) {
        ctx.beginPath(); ctx.arc(tx, ty, ripple * W() * 0.12, 0, 7);
        ctx.strokeStyle = 'rgba(224,164,92,' + (0.7 * (1 - ripple)) + ')'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    // draw finger
    ctx.beginPath(); ctx.arc(finger.x, finger.y, W() * 0.032, 0, 7);
    ctx.fillStyle = 'rgba(233,245,255,.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(224,164,92,.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(finger.x, finger.y, W() * 0.012, 0, 7); ctx.fillStyle = '#1f5fd8'; ctx.fill();

    // agent badge (who is acting)
    rr(W() * .06, H() * .93, W() * .5, H() * .05, 10);
    ctx.fillStyle = beat.ag === 'worker' ? 'rgba(224,164,92,.16)' : 'rgba(139,169,207,.16)'; ctx.fill();
    ctx.fillStyle = beat.ag === 'worker' ? '#e0a45c' : '#accbe6'; ctx.textAlign = 'left';
    ctx.font = '600 ' + (H() * .022) + 'px "IBM Plex Mono",monospace';
    ctx.fillText((beat.ag === 'worker' ? '● Worker 32B' : '● Planner 4B') + ' · OpenClaw', W() * .09, H() * .962);

    requestAnimationFrame(draw);
  }

  setScenario('coffee');
  requestAnimationFrame(draw);

  // controls
  const chips = document.getElementById('zteScenarios');
  if (chips) chips.addEventListener('click', e => {
    const b = e.target.closest('[data-task]'); if (!b) return;
    chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    b.classList.add('active'); setScenario(b.dataset.task);
  });
  const sp = document.getElementById('zteSpeed');
  if (sp) sp.addEventListener('input', e => { speed = Math.max(0.05, +e.target.value); });
  const pz = document.getElementById('ztePause');
  if (pz) pz.addEventListener('click', () => {
    paused = !paused;
    pz.setAttribute('aria-pressed', String(paused)); pz.textContent = paused ? 'Play' : 'Pause';
  });
})();
