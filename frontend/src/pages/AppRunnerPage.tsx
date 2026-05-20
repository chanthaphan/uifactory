import { useEffect, useState } from 'react';
import { AppBar, Box, Button, Chip, CircularProgress, IconButton, Toolbar, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useParams } from 'react-router-dom';
import { api, AppDef } from '../api/client';
import PreviewFrame from '../components/PreviewFrame';

export default function AppRunnerPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppDef | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const a = await api.getApp(id);
      setApp(a);
      // Prefer live data from the bound query; fall back to the stored snapshot.
      if (a.definition.queryId) {
        try {
          const res = await api.getAppData(id);
          setData(res.data);
          setLive(res.data != null);
        } catch {
          setData(a.definition.sample ? JSON.parse(a.definition.sample) : null);
          setLive(false);
        }
      } else {
        setData(a.definition.sample ? JSON.parse(a.definition.sample) : null);
        setLive(false);
      }
    } catch (e) {
      setError(api.errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => navigate('/apps')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
            {app?.name ?? 'App'}
          </Typography>
          <Chip size="small" sx={{ mr: 1 }} label={live ? 'Live data' : 'Snapshot'} color={live ? 'success' : 'default'} />
          {app?.definition.queryId && (
            <Button size="small" startIcon={<RefreshIcon />} onClick={load}>
              Refresh
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Box sx={{ p: 4 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}
        {!loading && app?.definition.html && <PreviewFrame html={app.definition.html} data={data} height="100%" />}
      </Box>
    </Box>
  );
}
