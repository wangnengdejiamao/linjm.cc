/* =================================================================
   aihero.js — the plate beside "Astronomy intelligence you can audit".

   What used to be here was a constellation of glowing dots joined by
   Bézier curves. It is the house style of every AI landing page since
   2023, it depicts nothing, and it is the single clearest signal that
   a page was assembled rather than designed.

   What replaces it is the claim the headline makes, drawn: a question
   goes in; two retrieval tracks (dense vectors and BM25) each return
   candidates; a cross-encoder reranks twenty down to five; the answer
   is written only from what survived — and when nothing survives, the
   system says so instead of answering.

   The third query in the loop is refused. That is the point of the
   figure; everything before it is the setup.
   ================================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('aiHeroCanvas');
  if (!canvas || !window.UI) return;
  const ctx = canvas.getContext('2d');
  const U = window.UI, C = U.C, E = U.E;

  const STAGES = ['recall', 'rerank', 'ground', 'verdict'];
  const stageEls = Array.from(document.querySelectorAll('.ai-viz-stages span'));

  /* ---------------------------------------------------------------
     Three questions. Two the corpus can answer, one it cannot.
     The source keys are the real bibcodes of my own papers, because a
     figure about provenance should not invent its provenance.
     --------------------------------------------------------------- */
  const QUERIES = [
    {
      q: 'Does ZTF J0112+5827 show resolved cyclotron humps?',
      cites: [
        ['2025A&A…J.Lin', '§3.1 · three humps, 4400–7200 Å', .94],
        ['2025A&A…J.Lin', '§3.3 · phase-resolved spectra', .91],
        ['2025ApJS…W.Hou', 'DESI DR1 CV catalogue', .78],
        ['Ferrario+2015', 'polar cyclotron review', .74],
        ['Campbell+2008', 'harmonic spacing ∝ B', .69]
      ],
      verdict: 'supported', line: '5 / 5 citations resolve to retrieved text',
      answer: 'Yes — three humps between 4400 and 7200 Å, resolved in the phase-resolved spectra.'
    },
    {
      q: 'What is the magnetic field strength of ZTF J0112+5827?',
      cites: [
        ['2025A&A…J.Lin', '§4.2 · B ≈ 38 MG (n = 3,4,5)', .96],
        ['2025A&A…J.Lin', '§4.2 · B ≈ 26 MG (n = 4,5,6)', .93],
        ['2026ApJ…J.Lin', 'automated χ²(B) profiling', .86],
        ['Schwope+1990', 'harmonic-assignment degeneracy', .71],
        ['Ferrario+2015', 'polar field distribution', .64]
      ],
      verdict: 'branched', line: 'two harmonic branches survive — both reported, neither collapsed',
      answer: 'Two values survive the evidence: B ≈ 38 MG and B ≈ 26 MG. The harmonic assignment is degenerate, so both branches are reported.'
    },
    {
      q: 'Has a magnetic white dwarf been confirmed in NGC 2168?',
      cites: [
        ['Williams+2006', 'NGC 2168 WD cooling sequence', .41],
        ['Kalirai+2005', 'cluster WD photometry', .37],
        ['2026ApJ…J.Lin', 'UPK 13 disk-eclipsing binary', .29],
        ['Ferrario+2015', 'MWD incidence in clusters', .26],
        ['Bagnulo+2021', 'spectropolarimetric MWD survey', .22]
      ],
      verdict: 'refused', line: 'no retrieved passage states this — answer withheld',
      answer: null
    }
  ];

  /* Twenty candidates per query: ten dense, ten sparse. Deterministic
     pseudo-random, so the figure is the same every reload. */
  function seeded(s) {
    let v = s >>> 0;
    return () => (v = (v * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  const POOL = QUERIES.map((Q, qi) => {
    const rnd = seeded(9127 + qi * 733);
    const top = Q.cites.map(c => c[2]);
    const out = [];
    for (let i = 0; i < 20; i++) {
      const survivor = i < 5;
      out.push({
        track: i % 2 === 0 ? 'dense' : 'sparse',
        score: survivor ? top[i] : (Q.verdict === 'refused' ? .05 + rnd() * .20 : .10 + rnd() * .42),
        survivor,
        jitter: rnd()
      });
    }
    /* shuffle so the survivors are not the first five on screen */
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  });

  /* ---------------------------------------------------------------
     Timeline. One query is a 15-second cycle in four acts.
     --------------------------------------------------------------- */
  const ACT = { type: 2.1, recall: 4.0, rerank: 2.6, ground: 3.0, hold: 3.3 };
  const CYCLE = ACT.type + ACT.recall + ACT.rerank + ACT.ground + ACT.hold;

  let t = 0, qi = 0, box = null;

  function phase() {
    let x = t;
    if (x < ACT.type) return ['type', x / ACT.type];
    x -= ACT.type;
    if (x < ACT.recall) return ['recall', x / ACT.recall];
    x -= ACT.recall;
    if (x < ACT.rerank) return ['rerank', x / ACT.rerank];
    x -= ACT.rerank;
    if (x < ACT.ground) return ['ground', x / ACT.ground];
    x -= ACT.ground;
    return ['hold', x / ACT.hold];
  }

  const VERDICT = {
    supported: { c: C.mint, k: 'SUPPORTED', mark: '✓' },
    branched: { c: C.amber, k: 'BRANCHED', mark: '≡' },
    refused: { c: C.ember, k: 'REFUSED', mark: '✕' }
  };

  /* ---------------------------------------------------------------
     Draw
     --------------------------------------------------------------- */
  function draw() {
    box = U.fit(canvas, ctx);
    if (!box) return;
    const w = box.w, h = box.h;
    const Q = QUERIES[qi], pool = POOL[qi];
    const [ph, k] = phase();
    const s = U.clamp(w / 430, .78, 1.15);   // one scale for the whole plate

    ctx.clearRect(0, 0, w, h);

    const L = 22 * s, R = w - 22 * s;
    let y = 62 * s;

    /* ---------- 1. the question ---------- */
    U.text(ctx, 'QUERY', L, y - 14 * s,
      { font: U.mono(8.5 * s, 500), fill: C.faint, track: '.14em' });
    const shown = ph === 'type'
      ? Q.q.slice(0, Math.ceil(E.out(k) * Q.q.length))
      : Q.q;
    ctx.save();
    ctx.font = U.sans(13 * s, 500);
    const words = shown.split(' ');
    const lines = []; let cur = '';
    words.forEach(word => {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > R - L - 14 * s && cur) { lines.push(cur); cur = word; }
      else cur = test;
    });
    if (cur) lines.push(cur);
    ctx.restore();
    lines.forEach((ln, i) => U.text(ctx, ln, L, y + i * 18 * s,
      { font: U.sans(13 * s, 500), fill: C.ink }));
    if (ph === 'type') {
      ctx.save();
      ctx.font = U.sans(13 * s, 500);
      const cw = ctx.measureText(lines[lines.length - 1] || '').width;
      ctx.fillStyle = C.amber;
      ctx.globalAlpha = Math.sin(t * 9) > 0 ? 1 : .2;
      ctx.fillRect(L + cw + 2 * s, y + (lines.length - 1) * 18 * s - 10 * s, 1.6 * s, 13 * s);
      ctx.restore();
    }
    y += lines.length * 18 * s + 20 * s;

    /* ---------- 2. the two recall tracks ----------
       The list has to hold twenty rows during recall and five after
       the cut, in the same box, without either state looking starved.
       So the row pitch is solved from the space available rather than
       chosen: the twenty rows exactly fill the gap between the query
       and the verdict, and the cut is always under row five. */
    const verdictTop = h - 46 * s - 40 * s;
    const listTop = y + 16 * s;
    const pitch = U.clamp((verdictTop - listTop - 8 * s) / 20, 11 * s, 14 * s);
    const rowH = pitch * .78, gap = pitch - rowH;
    const barX = L + 78 * s, barW = R - barX - 36 * s;

    U.text(ctx, 'DUAL-TRACK RECALL', L, y,
      { font: U.mono(8.5 * s, 500), fill: C.faint, track: '.14em' });

    /* the reranker's cut line, and the survivors' destination */
    const cutY = listTop + 5 * pitch + 3 * s;

    /* how far the reordering has run */
    const sortK = ph === 'rerank' ? E.emphasised(k)
      : (ph === 'ground' || ph === 'hold') ? 1 : 0;
    /* once the citations open, the rejected rows are gone, not faded —
       leaving them at 18% behind a panel is how a figure gets muddy */
    const cull = ph === 'ground' ? E.out(U.clamp(k * 3, 0, 1)) : ph === 'hold' ? 1 : 0;
    U.text(ctx, sortK > .5 ? 'kept 5 of 20' : 'top 20', R, y,
      { font: U.mono(8.5 * s), fill: C.faint, align: 'right' });

    pool.forEach((p, i) => {
      /* pre-rerank position is the pool order; post-rerank the
         survivors rise to the top five slots and the rest sink */
      const survivors = pool.filter(x => x.survivor);
      const rest = pool.filter(x => !x.survivor);
      const target = p.survivor ? survivors.indexOf(p) : 5 + rest.indexOf(p);
      const slot = U.lerp(i, target, sortK);
      const ry = listTop + slot * pitch;
      if (ry > verdictTop - rowH) return;

      /* appear, staggered, during recall */
      const born = ph === 'type' ? 0
        : ph === 'recall' ? U.clamp((k * 1.5 - p.jitter * .5) * 3, 0, 1) : 1;
      if (born <= 0) return;

      const dense = p.track === 'dense';
      const col = dense ? C.steel : C.amber;
      const dead = sortK > .2 && !p.survivor;
      if (dead && cull >= 1) return;
      const alpha = born * (dead ? U.lerp(1, .18, sortK) * (1 - cull) : 1);
      if (alpha <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      /* track tag */
      U.text(ctx, dense ? 'vector' : 'bm25', L, ry + rowH - 1.5 * s,
        { font: U.mono(7.6 * s), fill: dead ? C.faint : U.rgba(col, .9) });
      /* score bar */
      ctx.fillStyle = 'rgba(216,206,180,.09)';
      U.rrect(ctx, barX, ry, barW, rowH, rowH / 2); ctx.fill();
      const len = barW * U.clamp(p.score, .03, 1) * E.out(born);
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, U.rgba(col, dead ? .3 : .55));
      g.addColorStop(1, U.rgba(col, dead ? .4 : 1));
      ctx.fillStyle = g;
      U.rrect(ctx, barX, ry, Math.max(rowH, len), rowH, rowH / 2); ctx.fill();
      U.text(ctx, p.score.toFixed(2), R, ry + rowH - 1.5 * s,
        { font: U.mono(7.8 * s), fill: dead ? C.faint : C.soft, align: 'right' });
      ctx.restore();
    });

    /* the rerank sweep — one pass of the cross-encoder */
    if (ph === 'rerank') {
      const sy = listTop + E.inOut(k) * (20 * pitch);
      const g = ctx.createLinearGradient(0, sy - 26 * s, 0, sy + 4 * s);
      g.addColorStop(0, 'rgba(224,164,92,0)');
      g.addColorStop(1, 'rgba(224,164,92,.14)');
      ctx.fillStyle = g; ctx.fillRect(L, sy - 26 * s, R - L, 30 * s);
      ctx.strokeStyle = U.rgba(C.amber, .8); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, U.snap(sy)); ctx.lineTo(R, U.snap(sy)); ctx.stroke();
    }

    /* the cut */
    if (sortK > .05) {
      ctx.save();
      ctx.globalAlpha = sortK;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = U.rgba(C.amber, .55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, U.snap(cutY)); ctx.lineTo(R, U.snap(cutY)); ctx.stroke();
      ctx.setLineDash([]);
      /* the label sits *on* the rule in a plate-coloured chip, so it
         reads as that rule's name and cannot collide with a score */
      const lab = 'bge cross-encoder · cut';
      ctx.font = U.mono(8 * s, 500);
      const lw = ctx.measureText(lab).width + 12 * s;
      const lx = R - lw;
      ctx.fillStyle = '#241f18';
      U.rrect(ctx, lx, cutY - 7 * s, lw, 14 * s, 3 * s); ctx.fill();
      U.text(ctx, lab, lx + 6 * s, cutY + 3 * s,
        { font: U.mono(8 * s, 500), fill: C.amber, track: '.06em' });
      ctx.restore();
    }

    /* ---------- 3. the citations that survived, and the answer
       written from them. The answer matters as much as the list: the
       claim of the page is that nothing is said that the five rows
       above do not support — so the two are one block. ---------- */
    const groundK = ph === 'ground' ? E.emphasised(k) : ph === 'hold' ? 1 : 0;
    if (groundK > 0) {
      const cliH = 14.5 * s;
      const gy = cutY + 20 * s;
      const ansTop = gy + 12 * s + 5 * cliH + 8 * s;

      /* wrap the answer first, so the panel can be sized to hold it */
      let ansLines = [];
      if (Q.answer) {
        ctx.save(); ctx.font = U.sans(10.6 * s);
        let cur2 = '';
        Q.answer.split(' ').forEach(word => {
          const test = cur2 ? cur2 + ' ' + word : word;
          if (ctx.measureText(test).width > R - L - 22 * s && cur2) { ansLines.push(cur2); cur2 = word; }
          else cur2 = test;
        });
        if (cur2) ansLines.push(cur2);
        ctx.restore();
      } else ansLines = ['— no answer written —'];

      const panelH = (ansTop - gy) + 16 * s + ansLines.length * 14 * s + 26 * s;

      ctx.save();
      ctx.globalAlpha = groundK;
      ctx.fillStyle = 'rgba(20,17,11,.94)';
      U.rrect(ctx, L - 8 * s, gy - 15 * s, R - L + 16 * s, panelH, 7 * s);
      ctx.fill();
      ctx.strokeStyle = C.rule2; ctx.lineWidth = 1; ctx.stroke();
      U.text(ctx, 'GROUNDED CITATIONS', L, gy - 4 * s,
        { font: U.mono(8.5 * s, 500), fill: C.faint, track: '.14em' });

      Q.cites.forEach((c, i) => {
        const cy = gy + 12 * s + i * cliH;
        const a = U.clamp((groundK - i * .1) * 4, 0, 1);
        ctx.globalAlpha = groundK * a;
        ctx.fillStyle = Q.verdict === 'refused' ? U.rgba(C.ember, .5) : U.rgba(C.mint, .85);
        ctx.beginPath(); ctx.arc(L + 3 * s, cy - 3 * s, 2.2 * s, 0, U.TAU); ctx.fill();
        U.text(ctx, c[0], L + 12 * s, cy, { font: U.mono(8.6 * s, 500), fill: C.soft });
        U.text(ctx, U.fitText(ctx, c[1], R - L - 138 * s, U.sans(9.4 * s)), L + 96 * s, cy,
          { font: U.sans(9.4 * s), fill: C.dim });
        U.text(ctx, c[2].toFixed(2), R, cy,
          { font: U.mono(8.6 * s), fill: c[2] >= .5 ? C.soft : C.faint, align: 'right' });
      });

      ctx.globalAlpha = groundK;
      ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, U.snap(ansTop - 4 * s)); ctx.lineTo(R, U.snap(ansTop - 4 * s));
      ctx.stroke();
      U.text(ctx, Q.answer ? 'ANSWER' : 'WITHHELD', L, ansTop + 9 * s,
        { font: U.mono(8.5 * s, 500), fill: Q.answer ? C.faint : U.rgba(C.ember, .9), track: '.14em' });
      ansLines.forEach((ln, i) => U.text(ctx, ln, L, ansTop + 26 * s + i * 14 * s, {
        font: Q.answer ? U.sans(10.6 * s) : U.sans(10.6 * s, 400),
        fill: Q.answer ? C.ink : C.faint
      }));
      ctx.restore();
    }

    /* ---------- 4. the verdict ---------- */
    if (ph === 'hold' || (ph === 'ground' && k > .8)) {
      const a = ph === 'hold' ? U.clamp(k * 6, 0, 1) : U.clamp((k - .8) * 5, 0, 1);
      const v = VERDICT[Q.verdict];
      const bh = 42 * s, by = h - bh - 40 * s;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, (1 - E.spring(a)) * 8 * s);
      U.rrect(ctx, L - 6 * s, by, R - L + 12 * s, bh, 7 * s);
      ctx.fillStyle = U.rgba(v.c, .12); ctx.fill();
      ctx.strokeStyle = U.rgba(v.c, .55); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(L + 12 * s, by + bh / 2, 9 * s, 0, U.TAU);
      ctx.fillStyle = U.rgba(v.c, .22); ctx.fill();
      U.text(ctx, v.mark, L + 12 * s, by + bh / 2 + 4 * s,
        { font: U.sans(11 * s, 700), fill: v.c, align: 'center' });
      U.text(ctx, v.k, L + 28 * s, by + 17 * s,
        { font: U.mono(9.5 * s, 500), fill: v.c, track: '.13em' });
      U.text(ctx, U.fitText(ctx, Q.line, R - L - 40 * s, U.sans(10 * s)), L + 28 * s, by + 31 * s,
        { font: U.sans(10 * s), fill: C.soft });
      ctx.restore();
    }

    /* stage highlight in the HTML rail beneath the plate */
    const active = ph === 'type' ? -1 : STAGES.indexOf(ph === 'hold' ? 'verdict' : ph);
    stageEls.forEach((e, i) => e.classList.toggle('is-on', i === active));
  }

  /* ---------------------------------------------------------------
     Loop. Reduced motion gets the final frame of the refusal, which
     is the frame worth having.
     --------------------------------------------------------------- */
  if (U.reduce) {
    qi = 2; t = CYCLE - .2;
    U.onResize(canvas, draw);
    draw();
    return;
  }

  const anim = U.loop(canvas, dt => {
    t += dt * 0.0333;
    if (t >= CYCLE) { t = 0; qi = (qi + 1) % QUERIES.length; }
    draw();
  }, { fps: 30 });

  U.onResize(canvas, draw);
  draw();
  anim.start();

  /* Click to skip to the next question — the refusal is the one
     people want to see, and nobody should have to wait 30 s for it. */
  canvas.style.cursor = 'pointer';
  canvas.addEventListener('click', () => {
    qi = (qi + 1) % QUERIES.length;
    t = ACT.type + ACT.recall + ACT.rerank + ACT.ground * .9;
    draw();
  });
})();
