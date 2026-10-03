/* Original CPU counterpart of the site's Schwarzschild optical shader.
 * No DOM, external assets, packages or WebGL required. Use in a Worker.
 * Geometry: M=1, r_observer=36, static tetrad, u''=3u²-u,
 * RK4 dphi=.025, 480 steps. The finite-budget/emissivity limits match the GPU view.
 * HD acceleration interpolates a one-time Schwarzschild orbit table; critical
 * rays, ambiguous event intervals and disk edges retain direct RK4 integration.
 * A five-float pixel is [kind, r/R, angle/G, lambda/B, vignette]:
 * kind 0 = sky RGB, 1 = disk geometry, 2 = black (capture/radial/unresolved).
 */
(function (root, factory) {
  'use strict';
  const Core = factory();
  if (typeof module === 'object' && module.exports) module.exports = Core;
  else root.BlackHoleSoftwareCore = Core;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  const PI = Math.PI, R0 = 36, F0 = .94444444444, SQRT_F0 = Math.sqrt(F0);
  const H = .025, HALF_H = .0125, SIXTH_H = H / 6, STEPS = 480;
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const fract = x => x - Math.floor(x);
  function smooth(a,b,x) { const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
  function hash(x,y) { return fract(Math.sin(x*127.1+y*311.7)*43758.5453); }
  function noise(x,y) {
    const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
    return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
  }
  function fbm(x,y) { return .57*noise(x,y)+.28*noise(x*2.03,y*2.03)+.15*noise(x*4.07,y*4.07); }
  function sky(x,y,z,out,p) {
    const ux=Math.atan2(z,x)/(2*PI)+.5,uy=Math.asin(clamp(y,-1,1))/PI+.5;
    const band=Math.exp(-Math.pow((y+.24*x-.15*z)/.19,2));
    const cloud=fbm(ux*32,uy*18),gx=ux*720,gy=uy*360,cx=Math.floor(gx),cy=Math.floor(gy);
    const h=hash(cx,cy),dx=fract(gx)-(hash(cx+9.3,cy+9.3)*.76+.12);
    const dy=fract(gy)-(hash(cx+25.7,cy+25.7)*.76+.12);
    const star=h>.976?Math.exp(-(dx*dx+dy*dy)/.008)*(.1+2*Math.pow((h-.976)/.024,6)):0;
    const t=hash(cx+75,cy+75),light=band*cloud;
    out[p]=0;out[p+1]=.0018+.006*light+star*(.6+.4*t);
    out[p+2]=.0024+.006*light+star*(.74+.07*t);
    out[p+3]=.0048+.012*light+star*(1-.42*t);
  }

  // Spherical symmetry makes every inbound orbit a function of impact b alone.
  // Cache RK4 trajectories, with logarithmic sampling on either side of bcrit.
  // The thin critical band and any interpolation/event ambiguity use direct RK4.
  const CRITICAL=3*Math.sqrt(3), DIRECT_BAND=.01, SIDE_N=768, STRIDE=STEPS+1;
  let trajectoryTable=null;
  function getTrajectoryTable() {
    if(trajectoryTable)return trajectoryTable;
    const samples=new Float32Array(2*SIDE_N*STRIDE),endSteps=new Uint16Array(2*SIDE_N);
    const escapeAngles=new Float64Array(2*SIDE_N),deltas=new Float64Array(2*SIDE_N);
    const logMax=[Math.log((CRITICAL-.005)/DIRECT_BAND),Math.log((R0/SQRT_F0-CRITICAL)/DIRECT_BAND)];
    for(let side=0;side<2;side++)for(let j=0;j<SIDE_N;j++) {
      const index=side*SIDE_N+j,delta=DIRECT_BAND*Math.exp(logMax[side]*j/(SIDE_N-1));
      const b=CRITICAL+(side?delta:-delta),offset=index*STRIDE;
      deltas[index]=delta;let u=1/R0,v=Math.sqrt(Math.max(0,1/(b*b)-F0/(R0*R0))),phi=0;
      samples[offset]=u;endSteps[index]=STEPS;escapeAngles[index]=NaN;
      for(let n=0;n<STEPS;n++) {
        const aV=3*u*u-u,bu=u+HALF_H*v,bv=v+HALF_H*aV,bV=3*bu*bu-bu;
        const cu=u+HALF_H*bv,cv=v+HALF_H*bV,cV=3*cu*cu-cu;
        const du=u+H*cv,dv=v+H*cV,dV=3*du*du-du;
        const nu=u+SIXTH_H*(v+2*bv+2*cv+dv),nv=v+SIXTH_H*(aV+2*bV+2*cV+dV);
        samples[offset+n+1]=nu;
        if(nu>=.5||nu<=0) {
          endSteps[index]=n+1;
          if(nu<=0)escapeAngles[index]=phi+H*u/(u-nu);
          break;
        }
        u=nu;v=nv;phi+=H;
      }
    }
    trajectoryTable={samples,endSteps,escapeAngles,deltas,logMax};return trajectoryTable;
  }
  function traceLookup(b,crossing,erx,ery,erz,etx,ety,etz,lambda,g,p,table) {
    const delta=Math.abs(b-CRITICAL);
    if(delta<DIRECT_BAND||b<1||b>=R0/SQRT_F0)return -1;
    const side=b>CRITICAL?1:0,pos=Math.log(delta/DIRECT_BAND)/table.logMax[side]*(SIDE_N-1);
    const local=Math.floor(pos);
    if(local<1||local>SIDE_N-3)return -1;
    const index=side*SIDE_N+local,t=pos-local,t2=t*t,t3=t2*t;
    // Cubic interpolation in uniformly sampled log distance from the photon sphere.
    const w0=-.5*t+t2-.5*t3,w1=1-2.5*t2+1.5*t3,w2=.5*t+2*t2-1.5*t3,w3=-.5*t2+.5*t3;
    const e=table.endSteps,minEnd=Math.min(e[index-1],e[index],e[index+1],e[index+2]);
    const maxEnd=Math.max(e[index-1],e[index],e[index+1],e[index+2]),values=table.samples;
    const a=(index-1)*STRIDE,bb=index*STRIDE,c=(index+1)*STRIDE,d=(index+2)*STRIDE;
    for(let turn=0;turn<4;turn++,crossing+=PI) {
      const sample=crossing/H,k=Math.floor(sample),f=sample-k;
      if(k+1>minEnd) {
        if(crossing<=maxEnd*H)return -1; // Event lies between tabulated endpoints.
        break;
      }
      const u0=values[a+k]+f*(values[a+k+1]-values[a+k]);
      const u1=values[bb+k]+f*(values[bb+k+1]-values[bb+k]);
      const u2=values[c+k]+f*(values[c+k+1]-values[c+k]);
      const u3=values[d+k]+f*(values[d+k+1]-values[d+k]);
      const u=w0*u0+w1*u1+w2*u2+w3*u3;
      // Preserve exact first-hit disk-edge decisions with the original solver.
      if(Math.abs(u-1/6)<.00001||Math.abs(u-1/22)<.00001)return -1;
      if(u>1/22&&u<1/6) {
        const co=Math.cos(crossing),si=Math.sin(crossing);
        g[p]=1;g[p+1]=1/u;g[p+2]=Math.atan2(erz*co+etz*si,erx*co+etx*si);g[p+3]=lambda;
        return 1;
      }
    }
    if(side) {
      const a=table.escapeAngles;
      if(!Number.isFinite(a[index-1])||!Number.isFinite(a[index])||!Number.isFinite(a[index+1])||!Number.isFinite(a[index+2]))return -1;
      const phi=w0*a[index-1]+w1*a[index]+w2*a[index+1]+w3*a[index+2],co=Math.cos(phi),si=Math.sin(phi);
      sky(erx*co+etx*si,ery*co+ety*si,erz*co+etz*si,g,p);return 0;
    }
    return 2;
  }

  class BlackHoleSoftwareCore {
    constructor(options) { this.setView(options || {width:320,height:154,tilt:8,azimuth:.35,zoom:1}); }
    static create(options) { return new BlackHoleSoftwareCore(options); }
    setView(options) {
      const o=Object.assign({width:this.width||320,height:this.height||154,tilt:8,azimuth:.35,zoom:1},this.view,options);
      if (!Number.isInteger(o.width)||!Number.isInteger(o.height)||o.width<1||o.height<1||o.width*o.height>3145728||
          ![o.tilt,o.azimuth,o.zoom].every(Number.isFinite)||o.tilt<=0||o.tilt>=90||o.zoom<=0) {
        throw new RangeError('Use positive integer dimensions (at most 3,145,728 pixels), 0 < tilt < 90 degrees, finite azimuth and positive zoom.');
      }
      this.view=o;this.width=o.width;this.height=o.height;
      const count=o.width*o.height;
      this.geometry=new Float32Array(count*5);
      for(let p=0;p<this.geometry.length;p+=5)this.geometry[p]=2;
      this.pixels=new Uint8ClampedArray(count*4);
      this.tracedRows=new Uint8Array(o.height);
      const elevation=o.tilt*PI/180,se=Math.sin(elevation),ce=Math.cos(elevation),sa=Math.sin(o.azimuth),ca=Math.cos(o.azimuth);
      this.erx=ce*sa;this.ery=se;this.erz=ce*ca;
      this.rightx=ca;this.rightz=-sa;
      this.upx=-se*sa;this.upy=ce;this.upz=-se*ca;
      this.rayScale=.99*Math.max(1+.45*se,1.75*o.height/o.width)/o.zoom;
      return this;
    }
    traceRows(start,end) {
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>this.height)throw new RangeError('Rows must satisfy 0 <= start <= end <= height.');
      const w=this.width,h=this.height,g=this.geometry,erx=this.erx,ery=this.ery,erz=this.erz;
      const rightx=this.rightx,rightz=this.rightz,upx=this.upx,upy=this.upy,upz=this.upz,scale=this.rayScale;
      const table=getTrajectoryTable();
      let diskCount=0,skyCount=0,blackCount=0,lookupCount=0,directCount=0;
      for(let row=start;row<end;row++) {
        // ImageData rows run top to bottom; gl_FragCoord runs bottom to top.
        const rawY=(h*.5-row-.5)/h;
        for(let col=0;col<w;col++) {
          const p=(row*w+col)*5,rawX=(col+.5-w*.5)/h;
          const ux=.9968*rawX+.0799*rawY,uy=-.0799*rawX+.9968*rawY,uvLength=Math.hypot(ux,uy);
          g[p]=2;g[p+1]=g[p+2]=g[p+3]=0;g[p+4]=1-.24*smooth(.3,1,uvLength);
          const tangent=scale*uvLength,nt=tangent/Math.sqrt(1+tangent*tangent);
          if(nt<=.00001){blackCount++;continue;}
          const etx=(ux*rightx+uy*upx)/uvLength,ety=uy*upy/uvLength,etz=(ux*rightz+uy*upz)/uvLength;
          const lambda=R0*nt/SQRT_F0*(erz*etx-erx*etz);
          let u=1/R0,v=SQRT_F0/(R0*tangent),phi=0;
          // Plane intersections repeat every pi; no per-step sin/cos is needed.
          let crossing=Math.atan2(-ery,ety);
          crossing+=Math.ceil(-crossing/PI)*PI;
          if(crossing<=0)crossing+=PI;
          const lookupKind=traceLookup(R0*nt/SQRT_F0,crossing,erx,ery,erz,etx,ety,etz,lambda,g,p,table);
          if(lookupKind>=0) {
            lookupCount++;
            if(lookupKind===1)diskCount++;else if(lookupKind===0)skyCount++;else blackCount++;
            continue;
          }
          directCount++;
          let kind=2;
          for(let i=0;i<STEPS;i++) {
            const aU=v,aV=3*u*u-u;
            const bu=u+HALF_H*aU,bv=v+HALF_H*aV,bV=3*bu*bu-bu;
            const cu=u+HALF_H*bv,cv=v+HALF_H*bV,cV=3*cu*cu-cu;
            const du=u+H*cv,dv=v+H*cV,dV=3*du*du-du;
            const nu=u+SIXTH_H*(aU+2*bv+2*cv+dv),nv=v+SIXTH_H*(aV+2*bV+2*cV+dV),np=phi+H;
            if(crossing<=np) {
              const t=clamp((crossing-phi)/H,0,1),hitU=u+t*(nu-u);
              if(hitU>1/22&&hitU<1/6) {
                const co=Math.cos(crossing),si=Math.sin(crossing);
                g[p]=1;g[p+1]=1/hitU;g[p+2]=Math.atan2(erz*co+etz*si,erx*co+etx*si);g[p+3]=lambda;
                kind=1;diskCount++;break;
              }
              crossing+=PI;
            }
            if(nu>=.5)break;
            if(nu<=0) {
              const farPhi=phi+H*u/(u-nu),co=Math.cos(farPhi),si=Math.sin(farPhi);
              sky(erx*co+etx*si,ery*co+ety*si,erz*co+etz*si,g,p);
              kind=0;skyCount++;break;
            }
            u=nu;v=nv;phi=np;
          }
          if(kind===2)blackCount++;
        }
        this.tracedRows[row]=1;
      }
      return {start,end,disk:diskCount,sky:skyCount,black:blackCount,lookup:lookupCount,direct:directCount};
    }
    shade(options) { return this.shadeRows(0,this.height,options); }
    shadeRows(start,end,options) {
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>this.height)throw new RangeError('Rows must satisfy 0 <= start <= end <= height.');
      const o=options||{},time=o.time===undefined?0:o.time,doppler=o.doppler===undefined?1:clamp(Number(o.doppler),0,1);
      if(!Number.isFinite(time)||!Number.isFinite(doppler))throw new RangeError('Finite time and color-shift setting required.');
      const g=this.geometry,count=this.width*this.height;
      // A worker may have transferred the previous RGBA ArrayBuffer to the UI.
      if(this.pixels.byteLength!==count*4)this.pixels=new Uint8ClampedArray(count*4);
      const out=this.pixels;
      for(let i=start*this.width,p=i*5,j=i*4;i<end*this.width;i++,p+=5,j+=4) {
        let red=0,green=0,blue=0;
        if(g[p]===0){red=g[p+1];green=g[p+2];blue=g[p+3];}
        else if(g[p]===1) {
          const r=g[p+1],angle=g[p+2],lambda=g[p+3],r15=r*Math.sqrt(r),a=angle+time*9/r15;
          const structure=fbm(r*3.1+Math.sin(a*3)*.8,Math.cos(a)*4+Math.sin(a*2)*2);
          const fine=noise(r*18+structure*5,Math.sin(a)*7+Math.cos(a*3)*3);
          const filaments=.8+.12*Math.sin(r*19+structure*9)+.06*Math.sin(r*43+fine*4);
          const edge=smooth(6,6.55,r)*(1-smooth(17,22,r));
          const intensity=Math.pow(7.5/r,2)*edge*(.65+.65*structure)*filaments;
          const shift=Math.sqrt(1-3/r)/(SQRT_F0*(1+lambda/r15)),factor=1+(shift-1)*doppler;
          const warm=clamp((17-r)/10,0,1),white=.65*smooth(1.05,1.55,factor);
          red=1;green=.19+.47*warm;blue=.028+.262*warm;
          green+=(.89-green)*white;blue+=(.66-blue)*white;
          const light=intensity*Math.pow(factor,4)*2.6;
          red*=light;green*=light;blue*=light;
        }
        const vignette=g[p+4];
        out[j]=255*Math.pow(Math.max(0,1-Math.exp(-red*1.15)),.8)*vignette;
        out[j+1]=255*Math.pow(Math.max(0,1-Math.exp(-green*1.15)),.8)*vignette;
        out[j+2]=255*Math.pow(Math.max(0,1-Math.exp(-blue*1.15)),.8)*vignette;
        out[j+3]=255;
      }
      return out;
    }
  }
  BlackHoleSoftwareCore.constants=Object.freeze({M:1,observerRadius:R0,step:H,maxSteps:STEPS,horizon:2,diskInner:6,diskOuter:22,lookupBytes:2*SIDE_N*STRIDE*4,lookupSamplesPerSide:SIDE_N,directCriticalBand:DIRECT_BAND});
  return BlackHoleSoftwareCore;
});
