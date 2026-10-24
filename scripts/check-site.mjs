// Dependency-free contract and application smoke checks, run before Pages deploys.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const catalog = JSON.parse(read('catalog.json'));
const html = read('index.html');
const source = read('app.js');
assert.ok(catalog.benchmarks?.length, 'Empty catalog');
assert.equal(catalog.benchmark_count, catalog.benchmarks.length);
assert.ok(catalog.facets?.domain, 'Use the website exporter, not the raw registry');
assert.ok(catalog.taxonomy?.subjects?.length, 'Missing taxonomy subject summaries');
assert.ok(catalog.taxonomy?.question_count, 'Missing question-count taxonomy');
assert.ok(catalog.taxonomy?.major_company, 'Missing major-company signal taxonomy');
assert.ok(Array.isArray(catalog.taxonomy.major_company.families), 'Missing major-company family taxonomy');
assert.equal(catalog.suite_count, catalog.suites.length);
assert.equal(catalog.organization_count, Object.keys(catalog.organizations).length);
assert.equal(catalog.relationship_count, catalog.benchmarks.reduce((n, b) => n + b.organizations.length, 0));
const ids = new Set(catalog.benchmarks.map(b => b.id));
assert.equal(ids.size, catalog.benchmark_count);
for (const b of catalog.benchmarks) {
  for (const field of ['task_types', 'modalities', 'metrics', 'organizations']) assert.ok(Array.isArray(b[field]), `${b.id}: ${field}`);
  assert.ok(Object.hasOwn(b, 'question_count'), `${b.id}: question_count`);
  assert.ok(Array.isArray(b.major_company_signals), `${b.id}: major_company_signals`);
  assert.ok(['none', 'company_published', 'evaluation_record', 'release_and_evaluation'].includes(b.major_company_status?.release_type), `${b.id}: major_company_status`);
  assert.ok(Array.isArray(b.major_company_status?.published_by), `${b.id}: major_company_status.published_by`);
  assert.ok(Array.isArray(b.major_company_status?.evaluated_by), `${b.id}: major_company_status.evaluated_by`);
  for (const field of ['capability_axes', 'workflow_stages', 'evaluation_modes']) assert.ok(Array.isArray(b.classification[field]), `${b.id}: ${field}`);
  assert.ok(b.paper && b.official && b.integration);
  assert.ok(!('local_path' in b.integration), 'Private checkout paths must not be exported');
}
for (const suite of catalog.suites) for (const id of suite.benchmarks) assert.ok(ids.has(id), `Unknown suite member ${id}`);
if (catalog.frontier) {
  assert.equal(catalog.frontier.schema_version, '1.0.0');
  assert.match(catalog.frontier.reviewed_at, /^\d{4}-\d{2}-\d{2}$/);
  for (const field of ['resources', 'benchmarks', 'scoreboards']) assert.ok(Array.isArray(catalog.frontier[field]), `frontier.${field}`);
  for (const benchmark of catalog.frontier.benchmarks) if (benchmark.benchmark_id) assert.ok(ids.has(benchmark.benchmark_id), `Unknown frontier benchmark ${benchmark.benchmark_id}`);
  const sourceGroups=[...catalog.frontier.resources, ...catalog.frontier.benchmarks].map(entry=>entry.sources);
  sourceGroups.push(...catalog.frontier.scoreboards.map(board=>[board.source]));
  for (const sources of sourceGroups) {
    assert.ok(sources?.length, 'Every frontier entry needs a primary source');
    for (const source of sources) assert.match(source.url, /^https:\/\//, 'Frontier sources use public HTTPS URLs');
  }
}
for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(https?:|#|data:)/.test(ref)) continue;
  assert.ok(!ref.startsWith('/'), `Project Pages needs relative asset paths: ${ref}`);
  assert.ok(existsSync(new URL(ref.split('?')[0], root)), `Missing asset: ${ref}`);
}

// A minimal DOM records effects of the actual frontend without fetching external data.
function element(tagName='div', attrs={}) {
  const classes = new Set((attrs.class||'').split(/\s+/).filter(Boolean));
  return { value: '', textContent: '', innerHTML: '', disabled: false, hidden: false,
    tagName: String(tagName).toUpperCase(), dataset: {},
    style: {}, attributes: {...attrs}, children: [], listeners: {}, scrolls: [],
    classList: {
      add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x),
      toggle(x, force) { const add=force??!classes.has(x); if(add)classes.add(x);else classes.delete(x);return add; },
    },
    addEventListener(name, fn) { (this.listeners[name]??=[]).push(fn); },
    dispatch(name, event={}) { for(const fn of this.listeners[name]||[])fn({target:this,...event}); },
    append(child) { this.children.push(child); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]??null; },
    closest(selector) {
      for(const part of selector.split(',')) {
        const simple=part.trim();
        if(simple===this.tagName.toLowerCase())return this;
        if(simple.startsWith('[contenteditable]')&&this.attributes.contenteditable!==undefined&&this.attributes.contenteditable!=='false')return this;
        const data=simple.match(/^\[data-([\w-]+)\]$/);
        if(data&&Object.hasOwn(this.dataset,data[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())))return this;
      }
      return null;
    },
    focus() { this.document.activeElement=this; },
    scrollIntoView(options) { this.scrolls.push(options); }, click() { this.dispatch('click'); },
  };
}
async function boot(payload) {
  const nodes = new Map([...html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map(match => {
    const [,tag,id]=match;
    const attrs=Object.fromEntries([...match[0].matchAll(/\b([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
    return [id,element(tag,attrs)];
  }));
  for (const id of ['.drawer-panel', '.drawer-close', '.drawer-last-link']) nodes.set(id, element(id==='.drawer-last-link'?'a':'button'));
  const quickDomains=[...html.matchAll(/<button\b[^>]*\bdata-quick-domain="([^"]*)"[^>]*>/g)].map(([,domain])=>{const button=element('button');button.dataset.quickDomain=domain;return button;});
  const frontierCatalogButtons=[...html.matchAll(/<button\b[^>]*\bdata-frontier-catalog(?:[\s=>])/g)].map(()=>{const button=element('button');button.dataset.frontierCatalog='';return button;});
  let scoreboardMarkup, scoreboardNodes=[];
  const scoreboardButtons=()=>{
    const markup=nodes.get('scoreboard-controls')?.innerHTML||'';
    if(markup!==scoreboardMarkup){
      scoreboardMarkup=markup;
      scoreboardNodes=[...markup.matchAll(/<button\b[^>]*\bdata-scoreboard="([^"]*)"[^>]*>/g)].map(match=>{
        const attrs=Object.fromEntries([...match[0].matchAll(/\b([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
        const button=element('button',attrs);button.dataset.scoreboard=match[1];return button;
      });
    }
    return scoreboardNodes;
  };
  const errors = [];
  const document={ body: { style: {} }, activeElement: null, listeners: {},
    getElementById: id => { assert.ok(nodes.has(id), `Missing DOM id ${id}`); return nodes.get(id); },
    createElement: tag => {const node=element(tag);node.document=document;return node;},
    querySelector: selector => nodes.get(selector),
    querySelectorAll: selector => selector==='[data-quick-domain]'?quickDomains:selector==='[data-scoreboard]'?scoreboardButtons():selector==='[data-frontier-catalog]'?frontierCatalogButtons:selector==='.drawer-panel button,.drawer-panel a'?[nodes.get('.drawer-close'),nodes.get('.drawer-last-link')]:[],
    addEventListener(name,fn) { (this.listeners[name]??=[]).push(fn); },
    dispatch(name,event) { for(const fn of this.listeners[name]||[])fn(event); },
  };
  for(const node of [...nodes.values(),...quickDomains,...frontierCatalogButtons])node.document=document;
  document.activeElement=document.createElement('body');
  const context = vm.createContext({
    URL, console: { error: e => errors.push(e) },
    fetch: async url => { assert.equal(url, 'catalog.json'); return { ok: true, json: async () => structuredClone(payload) }; },
    document,
  });
  vm.runInContext(source, context, { filename: fileURLToPath(new URL('app.js', root)) });
  await new Promise(resolve => setImmediate(resolve));
  const click=dataset=>{const target=document.createElement('button');target.dataset=dataset;document.dispatch('click',{target,detail:0});};
  const key=(key,options={})=>{
    const event={key,target:document.activeElement,prevented:false,preventDefault(){this.prevented=true;},...options};
    document.dispatch('keydown',event);return event;
  };
  return { nodes, context, errors, document, quickDomains, frontierCatalogButtons, scoreboardButtons, click, key };
}
const { nodes, context, errors, document, quickDomains, click, key } = await boot(catalog);
assert.deepEqual(errors, [], 'Frontend initialization failed');
assert.equal(nodes.get('frontier-data-signal').textContent,String(catalog.frontier.resources.length));
assert.equal(catalog.frontier.featured?.benchmark_id,'terminal-bench-science-scientific-agent-benchmark');
assert.equal(catalog.frontier.featured?.scoreboard_id,'terminal-bench-science-official');
assert.equal(catalog.frontier.featured?.metric_key,'resolution');
const featuredBenchmark=catalog.frontier.benchmarks.find(b=>b.benchmark_id===catalog.frontier.featured.benchmark_id);
const featuredBoard=catalog.frontier.scoreboards.find(b=>b.id===catalog.frontier.featured.scoreboard_id);
assert.equal(String(featuredBenchmark.scale),'70');
assert.equal(nodes.get('frontier-benchmark-signal').textContent,'70');
assert.match(nodes.get('frontier-benchmark-signal-label').textContent,/Terminal-Bench-Science/);
assert.equal(nodes.get('frontier-score-signal').textContent,'68.1%');
assert.ok(nodes.get('frontier-score-signal-label').textContent.includes(featuredBoard.name));
assert.ok(nodes.get('frontier-score-signal-label').textContent.includes(featuredBoard.columns.find(column=>column.key===catalog.frontier.featured.metric_key).label));
assert.doesNotMatch(nodes.get('frontier-score-signal-label').textContent,/Full/);
const featuredHero=nodes.get('hero-frontier').innerHTML;
assert.match(featuredHero,/核心科学终端评测/);
assert.match(featuredHero,/Terminal-Bench-Science/);
assert.match(featuredHero,/<strong>70<\/strong>/);
assert.match(featuredHero,/68.1%/);
assert.match(featuredHero,/GPT-6 Astra/);
assert.match(featuredHero,/Codex/);
assert.match(featuredHero,/max/);
assert.match(featuredHero,/2026-09-23/);
assert.match(featuredHero,/data-detail="terminal-bench-science-scientific-agent-benchmark"/);
assert.match(featuredHero,/data-open-scoreboard="terminal-bench-science-official"/);
assert.ok(featuredHero.includes(featuredBoard.source.label),'Hero exposes the source label for its score');
const featuredHeroUrls=[...featuredHero.matchAll(/href="(https?:[^\"]+)"/g)].map(match=>match[1]);
assert.ok(featuredHeroUrls.length<=3,'Hero uses at most three primary source links');
assert.equal(new Set(featuredHeroUrls).size,featuredHeroUrls.length,'Hero source links are deduplicated');
assert.match(nodes.get('frontier-scores').innerHTML,/68.1/);
assert.ok(nodes.get('frontier-score-context').innerHTML.includes(featuredBoard.name),'Featured board opens by default');
assert.ok(nodes.get('frontier-score-context').innerHTML.includes(featuredBoard.source.label));
assert.match(nodes.get('sync-status').textContent, /^更新 /);
assert.equal(nodes.get('hero-count').textContent, catalog.benchmark_count.toLocaleString('en-US'));
assert.equal(nodes.get('hero-suites').textContent, catalog.suite_count);
assert.match(nodes.get('benchmark-list').innerHTML, /benchmark-card/);
assert.doesNotMatch(nodes.get('benchmark-list').innerHTML, /card-spec|benchmark-flow|demo-disclaimer|company-fields/,'Cards should remain compact; full evidence belongs in details');
assert.match(nodes.get('suite-list').innerHTML, /core-science-v1/);
assert.equal(nodes.get('view-grid').getAttribute('aria-pressed'),'true');
nodes.get('view-list').click();
assert.equal(nodes.get('benchmark-list').classList.contains('is-list'),true);
assert.equal(nodes.get('view-list').getAttribute('aria-pressed'),'true');
assert.equal(nodes.get('view-grid').getAttribute('aria-pressed'),'false');
nodes.get('view-grid').click();
assert.equal(nodes.get('benchmark-list').classList.contains('is-list'),false);
assert.equal(nodes.get('view-grid').getAttribute('aria-pressed'),'true');
assert.equal(nodes.get('active-filters').hidden,true);
nodes.get('search').value = 'gpqa';
nodes.get('search').dispatch('input');
assert.match(nodes.get('benchmark-list').innerHTML, /GPQA/i);
assert.equal(nodes.get('active-filters').hidden,false);
assert.match(nodes.get('active-filters').innerHTML,/data-clear-filter="search"/);
click({clearFilter:'search'});
assert.equal(nodes.get('search').value,'');
assert.equal(document.activeElement,nodes.get('search'),'Keyboard chip removal returns focus to search');
assert.equal(nodes.get('active-filters').hidden,true);
nodes.get('search').value='code_execution';
nodes.get('search').dispatch('input');
assert.match(nodes.get('active-filters').innerHTML,/关键词 · code_execution/,'Search chip preserves the literal query');
nodes.get('search').value = 'no-such-benchmark-unique-needle';
nodes.get('search').dispatch('input');
assert.equal(nodes.get('result-count').textContent, '0');
assert.match(nodes.get('benchmark-list').innerHTML,/data-reset-all/);
click({resetAll:''});
assert.equal(nodes.get('result-count').textContent,catalog.benchmark_count.toLocaleString('en-US'));
assert.equal(nodes.get('active-filters').hidden,true);
for (const company of ['OpenAI', 'Tencent / Hunyuan', 'ByteDance / Seed']) {
  for (const role of ['released_by', 'official_evaluation', 'external_evaluation', 'evaluation_unresolved']) {
    nodes.get('company-filter').value = company;
    nodes.get('industry-filter').value = role;
    nodes.get('company-filter').dispatch('change');
    const expected = catalog.benchmarks.filter(b => b.major_company_signals.some(s => s.company_family === company && s.context === role)).length;
    assert.equal(nodes.get('result-count').textContent, expected.toLocaleString('en-US'), `${company}: ${role}`);
  }
}
nodes.get('reset-filters').click();
const filterValues={domain:'Chemistry',family:Object.keys(catalog.facets.capability_axes)[0],mode:Object.keys(catalog.facets.evaluation_modes)[0],access:Object.keys(catalog.facets.data_access)[0],year:String(catalog.benchmarks.find(b=>b.year).year),company:'OpenAI',industry:'official_evaluation'};
for(const [filter,value] of Object.entries(filterValues)){
  nodes.get(`${filter}-filter`).value=value;
  nodes.get(`${filter}-filter`).dispatch('change');
  assert.match(nodes.get('active-filters').innerHTML,new RegExp(`data-clear-filter="${filter}"`));
  click({clearFilter:filter});
  assert.equal(nodes.get(`${filter}-filter`).value,'');
  assert.equal(nodes.get('active-filters').hidden,true);
}
nodes.get('domain-filter').value = 'Chemistry';
nodes.get('domain-filter').dispatch('change');
assert.equal(nodes.get('result-count').textContent, catalog.facets.domain.Chemistry.toLocaleString('en-US'));
assert.ok(quickDomains.length>=4,'Missing quick-domain shortcuts');
assert.equal(quickDomains.find(b=>b.dataset.quickDomain==='Chemistry').getAttribute('aria-pressed'),'true');
click({suite:'core-science-v1'});
assert.match(nodes.get('active-filters').innerHTML,/data-clear-filter="selectedSuite"/);
click({clearFilter:'selectedSuite'});
assert.equal(nodes.get('active-filters').hidden,true);
click({axis:'workflow_stages',key:Object.keys(catalog.facets.workflow_stages)[0]});
assert.match(nodes.get('active-filters').innerHTML,/data-clear-filter="extraFilter"/);
click({clearFilter:'extraFilter'});
assert.equal(nodes.get('active-filters').hidden,true);
click({suite:'core-science-v1'});
nodes.get('search').value='gpqa';
click({quickDomain:'Chemistry'});
assert.equal(nodes.get('search').value,'');
assert.equal(nodes.get('domain-filter').value,'Chemistry');
assert.equal(nodes.get('result-count').textContent,catalog.facets.domain.Chemistry.toLocaleString('en-US'));
assert.doesNotMatch(nodes.get('active-filters').innerHTML,/selectedSuite/);
click({quickDomain:''});
assert.equal(nodes.get('active-filters').hidden,true);
assert.equal(quickDomains.find(b=>b.dataset.quickDomain==='').getAttribute('aria-pressed'),'true');
assert.equal(nodes.get('filter-toggle').getAttribute('aria-expanded'),'false');
nodes.get('filter-toggle').click();
assert.equal(nodes.get('filters-panel').classList.contains('is-open'),true);
assert.equal(nodes.get('filter-toggle').getAttribute('aria-expanded'),'true');
nodes.get('filter-toggle').click();
assert.equal(nodes.get('filters-panel').classList.contains('is-open'),false);
assert.equal(nodes.get('filter-toggle').getAttribute('aria-expanded'),'false');
const scrollsBefore=nodes.get('results-scroll').scrolls.length;
nodes.get('next-page').click();
assert.match(nodes.get('page-label').textContent,/^2 \/ /);
assert.equal(nodes.get('results-scroll').scrolls.length,scrollsBefore+1);
nodes.get('prev-page').click();
assert.match(nodes.get('page-label').textContent,/^1 \/ /);
assert.equal(nodes.get('prev-page').disabled,true);
nodes.get('prev-page').click();
assert.match(nodes.get('page-label').textContent,/^1 \/ /);
document.activeElement=document.createElement('body');
assert.equal(key('/').prevented,true);
assert.equal(document.activeElement,nodes.get('search'));
for(const target of [document.createElement('input'),document.createElement('select'),document.createElement('textarea'),document.createElement('div')]){
  if(target.tagName==='DIV')target.setAttribute('contenteditable','true');
  document.activeElement=target;
  assert.equal(key('/').prevented,false);
  assert.equal(document.activeElement,target);
}
document.activeElement=nodes.get('view-grid');
for(const modifier of ['ctrlKey','metaKey','altKey'])assert.equal(key('/',{[modifier]:true}).prevented,false);
nodes.get('.drawer-panel').scrollTop=500;
vm.runInContext("openDetail('gpqa')", context);
assert.equal(nodes.get('.drawer-panel').scrollTop,0,'Each detail opens at its start');
assert.match(nodes.get('drawer-content').innerHTML, /GPQA/);
assert.match(nodes.get('drawer-content').innerHTML, /company-fields/,'Details retain all company evidence roles');
assert.equal(nodes.get('detail-drawer').attributes['aria-hidden'], 'false');
assert.equal(document.activeElement,nodes.get('.drawer-close'));
assert.equal(key('/').prevented,false);
assert.equal(document.activeElement,nodes.get('.drawer-close'));
assert.equal(key('Tab',{shiftKey:true}).prevented,true);
assert.equal(document.activeElement,nodes.get('.drawer-last-link'));
assert.equal(key('Tab').prevented,true);
assert.equal(document.activeElement,nodes.get('.drawer-close'));
key('Escape');
assert.equal(nodes.get('detail-drawer').attributes['aria-hidden'], 'true');
assert.equal(document.activeElement,nodes.get('view-grid'));
const selectedFrontierIds=[...new Set(catalog.frontier.benchmarks.map(b=>b.benchmark_id).filter(id=>ids.has(id)))];
assert.equal(selectedFrontierIds.length,3,'The curated catalog includes three registered benchmark identities');
assert.ok(selectedFrontierIds.includes('terminal-bench-science-scientific-agent-benchmark'));
click({frontierCatalog:''});
assert.equal(nodes.get('result-count').textContent,'3');
assert.match(nodes.get('benchmark-list').innerHTML,/Terminal-Bench-Science/);
assert.match(nodes.get('active-filters').innerHTML,/长程科研精选/);
nodes.get('reset-filters').click();

// Independent fixtures exercise source safety, benchmark membership and score protocols.
const fixtureId=catalog.benchmarks[0].id;
const frontierFixture={
  schema_version:'1.0.0', reviewed_at:'2026-10-24', selection_note:'精选来源，不构成热度排名',
  resources:[
    {id:'trajectory-a',title:'Research <trajectory>',kind:'人工科研轨迹',badge:'长程科研',scale:{value:'599',unit:'条轨迹',detail:'含逐步执行记录'},summary:'跨日科研轨迹 & 产物',horizon:'数小时至数日',access:'开放元数据',license:'CC BY 4.0',published_at:'2026-10-20',sources:[{label:'官方数据',url:'https://example.org/data?x=1&y=2'},{label:'unsafe',url:'javascript:alert(1)'}]},
    {id:'unknown-scale',title:'Pending resource',sources:[{label:'Official',url:'https://example.org/pending'}]},
  ],
  benchmarks:[
    {id:'benchmark-a',benchmark_id:fixtureId,name:'Research benchmark',scale:'93',unit:'项任务',description:'长程执行与验证',horizon:'多轮工具交互',access:'开放',sources:[{label:'官方论文',url:'https://example.org/paper'}]},
    {id:'benchmark-b',benchmark_id:'not-in-catalog',name:'External benchmark',description:'外部评测',sources:[{label:'Official',url:'https://example.org/external'}]},
    {id:'benchmark-duplicate',benchmark_id:fixtureId,name:'Same benchmark subset',sources:[{label:'Official',url:'https://example.org/subset'}]},
  ],
  scoreboards:[
    {id:'protocol-a',name:'Protocol A',metric_note:'成功率与交互次数各自统计',protocol:'使用固定工具预算 A',score_date:'2026-10-20',source:{label:'官方结果 A',url:'https://example.org/scores-a'},columns:[{key:'success',label:'Success',unit:'%',decimals:2},{key:'turns',label:'交互轮数',unit:'轮',decimals:1}],rows:[{system:'Model Z',values:{success:12.345,turns:2.3}},{system:'Model A',values:{success:null,turns:Infinity}}]},
    {id:'protocol-b',name:'Protocol B',metric_note:'只报告完成率，不可跨协议比较',protocol:'使用独立预算 B',score_date:null,source:{label:'unsafe',url:'data:text/html,test'},columns:[{key:'completed',label:'Completed',unit:'%',decimals:1}],rows:[{system:'Model <B>',values:{completed:71.24}}]},
  ],
};
const frontierApp=await boot({...catalog,frontier:frontierFixture});
assert.deepEqual(frontierApp.errors,[], 'Frontier initialization failed');
assert.equal(frontierApp.nodes.get('frontier').hidden,false);
assert.equal(frontierApp.nodes.get('hero-frontier').hidden,false);
assert.match(frontierApp.nodes.get('hero-frontier').innerHTML,/599/);
assert.match(frontierApp.nodes.get('hero-frontier').innerHTML,/Research &lt;trajectory&gt;/);
assert.equal(frontierApp.nodes.get('frontier-benchmark-signal').textContent,'93','Missing featured benchmark falls back to the first benchmark');
assert.equal(frontierApp.nodes.get('frontier-score-signal').textContent,'12.35%','Fallback uses the first scoreboard column precision and unit');
assert.match(frontierApp.nodes.get('frontier-score-signal-label').textContent,/Protocol A · Success · Model Z/);
assert.doesNotMatch(frontierApp.nodes.get('frontier-score-signal-label').textContent,/Full/);
assert.match(frontierApp.nodes.get('frontier-reviewed').textContent,/2026-10-24/);
const resourcesMarkup=frontierApp.nodes.get('frontier-resources').innerHTML;
assert.match(resourcesMarkup,/条轨迹/);
assert.match(resourcesMarkup,/数小时至数日/);
assert.match(resourcesMarkup,/CC BY 4.0/);
assert.match(resourcesMarkup,/2026-10-20/);
assert.match(resourcesMarkup,/规模待核实/,'Missing resource counts stay unknown');
assert.match(resourcesMarkup,/许可证<\/dt><dd>待核实/,'Missing licenses stay unknown');
assert.match(resourcesMarkup,/https:\/\/example.org\/data\?x=1&amp;y=2/);
assert.doesNotMatch(resourcesMarkup,/javascript:|data:text\/html|Research <trajectory>/);
assert.match(resourcesMarkup,/target="_blank" rel="noreferrer"/);
assert.match(frontierApp.nodes.get('frontier-benchmarks').innerHTML,new RegExp(`data-detail="${fixtureId}"`));
assert.doesNotMatch(frontierApp.nodes.get('frontier-benchmarks').innerHTML,/data-detail="not-in-catalog"/);
assert.equal(frontierApp.scoreboardButtons().length,2);
assert.equal(frontierApp.scoreboardButtons()[0].getAttribute('aria-pressed'),'true');
assert.equal(frontierApp.scoreboardButtons()[1].getAttribute('aria-pressed'),'false');
assert.match(frontierApp.nodes.get('frontier-score-context').innerHTML,/固定工具预算 A/);
assert.match(frontierApp.nodes.get('frontier-score-context').innerHTML,/2026-10-20/);
const firstScores=frontierApp.nodes.get('frontier-scores').innerHTML;
assert.match(firstScores,/<caption>Protocol A/);
assert.match(firstScores,/12.35/);
assert.match(firstScores,/2.3/);
assert.match(firstScores,/aria-label="未报告"/);
assert.match(firstScores,/tabindex="0"/,'Score table remains keyboard scrollable');
assert.ok(firstScores.indexOf('Model Z')<firstScores.indexOf('Model A'),'Preserve official row order');
assert.doesNotMatch(firstScores,/Infinity|NaN|null/);
frontierApp.click({scoreboard:'protocol-b'});
assert.equal(frontierApp.scoreboardButtons()[0].getAttribute('aria-pressed'),'false');
assert.equal(frontierApp.scoreboardButtons()[1].getAttribute('aria-pressed'),'true');
assert.match(frontierApp.nodes.get('frontier-score-context').innerHTML,/只报告完成率/);
assert.match(frontierApp.nodes.get('frontier-score-context').innerHTML,/独立预算 B/);
assert.match(frontierApp.nodes.get('frontier-score-context').innerHTML,/原报告未披露成绩日期/);
assert.doesNotMatch(frontierApp.nodes.get('frontier-score-context').innerHTML,/data:text\/html/);
assert.match(frontierApp.nodes.get('frontier-scores').innerHTML,/71.2/);
assert.match(frontierApp.nodes.get('frontier-scores').innerHTML,/Model &lt;B&gt;/);
assert.doesNotMatch(frontierApp.nodes.get('frontier-scores').innerHTML,/Model Z|Success/,'Benchmark tables cannot blend results');
frontierApp.click({scoreboard:'not-a-board'});
assert.match(frontierApp.nodes.get('frontier-scores').innerHTML,/71.2/,'Unknown board is ignored');
frontierApp.nodes.get('search').value='irrelevant active filter';
frontierApp.nodes.get('domain-filter').value='Chemistry';
frontierApp.click({frontierCatalog:''});
assert.equal(frontierApp.nodes.get('search').value,'');
assert.equal(frontierApp.nodes.get('domain-filter').value,'');
assert.equal(frontierApp.nodes.get('result-count').textContent,'1','Topic uses existing, deduplicated catalog IDs');
assert.equal(frontierApp.nodes.get('result-label').textContent,'长程科研精选');
assert.match(frontierApp.nodes.get('benchmark-list').innerHTML,new RegExp(`data-detail="${fixtureId}"`));
assert.equal(frontierApp.nodes.get('results-scroll').scrolls.length,1);
assert.ok(frontierApp.frontierCatalogButtons.length,'Missing curated catalog button');
assert.equal(frontierApp.frontierCatalogButtons[0].disabled,false);

// Featured content must follow canonical configuration even when it is not first.
const featuredFixture=structuredClone(frontierFixture),featuredFixtureId=catalog.benchmarks[1].id;
featuredFixture.benchmarks.push({id:'configured-benchmark',benchmark_id:featuredFixtureId,name:'Configured benchmark',scale:'21',unit:'项研究',description:'由 canonical 配置的研究任务',sources:[{label:'Configured source',url:'https://example.org/configured'},{label:'Secondary source',url:'https://example.org/secondary'},{label:'More sources belong in cards',url:'https://example.org/card-only'}]});
featuredFixture.scoreboards[1].source={label:'Preferred scoreboard source',url:'https://example.org/configured'};
featuredFixture.featured={benchmark_id:featuredFixtureId,scoreboard_id:'protocol-b',metric_key:'completed'};
const configuredApp=await boot({...catalog,frontier:featuredFixture});
assert.deepEqual(configuredApp.errors,[]);
assert.match(configuredApp.nodes.get('hero-frontier').innerHTML,/Configured benchmark/);
assert.match(configuredApp.nodes.get('hero-frontier').innerHTML,/<strong>21<\/strong>/);
assert.match(configuredApp.nodes.get('hero-frontier').innerHTML,/71.2%/);
assert.doesNotMatch(configuredApp.nodes.get('hero-frontier').innerHTML,/Research &lt;trajectory&gt;|data:text\/html/);
assert.match(configuredApp.nodes.get('hero-frontier').innerHTML,/Preferred scoreboard source/);
assert.doesNotMatch(configuredApp.nodes.get('hero-frontier').innerHTML,/Configured source|More sources belong in cards/,'Score source label takes priority and the hero truncates benchmark links');
assert.match(configuredApp.nodes.get('frontier-benchmarks').innerHTML,/More sources belong in cards/,'Benchmark cards retain every source');
assert.equal([...configuredApp.nodes.get('hero-frontier').innerHTML.matchAll(/href="https:\/\/example.org\/configured"/g)].length,1);
assert.equal(configuredApp.nodes.get('frontier-benchmark-signal').textContent,'21');
assert.equal(configuredApp.nodes.get('frontier-score-signal').textContent,'71.2%');
assert.match(configuredApp.nodes.get('frontier-score-signal-label').textContent,/Protocol B · Completed · Model <B>/);
assert.equal(configuredApp.scoreboardButtons()[0].getAttribute('aria-pressed'),'false');
assert.equal(configuredApp.scoreboardButtons()[1].getAttribute('aria-pressed'),'true');
assert.match(configuredApp.nodes.get('frontier-score-context').innerHTML,/独立预算 B/);
configuredApp.click({scoreboard:'protocol-a'});
configuredApp.click({openScoreboard:'protocol-b'});
assert.match(configuredApp.nodes.get('frontier-score-context').innerHTML,/独立预算 B/,'Hero score link restores its own protocol');
const turnsApp=await boot({...catalog,frontier:{...featuredFixture,featured:{...featuredFixture.featured,scoreboard_id:'protocol-a',metric_key:'turns'}}});
assert.equal(turnsApp.nodes.get('frontier-score-signal').textContent,'2.3 轮','Featured units are derived from the configured column');
assert.match(turnsApp.nodes.get('frontier-score-signal-label').textContent,/交互轮数/);
const unknownScoreFixture=structuredClone(featuredFixture);
unknownScoreFixture.scoreboards[1].rows[0].values.completed=null;
const unknownScoreApp=await boot({...catalog,frontier:unknownScoreFixture});
assert.equal(unknownScoreApp.nodes.get('frontier-score-signal').textContent,'—');
assert.match(unknownScoreApp.nodes.get('hero-frontier').innerHTML,/<strong>—<\/strong>/);
const missingFeatureApp=await boot({...catalog,frontier:{...frontierFixture,featured:{benchmark_id:'absent',scoreboard_id:'absent',metric_key:'absent'}}});
assert.deepEqual(missingFeatureApp.errors,[]);
assert.match(missingFeatureApp.nodes.get('hero-frontier').innerHTML,/Research &lt;trajectory&gt;/);
assert.equal(missingFeatureApp.nodes.get('frontier-benchmark-signal').textContent,'93');
assert.equal(missingFeatureApp.nodes.get('frontier-score-signal').textContent,'12.35%');
assert.match(missingFeatureApp.nodes.get('frontier-score-context').innerHTML,/固定工具预算 A/);
for(const frontier of [undefined,{}, {resources:'invalid',benchmarks:null,scoreboards:[null,{}]}]){
  const fallback=await boot({...catalog,frontier});
  assert.deepEqual(fallback.errors,[],'Missing frontier cannot block the catalog');
  assert.equal(fallback.nodes.get('frontier').hidden,true);
  assert.equal(fallback.nodes.get('hero-frontier').hidden,true);
  assert.equal(fallback.frontierCatalogButtons[0].disabled,true);
  assert.match(fallback.nodes.get('benchmark-list').innerHTML,/benchmark-card/);
  assert.equal(fallback.nodes.get('result-count').textContent,catalog.benchmark_count.toLocaleString('en-US'));
  fallback.click({frontierCatalog:''});
  assert.equal(fallback.nodes.get('result-count').textContent,catalog.benchmark_count.toLocaleString('en-US'));
}
const invalid = await boot({ benchmarks: [{ id: 'raw-registry' }] });
assert.equal(invalid.nodes.get('sync-status').textContent, '目录加载失败');
console.log(`[OK] ${catalog.benchmark_count} benchmarks; contract, assets, search, filters, chips, views, mobile filters, pagination, shortcuts, details, frontier resources, isolated score protocols, safe sources, curated selection, fallback, error state`);
