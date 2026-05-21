import { useState, MouseEvent, lazy, Suspense } from 'react';
import {
  AppBar, Avatar, Box, Button, CircularProgress, Container, Divider, ListItemIcon,
  Menu, MenuItem, Stack, Toolbar, Typography,
} from '@mui/material';
import AppsIcon from '@mui/icons-material/Apps';
import BuildIcon from '@mui/icons-material/Build';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import BrandLogo from './components/BrandLogo';
import LoginPage from './pages/LoginPage';

// Route-level code-splitting: heavy pages load on demand to shrink the initial bundle.
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const MyAppsPage = lazy(() => import('./pages/MyAppsPage'));
const AppEditorPage = lazy(() => import('./pages/AppEditorPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AppRunnerPage = lazy(() => import('./pages/AppRunnerPage'));

function PageLoader() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

function NavBar() {
  const { user, config, logout, isAdmin, canBuild } = useAuth();
  const location = useLocation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const nav = [
    { to: '/', label: 'Catalog', icon: <AppsIcon fontSize="small" /> },
    ...(canBuild ? [{ to: '/build', label: 'Build', icon: <BuildIcon fontSize="small" /> }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: <AdminPanelSettingsIcon fontSize="small" /> }] : []),
  ];
  const active = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
      <Toolbar>
        <Box sx={{ mr: 1.5, display: 'flex' }}>
          <BrandLogo logo={config?.platformLogo} brandColor={config?.platformBrandColor} name={config?.platformName} size={30} />
        </Box>
        <Typography variant="h6" sx={{ mr: 4 }}>
          {config?.platformName || 'UIFactory'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
          {nav.map((n) => (
            <Button key={n.to} component={Link} to={n.to} startIcon={n.icon} color={active(n.to) ? 'primary' : 'inherit'} variant={active(n.to) ? 'outlined' : 'text'}>
              {n.label}
            </Button>
          ))}
        </Stack>
        <Button onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)} startIcon={<Avatar sx={{ width: 26, height: 26, fontSize: 13 }}>{user?.name?.[0]?.toUpperCase()}</Avatar>} color="inherit">
          {user?.name}
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={700}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email} · {user?.role}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={logout}>
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

function Shell() {
  const { isAdmin, canBuild } = useAuth();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <NavBar />
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/build" element={canBuild ? <MyAppsPage /> : <Navigate to="/" replace />} />
            <Route path="/build/:id" element={canBuild ? <AppEditorPage /> : <Navigate to="/" replace />} />
            <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Container>
    </Box>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <LoginPage />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/run/:slug" element={<AppRunnerPage />} />
        <Route path="*" element={<Shell />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
