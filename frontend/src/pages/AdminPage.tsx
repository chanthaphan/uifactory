import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, IconButton, MenuItem, Paper, Snackbar, Stack, Switch, Tab, Table,
  TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api, AdminUser, AppSummary, Connector, DataSourceType, PlatformSettings, TemplateSummary } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import BrandLogo from '../components/BrandLogo';

const DS_TYPE_LABEL: Record<DataSourceType, string> = { REST: 'REST API', POSTGRES: 'PostgreSQL', SQLITE: 'SQLite', MSGRAPH: 'Microsoft 365' };

function ConnectorsTab() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ name: '', description: '', category: '', type: 'REST' as DataSourceType, baseUrl: '', connectionString: '', file: '', headers: '' });

  const load = () => api.listConnectors().then(setConnectors).catch((e) => setError(api.errMessage(e)));
  useEffect(() => { load(); }, []);

  const configFromForm = (): Record<string, unknown> => {
    if (form.type === 'REST') {
      const cfg: Record<string, unknown> = { baseUrl: form.baseUrl.trim() };
      if (form.headers.trim()) { try { cfg.headers = JSON.parse(form.headers); } catch { /* ignore invalid */ } }
      return cfg;
    }
    if (form.type === 'POSTGRES') return { connectionString: form.connectionString.trim() };
    if (form.type === 'MSGRAPH') return {};
    return { file: form.file.trim() };
  };

  const create = async () => {
    setError('');
    try {
      await api.createConnector({ name: form.name.trim(), description: form.description || undefined, category: form.category || undefined, type: form.type, config: configFromForm() });
      setForm({ name: '', description: '', category: '', type: form.type, baseUrl: '', connectionString: '', file: '', headers: '' });
      setToast('Connector created');
      await load();
    } catch (e) { setError(api.errMessage(e)); }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this connector? Apps already using a copy are unaffected.')) return;
    await api.deleteConnector(id);
    await load();
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Prebuilt connectors are reusable data-source configs any member can clone into their app (Data panel → “Add a prebuilt connector”). Secrets are encrypted and never shown.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mb: 3 }}>
        <Stack spacing={1.2} sx={{ flex: 1 }}>
          <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField size="small" label="Category (optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <TextField size="small" label="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField select size="small" label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DataSourceType })}>
            <MenuItem value="REST">REST API</MenuItem>
            <MenuItem value="POSTGRES">PostgreSQL</MenuItem>
            <MenuItem value="SQLITE">SQLite</MenuItem>
            <MenuItem value="MSGRAPH">Microsoft 365 (Graph)</MenuItem>
          </TextField>
        </Stack>
        <Stack spacing={1.2} sx={{ flex: 1 }}>
          {form.type === 'REST' && <>
            <TextField size="small" label="Base URL" placeholder="https://api.example.com" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            <TextField size="small" label="Default headers (JSON, optional)" placeholder='{"Authorization":"Bearer …"}' value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} multiline minRows={2} />
          </>}
          {form.type === 'POSTGRES' && <TextField size="small" label="Connection string" value={form.connectionString} onChange={(e) => setForm({ ...form, connectionString: e.target.value })} />}
          {form.type === 'SQLITE' && <TextField size="small" label="SQLite file path" value={form.file} onChange={(e) => setForm({ ...form, file: e.target.value })} />}
          {form.type === 'MSGRAPH' && <Alert severity="info">Uses the platform's Azure AD app — no config needed.</Alert>}
          <Box textAlign="right"><Button variant="contained" disabled={!form.name.trim()} onClick={create}>Create connector</Button></Box>
        </Stack>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>Category</TableCell><TableCell /></TableRow>
          </TableHead>
          <TableBody>
            {connectors.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}{c.description ? <Typography variant="caption" display="block" color="text.secondary">{c.description}</Typography> : null}</TableCell>
                <TableCell><Chip size="small" label={DS_TYPE_LABEL[c.type]} /></TableCell>
                <TableCell>{c.category}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => remove(c.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
            {connectors.length === 0 && <TableRow><TableCell colSpan={4}><Typography variant="caption" color="text.secondary">No connectors yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const load = () => api.listUsers().then(setUsers).catch((e) => setError(api.errMessage(e)));
  useEffect(() => { load(); }, []);

  const update = async (id: string, body: { role?: 'admin' | 'member'; active?: boolean }) => {
    try {
      await api.updateUser(id, body);
      await load();
    } catch (e) {
      setError(api.errMessage(e));
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <TextField select size="small" value={u.role} onChange={(e) => update(u.id, { role: e.target.value as 'admin' | 'member' })} sx={{ width: 120 }}>
                    <MenuItem value="admin">admin</MenuItem>
                    <MenuItem value="member">member</MenuItem>
                  </TextField>
                </TableCell>
                <TableCell><Switch checked={u.active} onChange={(e) => update(u.id, { active: e.target.checked })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [fromApp, setFromApp] = useState('');
  const [toast, setToast] = useState('');
  const load = () => api.listTemplates().then(setTemplates).catch(() => undefined);
  useEffect(() => {
    load();
    api.listMyApps().then(setApps).catch(() => undefined);
  }, []);

  const createFromApp = async () => {
    if (!fromApp) return;
    await api.createTemplateFromApp(fromApp, {});
    setFromApp('');
    setToast('Template created');
    await load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.deleteTemplate(id);
    await load();
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} mb={2} alignItems="center">
        <TextField select size="small" label="Create template from app" value={fromApp} onChange={(e) => setFromApp(e.target.value)} sx={{ minWidth: 260 }}>
          <MenuItem value="">Select an app…</MenuItem>
          {apps.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
        </TextField>
        <Button variant="contained" disabled={!fromApp} onClick={createFromApp}>Create</Button>
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Name</TableCell><TableCell>Category</TableCell><TableCell>Pages</TableCell><TableCell /></TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.category && <Chip size="small" label={t.category} />}</TableCell>
                <TableCell>{t.pageCount}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => remove(t.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}

function SettingsTab() {
  const { refresh } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => { api.getSettings().then(setSettings).catch(() => undefined); }, []);

  if (!settings) return null;
  const save = async () => {
    const updated = await api.updateSettings(settings);
    setSettings(updated);
    await refresh().catch(() => undefined); // update the nav bar / login branding immediately
    setToast('Settings saved');
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 460 }}>
      <TextField label="Platform name" size="small" value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
      <Stack direction="row" spacing={1.5} alignItems="center">
        <BrandLogo logo={settings.platformLogo} brandColor={settings.platformBrandColor} name={settings.platformName} size={44} />
        <TextField fullWidth size="small" label="Platform logo (image URL, or a letter/emoji)" placeholder="https://…/logo.png  or  🏦" value={settings.platformLogo} onChange={(e) => setSettings({ ...settings, platformLogo: e.target.value })} />
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField size="small" label="Brand color (used when no logo image)" placeholder="#3a64f0" value={settings.platformBrandColor} onChange={(e) => setSettings({ ...settings, platformBrandColor: e.target.value })} sx={{ flex: 1 }} />
        <Box component="input" type="color" value={settings.platformBrandColor || '#3a64f0'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, platformBrandColor: e.target.value })} sx={{ width: 44, height: 40, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0, bgcolor: 'transparent' }} />
      </Stack>
      <TextField select label="Default visibility for new shares" size="small" value={settings.defaultVisibility} onChange={(e) => setSettings({ ...settings, defaultVisibility: e.target.value as PlatformSettings['defaultVisibility'] })}>
        <MenuItem value="private">private</MenuItem>
        <MenuItem value="org">org</MenuItem>
        <MenuItem value="public">public</MenuItem>
      </TextField>
      <TextField select label="Default AI provider" size="small" value={settings.defaultAiProvider} onChange={(e) => setSettings({ ...settings, defaultAiProvider: e.target.value })}>
        <MenuItem value="auto">auto-detect</MenuItem>
        <MenuItem value="anthropic">anthropic</MenuItem>
        <MenuItem value="openai">openai</MenuItem>
        <MenuItem value="azure-openai">azure-openai</MenuItem>
      </TextField>
      <Alert severity="info">Provider API keys are configured per-app or via server environment variables, not here.</Alert>
      <Box><Button variant="contained" onClick={save}>Save settings</Button></Box>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} message={toast} />
    </Stack>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Admin</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Users" />
        <Tab label="Templates" />
        <Tab label="Connectors" />
        <Tab label="Settings" />
      </Tabs>
      <Divider sx={{ mb: 2 }} />
      {tab === 0 && <UsersTab />}
      {tab === 1 && <TemplatesTab />}
      {tab === 2 && <ConnectorsTab />}
      {tab === 3 && <SettingsTab />}
    </Box>
  );
}
