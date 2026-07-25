/* =================================================================
   Hero plate — a magnetised white dwarf, drawn with the same kit and
   the same dipole maths as Fig. 1, just smaller and without controls.
   Field lines are r = r_eq sin²θ around a tilted moment; the curtain
   lands on a footpoint whose beam sweeps as the star turns.
   ================================================================= */
(function () {
  const canvas = document.getElementById('heroOrbit');
  if (!canvas || !window.FK) return;
  const ctx = canvas.getContext('2d');
  const C = FK.C;
  let W = 0, H = 0, t = 0;

  const BETA = FK.RAD(28), INC = FK.RAD(74), R_WD = 0.15, R_MU = 0.72;

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let eh = [1, 0, 0], ev = [0, 1, 0], nh = [0, 0, 1];
  function setView(ph) {
    const psi = 2 * Math.PI * ph, s = Math.sin(INC), c = Math.cos(INC);
    const cp = Math.cos(psi), sp = Math.sin(psi);
    nh = [s * cp, s * sp, c]; eh = [-sp, cp, 0]; ev = [-c * cp, -c * sp, s];
  }
  const rot = (v, ax, a) => {
    const c = Math.cos(a), s = Math.sin(a), d = dot(v, ax);
    return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * d * (1 - c),
            v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * s + ax[1] * d * (1 - c),
            v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * s + ax[2] * d * (1 - c)];
  };

  function resize() { const m = FK.fit(canvas, ctx); if (m) { W = m.w; H = m.h; } }

  function frame() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    setView(t);
    const cx = W * 0.5, cy = H * 0.52, S = Math.min(W, H) * 0.40;
    const m = [Math.sin(BETA), 0, Math.cos(BETA)];
    const e0 = [Math.cos(BETA), 0, -Math.sin(BETA)];

    const lineOf = (req, e1, thA, thB, n) => {
      const p = [];
      for (let k = 0; k <= n; k++) {
        const th = thA + (thB - thA) * k / n;
        const st = Math.sin(th), ct = Math.cos(th), r = req * st * st;
        const P = [r * (st * e1[0] + ct * m[0]), r * (st * e1[1] + ct * m[1]), r * (st * e1[2] + ct * m[2])];
        p.push([cx + dot(P, eh) * S, cy - dot(P, ev) * S, dot(P, nh) > 0]);
      }
      return p;
    };
    const stroke = (p, front, style, w) => {
      ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineJoin = 'round';
      let open = false; ctx.beginPath();
      for (const q of p) {
        if (q[2] !== front) { open = false; continue; }
        if (!open) { ctx.moveTo(q[0], q[1]); open = true; } else ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke(); ctx.restore();
    };

    for (const req of [0.36, 0.55, 0.82, 1.15]) {
      for (const az of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
        const thF = Math.asin(Math.min(1, Math.sqrt(Math.min(1, R_WD / req))));
        const L = lineOf(req, rot(e0, m, az), thF, Math.PI - thF, 40);
        const a = 0.26 - (req - 0.36) * 0.14;
        stroke(L, false, 'rgba(139,169,207,' + (a * 0.4).toFixed(3) + ')', 1);
        stroke(L, true, 'rgba(139,169,207,' + a.toFixed(3) + ')', 1);
      }
    }

    /* accretion curtain onto the northern footpoint */
    const thF = Math.asin(Math.min(1, Math.sqrt(R_WD / R_MU)));
    for (let s = -2; s <= 2; s++) {
      const L = lineOf(R_MU * (1 + s * 0.05), rot(e0, m, s * 0.19), thF, Math.PI / 2.1, 26);
      stroke(L, false, 'rgba(224,164,92,.13)', 2.2 - Math.abs(s) * 0.4);
      stroke(L, true, 'rgba(240,190,120,.42)', 2.2 - Math.abs(s) * 0.4);
    }

    /* the star */
    FK.disc(ctx, cx, cy, R_WD * S, FK.RGB.wd, { u: 0.42, core: 0.98, bloom: 2.5 });

    /* hot spot + beam */
    const st = Math.sin(thF), ct = Math.cos(thF), r = R_MU * st * st;
    const P = [r * (st * e0[0] + ct * m[0]), r * (st * e0[1] + ct * m[1]), r * (st * e0[2] + ct * m[2])];
    if (dot(P, nh) > -0.02) {
      const sx = cx + dot(P, eh) * S, sy = cy - dot(P, ev) * S;
      const be1 = 3 * st * ct, bem = 2 * ct * ct - st * st, bn = Math.hypot(be1, bem) || 1;
      const B = [(be1 * e0[0] + bem * m[0]) / bn, (be1 * e0[1] + bem * m[1]) / bn, (be1 * e0[2] + bem * m[2]) / bn];
      const bright = 1 - Math.pow(FK.clamp(dot(B, nh), -1, 1), 2);
      const ang = Math.atan2(-dot(B, ev), dot(B, eh));
      const reach = S * 0.62 * (0.4 + 0.6 * bright);
      for (const s of [1, -1]) {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, reach);
        g.addColorStop(0, 'rgba(240,186,116,' + (0.24 * bright + 0.03) + ')');
        g.addColorStop(1, 'rgba(240,186,116,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, reach, ang + s * Math.PI / 2 - 0.4, ang + s * Math.PI / 2 + 0.4);
        ctx.closePath(); ctx.fill();
      }
      const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R_WD * S * 0.9);
      hg.addColorStop(0, 'rgba(255,226,176,.95)'); hg.addColorStop(1, 'rgba(224,140,70,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(sx, sy, R_WD * S * 0.9, 0, 7); ctx.fill();
    }

    FK.kicker(ctx, 'Fig. 0 — magnetised white dwarf', 12, H - 12, { size: 8, fill: C.faint });
    FK.text(ctx, 'β = 28°', W - 12, H - 12, { font: FK.mono(9), fill: C.faint, align: 'right' });
  }

  resize(); frame();
  FK.onResize(canvas, () => { resize(); frame(); });
  const anim = FK.loop(canvas, dt => { t = (t + 0.0013 * dt) % 1; frame(); }, { fps: 30 });
  anim.start();
})();
