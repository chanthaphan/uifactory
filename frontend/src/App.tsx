import { AppBar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AppsIcon from '@mui/icons-material/Apps';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, AiStatus, PROVIDER_LABEL } from './api/client';
import DataSourcesPage from './pages/DataSourcesPage';
import BuilderPage from './pages/BuilderPage';
import AppsPage from './pages/AppsPage';
import AppRunnerPage from './pages/AppRunnerPage';

const NAV = [
  { to: '/', label: 'Builder', icon: <AutoAwesomeIcon fontSize="small" /> },
  { to: '/datasources', label: 'Data Sources', icon: <StorageIcon fontSize="small" /> },
  { to: '/apps', label: 'My Apps', icon: <AppsIcon fontSize="small" /> },
];

function NavBar() {
  const location = useLocation();
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    api.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, provider: null, model: null }));
  }, []);

  const aiLabel = (() => {
    if (!aiStatus) return 'AI…';
    if (aiStatus.configured && aiStatus.provider) return `${PROVIDER_LABEL[aiStatus.provider]} connected`;
    return 'AI: template mode';
  })();

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
      <Toolbar>
        <Box
          sx={{
            width: 30, height: 30, borderRadius: 1.5, mr: 1.5,
            background: 'linear-gradient(135deg,#3a64f0,#7c4dff)', color: '#fff',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16,
          }}
        >
          U
        </Box>
        <Typography variant="h6" sx={{ mr: 4 }}>
          UIFactory
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
          {NAV.map((n) => {
            const active = n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to);
            return (
              <Button
                key={n.to}
                component={Link}
                to={n.to}
                startIcon={n.icon}
                color={active ? 'primary' : 'inherit'}
                variant={active ? 'outlined' : 'text'}
              >
                {n.label}
              </Button>
            );
          })}
        </Stack>
        <Chip
          size="small"
          color={aiStatus?.configured ? 'success' : 'default'}
          variant={aiStatus?.configured ? 'filled' : 'outlined'}
          label={aiLabel}
        />
      </Toolbar>
    </AppBar>
  );
}

export default function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <NavBar />
      <Routes>
        <Route path="/run/:id" element={<AppRunnerPage />} />
        <Route
          path="*"
          element={
            <Container maxWidth="xl" sx={{ py: 3 }}>
              <Routes>
                <Route path="/" element={<BuilderPage />} />
                <Route path="/datasources" element={<DataSourcesPage />} />
                <Route path="/apps" element={<AppsPage />} />
              </Routes>
            </Container>
          }
        />
      </Routes>
    </Box>
  );
}
