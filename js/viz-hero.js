/* =================================================================
   viz-hero.js — ai.html hero: four domains around one method.

   A core (evidence → structure → decision) with the four domain
   constellations orbiting it. Packets carry sources in and decisions
   out. Hover a domain to see what it is built from; click to jump.
   ================================================================= */
(function () {
  'use strict';
  const root = document.getElementById('heroDomains');
  const T = window.TV;
  if (!root || !T) return;
  const C = T.C, F = T.font;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Four domain constellations — chemistry, business, astronomy and manufacturing — orbit a shared core labelled evidence, structure, decision. Packets flow from each domain into the core and back out.');
  const cap = document.createElement('div');
  cap.className = 'tv-hero-cap';
  cap.innerHTML = '<span>Evidence → structure → decision</span><span>hover · click a domain</span>';
  root.append(canvas, cap);
  const fig = { root, stage: root, canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1 };
  const ctx = fig.ctx;

  const D = [
    { id: 'chemistry', name: 'Chemistry', c: T.DOMAIN.chem, a0: -2.35, items: ['electrolyte papers', 'audited triples', 'Leiden communities', 'protocols'] },
    { id: 'business', name: 'Business', c: T.DOMAIN.biz, a0: -.75, items: ['business plans', 'expert cards', '3-valued rules', 'screen verdict'] },
    { id: 'astronomy', name: 'Astronomy', c: T.DOMAIN.astro, a0: .8, items: ['survey archives', '8B LLM', 'pipelines', 'light curves'] },
    { id: 'manufacturing', name: 'Manufacturing', c: T.DOMAIN.mfg, a0: 2.4, items: ['ERP exports', 'ontology', 'decision tables', 'APS plan'] }
  ];
  const rnd = T.rand(7);
  D.forEach(d => {
    d.sat = Array.from({ length: 9 }, (_, i) => ({ r: 18 + rnd() * 34, a: rnd() * T.TAU, s: (.15 + rnd() * .35) * (rnd() < .5 ? -1 : 1), z: rnd() }));
    d.links = d.sat.map((_, i) => [i, Math.floor(rnd() * d.sat.length)]).filter(([a, b]) => a !== b);
  });
  const stars = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), a: .1 + rnd() * .35, s: rnd() < .1 ? 1.4 : .8 }));
  let hover = -1;

  function pos(d, t, w, h) {
    const a = d.a0 + t * .045;
    const rx = Math.min(w * .36, 230), ry = Math.min(h * .33, 170);
    return { x: w / 2 + Math.cos(a) * rx, y: h / 2 + Math.sin(a) * ry * .95 };
  }

  T.pointer(canvas, {
    move(x, y) {
      const t = loop.t;
      hover = D.findIndex(d => { const p = pos(d, t, fig.w, fig.h); return Math.hypot(x - p.x, y - p.y) < 58; });
      canvas.style.cursor = hover >= 0 ? 'pointer' : '';
    },
    leave() { hover = -1; },
    click(x, y) {
      const t = loop.t;
      const i = D.findIndex(d => { const p = pos(d, t, fig.w, fig.h); return Math.hypot(x - p.x, y - p.y) < 58; });
      if (i >= 0) { const el = document.getElementById(D[i].id); if (el) el.scrollIntoView({ behavior: T.REDUCE ? 'auto' : 'smooth' }); }
    }
  });

  function draw(t) {
    const w = fig.w, h = fig.h, cx = w / 2, cy = h / 2;
    T.bg(ctx, w, h, { grid: 22, lift: '#1d1913' });
    stars.forEach(s => { ctx.fillStyle = 'rgba(244,238,226,' + (s.a * (.7 + .3 * Math.sin(t * .8 + s.x * 20))) + ')'; ctx.fillRect(s.x * w, s.y * h, s.s, s.s); });

    /* orbit */
    const rx = Math.min(w * .36, 230), ry = Math.min(h * .33, 170) * .95;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, T.TAU);
    ctx.strokeStyle = 'rgba(236,224,200,.10)'; ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);

    /* core */
    T.glow(ctx, cx, cy, 90, C.amber, .12);
    [56, 42].forEach((r, i) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (i ? -.25 : .15));
      ctx.beginPath(); ctx.arc(0, 0, r, 0, T.TAU);
      ctx.strokeStyle = 'rgba(232,168,95,' + (i ? .35 : .22) + ')'; ctx.setLineDash(i ? [1, 5] : [14, 8]); ctx.stroke(); ctx.setLineDash([]);
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * T.TAU;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.8, 0, T.TAU);
        ctx.fillStyle = C.amber; ctx.fill();
      }
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, T.TAU);
    ctx.fillStyle = 'rgba(20,17,12,.95)'; ctx.fill();
    ctx.strokeStyle = 'rgba(232,168,95,.6)'; ctx.stroke();
    const words = ['evidence', 'structure', 'decision'];
    const wi = Math.floor(t / 1.6) % 3;
    words.forEach((s, i) => T.label(ctx, s, cx, cy - 11 + i * 11, { size: 8.5, align: 'center', color: i === wi ? C.amber : C.dim, weight: i === wi ? 500 : 400 }));

    /* domains */
    D.forEach((d, di) => {
      const p = pos(d, t, w, h), on = hover === di, dim = hover >= 0 && !on;
      const q = T.bez(p, { x: cx, y: cy }, .16 * (di % 2 ? 1 : -1));
      T.strokeBez(ctx, q, d.c, 1, dim ? .08 : .22);
      T.flow(ctx, q, t, { n: 2, speed: .28, color: d.c, size: 1.8, phase: di * .23 });
      T.flow(ctx, u => T.bezPt(q, 1 - u), t, { n: 1, speed: .2, color: C.amber, size: 1.5, phase: di * .37 });

      const sats = d.sat.map(s => ({ x: p.x + Math.cos(s.a + t * s.s) * s.r, y: p.y + Math.sin(s.a + t * s.s) * s.r * .8, z: s.z }));
      d.links.forEach(([a, b]) => {
        ctx.beginPath(); ctx.moveTo(sats[a].x, sats[a].y); ctx.lineTo(sats[b].x, sats[b].y);
        ctx.strokeStyle = T.rgba(d.c, dim ? .06 : on ? .4 : .18); ctx.lineWidth = 1; ctx.stroke();
      });
      sats.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x, s.y, 1.6 + s.z * 1.8, 0, T.TAU);
        ctx.fillStyle = T.rgba(d.c, dim ? .2 : .55 + .4 * s.z); ctx.fill();
      });
      T.node(ctx, p.x, p.y, on ? 9 : 7.5, d.c, { active: on, level: dim ? .2 : .7 });
      const above = p.y < cy;
      const ly = above ? p.y - 64 : p.y + 64;
      T.label(ctx, d.name.toUpperCase(), p.x, ly, { size: 10.5, weight: 500, align: 'center', color: dim ? C.faint : C.ink });
      T.label(ctx, '0' + (di + 1) + ' · AI for', p.x, ly + (above ? -13 : 13), { size: 8.5, align: 'center', color: T.rgba(d.c, dim ? .4 : .9) });
      if (on) {
        d.items.forEach((s, i) => {
          const yy = (above ? ly + 18 : ly - 18 - 3 * 12) + i * 12;
          T.label(ctx, s, p.x + (p.x < cx ? 62 : -62), yy + (above ? 52 : -40), { size: 9, align: p.x < cx ? 'left' : 'right', color: C.soft });
        });
      }
    });
  }
  const loop = T.run(fig, { draw, still: 3 });
})();
