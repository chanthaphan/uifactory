import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddCommentIcon from '@mui/icons-material/AddComment';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ChatMessage, ConversationSummary } from '../api/client';
import { useAuth } from '../auth/AuthContext';

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
  /** Persist threads per signed-in user and show a thread switcher (runner only). */
  persistHistory?: boolean;
}

function makeConversationId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `conv-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

export default function ChatView({ appId, pageId, greeting, persistHistory }: Props) {
  const { user } = useAuth();
  const historyEnabled = Boolean(persistHistory && user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // For persisted threads this holds the DB conversation id; otherwise a client session id.
  const [conversationId, setConversationId] = useState<string | undefined>(makeConversationId);
  const [threads, setThreads] = useState<ConversationSummary[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const greetingMessages = (): ChatMessage[] => (greeting ? [{ role: 'assistant', content: greeting }] : []);

  const startNewChat = () => {
    setMessages(greetingMessages());
    setConversationId(historyEnabled ? undefined : makeConversationId());
  };

  const loadThread = async (id: string) => {
    try {
      const convo = await api.getConversation(appId, id);
      setMessages(convo.messages.length ? convo.messages : greetingMessages());
      setConversationId(id);
    } catch {
      startNewChat();
    }
  };

  const refreshThreads = async () => {
    if (!historyEnabled) return [] as ConversationSummary[];
    try {
      const list = await api.listConversations(appId, pageId);
      setThreads(list);
      return list;
    } catch {
      return [] as ConversationSummary[];
    }
  };

  // Initialise: resume the most recent thread (signed-in) or start fresh (ephemeral / editor preview).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (historyEnabled) {
        const list = await refreshThreads();
        if (cancelled) return;
        if (list.length) await loadThread(list[0].id);
        else startNewChat();
      } else {
        startNewChat();
      }
    })();
    return () => { cancelled = true; };
  }, [appId, pageId, historyEnabled, greeting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const deleteThread = async () => {
    if (!conversationId || !historyEnabled) return;
    if (!confirm('Delete this conversation?')) return;
    try { await api.deleteConversation(appId, conversationId); } catch { /* ignore */ }
    const list = await refreshThreads();
    if (list.length) await loadThread(list[0].id);
    else startNewChat();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const base = [...messages, { role: 'user' as const, content: text }];
    // Show the user message immediately plus an empty assistant bubble we stream into.
    setMessages([...base, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    let acc = '';
    try {
      const res = await api.chatStream(
        appId,
        { pageId, conversationId, persist: historyEnabled, messages: base.filter((m) => m.role !== 'system') },
        (delta) => {
          acc += delta;
          setMessages([...base, { role: 'assistant', content: acc }]);
        },
      );
      if (!acc) setMessages([...base, { role: 'assistant', content: '(no response)' }]);
      if (historyEnabled && res.conversationId) {
        setConversationId(res.conversationId);
        refreshThreads();
      }
    } catch (e) {
      setMessages([...base, { role: 'assistant', content: `Error: ${api.errMessage(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f7f8fa' }}>
      {historyEnabled && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
          <TextField
            select size="small" fullWidth
            value={conversationId && threads.some((t) => t.id === conversationId) ? conversationId : ''}
            onChange={(e) => { const v = e.target.value; if (v) loadThread(v); else startNewChat(); }}
          >
            <MenuItem value="">New conversation</MenuItem>
            {threads.map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
          </TextField>
          <Tooltip title="New chat"><IconButton size="small" onClick={startNewChat}><AddCommentIcon fontSize="small" /></IconButton></Tooltip>
          {conversationId && threads.some((t) => t.id === conversationId) && (
            <Tooltip title="Delete conversation"><IconButton size="small" onClick={deleteThread}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
          )}
        </Stack>
      )}
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
