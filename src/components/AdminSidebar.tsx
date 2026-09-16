import { useApp } from '@/lib/context';
import type { AdminPageKey } from '@/lib/types';
import {
  LayoutDashboard, Users, Webhook, MessageSquare, FileText,
  ShieldCheck, ScrollText, Settings, ArrowLeft, LogOut, X,
} from 'lucide-react';

const NAV_ITEMS: { key: AdminPageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'admin-overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'admin-users', label: 'Users', icon: Users },
  { key: 'admin-webhooks', label: 'Webhooks', icon: Webhook },
  { key: 'admin-messages', label: 'Messages', icon: MessageSquare },
  { key: 'admin-templates', label: 'Templates', icon: FileText },
  { key: 'admin-logs', label: 'Audit Logs', icon: ScrollText },
  { key: 'admin-security', label: 'Security', icon: ShieldCheck },
  { key: 'admin-settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const { adminPage, setAdminPage, setAdminUserId, sidebarOpen, setSidebarOpen, setPage, user, signOut } = useApp();

  const go = (p: AdminPageKey) => {
    if (p !== 'admin-user-details') setAdminUserId(null);
    setAdminPage(p);
    setSidebarOpen(false);
  };

  const backToApp = () => {
    setAdminUserId(null);
    setPage('dashboard');
    setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[244px] shrink-0 bg-kma-surface border-r border-kma-border-subtle flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-kma-border-subtle">
          <div className="flex items-center gap-2.5">
            <img
              src="/901c4dfc-a450-463e-b9d0-69aaed94f9ba.png"
              alt="KMA TOOLS"
              className="h-6 w-auto object-contain"
              style={{ filter: 'brightness(1.4) contrast(1.1)' }}
            />
            <span className="tag tag-neutral" style={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.08)' }}>ADMIN</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <div className="mb-3">
            <div className="px-2.5 mb-1 text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Management</div>
            <div className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = adminPage === item.key || (item.key === 'admin-users' && adminPage === 'admin-user-details');
                return (
                  <button key={item.key} onClick={() => go(item.key)} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${active ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-kma-elevated'}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="px-2.5 py-3 border-t border-kma-border-subtle">
          <button onClick={backToApp} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-kma-elevated transition-colors mb-1">
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div className="w-7 h-7 rounded-md bg-kma-hover flex items-center justify-center text-zinc-300 font-semibold text-xs shrink-0">
              {(user?.email ?? 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-300 truncate leading-none">{user?.email ?? 'Admin'}</div>
              <div className="text-2xs text-amber-500/70 mt-0.5">Administrator</div>
            </div>
            <button onClick={signOut} className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors shrink-0" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
