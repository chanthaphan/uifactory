import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { api, AppCredentialStatus } from '../api/client';

type FormState = Record<string, { token: string; headerName: string; connectionString: string }>;
const blank = { token: '', headerName: 'Authorization', connectionString: '' };

function buildConfig(type: string, f: { token: string; headerName: string; connectionString: string }): Record<string, unknown> | null {
  if (type === 'POSTGRES') {
    return f.connectionString.trim() ? { connectionString: f.connectionString.trim() } : null;
  }
  // REST (and Graph fall back to a header token)
  if (!f.token.trim()) return null;
  const header = f.headerName.trim() || 'Authorization';
  const value = header.toLowerCase() === 'authorization' ? `Bearer ${f.token.trim()}` : f.token.trim();
  return { headers: { [header]: value } };
}

/** Lets the current user manage their own credential for each per-user data source in an app. */
export default function CredentialsManager({ appId, onChanged }: { appId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<AppCredentialStatus[]>([]);
  const [form, setForm] = useState<FormState>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => api.listAppCredentials(appId).then(setItems).catch((e) => setError(api.errMessage(e)));
  useEffect(() => { load(); }, [appId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (id: string, patch: Partial<(typeof blank)>) =>
    setForm((s) => ({ ...s, [id]: { ...blank, ...s[id], ...patch } }));

  const save = async (it: AppCredentialStatus) => {
    setError(''); setMsg('');
    const config = buildConfig(it.type, form[it.dataSourceId] || blank);
    if (!config) { setError('Enter your credential first.'); return; }
    try {
      await api.setCredential(appId, it.dataSourceId, config);
      setForm((s) => ({ ...s, [it.dataSourceId]: { ...blank } }));
      setMsg(`Saved your credential for ${it.name}`);
      await load();
      onChanged?.();
    } catch (e) { setError(api.errMessage(e)); }
  };
  const clear = async (it: AppCredentialStatus) => {
    setError(''); setMsg('');
    try { await api.deleteCredential(appId, it.dataSourceId); await load(); onChanged?.(); } catch (e) { setError(api.errMessage(e)); }
  };

  if (!items.length) {
    return <Typography variant="caption" color="text.secondary">No data sources in this app require your personal credentials.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        These data sources connect with <strong>your own</strong> credentials. They are encrypted and only used for your sessions.
      </Typography>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {msg && <Alert severity="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {items.map((it) => {
        const f = form[it.dataSourceId] || blank;
        return (
          <Box key={it.dataSourceId} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <LockIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>{it.name}</Typography>
              <Chip size="small" color={it.hasCredential ? 'success' : 'default'} label={it.hasCredential ? 'Connected' : 'Not connected'} />
            </Stack>
            {it.type === 'POSTGRES' ? (
              <TextField size="small" fullWidth type="password" label="Your connection string" placeholder="leave blank to keep existing"
                value={f.connectionString} onChange={(e) => setField(it.dataSourceId, { connectionString: e.target.value })} />
            ) : (
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Header" sx={{ width: 150 }} value={f.headerName} onChange={(e) => setField(it.dataSourceId, { headerName: e.target.value })} />
                <TextField size="small" fullWidth type="password" label="API token / key" placeholder="leave blank to keep existing"
                  value={f.token} onChange={(e) => setField(it.dataSourceId, { token: e.target.value })} />
              </Stack>
            )}
            <Stack direction="row" spacing={1} mt={1} justifyContent="flex-end">
              {it.hasCredential && <Button size="small" color="inherit" onClick={() => clear(it)}>Disconnect</Button>}
              <Button size="small" variant="contained" onClick={() => save(it)}>{it.hasCredential ? 'Update' : 'Connect'}</Button>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
