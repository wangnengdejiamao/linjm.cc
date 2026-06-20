/* =================================================================
   Cyclotron spectrum lab — drag B and watch the harmonic humps move.
   Harmonics sit at  λ_n ≈ 107.1 / (n · B[MG])  µm  (= 1.071e6/(nB) Å).
   Hump strengths use a simple constant-Λ-flavoured envelope; this is a
   teaching schematic, not a published fit.
   ================================================================= */
(function () {
  const canvas = document.getElementById('specCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const sB = document.getElementById('specB');
  const sT = document.getElementById('specT');
  const sTh = document.getElementById('specTheta');
  const oB = document.getElementById('specBval');
  const oT = document.getElementById('specTval');
  const oTh = document.getElementById('specThetaval');
  const oH = document.getElementById('specHarm');
  const chips = document.querySelectorAll('.spec-presets .chip');

  const LAM0 = 3200, LAM1 = 9800;      // plotted band (Å)
  let W = 0, H = 0;

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }
  const x = lam => 40 + (W - 55) * (lam - LAM0) / (LAM1 - LAM0);
  const lamToRGB = lam => {            // approximate visible spectrum colour
    const nm = lam / 10; let r=0,g=0,b=0;
    if (nm<440){r=-(nm-440)/60;b=1;} else if(nm<490){g=(nm-440)/50;b=1;}
    else if(nm<510){g=1;b=-(nm-510)/20;} else if(nm<580){r=(nm-510)/70;g=1;}
    else if(nm<645){r=1;g=-(nm-645)/65;} else {r=1;}
    return `rgb(${r*255|0},${g*255|0},${b*255|0})`;
  };

  function spectrum(lam, B, kT, thDeg) {
    const th = thDeg * Math.PI / 180;
    // hot WD-ish continuum: blue, declining to the red (schematic)
    const cont = 0.30 + 0.55 * Math.pow(4500 / lam, 1.3);
    // cyclotron humps
    let hump = 0;
    const nPeak = 3.0 + kT * 0.32;          // hotter -> peak shifts to higher harmonics
    const nWid  = 1.4 + kT * 0.12;
    const beam  = 0.35 + 0.65 * Math.sin(th) * Math.sin(th);
    for (let n = 2; n <= 14; n++) {
      const ln = 1.071e6 / (n * B);          // Å
      if (ln < LAM0 - 400 || ln > LAM1 + 400) continue;
      const env = Math.exp(-Math.pow((n - nPeak) / nWid, 2));
      const sig = ln * (0.045 + kT * 0.008);  // thermal width grows with kT
      hump += env * beam * Math.exp(-Math.pow((lam - ln) / sig, 2));
    }
    return { y: cont + 1.15 * hump, cont };
  }

  function visibleHarmonics(B) {
    const list = [];
    for (let n = 2; n <= 14; n++) {
      const ln = 1.071e6 / (n * B);
      if (ln >= LAM0 && ln <= LAM1) list.push({ n, ln });
    }
    return list;
  }

  function draw() {
    const B = +sB.value, kT = +sT.value, th = +sTh.value;
    oB.textContent = B.toFixed(1) + ' MG';
    oT.textContent = kT.toFixed(1) + ' keV';
    oTh.textContent = th + '°';
    ctx.clearRect(0, 0, W, H);

    const padT = 18, padB = 34, y0 = H - padB, y1 = padT;
    const yMax = 2.2;
    const Y = v => y0 - (y0 - y1) * Math.min(v, yMax) / yMax;

    // faint spectral colour strip along the wavelength axis
    for (let lam = 3900; lam <= 7000; lam += 12) {
      ctx.fillStyle = lamToRGB(lam); ctx.globalAlpha = 0.10;
      ctx.fillRect(x(lam), y1, (W-55)/((7000-3900)/12)+1, y0 - y1);
    }
    ctx.globalAlpha = 1;

    // axes
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, y0); ctx.lineTo(W-15, y0); ctx.stroke();
    ctx.fillStyle = 'rgba(170,182,212,.8)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    for (let lam = 4000; lam <= 9000; lam += 1000) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.moveTo(x(lam), y1); ctx.lineTo(x(lam), y0); ctx.stroke();
      ctx.fillText(lam, x(lam), y0 + 16);
    }
    ctx.fillText('wavelength (Å)', W/2, H - 4);
    ctx.save(); ctx.translate(12, (y0+y1)/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('flux (arb.)', 0, 0); ctx.restore();

    // continuum (dashed) + total spectrum (filled)
    ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(170,182,212,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let p = 0; p <= W; p += 3) { const lam = LAM0 + (LAM1-LAM0)*(p-40)/(W-55);
      const s = spectrum(lam, B, kT, th); p?ctx.lineTo(x(lam),Y(s.cont)):ctx.moveTo(x(lam),Y(s.cont)); }
    ctx.stroke(); ctx.setLineDash([]);

    const grad = ctx.createLinearGradient(0, y1, 0, y0);
    grad.addColorStop(0, 'rgba(79,208,227,.45)'); grad.addColorStop(1, 'rgba(79,208,227,.04)');
    ctx.beginPath(); ctx.moveTo(x(LAM0), y0);
    for (let p = 40; p <= W-15; p += 2) { const lam = LAM0 + (LAM1-LAM0)*(p-40)/(W-55);
      ctx.lineTo(x(lam), Y(spectrum(lam, B, kT, th).y)); }
    ctx.lineTo(x(LAM1), y0); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.strokeStyle = '#4fd0e3'; ctx.lineWidth = 2; ctx.beginPath();
    for (let p = 40; p <= W-15; p += 2) { const lam = LAM0 + (LAM1-LAM0)*(p-40)/(W-55);
      const yy = Y(spectrum(lam, B, kT, th).y); (p===40)?ctx.moveTo(x(lam),yy):ctx.lineTo(x(lam),yy); }
    ctx.stroke();

    // harmonic labels
    const harm = visibleHarmonics(B);
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    for (const {n, ln} of harm) {
      const yy = Y(spectrum(ln, B, kT, th).y);
      ctx.strokeStyle = 'rgba(230,159,0,.4)'; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(x(ln), yy-4); ctx.lineTo(x(ln), y1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,200,120,.95)';
      ctx.fillText('n=' + n, x(ln), y1 + 10);
    }
    oH.textContent = harm.length ? harm.map(h => h.n).join(', ') : 'none in band';
  }

  [sB, sT, sTh].forEach(s => s.addEventListener('input', draw));
  chips.forEach(c => c.addEventListener('click', () => {
    chips.forEach(o => o.classList.remove('active'));
    c.classList.add('active');
    sB.value = c.dataset.b; draw();
  }));

  resize();
  window.addEventListener('resize', resize);
})();
