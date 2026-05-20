import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { api, DataSource, ExecutionResult, GenerateUiResult, QueryDef, DataSourceType, PROVIDER_LABEL } from '../api/client';
import ResultView from '../components/ResultView';
import PreviewFrame from '../components/PreviewFrame';

const NEW_QUERY = '__new__';

interface RestForm {
  method: string;
  path: string;
  headers: string;
  body: string;
}

function dsType(list: DataSource[], id: string): DataSourceType | null {
  return list.find((d) => d.id === id)?.type ?? null;
}

export default function BuilderPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dsId, setDsId] = useState('');
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [queryId, setQueryId] = useState<string>(NEW_QUERY);

  const [queryName, setQueryName] = useState('Untitled query');
  const [sql, setSql] = useState('SELECT 1;');
  const [rest, setRest] = useState<RestForm>({ method: 'GET', path: '', headers: '', body: '' });

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [runError, setRunError] = useState('');

  const [prompt, setPrompt] = useState('Build a clean dashboard to explore this data with a table and a summary.');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GenerateUiResult | null>(null);
  const [genError, setGenError] = useState('');

  const [saveOpen, setSaveOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const type = useMemo(() => dsType(dataSources, dsId), [dataSources, dsId]);
  const isSql = type === 'POSTGRES' || type === 'SQLITE';

  useEffect(() => {
    api.listDataSources().then((ds) => {
      setDataSources(ds);
      if (ds.length && !dsId) setDsId(ds[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dsId) return;
    api.listQueries(dsId).then((qs) => {
      setQueries(qs);
      setQueryId(NEW_QUERY);
      resetEditorForType(dsType(dataSources, dsId));
    });
  }, [dsId]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetEditorForType(t: DataSourceType | null) {
    setQueryName('Untitled query');
    if (t === 'REST') setRest({ method: 'GET', path: '', headers: '', body: '' });
    else setSql('SELECT 1;');
  }

  function selectQuery(id: string) {
    setQueryId(id);
    if (id === NEW_QUERY) {
      resetEditorForType(type);
      return;
    }
    const q = queries.find((x) => x.id === id);
    if (!q) return;
    setQueryName(q.name);
    if (type === 'REST') {
      const c = q.config as Partial<RestForm> & { body?: unknown };
      setRest({
        method: (c.method as string) || 'GET',
        path: (c.path as string) || '',
        headers: c.headers ? JSON.stringify(c.headers, null, 2) : '',
        body: c.body ? JSON.stringify(c.body, null, 2) : '',
      });
    } else {
      setSql((q.config as { sql?: string }).sql || '');
    }
  }

  function buildConfig(): Record<string, unknown> {
    if (type === 'REST') {
      const cfg: Record<string, unknown> = { method: rest.method, path: rest.path };
      if (rest.headers.trim()) cfg.headers = JSON.parse(rest.headers);
      if (rest.body.trim()) cfg.body = JSON.parse(rest.body);
      return cfg;
    }
    return { sql };
  }

  async function handleRun() {
    setRunError('');
    setRunning(true);
    setResult(null);
    try {
      const res = await api.runInline({ dataSourceId: dsId, config: buildConfig() });
      setResult(res);
    } catch (e) {
      setRunError(api.errMessage(e));
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveQuery() {
    try {
      const config = buildConfig();
      if (queryId === NEW_QUERY) {
        const created = await api.createQuery({ name: queryName, dataSourceId: dsId, config });
        const qs = await api.listQueries(dsId);
        setQueries(qs);
        setQueryId(created.id);
      } else {
        await api.updateQuery(queryId, { name: queryName, config });
        setQueries(await api.listQueries(dsId));
      }
    } catch (e) {
      setRunError(api.errMessage(e));
    }
  }

  async function handleGenerate() {
    if (!result) return;
    setGenError('');
    setGenerating(true);
    try {
      const res = await api.generateUi({
        prompt,
        sample: JSON.stringify(result.data),
        queryName,
      });
      setGenerated(res);
    } catch (e) {
      setGenError(api.errMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveApp() {
    setSaving(true);
    try {
      await api.createApp({
        name: appName.trim(),
        definition: {
          html: generated?.html,
          queryId: queryId !== NEW_QUERY ? queryId : undefined,
          prompt,
          sample: result ? JSON.stringify(result.data).slice(0, 100000) : undefined,
        },
      });
      setSaveOpen(false);
      setSavedMsg(`Saved "${appName.trim()}" to My Apps.`);
      setAppName('');
    } catch (e) {
      setGenError(api.errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        App Builder
      </Typography>
      <Typography color="text.secondary" variant="body2" mb={2}>
        Run a query against a data source, then let Claude turn its output into an app UI.
      </Typography>

      <Grid container spacing={2}>
        {/* LEFT: data + query */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="overline" color="primary">
                1 · Data & query
              </Typography>
              <Stack spacing={2} mt={1}>
                <TextField select size="small" label="Data source" value={dsId} onChange={(e) => setDsId(e.target.value)} fullWidth>
                  {dataSources.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} · {d.type}
                    </MenuItem>
                  ))}
                  {dataSources.length === 0 && <MenuItem value="">No data sources — add one first</MenuItem>}
                </TextField>

                <TextField select size="small" label="Query" value={queryId} onChange={(e) => selectQuery(e.target.value)} fullWidth>
                  <MenuItem value={NEW_QUERY}>+ New query</MenuItem>
                  {queries.map((q) => (
                    <MenuItem key={q.id} value={q.id}>
                      {q.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField size="small" label="Query name" value={queryName} onChange={(e) => setQueryName(e.target.value)} fullWidth />

                {isSql && (
                  <TextField
                    label="SQL"
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    fullWidth
                    multiline
                    minRows={5}
                    slotProps={{ input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } } }}
                  />
                )}

                {type === 'REST' && (
                  <>
                    <Stack direction="row" spacing={1}>
                      <TextField select size="small" label="Method" value={rest.method} onChange={(e) => setRest({ ...rest, method: e.target.value })} sx={{ width: 120 }}>
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                          <MenuItem key={m} value={m}>
                            {m}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField size="small" label="Path" placeholder="/users" value={rest.path} onChange={(e) => setRest({ ...rest, path: e.target.value })} fullWidth />
                    </Stack>
                    <TextField label="Headers (JSON, optional)" value={rest.headers} onChange={(e) => setRest({ ...rest, headers: e.target.value })} fullWidth multiline minRows={2} />
                    <TextField label="Body (JSON, optional)" value={rest.body} onChange={(e) => setRest({ ...rest, body: e.target.value })} fullWidth multiline minRows={2} />
                  </>
                )}

                <Stack direction="row" spacing={1}>
                  <Button variant="contained" startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />} onClick={handleRun} disabled={!dsId || running}>
                    Run
                  </Button>
                  <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveQuery} disabled={!dsId}>
                    {queryId === NEW_QUERY ? 'Save query' : 'Update query'}
                  </Button>
                </Stack>

                {runError && <Alert severity="error">{runError}</Alert>}
              </Stack>
            </CardContent>
          </Card>

          {result && (
            <Card variant="outlined" sx={{ mt: 2 }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Typography variant="subtitle2">Result</Typography>
                  <Chip size="small" label={`${result.meta.durationMs} ms`} />
                  {result.meta.rowCount != null && <Chip size="small" label={`${result.meta.rowCount} rows`} />}
                  {result.meta.status != null && <Chip size="small" label={`HTTP ${result.meta.status}`} color={result.meta.status < 400 ? 'success' : 'error'} />}
                </Stack>
                <ResultView data={result.data} />
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* RIGHT: AI + preview */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="overline" color="secondary">
                2 · Generate UI with AI
              </Typography>
              <Stack spacing={1.5} mt={1}>
                <TextField label="Describe the app UI you want" value={prompt} onChange={(e) => setPrompt(e.target.value)} fullWidth multiline minRows={2} />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                    onClick={handleGenerate}
                    disabled={!result || generating}
                  >
                    Generate UI
                  </Button>
                  {!result && <Typography variant="caption" color="text.secondary">Run a query first to provide the data shape.</Typography>}
                  {generated && (
                    <Chip
                      size="small"
                      color={generated.source === 'ai' ? 'success' : 'default'}
                      label={
                        generated.source === 'ai'
                          ? `${generated.provider ? PROVIDER_LABEL[generated.provider] : 'AI'} · ${generated.model}`
                          : 'Template (no AI key)'
                      }
                    />
                  )}
                </Stack>
                {generated?.note && <Alert severity="info">{generated.note}</Alert>}
                {genError && <Alert severity="error">{genError}</Alert>}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2">Live preview</Typography>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={!generated}
                  onClick={() => {
                    setAppName(queryName === 'Untitled query' ? 'My App' : queryName);
                    setSaveOpen(true);
                  }}
                >
                  Save as app
                </Button>
              </Stack>
              <Divider sx={{ mb: 1 }} />
              {savedMsg && (
                <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSavedMsg('')}>
                  {savedMsg}
                </Alert>
              )}
              <Box sx={{ height: 520, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                {generated ? (
                  <PreviewFrame html={generated.html} data={result?.data} />
                ) : (
                  <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                    <Stack alignItems="center" spacing={1}>
                      <AutoAwesomeIcon color="disabled" />
                      <Typography variant="body2">Your generated app will appear here.</Typography>
                    </Stack>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Save app</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="App name" value={appName} onChange={(e) => setAppName(e.target.value)} fullWidth sx={{ mt: 1 }} />
          {queryId === NEW_QUERY && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This query isn't saved, so the app will store a snapshot of the data. Save the query to enable live refresh.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveApp} disabled={!appName.trim() || saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
