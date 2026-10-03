/* Interactive preview followed by native-size detail. Animation keeps HD geometry. */
(() => {
  'use strict';
  const scriptURL=document.currentScript.src;
  window.BlackHoleSoftware={create(canvas,options={}){
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx||!window.BlackHoleSoftwareRunner)throw Error('Canvas renderer unavailable');
    const offscreen=document.createElement('canvas'),offctx=offscreen.getContext('2d',{alpha:false});
    let worker=null,local=null,inFlight=false,latest=null,job=0,currentJob=0;
    let width=1,height=1,closed=false,timer=0,idleTimer=0,lastSubmit=0,first=true;
    let cameraKey='',generation=0,phase='preview',lastPaintKey='',lastPaintTime=-1,lastDuration=125;
    function key(state){return [width,height,state.tilt.toFixed(3),state.azimuth.toFixed(4),state.zoom.toFixed(3)].join('/');}
    function detail(next){phase=next;options.onDetail?.(next);}
    function request(){
      const scale=phase==='preview'?Math.min(1,Math.sqrt(80000/(width*height))):1;
      const view={width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),
        tilt:latest.tilt,azimuth:latest.azimuth,zoom:latest.zoom};
      return {type:'render',job:++job,generation,view,quality:phase==='preview'?'preview':'high',
        viewKey:[view.width,view.height,latest.tilt.toFixed(3),latest.azimuth.toFixed(4),latest.zoom.toFixed(3)].join('/'),
        time:latest.time,doppler:latest.doppler};
    }
    function receive(frame){
      if(closed||frame.job!==currentJob)return;
      inFlight=false;
      if(frame.type==='error'){if(worker){workerFailed();return;}closed=true;options.onError?.(Error(frame.message));return;}
      if(frame.generation!==generation)return;
      if(frame.quality==='preview'&&phase!=='preview'){submit(true);return;}
      // Color changes reuse the completed ray geometry for another shading pass.
      if(frame.quality==='high')phase='high';
      if(frame.doppler!==latest.doppler){schedule();return;}
      offscreen.width=frame.width;offscreen.height=frame.height;
      offctx.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels),frame.width,frame.height),0,0);
      ctx.imageSmoothingEnabled=frame.quality==='preview';
      if(frame.quality==='preview')ctx.imageSmoothingQuality='high';
      ctx.drawImage(offscreen,0,0,canvas.width,canvas.height);
      canvas.dataset.detail=frame.quality;
      canvas.dataset.sampleWidth=String(frame.width);canvas.dataset.sampleHeight=String(frame.height);
      canvas.dataset.viewKey=frame.viewKey;
      if(frame.quality==='high')detail('high');
      lastPaintKey=cameraKey+'/'+latest.doppler;lastPaintTime=frame.time;lastDuration=frame.duration;
      if(first){first=false;options.onReady?.();}
      options.onFrame?.(frame);
      if(latest.time!==lastPaintTime||lastPaintKey!==cameraKey+'/'+latest.doppler)schedule();
    }
    function ensureLocal(){if(!local)local=window.BlackHoleSoftwareRunner.create(receive);}
    function workerFailed(){
      worker?.terminate();worker=null;inFlight=false;ensureLocal();options.onMode?.('main-thread');submit(true);
    }
    try{
      if(typeof Worker==='function'&&options.worker!==false){
        worker=new Worker(new URL('blackhole-software-worker.js?v=20261001d',scriptURL));
        worker.onmessage=event=>receive(event.data);
        worker.onerror=event=>{event.preventDefault();if(!closed)workerFailed();};
      }
    }catch(_){worker=null;}
    function submit(force=false){
      if(closed||(!force&&inFlight)||!latest||document.hidden)return;
      if(timer){clearTimeout(timer);timer=0;}
      const task=request();currentJob=task.job;inFlight=true;lastSubmit=performance.now();
      if(worker){try{worker.postMessage(task);}catch(_){workerFailed();}}
      else{ensureLocal();local.render(task);}
    }
    function schedule(){
      if(closed||inFlight||timer||!latest||phase==='refining')return;
      if(lastPaintTime===latest.time&&lastPaintKey===cameraKey+'/'+latest.doppler)return;
      const changed=lastPaintKey!==cameraKey+'/'+latest.doppler;
      const interval=phase==='high'?Math.max(200,Math.min(1200,lastDuration*1.1)):125;
      const delay=changed?0:Math.max(0,interval-(performance.now()-lastSubmit));
      timer=setTimeout(()=>{timer=0;submit();},delay);
    }
    return {
      resize(w,h){
        if(width===w&&height===h)return;
        width=w;height=h;generation++;currentJob=0;inFlight=false;cameraKey='';
        clearTimeout(timer);timer=0;clearTimeout(idleTimer);idleTimer=0;
      },
      render(state){
        latest={...state};const nextKey=key(state);
        if(nextKey!==cameraKey){
          cameraKey=nextKey;generation++;detail('preview');
          clearTimeout(idleTimer);submit(true);
          // Time evolution does not restart the camera-idle timer.
          idleTimer=setTimeout(()=>{idleTimer=0;if(closed)return;detail('refining');submit(true);},350);
        }else if(phase==='refining'&&!inFlight&&!document.hidden)submit(true);
        else schedule();
      },
      destroy(){closed=true;clearTimeout(timer);clearTimeout(idleTimer);worker?.terminate();local?.cancel();}
    };
  }};
})();
