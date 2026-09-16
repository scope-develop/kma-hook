import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AdminPageKey, AppSettings, PageKey, Stats, Toast, Webhook } from './types';

interface AppContextValue {
  session: Session | null;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  adminReady: boolean;
  page: PageKey;
  setPage: (p: PageKey) => void;
  adminPage: AdminPageKey;
  setAdminPage: (p: AdminPageKey) => void;
  adminUserId: string | null;
  setAdminUserId: (id: string | null) => void;
  webhooks: Webhook[];
  activeWebhook: Webhook | null;
  refreshWebhooks: () => Promise<void>;
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
  stats: Stats | null;
  refreshStats: () => Promise<void>;
  historyVersion: number;
  bumpHistory: () => void;
  toasts: Toast[];
  toast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [page, setPage] = useState<PageKey>('dashboard');
  const [adminPage, setAdminPage] = useState<AdminPageKey>('admin-overview');
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refreshWebhooks = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_webhooks');
    if (!error && data) setWebhooks(data as Webhook[]);
  }, []);

  const refreshSettings = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_settings');
    if (!error && data) setSettings((data as AppSettings[])[0] ?? null);
  }, []);

  const refreshStats = useCallback(async () => {
    const { data, error } = await supabase.from('stats').select('*').maybeSingle();
    if (!error && data) setStats(data as Stats);
  }, []);

  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setWebhooks([]); setSettings(null); setStats(null);
    setIsAdmin(false); setAdminReady(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session); setAuthReady(true);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => { setSession(newSession); setAuthReady(true); })();
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      setWebhooks([]); setSettings(null); setStats(null);
      setIsAdmin(false); setAdminReady(false);
      return;
    }
    refreshWebhooks(); refreshSettings(); refreshStats();

    // Check admin status
    supabase.rpc('is_admin').then(({ data }) => {
      setIsAdmin(data === true);
      setAdminReady(true);
    }).catch(() => { setIsAdmin(false); setAdminReady(true); });
  }, [session, refreshWebhooks, refreshSettings, refreshStats]);

  const activeWebhook = webhooks.find((w) => w.is_active) ?? null;

  return (
    <AppContext.Provider
      value={{
        session, user: session?.user ?? null, authReady, isAdmin, adminReady,
        page, setPage, adminPage, setAdminPage, adminUserId, setAdminUserId,
        webhooks, activeWebhook, refreshWebhooks,
        settings, refreshSettings, stats, refreshStats,
        historyVersion, bumpHistory, toasts, toast, dismissToast,
        sidebarOpen, setSidebarOpen, signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
