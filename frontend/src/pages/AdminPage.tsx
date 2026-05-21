import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, IconButton, MenuItem, Paper, Snackbar, Stack, Switch, Tab, Table,
  TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api, AdminUser, AppSummary, PlatformSettings, TemplateSummary } from '../api/client';

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
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => { api.getSettings().then(setSettings).catch(() => undefined); }, []);

  if (!settings) return null;
  const save = async () => {
    const updated = await api.updateSettings(settings);
    setSettings(updated);
    setToast('Settings saved');
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 460 }}>
      <TextField label="Platform name" size="small" value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
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
        <Tab label="Settings" />
      </Tabs>
      <Divider sx={{ mb: 2 }} />
      {tab === 0 && <UsersTab />}
      {tab === 1 && <TemplatesTab />}
      {tab === 2 && <SettingsTab />}
    </Box>
  );
}
