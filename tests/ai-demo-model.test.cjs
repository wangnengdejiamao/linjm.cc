const assert = require('node:assert/strict');
const {schedule,research,orders} = require('../js/ai-demo-model.js');

// Independent constraints: release dates, precedences, resource exclusivity and due dates.
for (let delay=0;delay<=4;delay++) for (const strategy of ['fixed','ready']) {
  const result=schedule(delay,strategy);
  assert.equal(result.tasks.length,6);
  assert.equal(new Set(result.tasks.map(t=>t.id)).size,6);
  for (const o of orders) {
    const tasks=result.tasks.filter(t=>t.order===o.id);
    const first=tasks.find(t=>t.resource===0),second=tasks.find(t=>t.resource===1);
    assert.ok(first.start >= (o.id==='A'?delay:0),'cannot start before material arrival');
    assert.ok(second.start>=first.end,'inspection follows production');
    assert.equal(first.end-first.start,1);
    assert.equal(second.end-second.start,1);
    const summary=result.results.find(r=>r.id===o.id);
    assert.equal(summary.end,second.end);
    assert.equal(summary.late,Math.max(0,second.end-o.due));
  }
  for (const resource of [0,1]) {
    const tasks=result.tasks.filter(t=>t.resource===resource).sort((a,b)=>a.start-b.start);
    for(let i=1;i<tasks.length;i++)assert.ok(tasks[i].start>=tasks[i-1].end,'shared resource must not overlap');
  }
  assert.equal(result.onTime,result.results.filter(o=>o.end<=o.due).length);
  assert.equal(result.makespan,Math.max(...result.tasks.map(t=>t.end)));
}

// A late material may delay A, but a ready-first strategy must not idle for A at t=0.
assert.equal(schedule(4,'fixed').onTime,0);
assert.equal(schedule(4,'ready').onTime,2);
assert.equal(schedule(4,'fixed').makespan-schedule(4,'ready').makespan,2);
assert.equal(schedule(4,'ready').results.find(o=>o.id==='A').late,3);
// At t=1 A becomes ready and has the earliest due date, so it precedes C.
assert.deepEqual(schedule(1,'ready').tasks.filter(t=>t.resource===0).map(t=>t.order),['B','A','C']);
assert.equal(schedule(1,'ready').onTime,3);

for(const added of [false,true]) {
  const data=research(added),ids=new Set(data.nodes.map(n=>n.id));
  assert.equal(ids.size,data.nodes.length);
  data.edges.forEach(([a,b])=>{assert.ok(ids.has(a));assert.ok(ids.has(b));});
  data.nodes.forEach(n=>assert.ok(ids.has(n.source),'source references resolve'));
  assert.equal(data.coverage,added?3:1);
  assert.equal(data.nodes.find(n=>n.id==='payment').missing,!added);
  assert.match(data.verdict,added?/规模复制仍需验证/:/试点部署 ≠ 商业化验证/);
}
console.log('PASS: 10 scheduling scenarios, precedence/resource/release constraints, expected tradeoffs, and evidence references.');
