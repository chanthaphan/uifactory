import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BoltIcon from '@mui/icons-material/Bolt';
import { api, Connector, DataSource, DataSourceAuthMode, DataSourceType, QueryDef } from '../api/client';
import ResultView from './ResultView';
import CredentialsManager from './CredentialsManager';

const TYPE_LABEL: Record<DataSourceType, string> = { REST: 'REST API', POSTGRES: 'PostgreSQL', SQLITE: 'SQLite', MSGRAPH: 'Microsoft 365' };

function dsConfigFromForm(type: DataSourceType, f: { baseUrl: string; connectionString: string; file: string; headers: string; forwardIdentity: boolean; identityHeader: string }): Record<string, unknown> {
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

const EMPTY_DS_FORM = { baseUrl: '', connectionString: '', file: '', headers: '', forwardIdentity: false, identityHeader: '' };

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

  const addDataSource = async () => {
    setError('');
    try {
      await api.createDataSource(appId, { name: dsName.trim(), type: dsType, config: dsConfigFromForm(dsType, dsForm), authMode: dsAuthMode });
      setDsName(''); setDsForm({ ...EMPTY_DS_FORM }); setDsAuthMode('shared');
      load(); onChanged(); notify('Data source added');
    } catch (e) { setError(api.errMessage(e)); }
  };
  const perUserCapable = dsType === 'REST' || dsType === 'POSTGRES';
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
  const addQuery = async () => {
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
      await api.createQuery(appId, { name: qName.trim(), dataSourceId: qDs, config });
      setQName(''); setQResult(null); setQBody(''); setQSchema('');
      load(); onChanged(); notify('Query saved');
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
        <Typography variant="h6" gutterBottom>Data &amp; Queries</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}

        <Typography variant="subtitle2" gutterBottom>Data sources</Typography>
        <Stack spacing={1} mb={1}>
          {dataSources.map((d) => (
            <Stack key={d.id} direction="row" alignItems="center" spacing={1}>
              <Chip size="small" label={TYPE_LABEL[d.type]} />
              {d.authMode === 'per-user' && <Chip size="small" color="warning" variant="outlined" label="per-user" />}
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{d.name}</Typography>
              <IconButton size="small" title="Test" onClick={async () => { try { const r = await api.testDataSource(appId, d.id); notify(r.message); } catch (e) { setError(api.errMessage(e)); } }}><BoltIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => removeDs(d.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {dataSources.length === 0 && <Typography variant="caption" color="text.secondary">No data sources yet.</Typography>}
        </Stack>
        {connectors.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <TextField select size="small" label="Add a prebuilt connector" value={connectorId} onChange={(e) => setConnectorId(e.target.value)} fullWidth>
              <MenuItem value="">Select…</MenuItem>
              {connectors.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name} · {TYPE_LABEL[c.type]}{c.category ? ` · ${c.category}` : ''}</MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!connectorId} onClick={addFromConnector}>Add</Button>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>…or configure one manually:</Typography>
        <Stack spacing={1.2} sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mb: 3 }}>
          <TextField size="small" label="Name" value={dsName} onChange={(e) => setDsName(e.target.value)} />
          <TextField select size="small" label="Type" value={dsType} onChange={(e) => setDsType(e.target.value as DataSourceType)}>
            <MenuItem value="SQLITE">SQLite</MenuItem>
            <MenuItem value="POSTGRES">PostgreSQL</MenuItem>
            <MenuItem value="REST">REST API</MenuItem>
            <MenuItem value="MSGRAPH">Microsoft 365 (Graph)</MenuItem>
          </TextField>
          {dsType === 'SQLITE' && <TextField size="small" label="SQLite file path" value={dsForm.file} onChange={(e) => setDsForm({ ...dsForm, file: e.target.value })} />}
          {dsType === 'POSTGRES' && <TextField size="small" label="Connection string" value={dsForm.connectionString} onChange={(e) => setDsForm({ ...dsForm, connectionString: e.target.value })} />}
          {dsType === 'REST' && <TextField size="small" label="Base URL" placeholder="https://api.example.com" value={dsForm.baseUrl} onChange={(e) => setDsForm({ ...dsForm, baseUrl: e.target.value })} />}
          {dsType === 'MSGRAPH' && <Typography variant="caption" color="text.secondary">Uses the platform's Azure AD app. No config needed.</Typography>}
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
            <Button size="small" onClick={testNew}>Test</Button>
            <Box flexGrow={1} />
            <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={!dsName.trim()} onClick={addDataSource}>Add</Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" gutterBottom>Queries</Typography>
        <Stack spacing={1} mb={1}>
          {queries.map((q) => (
            <Stack key={q.id} direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{q.name}</Typography>
              <IconButton size="small" title="Run" onClick={() => runQ(q.id)}><PlayArrowIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => removeQ(q.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {queries.length === 0 && <Typography variant="caption" color="text.secondary">No queries yet.</Typography>}
        </Stack>
        {qResult != null && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mb: 1 }}><ResultView data={qResult} /></Box>}
        <Stack spacing={1.2} sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
          <TextField size="small" label="Query name" value={qName} onChange={(e) => setQName(e.target.value)} />
          <TextField select size="small" label="Data source" value={qDs} onChange={(e) => setQDs(e.target.value)}>
            <MenuItem value="">Select…</MenuItem>
            {dataSources.map((d) => <MenuItem key={d.id} value={d.id}>{d.name} · {TYPE_LABEL[d.type]}</MenuItem>)}
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
          <Box textAlign="right">
            <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={!qName.trim() || !qDs} onClick={addQuery}>Save query</Button>
          </Box>
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
