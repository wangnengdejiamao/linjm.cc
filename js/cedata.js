/* =================================================================
   cedata.js — the measured and computed numbers behind Fig. 4.

   Nothing here is invented for the figure. The period is a SDSS-V
   BOSS measurement; the donor is the Knigge (2011) semi-empirical CV
   donor sequence evaluated at that period; the grid line is a COSMIC
   (BSE) population-synthesis run at the cluster's metallicity.
   ================================================================= */
window.CE_DATA = {
  target: 'NS Per',
  cluster: 'NGC 1528',

  /* SDSS-V BOSS spectroscopy (DR19, CLASS = CV, Hα in emission) */
  P_orb_h: 6.2994,

  /* Knigge (2011) donor sequence at P = 6.30 h */
  donor: { M2: 0.55, R2: 0.63, Teff: 4180, sp: 'K7–M0' },

  /* the cluster age is genuinely disputed — three literature values,
     and the CE constraint tightens or loosens with the one you pick:
     110 Myr (Peña+ 2019, uvby-β — the young outlier), 209 Myr
     (Hunt & Reffert 2023, Gaia DR3), and 400 Myr — the long-standing
     consensus band (Dias+ 2021: 385; Bossini+ 2019: 394; Sharma+ 2006:
     400; Cavallo+ 2024: 437), which is also the only age that admits
     the COSMIC hits arriving as late as t = 386 Myr */
  cluster_ages_myr: [110, 209, 400],

  /* COSMIC v3.6.1 grid, [Fe/H] = −0.31 (Z = 0.0098), 924 systems per
     α, integrated to 500 Myr, CV window P = 0.2–0.4 d */
  bse: {
    code: 'COSMIC v3.6.1', n_per_alpha: 924, feh: -0.31,
    merger_fraction: 0.87,
    alpha: [
      { a: 0.2, hits: 6, t_myr: [72.5, 197.6], mwd: [0.828, 0.975] },
      { a: 0.3, hits: 7, t_myr: [76.1, 386.3], mwd: [0.915, 1.064] },
      { a: 0.5, hits: 0 },
      { a: 1.0, hits: 0 }
    ]
  },

  /* what a single time-resolved spectrum would test: radial-velocity
     semi-amplitudes at i = 90°, for the three white-dwarf masses the
     grid allows */
  predictions: [
    { mwd: 0.83, q: 0.663, a_rsun: 1.921, K1: 147.6, K2: 222.7 },
    { mwd: 0.95, q: 0.579, a_rsun: 1.975, K1: 139.6, K2: 241.1 },
    { mwd: 1.06, q: 0.519, a_rsun: 2.022, K1: 133.0, K2: 257.0 }
  ]
};
