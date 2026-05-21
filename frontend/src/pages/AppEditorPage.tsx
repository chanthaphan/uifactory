import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Drawer, FormControlLabel, IconButton, List,
  ListItemButton, ListItemIcon, ListItemText, MenuItem, Snackbar, Stack, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import { useNavigate, useParams } from 'react-router-dom';
import {
  api, AppAiConfig, AppDefinition, AppFull, AppPage, AppVersion, CanvasLayout, DataSource, EditorMode, QueryDef, Visibility,
} from '../api/client';
import ResultView from '../components/ResultView';
import PreviewFrame, { PreviewBridge } from '../components/PreviewFrame';
import ChatView from '../components/ChatView';
import AiConnectionForm from '../components/AiConnectionForm';
import ShareSettings, { ShareMember } from '../components/ShareSettings';
import DataPanel from '../components/DataPanel';
import CanvasBuilder from '../components/CanvasBuilder';
import { compileLayout } from '../components/layout-compiler';
import StorageIcon from '@mui/icons-material/Storage';

const rid = () => `page-${Math.random().toString(16).slice(2, 8)}`;

const COMPONENT_SUGGESTIONS = [
  'Add summary KPI cards at the top',
  'Add a bar chart of the main numeric field',
  'Add a search / filter box to the table',
  'Add a "Create" form that calls UIFactory.runAction then refreshes',
  'Add a file upload that reads the file and submits it via UIFactory.runAction',
  'Add a refresh button',
  'Lay the content out in two columns',
];

/** Field names available from the bound query result (to help bind builder components). */
function fieldsOf(data: unknown): string[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const firstArray = Object.values(obj).find((v) => Array.isArray(v)) as unknown[] | undefined;
    arr = firstArray ?? [obj];
  }
  const first = arr[0];
  return first && typeof first === 'object' ? Object.keys(first as object) : [];
}

// ---------------- UI page editor ----------------
function UiPageEditor({ appId, page, brandColor, onPatch, dataVersion }: { appId: string; page: AppPage; brandColor?: string; onPatch: (p: Partial<AppPage>) => void; dataVersion: number }) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [queryId, setQueryId] = useState(page.queryId || '');
  const [result, setResult] = useState<unknown>(page.sample ? safeParse(page.sample) : null);
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState(page.prompt || 'Build a clean dashboard with a table and summary of this data.');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const initialView: EditorMode = page.editorMode || (page.layout?.components?.length ? 'canvas' : 'ai');
  const [view, setView] = useState<'ai' | 'canvas' | 'code' | 'preview'>(initialView);
  // local actions editor state
  const actions = page.actions || [];
  const [actionName, setActionName] = useState('');
  const [actionQuery, setActionQuery] = useState('');

  useEffect(() => {
    api.listDataSources(appId).then(setDataSources).catch(() => undefined);
    api.listQueries(appId).then(setQueries).catch(() => undefined);
  }, [appId, dataVersion]);

  const boundQuery = queries.find((q) => q.id === queryId);
  const dataGuidance = boundQuery
    ? [boundQuery.config?.description, boundQuery.config?.schema].filter((x) => typeof x === 'string' && x).join('\n')
    : '';

  const runQuery = async () => {
    if (!queryId) return;
    setRunning(true);
    setError('');
    try {
      const res = await api.runQuery(appId, queryId);
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
        dataGuidance: dataGuidance || undefined,
      });
      onPatch({ html: res.html, prompt, queryId: queryId || undefined, editorMode: 'ai' });
      if (refine) setRefinePrompt('');
    } catch (e) {
      setError(api.errMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const onLayoutChange = (layout: CanvasLayout) => {
    onPatch({
      layout,
      html: compileLayout(layout, { title: page.name, brandColor }),
      queryId: queryId || undefined,
      editorMode: 'canvas',
    });
  };

  const useSuggestion = (s: string) => {
    if (page.html) setRefinePrompt(s);
    else setPrompt(s);
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
      if (!queryId) return { data: result };
      const res = await api.runQuery(appId, queryId);
      setResult(res.data);
      return { data: res.data, meta: res.meta };
    },
  };

  return (
    <Stack spacing={1.5} sx={{ height: '100%' }}>
      {/* Data binding + actions (shared across all modes) */}
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Data &amp; actions</Typography>
          {queryId && <Chip size="small" sx={{ ml: 1 }} label={boundQuery?.name || 'query'} />}
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              <Typography variant="overline" color="primary">Data binding</Typography>
              <TextField select size="small" label="Bound query (becomes window.APP_DATA)" value={queryId} onChange={(e) => setQueryId(e.target.value)}>
                <MenuItem value="">(none — static UI)</MenuItem>
                {queries.map((q) => {
                  const ds = dataSources.find((d) => d.id === q.dataSourceId);
                  return <MenuItem key={q.id} value={q.id}>{q.name}{ds ? ` · ${ds.name}` : ''}</MenuItem>;
                })}
              </TextField>
              <Button variant="outlined" startIcon={running ? <CircularProgress size={16} /> : <PlayArrowIcon />} disabled={!queryId || running} onClick={runQuery}>
                Run query (load sample data)
              </Button>
              {result != null && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, maxHeight: 220, overflow: 'auto' }}>
                  <ResultView data={result} />
                </Box>
              )}
            </Stack>
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              <Typography variant="overline">Actions (for forms / buttons / write-back)</Typography>
              <Typography variant="caption" color="text.secondary">
                Expose a query to the UI as <code>UIFactory.runAction(name, params)</code>. Builder buttons and AI forms call these.
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
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
        <ToggleButton value="canvas">Drag &amp; drop</ToggleButton>
        <ToggleButton value="ai">AI generate</ToggleButton>
        <ToggleButton value="code">Source code</ToggleButton>
        <ToggleButton value="preview">Preview</ToggleButton>
      </ToggleButtonGroup>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ flexGrow: 1, minHeight: 420 }}>
        {view === 'canvas' && (
          <CanvasBuilder
            layout={page.layout || { components: [] }}
            onChange={onLayoutChange}
            actions={actions}
            fieldOptions={fieldsOf(result)}
          />
        )}

        {view === 'ai' && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
            <Box sx={{ width: { md: 380 }, flexShrink: 0 }}>
              <Stack spacing={1.5}>
                <Typography variant="overline" color="secondary">Generate UI with AI</Typography>
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
                <Typography variant="overline">Add a component</Typography>
                <Typography variant="caption" color="text.secondary">Click to {page.html ? 'queue a refine' : 'set the prompt'}, then Generate / Refine.</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {COMPONENT_SUGGESTIONS.map((s) => (
                    <Chip key={s} size="small" variant="outlined" label={s} onClick={() => useSuggestion(s)} clickable />
                  ))}
                </Box>
                {dataGuidance && <Alert severity="info" sx={{ py: 0 }}>Using API/schema guidance from the bound query to steer the AI.</Alert>}
              </Stack>
            </Box>
            <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 420 }}>
              {page.html ? <PreviewFrame html={page.html} data={result} bridge={bridge} />
                : <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}><Typography variant="body2">Generate a UI to preview it here.</Typography></Box>}
            </Box>
          </Stack>
        )}

        {view === 'code' && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TextField
                label="Page HTML (edit directly)"
                value={page.html || ''}
                onChange={(e) => onPatch({ html: e.target.value, editorMode: 'code' })}
                multiline minRows={18} fullWidth
                slotProps={{ input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 } } }}
              />
              {page.layout?.components?.length ? (
                <Alert severity="warning" sx={{ mt: 1 }}>This page also has a drag-and-drop layout. Editing the source here, then editing in the builder, will overwrite these manual changes.</Alert>
              ) : null}
            </Box>
            <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 420 }}>
              {page.html ? <PreviewFrame html={page.html} data={result} bridge={bridge} />
                : <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}><Typography variant="body2">No HTML yet.</Typography></Box>}
            </Box>
          </Stack>
        )}

        {view === 'preview' && (
          <Box sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 460 }}>
            {page.html ? <PreviewFrame html={page.html} data={result} bridge={bridge} />
              : <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}><Typography variant="body2">Build or generate a UI to preview it.</Typography></Box>}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

// ---------------- chat page editor ----------------
const AI_MODE_LABEL: Record<AppAiConfig['mode'], string> = {
  platform: 'Platform LLM (server default)',
  provider: "This app's own LLM key",
  'agent-api': 'External conversation AI (your API)',
};
function ChatPageEditor({ page, appId, saved, aiMode, onOpenSettings, onPatch, dataVersion }: { page: AppPage; appId: string; saved: boolean; aiMode: AppAiConfig['mode']; onOpenSettings: () => void; onPatch: (p: Partial<AppPage>) => void; dataVersion: number }) {
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const chat = page.chat || {};
  useEffect(() => {
    api.listQueries(appId).then(setQueries).catch(() => undefined);
  }, [appId, dataVersion]);
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
          <Divider />
          <Typography variant="overline">Responder</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color={aiMode === 'agent-api' ? 'secondary' : 'default'} label={AI_MODE_LABEL[aiMode]} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Point this chat at a raw LLM or an <strong>external conversation AI API</strong> (your own assistant endpoint). UIFactory POSTs the
            transcript, latest <code>message</code>, and a stable <code>conversationId</code> so a stateful assistant can keep the thread.
          </Typography>
          <Button size="small" startIcon={<SettingsIcon />} onClick={onOpenSettings}>Change AI / agent connection</Button>
          {!saved && <Alert severity="info">Save the app to test the chat with your latest changes.</Alert>}
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
  const [dataOpen, setDataOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [dirty, setDirty] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [publishNote, setPublishNote] = useState('');

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

  const publishChanges = async (note?: string) => {
    if (dirty) await save();
    const updated = await api.deployApp(id, note);
    setApp(updated);
    setPublishNote('');
    setToast(`Published v${updated.version}`);
    if (versionsOpen) loadVersions();
  };

  const loadVersions = async () => {
    try {
      setVersions(await api.listVersions(id));
    } catch (e) {
      setToast(api.errMessage(e));
    }
  };

  const openVersions = () => {
    setVersionsOpen(true);
    loadVersions();
  };

  const restoreVersion = async (version: number) => {
    if (!confirm(`Restore version ${version} into the draft? You can review it, then Publish to make it live.`)) return;
    try {
      const updated = await api.rollbackApp(id, version);
      setApp(updated);
      setDef(updated.definition);
      setSelectedId(updated.definition.pages[0]?.id || '');
      setDirty(false);
      setToast(`Restored v${version} into the draft`);
      setVersionsOpen(false);
    } catch (e) {
      setToast(api.errMessage(e));
    }
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
        <Button startIcon={<StorageIcon />} onClick={() => setDataOpen(true)}>Data</Button>
        <Button startIcon={<HistoryIcon />} onClick={openVersions}>Versions</Button>
        <Button startIcon={<SettingsIcon />} onClick={() => setSettingsOpen(true)}>Settings</Button>
        <Button variant="outlined" startIcon={<SaveIcon />} onClick={save} disabled={saving}>Save</Button>
        {app.status === 'deployed' && (app.hasUnpublishedChanges || dirty) && (
          <Button variant="contained" color="warning" startIcon={<RocketLaunchIcon />} onClick={() => publishChanges()}>
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
                <UiPageEditor appId={id} page={selected} brandColor={(def.theme as { brandColor?: string } | undefined)?.brandColor} onPatch={(p) => patchPage(selected.id, p)} dataVersion={dataVersion} />
              ) : (
                <ChatPageEditor page={selected} appId={id} saved={!dirty} aiMode={aiConfig.mode} onOpenSettings={() => setSettingsOpen(true)} onPatch={(p) => patchPage(selected.id, p)} dataVersion={dataVersion} />
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
              <Typography variant="subtitle2" gutterBottom>Branding</Typography>
              {(() => {
                const theme = (def.theme || {}) as { brandName?: string; brandColor?: string; logo?: string };
                const setTheme = (patch: Record<string, unknown>) => { setDef({ ...def, theme: { ...theme, ...patch } }); setDirty(true); };
                return (
                  <Stack spacing={1.5}>
                    <TextField size="small" label="Brand name" value={theme.brandName || ''} onChange={(e) => setTheme({ brandName: e.target.value })} placeholder={name} />
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <TextField size="small" label="Brand color" value={theme.brandColor || ''} onChange={(e) => setTheme({ brandColor: e.target.value })} placeholder="#0b1f3a" sx={{ flex: 1 }} />
                      <Box component="input" type="color" value={theme.brandColor || '#0b1f3a'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTheme({ brandColor: e.target.value })} sx={{ width: 44, height: 40, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0, bgcolor: 'transparent' }} />
                    </Stack>
                    <TextField size="small" label="Logo (letter or emoji)" value={theme.logo || ''} onChange={(e) => setTheme({ logo: e.target.value })} placeholder="N" inputProps={{ maxLength: 2 }} />
                  </Stack>
                );
              })()}
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>AI / agent connection</Typography>
              <AiConnectionForm value={aiConfig} onChange={(c) => { setAiConfig(c); setDirty(true); }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Permissions</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={def.allowWriteActions !== false}
                    onChange={(e) => { setDef({ ...def, allowWriteActions: e.target.checked }); setDirty(true); }}
                  />
                }
                label="Allow non-editors to run write actions (forms / create / update / delete)"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                When off, viewers and org users can only run read-only actions; editors and admins are unaffected.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={() => { save(); setSettingsOpen(false); }}>Save settings</Button>
          </Stack>
        </Box>
      </Drawer>

      <DataPanel appId={id} open={dataOpen} onClose={() => setDataOpen(false)} onChanged={() => setDataVersion((v) => v + 1)} />

      <Drawer anchor="right" open={versionsOpen} onClose={() => setVersionsOpen(false)}>
        <Box sx={{ width: 420, p: 3 }}>
          <Typography variant="h6" gutterBottom>Version history</Typography>
          <Typography variant="caption" color="text.secondary">Each publish snapshots a version. Restore one into the draft, review it, then Publish to make it live.</Typography>
          <Stack spacing={1.5} sx={{ mt: 2, mb: 3 }}>
            <TextField size="small" label="Note for next publish (optional)" value={publishNote} onChange={(e) => setPublishNote(e.target.value)} placeholder="e.g. Added revenue chart" />
            <Button variant="contained" startIcon={<RocketLaunchIcon />} onClick={() => publishChanges(publishNote)}>
              Publish current draft as new version
            </Button>
          </Stack>
          <Divider />
          <List dense>
            {versions.map((v) => (
              <ListItemButton key={v.id} disableRipple sx={{ alignItems: 'flex-start' }}>
                <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}><HistoryIcon fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" fontWeight={700}>v{v.version}</Typography>{v.isCurrent && <Chip size="small" color="success" label="live" />}<Typography variant="caption" color="text.secondary">{v.pageCount} page{v.pageCount === 1 ? '' : 's'}</Typography></Stack>}
                  secondary={<>{v.note ? <Typography variant="caption" display="block">{v.note}</Typography> : null}<Typography variant="caption" color="text.secondary">{new Date(v.createdAt).toLocaleString()}{v.createdBy ? ` · ${v.createdBy}` : ''}</Typography></>}
                />
                <Tooltip title={`Restore v${v.version}`}>
                  <span><IconButton size="small" disabled={v.isCurrent} onClick={() => restoreVersion(v.version)}><RestoreIcon fontSize="small" /></IconButton></span>
                </Tooltip>
              </ListItemButton>
            ))}
            {versions.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>No published versions yet. Deploy/Publish to create the first one.</Typography>}
          </List>
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
