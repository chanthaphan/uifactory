import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardActions, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { api, AppSummary, TemplateSummary } from '../api/client';

export default function MyAppsPage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = () => api.listMyApps().then(setApps).catch(() => setApps([]));
  useEffect(() => {
    load();
    api.listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const app = await api.createApp({ name: name.trim(), templateId: templateId || undefined });
      setOpen(false);
      setName('');
      setTemplateId('');
      navigate(`/build/${app.id}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this app?')) return;
    await api.deleteApp(id);
    await load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Build</Typography>
          <Typography variant="body2" color="text.secondary">Apps you own or can edit.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New app</Button>
      </Stack>

      <Grid container spacing={2}>
        {apps.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" spacing={1} mb={1}>
                  <Chip size="small" label={a.status} color={a.status === 'deployed' ? 'success' : 'default'} />
                  <Chip size="small" variant="outlined" label={a.visibility} />
                </Stack>
                <Typography variant="subtitle1" fontWeight={700}>{a.name}</Typography>
                <Typography variant="body2" color="text.secondary">{a.description || 'No description'}</Typography>
                <Typography variant="caption" color="text.secondary">{a.pageCount} pages · updated {new Date(a.updatedAt).toLocaleDateString()}</Typography>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<EditIcon />} onClick={() => navigate(`/build/${a.id}`)}>Edit</Button>
                {a.status === 'deployed' && (
                  <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/run/${a.slug}`)}>Open</Button>
                )}
                <Box flexGrow={1} />
                <IconButton size="small" onClick={() => remove(a.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {apps.length === 0 && (
          <Grid size={12}>
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No apps yet — create one to get started.</Typography>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New app</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField autoFocus label="App name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField select label="Start from" value={templateId} onChange={(e) => setTemplateId(e.target.value)} fullWidth>
              <MenuItem value="">Blank app</MenuItem>
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={!name.trim() || busy}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
