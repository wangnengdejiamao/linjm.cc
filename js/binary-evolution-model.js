/* Scientific states shared by the scene, readouts and period cursor.
   HSC1224 identities: thesis story revision 2026-09-12.
   NS Per: production-track replay 2026-09-11 and approved channel diagram.
   Intermediate CE morphology is illustrative: no hydrodynamical timescale is inferred. */
(function(root){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,u)=>a+(b-a)*u;
const smooth=u=>{u=clamp(u);return u*u*(3-2*u)};
const egg=q=>{const c=Math.cbrt(q);return .49*c*c/(.6*c*c+Math.log1p(c))};
const separation=(periodD,ma,mb)=>4.20832076*Math.cbrt(ma+mb)*Math.pow(periodD,2/3);
function sample(data,t,side='after'){
 // Event nodes share a timestamp; choose their final (post-event) state.
 // The tolerance only absorbs serialization rounding (Myr), not evolution.
 const nodes=data.nodes,tolerance=1e-9;let lo=nodes[0],hi=lo;
 if(side==='before'){
  const first=nodes.find(r=>Math.abs(r.tphys-t)<=tolerance);
  if(first)return {...first,tphys:t,a:separation(first.porb,first.mass_1,first.mass_2),q:first.mass_2/first.mass_1};
 }
 for(const r of nodes){if(r.tphys<=t+tolerance)lo=r;else{hi=r;break}}
 if(hi.tphys<=lo.tphys)hi=lo;
 const u=hi===lo?0:clamp((t-lo.tphys)/(hi.tphys-lo.tphys)),r={tphys:t};
 for(const k of ['porb','mass_1','mass_2','RRLO_1','RRLO_2'])r[k]=mix(lo[k],hi[k],u);
 r.a=separation(r.porb,r.mass_1,r.mass_2);r.q=r.mass_2/r.mass_1;return r;
}
const item=(short,title,kind,description,note)=>({short,title,kind,description,note});
const routes={
 tight:{title:'HSC 1224 · the merger branch',clock:'HSC 1224 age: 1.93⁺⁰·³⁴₋₀·₂₄ Gyr',steps:[
  item('First transfer','Building a blue straggler','Channel reconstruction','The original donor A fills its Roche lobe. Material passes through L₁ to B, which gains mass and becomes a blue straggler.','The initial binary is illustrative; no unique initial masses or period are assigned to BSS-1.'),
  item('BSS-1 today','A blue straggler near Roche contact','Observed configuration','BSS-1 contains a blue straggler B and the stripped remnant of its original donor A. Transfer may have just ended or may continue at a low rate.','The drawing follows the light-curve radius ratio. No stream is shown because ongoing transfer is not established by this geometry alone.'),
  item('Reverse transfer','The blue straggler becomes the donor','Future model','About 0.74 Gyr from now, B expands to its Roche lobe. Transfer now runs from B to A and becomes unstable.','The flow starts only when the expanding surface reaches L₁. The later 19-minute model cutoff is not a measured or secure final orbit.'),
  item('Shared envelope','Inspiral inside a common envelope','Future model','The two cores spiral inward inside a shared envelope. The tested envelope-ejection models do not unbind the gas.','Roche lobes are hidden during this non-equilibrium stage. The common envelope is retained, leading to merger.'),
  item('Stellar merger','A merged star, before the white dwarf','Future model','The merger first leaves an evolved star. Further stellar evolution and envelope loss precede white-dwarf cooling.','This is not an instantaneous conversion of two stars into a white dwarf, and no supernova is implied.'),
  item('White dwarf','The specific BSS-1 model endpoint','Future model','The forward model leaves a single 0.64–0.66 M☉ white dwarf. WD4 and WD6 are independent candidates associated with the broader merger channel.','WD4 and WD6 are not the future identities of BSS-1. Their measured masses are 0.79 ± 0.04 and 0.80 ± 0.01 M☉.')
 ]},
 wide:{title:'HSC 1224 · the survival branch',clock:'HSC 1224 age: 1.93⁺⁰·³⁴₋₀·₂₄ Gyr',steps:[
  item('First transfer','Building a blue straggler','Channel reconstruction','A transfers its envelope to B and eventually becomes a white dwarf. B gains mass and remains in a wider binary.','The animation illustrates the wide family of models, rather than a measured initial binary.'),
  item('BSS-2 today','A blue straggler and a hot companion','Observed constraints','The far-ultraviolet excess of BSS-2 supports a hot white-dwarf companion. Transfer has ended; the orbit has not yet been measured.','The 94-minute signal is δ Scuti pulsation. The 1400–2100-day range belongs to present-day wide models, not final double-white-dwarf periods.'),
  item('AGB overflow','A second episode of interaction','Future model','In the wide models, B reaches the asymptotic giant branch before filling its Roche lobe. Transfer reverses: B now supplies A.','This future is conditional on a wide orbit. A schematic disk intercepts the pre-CE stream; its size is not constrained by the data.'),
  item('Shared envelope','Two cores spiral inward','Future model','The giant core and the existing white dwarf orbit inside a common envelope. The orbital separation decreases as energy is transferred to the gas.','This stage shows the shared envelope before it is expelled. The core trajectories are illustrative.'),
  item('Envelope ejection','The envelope escapes; the pair survives','Future model','The extended, weakly bound envelope is expelled. Two compact remnants remain in a tighter orbit.','The shell expands once and fades; it does not repeatedly erupt. The surviving orbit does not widen at the end of the animation.'),
  item('Double WD','A detached double-white-dwarf system','Future model','The wide configurations leave detached double white dwarfs after a second interaction in about 2–3 Gyr.','WD2 is a candidate counterpart with an unconfirmed orbit. No observed gravitational-wave detection or final orbital period is assigned.')
 ]},
 nsper:{title:'NS Per · a surviving accreting binary',clock:'NGC 1528 age: 209⁺¹⁴⁵₋₆₉ Myr',steps:[
  item('Wide binary','A coeval, initially wide binary','Representative COSMIC track','A 5.11 M☉ primary and a 0.88 M☉ companion form with NGC 1528. The more massive star evolves first.','This production-grid example uses Z = 0.0132 and αCE = 0.20. It is not a unique reconstruction of NS Per.'),
  item('AGB overflow','The primary reaches TP-AGB Roche-lobe overflow','Representative COSMIC track','A expands and fills its critical Roche surface on the thermally pulsing asymptotic giant branch. B remains the original low-mass companion.','At 114.636 Myr, the pre-envelope period is 1256.31 d. The giant loses its own envelope; the companion is not stripped to a bare core.'),
  item('CE inspiral','The companion enters the shared envelope','CE morphology: schematic','A’s core and B spiral inward inside the envelope. The event sharply reduces the orbital separation.','The model records CE as a rapid event at 114.636 Myr. The animated inspiral has no resolved physical duration.'),
  item('Ejection','A white dwarf and a surviving main-sequence star','Representative COSMIC endpoint','A’s envelope is ejected. The surviving system contains a white dwarf and a low-mass main-sequence companion.','The period falls from 1256.31 d to 7.205 h. The period ratio is about 4185, while the separation ratio is about 386.'),
  item('Detached decay','The donor approaches contact','Representative COSMIC track','After envelope ejection, the system stays detached for 13.004 Myr. In this COSMIC model, tides drive most of the remaining orbital contraction.','The stream and disk remain absent until the donor reaches its critical Roche surface.'),
  item('Roche contact','The companion feeds an accretion disk','Representative COSMIC track','B fills its Roche lobe at 127.640 Myr. A ballistic stream leaves L₁, strikes the disk rim, and supplies the white dwarf A.','The disk radius is illustrative and confined within the accretor’s lobe. The hot spot marks first impact, not a measured surface feature.'),
  item('Cluster age','Accretion continues to the cluster age','Model and observation','The representative binary continues transferring mass until 209 Myr. Contact happens before the present cluster age, not exactly at it.','The final model period is about 6.208 h; the observed NS Per period is 6.29500 ± 0.00050 h. The two values remain separate.')
 ]}
};
// The alternative outcomes come from the author's representative-channel diagram.
// No numerical trajectories are invented for those two discrete comparisons.
const alternatives={
 merger:{title:'NS Per progenitor · merger',clock:routes.nsper.clock,steps:routes.nsper.steps.slice(0,3).concat([
  item('Merger','The envelope is not ejected','Representative comparison · αCE ≤ 0.1','In the low-efficiency examples, the two stars merge. No surviving binary remains to become NS Per.','The merged object is drawn as a star, not an instantaneous white dwarf. These limits apply to the illustrated progenitor, not to every binary.')
 ])},
 detached:{title:'NS Per progenitor · still detached',clock:routes.nsper.clock,steps:routes.nsper.steps.slice(0,3).concat([
  item('Ejection','The pair survives in a wider orbit','Representative comparison · αCE ≥ 0.35','Envelope ejection leaves a white dwarf and a main-sequence companion. The orbit is wider than in the red, accreting example.','This comparison has no stored time-resolved trajectory here; the geometry is schematic.'),
  item('Still detached','The cluster reaches 209 Myr first','Representative comparison · αCE ≥ 0.35','At 209 Myr, these systems still have periods of 16–75 h and remain detached. There is no Roche-lobe stream or accretion disk.','The range represents different discrete efficiency trials, not an uncertainty on a single orbit. It is not a universal upper-efficiency threshold.')
 ])}
};
function getRoute(route,branch='success'){return route==='nsper'&&alternatives[branch]?alternatives[branch]:routes[route]}
function state(route,progress,data,branch='success'){
 const story=getRoute(route,branch),n=story.steps.length,z=clamp(progress)*n,i=Math.min(n-1,Math.floor(z)),u=clamp(z-i),v=smooth(u);
 const s={route,branch,i,u,step:story.steps[i],q:1,sep:1,ra:.14,rb:.1,colorA:'blue',colorB:'warm',labelA:'A · original donor',labelB:'B · original companion',lobes:true,donor:null,flow:false,disk:false,envelope:0,shell:0,ce:false,single:false,measured:false,schematic:true,time:'Not uniquely reconstructed',period:null,physicalA:null,masses:'Not uniquely reconstructed',scaleNote:'Orbital-plane view · sizes shown schematically'};
 if(route==='tight'||route==='wide'){
  s.time=route==='tight'?'HSC 1224 · merger branch':'HSC 1224 · wide branch';
  if(i===0){s.q=mix(.65,route==='tight'?5:3.3,v);s.colorA='warm';s.colorB='blue';s.ra=egg(1/s.q);s.rb=mix(.12,.255,v);s.donor='A';s.flow=true;s.labelB='B · growing blue straggler';}
  if(i===1){s.q=route==='tight'?5:3.3;s.ra=route==='tight'?.045645:.018;s.rb=route==='tight'?.255:.15;s.colorA=route==='tight'?'warm':'wd';s.colorB='blue';s.measured=true;s.labelA=route==='tight'?'A · stripped companion':'A · candidate hot WD';s.labelB=route==='tight'?'B · BSS-1':'B · BSS-2';s.time='Present-day constraints';
   s.period=route==='tight'?1.785522*24:null;s.physicalA=route==='tight'?8.6:null;s.masses=route==='tight'?'B: 2.25 ± 0.40; A: 0.45 ± 0.12 M☉':'Hot companion: 22,000–26,000 K';s.scaleNote=route==='tight'?'Orbital-plane view · measured R/a and mass ratio':'Illustrative wide orbit · orbit unmeasured';}
  if(i===2){s.q=route==='tight'?5:3.3;s.ra=route==='tight'?.045645:.018;s.rb=mix(route==='tight'?.255:.15,egg(s.q),smooth(u/.64));s.colorA=route==='tight'?'warm':'wd';s.colorB='warm';s.donor=u>=.64?'B':null;s.flow=u>=.64;s.disk=route==='wide'&&s.flow;s.labelA=route==='tight'?'A · stripped companion':'A · white dwarf';s.labelB=route==='tight'?'B · expanding straggler':'B · AGB donor';s.time=route==='tight'?'≈ 0.74 Gyr from now':'Future wide-orbit model';}
  if(i===3){s.ce=true;s.lobes=false;s.q=1;s.colorA=route==='wide'?'wd':'warm';s.colorB='wd';s.sep=mix(1,route==='tight'?.10:.52,v);s.ra=.035;s.rb=.05;s.envelope=1;s.labelA=route==='tight'?'A · low-mass companion':'A · existing white dwarf';s.labelB='B · stripped giant core';s.time='Rapid CE event · duration not resolved';s.scaleNote='Core inspiral and envelope morphology: schematic';}
  if(i===4){s.lobes=false;s.time=route==='tight'?'After the stellar merger':'After envelope ejection';
   if(route==='tight'){s.single=true;s.sep=0;s.ra=mix(.29,.23,v);s.rb=0;s.colorA='warm';s.labelA='A + B · merged star';s.labelB='';s.envelope=mix(.8,.2,v);}
   else{s.sep=.52;s.q=1;s.ra=.02;s.rb=.025;s.colorA=s.colorB='wd';s.shell=v;s.envelope=1-v;s.labelA='A · white dwarf';s.labelB='B · exposed core';}
  }
  if(i===5){s.lobes=false;s.colorA=s.colorB='wd';s.time=route==='tight'?'≈ 0.2–0.7 Gyr after merger':'≈ 2–3 Gyr after the present state';
   if(route==='tight'){s.single=true;s.sep=0;s.ra=.025;s.rb=0;s.labelA='Model · single white dwarf';s.labelB='';s.masses='Model remnant: 0.64–0.66 M☉';}
   else{s.sep=.52;s.ra=.025;s.rb=.027;s.q=1;s.labelA='A · white dwarf';s.labelB='B · white dwarf';s.masses='WD2: candidate counterpart only';}
  }
 }else{
  const e=data.events;let t=0;
  if(i===0)t=mix(0,98.7245812622,v);
  if(i===1)t=u>=.995?e.t_CE_myr:mix(98.7245812622,e.t_CE_myr-.000001,v);
  if(i===2||i===3)t=e.t_CE_myr;
  if(i===4)t=mix(e.t_CE_myr,e.t_contact_myr,v);
  if(i===5)t=e.t_contact_myr;
  if(i===6)t=mix(e.t_contact_myr,209,v);
  const r=sample(data,t,i===1&&u>=.995?'before':'after');s.model=r;s.t=t;s.q=r.q;s.period=r.porb*24;s.physicalA=r.a;s.schematic=false;
  s.ra=r.RRLO_1*egg(1/r.q);s.rb=r.RRLO_2*egg(r.q);s.fillB=r.RRLO_2;
  s.masses=`A: ${r.mass_1.toFixed(3)}; B: ${r.mass_2.toFixed(3)} M☉`;
  s.time=`${t.toFixed(3)} Myr since cluster formation`;s.sep=i<2?1:i===2?mix(1,.58,v):.58;
  s.scaleNote='Track-based radii / separation · small stellar markers enlarged';
  if(i===0)s.labelA='A · massive primary';
  if(i===1){s.colorA='warm';s.labelA='A · giant donor';if(r.RRLO_1>=1){s.donor='A';s.flow=true;}}
  if(i>=2){s.colorA='wd';s.labelA=i===2?'A · giant core':'A · white dwarf';s.labelB='B · main-sequence companion';}
  if(i===2){s.ce=true;s.lobes=false;s.ra=.015;s.rb=.12;s.envelope=1;s.period=null;s.physicalA=null;s.masses='Giant core + main-sequence companion';s.time='CE event at 114.636 Myr';s.scaleNote='Rapid CE event · contraction shown at compressed scale';}
  if(i===3){s.envelope=1-v;s.shell=v;s.lobes=v>.8;s.camera=1+.75*v;s.scaleNote='Camera zooms to 1.75× · physical separation stays fixed';}
  if(i===4){const post=sample(data,e.t_CE_myr);s.sep=.58*r.a/post.a;s.camera=1.75;s.scaleNote='Close-up 1.75× · track-based orbital contraction';}
  if(i>=5){const post=sample(data,e.t_CE_myr);s.sep=.58*r.a/post.a;s.donor='B';s.flow=true;s.disk=true;s.labelB='B · Roche-filling donor';s.camera=1.75;s.scaleNote='Close-up 1.75× · WD marker enlarged; disk schematic';}
 }
 if(route==='nsper'&&branch!=='success'){
  if(i<3)s.step={...s.step,kind:'Shared progenitor · representative comparison',note:'The same initial binary is used to compare envelope-ejection efficiencies. Only the red αCE = 0.20 route has a sampled numerical track in this animation.'};
  if(i>=3){
   s.schematic=true;s.model=null;s.period=null;s.physicalA=null;s.donor=null;s.flow=false;s.disk=false;s.ce=false;s.camera=1;s.lobes=false;s.t=branch==='detached'&&i===4?209:null;
   s.time=branch==='detached'&&i===4?'209 Myr since cluster formation':'After the common-envelope interaction';
   s.scaleNote='Alternative outcome · stellar sizes and orbit schematic';
   if(branch==='merger'){
    s.single=true;s.sep=0;s.ra=mix(.30,.24,v);s.rb=0;s.colorA='warm';s.envelope=.5*(1-v);s.shell=0;
    s.labelA='A + B · merged star';s.labelB='';s.masses='A single stellar merger remnant';s.periodText='No surviving binary';
   }else{
    s.single=false;s.sep=1;s.q=1;s.ra=.025;s.rb=.14;s.colorA='wd';s.colorB='warm';s.envelope=i===3?1-v:0;s.shell=i===3?v:0;
    s.labelA='A · white dwarf';s.labelB='B · detached K dwarf';s.masses='White dwarf + main-sequence companion';s.periodText=i===4?'16–75 h':'Wider post-CE orbit';
   }
  }
 }
 return s;
}
const api={routes,getRoute,state,sample,separation,egg,clamp,mix,smooth};root.BinaryEvolutionModel=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
