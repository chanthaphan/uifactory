import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { api, ChatMessage } from '../api/client';

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
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}
              >
                <Typography variant="body2">{m.content}</Typography>
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
