/* Interactive portfolio. All case content is synthetic and stays in the browser. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const model = window.PortfolioModel;
  if (!model || !$('researchDemo')) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
        if(event.key==='ArrowRight') next=(index+1)%buttons.length;
        if(event.key==='ArrowLeft') next=(index+buttons.length-1)%buttons.length;
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
  wireTabs('data-operations-view');

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
    renderEvidence();renderReasoning();renderReport();
  });
  renderEvidence();renderReasoning();renderReport();

  // One small scheduling model feeds the chart, KPI values, explanations and graph.
  let selectedTask='A-0',selectedObject='material';
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
    renderObjectDetail();
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
  const objects=[
    {id:'source',x:15,y:25,label:'来源资料',en:'SOURCE'},
    {id:'material',x:15,y:74,label:'物料',en:'MATERIAL'},
    {id:'order',x:49,y:25,label:'订单',en:'ORDER'},
    {id:'operation',x:49,y:74,label:'工序',en:'OPERATION'},
    {id:'resource',x:83,y:25,label:'资源',en:'RESOURCE'},
    {id:'review',x:83,y:74,label:'计划审核',en:'REVIEW'}
  ];
  function renderObjectGraph(){
    $('operationsGraph').innerHTML='<svg viewBox="0 0 750 240" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#567e87" stroke-width="1.2"><path d="M113 60H368V178H622V60H368M113 60V178H368"/><path d="M622 60V178" stroke-dasharray="4 4"/></g></svg>'+objects.map(o=>`<button type="button" class="object-node" data-object="${o.id}" style="left:${o.x}%;top:${o.y}%" aria-pressed="${o.id===selectedObject}">${o.label}<small>${o.en}</small></button>`).join('');
  }
  function renderObjectDetail(){
    const d=currentSchedule();
    const copy={
      source:['来源资料 → 对象与规则','资料中的字段映射到订单、物料与资源，并保留原始出处。当前演示使用合成数据，规则不来自客户实际生产文件。'],
      material:['物料 → 工序最早开工',`订单 A 的物料可用时点为 D+${d.delay}。加工必须等待到料；之后检测还需等待加工完成与检测资源空闲。`],
      order:['订单 → 交期与工序','A、B、C 的交期分别是 D+3、D+4、D+5。每张订单包含加工和检测两道工序，交期不是可以突破工序约束的理由。'],
      operation:['工序 → 前置依赖','每道工序耗时 1 天。开始时间取物料/前序完成与资源可用时点的较晚值。检测不能早于加工完成。'],
      resource:['共享资源 → 互斥约束','加工单元与检测单元各只有一个资源槽，同一资源同时只能处理一个任务。甘特图由这条约束逐项计算。'],
      review:['候选计划 → 人工审核',`当前示例 ${d.onTime}/3 订单按期，最大晚交 ${d.maxLate} 天。试算结果应连同假设和约束交给计划员复核；演示不会批准或下达生产任务。`]
    };
    $('ontologyDetail').innerHTML=`<strong>${copy[selectedObject][0]}</strong><br>${copy[selectedObject][1]}`;
  }
  $('operationsGraph').addEventListener('click',event=>{
    const b=event.target.closest('[data-object]');if(!b)return;
    selectedObject=b.dataset.object;
    document.querySelectorAll('[data-object]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
    renderObjectDetail();
  });
  renderObjectGraph();renderSchedule();

  // Existing public anchors continue to open the appropriate original demo.
  function resolveAnchor(){
    const hash=location.hash.slice(1);
    const aliases={ontology:'sustech','ontology-operations':'enterprise'};
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

  // A projected 3D structure, drawn in Canvas so the portfolio has no WebGL/CDN dependency.
  const canvas=$('knowledgeEngine'),ctx=canvas.getContext('2d');
  if(!ctx)return;
  let width=1,height=1,phase=.38,raf=0,lastTime=0,visible=true,paused=motion.matches,layer='all';
  const colors=['#8dcccc','#91b3d8','#d2b48a'];
  const layerNodes=Array.from({length:3},(_,level)=>Array.from({length:9},(_,i)=>{
    const angle=i*2*Math.PI/8;
    const r=i===8?0:[117,139,88][level];
    return {x:Math.cos(angle)*r,z:Math.sin(angle)*r,y:(level-1)*104,level,i};
  }));
  function project(p){
    const yaw=phase*.22;
    const x=p.x*Math.cos(yaw)-p.z*Math.sin(yaw),z=p.x*Math.sin(yaw)+p.z*Math.cos(yaw);
    const tilt=.53;
    const y=p.y*Math.cos(tilt)-z*Math.sin(tilt),depth=p.y*Math.sin(tilt)+z*Math.cos(tilt);
    const scale=Math.min(width/540,height/510)*1.02*(700/(700+depth));
    return {x:width*.51+x*scale,y:height*.42+y*scale,depth,scale};
  }
  function opacity(level){return layer==='all'||['source','knowledge','decision'][level]===layer?1:.16;}
  function path3d(points,color,alpha,lineWidth,closed){
    ctx.beginPath();points.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});if(closed)ctx.closePath();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=lineWidth;ctx.stroke();ctx.globalAlpha=1;
  }
  function paint(){
    ctx.clearRect(0,0,width,height);
    const unit=Math.min(width/540,height/510),cx=width*.51,cy=height*.41;
    const halo=ctx.createRadialGradient(cx,cy,12,cx,cy,225*unit);halo.addColorStop(0,'#24424d33');halo.addColorStop(.73,'#1c334c18');halo.addColorStop(1,'#17344600');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
    // A faint enclosing sphere and orbital curves provide depth without hiding labels.
    ctx.strokeStyle='#446574';ctx.globalAlpha=.28;ctx.lineWidth=.7;ctx.beginPath();ctx.arc(cx,cy,190*unit,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    for(let r=0;r<3;r++){
      const pts=Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return {x:Math.cos(a)*(196+r*10),y:Math.sin(a)*35,z:Math.sin(a)*(196+r*10)};});
      path3d(pts,r===1?'#bda780':'#607b8b',r===1?.36:.17,.8,false);
    }
    // Structured links carry animated pulses between adjacent knowledge layers.
    for(let l=0;l<2;l++)for(let i=0;i<8;i++){
      const a=layerNodes[l][i],b=layerNodes[l+1][(i+(l?1:0))%8];
      const alpha=Math.max(opacity(l),opacity(l+1));
      path3d([a,b],colors[l],.23*alpha,.8,false);
      const progress=(phase*.22+i*.123)%1;
      const p=project({x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress,z:a.z+(b.z-a.z)*progress});
      ctx.globalAlpha=.8*alpha;ctx.fillStyle=colors[l];ctx.beginPath();ctx.arc(p.x,p.y,1.45*unit,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    layerNodes.forEach((nodes,l)=>{
      const alpha=opacity(l);
      path3d(nodes.slice(0,8),colors[l],.48*alpha,.8,true);
      const circle=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return {x:Math.cos(a)*[138,156,107][l],y:nodes[0].y,z:Math.sin(a)*[138,156,107][l]};});
      path3d(circle,colors[l],.26*alpha,.6,false);
      for(let i=0;i<8;i+=2)path3d([nodes[i],nodes[8],nodes[(i+3)%8]],colors[l],.21*alpha,.6,false);
    });
    const projected=layerNodes.flat().map(p=>({...p,q:project(p)})).sort((a,b)=>b.q.depth-a.q.depth);
    projected.forEach(p=>{
      const q=p.q,s=q.scale,alpha=opacity(p.level),r=p.i===8?10:5;
      ctx.globalAlpha=alpha;ctx.fillStyle='#132936';ctx.strokeStyle=colors[p.level];ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(q.x-r*s,q.y-3*s);ctx.lineTo(q.x,q.y-8*s);ctx.lineTo(q.x+r*s,q.y-3*s);ctx.lineTo(q.x+r*s,q.y+4*s);ctx.lineTo(q.x,q.y+9*s);ctx.lineTo(q.x-r*s,q.y+4*s);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=colors[p.level];ctx.beginPath();ctx.arc(q.x,q.y,p.i===8?2.8*s:1.5*s,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    });
    const labels=[['SOURCE','来源资料',-.99,-1.04],['KNOWLEDGE','知识对象',1.02,-.08],['DECISION','推理与行动',-.9,.94]];
    labels.forEach((label,l)=>{
      const x=cx+label[2]*184*unit,y=cy+label[3]*132*unit;
      const align=label[2]>0?'right':'left';
      ctx.globalAlpha=opacity(l);ctx.textAlign=align;ctx.fillStyle=colors[l];ctx.font='9px ui-monospace,monospace';ctx.fillText(label[0],x,y);ctx.fillStyle='#88a7b8';ctx.font='10px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText(label[1],x,y+17);ctx.globalAlpha=1;
    });
  }
  function animate(time){raf=0;if(!visible||document.hidden||paused){lastTime=0;return;}if(lastTime)phase+=Math.min((time-lastTime)/1000,.05);lastTime=time;paint();raf=requestAnimationFrame(animate);}
  function updateAnimation(){cancelAnimationFrame(raf);raf=0;lastTime=0;paint();if(visible&&!document.hidden&&!paused)raf=requestAnimationFrame(animate);}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);width=Math.max(1,rect.width);height=Math.max(1,rect.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);paint();}
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;updateAnimation();},{threshold:.02}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{updateAnimation();if(document.hidden)stopReasoning();});
  function updatePause(){ $('scenePause').setAttribute('aria-pressed',String(paused));$('scenePause').setAttribute('aria-label',paused?'播放空间动画':'暂停空间动画');$('scenePause').textContent=paused?'播放':'暂停';updateAnimation(); }
  $('scenePause').addEventListener('click',()=>{paused=!paused;updatePause();});
  motion.addEventListener('change',event=>{paused=event.matches;updatePause();});
  const layerCopy={all:['01 — 03','每一个决策，都有来处。','文档 → 知识 → 推理 → 行动'],source:['01 / SOURCE','让原始资料成为可引用的证据。','保留原文、版本与定位'],knowledge:['02 / KNOWLEDGE','让孤立的事实建立连接。','对象 · 关系 · 条件 · 规则'],decision:['03 / DECISION','让变化有解释，让行动有依据。','追踪影响 · 比较方案 · 人工判断']};
  document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{
    layer=button.dataset.scene;document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $('sceneNumber').textContent=layerCopy[layer][0];$('sceneTitle').textContent=layerCopy[layer][1];$('sceneDescription').textContent=layerCopy[layer][2];paint();
  }));
  resize();updatePause();
})();
