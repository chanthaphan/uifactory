import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, AuthConfig, AuthUser } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  config: AuthConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [cfg, me] = await Promise.all([
      api.authConfig().catch(() => ({ mode: 'dev' as const, platformName: 'UIFactory' })),
      api.me().catch(() => null),
    ]);
    setConfig(cfg);
    setUser(me);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({ user, config, loading, refresh, logout, isAdmin: user?.role === 'admin' }),
    [user, config, loading, refresh, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
