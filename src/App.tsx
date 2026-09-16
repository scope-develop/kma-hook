import { AppProvider, useApp } from '@/lib/context';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { ToastContainer } from '@/components/Toast';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SendMessagePage } from '@/pages/SendMessagePage';
import { EmbedBuilderPage } from '@/pages/EmbedBuilderPage';
import { WebhookTesterPage } from '@/pages/WebhookTesterPage';
import { WebhookManagerPage } from '@/pages/WebhookManagerPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ScheduledMessagesPage } from '@/pages/ScheduledMessagesPage';
import { BroadcastPage } from '@/pages/BroadcastPage';
import { TeamsPage } from '@/pages/TeamsPage';
import { Spinner } from '@/components/Loading';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminTopbar } from '@/components/AdminTopbar';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminUserDetailsPage } from '@/pages/admin/AdminUserDetailsPage';
import { AdminWebhooksPage } from '@/pages/admin/AdminWebhooksPage';
import { AdminMessagesPage } from '@/pages/admin/AdminMessagesPage';
import { AdminTemplatesPage } from '@/pages/admin/AdminTemplatesPage';
import { AdminLogsPage } from '@/pages/admin/AdminLogsPage';
import { AdminSecurityPage } from '@/pages/admin/AdminSecurityPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';

function UserPageRouter() {
  const { page } = useApp();
  switch (page) {
    case 'dashboard': return <DashboardPage />;
    case 'send': return <SendMessagePage />;
    case 'embed': return <EmbedBuilderPage />;
    case 'tester': return <WebhookTesterPage />;
    case 'manager': return <WebhookManagerPage />;
    case 'templates': return <TemplatesPage />;
    case 'history': return <HistoryPage />;
    case 'settings': return <SettingsPage />;
    case 'scheduled': return <ScheduledMessagesPage />;
    case 'broadcast': return <BroadcastPage />;
    case 'teams': return <TeamsPage />;
    case 'admin': return null;
    default: return <DashboardPage />;
  }
}

function AdminPageRouter() {
  const { adminPage } = useApp();
  switch (adminPage) {
    case 'admin-overview': return <AdminOverviewPage />;
    case 'admin-users': return <AdminUsersPage />;
    case 'admin-user-details': return <AdminUserDetailsPage />;
    case 'admin-webhooks': return <AdminWebhooksPage />;
    case 'admin-messages': return <AdminMessagesPage />;
    case 'admin-templates': return <AdminTemplatesPage />;
    case 'admin-logs': return <AdminLogsPage />;
    case 'admin-security': return <AdminSecurityPage />;
    case 'admin-settings': return <AdminSettingsPage />;
    default: return <AdminOverviewPage />;
  }
}

function UserShell() {
  return (
    <div className="flex min-h-screen bg-kma-base">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          <UserPageRouter />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

function AdminShell() {
  return (
    <div className="flex min-h-screen bg-kma-base">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar />
        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          <AdminPageRouter />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

function Gate() {
  const { session, authReady, isAdmin, adminReady, page, adminPage } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kma-base">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (!session) return <AuthPage />;

  // Route to admin panel
  if (page === 'admin' && isAdmin && adminReady) {
    return <AdminShell />;
  }

  // If admin page is set and user is admin, show admin shell
  if (isAdmin && adminReady && adminPage !== 'admin-overview' && page === 'admin') {
    return <AdminShell />;
  }

  return <UserShell />;
}

function App() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}

export default App;
