import { useApp } from '@/lib/context';
import { Menu, ShieldCheck } from 'lucide-react';

export function AdminTopbar() {
  const { setSidebarOpen, adminPage } = useApp();

  const titles: Record<string, string> = {
    'admin-overview': 'Overview',
    'admin-users': 'User Management',
    'admin-user-details': 'User Details',
    'admin-webhooks': 'Webhook Management',
    'admin-messages': 'Messages & Embeds',
    'admin-templates': 'Template Management',
    'admin-logs': 'Audit Logs',
    'admin-security': 'Security Center',
    'admin-settings': 'Admin Settings',
  };

  return (
    <header className="sticky top-0 z-20 bg-kma-base/95 backdrop-blur-sm border-b border-kma-border-subtle h-14 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-zinc-400 hover:text-zinc-200 p-1.5 rounded-md hover:bg-kma-elevated">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-zinc-200">{titles[adminPage] ?? 'Admin'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="tag tag-accent" style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.15)' }}>ADMIN MODE</span>
      </div>
    </header>
  );
}
