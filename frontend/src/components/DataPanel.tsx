import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BoltIcon from '@mui/icons-material/Bolt';
import { api, Connector, DataSource, DataSourceAuthMode, DataSourceType, QueryDef } from '../api/client';
import ResultView from './ResultView';
import CredentialsManager from './CredentialsManager';

const TYPE_LABEL: Record<DataSourceType, string> = { REST: 'REST API', POSTGRES: 'PostgreSQL', SQLITE: 'SQLite', MSGRAPH: 'Microsoft 365', AGENT: 'Agent API' };

function dsConfigFromForm(type: DataSourceType, f: { baseUrl: string; connectionString: string; file: string; headers: string; forwardIdentity: boolean; identityHeader: string; agentUrl: string; agentApiKey: string; agentAuthHeader: string }): Record<string, unknown> {
  if (type === 'AGENT') {
    const cfg: Record<string, unknown> = { url: f.agentUrl.trim() };
    if (f.agentApiKey.trim()) cfg.apiKey = f.agentApiKey.trim();
    if (f.agentAuthHeader.trim()) cfg.authHeader = f.agentAuthHeader.trim();
    return cfg;
  }
  if (type === 'REST') {
    const cfg: Record<string, unknown> = { baseUrl: f.baseUrl.trim() };
    if (f.headers.trim()) cfg.headers = JSON.parse(f.headers);
    if (f.forwardIdentity) {
      cfg.forwardIdentity = true;
      if (f.identityHeader.trim()) cfg.identityHeader = f.identityHeader.trim();
    }
    return cfg;
  }
  if (type === 'POSTGRES') return { connectionString: f.connectionString.trim() };
  if (type === 'MSGRAPH') return {};
  return { file: f.file.trim() };
}

const EMPTY_DS_FORM = { baseUrl: '', connectionString: '', file: '', headers: '', forwardIdentity: false, identityHeader: '', agentUrl: '', agentApiKey: '', agentAuthHeader: '' };

/** Map a stored (redacted) config back into the manual form fields for editing. Masked secrets are
 * kept verbatim — leaving them unchanged tells the backend to preserve the stored secret. */
function dsFormFromConfig(type: DataSourceType, config: Record<string, unknown>): typeof EMPTY_DS_FORM {
  const f = { ...EMPTY_DS_FORM };
  const s = (v: unknown) => (v == null ? '' : String(v));
  if (type === 'REST') {
    f.baseUrl = s(config.baseUrl);
    f.headers = config.headers ? JSON.stringify(config.headers) : '';
    f.forwardIdentity = !!config.forwardIdentity;
    f.identityHeader = s(config.identityHeader);
  } else if (type === 'POSTGRES') {
    f.connectionString = s(config.connectionString);
  } else if (type === 'SQLITE') {
    f.file = s(config.file);
  } else if (type === 'AGENT') {
    f.agentUrl = s(config.url);
    f.agentApiKey = s(config.apiKey);
    f.agentAuthHeader = s(config.authHeader);
  }
  return f;
}

/** Whether the required config field for the given type is filled in (MSGRAPH needs none). */
function dsConfigValid(type: DataSourceType, f: typeof EMPTY_DS_FORM): boolean {
  if (type === 'REST') return !!f.baseUrl.trim();
  if (type === 'POSTGRES') return !!f.connectionString.trim();
  if (type === 'SQLITE') return !!f.file.trim();
  if (type === 'AGENT') return !!f.agentUrl.trim();
  return true; // MSGRAPH uses the platform's Azure AD app — no config needed
}

export default function DataPanel({ appId, open, onClose, onChanged }: { appId: string; open: boolean; onClose: () => void; onChanged: () => void }) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorId, setConnectorId] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // data source form
  const [dsName, setDsName] = useState('');
  const [dsType, setDsType] = useState<DataSourceType>('SQLITE');
  const [dsForm, setDsForm] = useState({ ...EMPTY_DS_FORM });
  const [dsAuthMode, setDsAuthMode] = useState<DataSourceAuthMode>('shared');
  const [editingDsId, setEditingDsId] = useState<string | null>(null);
  const [editingQId, setEditingQId] = useState<string | null>(null);

  // query form
  const [qName, setQName] = useState('');
  const [qDs, setQDs] = useState('');
  const [qSql, setQSql] = useState('SELECT 1;');
  const [qMethod, setQMethod] = useState('GET');
  const [qPath, setQPath] = useState('');
  const [qBody, setQBody] = useState('');
  const [qSchema, setQSchema] = useState('');
  const [qResult, setQResult] = useState<unknown>(null);

  const load = () => {
    api.listDataSources(appId).then(setDataSources).catch((e) => setError(api.errMessage(e)));
    api.listQueries(appId).then(setQueries).catch(() => undefined);
    api.listConnectors().then(setConnectors).catch(() => undefined);
  };
  useEffect(() => {
    if (open) load();
  }, [open, appId]); // eslint-disable-line react-hooks/exhaustive-deps

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const resetDsForm = () => { setEditingDsId(null); setDsName(''); setDsType('SQLITE'); setDsForm({ ...EMPTY_DS_FORM }); setDsAuthMode('shared'); };
  const startEditDs = (d: DataSource) => {
    setError('');
    setEditingDsId(d.id);
    setDsName(d.name);
    setDsType(d.type);
    setDsAuthMode(d.authMode || 'shared');
    setDsForm(dsFormFromConfig(d.type, d.config));
  };
  const submitDs = async () => {
    setError('');
    try {
      const config = dsConfigFromForm(dsType, dsForm);
      if (editingDsId) {
        await api.updateDataSource(appId, editingDsId, { name: dsName.trim(), config, authMode: dsAuthMode });
        notify('Connector updated');
      } else {
        await api.createDataSource(appId, { name: dsName.trim(), type: dsType, config, authMode: dsAuthMode });
        notify('Connector added');
      }
      resetDsForm();
      load(); onChanged();
    } catch (e) { setError(api.errMessage(e)); }
  };
  const perUserCapable = dsType === 'REST' || dsType === 'POSTGRES';
  const isAgent = dsType === 'AGENT';
  const addFromConnector = async () => {
    if (!connectorId) return;
    setError('');
    try {
      await api.addConnectorToApp(appId, connectorId);
      setConnectorId('');
      load(); onChanged(); notify('Connector added to app');
    } catch (e) { setError(api.errMessage(e)); }
  };
  const testNew = async () => {
    setError('');
    try {
      const r = await api.testInline(appId, { type: dsType, config: dsConfigFromForm(dsType, dsForm) });
      notify(r.message);
    } catch (e) { setError(api.errMessage(e)); }
  };
  const removeDs = async (id: string) => { await api.deleteDataSource(appId, id); load(); onChanged(); };

  const selectedDsType = dataSources.find((d) => d.id === qDs)?.type;
  const isSql = selectedDsType === 'SQLITE' || selectedDsType === 'POSTGRES';
  const resetQForm = () => { setEditingQId(null); setQName(''); setQDs(''); setQSql('SELECT 1;'); setQMethod('GET'); setQPath(''); setQBody(''); setQSchema(''); setQResult(null); };
  const startEditQ = (q: QueryDef) => {
    setError('');
    setEditingQId(q.id);
    setQName(q.name);
    setQDs(q.dataSourceId);
    setQResult(null);
    const dsT = dataSources.find((d) => d.id === q.dataSourceId)?.type;
    if (dsT === 'SQLITE' || dsT === 'POSTGRES') {
      setQSql(String(q.config.sql ?? 'SELECT 1;'));
    } else {
      setQMethod(String(q.config.method ?? 'GET'));
      setQPath(String(q.config.path ?? ''));
      setQBody(q.config.body == null ? '' : (typeof q.config.body === 'string' ? q.config.body : JSON.stringify(q.config.body)));
      setQSchema(String(q.config.schema ?? ''));
    }
  };
  const submitQuery = async () => {
    setError('');
    let config: Record<string, unknown>;
    if (isSql) {
      config = { sql: qSql };
    } else {
      config = { method: qMethod, path: qPath };
      if (qMethod !== 'GET' && qBody.trim()) {
        try { config.body = JSON.parse(qBody); } catch { config.body = qBody; }
      }
      if (qSchema.trim()) config.schema = qSchema.trim();
    }
    try {
      if (editingQId) {
        await api.updateQuery(appId, editingQId, { name: qName.trim(), dataSourceId: qDs, config });
        notify('Query updated');
      } else {
        await api.createQuery(appId, { name: qName.trim(), dataSourceId: qDs, config });
        notify('Query saved');
      }
      resetQForm();
      load(); onChanged();
    } catch (e) { setError(api.errMessage(e)); }
  };
  const runQ = async (id: string) => {
    setError('');
    try {
      const r = await api.runQuery(appId, id);
      setQResult(r.data);
    } catch (e) { setError(api.errMessage(e)); }
  };
  const removeQ = async (id: string) => { await api.deleteQuery(appId, id); load(); onChanged(); };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 460, p: 3 }}>
        <Typography variant="h6" gutterBottom>Connectors</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

        <Typography variant="subtitle2" gutterBottom>Connectors</Typography>
        <Stack spacing={1} mb={1}>
          {dataSources.map((d) => (
            <Stack key={d.id} direction="row" alignItems="center" spacing={1}>
              <Chip size="small" label={TYPE_LABEL[d.type]} />
              {d.authMode === 'per-user' && <Chip size="small" color="warning" variant="outlined" label="per-user" />}
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{d.name}</Typography>
              <IconButton size="small" title="Edit" color={editingDsId === d.id ? 'primary' : 'default'} onClick={() => startEditDs(d)}><EditOutlinedIcon fontSize="small" /></IconButton>
              <IconButton size="small" title="Test" onClick={async () => { try { const r = await api.testDataSource(appId, d.id); notify(r.message); } catch (e) { setError(api.errMessage(e)); } }}><BoltIcon fontSize="small" /></IconButton>
              <IconButton size="small" title="Delete" onClick={() => removeDs(d.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {dataSources.length === 0 && <Typography variant="caption" color="text.secondary">No connectors yet.</Typography>}
        </Stack>
        {connectors.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <TextField select size="small" label="Add from connector library" value={connectorId} onChange={(e) => setConnectorId(e.target.value)} fullWidth>
              <MenuItem value="">Select…</MenuItem>
              {connectors.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name} · {TYPE_LABEL[c.type]}{c.category ? ` · ${c.category}` : ''}</MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!connectorId} onClick={addFromConnector}>Add</Button>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{editingDsId ? '' : '…or configure one manually:'}</Typography>
        <Stack spacing={1.2} sx={{ p: 1.5, border: '1px dashed', borderColor: editingDsId ? 'primary.main' : 'divider', borderRadius: 1, mb: 3 }}>
          {editingDsId && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Editing connector</Typography>
              <Button size="small" onClick={resetDsForm}>Cancel</Button>
            </Stack>
          )}
          <TextField size="small" required label="Name" value={dsName} onChange={(e) => setDsName(e.target.value)} />
          <TextField select size="small" label="Type" value={dsType} disabled={!!editingDsId} helperText={editingDsId ? 'Type cannot be changed after creation' : undefined} onChange={(e) => setDsType(e.target.value as DataSourceType)}>
            <MenuItem value="SQLITE">SQLite</MenuItem>
            <MenuItem value="POSTGRES">PostgreSQL</MenuItem>
            <MenuItem value="REST">REST API</MenuItem>
            <MenuItem value="MSGRAPH">Microsoft 365 (Graph)</MenuItem>
            <MenuItem value="AGENT">Agent API (conversational)</MenuItem>
          </TextField>
          {dsType === 'SQLITE' && <TextField size="small" required label="SQLite file path" value={dsForm.file} onChange={(e) => setDsForm({ ...dsForm, file: e.target.value })} />}
          {dsType === 'POSTGRES' && <TextField size="small" required label="Connection string" value={dsForm.connectionString} helperText={editingDsId ? 'Leave the masked value to keep the current secret' : undefined} onChange={(e) => setDsForm({ ...dsForm, connectionString: e.target.value })} />}
          {dsType === 'REST' && (
            <>
              <TextField size="small" required label="Base URL" placeholder="https://api.example.com" value={dsForm.baseUrl} onChange={(e) => setDsForm({ ...dsForm, baseUrl: e.target.value })} />
              <TextField size="small" label="Default headers (JSON, optional)" placeholder='{"Authorization":"Bearer …"}' value={dsForm.headers} onChange={(e) => setDsForm({ ...dsForm, headers: e.target.value })} multiline minRows={2} />
            </>
          )}
          {dsType === 'MSGRAPH' && <Typography variant="caption" color="text.secondary">Uses the platform's Azure AD app. No config needed.</Typography>}
          {isAgent && (
            <>
              <TextField size="small" required label="Agent endpoint URL" placeholder="https://your-agent.example.com" value={dsForm.agentUrl} onChange={(e) => setDsForm({ ...dsForm, agentUrl: e.target.value })} />
              <TextField size="small" label="API key (optional)" type="password" value={dsForm.agentApiKey} helperText={editingDsId ? 'Leave unchanged to keep the current key' : undefined} onChange={(e) => setDsForm({ ...dsForm, agentApiKey: e.target.value })} />
              <TextField size="small" label="Auth header name (optional)" placeholder="Authorization" value={dsForm.agentAuthHeader} onChange={(e) => setDsForm({ ...dsForm, agentAuthHeader: e.target.value })} />
              <Typography variant="caption" color="text.secondary">
                UIFactory will POST <code>{'{ messages, message, conversationId, system, data, user }'}</code> to this endpoint for each chat turn.
              </Typography>
            </>
          )}
          {perUserCapable && (
            <FormControlLabel
              control={<Switch size="small" checked={dsAuthMode === 'per-user'} onChange={(e) => setDsAuthMode(e.target.checked ? 'per-user' : 'shared')} />}
              label={<Typography variant="caption">Each user provides their own credentials{dsType === 'REST' ? ' (token/header)' : ' (connection string)'}</Typography>}
            />
          )}
          {dsType === 'REST' && (
            <>
              <FormControlLabel
                control={<Switch size="small" checked={dsForm.forwardIdentity} onChange={(e) => setDsForm({ ...dsForm, forwardIdentity: e.target.checked })} />}
                label={<Typography variant="caption">Forward signed user identity (a JWT the API can verify)</Typography>}
              />
              {dsForm.forwardIdentity && (
                <TextField size="small" label="Identity header name" placeholder="X-UIFactory-User" value={dsForm.identityHeader} onChange={(e) => setDsForm({ ...dsForm, identityHeader: e.target.value })} />
              )}
              <Typography variant="caption" color="text.secondary">
                Queries can also use <code>{'{{user_email}}'}</code>, <code>{'{{user_id}}'}</code>, <code>{'{{user_name}}'}</code> in the path/body — the platform fills these from the signed-in user.
              </Typography>
            </>
          )}
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={!dsConfigValid(dsType, dsForm)} onClick={testNew}>Test</Button>
            <Box flexGrow={1} />
            {editingDsId && <Button size="small" onClick={resetDsForm}>Cancel</Button>}
            <Button size="small" variant="contained" startIcon={editingDsId ? undefined : <AddIcon />} disabled={!dsName.trim() || !dsConfigValid(dsType, dsForm)} onClick={submitDs}>{editingDsId ? 'Save changes' : 'Add'}</Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" gutterBottom>Queries</Typography>
        <Stack spacing={1} mb={1}>
          {queries.map((q) => (
            <Stack key={q.id} direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{q.name}</Typography>
              <IconButton size="small" title="Edit" color={editingQId === q.id ? 'primary' : 'default'} onClick={() => startEditQ(q)}><EditOutlinedIcon fontSize="small" /></IconButton>
              <IconButton size="small" title="Run" onClick={() => runQ(q.id)}><PlayArrowIcon fontSize="small" /></IconButton>
              <IconButton size="small" title="Delete" onClick={() => removeQ(q.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {queries.length === 0 && <Typography variant="caption" color="text.secondary">No queries yet.</Typography>}
        </Stack>
        {qResult != null && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mb: 1 }}><ResultView data={qResult} /></Box>}
        <Stack spacing={1.2} sx={{ p: 1.5, border: '1px dashed', borderColor: editingQId ? 'primary.main' : 'divider', borderRadius: 1 }}>
          {editingQId && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Editing query</Typography>
              <Button size="small" onClick={resetQForm}>Cancel</Button>
            </Stack>
          )}
          <TextField size="small" label="Query name" value={qName} onChange={(e) => setQName(e.target.value)} />
          <TextField select size="small" label="Connector" value={qDs} onChange={(e) => setQDs(e.target.value)}>
            <MenuItem value="">Select…</MenuItem>
            {dataSources.filter((d) => d.type !== 'AGENT').map((d) => <MenuItem key={d.id} value={d.id}>{d.name} · {TYPE_LABEL[d.type]}</MenuItem>)}
          </TextField>
          {isSql && (
            <TextField label="SQL" value={qSql} onChange={(e) => setQSql(e.target.value)} multiline minRows={3} size="small" slotProps={{ input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } } }} />
          )}
          {(selectedDsType === 'REST' || selectedDsType === 'MSGRAPH') && (
            <>
              <Stack direction="row" spacing={1}>
                <TextField select size="small" label="Method" value={qMethod} onChange={(e) => setQMethod(e.target.value)} sx={{ width: 110 }}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <TextField size="small" fullWidth label={selectedDsType === 'MSGRAPH' ? 'Graph path (e.g. users)' : 'Path (e.g. /users)'} value={qPath} onChange={(e) => setQPath(e.target.value)} />
              </Stack>
              {qMethod !== 'GET' && (
                <TextField size="small" label="Request body (JSON, supports {{params}})" value={qBody} onChange={(e) => setQBody(e.target.value)} multiline minRows={2} slotProps={{ input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 } } }} />
              )}
              <TextField size="small" label="API schema / usage guidance (steers the AI)" placeholder="e.g. Returns [{id,name,email}]. Use email as the unique key; status is one of active|pending." value={qSchema} onChange={(e) => setQSchema(e.target.value)} multiline minRows={2} />
            </>
          )}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {editingQId && <Button size="small" onClick={resetQForm}>Cancel</Button>}
            <Button size="small" variant="contained" startIcon={editingQId ? undefined : <AddIcon />} disabled={!qName.trim() || !qDs} onClick={submitQuery}>{editingQId ? 'Save changes' : 'Save query'}</Button>
          </Stack>
        </Stack>

        {dataSources.some((d) => d.authMode === 'per-user') && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Your credentials</Typography>
            <CredentialsManager appId={appId} />
          </>
        )}
      </Box>
    </Drawer>
  );
}
