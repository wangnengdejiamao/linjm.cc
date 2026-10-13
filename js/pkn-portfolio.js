/* A source-to-rule PKN workspace reconstructed with synthetic examples only. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), model=window.PortfolioModel;
  if(!$('pknFlowGraph')||!model)return;
  const sources=[
    {id:'orders',name:'订单与物料.xlsx',type:'TABLE',meta:'2 张示例表 · 订单 / 物料',citation:'订单表 A:B 列 · 物料表 C 列',excerpt:'订单 A / B / C 的交期分别为 D+3 / D+4 / D+5。初始到料日均为 D+0；场景试算可调整 A 的到料日。'},
    {id:'process',name:'工艺说明.md',type:'DOCUMENT',meta:'2 道工序 · 加工 → 检测',citation:'工艺说明 · 第 2 节',excerpt:'每张订单先加工、再检测。每道工序耗时 1 天；检测必须等待本订单加工完成。'},
    {id:'constraints',name:'约束说明.md',type:'RULE SOURCE',meta:'资源互斥 · 到料约束',citation:'约束说明 · 第 1–2 节',excerpt:'加工和检测资源各有 1 个并行槽位，同一时段只能处理一项任务。加工开始时间不得早于物料可用时点。'}
  ];
  const nodes=[
    {id:'s-order',col:0,y:24,label:'订单与物料',code:'SOURCE / XLSX',source:'orders',text:'订单与物料资料保留表名、行列定位。示例包含三张订单，不包含客户原始数据。'},
    {id:'s-process',col:0,y:51,label:'工艺说明',code:'SOURCE / DOC',source:'process',text:'工艺文档提供工序顺序和耗时，抽取结果进入候选数据。'},
    {id:'s-constraint',col:0,y:78,label:'约束说明',code:'SOURCE / RULE',source:'constraints',text:'把自然语言约束拆成资源容量、到料条件和适用范围。'},
    {id:'d-order',col:1,y:24,label:'订单字段',code:'DATA / 3 ROWS',source:'orders',text:'订单编号映射为字符串，交期映射为相对天。字段语义需要与原表一同复核。'},
    {id:'d-process',col:1,y:51,label:'工序数据',code:'DATA / 2 STEPS',source:'process',text:'加工、检测各 1 天；工序顺序与时长均保留来源。'},
    {id:'d-capacity',col:1,y:78,label:'容量与到料',code:'DATA / CONSTRAINT',source:'constraints',text:'资源容量为 1；到料时间来自物料表。单位与适用范围影响后续规则。'},
    {id:'o-order',col:2,y:20,label:'订单 Order',code:'SEMANTIC / CLASS',source:'orders',text:'关键属性：id、due_day。订单关联物料和有序工序，交期用于计算晚交。'},
    {id:'o-material',col:2,y:41,label:'物料 Material',code:'SEMANTIC / CLASS',source:'orders',text:'关键属性：ready_day。物料约束首道工序的最早开工时间。'},
    {id:'o-operation',col:2,y:62,label:'工序 Operation',code:'SEMANTIC / CLASS',source:'process',text:'关键属性：duration、predecessor。工序属于订单，并占用一个指定资源。'},
    {id:'o-resource',col:2,y:83,label:'资源 Resource',code:'SEMANTIC / CLASS',source:'constraints',text:'关键属性：capacity = 1。候选计划需要检查同一资源上的时间区间是否相交。'},
    {id:'r-material',col:3,y:24,label:'到料约束',code:'RULE / R-MAT',source:'constraints',text:'加工开始 ≥ 物料可用时点。缺少到料信息时应保留待确认状态。',rule:true},
    {id:'r-precedence',col:3,y:51,label:'工序前置',code:'RULE / R-PRE',source:'process',text:'检测开始 ≥ 本订单加工完成。规则来自流程说明，可用反例验证。',rule:true},
    {id:'r-capacity',col:3,y:78,label:'资源互斥',code:'RULE / R-CAP',source:'constraints',text:'容量为 1 的同一资源，任意两项任务的占用区间不得重叠。',rule:true},
    {id:'g-test',col:4,y:34,label:'用例校验',code:'GOVERNANCE / TEST',text:'把候选规则应用到合成计划，并加入反例检查。校验只覆盖页面列出的三项约束。'},
    {id:'g-review',col:4,y:69,label:'人工复核',code:'GOVERNANCE / REVIEW',text:'核对来源、适用边界与例外；当前状态为待复核。通过示例测试不等于正式批准。'}
  ];
  const edges=[['s-order','d-order'],['s-process','d-process'],['s-constraint','d-capacity'],
    ['d-order','o-order'],['d-order','o-material'],['d-process','o-operation'],['d-capacity','o-material'],['d-capacity','o-resource'],
    ['o-order','r-material'],['o-material','r-material'],['o-operation','r-precedence'],['o-resource','r-capacity'],
    ['r-material','g-test'],['r-precedence','g-test'],['r-capacity','g-test'],['g-test','g-review']];
  let selected='r-capacity', focused=false, selectedSource='orders';
  const positions=[10,30,50,70,90];
  function jump(view){const tab=document.querySelector('[data-pkn-view="'+view+'"]');tab.click();tab.focus({preventScroll:true});}
  function related(id){
    const all=new Set([id]);
    [0,1].forEach(direction=>{
      const seen=new Set([id]), queue=[id];
      while(queue.length){const n=queue.shift();edges.forEach(e=>{if(e[direction]===n&&!seen.has(e[1-direction])){seen.add(e[1-direction]);all.add(e[1-direction]);queue.push(e[1-direction]);}});}
    });
    return all;
  }
  function renderGraph(){
    const connected=related(selected);
    $('pknGraphCount').textContent=nodes.length+' 个条目 · '+edges.length+' 条关系';
    $('pknFlowGraph').classList.toggle('is-focused',focused);
    const paths=edges.map(([a,b])=>{
      const from=nodes.find(n=>n.id===a),to=nodes.find(n=>n.id===b);
      const x1=positions[from.col]*10+63,x2=positions[to.col]*10-63,y1=from.y*4.1,y2=to.y*4.1,m=(x1+x2)/2;
      return `<path class="pkn-edge ${connected.has(a)&&connected.has(b)?'connected':'muted'}" d="M ${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}"/>`;
    }).join('');
    $('pknFlowGraph').innerHTML='<svg viewBox="0 0 1000 410" preserveAspectRatio="none" aria-hidden="true">'+paths+'</svg>'+
      ['来源','数据','语义','规则','治理'].map((label,i)=>`<span class="pkn-layer-label" style="left:${positions[i]}%">0${i+1} · ${label}</span>`).join('')+
      nodes.map(n=>`<button type="button" class="pkn-node layer-${n.col} ${connected.has(n.id)?'connected':'muted'}" style="left:${positions[n.col]}%;top:${n.y}%" data-pkn-node="${n.id}" aria-pressed="${n.id===selected}"><small>${n.code}</small><strong>${n.label}</strong></button>`).join('');
    const n=nodes.find(n=>n.id===selected),source=sources.find(s=>s.id===n.source);
    $('pknInspector').innerHTML=`<div><span>${n.code}</span><h4>${n.label}</h4><p>${n.text}</p></div><div class="pkn-inspector-source"><b>${source?'来源定位':'当前状态'}</b><p>${source?source.citation:'待人工复核 · 示例空间'}</p><button type="button" class="pkn-text-action" ${source?'data-pkn-source-jump="'+source.id+'"':'data-pkn-jump="rules"'}>${source?'回读示例材料 ↗':'查看校验用例 →'}</button></div>`;
  }
  function renderSources(){
    $('pknSources').innerHTML=sources.map(s=>`<button type="button" class="pkn-source-card" data-pkn-source="${s.id}" aria-pressed="${selectedSource===s.id}"><span>${s.type}</span><strong>${s.name}</strong><small>${s.meta}</small></button>`).join('');
    const source=sources.find(s=>s.id===selectedSource);
    $('pknSourcePreview').innerHTML=`<span>合成材料片段 / ${source.citation}</span><h4>${source.name}</h4><blockquote>${source.excerpt}</blockquote><p>示例字段可在「对象映射」中继续追踪。</p>`;
  }
  $('pknFlowGraph').addEventListener('click',event=>{
    const b=event.target.closest('[data-pkn-node]');if(!b)return;
    selected=b.dataset.pknNode;renderGraph();document.querySelector('[data-pkn-node="'+selected+'"]').focus({preventScroll:true});
  });
  $('pknFocus').addEventListener('click',()=>{focused=!focused;$('pknFocus').setAttribute('aria-pressed',String(focused));$('pknFocus').textContent=focused?'显示全部关系':'只看当前链路';renderGraph();});
  $('enterpriseDemo').addEventListener('click',event=>{
    const source=event.target.closest('[data-pkn-source]');
    if(source){selectedSource=source.dataset.pknSource;renderSources();document.querySelector('[data-pkn-source="'+selectedSource+'"]').focus({preventScroll:true});}
    const sourceJump=event.target.closest('[data-pkn-source-jump]');
    if(sourceJump){selectedSource=sourceJump.dataset.pknSourceJump;renderSources();jump('sources');}
    const go=event.target.closest('[data-pkn-jump]');if(go)jump(go.dataset.pknJump);
  });
  $('pknCounterexample').addEventListener('change',()=>{$('pknCheckResults').innerHTML='<p>样本已改变，请重新运行校验。</p>';});
  $('pknRunChecks').addEventListener('click',()=>{
    const tasks=model.schedule(0,'fixed').tasks.map(t=>({...t}));
    if($('pknCounterexample').checked){const task=tasks.find(t=>t.id==='B-0');task.start=0;task.end=1;}
    const results=model.validateTasks(tasks);
    $('pknCheckResults').innerHTML=results.map(r=>`<div class="${r.violations.length?'check-fail':'check-pass'}"><span>${r.violations.length?'×':'✓'}</span><strong>${r.id} · ${r.label}</strong><p>${r.violations.length?'发现冲突：'+r.violations.join('、'):'示例通过'}</p></div>`).join('');
  });
  renderSources();renderGraph();
})();
