/**
 * Builds a self-contained HTML document that renders window.APP_DATA as a table or
 * detail view. Used when Claude is not configured or a generation call fails, so the
 * "Generate UI" feature still works end-to-end without an API key.
 */
export function buildFallbackHtml(prompt: string, _sample: string, queryName?: string): string {
  const title = escapeHtml(queryName || 'Generated App');
  const subtitle = escapeHtml(prompt || 'Auto-generated from your data');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --border:#e3e6ea; --text:#1c2530; --muted:#6b7785; --accent:#3a64f0; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--text); }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
  header h1 { margin:0 0 4px; font-size: 22px; }
  header p { margin:0 0 18px; color:var(--muted); font-size: 14px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
  .toolbar { display:flex; gap:12px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
  .toolbar input { flex:1; min-width:200px; padding:9px 12px; border:1px solid var(--border); border-radius:8px; font-size:14px; }
  .pill { background:#eef2ff; color:var(--accent); border-radius:999px; padding:4px 10px; font-size:12px; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:top; }
  th { position:sticky; top:0; background:#fbfbfc; cursor:pointer; user-select:none; white-space:nowrap; }
  tbody tr:nth-child(even) { background:#fafbfc; }
  .scroll { overflow:auto; max-height:70vh; border-radius:8px; }
  .empty { padding:40px; text-align:center; color:var(--muted); }
  .kv { display:grid; grid-template-columns: 200px 1fr; gap:8px 16px; font-size:14px; }
  .kv dt { color:var(--muted); }
  .kv dd { margin:0; word-break:break-word; }
  code { background:#f1f3f5; padding:2px 6px; border-radius:6px; font-size:12px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${title}</h1>
    <p>${subtitle}</p>
  </header>
  <div class="card" id="root"><div class="empty">Loading…</div></div>
</div>
<script>
(function () {
  var root = document.getElementById('root');
  var data = window.APP_DATA;

  // REST responses often wrap the array in a property; find the first array.
  function findRows(d) {
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object') {
      for (var k of ['value','data','results','items','rows','records']) {
        if (Array.isArray(d[k])) return d[k];
      }
      for (var key in d) { if (Array.isArray(d[key])) return d[key]; }
    }
    return null;
  }

  function fmt(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return '<code>' + esc(JSON.stringify(v)) + '</code>';
    return esc(String(v));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  if (data === undefined || data === null) {
    root.innerHTML = '<div class="empty">No data. Run a query and bind it to this view.</div>';
    return;
  }

  var rows = findRows(data);

  if (rows && rows.length && typeof rows[0] === 'object') {
    var cols = Object.keys(rows[0]);
    var sortState = { col: null, dir: 1 };

    function render(list) {
      var thead = '<tr>' + cols.map(function (c) { return '<th data-c="' + esc(c) + '">' + esc(c) + '</th>'; }).join('') + '</tr>';
      var body = list.map(function (r) {
        return '<tr>' + cols.map(function (c) { return '<td>' + fmt(r[c]) + '</td>'; }).join('') + '</tr>';
      }).join('');
      root.innerHTML =
        '<div class="toolbar"><input id="q" placeholder="Filter…" /><span class="pill">' + list.length + ' rows</span></div>' +
        '<div class="scroll"><table><thead>' + thead + '</thead><tbody>' + body + '</tbody></table></div>';
      wire(list);
    }

    function wire(list) {
      var q = document.getElementById('q');
      q.addEventListener('input', function () {
        var term = q.value.toLowerCase();
        var filtered = !term ? rows : rows.filter(function (r) {
          return cols.some(function (c) { return String(r[c] == null ? '' : r[c]).toLowerCase().indexOf(term) > -1; });
        });
        renderBody(filtered);
        document.querySelector('.pill').textContent = filtered.length + ' rows';
      });
      Array.prototype.forEach.call(document.querySelectorAll('th'), function (th) {
        th.addEventListener('click', function () {
          var c = th.getAttribute('data-c');
          sortState.dir = sortState.col === c ? -sortState.dir : 1;
          sortState.col = c;
          var sorted = rows.slice().sort(function (a, b) {
            var av = a[c], bv = b[c];
            if (av == null) return 1; if (bv == null) return -1;
            return (av > bv ? 1 : av < bv ? -1 : 0) * sortState.dir;
          });
          renderBody(sorted);
        });
      });
    }

    function renderBody(list) {
      var tbody = document.querySelector('tbody');
      tbody.innerHTML = list.map(function (r) {
        return '<tr>' + cols.map(function (c) { return '<td>' + fmt(r[c]) + '</td>'; }).join('') + '</tr>';
      }).join('');
    }

    render(rows);
  } else if (typeof data === 'object') {
    var entries = Object.keys(data);
    root.innerHTML = '<dl class="kv">' + entries.map(function (k) {
      return '<dt>' + esc(k) + '</dt><dd>' + fmt(data[k]) + '</dd>';
    }).join('') + '</dl>';
  } else {
    root.innerHTML = '<pre>' + esc(String(data)) + '</pre>';
  }
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
