'use strict';
importScripts('blackhole-software-core.js?v=20261001d','blackhole-software-runner.js?v=20261001d');
const renderer=self.BlackHoleSoftwareRunner.create(frame=>{
  if(frame.type==='frame')self.postMessage(frame,[frame.pixels]);
  else self.postMessage(frame);
});
self.onmessage=event=>{
  if(event.data.type==='render')renderer.render(event.data);
  else if(event.data.type==='cancel')renderer.cancel();
};
