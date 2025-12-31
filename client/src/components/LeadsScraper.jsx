/**
 * LeadsScraper - Lead scraping interface
 * 
 * Provides sector selection, location input, and leads display with export options.
 */

import { Loader2, Search, FileSpreadsheet, ChevronRight } from 'lucide-react'
import ObsidianDropdown from '../ObsidianDropdown'

const SECTORS = [
    'Chiropractors', 'Plumbers', 'Roofing Contractors', 'Dentists',
    'HVAC Services', 'Solar Installers', 'Custom Query'
]

function LeadsScraper({
    loading,
    leads,
    scrapeSector,
    scrapeKeyword,
    scrapeLocation,
    leadsLimit,
    onSectorChange,
    onKeywordChange,
    onLocationChange,
    onLimitChange,
    onSubmit,
    onExport,
    onAnalyzeLeads
}) {
    return (
        <div className="dashboard-grid animate-fade-in">
            {/* Search Form */}
            <div className="widget half-width" style={{ gridColumn: 'span 12' }}>
                <div className="widget-header">
                    <div className="widget-title">LEAD ACQUISITION PROTOCOLS</div>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>SECTOR</label>
                        <div style={{ width: '100%', minWidth: '220px' }}>
                            <ObsidianDropdown
                                value={scrapeSector}
                                onChange={onSectorChange}
                                options={SECTORS.map(s => ({ label: s, value: s }))}
                            />
                        </div>
                    </div>

                    {scrapeSector === 'Custom Query' && (
                        <div style={{ flex: 1 }}>
                            <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>KEYWORD</label>
                            <input
                                className="hud-input"
                                value={scrapeKeyword}
                                onChange={e => onKeywordChange(e.target.value)}
                                placeholder="..."
                            />
                        </div>
                    )}

                    <div style={{ flex: 1 }}>
                        <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>REGION</label>
                        <input
                            className="hud-input"
                            value={scrapeLocation}
                            onChange={e => onLocationChange(e.target.value)}
                            placeholder="City, State"
                        />
                    </div>

                    <div style={{ flex: 1 }}>
                        <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>LIMIT</label>
                        <div style={{ width: '100%' }}>
                            <ObsidianDropdown
                                value={leadsLimit}
                                onChange={val => onLimitChange(Number(val))}
                                options={[
                                    { label: '10 LEADS', value: 10 },
                                    { label: '20 LEADS', value: 20 },
                                    { label: '50 LEADS', value: 50 },
                                    { label: '100 LEADS', value: 100 }
                                ]}
                            />
                        </div>
                    </div>

                    <button className="hud-btn primary" disabled={loading} style={{ width: '200px' }}>
                        {loading ? <Loader2 className="spin" /> : 'DEPLOY AGENTS'}
                    </button>
                </form>
            </div>

            {/* Leads Results */}
            <div className="widget full-width">
                <div className="widget-header">
                    <div className="widget-title">EXTRACTED TARGETS</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {leads.length > 0 && (
                            <>
                                <button
                                    onClick={() => onExport('csv')}
                                    className="hud-btn"
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem' }}
                                >
                                    <FileSpreadsheet size={14} style={{ marginRight: '4px' }} /> CSV
                                </button>
                                <button
                                    onClick={() => onExport('xlsx')}
                                    className="hud-btn"
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem' }}
                                >
                                    <FileSpreadsheet size={14} style={{ marginRight: '4px' }} /> XLSX
                                </button>
                                <button
                                    onClick={onAnalyzeLeads}
                                    className="hud-btn primary"
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}
                                >
                                    ANALYZE ALL <ChevronRight size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {leads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                            <Search size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <p>Ready to deploy agents.</p>
                        </div>
                    ) : (
                        leads.map((lead, idx) => (
                            <div key={idx} className="list-item">
                                <div style={{ width: '30px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{idx + 1}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: '#fff' }}>{lead.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)' }}>{lead.website}</div>
                                    {lead.address && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            📍 {lead.address}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', fontSize: '0.85rem' }}>
                                    {lead.phone && <span>📞 {lead.phone}</span>}
                                    {lead.email && <span>✉️ {lead.email}</span>}
                                    {lead.rating && (
                                        <span className="badge neutral">
                                            ⭐ {lead.rating} ({lead.reviews})
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export default LeadsScraper
