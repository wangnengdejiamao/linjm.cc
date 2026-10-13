/* Deterministic, synthetic portfolio examples. No production data or API calls. */
(function (root) {
  'use strict';
  const orders = Object.freeze([
    Object.freeze({id:'A', due:3, release:0}),
    Object.freeze({id:'B', due:4, release:0}),
    Object.freeze({id:'C', due:5, release:0})
  ]);
  function schedule(delay, strategy) {
    delay = Math.min(4, Math.max(0, Math.round(Number(delay) || 0)));
    const jobs = orders.map(o => ({...o, release:o.id === 'A' ? delay : 0}));
    const resourceEnds = [0,0];
    const tasks = [], results = [];
    while (jobs.length) {
      let index=0;
      if(strategy==='ready') {
        const now=resourceEnds[0];
        const ready=jobs.filter(o=>o.release<=now).sort((a,b)=>a.due-b.due);
        const next=ready[0]||jobs.slice().sort((a,b)=>a.release-b.release||a.due-b.due)[0];
        index=jobs.indexOf(next);
      }
      const [job]=jobs.splice(index,1);
      let previousEnd = job.release;
      for (let resource = 0; resource < 2; resource++) {
        const resourceReady = resourceEnds[resource];
        const start = Math.max(previousEnd, resourceReady);
        const task = {id:job.id+'-'+resource, order:job.id, resource,
          start, end:start+1, materialReady:job.release, previousEnd, resourceReady};
        tasks.push(task);
        resourceEnds[resource] = task.end;
        previousEnd = task.end;
      }
      results.push({...job, end:previousEnd, late:Math.max(0,previousEnd-job.due)});
    }
    results.sort((a,b) => a.id.localeCompare(b.id));
    return {delay, strategy, tasks, results, makespan:Math.max(...results.map(o=>o.end)),
      onTime:results.filter(o=>o.late===0).length, maxLate:Math.max(...results.map(o=>o.late))};
  }
  function research(supplemented) {
    return {
      supplemented:!!supplemented, coverage:supplemented?3:1,
      verdict:supplemented?'首单商业闭环有支持，规模复制仍需验证':'试点部署 ≠ 商业化验证',
      next:supplemented?'已补充付费合同与回款材料；下一步核对续约、复购及其他客户。':'还需要合同、验收与回款证据，才能继续判断。',
      nodes:[
        {id:'bp', kind:'source', x:12, y:27, label:'商业计划书', code:'SOURCE / E01', status:'企业自述', description:'从材料中抽取可检验的陈述，并保留页码。材料有陈述，不等于事实已经核实。', quote:'已在三家试点客户现场完成部署，正在推进商业化。', citation:'虚构 BP · 第 8 页', source:'bp'},
        {id:'interview', kind:'source', x:12, y:54, label:'访谈记录', code:'SOURCE / E02', status:'带时间范围的材料', description:'访谈记录给出了商业化所处的阶段。判断应保留材料的时间范围。', quote:'截至本次访谈，试点尚未签订付费合同。', citation:'虚构访谈 · 第 3 段', source:'interview'},
        {id:'supplement', kind:'source', x:12, y:81, label:supplemented?'合同与回款材料':'待补充材料', code:'SOURCE / E03', missing:!supplemented, status:supplemented?'演示材料已关联':'证据缺口', description:supplemented?'后续补充材料关联了付费订单、验收与首期回款。它支持首单闭环，仍不能证明规模化复制。':'缺少付费合同和回款证据。使用上方按钮加入合成补充材料，观察判断如何变化。', quote:supplemented?'后续签署付费订单，验收已完成；回款凭证记载首期款已到账。':'暂无付费合同、验收单及回款凭证。', citation:'合成补充材料 · 第 2–3 页', source:'supplement'},
        {id:'pilot', kind:'fact', x:38, y:27, label:'试点部署', code:'CLAIM / F01', status:'有来源陈述', description:'BP 支持“企业自述完成试点部署”，还需要现场交付材料进一步核实。不能直接推导客户已经付款。', quote:'已在三家试点客户现场完成部署。', citation:'虚构 BP · 第 8 页', source:'bp'},
        {id:'contract', kind:'fact', x:38, y:54, label:'付费与验收', code:'CLAIM / F02', missing:!supplemented, status:supplemented?'补充材料支持':'尚缺支持', description:supplemented?'补充材料记载付费订单与验收。只把材料实际支持的范围纳入判断。':'试点部署和签约付费是两个独立条件，目前不能从原始材料推导付费已发生。', quote:supplemented?'后续签署付费订单，验收已完成。':'截至本次访谈，试点尚未签订付费合同。', citation:supplemented?'合成补充材料 · 第 2 页':'虚构访谈 · 第 3 段', source:supplemented?'supplement':'interview'},
        {id:'payment', kind:'fact', x:38, y:81, label:'首期回款', code:'CLAIM / F03', missing:!supplemented, status:supplemented?'补充材料支持':'尚缺支持', description:supplemented?'回款材料支持首期款到账，不能推出全额回款或稳定收入。':'未提供回款材料，不将“未提供”解释为“没有回款”。', quote:supplemented?'回款凭证记载首期款已到账。':'暂无回款凭证。', citation:'合成补充材料 · 第 3 页', source:'supplement'},
        {id:'rule', kind:'rule', x:64, y:54, label:'商业闭环条件', code:'RULE / R01', status:'演示规则', description:'分别检查试点部署、付费验收和回款材料。只有三个条件都有来源时，才支持首单商业闭环的示例判断。', quote:'检查交付、付费验收、首期回款；规模复制另行判断。', citation:'本页面合成规则 · R01', source:'rule'},
        {id:'judgment', kind:'decision', x:87, y:54, label:supplemented?'首单有支持':'仍待补证', code:'FINDING / J01', status:supplemented?'有限支持':'证据不足', description:supplemented?'三项条件已有对应示例材料，支持首单闭环；客户续约、复购和规模化仍需独立证据。':'现有材料只能支撑试点自述，尚不足以支持已完成商业化验证。缺口会转为后续访谈问题。', quote:supplemented?'下一步：核对续约、复购和其他客户的合同。':'下一步：补充付费合同、验收材料和回款凭证。', citation:'示例推理摘要 · 非投资结论', source:'rule'}
      ],
      edges:[['bp','pilot'],['interview','contract'],['supplement','contract'],['supplement','payment'],['pilot','rule'],['contract','rule'],['payment','rule'],['rule','judgment']]
    };
  }
  const api = Object.freeze({schedule,research,orders});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PortfolioModel=api;
})(typeof window!=='undefined'?window:globalThis);
