import { useMemo } from 'react';
import { Box } from '@mui/material';

interface Props {
  html: string;
  data: unknown;
  height?: number | string;
}

/**
 * Serialize data for embedding inside a <script> tag. Escaping every `<` as `<`
 * is enough to guarantee the JSON can never produce a `</script>` sequence and break out.
 */
function serializeData(data: unknown): string {
  return JSON.stringify(data ?? null).replace(/</g, '\\u003c');
}

/** Inject `window.APP_DATA` into the generated document before its own scripts run. */
function buildSrcDoc(html: string, data: unknown): string {
  const dataScript = `<script>window.APP_DATA = ${serializeData(data)};</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${dataScript}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n${dataScript}`);
  }
  return `${dataScript}\n${html}`;
}

/**
 * Renders generated HTML inside a sandboxed iframe. The iframe runs scripts but has an
 * opaque origin (no allow-same-origin), so generated code cannot access the parent app.
 */
export default function PreviewFrame({ html, data, height = '100%' }: Props) {
  const srcDoc = useMemo(() => buildSrcDoc(html, data), [html, data]);

  return (
    <Box
      component="iframe"
      title="App preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups"
      sx={{
        width: '100%',
        height,
        border: 'none',
        borderRadius: 1,
        backgroundColor: '#fff',
        display: 'block',
      }}
    />
  );
}
