/* Interactive portfolio. All case content is synthetic and stays in the browser. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const model = window.PortfolioModel;
  if (!model || !$('researchDemo')) return;

  // Roving tab focus, including arrows / Home / End. Native buttons handle Enter.
  function wireTabs(attribute, onChange) {
    const buttons = Array.from(document.querySelectorAll('['+attribute+']'));
    const activate = button => {
      buttons.forEach(b => {
        const selected = b === button;
        b.setAttribute('aria-selected', String(selected));
        b.tabIndex = selected ? 0 : -1;
        $(b.getAttribute('aria-controls')).hidden = !selected;
      });
      if (onChange) onChange(button.getAttribute(attribute));
    };
    buttons.forEach((button,index) => {
      button.addEventListener('click',()=>activate(button));
      button.addEventListener('keydown',event=>{
        let next;
        if(event.key==='ArrowRight'||event.key==='ArrowDown') next=(index+1)%buttons.length;
        if(event.key==='ArrowLeft'||event.key==='ArrowUp') next=(index+buttons.length-1)%buttons.length;
        if(event.key==='Home') next=0;
        if(event.key==='End') next=buttons.length-1;
        if(next===undefined)return;
        event.preventDefault();buttons[next].focus();activate(buttons[next]);
      });
    });
    return value => { const b=buttons.find(b=>b.getAttribute(attribute)===value);if(b)activate(b); };
  }

  let supplemented = false, selectedNode = 'judgment', reasoningTimer = 0;
  const selectResearchView = wireTabs('data-research-view',()=>stopReasoning());
  wireTabs('data-pkn-view');

  function relatedNodes(data, id) {
    const related = new Set([id]);
    // Ancestors and descendants are traced independently, so sibling claims stay dim.
    for(const direction of [0,1]) {
      const seen = new Set([id]), queue=[id];
      while(queue.length) {
        const next=queue.shift();
        data.edges.forEach(edge=>{
          if(edge[direction]===next&&!seen.has(edge[1-direction])) {
            seen.add(edge[1-direction]);related.add(edge[1-direction]);queue.push(edge[1-direction]);
          }
        });
      }
    }
    return related;
  }
  function renderEvidence() {
    const data=model.research(supplemented), related=relatedNodes(data,selectedNode);
    const edges=data.edges.map(([a,b])=>{
      const from=data.nodes.find(n=>n.id===a),to=data.nodes.find(n=>n.id===b);
      const active=related.has(a)&&related.has(b);
      const x1=from.x*10,x2=to.x*10,y1=from.y*3.83,y2=to.y*3.83;
      const middle=(x1+x2)/2;
      return `<path class="graph-edge ${active?'active':'dimmed'} ${from.missing||to.missing?'missing':''}" d="M${x1},${y1} C${middle},${y1} ${middle},${y2} ${x2},${y2}"/>`;
    }).join('');
    const columns=[[12,'01 来源材料'],[38,'02 结构化事实'],[64,'03 判断条件'],[87,'04 结论']];
    $('evidenceGraph').innerHTML=`<svg viewBox="0 0 1000 383" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>`+
      columns.map(([x,text])=>`<span class="graph-column-title" style="left:${x}%">${text}</span>`).join('')+
      data.nodes.map(n=>`<button type="button" class="evidence-node ${n.kind} ${n.missing?'missing':''} ${related.has(n.id)?'':'dimmed'}" data-graph-node="${n.id}" aria-pressed="${n.id===selectedNode}" style="left:${n.x}%;top:${n.y}%"><small>${n.code}</small><strong>${n.label}</strong></button>`).join('');
    const node=data.nodes.find(n=>n.id===selectedNode);
    const supported=supplemented&&['supplement','contract','payment','judgment'].includes(node.id);
    $('evidenceInspector').innerHTML=`<span class="panel-kicker">${node.code}</span><h3>${node.label}</h3><span class="inspector-status ${supported?'supported':''}">${node.status}</span><p>${node.description}</p><blockquote>“${node.quote}”<small>${node.citation}</small></blockquote>${node.source!==node.id?`<button type="button" class="inspector-link" data-inspect-source="${node.source}">定位${node.source==='rule'?'判断条件':'来源节点'} ↗</button>`:''}`;
    $('researchVerdict').textContent=data.verdict;
    $('researchNext').textContent=data.next;
    $('researchCoverage').textContent=`${data.coverage} / 3 条件有材料`;
    $('researchResultIcon').textContent=supplemented?'✓':'!';
    document.querySelector('.research-result').classList.toggle('is-supported',supplemented);
  }
  function setNode(id, focus) {
    selectedNode=id;renderEvidence();
    if(focus)document.querySelector(`[data-graph-node="${id}"]`).focus({preventScroll:true});
  }
  $('evidenceGraph').addEventListener('click',event=>{
    const button=event.target.closest('[data-graph-node]');
    if(button)setNode(button.dataset.graphNode,true);
  });
  $('evidenceInspector').addEventListener('click',event=>{
    const button=event.target.closest('[data-inspect-source]');
    if(button)setNode(button.dataset.inspectSource,true);
  });
  function renderReasoning() {
    $('reasoningContent').innerHTML=`<div class="reasoning-intro"><p>把问题分解为条件，再逐项关联材料。每一步都保留事实、解释和证据缺口。</p><button type="button" class="demo-btn" id="playReasoning">▷ 播放推理路径</button></div><ol class="reasoning-steps">
      <li class="complete"><span>01</span><div><strong>从材料提取陈述</strong><p>BP 自述完成三家试点部署，保留来源页码 E01。</p></div><em>有来源陈述</em></li>
      <li class="${supplemented?'complete':''}"><span>02</span><div><strong>对照付费与验收条件</strong><p>${supplemented?'后续补充合同与验收材料 E03，关联到 F02。':'访谈 E02 说明尚未签订付费合同，识别材料缺口。'}</p></div><em>${supplemented?'有补充支持':'待补充'}</em></li>
      <li class="${supplemented?'complete':''}"><span>03</span><div><strong>检查回款证据</strong><p>${supplemented?'补充凭证 E03 记载首期款到账，关联到 F03。':'未提供回款材料；保留未知状态，不推断没有回款。'}</p></div><em>${supplemented?'有补充支持':'待补充'}</em></li>
      <li><span>04</span><div><strong>形成有边界的结论</strong><p>${model.research(supplemented).verdict}。${model.research(supplemented).next}</p></div><em>人工复核</em></li></ol>`;
    $('playReasoning').addEventListener('click',()=>{
      if(reasoningTimer){stopReasoning();return;}
      const steps=Array.from(document.querySelectorAll('.reasoning-steps li'));
      let index=0;
      $('playReasoning').textContent='暂停播放';
      function step(){steps.forEach((el,i)=>{el.classList.toggle('highlighted',i===index);if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});index++;if(index===steps.length){clearInterval(reasoningTimer);reasoningTimer=0;$('playReasoning').textContent='↺ 再看一遍';}}
      step();reasoningTimer=setInterval(step,900);
    });
  }
  function stopReasoning(){clearInterval(reasoningTimer);reasoningTimer=0;if($('playReasoning'))$('playReasoning').textContent='▷ 播放推理路径';}
  function reportText(){const d=model.research(supplemented);return `水晶球 · 研究摘要（虚构数据演示）\n\n问题：这家企业已经完成商业化验证了吗？\n\n当前判断：${d.verdict}\n证据覆盖：${d.coverage}/3 项条件有材料\n\n来源：\nE01 虚构 BP，第 8 页：企业自述三家试点部署。\nE02 虚构访谈，第 3 段：截至访谈尚未签付费合同。\nE03 ${supplemented?'合成补充材料，第 2–3 页：后续付费订单、验收完成、首期回款。':'缺失：付费合同、验收与回款凭证。'}\n\n下一步：${d.next}\n\n所有企业材料、规则与判断均为本页面合成演示，不构成投资评估。\n`;
  }
  function renderReport(){
    const d=model.research(supplemented);
    $('reportContent').innerHTML=`<div class="report-heading"><div><span class="panel-kicker">RESEARCH BRIEF / SYNTHETIC CASE</span><h3>示例项目 A · 商业化验证</h3></div><button type="button" class="demo-btn" id="downloadBrief">↓ 导出摘要</button></div><div class="report-columns"><div><h4>当前判断</h4><p>${d.verdict}。</p><h4>判断依据</h4><p>原始材料自述已完成三家试点部署 <button type="button" class="source-cite" data-cite="bp">[E01]</button>；访谈记录说明截至该时点尚未签付费合同 <button type="button" class="source-cite" data-cite="interview">[E02]</button>。${supplemented?'后续材料支持付费验收及首期回款 <button type="button" class="source-cite" data-cite="supplement">[E03]</button>，可在上述范围内更新判断。':'缺少进一步合同和回款材料，保留未知状态。'}</p></div><div><h4>下一步核对</h4><ul>${supplemented?'<li>续约与复购是否已经发生？</li><li>其他客户是否采用相同付费模式？</li><li>交付是否能够规模复制？</li>':'<li>补充签署的付费合同与验收文件。</li><li>核对合同主体、金额和回款对应关系。</li><li>区分免费试点、试用与正式商业客户。</li>'}</ul><h4>使用范围</h4><p>演示规则和合成材料形成的研究摘要；最终判断需要研究者复核。</p></div></div>`;
    $('downloadBrief').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob(['\ufeff'+reportText()],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='Crystal-Ball-synthetic-brief.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }
  $('reportContent').addEventListener('click',event=>{
    const button=event.target.closest('[data-cite]');if(!button)return;
    selectResearchView('evidence');setNode(button.dataset.cite,true);
  });
  $('addEvidence').addEventListener('click',()=>{
    stopReasoning();supplemented=!supplemented;
    $('addEvidence').setAttribute('aria-pressed',String(supplemented));
    $('addEvidence').textContent=supplemented?'− 移除补充证据':'＋ 加入补充证据';
    renderEvidence();renderReasoning();renderReport();renderMaterials();
  });
  function renderMaterials(){
    const sources=model.research(supplemented).nodes.filter(n=>n.kind==='source');
    $('researchMaterials').innerHTML='<span class="panel-kicker">MATERIAL ROOM / 示例项目 A</span><h3>每条事实，都保留一份来源。</h3>'+sources.map(n=>`<article class="research-source-card"><div><span>${n.code}</span><h4>${n.label}</h4><p>${n.citation}</p></div><span class="material-status">${n.status}</span><button type="button" class="demo-btn" data-material-source="${n.id}">查看原文 →</button></article>`).join('');
  }
  $('researchMaterials').addEventListener('click',event=>{const b=event.target.closest('[data-material-source]');if(b){selectResearchView('evidence');setNode(b.dataset.materialSource,true);}});
  renderEvidence();renderReasoning();renderReport();renderMaterials();

  // One small scheduling model feeds the chart, KPI values, explanations and graph.
  let selectedTask='A-0';
  function currentSchedule(){return model.schedule($('materialDelay').value,document.querySelector('[name=scheduleStrategy]:checked').value);}
  function renderSchedule(){
    const data=currentSchedule(),baseline=model.schedule(0,'fixed'),fixed=model.schedule(data.delay,'fixed');
    $('delayValue').textContent=`${data.delay} 天`;
    $('materialDelay').style.setProperty('--p',`${data.delay/4*100}%`);
    $('onTimeValue').innerHTML=`${data.onTime}<span>/ 3</span>`;
    $('lateValue').innerHTML=`${data.maxLate}<span>天</span>`;
    $('lateValue').classList.toggle('is-late',data.maxLate>0);
    $('gainValue').innerHTML=`${fixed.makespan-data.makespan}<span>天</span>`;
    $('scheduleGantt').innerHTML=`<div class="gantt-axis"><span>资源 / 天</span><div class="gantt-ticks">${Array.from({length:9},(_,i)=>`<span>D+${i}</span>`).join('')}</div></div>`+
      ['加工单元','检测单元'].map((name,resource)=>`<div class="gantt-row"><span class="gantt-row-label">${name}</span><div class="gantt-track">${data.tasks.filter(t=>t.resource===resource).map(t=>`<button type="button" class="gantt-bar" data-task="${t.id}" data-order="${t.order}" aria-label="订单 ${t.order} ${name}，D+${t.start} 至 D+${t.end}" aria-pressed="${t.id===selectedTask}" style="left:${t.start/9*100}%;width:${100/9-0.8}%">${t.order}</button>`).join('')}${baseline.tasks.filter(t=>t.resource===resource).map(t=>`<span class="gantt-baseline" title="原计划 ${t.order}：D+${t.start} 至 D+${t.end}" style="left:${t.start/9*100}%;width:${100/9-0.8}%"></span>`).join('')}</div></div>`).join('');
    $('orderSummary').innerHTML=data.results.map(o=>`<span class="order-status ${o.late?'late':''}">${o.id} · D+${o.end} 完成 · ${o.late?'晚 '+o.late+' 天':'按期'}</span>`).join('');
    renderTaskDetail(data);
    const summary=data.maxLate?`${data.results.filter(o=>o.late).map(o=>o.id).join('、')} 有晚交，最大 ${data.maxLate} 天。${data.strategy==='fixed'?'可切换“就绪订单优先”，比较空档利用与订单交期。':'就绪订单填补了空档，但缺料订单仍受最早开工时间约束。'}`:data.delay?'当前策略下所有订单按期完成。继续增加延迟，可观察交期缓冲何时耗尽。':'物料按计划到达，所有订单可以按期完成。';
    $('scheduleVerdict').textContent=summary;
    document.querySelector('.schedule-verdict').classList.toggle('has-delay',data.maxLate>0);
  }
  function renderTaskDetail(data){
    const task=data.tasks.find(t=>t.id===selectedTask), name=task.resource?'检测':'加工';
    const order=data.results.find(o=>o.id===task.order);
    $('operationDetail').innerHTML=`<strong>订单 ${task.order} · ${name}</strong>　D+${task.start} → D+${task.end}<br><span>开工依据：</span>${task.resource?'前序加工完成 D+'+task.previousEnd:'物料可用 D+'+task.materialReady}；资源空闲 D+${task.resourceReady}。取较晚时点开工。<span>订单交期 D+${order.due}。</span>`;
  }
  $('scheduleGantt').addEventListener('click',event=>{
    const button=event.target.closest('[data-task]');if(!button)return;
    selectedTask=button.dataset.task;
    document.querySelectorAll('[data-task]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    renderTaskDetail(currentSchedule());
  });
  $('materialDelay').addEventListener('input',renderSchedule);
  document.querySelectorAll('[name=scheduleStrategy]').forEach(r=>r.addEventListener('change',renderSchedule));
  $('resetSchedule').addEventListener('click',()=>{
    $('materialDelay').value=0;document.querySelector('[name=scheduleStrategy][value=fixed]').checked=true;selectedTask='A-0';renderSchedule();
  });
  renderSchedule();

  // Existing public anchors continue to open the appropriate original demo.
  function resolveAnchor(){
    const hash=location.hash.slice(1);
    const aliases={'ontology-operations':'enterprise'};
    const target=$(aliases[hash]||hash);
    if(!target)return;
    const detail=target.matches('details')?target:target.closest('details');
    if(detail)detail.open=true;
    if(detail||aliases[hash])requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  }
  document.querySelectorAll('.archive-project').forEach(d=>d.addEventListener('toggle',()=>{
    if(d.open)requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }));
  window.addEventListener('hashchange',resolveAnchor);resolveAnchor();

})();
