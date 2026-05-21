import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ChatMessage } from '../api/client';

/** Render assistant replies as GitHub-flavoured markdown (raw HTML is not rendered — safe by default). */
function MarkdownMessage({ text }: { text: string }) {
  return (
    <Box
      sx={{
        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
        '& > :first-of-type': { mt: 0 }, '& > :last-child': { mb: 0 },
        '& p': { my: 0.75 },
        '& ul, & ol': { my: 0.75, pl: 2.5 },
        '& li': { mb: 0.25 },
        '& h1, & h2, & h3, & h4': { my: 1, fontWeight: 700, fontSize: 15 },
        '& a': { color: 'primary.main' },
        '& code': { bgcolor: 'rgba(0,0,0,0.06)', px: 0.5, py: 0.1, borderRadius: 0.5, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 },
        '& pre': { bgcolor: '#0f172a', color: '#e2e8f0', p: 1.25, borderRadius: 1, overflow: 'auto', my: 0.75 },
        '& pre code': { bgcolor: 'transparent', color: 'inherit', p: 0 },
        '& table': { borderCollapse: 'collapse', my: 0.75, width: '100%' },
        '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1, py: 0.5, textAlign: 'left' },
        '& blockquote': { borderLeft: '3px solid', borderColor: 'divider', pl: 1.5, my: 0.75, color: 'text.secondary' },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
      >
        {text}
      </ReactMarkdown>
    </Box>
  );
}

interface Props {
  appId: string;
  pageId?: string;
  greeting?: string;
}

function makeConversationId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `conv-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

export default function ChatView({ appId, pageId, greeting }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState(makeConversationId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(greeting ? [{ role: 'assistant', content: greeting }] : []);
    // Start a fresh conversation when the page/app changes so external conversation APIs get a new thread.
    setConversationId(makeConversationId());
  }, [greeting, appId, pageId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await api.chat(appId, { pageId, conversationId, messages: next.filter((m) => m.role !== 'system') });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Error: ${api.errMessage(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f7f8fa' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={1.5}>
          {messages.map((m, i) => (
            <Stack key={i} direction="row" justifyContent={m.role === 'user' ? 'flex-end' : 'flex-start'}>
              <Paper
                elevation={0}
                sx={{
                  px: 1.5, py: 1, maxWidth: '78%', borderRadius: 2,
                  bgcolor: m.role === 'user' ? 'primary.main' : '#fff',
                  color: m.role === 'user' ? '#fff' : 'text.primary',
                  border: m.role === 'user' ? 'none' : '1px solid', borderColor: 'divider',
                  wordBreak: 'break-word',
                }}
              >
                {m.role === 'assistant'
                  ? <MarkdownMessage text={m.content} />
                  : <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>}
              </Paper>
            </Stack>
          ))}
          {busy && <Typography variant="caption" color="text.secondary">Assistant is typing…</Typography>}
          <div ref={endRef} />
        </Stack>
      </Box>
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth size="small" placeholder="Type a message…" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <IconButton color="primary" onClick={send} disabled={busy || !input.trim()}>
            <SendIcon />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
