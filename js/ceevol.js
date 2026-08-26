/* =================================================================
   ceevol.js — how NS Per was built: a common envelope, run forwards.

   NS Per is a dwarf nova inside NGC 1528, a cluster only a few hundred
   Myr old. That is the whole point: the cluster is a clock. Whatever
   made this binary had to finish inside the cluster's lifetime, and
   that turns a notoriously unconstrained parameter — the common-envelope
   efficiency α_CE — into something you can bracket.

   The figure runs the channel end to end and solves it as it goes:

     1. A ~6 M⊙ primary and a 0.55 M⊙ companion, wide.
     2. The primary reaches the AGB and fills its Roche lobe. The mass
        ratio is ~11:1, so transfer is dynamically unstable.
     3. Common envelope. The α-formalism says the envelope is unbound
        by the orbital energy released as the cores spiral in,

            α_CE ( G M_c M₂ / 2a_f − G M₁ M₂ / 2a_i ) = G M₁ M_env / λR₁

        which is solved here for a_f every frame.
     4. If a_f leaves the companion inside its Roche lobe, the two cores
        merge and the cluster gets one more invisible white dwarf. That
        is where 87% of the COSMIC grid ends.
     5. If it survives, magnetic braking and gravitational waves grind
        the orbit down. Angular momentum loss is integrated properly —
        Rappaport–Verbunt–Joss braking plus the GR quadrupole, giving

            |ȧ| = 7.6e-30 R₂⁴ G M² / (M_wd a⁴)  +  (64/5) G³M₁M₂M / c⁵a³

        and t_decay = ∫ da/|ȧ|, in years, not in hand-waving.
     6. It has to reach 6.2994 h — the measured SDSS-V period — before
        the cluster age. Miss it and the system is still a detached
        white dwarf pair today: real, but invisible.

   Only a narrow band of α_CE threads steps 4 and 6 at once. Drag α and
   the band is what you are looking for. The independent COSMIC grid
   agrees: α ≤ 0.3 produces NS Per, α ≥ 0.5 produces nothing.

   Drawing: everything lives in the orbital plane and is projected once,
   so the Roche lobes, the ballistic stream and the disk all share one
   geometry. Lobes are the traced Φ = Φ(L₁) equipotential; the stream is
   RK4 in the co-rotating frame, the same integrator as Fig. 1, stopped
   at its first pericenter passage — beyond that the real gas has struck
   the ring it is building at R_circ (Frank, King & Raine 2002).
   ================================================================= */
(function () {
  const canvas = document.getElementById('ceCanvas');
  const trackEl = document.getElementById('ceTrack');
  if (!canvas || !trackEl || !window.FK) return;
  const ctx = canvas.getContext('2d');
  const tctx = trackEl.getContext('2d');
  const C = FK.C, RGB = FK.RGB;
  const D = window.CE_DATA || {};

  const $ = id => document.getElementById(id);
  const out = {
    stage: $('ceStage'), time: $('ceTime'), sep: $('ceSep'), porb: $('cePorb'),
    mwd: $('ceMwd'), pce: $('cePce'), tdec: $('ceTdec'), win: $('ceWindow'),
    verdict: $('ceVerdict'), lobe: $('ceLobe'), chan: $('ceChan'),
    /* the labels move too: three of these rows mean different things on the
       two channels, and a row that says one thing while showing another is
       worse than no row at all */
    mwdL: $('ceMwdL'), pceL: $('cePceL'), tdecL: $('ceTdecL'), lobeL: $('ceLobeL')
  };
  const inp = {
    alpha: $('ceAlpha'), lam: $('ceLam'), m1: $('ceM1'), m2: $('ceM2'), speed: $('ceSpeed'),
    age: $('ceAge'), cs: $('ceCase'), pause: $('cePause')
  };

  /* ---------------- constants (cgs) ---------------- */
  const Msun = 1.989e33, Rsun = 6.957e10, GG = 6.674e-8, CL = 2.998e10;
  const MYR = 3.156e13;

  const P_OBS_H = D.P_orb_h || 6.2994;
  const P_OBS_S = P_OBS_H * 3600;
  const M2 = (D.donor && D.donor.M2) || 0.55;      // Knigge (2011) donor at 6.30 h
  const R2_KNIGGE = (D.donor && D.donor.R2) || 0.63;
  const R1_AGB = 400;                              // R⊙ — fiducial Case-C RLOF radius
  const AGES = D.cluster_ages_myr || [110, 209, 400];
  const BSE_ALPHA = (D.bse && D.bse.alpha) || [];

  /* ================================================================
     PHYSICS
     ================================================================ */
  /* Eggleton (1983): volume-equivalent lobe radius of the star whose
     mass ratio to its companion is q. */
  function fRL(q) {
    const c = Math.cbrt(q), c2 = c * c;
    return 0.49 * c2 / (0.6 * c2 + Math.log(1 + c));
  }
  const aFromP = (P_s, M_g) => Math.cbrt(GG * M_g * P_s * P_s / (4 * Math.PI * Math.PI));
  const pFromA = (a_cm, M_g) => 2 * Math.PI * Math.sqrt(a_cm * a_cm * a_cm / (GG * M_g));

  /* The true orbital period of the frame being drawn, in hours. Both the
     animation clock and the plate read from this, so the motion on screen
     and the number beside it can never disagree. */
  function pNowH(f, m) {
    const Mtot = m.channel === 'stable' ? f.Mp + f.Ms
                                        : (f.core < 0.02 ? m.M1 : m.Mc) + m.M2;
    return pFromA(f.a * Rsun, Mtot * Msun) / 3600;
  }
  const ORB_CAP = 18;                    // fastest drawn orbit, in units of P₀

  /* ---- Roche geometry, cached per mass ratio ----
     Accretor at the origin, donor at x = 1, G = a = M = 1. L₁ from the
     stationary point of Φ on the axis; the lobe outline is bisected onto
     Φ = Φ(L₁) along 96 rays; the stream is RK4 in the rotating frame. */
  const rocheCache = new Map();
  function roche(q) {                                // q = M_donor / M_accretor
    const key = q.toFixed(3);
    if (rocheCache.has(key)) return rocheCache.get(key);
    const m1 = 1 / (1 + q), m2 = q / (1 + q), xcm = m2;
    const phi = (x, y) => {
      const r1 = Math.hypot(x, y) || 1e-9, r2 = Math.hypot(x - 1, y) || 1e-9;
      return -m1 / r1 - m2 / r2 - 0.5 * ((x - xcm) * (x - xcm) + y * y);
    };
    const dphi = x => m1 / (x * x) - m2 / ((1 - x) * (1 - x)) - (x - xcm);
    let lo = 1e-3, hi = 1 - 1e-3;
    for (let k = 0; k < 90; k++) { const m = (lo + hi) / 2; dphi(m) > 0 ? (lo = m) : (hi = m); }
    const xL1 = (lo + hi) / 2, phiL1 = phi(xL1, 0);

    /* The lobe's equatorial (z = 0) outline: a single smooth teardrop that
       the scene later foreshortens with its own inclination squash, the same
       way the orbits and the disk are drawn. Because L₁ has y = 0, the nose
       of this section lands exactly on the first point of the ballistic
       stream — at every orbital phase, for free. */
    const trace = (ox, oy, rmax) => {
      const N = 96, pts = [];
      let seen = 0;
      for (let i = 0; i < N; i++) {
        const th = i / N * 2 * Math.PI, cx = Math.cos(th), cy = Math.sin(th);
        let a = 1e-4, b = rmax;
        /* a ray whose innermost sample is already outside would otherwise
           bisect its way to rmax and spike the outline */
        if (phi(ox + a * cx, oy + a * cy) >= phiL1) { pts.push([ox, oy]); continue; }
        for (let k = 0; k < 36; k++) {
          const m = (a + b) / 2;
          /* inside the lobe Φ < Φ(L1); push the lower bound outward */
          (phi(ox + m * cx, oy + m * cy) < phiL1) ? (a = m) : (b = m);
        }
        const r = (a + b) / 2;
        if (r > seen) seen = r;
        pts.push([ox + r * cx, oy + r * cy]);
      }
      return seen > 1e-3 ? [{ z: 0, pts }] : [{ z: 0, pts: [[ox, oy]] }];
    };
    const lobeD = trace(1, 0, (1 - xL1) * 0.9996);   // donor's lobe
    const lobeA = trace(0, 0, xL1 * 0.9996);         // accretor's lobe

    /* Ballistic stream out of L₁, co-rotating frame, COM at the origin.
       The integration stops at the first pericenter passage: past that
       point a real stream has already struck the disk edge — or itself —
       and circularised. Integrating further only winds the curve into a
       tangle that corresponds to nothing physical. */
    const X1 = -xcm, X2 = 1 - xcm;
    const deriv = s => {
      const dx1 = s[0] - X1, dx2 = s[0] - X2, y = s[1];
      const r1 = Math.pow(dx1 * dx1 + y * y, 1.5) || 1e-9;
      const r2 = Math.pow(dx2 * dx2 + y * y, 1.5) || 1e-9;
      return [s[2], s[3],
              2 * s[3] + s[0] - m1 * dx1 / r1 - m2 * dx2 / r2,
              -2 * s[2] + s[1] - m1 * s[1] / r1 - m2 * s[1] / r2];
    };
    let st = [xL1 - xcm, 0, -0.020, 0];
    const h = 0.0016, stream = [];
    let prevR = 1, fell = false, rmin = 1, jm = 0;
    for (let n = 0; n < 5200; n++) {
      const k1 = deriv(st);
      const s2 = st.map((v, i) => v + h / 2 * k1[i]), k2 = deriv(s2);
      const s3 = st.map((v, i) => v + h / 2 * k2[i]), k3 = deriv(s3);
      const s4 = st.map((v, i) => v + h * k3[i]),     k4 = deriv(s4);
      st = st.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      const x = st[0] + xcm, y = st[1];
      if (!isFinite(x) || Math.hypot(x, y) > 1.5) break;
      const r = Math.hypot(x, y);
      if (n % 4 === 0) stream.push([x, y]);
      /* record the angular momentum about the accretor at closest approach:
         that is what sets the ring the gas can actually settle into */
      if (r < rmin) { rmin = r; jm = x * (st[3] + x) - y * (st[2] - y); }
      if (r < prevR - 1e-6) fell = true;
      else if (fell && n > 60 && r < 0.6) { stream.push([x, y]); break; }
      prevR = r;
      if (r < 0.012) break;
    }
    /* The radius the stream's angular momentum makes it settle into —
       where a ring, and then a disk, forms. Taken from the integrator's
       own j at pericenter rather than from a fitted law: the usual CV fit
       (0.0859 q^−0.426, Lubow & Shu 1975) is calibrated for q ≤ 1 and runs
       43% low at the q ≈ 11 of the progenitor's first contact. Note j is
       measured in the accretor's own non-rotating frame — the accretor
       sits at X₁ = −x_cm and the frame spins at Ω = +ẑ, so its orbital
       motion has to be added back before taking the moment. */
    const rcirc = (1 + q) * jm * jm;                  // j²/(G·M_acc), G = a = M = 1
    const R = { q, xL1, lobeD, lobeA, stream, rmin, rcirc, rLD: fRL(q), rLA: fRL(1 / q) };
    rocheCache.set(key, R);
    if (rocheCache.size > 60) rocheCache.clear();
    return R;
  }

  /* Log-log interpolation down a lifetime table. Off the ends it
     *extrapolates* along the nearest segment rather than clamping: a
     clamped table silently flattens, and a flat table cannot be inverted. */
  function interpLL(MM, TT, M) {
    const n = MM.length;
    let i = 0;
    if (M <= MM[0]) i = 0;
    else if (M >= MM[n - 1]) i = n - 2;
    else while (i < n - 2 && M > MM[i + 1]) i++;
    const f = (Math.log(M) - Math.log(MM[i])) / (Math.log(MM[i + 1]) - Math.log(MM[i]));
    return Math.exp(Math.log(TT[i]) + f * (Math.log(TT[i + 1]) - Math.log(TT[i])));
  }

  /* Time to the thermally-pulsing AGB — this is what sets when Case-C
     overflow happens, and it is the clock the common envelope runs on. */
  const TAU_M = [3, 4, 5, 6, 7, 8], TAU_T = [390, 190, 118, 82, 62, 48];
  const tauNuc = M => interpLL(TAU_M, TAU_T, FK.clamp(M, 3, 8));

  /* Main-sequence lifetime — a *different* quantity, 20–30% shorter for
     intermediate masses, and the one that sets a cluster's turnoff. Using
     the AGB table for the turnoff put a 10-Gyr globular's 0.9 M⊙ on a
     400-Myr cluster's plate. Z ≈ 0.0098 tracks. */
  const MS_M = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];
  const MS_T = [7400, 2100, 950, 550, 320, 155, 93, 62, 45, 35];
  const tMS = M => interpLL(MS_M, MS_T, M);
  /* Cummings et al. (2018) initial–final mass relation */
  const coreMass = M => FK.clamp(0.0873 * M + 0.476, 0.5, 1.4);
  const rMS = M => Math.pow(M, 0.6);
  /* Nauenberg (1972) zero-temperature mass–radius relation: a 1 M⊙ white
     dwarf is 0.008 R⊙, which is why it is a point in every panel below */
  const rWD = M => {
    const x = FK.clamp(M / 1.44, 0.02, 0.998);
    return 0.0114 * Math.sqrt(Math.pow(x, -2 / 3) - Math.pow(x, 2 / 3));
  };

  /* Rappaport–Verbunt–Joss braking (γ = 4) reduced to ȧ, plus the GR
     quadrupole. Masses constant: the binary is detached until contact. */
  function adot(a_rsun, Mwd, Md, Rd) {
    const a = a_rsun * Rsun, Mt = (Mwd + Md) * Msun;
    const m1 = Mwd * Msun, m2 = Md * Msun, r2 = Rd * Rsun;
    const mb = 7.6e-30 * Math.pow(r2, 4) * GG * Mt * Mt / (m1 * Math.pow(a, 4));
    const gr = (64 / 5) * Math.pow(GG, 3) * m1 * m2 * Mt / (Math.pow(CL, 5) * Math.pow(a, 3));
    return mb + gr;                                  // cm/s
  }

  /* ================================================================
     WHICH CHANNEL THE FIRST MASS TRANSFER TAKES

     The donor's adiabatic mass–radius exponent ζ_ad says how it reacts to
     losing mass; the lobe's exponent ζ_L says how fast the lobe shrinks
     around it. Transfer runs away — and a common envelope forms — when the
     lobe outruns the star, ζ_L > ζ_ad. For conservative transfer

        ζ_L = 2(q − 1) + (1 + q)·dln f_RL/dln q ,   q = M_donor/M_accretor

     A giant with a deep convective envelope *expands* as it loses mass
     (ζ_ad ≈ −1/3), so almost nothing is stable: q_crit ≈ 0.7, and Case C
     onto a low-mass companion is violently unstable. A donor still carrying
     a radiative envelope contracts instead and stays stable out to q ≈ 2–3.
     That second branch never makes a common envelope at all: it reverses
     the mass ratio and builds a blue straggler.
     ================================================================ */
  function zetaL(q) {
    const d = 1e-4;
    const dlnf = (Math.log(fRL(q * (1 + d))) - Math.log(fRL(q * (1 - d)))) / (2 * d);
    return 2 * (q - 1) + (1 + q) * dlnf;
  }
  function qCrit(zad) {
    let lo = 0.05, hi = 60;
    if (zetaL(lo) > zad) return lo;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (zetaL(m) < zad) ? (lo = m) : (hi = m); }
    return (lo + hi) / 2;
  }
  /* Hjellming & Webbink (1987), condensed polytropes: a giant with a core
     does not respond like a full n = 3/2 polytrope. The familiar ζ_ad = −1/3
     is only the coreless limit — this reduces to exactly that at m_c = 0 and
     stiffens as the core grows, which is why q_crit for a real AGB donor is
     ≈ 0.75 rather than 0.63. */
  function zetaAd(mf) {
    const f = FK.clamp(mf, 0, 0.85);
    return (2 / 3) * f / (1 - f) - (1 / 3) * (1 - f) / (1 + 2 * f) -
           0.03 * f + 0.2 * f / (1 + Math.pow(1 - f, -6));
  }

  /* where the primary first fills its lobe, and what its envelope is doing */
  const CASES = [
    { key: 'C', name: 'Case C · AGB',             conv: true,  zad: -1 / 3, fcore: null },
    { key: 'B', name: 'Case B · Hertzsprung gap', conv: false, zad: 2.6,    fcore: 0.17 },
    { key: 'A', name: 'Case A · main sequence',   conv: false, zad: 4.0,    fcore: 0.10 }
  ];
  const caseR1 = (cs, M1) => cs.key === 'C' ? R1_AGB : cs.key === 'B' ? 40 : rMS(M1) * 1.35;
  const caseCore = (cs, M1) => cs.fcore == null ? coreMass(M1) : FK.clamp(cs.fcore * M1, 0.15, 1.4);
  /* Turnoff mass at a given cluster age, by inverting the main-sequence
     lifetime. NaN rather than a bracket edge if the age is off the table:
     a wrong number printed confidently is worse than an em dash. */
  function mTurnoff(t) {
    let lo = 0.8, hi = 10;
    if ((tMS(lo) - t) * (tMS(hi) - t) > 0) return NaN;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (tMS(m) > t) ? (lo = m) : (hi = m); }
    return (lo + hi) / 2;
  }
  const mtTxt = m => isFinite(m) ? m.toFixed(2) + ' M⊙' : '—';

  const solveCache = new Map();
  function solve(alpha, lam, M1, tcl, m2, ci) {
    m2 = m2 == null ? M2 : m2; ci = ci == null ? 0 : ci;
    const key = [alpha, lam, M1, tcl, m2, ci].map(v => (+v).toFixed(3)).join('|');
    if (solveCache.has(key)) return solveCache.get(key);

    const cs = CASES[ci];
    const R1 = caseR1(cs, M1);
    const Mc = caseCore(cs, M1), Menv = M1 - Mc;
    const Mt = (Mc + m2) * Msun;
    const tau = tauNuc(M1);

    const ai = R1 / fRL(M1 / m2);                    // donor fills its lobe
    const P0 = pFromA(ai * Rsun, (M1 + m2) * Msun);

    /* the branch. A convective donor's adiabatic response depends on how
       much of it is core, so ζ_ad is evaluated rather than assumed. */
    const zad = cs.conv ? zetaAd(Mc / M1) : cs.zad;
    const q0 = M1 / m2, qc = qCrit(zad);
    const stable = q0 < qc;

    /* ---------- channel 2: stable, conservative transfer → blue straggler ---------- */
    if (stable) {
      const M1f = Mc, M2f = m2 + Menv;               // conservative: nothing leaves
      /* a ∝ (M₁M₂)⁻² at fixed J, so the orbit shrinks until q = 1 and then
         widens — the classic V, with its minimum at the mass-ratio reversal */
      const aOf = d => ai * Math.pow(M1 * m2 / ((M1 - d) * (m2 + d)), 2);
      const afS = aOf(Menv);
      const dRev = FK.clamp((M1 - m2) / 2, 0, Menv); // Δ at which q = 1
      const mto = mTurnoff(tcl);
      const tLive = tauNuc(M2f);                     // rejuvenated straggler's clock
      const dead = tau + tLive < tcl;
      const verdict = M2f <= mto ? 'nobss' : (dead ? 'bssdead' : 'bss');

      /* track: flat, a fast V at the transfer, then flat again */
      const trk = [];
      const DT = 1.6;                                // Myr of screen time for a thermal event
      for (let i = 0; i <= 24; i++) {
        const d = Menv * i / 24;
        trk.push([tau + DT * i / 24,
                  Math.log10(pFromA(aOf(d) * Rsun, (M1 + m2) * Msun) / 3600)]);
      }
      const mS = {
        alpha, lam, M1, tcl, M2: m2, cs, ci, channel: 'stable', stable,
        q0, qc, zad, zl: zetaL(q0), R1, Mc, Menv, ai, af: afS, aOf, dRev,
        M1f, M2f, mto, tLive, P0h: P0 / 3600,
        PfS: pFromA(afS * Rsun, (M1f + M2f) * Msun) / 3600,
        merged: false, PfTight: 0, tau, tDecay: 0, budget: tcl - tau, verdict,
        aNow: afS, tEnd: tau + DT, trk,
        aCon: afS, Rd: rMS(m2), Pce: 0
      };
      solveCache.set(key, mS);
      if (solveCache.size > 400) solveCache.clear();
      return mS;
    }

    /* ---------- channel 1: unstable → common envelope ---------- */
    /* contact is anchored on the measured period, so the model has to
       land on the observation rather than being told where to stop */
    const aCon = aFromP(P_OBS_S, Mt) / Rsun;
    /* Two radii for the companion, and they are not interchangeable.
       R2det is what the star actually is while the pair is detached — a
       near-ZAMS low-mass dwarf; Rd is the lobe it will fill at contact,
       which is a *prediction* and must not be fed back into the integral
       that produces it. Since |ȧ| from magnetic braking goes as R₂⁴, using
       the lobe radius here overestimated the braking by a factor 2.5. */
    const R2det = 0.89 * Math.pow(m2, 0.89);
    const Rd = fRL(m2 / Mc) * aCon;

    const A = M1 * Menv / (lam * R1), B = M1 * m2 / (2 * ai);
    const af = Mc * m2 / (2 * (A / Math.max(1e-4, alpha) + B));
    /* The merger criterion is coalescence — the companion filling its own
       lobe inside the envelope, or simply touching the core — which is the
       test the figure's own caption prints. "Tighter than the CV we see" is
       a different statement with a different root, and using it mislabelled
       a band of α that survives and merely lands short of 6.30 h. */
    const aMerge = Math.max(R2det / fRL(m2 / Mc), rWD(Mc) + R2det);
    const merged = af < aMerge;
    const Pce = merged ? 0 : pFromA(af * Rsun, Mt) / 3600;

    const trk = [];
    let tDecay = Infinity;
    if (!merged) {
      const N = 90, da = (af - aCon) / N;             // R⊙ per step
      let t = 0;
      trk.push([tau, Math.log10(Pce)]);
      let prev = 1 / adot(af, Mc, m2, R2det);         // s/cm
      for (let i = 1; i <= N; i++) {
        const a = af - da * i, cur = 1 / adot(a, Mc, m2, R2det);
        t += 0.5 * (prev + cur) * da * Rsun;          // seconds
        prev = cur;
        trk.push([tau + t / MYR, Math.log10(pFromA(a * Rsun, Mt) / 3600)]);
      }
      tDecay = t / MYR;
    }

    const budget = tcl - tau;
    let verdict = 'cv';
    if (tau > tcl) verdict = 'slow';
    else if (merged) verdict = 'merge';
    /* it survived the envelope but the orbit was left tighter than the one
       we measure: a real close binary, just not this one */
    else if (af < aCon) verdict = 'tight';
    else if (tDecay > budget) verdict = 'wide';

    let aNow = af, tEnd = tau + tDecay;
    if (verdict === 'wide') {
      /* it is still shrinking when we look at it — interpolate the track
         to the cluster age rather than snapping to a grid point */
      tEnd = tcl;
      const N = trk.length - 1;
      for (let i = 1; i < trk.length; i++) {
        if (trk[i][0] >= tcl) {
          const t0 = trk[i - 1][0], t1 = trk[i][0];
          const w = t1 > t0 ? FK.clamp((tcl - t0) / (t1 - t0), 0, 1) : 0;
          aNow = af - (af - aCon) * (i - 1 + w) / N;
          break;
        }
        aNow = aCon;
      }
    } else if (verdict === 'cv') aNow = aCon;
    /* a merger has no decay phase to time, and a progenitor that is still
       burning hydrogen has no post-CE clock either — in both cases the
       only remaining milestone is the moment we observe the cluster */
    if (verdict === 'merge' || !isFinite(tEnd)) tEnd = tcl;

    const m = {
      alpha, lam, M1, tcl, M2: m2, cs, ci, channel: 'ce', stable,
      q0, qc, zad, zl: zetaL(q0), R1,
      Mc, Menv, ai, af, aCon, aMerge, Rd, R2det, P0h: P0 / 3600, Pce,
      /* the period it would reach at contact if it is tighter than 6.30 h */
      PfTight: P_OBS_H * Math.pow(Math.min(af, aCon) / aCon, 1.5),
      merged, tau, tDecay, budget, verdict, aNow, tEnd, trk
    };
    solveCache.set(key, m);
    if (solveCache.size > 400) solveCache.clear();
    return m;
  }

  /* the α band that both survives the spiral-in and makes it to 6.30 h.
     Only defined on the common-envelope channel — the stable branch never
     forms one, so there is no α to constrain. */
  function window_(lam, M1, tcl, m2, ci) {
    const cs = CASES[ci];
    const R1 = caseR1(cs, M1);
    const Mc = caseCore(cs, M1), Menv = M1 - Mc;
    if (M1 / m2 < qCrit(cs.conv ? zetaAd(Mc / M1) : cs.zad)) return null;
    const aCon = aFromP(P_OBS_S, (Mc + m2) * Msun) / Rsun;
    const ai = R1 / fRL(M1 / m2);
    const R2det = 0.89 * Math.pow(m2, 0.89);
    const aMerge = Math.max(R2det / fRL(m2 / Mc), rWD(Mc) + R2det);
    const A = M1 * Menv / (lam * R1), B = M1 * m2 / (2 * ai);
    /* invert the α equation for the α that lands a_f on a given separation */
    const alphaFor = aa => A / Math.max(1e-9, Mc * m2 / (2 * aa) - B);
    const lo = alphaFor(aCon), merge = alphaFor(aMerge);
    if (!(lo > 0) || tcl <= tauNuc(M1)) return null;
    let a = lo, b = 6;
    if (solve(b, lam, M1, tcl, m2, ci).verdict !== 'wide') return { lo, hi: b, merge, open: true };
    for (let i = 0; i < 44; i++) {
      const m = (a + b) / 2;
      (solve(m, lam, M1, tcl, m2, ci).verdict === 'wide') ? (b = m) : (a = m);
    }
    return { lo, hi: (a + b) / 2, merge };
  }

  /* ================= story time =================
     Eleven beats, because the accretion story has that many distinct
     states. The three that were missing are the ones that make it a
     *story* rather than a slideshow: `flood`, where the thread of gas
     becomes a tongue and then an envelope; `contact2`, where the M dwarf
     touches its lobe again after ~100 Myr of silence and the dwarf nova
     is born; and `build`, where the ring at R_circ shears itself into a
     disk. Nothing is keyed to a bare number below — sAt() names the beat,
     so the ramps and the beats can never drift apart. */
  const PH = [
    ['zams',     0.000, 0.070], ['agb',      0.070, 0.185],
    ['rlof',     0.185, 0.260], ['flood',    0.260, 0.340],
    ['plunge',   0.340, 0.430], ['spiral',   0.430, 0.545],
    ['exit',     0.545, 0.660], ['decay',    0.660, 0.780],
    ['contact2', 0.780, 0.840], ['build',    0.840, 0.925],
    ['now',      0.925, 1.000]
  ];
  const PHI = {}; PH.forEach(p => { PHI[p[0]] = p; });
  /* the scrub position a fraction u through a named beat */
  const sAt = (key, u) => { const p = PHI[key]; return p[1] + (p[2] - p[1]) * u; };
  function stage(s) {
    for (const p of PH) if (s < p[2]) return { key: p[0], u: FK.clamp((s - p[1]) / (p[2] - p[1]), 0, 1) };
    return { key: 'now', u: 1 };
  }

  /* ---- what actually happens across the CE, as continuous functions ----
     A phase switch that flips the envelope on, deletes the giant and swaps
     the orbital masses all in one frame is not what the physics does. The
     envelope grows out of the giant as transfer runs away; the giant is not
     removed but *becomes* that envelope; and the orbit hands over from the
     whole star to the bare core only as the envelope is unbound. All three
     are therefore ramps, not steps — and the envelope's ramp begins at the
     END of the flood, so the envelope reads as the flood's consequence. */
  const envAt   = x => FK.smooth(sAt('flood', 0.85), sAt('plunge', 0.35), x) *
                       (1 - FK.smooth(sAt('exit', 0.10), sAt('exit', 0.85), x));
  const coreAt  = x => FK.smooth(sAt('plunge', 0.30), sAt('spiral', 0.70), x);
  const giantAt = x => 1 - FK.smooth(sAt('flood', 0.55), sAt('plunge', 0.45), x);

  /* Beat groups. Every downstream test asks about a group, never about a
     list of names — otherwise adding a beat means remembering nine places. */
  const IS = {
    inCE:  { plunge: 1, spiral: 1 },                    // inside the envelope
    post:  { decay: 1, contact2: 1, build: 1, now: 1 },  // the envelope is gone
    close: { contact2: 1, build: 1, now: 1 },            // the CV, assembling or assembled
    flow:  { rlof: 1, flood: 1 }                         // first mass transfer
  };

  function frame(s, m) {
    const st = stage(s);
    const RL = m.R1;                                // radius at first contact
    let t = 0, a = m.ai, R1 = rMS(m.M1), spiral = 0;
    /* How far the primary reddens depends on how far it actually gets before
       the lobe stops it: a star that fills its lobe on the main sequence
       (Case A) never becomes a red giant, and should not be drawn as one. */
    const MIXMAX = { C: 1, B: 0.62, A: 0.16 }[m.cs.key];
    let mix = MIXMAX;       // 0 = hot B-type main sequence, 1 = cool AGB giant
    let hot = 0;            // the freshly exposed core, before it cools
    /* overflow depth: 1.00 exactly at first contact, then deeper as the
       runaway drives the photosphere out toward the outer critical surface */
    let over = 1;
    const target = m.merged ? m.aCon * 0.04 : m.af;
    const LN = Math.log(Math.max(target, 1e-6) / m.ai);
    /* the plunge takes the first 70% of ln(a_f/a_i); the rest is the slower,
       self-regulated spiral. Eased at both ends of each beat, so a and its
       rate are both continuous across the seam. */
    const aOfSpiral = sp => m.ai * Math.exp(LN * sp);
    switch (st.key) {
      case 'zams': t = m.tau * 0.86 * st.u; mix = 0; break;
      case 'agb':
        t = m.tau * (0.86 + 0.14 * st.u);
        R1 = rMS(m.M1) * Math.pow(RL / rMS(m.M1), FK.smooth(0, 1, st.u));
        mix = MIXMAX * FK.smooth(0, 0.8, st.u);
        break;
      case 'rlof': t = m.tau; R1 = RL; break;
      case 'flood':
        t = m.tau;
        over = 1 + 0.30 * FK.smooth(0, 1, st.u);
        R1 = RL * over;
        break;
      case 'plunge':
        t = m.tau; over = 1.30; R1 = RL * over;
        spiral = 0.70 * FK.smooth(0, 1, st.u);
        a = aOfSpiral(spiral);
        break;
      case 'spiral':
        t = m.tau; over = 1.30; R1 = RL * over;
        spiral = 0.70 + 0.30 * FK.smooth(0, 1, st.u);
        a = aOfSpiral(spiral);
        break;
      case 'exit':
        t = m.tau; R1 = RL; spiral = 1; a = target;
        hot = 1;
        break;
      case 'decay':
        t = m.tau + (m.tEnd - m.tau) * st.u;
        a = m.merged ? target : m.af + (m.aNow - m.af) * st.u;
        spiral = 1;
        hot = Math.max(0, 1 - st.u * 3);
        break;
      case 'contact2':
        /* the model's own prediction: this is the moment it says the donor
           touches its lobe again, and the clock reads m.tEnd */
        t = m.tEnd; a = m.merged ? target : m.aNow; spiral = 1;
        break;
      default:                                        // build, now
        t = m.tEnd + (Math.max(m.tcl, m.tEnd) - m.tEnd) *
            (st.key === 'build' ? 0.45 * st.u : 0.45 + 0.55 * st.u);
        a = m.merged ? target : m.aNow;
        spiral = 1;
    }
    const f = { key: st.key, u: st.u, t, a, R1, spiral, mix, hot, over,
                env: envAt(s), core: coreAt(s), giant: giantAt(s), Rcore: rWD(m.Mc),
                Mp: m.M1, Ms: m.M2, Rsec: m.Rd };
    /* How much of the envelope's binding energy the shrinking orbit has
       actually paid off — the left side of the α equation over its right
       side, so it reaches 1 exactly at a = a_f, by the definition of a_f.
       The envelope clears against THIS, not against a scrub timer, which is
       why a merger now keeps the envelope it never managed to unbind. */
    f.paid = m.channel === 'stable' ? 0 : FK.clamp(
      m.alpha * (m.Mc * m.M2 / (2 * f.a) - m.M1 * m.M2 / (2 * m.ai)) /
      Math.max(1e-9, m.M1 * m.Menv / (m.lam * m.R1)), 0, 1);

    if (m.channel === 'stable') {
      /* Nothing is engulfed on this branch, so there is no envelope and no
         spiral-in. Instead the donor is peeled down to its core while the
         accretor swallows what it loses, and the orbit follows the V. The
         transfer occupies the beats the common envelope would have. */
      const s0 = sAt('plunge', 0), s1 = sAt('spiral', 1);
      const prog = FK.clamp((s - s0) / (s1 - s0), 0, 1);   // the transfer itself
      const d = m.Menv * FK.smooth(0, 1, prog);
      f.env = 0; f.giant = 1; f.core = 0; f.over = 1;
      f.Mp = m.M1 - d; f.Ms = m.M2 + d;
      f.xfer = prog;
      f.Rsec = rMS(f.Ms);
      if (s >= s0) {
        f.a = m.aOf(d);
        /* the donor stays exactly lobe-filling while it is being stripped,
           then shrinks to the hot, stripped helium core it leaves behind */
        const shrink = FK.smooth(sAt('exit', 0.10), sAt('exit', 0.70), s);
        const Rlobe = fRL(f.Mp / f.Ms) * f.a;
        f.R1 = Rlobe * (1 - shrink) + rWD(m.Mc) * 2.2 * shrink;
        f.hot = FK.smooth(sAt('exit', 0.05), sAt('exit', 0.65), s) *
                (1 - FK.smooth(sAt('build', 0.2), sAt('now', 0.8), s) * 0.55);
        f.mix = MIXMAX * (1 - FK.smooth(sAt('exit', 0.05), sAt('exit', 0.95), s));
        const sx = sAt('exit', 0);
        f.t = s >= sx ? m.tau + (Math.max(m.tcl, m.tau) - m.tau) * FK.clamp((s - sx) / (1 - sx), 0, 1)
                      : m.tau;
      }
    }
    return f;
  }

  /* ================= state ================= */
  let s = 0, speed = +(inp.speed && inp.speed.value || 1), orb = 0, spin = 0, dn = 0;
  let timeSquash = 1;      // how much slower than Kepler the drawn orbit runs
  let ageIdx = Math.max(0, AGES.indexOf(400)), caseIdx = 0;
  let W = 0, H = 0, TW = 0, TH = 0, tAx = null, hover = null;

  const cur = () => solve(+(inp.alpha ? inp.alpha.value : 0.3),
                          +(inp.lam ? inp.lam.value : 2.5),
                          +(inp.m1 ? inp.m1.value : 6),
                          AGES[ageIdx],
                          +(inp.m2 ? inp.m2.value : M2),
                          caseIdx);

  /* ================================================================
     SCENE

     One geometry, projected once. Plane coordinates are pixels in the
     orbital plane; S() drops them onto the canvas with the viewing
     squash. Anything that lives in the plane — orbits, lobes, stream,
     disk — goes through it; stars are spheres and stay circular.
     ================================================================ */
  const SQ = 0.36;                                    // cos i — i = 68.9°
  const RGB_B    = [204, 219, 246];                   // ~6 M⊙ B-type primary
  const RGB_AGB  = [236, 146, 92];                    // AGB giant
  const RGB_CORE = [246, 250, 255];                   // core just stripped, ~10⁵ K
  const ENV = '182,126,80';

  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function geom() {
    /* the orbit is squashed to 0.36 vertically, so the plate can afford a
       much wider separation than its height would suggest */
    return { cx: W * 0.485, cy: H * 0.515, R0: Math.min(W * 0.40, H * 0.70) };
  }

  /* a faint, fixed star field — the wide phases are mostly empty space,
     and empty space should look like space rather than like a blank plate */
  function starfield() {
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 3 + 1) * W, y = hash(i * 3 + 2) * H;
      const b = hash(i * 3 + 3);
      ctx.fillStyle = 'rgba(232,224,206,' + (0.05 + 0.16 * b * b).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, 0.4 + 0.9 * b * b, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  const S = (g, p) => [g.cx + p[0], g.cy + p[1] * SQ];

  /* A 250-fold spiral-in cannot be drawn linearly and stay legible at
     both ends. Before and during the CE the separation is compressed as
     a^0.18 so the inspiral is visible; afterwards the view zooms in on
     the survivor, and the zoom factor is stated on the plate. */
  function viewScale(f, m, g) {
    const raw = g.R0 * Math.pow(Math.max(f.a, 1e-3) / m.ai, 0.18);
    let k = 1;
    if (f.key === 'exit') k = 1 + 1.05 * FK.smooth(0, 1, f.u);
    else if (IS.post[f.key]) k = 2.05;
    return { sep: raw * k, zoom: k };
  }

  /* a frame anchored on `o`, with X toward `to` and Y 90° counter-clockwise;
     X and Y are in units of the separation */
  function localFrame(o, to) {
    const ex = to[0] - o[0], ey = to[1] - o[1], L = Math.hypot(ex, ey) || 1;
    const e = [ex / L, ey / L], n = [-e[1], e[0]];
    return (X, Y) => [o[0] + (X * e[0] + Y * n[0]) * L, o[1] + (X * e[1] + Y * n[1]) * L];
  }

  /* `sq` defaults to the orbital-plane projection cos i, which is right for
     anything that genuinely lies in the plane — orbits, the disk, the stream.
     A *star* is not one of those: it is a three-dimensional body, and its
     silhouette is only flattened by however much the body itself is flatter
     along the orbital pole than across it. Callers drawing a star pass their
     own value (see tidalShape). */
  function planePoly(g, pts, proj, sq) {
    sq = sq == null ? SQ : sq;
    const p = new Path2D();
    pts.forEach((q, i) => {
      const w = proj(q[0], q[1]);
      const x = g.cx + w[0], y = g.cy + w[1] * sq;
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    });
    p.closePath();
    return p;
  }

  /* ================================================================
     TIDAL FIGURE OF THE DONOR

     A star's surface is an equipotential of the Roche potential, and it
     coincides with the *lobe* only when the star actually fills it. Trace
     the equipotential whose nose reaches a fraction `fill` of the way from
     the star to L₁: at fill → 0 that is a sphere, at fill = 1 it is the
     lobe, and every value between is the tidally distorted figure the star
     really has. This replaces a hard switch at fill = 0.985 that turned a
     sphere into a teardrop in one frame.

     It also returns the squash to draw it with. The silhouette of a body
     with in-plane and polar semi-axes k_y, k_z (relative to the axis toward
     L₁) seen at inclination i has vertical extent √((k_y cos i)² + (k_z sin i)²),
     and since the traced outline already carries k_y, the factor left to
     apply is that over k_y. For a sphere it is exactly 1 at any inclination
     — which is the point: spheres do not look like pancakes.
     ================================================================ */
  const tidalCache = new Map();
  function tidalShape(q, fill) {
    const f = FK.clamp(fill, 0, 1);
    const key = q.toFixed(2) + '|' + (Math.round(f * 40) / 40).toFixed(3);
    if (tidalCache.has(key)) return tidalCache.get(key);

    const m1 = 1 / (1 + q), m2 = q / (1 + q), xcm = m2;
    const phi = (x, y) => {
      const r1 = Math.hypot(x, y) || 1e-9, r2 = Math.hypot(x - 1, y) || 1e-9;
      return -m1 / r1 - m2 / r2 - 0.5 * ((x - xcm) * (x - xcm) + y * y);
    };
    const dphi = x => m1 / (x * x) - m2 / ((1 - x) * (1 - x)) - (x - xcm);
    let lo = 1e-3, hi = 1 - 1e-3;
    for (let k = 0; k < 80; k++) { const mm = (lo + hi) / 2; dphi(mm) > 0 ? (lo = mm) : (hi = mm); }
    const dL1 = 1 - (lo + hi) / 2;

    const nose = Math.max(2e-3, f) * dL1;
    const phiT = phi(1 - nose, 0);                   // L₁ lies at −x from the donor
    const N = 72, pts = [];
    let sum = 0, aX = nose, aY = nose;
    for (let i = 0; i < N; i++) {
      const th = i / N * 2 * Math.PI, cx = Math.cos(th), cy = Math.sin(th);
      let a = 1e-6, b = dL1 * 0.99995;
      for (let k = 0; k < 34; k++) {
        const mm = (a + b) / 2;
        (phi(1 + mm * cx, mm * cy) < phiT) ? (a = mm) : (b = mm);
      }
      const r = (a + b) / 2;
      sum += r;
      if (i === N / 2) aX = r;                       // toward L₁
      if (i === N / 4) aY = r;                       // across the line of centres
      pts.push([1 + r * cx, r * cy]);
    }
    const kY = FK.clamp(aY / Math.max(aX, 1e-9), 0.4, 1);
    const kZ = 1 - (1 - kY) * 0.93;                  // the pole flattens slightly less than y
    const sinI = Math.sqrt(Math.max(0, 1 - SQ * SQ));
    const sq = Math.sqrt(Math.pow(kY * SQ, 2) + Math.pow(kZ * sinI, 2)) / Math.max(kY, 1e-9);

    const out = { pts, rMean: sum / N, kY, sq, nose };
    tidalCache.set(key, out);
    if (tidalCache.size > 500) tidalCache.clear();
    return out;
  }

  /* ---- the giant, drawn as the actual lobe it is filling ----
     fill ∈ [0,1]: 0 = a sphere of radius r, 1 = the Roche lobe itself.
     irr < 0: the L₁ nose is gravity-darkened — lower g means a cooler
     photosphere there. irr > 0: the nose is *heated* instead, the classic
     irradiated face a CV donor shows its white dwarf. */
  function drawGiant(g, c, r, fill, R, proj, rgb, irr, sep) {
    /* The figure is traced at the star's *actual* fill factor, so it grows
       continuously from a sphere into the teardrop instead of switching. Only
       an all-but-undistorted star short-circuits to a plain disc, and there
       the two draw the same thing anyway. */
    const T = tidalShape(R.q, fill);
    if (fill < 0.22 || !(sep > 0)) {
      FK.disc(ctx, c[0], c[1], r, rgb, { u: 0.74, core: 1, bloom: 1.45 });
      return;
    }
    /* Scale the traced figure so its mean radius matches the radius the
       physics gives, then hand the last few per cent back to the true lobe so
       that a star which really does fill its lobe still puts its nose on L₁
       — and therefore on the first point of the stream. */
    const want = r / sep;
    const blend = FK.smooth(0.90, 1.0, fill);
    const k = (1 - blend) * (want / Math.max(T.rMean, 1e-9)) + blend;
    const pts = T.pts.map(p => [1 + (p[0] - 1) * k, p[1] * k]);
    const path = planePoly(g, pts, proj, T.sq);
    /* the bright point of a lobe-filling star is not its centroid — nudge
       the shading centre along the line of centres, toward the accretor */
    const wc = proj(1, 0), wa = proj(0, 0);
    const cxs = c[0] + (wa[0] - wc[0]) * 0.06, cys = c[1] + (wa[1] - wc[1]) * T.sq * 0.06;
    /* the gradient must reach the L₁ nose, which sticks out past the
       volume-equivalent radius — measured on the drawn outline so the limb
       really does reach μ = 0 at the tip rather than clipping to a black wedge */
    let far = r;
    pts.forEach(p => {
      const w = proj(p[0], p[1]);
      const d = Math.hypot(g.cx + w[0] - cxs, g.cy + w[1] * T.sq - cys);
      if (d > far) far = d;
    });
    FK.discPath(ctx, path, cxs, cys, far * 1.02, rgb, { u: 0.74, core: 1 });
    if (irr) {
      const wn = proj(R.xL1, 0);                     // L₁ sits at (xL1, 0, 0)
      const nx = g.cx + wn[0], ny = g.cy + wn[1] * T.sq;
      const nr = Math.max(6, r * 0.8);
      ctx.save();
      ctx.clip(path);
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      if (irr > 0) {
        ng.addColorStop(0, 'rgba(255,240,205,' + (0.32 * irr).toFixed(3) + ')');
        ng.addColorStop(1, 'rgba(255,240,205,0)');
      } else {
        ng.addColorStop(0, 'rgba(30,16,8,' + (0.24 * -irr).toFixed(3) + ')');
        ng.addColorStop(1, 'rgba(30,16,8,0)');
      }
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,206,150,.30)'; ctx.lineWidth = 1; ctx.stroke(path);
    ctx.restore();
  }

  /* ---- the ring the stream settles into at R_circ. Even when transfer
     is running away, the gas already through L₁ has far too much angular
     momentum to fall onto the accretor — it piles into a ring first. ---- */
  function drawRing(x, y, R, sq, ph, k) {
    if (k <= 0.02 || !(R > 2.5)) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(255,226,178,' + (0.85 * k).toFixed(3) + ')'
                             : 'rgba(255,186,110,' + (0.30 * k).toFixed(3) + ')';
      ctx.lineWidth = pass ? Math.max(0.9, R * 0.045) : Math.max(2.6, R * 0.14);
      ctx.beginPath(); ctx.ellipse(x, y, R, R * sq, 0, 0, 7); ctx.stroke();
    }
    for (let b = 0; b < 3; b++) {                    // packets shearing around it
      const th = ph * 2.2 + b * 2.09;
      ctx.fillStyle = 'rgba(255,240,214,' + (0.75 * k).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x + R * Math.cos(th), y + R * sq * Math.sin(th),
              Math.max(1, R * 0.055), 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  /* the flash where the stream strikes gas that is already there */
  function impactGlow(x, y, r, a) {
    if (a <= 0.02) return;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, 'rgba(255,250,235,' + (0.90 * a).toFixed(3) + ')');
    gr.addColorStop(0.4, 'rgba(255,214,150,' + (0.50 * a).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.save(); ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 7); ctx.fill(); ctx.restore();
  }

  /* ---- the dust-driven AGB wind. The giant sheds mass for a long time
     before it ever overflows; that is part of why Case C happens at all. ---- */
  function drawWind(c, r, k, ph) {
    if (k <= 0.03) return;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const u = (ph * 0.055 + i / 3) % 1;
      const R = r * (1.04 + 1.35 * u);
      ctx.globalAlpha = 0.22 * k * (1 - u) * (1 - u);
      ctx.strokeStyle = '#d69660';
      ctx.lineWidth = Math.max(1, r * 0.06 * (1 - u));
      ctx.beginPath(); ctx.ellipse(c[0], c[1], R, R * 0.95, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  /* ================= the accretion disk =================
     Drawn as one gradient rather than a stack of opaque annuli, so the
     white dwarf at the middle is not buried by its own disk and the plate
     does not go flat brown. The colour ramp is the Shakura–Sunyaev
     profile of a steady disk,

         T(r) ∝ [ (1 − √(r_in/r)) / r³ ]^(1/4)

     which is what puts the temperature *peak* just outside the inner edge
     rather than at it, and lets the inner disk read as white-hot against
     an amber rim. The three anchors are the palette's own gas colours. */
  const DISK_ANCHOR = [[224, 164, 92], [255, 222, 180], RGB.wd];
  const SS = (() => {
    const rin = 0.10;
    const T = x => {
      const y = Math.max(x, rin);
      return Math.pow(Math.max(0, 1 - Math.sqrt(rin / y)) / (y * y * y), 0.25);
    };
    let peak = 0;
    for (let i = 0; i <= 400; i++) { const v = T(rin + (1 - rin) * i / 400); if (v > peak) peak = v; }
    return { rin, T, peak };
  })();
  const diskCol = k => {
    const A = DISK_ANCHOR, n = A.length - 1;
    const u = FK.clamp(k, 0, 1) * n, i = Math.min(n - 1, Math.floor(u)), fr = u - i;
    return A[i].map((v, j) => Math.round(v + (A[i + 1][j] - v) * fr));
  };

  /* the disk face. `heat` ∈ [0,1] slides the whole ramp: in quiescence the
     gas is genuinely cool, not merely dimmed. */
  function diskBody(x, y, R, sq, heat) {
    if (!(R > 2)) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, sq);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const k = FK.clamp(SS.T(Math.max(t, SS.rin)) / SS.peak, 0, 1) * heat;
      const a = t < SS.rin ? FK.clamp(t / SS.rin, 0, 1) : 1;   // hollow at the WD
      gr.addColorStop(t, 'rgba(' + diskCol(k).join(',') + ',' + a.toFixed(3) + ')');
    }
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* the near rim lip — the disk's only 3-D cue, and what hides the far
     half of the stream where it dives behind the disk */
  function diskRim(x, y, R, sq, heat) {
    if (!(R > 2)) return;
    const lip = Math.max(1.6, R * 0.085);
    const c = diskCol(0).map(v => Math.round(v * (0.40 + 0.20 * heat)));
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + lip, R, R * sq, 0, 0, Math.PI);
    ctx.ellipse(x, y, R, R * sq, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = 'rgb(' + c.join(',') + ')'; ctx.fill();
    ctx.restore();
  }

  /* Two trailing tidal arms. They are an m = 2 pattern raised by the donor
     and are stationary in the co-rotating frame, so they are locked to the
     line of centres — not to a free-running clock. Outburst only: a
     quiescent dwarf-nova disk is cool and featureless. */
  function diskArms(x, y, R, sq, thDonor, k) {
    if (k <= 0.02 || !(R > 6)) return;
    const rin = Math.max(1.6, R * SS.rin);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,232,190,' + (0.32 * k).toFixed(3) + ')';
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.9, R * 0.055);
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, r = rin + (R - rin) * t;
        const th = thDonor + arm * Math.PI + (1 - t) * 2.1;
        const px = x + r * Math.cos(th), py = y + r * sq * Math.sin(th);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* The bright spot: where the stream strikes the rim, smeared downstream
     by the rim gas sweeping through it. Its brightness flickers, its size
     does not — and because it is painted with the rim it is hidden when it
     rounds the far side, which is the orbital hump a U Gem star shows. */
  function brightSpot(x, y, R, sq, spotA, ph, k) {
    if (spotA == null || k <= 0.02) return;
    const sx = x + R * Math.cos(spotA), sy = y + R * sq * Math.sin(spotA);
    const rr = Math.max(2.6, R * 0.105);
    const fl = 0.86 + 0.14 * (0.5 * Math.sin(ph * 3.1) + 0.3 * Math.sin(ph * 7.7 + 1.1)
                              + 0.2 * Math.sin(ph * 13.3 + 2.4));
    const a = k * fl;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,222,168,' + (0.50 * a).toFixed(3) + ')';
    ctx.lineWidth = Math.max(0.9, R * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(x, y, R, R * sq, 0, spotA - 0.05, spotA + 0.55); ctx.stroke();
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr * 2.1);
    gr.addColorStop(0, 'rgba(255,250,235,' + (0.95 * a).toFixed(3) + ')');
    gr.addColorStop(0.4, 'rgba(255,214,150,' + (0.50 * a).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(sx, sy, rr * 2.1, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,252,244,' + (0.98 * a).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(sx, sy, rr * 0.45, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ---- the stream ----
     `wide` ≥ 1 is the overflow depth: at first contact the gas leaves L₁
     through a nozzle a scale height across and the stream is a hairline,
     but once the donor is driven past its own critical surface the nozzle
     opens and the thread becomes a tongue. The travelling packets
     *brighten* as they fall: at fixed cross-section continuity gives
     ρ ∝ 1/v, and they are speeding up. */
  function drawStream(g, R, proj, sep, cutR, ph, alpha, wide) {
    const pts = R.stream;
    if (!pts.length) return null;
    wide = wide || 1;
    let end = pts.length - 1, tail = null;
    if (cutR != null) {
      for (let i = 0; i < pts.length; i++) {
        if (Math.hypot(pts[i][0], pts[i][1]) <= cutR) {
          end = i;
          /* interpolate onto the cut radius, so the endpoint — and with it
             the bright spot — stops jumping a pixel as the disk breathes */
          if (i > 0) {
            const a = pts[i - 1], b = pts[i];
            const ra = Math.hypot(a[0], a[1]), rb = Math.hypot(b[0], b[1]);
            const w = ra > rb ? FK.clamp((ra - cutR) / (ra - rb), 0, 1) : 1;
            tail = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
          }
          break;
        }
      }
    }
    const scrP = p => { const w = proj(p[0], p[1]); return [g.cx + w[0], g.cy + w[1] * SQ]; };
    const path = [];
    for (let i = 0; i <= end; i++) path.push(pts[i]);
    if (tail) path.push(tail);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(255,226,178,' + (0.92 * alpha) + ')'
                             : 'rgba(255,186,110,' + (0.24 * alpha) + ')';
      ctx.lineWidth = (pass ? Math.max(1.2, sep * 0.010) : Math.max(3.4, sep * 0.030)) *
                      (1 + 2.6 * (wide - 1));
      ctx.beginPath();
      path.forEach((p, i) => { const q = scrP(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.stroke();
    }
    if (!FK.reduce && path.length > 6) {
      for (let b = 0; b < 5; b++) {
        const u = ((ph * 0.22 + b / 5) % 1);
        const p = scrP(path[Math.min(path.length - 1, Math.floor(u * (path.length - 1)))]);
        ctx.fillStyle = 'rgba(255,240,214,' + (0.55 * alpha * (0.5 + 0.9 * u)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p[0], p[1], Math.max(1.4, sep * 0.011) * (0.8 + 0.5 * u) * wide, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
    return path[path.length - 1];
  }

  /* ---- common envelope: a turbulent, differentially rotating cloud,
     the friction heat the spiral-in deposits, and the two drag wakes the
     cores actually carve ---- */
  function drawEnvelope(g, Rx, k, tight, ph, cores, paid) {
    if (k <= 0.012) return;
    /* A common envelope is a BLOATED, roughly spherical cloud that engulfs
       both stars — not a thin disk. It flattens somewhat as the spiral-in
       spins it up (which is why post-CE nebulae are mildly bipolar), but it
       stays a fat oblate cloud: pancaking it all the way to the orbital-plane
       squash, as this once did, made it read as a spiral galaxy. */
    const EQ = 0.92 + (0.66 - 0.92) * FK.smooth(0.15, 0.95, tight);
    const Ry = Rx * EQ;

    /* a soft outer halo, drawn UNCLIPPED, so the cloud has diffuse gassy
       edges instead of a hard rim — this is most of what sells "engulfing" */
    ctx.save();
    const halo = ctx.createRadialGradient(g.cx, g.cy, Rx * 0.55, g.cx, g.cy, Rx * 1.18);
    halo.addColorStop(0, 'rgba(' + ENV + ',' + (0.22 * k).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(' + ENV + ',0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, Rx * 1.18, Ry * 1.18, 0, 0, 7); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, Rx, Ry, 0, 0, 7); ctx.clip();

    /* the body of the cloud: opaque and warm at the centre where the stars
       are buried, fading out toward the edge */
    const base = ctx.createRadialGradient(g.cx, g.cy, Rx * 0.04, g.cx, g.cy, Rx);
    base.addColorStop(0, 'rgba(' + ENV + ',' + (0.74 * k).toFixed(3) + ')');
    base.addColorStop(0.55, 'rgba(' + ENV + ',' + (0.44 * k).toFixed(3) + ')');
    base.addColorStop(1, 'rgba(' + ENV + ',' + (0.06 * k).toFixed(3) + ')');
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, Rx, Ry, 0, 0, 7); ctx.fill();

    /* Turbulence as soft mottled patches rather than sharp arcs: gas in a
       differentially rotating envelope is stretched along its own orbit, but
       drawn as high-contrast arcs it reads as galaxy spiral structure. Softer,
       rounder, lower-contrast blobs read as churning cloud. Deterministic so
       they do not shimmer; Ω(r) ∝ r^(−1/2) so the inner material outruns the
       outer. */
    for (let i = 0; i < 26; i++) {
      const rr = Rx * (0.08 + 0.80 * Math.sqrt(hash(i + 40)));
      const th = hash(i) * 6.2832 + ph * 0.45 * Math.pow(Math.max(rr / Rx, 0.12), -0.5);
      const rad = Rx * (0.10 + 0.20 * hash(i + 70));
      const dark = hash(i + 11) < 0.30;
      const al = (dark ? 0.09 : 0.11) * k * (0.4 + hash(i + 20));
      const cx = g.cx + rr * Math.cos(th), cy = g.cy + rr * EQ * Math.sin(th);
      const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      blob.addColorStop(0, dark ? 'rgba(96,60,34,' + al.toFixed(3) + ')'
                                : 'rgba(236,180,124,' + al.toFixed(3) + ')');
      blob.addColorStop(1, dark ? 'rgba(96,60,34,0)' : 'rgba(236,180,124,0)');
      ctx.fillStyle = blob;
      ctx.beginPath(); ctx.ellipse(cx, cy, rad, rad * (0.6 + 0.4 * EQ), 0, 0, 7); ctx.fill();
    }

    /* where each core actually is, in the envelope's squashed frame */
    const anchors = cores.map(c => {
      const dx = c[0] - g.cx, dy = (c[1] - g.cy) / EQ;
      /* clamped inside the cloud, or the wake marches outward from a point
         that is not in it and gets clipped to a stub */
      return { r: Math.min(Math.hypot(dx, dy), Rx * 0.9), th: Math.atan2(dy, dx) };
    });

    /* Friction luminosity: the drag heat rising from the orbit as the cores
       dig in. It is scaled by the fraction of the envelope's binding energy
       the shrinking orbit has actually paid off, so a case that cannot
       afford to eject stays dim and stays wrapped. */
    const rHeat = FK.clamp(Math.max(anchors[0].r, anchors[1].r) * 2.3, Rx * 0.12, Rx * 0.85);
    const hAmp = (0.08 + 0.34 * FK.clamp(paid || 0, 0, 1)) * k;
    const hg = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, rHeat);
    hg.addColorStop(0, 'rgba(255,214,160,' + hAmp.toFixed(3) + ')');
    hg.addColorStop(0.6, 'rgba(236,160,104,' + (0.4 * hAmp).toFixed(3) + ')');
    hg.addColorStop(1, 'rgba(236,160,104,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, rHeat, rHeat * EQ, 0, 0, 7); ctx.fill();

    /* The two-armed wake, one arm rooted on each core. The wake is the
       core's own bow shock sheared out by differential rotation, so it has
       to trail from the core's screen position — an arm on its own clock
       reads as a decorative vortex. Tapered: hot and dense at the core,
       mixed away further out. */
    ctx.lineCap = 'round';
    const wind = 1.1 + 3.6 * tight, SEG = 30;
    anchors.forEach(aa => {
      const r0 = Math.max(2, aa.r), th0 = aa.th;
      let px = g.cx + r0 * Math.cos(th0), py = g.cy + r0 * EQ * Math.sin(th0);
      for (let i = 1; i <= SEG; i++) {
        const t = i / SEG, r = r0 + (Rx - r0) * t;
        const th = th0 - t * wind;                  // trailing: outer gas was hit earlier
        const x = g.cx + r * Math.cos(th), y = g.cy + r * EQ * Math.sin(th);
        /* soft and short-lived: a hint of the drag wake, not a galaxy arm */
        ctx.strokeStyle = 'rgba(255,206,150,' + (0.18 * k * (1 - t) * (1 - t)).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.9, Rx * 0.026 * (1 - 0.75 * t));
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        px = x; py = y;
      }
    });
    ctx.restore();
    /* no hard outer stroke: the base gradient already reaches zero alpha
       inside the clip, and a 1.4 px ring around it read as a container */
  }

  /* ---- the ejected envelope. CE ejecta are strongly equatorially
     concentrated — most of the mass leaves in the orbital plane as a dense
     torus, with a thinner, faster shell above it — and the newly exposed
     ~10⁵ K core ionises it from the inside: for a while this is a small
     bipolar planetary nebula with a close binary at the middle of it. ---- */
  function drawEjecta(g, u, R, ion) {
    if (u <= 0 || u >= 1) return;
    const k = 1 - u;
    const col = [182, 126, 80].map((v, i) => Math.round(v + ([150, 216, 222][i] - v) * (ion || 0)));
    const cs = col.join(',');
    ctx.save();
    /* the equatorial torus, riding the orbital plane */
    const Rr = R * (0.62 + 0.55 * u);            // dense, slow, in the plane
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = 'rgba(' + cs + ',' + ((pass ? 0.55 : 0.20) * k).toFixed(3) + ')';
      ctx.lineWidth = pass ? Math.max(1.4, R * 0.030 * k) : Math.max(3, R * 0.085 * k);
      ctx.beginPath(); ctx.ellipse(g.cx, g.cy, Rr, Rr * SQ, 0, 0, 7); ctx.stroke();
    }
    /* cometary knots — the clumps survive as knots in the ring */
    for (let i = 0; i < 10; i++) {
      const th = hash(i + 55) * 6.2832 + 0.4;
      const rr = Rr * (0.96 + 0.10 * hash(i + 83));
      ctx.fillStyle = 'rgba(' + cs + ',' + (0.50 * k * (0.4 + 0.6 * hash(i + 29))).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(g.cx + rr * Math.cos(th), g.cy + rr * SQ * Math.sin(th),
              Math.max(1, R * 0.022 * k), 0, 7);
      ctx.fill();
    }
    /* the polar shell: faster, thinner, limb-brightened, slightly prolate */
    const Rs = R * (0.55 + 2.40 * u);            // thin, fast, out of the plane
    ctx.strokeStyle = 'rgba(' + cs + ',' + (0.26 * k).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, R * 0.018 * k);
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, Rs * 0.86, Rs * 0.94, 0, 0, 7); ctx.stroke();
    const sg = ctx.createRadialGradient(g.cx, g.cy, Rs * 0.55, g.cx, g.cy, Rs);
    sg.addColorStop(0, 'rgba(' + cs + ',0)');
    sg.addColorStop(0.85, 'rgba(' + cs + ',' + (0.10 * k).toFixed(3) + ')');
    sg.addColorStop(1, 'rgba(' + cs + ',0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(g.cx, g.cy, Rs * 0.86, Rs * 0.94, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ---- magnetic braking: an ordered magnetosphere, not scribbles. The
     donor's wind is held in corotation out to several stellar radii, and
     that long lever arm is what drains the orbital angular momentum. ---- */
  function drawBraking(x, y, r, ph, rmax) {
    const cap = rmax ? Math.min(r * 2.6, rmax) : r * 2.6;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const R = r * (1.22 + 0.40 * i);
      if (R > cap) break;
      ctx.globalAlpha = 0.30 - 0.06 * i;
      ctx.strokeStyle = '#8ba9cf'; ctx.lineWidth = Math.max(0.9, r * 0.05);
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.42, -0.26, 0, 7); ctx.stroke();
    }
    /* wind packets sliding out along the field, taking J with them */
    for (let b = 0; b < 4; b++) {
      const u = (ph * 0.10 + b / 4) % 1;
      const R = r * (1.22 + 1.38 * u);
      if (R > cap) continue;
      const th = 0.6 + b * 1.57;
      ctx.globalAlpha = 0.55 * (1 - u);
      ctx.fillStyle = '#a9c3e2';
      ctx.beginPath();
      ctx.arc(x + R * Math.cos(th), y + R * 0.42 * Math.sin(th), 1.3, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  /* =================== the scene =================== */
  function drawScene(m) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    starfield();
    const g = geom();
    const f = frame(s, m);
    const gone = m.merged && (IS.post[f.key] ||
                              (f.key === 'exit' && f.u > 0.42));
    const V = viewScale(f, m, g);
    const sep = V.sep;

    /* The orbit is held by whatever mass is still bound inside it, so the
       primary's effective mass slides from the whole star to the bare core
       as the envelope comes unbound — no discontinuity at the CE. */
    const preCE = f.core < 0.02;
    const Mprim = m.channel === 'stable' ? f.Mp : m.M1 + (m.Mc - m.M1) * f.core;
    const Msec = f.Ms;
    const q1 = Mprim / Msec;                          // primary : companion

    /* bodies in the orbital plane, in pixels */
    const r1 = sep * Msec / (Mprim + Msec), r2 = sep * Mprim / (Mprim + Msec);
    const P1 = [r1 * Math.cos(orb), r1 * Math.sin(orb)];
    const P2 = [-r2 * Math.cos(orb), -r2 * Math.sin(orb)];
    const c1 = S(g, P1), c2 = S(g, P2);
    const behind1 = Math.sin(orb) < Math.sin(orb + Math.PI);

    /* radii: as a fraction of the Roche lobe where that is the point,
       with a legible floor for stars that are effectively points */
    /* floored so a stripped helium core or a white dwarf stays visible
       rather than dropping below one pixel */
    const smallPx = R => Math.max(2.4, 3.1 * Math.pow(Math.max(R, 1e-3), 0.33));
    const lobe1 = fRL(q1) * sep, lobe2 = fRL(1 / q1) * sep;
    const fill1 = FK.clamp(f.R1 / (fRL(q1) * f.a), 0, 1);
    const fill2 = FK.clamp(f.Rsec / (fRL(1 / q1) * f.a), 0, 1);
    const rGiant = Math.max(smallPx(f.R1), fill1 * lobe1);
    const rCore = Math.max(2.6, smallPx(f.Rcore));
    const rd = Math.max(preCE ? 2.6 : 3.4, fill2 * lobe2);

    /* --- orbit guides --- */
    if (!gone && f.env < 0.35) {
      ctx.save();
      ctx.strokeStyle = 'rgba(139,169,207,.15)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.ellipse(g.cx, g.cy, r1, r1 * SQ, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(g.cx, g.cy, r2, r2 * SQ, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }

    /* --- envelope behind everything ---
       it *is* the giant's envelope, so it starts at the size the giant
       had and puffs out as the cores pump energy into it */
    const expand = 1.02 + 0.80 * FK.smooth(sAt('spiral', 0.35), sAt('exit', 0.45), s);
    /* It has to *contain* the companion. Drawn from the giant's own lobe it
       did not, for the first 40% of the phase captioned "common envelope" —
       the companion orbited in clear space outside an opaque cloud, which is
       the one thing that cannot be happening. */
    const rComp = sep * Mprim / (Mprim + Msec);
    const Renv = Math.min(Math.max(fRL(m.M1 / m.M2) * g.R0, (rComp + rd) * 1.10) * expand,
                          W * 0.47, H * 0.92);
    if (f.env > 0) drawEnvelope(g, Renv, f.env, f.spiral, orb, [c1, c2], f.paid);
    if (f.key === 'exit') drawEjecta(g, FK.clamp(f.u * 1.25, 0, 1), Renv, m.merged ? 0 : f.hot);

    /* --- inspiral trail --- */
    if (IS.inCE[f.key] && f.spiral > 0.02) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,160,.16)'; ctx.lineWidth = 1.4;
      for (let side = 0; side < 2; side++) {
        ctx.beginPath();
        for (let i = 0; i <= 46; i++) {
          const t = i / 46;
          const sp = f.spiral * t;
          const aa = m.ai * Math.pow(Math.max(m.merged ? m.aCon * 0.04 : m.af, 1e-3) / m.ai, sp);
          const rr = g.R0 * Math.pow(aa / m.ai, 0.18) * (side ? m.M2 : Mprim) / (Mprim + m.M2);
          const th = orb + Math.PI * side - (f.spiral - sp) * 26;
          const x = g.cx + rr * Math.cos(th), y = g.cy + rr * SQ * Math.sin(th);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* --- Roche geometry, where it carries the argument --- */
    const showLobes = ((f.key === 'agb' || IS.flow[f.key] ||
                        (IS.post[f.key] && !gone)) ||
                       (m.channel === 'stable' && f.key !== 'zams')) && f.env < 0.06;
    const donorIsPrimary = preCE;                     // the giant is the mass loser
    /* Roche geometry is only meaningful outside the common envelope, and
       recomputing the RK4 stream on every frame of the mass ramp would be
       wasteful — so solve it only where the mass ratio is settled. */
    const qR = donorIsPrimary ? q1 : 1 / q1;
    const RO = (f.core < 0.02 || f.core > 0.98)
      ? roche(Math.round(qR * 40) / 40)              // quantised: the RK4 stream is cached
      : null;
    /* frame with X from the accretor to the donor */
    const acc = donorIsPrimary ? P2 : P1, don = donorIsPrimary ? P1 : P2;
    const proj = localFrame(acc, don);

    /* ================= the accretion flow, as a state =================
       Three radii decide everything the gas can do:

         R_circ  where the stream's own angular momentum lets it settle —
                 taken from the integrator, not from a fitted law
         R_tid   0.85 R_L1, where the donor's tide stops the disk growing
                 (Paczyński 1977; Ichikawa & Osaki 1994; Smak 2002)
         R_acc   the accretor itself

       A disk can only form if the ring fits between the two: when R_circ
       lands inside the star, the stream hits the surface directly and
       there is no disk to draw. Between contact and today the ring is not
       yet a disk — it has to spread there, and that is its own beat. */
    const Rtid = 0.85 * lobe1;
    const rcircPx = RO ? RO.rcirc * sep : 0;
    /* measured against whichever star is doing the accreting — on the stable
       branch that is the swelling secondary, not a compact core */
    const rAccPx = donorIsPrimary ? rd : (f.core > 0.5 ? rCore : rGiant);
    const disky = !!RO && rcircPx > rAccPx * 1.35 && RO.rcirc < RO.rLA;
    /* NS Per is a U Gem dwarf nova. Smak (1984) measures U Gem's own disk
       breathing between 0.72 and 0.97 R_tid across the cycle, so the radius
       moves with the outburst instead of being nailed down. */
    const outb = dn < 0.24 ? FK.smooth(0, 0.04, dn) * (1 - FK.smooth(0.16, 0.24, dn)) : 0;
    const heat = 0.34 + 0.66 * outb;
    const RdQ = Rtid * (0.72 + 0.25 * outb);
    const spread = f.key === 'build' ? FK.smooth(0, 1, f.u) : 1;
    const Rdisk = rcircPx + (RdQ - rcircPx) * spread;
    /* the CV proper: a disk exists from the `build` beat onward */
    const cvOK = m.verdict === 'cv' && !gone && m.channel !== 'stable';
    const isCV = cvOK && (f.key === 'build' || f.key === 'now') && disky && Rdisk > 3;
    /* second contact: the stream and the first ring, but no disk yet */
    const isBirth = cvOK && f.key === 'contact2';
    /* the donor's direction as seen from the accretor — the tidal arms and
       the disk's own pattern are locked to this, not to a free clock */
    const thDon = Math.atan2((don[1] - acc[1]), (don[0] - acc[0]));

    /* The guides are the lobes' *equatorial* sections — the z = 0 slice,
       projected exactly like the orbit ellipses they sit on. Stroking the
       full silhouette here would draw the whole stack of contours. */
    if (showLobes && !gone && RO) {
      ctx.save();
      ctx.strokeStyle = 'rgba(216,206,180,.20)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.stroke(planePoly(g, RO.lobeA[0].pts, proj, tidalShape(1 / RO.q, 1).sq));
      /* the lobe guide is a surface, not a ring in the plane — same squash
         as a star that fills it, so the outline the donor grows into and the
         donor itself are drawn in the same geometry */
      const lobeSq = tidalShape(RO.q, 1).sq;
      if (fill1 < 0.985 || !donorIsPrimary) {
        ctx.stroke(planePoly(g, RO.lobeD[0].pts, proj, lobeSq));
      }
      ctx.restore();
    }

    /* --- bodies, far one first --- */
    let giantCol = RGB_B.map((v, i) => Math.round(v + (RGB_AGB[i] - v) * f.mix));
    /* on the stable branch the donor ends as a bare, hot helium core */
    if (m.channel === 'stable' && f.hot > 0)
      giantCol = giantCol.map((v, i) => Math.round(v + (RGB_CORE[i] - v) * f.hot));
    /* the core leaves the envelope at ~10⁵ K and cools to a white dwarf */
    const coreCol = RGB.wd.map((v, i) => Math.round(v + (RGB_CORE[i] - v) * f.hot));
    const drawPrimary = () => {
      if (gone) return;
      /* The giant is not deleted when the CE starts — it *is* the envelope.
         So it fades out over the same interval the envelope fades in, and
         the core emerges from underneath it rather than replacing it. */
      if (f.giant > 0.02) {
        if (f.mix > 0.25 && f.env < 0.3) drawWind(c1, rGiant, f.mix * 0.6, spin);
        ctx.save();
        ctx.globalAlpha = f.giant;
        /* the star's own fill factor decides its figure — no threshold */
        if (donorIsPrimary && RO) drawGiant(g, c1, rGiant, fill1, RO, proj, giantCol, -1, sep);
        else FK.disc(ctx, c1[0], c1[1], rGiant, giantCol, { u: 0.74, core: 1, bloom: 1.5 });
        ctx.restore();
      }
      if (f.core > 0.02) {
        ctx.save();
        ctx.globalAlpha = FK.clamp(f.core * 1.6, 0, 1);
        FK.disc(ctx, c1[0], c1[1], rCore, coreCol,
          { u: 0.40, core: 1, bloom: 3.0 + 2.6 * f.hot });
        ctx.restore();
      }
    };
    /* the companion's colour tracks the mass it has swallowed: a 0.55 M⊙
       K dwarf is orange, a rejuvenated straggler above the turnoff is not */
    const secCol = RGB.kdwarf.map((v, i) =>
      Math.round(v + (RGB_B[i] - v) * FK.clamp((Math.log10(Msec) + 0.3) / 1.2, 0, 1)));
    const drawDonor = () => {
      if (gone) return;
      if (!donorIsPrimary && RO)
        drawGiant(g, c2, rd, fill2, RO, proj, secCol, (isCV || isBirth) ? 1 : 0, sep);
      else FK.disc(ctx, c2[0], c2[1], rd, secCol,
        { u: 0.68, core: 0.95,
          bloom: m.channel === 'stable' ? 1.7 + 0.9 * f.xfer : (rd > 40 ? 1.35 : 1.7) });
    };

    /* where the stream lands, found by running it once without ink. The rim
       angle is parametric on the squashed ellipse, so undo the squash. */
    let spotA = null;
    if (isCV && RO) {
      const hit = drawStream(g, RO, proj, sep, Rdisk / sep, spin, 0);
      if (hit) {
        const w = proj(hit[0], hit[1]);
        spotA = Math.atan2(((g.cy + w[1] * SQ) - c1[1]) / SQ, (g.cx + w[0]) - c1[0]);
      }
    }

    /* Depth comes from paint order, not from clipping halves. At H/R ≈ 0.05
       the disk is far too thin to occult its own white dwarf, so the
       accretor goes over the face and under the near rim; the donor goes
       under everything when it is on the far side of the orbit. */
    if (isCV) {
      const donorFar = !behind1;
      if (donorFar) drawDonor();
      if (spotA != null && Math.sin(spotA) < 0)                  // spot on the far rim
        brightSpot(c1[0], c1[1], Rdisk, SQ, spotA, spin, 0.55 + 0.45 * outb);
      diskBody(c1[0], c1[1], Rdisk, SQ, heat);
      drawPrimary();
      diskRim(c1[0], c1[1], Rdisk, SQ, heat);
      diskArms(c1[0], c1[1], Rdisk, SQ, thDon, 0.06 + 0.34 * outb);
      if (spotA != null && Math.sin(spotA) >= 0)                 // spot on the near rim
        brightSpot(c1[0], c1[1], Rdisk, SQ, spotA, spin, 0.55 + 0.45 * outb);
      if (RO) drawStream(g, RO, proj, sep, Rdisk / sep, spin, 1);
      if (!donorFar) drawDonor();
    } else if (behind1) {
      drawPrimary(); drawDonor();
    } else {
      drawDonor(); drawPrimary();
    }

    /* ---- second contact: the dwarf nova being born ----
       The donor has just touched its lobe again. There is a stream, and the
       gas is beginning to pile into a ring at R_circ — but there is no disk
       yet, and drawing one here would skip the only part of the story the
       figure previously left out entirely. */
    if (isBirth && RO && disky) {
      const kR = FK.smooth(0.55, 1, f.u);
      drawRing(c1[0], c1[1], rcircPx, SQ, spin, kR * 0.9);
      const hit = drawStream(g, RO, proj, sep, RO.rcirc, spin, FK.smooth(0, 0.30, f.u));
      if (hit) {
        const w = proj(hit[0], hit[1]);
        impactGlow(g.cx + w[0], g.cy + w[1] * SQ, Math.max(2.2, rcircPx * 0.16), kR * 0.8);
      }
    }

    /* --- mass transfer ---
       The stream is cut at the circularisation radius: whatever its fate,
       gas through L₁ carries too much angular momentum to fall straight
       in, so it piles into a ring at R_circ first (Frank, King & Raine). */
    if (IS.flow[f.key] && RO) {
      const accC = donorIsPrimary ? c2 : c1;
      const kS = FK.smooth(0, 0.35, f.u) * (1 - f.env);   // swallowed by the envelope
      const kR = f.key === 'rlof' ? FK.smooth(0.10, 0.55, f.u) * (1 - f.env) : (1 - f.env);
      const cut = disky ? RO.rcirc : Math.max(rd / sep, 0.02);
      const hit = drawStream(g, RO, proj, sep, cut, spin, kS, f.over);
      if (disky) drawRing(accC[0], accC[1], rcircPx, SQ, spin, kR * 0.9);
      if (hit) {
        const w = proj(hit[0], hit[1]);
        impactGlow(g.cx + w[0], g.cy + w[1] * SQ,
          Math.max(2.2, (disky ? rcircPx : rd) * 0.16), kS * kR);
      }
      FK.text(ctx, 'q = ' + q1.toFixed(2) + (m.stable ? ' < ' : ' > ') + 'q_crit = ' +
        m.qc.toFixed(2) + '  →  ' + (m.stable ? 'transfer is stable' : 'dynamically unstable'),
        g.cx, H - 30, { font: FK.mono(10), fill: m.stable ? C.mint : '#f0bd86', align: 'center' });
      /* When R_circ lands inside the accretor there is no room for a ring:
         the stream hits the surface. Saying so is cheaper than drawing a
         ring inside a star, which is what the old floor did. */
      if (!disky) FK.text(ctx, 'R_circ < R₂ — the stream strikes the surface, no disk forms',
        g.cx, H - 44, { font: FK.mono(9), fill: C.dim, align: 'center' });
    }
    /* the stable branch keeps transferring instead of forming an envelope */
    if (m.channel === 'stable' && RO && f.xfer > 0 && f.xfer < 1 && fill1 > 0.985) {
      const cut = disky ? RO.rcirc : Math.max(rd / sep, 0.02);
      const hit = drawStream(g, RO, proj, sep, cut, spin, 1, 1);
      if (disky) drawRing(c2[0], c2[1], rcircPx, SQ, spin, 0.8);
      if (hit) {
        const w = proj(hit[0], hit[1]);
        impactGlow(g.cx + w[0], g.cy + w[1] * SQ,
          Math.max(2.2, (disky ? rcircPx : rd) * 0.16), 0.75);
      }
    }
    /* Magnetic braking only matters on the close post-CE orbit. The stable
       branch ends up hundreds of R⊙ apart, where it does nothing — so the
       field lines must not be drawn there. */
    if ((f.key === 'decay' || f.key === 'contact2') && !gone && m.channel !== 'stable') {
      drawBraking(c2[0], c2[1], Math.max(rd, 6), spin, sep * 0.60);
    }

    /* --- merger --- */
    if (m.merged && f.key === 'exit' && f.u > 0.24 && f.u < 0.76) {
      const k = 1 - Math.abs(f.u - 0.5) / 0.26;
      const R = 96 * k + 14;
      const gr = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, R);
      gr.addColorStop(0, 'rgba(255,244,220,' + (0.80 * k).toFixed(3) + ')');
      gr.addColorStop(0.35, 'rgba(255,206,146,' + (0.34 * k).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.save(); ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, R, 0, 7); ctx.fill(); ctx.restore();
    }
    if (gone) {
      FK.disc(ctx, g.cx, g.cy, 3.6, RGB.wd, { u: 0.42, core: 1, bloom: 3.6 });
      FK.text(ctx, 'one more invisible white dwarf', g.cx, g.cy + 38,
        { font: FK.mono(10), fill: C.soft, align: 'center' });
    }

    /* ---------------- annotation ---------------- */
    const ST = m.channel === 'stable';
    /* Captions name what is on screen *at this instant*, not what is about
       to happen: during the expansion the primary is still growing toward
       its lobe, and the first stage covers the whole main sequence, not
       just the zero-age moment. */
    /* every caption below states an orbital quantity, so the formatters
       have to exist before the caption table is built */
    const aTxt = a => a >= 10 ? a.toFixed(0) : a.toFixed(2);
    const pTxt = p => p > 48 ? (p / 24).toFixed(0) + ' d' : p.toFixed(2) + ' h';
    const grow = m.cs.key === 'C' ? 'swells toward the AGB'
               : m.cs.key === 'B' ? 'crosses the Hertzsprung gap'
               : 'expands on the main sequence';
    const bornTxt = { cv: 'Second contact — the dwarf nova is born',
                      tight: 'Second contact — but already below 6.30 h',
                      wide: 'Still detached — the lobe never caught up',
                      merge: 'Nothing left to evolve',
                      slow: 'Still on the main sequence' }[m.verdict];
    const buildTxt = { cv: 'The ring spreads into a disk',
                       tight: 'A cataclysmic variable — the wrong one',
                       wide: 'Still grinding down, and out of time',
                       merge: 'Nothing left to evolve',
                       slow: 'Still on the main sequence' }[m.verdict];
    const cap = ST ? {
      zams:     'Detached · both stars on the main sequence',
      agb:      'The primary ' + grow,
      rlof:     'Case ' + m.cs.key + ' overflow · stable',
      flood:    'Orbit tightening · transfer on the donor’s timescale',
      plunge:   f.Mp > f.Ms ? 'Orbit tightening · q still above 1'
                            : 'Orbit widening · q has reversed',
      spiral:   f.Mp > f.Ms ? 'Orbit tightening · q still above 1'
                            : 'Orbit widening · q has reversed',
      exit:     'Orbit widened · ' + aTxt(m.ai) + ' → ' + aTxt(m.af) + ' R⊙',
      decay:    'Orbit fixed · P = ' + pTxt(m.PfS),
      contact2: 'No second contact on this branch',
      build:    'No disk — the pair stays detached',
      now:      ({ bss: 'Blue straggler + stripped core — today',
                   bssdead: 'The straggler has already died',
                   nobss: 'An ordinary binary — today' })[m.verdict]
    }[f.key] : {
      zams:     'Detached · both stars on the main sequence',
      agb:      'The primary ' + grow,
      rlof:     'Case ' + m.cs.key + ' overflow · dynamically unstable',
      flood:    'Orbit starts to shrink · transfer runs away',
      plunge:   'Orbit collapsing · ' + aTxt(m.ai) + ' → ' + aTxt(f.a) + ' R⊙',
      spiral:   'Orbit collapsing · ' + aTxt(m.ai) + ' → ' +
                (m.merged ? '0' : aTxt(m.af)) + ' R⊙',
      exit:     m.merged ? 'Orbit → 0 · the cores coalesce'
                         : 'Orbit fixed · P = ' + m.Pce.toFixed(2) + ' h',
      decay:    m.merged ? 'No orbit left'
                         : 'Orbit grinding down · ' + aTxt(m.af) + ' → ' + aTxt(m.aNow) + ' R⊙',
      contact2: m.merged ? 'Nothing left to evolve' : bornTxt,
      build:    m.merged ? 'Nothing left to evolve' : buildTxt,
      now:      ({ cv: 'Dwarf nova — today', wide: 'Detached pair — today',
                   tight: 'A dwarf nova, but too short a period',
                   merge: 'Single white dwarf — today', slow: 'Still on the main sequence' })[m.verdict]
    }[f.key];
    FK.kicker(ctx, cap, 14, 20, { size: 9, fill: C.soft });

    const P0txt = m.P0h > 48 ? (m.P0h / 24).toFixed(0) + ' d' : m.P0h.toFixed(1) + ' h';
    const zadTxt = (m.zad >= 0 ? '+' : '−') + Math.abs(m.zad).toFixed(2);
    /* the runaway is faster than the orbit it is happening in, and both
       numbers are computed rather than asserted */
    const tDyn = Math.sqrt(Math.pow(f.R1 * Rsun, 3) / (GG * m.M1 * Msun)) / 3.156e7;  // yr
    const P0yr = m.P0h / 24 / 365.25;
    const rcircA = RO ? RO.rcirc.toFixed(3) : '—';
    const RtidA = sep > 0 ? (Rtid / sep).toFixed(3) : '—';
    const sub = ST ? {
      zams:     'M₁ = ' + m.M1.toFixed(1) + ' + M₂ = ' + m.M2.toFixed(2) + ' M⊙  ·  P = ' + P0txt,
      agb:      'R₁ = ' + f.R1.toFixed(0) + ' R⊙  ·  ' + (m.cs.conv ? 'convective' : 'radiative') +
                ' envelope, ζ_ad = ' + zadTxt,
      rlof:     'a contracting donor outruns its own lobe — transfer self-limits',
      flood:    'the lobe cannot outrun this donor: ζ_L = ' + m.zl.toFixed(1) +
                ' < ζ_ad = ' + zadTxt,
      plunge:   'M₁ ' + f.Mp.toFixed(2) + '  →  M₂ ' + f.Ms.toFixed(2) + ' M⊙' +
                (f.Mp < f.Ms ? '   (ratio reversed — orbit widening)' : '   (orbit still shrinking)'),
      spiral:   'M₁ ' + f.Mp.toFixed(2) + '  →  M₂ ' + f.Ms.toFixed(2) + ' M⊙' +
                (f.Mp < f.Ms ? '   (ratio reversed — orbit widening)' : '   (orbit still shrinking)'),
      exit:     'a : ' + m.ai.toFixed(0) + ' → ' + m.af.toFixed(0) + ' R⊙  ·  P = ' +
                (m.PfS > 48 ? (m.PfS / 24).toFixed(1) + ' d' : m.PfS.toFixed(1) + ' h'),
      decay:    'straggler ' + m.M2f.toFixed(2) + ' M⊙ vs turnoff ' + mtTxt(m.mto),
      contact2: 'the orbit ends up ' + aTxt(m.af) + ' R⊙ wide — far too wide for contact',
      build:    'no stream, no ring, no disk on this branch',
      now:      ({ bss: m.M2f.toFixed(2) + ' M⊙ above a ' + mtTxt(m.mto) + ' turnoff',
                   bssdead: 'it lived only ' + Math.round(m.tLive) + ' Myr after the transfer',
                   nobss: 'never got above the turnoff' })[m.verdict]
    }[f.key] : {
      zams:     'M₁ = ' + m.M1.toFixed(1) + ' + M₂ = ' + m.M2.toFixed(2) + ' M⊙  ·  P = ' + P0txt,
      agb:      'R₁ = ' + f.R1.toFixed(0) + ' R⊙  →  lobe at ' + Math.round(fRL(q1) * m.ai) + ' R⊙',
      rlof:     m.cs.conv ? 'the envelope expands as it loses mass while the lobe shrinks'
                          : 'q is too extreme — the lobe shrinks faster than the donor',
      flood:    'τ_dyn = ' + tDyn.toFixed(2) + ' yr against P_orb = ' + P0yr.toFixed(2) +
                ' yr — it runs away inside one orbit',
      plunge:   'P : ' + P0txt + ' → ' + (m.merged ? 'contact' : m.Pce.toFixed(2) + ' h') +
                '   ·   envelope paid off ' + Math.round(f.paid * 100) + '%',
      spiral:   'a = ' + aTxt(f.a) + ' R⊙   ·   envelope paid off ' + Math.round(f.paid * 100) + '%',
      exit:     m.merged ? 'the companion never got out'
                         : 'ejecta lit by the exposed core  ·  P_CE = ' + m.Pce.toFixed(2) + ' h',
      decay:    m.merged ? '—' : 'donor fills ' + Math.round(fill2 * 100) + '% of its lobe' +
                                 (f.hot > 0.05 ? '  ·  core still cooling' : ''),
      contact2: m.merged ? '—'
                : m.verdict === 'cv'
                  ? 'lobe at contact ' + (fRL(m.M2 / m.Mc) * m.aCon).toFixed(2) +
                    ' R⊙  vs  Knigge ' + R2_KNIGGE + ' R⊙'
                  : m.verdict === 'tight'
                    ? 'a_f = ' + m.af.toFixed(2) + ' R⊙ < a(6.30 h) = ' + m.aCon.toFixed(2) + ' R⊙'
                    : 'donor fills only ' + Math.round(fill2 * 100) + '% of its lobe',
      build:    m.merged ? '—'
                : m.verdict === 'cv'
                  ? (disky ? 'ring at ' + rcircA + ' a  →  tidal limit ' + RtidA + ' a'
                           : 'R_circ is inside the white dwarf — direct impact, no disk')
                  : 'the cluster runs out of time first',
      now:      ({ cv: 'P = ' + P_OBS_H.toFixed(4) + ' h  ·  ' +
                       (outb > 0.28 ? 'dwarf-nova outburst' : 'quiescence'),
                   tight: 'P = ' + m.PfTight.toFixed(2) + ' h — real, but not the one we measure',
                   wide: 'P = ' + (pFromA(m.aNow * Rsun, (m.Mc + m.M2) * Msun) / 3600).toFixed(1) +
                         ' h — never reached contact',
                   merge: '87% of the COSMIC grid ends here',
                   slow: 'M₁ = ' + m.M1.toFixed(1) + ' M⊙ needs ' + Math.round(m.tau) + ' Myr' })[m.verdict]
    }[f.key];
    FK.text(ctx, sub, 14, 35, { font: FK.mono(9.5), fill: C.dim });

    /* clock */
    FK.kicker(ctx, 'cluster clock', W - 14, 20, { size: 8.5, align: 'right' });
    FK.text(ctx, f.t < 1 ? '0 Myr' : f.t.toFixed(0) + ' Myr', W - 14, 37,
      { font: FK.mono(14, 500), fill: f.t > m.tcl + .5 ? '#e0a45c' : C.ink, align: 'right' });
    FK.text(ctx, 'of ' + m.tcl + ' Myr', W - 14, 50, { font: FK.mono(9), fill: C.faint, align: 'right' });
    const bx = W - 104, by = 57;
    ctx.save();
    ctx.fillStyle = 'rgba(216,206,180,.16)'; ctx.fillRect(bx, by, 90, 3);
    ctx.fillStyle = m.verdict === 'cv' ? C.mint : C.amber;
    ctx.fillRect(bx, by, 90 * FK.clamp(f.t / m.tcl, 0, 1), 3);
    ctx.restore();

    /* Scale bar: a round number of R⊙ whose drawn length is that number's
       actual size in the scene, instead of a clamped copy of the separation
       labelled with a value it does not measure. */
    const nice = FK.niceTicks(0, f.a, 1);
    const aBar = nice.values.filter(v => v > 0).pop() || f.a;
    const sbx = 14, sby = H - 14;
    const sbw = FK.clamp(sep * aBar / Math.max(f.a, 1e-6), 26, W * 0.34);
    ctx.save(); ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sbx, sby); ctx.lineTo(sbx + sbw, sby);
    ctx.moveTo(sbx, sby - 3); ctx.lineTo(sbx, sby + 3);
    ctx.moveTo(sbx + sbw, sby - 3); ctx.lineTo(sbx + sbw, sby + 3);
    ctx.stroke(); ctx.restore();
    FK.text(ctx, (aBar >= 10 ? aBar.toFixed(0) : aBar.toFixed(2)) + ' R⊙' +
      (V.zoom > 1.06 ? '   ·   view ×' + V.zoom.toFixed(1) : ''),
      sbx + sbw / 2, sby - 5, { font: FK.mono(9), fill: C.dim, align: 'center' });

    /* The orbit on screen runs at the true Kepler rate for the separation
       shown, so state what that rate is and — once it has been clipped for
       legibility — by how much it is being held back. */
    const Porb = pNowH(f, m);
    FK.text(ctx, gone ? '' : 'P_orb = ' + (Porb > 48 ? (Porb / 24).toFixed(1) + ' d'
                                                     : Porb.toFixed(2) + ' h') +
      (timeSquash > 1.05 ? '   ·   shown ×' + (timeSquash < 10 ? timeSquash.toFixed(1)
        : Math.round(timeSquash)) + ' slow' : ''),
      W - 14, H - 28, { font: FK.mono(9.5), fill: C.dim, align: 'right' });

    FK.text(ctx, 'α = ' + m.alpha.toFixed(2) + '   λ = ' + m.lam.toFixed(1),
      W - 14, H - 14, { font: FK.mono(9.5), fill: C.dim, align: 'right' });

    /* ---------------- readouts ---------------- */
    const Pnow = pFromA(f.a * Rsun, (Mprim + Msec) * Msun) / 3600;
    const set = (el, v) => { if (el) el.textContent = v; };
    set(out.stage, cap);
    set(out.time, (f.t < 1 ? '0' : f.t.toFixed(0)) + ' Myr  /  ' + m.tcl + ' Myr');
    set(out.sep, gone ? '—' : (f.a >= 10 ? f.a.toFixed(0) : f.a.toFixed(2)) + ' R⊙');
    set(out.porb, gone ? '—' : Pnow > 48 ? (Pnow / 24).toFixed(1) + ' d' : Pnow.toFixed(2) + ' h');
    set(out.chan, ST ? 'stable · q ' + m.q0.toFixed(2) + ' < ' + m.qc.toFixed(2)
                     : 'CE · q ' + m.q0.toFixed(2) + ' > ' + m.qc.toFixed(2));
    set(out.mwdL, ST ? 'Stripped core + accretor' : 'Core → white dwarf');
    set(out.mwd, ST ? m.M1f.toFixed(2) + ' + ' + m.M2f.toFixed(2) + ' M⊙'
                    : m.Mc.toFixed(2) + ' M⊙  (M_env = ' + m.Menv.toFixed(2) + ')');
    set(out.pceL, ST ? 'Period after transfer' : 'Post-CE period');
    set(out.pce, ST ? (m.PfS > 48 ? (m.PfS / 24).toFixed(1) + ' d' : m.PfS.toFixed(1) + ' h')
                    : m.merged ? 'merged' : m.Pce.toFixed(2) + ' h');
    set(out.tdecL, ST ? 'Straggler lifetime' : 'Decay time');
    set(out.tdec, ST ? Math.round(m.tLive) + ' Myr  (needs ' + Math.max(0, m.budget).toFixed(0) + ')'
                     : m.merged ? '—' : m.tDecay > 9999 ? '≫ 10 Gyr' :
      m.tDecay.toFixed(0) + ' Myr  (budget ' + Math.max(0, m.budget).toFixed(0) + ')');
    set(out.lobeL, ST ? 'Cluster turnoff mass' : 'Donor lobe at contact');
    set(out.lobe, ST ? mtTxt(m.mto)
                     : (fRL(m.M2 / m.Mc) * m.aCon).toFixed(2) + ' R⊙  (Knigge ' + R2_KNIGGE + ')');

    const win = window_(m.lam, m.M1, m.tcl, m.M2, m.ci);
    set(out.win, win ? (win.lo.toFixed(2) + ' – ' + (win.open ? '>6' : win.hi.toFixed(2)) +
                        '   (merges below ' + win.merge.toFixed(2) + ')')
                     : (ST ? 'n/a — no envelope forms' : 'none'));
    if (out.verdict) {
      const v = {
        cv:      ['reaches 6.30 h in time ✓', C.mint],
        merge:   ['merges inside the envelope', '#d9703c'],
        tight:   ['survives, but lands at ' + (m.PfTight || 0).toFixed(2) + ' h', '#d98f4c'],
        wide:    ['too wide — still detached', '#e0a45c'],
        slow:    ['progenitor too light for this cluster', '#e0a45c'],
        bss:     ['blue straggler + stripped core ✓', C.mint],
        bssdead: ['straggler formed, already evolved off', '#e0a45c'],
        nobss:   ['stable transfer, but below the turnoff', '#e0a45c']
      }[m.verdict];
      out.verdict.textContent = v[0];
      out.verdict.style.color = v[1];
    }
  }

  /* ================= the P(t) track ================= */
  function poly(c, pts, o) {
    o = o || {};
    c.save();
    c.strokeStyle = o.stroke || C.amber; c.lineWidth = o.width || 1.8;
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (o.dash) c.setLineDash(o.dash);
    c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.stroke(); c.restore();
  }

  function fullTrack(m, A, ymin, TMAX) {
    const y0 = Math.log10(m.P0h);
    const pts = [[A.X(0), A.Y(y0)], [A.X(m.tau), A.Y(y0)]];
    if (m.channel === 'stable') {
      /* the V: conservative transfer shrinks the orbit until q = 1, then
         widens it again — and the system just sits there afterwards */
      m.trk.forEach(p => pts.push([A.X(p[0]), A.Y(p[1])]));
      pts.push([A.X(TMAX), A.Y(Math.log10(m.PfS))]);
      return { pts, dead: false };
    }
    if (m.merged) { pts.push([A.X(m.tau), A.Y(ymin)]); return { pts, dead: true }; }
    pts.push([A.X(m.tau), A.Y(Math.log10(m.Pce))]);
    m.trk.forEach(p => pts.push([A.X(p[0]), A.Y(p[1])]));
    return { pts, dead: false };
  }

  function drawTrack(m) {
    if (!TW) return;
    tctx.clearRect(0, 0, TW, TH);
    const TMAX = Math.max(400, Math.ceil((m.tcl + 60) / 100) * 100);
    const ymin = 0.4, ymax = 4.6;
    const A = FK.axes(tctx, {
      l: 44, t: 12, r: TW - 10, b: TH - 30,
      x: { min: 0, max: TMAX, n: 4, label: 'time since the cluster formed  (Myr)' },
      y: {
        min: ymin, max: ymax, label: 'orbital period', minor: false,
        ticks: { step: 1, values: [1, 2, 3, 4] },
        fmt: v => { const h = Math.pow(10, v); return h < 48 ? h.toFixed(0) + ' h' : Math.round(h / 24) + ' d'; }
      },
      grid: false, yTitleGap: 34
    });
    tAx = A;

    FK.inBox(tctx, A.box, () => {
      tctx.save();
      tctx.fillStyle = 'rgba(24,20,14,.34)';
      tctx.fillRect(A.X(m.tcl), A.box.t, Math.max(0, A.box.r - A.X(m.tcl)), A.box.b - A.box.t);
      tctx.restore();
      tctx.save();
      tctx.strokeStyle = 'rgba(216,206,180,.42)'; tctx.lineWidth = 1; tctx.setLineDash([3, 3]);
      tctx.beginPath(); tctx.moveTo(FK.snap(A.X(m.tcl)), A.box.t);
      tctx.lineTo(FK.snap(A.X(m.tcl)), A.box.b); tctx.stroke();
      tctx.restore();

      const yo = A.Y(Math.log10(P_OBS_H));
      poly(tctx, [[A.box.l, yo], [A.box.r, yo]],
        { stroke: 'rgba(99,179,148,.85)', width: 1.3, dash: [5, 3] });

      /* the α family only means anything on the common-envelope branch */
      if (m.channel !== 'stable') {
        BSE_ALPHA.forEach(b => {
          if (Math.abs(b.a - m.alpha) < 0.005) return;
          const T = fullTrack(solve(b.a, m.lam, m.M1, m.tcl, m.M2, m.ci), A, ymin, TMAX);
          poly(tctx, T.pts, { stroke: 'rgba(216,206,180,.26)', width: 1.1 });
          const last = T.pts[T.pts.length - 1];
          if (last[0] < A.box.r - 4 && last[1] > A.box.t + 6) {
            FK.text(tctx, 'α=' + b.a, Math.min(last[0] + 5, A.box.r - 30), last[1] + 3,
              { font: FK.mono(8.5), fill: C.faint });
          }
        });
      }

      const T = fullTrack(m, A, ymin, TMAX);
      poly(tctx, T.pts, {
        stroke: m.channel === 'stable' ? C.mint
              : m.verdict === 'cv' ? C.amber : m.verdict === 'merge' ? '#d9703c'
              : m.verdict === 'tight' ? '#d98f4c' : '#8ba9cf',
        width: 2.0
      });

      const f = frame(s, m);
      const preCE = f.core < 0.02;
      const Mtot = m.channel === 'stable' ? f.Mp + f.Ms
                                          : m.M1 + (m.Mc - m.M1) * f.core + m.M2;
      const Pn = pFromA(f.a * Rsun, Mtot * Msun) / 3600;
      if (!(m.merged && IS.post[f.key])) {
        tctx.save(); tctx.fillStyle = C.ink;
        tctx.beginPath();
        tctx.arc(A.X(FK.clamp(f.t, 0, TMAX)),
          A.Y(FK.clamp(Math.log10(Math.max(Pn, 0.1)), ymin, ymax)), 3.4, 0, 7);
        tctx.fill(); tctx.restore();
      }
      if (m.verdict === 'cv') {
        tctx.save(); tctx.strokeStyle = C.mint; tctx.lineWidth = 1.4;
        tctx.beginPath(); tctx.arc(A.X(FK.clamp(m.tEnd, 0, TMAX)), yo, 4.6, 0, 7);
        tctx.stroke(); tctx.restore();
      }
      if (m.channel === 'stable') {
        FK.text(tctx, 'stable RLOF — no common envelope, no 6.30 h',
          A.box.l + 10, A.box.b - 10, { font: FK.mono(9), fill: C.mint });
      }
    });

    FK.text(tctx, 'cluster age', A.X(m.tcl) - 5, A.box.t + 11,
      { font: FK.mono(8.5), fill: C.dim, align: 'right' });
    FK.text(tctx, P_OBS_H.toFixed(2) + ' h  (SDSS-V)', A.box.r - 4,
      A.Y(Math.log10(P_OBS_H)) - 5, { font: FK.mono(8.5), fill: 'rgba(99,179,148,.95)', align: 'right' });

    if (hover != null && tAx) {
      const what = m.channel === 'stable'
        ? (hover < m.tau ? 'both on the main sequence'
           : hover < m.tEnd ? 'stable transfer' : 'detached, ratio reversed')
        : hover < m.tau ? 'pre-CE, orbit unchanged'
        : m.merged ? 'merged at ' + m.tau.toFixed(0) + ' Myr'
        : hover < m.tEnd ? 'detached, grinding down'
        : m.verdict === 'cv' || m.verdict === 'tight' ? 'mass transfer'
        : 'still detached';
      FK.chip(tctx, tAx.X(hover), tAx.box.t + 30,
        [hover.toFixed(0) + ' Myr', what], tAx.box);
    }
  }

  /* ================= plumbing ================= */
  function resize() {
    const a = FK.fit(canvas, ctx); if (a) { W = a.w; H = a.h; }
    const b = FK.fit(trackEl, tctx); if (b) { TW = b.w; TH = b.h; }
  }
  function render() { const m = cur(); drawScene(m); drawTrack(m); }

  resize(); render();
  const anim = FK.loop(canvas, dt => {
    const m = cur();
    const f = frame(s, m);
    /* Kepler's third law drives the drawn motion, not an easing curve:
       Ω = 2π/P with P taken from the current separation and the current
       masses. That is the whole point of the figure — the binary visibly
       whirls up as the orbit collapses, and slows again when stable
       transfer widens it. The true speed-up across the spiral-in is ~4000×,
       more than any screen can show, so the rate is clipped and whatever is
       left over is printed on the plate as a time compression. */
    const kep = m.P0h / Math.max(pNowH(f, m), 1e-9);
    const rate = Math.min(kep, ORB_CAP);
    timeSquash = kep / rate;
    orb = (orb + 0.010 * rate * speed * dt) % (2 * Math.PI);
    spin = (spin + 0.055 * speed * dt) % (2 * Math.PI);
    dn = (dn + 0.0022 * speed * dt) % 1;               // dwarf-nova duty cycle
    s = (s + 0.0015 * speed * dt) % 1;
    render();
  });
  FK.onResize(canvas, () => { resize(); render(); });
  FK.onResize(trackEl, () => { resize(); render(); });

  FK.pointer(canvas, { drag: p => { s = FK.clamp(p.x / Math.max(1, p.w), 0, 0.999); render(); } });
  FK.pointer(trackEl, {
    move: p => { hover = tAx ? FK.clamp(tAx.invX(p.x), 0, tAx.invX(tAx.box.r)) : null; render(); },
    leave: () => { hover = null; render(); }
  });

  const on = (el, fn) => el && el.addEventListener('input', () => { if (fn) fn(); render(); });
  on(inp.alpha); on(inp.lam); on(inp.m1); on(inp.m2);
  on(inp.speed, () => { speed = +inp.speed.value; });

  if (inp.age) inp.age.addEventListener('click', () => {
    ageIdx = (ageIdx + 1) % AGES.length;
    inp.age.textContent = 'Cluster age: ' + AGES[ageIdx] + ' Myr';
    render();
  });
  if (inp.cs) inp.cs.addEventListener('click', () => {
    caseIdx = (caseIdx + 1) % CASES.length;
    inp.cs.textContent = CASES[caseIdx].name;
    render();
  });
  if (inp.cs) inp.cs.textContent = CASES[caseIdx].name;
  if (inp.pause) inp.pause.addEventListener('click', () => {
    anim.paused = !anim.paused;
    inp.pause.textContent = anim.paused ? 'Play' : 'Pause';
    inp.pause.setAttribute('aria-pressed', String(anim.paused));
    render();
  });
  if (inp.age) inp.age.textContent = 'Cluster age: ' + AGES[ageIdx] + ' Myr';
  anim.start();
})();
