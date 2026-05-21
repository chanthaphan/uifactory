import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Snackbar } from '@mui/material';

export interface PreviewBridge {
  runAction?: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  runQuery?: (queryId: string, params: Record<string, unknown>) => Promise<unknown>;
  refresh?: () => Promise<unknown> | void;
  navigate?: (slug: string) => void;
}

interface Props {
  html: string;
  data: unknown;
  height?: number | string;
  bridge?: PreviewBridge;
}

function serializeData(data: unknown): string {
  return JSON.stringify(data ?? null).replace(/</g, '\\u003c');
}

// Injected into the iframe: window.UIFactory talks to the host via postMessage.
const BRIDGE_SCRIPT = `<script>
(function(){
  var pending = {}, seq = 0, dataCbs = [];
  function call(method, args){
    return new Promise(function(resolve, reject){
      var reqId = 'r' + (++seq);
      pending[reqId] = { resolve: resolve, reject: reject };
      parent.postMessage({ source: 'uifactory-app', reqId: reqId, method: method, args: args || [] }, '*');
    });
  }
  window.addEventListener('message', function(e){
    var m = e.data || {};
    if (m.source !== 'uifactory-host') return;
    if (m.type === 'data') { window.APP_DATA = m.data; dataCbs.forEach(function(cb){ try { cb(m.data); } catch (_) {} }); return; }
    var p = pending[m.reqId];
    if (!p) return;
    delete pending[m.reqId];
    if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || 'Request failed'));
  });
  function toCsv(rows){
    if (!rows || !rows.length) return '';
    var cols = Object.keys(rows[0]);
    var esc = function(v){ v = (v==null?'':String(v)); return /[",\\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
    return cols.join(',') + '\\n' + rows.map(function(r){ return cols.map(function(c){ return esc(r[c]); }).join(','); }).join('\\n');
  }
  window.UIFactory = {
    // data + navigation
    runAction: function(name, params){ return call('runAction', [name, params || {}]); },
    runQuery: function(queryId, params){ return call('runQuery', [queryId, params || {}]); },
    refresh: function(){ return call('refresh', []); },
    navigate: function(slug){ parent.postMessage({ source: 'uifactory-app', method: 'navigate', args: [slug] }, '*'); },
    onData: function(cb){ dataCbs.push(cb); try { cb(window.APP_DATA); } catch (_) {} },
    // framework helpers (Appsmith-style)
    showAlert: function(message, type){ return call('showAlert', [String(message), type || 'info']); },
    confirm: function(message){ return call('confirm', [String(message)]); },
    download: function(filename, content, mime){ return call('download', [filename || 'download', String(content), mime || 'text/plain']); },
    downloadCSV: function(filename, rows){ return call('download', [filename || 'export.csv', toCsv(rows), 'text/csv']); },
    copyToClipboard: function(text){ return call('copyToClipboard', [String(text)]); },
    storeValue: function(key, value){ return call('storeValue', [key, value]); },
    getValue: function(key){ return call('getValue', [key]); },
    // read a user-selected file (input element or File); resolves to { name, type, size, dataUrl, text }
    readFile: function(fileOrInput){
      var file = fileOrInput;
      if (fileOrInput && fileOrInput.files) file = fileOrInput.files[0];
      return new Promise(function(resolve, reject){
        if (!file){ reject(new Error('No file selected')); return; }
        var meta = { name: file.name, type: file.type, size: file.size, dataUrl: null, text: null };
        var isText = /^text\\/|json|csv|xml|javascript|svg/.test(file.type) || /\\.(txt|csv|json|md|xml|svg|html?)$/i.test(file.name||'');
        var rdr = new FileReader();
        rdr.onerror = function(){ reject(new Error('Could not read file')); };
        rdr.onload = function(){
          meta.dataUrl = rdr.result;
          if (isText){ var tr = new FileReader(); tr.onload = function(){ meta.text = tr.result; resolve(meta); }; tr.onerror = function(){ resolve(meta); }; tr.readAsText(file); }
          else resolve(meta);
        };
        rdr.readAsDataURL(file);
      });
    }
  };
})();
</script>`;

function buildSrcDoc(html: string, data: unknown): string {
  const head = `<script>window.APP_DATA = ${serializeData(data)};</script>\n${BRIDGE_SCRIPT}`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${head}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}\n${head}`);
  return `${head}\n${html}`;
}

export default function PreviewFrame({ html, data, height = '100%', bridge }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const srcDoc = useMemo(() => buildSrcDoc(html, data), [html, data]);
  const [snack, setSnack] = useState<{ msg: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const frame = ref.current;
      if (!frame || e.source !== frame.contentWindow) return;
      const m = e.data || {};
      if (m.source !== 'uifactory-app') return;
      const b = bridgeRef.current || {};
      if (m.method === 'navigate') {
        b.navigate?.(m.args?.[0]);
        return;
      }
      const reply = (ok: boolean, result?: unknown, error?: string) =>
        frame.contentWindow?.postMessage({ source: 'uifactory-host', reqId: m.reqId, ok, result, error }, '*');
      (async () => {
        try {
          const a = m.args || [];
          let result: unknown;
          switch (m.method) {
            case 'runAction':
              result = await b.runAction?.(a[0], a[1]);
              break;
            case 'runQuery':
              result = await b.runQuery?.(a[0], a[1]);
              break;
            case 'refresh':
              result = await b.refresh?.();
              break;
            case 'showAlert': {
              const t = ['success', 'info', 'warning', 'error'].includes(a[1]) ? a[1] : 'info';
              setSnack({ msg: a[0], type: t });
              break;
            }
            case 'confirm':
              result = window.confirm(a[0]);
              break;
            case 'download': {
              const blob = new Blob([a[1]], { type: a[2] || 'text/plain' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = a[0] || 'download';
              document.body.appendChild(link);
              link.click();
              link.remove();
              URL.revokeObjectURL(url);
              break;
            }
            case 'copyToClipboard':
              await navigator.clipboard?.writeText(a[0]).catch(() => undefined);
              break;
            case 'storeValue':
              try {
                sessionStorage.setItem('uif:' + a[0], JSON.stringify(a[1]));
              } catch {
                /* ignore quota/availability */
              }
              break;
            case 'getValue':
              try {
                const raw = sessionStorage.getItem('uif:' + a[0]);
                result = raw == null ? null : JSON.parse(raw);
              } catch {
                result = null;
              }
              break;
            default:
              break;
          }
          reply(true, result);
        } catch (err) {
          reply(false, undefined, (err as Error).message);
        }
      })();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      <Box
        component="iframe"
        ref={ref}
        title="App preview"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-popups allow-forms allow-modals"
        sx={{ width: '100%', height, border: 'none', borderRadius: 1, backgroundColor: '#fff', display: 'block' }}
      />
      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.type} variant="filled" onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
