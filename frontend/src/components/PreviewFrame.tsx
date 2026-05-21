import { useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';

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

// Injected into the iframe: exposes window.UIFactory, which talks to the host via postMessage.
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
    if (m.type === 'data') {
      window.APP_DATA = m.data;
      dataCbs.forEach(function(cb){ try { cb(m.data); } catch (_) {} });
      return;
    }
    var p = pending[m.reqId];
    if (!p) return;
    delete pending[m.reqId];
    if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || 'Request failed'));
  });
  window.UIFactory = {
    runAction: function(name, params){ return call('runAction', [name, params || {}]); },
    runQuery: function(queryId, params){ return call('runQuery', [queryId, params || {}]); },
    refresh: function(){ return call('refresh', []); },
    navigate: function(slug){ parent.postMessage({ source: 'uifactory-app', method: 'navigate', args: [slug] }, '*'); },
    onData: function(cb){ dataCbs.push(cb); try { cb(window.APP_DATA); } catch (_) {} }
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
          let result: unknown;
          if (m.method === 'runAction') result = await b.runAction?.(m.args[0], m.args[1]);
          else if (m.method === 'runQuery') result = await b.runQuery?.(m.args[0], m.args[1]);
          else if (m.method === 'refresh') result = await b.refresh?.();
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
    <Box
      component="iframe"
      ref={ref}
      title="App preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-forms"
      sx={{ width: '100%', height, border: 'none', borderRadius: 1, backgroundColor: '#fff', display: 'block' }}
    />
  );
}
