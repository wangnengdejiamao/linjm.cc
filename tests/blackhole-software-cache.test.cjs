'use strict';
/* Adapter integration tests: real adapter + real row runner for fallback, and
 * deliberately reordered worker replies for presentation/generation guards.
 * No browser timing, geodesic calculation, or internal cache inspection needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const {createClock, createTracer, loadRunner, assertPixels} = require('./blackhole-software-runner.test.cjs');

const state = (tilt = 8, options = {}) => ({tilt, azimuth: .35, zoom: 1, doppler: true, time: 0, ...options});
function adapterHarness({width = 768, height = 512, worker = false} = {}) {
  const clock = createClock(), {RowTracer, log} = createTracer(clock);
  const paints = [], frames = [], details = [], errors = [], workers = [];
  let ready = 0;
  const context = {
    drawImage(source) {
      paints.push({width: source.image.width, height: source.image.height,
        data: source.image.data.slice(), at: clock.now(), smoothing: this.imageSmoothingEnabled});
    }
  };
  const canvas = {width, height, dataset: {}, getContext: () => context};
  const document = {
    currentScript: {src: 'https://example.test/js/blackhole-software.js'}, hidden: false,
    createElement() {
      const offscreen = {getContext: () => ({putImageData(image) { offscreen.image = image; }})};
      return offscreen;
    }
  };
  class ControlledWorker {
    constructor() { this.requests = []; workers.push(this); }
    postMessage(request) { this.requests.push(structuredClone(request)); }
    terminate() { this.terminated = true; }
    reply(request) {
      const {width: w, height: h} = request.view;
      const pixels = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < pixels.length; i += 4)
        pixels.set([request.view.tilt, request.doppler ? 221 : 17, Math.floor(request.time) % 256, 255], i);
      this.onmessage({data: {type: 'frame', job: request.job, generation: request.generation,
        viewKey: request.viewKey, quality: request.quality, width: w, height: h,
        time: request.time, doppler: request.doppler, pixels: pixels.buffer, duration: 100}});
    }
  }
  const sandbox = {document, BlackHoleSoftwareCore: RowTracer, URL, Uint8ClampedArray,
    performance: {now: clock.now}, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    ImageData: class { constructor(data, w, h) {
      assert.equal(data.length, w * h * 4); this.data = data; this.width = w; this.height = h;
    }}
  };
  sandbox.window = sandbox;
  if (worker) sandbox.Worker = ControlledWorker;
  loadRunner(sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/blackhole-software.js'), 'utf8'), sandbox,
    {filename: 'blackhole-software.js'});
  const renderer = sandbox.BlackHoleSoftware.create(canvas, {
    onReady() { ready++; }, onError(error) { errors.push(error); },
    onDetail(quality) { details.push(quality); },
    onFrame(frame) { frames.push({...frame, data: new Uint8ClampedArray(frame.pixels).slice()}); }
  });
  renderer.resize(width, height);
  return {clock, log, paints, frames, details, errors, workers, canvas, document, renderer,
    get ready() { return ready; },
    resize(w, h) { canvas.width = w; canvas.height = h; renderer.resize(w, h); },
    finish() { renderer.destroy(); clock.drain(); assert.equal(errors.length, 0); }
  };
}

function animate(h, initialTime = 1) {
  let running = true, time = initialTime;
  function tick() { if (!running) return; h.renderer.render(state(8, {time: time++})); h.clock.setTimeout(tick, 16); }
  h.clock.setTimeout(tick, 16);
  return () => { running = false; };
}

function assertOneTracePerRow(log, expectedViews) {
  assert.equal(log.views.length, expectedViews, 'Only preview and HD geometry should be allocated for one camera');
  for (const [viewId, view] of log.views.entries()) {
    const rows = new Uint8Array(view.height);
    for (const call of log.traces.filter(t => t.viewId === viewId))
      for (let row = call.start; row < call.end; row++) rows[row]++;
    assert.ok(rows.every(count => count === 1), 'Every geometry row must be traced exactly once');
  }
}

test('adapter: continuously advancing time reaches HD and subsequent animation only reshades', () => {
  const h = adapterHarness();
  h.renderer.render(state()); const stopAnimation = animate(h);
  h.clock.until(() => h.frames.some(f => f.quality === 'high'), 'Continuous animation must reach HD');
  const firstHD = h.frames.find(f => f.quality === 'high');
  assert.equal(firstHD.width, 768); assert.equal(firstHD.height, 512);
  assert.ok(firstHD.time >= 10, 'Animation updates were active while HD was being requested');
  assertPixels(firstHD, 8, true, firstHD.time);
  assertOneTracePerRow(h.log, 2);
  const traces = h.log.traces.length;
  h.clock.until(() => h.frames.filter(f => f.quality === 'high').length >= 3);
  assert.equal(h.log.traces.length, traces, 'Animation frames must reuse the completed HD geometry');
  assert.equal(h.canvas.dataset.detail, 'high');
  assert.equal(h.paints.at(-1).smoothing, false, 'HD uses exact rendered pixels');
  assert.equal(h.ready, 1);
  stopAnimation(); h.finish();
});

test('adapter: changing only Doppler colors reuses HD geometry and displays the new colors', () => {
  const h = adapterHarness();
  h.renderer.render(state()); h.clock.drain();
  const traceCount = h.log.traces.length, viewCount = h.log.views.length;
  h.renderer.render(state(8, {time: 37, doppler: false})); h.clock.drain();
  assert.equal(h.log.traces.length, traceCount);
  assert.equal(h.log.views.length, viewCount);
  assertPixels(h.frames.at(-1), 8, false, 37);
  assert.equal(h.frames.at(-1).quality, 'high');
  h.finish();
});

test('adapter: A -> partially traced B -> A never presents partial B under the A cache key', () => {
  const h = adapterHarness({width: 16, height: 48});
  h.renderer.render(state()); h.clock.drain();
  assertPixels(h.frames.at(-1), 8, true, 0);
  h.renderer.render(state(35));
  h.clock.until(() => h.log.traces.some(t => t.tilt === 35));
  assert.ok(h.log.traces.filter(t => t.tilt === 35).at(-1).end < 48);
  const before = h.paints.length;
  h.renderer.render(state()); h.clock.drain();
  assert.ok(h.paints.length > before);
  for (const frame of h.frames.slice(before)) assertPixels(frame, 8, true, 0);
  assertPixels(h.paints.at(-1), 8, true, 0);
  assert.equal(h.ready, 1); h.finish();
});

test('adapter: late preview replies cannot interrupt refinement or overwrite a painted HD frame', () => {
  const h = adapterHarness({worker: true});
  h.renderer.render(state()); const w = h.workers[0], preview = w.requests[0];
  h.clock.advance(350); const high = w.requests.at(-1);
  assert.equal(preview.quality, 'preview'); assert.equal(high.quality, 'high');
  w.reply(preview);
  assert.equal(h.paints.length, 0, 'A stale preview arriving during HD must be discarded');
  h.renderer.render(state(8, {time: 1}));
  assert.equal(w.requests.length, 2, 'Stale preview cannot clear the active HD job');
  w.reply(high);
  assert.equal(h.paints.length, 1); assert.equal(h.canvas.dataset.detail, 'high');
  w.reply(preview);
  assert.equal(h.paints.length, 1, 'Late preview cannot overwrite an already painted HD frame');
  assertPixels(h.paints[0], 8, true, 0); h.finish();
});

test('adapter: resize invalidates in-flight frames immediately, including before the next render callback', () => {
  const h = adapterHarness({worker: true});
  h.renderer.render(state()); h.clock.advance(350);
  const w = h.workers[0], obsolete = w.requests.at(-1);
  h.resize(640, 360);
  w.reply(obsolete);
  assert.equal(h.paints.length, 0, 'An old-size frame cannot paint between resize and the next animation callback');
  h.renderer.render(state()); const next = w.requests.at(-1);
  assert.notEqual(next.generation, obsolete.generation);
  w.reply(next);
  assert.equal(h.paints.length, 1);
  assert.equal(h.paints[0].width, next.view.width);
  assert.equal(h.paints[0].height, next.view.height);
  w.reply(obsolete);
  assert.equal(h.paints.length, 1, 'Old generation remains rejected after the new view paints');
  h.finish();
});

test('adapter: becoming visible after a hidden refinement deadline resumes HD rendering', () => {
  const h = adapterHarness();
  h.renderer.render(state());
  h.clock.until(() => h.frames.length > 0);
  assert.equal(h.frames.at(-1).quality, 'preview');
  h.document.hidden = true; h.clock.advance(400);
  assert.ok(h.details.includes('refining'));
  assert.equal(h.frames.length, 1, 'Hidden document must not start expensive refinement');
  h.renderer.render(state(8, {time: 11}));
  h.document.hidden = false; h.renderer.render(state(8, {time: 12}));
  h.clock.until(() => h.frames.some(f => f.quality === 'high'), 'Returning to a visible tab must resume refinement');
  assertPixels(h.frames.at(-1), 8, true, 12);
  assert.equal(h.canvas.dataset.detail, 'high'); h.finish();
});
