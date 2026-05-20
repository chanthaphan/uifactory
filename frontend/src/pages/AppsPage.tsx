import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardActions, CardContent, Grid, IconButton, Stack, Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from 'react-router-dom';
import { api, AppDef } from '../api/client';

export default function AppsPage() {
  const [apps, setApps] = useState<AppDef[]>([]);
  const navigate = useNavigate();

  const load = () => api.listApps().then(setApps).catch(() => setApps([]));
  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this app?')) return;
    await api.deleteApp(id);
    await load();
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        My Apps
      </Typography>
      <Typography color="text.secondary" variant="body2" mb={2}>
        Apps you generated in the Builder. Open one to run it with live data.
      </Typography>

      <Grid container spacing={2}>
        {apps.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {a.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {a.definition.prompt || 'No description'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {a.definition.queryId ? 'Live data' : 'Snapshot'} · updated {new Date(a.updatedAt).toLocaleString()}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/run/${a.id}`)}>
                  Open
                </Button>
                <Box flexGrow={1} />
                <IconButton size="small" onClick={() => handleDelete(a.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {apps.length === 0 && (
          <Grid size={12}>
            <Stack alignItems="center" spacing={1} sx={{ py: 8, color: 'text.secondary' }}>
              <Typography>No apps yet.</Typography>
              <Button variant="contained" onClick={() => navigate('/')}>
                Open the Builder
              </Button>
            </Stack>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
