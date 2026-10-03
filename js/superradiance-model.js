/* Lin et al., Phys. Lett. B 819 (2021) 136392, arXiv:2105.02161.
 * Dimensionless units G = c = hbar = M = 1; positive-frequency scalar modes.
 * These strict sufficient conditions do not solve the mode spectrum or growth.
 */
(function (root) {
  'use strict';
  function classify(p) {
    const { family, mu, omega, k = 1, eta = 0, m = 1 } = p;
    if (!['kerr', 'kn'].includes(family) || ![mu, omega, k, eta, m].every(Number.isFinite) ||
        mu <= 0 || omega <= 0 || k < 0 || k > 1 || !Number.isInteger(m) || m < 1) {
      throw new RangeError('Expected positive scalar mass/frequency, 0 <= a/M <= 1, and positive integer m.');
    }
    if (family === 'kn' && k === 1 && eta !== 0) {
      throw new RangeError('Extremality with a/M = 1 implies Q = 0 and qQ = 0.');
    }
    const spin = family === 'kerr' ? 1 : k;
    const charge = family === 'kerr' ? 0 : eta;
    const omegaC = (m * spin + charge) / (1 + spin * spin);
    const ratioBound = Math.sqrt((3 * spin * spin + 2) / (spin * spin + 2));
    // Exclude floating-point equality from the paper's strict inequalities.
    const below = (a, b) => a < b - 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
    const superradiant = below(omega, omegaC);
    const bound = below(omega, mu);
    const theorem = family === 'kerr' ? below(Math.sqrt(3) * omega, mu) :
      charge > 0 && below(omega, charge) && below(ratioBound * charge, mu);
    const stable = superradiant && bound && theorem;
    const status = !superradiant ? 'no-amplification' : !bound ? 'unbound' : stable ? 'stable' : 'unresolved';
    return { spin, charge, blackHoleCharge: Math.sqrt(Math.max(0, 1 - spin * spin)),
      omegaC, ratioBound, superradiant, bound, theorem, stable, status };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { classify };
  else root.SuperradianceModel = Object.freeze({ classify });
})(typeof window !== 'undefined' ? window : globalThis);
