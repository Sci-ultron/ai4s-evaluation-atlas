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
    return `<article class="benchmark-card"><div class="card-topline"><span class="card-domain">${esc(label(b.domain))}</span><span class="card-year">${esc(b.year||'年份待核实')}</span><span class="card-index">${String((page-1)*pageSize+i+1).padStart(4,'0')}</span></div><button class="benchmark-title" data-detail="${esc(b.id)}">${esc(b.name)}</button><p class="benchmark-description">${esc(b.description||purposeText(b))}</p><div class="chips card-capabilities">${c.capability_axes.slice(0,3).map(x=>chip(label(x),'capability')).join('')}</div><div class="chips card-signals">${countChip(b)}${majorSignalChips(b)}</div><div class="card-footer">${chip(label(status),['runnable','partially_runnable'].includes(status)?'runner':'access')}<button class="detail-button" data-detail="${esc(b.id)}">查看详情 <span aria-hidden="true">↗</span></button></div></article>`;
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
function openDetail(id){const b=data.benchmarks.find(x=>x.id===id);if(!b)return;previousFocus=document.activeElement;const c=b.classification;const links=[['论文',b.paper.url],['官方源码',b.official.repository],['官方数据',b.official.dataset],['项目主页',b.official.homepage]].filter(x=>safeUrl(x[1]));const stages=(c.workflow_stages||[]).map(label).join(' → ')||'未明确';const summarySource=b.description?.trim()?'已登记摘要':'任务字段摘要';$('drawer-content').innerHTML=`<p class="eyebrow">BENCHMARK / ${esc(b.id)}</p><h2 id="detail-title">${esc(b.name)}</h2><p class="detail-lede">${esc(purposeText(b))}</p><div class="chips detail-tags">${chip(label(b.domain))}${b.subdomain?chip(b.subdomain.replaceAll('-',' ')):''}${chip(b.year||'年份待核实')}${chip(label(b.integration.status),'runner')}${b.question_count!=null?chip(`${fmt(b.question_count)} （规模提取值）`,'count-chip'):''}${chip(summarySource,'inferred')}</div><div class="detail-note"><strong>阅读提示：</strong>先看“测量对象”和输入输出示意，再核对官方来源、版本、许可证与访问边界。此目录展示元数据与评测入口，不提供受限数据下载，也不代表所有评测均已接入本地执行。</div>${section('一眼看懂',infoGrid([['科学域',label(b.domain)],['学科分类',label(c.domain_family||b.domain)],['评测对象',b.task_types?.[0]||'科学任务'],['规模提取值（见原始单位）',b.question_count==null?'未提取':fmt(b.question_count)],['工作流',stages],['摘要来源',summarySource],['元数据完整度',`${metadataCompleteness(b)}%`],['证据等级',label(c.evidence_tier||'metadata_only')]]))}${section('任务定义与规模',`<p>${esc(b.description||purposeText(b))}</p><p class="size-line"><strong>规模：</strong>${esc(formatSize(b.size))}</p>`)}${section('输入 → 输出示意',demoBlock(b))}${section('能力与科研流程',`<div class="chips">${(c.capability_axes||[]).map(x=>chip(label(x),'capability')).join('')}</div><p class="detail-flow">${(c.workflow_stages||[]).map(label).map(esc).join(' → ')||'上游未声明工作流阶段'}</p>`)}${section('输入模态与评测范式',`<p>${(b.modalities||[]).map(label).map(esc).join(' · ')||'上游未明确'}</p><div class="chips detail-mode-chips">${(c.evaluation_modes||[]).map(x=>chip(label(x))).join('')}</div>`)}${section('评测指标',`<div class="metric-list">${(b.metrics||[]).map(x=>`<span>${esc(label(x))}</span>`).join('')||'<span>上游尚未明确，使用前需核对。</span>'}</div>`)}${section('访问与许可证',`<p><strong>${esc(label(c.data_access))}</strong> · ${esc(label(c.license_class))}</p><p class="license-copy">${esc(b.license||'上游未声明可复用许可证。')}</p>`)}${section('公司关系与证据',majorSignalBlock(b))}${section('官方来源',links.length?`<ul class="source-list">${links.map(([n,u])=>`<li><span>${esc(n)}</span><a href="${esc(safeUrl(u))}" target="_blank" rel="noreferrer">打开官方入口 ↗</a></li>`).join('')}</ul>`:'<p>暂无可直接打开的官方入口。</p>')}${b.integration.runner?section('本地调用入口',`<code>${esc(b.integration.runner)}</code><p>请在私有评测仓库中执行；部分适配仅覆盖已声明子任务。</p>`):''}${section('机构证据',b.organizations.length?b.organizations.map(o=>`<div class="organization-row"><strong>${esc(o.organization)}</strong> <span>· ${esc(label(o.relationship))}</span> ${safeUrl(o.source_url)?`<a href="${esc(safeUrl(o.source_url))}" target="_blank" rel="noreferrer">来源 ↗</a>`:''}</div>`).join('')+'<p class="evidence-footnote">模型被论文作者测试，不等于该公司内部采用此基准。</p>':'<p>暂无已收录的公司或机构关系证据。</p>')}<div class="detail-note">分类版本 ${esc(c.version||'1.0.0')} · 规则派生，未经逐条人工认证。无法据此推断难度等级或模型综合排名。</div>`;document.querySelector('.drawer-panel').scrollTop=0;$('detail-drawer').classList.add('open');$('detail-drawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.querySelector('.drawer-close').focus()}
function closeDetail(){$('detail-drawer').classList.remove('open');$('detail-drawer').setAttribute('aria-hidden','true');document.body.style.overflow='';previousFocus?.focus()}
async function init(){try{const response=await fetch('catalog.json',{cache:'no-cache'});if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();data.benchmarks.forEach(b=>b._search=[b.name,b.id,b.description,b.subdomain,label(b.domain),label(b.classification.domain_family),b.paper.title,...b.task_types,...b.modalities,...b.classification.capability_axes.map(label),...b.organizations.map(o=>o.organization),...(b.major_company_published_by||[]),...(b.major_company_evaluated_by||[]),...(b.major_company_published_labels||[]),...(b.major_company_evaluated_labels||[]),b.major_company_status?.label||''].join(' ').toLowerCase());$('hero-count').textContent=fmt(data.benchmark_count);$('hero-domains').textContent=Object.keys(data.facets.domain).length;$('hero-suites').textContent=data.suite_count;$('hero-orgs').textContent=data.organization_count;$('sync-status').textContent=`更新 ${data.generated_at}`;$('footer-meta').textContent=`${fmt(data.benchmark_count)} 条 · ${data.generated_at} · 仅展示元数据`;const runners=data.benchmarks.filter(x=>x.integration.runner).length,linked=data.benchmarks.filter(x=>x.organizations.length).length,questioned=data.taxonomy?.question_count?.known_benchmark_count||0,major=data.taxonomy?.major_company||{};$('kpi-row').innerHTML=[[runners,'含调用入口'],[linked,'有机构证据'],[data.relationship_count,'发布/评测关系'],[questioned,'已提取规模数量'],[major.role_counts?.released_by||0,'公司发布/联合发布'],[major.role_counts?.official_evaluation||0,'公司官方报告使用']].map(([v,l])=>`<div class="kpi"><strong>${fmt(v)}</strong><span>${l}</span></div>`).join('');fillSelect('company-filter',(data.taxonomy?.major_company?.families||[]).map(x=>x.company));fillSelect('domain-filter',Object.keys(data.facets.domain));fillSelect('family-filter',Object.keys(data.facets.capability_axes));fillSelect('mode-filter',Object.keys(data.facets.evaluation_modes));fillSelect('access-filter',Object.keys(data.facets.data_access));fillSelect('year-filter',[...new Set(data.benchmarks.map(x=>x.year).filter(Boolean))].sort((a,b)=>b-a));renderBars('capability-bars',data.facets.capability_axes,'capability_axes');renderBars('workflow-bars',data.facets.workflow_stages,'workflow_stages');renderBars('evidence-bars',data.facets.evidence_tier,'evidence_tier');renderTaxonomy();renderFrontier();$('suite-list').innerHTML=data.suites.filter(s=>['core-science-v1','chemistry-v1','biology-medicine-v1','research-agent-v1','scientific-literature-v1','scientific-ml-v1'].includes(s.id)).map(s=>`<article class="suite-card"><p class="eyebrow">${s.benchmarks.length} BENCHMARKS</p><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><button data-suite="${esc(s.id)}">查看套件 →</button></article>`).join('');applyFilters()}catch(error){$('sync-status').textContent='目录加载失败';$('benchmark-list').innerHTML='<div class="empty-state">目录暂时无法读取。请使用本地 HTTP 服务打开网站，并确认 catalog.json 已生成。</div>';console.error(error)}}
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
setView('grid');
init();
