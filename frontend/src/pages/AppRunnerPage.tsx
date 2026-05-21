import { useEffect, useState } from 'react';
import { AppBar, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyIcon from '@mui/icons-material/Key';
import { useNavigate, useParams } from 'react-router-dom';
import { api, AppFull, AppPage } from '../api/client';
import PreviewFrame, { PreviewBridge } from '../components/PreviewFrame';
import ChatView from '../components/ChatView';
import CredentialsManager from '../components/CredentialsManager';

function UiPageRunner({ appId, page, onNavigate }: { appId: string; page: AppPage; onNavigate: (slug: string) => void }) {
  const [data, setData] = useState<unknown>(page.sample ? safeParse(page.sample) : null);
  const [loading, setLoading] = useState(!!page.queryId);

  useEffect(() => {
    let cancelled = false;
    if (page.queryId) {
      setLoading(true);
      api
        .appPageData(appId, page.id)
        .then((res) => !cancelled && setData(res.data))
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false));
    }
    return () => {
      cancelled = true;
    };
  }, [appId, page.id, page.queryId]);

  const bridge: PreviewBridge = {
    runQuery: (queryId, params) => api.appRunQuery(appId, { queryId, pageId: page.id, params }),
    runAction: (name, params) => api.appRunQuery(appId, { action: name, pageId: page.id, params }),
    refresh: async () => {
      const res = await api.appPageData(appId, page.id);
      setData(res.data);
      return res;
    },
    navigate: onNavigate,
  };

  if (!page.html) {
    return <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', color: 'text.secondary' }}>This page has no content yet.</Box>;
  }
  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}><CircularProgress /></Box>;
  }
  return <PreviewFrame html={page.html} data={data} height="100%" bridge={bridge} />;
}

export default function AppRunnerPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppFull | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [needsCreds, setNeedsCreds] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.getAppBySlug(slug).then(setApp).catch((e) => setError(api.errMessage(e)));
  }, [slug]);

  useEffect(() => {
    if (!app) return;
    api.listAppCredentials(app.id).then((c) => setNeedsCreds(c.length > 0)).catch(() => setNeedsCreds(false));
  }, [app]);

  if (error) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography color="error" gutterBottom>{error}</Typography>
        <IconButton onClick={() => navigate('/')}><ArrowBackIcon /></IconButton>
      </Box>
    );
  }
  if (!app) return <Box sx={{ height: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const page = app.definition.pages[tab];
  const theme = (app.definition.theme || {}) as { brandColor?: string; brandName?: string; logo?: string };
  const brand = theme.brandColor || '#0b1f3a';
  const initial = (theme.logo || theme.brandName || app.name || '?').trim().slice(0, 2) || '?';

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => navigate('/')}><ArrowBackIcon /></IconButton>
          <Box sx={{ width: 26, height: 26, borderRadius: 1.2, mr: 1, bgcolor: brand, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>
            {initial}
          </Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 3 }}>{theme.brandName || app.name}</Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ minHeight: 48, flexGrow: 1, '& .Mui-selected': { color: brand }, '& .MuiTabs-indicator': { backgroundColor: brand } }}>
            {app.definition.pages.map((p) => (
              <Tab key={p.id} label={p.name} sx={{ minHeight: 48 }} />
            ))}
          </Tabs>
          {needsCreds && (
            <Button size="small" startIcon={<KeyIcon fontSize="small" />} onClick={() => setCredOpen(true)} sx={{ color: brand, flexShrink: 0 }}>
              Connect accounts
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Dialog open={credOpen} onClose={() => setCredOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Connect your accounts</DialogTitle>
        <DialogContent>
          <CredentialsManager appId={app.id} onChanged={() => setReloadKey((k) => k + 1)} />
        </DialogContent>
      </Dialog>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {!page ? (
          <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', color: 'text.secondary' }}>This app has no pages.</Box>
        ) : page.type === 'chat' ? (
          <ChatView key={`${page.id}-${reloadKey}`} appId={app.id} pageId={page.id} greeting={page.chat?.greeting} persistHistory />
        ) : (
          <UiPageRunner
            key={`${page.id}-${reloadKey}`}
            appId={app.id}
            page={page}
            onNavigate={(slug) => {
              const idx = app.definition.pages.findIndex((p) => p.slug === slug || p.id === slug || p.name === slug);
              if (idx >= 0) setTab(idx);
            }}
          />
        )}
      </Box>
    </Box>
  );
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
