import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Grid, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChatIcon from '@mui/icons-material/Chat';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useNavigate } from 'react-router-dom';
import { api, AppSummary } from '../api/client';

const VIS_COLOR = { public: 'success', org: 'info', private: 'default' } as const;

export default function CatalogPage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.catalog().then(setApps).catch(() => setApps([]));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? apps.filter((a) => a.name.toLowerCase().includes(t) || (a.description || '').toLowerCase().includes(t)) : apps;
  }, [apps, q]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>App Catalog</Typography>
          <Typography variant="body2" color="text.secondary">Deployed apps shared with you and your organization.</Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search apps…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Stack>

      <Grid container spacing={2}>
        {filtered.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea sx={{ height: '100%' }} onClick={() => navigate(`/run/${a.slug}`)}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    {a.pageCount > 1 ? <DashboardIcon color="primary" /> : <ChatIcon color="secondary" />}
                    <Chip size="small" color={VIS_COLOR[a.visibility]} label={a.visibility} />
                  </Stack>
                  <Typography variant="subtitle1" fontWeight={700}>{a.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                    {a.description || 'No description'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.pageCount} page{a.pageCount === 1 ? '' : 's'} · by {a.owner.name}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {filtered.length === 0 && (
          <Grid size={12}>
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              No apps available yet. Build one in the Build tab and deploy it.
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
