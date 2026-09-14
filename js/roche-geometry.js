/*
 * Geometry for an explanatory binary-evolution animation, not a stellar or
 * hydrodynamic simulation. A stays at (0,0), B at (1,0); q = M_B / M_A.
 * Units: separation a = 1, G(M_A + M_B) = 1, orbital angular speed Omega = 1.
 * Coordinates corotate with a circular, synchronous, point-mass binary.
 * Roche equipotentials cease to be an appropriate description inside a CE.
 *
 * Sources: Roche potential in A&A 661, A123 (2022), section on synchronized
 * Roche binaries: https://www.aanda.org/articles/aa/pdf/2022/05/aa43094-22.pdf
 * Ballistic equations follow Newton's law in that rotating coordinate system;
 * pressure, magnetic fields, stream thickness and disc hydrodynamics are absent.
 * A chosen target/disc radius and launch perturbation are illustrative inputs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EvolutionGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const cache = new Map();

  function validQ(q) {
    if (!Number.isFinite(q) || q <= 0) throw new RangeError('q = M_B / M_A must be positive and finite.');
  }
  function bisect(fn, lo, hi, iterations = 70) {
    let fLo = fn(lo);
    if (fLo === 0) return lo;
    if (fn(hi) === 0) return hi;
    if (fLo * fn(hi) > 0) throw new Error('Root is not bracketed.');
    for (let k = 0; k < iterations; k++) {
      const mid = (lo + hi) / 2, fMid = fn(mid);
      if (fMid === 0) return mid;
      if (fLo * fMid <= 0) hi = mid;
      else { lo = mid; fLo = fMid; }
    }
    return (lo + hi) / 2;
  }

  function geometry(q, options = {}) {
    validQ(q);
    const samples = options.samples === undefined ? 256 : options.samples;
    if (!Number.isInteger(samples) || samples < 32 || samples % 2 !== 0)
      throw new RangeError('samples must be an even integer >= 32.');
    const key = q + ':' + samples;
    if (cache.has(key)) return cache.get(key);
    const massA = 1 / (1 + q), massB = q / (1 + q), barycenter = massB;
    function phi(x, y = 0) {
      return -massA / Math.hypot(x, y) - massB / Math.hypot(x - 1, y)
        - ((x - barycenter) ** 2 + y * y) / 2;
    }
    function gradient(x, y = 0) {
      const rA3 = Math.hypot(x, y) ** 3, rB3 = Math.hypot(x - 1, y) ** 3;
      return { x: massA * x / rA3 + massB * (x - 1) / rB3 - (x - barycenter),
        y: massA * y / rA3 + massB * y / rB3 - y };
    }
    const l1x = bisect(x => gradient(x, 0).x, 1e-12, 1 - 1e-12);
    const l1 = Object.freeze({ x: l1x, y: 0 }), phiL1 = phi(l1x, 0);

    // First outward crossing of Phi_L1 around each centre. The direction to
    // L1 only touches the saddle, rather than crossing it, so pin it exactly.
    function lobe(center, towardIndex) {
      const extent = Math.abs(l1x - center), points = [];
      for (let i = 0; i < samples; i++) {
        if (i === towardIndex) { points.push(l1); continue; }
        const theta = i * Math.PI * 2 / samples, cx = Math.cos(theta), cy = Math.sin(theta);
        const fn = r => phi(center + r * cx, r * cy) - phiL1;
        let lo = extent * 1e-9, hi = extent;
        // Scan rather than assume the outermost root: the centrifugal term
        // can produce additional crossings outside the closed Roche lobe.
        let found = false;
        for (let j = 1; j <= 128; j++) {
          hi = extent * 1.3 * j / 128;
          if (fn(hi) >= 0) { found = true; break; }
          lo = hi;
        }
        if (!found) throw new Error('Unable to bracket a Roche contour for q=' + q + ', angle=' + theta);
        const r = bisect(fn, lo, hi);
        points.push(Object.freeze({ x: center + r * cx, y: r * cy }));
      }
      points.push(points[0]);
      return Object.freeze(points);
    }
    const lobes = Object.freeze({ A: lobe(0, 0), B: lobe(1, samples / 2) });
    const minimumRadius = (points, center) => Math.min(...points.map(p => Math.hypot(p.x - center, p.y)));
    const result = Object.freeze({ q, massA, massB, barycenter, l1, L1: l1x,
      phiL1, phi, gradient, lobes,
      A: Object.freeze({ x: 0, y: 0, mass: massA, lobe: lobes.A }),
      B: Object.freeze({ x: 1, y: 0, mass: massB, lobe: lobes.B }),
      minimumLobeRadius: Object.freeze({ A: minimumRadius(lobes.A, 0), B: minimumRadius(lobes.B, 1) }) });
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  }

  /*
   * Nested Roche equipotential for explanatory pre-contact shape changes.
   * `fill` is the SIDE-RADIUS ratio: the +y radius measured perpendicular to
   * the line of centres, divided by that same radius on the critical lobe.
   * It is NOT R/R_L for a volume-equivalent sphere and is NOT a measured R/a.
   * Returns the same 257-point ordering/closure as geometry(q).lobes[which].
   * fill=1 returns that exact critical array, including the pinned L1 saddle.
   * For fill<1, each point is the first radial root INSIDE its critical point.
   */
  function underfilledSurface(q, which, fill) {
    if (which !== 'A' && which !== 'B') throw new RangeError('which must be A or B.');
    if (!Number.isFinite(fill) || fill <= 0 || fill > 1)
      throw new RangeError('Side-radius fill must satisfy 0 < fill <= 1.');
    const g = geometry(q), critical = g.lobes[which];
    if (fill === 1) return critical;
    const center = g[which].x, samples = critical.length - 1;
    const sideRadius = critical[samples / 4].y;
    const targetPotential = g.phi(center, sideRadius * fill);
    const points = [];
    for (let i = 0; i < samples; i++) {
      const theta = i * Math.PI * 2 / samples;
      const dx = Math.cos(theta), dy = Math.sin(theta);
      const criticalRadius = Math.hypot(critical[i].x - center, critical[i].y);
      // The interior radial potential increases from the stellar singularity
      // to this first critical-lobe intersection. Its nested equipotential
      // therefore has one radial root before the supplied critical bound.
      const fn = r => g.phi(center + r * dx, r * dy) - targetPotential;
      const r = bisect(fn, 0, criticalRadius);
      points.push(Object.freeze({ x: center + r * dx, y: r * dy }));
    }
    points.push(points[0]);
    return Object.freeze(points);
  }

  function rk4(s, h, derivative) {
    const add = (a, k, scale) => a.map((v, i) => v + k[i] * scale);
    const k1 = derivative(s), k2 = derivative(add(s, k1, h / 2));
    const k3 = derivative(add(s, k2, h / 2)), k4 = derivative(add(s, k3, h));
    return s.map((v, i) => v + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
  }

  function ballistic(q, donor = 'B', diskRadius, options = {}) {
    const g = geometry(q);
    if (donor !== 'A' && donor !== 'B') throw new RangeError('donor must be A or B.');
    const accretor = donor === 'A' ? 'B' : 'A', targetX = g[accretor].x;
    const direction = donor === 'B' ? -1 : 1;
    const radius = diskRadius === undefined ? g.minimumLobeRadius[accretor] * 0.65 : diskRadius;
    if (!Number.isFinite(radius) || radius <= 0 || radius >= g.minimumLobeRadius[accretor])
      throw new RangeError('Target radius must be positive and fit wholly within the accretor Roche lobe.');
    const hBase = options.step === undefined ? 0.002 : options.step;
    const epsilon = options.launchOffset === undefined ? 1e-4 : options.launchOffset;
    const speed = options.launchSpeed === undefined ? 1e-3 : options.launchSpeed;
    if (!(hBase > 0 && hBase <= 0.02 && epsilon > 0 && epsilon < 0.01 && speed > 0 && speed < 0.1))
      throw new RangeError('Use 0 < step <= .02, 0 < launchOffset < .01, 0 < launchSpeed < .1.');
    function derivative(s) {
      const grad = g.gradient(s[0], s[1]);
      return [s[2], s[3], -grad.x + 2 * s[3], -grad.y - 2 * s[2]];
    }
    const distance = s => Math.hypot(s[0] - targetX, s[1]);
    const jacobi = s => -2 * g.phi(s[0], s[1]) - s[2] ** 2 - s[3] ** 2;
    const record = s => Object.freeze({ x: s[0], y: s[1], vx: s[2], vy: s[3] });
    let state = [g.L1 + direction * epsilon, 0, direction * speed, 0];
    const points = [record(state)], initialJacobi = jacobi(state);
    let maxJacobiDrift = 0, stopReason = 'step-limit', time = 0;
    for (let i = 0; i < 25000; i++) {
      // Resolve increasing acceleration near the accretor without swallowing
      // its singularity. This is still a cold test-particle approximation.
      const h = Math.min(hBase, 0.02 * Math.sqrt(distance(state) ** 3 / g[accretor].mass));
      let next = rk4(state, h, derivative);
      if (!next.every(Number.isFinite)) { stopReason = 'numerical-failure'; break; }
      if (distance(next) <= radius) {
        // Event location: integrate a fractional step to the disc/surface,
        // avoiding a straight-line endpoint snap which changes the trajectory.
        const hh = bisect(dt => distance(rk4(state, dt, derivative)) - radius, 0, h, 48);
        next = rk4(state, hh, derivative); time += hh;
        points.push(record(next)); maxJacobiDrift = Math.max(maxJacobiDrift, Math.abs(jacobi(next) - initialJacobi));
        state = next; stopReason = 'target'; break;
      }
      const oldRadialVelocity = (state[0] - targetX) * state[2] + state[1] * state[3];
      const newRadialVelocity = (next[0] - targetX) * next[2] + next[1] * next[3];
      if (oldRadialVelocity < 0 && newRadialVelocity >= 0) {
        const hh = bisect(dt => {
          const p = rk4(state, dt, derivative);
          return (p[0] - targetX) * p[2] + p[1] * p[3];
        }, 0, h, 48);
        next = rk4(state, hh, derivative); time += hh;
        points.push(record(next)); maxJacobiDrift = Math.max(maxJacobiDrift, Math.abs(jacobi(next) - initialJacobi));
        state = next; stopReason = 'missed-target'; break;
      }
      time += h; state = next; points.push(record(state));
      maxJacobiDrift = Math.max(maxJacobiDrift, Math.abs(jacobi(state) - initialJacobi));
      if (distance(state) > 2) { stopReason = 'escaped'; break; }
    }
    return Object.freeze({ q, donor, accretor, targetRadius: radius, points: Object.freeze(points),
      stopReason, hitTarget: stopReason === 'target', elapsedDynamicalTime: time,
      initialJacobi, maxJacobiDrift, endpointRadius: distance(state),
      approximation: 'Cold test particles in a circular, corotating Roche potential; illustrative launch and target radius.' });
  }

  // Apply this transform equally to stars, lobes, L1, stream and disc. With
  // projection = 1 it is an orbital-plane view; projected spheres need their
  // own depth ordering if the caller chooses a value below 1.
  function transform(point, options = {}) {
    const { q = 1, angle = 0, separation = 1, centerX = 0, centerY = 0, projection = 1 } = options;
    validQ(q);
    const x = point.x - q / (1 + q), y = point.y;
    const co = Math.cos(angle), si = Math.sin(angle);
    return { x: centerX + separation * (x * co - y * si),
      y: centerY + separation * projection * (x * si + y * co) };
  }

  return Object.freeze({ geometry, underfilledSurface, ballistic, transform });
});
