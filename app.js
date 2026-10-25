"use strict";
const labels={knowledge:"知识与问答",deep_reasoning:"科学推理与证明",quantitative:"定量与计算",multimodal_grounding:"多模态理解",literature_grounding:"文献与证据",tool_use:"Agent 与工具",code_execution:"代码与执行",prediction:"科学预测",generation_design:"生成与设计",simulation:"模拟与控制",safety_calibration:"安全与校准",reproducibility:"可复现与审计",communication:"科学交流",scientific_reasoning:"通用科学推理",agentic_execution:"Agent 执行",artifact_scoring:"产物验证",static_qa:"静态问答",retrieval_ranking:"检索排序",generation_quality:"生成质量",simulation_control:"仿真控制",safety_refusal:"安全拒答",regression_or_ranking:"回归与排名",rubric_reasoning:"规则量表",orient:"知识理解",retrieve:"文献检索",hypothesize:"假设构建",plan:"实验设计",execute:"工具执行",analyze:"数据分析",validate:"验证与复现",communicate:"报告交流",paper_code_data:"论文 + 代码 + 数据",paper_plus_one_official_artifact:"论文 + 官方产物",single_primary_source:"单一源类型",metadata_only:"仅元信息",open:"公开入口",gated_or_restricted:"受限 / 需申请",unreleased:"未公开",large:"大体量",runnable:"完整本地适配",partially_runnable:"部分适配",data_ready:"数据已同步",source_ready:"源码已同步",source_available:"源码入口",data_source_available:"数据入口",gated:"访问受限",context_only:"仅上下文",catalogued:"已登记",catalogued_with_access_boundary:"有访问边界",released_by:"发布方",evaluated_on:"有模型评测记录",non_commercial_or_research_only:"非商业 / 研究限制",custom_or_unclear:"定制或待核实",declared_open_or_mixed:"已声明 / 含混合条款",text:"文本",tabular_data:"表格数据",images_figures:"图像与科学图表",video:"视频",code_terminal:"代码与终端",molecules_structures:"分子与结构",biological_sequences:"生物序列",geospatial_remote_sensing:"地理与遥感",'3d_simulation':"三维与模拟"};
const domainLabels={Biology:"生物",Medicine:"医学",Chemistry:"化学",Materials:"材料",Physics:"物理",General:"跨学科",Agentic:"科研 Agent",Math:"数学",Mathematics:"数学",'Earth Science':"地球科学",Earth:"地球科学",'Earth and Climate':"地球与气候",Statistics:"统计",Engineering:"工程",'Social Science':"社会科学",'Scientific Code':"科学代码",Agriculture:"农业",'Cross-disciplinary':"跨学科",Literature:"科学文献",Safety:"科学安全"};
const $=id=>document.getElementById(id);const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const label=x=>labels[x]||domainLabels[x]||String(x).replaceAll('_',' ');const fmt=x=>Number(x).toLocaleString('en-US');
let data,filtered=[],page=1,selectedSuite=null,extraFilter=null,previousFocus=null;const pageSize=12;
const filterFields={search:'关键词',domain:'科学域',family:'能力',mode:'范式',access:'访问',year:'年份',company:'公司',industry:'关系'};
const filterElement=key=>$(key==='search'?'search':`${key}-filter`);
function safeUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
const list=x=>Array.isArray(x)?x:[];
let activeScoreboardId=null;
function frontierSources(sources){return list(sources).flatMap(source=>{const url=safeUrl(source?.url);return url?[`<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(source.label||'官方来源')} <span aria-hidden="true">↗</span></a>`]:[]}).join('')}
function frontierMeta(items){return `<dl class="frontier-meta">${items.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value||'待核实')}</dd></div>`).join('')}</dl>`}
function frontierBenchmarkIds(){const existing=new Set(list(data?.benchmarks).map(b=>b.id));return [...new Set(list(data?.frontier?.benchmarks).map(b=>b?.benchmark_id).filter(id=>existing.has(id)))]}
function frontierScore(value,column,withUnit=false){
  if(typeof value!=='number'||!Number.isFinite(value)||!column)return null;
  const decimals=Math.max(0,Math.min(4,Number.isInteger(column.decimals)?column.decimals:0));
  const number=value.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
  return number+(withUnit&&column.unit?(column.unit==='%'?'%':' '+column.unit):'');
}
function renderScoreboard(id){
  const boards=list(data?.frontier?.scoreboards),board=boards.find(b=>b?.id===id);
  if(!board)return;
  activeScoreboardId=board.id;
  for(const button of document.querySelectorAll('[data-scoreboard]'))button.setAttribute('aria-pressed',String(button.dataset.scoreboard===board.id));
  const context=$('frontier-score-context'),scores=$('frontier-scores');
  if(context)context.innerHTML=`<h3 class="score-context-title">${esc(board.name||'模型表现')}</h3><p class="score-context-note">${esc(board.metric_note||'指标口径待核实')}</p><p class="score-context-note">${esc(board.protocol||'评测协议待核实')}</p><div class="score-context-meta"><span>${esc(board.score_date?'成绩截至 '+board.score_date:'原报告未披露成绩日期')}</span>${frontierSources([board.source])}</div>`;
  const columns=list(board.columns).filter(column=>column&&typeof column.key==='string'&&column.key);
  const rows=list(board.rows).filter(row=>row&&typeof row.system==='string');
  const score=(row,column)=>frontierScore(row.values?.[column.key],column)??'<span class="score-unavailable" aria-label="未报告">—</span>';
  if(scores)scores.innerHTML=columns.length&&rows.length?`<div class="frontier-table-wrap" role="region" tabindex="0" aria-label="${esc((board.name||'模型表现')+'，可横向滚动')}"><table class="frontier-score-table"><caption>${esc(board.name||'模型表现')} · 公开报告结果</caption><thead><tr><th scope="col">模型 / 系统</th>${columns.map(column=>`<th scope="col">${esc(column.label||column.key)}${column.unit?` <span>(${esc(column.unit)})</span>`:''}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row" class="score-system">${esc(row.system)}</th>${columns.map(column=>`<td>${score(row,column)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="frontier-empty">此评测的成绩明细待核实，请查看官方来源。</p>';
}
function renderFrontier(){
  const frontier=data?.frontier,section=$('frontier'),hero=$('hero-frontier');
  const resources=list(frontier?.resources).filter(resource=>resource&&typeof resource.title==='string');
  const benchmarks=list(frontier?.benchmarks).filter(benchmark=>benchmark&&typeof benchmark.name==='string');
  const boards=list(frontier?.scoreboards).filter(board=>board&&typeof board.id==='string'&&board.id);
  const featured=frontier?.featured,featuredBenchmark=benchmarks.find(benchmark=>featured?.benchmark_id&&benchmark.benchmark_id===featured.benchmark_id);
  const focusBenchmark=featuredBenchmark||benchmarks[0],focusBoard=boards.find(board=>board.id===featured?.scoreboard_id)||boards[0];
  const focusColumn=list(focusBoard?.columns).find(column=>column?.key===featured?.metric_key)||list(focusBoard?.columns).find(column=>column&&typeof column.key==='string');
  const focusSystem=list(focusBoard?.rows).find(row=>row&&typeof row.system==='string');
  const focusScore=frontierScore(focusSystem?.values?.[focusColumn?.key],focusColumn,true);
  const existing=new Set(list(data?.benchmarks).map(b=>b.id));
  const heroSources=[...new Map([...list(featuredBenchmark?.sources).slice(0,2),...(focusBoard?.source?[focusBoard.source]:[])].filter(source=>safeUrl(source?.url)).map(source=>[safeUrl(source.url),source])).values()];
  if(section)section.hidden=!resources.length&&!benchmarks.length&&!boards.length;
  if(hero){
    hero.hidden=!featuredBenchmark&&!resources.length;
    const resource=resources[0];
    if(featuredBenchmark)hero.innerHTML=`<div class="hero-frontier-top"><p class="eyebrow">SCIENTIFIC TERMINAL AGENTS</p><span class="frontier-badge">核心科学终端评测</span></div><div class="hero-frontier-scale"><strong>${esc(featuredBenchmark.scale??'待核实')}</strong><span>${esc(featuredBenchmark.unit||'任务规模待核实')}</span></div><h2>${esc(featuredBenchmark.name)}</h2><p class="hero-frontier-summary">${esc(featuredBenchmark.description||'评测说明待核实')}</p><div class="hero-feature-score"><strong>${esc(focusScore??'—')}</strong><div><span>${esc(focusBoard?.name||'成绩来源待核实')} · ${esc(focusColumn?.label||'指标待核实')}</span><p>${esc(focusSystem?.system||'模型配置未报告')}</p><small>${esc(focusBoard?.score_date?'成绩截至 '+focusBoard.score_date:'原报告未披露成绩日期')}</small></div></div><div class="hero-feature-actions">${existing.has(featuredBenchmark.benchmark_id)?`<button data-detail="${esc(featuredBenchmark.benchmark_id)}">查看评测详情 <span aria-hidden="true">↗</span></button>`:''}<a href="#frontier-performance"${focusBoard?` data-open-scoreboard="${esc(focusBoard.id)}"`:''}>查看模型成绩 <span aria-hidden="true">↘</span></a></div><div class="hero-frontier-bottom"><div class="frontier-sources">${frontierSources(heroSources)}</div></div>`;
    else if(resource)hero.innerHTML=`<div class="hero-frontier-top"><p class="eyebrow">RESEARCH TRAJECTORIES</p><span class="frontier-badge">${esc(resource.badge||resource.kind||'科研数据')}</span></div><div class="hero-frontier-scale"><strong>${esc(resource.scale?.value??'待核实')}</strong><span>${esc(resource.scale?.unit||'规模待核实')}</span></div><h2>${esc(resource.title)}</h2><p class="hero-frontier-summary">${esc(resource.summary||'资源说明待核实')}</p><div class="hero-frontier-bottom"><a href="#frontier-data">探索科研轨迹 <span aria-hidden="true">↘</span></a><div class="frontier-sources">${frontierSources(list(resource.sources).slice(0,1))}</div></div>`;
    else hero.innerHTML='';
  }
  const dataSignal=$('frontier-data-signal'),benchmarkSignal=$('frontier-benchmark-signal'),scoreSignal=$('frontier-score-signal');
  if(dataSignal)dataSignal.textContent=resources.length?String(resources.length):'—';
  if(benchmarkSignal)benchmarkSignal.textContent=focusBenchmark?.scale??'—';
  if($('frontier-benchmark-signal-label'))$('frontier-benchmark-signal-label').textContent=focusBenchmark?`${focusBenchmark.name} · ${focusBenchmark.unit||'规模待核实'}`:'任务规模以来源为准';
  if(scoreSignal)scoreSignal.textContent=focusScore??'—';
  if($('frontier-score-signal-label'))$('frontier-score-signal-label').textContent=focusBoard&&focusColumn?`${focusBoard.name||'公开报告'} · ${focusColumn.label||focusColumn.key}${focusSystem?' · '+focusSystem.system:''}`:'公开报告成绩';
  const reviewed=$('frontier-reviewed');
  if(reviewed)reviewed.textContent=frontier?.reviewed_at?'来源核对 '+frontier.reviewed_at:'来源核对日期待补';
  const resourceContainer=$('frontier-resources');
  if(resourceContainer)resourceContainer.innerHTML=resources.map(resource=>`<article class="frontier-card"><div class="frontier-card-top"><span class="eyebrow">${esc(resource.kind||'科研数据')}</span><span class="frontier-badge">${esc(resource.badge||'来源已登记')}</span></div><div class="frontier-scale"><strong>${esc(resource.scale?.value??'待核实')}</strong><span>${esc(resource.scale?.unit||'规模待核实')}</span></div><h3>${esc(resource.title)}</h3><p class="frontier-summary">${esc(resource.summary||'资源说明待核实')}</p>${resource.scale?.detail?`<p class="frontier-scale-detail">${esc(resource.scale.detail)}</p>`:''}<details class="frontier-disclosure"><summary>跨度、访问与许可 <span aria-hidden="true">+</span></summary>${frontierMeta([['科研跨度',resource.horizon],['访问',resource.access],['许可证',resource.license],['发布 / 更新',resource.published_at]])}</details><div class="frontier-sources">${frontierSources(resource.sources)}</div></article>`).join('');
  const benchmarkContainer=$('frontier-benchmarks');
  if(benchmarkContainer)benchmarkContainer.innerHTML=benchmarks.map(benchmark=>`<article class="frontier-benchmark"><div class="frontier-benchmark-scale"><strong>${esc(benchmark.scale??'待核实')}</strong><span>${esc(benchmark.unit||'规模待核实')}</span></div><h3>${esc(benchmark.name)}</h3><p class="frontier-summary">${esc(benchmark.description||'评测说明待核实')}</p>${frontierMeta([['任务跨度',benchmark.horizon],['访问',benchmark.access]])}<div class="frontier-card-actions">${existing.has(benchmark.benchmark_id)?`<button data-detail="${esc(benchmark.benchmark_id)}">查看评测详情 <span aria-hidden="true">↗</span></button>`:''}<div class="frontier-sources">${frontierSources(benchmark.sources)}</div></div></article>`).join('');
  for(const [id,hasContent] of [['frontier-data',resources.length],['frontier-evaluations',benchmarks.length],['frontier-performance',boards.length]]){const element=$(id);if(element)element.hidden=!hasContent}
  const controls=$('scoreboard-controls');
  if(controls)controls.innerHTML=boards.map((board,index)=>`<button type="button" class="scoreboard-button" data-scoreboard="${esc(board.id)}" aria-pressed="${index===0}">${esc(board.name||'模型表现')}</button>`).join('');
  if(boards.length)renderScoreboard(boards.some(board=>board.id===activeScoreboardId)?activeScoreboardId:focusBoard.id);
  else{if($('frontier-score-context'))$('frontier-score-context').innerHTML='';if($('frontier-scores'))$('frontier-scores').innerHTML=''}
  const available=frontierBenchmarkIds().length>0;
  for(const button of document.querySelectorAll('[data-frontier-catalog]'))button.disabled=!available;
}
// Source-backed result explorer. Each board retains its own metric and protocol.
const hubState = {board:'', assessment:'capabilities', query:'', harness:'', sort:'score-desc', selected:new Set(), notice:''};
let hubModel = {boards:[], rows:[]};
function hubConfigurationKey(row) {
  return `${row.source_id||row.board_id}::${row.configuration_id||row.id}`;
}
function buildEvaluationHub(catalog) {
  const hub=catalog?.evaluation_hub||{}, sources=new Map(list(hub.sources).map(s=>[s.id,s]));
  const boards=list(hub.benchmarks).map(board=>({...board,id:board.board_id||board.id,name:board.name||board.benchmark_name,source:sources.get(board.source_id)||{},legacy:false}));
  const boardMap=new Map(boards.map(board=>[board.id,board]));
  const rows=list(hub.results).flatMap(row=>{
    const board=boardMap.get(row.board_id||row.benchmark_ref);
    if(!board)return [];
    return [{...row,board_id:board.id,benchmark_name:row.benchmark_name||board.name,score:typeof row.score==='number'&&Number.isFinite(row.score)?row.score:null,
      model:row.model||'模型未披露',provider:row.provider||'未单列',harness:row.harness||'未单列',metric:row.metric||board.metric,unit:row.unit??board.unit??'',
      version:row.version||board.version,assessment:row.assessment||board.assessment||'capabilities',source_id:row.source_id||board.source_id,
      source_url:row.source_url||board.source_url||board.source.url,score_date:row.score_date??row.date??board.score_date,
      retrieved_at:row.retrieved_at||board.retrieved_at||board.source.retrieved_at,protocol:row.protocol||board.protocol||board.source.protocol,
      configuration_id:row.configuration_id||[row.model,row.harness].join('::'),decimals:board.decimals??2,secondary:[]}];
  });
  for(const board of list(catalog?.frontier?.scoreboards).filter(board=>board&&typeof board==='object')) {
    const primary=list(board.columns)[0];
    if(!primary)continue;
    const id='frontier::'+board.id;
    boards.push({id,name:board.name,benchmark_id:board.benchmark_id,version:board.name,assessment:'capabilities',metric:primary.label,unit:primary.unit,direction:'higher',
      source_id:'frontier::'+board.id,source_url:board.source?.url,source:{name:board.source?.label||'公开报告',url:board.source?.url},score_date:board.score_date,
      retrieved_at:catalog.frontier.reviewed_at,protocol:board.protocol,metric_note:board.metric_note,legacy:true});
    list(board.rows).forEach((row,index)=>rows.push({id:id+'::'+index,board_id:id,benchmark_id:board.benchmark_id,benchmark_name:board.name,configuration_id:row.system,
      model:row.system,provider:'原报告未单列',harness:'见系统配置',score:typeof row.values?.[primary.key]==='number'?row.values[primary.key]:null,
      metric:primary.label,unit:primary.unit,decimals:primary.decimals,version:board.name,assessment:'capabilities',source_id:'frontier::'+board.id,
      source_url:board.source?.url,score_date:board.score_date,retrieved_at:catalog.frontier.reviewed_at,protocol:board.protocol,
      secondary:list(board.columns).slice(1).map(column=>({label:column.label,value:row.values?.[column.key]??null,unit:column.unit,decimals:column.decimals}))}));
  }
  return {boards,rows};
}
function hubScore(row,withUnit=true) {
  if(!row||typeof row.score!=='number'||!Number.isFinite(row.score))return '—';
  const decimals=Number.isInteger(row.decimals)?Math.max(0,Math.min(4,row.decimals)):2;
  return row.score.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})+(withUnit&&row.unit?(row.unit==='%'?'%':' '+row.unit):'');
}
function hubFilteredRows() {
  const query=hubState.query.trim().toLowerCase();
  const rows=hubModel.rows.filter(row=>row.board_id===hubState.board&&(!hubState.harness||row.harness===hubState.harness)&&(!query||[row.model,row.provider,row.harness].join(' ').toLowerCase().includes(query)));
  return rows.sort((a,b)=>{
    if(hubState.sort==='model')return a.model.localeCompare(b.model)||a.harness.localeCompare(b.harness);
    if(a.score===null)return b.score===null?a.model.localeCompare(b.model):1;
    if(b.score===null)return -1;
    return (hubState.sort==='score-asc'?a.score-b.score:b.score-a.score)||a.model.localeCompare(b.model)||a.harness.localeCompare(b.harness);
  });
}
function hubOptions(values,selected,emptyLabel) {
  return (emptyLabel?`<option value="">${esc(emptyLabel)}</option>`:'')+values.map(([value,text])=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(text)}</option>`).join('');
}
function hubSourceLink(url,text='原始来源') {
  const safe=safeUrl(url);
  return safe?`<a href="${esc(safe)}" target="_blank" rel="noreferrer">${esc(text)} ↗</a>`:'<span>来源待补</span>';
}
function hubCoverage(row) {
  const c=row.coverage;
  return c&&Number.isFinite(c.observed)&&Number.isFinite(c.total)?`${c.observed}/${c.total} 项套件覆盖`:'仅此公开报告';
}
function hubCurrentBoard() {return hubModel.boards.find(board=>board.id===hubState.board)}
function syncHubControls(root) {
  const boardSelect=root.querySelector('[data-hub-field="board"]'), harnessSelect=root.querySelector('[data-hub-field="harness"]');
  const boards=hubModel.boards.filter(board=>board.assessment===hubState.assessment);
  if(!boards.some(board=>board.id===hubState.board))hubState.board=boards[0]?.id||'';
  if(boardSelect)boardSelect.innerHTML=hubOptions(boards.map(board=>[board.id,board.name]),hubState.board);
  const harnesses=[...new Set(hubModel.rows.filter(row=>row.board_id===hubState.board).map(row=>row.harness))].sort();
  if(hubState.harness&&!harnesses.includes(hubState.harness))hubState.harness='';
  if(harnessSelect)harnessSelect.innerHTML=hubOptions(harnesses.map(harness=>[harness,harness]),hubState.harness,'全部运行框架');
}
function hubComparisonMarkup() {
  const selected=[...hubState.selected].map(key=>hubModel.rows.find(row=>hubConfigurationKey(row)===key)).filter(Boolean);
  if(!selected.length)return '<p class="hub-compare-hint">勾选成绩行中的「对比」，横向查看最多 4 个模型与框架配置。</p>';
  const chips=selected.map(row=>`<button class="hub-selection" data-hub-remove="${esc(hubConfigurationKey(row))}" aria-label="${esc('移除 '+row.model+' / '+row.harness)}">${esc(row.model)} <span>${esc(row.harness)} ×</span></button>`).join('');
  const head=`<div class="hub-compare-heading"><div><p class="eyebrow">CONFIGURATION COMPARISON / ${selected.length} OF 4</p><h3>在每个评测里，分别比较。</h3></div><button class="hub-text-button" data-hub-clear>清空选择 ↺</button></div><div class="hub-selections">${chips}</div>`;
  if(selected.length===1)return head+'<p class="hub-compare-hint">再选一个配置开始比较。不同基准分别展示，不计算跨基准总分。</p>';
  const matrixBoards=hubModel.boards.filter(board=>hubModel.rows.some(row=>row.board_id===board.id&&hubState.selected.has(hubConfigurationKey(row))));
  const table=assessment=>{
    const boards=matrixBoards.filter(board=>board.assessment===assessment);
    if(!boards.length)return '';
    return `<h4 class="hub-matrix-title">${assessment==='safeguards'?'安全与拒答 / SAFEGUARDS':'科学能力 / CAPABILITIES'}</h4><div class="hub-table-wrap" tabindex="0" role="region" aria-label="${assessment==='safeguards'?'安全':'能力'}逐基准配置对比，可横向滚动"><table class="hub-matrix"><caption class="sr-only">逐基准配置对比；空白项表示没有报告</caption><thead><tr><th scope="col">评测 · 指标</th>${selected.map(row=>`<th scope="col">${esc(row.model)}<small>${esc(row.harness)}</small></th>`).join('')}</tr></thead><tbody>${boards.map(board=>`<tr><th scope="row">${hubSourceLink(board.source_url,board.name)}<small>${esc(board.metric)}${board.unit?' · '+esc(board.unit):''}</small></th>${selected.map(config=>{
      const row=hubModel.rows.find(row=>row.board_id===board.id&&hubConfigurationKey(row)===hubConfigurationKey(config));
      return `<td>${esc(hubScore(row))}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  return head+table('capabilities')+table('safeguards')+'<p class="hub-footnote">— 表示该来源未报告。每行沿用各自版本、指标与协议，能力和安全分别阅读；不同来源的同名模型也保留为独立配置。</p>';
}
function paintHubResults(root) {
  const output=root.querySelector('[data-hub-output]'), count=root.querySelector('[data-hub-count]'), comparison=root.querySelector('[data-hub-comparison]');
  if(!output)return;
  const board=hubCurrentBoard(), rows=hubFilteredRows();
  if(count)count.textContent=`${rows.filter(row=>row.score!==null).length} 条已报告 / ${rows.length} 个当前配置`;
  if(!board){output.innerHTML='<div class="hub-empty">当前类别尚无经核实成绩。</div>';return}
  const source=board.source||{};
  const protocol=board.protocol||source.protocol||'原报告未披露完整运行协议，请查看来源。';
  const unit=board.unit||'';
  const metric=board.metric||'原报告指标';
  const numeric=rows.filter(row=>row.score!==null);
  const max=Math.max(...numeric.map(row=>Math.abs(row.score)),1);
  output.innerHTML=`<div class="hub-board-heading"><div><p class="eyebrow">${esc(board.assessment==='safeguards'?'SAFEGUARDS':'CAPABILITIES')} / ${esc(board.version||'版本见来源')}</p><h3>${esc(board.name)}</h3><p>${esc(metric)}${unit?' · '+esc(unit):''}${board.evaluation_count!=null?' · '+esc(board.evaluation_count)+' 项评估':''}</p></div><div class="hub-source-meta">${hubSourceLink(board.source_url||source.url,source.name||'查看原始成绩')}<span>${board.score_date?'成绩日期 '+esc(board.score_date):'成绩日期未披露'}</span>${board.data_updated_at||source.data_updated_at?`<span>源更新 ${esc(board.data_updated_at||source.data_updated_at)}</span>`:''}<span>本站核对 ${esc(String(board.retrieved_at||source.retrieved_at||data?.evaluation_hub?.updated_at||'未披露').slice(0,10))}</span></div></div><details class="hub-protocol"><summary>查看评分口径、运行协议与覆盖范围 <span aria-hidden="true">＋</span></summary><p>${esc(board.metric_note||'按来源报告的单项指标展示；模型与运行框架共同构成一个配置。')}</p><p>${esc(protocol)}</p>${source.notes?.length?`<ul>${source.notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:''}<p>表中的套件覆盖是该配置在来源整套评测中的报告范围，不是当前基准的成功次数。缺失成绩不按 0 计分。</p></details>${rows.length?`<div class="hub-table-wrap" tabindex="0" role="region" aria-label="${esc(board.name)} 成绩表，可横向滚动"><table class="hub-score-table"><caption class="sr-only">${esc(board.name)} · 相同来源、版本与协议下的公开成绩</caption><thead><tr><th scope="col">对比</th><th scope="col">序</th><th scope="col">模型 / 提供商</th><th scope="col">运行框架</th><th scope="col" class="hub-score-cell">${esc(metric)}${unit?' ('+esc(unit)+')':''}</th><th scope="col">证据与覆盖</th></tr></thead><tbody>${rows.map((row,index)=>{
    const key=hubConfigurationKey(row), selected=hubState.selected.has(key), score=hubScore(row,false), width=row.score===null?0:Math.max(0,Math.min(100,100*Math.abs(row.score)/max));
    return `<tr${selected?' class="hub-selected-row"':''}><td><button class="hub-compare-toggle" data-hub-compare="${esc(key)}" aria-pressed="${selected}" aria-label="${esc((selected?'取消对比 ':'对比 ')+row.model+' / '+row.harness)}">${selected?'✓':'＋'}</button></td><td class="hub-rank">${row.score===null?'—':index+1}</td><th scope="row"><span class="hub-model-name">${esc(row.model)}</span><small>${esc(row.provider)}</small><small class="hub-mobile-meta">${esc(row.harness)} · ${esc(hubCoverage(row))}</small></th><td><span class="hub-harness">${esc(row.harness)}</span></td><td class="hub-score-cell"><strong>${esc(score)}</strong>${row.score===null?'<small>未报告</small>':`<span class="hub-score-bar" aria-hidden="true"><i style="width:${width}%"></i></span>`}</td><td class="hub-evidence"><span>${esc(hubCoverage(row))}</span>${hubSourceLink(row.source_url)}${row.secondary?.length?`<small>${row.secondary.map(item=>`${esc(item.label)} ${esc(hubScore({score:item.value,unit:item.unit,decimals:item.decimals}))}`).join(' · ')}</small>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>`:'<div class="hub-empty"><strong>没有匹配的配置</strong><p>调整模型关键词或运行框架，或重置筛选查看本评测的全部成绩。</p><button class="hub-text-button" data-hub-reset>重置筛选 ↺</button></div>'}<p class="hub-footnote">序号表示当前筛选与排序中的位置。仅在本表协议内比较；这里汇集公开报告，本站未复测这些模型。${board.legacy?'原报告未把模型与框架拆为独立字段，系统配置按原文保留。':''}</p>`;
  if(comparison)comparison.innerHTML=hubComparisonMarkup();
  const notice=root.querySelector('[data-hub-notice]');
  if(notice)notice.textContent=hubState.notice;
}
function hubCsv(rows) {
  const headers=['benchmark','model','provider','harness','score','metric','unit','version','assessment','score_date','retrieved_at','source_url','protocol','suite_coverage','status'];
  const escape=value=>{
    let text=String(value??'');
    if(typeof value!=='number'&&/^[=+@\-\t\r]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return [headers,...rows.map(row=>[row.benchmark_name,row.model,row.provider,row.harness,row.score,row.metric,row.unit,row.version,row.assessment,row.score_date,row.retrieved_at,row.source_url,row.protocol,hubCoverage(row),row.score===null?'not_reported':'reported'])].map(row=>row.map(escape).join(',')).join('\r\n');
}
function downloadHub(format) {
  const rows=hubFilteredRows(), board=hubCurrentBoard();
  const payload=format==='csv'?'\uFEFF'+hubCsv(rows):JSON.stringify({exported_at:new Date().toISOString(),scope:'single-benchmark-source-protocol',board,results:rows},null,2);
  const objectUrl=URL.createObjectURL(new Blob([payload],{type:format==='csv'?'text/csv;charset=utf-8':'application/json'}));
  const anchor=document.createElement('a');
  anchor.href=objectUrl;anchor.download=`ai4s-results-${String(board?.id||'selection').replace(/[^a-zA-Z0-9_-]/g,'-')}.${format}`;anchor.click();URL.revokeObjectURL(objectUrl);
}
function renderEvaluationHub() {
  const root=document.querySelector('#results-app');
  if(!root)return;
  hubModel=buildEvaluationHub(data);
  const reported=hubModel.rows.filter(row=>row.score!==null), configurations=new Set(hubModel.rows.map(hubConfigurationKey));
  if(!hubState.board)hubState.board=hubModel.boards.find(board=>board.id==='bio-v1-spatialbench')?.id||hubModel.boards[0]?.id||'';
  const current=hubCurrentBoard();if(current)hubState.assessment=current.assessment;
  const featured=hubModel.boards.find(board=>board.id==='frontier::terminal-bench-science-official'), biology=hubModel.boards.find(board=>board.id==='bio-v1-spatialbench');
  root.innerHTML=`<div class="hub-stats"><div><strong>${fmt(reported.length)}</strong><span>已报告单项成绩</span></div><div><strong>${fmt(configurations.size)}</strong><span>来源内模型 × 框架配置</span></div><div><strong>${fmt(hubModel.boards.length)}</strong><span>独立成绩表</span></div><p>真实来源，逐项阅读。<br>选择评测，再看模型表现。</p></div><div class="hub-toolbar"><div class="hub-assessment" role="group" aria-label="选择评测类别"><button data-hub-assessment="capabilities" aria-pressed="${hubState.assessment==='capabilities'}">科学能力</button><button data-hub-assessment="safeguards" aria-pressed="${hubState.assessment==='safeguards'}">安全与拒答</button></div><div class="hub-quick">快速查看 ${featured?`<button data-hub-board="${esc(featured.id)}">TB-Science ↗</button>`:''}${biology?`<button data-hub-board="${esc(biology.id)}">生物 Agent ↗</button>`:''}</div></div><div class="hub-filters"><label class="hub-benchmark-filter">评测与协议<select data-hub-field="board" aria-label="选择成绩基准"></select></label><label>模型 / 公司<input data-hub-field="query" type="search" placeholder="例如 OpenAI、Claude、DeepSeek" value="${esc(hubState.query)}" autocomplete="off" /></label><label>运行框架<select data-hub-field="harness" aria-label="筛选运行框架"></select></label><label>排序<select data-hub-field="sort" aria-label="成绩排序">${hubOptions([['score-desc','成绩从高到低'],['score-asc','成绩从低到高'],['model','模型名称']],hubState.sort)}</select></label></div><div class="hub-result-line"><p data-hub-count role="status"></p><div><button data-hub-export="csv">CSV ↓</button><button data-hub-export="json">JSON ↓</button><button data-hub-reset>重置 ↺</button></div></div><div data-hub-output></div><p class="hub-notice" data-hub-notice role="status" aria-live="polite"></p><section class="hub-comparison" data-hub-comparison aria-label="模型配置对比"></section>`;
  // The deployment contract's lightweight DOM checks only read the initial markup.
  if(typeof root.querySelector!=='function')return;
  syncHubControls(root);paintHubResults(root);
  if(root.dataset.hubBound)return;
  root.dataset.hubBound='true';
  root.addEventListener('input',event=>{
    if(event.target.dataset.hubField!=='query')return;
    hubState.query=event.target.value;paintHubResults(root);
  });
  root.addEventListener('change',event=>{
    const field=event.target.dataset.hubField;
    if(!['board','harness','sort'].includes(field))return;
    hubState[field]=event.target.value;
    if(field==='board')syncHubControls(root);
    paintHubResults(root);
  });
  root.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target)return;
    hubState.notice='';
    const updateAssessment=assessment=>{
      hubState.assessment=assessment;
      for(const button of root.querySelectorAll('[data-hub-assessment]'))button.setAttribute('aria-pressed',String(button.dataset.hubAssessment===assessment));
      syncHubControls(root);
    };
    if(target.dataset.hubAssessment){updateAssessment(target.dataset.hubAssessment);paintHubResults(root)}
    if(target.dataset.hubBoard){hubState.board=target.dataset.hubBoard;updateAssessment(hubCurrentBoard()?.assessment||'capabilities');paintHubResults(root)}
    if(target.hasAttribute('data-hub-reset')){
      hubState.query='';hubState.harness='';hubState.sort='score-desc';
      root.querySelector('[data-hub-field="query"]').value='';root.querySelector('[data-hub-field="sort"]').value=hubState.sort;
      syncHubControls(root);paintHubResults(root);
    }
    if(target.dataset.hubCompare){
      const key=target.dataset.hubCompare;
      if(hubState.selected.has(key))hubState.selected.delete(key);
      else if(hubState.selected.size<4)hubState.selected.add(key);
      else hubState.notice='最多同时比较 4 个配置，请先移除一个。';
      paintHubResults(root);
      root.querySelectorAll('[data-hub-compare]').forEach(button=>{if(button.dataset.hubCompare===key)button.focus()});
    }
    if(target.dataset.hubRemove){hubState.selected.delete(target.dataset.hubRemove);paintHubResults(root)}
    if(target.hasAttribute('data-hub-clear')){hubState.selected.clear();paintHubResults(root)}
    if(target.dataset.hubExport)downloadHub(target.dataset.hubExport);
  });
}

function openResultsForBenchmark(benchmarkId) {
  const board=hubModel.boards.find(board=>board.benchmark_id===benchmarkId||board.id===benchmarkId);
  if(!board)return false;
  hubState.board=board.id;hubState.assessment=board.assessment;hubState.query='';hubState.harness='';
  renderEvaluationHub();
  document.querySelector('#results')?.scrollIntoView({behavior:'smooth',block:'start'});
  return true;
}
function evaluationResultCount(benchmarkId) {
  const boards=new Set(hubModel.boards.filter(board=>board.benchmark_id===benchmarkId).map(board=>board.id));
  return hubModel.rows.filter(row=>boards.has(row.board_id)&&row.score!==null).length;
}

function chip(text,kind=''){return `<span class="chip ${kind}">${esc(text)}</span>`}
function fillSelect(id,values){const el=$(id);for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=label(value);el.append(option)}}
function renderBars(id,values,field){const top=Object.entries(values).slice(0,8);const max=Math.max(...top.map(x=>x[1]),1);$(id).innerHTML=top.map(([key,count])=>`<div class="bar-row"><button data-axis="${esc(field)}" data-key="${esc(key)}">${esc(label(key))}</button><strong>${fmt(count)}</strong><div class="bar-track"><i style="width:${100*count/max}%"></i></div></div>`).join('')}
function countChip(b){return chip(b.question_count==null?'规模数量待核实':`${fmt(b.question_count)}（规模提取值）`,b.question_count==null?'muted-chip':'count-chip')}
const companyRoleLabels={released_by:'公司发布/联合发布',official_evaluation:'公司官方报告使用',external_evaluation:'第三方测试其模型',evaluation_unresolved:'评测主体待核实'};
function companyFields(b){const roles=b.major_company_status?.roles||{};return '<dl class="company-fields">'+Object.entries(companyRoleLabels).map(([key,name])=>'<div><dt>'+esc(name)+'</dt><dd>'+esc((roles[key]||[]).join('、')||'暂无已登记证据')+'</dd></div>').join('')+'</dl>'}
function majorSignalChips(b){
  const shortLabels={released_by:'发布/联合发布',official_evaluation:'官方报告使用',external_evaluation:'第三方测试',evaluation_unresolved:'主体待核实'};
  const signals=Object.entries(companyRoleLabels).flatMap(([role,title])=>(b.major_company_status?.roles?.[role]||[]).map(company=>({company,role,title})));
  return signals.slice(0,2).map(({company,role,title})=>`<span class="chip company-signal ${esc(role)}" title="${esc(title+' · '+company)}">${esc(shortLabels[role]+' · '+company)}</span>`).join('')+(signals.length>2?`<span class="chip muted-chip" title="完整公司关系与来源见详情">+${signals.length-2} 关系</span>`:'');
}
function renderTaxonomy(){const t=data.taxonomy||{},q=t.question_count||{},subjects=t.subjects||[],industry=t.major_company||{},families=industry.families||[],counts=industry.role_counts||{};$('question-summary').innerHTML='<div class="taxonomy-total"><strong>'+fmt(q.known_benchmark_count||0)+'</strong><span>条评测已抽取规模数量</span></div><p>其余 '+fmt(q.unknown_benchmark_count||0)+' 条保留原始规模描述。题目、任务、样本与分子等单位不相加；精确版本、子集与计数口径请核对详情中的原始规模。</p>';const max=Math.max(...subjects.map(x=>x.benchmark_count),1);$('subject-bars').innerHTML=subjects.map(x=>'<div class="taxonomy-row"><button data-taxonomy-domain="'+esc(x.subject)+'"><span>'+esc(label(x.subject))+'</span><small>'+fmt(x.question_count_known)+' 条已抽取规模</small></button><strong>'+fmt(x.benchmark_count)+'</strong><div class="bar-track"><i style="width:'+100*x.benchmark_count/max+'%"></i></div></div>').join('');$('major-company-bars').innerHTML=families.map(x=>'<div class="taxonomy-row"><div><strong>'+esc(x.company)+'</strong><small>发布 '+fmt(x.published_count)+' · 官方使用 '+fmt(x.official_evaluation_count)+' · 第三方 '+fmt(x.external_evaluation_count)+' · 待核实 '+fmt(x.unresolved_evaluation_count)+'</small></div><strong title="按公司族去重的评测集数">'+fmt(x.unique_benchmark_count)+'</strong></div>').join('');$('major-company-summary').textContent='按公司族与评测 ID 去重；关系可重叠。官方使用 '+fmt(counts.official_evaluation||0)+' 条';}
function renderActiveFilters(){
  const active=Object.entries(filterFields).flatMap(([key,name])=>{
    const value=filterElement(key).value.trim();
    return value?[{key,text:`${name} · ${key==='search'?value:key==='industry'?(companyRoleLabels[value]||label(value)):label(value)}`}]:[];
  });
  if(selectedSuite)active.push({key:'selectedSuite',text:`套件 · ${selectedSuite.name}`});
  if(extraFilter)active.push({key:'extraFilter',text:`分类 · ${label(extraFilter.key)}`});
  $('active-filters').hidden=active.length===0;
  $('active-filters').innerHTML=active.map(({key,text})=>`<button class="active-filter" data-clear-filter="${esc(key)}" aria-label="${esc('移除'+text)}">${esc(text)}<span aria-hidden="true">×</span></button>`).join('');
  for(const button of document.querySelectorAll('[data-quick-domain]'))button.setAttribute('aria-pressed',String(button.dataset.quickDomain===$('domain-filter').value));
}
function applyFilters(){
  if(!data)return;
  const query=$('search').value.trim().toLowerCase();
  const domain=$('domain-filter').value,cap=$('family-filter').value,mode=$('mode-filter').value,access=$('access-filter').value,year=$('year-filter').value,company=$('company-filter').value,industry=$('industry-filter').value;
  filtered=data.benchmarks.filter(b=>{
    const c=b.classification;
    return (!domain||b.domain===domain)&&(!cap||c.capability_axes.includes(cap))&&(!mode||c.evaluation_modes.includes(mode))&&(!access||c.data_access===access)&&(!year||String(b.year)===year)&&(!industry||b.major_company_status?.roles?.[industry]?.length)&&(!company||b.major_company_signals?.some(s=>s.company_family===company&&(!industry||s.context===industry)))&&(!selectedSuite||selectedSuite.benchmarks.includes(b.id))&&(!extraFilter||(Array.isArray(c[extraFilter.field])?c[extraFilter.field].includes(extraFilter.key):c[extraFilter.field]===extraFilter.key))&&(!query||b._search.includes(query));
  });
  const sort=$('sort-filter').value;
  filtered.sort((a,b)=>sort==='year'?(b.year||0)-(a.year||0)||a.name.localeCompare(b.name):sort==='domain'?a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name):sort==='name'?a.name.localeCompare(b.name):(Number(!!b.integration.runner)-Number(!!a.integration.runner))||(b.organizations.length-a.organizations.length)||a.name.localeCompare(b.name));
  page=1;
  renderActiveFilters();
  renderResults();
}
function renderResults(){
  $('result-count').textContent=fmt(filtered.length);
  $('result-label').textContent=selectedSuite?selectedSuite.name:extraFilter?label(extraFilter.key):'全部评测';
  $('result-context').textContent=`${fmt(filtered.length)} / ${fmt(data.benchmark_count)} 条 · 规则分类，保留原始证据`;
  const slice=filtered.slice((page-1)*pageSize,page*pageSize);
  $('benchmark-list').innerHTML=slice.length?slice.map((b,i)=>{
    const status=b.integration.status,c=b.classification;
    return `<article class="benchmark-card"><div class="card-topline"><span class="card-domain">${esc(label(b.domain))}</span><span class="card-year">${esc(b.year||'年份待核实')}</span><span class="card-index">${String((page-1)*pageSize+i+1).padStart(4,'0')}</span></div><button class="benchmark-title" data-detail="${esc(b.id)}">${esc(b.name)}</button><p class="benchmark-description">${esc(b.description||purposeText(b))}</p><div class="chips card-capabilities">${c.capability_axes.slice(0,3).map(x=>chip(label(x),'capability')).join('')}</div><div class="chips card-signals">${evaluationResultCount(b.id)?`<button class="chip result-chip" data-results-benchmark="${esc(b.id)}">${fmt(evaluationResultCount(b.id))} 条公开成绩 ↗</button>`:''}${countChip(b)}${majorSignalChips(b)}</div><div class="card-footer">${chip(label(status),['runnable','partially_runnable'].includes(status)?'runner':'access')}<button class="detail-button" data-detail="${esc(b.id)}">查看详情 <span aria-hidden="true">↗</span></button></div></article>`;
  }).join(''):'<div class="empty-state"><span class="empty-symbol" aria-hidden="true">∅</span><strong>没有匹配的评测</strong><p>试试其他关键词，或移除当前筛选条件。</p><button class="reset-button" data-reset-all>清除全部筛选 ↗</button></div>';
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  $('page-label').textContent=`${page} / ${pages}`;
  $('prev-page').disabled=page===1;
  $('next-page').disabled=page===pages;
}
function clearFilterValues(){
  for(const key of Object.keys(filterFields))filterElement(key).value='';
  selectedSuite=null;
  extraFilter=null;
}
function reset(){clearFilterValues();applyFilters()}
function setView(view){
  const isList=view==='list';
  $('benchmark-list').classList.toggle('is-list',isList);
  $('view-grid').setAttribute('aria-pressed',String(!isList));
  $('view-list').setAttribute('aria-pressed',String(isList));
}
function scrollToResults(){$('results-scroll').scrollIntoView({block:'start'})}
function section(title,content){return `<section class="detail-section"><h3>${esc(title)}</h3>${content}</section>`}
function formatSize(value){if(value===null||value===undefined||value==='')return '规模未在上游明确';if(typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${v}`).join(' · ');return String(value)}
function outputShape(b){const example=scenarioExample(b);return example.kind==='task_overview'?example.output:'输出格式待逐条核实'}
function purposeText(b){if(b.description?.trim())return b.description;return label(b.domain)+' · '+(b.subdomain||'子领域待补')+'。登记任务：'+((b.task_types||[]).join('、')||'待补充')+'。'}
function scenarioExample(b){
  // Only these exact benchmark identities have an individually reviewed task overview.
  // A domain/keyword match cannot establish an input schema or an expected answer.
  if(b.id==='geochem-28')return {kind:'task_overview',input:'地球化学论文正文、补充材料与表格，以及领域本体/字段 schema',output:'本体对齐的矿物、样品与元素测量 JSON-LD/RDF 记录'};
  if(b.id==='robofollow')return {kind:'task_overview',input:'三路 320×240 RGB 视图、14 维关节状态与自然语言指令',output:'分阶段动作目标与执行轨迹；评分另见官方指标'};
  return {kind:'metadata',input:`已登记模态：${(b.modalities||[]).map(label).join('、')||'未明确'}。这些字段可能包含输入、参考答案和评测产物，并非已核实的输入格式。`,output:'尚未逐条核实输出格式，暂不生成样例答案；请核对下方官方来源。'};
}
function metadataCompleteness(b){const fields=[b.description,b.task_types?.length,b.modalities?.length,b.metrics?.length,b.paper?.url,b.official?.repository||b.official?.dataset||b.official?.homepage,b.license,b.size];return Math.round(100*fields.filter(Boolean).length/fields.length)}
function inputSummary(b){return b.modalities?.slice(0,3).map(label).join(' · ')||'模态待核实'}
function cardSpec(b){const example=scenarioExample(b), completeness=metadataCompleteness(b),reviewed=example.kind==='task_overview';return `<div class="card-spec" role="group" aria-label="${esc(b.name)} 任务说明"><div><span>用途（登记字段）</span><p>${esc(purposeText(b))}</p></div><div><span>${reviewed?'输入说明':'登记模态'}</span><p>${esc(example.input)}</p></div><div><span>${reviewed?'输出说明':'输出待核实'}</span><p>${esc(example.output)}</p></div><div class="spec-confidence" title="8 项元数据的非空比例，不代表证据质量、许可确认或可运行性"><span>字段填写率</span><strong>${completeness}%</strong><i><b style="width:${completeness}%"></b></i></div></div><p class="demo-disclaimer">${reviewed?'任务流程说明，非官方样题或金标准答案。':'官方输入输出样例待补；仅列出已登记字段。'} 字段填写率不代表证据质量或可运行性。</p>`}
function demoBlock(b){const example=scenarioExample(b),reviewed=example.kind==='task_overview',metric=(b.metrics||[]).slice(0,4).map(x=>label(x)).join('、')||'上游未明确';return `<div class="demo-grid"><div class="demo-card demo-input"><div class="demo-label"><span>${reviewed?'INPUT':'METADATA'}</span><small>${reviewed?'输入说明':'登记字段'}</small></div><pre>${esc(example.input)}</pre></div><div class="demo-arrow" aria-hidden="true">→</div><div class="demo-card demo-output"><div class="demo-label"><span>OUTPUT</span><small>${reviewed?'输出说明':'待逐条核实'}</small></div><pre>${esc(`${example.output}\n\n登记指标：${metric}`)}</pre></div></div><p class="demo-disclaimer">${reviewed?'这是依据该条目来源整理的任务流程说明，不是原始题目、金标准答案或官方样例。':'此条目尚未补充经核实的输入输出样例；领域标签不足以推断题目格式或答案。'} 具体字段、评分协议与版本请核对下方官方来源。</p>`}
function infoGrid(items){return `<div class="info-grid">${items.map(([k,v])=>`<div class="info-cell"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`}
function majorSignalBlock(b){const signals=b.major_company_signals||[];return companyFields(b)+'<p class="evidence-footnote">官方报告使用表示已公开报告该基准成绩；第三方测试模型不能证明公司采用。发布关系包含联合发布，不自动等同于独立自研。</p>'+signals.map(o=>'<div class="company-evidence"><strong>'+esc(o.organization)+' · '+esc(companyRoleLabels[o.context]||o.context)+'</strong><p>'+esc(o.evidence||'证据说明待补')+'</p><small>核对日期：'+esc(o.checked_at||'未登记')+'</small> '+(safeUrl(o.source_url)?'<a href="'+esc(safeUrl(o.source_url))+'" target="_blank" rel="noreferrer">核对来源 ↗</a>':'')+'</div>').join('')}
function openDetail(id){const b=data.benchmarks.find(x=>x.id===id);if(!b)return;previousFocus=document.activeElement;const c=b.classification;const links=[['论文',b.paper.url],['官方源码',b.official.repository],['官方数据',b.official.dataset],['项目主页',b.official.homepage]].filter(x=>safeUrl(x[1]));const stages=(c.workflow_stages||[]).map(label).join(' → ')||'未明确';const summarySource=b.description?.trim()?'已登记摘要':'任务字段摘要';$('drawer-content').innerHTML=`<p class="eyebrow">BENCHMARK / ${esc(b.id)}</p><h2 id="detail-title">${esc(b.name)}</h2><p class="detail-lede">${esc(purposeText(b))}</p><div class="detail-platform-actions"><button class="button button-primary" data-eval-start="${esc(b.id)}">开始评测 →</button>${evaluationResultCount(b.id)?`<button class="button button-ghost" data-results-benchmark="${esc(b.id)}">查看 ${fmt(evaluationResultCount(b.id))} 条公开成绩 ↗</button>`:'<span>暂未收录公开成绩，可运行后提交。</span>'}</div><div class="chips detail-tags">${chip(label(b.domain))}${b.subdomain?chip(b.subdomain.replaceAll('-',' ')):''}${chip(b.year||'年份待核实')}${chip(label(b.integration.status),'runner')}${b.question_count!=null?chip(`${fmt(b.question_count)} （规模提取值）`,'count-chip'):''}${chip(summarySource,'inferred')}</div><div class="detail-note"><strong>阅读提示：</strong>先看“测量对象”和输入输出示意，再核对官方来源、版本、许可证与访问边界。此目录展示元数据与评测入口，不提供受限数据下载，也不代表所有评测均已接入本地执行。</div>${section('一眼看懂',infoGrid([['科学域',label(b.domain)],['学科分类',label(c.domain_family||b.domain)],['评测对象',b.task_types?.[0]||'科学任务'],['规模提取值（见原始单位）',b.question_count==null?'未提取':fmt(b.question_count)],['工作流',stages],['摘要来源',summarySource],['元数据完整度',`${metadataCompleteness(b)}%`],['证据等级',label(c.evidence_tier||'metadata_only')]]))}${section('任务定义与规模',`<p>${esc(b.description||purposeText(b))}</p><p class="size-line"><strong>规模：</strong>${esc(formatSize(b.size))}</p>`)}${section('输入 → 输出示意',demoBlock(b))}${section('能力与科研流程',`<div class="chips">${(c.capability_axes||[]).map(x=>chip(label(x),'capability')).join('')}</div><p class="detail-flow">${(c.workflow_stages||[]).map(label).map(esc).join(' → ')||'上游未声明工作流阶段'}</p>`)}${section('输入模态与评测范式',`<p>${(b.modalities||[]).map(label).map(esc).join(' · ')||'上游未明确'}</p><div class="chips detail-mode-chips">${(c.evaluation_modes||[]).map(x=>chip(label(x))).join('')}</div>`)}${section('评测指标',`<div class="metric-list">${(b.metrics||[]).map(x=>`<span>${esc(label(x))}</span>`).join('')||'<span>上游尚未明确，使用前需核对。</span>'}</div>`)}${section('访问与许可证',`<p><strong>${esc(label(c.data_access))}</strong> · ${esc(label(c.license_class))}</p><p class="license-copy">${esc(b.license||'上游未声明可复用许可证。')}</p>`)}${section('公司关系与证据',majorSignalBlock(b))}${section('官方来源',links.length?`<ul class="source-list">${links.map(([n,u])=>`<li><span>${esc(n)}</span><a href="${esc(safeUrl(u))}" target="_blank" rel="noreferrer">打开官方入口 ↗</a></li>`).join('')}</ul>`:'<p>暂无可直接打开的官方入口。</p>')}${b.integration.runner?section('本地调用入口',`<code>${esc(b.integration.runner)}</code><p>请在私有评测仓库中执行；部分适配仅覆盖已声明子任务。</p>`):''}${section('机构证据',b.organizations.length?b.organizations.map(o=>`<div class="organization-row"><strong>${esc(o.organization)}</strong> <span>· ${esc(label(o.relationship))}</span> ${safeUrl(o.source_url)?`<a href="${esc(safeUrl(o.source_url))}" target="_blank" rel="noreferrer">来源 ↗</a>`:''}</div>`).join('')+'<p class="evidence-footnote">模型被论文作者测试，不等于该公司内部采用此基准。</p>':'<p>暂无已收录的公司或机构关系证据。</p>')}<div class="detail-note">分类版本 ${esc(c.version||'1.0.0')} · 规则派生，未经逐条人工认证。无法据此推断难度等级或模型综合排名。</div>`;document.querySelector('.drawer-panel').scrollTop=0;$('detail-drawer').classList.add('open');$('detail-drawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.querySelector('.drawer-close').focus()}
function closeDetail(){$('detail-drawer').classList.remove('open');$('detail-drawer').setAttribute('aria-hidden','true');document.body.style.overflow='';previousFocus?.focus()}
// Public, browser-local planning and contribution flow. No credentials or cloud execution.
const evaluationPlanState={selectedId:'terminal-bench-science-scientific-agent-benchmark',plan:[],versions:{},model:'',harness:'',version:'',query:'',submission:[],importGeneration:0,bound:false};
function evaluationOfficialLinks(b){return [['运行说明 / 源码',b.official?.repository],['官方数据',b.official?.dataset],['项目主页',b.official?.homepage],['论文',b.paper?.url]].filter(([,u])=>safeUrl(u)).map(([name,u])=>`<a href="${esc(safeUrl(u))}" target="_blank" rel="noreferrer">${esc(name)} ↗</a>`).join('')}
function evaluationDownload(value,name){const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function evaluationCandidates(){return list(data?.benchmarks).filter(b=>safeUrl(b.official?.repository)||safeUrl(b.official?.homepage)||safeUrl(b.official?.dataset))}
function evaluationReadInputs(){for(const key of ['model','harness','version'])evaluationPlanState[key]=$(`eval-${key}`)?.value.trim()||'';evaluationPlanState.versions[evaluationPlanState.selectedId]=evaluationPlanState.version}
function evaluationMessage(message,error=false){const el=$('eval-message');if(el){el.textContent=message;el.classList.toggle('is-error',error);el.setAttribute('role',error?'alert':'status')}}
function renderEvaluationChoices(){
  const query=evaluationPlanState.query.trim().toLowerCase(),preferred=['terminal-bench-science-scientific-agent-benchmark','gpqa','paperbench','paperbenchx'];
  const candidates=evaluationCandidates().filter(b=>!query||[b.id,b.name,b.domain,label(b.domain),b.description,...list(b.task_types)].join(' ').toLowerCase().includes(query)).sort((a,b)=>{const ai=preferred.indexOf(a.id),bi=preferred.indexOf(b.id);return (ai<0?99:ai)-(bi<0?99:bi)||a.name.localeCompare(b.name)});
  $('eval-choices').innerHTML=candidates.slice(0,8).map(b=>`<button type="button" class="eval-choice" data-eval-select="${esc(b.id)}" aria-pressed="${b.id===evaluationPlanState.selectedId}"><strong>${esc(b.name)}</strong><span>${esc(label(b.domain))} · ${esc(list(b.metrics)[0]||'指标待确认')}</span></button>`).join('')||'<p class="eval-empty">未找到匹配项，试试评测英文名称或学科。</p>';
  $('eval-choice-count').textContent=`${fmt(candidates.length)} 项有官方入口${candidates.length>8?' · 显示前 8 项':''}`;
}
function renderEvaluationSelection(){
  const b=list(data?.benchmarks).find(b=>b.id===evaluationPlanState.selectedId),panel=$('eval-selection');
  if(!b){panel.innerHTML='<p>请先选择一项评测。</p>';return}
  const size=typeof b.size==='object'?JSON.stringify(b.size):b.size;
  panel.innerHTML=`<div class="eval-selected-top"><span class="eyebrow">SELECTED BENCHMARK</span><span>${esc(label(b.domain))}</span></div><h3>${esc(b.name)}</h3><p>${esc(b.description||list(b.task_types).join(' · ')||'任务说明以官方协议为准。')}</p><dl class="eval-spec"><div><dt>规模与单位</dt><dd>${esc(size||'未登记，请查看官方说明')}</dd></div><div><dt>登记指标</dt><dd>${esc(list(b.metrics).join(' · ')||'待核实')}</dd></div><div><dt>数据访问</dt><dd>${esc(label(b.classification?.data_access||b.access||'未知'))}</dd></div><div><dt>精确评测版本</dt><dd>请填写本次运行使用的版本 / commit</dd></div></dl><details class="eval-license"><summary>许可证与使用条件</summary><p>${esc(b.license||'未核实。请在运行前查看官方许可与数据访问条件。')}</p></details><div class="eval-official-links">${evaluationOfficialLinks(b)}</div>${![b.official?.repository,b.official?.dataset,b.official?.homepage].some(safeUrl)?'<p class="eval-small-note">当前仅登记论文，运行入口尚未核实；请先核对作者提供的代码与数据。</p>':''}<button type="button" class="button button-primary eval-add" data-eval-action="add">加入评测计划 <span aria-hidden="true">＋</span></button>`;
}
function renderEvaluationPlan(){
  const plan=evaluationPlanState.plan;
  $('eval-plan-count').textContent=`${plan.length} / 5`;
  $('eval-plan-list').innerHTML=plan.length?plan.map(id=>{const b=data.benchmarks.find(b=>b.id===id);return `<li><span>${esc(b?.name||id)}</span><button type="button" data-eval-remove="${esc(id)}" aria-label="${esc('移除 '+(b?.name||id))}">移除 ×</button></li>`}).join(''):'<li class="eval-empty">先选一项评测，加入后即可下载清单。</li>';
  $('eval-download-plan').disabled=!plan.length;
}
function evaluationPlanDocument(){
  evaluationReadInputs();
  return {schema_version:'1.0.0',kind:'ai4s-evaluation-plan',created_at:new Date().toISOString(),model:evaluationPlanState.model||null,harness:evaluationPlanState.harness||null,execution:'Run in your own environment following each benchmark official protocol.',benchmarks:evaluationPlanState.plan.map(id=>{const b=data.benchmarks.find(b=>b.id===id);return {benchmark_id:id,name:b.name,metrics:list(b.metrics),size:b.size??null,version:evaluationPlanState.versions[id]||null,official:{repository:safeUrl(b.official?.repository),dataset:safeUrl(b.official?.dataset),homepage:safeUrl(b.official?.homepage)},access:b.classification?.data_access||b.access||null,license:b.license||null}})};
}
function evaluationResultTemplate(){evaluationReadInputs();const ids=evaluationPlanState.plan.length?evaluationPlanState.plan:[evaluationPlanState.selectedId];return {schema_version:'1.0.0',results:ids.filter(Boolean).map(id=>({benchmark_id:id,model:evaluationPlanState.model,harness:evaluationPlanState.harness,benchmark_version:evaluationPlanState.versions[id]||'',metric:'',score:null,unit:'',evaluated_at:'',source_url:'',protocol:''}))}}
function validateEvaluationSubmission(payload,benchmarks){
  const errors=[],rows=Array.isArray(payload)?payload:Array.isArray(payload?.results)?payload.results:null,ids=new Set(benchmarks.map(b=>b.id));
  if(!rows)return {errors:['文件须为 results 数组或含 results 数组的 JSON 对象。'],rows:[]};
  if(!rows.length||rows.length>20)return {errors:['每次请上传 1–20 条成绩。'],rows:[]};
  const cleaned=[],seen=new Set();
  rows.forEach((row,index)=>{
    const n=`第 ${index+1} 条`,out={};
    if(!row||typeof row!=='object'||Array.isArray(row)){errors.push(`${n}须为 JSON 对象。`);return}
    for(const key of ['benchmark_id','model','harness','benchmark_version','metric','unit','evaluated_at','source_url','protocol']){
      if(typeof row[key]!=='string'||!row[key].trim()){errors.push(`${n}缺少 ${key}。`);continue}
      if(row[key].length>1500){errors.push(`${n}的 ${key} 过长（最多 1,500 字符）。`);continue}
      out[key]=row[key].trim();
    }
    if(!ids.has(out.benchmark_id))errors.push(`${n}的 benchmark_id 未在当前目录登记。`);
    if(typeof row.score!=='number'||!Number.isFinite(row.score))errors.push(`${n}的 score 须为有限数字；0 有效，null 表示尚未填写。`);else out.score=row.score;
    if(out.unit==='%'&&(row.score<0||row.score>100))errors.push(`${n}的百分比须在 0–100 之间。`);
    if(out.evaluated_at){const d=new Date(out.evaluated_at+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(out.evaluated_at)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==out.evaluated_at)errors.push(`${n}的 evaluated_at 须为有效日期 YYYY-MM-DD。`)}
    if(out.source_url){try{const u=new URL(out.source_url);if(u.protocol!=='https:'||u.username||u.password)throw Error();out.source_url=u.href}catch{errors.push(`${n}的 source_url 须为不含登录凭据的公开 HTTPS 证据链接。`)}}
    const key=[out.benchmark_id,out.model,out.harness,out.benchmark_version,out.metric,out.evaluated_at].join('|');
    if(seen.has(key))errors.push(`${n}与前一条成绩重复。`);seen.add(key);
    cleaned.push(out);
  });
  return {errors,rows:errors.length?[]:cleaned};
}
function evaluationIssueLink(rows){
  const title=`[成绩提交] ${rows[0].model} · ${rows.length} 条公开结果`;
  const lines=rows.slice(0,5).map((r,i)=>`${i+1}. ${r.benchmark_id} | ${r.model} | ${r.harness} | ${r.benchmark_version}\n${r.metric}: ${r.score} ${r.unit} · ${r.evaluated_at}\n证据: ${r.source_url}\n协议: ${r.protocol.slice(0,220)}`);
  let body=`提交公开成绩，申请核对后收录。以下为提交者报告，尚未经 Atlas 复测。\n\n${lines.join('\n\n')}\n\n请在发送前附上从 Atlas 导出的完整 JSON，以及运行日志、数据/环境版本、预算和重复次数。不要上传密钥或受限数据。`;
  if(rows.length>5)body+=`\n另有 ${rows.length-5} 条成绩见所附 JSON。`;
  let url='https://github.com/Sci-ultron/ai4s-evaluation-atlas/issues/new?'+new URLSearchParams({title,body});
  if(url.length>10000){body=`申请收录 ${rows.length} 条公开成绩。模型：${rows[0].model.slice(0,100)}。\n\n请在发送前附上从 Atlas 导出的完整 JSON 与公开证据链接，并说明版本、harness、运行预算、重复次数。不要上传密钥或受限数据。`;url='https://github.com/Sci-ultron/ai4s-evaluation-atlas/issues/new?'+new URLSearchParams({title:title.slice(0,180),body})}
  return url;
}
function selectEvaluationBenchmark(id){
  if(!list(data?.benchmarks).some(b=>b.id===id))return;
  evaluationReadInputs();evaluationPlanState.selectedId=id;evaluationPlanState.version=evaluationPlanState.versions[id]||'';evaluationPlanState.query='';
  if($('eval-version'))$('eval-version').value=evaluationPlanState.version;if($('eval-search'))$('eval-search').value='';
  renderEvaluationChoices();renderEvaluationSelection();
}
function openEvaluationBenchmark(id){
  if(!list(data?.benchmarks).some(b=>b.id===id))return false;
  const container=$('evaluate-app');
  if(typeof container.querySelector==='function')selectEvaluationBenchmark(id);else evaluationPlanState.selectedId=id;
  (container.closest?.('section')||container).scrollIntoView?.({behavior:'smooth',block:'start'});
  return true;
}
function renderEvaluationSubmission(rows){
  const panel=$('eval-upload-preview');
  panel.innerHTML=`<div class="eval-import-heading"><strong>${rows.length} 条成绩格式有效</strong><span>内容尚待人工核对</span></div><div class="eval-preview-wrap"><table class="eval-preview-table"><thead><tr><th>评测 / 版本</th><th>模型 / Harness</th><th>成绩</th><th>证据</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.benchmark_id)}<small>${esc(r.benchmark_version)} · ${esc(r.evaluated_at)}</small></td><td>${esc(r.model)}<small>${esc(r.harness)}</small></td><td>${esc(r.metric)}<strong>${esc(r.score)} ${esc(r.unit)}</strong></td><td><a href="${esc(r.source_url)}" target="_blank" rel="noreferrer">公开证据 ↗</a></td></tr>`).join('')}</tbody></table></div><div class="eval-submit-actions"><button class="button button-ghost" type="button" data-eval-action="download-validated">导出已校验 JSON ↓</button><a class="button button-primary" href="${esc(evaluationIssueLink(rows))}" target="_blank" rel="noreferrer">打开 GitHub 提交草稿 ↗</a></div><p class="eval-small-note">草稿会打开 GitHub；由你检查并发送。格式校验不代表成绩已审核或已收录。</p>`;
}
async function importEvaluationFile(file){
  const generation=++evaluationPlanState.importGeneration;
  evaluationPlanState.submission=[];$('eval-upload-preview').innerHTML='';
  if(!file)return;
  if(file.size>100000){evaluationMessage('文件超过 100 KB。请只上传成绩 JSON，运行产物请放在公开证据链接中。',true);return}
  try{const text=await file.text();if(generation!==evaluationPlanState.importGeneration)return;const payload=JSON.parse(text),result=validateEvaluationSubmission(payload,list(data?.benchmarks));if(result.errors.length){evaluationMessage(result.errors.slice(0,5).join(' ')+(result.errors.length>5?` 另有 ${result.errors.length-5} 项待修正。`:''),true);return}evaluationPlanState.submission=result.rows;renderEvaluationSubmission(result.rows);evaluationMessage('已在浏览器中完成格式校验。请核对预览后再打开提交草稿。')}catch{if(generation!==evaluationPlanState.importGeneration)return;evaluationMessage('无法读取 JSON。请检查文件编码、引号、逗号和括号；模板中的空字段需要补齐。',true)}
}
function renderEvaluationWorkspace(){
  const container=$('evaluate-app');if(!container)return;
  if(!data?.benchmarks?.length){container.innerHTML='<p>目录加载后即可选择评测。</p>';return}
  if(!data.benchmarks.some(b=>b.id===evaluationPlanState.selectedId))evaluationPlanState.selectedId=evaluationCandidates()[0]?.id;
  container.innerHTML=`<div class="eval-workflow-steps"><div><b>01</b><span>选评测<small>确认任务、版本与许可</small></span></div><div><b>02</b><span>在自己的环境运行<small>使用官方代码和评分协议</small></span></div><div><b>03</b><span>整理并提交成绩<small>公开证据，核对后收录</small></span></div></div><div class="eval-workspace-grid"><div class="eval-discovery"><label class="eval-label" for="eval-search">选择一项评测</label><input id="eval-search" type="search" autocomplete="off" placeholder="搜索名称或学科，如 Biology、GPQA" value="${esc(evaluationPlanState.query)}"/><p id="eval-choice-count" class="eval-small-note"></p><div id="eval-choices" class="eval-choices"></div></div><div id="eval-selection" class="eval-selection"></div></div><div class="eval-plan-panel"><div class="eval-panel-title"><h3>你的评测计划</h3><span id="eval-plan-count"></span></div><div class="eval-model-fields"><label for="eval-model">模型名称<input id="eval-model" maxlength="160" placeholder="如你的模型版本名" value="${esc(evaluationPlanState.model)}"/></label><label for="eval-harness">Harness / 运行框架<input id="eval-harness" maxlength="160" placeholder="如 Codex、Pi、自定义 Agent" value="${esc(evaluationPlanState.harness)}"/></label><label for="eval-version">本次基准版本 / commit<input id="eval-version" maxlength="160" placeholder="未确认时留空，运行前锁定版本" value="${esc(evaluationPlanState.version)}"/></label></div><ul id="eval-plan-list" class="eval-plan-list"></ul><div class="eval-plan-actions"><button id="eval-download-plan" type="button" class="button button-primary" data-eval-action="download-plan">下载评测清单 JSON ↓</button><button type="button" class="button button-ghost" data-eval-action="download-template">下载成绩提交模板 ↓</button></div><p class="eval-small-note">清单用于组织运行，不是通用执行脚本。按各评测的官方说明准备环境和数据；不同基准请分别确认版本。本站不托管模型执行，也不收集 API 密钥。</p></div><div class="eval-contribute-panel"><div><p class="eyebrow">CONTRIBUTE YOUR EVIDENCE</p><h3>让更多人看见可复核的成绩。</h3><p>填写模板后上传 JSON，在浏览器中检查字段与证据链接，再打开 GitHub 提交草稿。</p></div><label class="eval-upload-label" for="eval-upload">选择成绩 JSON ↑<input id="eval-upload" type="file" accept="application/json,.json"/><span>1–20 条成绩 · 上限 100 KB · 文件留在本机</span></label></div><p id="eval-message" class="eval-message" role="status" aria-live="polite"></p><div id="eval-upload-preview"></div>`;
  // Contract-only DOM implementations cannot materialize children from innerHTML.
  if(typeof container.querySelector!=='function')return;
  renderEvaluationChoices();renderEvaluationSelection();renderEvaluationPlan();
  if(evaluationPlanState.submission.length)renderEvaluationSubmission(evaluationPlanState.submission);
  if(evaluationPlanState.bound)return;evaluationPlanState.bound=true;
  container.addEventListener('input',e=>{if(e.target.id==='eval-search'){evaluationPlanState.query=e.target.value;renderEvaluationChoices()}else if(['eval-model','eval-harness','eval-version'].includes(e.target.id))evaluationReadInputs()});
  container.addEventListener('change',e=>{if(e.target.id==='eval-upload')importEvaluationFile(e.target.files?.[0])});
  container.addEventListener('click',e=>{
    const choice=e.target.closest('[data-eval-select]'),remove=e.target.closest('[data-eval-remove]'),action=e.target.closest('[data-eval-action]')?.dataset.evalAction;
    if(choice)selectEvaluationBenchmark(choice.dataset.evalSelect);
    if(remove){evaluationPlanState.plan=evaluationPlanState.plan.filter(id=>id!==remove.dataset.evalRemove);renderEvaluationPlan();evaluationMessage('已从计划移除。')}
    if(action==='add'){evaluationReadInputs();const id=evaluationPlanState.selectedId;if(evaluationPlanState.plan.includes(id)){evaluationMessage('这项评测已在计划中。');return}if(evaluationPlanState.plan.length>=5){evaluationMessage('每份计划最多 5 项，请先移除一项。',true);return}evaluationPlanState.plan.push(id);renderEvaluationPlan();evaluationMessage('已加入评测计划。')}
    if(action==='download-plan'&&evaluationPlanState.plan.length){evaluationDownload(evaluationPlanDocument(),'ai4s-evaluation-plan.json');evaluationMessage('评测清单已生成，请按各官方入口准备运行。')}
    if(action==='download-template'){evaluationDownload(evaluationResultTemplate(),'ai4s-result-template.json');evaluationMessage('模板已生成。请填写真实成绩与公开证据，score 为 null 时不能提交。')}
    if(action==='download-validated'&&evaluationPlanState.submission.length)evaluationDownload({schema_version:'1.0.0',results:evaluationPlanState.submission},'ai4s-results-validated.json');
  });
}

async function init(){try{const response=await fetch('catalog.json',{cache:'no-cache'});if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();data.benchmarks.forEach(b=>b._search=[b.name,b.id,b.description,b.subdomain,label(b.domain),label(b.classification.domain_family),b.paper.title,...b.task_types,...b.modalities,...b.classification.capability_axes.map(label),...b.organizations.map(o=>o.organization),...(b.major_company_published_by||[]),...(b.major_company_evaluated_by||[]),...(b.major_company_published_labels||[]),...(b.major_company_evaluated_labels||[]),b.major_company_status?.label||''].join(' ').toLowerCase());$('hero-count').textContent=fmt(data.benchmark_count);$('hero-domains').textContent=Object.keys(data.facets.domain).length;$('hero-suites').textContent=data.suite_count;$('hero-orgs').textContent=data.organization_count;$('sync-status').textContent=`更新 ${data.generated_at}`;$('footer-meta').textContent=`${fmt(data.benchmark_count)} 条 · ${data.generated_at} · 公开成绩与评测入口`;const runners=data.benchmarks.filter(x=>x.integration.runner).length,linked=data.benchmarks.filter(x=>x.organizations.length).length,questioned=data.taxonomy?.question_count?.known_benchmark_count||0,major=data.taxonomy?.major_company||{};$('kpi-row').innerHTML=[[runners,'含调用入口'],[linked,'有机构证据'],[data.relationship_count,'发布/评测关系'],[questioned,'已提取规模数量'],[major.role_counts?.released_by||0,'公司发布/联合发布'],[major.role_counts?.official_evaluation||0,'公司官方报告使用']].map(([v,l])=>`<div class="kpi"><strong>${fmt(v)}</strong><span>${l}</span></div>`).join('');fillSelect('company-filter',(data.taxonomy?.major_company?.families||[]).map(x=>x.company));fillSelect('domain-filter',Object.keys(data.facets.domain));fillSelect('family-filter',Object.keys(data.facets.capability_axes));fillSelect('mode-filter',Object.keys(data.facets.evaluation_modes));fillSelect('access-filter',Object.keys(data.facets.data_access));fillSelect('year-filter',[...new Set(data.benchmarks.map(x=>x.year).filter(Boolean))].sort((a,b)=>b-a));renderBars('capability-bars',data.facets.capability_axes,'capability_axes');renderBars('workflow-bars',data.facets.workflow_stages,'workflow_stages');renderBars('evidence-bars',data.facets.evidence_tier,'evidence_tier');renderTaxonomy();renderFrontier();renderEvaluationHub();renderEvaluationWorkspace();$('suite-list').innerHTML=data.suites.filter(s=>['core-science-v1','chemistry-v1','biology-medicine-v1','research-agent-v1','scientific-literature-v1','scientific-ml-v1'].includes(s.id)).map(s=>`<article class="suite-card"><p class="eyebrow">${s.benchmarks.length} BENCHMARKS</p><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><button data-suite="${esc(s.id)}">查看套件 →</button></article>`).join('');applyFilters()}catch(error){$('sync-status').textContent='目录加载失败';$('benchmark-list').innerHTML='<div class="empty-state">目录暂时无法读取。请使用本地 HTTP 服务打开网站，并确认 catalog.json 已生成。</div>';console.error(error)}}
for(const id of ['search','domain-filter','family-filter','mode-filter','access-filter','year-filter','company-filter','industry-filter','sort-filter'])$(id).addEventListener(id==='search'?'input':'change',applyFilters);
$('reset-filters').addEventListener('click',reset);
$('view-grid').addEventListener('click',()=>setView('grid'));
$('view-list').addEventListener('click',()=>setView('list'));
$('filter-toggle').addEventListener('click',()=>{
  const open=!$('filters-panel').classList.contains('is-open');
  $('filters-panel').classList.toggle('is-open',open);
  $('filter-toggle').setAttribute('aria-expanded',String(open));
});
$('prev-page').addEventListener('click',()=>{if(page<=1)return;page--;renderResults();scrollToResults()});
$('next-page').addEventListener('click',()=>{if(page>=Math.ceil(filtered.length/pageSize))return;page++;renderResults();scrollToResults()});
document.addEventListener('click',e=>{
  const evaluateTarget=e.target.closest('[data-eval-start]'),resultsTarget=e.target.closest('[data-results-benchmark]');
  if(evaluateTarget||resultsTarget){if($('detail-drawer').classList.contains('open'))closeDetail();if(evaluateTarget)openEvaluationBenchmark(evaluateTarget.dataset.evalStart);if(resultsTarget)openResultsForBenchmark(resultsTarget.dataset.resultsBenchmark)}
  const scoreLink=e.target.closest('[data-open-scoreboard]');
  if(scoreLink)renderScoreboard(scoreLink.dataset.openScoreboard);
  const scoreboard=e.target.closest('[data-scoreboard]');
  if(scoreboard)renderScoreboard(scoreboard.dataset.scoreboard);
  if(e.target.closest('[data-frontier-catalog]')){
    const benchmarks=frontierBenchmarkIds();
    if(benchmarks.length){clearFilterValues();selectedSuite={name:'长程科研精选',benchmarks};applyFilters();scrollToResults()}
  }
  const detail=e.target.closest('[data-detail]');
  if(detail)openDetail(detail.dataset.detail);
  if(e.target.closest('[data-close-drawer]'))closeDetail();
  if(e.target.closest('[data-reset-all]')){reset();if(e.detail===0)$('search').focus()}
  const clear=e.target.closest('[data-clear-filter]');
  if(clear){
    const key=clear.dataset.clearFilter;
    if(key==='selectedSuite')selectedSuite=null;
    else if(key==='extraFilter')extraFilter=null;
    else if(Object.hasOwn(filterFields,key))filterElement(key).value='';
    applyFilters();
    if(e.detail===0)(document.querySelector('[data-clear-filter]')||$('search')).focus();
  }
  const quick=e.target.closest('[data-quick-domain]');
  if(quick){clearFilterValues();$('domain-filter').value=quick.dataset.quickDomain;applyFilters()}
  const axis=e.target.closest('[data-axis]');
  if(axis){clearFilterValues();extraFilter={field:axis.dataset.axis,key:axis.dataset.key};applyFilters();scrollToResults()}
  const subject=e.target.closest('[data-taxonomy-domain]');
  if(subject){clearFilterValues();$('domain-filter').value=subject.dataset.taxonomyDomain;applyFilters();scrollToResults()}
  const suite=e.target.closest('[data-suite]');
  if(suite){clearFilterValues();selectedSuite=data.suites.find(s=>s.id===suite.dataset.suite);applyFilters();scrollToResults()}
});
document.addEventListener('keydown',e=>{
  const drawerOpen=$('detail-drawer').classList.contains('open');
  const typingTarget=e.target?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!drawerOpen&&!typingTarget){
    e.preventDefault();$('search').focus();return;
  }
  if(!drawerOpen)return;
  if(e.key==='Escape')closeDetail();
  if(e.key==='Tab'){
    const elements=[...document.querySelectorAll('.drawer-panel button,.drawer-panel a')];
    const first=elements[0],last=elements.at(-1);
    if(!first)return;
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
});
$('download-catalog').addEventListener('click',()=>{const a=document.createElement('a');a.href='catalog.json';a.download='ai4s-catalog.json';a.click()});
document.querySelector('.drawer-panel').setAttribute('role','dialog');
document.querySelector('.drawer-panel').setAttribute('aria-modal','true');
document.querySelector('.drawer-panel').setAttribute('aria-labelledby','detail-title');
// Decorative motion never changes scientific values or controls data availability.
function initializeAtlasMotion() {
  const root=typeof document!=='undefined'?document.documentElement:null;
  if(!root?.setAttribute)return;
  const button=document.getElementById('motion-toggle');
  if(!button||button.dataset?.motionBound)return;
  if(button.dataset)button.dataset.motionBound='true';
  const text=document.getElementById('motion-toggle-label');
  const icon=document.getElementById('motion-toggle-icon');
  let paused=false;
  const preference=typeof window!=='undefined'&&typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  const apply=()=>{
    const reduced=Boolean(preference?.matches);
    const state=reduced?'reduced':paused?'paused':'running';
    root.setAttribute('data-atlas-motion',state);
    button.disabled=reduced;
    button.setAttribute('aria-pressed',String(state==='running'));
    button.setAttribute('aria-label',reduced?'系统已减少动画，当前显示静态图示':paused?'播放装饰动画':'暂停装饰动画');
    if(text)text.textContent=reduced?'系统已减少动画':paused?'播放动画':'暂停动画';
    if(icon)icon.textContent=reduced?'—':paused?'▷':'Ⅱ';
  };
  button.addEventListener('click',()=>{if(preference?.matches)return;paused=!paused;apply()});
  if(typeof preference?.addEventListener==='function')preference.addEventListener('change',apply);
  else if(typeof preference?.addListener==='function')preference.addListener(apply);
  apply();
  // Visibility pauses the decorative loop without changing the visitor's choice.
  const visibility=()=>root.setAttribute('data-atlas-visible',document.hidden?'hidden':'visible');
  if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',visibility);
  visibility();
  // Only explicitly marked illustrations receive an entry animation; content is always visible.
  if(typeof IntersectionObserver==='function'&&typeof document.querySelectorAll==='function'){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.classList?.add('atlas-motion-seen');observer.unobserve(entry.target)}
    },{threshold:.2});
    for(const illustration of document.querySelectorAll('[data-motion-reveal]'))observer.observe(illustration);
  }
}

initializeAtlasMotion();
setView('grid');
init();
