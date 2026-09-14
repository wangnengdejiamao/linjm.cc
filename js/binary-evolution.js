/* Figure 4: the same figure kit and palette as the accreting-WD figures.
   All state changes come from BinaryEvolutionModel.state(progress). */
(function(){
'use strict';
const $=id=>document.getElementById(id),canvas=$('beCanvas'),chart=$('bePeriod');
if(!canvas||!window.FK||!window.EvolutionGeometry||!window.BinaryEvolutionModel)return;
const ctx=canvas.getContext('2d'),tx=chart.getContext('2d'),E=window.EvolutionGeometry,M=window.BinaryEvolutionModel,D=window.BINARY_EVOLUTION_DATA,C=FK.C;
const TAU=Math.PI*2;let route='nsper',branch='success',progress=0,phase=.08,playing=false,orbiting=false,last=0,visible=true,zoom=true,viewState=null,lastStep=-1,paintStamp=0,frame=0;
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
const story=()=>M.getRoute(route,branch);
const streams=new Map();
const color={blue:[139,169,207],warm:FK.RGB.donor,wd:FK.RGB.wd};
function setText(id,value){const el=$(id);if(el.textContent!==String(value))el.textContent=value;}
function setRoute(key,choice='success'){route=key;branch=choice;progress=0;phase=.08;playing=false;orbiting=false;lastStep=-1;
 document.querySelectorAll('[data-evolution]').forEach(b=>{const on=b.dataset.evolution===key;b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on))});
 setText('beSceneTitle',story().title);setText('beClock',story().clock);
 setText('beClockNote',key==='nsper'?'Envelope ejection at 114.636 Myr is followed by 13.004 Myr of detached evolution. Accretion starts at 127.640 Myr and continues to the present cluster age.':'Different members anchor different stages of the channel. The shared age links their interpretation; it does not make them successive observations of the same binary.');
 if(key==='nsper'&&branch!=='success')setText('beClockNote','These branches compare discrete efficiencies for the same initial binary. They are schematic outcomes, not extra interpolated COSMIC tracks or universal efficiency limits.');
 $('beTrackWrap').hidden=key!=='nsper'||branch!=='success';$('beStoryMap').hidden=key!=='nsper';
 $('binaryEvolution').dataset.branch=branch;$('binaryEvolution').dataset.route=route;
 const rail=$('beStages');rail.style.setProperty('--stages',story().steps.length);rail.replaceChildren();
 story().steps.forEach((st,i)=>{const li=document.createElement('li'),b=document.createElement('button');b.type='button';const small=document.createElement('span');small.textContent=String(i+1).padStart(2,'0');b.append(small,document.createTextNode(st.short));b.addEventListener('click',()=>seekStage(i));li.append(b);rail.append(li)});update();
}
function seekStage(i,fromMap=false){const n=story().steps.length;i=M.clamp(i,0,n-1);const u=fromMap?([0,.999,.5,.99,.5,0,1][i]||0):.04;progress=i===n-1?1:(i+u)/n;playing=false;orbiting=false;update()}
function fmtP(h){return h>=48?(h/24).toFixed(2)+' d':h.toFixed(3)+' h'}
function update(){
 const s=M.state(route,progress,D,branch);viewState=s;
 if(s.i!==lastStep){lastStep=s.i;setText('beKind',s.step.kind);setText('beTitle',s.step.title);setText('beDescription',s.step.description);setText('beNote',s.step.note);
  [...$('beStages').querySelectorAll('button')].forEach((b,i)=>b.setAttribute('aria-current',i===s.i?'step':'false'));
  canvas.setAttribute('aria-label',story().title+'. '+s.step.title+'. '+s.step.description);
 }
 setText('beTime',s.time);
 setText('beP',s.periodText||(s.period!==null?(route==='nsper'?fmtP(s.period):(s.period/24).toFixed(6)+' d'):s.ce?'Rapid CE transition':'Not specified'));
 setText('beA',s.physicalA!==null?s.physicalA.toFixed(s.physicalA>100?1:3)+' R☉':s.ce?'Contracts within shared gas':'Schematic scale');
 setText('beMass',s.masses);
 setText('beFlow',s.flow?(s.donor==='A'?'A → L₁ → B':'B → L₁ → A'):s.ce?'Common-envelope interaction':s.single?'Single remnant':'No Roche-lobe stream');
 setText('beScale',s.scaleNote);
 $('beProgress').value=Math.round(progress*1000);$('beProgress').setAttribute('aria-valuetext',s.step.short+', stage '+(s.i+1)+' of '+story().steps.length);$('beProgress').style.setProperty('--p',(progress*100)+'%');
 setText('beProgressLabel',(s.i+1)+' / '+story().steps.length);
 setText('bePlay',playing?'Pause':progress===1?'Replay evolution':'Play evolution');
 $('beOrbit').disabled=s.single||motion.matches;$('bePlay').disabled=motion.matches;$('beMotionNote').hidden=!motion.matches;setText('beOrbit',orbiting?'Pause orbit':'Animate orbit');$('beOrbit').setAttribute('aria-pressed',String(orbiting));
 $('bePrevious').disabled=s.i===0;$('beNext').disabled=s.i===story().steps.length-1;
 if(window.BinaryEvolutionMap)window.BinaryEvolutionMap.update(s,branch);
 drawScene(s);if(route==='nsper'&&branch==='success')drawTrack(s);
}
function curvePath(points,transform){const path=new Path2D();points.forEach((p,i)=>{const v=transform(p);i?path.lineTo(v.x,v.y):path.moveTo(v.x,v.y)});return path}
function poly(points,transform,stroke,width=1,dash=[]){ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke(curvePath(points,transform));ctx.restore()}
function drawScene(s){
 const size=FK.fit(canvas,ctx);if(!size)return;const {w,h}=size;ctx.clearRect(0,0,w,h);
 const cx=w*.5,cy=h*.48,base=Math.min(w*.56,(h-150)*.53)*(s.camera||1),a=base*s.sep;
 // Quantization only caches smoothly changing illustrative mass ratios; measured states are retained.
 const q=s.schematic&&s.i===0?Math.round(s.q*10)/10:Math.round(s.q*10000)/10000;
 const g=E.geometry(q),opts={q,angle:phase,separation:a,centerX:cx,centerY:cy,projection:1};
 const project=p=>E.transform(p,opts),A=project({x:0,y:0}),B=project({x:1,y:0});
 const geomRadius=which=>g.lobes[which].reduce((m,p)=>Math.max(m,Math.hypot(p.x-(which==='A'?0:1),p.y)),0)*a;
 const pbody={A,B};
 // Faint barycentric orbits; no shared-envelope equipotential is asserted.
 if(!s.single&&!s.ce){ctx.save();ctx.strokeStyle=C.rule2;ctx.lineWidth=.75;ctx.setLineDash([2,5]);for(const r of [a*q/(1+q),a/(1+q)]){ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.stroke()}ctx.restore();}
 function envelope(strength){if(strength<=0)return;const r=base*.98;
  const g0=ctx.createRadialGradient(cx,cy,r*.12,cx,cy,r);g0.addColorStop(0,FK.rgba(FK.RGB.donor,.04*strength));g0.addColorStop(.5,FK.rgba(FK.RGB.donor,.23*strength));g0.addColorStop(.84,FK.rgba(FK.RGB.donor,.16*strength));g0.addColorStop(1,FK.rgba(FK.RGB.donor,0));ctx.fillStyle=g0;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();
  ctx.save();ctx.strokeStyle=FK.rgba(FK.RGB.donor,.18*strength);ctx.lineWidth=1;for(let k=0;k<4;k++){ctx.beginPath();ctx.ellipse(cx,cy,r*(.56+k*.09),r*(.43+k*.08),k*.7+phase*.05,0,TAU);ctx.stroke()}ctx.restore();
 }
 envelope(s.envelope);
 // One finite ejection event, determined by stage progress; no repeating burst.
 if(s.shell>0&&s.shell<1){ctx.save();const u=s.shell;for(let j=0;j<40;j++){const ang=j/40*TAU;const r=base*(.70+u*(.50+(j%5)*.03));const x=cx+Math.cos(ang)*r,y=cy+Math.sin(ang)*r;ctx.fillStyle=FK.rgba(FK.RGB.donor,(1-u)*.55);ctx.beginPath();ctx.arc(x,y,1.5+(j%3)*.4,0,TAU);ctx.fill()}ctx.restore();}
 if(s.ce){for(const side of [0,1]){const pts=[];for(let j=0;j<48;j++){const lag=j/47*.55,sep=base*Math.min(1,s.sep+lag*.40);pts.push(E.transform({x:side,y:0},{...opts,angle:phase-lag*TAU,separation:sep}))}poly(pts,p=>p,C.rule,1.1)} }
 if(s.lobes&&$('beLobes').checked){poly(g.lobes.A,project,C.steel,1,[4,5]);poly(g.lobes.B,project,C.amber,1,[4,5]);}
 let stream=null,diskR=0,hitPoint=null;
 if(s.flow){const acc=s.donor==='B'?'A':'B';let target=s.disk?.65*g.minimumLobeRadius[acc]:(acc==='A'?s.ra:s.rb);
  target=Math.min(target,.92*g.minimumLobeRadius[acc]);const cacheKey=q+':'+s.donor+':'+target.toFixed(3);
  if(!streams.has(cacheKey)){streams.set(cacheKey,E.ballistic(q,s.donor,target));if(streams.size>150)streams.delete(streams.keys().next().value)}
  stream=streams.get(cacheKey);if(s.disk)diskR=stream.targetRadius*a;
 }
 if(s.disk&&diskR>0){const c=A;ctx.save();
  const grd=ctx.createRadialGradient(c.x,c.y,4,c.x,c.y,diskR);grd.addColorStop(0,FK.rgba(FK.RGB.spot,.7));grd.addColorStop(.28,FK.rgba(FK.RGB.spot,.34));grd.addColorStop(1,FK.rgba(FK.RGB.spot,.03));ctx.fillStyle=grd;ctx.beginPath();ctx.arc(c.x,c.y,diskR,0,TAU);ctx.fill();
  for(let k=1;k<=5;k++){const r=diskR*k/5;ctx.strokeStyle=k===5?C.amber:FK.rgba(FK.RGB.spot,.22);ctx.lineWidth=k===5?1.7:.7;ctx.beginPath();ctx.arc(c.x,c.y,r,0,TAU);ctx.stroke();}
  for(let j=0;j<15;j++){const r=diskR*(.3+.6*(j%4)/3),ang=phase*(2+Math.pow(diskR/r,1.5))+j*2.4;ctx.fillStyle=FK.rgba(FK.RGB.spot,.48);ctx.beginPath();ctx.arc(c.x+r*Math.cos(ang),c.y+r*Math.sin(ang),1.1,0,TAU);ctx.fill()}ctx.restore();
 }
 const drawn={};
 for(const which of ['A','B']){
  if(s.single&&which==='B')continue;const center=s.single?{x:cx,y:cy}:pbody[which];const raw=(which==='A'?s.ra:s.rb)*(s.single?base:a),minimum=s.ce?5:which==='A'&&s.colorA==='wd'?7:which==='A'?11:8,r=Math.max(minimum,raw);const rgb=color[which==='A'?s.colorA:s.colorB];drawn[which]={...center,r};
  let surface=s.donor===which&&!s.ce?g.lobes[which]:null;
  // Only the reconstructed HSC expansion uses a side-radius sequence.
  // Keep the measured BSS-1 R/a and track radius readouts separate from it.
  if(!surface&&s.route!=='nsper'&&s.schematic&&s.i===2&&which==='B'){
   const side=g.lobes.B[(g.lobes.B.length-1)/4].y;
   const fill=M.mix((s.route==='tight'?.255:.15)/side,1,M.smooth(s.u/.64));
   surface=E.underfilledSurface(q,'B',fill);
  }
  if(surface){const radius=surface.reduce((m,p)=>Math.max(m,Math.hypot(p.x-(which==='A'?0:1),p.y)),0)*a;FK.discPath(ctx,curvePath(surface,project),center.x,center.y,radius,rgb,{u:.55});drawn[which].r=radius;}
  else{FK.disc(ctx,center.x,center.y,r,rgb,{u:.55});}
  if(raw<minimum&&!s.ce){ctx.save();ctx.strokeStyle=FK.rgba(rgb,.35);ctx.lineWidth=.6;ctx.beginPath();ctx.arc(center.x,center.y,r+3,0,TAU);ctx.stroke();ctx.restore();}
 }
 if(stream){poly(stream.points,project,C.amber,1.7);const pts=stream.points;
  for(let j=0;j<9;j++){const k=Math.floor(((phase*.35+j/9)%1+1)%1*(pts.length-1)),p=project(pts[k]);ctx.fillStyle=C.ink;ctx.beginPath();ctx.arc(p.x,p.y,1.35,0,TAU);ctx.fill()}
  if(s.disk&&stream.hitTarget){hitPoint=project(pts[pts.length-1]);FK.disc(ctx,hitPoint.x,hitPoint.y,3.4,FK.RGB.spot,{u:.2});}
 }
 if(!s.single&&s.lobes&&$('beLobes').checked){const p=project(g.l1);ctx.fillStyle=C.soft;ctx.beginPath();ctx.arc(p.x,p.y,2,0,TAU);ctx.fill();FK.text(ctx,'L₁',p.x+7,p.y-8,{font:FK.mono(12),fill:C.soft});}
 if(!s.single){ctx.save();ctx.strokeStyle=C.dim;ctx.lineWidth=.8;FK.line(ctx,cx-3,cy,cx+3,cy);FK.line(ctx,cx,cy-3,cx,cy+3);ctx.restore();}
 // Separate label lanes preserve A/B identity during a full orbital cycle.
 const labelY=h-70;
 function label(which,text,x){const p=drawn[which];if(!p||!text)return;ctx.save();ctx.strokeStyle=C.rule;ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(p.x,p.y+Math.min(p.r+7,36));ctx.lineTo(x,labelY-16);ctx.stroke();ctx.restore();const font=FK.sans(w<460?12:13);ctx.font=font;const maxWidth=s.single?w-30:w*.44;const words=text.split(' '),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word}else line=next}if(line)lines.push(line);lines.forEach((str,i)=>FK.text(ctx,str,x,labelY+i*16,{font,fill:C.soft,align:'center'}));}
 if(s.single)label('A',s.labelA,cx);else{label('A',s.labelA,w*.26);label('B',s.labelB,w*.74)}
 if(s.ce)FK.text(ctx,'shared envelope',cx,70,{font:FK.mono(12),fill:C.amber,align:'center'});
 else if(s.shell>0&&s.shell<1)FK.text(ctx,'envelope ejection',cx,70,{font:FK.mono(12),fill:C.amber,align:'center'});
 else if(s.disk&&hitPoint&&w>480)FK.text(ctx,'stream → disk rim',cx,73,{font:FK.mono(12),fill:C.amber,align:'center'});
}
function drawTrack(s){
 const size=FK.fit(chart,tx);if(!size)return;const {w,h}=size;tx.clearRect(0,0,w,h);
 const xmin=zoom?D.events.t_CE_myr:0,xmax=209,ymin=zoom?6.10:Math.log10(3),ymax=zoom?7.36:5;
 const left=50,right=w-17,top=35,bottom=h-42;
 const yvalue=p=>zoom?p:Math.log10(p),X=t=>left+(t-xmin)/(xmax-xmin)*(right-left),Y=p=>bottom-(yvalue(p)-ymin)/(ymax-ymin)*(bottom-top);
 tx.save();tx.strokeStyle=C.rule;tx.lineWidth=.8;tx.strokeRect(left,top,right-left,bottom-top);
 const ticks=zoom?[6.2,6.5,6.8,7.1]:[10,100,1000,10000];for(const v of ticks){const y=Y(v);tx.strokeStyle=C.grid;FK.line(tx,left,y,right,y);FK.text(tx,zoom?v.toFixed(1):v>=1000?(v/1000)+'k':String(v),left-8,y+4,{font:FK.mono(11),align:'right'})}
 const xticks=zoom?[120,150,180,209]:[0,50,100,150,209];for(const t of xticks)FK.text(tx,t.toString(),X(t),bottom+20,{font:FK.mono(11),align:t===209?'right':'center'});
 FK.text(tx,zoom?'P / h':'P / h · log scale',left,17,{font:FK.mono(11),fill:C.soft});FK.text(tx,'cluster age / Myr',right,h-5,{font:FK.mono(11),align:'right'});
 tx.beginPath();tx.rect(left,top,right-left,bottom-top);tx.clip();
 const post=M.sample(D,D.events.t_CE_myr);const nodes=(zoom?[post]:[]).concat(D.nodes.filter(r=>r.tphys>=xmin&&r.tphys<=209&&(!zoom||r.porb<1)),[M.sample(D,209)]);
 tx.strokeStyle=C.amber;tx.lineWidth=1.9;tx.beginPath();nodes.forEach((r,i)=>i?tx.lineTo(X(r.tphys),Y(r.porb*24)):tx.moveTo(X(r.tphys),Y(r.porb*24)));tx.stroke();
 tx.strokeStyle=C.mint;tx.setLineDash([4,4]);FK.line(tx,left,Y(D.observed.periodH),right,Y(D.observed.periodH));tx.setLineDash([]);
 if(s.t>=xmin){const x=X(s.t);tx.strokeStyle=C.steel;tx.lineWidth=1;FK.line(tx,x,top,x,bottom);if(s.period!==null){tx.fillStyle=C.steel;tx.beginPath();tx.arc(x,Y(s.period),3.5,0,TAU);tx.fill()}}
 tx.restore();
 FK.text(tx,'model',right-130,17,{font:FK.mono(11),fill:C.amber});FK.text(tx,'observed',right,17,{font:FK.mono(11),fill:C.mint,align:'right'});
 if(s.t<xmin)FK.text(tx,'Before envelope ejection',left+12,top+22,{font:FK.sans(12),fill:C.soft});
}
function animate(now){frame=0;if(last===0)last=now;const dt=Math.min(.05,(now-last)/1000);last=now;
 if((playing||orbiting)&&visible&&!document.hidden&&!motion.matches){const speed=+$('beSpeed').value,wasPlaying=playing;if(playing)progress=Math.min(1,progress+dt*speed/(story().steps.length*8));const s=M.state(route,progress,D,branch);let orbitRate=.48;if(s.ce)orbitRate=1.0+1.5*s.u;else if(s.period)orbitRate=M.clamp(Math.pow(43/s.period,.33),.2,1.2)*.6;phase+=dt*speed*orbitRate;if(progress>=1)playing=false;
  if(now-paintStamp>30){paintStamp=now;if(wasPlaying)update();else drawScene(viewState)}}
 if((playing||orbiting)&&visible&&!document.hidden&&!motion.matches)frame=requestAnimationFrame(animate);
}
function wake(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;if((playing||orbiting)&&visible&&!document.hidden&&!motion.matches)frame=requestAnimationFrame(animate)}
document.querySelectorAll('[data-evolution]').forEach(b=>b.addEventListener('click',()=>setRoute(b.dataset.evolution)));
$('bePlay').addEventListener('click',()=>{if(progress>=1){progress=0;lastStep=-1;}playing=!playing;orbiting=false;update();wake()});
$('beProgress').addEventListener('input',()=>{playing=false;orbiting=false;progress=+$('beProgress').value/1000;update()});
$('beOrbit').addEventListener('click',()=>{playing=false;orbiting=!orbiting;update();wake()});
$('bePrevious').addEventListener('click',()=>seekStage(viewState.i-1));$('beNext').addEventListener('click',()=>seekStage(viewState.i+1));
$('beLobes').addEventListener('change',update);$('beZoom').addEventListener('click',()=>{zoom=!zoom;setText('beZoom',zoom?'Post-CE detail':'Full history');$('beZoom').setAttribute('aria-pressed',String(zoom));update()});
if('IntersectionObserver'in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting;wake()},{threshold:.02}).observe(canvas);
document.addEventListener('visibilitychange',wake);motion.addEventListener('change',()=>{playing=false;orbiting=false;wake();update()});FK.onResize(canvas,()=>{if(viewState)update()});FK.onResize(chart,()=>{if(viewState&&route==='nsper'&&branch==='success')drawTrack(viewState)});
if(window.BinaryEvolutionMap)window.BinaryEvolutionMap.mount($('beStoryMap'),choice=>{setRoute('nsper',choice.branch);seekStage(choice.stage,true)});
setRoute('nsper');
})();
