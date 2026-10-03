'use strict';
/* Tests use the real cooperative runner. The inexpensive tracer records which
 * camera actually reached each row, so cancellation is checked in emitted pixels. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createClock() {
  let now = 1000, id = 0;
  const pending = new Map();
  function next() {
    if (!pending.size) return false;
    const [key, task] = [...pending].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
    pending.delete(key); now = Math.max(now, task.at); task.fn(); return true;
  }
  return {
    now: () => now,
    spend: amount => { now += amount; },
    setTimeout(fn, delay = 0) { const key = ++id; pending.set(key, {fn, at: now + delay}); return key; },
    clearTimeout: key => pending.delete(key),
    next,
    until(predicate, message = 'Expected scheduled work to complete') {
      for (let count = 0; !predicate(); count++) {
        assert.ok(count < 10000, message + ' (iteration limit)');
        assert.ok(next(), message + ' (no pending work)');
      }
    },
    advance(milliseconds) {
      const target = now + milliseconds;
      for (let count = 0; pending.size; count++) {
        assert.ok(count < 10000, 'Timers must make progress');
        if (Math.min(...[...pending.values()].map(t => t.at)) > target) break;
        next();
      }
      now = Math.max(now, target);
    },
    drain() {
      for (let count = 0; pending.size; count++) {
        assert.ok(count < 10000, 'Rendering must settle'); next();
      }
    }
  };
}

function createTracer(clock, traceCost = 0.0008, shadeCost = 0.00006) {
  const log = {views: [], traces: [], shades: []};
  class RowTracer {
    constructor(view) { this.setView(view); }
    setView(view) {
      this.view = {...view}; this.rows = new Uint8Array(view.height);
      this.pixels = new Uint8ClampedArray(view.width * view.height * 4);
      this.viewId = log.views.length;
      log.views.push({...view});
    }
    traceRows(start, end) {
      log.traces.push({viewId: this.viewId, start, end, ...this.view});
      for (let row = start; row < end; row++) this.rows[row] = this.view.tilt;
      clock.spend((end - start) * this.view.width * traceCost);
    }
    shadeRows(start, end, options) {
      if (this.pixels.length !== this.view.width * this.view.height * 4)
        this.pixels = new Uint8ClampedArray(this.view.width * this.view.height * 4);
      log.shades.push({viewId: this.viewId, start, end, ...options});
      for (let row = start; row < end; row++) {
        for (let col = 0; col < this.view.width; col++) {
          const i = (row * this.view.width + col) * 4;
          this.pixels[i] = this.rows[row];
          this.pixels[i + 1] = options.doppler ? 221 : 17;
          this.pixels[i + 2] = Math.floor(options.time) % 256;
          this.pixels[i + 3] = 255;
        }
      }
      clock.spend((end - start) * this.view.width * shadeCost);
      return this.pixels;
    }
  }
  return {RowTracer, log};
}

function loadRunner(sandbox) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/blackhole-software-runner.js'), 'utf8'), sandbox,
    {filename: 'blackhole-software-runner.js'});
  return sandbox.BlackHoleSoftwareRunner;
}

function assertPixels(frame, tilt, doppler, time) {
  const pixels = frame.data || new Uint8ClampedArray(frame.pixels);
  assert.equal(pixels.length, frame.width * frame.height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(pixels[i], tilt, 'Every displayed row must belong to the requested complete geometry');
    assert.equal(pixels[i + 1], doppler ? 221 : 17, 'Color must match the completed shading pass');
    assert.equal(pixels[i + 2], Math.floor(time) % 256, 'One frame cannot mix animation times');
    assert.equal(pixels[i + 3], 255);
  }
}

function makeRequest(job, tilt = 8, options = {}) {
  const view = {width: 16, height: 48, tilt, azimuth: .35, zoom: 1, ...options.view};
  return {type: 'render', job, generation: job, quality: 'high',
    viewKey: [view.width, view.height, view.tilt, view.azimuth, view.zoom].join('/'),
    view, time: 0, doppler: true, ...options};
}

function runnerHarness() {
  const clock = createClock(), {RowTracer, log} = createTracer(clock);
  const sandbox = {BlackHoleSoftwareCore: RowTracer, setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout, performance: {now: clock.now}};
  const frames = [];
  const runner = loadRunner(sandbox).create(frame => {
    // Model worker postMessage transfer, including detachment of the core buffer.
    frames.push(structuredClone(frame, frame.pixels ? {transfer: [frame.pixels]} : undefined));
  });
  return {clock, log, runner, frames};
}

if (require.main === module) {
  test('runner: A -> partially traced B -> A emits only complete A geometry', () => {
    const h = runnerHarness();
    h.runner.render(makeRequest(1)); h.clock.drain();
    assertPixels(h.frames[0], 8, true, 0);
    h.runner.render(makeRequest(2, 35)); h.clock.next();
    const b = h.log.traces.filter(t => t.tilt === 35);
    assert.ok(b.length && b.at(-1).end < 48, 'B is deliberately interrupted before completion');
    h.runner.render(makeRequest(3)); h.clock.drain();
    assert.deepEqual(h.frames.map(f => f.job), [1, 3], 'Cancelled B cannot emit a frame');
    assertPixels(h.frames.at(-1), 8, true, 0);
  });

  test('runner: color/time updates reuse complete geometry after transferable-buffer detachment', () => {
    const h = runnerHarness();
    h.runner.render(makeRequest(1)); h.clock.drain();
    const traceCount = h.log.traces.length, viewCount = h.log.views.length;
    h.runner.render(makeRequest(2, 8, {time: 37, doppler: false})); h.clock.drain();
    assert.equal(h.log.traces.length, traceCount, 'Shading changes must not trace rays again');
    assert.equal(h.log.views.length, viewCount, 'Shading changes must not reset the geometry');
    assertPixels(h.frames.at(-1), 8, false, 37);
  });

  test('runner: cancellation during shading cannot leak a partly shaded frame', () => {
    const h = runnerHarness();
    h.runner.render(makeRequest(1));
    h.clock.until(() => h.log.shades.length > 0);
    assert.equal(h.frames.length, 0);
    h.runner.cancel(); h.clock.drain();
    assert.equal(h.frames.length, 0);
    h.runner.render(makeRequest(2, 8, {time: 19})); h.clock.drain();
    assertPixels(h.frames[0], 8, true, 19);
  });
}

module.exports = {createClock, createTracer, loadRunner, assertPixels};
