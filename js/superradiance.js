/* Original Canvas illustration and linked analytic parameter map. No external assets. */
(() => {
  'use strict';
  const root = document.getElementById('superradiance');
  if (!root || !window.SuperradianceModel) return;
  const $ = id => document.getElementById(id);
  const scene = $('srScene'), map = $('srMap');
  const ctx = scene.getContext('2d'), mc = map.getContext('2d');
  if (!ctx || !mc) return;
  const model = window.SuperradianceModel;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {family:'kerr', mu:0.8, omega:0.3, k:0.6, eta:0.3, m:1};
  let result, running = !reduced.matches, visible = false, raf = 0, last = 0, phase = 0;
  let sceneW = 600, sceneH = 380, mapW = 600, mapH = 310, mapBounds;
  const palette = {blue:'#95b9dc', gold:'#e5b074', green:'#bad8c7', ink:'#454238'};
  const presets = {
    kerr: {stable:{mu:0.8,omega:0.3}, unresolved:{mu:0.6,omega:0.45}, 'no-amplification':{mu:0.8,omega:0.7}},
    kn: {stable:{mu:0.4,omega:0.2,k:0.6,eta:0.3}, unresolved:{mu:0.5,omega:0.4,k:0.6,eta:0.3}, 'no-amplification':{mu:0.8,omega:0.75,k:0.6,eta:0.3}}
  };
  const descriptions = {
    stable:['Covered by the stability proof','The superradiant and bound-state conditions hold, but the paper excludes an exterior trapping well in this parameter range.'],
    unresolved:['Not settled by this proof','The superradiant and bound-state conditions hold. The sufficient stability bound is not met; this does not establish an instability.'],
    unbound:['Outside the bound-state window','This frequency does not satisfy ω < μ, required for exponential decay at infinity. The bound-state stability proof is not applied.'],
    'no-amplification':['Outside the superradiant window','This positive-frequency mode does not meet ω < ωc. At equality the superradiant threshold is reached; this is not a statement about every possible mode.']
  };
  const fmt = x => x.toFixed(2);
  function syncSliders() {
    [['Mu','mu'],['Omega','omega'],['Spin','k'],['Charge','eta']].forEach(([id,key]) => {
      $('sr'+id).value = state[key]; $('sr'+id+'Value').textContent = fmt(state[key]);
    });
  }
  function check(id, pass, text) { $(id).dataset.pass = String(pass); $(id).textContent = text; }
  function update() {
    result = model.classify(state); syncSliders();
    root.querySelectorAll('[data-sr-family]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.srFamily===state.family)));
    root.querySelectorAll('[data-sr-preset]').forEach(b => b.setAttribute('aria-pressed', String(Object.entries(presets[state.family][b.dataset.srPreset]).every(([key,v]) => Math.abs(state[key]-v)<1e-8))));
    const kn = state.family==='kn'; $('srChargedControls').hidden = !kn;
    $('srGeometry').textContent = kn ? `a/M = ${fmt(state.k)} · Q/M = ${fmt(result.blackHoleCharge)}` : 'a/M = 1 · Q = 0';
    $('srAssumptions').textContent = kn ? `G = c = ℏ = 1 · m = 1 · Q/M = √(1 − k²) = ${result.blackHoleCharge.toFixed(3)}. Extremality is maintained as k varies; qQ sets the field charge coupling.` : 'G = c = ℏ = 1 · m = 1 · a = M. The black hole is exactly extremal; only the scalar-field parameters vary.';
    $('srResult').dataset.status = result.status;
    $('srResultTitle').textContent = descriptions[result.status][0]; $('srResultText').textContent = descriptions[result.status][1];
    $('srWindowFormula').textContent = kn ? '0 < Mω < (mk + qQ)/(1 + k²)' : '0 < Mω < m/2';
    check('srWindowCheck', result.superradiant, `${result.superradiant?'Yes':'No'} · ${fmt(state.omega)} ${result.superradiant?'<':'≥'} ${result.omegaC.toFixed(3)}`);
    check('srBoundCheck', result.bound, `${result.bound?'Yes':'No'} · ${fmt(state.omega)} ${result.bound?'<':'≥'} ${fmt(state.mu)}`);
    $('srProofFormula').textContent = kn ? 'Mω < qQ;  Mμ > qQ · f(k)' : 'Mω < Mμ / √3';
    check('srProofCheck', result.stable, result.stable ? 'Yes · sufficient condition met' : result.superradiant && result.bound ? 'Not established by this criterion' : 'Not applied outside the joint window');
    $('srProofDescription').textContent = kn ? 'Here f(k) = √[(3k² + 2)/(k² + 2)], with qQ > 0. Both strict inequalities and the superradiant window are required.' : 'Within the superradiant window, this sufficient condition rules out the feedback needed for this instability.';
    $('srMapFormula').innerHTML = kn ? 'a² + Q² = M², qQ &gt; 0<br>Mω &lt; qQ<br>Mμ &gt; qQ √[(3k² + 2)/(k² + 2)]' : 'a = M, Q = 0<br>0 &lt; Mω &lt; m/2<br>Mω &lt; Mμ / √3';
    $('srMapExplanation').textContent = kn ? 'For the charged case, the green region satisfies both strict bounds while remaining in the superradiant and bound-state window. Changing rotation also changes the black-hole charge through extremality.' : "The green region meets the paper's sufficient stability condition within the superradiant and bound-state window. Moving outside green does not establish instability.";
    $('srEnergyLegend').textContent = result.superradiant ? 'Energy transfer from the black hole' : 'No superradiant energy transfer';
    scene.setAttribute('aria-label', `Local scalar-wave schematic for ${kn?'extremal Kerr–Newman':'extremal Kerr'}. ${descriptions[result.status].join('. ')}`);
    map.setAttribute('aria-label', `Scalar mass versus wave frequency. Current Mμ ${fmt(state.mu)}, Mω ${fmt(state.omega)}. ${descriptions[result.status][0]}. Green marks the sufficient stability region; hatched areas are unresolved by the proof. Use the labeled sliders for keyboard control.`);
    drawMap(); drawScene();
  }
  function fit(canvas, context) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1,2);
    const w = Math.max(1,rect.width), h = Math.max(1,rect.height);
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); context.setTransform(dpr,0,0,dpr,0,0);
    return [w,h];
  }
  function resize() {
    [sceneW,sceneH] = fit(scene,ctx); [mapW,mapH] = fit(map,mc); drawMap(); drawScene();
  }
  function text(c, s, x, y, color, size=12, align='left') {
    c.fillStyle=color;c.font=`${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;c.textAlign=align;c.fillText(s,x,y);
  }
  function arrow(c,x,y,angle,color,size=7) {
    c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(0,0);c.lineTo(-size,-size*.45);c.lineTo(-size,size*.45);c.closePath();c.fill();c.restore();
  }
  function drawScene() {
    if (!result) return;
    const w=sceneW,h=sceneH,cx=w*.5,cy=h*.41,r=Math.min(56,w*.13),reach=Math.min(w*.41,220);
    ctx.clearRect(0,0,w,h);
    const bg=ctx.createRadialGradient(cx,cy,r,cx,cy,reach*1.7);bg.addColorStop(0,'#38312a');bg.addColorStop(1,'#211e19');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    // A compressed radial coordinate guide, not a Kerr embedding or ray trace.
    ctx.save();ctx.translate(cx,cy+12);
    for(let i=0;i<9;i++){const rr=r+20+i*19;ctx.strokeStyle=`rgba(217,192,151,${.09-i*.006})`;ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(0,0,rr,rr*.46,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    // Local wave crests remain outside the event horizon in both regimes.
    for(let j=0;j<15;j++){
      const v=(j/15+phase*.05)%1,rad=r+14+(1-v)*(reach-r);
      const fade=Math.sin(v*Math.PI)*.45;
      ctx.beginPath();
      for(let i=0;i<=72;i++){
        const a=-Math.PI*.93+i/72*Math.PI*1.65;
        const bend=.15*Math.sin(a*2-phase*.8)*(1-v);
        const rr=rad*(1+bend); const xx=cx+Math.cos(a)*rr, yy=cy+Math.sin(a)*rr*.64;
        if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      }
      ctx.strokeStyle=`rgba(149,185,220,${fade})`;ctx.lineWidth=1.25;ctx.stroke();
    }
    // The horizon boundary masks the field. Gold paths start outside it.
    if(result.spin>0){
      ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(229,176,116,.47)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cx,cy,r*(1.22+.4*result.spin),r*(1.02+.18*result.spin),-.17,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    const halo=ctx.createRadialGradient(cx,cy,r*.7,cx,cy,r*1.25);halo.addColorStop(0,'rgba(227,166,89,.13)');halo.addColorStop(1,'rgba(227,166,89,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,r*1.25,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#100f0d';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b58c59';ctx.lineWidth=1.1;ctx.stroke();
    if(result.spin>0){const a=phase*.35*result.spin;ctx.strokeStyle='#d2aa76';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(cx,cy,r*.66,a,a+Math.PI*1.4);ctx.stroke();arrow(ctx,cx+Math.cos(a+Math.PI*1.4)*r*.66,cy+Math.sin(a+Math.PI*1.4)*r*.66,a+Math.PI*1.9,'#d2aa76',6);}
    text(ctx,'HORIZON',cx,cy+4,'#d6c8b0',9,'center');
    if(result.superradiant){
      for(let j=0;j<5;j++){
        const a=.2+j*.28,start=r+15,end=reach*.97;
        ctx.beginPath();
        for(let i=0;i<=40;i++){const t=i/40,rr=start+(end-start)*t,ang=a+t*.5;const x=cx+Math.cos(ang)*rr,y=cy+Math.sin(ang)*rr*.75;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
        ctx.strokeStyle='rgba(229,176,116,.23)';ctx.lineWidth=1;ctx.stroke();
        const t=(phase*.12+j*.17)%1,rr=start+(end-start)*t,ang=a+t*.5;
        arrow(ctx,cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr*.75,ang+.5,'#e5b074',6);
      }
    }
    // Wave direction annotation and horizon label are anchored outside the geometry.
    const lx=Math.max(20,cx-reach+8);text(ctx,'LOCAL WAVE',lx,48,palette.blue,10);ctx.strokeStyle='#7291af';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(lx+35,55);ctx.lineTo(cx-r-20,cy-r*.45);ctx.stroke();
    const tx=w-24; text(ctx,result.spin>0?'ROTATING HORIZON':'CHARGED HORIZON',tx,48,'#d2b385',10,'right');
    ctx.strokeStyle='#927855';ctx.beginPath();ctx.moveTo(tx-50,56);ctx.lineTo(cx+r*.65,cy-r*.78);ctx.stroke();
    const statusY=h-67; text(ctx,result.superradiant?'Horizon energy flux < 0':'No negative horizon energy flux',cx,statusY,result.superradiant?palette.gold:'#cdc6b8',w<400?13:15,'center');
    text(ctx,result.superradiant?'Energy is transferred to the exterior field.':'The selected mode is outside the amplification window.',cx,statusY+23,'#b9ae9b',w<400?10:12,'center');
    text(ctx,result.stable?'NO TRAPPING WELL IN THE PROVED REGION':result.status==='unresolved'?'TRAPPING: NOT DETERMINED BY THIS CRITERION':'BOUND-STATE PROOF NOT APPLIED',cx,h-13,'#a99f8b',w<400?8:9,'center');
  }
  function drawMap() {
    if (!result) return;
    const w=mapW,h=mapH,left=47,right=18,top=23,bottom=43,pw=w-left-right,ph=h-top-bottom;
    if(pw<=0 || ph<=0)return;
    mapBounds={left,top,pw,ph};
    const x=v=>left+(v-.1)/1.3*pw, y=v=>top+(1-v)/.98*ph;
    mc.clearRect(0,0,w,h); mc.fillStyle='#ebe9e3';mc.fillRect(left,top,pw,ph);
    const tile=document.createElement('canvas');tile.width=8;tile.height=8;const tc=tile.getContext('2d');tc.fillStyle='#fbf4df';tc.fillRect(0,0,8,8);tc.strokeStyle='#e2d4af';tc.lineWidth=1;tc.beginPath();tc.moveTo(0,8);tc.lineTo(8,0);tc.moveTo(-4,4);tc.lineTo(4,-4);tc.moveTo(4,12);tc.lineTo(12,4);tc.stroke();
    function region(xmin, ymax, fill) {
      if(xmin>=1.4)return;mc.beginPath();mc.moveTo(x(xmin),y(.02));
      for(let i=0;i<=150;i++){const mu=xmin+(1.4-xmin)*i/150,cap=Math.max(.02,Math.min(1,ymax(mu)));mc.lineTo(x(mu),y(cap));}
      mc.lineTo(x(1.4),y(.02));mc.closePath();mc.fillStyle=fill;mc.fill();
    }
    mc.save();mc.beginPath();mc.rect(left,top,pw,ph);mc.clip();
    region(.1,mu=>Math.min(mu,result.omegaC),mc.createPattern(tile,'repeat'));
    if(state.family==='kerr')region(.1,mu=>Math.min(mu/Math.sqrt(3),result.omegaC),palette.green);
    else if(state.eta>0)region(Math.max(.1,state.eta*result.ratioBound),()=>Math.min(state.eta,result.omegaC),palette.green);
    mc.strokeStyle='rgba(100,94,80,.14)';mc.lineWidth=1;
    for(let i=2;i<=14;i+=2){mc.beginPath();mc.moveTo(x(i/10),top);mc.lineTo(x(i/10),top+ph);mc.stroke();}
    for(let i=2;i<=10;i+=2){mc.beginPath();mc.moveTo(left,y(i/10));mc.lineTo(left+pw,y(i/10));mc.stroke();}
    function line(a,b,color,dash=[]) {mc.strokeStyle=color;mc.lineWidth=1.3;mc.setLineDash(dash);mc.beginPath();mc.moveTo(x(a[0]),y(a[1]));mc.lineTo(x(b[0]),y(b[1]));mc.stroke();mc.setLineDash([]);}
    line([.1,.1],[1.4,1.4],'#a49d8e',[2,4]);
    line([.1,result.omegaC],[1.4,result.omegaC],'#8e5829',[6,4]);
    if(state.family==='kerr')line([.1,.1/Math.sqrt(3)],[1.4,1.4/Math.sqrt(3)],'#397e66');
    else if(state.eta>0){line([state.eta*result.ratioBound,.02],[state.eta*result.ratioBound,Math.min(state.eta,result.omegaC)],'#397e66');line([state.eta*result.ratioBound,state.eta],[1.4,state.eta],'#397e66');}
    const px=x(state.mu),py=y(state.omega);
    mc.setLineDash([3,3]);mc.strokeStyle='rgba(37,37,32,.55)';mc.beginPath();mc.moveTo(px,top+ph);mc.lineTo(px,py);mc.lineTo(left,py);mc.stroke();mc.setLineDash([]);
    mc.fillStyle='#fff';mc.beginPath();mc.arc(px,py,7,0,Math.PI*2);mc.fill();mc.fillStyle='#26231d';mc.beginPath();mc.arc(px,py,4,0,Math.PI*2);mc.fill();mc.restore();
    mc.strokeStyle='#b1aa9a';mc.lineWidth=1;mc.strokeRect(left,top,pw,ph);
    for(let i=2;i<=14;i+=2)text(mc,(i/10).toFixed(1),x(i/10),top+ph+18,'#6b665a',10,'center');
    for(let i=2;i<=10;i+=2)text(mc,(i/10).toFixed(1),left-9,y(i/10)+4,'#6b665a',10,'right');
    text(mc,'Mμ · scalar mass',left+pw/2,h-3,'#514c42',11,'center');text(mc,'Mω',left-30,14,'#514c42',11);
    if(result.omegaC>.02&&result.omegaC<1)text(mc,'Mωc',w-right-4,y(result.omegaC)-6,'#865026',10,'right');
  }
  function selectPoint(e) {
    if(!mapBounds)return;
    const rect=map.getBoundingClientRect(),{left,top,pw,ph}=mapBounds;
    state.mu=Math.round(Math.max(.1,Math.min(1.4,.1+(e.clientX-rect.left-left)/pw*1.3))*100)/100;
    state.omega=Math.round(Math.max(.02,Math.min(1,1-(e.clientY-rect.top-top)/ph*.98))*100)/100;
    update();
  }
  map.addEventListener('pointerdown',e=>{map.setPointerCapture(e.pointerId);selectPoint(e);});
  map.addEventListener('pointermove',e=>{if(map.hasPointerCapture(e.pointerId))selectPoint(e);});
  map.addEventListener('pointerup',e=>{if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);});
  [['Mu','mu'],['Omega','omega'],['Spin','k'],['Charge','eta']].forEach(([id,key])=>$('sr'+id).addEventListener('input',e=>{state[key]=Number(e.target.value);update();}));
  root.querySelectorAll('[data-sr-family]').forEach(b=>b.addEventListener('click',()=>{state.family=b.dataset.srFamily;Object.assign(state,presets[state.family].stable);update();resize();}));
  root.querySelectorAll('[data-sr-preset]').forEach(b=>b.addEventListener('click',()=>{Object.assign(state,presets[state.family][b.dataset.srPreset]);update();}));
  function animate(now) {
    raf=0;if(!running||!visible||document.hidden)return;
    if(!last)last=now;
    if(now-last>=30){phase+=Math.min((now-last)/1000,.1);last=now;drawScene();}
    raf=requestAnimationFrame(animate);
  }
  function playback() {
    $('srPlay').textContent=running?'Pause animation':'Play animation';$('srPlay').setAttribute('aria-pressed',String(running));
    if(raf)cancelAnimationFrame(raf);raf=0;last=0;
    if(running&&visible&&!document.hidden)raf=requestAnimationFrame(animate);
  }
  $('srPlay').addEventListener('click',()=>{running=!running;playback();});
  reduced.addEventListener('change',e=>{if(e.matches){running=false;playback();}});
  document.addEventListener('visibilitychange',playback);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;playback();},{threshold:0.01}).observe(scene);
  new ResizeObserver(resize).observe(root);
  update();resize();playback();
  // Earlier figures and web fonts can change the height above a deep link.
  // Re-align only during initial layout, and stop as soon as the reader interacts.
  if (location.hash === '#superradiance') {
    let userMoved = false;
    const stop = () => { userMoved = true; };
    const events = ['wheel','touchstart','pointerdown','keydown'];
    events.forEach(name => window.addEventListener(name, stop, {passive:true}));
    const align = () => { if (!userMoved && location.hash === '#superradiance') root.scrollIntoView({behavior:'instant',block:'start'}); };
    const settle = () => {
      align(); setTimeout(align,500); setTimeout(align,1500);
      setTimeout(() => events.forEach(name => window.removeEventListener(name,stop)),2000);
    };
    if (document.readyState === 'complete') settle(); else window.addEventListener('load',settle,{once:true});
    if (document.fonts) document.fonts.ready.then(align);
  }
})();
