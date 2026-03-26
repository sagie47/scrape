import { useEffect, useMemo, useState } from 'react';
import {
  FileSearch,
  Users,
  LayoutDashboard,
  FileText,
  Target,
  Settings,
  Zap,
  LogOut
} from 'lucide-react';

import LandingPage from './LandingPage';
import { useAuth } from './contexts/AuthContext';
import CampaignsList from './pages/CampaignsList';
import CampaignBuilder from './pages/CampaignBuilder';
import CampaignDashboard from './pages/CampaignDashboard';
import TaskInbox from './pages/TaskInbox';
import ProspectingPage from './pages/ProspectingPage';
import LeadsPage from './pages/LeadsPage';
import AuditsPage from './pages/AuditsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsView from './components/SettingsView';

const parseRoute = (pathname) => {
  if (pathname === '/campaigns') return { view: 'campaigns', params: {} };
  if (pathname === '/campaigns/new') return { view: 'campaign-builder', params: {} };
  const tasksMatch = pathname.match(/^\/campaigns\/([^/]+)\/tasks$/);
  if (tasksMatch) return { view: 'task-inbox', params: { campaignId: tasksMatch[1] } };
  const campaignMatch = pathname.match(/^\/campaigns\/([^/]+)$/);
  if (campaignMatch) return { view: 'campaign-dashboard', params: { campaignId: campaignMatch[1] } };
  if (pathname === '/prospecting') return { view: 'prospecting', params: {} };
  if (pathname === '/leads') return { view: 'leads', params: {} };
  if (pathname === '/audits') return { view: 'audits', params: {} };
  if (pathname === '/reports') return { view: 'reports', params: {} };
  if (pathname === '/settings') return { view: 'settings', params: {} };
  return { view: 'prospecting', params: {} };
};

const VIEW_TITLES = {
  prospecting: 'Prospecting',
  leads: 'Leads',
  audits: 'Audits',
  reports: 'Reports',
  campaigns: 'Campaigns',
  'campaign-builder': 'Campaign Builder',
  'campaign-dashboard': 'Campaign Dashboard',
  'task-inbox': 'Task Inbox',
  settings: 'Settings'
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setRoute(parseRoute(path));
  };

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!authLoading && user && window.location.pathname === '/') {
      navigate('/prospecting');
    }
  }, [authLoading, user]);

  const navItems = useMemo(() => ([
    { key: 'prospecting', label: 'Prospecting', path: '/prospecting', icon: FileSearch },
    { key: 'leads', label: 'Leads', path: '/leads', icon: Users },
    { key: 'audits', label: 'Audits', path: '/audits', icon: LayoutDashboard },
    { key: 'reports', label: 'Reports', path: '/reports', icon: FileText },
    { key: 'campaigns', label: 'Campaigns', path: '/campaigns', icon: Target },
    { key: 'settings', label: 'Settings', path: '/settings', icon: Settings }
  ]), []);

  if (authLoading) {
    return <div className="app-container" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>Loading…</div>;
  }

  if (!user) {
    return <LandingPage onLogin={() => navigate('/prospecting')} onEnter={() => navigate('/prospecting')} />;
  }

  const currentView = route.view;

  return (
    <div className="app-container">
      <aside className="control-deck">
        <div className="deck-header" onClick={() => navigate('/prospecting')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
          <Zap size={32} strokeWidth={3} style={{ color: 'var(--accent-cyan)', filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.5))' }} />
        </div>

        <nav className="deck-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.key || (item.key === 'campaigns' && ['campaign-builder', 'campaign-dashboard', 'task-inbox'].includes(currentView));
            return (
              <button key={item.key} className={`deck-nav-item ${active ? 'active' : ''}`} onClick={() => navigate(item.path)} title={item.label}>
                <Icon size={22} />
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="viewscreen">
        <header className="view-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{VIEW_TITLES[currentView] || 'Workspace'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</span>
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </header>

        <div className="view-content">
          {currentView === 'prospecting' && <ProspectingPage onNavigate={navigate} />}
          {currentView === 'leads' && <LeadsPage onNavigate={navigate} />}
          {currentView === 'audits' && <AuditsPage onNavigate={navigate} />}
          {currentView === 'reports' && <ReportsPage onNavigate={navigate} />}
          {currentView === 'campaigns' && <CampaignsList onNavigate={navigate} />}
          {currentView === 'campaign-builder' && <CampaignBuilder onNavigate={navigate} />}
          {currentView === 'campaign-dashboard' && <CampaignDashboard campaignId={route.params?.campaignId} onNavigate={navigate} />}
          {currentView === 'task-inbox' && <TaskInbox campaignId={route.params?.campaignId} onNavigate={navigate} />}
          {currentView === 'settings' && <SettingsView user={user} />}
        </div>
      </main>
    </div>
  );
}

export default App;
