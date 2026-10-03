/* Cooperative renderer. Camera changes cancel work at the next row batch. */
(() => {
  'use strict';
  const root=typeof self!=='undefined'?self:globalThis;
  root.BlackHoleSoftwareRunner={create(emit){
    let core=null,completedKey='',activeKey='',serial=0,timer=0;
    function render(request){
      const token=++serial;clearTimeout(timer);
      const cached=completedKey===request.viewKey;
      if(!cached||activeKey!==request.viewKey){
        if(!core)core=new root.BlackHoleSoftwareCore(request.view);else core.setView(request.view);
        completedKey='';activeKey=request.viewKey;
      }
      let phase=cached?'shade':'trace',row=0,batch=8;
      const start=performance.now();
      function work(){
        if(token!==serial)return;
        try{
          const before=performance.now(),end=Math.min(request.view.height,row+batch);
          if(phase==='trace')core.traceRows(row,end);
          else core.shadeRows(row,end,{time:request.time,doppler:request.doppler});
          const elapsed=performance.now()-before;
          if(elapsed>12)batch=Math.max(1,Math.floor(batch*.65));
          else if(elapsed<4)batch=Math.min(32,batch+2);
          row=end;
          if(row>=request.view.height){
            if(phase==='trace'){completedKey=request.viewKey;phase='shade';row=0;batch=8;}
            else{
              emit({type:'frame',job:request.job,generation:request.generation,viewKey:request.viewKey,
                quality:request.quality,width:request.view.width,height:request.view.height,
                doppler:request.doppler,time:request.time,pixels:core.pixels.buffer,duration:performance.now()-start});
              return;
            }
          }
          timer=setTimeout(work,0);
        }catch(error){emit({type:'error',job:request.job,message:error.message});}
      }
      timer=setTimeout(work,0);
    }
    return {render,cancel(){serial++;clearTimeout(timer);}};
  }};
})();
