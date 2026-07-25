/* =================================================================
   A POLAR (AM Her star), built from the actual binary geometry.

   Polars are synchronous: P_spin = P_orb, so the white dwarf's field
   is locked to the binary frame. Everything below is therefore solved
   ONCE in the co-rotating frame and only the observer moves — which
   is both the physically honest picture and the reason the scene and
   the light curve can never disagree.

     · the donor fills its Roche lobe. The lobe is the equipotential
       through L1 of
         Φ = −µ1/r1 − µ2/r2 − ½[(x−x_cm)² + y²]        (a = 1, ω = 1)
       with L1 found by bisection on dΦ/dx and the surface found by
       bisection along 420 Fibonacci directions. Change q and the
       teardrop changes shape, as it must.
     · the stream leaves L1 ballistically and is integrated with RK4
       in the rotating frame, so it carries the Coriolis curvature.
     · at the threading radius R_µ the gas couples to the field and
       follows dipole lines, r = r_eq sin²θ_m, down to a footpoint —
       the accretion curtain.
     · cyclotron emission is beamed ⊥ B, so the flux follows
         F ∝ sin²µ · visibility,   cos µ = B̂(spot) · n̂(φ)
       with B̂ the true dipole direction at the footpoint,
         B ∝ 3 sinθ cosθ ê₁ + (2cos²θ − sin²θ) m̂.
     · the observer's direction in the binary frame is
         n̂(φ) = (sin i cos 2πφ, sin i sin 2πφ, cos i)
       so φ = 0 is inferior conjunction of the white dwarf: the donor
       is in front, and the eclipse appears on its own once
       i > arccos(R_L,proj / a).
   ================================================================= */
(function () {
  const scene = document.getElementById('cycCanvas');
  const lcEl  = document.getElementById('lcCanvas');
  if (!scene || !lcEl || !window.FK) return;
  const ctx  = scene.getContext('2d');
  const lctx = lcEl.getContext('2d');
  const C = FK.C, RGB = FK.RGB;

  const $ = id => document.getElementById(id);
  const out = {
    phase: $('cycPhase'), geom: $('cycGeom'), mu: $('cycMu'), psi: $('cycPsi'),
    poles: $('cycPoles'), flux: $('cycFlux'), ecl: $('cycEcl'),
    lobe: $('cycLobe'), q: $('cycQ')
  };
  const inp = {
    inc: $('cycInc'), beta: $('cycBeta'), psi: $('cycPsi_i'), q: $('cycQ_i'),
    speed: $('cycSpeed'), two: $('cycTwoPole'), pause: $('cycPause')
  };
  const chips = document.querySelectorAll('[data-morph]');

  /* ---------------- state ---------------- */
  let inc  = FK.RAD(+(inp.inc  && inp.inc.value  || 78));
  let beta = FK.RAD(+(inp.beta && inp.beta.value || 55));
  let psim = FK.RAD(+(inp.psi  && inp.psi.value  || 35));   // magnetic longitude from the donor
  let q    = +(inp.q && inp.q.value || 0.35);               // M_donor / M_wd
  let speed = +(inp.speed && inp.speed.value || 1);
  let twoPole = false, phase = 0.22;   // open at quadrature: the teardrop and the stream both read
  let W = 0, H = 0, LW = 0, LH = 0;

  const R_WD    = 0.030;   // exaggerated ×~30 so the pole geometry is legible
  const R_MU    = 0.170;   // magnetospheric / threading radius, in units of a
  const SECOND  = 0.42;    // relative strength of the second pole

  /* ================= Roche geometry (cached per q) ================= */
  let RO = null;
  function buildRoche(qq) {
    const m1 = 1 / (1 + qq), m2 = qq / (1 + qq), xcm = m2;
    const phi = (x, y, z) => {
      const r1 = Math.sqrt(x * x + y * y + z * z) || 1e-9;
      const dx = x - 1, r2 = Math.sqrt(dx * dx + y * y + z * z) || 1e-9;
      return -m1 / r1 - m2 / r2 - 0.5 * ((x - xcm) * (x - xcm) + y * y);
    };
    const dphi = x => m1 / (x * x) - m2 / ((1 - x) * (1 - x)) - (x - xcm);
    let lo = 1e-3, hi = 1 - 1e-3;
    for (let k = 0; k < 90; k++) { const m = (lo + hi) / 2; if (dphi(m) > 0) lo = m; else hi = m; }
    const xL1 = (lo + hi) / 2, phiL1 = phi(xL1, 0, 0), dL1 = 1 - xL1;

    /* lobe surface — Fibonacci directions, bisected onto Φ = Φ(L1) */
    const N = 420, pts = new Float64Array(N * 3);
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < N; k++) {
      const zz = 1 - 2 * (k + 0.5) / N, rr = Math.sqrt(Math.max(0, 1 - zz * zz)), th = ga * k;
      const ux = rr * Math.cos(th), uy = rr * Math.sin(th), uz = zz;
      let a = 1e-4, b = dL1 * 0.9994;
      if (phi(1 + ux * b, uy * b, uz * b) < phiL1) a = b;
      else for (let it = 0; it < 40; it++) {
        const m = (a + b) / 2;
        if (phi(1 + ux * m, uy * m, uz * m) < phiL1) a = m; else b = m;
      }
      const rho = (a + b) / 2;
      pts[k * 3] = 1 + ux * rho; pts[k * 3 + 1] = uy * rho; pts[k * 3 + 2] = uz * rho;
    }
    /* Eggleton (1983) volume-equivalent lobe radius, for the readout */
    const c = Math.cbrt(qq);
    const rL = 0.49 * c * c / (0.6 * c * c + Math.log(1 + c));

    /* ballistic stream: RK4 in the co-rotating frame, COM at the origin */
    const X1 = -xcm, X2 = 1 - xcm;
    const acc = s => {
      const dx1 = s[0] - X1, dx2 = s[0] - X2, y = s[1];
      const r1 = Math.pow(dx1 * dx1 + y * y, 1.5) || 1e-9;
      const r2 = Math.pow(dx2 * dx2 + y * y, 1.5) || 1e-9;
      return [2 * s[3] + s[0] - m1 * dx1 / r1 - m2 * dx2 / r2,
              -2 * s[2] + y - m1 * y / r1 - m2 * y / r2];
    };
    const deriv = s => { const a = acc(s); return [s[2], s[3], a[0], a[1]]; };
    let st = [xL1 - xcm, 0, -0.020, 0];
    const h = 0.0016, stream = [];
    for (let n = 0; n < 5200; n++) {
      const k1 = deriv(st);
      const s2 = st.map((v, i) => v + h / 2 * k1[i]), k2 = deriv(s2);
      const s3 = st.map((v, i) => v + h / 2 * k2[i]), k3 = deriv(s3);
      const s4 = st.map((v, i) => v + h * k3[i]),     k4 = deriv(s4);
      st = st.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      const x = st[0] + xcm, y = st[1];
      if (n % 3 === 0) stream.push([x, y, 0]);
      if (Math.hypot(x, y) < R_MU * 0.98) break;
      if (!isFinite(x) || Math.hypot(x, y) > 1.4) break;
    }
    const thread = stream.length ? stream[stream.length - 1] : [R_MU, 0, 0];
    return { q: qq, m1, m2, xcm, xL1, dL1, pts, N, rL, stream, thread };
  }

  /* ================= projection ================= */
  /* n̂(φ) = (sin i cos ψ, sin i sin ψ, cos i);  screen axes ⊥ n̂ */
  let nh = [0, 0, 1], eh = [1, 0, 0], ev = [0, 1, 0];
  function setView(ph) {
    const psi = 2 * Math.PI * ph, s = Math.sin(inc), c = Math.cos(inc);
    const cp = Math.cos(psi), sp = Math.sin(psi);
    nh = [s * cp, s * sp, c];
    eh = [-sp, cp, 0];
    ev = [-c * cp, -c * sp, s];
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /* screen coords, in units of a, y already flipped for the canvas */
  const px = p => dot(p, eh);
  const py = p => -dot(p, ev);
  const pz = p => dot(p, nh);

  /* magnetic moment, fixed in the binary frame */
  function mhat() {
    return [Math.sin(beta) * Math.cos(psim), Math.sin(beta) * Math.sin(psim), Math.cos(beta)];
  }

  /* ================= the accretion footpoint ================= */
  /* Returns the spot position, its outward normal and the local field
     direction for a given pole sign (+1 = the pole the stream reaches). */
  function footpoint(sign) {
    const m = mhat(), P = RO.thread;
    const rP = Math.hypot(P[0], P[1], P[2]) || 1e-6;
    let cT = dot(P, m) / rP;
    /* e1 = unit component of P perpendicular to m */
    let e1 = [P[0] - dot(P, m) * m[0], P[1] - dot(P, m) * m[1], P[2] - dot(P, m) * m[2]];
    let n1 = Math.hypot(e1[0], e1[1], e1[2]);
    if (n1 < 1e-8) { e1 = [1, 0, 0]; n1 = 1; }
    e1 = [e1[0] / n1, e1[1] / n1, e1[2] / n1];
    const sT2 = Math.max(1e-4, 1 - cT * cT);
    const req = rP / sT2;
    /* footpoint on the requested hemisphere */
    const north = sign > 0 ? (cT >= 0) : (cT < 0);
    let th = Math.asin(Math.min(1, Math.sqrt(R_WD / req)));
    if (!north) th = Math.PI - th;
    const st = Math.sin(th), ct = Math.cos(th), r = req * st * st;
    const pos = [r * (st * e1[0] + ct * m[0]), r * (st * e1[1] + ct * m[1]), r * (st * e1[2] + ct * m[2])];
    const be1 = 3 * st * ct, bem = 2 * ct * ct - st * st, bn = Math.hypot(be1, bem) || 1;
    const B = [(be1 * e1[0] + bem * m[0]) / bn, (be1 * e1[1] + bem * m[1]) / bn, (be1 * e1[2] + bem * m[2]) / bn];
    const pn = Math.hypot(pos[0], pos[1], pos[2]) || 1;
    return { pos, req, e1, theta: th, B, nrm: [pos[0] / pn, pos[1] / pn, pos[2] / pn] };
  }
  let FP1 = null, FP2 = null;
  function rebuildPoles() { FP1 = footpoint(+1); FP2 = footpoint(-1); }

  /* ================= eclipse table (per i, q) ================= */
  /* Support function of the projected Roche lobe toward the white dwarf:
     the exact quantity that decides whether the lobe covers it. */
  const NPH = 240;
  let eclTab = new Float64Array(NPH);
  function buildEclipse() {
    const p = RO.pts, N = RO.N;
    for (let k = 0; k < NPH; k++) {
      const ph = k / NPH;
      setView(ph);
      /* donor centre and the sky direction from it to the WD (origin) */
      const cx = px([1, 0, 0]), cy = py([1, 0, 0]), cz = pz([1, 0, 0]);
      if (cz <= 0) { eclTab[k] = 1; continue; }        // donor behind the WD
      const sep = Math.hypot(cx, cy);
      const ux = -cx / (sep || 1), uy = -cy / (sep || 1);
      let hsup = 0;
      for (let j = 0; j < N; j++) {
        const v = [p[j * 3] - 1, p[j * 3 + 1], p[j * 3 + 2]];
        const d = px(v) * ux + py(v) * uy;
        if (d > hsup) hsup = d;
      }
      const g = sep - hsup;                            // gap from the lobe edge to the WD centre
      eclTab[k] = g >= R_WD ? 1 : g <= -R_WD ? 0 : (g + R_WD) / (2 * R_WD);
    }
  }
  function eclipseAt(ph) {
    const t = (((ph % 1) + 1) % 1) * NPH, i0 = Math.floor(t), f = t - i0;
    return FK.lerp(eclTab[i0 % NPH], eclTab[(i0 + 1) % NPH], f);
  }

  /* ================= flux ================= */
  function poleFlux(ph, fp) {
    const psi = 2 * Math.PI * ph, s = Math.sin(inc), c = Math.cos(inc);
    const n = [s * Math.cos(psi), s * Math.sin(psi), c];
    const cmu = FK.clamp(dot(fp.B, n), -1, 1);
    const vis = FK.smooth(-0.12, 0.16, dot(fp.nrm, n));   // spot rotating over the limb
    return (1 - cmu * cmu) * vis;
  }
  function fluxAt(ph) {
    let F = poleFlux(ph, FP1);
    if (twoPole) F += SECOND * poleFlux(ph, FP2);
    F = 0.07 + 0.93 * F;                                  // photosphere + companion floor
    return F * eclipseAt(ph);
  }
  let fMax = 1;
  function renorm() {
    fMax = -1e9;
    for (let k = 0; k <= 400; k++) { const f = fluxAt(k / 400); if (f > fMax) fMax = f; }
    if (fMax < 1e-4) fMax = 1e-4;
  }
  /* normalised to the maximum, not stretched to fill 0–1: the residual
     photospheric floor between humps is real and worth seeing */
  const norm = f => f / fMax;
  function muAt(ph) {
    const psi = 2 * Math.PI * ph, s = Math.sin(inc);
    const n = [s * Math.cos(psi), s * Math.sin(psi), Math.cos(inc)];
    return Math.acos(FK.clamp(dot(FP1.B, n), -1, 1));
  }
  function eclipseState() {
    let m = 1; for (let k = 0; k < NPH; k++) if (eclTab[k] < m) m = eclTab[k];
    return m >= 0.995 ? 'none' : m <= 0.02 ? 'total' : 'partial';
  }
  function iCrit() {
    /* smallest i that produces any occultation, from the lobe's polar radius */
    const p = RO.pts; let rmax = 0;
    for (let j = 0; j < RO.N; j++) {
      const dy = p[j * 3 + 1], dz = p[j * 3 + 2], d = Math.hypot(dy, dz);
      if (d > rmax) rmax = d;
    }
    return Math.acos(FK.clamp(rmax + R_WD, 0, 1));
  }

  /* ================= scene ================= */
  function rebuild(full) {
    if (full) { RO = buildRoche(q); }
    rebuildPoles(); buildEclipse(); renorm();
  }

  function strokeSplit(pts3, front, style, width, dash) {
    /* stroke only the segments on the requested side of the sky plane,
       so field lines duck behind the star instead of floating over it */
    ctx.save();
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    let open = false;
    ctx.beginPath();
    for (const p of pts3) {
      const ok = front ? p[3] : !p[3];
      if (!ok) { open = false; continue; }
      if (!open) { ctx.moveTo(p[0], p[1]); open = true; } else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.restore();
  }

  /* a dipole line through a given r_eq / azimuth, in screen space */
  function dipoleLine(req, e1, m, cx, cy, S, thA, thB, steps) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
      const th = thA + (thB - thA) * k / steps;
      const st = Math.sin(th), ct = Math.cos(th), r = req * st * st;
      const P = [r * (st * e1[0] + ct * m[0]), r * (st * e1[1] + ct * m[1]), r * (st * e1[2] + ct * m[2])];
      pts.push([cx + px(P) * S, cy + py(P) * S, 0, pz(P) > 0]);
    }
    return pts;
  }
  function rotAbout(v, axis, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), d = dot(v, axis);
    return [v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * d * (1 - c),
            v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * d * (1 - c),
            v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * d * (1 - c)];
  }

  /* Projected silhouette of the Roche lobe.
     Binning by angle leaves under-sampled spikes, so instead we take the
     support function h(u) = max_j (p_j · u) over 72 directions and rebuild
     the outline as the envelope of the supporting lines. The lobe is convex,
     so this is both exact and spike-free — and h is the same quantity the
     eclipse test needs, which keeps the scene and the light curve consistent. */
  const NB = 72, sup = new Float64Array(NB);
  function lobeSilhouette() {
    const p = RO.pts, N = RO.N;
    const cx = px([1, 0, 0]), cy = py([1, 0, 0]);
    for (let k = 0; k < NB; k++) sup[k] = -1e9;
    for (let j = 0; j < N; j++) {
      const v = [p[j * 3] - 1, p[j * 3 + 1], p[j * 3 + 2]];
      const dx = px(v), dy = py(v);
      for (let k = 0; k < NB; k++) {
        const a = k / NB * 2 * Math.PI;
        const d = dx * Math.cos(a) + dy * Math.sin(a);
        if (d > sup[k]) sup[k] = d;
      }
    }
    return { cx, cy };
  }
  function lobePath(cx, cy, S) {
    const P = new Path2D();
    const da = 2 * Math.PI / NB, det = Math.sin(da);
    for (let k = 0; k < NB; k++) {
      const a0 = k * da, a1 = a0 + da;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const h0 = sup[k], h1 = sup[(k + 1) % NB];
      const vx = (h0 * s1 - h1 * s0) / det, vy = (c0 * h1 - c1 * h0) / det;
      const X = cx + vx * S, Y = cy + vy * S;
      k ? P.lineTo(X, Y) : P.moveTo(X, Y);
    }
    P.closePath();
    return P;
  }

  function drawScene() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    setView(phase);
    const S = Math.min(W * 0.405, H * 0.475);            // pixels per orbital separation
    const cx = W * 0.5, cy = H * 0.5;                    // the white dwarf sits at the centre
    const m = mhat();
    const ecf = eclipseAt(phase);
    const f1 = poleFlux(phase, FP1), f2 = twoPole ? poleFlux(phase, FP2) : 0;

    const don = { x: cx + px([1, 0, 0]) * S, y: cy + py([1, 0, 0]) * S, z: pz([1, 0, 0]) };
    const donFront = don.z > 0;

    /* --- relative orbit, drawn as the ring the donor traces --- */
    ctx.save();
    ctx.strokeStyle = 'rgba(139,169,207,.15)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    ctx.beginPath();
    for (let k = 0; k <= 96; k++) {
      const a = k / 96 * 2 * Math.PI, P = [Math.cos(a), Math.sin(a), 0];
      const X = cx + px(P) * S, Y = cy + py(P) * S;
      k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.stroke(); ctx.restore();

    /* --- dipole field lines --- */
    const e1 = FP1.e1;
    const shells = [0.09, 0.145, 0.21, 0.30, 0.42];
    for (let s = 0; s < shells.length; s++) {
      for (const az of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
        const ee = rotAbout(e1, m, az);
        const req = shells[s];
        const thF = Math.asin(Math.min(1, Math.sqrt(Math.min(1, R_WD / req))));
        const L = dipoleLine(req, ee, m, cx, cy, S, thF, Math.PI - thF, 44);
        const al = 0.42 - s * 0.058;
        strokeSplit(L, false, 'rgba(139,169,207,' + (al * 0.45).toFixed(3) + ')', 1);
        strokeSplit(L, true,  'rgba(139,169,207,' + al.toFixed(3) + ')', 1);
      }
    }
    /* magnetic axis */
    const mA = [m[0] * 0.62, m[1] * 0.62, m[2] * 0.62], mB = [-mA[0], -mA[1], -mA[2]];
    ctx.save();
    ctx.strokeStyle = 'rgba(139,169,207,.30)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + px(mB) * S, cy + py(mB) * S);
    ctx.lineTo(cx + px(mA) * S, cy + py(mA) * S);
    ctx.stroke(); ctx.restore();
    FK.text(ctx, 'µ', cx + px(mA) * S + 6, cy + py(mA) * S - 2,
      { font: FK.serif(12, 500), fill: 'rgba(139,169,207,.8)' });

    /* --- donor behind? --- */
    const sil = lobeSilhouette();
    const dcx = cx + sil.cx * S, dcy = cy + sil.cy * S;
    let rMean = 0; for (let k = 0; k < NB; k++) rMean += sup[k]; rMean = rMean / NB * S;
    const drawDonor = () => {
      const path = lobePath(dcx, dcy, S);
      FK.discPath(ctx, path, dcx + (cx - dcx) * 0.10, dcy + (cy - dcy) * 0.10, rMean * 1.12, RGB.donor,
        { u: 0.66, core: 0.94 });
      /* the face turned toward the white dwarf is irradiated by the accretion region */
      ctx.save();
      ctx.clip(path);
      const ang = Math.atan2(cy - dcy, cx - dcx);
      const gx = dcx + Math.cos(ang) * rMean * 0.85, gy = dcy + Math.sin(ang) * rMean * 0.85;
      const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rMean * 1.5);
      gg.addColorStop(0, 'rgba(255,214,168,.42)'); gg.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = gg; ctx.fill(path);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,196,142,.30)'; ctx.lineWidth = 1; ctx.stroke(path);
      ctx.restore();
    };
    if (!donFront) drawDonor();

    /* --- ballistic stream, faded by depth --- */
    const str = RO.stream;
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 1; k < str.length; k++) {
      const A = str[k - 1], B = str[k];
      const ax = cx + px(A) * S, ay = cy + py(A) * S, bx = cx + px(B) * S, by = cy + py(B) * S;
      const depth = FK.clamp(0.5 + pz(B) * 0.9, 0.12, 1);
      const t = k / str.length;
      ctx.strokeStyle = 'rgba(224,164,92,' + (0.30 + 0.55 * t) * depth + ')';
      ctx.lineWidth = 1.1 + 1.7 * t;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    if (!FK.reduce && str.length > 6) {                    // gas blobs travelling down the stream
      for (let b = 0; b < 4; b++) {
        const t = ((phase * 2.4 + b / 4) % 1);
        const idx = Math.min(str.length - 1, Math.floor(t * (str.length - 1)));
        const P = str[idx];
        ctx.fillStyle = 'rgba(255,214,152,' + (0.85 - t * 0.35) * FK.clamp(0.4 + pz(P), 0.2, 1) + ')';
        ctx.beginPath(); ctx.arc(cx + px(P) * S, cy + py(P) * S, 2.1, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
    /* threading marker */
    const Pt = RO.thread;
    const tx = cx + px(Pt) * S, ty = cy + py(Pt) * S;
    ctx.save();
    ctx.strokeStyle = 'rgba(216,206,180,.42)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx, ty + 5); ctx.lineTo(tx, ty + 18); ctx.lineTo(tx + 8, ty + 18); ctx.stroke();
    ctx.restore();
    FK.text(ctx, 'threads onto the field at R', tx + 12, ty + 21, { font: FK.mono(9), fill: C.dim });
    ctx.save(); ctx.font = FK.mono(9);
    FK.text(ctx, 'µ', tx + 12 + ctx.measureText('threads onto the field at R').width, ty + 24,
      { font: FK.mono(7.5), fill: C.dim });
    ctx.restore();

    /* --- accretion curtain: dipole lines from R_µ down to the footpoint --- */
    const drawCurtain = (fp, strength) => {
      if (strength <= 0.001) return;
      const north = fp.theta < Math.PI / 2;
      for (let s = -2; s <= 2; s++) {
        const ee = rotAbout(fp.e1, m, s * 0.17);
        const req = fp.req * (1 + s * 0.035);
        const thF = Math.asin(Math.min(1, Math.sqrt(Math.min(1, R_WD / req))));
        const thT = Math.acos(FK.clamp(dot(Pt, m) / (Math.hypot(Pt[0], Pt[1], Pt[2]) || 1), -1, 1));
        const A = north ? thF : Math.PI - thF;
        const B = north ? Math.min(thT, Math.PI / 2) : Math.max(thT, Math.PI / 2);
        const L = dipoleLine(req, ee, m, cx, cy, S, A, B, 30);
        const w = 2.6 - Math.abs(s) * 0.55;
        strokeSplit(L, false, 'rgba(224,164,92,' + (0.16 * strength) + ')', w);
        strokeSplit(L, true,  'rgba(240,190,120,' + (0.40 * strength) + ')', w);
      }
    };

    /* --- the white dwarf and its poles --- */
    const spot = (fp, bright) => {
      const P = fp.pos, d = pz(P);
      const sx = cx + px(P) * S, sy = cy + py(P) * S;
      const rr = Math.max(3, R_WD * S * 0.62);
      if (d < 0) return;                                  // on the far hemisphere
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 1.9);
      g.addColorStop(0, 'rgba(255,226,176,' + (0.55 + 0.45 * bright) + ')');
      g.addColorStop(0.45, 'rgba(240,168,86,' + (0.35 + 0.4 * bright) + ')');
      g.addColorStop(1, 'rgba(216,112,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rr * 1.9, 0, 7); ctx.fill();
      /* the beam: cyclotron radiation leaves ⊥ B, i.e. as a fan around the field */
      if (bright > 0.04) {
        const bh = px(fp.B), bv = py(fp.B);
        const ang = Math.atan2(bv, bh);
        const reach = S * 0.30 * (0.35 + 0.65 * bright);
        for (const s of [1, -1]) {
          const d0 = ang + s * Math.PI / 2;
          const gg = ctx.createRadialGradient(sx, sy, rr * 0.4, sx, sy, reach);
          gg.addColorStop(0, 'rgba(240,186,116,' + (0.30 * bright + 0.03) + ')');
          gg.addColorStop(1, 'rgba(240,186,116,0)');
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, reach, d0 - 0.40, d0 + 0.40); ctx.closePath(); ctx.fill();
        }
      }
    };

    drawCurtain(FP1, 1);
    if (twoPole) drawCurtain(FP2, SECOND);
    if (pz(FP1.pos) < 0) spot(FP1, f1 * ecf);
    if (twoPole && pz(FP2.pos) < 0) spot(FP2, f2 * ecf);

    const rw = Math.max(4, R_WD * S);
    FK.disc(ctx, cx, cy, rw, RGB.wd, { u: 0.42, core: 0.98, bloom: 2.3 });

    if (pz(FP1.pos) >= 0) spot(FP1, f1 * ecf);
    if (twoPole && pz(FP2.pos) >= 0) spot(FP2, f2 * ecf);

    if (donFront) drawDonor();

    /* --- annotation ---
       The scene IS the observer's view, so there is no "to observer" arrow.
       What does need marking is the projected spin / orbital axis. */
    const gx = W - 34, gy = H - 78, gl = 26 * Math.sin(inc) + 4;
    ctx.save();
    ctx.strokeStyle = 'rgba(139,169,207,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gl);
    ctx.moveTo(gx - 3, gy - gl + 4); ctx.lineTo(gx, gy - gl); ctx.lineTo(gx + 3, gy - gl + 4);
    ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(139,169,207,.22)';
    ctx.beginPath(); ctx.ellipse(gx, gy, 14, 14 * Math.cos(inc), 0, 0, 7); ctx.stroke();
    ctx.restore();
    FK.text(ctx, 'Ω', gx + 6, gy - gl + 4, { font: FK.serif(11, 500), fill: 'rgba(139,169,207,.8)' });

    FK.kicker(ctx, 'P_spin = P_orb  ·  synchronous', 14, 20, { size: 8.5 });
    FK.text(ctx, 'q = ' + q.toFixed(2) + '   i = ' + Math.round(FK.DEG(inc)) + '°   β = ' +
      Math.round(FK.DEG(beta)) + '°   ψ = ' + Math.round(FK.DEG(psim)) + '°',
      W - 14, 20, { font: FK.mono(9.5), fill: C.dim, align: 'right' });

    /* scale bar: one orbital separation */
    const bx0 = 14, by0 = H - 44;
    ctx.save(); ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx0 + S, by0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx0, by0 - 3); ctx.lineTo(bx0, by0 + 3);
    ctx.moveTo(bx0 + S, by0 - 3); ctx.lineTo(bx0 + S, by0 + 3); ctx.stroke(); ctx.restore();
    FK.text(ctx, 'a', bx0 + S / 2, by0 - 5, { font: FK.serif(11, 500), fill: C.dim, align: 'center' });

    if (donFront && ecf < 0.6) {
      FK.text(ctx, 'the donor eclipses the white dwarf', cx, Math.max(46, dcy - rMean - 14),
        { font: FK.mono(10), fill: '#f0bd86', align: 'center' });
    }

    /* --- readouts --- */
    if (out.phase) out.phase.textContent = phase.toFixed(3);
    if (out.geom)  out.geom.textContent = Math.round(FK.DEG(inc)) + '° / ' + Math.round(FK.DEG(beta)) + '°';
    if (out.psi)   out.psi.textContent = Math.round(FK.DEG(psim)) + '°';
    if (out.mu)    out.mu.textContent = Math.round(FK.DEG(muAt(phase))) + '°';
    if (out.poles) out.poles.textContent = twoPole ? 'two' : 'one';
    if (out.flux)  out.flux.textContent = Math.round(norm(fluxAt(phase)) * 100) + '%';
    if (out.q)     out.q.textContent = q.toFixed(2);
    if (out.lobe)  out.lobe.textContent = 'R_L = ' + RO.rL.toFixed(3) + ' a  ·  L1 = ' + RO.dL1.toFixed(3) + ' a';
    if (out.ecl) {
      const st = eclipseState();
      out.ecl.textContent = st === 'none'
        ? 'none — raise i past ' + Math.round(FK.DEG(iCrit())) + '°'
        : st + ' · iᶜ ≈ ' + Math.round(FK.DEG(iCrit())) + '°';
    }
  }

  /* ================= light curve ================= */
  let lcAx = null, hover = null;
  function drawLC() {
    if (!LW) return;
    lctx.clearRect(0, 0, LW, LH);
    const A = FK.axes(lctx, {
      l: 34, t: 10, r: LW - 8, b: LH - 26,
      x: { min: 0, max: 1, n: 4, label: 'orbital phase φ', fmt: v => v.toFixed(2) },
      y: { min: -0.04, max: 1.06, n: 3, label: 'normalised flux', fmt: v => v.toFixed(1) },
      grid: false, yTitleGap: 27
    });
    lcAx = A;
    FK.inBox(lctx, A.box, () => {
      /* eclipse window, shaded */
      let lo = -1, hi = -1;
      for (let k = 0; k < NPH; k++) {
        if (eclTab[k] < 0.995) { if (lo < 0) lo = k / NPH; hi = k / NPH; }
      }
      if (lo >= 0) {
        lctx.fillStyle = 'rgba(224,164,92,.11)';
        const xa = A.X(lo), xb = A.X(Math.max(hi, lo + 0.004));
        lctx.fillRect(xa, A.box.t, xb - xa, A.box.b - A.box.t);
      }
      /* one-pole contribution, dashed, when a second pole is on */
      if (twoPole) {
        FK.curve(lctx, 220, t => {
          const f = 0.07 + 0.93 * poleFlux(t, FP1);
          return [A.X(t), A.Y(norm(f * eclipseAt(t)))];
        }, { stroke: 'rgba(216,206,180,.42)', width: 1.2, dash: [4, 3] });
      }
      FK.curve(lctx, 320, t => [A.X(t), A.Y(norm(fluxAt(t)))], { stroke: C.amber, width: 1.9 });
    });
    /* phase cursor */
    const ph = ((phase % 1) + 1) % 1;
    lctx.save();
    lctx.strokeStyle = 'rgba(244,238,226,.34)'; lctx.lineWidth = 1;
    lctx.beginPath(); lctx.moveTo(FK.snap(A.X(ph)), A.box.t); lctx.lineTo(FK.snap(A.X(ph)), A.box.b); lctx.stroke();
    lctx.fillStyle = C.ink;
    lctx.beginPath(); lctx.arc(A.X(ph), A.Y(norm(fluxAt(ph))), 3.4, 0, 7); lctx.fill();
    lctx.restore();
    if (hover != null) {
      const f = norm(fluxAt(hover));
      FK.chip(lctx, A.X(hover), A.Y(f), ['φ = ' + hover.toFixed(3), 'F = ' + f.toFixed(3)], A.box);
    }
  }

  /* ================= plumbing ================= */
  function resize() {
    const a = FK.fit(scene, ctx); if (a) { W = a.w; H = a.h; }
    const b = FK.fit(lcEl, lctx); if (b) { LW = b.w; LH = b.h; }
  }
  function render() { drawScene(); drawLC(); }

  RO = buildRoche(q);
  rebuild(false);
  resize(); render();

  const anim = FK.loop(scene, dt => { phase = (phase + 0.0015 * speed * dt) % 1; render(); });
  FK.onResize(scene, () => { resize(); render(); });
  FK.onResize(lcEl, () => { resize(); render(); });

  /* drag the scene or the light curve to scrub the orbit */
  FK.pointer(scene, {
    drag: p => { phase = ((p.x / Math.max(1, p.w)) % 1 + 1) % 1; render(); }
  });
  FK.pointer(lcEl, {
    move: p => { hover = lcAx ? FK.clamp(lcAx.invX(p.x), 0, 1) : null; if (!anim.paused) return; drawLC(); },
    leave: () => { hover = null; drawLC(); },
    drag: p => { if (lcAx) { phase = FK.clamp(lcAx.invX(p.x), 0, 1); render(); } }
  });

  /* ---- controls ---- */
  const MORPH = {
    single:  { i: 42, b: 22, p: 20, two: false },
    double:  { i: 72, b: 62, p: 40, two: false },
    twopole: { i: 62, b: 74, p: 55, two: true  },
    eclipse: { i: 86, b: 34, p: 25, two: false }
  };
  const clearChips = () => chips.forEach(c => c.classList.remove('active'));
  function syncToggle() {
    if (!inp.two) return;
    inp.two.textContent = 'Second pole: ' + (twoPole ? 'on' : 'off');
    inp.two.setAttribute('aria-pressed', String(twoPole));
  }
  function setMorph(k) {
    const m = MORPH[k]; if (!m) return;
    inc = FK.RAD(m.i); beta = FK.RAD(m.b); psim = FK.RAD(m.p); twoPole = m.two;
    if (inp.inc) inp.inc.value = m.i;
    if (inp.beta) inp.beta.value = m.b;
    if (inp.psi) inp.psi.value = m.p;
    syncToggle(); clearChips();
    chips.forEach(c => { if (c.dataset.morph === k) c.classList.add('active'); });
    rebuild(false); render();
  }
  const on = (el, fn) => el && el.addEventListener('input', () => { fn(); render(); });
  on(inp.inc,  () => { inc  = FK.RAD(+inp.inc.value);  clearChips(); rebuild(false); });
  on(inp.beta, () => { beta = FK.RAD(+inp.beta.value); clearChips(); rebuild(false); });
  on(inp.psi,  () => { psim = FK.RAD(+inp.psi.value);  clearChips(); rebuild(false); });
  on(inp.q,    () => { q    = +inp.q.value;            clearChips(); rebuild(true);  });
  on(inp.speed, () => { speed = +inp.speed.value; });
  if (inp.two) inp.two.addEventListener('click', () => {
    twoPole = !twoPole; syncToggle(); clearChips(); rebuild(false); render();
  });
  chips.forEach(c => c.addEventListener('click', () => setMorph(c.dataset.morph)));
  if (inp.pause) inp.pause.addEventListener('click', () => {
    anim.paused = !anim.paused;
    inp.pause.textContent = anim.paused ? 'Play' : 'Pause';
    inp.pause.setAttribute('aria-pressed', String(anim.paused));
    render();
  });

  syncToggle();
  anim.start();
})();
