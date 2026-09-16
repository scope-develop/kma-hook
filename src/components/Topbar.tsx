import { useApp } from '@/lib/context';
import { Menu, LogOut } from 'lucide-react';

export function Topbar() {
  const { setSidebarOpen, activeWebhook, user, signOut } = useApp();

  const email = user?.email ?? '';
  const initial = email.charAt(0).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-20 bg-kma-base/95 backdrop-blur-sm border-b border-kma-border-subtle h-14 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-zinc-500 hover:text-steel-bright p-1.5 rounded-md hover:bg-kma-elevated"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {activeWebhook ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent-bright">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-bright" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              Offline
            </span>
          )}
          {activeWebhook && (
            <>
              <span className="text-xs text-zinc-700 hidden sm:inline">·</span>
              <span className="text-xs text-zinc-500 hidden sm:inline font-mono">{activeWebhook.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 pl-3 border-l border-kma-border-subtle">
          <div className="w-7 h-7 rounded-md bg-kma-hover flex items-center justify-center text-steel-bright font-semibold text-xs">
            {initial}
          </div>
          <div className="hidden sm:block leading-none">
            <div className="text-xs font-medium text-steel-bright">{email}</div>
            <div className="text-2xs text-zinc-600 mt-0.5">Signed in</div>
          </div>
          <button
            onClick={signOut}
            className="ml-1 text-zinc-600 hover:text-red-400 p-1.5 rounded-md hover:bg-kma-elevated transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
