import { CanvasLayout, ComponentType, UiComponent } from '../api/client';

export interface CompileOptions {
  title?: string;
  brandColor?: string;
}

/** Catalog of component types the builder offers, with defaults and a short description. */
export const COMPONENT_CATALOG: {
  type: ComponentType;
  label: string;
  hint: string;
  defaults: Record<string, unknown>;
  container?: boolean;
}[] = [
  { type: 'heading', label: 'Heading', hint: 'A section title', defaults: { text: 'Heading', level: 2 } },
  { type: 'text', label: 'Text', hint: 'A paragraph of text', defaults: { text: 'Some descriptive text.' } },
  { type: 'metric', label: 'Metric / KPI', hint: 'A single number from the data', defaults: { label: 'Total rows', source: 'count', field: '' } },
  { type: 'table', label: 'Table', hint: 'Tabular view of array data', defaults: { filter: true, columns: [] } },
  { type: 'chart', label: 'Chart', hint: 'Bar / line / pie from data', defaults: { chartType: 'bar', labelField: '', valueField: '', title: '' } },
  { type: 'textInput', label: 'Text input', hint: 'Capture a value into the form', defaults: { label: 'Field', key: 'field', placeholder: '' } },
  { type: 'fileUpload', label: 'File upload', hint: 'Browse a file and submit it to an API', defaults: { label: 'Upload file', key: 'file', accept: '' } },
  { type: 'button', label: 'Button', hint: 'Run an action (with the form values)', defaults: { label: 'Submit', action: '', paramsJson: '', successMsg: 'Done' } },
  { type: 'image', label: 'Image', hint: 'A static image', defaults: { src: '', alt: '', width: 240 } },
  { type: 'divider', label: 'Divider', hint: 'A horizontal rule', defaults: {} },
  { type: 'container', label: 'Columns', hint: 'A row that holds other components', defaults: { columns: 2, title: '' }, container: true },
];

export const newComponent = (type: ComponentType): UiComponent => {
  const def = COMPONENT_CATALOG.find((c) => c.type === type);
  const comp: UiComponent = {
    id: `c-${Math.random().toString(16).slice(2, 9)}`,
    type,
    props: { ...(def?.defaults || {}) },
  };
  if (def?.container) comp.children = [];
  return comp;
};

// ---- runtime injected into the generated page (kept dependency-free, runs in the sandboxed iframe) ----
const RUNTIME = `
var FORM = {};
var CHARTS = [];
function uifEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
function uifArray(data){
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object'){
    for (var k in data){ if (Array.isArray(data[k])) return data[k]; }
    return [data];
  }
  return [];
}
function uifNum(v){ var n = Number(v); return isNaN(n) ? 0 : n; }
function uifFmt(n){ return (Math.round(n*100)/100).toLocaleString(); }
function el(tag, cls){ var e = document.createElement(tag); if (cls) e.className = cls; return e; }

function renderComp(c, data){
  var p = c.props || {};
  switch(c.type){
    case 'heading': { var h = el('h'+(p.level||2), 'uif-h'); h.textContent = p.text||'Heading'; return h; }
    case 'text': { var t = el('p','uif-text'); t.textContent = p.text||''; return t; }
    case 'divider': return el('hr','uif-hr');
    case 'image': { var im = el('img','uif-img'); im.src = p.src||''; im.alt = p.alt||''; if(p.width) im.style.maxWidth = uifNum(p.width)+'px'; return im; }
    case 'metric': return renderMetric(p, data);
    case 'table': return renderTable(p, data);
    case 'chart': return renderChart(p, data);
    case 'textInput': return renderInput(p);
    case 'fileUpload': return renderFile(p);
    case 'button': return renderButton(p);
    case 'container': return renderContainer(c, data);
    default: { var d = el('div'); d.textContent = '['+c.type+']'; return d; }
  }
}
function renderContainer(c, data){
  var wrap = el('div');
  if (c.props && c.props.title){ var ti = el('div','uif-grouptitle'); ti.textContent = c.props.title; wrap.appendChild(ti); }
  var grid = el('div','uif-row');
  var cols = Math.max(1, Math.min(6, uifNum((c.props&&c.props.columns)||2)));
  grid.style.gridTemplateColumns = 'repeat('+cols+', minmax(0,1fr))';
  (c.children||[]).forEach(function(ch){ grid.appendChild(renderComp(ch, data)); });
  wrap.appendChild(grid);
  return wrap;
}
function renderMetric(p, data){
  var arr = uifArray(data); var val;
  if (p.source === 'static') val = p.value;
  else if (p.source === 'count') val = arr.length;
  else if (p.source === 'sum') val = uifFmt(arr.reduce(function(a,r){ return a + uifNum(r[p.field]); },0));
  else if (p.source === 'avg') val = arr.length ? uifFmt(arr.reduce(function(a,r){ return a + uifNum(r[p.field]); },0)/arr.length) : 0;
  else val = arr.length ? (arr[0][p.field]) : (data && typeof data==='object' ? data[p.field] : '');
  var card = el('div','uif-card uif-metric');
  var lab = el('div','uif-metric-label'); lab.textContent = p.label||'';
  var num = el('div','uif-metric-value'); num.textContent = (val==null?'—':val);
  card.appendChild(num); card.appendChild(lab); return card;
}
function renderTable(p, data){
  var arr = uifArray(data);
  var card = el('div','uif-card');
  if (!arr.length){ var empty = el('div','uif-empty'); empty.textContent = 'No data'; card.appendChild(empty); return card; }
  var cols = (p.columns && p.columns.length) ? p.columns : Object.keys(arr[0]);
  var filterText = '';
  var tableWrap = el('div','uif-tablewrap');
  function draw(){
    tableWrap.innerHTML = '';
    var rows = arr.filter(function(r){ if(!filterText) return true; return cols.some(function(col){ return String(r[col]==null?'':r[col]).toLowerCase().indexOf(filterText)>=0; }); });
    var tbl = el('table','uif-table');
    var thead = el('thead'); var htr = el('tr');
    cols.forEach(function(col){ var th = el('th'); th.textContent = col; htr.appendChild(th); });
    thead.appendChild(htr); tbl.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function(r){ var tr = el('tr'); cols.forEach(function(col){ var td = el('td'); td.textContent = (r[col]==null?'':String(r[col])); tr.appendChild(td); }); tb.appendChild(tr); });
    tbl.appendChild(tb); tableWrap.appendChild(tbl);
  }
  if (p.filter){ var f = el('input','uif-input'); f.placeholder = 'Filter…'; f.oninput = function(){ filterText = f.value.toLowerCase(); draw(); }; card.appendChild(f); }
  draw(); card.appendChild(tableWrap); return card;
}
function renderChart(p, data){
  var arr = uifArray(data);
  var card = el('div','uif-card');
  if (p.title){ var ti = el('div','uif-grouptitle'); ti.textContent = p.title; card.appendChild(ti); }
  var canvas = el('canvas'); canvas.style.maxHeight = '320px'; card.appendChild(canvas);
  var labels = arr.map(function(r){ return r[p.labelField]; });
  var values = arr.map(function(r){ return uifNum(r[p.valueField]); });
  var palette = ['#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d'];
  CHARTS.push(function(){
    if (!window.Chart) return;
    try {
      CHARTS._instances = CHARTS._instances || [];
      CHARTS._instances.push(new window.Chart(canvas, {
        type: p.chartType || 'bar',
        data: { labels: labels, datasets: [{ label: p.valueField||'value', data: values, backgroundColor: (p.chartType==='line'?'#2563eb':palette), borderColor: '#2563eb', fill: p.chartType!=='line' }] },
        options: { responsive: true, plugins: { legend: { display: p.chartType==='pie' } } }
      }));
    } catch(e){}
  });
  return card;
}
function renderInput(p){
  var wrap = el('div','uif-field');
  if (p.label){ var lab = el('label','uif-label'); lab.textContent = p.label; wrap.appendChild(lab); }
  var input = el('input','uif-input'); input.placeholder = p.placeholder||''; var key = p.key||'field';
  if (FORM[key] != null) input.value = FORM[key];
  input.oninput = function(){ FORM[key] = input.value; };
  wrap.appendChild(input); return wrap;
}
function renderFile(p){
  var wrap = el('div','uif-field'); var key = p.key||'file';
  if (p.label){ var lab = el('label','uif-label'); lab.textContent = p.label; wrap.appendChild(lab); }
  var input = el('input','uif-input'); input.type = 'file'; if (p.accept) input.accept = p.accept;
  var status = el('div','uif-filestatus'); if (FORM[key] && FORM[key].name) status.textContent = 'Loaded: '+FORM[key].name;
  input.onchange = function(){
    var f = input.files && input.files[0]; if (!f) return;
    var done = function(res){ FORM[key] = res; status.textContent = 'Loaded: '+res.name+' ('+res.size+' bytes)'; };
    if (window.UIFactory && UIFactory.readFile){ UIFactory.readFile(f).then(done); }
    else { var rdr = new FileReader(); rdr.onload = function(){ done({ name: f.name, type: f.type, size: f.size, dataUrl: rdr.result, text: null }); }; rdr.readAsDataURL(f); }
  };
  wrap.appendChild(input); wrap.appendChild(status); return wrap;
}
function renderButton(p){
  var btn = el('button','uif-btn'); btn.textContent = p.label||'Submit';
  btn.onclick = function(){
    var params = Object.assign({}, FORM);
    if (p.paramsJson){ try { Object.assign(params, JSON.parse(p.paramsJson)); } catch(e){} }
    if (!p.action){ if (window.UIFactory && UIFactory.showAlert) UIFactory.showAlert('No action configured for this button','warning'); return; }
    btn.disabled = true;
    Promise.resolve(UIFactory.runAction(p.action, params))
      .then(function(){ return UIFactory.refresh ? UIFactory.refresh() : null; })
      .then(function(){ if (UIFactory.showAlert) UIFactory.showAlert(p.successMsg||'Done','success'); })
      .catch(function(e){ if (UIFactory.showAlert) UIFactory.showAlert(String((e&&e.message)||e),'error'); })
      .then(function(){ btn.disabled = false; });
  };
  return btn;
}
function renderLayout(data){
  var root = document.getElementById('uif-root'); if (!root) return;
  if (CHARTS._instances){ CHARTS._instances.forEach(function(ch){ try { ch.destroy(); } catch(e){} }); }
  CHARTS = []; CHARTS._instances = [];
  root.innerHTML = '';
  (window.__UIF_LAYOUT.components||[]).forEach(function(c){ root.appendChild(renderComp(c, data)); });
  CHARTS.forEach(function(fn){ fn(); });
}
(function(){
  function boot(){
    if (window.UIFactory && UIFactory.onData) UIFactory.onData(renderLayout);
    else renderLayout(window.APP_DATA);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
`;

const STYLE = (brand: string) => `
:root{ --brand:${brand}; }
*{ box-sizing:border-box; }
body{ margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1f2937; background:#f7f8fa; }
#uif-root{ max-width:1080px; margin:0 auto; padding:24px; display:flex; flex-direction:column; gap:16px; }
.uif-h{ margin:0; color:#0f172a; }
.uif-text{ margin:0; color:#374151; line-height:1.5; }
.uif-hr{ border:none; border-top:1px solid #e5e7eb; margin:4px 0; }
.uif-img{ display:block; border-radius:8px; }
.uif-row{ display:grid; gap:16px; }
.uif-grouptitle{ font-weight:700; color:#0f172a; margin-bottom:8px; }
.uif-card{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; }
.uif-metric{ text-align:left; }
.uif-metric-value{ font-size:30px; font-weight:800; color:var(--brand); }
.uif-metric-label{ color:#6b7280; font-size:13px; margin-top:2px; }
.uif-empty{ color:#9ca3af; text-align:center; padding:24px 0; }
.uif-tablewrap{ overflow:auto; }
.uif-table{ width:100%; border-collapse:collapse; font-size:14px; }
.uif-table th{ text-align:left; padding:8px 10px; border-bottom:2px solid #e5e7eb; color:#6b7280; font-weight:600; position:sticky; top:0; background:#fff; }
.uif-table td{ padding:8px 10px; border-bottom:1px solid #f1f5f9; }
.uif-table tbody tr:nth-child(even){ background:#fafafa; }
.uif-field{ display:flex; flex-direction:column; gap:6px; }
.uif-label{ font-size:13px; font-weight:600; color:#374151; }
.uif-input{ width:100%; padding:9px 11px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; }
.uif-input:focus{ outline:none; border-color:var(--brand); }
.uif-filestatus{ font-size:12px; color:#6b7280; }
.uif-btn{ align-self:flex-start; background:var(--brand); color:#fff; border:none; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; }
.uif-btn:disabled{ opacity:.6; cursor:default; }
`;

const layoutHasChart = (comps: UiComponent[]): boolean =>
  comps.some((c) => c.type === 'chart' || (c.children ? layoutHasChart(c.children) : false));

/** Compile a drag-and-drop layout into a self-contained HTML document for the runtime. */
export function compileLayout(layout: CanvasLayout, opts: CompileOptions = {}): string {
  const brand = opts.brandColor || '#2563eb';
  const components = layout?.components || [];
  const chartCdn = layoutHasChart(components)
    ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
    : '';
  const serialized = JSON.stringify({ components }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${(opts.title || 'App').replace(/</g, '&lt;')}</title>
<style>${STYLE(brand)}</style>
${chartCdn}
</head>
<body>
<div id="uif-root"></div>
<script>window.__UIF_LAYOUT = ${serialized};</script>
<script>${RUNTIME}</script>
</body>
</html>`;
}
