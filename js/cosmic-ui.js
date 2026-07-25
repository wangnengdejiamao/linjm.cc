/* Cosmic interface visuals: ambient star field, binary-star hero, AI constellation.
   Canvas only, dependency-free, DPR-aware, and respectful of reduced motion. */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const pointer = { x: 0, y: 0, active: false };

  window.addEventListener('pointermove', event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }, { passive: true });

  function seeded(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function fitCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    let width = 1;
    let height = 1;
    const stage = {
      ctx, onFit: null,
      get width() { return width; },
      get height() { return height; }
    };
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stage.onFit) stage.onFit();
    };
    stage.fit = fit;
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return stage;
  }

  function glowDot(ctx, x, y, radius, color, glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* Paint a first frame synchronously and repaint after every buffer reset,
     so reduced-motion users and restored background tabs never see an empty
     panel; the clock only advances while the canvas is visible. */
  function makeRunner(stage, canvas, draw) {
    if (!canvas) return;
    let visible = true;
    const start = performance.now();
    const paint = () => {
      if (stage.width < 8 || stage.height < 8) return;
      try { draw((performance.now() - start) / 1000); } catch (err) { /* decorative only */ }
    };
    stage.onFit = paint;
    if ('IntersectionObserver' in window && canvas !== document.getElementById('cosmicBackdrop')) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) paint();
      }, { threshold: 0.02 }).observe(canvas);
    }
    paint();
    if (reduceMotion) return;
    const tick = () => {
      if (visible && !document.hidden) paint();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------
     Ambient deep-space field
     ------------------------------------------------------------------ */
  const backdrop = document.getElementById('cosmicBackdrop');
  if (backdrop) {
    const stage = fitCanvas(backdrop);
    const random = seeded(20260722);
    const stars = Array.from({ length: 145 }, (_, index) => ({
      x: random(), y: random(), r: .35 + random() * 1.15,
      a: .16 + random() * .58, phase: random() * TAU, drift: .25 + random() * .75,
      blue: index % 7 === 0
    }));

    makeRunner(stage, backdrop, time => {
      const { ctx, width: w, height: h } = stage;
      ctx.clearRect(0, 0, w, h);
      const px = pointer.active ? (pointer.x / Math.max(1, w) - .5) * 8 : 0;
      const py = pointer.active ? (pointer.y / Math.max(1, h) - .5) * 8 : 0;
      const scroll = window.scrollY * .025;

      stars.forEach((star, index) => {
        const twinkle = reduceMotion ? .72 : .48 + .52 * Math.sin(time * star.drift + star.phase);
        const x = (star.x * w + px * star.r + index * .03) % w;
        const y = ((star.y * h + py * star.r - scroll * star.r) % h + h) % h;
        ctx.globalAlpha = star.a * (.58 + twinkle * .42);
        ctx.fillStyle = star.blue ? '#8be9ff' : '#d9e9f4';
        ctx.fillRect(x, y, star.r, star.r);
      });
      ctx.globalAlpha = 1;
    });
  }

  /* ------------------------------------------------------------------
     Home hero: Jiamao's research map
     cluster white dwarfs -> magnetic compact binaries -> AI systems
     ------------------------------------------------------------------ */
  const heroCanvas = document.getElementById('heroCosmos');
  if (heroCanvas) {
    const stage = fitCanvas(heroCanvas);
    const random = seeded(84);
    const dust = Array.from({ length: 58 }, () => ({
      x: random(), y: random(), r: .35 + random() * 1.05, phase: random() * TAU
    }));
    const cluster = Array.from({ length: 31 }, (_, index) => ({
      angle: random() * TAU,
      radius: Math.pow(random(), .65),
      size: index === 0 ? 3.1 : .7 + random() * 1.6,
      phase: random() * TAU,
      blue: index === 0 || index % 8 === 0
    }));
    const graphNodes = [
      [-.10,-.23],[.08,-.30],[.25,-.15],[-.18,.02],[.05,.02],[.27,.08],[-.08,.25],[.16,.27]
    ];
    const graphEdges = [[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[3,6],[4,5],[4,6],[4,7],[5,7],[6,7]];
    const localPointer = { x: .5, y: .5 };
    heroCanvas.addEventListener('pointermove', event => {
      const rect = heroCanvas.getBoundingClientRect();
      localPointer.x = (event.clientX - rect.left) / rect.width;
      localPointer.y = (event.clientY - rect.top) / rect.height;
    }, { passive: true });
    heroCanvas.addEventListener('pointerleave', () => { localPointer.x = .5; localPointer.y = .5; });

    const quadPoint = (a, c, b, t) => {
      const m = 1 - t;
      return { x: m*m*a.x + 2*m*t*c.x + t*t*b.x, y: m*m*a.y + 2*m*t*c.y + t*t*b.y };
    };
    const roundedRectPath = (ctx, x, y, width, height, radius) => {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);ctx.quadraticCurveTo(x, y, x + r, y);ctx.closePath();
    };

    /* The panel is near-square on desktop and wide on tablet, so the story
       flows along the diagonal — observation (top-left) -> physics (centre)
       -> agent systems (bottom-right) — instead of a cramped horizontal row. */
    makeRunner(stage, heroCanvas, time => {
      const { ctx, width: w, height: h } = stage;
      const s = Math.min(w, h);
      const dx = (localPointer.x - .5) * 10;
      const dy = (localPointer.y - .5) * 8;
      const clusterC = { x: w * .27 + dx * .35, y: h * .28 + dy * .35 };
      const binaryC = { x: w * .54 + dx * .55, y: h * .50 + dy * .55 };
      const phoneC = { x: w * .80 + dx * .75, y: h * .76 + dy * .75 };
      const graphC = { x: phoneC.x - s * .16, y: phoneC.y - s * .06 };
      ctx.clearRect(0, 0, w, h);

      const haze = ctx.createRadialGradient(binaryC.x, binaryC.y, 0, binaryC.x, binaryC.y, s * .66);
      haze.addColorStop(0, 'rgba(38,166,211,.12)');
      haze.addColorStop(.48, 'rgba(80,74,158,.045)');
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      dust.forEach((star, index) => {
        const pulse = reduceMotion ? .7 : .5 + .5 * Math.sin(time * .48 + star.phase);
        ctx.globalAlpha = .16 + pulse * .42;
        ctx.fillStyle = index % 9 === 0 ? '#7dd3fc' : '#dcefff';
        ctx.fillRect(star.x * w, star.y * h, star.r, star.r);
      });
      ctx.globalAlpha = 1;

      /* one continuous research spine carries the whole story */
      const spine = [
        { a: { x: clusterC.x + s * .10, y: clusterC.y + s * .07 }, c: { x: w * .47, y: h * .30 }, b: { x: binaryC.x - s * .13, y: binaryC.y - s * .02 } },
        { a: { x: binaryC.x + s * .12, y: binaryC.y + s * .04 }, c: { x: w * .63, y: h * .74 }, b: { x: graphC.x - s * .07, y: graphC.y + s * .02 } }
      ];
      ctx.save();
      ctx.setLineDash([1, 6]);
      spine.forEach(seg => {
        ctx.beginPath();ctx.moveTo(seg.a.x, seg.a.y);
        ctx.quadraticCurveTo(seg.c.x, seg.c.y, seg.b.x, seg.b.y);
        ctx.strokeStyle = 'rgba(151,196,219,.30)';ctx.lineWidth = 1;ctx.stroke();
      });
      ctx.restore();
      spine.forEach((seg, index) => {
        const phase = reduceMotion ? .52 : (time * .12 + index * .46) % 1;
        const packet = quadPoint(seg.a, seg.c, seg.b, phase);
        glowDot(ctx, packet.x, packet.y, 2, '#e0a45c', 12);
      });

      /* 1 — a star cluster with a highlighted white dwarf */
      const clusterRadius = s * .17;
      cluster.forEach((star, index) => {
        const rr = star.radius * clusterRadius;
        const orbit = star.angle + (reduceMotion ? 0 : time * .018 * (index % 2 ? 1 : -1));
        const x = clusterC.x + Math.cos(orbit) * rr;
        const y = clusterC.y + Math.sin(orbit) * rr * .82;
        const twinkle = reduceMotion ? 1 : .82 + Math.sin(time * .8 + star.phase) * .18;
        glowDot(ctx, x, y, star.size * twinkle, star.blue ? '#bfefff' : '#e8d7b5', star.blue ? 12 : 5);
        if (index === 0) {
          ctx.beginPath();ctx.arc(x,y,10 + Math.sin(time*1.3)*1.2,0,TAU);
          ctx.strokeStyle='rgba(224,164,92,.46)';ctx.lineWidth=1;ctx.stroke();
          ctx.beginPath();ctx.moveTo(x-16,y);ctx.lineTo(x-11,y);ctx.moveTo(x+11,y);ctx.lineTo(x+16,y);ctx.stroke();
        }
      });
      ctx.beginPath();ctx.ellipse(clusterC.x,clusterC.y,clusterRadius*1.12,clusterRadius*.88,-.12,0,TAU);
      ctx.strokeStyle='rgba(146,200,224,.14)';ctx.lineWidth=1;ctx.stroke();

      /* 2 — an accreting magnetic compact binary */
      ctx.save();ctx.translate(binaryC.x,binaryC.y);ctx.rotate(-.18);
      ctx.beginPath();ctx.ellipse(0,0,s*.14,s*.062,0,0,TAU);
      ctx.strokeStyle='rgba(224,164,92,.24)';ctx.lineWidth=1;ctx.stroke();ctx.restore();
      const angle = reduceMotion ? .75 : time * .56;
      const whiteDwarf = { x: binaryC.x + Math.cos(angle)*s*.08, y: binaryC.y + Math.sin(angle)*s*.035 };
      const donor = { x: binaryC.x - Math.cos(angle)*s*.105, y: binaryC.y - Math.sin(angle)*s*.046 };

      ctx.beginPath();ctx.moveTo(donor.x,donor.y);
      ctx.bezierCurveTo(binaryC.x-s*.01,binaryC.y-s*.13,binaryC.x+s*.08,binaryC.y+s*.08,whiteDwarf.x,whiteDwarf.y);
      ctx.strokeStyle='rgba(251,191,36,.62)';ctx.lineWidth=1.4;ctx.stroke();

      for (let k = 0; k < 4; k += 1) {
        ctx.save();ctx.translate(whiteDwarf.x,whiteDwarf.y);ctx.rotate(k*Math.PI/4 + time*.035);
        ctx.beginPath();ctx.ellipse(0,0,s*(.036+k*.012),s*(.014+k*.005),0,0,TAU);
        ctx.strokeStyle=`rgba(224,164,92,${.26-k*.035})`;ctx.lineWidth=1;ctx.stroke();ctx.restore();
      }
      glowDot(ctx,whiteDwarf.x,whiteDwarf.y,s*.018,'#d8f8ff',22);
      glowDot(ctx,donor.x,donor.y,s*.024,'#d88f62',16);
      const beamAngle = -1.15 + Math.sin(time*.8)*.2;
      const beamX = whiteDwarf.x + Math.cos(beamAngle)*s*.13;
      const beamY = whiteDwarf.y + Math.sin(beamAngle)*s*.13;
      const beam = ctx.createLinearGradient(whiteDwarf.x,whiteDwarf.y,beamX,beamY);
      beam.addColorStop(0,'rgba(224,164,92,.52)');beam.addColorStop(1,'rgba(224,164,92,0)');
      ctx.beginPath();ctx.moveTo(whiteDwarf.x,whiteDwarf.y);ctx.lineTo(beamX,beamY);ctx.strokeStyle=beam;ctx.lineWidth=4;ctx.stroke();

      /* 3 — a knowledge graph feeding the multimodal mobile agent */
      const phoneW = Math.max(34, s * .105), phoneH = Math.max(72, s * .225);
      ctx.save();
      ctx.translate(phoneC.x, phoneC.y);
      ctx.strokeStyle='rgba(230,222,206,.46)';ctx.lineWidth=1.2;
      roundedRectPath(ctx,-phoneW/2,-phoneH/2,phoneW,phoneH,7);ctx.stroke();
      ctx.strokeStyle='rgba(224,164,92,.22)';
      ctx.strokeRect(-phoneW*.32,-phoneH*.30,phoneW*.64,phoneH*.16);
      ctx.strokeRect(-phoneW*.32,-phoneH*.06,phoneW*.28,phoneH*.20);
      ctx.strokeRect(phoneW*.04,-phoneH*.06,phoneW*.28,phoneH*.20);
      const focusY = -phoneH*.28 + (reduceMotion ? phoneH*.2 : (Math.sin(time*.7)*.5+.5)*phoneH*.4);
      ctx.strokeStyle='rgba(224,164,92,.6)';
      ctx.strokeRect(-phoneW*.36,focusY,phoneW*.72,phoneH*.10);
      ctx.beginPath();ctx.arc(0,phoneH*.38,1.8,0,TAU);ctx.fillStyle='rgba(230,222,206,.6)';ctx.fill();
      ctx.restore();

      const graphPos = graphNodes.map((node,index) => ({
        x:graphC.x + node[0]*s*.34,
        y:graphC.y + node[1]*s*.34 + (reduceMotion?0:Math.sin(time*.45+index)*1.7)
      }));
      graphEdges.forEach((edge,index) => {
        const a=graphPos[edge[0]],b=graphPos[edge[1]];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='rgba(139,169,207,.24)';ctx.lineWidth=1;ctx.stroke();
        const phase=reduceMotion?.5:(time*.16+index*.13)%1;
        glowDot(ctx,a.x+(b.x-a.x)*phase,a.y+(b.y-a.y)*phase,1.2,'#8ba9cf',8);
      });
      /* retrieved context flows from the graph into the phone screen */
      const intake = { x: phoneC.x - phoneW*.42, y: phoneC.y - phoneH*.18 };
      [2,5,7].forEach((nodeIndex,index) => {
        const a = graphPos[nodeIndex];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(intake.x,intake.y);
        ctx.strokeStyle='rgba(224,164,92,.16)';ctx.lineWidth=1;ctx.stroke();
        const phase=reduceMotion?.5:(time*.2+index*.31)%1;
        glowDot(ctx,a.x+(intake.x-a.x)*phase,a.y+(intake.y-a.y)*phase,1.4,'#e0a45c',9);
      });
      graphPos.forEach((p,index)=>glowDot(ctx,p.x,p.y,index===4?3:1.7,index%3===0?'#e0a45c':'#8ba9cf',10));

      /* labels are deliberately concise; the HTML HUD carries the full story */
      ctx.font='10px "IBM Plex Mono", monospace';ctx.textAlign='center';ctx.fillStyle='rgba(234,226,210,.72)';
      ctx.fillText('CLUSTER WHITE DWARF', clusterC.x, clusterC.y + clusterRadius + 22);
      ctx.fillText('MAGNETIC ACCRETION', binaryC.x + s*.02, binaryC.y - s*.17);
      ctx.fillText('KG + MOBILE GUI AGENT', phoneC.x - s*.06, phoneC.y - phoneH*.5 - s*.11);
    });
  }

  /* The AI hero plate is drawn by js/aihero.js — it shows the retrieval
     audit the headline promises, not a decorative node graph. */
})();
