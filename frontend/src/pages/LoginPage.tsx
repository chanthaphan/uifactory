import { useEffect, useState } from 'react';
import { Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import MicrosoftIcon from '@mui/icons-material/Window';
import { api, AdminUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import BrandLogo from '../components/BrandLogo';

export default function LoginPage() {
  const { config, refresh } = useAuth();
  const [devUsers, setDevUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (config?.mode === 'dev') api.devUsers().then(setDevUsers).catch(() => setDevUsers([]));
  }, [config?.mode]);

  const devLogin = async (email: string) => {
    setBusy(email);
    try {
      await api.devLogin(email);
      await refresh();
    } finally {
      setBusy('');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card variant="outlined" sx={{ width: 420, maxWidth: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1} mb={3}>
            <BrandLogo logo={config?.platformLogo} brandColor={config?.platformBrandColor} name={config?.platformName} size={48} />
            <Typography variant="h5" fontWeight={800}>
              {config?.platformName || 'UIFactory'}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Build, deploy and share internal apps powered by your data and AI.
            </Typography>
          </Stack>

          {config?.mode === 'azure' ? (
            <Button fullWidth size="large" variant="contained" startIcon={<MicrosoftIcon />} href="/api/auth/login">
              Sign in with Microsoft
            </Button>
          ) : (
            <Stack spacing={1.5}>
              <Divider>
                <Chip size="small" label="Dev sign-in" />
              </Divider>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Azure AD is not configured, so pick a demo user to continue.
              </Typography>
              {devUsers.map((u) => (
                <Button
                  key={u.id}
                  variant="outlined"
                  size="large"
                  disabled={!!busy}
                  onClick={() => devLogin(u.email)}
                  startIcon={busy === u.email ? <CircularProgress size={18} /> : <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>{u.name[0]}</Avatar>}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  <Box textAlign="left" sx={{ ml: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {u.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.email} · {u.role}
                    </Typography>
                  </Box>
                </Button>
              ))}
              {devUsers.length === 0 && <Typography variant="body2" color="text.secondary">No demo users seeded.</Typography>}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
