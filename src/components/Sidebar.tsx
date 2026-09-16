import { useApp } from '@/lib/context';
import type { PageKey } from '@/lib/types';
import {
  LayoutDashboard,
  Send,
  Blocks,
  Activity,
  Webhook,
  FileText,
  History,
  Settings,
  X,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CalendarClock,
  Radio,
  Users,
} from 'lucide-react';
import { DiscordJoinWidget } from '@/components/DiscordJoinWidget';

const NAV_SECTIONS: { label: string; items: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Messaging',
    items: [
      { key: 'send', label: 'Send Message', icon: Send },
      { key: 'embed', label: 'Embed Builder', icon: Blocks },
      { key: 'broadcast', label: 'Broadcast', icon: Radio },
      { key: 'templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    label: 'Automation',
    items: [
      { key: 'scheduled', label: 'Scheduled', icon: CalendarClock },
    ],
  },
  {
    label: 'Webhooks',
    items: [
      { key: 'manager', label: 'Manager', icon: Webhook },
      { key: 'tester', label: 'Tester', icon: Activity },
    ],
  },
  {
    label: 'Organization',
    items: [
      { key: 'teams', label: 'Teams', icon: Users },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'history', label: 'History', icon: History },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const { page, setPage, activeWebhook, sidebarOpen, setSidebarOpen, user, signOut, isAdmin, adminReady } = useApp();

  const go = (p: PageKey) => {
    setPage(p);
    setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[244px] shrink-0 bg-kma-surface border-r border-kma-border-subtle flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-kma-border-subtle">
          <div className="flex items-center gap-2.5">
            <img
              src="/901c4dfc-a450-463e-b9d0-69aaed94f9ba.png"
              alt="KMA TOOLS"
              className="h-6 w-auto object-contain"
              style={{ filter: 'brightness(1.4) contrast(1.1)' }}
            />
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-steel-dim hover:text-steel-bright p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="px-2.5 mb-1 text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = page === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => go(item.key)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                        active
                          ? 'bg-accent-bg text-accent-bright border border-accent-border'
                          : 'text-steel-dim hover:text-steel-bright hover:bg-kma-elevated'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                      {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin && adminReady && (
            <div className="mb-4">
              <div className="px-2.5 mb-1 text-2xs uppercase tracking-wider text-zinc-600 font-semibold">Administration</div>
              <button
                onClick={() => go('admin')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Admin Panel
                <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
              </button>
            </div>
          )}
        </nav>

        <div className="px-2.5 py-3 border-t border-kma-border-subtle">
          <div className="mb-2">
            <DiscordJoinWidget variant="compact" />
          </div>
          <div className="px-2.5 py-2 rounded-md bg-kma-elevated mb-2">
            <div className="text-2xs uppercase tracking-wider text-zinc-600 font-semibold mb-1">Active Webhook</div>
            {activeWebhook ? (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-bright" />
                <span className="text-[13px] text-steel-bright font-medium truncate">{activeWebhook.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                <span className="text-[13px] text-zinc-500">None configured</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div className="w-7 h-7 rounded-md bg-kma-hover flex items-center justify-center text-steel-bright font-semibold text-xs shrink-0">
              {(user?.email ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-steel-bright truncate leading-none">{user?.email ?? 'User'}</div>
              <div className="text-2xs text-zinc-600 mt-0.5">Signed in</div>
            </div>
            <button
              onClick={signOut}
              className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
