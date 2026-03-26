import React, { useState } from 'react';
import { ArrowRight, FileSearch, FileText, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './AuthModal';

const features = [
  {
    icon: <FileSearch size={28} />,
    title: 'Prospect local businesses at scale',
    desc: 'Import leads from Google Maps or your own datasets, keep websites, emails, categories, and contact detail in one place.'
  },
  {
    icon: <Sparkles size={28} />,
    title: 'Run multimodal CRO audits',
    desc: 'Capture the homepage, combine technical checks with visual analysis, and turn it into a structured intelligence report.'
  },
  {
    icon: <FileText size={28} />,
    title: 'Ship branded reports',
    desc: 'Generate public share links and downloadable PDFs with your own sender identity, support email, and brand color.'
  },
  {
    icon: <Send size={28} />,
    title: 'Draft outreach without becoming an ESP',
    desc: 'Generate sequences and export or webhook them into Smartlead, Mailead, or your own outbound system.'
  }
];

export default function LandingPage({ onEnter, onLogin: onLoginProp }) {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');

  const openAuth = (mode) => {
    if (user) {
      onEnter?.();
      onLoginProp?.();
      return;
    }
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="landing-container" style={{ zIndex: 100, background: 'var(--bg-void)', color: 'var(--lux-primary)', overflowY: 'auto', fontFamily: 'var(--font-sans)', position: 'absolute', inset: 0 }}>
      <div className="void-atmosphere"></div>

      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem 4rem', maxWidth: '1300px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, fontSize: '1.1rem' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-cyan), #22c55e)', display: 'grid', placeItems: 'center', color: '#04111c' }}>
            <Sparkles size={18} />
          </div>
          Scrape Intelligence
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="hud-btn" onClick={() => openAuth('signin')}>Sign In</button>
          <button className="hud-btn primary" onClick={() => openAuth('signup')} style={{ color: '#04111c' }}>Start Free</button>
        </div>
      </nav>

      <section style={{ maxWidth: '1300px', margin: '0 auto', padding: '3rem 4rem 4rem', display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '2rem', alignItems: 'stretch' }}>
        <div className="widget" style={{ padding: '3rem', background: 'linear-gradient(145deg, rgba(12,27,38,0.92), rgba(8,16,27,0.96))' }}>
          <div className="badge active" style={{ marginBottom: '1rem', display: 'inline-flex' }}>For agencies and outbound operators</div>
          <h1 style={{ fontSize: '4.5rem', lineHeight: 0.95, letterSpacing: '-0.05em', margin: '0 0 1.5rem' }}>
            Audit websites.
            <br />
            Generate intelligence.
            <br />
            Move outreach faster.
          </h1>
          <p style={{ fontSize: '1.15rem', lineHeight: 1.7, color: 'var(--lux-secondary)', maxWidth: '48rem' }}>
            Scrape Intelligence is a local-business prospecting and CRO workflow for agencies. Pull in leads, run multimodal audits in batches, produce branded reports, and hand clean outreach drafts into your outbound stack.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <button className="hud-btn primary" onClick={() => openAuth('signup')} style={{ color: '#04111c', padding: '0.9rem 1.4rem' }}>
              Start Prospecting <ArrowRight size={16} />
            </button>
            <button className="hud-btn" onClick={() => openAuth('signin')} style={{ padding: '0.9rem 1.4rem' }}>
              Open Workspace
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            <span className="pill">Google Maps ingestion</span>
            <span className="pill">Multimodal CRO review</span>
            <span className="pill">Share links + PDFs</span>
            <span className="pill">Webhook export</span>
          </div>
        </div>

        <div className="widget" style={{ padding: '2rem', display: 'grid', alignContent: 'space-between' }}>
          <div>
            <div className="widget-title" style={{ marginBottom: '1rem' }}><ShieldCheck size={16} /> WORKFLOW</div>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {[
                '1. Run a maps scrape or import a dataset.',
                '2. Select the leads with websites worth auditing.',
                '3. Generate structured CRO findings and outreach angles.',
                '4. Publish a branded report and export the follow-up.'
              ].map((line) => (
                <div key={line} className="list-item" style={{ marginBottom: 0 }}>{line}</div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', color: 'var(--lux-secondary)', lineHeight: 1.7 }}>
            Default mode is human-in-the-loop. The system drafts the report and outreach first, then you decide what gets sent onward.
          </div>
        </div>
      </section>

      <section style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 4rem 5rem' }}>
        <div className="dashboard-grid">
          {features.map((feature) => (
            <div key={feature.title} className="widget quarter-width" style={{ padding: '1.75rem' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>
                {feature.icon}
              </div>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>{feature.title}</h3>
              <p style={{ margin: 0, color: 'var(--lux-secondary)', lineHeight: 1.7 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          if (user) {
            onEnter?.();
            onLoginProp?.();
          }
        }}
        initialMode={authMode}
      />
    </div>
  );
}
