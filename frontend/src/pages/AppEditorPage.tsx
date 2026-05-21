import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
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
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
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
import { compileLayout } from '../components/layout-compiler';

// Drag-and-drop builder is editor-only; load it on demand to keep it out of the base chunk.
const CanvasBuilder = lazy(() => import('../components/CanvasBuilder'));
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

type GenStatus = { state: 'running' | 'done' | 'error'; message?: string };
interface GenerateOpts {
  prompt: string;
  storePrompt: string;
  sample: string;
  queryName?: string;
  currentHtml?: string;
  dataGuidance?: string;
  queryId?: string;
}

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

/** A query mutates data when its SQL isn't a SELECT/WITH/PRAGMA or its REST method isn't GET. */
function isWriteQueryConfig(config: Record<string, unknown> | undefined): boolean {
  const cfg = (config || {}) as { sql?: string; method?: string };
  if (typeof cfg.sql === 'string') return !/^\s*(select|with|pragma)/i.test(cfg.sql);
  return (cfg.method || 'GET').toUpperCase() !== 'GET';
}

// ---------------- UI page editor ----------------
function UiPageEditor({ appId, page, brandColor, status, onGenerate, onPatch, dataVersion }: { appId: string; page: AppPage; brandColor?: string; status?: GenStatus; onGenerate: (pageId: string, opts: GenerateOpts) => void; onPatch: (p: Partial<AppPage>) => void; dataVersion: number }) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [queryId, setQueryId] = useState(page.queryId || '');
  const [result, setResult] = useState<unknown>(page.sample ? safeParse(page.sample) : null);
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState(page.prompt || 'Build a clean dashboard with a table and summary of this data.');
  const [refinePrompt, setRefinePrompt] = useState('');
  const generating = status?.state === 'running';
  const [error, setError] = useState('');
  const initialView: EditorMode = page.editorMode || (page.layout?.components?.length ? 'canvas' : 'ai');
  const [view, setView] = useState<'ai' | 'canvas' | 'code' | 'preview'>(initialView);
  // local actions editor state
  const actions = page.actions || [];
  const [actionName, setActionName] = useState('');
  const [actionQuery, setActionQuery] = useState('');
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [previewing, setPreviewing] = useState('');

  useEffect(() => {
    api.listDataSources(appId).then(setDataSources).catch(() => undefined);
    api.listQueries(appId).then(setQueries).catch(() => undefined);
  }, [appId, dataVersion]);

  const boundQuery = queries.find((q) => q.id === queryId);
  const dataGuidance = boundQuery
    ? [boundQuery.config?.description, boundQuery.config?.schema].filter((x) => typeof x === 'string' && x).join('\n')
    : '';

  // Per-page connector scope. Empty = all connectors available.
  const scopeIds = page.dataSourceIds ?? [];
  const scopedQueries = scopeIds.length === 0 ? queries : queries.filter((q) => scopeIds.includes(q.dataSourceId));
  const boundOutOfScope = !!queryId && scopeIds.length > 0 && !scopedQueries.some((q) => q.id === queryId);
  const outOfScopeActions = scopeIds.length === 0 ? [] : actions.filter((a) => !scopedQueries.some((q) => q.id === a.queryId));

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

  const generate = (refine: boolean) => {
    onGenerate(page.id, {
      prompt: refine ? refinePrompt : prompt,
      storePrompt: prompt,
      sample: JSON.stringify(result ?? null),
      queryName: page.name,
      currentHtml: refine ? page.html : undefined,
      dataGuidance: dataGuidance || undefined,
      queryId: queryId || undefined,
    });
    if (refine) setRefinePrompt('');
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
  const previewAction = async (a: { name: string; queryId: string }) => {
    const q = queries.find((x) => x.id === a.queryId);
    if (isWriteQueryConfig(q?.config) && !window.confirm(`"${a.name}" runs a write query and will modify data in the connected system. Run it anyway?`)) return;
    setPreviewing(a.name); setError(''); setActionResult(null);
    try { const r = await api.appRunQuery(appId, { action: a.name, pageId: page.id }); setActionResult(r.data); }
    catch (e) { setError(api.errMessage(e)); }
    finally { setPreviewing(''); }
  };

  const bridge: PreviewBridge = {
    runQuery: (qid, params) => api.appRunQuery(appId, { queryId: qid, pageId: page.id, params }),
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
              <TextField
                select size="small"
                label="Connectors available on this page"
                value={scopeIds}
                onChange={(e) => {
                  const v = e.target.value as unknown as string[];
                  onPatch({ dataSourceIds: v.length ? v : undefined });
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => {
                    const ids = selected as string[];
                    if (!ids.length) return 'All connectors';
                    return dataSources.filter((d) => ids.includes(d.id)).map((d) => d.name).join(', ');
                  },
                }}
                helperText={scopeIds.length === 0 ? 'Empty = all connectors available to this page' : `${scopeIds.length} connector(s) scoped to this page`}
              >
                {dataSources.map((d) => <MenuItem key={d.id} value={d.id}>{d.name} · {d.type}</MenuItem>)}
              </TextField>
              {boundOutOfScope && (
                <Alert severity="warning" sx={{ py: 0 }}>The bound query uses a connector not scoped to this page. Add its connector above, or change the bound query.</Alert>
              )}
              {outOfScopeActions.length > 0 && (
                <Alert severity="warning" sx={{ py: 0 }}>{outOfScopeActions.length} action(s) use a connector not scoped to this page and will be blocked at runtime.</Alert>
              )}
              <TextField select size="small" label="Bound query (becomes window.APP_DATA)" value={queryId} onChange={(e) => setQueryId(e.target.value)}>
                <MenuItem value="">(none — static UI)</MenuItem>
                {scopedQueries.map((q) => {
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
                  <IconButton size="small" title="Run & preview data" disabled={!!previewing} onClick={() => previewAction(a)}>
                    {previewing === a.name ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" title="Remove action" onClick={() => removeAction(a.name)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Stack>
              ))}
              {actionResult != null && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, maxHeight: 220, overflow: 'auto' }}>
                  <ResultView data={actionResult} />
                </Box>
              )}
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Action name" value={actionName} onChange={(e) => setActionName(e.target.value)} sx={{ width: 140 }} />
                <TextField select size="small" label="Query" value={actionQuery} onChange={(e) => setActionQuery(e.target.value)} fullWidth>
                  <MenuItem value="">Select…</MenuItem>
                  {scopedQueries.map((q) => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
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
          <Suspense fallback={<Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>}>
            <CanvasBuilder
              layout={page.layout || { components: [] }}
              onChange={onLayoutChange}
              actions={actions}
              fieldOptions={fieldsOf(result)}
            />
          </Suspense>
        )}

        {view === 'ai' && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
            <Box sx={{ width: { md: 380 }, flexShrink: 0 }}>
              <Stack spacing={1.5}>
                <Typography variant="overline" color="secondary">Generate UI with AI</Typography>
                <TextField label="Describe the UI" value={prompt} onChange={(e) => setPrompt(e.target.value)} multiline minRows={2} size="small" />
                <Button variant="contained" color="secondary" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />} onClick={() => generate(false)} disabled={generating}>
                  {generating ? 'Generating…' : 'Generate'}
                </Button>
                {page.html && (
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" fullWidth label="Refine (e.g. add a bar chart)" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} />
                    <Button variant="outlined" disabled={generating || !refinePrompt.trim()} onClick={() => generate(true)}>Refine</Button>
                  </Stack>
                )}
                {status?.state === 'running' && <Alert severity="info" icon={<CircularProgress size={16} />}>Generating this page… you can switch pages; it keeps running.</Alert>}
                {status?.state === 'done' && (status.message
                  ? <Alert severity="warning">{status.message}</Alert>
                  : <Alert severity="success" sx={{ py: 0 }}>Generation finished.</Alert>)}
                {status?.state === 'error' && <Alert severity="error">{status.message || 'Generation failed'}</Alert>}
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
function ChatPageEditor({ page, appId, saved, aiMode, onOpenSettings, onPatch, dataVersion }: { page: AppPage; appId: string; saved: boolean; aiMode: AppAiConfig['mode']; onOpenSettings: () => void; onPatch: (p: Partial<AppPage>) => void; dataVersion: number }) {
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [groundResult, setGroundResult] = useState<unknown>(null);
  const [groundLoading, setGroundLoading] = useState(false);
  const [groundError, setGroundError] = useState('');
  const chat = page.chat || {};
  useEffect(() => {
    api.listQueries(appId).then(setQueries).catch(() => undefined);
    api.listDataSources(appId).then(setDataSources).catch(() => undefined);
  }, [appId, dataVersion]);
  const patchChat = (p: Partial<NonNullable<AppPage['chat']>>) => onPatch({ chat: { ...chat, ...p } });
  const previewGround = async () => {
    if (!chat.queryId) return;
    const q = queries.find((x) => x.id === chat.queryId);
    if (isWriteQueryConfig(q?.config) && !window.confirm('This grounding query runs a write query and will modify data in the connected system. Run it anyway?')) return;
    setGroundLoading(true); setGroundError(''); setGroundResult(null);
    try { const r = await api.appRunQuery(appId, { queryId: chat.queryId, pageId: page.id }); setGroundResult(r.data); }
    catch (e) { setGroundError(api.errMessage(e)); }
    finally { setGroundLoading(false); }
  };
  const agentSources = dataSources.filter((d) => d.type === 'AGENT');
  const selectedAgent = agentSources.find((d) => d.id === chat.agentDataSourceId);

  // Per-page connector scope (governs the grounding query). Empty = all connectors available.
  const scopeIds = page.dataSourceIds ?? [];
  const scopableSources = dataSources.filter((d) => d.type !== 'AGENT');
  const scopedQueries = scopeIds.length === 0 ? queries : queries.filter((q) => scopeIds.includes(q.dataSourceId));
  const groundingOutOfScope = !!chat.queryId && scopeIds.length > 0 && !scopedQueries.some((q) => q.id === chat.queryId);

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ height: '100%' }}>
      <Box sx={{ width: { md: 380 }, flexShrink: 0 }}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary">Chat configuration</Typography>
          <TextField label="System prompt" value={chat.systemPrompt || ''} onChange={(e) => patchChat({ systemPrompt: e.target.value })} multiline minRows={3} size="small" placeholder="You are a helpful assistant for…" />
          <TextField label="Greeting" value={chat.greeting || ''} onChange={(e) => patchChat({ greeting: e.target.value })} size="small" placeholder="Hi! How can I help?" />
          <TextField
            select size="small"
            label="Connectors available on this page"
            value={scopeIds}
            onChange={(e) => {
              const v = e.target.value as unknown as string[];
              onPatch({ dataSourceIds: v.length ? v : undefined });
            }}
            SelectProps={{
              multiple: true,
              renderValue: (selected) => {
                const ids = selected as string[];
                if (!ids.length) return 'All connectors';
                return scopableSources.filter((d) => ids.includes(d.id)).map((d) => d.name).join(', ');
              },
            }}
            helperText={scopeIds.length === 0 ? 'Empty = all connectors available to this page' : `${scopeIds.length} connector(s) scoped to this page`}
          >
            {scopableSources.map((d) => <MenuItem key={d.id} value={d.id}>{d.name} · {d.type}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField select size="small" fullWidth label="Ground answers on query (optional)" value={chat.queryId || ''} onChange={(e) => patchChat({ queryId: e.target.value || undefined })}>
              <MenuItem value="">(no data grounding)</MenuItem>
              {scopedQueries.map((q) => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
            </TextField>
            <IconButton size="small" title="Run & preview data" disabled={!chat.queryId || groundLoading} onClick={previewGround} sx={{ mt: 0.5 }}>
              {groundLoading ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Stack>
          {groundingOutOfScope && (
            <Alert severity="warning" sx={{ py: 0 }}>The grounding query uses a connector not scoped to this page; it will be skipped at runtime.</Alert>
          )}
          {groundError && <Alert severity="error" sx={{ py: 0 }} onClose={() => setGroundError('')}>{groundError}</Alert>}
          {groundResult != null && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, maxHeight: 220, overflow: 'auto' }}>
              <ResultView data={groundResult} />
            </Box>
          )}
          <Divider />
          <Typography variant="overline">Responder</Typography>
          <TextField
            select size="small"
            label="Agent API (optional)"
            value={chat.agentDataSourceId || ''}
            onChange={(e) => patchChat({ agentDataSourceId: e.target.value || undefined })}
            helperText={
              chat.agentDataSourceId && selectedAgent
                ? `Using "${selectedAgent.name}" — overrides the app-level AI setting for this page`
                : agentSources.length === 0
                  ? 'No Agent API connectors yet — add one in Connectors'
                  : 'Select an Agent API connector to route this page\'s chat to your own endpoint'
            }
          >
            <MenuItem value="">(use app-level AI setting)</MenuItem>
            {agentSources.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          {!chat.agentDataSourceId && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={aiMode === 'agent-api' ? 'External agent API (app setting)' : aiMode === 'provider' ? "App's own LLM key" : 'Platform LLM'} />
              <Button size="small" startIcon={<SettingsIcon />} onClick={onOpenSettings} sx={{ ml: 'auto' }}>Change</Button>
            </Stack>
          )}
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
  const [genStatus, setGenStatus] = useState<Record<string, GenStatus>>({});
  // Undo/redo history of the definition (current-session edits, before/after save).
  const [undoStack, setUndoStack] = useState<AppDefinition[]>([]);
  const [redoStack, setRedoStack] = useState<AppDefinition[]>([]);
  const [epoch, setEpoch] = useState(0); // bumped on undo/redo to remount the page editor
  const defRef = useRef(def);
  useEffect(() => { defRef.current = def; }, [def]);
  const HISTORY_LIMIT = 100;

  /** Apply a definition change and record the previous state for undo. */
  const mutateDef = (updater: (d: AppDefinition) => AppDefinition) => {
    setUndoStack((s) => [...s, defRef.current].slice(-HISTORY_LIMIT));
    setRedoStack([]);
    setDef(updater);
    setDirty(true);
  };
  const fixSelection = (d: AppDefinition) => setSelectedId((sel) => (d.pages.some((p) => p.id === sel) ? sel : d.pages[0]?.id || ''));
  const undo = () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, defRef.current].slice(-HISTORY_LIMIT));
    setDef(prev);
    fixSelection(prev);
    setEpoch((e) => e + 1);
    setDirty(true);
  };
  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((s) => [...s, defRef.current].slice(-HISTORY_LIMIT));
    setDef(next);
    fixSelection(next);
    setEpoch((e) => e + 1);
    setDirty(true);
  };

  const load = async () => {
    const a = await api.getApp(id);
    setApp(a);
    setDef(a.definition);
    setName(a.name);
    setDescription(a.description || '');
    setAiConfig(a.aiConfig || { mode: 'platform' });
    setSharing({ visibility: a.visibility, members: (a.members || []).filter((m) => m.role !== 'owner') as ShareMember[] });
    setSelectedId(a.definition.pages[0]?.id || '');
    setUndoStack([]);
    setRedoStack([]);
  };
  useEffect(() => {
    load().catch(() => navigate('/build'));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => def.pages.find((p) => p.id === selectedId), [def, selectedId]);

  const patchPage = (pageId: string, patch: Partial<AppPage>) => {
    mutateDef((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) }));
  };

  // Generation runs at the app level so its status survives navigating between pages.
  const runGenerate = async (pageId: string, opts: GenerateOpts) => {
    const pageName = def.pages.find((p) => p.id === pageId)?.name || 'page';
    setGenStatus((s) => ({ ...s, [pageId]: { state: 'running' } }));
    try {
      const res = await api.generateUi(id, {
        prompt: opts.prompt,
        sample: opts.sample,
        queryName: opts.queryName,
        currentHtml: opts.currentHtml,
        dataGuidance: opts.dataGuidance,
        guidelines: def.buildGuidelines,
      });
      patchPage(pageId, { html: res.html, prompt: opts.storePrompt, queryId: opts.queryId, editorMode: 'ai' });
      const fellBack = res.source === 'fallback';
      setGenStatus((s) => ({
        ...s,
        [pageId]: fellBack
          ? { state: 'done', message: res.note || 'The AI was unavailable, so a built-in template was used. Check the app AI settings and try again.' }
          : { state: 'done' },
      }));
      setToast(fellBack ? `"${pageName}": used a template (AI unavailable)` : `"${pageName}": UI generated`);
    } catch (e) {
      setGenStatus((s) => ({ ...s, [pageId]: { state: 'error', message: api.errMessage(e) } }));
      setToast(`"${pageName}": generation failed`);
    }
  };

  const addPage = (type: 'ui' | 'chat') => {
    const n = def.pages.length + 1;
    const page: AppPage = { id: rid(), name: type === 'chat' ? `Chat ${n}` : `Page ${n}`, slug: `page-${n}`, type, ...(type === 'chat' ? { chat: { greeting: 'Hi! How can I help?' } } : {}) };
    mutateDef((d) => ({ ...d, pages: [...d.pages, page] }));
    setSelectedId(page.id);
  };

  const deletePage = (pageId: string) => {
    mutateDef((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== pageId) }));
    if (selectedId === pageId) setSelectedId((def.pages.filter((p) => p.id !== pageId)[0]?.id) || '');
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
      setUndoStack([]);
      setRedoStack([]);
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
        <Tooltip title="Undo"><span><IconButton size="small" onClick={undo} disabled={!undoStack.length}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Redo"><span><IconButton size="small" onClick={redo} disabled={!redoStack.length}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
        <Button startIcon={<StorageIcon />} onClick={() => setDataOpen(true)}>Connectors</Button>
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
            {def.pages.map((p) => {
              const gs = genStatus[p.id];
              return (
                <ListItemButton key={p.id} selected={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
                  <ListItemIcon sx={{ minWidth: 32 }}>{p.type === 'chat' ? <ChatIcon fontSize="small" /> : <DashboardIcon fontSize="small" />}</ListItemIcon>
                  <ListItemText primary={p.name} />
                  {gs?.state === 'running' && <Tooltip title="Generating…"><CircularProgress size={14} sx={{ mr: 0.5 }} /></Tooltip>}
                  {gs?.state === 'done' && <Tooltip title="Generation finished"><CheckCircleIcon color="success" fontSize="small" sx={{ mr: 0.5 }} /></Tooltip>}
                  {gs?.state === 'error' && <Tooltip title={gs.message || 'Generation failed'}><ErrorOutlineIcon color="error" fontSize="small" sx={{ mr: 0.5 }} /></Tooltip>}
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </ListItemButton>
              );
            })}
            {def.pages.length === 0 && <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>No pages. Add one above.</Typography>}
          </List>
        </Box>

        <Box sx={{ flexGrow: 1, minHeight: 480 }}>
          {selected ? (
            <Box key={`${selected.id}-${epoch}`} sx={{ height: '100%' }}>
              <TextField size="small" label="Page name" value={selected.name} onChange={(e) => patchPage(selected.id, { name: e.target.value })} sx={{ mb: 2 }} />
              {selected.type === 'ui' ? (
                <UiPageEditor appId={id} page={selected} brandColor={(def.theme as { brandColor?: string } | undefined)?.brandColor} status={genStatus[selected.id]} onGenerate={runGenerate} onPatch={(p) => patchPage(selected.id, p)} dataVersion={dataVersion} />
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
                const setTheme = (patch: Record<string, unknown>) => { mutateDef((d) => ({ ...d, theme: { ...((d.theme || {}) as Record<string, unknown>), ...patch } })); };
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
              <Typography variant="subtitle2" gutterBottom>Build guidelines</Typography>
              <TextField
                fullWidth multiline minRows={4} size="small"
                placeholder={'AGENTS.md / CLAUDE.md style. e.g.\n- Use our brand color for headers\n- Prefer tables with sticky headers\n- All money uses 2 decimals and a $ prefix'}
                value={(def.buildGuidelines as string) || ''}
                onChange={(e) => { const v = e.target.value; mutateDef((d) => ({ ...d, buildGuidelines: v })); }}
              />
              <Typography variant="caption" color="text.secondary">
                Conventions fed to the AI/agent for both UI generation and chat. When the AI connection is an
                external agent API, generation is routed through it (so it can use its own coding skills).
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Permissions</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={def.allowWriteActions !== false}
                    onChange={(e) => { const v = e.target.checked; mutateDef((d) => ({ ...d, allowWriteActions: v })); }}
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
