import { useEffect, useState } from 'react';
import { Check, Globe, KeyRound, Save, Send, Settings, User } from 'lucide-react';
import { api } from '../lib/api';
import ObsidianDropdown from '../ObsidianDropdown';

const STORAGE_KEY = 'scraper_settings';
const defaultRuntime = {
  captureMode: 'standard',
  defaultExportFormat: 'xlsx',
  includeTimestamps: true,
  concurrencyLimit: 4
};

const defaultBranding = {
  brandName: 'Scrape Intelligence',
  senderName: '',
  senderTitle: 'Founder',
  logoUrl: '',
  primaryColor: '#0ea5e9',
  supportEmail: ''
};

export default function SettingsView({ user }) {
  const [runtime, setRuntime] = useState(defaultRuntime);
  const [branding, setBranding] = useState(defaultBranding);
  const [destinations, setDestinations] = useState([]);
  const [destinationDraft, setDestinationDraft] = useState({ name: '', kind: 'webhook', targetUrl: '' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRuntime({ ...defaultRuntime, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load runtime settings', error);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const [brandingData, destinationsData] = await Promise.all([
          api.getBranding(),
          api.getOutboundDestinations()
        ]);
        if (!ignore) {
          setBranding({ ...defaultBranding, ...(brandingData || {}) });
          setDestinations(destinationsData || []);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  const showSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const updateRuntime = (key, value) => {
    const next = { ...runtime, [key]: value };
    setRuntime(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    showSaved();
  };

  const saveBranding = async () => {
    const next = await api.updateBranding(branding);
    setBranding({ ...defaultBranding, ...(next || {}) });
    showSaved();
  };

  const saveDestination = async () => {
    if (!destinationDraft.name || !destinationDraft.targetUrl) return;
    const savedDestination = await api.saveOutboundDestination(destinationDraft);
    setDestinations((prev) => [savedDestination, ...prev.filter((item) => item.id !== savedDestination.id)]);
    setDestinationDraft({ name: '', kind: 'webhook', targetUrl: '' });
    showSaved();
  };

  return (
    <div className="dashboard-grid animate-fade-in">
      <div className="full-width" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Settings size={28} strokeWidth={1.5} style={{ color: 'var(--lux-tertiary)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.25rem' }}>Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Branding, outbound destinations, and local runtime preferences.</p>
        </div>
        {saved && <div className="badge active" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={12} /> Saved</div>}
      </div>

      <div className="widget" style={{ gridColumn: 'span 6' }}>
        <div className="widget-header"><div className="widget-title"><User size={16} /> BRANDING</div></div>
        {loading ? <div className="campaigns-loading">Loading branding…</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label className="sequence-field"><span className="stat-label">Brand Name</span><input className="hud-input" value={branding.brandName} onChange={(e) => setBranding((prev) => ({ ...prev, brandName: e.target.value }))} /></label>
            <label className="sequence-field"><span className="stat-label">Support Email</span><input className="hud-input" value={branding.supportEmail} onChange={(e) => setBranding((prev) => ({ ...prev, supportEmail: e.target.value }))} /></label>
            <label className="sequence-field"><span className="stat-label">Sender Name</span><input className="hud-input" value={branding.senderName} onChange={(e) => setBranding((prev) => ({ ...prev, senderName: e.target.value }))} /></label>
            <label className="sequence-field"><span className="stat-label">Sender Title</span><input className="hud-input" value={branding.senderTitle} onChange={(e) => setBranding((prev) => ({ ...prev, senderTitle: e.target.value }))} /></label>
            <label className="sequence-field"><span className="stat-label">Logo URL</span><input className="hud-input" value={branding.logoUrl} onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))} /></label>
            <label className="sequence-field"><span className="stat-label">Primary Color</span><input className="hud-input" value={branding.primaryColor} onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))} /></label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="hud-btn primary" type="button" onClick={saveBranding}><Save size={14} /> Save Branding</button>
            </div>
          </div>
        )}
      </div>

      <div className="widget" style={{ gridColumn: 'span 6' }}>
        <div className="widget-header"><div className="widget-title"><Send size={16} /> OUTBOUND DESTINATIONS</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.4fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
          <label className="sequence-field"><span className="stat-label">Name</span><input className="hud-input" value={destinationDraft.name} onChange={(e) => setDestinationDraft((prev) => ({ ...prev, name: e.target.value }))} /></label>
          <div>
            <ObsidianDropdown
              label="Kind"
              value={destinationDraft.kind}
              onChange={(value) => setDestinationDraft((prev) => ({ ...prev, kind: value }))}
              options={[{ label: 'Webhook', value: 'webhook' }, { label: 'Smartlead', value: 'smartlead' }, { label: 'Mailead', value: 'mailead' }]}
            />
          </div>
          <label className="sequence-field"><span className="stat-label">Target URL</span><input className="hud-input" value={destinationDraft.targetUrl} onChange={(e) => setDestinationDraft((prev) => ({ ...prev, targetUrl: e.target.value }))} /></label>
          <button className="hud-btn primary" type="button" onClick={saveDestination}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {destinations.length === 0 && <div className="drawer-empty">No outbound destinations configured.</div>}
          {destinations.map((destination) => (
            <div key={destination.id} className="list-item" style={{ marginBottom: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{destination.name}</div>
                <div className="row-preview">{destination.kind} • {destination.target_url || destination.targetUrl || 'No URL'}</div>
              </div>
              <span className={`badge ${destination.is_active ? 'active' : 'neutral'}`}>{destination.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="widget" style={{ gridColumn: 'span 6' }}>
        <div className="widget-header"><div className="widget-title"><Globe size={16} /> LOCAL RUNTIME</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <ObsidianDropdown
              label="Default Capture Mode"
              value={runtime.captureMode}
              onChange={(value) => updateRuntime('captureMode', value)}
              options={[{ label: 'Full Capture', value: 'standard' }, { label: 'Fast Scan', value: 'fast' }]}
            />
          </div>
          <div>
            <ObsidianDropdown
              label="Default Export Format"
              value={runtime.defaultExportFormat}
              onChange={(value) => updateRuntime('defaultExportFormat', value)}
              options={[{ label: 'XLSX', value: 'xlsx' }, { label: 'CSV', value: 'csv' }]}
            />
          </div>
          <div>
            <ObsidianDropdown
              label="Concurrency"
              value={runtime.concurrencyLimit}
              onChange={(value) => updateRuntime('concurrencyLimit', Number(value))}
              options={[{ label: '2 parallel', value: 2 }, { label: '4 parallel', value: 4 }, { label: '8 parallel', value: 8 }]}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
            <input type="checkbox" checked={runtime.includeTimestamps} onChange={(e) => updateRuntime('includeTimestamps', e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)' }} />
            <div>
              <div style={{ fontWeight: 500 }}>Include timestamps</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Applied to local exports only.</div>
            </div>
          </label>
        </div>
      </div>

      <div className="widget" style={{ gridColumn: 'span 6' }}>
        <div className="widget-header"><div className="widget-title"><KeyRound size={16} /> ACCOUNT</div></div>
        <div className="list-item" style={{ marginBottom: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #22c55e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 600 }}>
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{user?.email || 'Not signed in'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Server-backed branding and outbound configuration enabled.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
