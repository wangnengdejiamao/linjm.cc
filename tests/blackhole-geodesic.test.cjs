'use strict';
/* Independent numerical validation, not a browser/GPU test.
 * The ray initialization and RK4 mirror blackhole-optics.js.
 * Analytic null-energy, critical-impact and tetrad identities are independent checks.
 * Run: node tests/blackhole-geodesic.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const shader = fs.readFileSync(path.join(__dirname, '../js/blackhole-optics.js'), 'utf8');
const R0 = 36, F0 = 1 - 2 / R0, BC = 3 * Math.sqrt(3);
const H = Number(shader.match(/const float h=([.\d]+);/)[1]);
const N = Number(shader.match(/for\(int i=0;i<(\d+);i\+\+\)/)[1]);
const FINE_H=.00625, FINE_N=Math.round(H*N/FINE_H);
const D = ([u,v]) => [v, 3*u*u-u];
const plus = (q,k,s) => q.map((x,i)=>x+s*k[i]);
function step(q,h) {
  const a=D(q), b=D(plus(q,a,h/2)), c=D(plus(q,b,h/2)), d=D(plus(q,c,h));
  return q.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.sqrt(dot(a,a));
const unit=a=>a.map(x=>x/norm(a));
const eq=(a,b,tol,message)=>assert.ok(Math.abs(a-b)<tol,`${message}: ${a} vs ${b}`);
function traceImpact(b,h=H,maxSteps=N) {
  if(b===0) return {kind:'capture',radial:true};
  const nt=b*Math.sqrt(F0)/R0, nr=-Math.sqrt(1-nt*nt);
  let q=[1/R0,-Math.sqrt(F0)*nr/(R0*nt)], phi=0, maxInvariantError=0;
  // q.y² + q.x²(1 - 2q.x) = 1/b² follows directly from the null metric.
  eq(q[1]**2+q[0]**2*(1-2*q[0]),1/(b*b),1e-11,'Initial null constraint');
  for(let i=0;i<maxSteps;i++) {
    const next=step(q,h);
    maxInvariantError=Math.max(maxInvariantError,Math.abs((next[1]**2+next[0]**2*(1-2*next[0]))*b*b-1));
    if(next[0]>=.5) return {kind:'capture',phi:phi+h*(.5-q[0])/(next[0]-q[0]),maxInvariantError,steps:i+1};
    if(next[0]<=0) return {kind:'escape',phi:phi+h*q[0]/(q[0]-next[0]),maxInvariantError,steps:i+1};
    q=next;phi+=h;
  }
  return {kind:'budget',phi,u:q[0],maxInvariantError,steps:maxSteps};
}
function cameraRay(sx,sy,elevation=12*Math.PI/180) {
  const er=[0,Math.sin(elevation),Math.cos(elevation)],right=[1,0,0],up=cross(er,right);
  const x=.9968*sx+.0799*sy,y=-.0799*sx+.9968*sy;
  const ray=unit(er.map((a,i)=>-a+.99*(x*right[i]+y*up[i])));
  const nr=dot(ray,er),trans=ray.map((a,i)=>a-nr*er[i]),nt=norm(trans);
  const et=trans.map(a=>a/Math.max(nt,1e-7));
  const b=R0*nt/Math.sqrt(F0),lambda=b*cross(er,et)[1];
  return {er,et,nr,nt,b,lambda};
}
function traceDisk(ray,h=H,maxSteps=N) {
  if(ray.nt<=1e-5)return {kind:'capture',radial:true};
  let q=[1/R0,-Math.sqrt(F0)*ray.nr/(R0*ray.nt)],phi=0,sy=ray.er[1];
  for(let i=0;i<maxSteps;i++) {
    const next=step(q,h),np=phi+h,ny=ray.er[1]*Math.cos(np)+ray.et[1]*Math.sin(np);
    if(sy*ny<0) {
      let hitPhi=Math.atan2(-ray.er[1],ray.et[1]);
      hitPhi+=Math.ceil((phi-hitPhi)/Math.PI)*Math.PI;
      const t=Math.max(0,Math.min(1,(hitPhi-phi)/h)),u=q[0]+t*(next[0]-q[0]);
      if(u>1/22 && u<1/6) {
        const r=1/u,g=Math.sqrt(1-3/r)/(Math.sqrt(F0)*(1+ray.lambda/r**1.5));
        return {kind:'disk',r,phi:hitPhi,g};
      }
    }
    if(next[0]>=.5)return {kind:'capture'};
    if(next[0]<=0)return {kind:'escape',phi:phi+h*q[0]/(q[0]-next[0])};
    q=next;phi=np;sy=ny;
  }
  return {kind:'budget',u:q[0]};
}
// The radial ray must be handled separately; the orbital plane is undefined for b=0.
assert.equal(traceImpact(0).kind,'capture');
const cases=[.1,1,3,5,.99*BC,1.01*BC,5.5,8,15,25];
let maxConvergence=0,maxInvariant=0;
for(const b of cases) {
  const coarse=traceImpact(b),fine=traceImpact(b,FINE_H,FINE_N);
  assert.equal(coarse.kind,b<BC?'capture':'escape',`analytic critical impact ${b}`);
  assert.equal(coarse.kind,fine.kind,`step convergence ${b}`);
  maxConvergence=Math.max(maxConvergence,Math.abs(coarse.phi-fine.phi));
  maxInvariant=Math.max(maxInvariant,coarse.maxInvariantError);
  assert.ok(Math.abs(coarse.phi-fine.phi)<2e-4,'endpoint-angle convergence');
  assert.ok(coarse.maxInvariantError<5e-8,'null-constraint drift');
}
// Independently derive the observer shadow angle using sin(alpha)=b sqrt(f0)/r0.
const shadowAngle=Math.asin(BC*Math.sqrt(F0)/R0);
const nt=Math.sin(shadowAngle),bRecovered=R0*nt/Math.sqrt(F0);
eq(bRecovered,BC,1e-12,'Static observer tetrad impact parameter');
// Same angular budget with finer steps must not be mistaken for a longer trace.
const nearCritical=[];
for(const factor of [.999,.9999,1,1.0001,1.001]) {
  const b=BC*factor,coarse=traceImpact(b),fineSameBudget=traceImpact(b,FINE_H,FINE_N);
  if(N*H<=8.000001) {
    assert.equal(coarse.kind,'budget',`near-critical remains unresolved: ${factor}`);
    assert.equal(fineSameBudget.kind,'budget','smaller step cannot fix angular-budget exhaustion');
    eq(coarse.u,fineSameBudget.u,1e-6,'Near-critical u convergence at fixed phi');
  }
  const extended=factor===1?null:traceImpact(b,.025,640);
  const extendedFine=factor===1?null:traceImpact(b,.00625,2560);
  if(extended)assert.equal(extended.kind,extendedFine.kind,'16-radian budget convergence');
  if(N*H>=12 && factor!==1){
    assert.equal(coarse.kind,factor<1?'capture':'escape','12-radian near-critical classification');
    assert.equal(coarse.kind,fineSameBudget.kind,'12-radian fine convergence');
    eq(coarse.phi,fineSameBudget.phi,2e-4,'12-radian event-angle convergence');
  }
  if(extended)assert.equal(extended.kind,factor<1?'capture':'escape');
  nearCritical.push({factor,coarse:coarse.kind,fineSameBudget:fineSameBudget.kind,extended:extended?.kind,requiredPhi:extendedFine?.phi});
}
// Disk hit radius should converge; rays on an emissivity boundary are handled separately.
let diskHits=0,classificationDifferences=0,maxRadiusError=0,maxRelativeShiftError=0;
for(const elevation of [12,35,78])for(let ix=-15;ix<=15;ix++)for(let iy=-10;iy<=10;iy++) {
  const ray=cameraRay(ix*.035,iy*.035,elevation*Math.PI/180);
  const a=traceDisk(ray),b=traceDisk(ray,FINE_H,FINE_N);
  if(a.kind!==b.kind){classificationDifferences++;continue;}
  if(a.kind==='disk') {
    diskHits++;maxRadiusError=Math.max(maxRadiusError,Math.abs(a.r-b.r));
    maxRelativeShiftError=Math.max(maxRelativeShiftError,Math.abs(a.g/b.g-1));
    assert.ok(a.r>6&&a.r<22&&Number.isFinite(a.g)&&a.g>0);
  }
}
assert.ok(diskHits>300,'Sufficient sampled disk intersections');
assert.ok(classificationDifferences<=3,'Only boundary-level disk classification changes');
assert.ok(maxRadiusError<.025,'Disk-radius interpolation convergence');
assert.ok(maxRelativeShiftError<.002,'Frequency-shift interpolation convergence');
// g sign: reversing orbital angular velocity swaps approaching/receding Doppler factors.
// Much closer critical rays can still exhaust 12 or even 16 radians; that is a budget status.
const closerCritical=[];
for(const factor of [.999999,1.000001]){
  const a=traceImpact(BC*factor),b=traceImpact(BC*factor,FINE_H,FINE_N),c=traceImpact(BC*factor,.025,640);
  assert.equal(a.kind,b.kind,'Very-near-critical finite-budget convergence');
  if(a.kind!=='budget')assert.equal(a.kind,factor<1?'capture':'escape');
  closerCritical.push({factor,current:a.kind,extended16:c.kind});
}
const r=8,Lz=3,prefactor=Math.sqrt(1-3/r)/Math.sqrt(F0);
const gp=prefactor/(1+Lz/r**1.5),gm=prefactor/(1-Lz/r**1.5);
assert.ok(gm>prefactor&&gp<prefactor&&prefactor<1);
console.log(JSON.stringify({passed:true,step:H,maxSteps:N,fineSteps:FINE_N,angularBudget:H*N,analyticShadowHalfAngleDegrees:shadowAngle*180/Math.PI,maxEndpointAngleDifference:maxConvergence,maxRelativeNullConstraintDrift:maxInvariant,diskHits,classificationDifferences,maxDiskRadiusDifference:maxRadiusError,maxRelativeFrequencyShiftDifference:maxRelativeShiftError,nearCritical,closerCritical},null,2));
