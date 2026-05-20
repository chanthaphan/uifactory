import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import { api, DataSource, DataSourceType } from '../api/client';

const TYPE_LABEL: Record<DataSourceType, string> = {
  REST: 'REST API',
  POSTGRES: 'PostgreSQL',
  SQLITE: 'SQLite',
};
const TYPE_COLOR: Record<DataSourceType, 'primary' | 'secondary' | 'warning'> = {
  REST: 'primary',
  POSTGRES: 'secondary',
  SQLITE: 'warning',
};

interface FormState {
  name: string;
  type: DataSourceType;
  baseUrl: string;
  headers: string;
  connectionString: string;
  file: string;
}

const EMPTY: FormState = { name: '', type: 'REST', baseUrl: '', headers: '', connectionString: '', file: '' };

function buildConfig(f: FormState): Record<string, unknown> {
  if (f.type === 'REST') {
    const cfg: Record<string, unknown> = { baseUrl: f.baseUrl.trim() };
    if (f.headers.trim()) {
      try {
        cfg.headers = JSON.parse(f.headers);
      } catch {
        throw new Error('Headers must be valid JSON, e.g. {"Authorization":"Bearer ..."}');
      }
    }
    return cfg;
  }
  if (f.type === 'POSTGRES') return { connectionString: f.connectionString.trim() };
  return { file: f.file.trim() };
}

export default function DataSourcesPage() {
  const [items, setItems] = useState<DataSource[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.listDataSources().then(setItems).catch((e) => setError(api.errMessage(e)));
  useEffect(() => {
    load();
  }, []);

  const openDialog = () => {
    setForm(EMPTY);
    setTestMsg(null);
    setError('');
    setOpen(true);
  };

  const handleTest = async () => {
    setTestMsg(null);
    try {
      const res = await api.testInline({ name: form.name || 'test', type: form.type, config: buildConfig(form) });
      setTestMsg({ ok: res.ok, text: res.message });
    } catch (e) {
      setTestMsg({ ok: false, text: api.errMessage(e) });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.createDataSource({ name: form.name.trim(), type: form.type, config: buildConfig(form) });
      setOpen(false);
      await load();
    } catch (e) {
      setError(api.errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSaved = async (id: string) => {
    try {
      const res = await api.testDataSource(id);
      alert(res.ok ? `✓ ${res.message}` : res.message);
    } catch (e) {
      alert(api.errMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this data source and all its queries?')) return;
    await api.deleteDataSource(id);
    await load();
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Data Sources
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Connect the databases and APIs your apps will read from.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
          Add data source
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {items.map((ds) => (
          <Grid key={ds.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Chip size="small" color={TYPE_COLOR[ds.type]} label={TYPE_LABEL[ds.type]} />
                  <Stack direction="row">
                    <IconButton size="small" title="Test connection" onClick={() => handleTestSaved(ds.id)}>
                      <BoltIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Delete" onClick={() => handleDelete(ds.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                <Typography variant="subtitle1" fontWeight={700} mt={1}>
                  {ds.name}
                </Typography>
                <Box
                  component="pre"
                  sx={{ fontSize: 11.5, color: 'text.secondary', overflow: 'auto', m: 0, mt: 0.5 }}
                >
                  {JSON.stringify(ds.config, null, 2)}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {items.length === 0 && (
          <Grid size={12}>
            <Typography color="text.secondary">No data sources yet. Add one to get started.</Typography>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New data source</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as DataSourceType })}
              fullWidth
            >
              <MenuItem value="REST">REST API</MenuItem>
              <MenuItem value="POSTGRES">PostgreSQL</MenuItem>
              <MenuItem value="SQLITE">SQLite</MenuItem>
            </TextField>

            {form.type === 'REST' && (
              <>
                <TextField
                  label="Base URL"
                  placeholder="https://api.example.com"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Default headers (JSON, optional)"
                  placeholder='{"Authorization":"Bearer ..."}'
                  value={form.headers}
                  onChange={(e) => setForm({ ...form, headers: e.target.value })}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </>
            )}
            {form.type === 'POSTGRES' && (
              <TextField
                label="Connection string"
                placeholder="postgres://user:pass@host:5432/dbname"
                value={form.connectionString}
                onChange={(e) => setForm({ ...form, connectionString: e.target.value })}
                fullWidth
              />
            )}
            {form.type === 'SQLITE' && (
              <TextField
                label="SQLite file path"
                placeholder="/absolute/path/to/database.db"
                value={form.file}
                onChange={(e) => setForm({ ...form, file: e.target.value })}
                fullWidth
              />
            )}

            {testMsg && <Alert severity={testMsg.ok ? 'success' : 'error'}>{testMsg.text}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleTest}>Test connection</Button>
          <Box flexGrow={1} />
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim() || saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
