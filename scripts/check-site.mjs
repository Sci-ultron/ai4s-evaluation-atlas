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
assert.equal(catalog.suite_count, catalog.suites.length);
assert.equal(catalog.organization_count, Object.keys(catalog.organizations).length);
assert.equal(catalog.relationship_count, catalog.benchmarks.reduce((n, b) => n + b.organizations.length, 0));
const ids = new Set(catalog.benchmarks.map(b => b.id));
assert.equal(ids.size, catalog.benchmark_count);
for (const b of catalog.benchmarks) {
  for (const field of ['task_types', 'modalities', 'metrics', 'organizations']) assert.ok(Array.isArray(b[field]), `${b.id}: ${field}`);
  for (const field of ['capability_axes', 'workflow_stages', 'evaluation_modes']) assert.ok(Array.isArray(b.classification[field]), `${b.id}: ${field}`);
  assert.ok(b.paper && b.official && b.integration);
  assert.ok(!('local_path' in b.integration), 'Private checkout paths must not be exported');
}
for (const suite of catalog.suites) for (const id of suite.benchmarks) assert.ok(ids.has(id), `Unknown suite member ${id}`);
for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(https?:|#|data:)/.test(ref)) continue;
  assert.ok(!ref.startsWith('/'), `Project Pages needs relative asset paths: ${ref}`);
  assert.ok(existsSync(new URL(ref.split('?')[0], root)), `Missing asset: ${ref}`);
}

// A minimal DOM records effects of the actual frontend without fetching external data.
function element() {
  const classes = new Set();
  return { value: '', textContent: '', innerHTML: '', disabled: false,
    style: {}, attributes: {}, children: [], listeners: {},
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    append(child) { this.children.push(child); },
    setAttribute(k, v) { this.attributes[k] = v; },
    focus() {}, scrollIntoView() {}, click() {},
  };
}
async function boot(payload) {
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, element()]));
  for (const id of ['.drawer-panel', '.drawer-close']) nodes.set(id, element());
  const errors = [];
  const context = vm.createContext({
    URL, console: { error: e => errors.push(e) },
    fetch: async url => { assert.equal(url, 'catalog.json'); return { ok: true, json: async () => structuredClone(payload) }; },
    document: { body: { style: {} }, activeElement: element(),
      getElementById: id => { assert.ok(nodes.has(id), `Missing DOM id ${id}`); return nodes.get(id); },
      createElement: element, querySelector: selector => nodes.get(selector),
      querySelectorAll: () => [], addEventListener() {},
    },
  });
  vm.runInContext(source, context, { filename: fileURLToPath(new URL('app.js', root)) });
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, context, errors };
}
const { nodes, context, errors } = await boot(catalog);
assert.deepEqual(errors, [], 'Frontend initialization failed');
assert.match(nodes.get('sync-status').textContent, /^更新 /);
assert.equal(nodes.get('hero-count').textContent, catalog.benchmark_count.toLocaleString('en-US'));
assert.equal(nodes.get('hero-suites').textContent, catalog.suite_count);
assert.match(nodes.get('benchmark-list').innerHTML, /benchmark-card/);
assert.match(nodes.get('suite-list').innerHTML, /core-science-v1/);
nodes.get('search').value = 'gpqa';
vm.runInContext('applyFilters()', context);
assert.match(nodes.get('benchmark-list').innerHTML, /GPQA/i);
nodes.get('search').value = 'no-such-benchmark-unique-needle';
vm.runInContext('applyFilters()', context);
assert.equal(nodes.get('result-count').textContent, '0');
vm.runInContext('reset()', context);
nodes.get('domain-filter').value = 'Chemistry';
vm.runInContext('applyFilters()', context);
assert.equal(nodes.get('result-count').textContent, catalog.facets.domain.Chemistry.toLocaleString('en-US'));
vm.runInContext("openDetail('gpqa')", context);
assert.match(nodes.get('drawer-content').innerHTML, /GPQA/);
assert.equal(nodes.get('detail-drawer').attributes['aria-hidden'], 'false');
vm.runInContext('closeDetail()', context);
assert.equal(nodes.get('detail-drawer').attributes['aria-hidden'], 'true');
const invalid = await boot({ benchmarks: [{ id: 'raw-registry' }] });
assert.equal(invalid.nodes.get('sync-status').textContent, '目录加载失败');
console.log(`[OK] ${catalog.benchmark_count} benchmarks; contract, assets, initialization, search, filters, details, error state`);
