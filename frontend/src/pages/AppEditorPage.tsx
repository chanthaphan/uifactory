import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, MenuItem, Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate, useParams } from 'react-router-dom';
import {
  api, AppAiConfig, AppDefinition, AppFull, AppPage, DataSource, QueryDef, Visibility,
} from '../api/client';
import ResultView from '../components/ResultView';
import PreviewFrame, { PreviewBridge } from '../components/PreviewFrame';
import ChatView from '../components/ChatView';
import AiConnectionForm from '../components/AiConnectionForm';
import ShareSettings, { ShareMember } from '../components/ShareSettings';

const rid = () => `page-${Math.random().toString(16).slice(2, 8)}`;

// ---------------- UI page editor ----------------
function UiPageEditor({ appId, page, onPatch }: { appId: string; page: AppPage; onPatch: (p: Partial<AppPage>) => void }) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [queryId, setQueryId] = useState(page.queryId || '');
  const [result, setResult] = useState<unknown>(page.sample ? safeParse(page.sample) : null);
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState(page.prompt || 'Build a clean dashboard with a table and summary of this data.');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  // local actions editor state
  const actions = page.actions || [];
  const [actionName, setActionName] = useState('');
  const [actionQuery, setActionQuery] = useState('');

  useEffect(() => {
    api.listDataSources().then(setDataSources).catch(() => undefined);
    api.listQueries().then(setQueries).catch(() => undefined);
  }, []);

  const runQuery = async () => {
    const q = queries.find((x) => x.id === queryId);
    if (!q) return;
    setRunning(true);
    setError('');
    try {
      const res = await api.runInline({ dataSourceId: q.dataSourceId, config: q.config });
      setResult(res.data);
      onPatch({ queryId, sample: JSON.stringify(res.data).slice(0, 100000) });
    } catch (e) {
      setError(api.errMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const generate = async (refine: boolean) => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.generateUi({
        prompt: refine ? refinePrompt : prompt,
        sample: JSON.stringify(result ?? null),
        queryName: page.name,
        currentHtml: refine ? page.html : undefined,
      });
      onPatch({ html: res.html, prompt: refine ? prompt : prompt, queryId: queryId || undefined });
      if (refine) setRefinePrompt('');
    } catch (e) {
      setError(api.errMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const addAction = () => {
    if (!actionName.trim() || !actionQuery) return;
    onPatch({ actions: [...actions, { name: actionName.trim(), queryId: actionQuery }] });
    setActionName('');
    setActionQuery('');
  };
  const removeAction = (name: string) => onPatch({ actions: actions.filter((a) => a.name !== name) });

  const bridge: PreviewBridge = {
    runQuery: (qid, params) => api.appRunQuery(appId, { queryId: qid, params }),
    runAction: (name, params) => api.appRunQuery(appId, { action: name, pageId: page.id, params }),
    refresh: async () => {
      const q = queries.find((x) => x.id === queryId);
      if (!q) return { data: result };
      const res = await api.runInline({ dataSourceId: q.dataSourceId, config: q.config });
      setResult(res.data);
      return { data: res.data, meta: res.meta };
    },
  };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
      <Box sx={{ width: { md: 380 }, flexShrink: 0 }}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary">Data binding</Typography>
          <TextField select size="small" label="Bound query" value={queryId} onChange={(e) => setQueryId(e.target.value)}>
            <MenuItem value="">(none — static UI)</MenuItem>
            {queries.map((q) => {
              const ds = dataSources.find((d) => d.id === q.dataSourceId);
              return <MenuItem key={q.id} value={q.id}>{q.name}{ds ? ` · ${ds.name}` : ''}</MenuItem>;
            })}
          </TextField>
          <Button variant="outlined" startIcon={running ? <CircularProgress size={16} /> : <PlayArrowIcon />} disabled={!queryId || running} onClick={runQuery}>
            Run query
          </Button>
          {result != null && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <ResultView data={result} />
            </Box>
          )}
          <Divider />
          <Typography variant="overline" color="secondary">Generate UI</Typography>
          <TextField label="Describe the UI" value={prompt} onChange={(e) => setPrompt(e.target.value)} multiline minRows={2} size="small" />
          <Button variant="contained" color="secondary" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />} onClick={() => generate(false)} disabled={generating}>
            Generate
          </Button>
          {page.html && (
            <Stack direction="row" spacing={1}>
              <TextField size="small" fullWidth label="Refine (e.g. add a bar chart)" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} />
              <Button variant="outlined" disabled={generating || !refinePrompt.trim()} onClick={() => generate(true)}>Refine</Button>
            </Stack>
          )}
          <Divider />
          <Typography variant="overline">Actions (for forms / interactivity)</Typography>
          <Typography variant="caption" color="text.secondary">
            Expose a query to the UI as <code>UIFactory.runAction(name, params)</code> — used for filters, lookups, and write-back.
          </Typography>
          {actions.map((a) => (
            <Stack key={a.name} direction="row" alignItems="center" spacing={1}>
              <Chip size="small" label={a.name} />
              <Typography variant="caption" sx={{ flexGrow: 1 }}>{queries.find((q) => q.id === a.queryId)?.name || a.queryId}</Typography>
              <IconButton size="small" onClick={() => removeAction(a.name)}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Action name" value={actionName} onChange={(e) => setActionName(e.target.value)} sx={{ width: 140 }} />
            <TextField select size="small" label="Query" value={actionQuery} onChange={(e) => setActionQuery(e.target.value)} fullWidth>
              <MenuItem value="">Select…</MenuItem>
              {queries.map((q) => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
            </TextField>
            <IconButton onClick={addAction} disabled={!actionName.trim() || !actionQuery}><AddIcon /></IconButton>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Box>
      <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 460 }}>
        {page.html ? (
          <PreviewFrame html={page.html} data={result} bridge={bridge} />
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">Run a query and generate a UI to preview it here.</Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
}

// ---------------- chat page editor ----------------
function ChatPageEditor({ page, appId, saved, onPatch }: { page: AppPage; appId: string; saved: boolean; onPatch: (p: Partial<AppPage>) => void }) {
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const chat = page.chat || {};
  useEffect(() => {
    api.listQueries().then(setQueries).catch(() => undefined);
  }, []);
  const patchChat = (p: Partial<NonNullable<AppPage['chat']>>) => onPatch({ chat: { ...chat, ...p } });

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
      <Box sx={{ width: { md: 380 }, flexShrink: 0 }}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary">Chat configuration</Typography>
          <TextField label="System prompt" value={chat.systemPrompt || ''} onChange={(e) => patchChat({ systemPrompt: e.target.value })} multiline minRows={3} size="small" placeholder="You are a helpful assistant for…" />
          <TextField label="Greeting" value={chat.greeting || ''} onChange={(e) => patchChat({ greeting: e.target.value })} size="small" placeholder="Hi! How can I help?" />
          <TextField select size="small" label="Ground answers on query (optional)" value={chat.queryId || ''} onChange={(e) => patchChat({ queryId: e.target.value || undefined })}>
            <MenuItem value="">(no data grounding)</MenuItem>
            {queries.map((q) => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
          </TextField>
          <Alert severity="info">Configure the AI/agent connection in the app Settings. Save the app to test the chat with your latest changes.</Alert>
        </Stack>
      </Box>
      <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 460 }}>
        {saved ? (
          <ChatView appId={appId} pageId={page.id} greeting={chat.greeting} />
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">Save the app to preview the chat.</Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
}

// ---------------- main editor ----------------
export default function AppEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppFull | null>(null);
  const [def, setDef] = useState<AppDefinition>({ pages: [] });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiConfig, setAiConfig] = useState<AppAiConfig>({ mode: 'platform' });
  const [sharing, setSharing] = useState<{ visibility: Visibility; members: ShareMember[] }>({ visibility: 'private', members: [] });
  const [selectedId, setSelectedId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    const a = await api.getApp(id);
    setApp(a);
    setDef(a.definition);
    setName(a.name);
    setDescription(a.description || '');
    setAiConfig(a.aiConfig || { mode: 'platform' });
    setSharing({ visibility: a.visibility, members: (a.members || []).filter((m) => m.role !== 'owner') as ShareMember[] });
    setSelectedId(a.definition.pages[0]?.id || '');
  };
  useEffect(() => {
    load().catch(() => navigate('/build'));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => def.pages.find((p) => p.id === selectedId), [def, selectedId]);

  const patchPage = (pageId: string, patch: Partial<AppPage>) => {
    setDef((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) }));
    setDirty(true);
  };

  const addPage = (type: 'ui' | 'chat') => {
    const n = def.pages.length + 1;
    const page: AppPage = { id: rid(), name: type === 'chat' ? `Chat ${n}` : `Page ${n}`, slug: `page-${n}`, type, ...(type === 'chat' ? { chat: { greeting: 'Hi! How can I help?' } } : {}) };
    setDef((d) => ({ ...d, pages: [...d.pages, page] }));
    setSelectedId(page.id);
    setDirty(true);
  };

  const deletePage = (pageId: string) => {
    setDef((d) => {
      const pages = d.pages.filter((p) => p.id !== pageId);
      if (selectedId === pageId) setSelectedId(pages[0]?.id || '');
      return { ...d, pages };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateApp(id, { name, description, definition: def, aiConfig });
      await api.setSharing(id, { visibility: sharing.visibility, members: sharing.members });
      setApp(updated);
      setDirty(false);
      setToast('Saved');
    } catch (e) {
      setToast(api.errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleDeploy = async () => {
    if (!app) return;
    if (dirty) await save();
    const updated = app.status === 'deployed' ? await api.undeployApp(id) : await api.deployApp(id);
    setApp(updated);
    setToast(updated.status === 'deployed' ? 'Deployed' : 'Undeployed');
  };

  const publishChanges = async () => {
    if (dirty) await save();
    const updated = await api.deployApp(id);
    setApp(updated);
    setToast(`Published v${updated.version}`);
  };

  if (!app) return <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
        <IconButton onClick={() => navigate('/build')}><ArrowBackIcon /></IconButton>
        <TextField variant="standard" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} sx={{ '& input': { fontSize: 22, fontWeight: 700 } }} />
        <Chip size="small" label={app.status} color={app.status === 'deployed' ? 'success' : 'default'} />
        {app.status === 'deployed' && <Chip size="small" variant="outlined" label={`v${app.version}`} />}
        <Box flexGrow={1} />
        {dirty && <Chip size="small" color="warning" label="Unsaved" />}
        <Button startIcon={<SettingsIcon />} onClick={() => setSettingsOpen(true)}>Settings</Button>
        <Button variant="outlined" startIcon={<SaveIcon />} onClick={save} disabled={saving}>Save</Button>
        {app.status === 'deployed' && (app.hasUnpublishedChanges || dirty) && (
          <Button variant="contained" color="warning" startIcon={<RocketLaunchIcon />} onClick={publishChanges}>
            Publish changes
          </Button>
        )}
        <Button variant="contained" color={app.status === 'deployed' ? 'inherit' : 'success'} startIcon={<RocketLaunchIcon />} onClick={toggleDeploy}>
          {app.status === 'deployed' ? 'Undeploy' : 'Deploy'}
        </Button>
        {app.status === 'deployed' && (
          <Tooltip title="Open running app">
            <IconButton onClick={() => navigate(`/run/${app.slug}`)}><OpenInNewIcon /></IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ width: { md: 220 }, flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1 }}>
            <Typography variant="subtitle2">Pages</Typography>
            <Box>
              <Tooltip title="Add UI page"><IconButton size="small" onClick={() => addPage('ui')}><AddIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Add chat page"><IconButton size="small" onClick={() => addPage('chat')}><ChatIcon fontSize="small" /></IconButton></Tooltip>
            </Box>
          </Stack>
          <Divider />
          <List dense>
            {def.pages.map((p) => (
              <ListItemButton key={p.id} selected={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
                <ListItemIcon sx={{ minWidth: 32 }}>{p.type === 'chat' ? <ChatIcon fontSize="small" /> : <DashboardIcon fontSize="small" />}</ListItemIcon>
                <ListItemText primary={p.name} />
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </ListItemButton>
            ))}
            {def.pages.length === 0 && <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>No pages. Add one above.</Typography>}
          </List>
        </Box>

        <Box sx={{ flexGrow: 1, minHeight: 480 }}>
          {selected ? (
            <Box key={selected.id} sx={{ height: '100%' }}>
              <TextField size="small" label="Page name" value={selected.name} onChange={(e) => patchPage(selected.id, { name: e.target.value })} sx={{ mb: 2 }} />
              {selected.type === 'ui' ? (
                <UiPageEditor appId={id} page={selected} onPatch={(p) => patchPage(selected.id, p)} />
              ) : (
                <ChatPageEditor page={selected} appId={id} saved={!dirty} onPatch={(p) => patchPage(selected.id, p)} />
              )}
            </Box>
          ) : (
            <Typography color="text.secondary">Select or add a page.</Typography>
          )}
        </Box>
      </Stack>

      <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Box sx={{ width: 420, p: 3 }}>
          <Typography variant="h6" gutterBottom>App settings</Typography>
          <Stack spacing={3} mt={1}>
            <TextField label="Description" value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} multiline minRows={2} size="small" />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Sharing</Typography>
              <ShareSettings visibility={sharing.visibility} members={sharing.members} ownerEmail={app.owner.email} onChange={(s) => { setSharing(s); setDirty(true); }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>AI / agent connection</Typography>
              <AiConnectionForm value={aiConfig} onChange={(c) => { setAiConfig(c); setDirty(true); }} />
            </Box>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={() => { save(); setSettingsOpen(false); }}>Save settings</Button>
          </Stack>
        </Box>
      </Drawer>

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
