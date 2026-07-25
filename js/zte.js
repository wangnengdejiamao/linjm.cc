/* =================================================================
   zte.js — §02, the mobile GUI agent.

   A phone-side agent is two models and a screen. The Planner (4B,
   multimodal) reads the screenshot and the app inventory and emits a
   sub-goal; the Worker (32B, self-trained for grounding) turns that
   sub-goal plus the same screenshot into one concrete action with
   pixel coordinates; the resulting screen goes back up. That loop is
   the whole system, so the figure has to show all three parts of it:
   what the phone looks like, where the Worker decided to touch, and
   what the two agents said to each other.

   Everything here is drawn in iOS points through UI.screen(), so the
   status bar, the icon grid and the dock keep their real proportions
   at any plate size. The scripted task is a real cross-app errand,
   including the part every honest agent demo leaves out: it stops and
   asks before it spends money.
   ================================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('zteScreen');
  if (!canvas || !window.UI) return;
  const ctx = canvas.getContext('2d');
  const U = window.UI, C = U.C, E = U.E;

  const el = {
    task: document.getElementById('zteTask'),
    agent: document.getElementById('zteAgent'),
    goal: document.getElementById('zteGoal'),
    action: document.getElementById('zteAction'),
    step: document.getElementById('zteStep'),
    bus: document.getElementById('zteBus'),
    conf: document.getElementById('zteConf')
  };

  /* ---------------------------------------------------------------
     The phone's apps. Every one carries a drawn glyph: a coloured
     tile with a letter in it is a wireframe, and the eye knows.
     --------------------------------------------------------------- */
  const APP = {
    luckin:   { id: 'luckin',   name: 'Luckin',   g: 'coffee',   c: '#2f5ea8' },
    messages: { id: 'messages', name: 'Messages', g: 'chat',     c: '#3f9464' },
    calendar: { id: 'calendar', name: 'Calendar', g: 'calendar', c: '#c9564a' },
    clock:    { id: 'clock',    name: 'Clock',    g: 'clock',    c: '#26231d' },
    maps:     { id: 'maps',     name: 'Maps',     g: 'map',      c: '#2f7d6b' },
    photos:   { id: 'photos',   name: 'Photos',   g: 'photo',    c: '#c98630' },
    notes:    { id: 'notes',    name: 'Notes',    g: 'notes',    c: '#a8863c' },
    settings: { id: 'settings', name: 'Settings', g: 'gear',     c: '#7b7469' },
    phone:    { id: 'phone',    name: 'Phone',    g: 'phone',    c: '#3f8f52' },
    browser:  { id: 'browser',  name: 'Browser',  g: 'browser',  c: '#3a6fa8' },
    camera:   { id: 'camera',   name: 'Camera',   g: 'camera',   c: '#5d5a55' },
    music:    { id: 'music',    name: 'Music',    g: 'music',    c: '#b2483f' }
  };
  const GRID = ['luckin', 'messages', 'calendar', 'clock', 'maps', 'photos', 'notes', 'settings'].map(k => APP[k]);
  const DOCK = ['phone', 'browser', 'camera', 'music'].map(k => APP[k]);

  /* Point-space rectangles for anything the Worker can ground onto.
     These are the figure's equivalent of an accessibility tree: the
     agent does not guess at pixels, it resolves an element. */
  function iconBox(id) {
    const i = GRID.findIndex(a => a.id === id);
    if (i < 0) return null;
    const [x, y] = U.iconCell(i % 4, Math.floor(i / 4));
    const s = U.M.iconSize;
    return [x - s / 2 - 5, y - s / 2 - 5, s + 10, s + 10 + 18];
  }
  const ROW = y => [20, y, U.REF_W - 40, 74];
  const CTA_BOX = y => [20, y, U.REF_W - 40, 52];

  /* ---------------------------------------------------------------
     SCREENS. Each takes the shared screen handle and a state bag;
     each draws a complete, self-consistent phone screen so the push
     transition has something real to slide.
     --------------------------------------------------------------- */

  function chrome(S, st, o) {
    o = o || {};
    U.statusBar(S, { time: st.clockLabel, battery: .76 });
    U.island(S, { expand: st.island, label: st.islandLabel, right: st.islandRight, t: st.t });
    if (o.indicator !== false) U.homeIndicator(S);
  }

  function scrHome(S, st) {
    U.wallpaper(S.ctx, S.w, S.h);
    U.homeWidget(S, {});
    /* the search pill every modern home screen has */
    S.pts(S2 => {
      const w = 108, x = (U.REF_W - w) / 2, y = S2.H - U.M.dockBottom - U.M.dockH - 54;
      U.capsule(S.ctx, x, y, w, 32);
      S.ctx.fillStyle = 'rgba(246,241,230,.10)'; S.ctx.fill();
      S.ctx.strokeStyle = 'rgba(246,241,230,.13)'; S.ctx.lineWidth = 1; S.ctx.stroke();
      S.ctx.save();
      S.ctx.strokeStyle = 'rgba(246,241,230,.6)'; S.ctx.lineWidth = 1.6;
      S.ctx.beginPath(); S.ctx.arc(x + 26, y + 15, 5.2, 0, U.TAU); S.ctx.stroke();
      S.ctx.beginPath(); S.ctx.moveTo(x + 30, y + 19); S.ctx.lineTo(x + 34, y + 23); S.ctx.stroke();
      S.ctx.restore();
      U.text(S.ctx, 'Search', x + 44, y + 20, { font: U.sans(13, 500), fill: 'rgba(246,241,230,.62)' });
    });
    U.homeGrid(S, GRID, { highlight: st.pressId, press: st.press, t: st.t, day: '24' });
    U.pageDots(S, 3, 0);
    U.dock(S, DOCK, { highlight: st.pressId, press: st.press, t: st.t });
    chrome(S, st);
  }

  /* --- Luckin: menu --- */
  const MENU = [
    { title: '生椰拿铁 Coconut Latte', sub: '冰 · 标准糖 · 你的常点', value: '¥18', thumb: '#b9793c', glyph: 'coffee' },
    { title: '美式 Americano', sub: '冰 · 无糖', value: '¥15', thumb: '#6f5236', glyph: 'coffee' },
    { title: '丝绒拿铁 Velvet Latte', sub: '热 · 半糖', value: '¥19', thumb: '#9a6b4a', glyph: 'coffee' }
  ];
  const MENU_Y = [188, 274, 360];

  function scrMenu(S, st) {
    const ctx = S.ctx;
    ctx.fillStyle = '#100e0a'; ctx.fillRect(0, 0, S.w, S.h);
    U.navBar(S, { title: '瑞幸咖啡 Luckin', right: '门店', tint: '#7fa8d0' });
    S.pts(() => {
      /* promo band — a menu with no artwork above it reads as a table */
      const y = 118, h = 58;
      U.rrect(ctx, 20, y, U.REF_W - 40, h, 16);
      const g = ctx.createLinearGradient(20, y, U.REF_W - 20, y + h);
      g.addColorStop(0, 'rgba(47,94,168,.30)'); g.addColorStop(1, 'rgba(224,164,92,.16)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1; ctx.stroke();
      U.text(ctx, '常点 · Reorder', 36, y + 25, { font: U.sans(13.5, 600), fill: C.onGlass });
      U.text(ctx, '门店 中大南校区店 · 取餐约 6 分钟', 36, y + 43,
        { font: U.sans(11.5), fill: C.onGlassDim });
    });
    MENU.forEach((m, i) => U.listCard(S, MENU_Y[i], {
      title: m.title, sub: m.sub, value: m.value,
      thumb: m.thumb, thumbGlyph: m.glyph,
      on: st.selected === i,
      badge: i === 0 && st.selected !== 0 ? 'USUAL' : null
    }));
    S.pts(S2 => {
      /* tab bar */
      const h = U.M.tabH, y = S2.H - h - 18;
      ctx.fillStyle = 'rgba(16,14,10,.94)'; ctx.fillRect(0, y, U.REF_W, h + 18);
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(U.REF_W, y); ctx.stroke();
      ['点单', '订单', '我的'].forEach((t, i) => {
        const x = U.REF_W * (i + .5) / 3;
        U.text(ctx, t, x, y + 38, {
          font: U.sans(11.5, i === 0 ? 600 : 400),
          fill: i === 0 ? C.amber : C.onGlassDim, align: 'center'
        });
        ctx.fillStyle = i === 0 ? C.amber : 'rgba(246,241,230,.32)';
        ctx.beginPath(); ctx.arc(x, y + 20, 3.4, 0, U.TAU); ctx.fill();
      });
    });
    chrome(S, st);
  }

  /* --- Luckin: the item, configured --- */
  function scrItem(S, st) {
    const ctx = S.ctx;
    ctx.fillStyle = '#100e0a'; ctx.fillRect(0, 0, S.w, S.h);
    U.navBar(S, { title: '生椰拿铁', tint: '#7fa8d0' });
    S.pts(S2 => {
      /* product plate */
      const y = 120, h = 132;
      U.rrect(ctx, 20, y, U.REF_W - 40, h, 20);
      const g = ctx.createLinearGradient(20, y, U.REF_W - 20, y + h);
      g.addColorStop(0, 'rgba(185,121,60,.34)'); g.addColorStop(1, 'rgba(28,24,18,.6)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1; ctx.stroke();
      ctx.save();
      ctx.translate(84, y + h / 2);
      ctx.strokeStyle = 'rgba(255,246,230,.86)'; ctx.lineCap = 'round';
      U.GLYPH.coffee(ctx, 92, {});
      ctx.restore();
      U.text(ctx, '生椰拿铁', 152, y + 48, { font: U.sans(19, 700), fill: C.onGlass });
      U.text(ctx, 'Coconut Latte', 152, y + 68, { font: U.sans(12), fill: C.onGlassDim });
      U.text(ctx, '¥18', 152, y + 100, { font: U.mono(22, 500), fill: C.amberL });

      /* option rows — a real order screen is choices, not one button */
      const opt = (oy, label, choices, pick) => {
        U.text(ctx, label, 24, oy, { font: U.sans(12, 600), fill: C.onGlassDim });
        let x = 24;
        choices.forEach((c, i) => {
          ctx.font = U.sans(12.5, 500);
          const w = ctx.measureText(c).width + 26;
          U.capsule(ctx, x, oy + 10, w, 32);
          ctx.fillStyle = i === pick ? U.rgba(C.amber, .18) : C.fill;
          ctx.fill();
          ctx.strokeStyle = i === pick ? U.rgba(C.amber, .7) : C.sep;
          ctx.lineWidth = i === pick ? 1.5 : 1; ctx.stroke();
          U.text(ctx, c, x + w / 2, oy + 31, {
            font: U.sans(12.5, 500), fill: i === pick ? C.amberL : C.onGlassDim, align: 'center'
          });
          x += w + 8;
        });
      };
      opt(284, '温度', ['冰', '少冰', '热'], 0);
      opt(348, '甜度', ['标准糖', '半糖', '无糖'], 0);
      opt(412, '规格', ['中杯', '大杯'], 0);
    });
    U.cta(S, st.ctaY, '加入购物车 · ¥18', { press: st.press });
    chrome(S, st);
  }

  /* --- Luckin: the payment sheet, and the gate --- */
  function scrPay(S, st) {
    scrItem(S, Object.assign({}, st, { press: 0, island: st.island, islandLabel: st.islandLabel }));
    const ctx = S.ctx;
    S.pts(S2 => {
      ctx.fillStyle = 'rgba(6,5,3,' + (.62 * (st.sheet || 1)) + ')';
      ctx.fillRect(0, 0, U.REF_W, S2.H);
      const h = 330;
      const y = S2.H - h * E.emphasised(st.sheet == null ? 1 : st.sheet);
      U.rrect(ctx, 0, y, U.REF_W, h + 40, [26, 26, 0, 0]);
      ctx.fillStyle = '#16130e'; ctx.fill();
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1; ctx.stroke();
      U.capsule(ctx, U.REF_W / 2 - 20, y + 10, 40, 4);
      ctx.fillStyle = 'rgba(246,241,230,.28)'; ctx.fill();

      U.text(ctx, '确认订单', 24, y + 48, { font: U.sans(18, 700), fill: C.onGlass });
      const line = (ly, k, v, tint) => {
        U.text(ctx, k, 24, ly, { font: U.sans(13), fill: C.onGlassDim });
        U.text(ctx, v, U.REF_W - 24, ly, {
          font: U.mono(13, 500), fill: tint || C.onGlass, align: 'right'
        });
        ctx.strokeStyle = C.sep; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(24, ly + 14); ctx.lineTo(U.REF_W - 24, ly + 14); ctx.stroke();
      };
      line(y + 86, '商品', '生椰拿铁 × 1');
      line(y + 122, '门店', '中大南校区店');
      line(y + 158, '取餐', '自提 · 约 6 min');
      line(y + 194, '合计', '¥18.00', C.amberL);

      /* the honest part: the agent will not spend money on its own */
      const gy = y + 214;
      U.rrect(ctx, 20, gy, U.REF_W - 40, 40, 12);
      ctx.fillStyle = U.rgba(C.ember, .12); ctx.fill();
      ctx.strokeStyle = U.rgba(C.ember, .4); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = C.ember;
      ctx.beginPath(); ctx.arc(38, gy + 20, 4, 0, U.TAU); ctx.fill();
      U.text(ctx, U.fitText(ctx, 'Payment step — agent paused for your confirmation', U.REF_W - 90, U.sans(11.5, 500)),
        50, gy + 24, { font: U.sans(11.5, 500), fill: '#eda98a' });
    });
    U.cta(S, (S.h / S.u) - 330 * E.emphasised(st.sheet == null ? 1 : st.sheet) + 268,
      st.paid ? '支付中…' : '确认支付 ¥18', { press: st.press, disabled: st.paid });
    chrome(S, st, { indicator: false });
  }

  /* --- Luckin: receipt --- */
  function scrDone(S, st) {
    const ctx = S.ctx;
    ctx.fillStyle = '#0d0b08'; ctx.fillRect(0, 0, S.w, S.h);
    U.wallpaper(ctx, S.w, S.h, { glow: 'rgba(99,179,148,.14)' });
    S.pts(S2 => {
      const cy = 250;
      const k = E.spring(U.clamp(st.doneT || 1, 0, 1));
      ctx.save();
      ctx.translate(U.REF_W / 2, cy); ctx.scale(k, k);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 62);
      g.addColorStop(0, 'rgba(99,179,148,.34)'); g.addColorStop(1, 'rgba(99,179,148,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 62, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, U.TAU);
      ctx.strokeStyle = C.mint; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-15, 1); ctx.lineTo(-4, 12); ctx.lineTo(16, -12);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.6; ctx.stroke();
      ctx.restore();

      U.text(ctx, '下单成功', U.REF_W / 2, cy + 84, { font: U.sans(21, 700), fill: C.onGlass, align: 'center' });
      U.text(ctx, '生椰拿铁 · ¥18 · 自提', U.REF_W / 2, cy + 110,
        { font: U.sans(13.5), fill: C.onGlassDim, align: 'center' });

      const y = cy + 140, h = 92;
      U.rrect(ctx, 28, y, U.REF_W - 56, h, 16);
      ctx.fillStyle = C.fill; ctx.fill();
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1; ctx.stroke();
      U.text(ctx, '取餐码', 46, y + 32, { font: U.sans(12), fill: C.onGlassDim });
      U.text(ctx, 'A-2417', U.REF_W - 46, y + 33, { font: U.mono(17, 500), fill: C.amberL, align: 'right' });
      U.text(ctx, '预计', 46, y + 66, { font: U.sans(12), fill: C.onGlassDim });
      U.text(ctx, '09:47 · 6 min', U.REF_W - 46, y + 67, { font: U.mono(14, 500), fill: C.onGlass, align: 'right' });
    });
    chrome(S, st);
  }

  /* --- Messages --- */
  function scrChat(S, st) {
    const ctx = S.ctx;
    ctx.fillStyle = '#100e0a'; ctx.fillRect(0, 0, S.w, S.h);
    U.navBar(S, { title: '妈妈 Mom', right: '', tint: '#63b394' });
    U.bubble(S, 128, '到哪儿了？菜快好了', {});
    U.bubble(S, 186, 'Where are you? Dinner is nearly ready', {});
    if (st.sent) U.bubble(S, 268, '在路上，20 分钟到 · On my way', { me: true });
    const kbY = (S.h / S.u) - (st.keyboard ? 216 : 0);
    U.inputBar(S, kbY - 62, st.typed || '', {
      placeholder: '发消息…', send: true, sendOn: !!st.typed,
      caret: st.typed && !st.sent ? (Math.sin(st.t * 6) > 0 ? 1 : .15) : 0
    });
    if (st.keyboard) U.keyboard(S, { key: st.key });
    chrome(S, st, { indicator: !st.keyboard });
  }

  /* --- Clock / timer --- */
  function scrTimer(S, st) {
    const ctx = S.ctx;
    ctx.fillStyle = '#0e0c09'; ctx.fillRect(0, 0, S.w, S.h);
    U.navBar(S, { title: '计时器 Timer', tint: '#e0a45c' });
    S.pts(() => {
      const cx = U.REF_W / 2, cy = 300, R = 108;
      ctx.strokeStyle = 'rgba(246,241,230,.10)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, U.TAU); ctx.stroke();
      const prog = st.running ? (st.t * .06) % 1 : 0;
      ctx.strokeStyle = C.amber; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + U.TAU * (st.running ? 1 - prog : 0)); ctx.stroke();
      ctx.lineCap = 'butt';
      const secs = st.running ? Math.max(0, 1800 - Math.floor(st.t * 12) % 1800) : 1800;
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      U.text(ctx, mm + ':' + ss, cx, cy + 14, { font: U.mono(44, 400), fill: C.onGlass, align: 'center' });
      U.text(ctx, st.running ? '倒计时中 · running' : '30 分钟', cx, cy + 42,
        { font: U.sans(12.5), fill: st.running ? C.amber : C.onGlassDim, align: 'center' });

      /* presets */
      let x = 34;
      ['5 min', '15 min', '30 min', '1 h'].forEach((p, i) => {
        ctx.font = U.sans(12.5, 500);
        const w = ctx.measureText(p).width + 24;
        U.capsule(ctx, x, 448, w, 32);
        const on = i === 2;
        ctx.fillStyle = on ? U.rgba(C.amber, .18) : C.fill; ctx.fill();
        ctx.strokeStyle = on ? U.rgba(C.amber, .7) : C.sep; ctx.lineWidth = on ? 1.5 : 1; ctx.stroke();
        U.text(ctx, p, x + w / 2, 469, { font: U.sans(12.5, 500), fill: on ? C.amberL : C.onGlassDim, align: 'center' });
        x += w + 8;
      });
    });
    U.cta(S, st.ctaY, st.running ? '运行中 · Running' : '开始 · Start', {
      press: st.press, tint: st.running ? C.mint : C.amber
    });
    chrome(S, st);
  }

  /* ---------------------------------------------------------------
     THE SCRIPT. A beat is: who is acting, what the sub-goal is, what
     the Worker grounds onto, and what the screen becomes afterwards.
     Grounding confidences are the kind of number a real trace carries;
     they are illustrative, and the caption says so.
     --------------------------------------------------------------- */
  const CTA_Y = 484, TIMER_CTA_Y = 520;

  const SCENARIOS = {
    coffee: {
      task: '“帮我点一杯生椰拿铁” · Order my coconut latte',
      beats: [
        {
          ag: 'planner', goal: 'perceive screen + app inventory', act: 'observe',
          island: 'Agent · reading screen', screen: (S, st) => scrHome(S, st),
          scan: true,
          bus: ['planner: screenshot → 8 icons, 4 dock', 'planner: Luckin installed ✓']
        },
        {
          ag: 'planner', goal: 'decompose: 4 sub-goals', act: 'plan',
          island: 'Planner · 4B', islandRight: '4 sub-goals',
          screen: (S, st) => scrHome(S, st),
          plan: ['open Luckin', 'pick 生椰拿铁', 'add to cart', 'confirm + pay'],
          bus: ['planner: open→pick→cart→pay', 'planner→worker: sub-goal 1']
        },
        {
          ag: 'worker', goal: 'open Luckin', act: 'tap(app: Luckin)', conf: 0.98,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrHome(S, st), pressId: 'luckin',
          ground: () => iconBox('luckin'), label: 'app · Luckin',
          next: (S, st) => scrMenu(S, Object.assign({}, st, { selected: -1 })), push: true,
          bus: ['worker: ground(Luckin) → (78, 132)', 'worker→planner: screen = menu']
        },
        {
          ag: 'worker', goal: 'select 生椰拿铁', act: 'tap(item #1)', conf: 0.94,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrMenu(S, Object.assign({}, st, { selected: -1 })),
          ground: () => ROW(MENU_Y[0]), label: 'listitem · ¥18',
          next: (S, st) => scrItem(S, Object.assign({}, st, { ctaY: CTA_Y, press: 0 })), push: true,
          bus: ['planner→worker: pick 生椰拿铁', 'worker: tap(0.5, 0.28) conf .94']
        },
        {
          ag: 'worker', goal: 'add to cart', act: 'tap(加入购物车)', conf: 0.96,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrItem(S, Object.assign({}, st, { ctaY: CTA_Y })),
          ground: () => CTA_BOX(CTA_Y), label: 'button · 加入购物车',
          next: (S, st) => scrPay(S, Object.assign({}, st, { sheet: 1, ctaY: CTA_Y })), sheet: true,
          bus: ['worker: tap(加入购物车 ¥18)', 'worker→planner: sheet = 确认订单']
        },
        {
          ag: 'human', goal: 'payment gate — you confirm', act: 'await user', conf: null,
          island: 'Paused · needs you', islandColor: '#d9703c',
          screen: (S, st) => scrPay(S, Object.assign({}, st, { sheet: 1, ctaY: CTA_Y })),
          ground: () => CTA_BOX((canvasPts() - 330) + 268), label: 'gate · ¥18.00', color: '#d9703c',
          hold: true,
          bus: ['policy: spend > 0 → human gate', 'user: confirm ✓']
        },
        {
          ag: 'worker', goal: 'confirm payment', act: 'tap(确认支付)', conf: 0.99,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrPay(S, Object.assign({}, st, { sheet: 1, ctaY: CTA_Y })),
          ground: () => CTA_BOX((canvasPts() - 330) + 268), label: 'button · 确认支付',
          next: (S, st) => scrDone(S, st), push: true,
          bus: ['worker: tap(确认支付 ¥18)', 'worker→planner: 下单成功']
        },
        {
          ag: 'planner', goal: 'verify against goal', act: 'done ✓',
          island: 'Done · 6 actions', islandRight: '11.8 s', islandColor: '#63b394',
          screen: (S, st) => scrDone(S, st),
          bus: ['planner: 取餐码 A-2417 matches goal', 'planner: task complete ✓']
        }
      ]
    },

    message: {
      task: '“告诉妈妈我在路上，再设 30 分钟计时” · two apps, one errand',
      beats: [
        {
          ag: 'planner', goal: 'perceive + split into 2 errands', act: 'observe',
          island: 'Planner · 4B', islandRight: '2 apps',
          screen: (S, st) => scrHome(S, st), scan: true,
          plan: ['reply to Mom', 'set a 30-min timer'],
          bus: ['planner: 2 independent sub-goals', 'planner: Messages + Clock']
        },
        {
          ag: 'worker', goal: 'open Messages', act: 'tap(app: Messages)', conf: 0.97,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrHome(S, st), pressId: 'messages',
          ground: () => iconBox('messages'), label: 'app · Messages',
          next: (S, st) => scrChat(S, Object.assign({}, st, { keyboard: true })), push: true,
          bus: ['worker: ground(Messages) → (176, 132)']
        },
        {
          ag: 'worker', goal: 'compose the reply', act: 'type(…)', conf: 0.91,
          island: 'Worker · 32B', islandRight: 'type',
          screen: (S, st) => scrChat(S, Object.assign({}, st, {
            keyboard: true, typed: '在路上，20 分钟到 · On my way'.slice(0, Math.round(st.frac * 24)),
            key: 'QWERTYUIOP'[Math.floor(st.t * 7) % 10]
          })),
          bus: ['worker: type「在路上，20 分钟到」', 'worker: keystrokes = 24']
        },
        {
          ag: 'worker', goal: 'send it', act: 'tap(Send)', conf: 0.99,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrChat(S, Object.assign({}, st, {
            keyboard: true, typed: '在路上，20 分钟到 · On my way'
          })),
          ground: () => [U.REF_W - 66, canvasPts() - 216 - 62, 50, 44], label: 'button · Send',
          next: (S, st) => scrChat(S, Object.assign({}, st, { sent: true, typed: '' })),
          bus: ['worker: tap(Send)', 'worker→planner: sent ✓ · sub-goal 1 done']
        },
        {
          ag: 'planner', goal: 'sub-goal 2 — leave the app', act: 'swipe(home)',
          island: 'Planner · 4B', islandRight: 'switch app',
          screen: (S, st) => scrChat(S, Object.assign({}, st, { sent: true })),
          swipe: [[U.REF_W / 2, 780], [U.REF_W / 2, 560]],
          next: (S, st) => scrHome(S, st), push: false, fade: true,
          bus: ['planner: cross-app hand-off', 'worker: swipe-up → home']
        },
        {
          ag: 'worker', goal: 'open Clock', act: 'tap(app: Clock)', conf: 0.98,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrHome(S, st), pressId: 'clock',
          ground: () => iconBox('clock'), label: 'app · Clock',
          next: (S, st) => scrTimer(S, Object.assign({}, st, { ctaY: TIMER_CTA_Y })), push: true,
          bus: ['worker: ground(Clock) → (274, 132)']
        },
        {
          ag: 'worker', goal: 'set 30 min and start', act: 'tap(开始)', conf: 0.95,
          island: 'Worker · 32B', islandRight: 'tap',
          screen: (S, st) => scrTimer(S, Object.assign({}, st, { ctaY: TIMER_CTA_Y })),
          ground: () => CTA_BOX(TIMER_CTA_Y), label: 'button · 开始',
          next: (S, st) => scrTimer(S, Object.assign({}, st, { ctaY: TIMER_CTA_Y, running: true })),
          bus: ['worker: preset(30 min) → tap(开始)', 'worker→planner: timer running']
        },
        {
          ag: 'planner', goal: 'verify both sub-goals', act: 'done ✓',
          island: 'Done · 5 actions', islandRight: '9.2 s', islandColor: '#63b394',
          screen: (S, st) => scrTimer(S, Object.assign({}, st, { ctaY: TIMER_CTA_Y, running: true })),
          bus: ['planner: message sent ✓ · timer 30:00 ✓', 'planner: task complete ✓']
        }
      ]
    }
  };

  /* ---------------------------------------------------------------
     RUNTIME
     --------------------------------------------------------------- */
  let box = null;
  const canvasPts = () => box ? box.h / (box.w / U.REF_W) : 800;

  let scen = 'coffee', beatIdx = 0, frac = 0, t = 0, speed = 1, paused = false;
  let ptr = { x: U.REF_W / 2, y: 640 }, lastBeat = -1;
  const BEAT_MS = 2600;
  let acc = 0;

  function beats() { return SCENARIOS[scen].beats; }

  function setScenario(k) {
    scen = k; beatIdx = 0; frac = 0; acc = 0; lastBeat = -1;
    if (el.bus) el.bus.innerHTML = '';
    if (el.task) el.task.textContent = SCENARIOS[k].task;
    ptr = { x: U.REF_W / 2, y: 640 };
  }

  function pushBus(lines) {
    if (!el.bus) return;
    lines.forEach(line => {
      const who = line.split(':')[0].trim();
      const worker = who.indexOf('worker') === 0;
      const row = document.createElement('div');
      row.className = 'ag-log-row ' + (worker ? 'zte-w' : who === 'user' || who === 'policy' ? 'zte-h' : 'zte-p');
      row.innerHTML = '<span class="ag-name">' + who + '</span>' +
        '<span class="ag-det">' + line.slice(line.indexOf(':') + 1).trim() + '</span>';
      el.bus.appendChild(row);
    });
    while (el.bus.children.length > 10) el.bus.removeChild(el.bus.firstChild);
    el.bus.scrollTop = el.bus.scrollHeight;
  }

  function syncReadout(b, i, n) {
    if (el.agent) {
      el.agent.textContent = b.ag === 'worker' ? 'Worker · 32B'
        : b.ag === 'human' ? 'You · gate' : 'Planner · 4B';
      el.agent.style.color = b.ag === 'worker' ? '#c07f36'
        : b.ag === 'human' ? '#b9491f' : '#5c7ba4';
    }
    if (el.goal) el.goal.textContent = b.goal;
    if (el.action) el.action.textContent = b.act || '—';
    if (el.step) el.step.textContent = (i + 1) + ' / ' + n;
    if (el.conf) el.conf.textContent = b.conf == null ? '—' : b.conf.toFixed(2);
    pushBus(b.bus || []);
  }

  /* The plan chips the Planner emits, drawn on the screen it read.
     Showing the plan on the phone (rather than only in the side
     panel) is what makes the perceive step legible. */
  function drawPlan(S, list, a) {
    const ctx = S.ctx;
    S.pts(S2 => {
      const y0 = 470;
      list.forEach((p, i) => {
        const k = U.clamp((a - i * .13) / .4, 0, 1);
        if (k <= 0) return;
        const y = y0 + i * 40;
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate(0, (1 - E.emphasised(k)) * 10);
        U.rrect(ctx, 28, y, U.REF_W - 56, 32, 10);
        ctx.fillStyle = 'rgba(16,13,9,.86)'; ctx.fill();
        ctx.strokeStyle = U.rgba(C.steel, .34); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.steel;
        ctx.beginPath(); ctx.arc(45, y + 16, 3.2, 0, U.TAU); ctx.fill();
        U.text(ctx, U.fitText(ctx, p, U.REF_W - 130, U.mono(11)), 58, y + 20,
          { font: U.mono(11), fill: C.soft });
        U.text(ctx, '#' + (i + 1), U.REF_W - 42, y + 20,
          { font: U.mono(10), fill: C.faint, align: 'right' });
        ctx.restore();
      });
    });
  }

  /* The perception sweep: a band crossing the screen, leaving a thin
     bracket on every element it resolves. This is the Planner's view
     of the phone, and it is the only moment the figure gets to show
     that the agent sees structure rather than pixels. */
  function drawScan(S, a) {
    const ctx = S.ctx;
    S.pts(S2 => {
      const H = S2.H;
      const y = 60 + E.inOut(U.clamp(a / .75, 0, 1)) * (H - 140);
      const g = ctx.createLinearGradient(0, y - 46, 0, y + 8);
      g.addColorStop(0, 'rgba(139,169,207,0)');
      g.addColorStop(1, 'rgba(139,169,207,.16)');
      ctx.fillStyle = g; ctx.fillRect(0, y - 46, U.REF_W, 54);
      ctx.strokeStyle = U.rgba(C.steel, .7); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(U.REF_W, y); ctx.stroke();

      GRID.forEach(app => {
        const b = iconBox(app.id);
        if (!b || b[1] > y) return;
        ctx.save();
        ctx.globalAlpha = U.clamp((y - b[1]) / 40, 0, 1) * .8;
        ctx.strokeStyle = U.rgba(C.steel, .8); ctx.lineWidth = 1;
        U.rrect(ctx, b[0], b[1], b[2], b[3], 12); ctx.stroke();
        ctx.restore();
      });
      const seen = GRID.filter(a2 => { const b = iconBox(a2.id); return b && b[1] <= y; }).length;
      U.text(ctx, 'elements resolved · ' + seen + '/' + GRID.length, U.REF_W - 22, y - 12,
        { font: U.mono(9.5), fill: C.steel, align: 'right', track: '.06em' });
    });
  }

  /* ---------------------------------------------------------------
     FRAME
     --------------------------------------------------------------- */
  function render() {
    box = U.fit(canvas, ctx);
    if (!box) return;
    const S = U.screen(ctx, box.w, box.h);
    const bs = beats();
    const b = bs[beatIdx];
    const Hpt = canvasPts();

    /* the state every screen reads */
    const st = {
      t, frac,
      clockLabel: '9:41',
      island: b.island ? U.clamp(frac * 5, 0, 1) : 0,
      islandLabel: b.island, islandRight: b.islandRight,
      press: 0, pressId: null,
      ctaY: CTA_Y, sheet: 1, doneT: 1
    };

    /* pointer + tap timing */
    const g = b.ground ? b.ground() : null;
    const tgt = g ? [g[0] + g[2] / 2, g[1] + g[3] / 2] : null;
    const T_GROUND = .18, T_REACH = .62, T_TAP = .70, T_LEAVE = .86;

    if (tgt) {
      const k = E.emphasised(U.clamp((frac - T_GROUND) / (T_REACH - T_GROUND), 0, 1));
      ptr.x = ptr.x + (tgt[0] - ptr.x) * (0.14 + 0.5 * k);
      ptr.y = ptr.y + (tgt[1] - ptr.y) * (0.14 + 0.5 * k);
      if (frac > T_REACH && frac < T_TAP + .06) {
        st.press = E.pulse((frac - T_REACH) / .12);
        st.pressId = b.pressId || null;
      }
    }

    const transitioning = b.next && frac > T_LEAVE;
    const tr = transitioning ? U.clamp((frac - T_LEAVE) / (1 - T_LEAVE), 0, 1) : 0;

    ctx.save();
    ctx.clearRect(0, 0, box.w, box.h);

    if (transitioning) {
      const from = () => b.screen(S, st);
      const to = () => b.next(S, Object.assign({}, st, { island: 1, press: 0, doneT: tr }));
      if (b.push) U.pushTransition(ctx, box.w, box.h, tr, from, to);
      else if (b.sheet) { from(); ctx.save(); to(); ctx.restore(); }
      else { ctx.globalAlpha = 1 - tr; from(); ctx.globalAlpha = tr; to(); ctx.globalAlpha = 1; }
    } else {
      b.screen(S, st);
    }

    /* --- agent overlays, always above the app --- */
    if (b.scan && !transitioning) drawScan(S, frac);
    if (b.plan && !transitioning) drawPlan(S, b.plan, U.clamp((frac - .12) / .7, 0, 1));

    if (g && !transitioning && frac > T_GROUND) {
      U.groundBox(S, g, {
        label: b.label, t,
        color: b.color || (b.ag === 'human' ? '#d9703c' : C.amber),
        alpha: U.clamp((frac - T_GROUND) / .12, 0, 1) * (frac > T_LEAVE ? 0 : 1)
      });
    }
    if (b.swipe && !transitioning) {
      U.swipeTrail(S, b.swipe[0], b.swipe[1], U.clamp((frac - .2) / .5, 0, 1));
    }
    if (tgt && !transitioning) {
      if (frac > T_REACH) U.tapRipple(S, tgt[0], tgt[1], U.clamp((frac - T_REACH) / .3, 0, 1),
        { color: b.color || C.amber });
      if (frac < T_LEAVE) U.pointer(S, ptr.x, ptr.y, { color: b.color || C.amber });
    }

    U.controlBanner(S, {
      t,
      color: b.ag === 'worker' ? C.amber : b.ag === 'human' ? '#d9703c' : C.steel,
      label: (b.ag === 'worker' ? 'Worker 32B' : b.ag === 'human' ? 'Waiting for you' : 'Planner 4B') +
             ' · OpenClaw' + (b.conf ? '  conf ' + b.conf.toFixed(2) : '')
    });
    ctx.restore();
  }

  /* ---------------------------------------------------------------
     LOOP
     --------------------------------------------------------------- */
  const anim = U.loop(canvas, dt => {
    t += dt * 0.016 * speed;
    acc += dt * 16.667 * speed;
    const dur = beats()[beatIdx].hold ? BEAT_MS * 1.5 : BEAT_MS;
    frac = acc / dur;
    if (frac >= 1) {
      acc = 0; frac = 0;
      beatIdx = (beatIdx + 1) % beats().length;
      if (beatIdx === 0 && el.bus) el.bus.innerHTML = '';
    }
    if (beatIdx !== lastBeat) {
      lastBeat = beatIdx;
      syncReadout(beats()[beatIdx], beatIdx, beats().length);
    }
    render();
  }, { fps: 34 });

  U.onResize(canvas, render);
  setScenario('coffee');
  syncReadout(beats()[0], 0, beats().length);
  render();
  anim.start();

  /* ---- controls ---- */
  const chips = document.getElementById('zteScenarios');
  if (chips) chips.addEventListener('click', e => {
    const btn = e.target.closest('[data-task]');
    if (!btn) return;
    chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    setScenario(btn.dataset.task);
    syncReadout(beats()[0], 0, beats().length);
    render();
  });

  const sp = document.getElementById('zteSpeed');
  if (sp) sp.addEventListener('input', e => { speed = Math.max(0.05, +e.target.value); });

  const pz = document.getElementById('ztePause');
  if (pz) pz.addEventListener('click', () => {
    anim.paused = !anim.paused;
    pz.setAttribute('aria-pressed', String(anim.paused));
    pz.textContent = anim.paused ? 'Play' : 'Pause';
  });

  /* Step one beat at a time — the figure is a trace, so it should be
     walkable, not only watchable. */
  const stepBtn = document.getElementById('zteStepBtn');
  if (stepBtn) stepBtn.addEventListener('click', () => {
    anim.paused = true;
    if (pz) { pz.setAttribute('aria-pressed', 'true'); pz.textContent = 'Play'; }
    acc = 0; frac = 0;
    beatIdx = (beatIdx + 1) % beats().length;
    syncReadout(beats()[beatIdx], beatIdx, beats().length);
    /* land mid-beat so the ground box and pointer are both visible */
    frac = 0.66; acc = 0.66 * BEAT_MS;
    const b = beats()[beatIdx];
    const g = b.ground ? b.ground() : null;
    if (g) ptr = { x: g[0] + g[2] / 2, y: g[1] + g[3] / 2 };
    render();
  });
})();
