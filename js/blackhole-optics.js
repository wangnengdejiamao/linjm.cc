/* Original Schwarzschild optical illustration. No external code, textures or dependencies.
 * G=c=M=1. Integrate u''=3u²-u in each ray's orbital plane; RK4, Δφ=.025.
 * Static camera tetrad at r=36. Geodesics are numerical; emissivity and tone mapping
 * are illustrative. This renderer is independent of the Kerr/KN superradiance model.
 */
(() => {
  'use strict';
  let canvas = document.getElementById('bhCanvas');
  if (!canvas) return;
  const $ = id => document.getElementById(id);
  const root = $('bhView'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let gl, program, buffer, locations, post, postLocations, frame, texture, lost = false, software = null;
  let playing = !reduced.matches, visible = false, raf = 0, last = 0, time = 0;
  let tilt = 8, azimuth = .35, zoom = 1, doppler = true, quality = 1;
  let slowFrames = 0, drag = null, resizePending = 0, renderRAF = 0, lastRender = 0;
  const presets = {edge:8, tilt:35, top:78};
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform float clock, elevation, azimuth, zoom, doppler;
    const float PI=3.14159265359;
    const float R0=36.0;
    const float F0=0.94444444444;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03)+.15*noise(p*4.07);}
    vec3 sky(vec3 d){
      // Procedural celestial sphere: no downloaded imagery. Its stars are decorative.
      vec2 uv=vec2(atan(d.z,d.x)/(2.0*PI)+.5,asin(clamp(d.y,-1.,1.))/PI+.5);
      float band=exp(-pow((d.y+.24*d.x-.15*d.z)/.19,2.));
      float cloud=fbm(uv*vec2(32,18));
      vec3 col=vec3(.0018,.0024,.0048)+vec3(.006,.006,.012)*band*cloud;
      vec2 grid=uv*vec2(720,360), cell=floor(grid), p=fract(grid);
      float h=hash(cell), star=0.;
      vec2 center=vec2(hash(cell+9.3),hash(cell+25.7))*.76+.12;
      float dist=length(p-center);
      if(h>.976) star=exp(-dist*dist/0.008)*(.1+2.*pow((h-.976)/.024,6.));
      vec3 tint=mix(vec3(.6,.74,1.),vec3(1.,.81,.58),hash(cell+75.));
      return col+star*tint;
    }
    vec2 derivative(vec2 q){return vec2(q.y,3.0*q.x*q.x-q.x);}
    vec2 stepRay(vec2 q){
      const float h=.025;
      vec2 a=derivative(q), b=derivative(q+h*.5*a);
      vec2 c=derivative(q+h*.5*b), d=derivative(q+h*c);
      return q+h/6.0*(a+2.0*b+2.0*c+d);
    }
    vec3 disk(vec3 p,float lambda){
      float r=length(p), angle=atan(p.z,p.x);
      float orbital=clock*9.0/pow(r,1.5);
      float a=angle+orbital;
      float structure=fbm(vec2(r*3.1+sin(a*3.0)*.8,cos(a)*4.0+sin(a*2.)*2.0));
      float fine=noise(vec2(r*18.0+structure*5.0,sin(a)*7.0+cos(a*3.0)*3.0));
      float filaments=.8+.12*sin(r*19.0+structure*9.0)+.06*sin(r*43.0+fine*4.0);
      float edge=smoothstep(6.0,6.55,r)*(1.0-smoothstep(17.0,22.0,r));
      // A pedagogical warm emissivity profile; this is not a fitted accretion spectrum.
      float intensity=pow(7.5/r,2.0)*edge*(.65+.65*structure)*filaments;
      float shift=sqrt(1.-3./r)/(sqrt(F0)*(1.+lambda/pow(r,1.5)));
      float g=mix(1.,shift,doppler);
      vec3 warm=mix(vec3(1.,.19,.028),vec3(1.,.66,.29),clamp((17.-r)/10.,0.,1.));
      warm=mix(warm,vec3(1.,.89,.66),smoothstep(1.05,1.55,g)*.65);
      return warm*intensity*pow(g,4.0)*2.6;
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
      // A small fixed camera roll keeps the disk visually distinct from the controls.
      uv=mat2(.9968,-.0799,.0799,.9968)*uv;
      vec3 er=vec3(cos(elevation)*sin(azimuth),sin(elevation),cos(elevation)*cos(azimuth));
      vec3 right=normalize(cross(vec3(0,1,0),er)), up=cross(er,right);
      float framing=max(1.+.45*sin(elevation),1.75*resolution.y/resolution.x);
      vec3 ray=normalize(-er+(.99*framing/zoom)*(uv.x*right+uv.y*up));
      float nr=dot(ray,er), nt=length(ray-nr*er);
      vec3 et=(ray-nr*er)/max(nt,1.e-7);
      float L=R0*nt/sqrt(F0), lambda=L*cross(er,et).y;
      vec2 q=vec2(1./R0,-sqrt(F0)*nr/(R0*max(nt,1.e-7)));
      vec3 color=vec3(0.);
      float phi=0., sy=er.y;
      
      if(nt>.00001){
        for(int i=0;i<480;i++){
          vec2 next=stepRay(q);
          float np=phi+.025;
          float ny=er.y*cos(np)+et.y*sin(np);
          if(sy*ny<0.){
            // Exact disk-plane angle; interpolate u across the short RK4 interval.
            float crossPhi=atan(-er.y,et.y);
            crossPhi+=ceil((phi-crossPhi)/PI)*PI;
            float u=mix(q.x,next.x,clamp((crossPhi-phi)/.025,0.,1.));
            if(u>1./22. && u<1./6.){
              vec3 pos=(er*cos(crossPhi)+et*sin(crossPhi))/u;
              color=disk(pos,lambda);break;
            }
          }
          if(next.x>=.5){break;}
          if(next.x<=0.){
            float farPhi=mix(phi,np,q.x/(q.x-next.x));
            color=sky(er*cos(farPhi)+et*sin(farPhi));break;
          }
          q=next;phi=np;sy=ny;
        }
      }
      // Unresolved near-critical rays are dark at this finite angular budget.
      // Tone mapping preserves a sharp shadow and avoids a white fog over the disk.
      color=1.0-exp(-color*1.15);
      color=pow(max(color,vec3(0.)),vec3(.8));
      float vignette=1.-.24*smoothstep(.3,1.0,length(uv));
      gl_FragColor=vec4(color*vignette,1.);
    }
  `;
  const postFragment = `
    precision mediump float;
    uniform sampler2D image;
    uniform vec2 size;
    vec3 bright(vec2 p){
      vec3 c=texture2D(image,p).rgb;
      return c*max(0.,max(c.r,max(c.g,c.b))-.48);
    }
    void main(){
      vec2 p=gl_FragCoord.xy/size, t=1./size;
      vec3 c=texture2D(image,p).rgb;
      // A small photographic glow from the rendered light, never an invented ring.
      vec3 glow=bright(p)*.2;
      for(int i=0;i<8;i++){
        float a=float(i)*.785398;
        vec2 v=vec2(cos(a),sin(a))*t;
        glow+=bright(p+v*3.)*.045+bright(p+v*9.)*.035+bright(p+v*18.)*.02;
      }
      gl_FragColor=vec4(c+glow*.32,1.);
    }
  `;
  function unavailable(message) {
    lost=true;cancelAnimationFrame(raf);cancelAnimationFrame(renderRAF);raf=0;renderRAF=0;
    $('bhFallback').hidden=false;
    $('bhFallback').querySelector('p').textContent=message;
    $('bhMode').textContent='Optical view unavailable';
    root.querySelectorAll('button:not(#bhFullscreen),input').forEach(e=>e.disabled=true);
    root.dataset.renderer='unavailable';
  }
  function startSoftware() {
    if(software)return true;
    cancelAnimationFrame(raf);cancelAnimationFrame(renderRAF);cancelAnimationFrame(resizePending);
    raf=0;renderRAF=0;resizePending=0;drag=null;
    try {
      // A canvas with an existing GPU context cannot be reused as a 2D canvas.
      const previous=canvas,focused=document.activeElement===previous;
      canvas=previous.cloneNode(false);previous.replaceWith(canvas);bindCanvasEvents(canvas);
      if(focused)canvas.focus({preventScroll:true});
      software=window.BlackHoleSoftware.create(canvas,{
        worker:new URLSearchParams(location.search).get('blackhole')!=='software-main',
        onReady(){
          $('bhFallback').hidden=true;root.dataset.renderer='canvas2d';
          $('bhMode').textContent=root.dataset.opticalDetail==='high'?'Light bending · high detail':'Light bending · preview';
        },
        onError(){unavailable('This browser could not start the optical view.');},
        onDetail(detail){
          root.dataset.opticalDetail=detail;
          if($('bhFallback').hidden)$('bhMode').textContent=detail==='high'?'Light bending · high detail':detail==='refining'?'Refining image…':'Light bending · preview';
        }
      });
      lost=false;root.dataset.renderer='software-loading';
      root.querySelectorAll('button,input').forEach(e=>e.disabled=false);
      $('bhFallback').querySelector('p').textContent='Preparing the black-hole view…';
      $('bhFallback').querySelector('span').textContent='Camera and zoom controls remain available.';
      $('bhFallback').hidden=false;
      resize();sync();playback();return true;
    }catch(error){unavailable('This browser could not start the optical view.');return false;}
  }
  function init() {
    if(['software','software-main'].includes(new URLSearchParams(location.search).get('blackhole')))return startSoftware();
    try {
      gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});
      if(!gl)return startSoftware();
      const compile=(type,source)=>{
        const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
          const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(message);
        }
        return shader;
      };
      const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const pvs=compile(gl.VERTEX_SHADER,vertex),pfs=compile(gl.FRAGMENT_SHADER,postFragment);
      post=gl.createProgram();gl.attachShader(post,pvs);gl.attachShader(post,pfs);
      gl.bindAttribLocation(post,pos,'position');gl.linkProgram(post);
      gl.deleteShader(pvs);gl.deleteShader(pfs);
      if(!gl.getProgramParameter(post,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(post));
      postLocations={image:gl.getUniformLocation(post,'image'),size:gl.getUniformLocation(post,'size')};
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      frame=gl.createFramebuffer();
      locations={};['resolution','clock','elevation','azimuth','zoom','doppler'].forEach(k=>locations[k]=gl.getUniformLocation(program,k));
      lost=false;root.dataset.renderer='webgl';$('bhFallback').hidden=true;
      root.querySelectorAll('button,input').forEach(e=>e.disabled=false);
      $('bhMode').textContent='Light bending · thin disk';
      return true;
    } catch(error) {
      // The science controls work independently if a GPU cannot compile this renderer.
      console.warn('Black-hole optical view unavailable:',error.message);
      return startSoftware();
    }
  }
  function draw() {
    if(lost)return;
    if(software){software.render({tilt,azimuth,zoom,doppler,time});return;}
    if(!gl)return;
    gl.bindFramebuffer(gl.FRAMEBUFFER,frame);gl.useProgram(program);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(locations.resolution,canvas.width,canvas.height);
    gl.uniform1f(locations.clock,time);gl.uniform1f(locations.elevation,tilt*Math.PI/180);
    gl.uniform1f(locations.azimuth,azimuth);gl.uniform1f(locations.zoom,zoom);gl.uniform1f(locations.doppler,doppler?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(post);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.uniform1i(postLocations.image,0);gl.uniform2f(postLocations.size,canvas.width,canvas.height);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  // Animation and direct interaction share the same bounded render queue.
  function queueDraw() {
    if(!renderRAF&&!lost&&!document.hidden)renderRAF=requestAnimationFrame(render);
  }
  function render(now) {
    renderRAF=0;
    if(lost||document.hidden)return;
    if(now-lastRender<40){renderRAF=requestAnimationFrame(render);return;}
    lastRender=now;draw();
  }
  function resize() {
    resizePending=0;
    const rect=canvas.getBoundingClientRect();
    // Bound fragment work, including high-DPR phones and full-screen monitors.
    const budget=software?2600000:(innerWidth<700?180000:420000);
    const scale=Math.min(devicePixelRatio||1,software?2:1.35,Math.sqrt(budget/Math.max(rect.width*rect.height,1)))*(software?1:quality);
    const w=Math.max(1,Math.round(rect.width*scale)),h=Math.max(1,Math.round(rect.height*scale));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    if(software){
      software.resize(w,h);
    }else if(gl&&!lost){
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,frame);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){startSoftware();return;}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    queueDraw();
  }
  function sync() {
    $('bhTilt').value=tilt;$('bhTiltValue').textContent=Math.round(tilt)+'°';
    $('bhZoom').value=zoom;$('bhZoomValue').textContent=zoom.toFixed(1)+'×';
    $('bhDoppler').setAttribute('aria-pressed',String(doppler));$('bhDoppler').textContent='Color shifts '+(doppler?'on':'off');
    root.querySelectorAll('[data-bh-view]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(tilt-presets[b.dataset.bhView])<.5)));
    queueDraw();
  }
  function tick(now) {
    raf=0;if(!playing||!visible||document.hidden||lost)return;
    if(!last)last=now;
    const dt=now-last;
    if(dt>=40){
      time+=Math.min(dt/1000,.1);last=now;queueDraw();
      // Scale pixels only; the ray equation and integration step stay unchanged.
      slowFrames=dt>95?slowFrames+1:Math.max(0,slowFrames-1);
      if(slowFrames>18&&quality>.6){quality=Math.max(.6,quality*.82);slowFrames=0;resize();}
    }
    raf=requestAnimationFrame(tick);
  }
  function playback() {
    $('bhPlay').textContent=playing?'Pause':'Play';$('bhPlay').setAttribute('aria-pressed',String(playing));
    cancelAnimationFrame(raf);raf=0;last=0;
    if(document.hidden){cancelAnimationFrame(renderRAF);renderRAF=0;}
    if(visible&&!document.hidden&&!lost)queueDraw();
    if(playing&&visible&&!document.hidden&&!lost)raf=requestAnimationFrame(tick);
  }
  root.querySelectorAll('[data-bh-view]').forEach(b=>b.addEventListener('click',()=>{tilt=presets[b.dataset.bhView];sync();}));
  $('bhTilt').addEventListener('input',e=>{tilt=Number(e.target.value);sync();});
  $('bhZoom').addEventListener('input',e=>{zoom=Number(e.target.value);sync();});
  $('bhDoppler').addEventListener('click',()=>{doppler=!doppler;sync();});
  $('bhPlay').addEventListener('click',()=>{playing=!playing;playback();});
  function bindCanvasEvents(target) {
  target.addEventListener('pointerdown',e=>{
    if(e.button!==0||!e.isPrimary||drag)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,tilt,azimuth};canvas.setPointerCapture(e.pointerId);
  });
  target.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId||!canvas.hasPointerCapture(e.pointerId))return;
    azimuth=drag.azimuth-(e.clientX-drag.x)*.006;
    tilt=Math.max(3,Math.min(85,drag.tilt+(e.clientY-drag.y)*.18));sync();
  });
  function stopDrag(e){if(!drag||drag.id!==e.pointerId)return;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  target.addEventListener('pointerup',stopDrag);target.addEventListener('pointercancel',stopDrag);
  target.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-','='].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowUp')tilt=Math.min(85,tilt+3);
    if(e.key==='ArrowDown')tilt=Math.max(3,tilt-3);
    if(e.key==='ArrowLeft')azimuth-=.1;
    if(e.key==='ArrowRight')azimuth+=.1;
    if(e.key==='+'||e.key==='=')zoom=Math.min(1.7,zoom+.05);
    if(e.key==='-')zoom=Math.max(.8,zoom-.05);
    sync();
  });
    target.addEventListener('webglcontextlost',e=>{
      e.preventDefault();if(target===canvas&&!software)startSoftware();
    });
  }
  bindCanvasEvents(canvas);
  $('bhFullscreen').addEventListener('click',async()=>{
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(root.requestFullscreen)await root.requestFullscreen();
    } catch (_) { $('bhMode').textContent='Full screen is unavailable in this browser'; }
  });
  if(!root.requestFullscreen)$('bhFullscreen').hidden=true;
  document.addEventListener('fullscreenchange',()=>{
    const full=document.fullscreenElement===root;
    $('bhFullscreen').textContent=full?'Exit full screen ↙':'Full screen ↗';
    $('bhFullscreen').setAttribute('aria-label',full?'Exit full screen':'Enter full screen');resize();
  });
  reduced.addEventListener('change',e=>{if(e.matches){playing=false;playback();}});
  document.addEventListener('visibilitychange',playback);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;playback();},{threshold:.01}).observe(root.querySelector('.bh-frame'));
  new ResizeObserver(()=>{if(!resizePending)resizePending=requestAnimationFrame(resize);}).observe(root.querySelector('.bh-frame'));
  if(init()){resize();sync();playback();}
})();
