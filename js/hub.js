/* Homepage track cards — science-specific live visualizations.
   Research: survey field -> cluster white dwarf -> magnetic binary -> spectrum.
   AI: mobile GUI perception -> knowledge graph -> auditable agent loop. */
(function () {
  'use strict';

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  function seeded(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  /* Canvas stage: buffer follows the CSS box (canvas must be position:absolute
     inside the plate so writing width/height attrs can't feed back into layout). */
  function setup(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let rect = { width: 0, height: 0 };
    const stage = {
      canvas, ctx, onFit: null,
      get w() { return rect.width; },
      get h() { return rect.height; }
    };
    const fit = () => {
      rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stage.onFit) stage.onFit();
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(canvas);
    else window.addEventListener('resize', fit, { passive: true });
    return stage;
  }

  /* Paint one frame immediately (so reduced-motion users and background tabs
     still get a composed still), repaint after every buffer reset, and only
     advance the clock while the plate is actually on screen. */
  function play(stage, renderFrame, advance) {
    const paint = () => {
      if (stage.w < 8 || stage.h < 8) return;
      try { renderFrame(); } catch (err) { /* never take the page down for a decoration */ }
    };
    stage.onFit = paint;
    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) paint();
      }, { threshold: .02 }).observe(stage.canvas);
    }
    paint();
    if (reduce) return;
    const loop = () => {
      if (visible && !document.hidden) { advance(); paint(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function glow(ctx, x, y, radius, color, blur) {
    if (!(radius > 0)) return;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.beginPath();ctx.arc(x, y, radius, 0, TAU);ctx.fill();
    ctx.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();ctx.moveTo(x + r, y);ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);ctx.quadraticCurveTo(x, y, x + r, y);ctx.closePath();
  }

  function label(ctx, text, x, y, align) {
    ctx.save();
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.letterSpacing = '.6px';
    ctx.textAlign = align || 'left';
    ctx.fillStyle = 'rgba(215,234,244,.62)';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function techGrid(ctx, w, h, time, tone) {
    ctx.save();
    ctx.strokeStyle = tone || 'rgba(107,183,216,.07)';
    ctx.lineWidth = 1;
    const cell = 34;
    const offset = reduce ? 0 : (time * 5) % cell;
    for (let x = -cell + offset; x < w + cell; x += cell) {
      ctx.beginPath();ctx.moveTo(x, 0);ctx.lineTo(x, h);ctx.stroke();
    }
    for (let y = 0; y < h; y += cell) {
      ctx.beginPath();ctx.moveTo(0, y);ctx.lineTo(w, y);ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     RESEARCH — survey field, cluster WD, compact binary, spectrum
     ------------------------------------------------------------------ */
  const research = setup(document.getElementById('doorResearch'));
  if (research) {
    const { ctx } = research;
    const random = seeded(2048);
    const field = Array.from({ length: 58 }, (_, index) => ({
      x: random(), y: random() * .72 + .06, size: .45 + random() * 1.35,
      phase: random() * TAU, blue: index % 9 === 0
    }));
    const cluster = Array.from({ length: 24 }, (_, index) => ({
      angle: random() * TAU, radius: Math.pow(random(), .62),
      size: index === 0 ? 2.8 : .7 + random() * 1.25, phase: random() * TAU
    }));
    let time = 0;

    const draw = () => {
      const w = research.w, h = research.h, s = Math.min(w, h);
      const clusterCenter = { x: w * .22, y: h * .40 };
      const binaryCenter = { x: w * .62, y: h * .39 };
      ctx.clearRect(0, 0, w, h);
      techGrid(ctx, w, h, time);

      /* wide-field survey stars */
      field.forEach((star, index) => {
        const twinkle = reduce ? 1 : .7 + Math.sin(time * .65 + star.phase) * .3;
        ctx.globalAlpha = .22 + twinkle * .42;
        ctx.fillStyle = star.blue ? '#8fe9ff' : '#dce8ee';
        ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
        if (index % 14 === 0) {
          ctx.strokeStyle = 'rgba(126,200,228,.18)';ctx.lineWidth = .7;
          ctx.beginPath();ctx.moveTo(star.x*w-3,star.y*h);ctx.lineTo(star.x*w+3,star.y*h);ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;

      /* scanning slit */
      const scanX = reduce ? w * .31 : (time * 33) % Math.max(1, w * .37);
      const scan = ctx.createLinearGradient(scanX - 22, 0, scanX + 22, 0);
      scan.addColorStop(0, 'rgba(103,232,249,0)');scan.addColorStop(.5, 'rgba(103,232,249,.09)');scan.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = scan;ctx.fillRect(scanX - 22, h*.08, 44, h*.66);
      ctx.strokeStyle = 'rgba(103,232,249,.26)';ctx.lineWidth = .8;
      ctx.beginPath();ctx.moveTo(scanX,h*.08);ctx.lineTo(scanX,h*.74);ctx.stroke();

      /* cluster and selected white dwarf */
      const radius = Math.min(w * .115, s * .24);
      let selected = null;
      cluster.forEach((star, index) => {
        const orbit = star.angle + (reduce ? 0 : time * .012 * (index % 2 ? 1 : -1));
        const r = star.radius * radius;
        const x = clusterCenter.x + Math.cos(orbit) * r;
        const y = clusterCenter.y + Math.sin(orbit) * r * .72;
        if (index === 0) selected = { x, y };
        glow(ctx, x, y, star.size, index === 0 ? '#c7f6ff' : '#e4d8bd', index === 0 ? 15 : 4);
      });
      if (selected) {
        const reticle = 11 + (reduce ? 0 : Math.sin(time*1.5)*1.4);
        ctx.strokeStyle='rgba(103,232,249,.58)';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(selected.x,selected.y,reticle,0,TAU);ctx.stroke();
        ctx.beginPath();ctx.moveTo(selected.x-reticle-5,selected.y);ctx.lineTo(selected.x-reticle+1,selected.y);
        ctx.moveTo(selected.x+reticle-1,selected.y);ctx.lineTo(selected.x+reticle+5,selected.y);ctx.stroke();
      }

      /* candidate packet -> physical characterization */
      ctx.beginPath();ctx.moveTo(clusterCenter.x+radius*.8,clusterCenter.y);
      ctx.quadraticCurveTo(w*.39,h*.2,binaryCenter.x-s*.11,binaryCenter.y);
      ctx.strokeStyle='rgba(103,232,249,.25)';ctx.lineWidth=1;ctx.stroke();
      const routePhase = reduce ? .54 : (time*.12)%1;
      const ax=clusterCenter.x+radius*.8, ay=clusterCenter.y, cx=w*.39, cy=h*.2, bx=binaryCenter.x-s*.11, by=binaryCenter.y;
      const m=1-routePhase;
      glow(ctx,m*m*ax+2*m*routePhase*cx+routePhase*routePhase*bx,m*m*ay+2*m*routePhase*cy+routePhase*routePhase*by,1.8,'#67e8f9',10);

      /* compact binary orbit */
      ctx.save();ctx.translate(binaryCenter.x,binaryCenter.y);ctx.rotate(-.18);
      ctx.beginPath();ctx.ellipse(0,0,s*.13,s*.052,0,0,TAU);
      ctx.strokeStyle='rgba(123,199,228,.26)';ctx.stroke();ctx.restore();
      const angle = reduce ? .8 : time*.58;
      const wd = {x:binaryCenter.x+Math.cos(angle)*s*.065,y:binaryCenter.y+Math.sin(angle)*s*.027};
      const donor = {x:binaryCenter.x-Math.cos(angle)*s*.085,y:binaryCenter.y-Math.sin(angle)*s*.035};
      ctx.beginPath();ctx.moveTo(donor.x,donor.y);ctx.bezierCurveTo(binaryCenter.x,binaryCenter.y-s*.11,binaryCenter.x+s*.06,binaryCenter.y+s*.065,wd.x,wd.y);
      ctx.strokeStyle='rgba(251,191,36,.66)';ctx.lineWidth=1.5;ctx.stroke();
      glow(ctx,wd.x,wd.y,s*.017,'#d7f8ff',19);glow(ctx,donor.x,donor.y,s*.025,'#d8865b',13);

      /* magnetic geometry + cyclotron beam */
      for (let k=0;k<4;k+=1) {
        ctx.save();ctx.translate(wd.x,wd.y);ctx.rotate(k*Math.PI/4+time*.025);
        ctx.beginPath();ctx.ellipse(0,0,s*(.032+k*.01),s*(.012+k*.004),0,0,TAU);
        ctx.strokeStyle=`rgba(103,232,249,${.32-k*.045})`;ctx.lineWidth=.8;ctx.stroke();ctx.restore();
      }
      const beamAngle=-1.05+Math.sin(time*.8)*.18;
      const beamEnd={x:wd.x+Math.cos(beamAngle)*s*.13,y:wd.y+Math.sin(beamAngle)*s*.13};
      const beam=ctx.createLinearGradient(wd.x,wd.y,beamEnd.x,beamEnd.y);
      beam.addColorStop(0,'rgba(103,232,249,.65)');beam.addColorStop(1,'rgba(103,232,249,0)');
      ctx.beginPath();ctx.moveTo(wd.x,wd.y);ctx.lineTo(beamEnd.x,beamEnd.y);ctx.strokeStyle=beam;ctx.lineWidth=4;ctx.stroke();

      /* live cyclotron spectrum */
      const y0=h*.84, x0=w*.08, x1=w*.92;
      ctx.strokeStyle='rgba(164,195,212,.28)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y0);ctx.stroke();
      ctx.beginPath();
      for(let i=0;i<=120;i+=1){
        const u=i/120;
        let amp=0;
        [0.23,0.46,0.69].forEach((center,j)=>{const z=(u-center-Math.sin(time*.25+j)*.004)/(.045+j*.007);amp+=(11-j*1.7)*Math.exp(-.5*z*z);});
        const x=x0+u*(x1-x0),y=y0-amp;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle='#67e8f9';ctx.lineWidth=1.4;ctx.stroke();

      label(ctx,'SURVEY + CLUSTER WD',w*.07,h*.14);
      label(ctx,'MAGNETIC BINARY',w*.52,h*.14);
      label(ctx,'CYCLOTRON SPECTRUM',w*.92,h*.94,'right');
    };
    play(research, draw, () => { time += .016; });
  }

  /* ------------------------------------------------------------------
     AI — mobile GUI perception, knowledge graph, auditable agent loop
     ------------------------------------------------------------------ */
  const ai = setup(document.getElementById('doorAI'));
  if (ai) {
    const { ctx } = ai;
    const nodes = [[-.18,-.21],[.02,-.28],[.21,-.13],[-.22,.05],[.03,.03],[.23,.09],[-.10,.26],[.16,.25]];
    const edges = [[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[3,6],[4,5],[4,6],[4,7],[5,7],[6,7]];
    const edgeOffsets = edges.map((_,index)=>(index*.137+.09)%1);
    let time = 0;

    const draw = () => {
      const w=ai.w,h=ai.h,s=Math.min(w,h);
      const phone={x:w*.14,y:h*.43,width:Math.max(48,w*.105),height:Math.max(94,h*.48)};
      const graph={x:w*.48,y:h*.43};
      const agent={x:w*.79,y:h*.43};
      ctx.clearRect(0,0,w,h);
      techGrid(ctx,w,h,time,'rgba(156,123,224,.07)');

      /* multimodal mobile GUI */
      ctx.save();ctx.translate(phone.x,phone.y);
      ctx.strokeStyle='rgba(215,229,241,.55)';ctx.lineWidth=1.25;
      roundedRect(ctx,-phone.width/2,-phone.height/2,phone.width,phone.height,8);ctx.stroke();
      ctx.strokeStyle='rgba(103,232,249,.24)';
      roundedRect(ctx,-phone.width*.33,-phone.height*.3,phone.width*.66,phone.height*.18,3);ctx.stroke();
      roundedRect(ctx,-phone.width*.33,-phone.height*.04,phone.width*.29,phone.height*.22,3);ctx.stroke();
      roundedRect(ctx,phone.width*.04,-phone.height*.04,phone.width*.29,phone.height*.22,3);ctx.stroke();
      ctx.beginPath();ctx.arc(0,phone.height*.36,2.2,0,TAU);ctx.fillStyle='rgba(216,234,242,.6)';ctx.fill();
      const focusY=-phone.height*.21+(reduce?0:(Math.sin(time*.9)*.5+.5)*phone.height*.29);
      ctx.strokeStyle='rgba(103,232,249,.62)';ctx.strokeRect(-phone.width*.26,focusY,phone.width*.52,phone.height*.075);
      ctx.restore();

      /* visual tokens leave the screen */
      for(let i=0;i<4;i+=1){
        const phase=reduce?(i+1)/5:(time*.18+i*.24)%1;
        const x=phone.x+phone.width*.55+phase*(graph.x-phone.x-phone.width*.75);
        const y=phone.y+(i-1.5)*6*Math.sin(phase*Math.PI);
        glow(ctx,x,y,1.5,i%2?'#a78bfa':'#67e8f9',9);
      }

      /* knowledge graph */
      const pos=nodes.map((node,index)=>({x:graph.x+node[0]*s*.52,y:graph.y+node[1]*s*.52+(reduce?0:Math.sin(time*.42+index)*1.4)}));
      edges.forEach((edge,index)=>{
        const a=pos[edge[0]],b=pos[edge[1]];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='rgba(167,139,250,.28)';ctx.lineWidth=1;ctx.stroke();
        const phase=reduce?.5:(time*.16+edgeOffsets[index])%1;
        glow(ctx,a.x+(b.x-a.x)*phase,a.y+(b.y-a.y)*phase,1.2,index%3?'#a78bfa':'#67e8f9',8);
      });
      pos.forEach((p,index)=>glow(ctx,p.x,p.y,index===4?3.1:1.8,index%3===0?'#67e8f9':'#a78bfa',10));

      /* evidence packet -> auditable agent */
      ctx.beginPath();ctx.moveTo(graph.x+s*.13,graph.y);ctx.bezierCurveTo(w*.64,h*.24,w*.70,h*.62,agent.x-s*.105,agent.y);
      ctx.strokeStyle='rgba(103,232,249,.24)';ctx.lineWidth=1;ctx.stroke();
      const ep=reduce?.56:(time*.14)%1;
      glow(ctx,graph.x+s*.13+(agent.x-s*.105-graph.x-s*.13)*ep,graph.y+Math.sin(ep*Math.PI)*-8,1.8,'#67e8f9',10);

      /* plan -> tool -> verify loop */
      const loopLabels=['PLAN','TOOL','VERIFY'];
      const loopColors=['#67e8f9','#fbbf24','#4ade80'];
      const loop=[];
      for(let i=0;i<3;i+=1){
        const angle=-Math.PI/2+i*TAU/3;
        loop.push({x:agent.x+Math.cos(angle)*s*.095,y:agent.y+Math.sin(angle)*s*.095});
      }
      loop.forEach((p,index)=>{
        const q=loop[(index+1)%loop.length];
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(agent.x,agent.y,q.x,q.y);
        ctx.strokeStyle=`rgba(${index===0?'103,232,249':index===1?'251,191,36':'74,222,128'},.30)`;ctx.lineWidth=1;ctx.stroke();
        const pulse=reduce?.5:(time*.22+index*.33)%1;
        glow(ctx,p.x+(q.x-p.x)*pulse,p.y+(q.y-p.y)*pulse,1.5,loopColors[index],9);
        glow(ctx,p.x,p.y,4.2,loopColors[index],13);
        label(ctx,loopLabels[index],p.x,p.y-9,'center');
      });
      glow(ctx,agent.x,agent.y,4.5,'#e9faff',18);

      /* audit trail */
      const logY=h*.82;
      ctx.strokeStyle='rgba(168,195,211,.22)';ctx.beginPath();ctx.moveTo(w*.07,logY);ctx.lineTo(w*.92,logY);ctx.stroke();
      const segments=[['VISION','#67e8f9'],['RETRIEVE','#a78bfa'],['ACT','#fbbf24'],['PASS','#4ade80']];
      segments.forEach((item,index)=>{
        const x=w*(.12+index*.22);
        ctx.fillStyle=item[1];ctx.fillRect(x,logY-2,16,3);
        label(ctx,item[0],x,logY+14);
      });

      label(ctx,'MOBILE GUI',w*.07,h*.13);
      label(ctx,'KNOWLEDGE GRAPH',w*.39,h*.13);
      label(ctx,'AUDITABLE AGENT',w*.72,h*.13);
    };
    play(ai, draw, () => { time += .016; });
  }
})();
