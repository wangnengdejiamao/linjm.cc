'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const A = require('../js/aps-model.js');

const SCENARIOS = [{}, { rush: true }, { down: true }, { matDelay: 8 }, { rush: true, down: true, matDelay: 12 }];

test('improved plan is never worse than the heuristic', () => {
  for (const o of SCENARIOS) {
    const r = A.solve(o);
    assert.ok(r.improved.ev.obj <= r.heuristic.ev.obj, JSON.stringify(o));
  }
});

test('validator finds no violations in either plan', () => {
  for (const o of SCENARIOS) {
    const r = A.solve(o);
    for (const ops of [r.heuristic.ops, r.improved.ops]) {
      const v = A.validate(r.sc, ops);
      assert.deepEqual(Object.values(v).filter(x => x !== 0), [], JSON.stringify(o) + ' ' + JSON.stringify(v));
    }
  }
});

test('validator catches an operation moved into a maintenance window', () => {
  const r = A.solve({});
  const ops = r.improved.ops.map(op => Object.assign({}, op));
  const onCnc2 = ops.filter(op => op.res === 'CNC-2');
  onCnc2[0].start = 9; onCnc2[0].end = 9 + onCnc2[0].dur;   // inside 08–12h maintenance
  const v = A.validate(r.sc, ops);
  assert.ok(v['V-CAL'] > 0);
});

test('objective is 1000 × late orders + late minutes', () => {
  const r = A.solve({ matDelay: 8 });
  const e = r.heuristic.ev;
  assert.equal(e.obj, 1000 * e.late + e.lateMin);
});
