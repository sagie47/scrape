import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, LayoutDashboard, RefreshCw, Search, Sparkles, Users } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { api } from '../lib/api';

const EMPTY_SELECTION = new Set();

function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString();
}

function summarizeAnalysis(lead) {
    return lead.analysis?.summary || lead.analysis?.analysisSummary || 'No CRO summary yet.';
}

export default function LeadsPage({ onNavigate }) {
    const [leads, setLeads] = useState([]);
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [selectedIds, setSelectedIds] = useState(EMPTY_SELECTION);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const loadLeads = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.getLeads();
            setLeads(data || []);
            setSelectedLeadId((current) => current || data?.[0]?.id || '');
        } catch (err) {
            console.error('Failed to load leads', err);
            setError(err.message || 'Unable to load leads.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeads();
    }, []);

    const filteredLeads = useMemo(() => {
        const query = search.trim().toLowerCase();
        return (leads || []).filter((lead) => {
            if (query) {
                const haystack = [
                    lead.name,
                    lead.website,
                    lead.email,
                    lead.category,
                    lead.city,
                    lead.region
                ].filter(Boolean).join(' ').toLowerCase();

                if (!haystack.includes(query)) {
                    return false;
                }
            }

            if (filter === 'website' && !lead.website) return false;
            if (filter === 'unanalyzed' && lead.analysis?.summary) return false;
            if (filter === 'analyzed' && !lead.analysis?.summary) return false;
            if (filter === 'report-ready' && !lead.lastReportId) return false;

            return true;
        });
    }, [filter, leads, search]);

    const selectedLead = useMemo(() => (
        filteredLeads.find((lead) => lead.id === selectedLeadId)
        || leads.find((lead) => lead.id === selectedLeadId)
        || null
    ), [filteredLeads, leads, selectedLeadId]);

    useEffect(() => {
        if (!selectedLeadId && filteredLeads[0]?.id) {
            setSelectedLeadId(filteredLeads[0].id);
        }
    }, [filteredLeads, selectedLeadId]);

    const stats = useMemo(() => ({
        total: leads.length,
        withWebsites: leads.filter((lead) => lead.website).length,
        analyzed: leads.filter((lead) => lead.analysis?.summary).length,
        reports: leads.filter((lead) => lead.lastReportId).length
    }), [leads]);

    const toggleLead = (leadId) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(leadId)) next.delete(leadId);
            else next.add(leadId);
            return next;
        });
    };

    const selectVisible = () => {
        setSelectedIds(new Set(filteredLeads.map((lead) => lead.id)));
    };

    const clearSelected = () => setSelectedIds(new Set());

    const analyzeLeadIds = async (leadIds) => {
        if (!leadIds.length) return;

        setBusy(true);
        setError('');
        try {
            const response = await api.createAnalysisJob({ leadIds });
            clearSelected();
            if (response?.jobId) {
                onNavigate?.('/audits');
            }
        } catch (err) {
            console.error('Failed to start analysis', err);
            setError(err.message || 'Unable to start analysis.');
        } finally {
            setBusy(false);
        }
    };

    const generateReport = async (leadId) => {
        if (!leadId) return;
        setBusy(true);
        setError('');
        try {
            await api.createReport({ leadId });
            await loadLeads();
            onNavigate?.('/reports');
        } catch (err) {
            console.error('Failed to generate report', err);
            setError(err.message || 'Unable to generate report.');
        } finally {
            setBusy(false);
        }
    };

    const exportLeads = async (format) => {
        setBusy(true);
        try {
            await api.downloadLeadExport(format);
        } catch (err) {
            console.error('Failed to export leads', err);
            setError(err.message || 'Unable to export leads.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="dashboard-grid">
                <StatsCard icon={<Users size={16} />} title="Leads" value={stats.total} subtext="Stored prospect records" />
                <StatsCard icon={<Search size={16} />} title="With Websites" value={stats.withWebsites} subtext="Ready for CRO analysis" />
                <StatsCard icon={<LayoutDashboard size={16} />} title="Analyzed" value={stats.analyzed} subtext="Structured audit summaries" />
                <StatsCard icon={<FileText size={16} />} title="Reports" value={stats.reports} subtext="Share-ready artifacts" />
            </div>

            <div className="widget">
                <div className="widget-header">
                    <div className="widget-title">Lead Inventory</div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="hud-btn" type="button" onClick={loadLeads}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button className="hud-btn" type="button" onClick={() => exportLeads('csv')} disabled={busy}>
                            <Download size={14} /> CSV
                        </button>
                        <button className="hud-btn" type="button" onClick={() => exportLeads('xlsx')} disabled={busy}>
                            <Download size={14} /> XLSX
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto auto', gap: '0.75rem', marginBottom: '1rem' }}>
                    <label className="sequence-field">
                        <span className="stat-label">Search</span>
                        <input
                            className="hud-input"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Business, city, website, category"
                        />
                    </label>
                    <label className="sequence-field">
                        <span className="stat-label">Filter</span>
                        <select className="hud-input" value={filter} onChange={(event) => setFilter(event.target.value)}>
                            <option value="all">All leads</option>
                            <option value="website">Has website</option>
                            <option value="unanalyzed">Needs analysis</option>
                            <option value="analyzed">Analyzed</option>
                            <option value="report-ready">Has report</option>
                        </select>
                    </label>
                    <button className="hud-btn" type="button" onClick={selectVisible}>Select visible</button>
                    <button className="hud-btn" type="button" onClick={clearSelected}>Clear</button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button className="hud-btn primary" type="button" onClick={() => analyzeLeadIds([...selectedIds])} disabled={busy || selectedIds.size === 0}>
                        <Sparkles size={14} /> Analyze selected ({selectedIds.size})
                    </button>
                    <div className="row-preview">
                        Select businesses with live websites, then push them into the audit queue.
                    </div>
                </div>

                {error && <div className="campaigns-error">{error}</div>}

                <div className="campaign-builder-grid" style={{ alignItems: 'start' }}>
                    <div className="campaign-builder-column">
                        {loading ? (
                            <div className="campaigns-loading">Loading leads...</div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="campaigns-empty">No leads match the current filters.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {filteredLeads.map((lead) => {
                                    const checked = selectedIds.has(lead.id);
                                    return (
                                        <div
                                            key={lead.id}
                                            className="leads-table-row"
                                            style={{
                                                borderColor: selectedLeadId === lead.id ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                                                background: selectedLeadId === lead.id ? 'rgba(0, 240, 255, 0.06)' : undefined
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleLead(lead.id)}
                                                    style={{ marginTop: '0.25rem' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLeadId(lead.id)}
                                                    style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', width: '100%', cursor: 'pointer' }}
                                                >
                                                    <div className="leads-table-name">{lead.name || 'Unnamed business'}</div>
                                                    <div className="leads-table-meta">
                                                        {[lead.category, lead.city || lead.region, lead.website || lead.email || lead.phone].filter(Boolean).join(' • ') || '--'}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                                                        {lead.website && <span className="badge neutral">website</span>}
                                                        {lead.analysis?.summary && <span className="badge active">analyzed</span>}
                                                        {lead.lastReportId && <span className="badge active">report</span>}
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="campaign-builder-column">
                        <div className="widget" style={{ minHeight: '100%' }}>
                            <div className="widget-header">
                                <div className="widget-title">Selected Lead</div>
                            </div>

                            {!selectedLead ? (
                                <div className="campaigns-empty">Select a lead to inspect analysis readiness, contact detail, and report status.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedLead.name}</div>
                                        <div className="leads-table-meta">{selectedLead.website || selectedLead.email || selectedLead.phone || '--'}</div>
                                    </div>

                                    <div className="drawer-info-grid">
                                        <div>
                                            <div className="stat-label">Category</div>
                                            <div className="drawer-info-value">{selectedLead.category || '--'}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Location</div>
                                            <div className="drawer-info-value">{[selectedLead.city, selectedLead.region, selectedLead.country].filter(Boolean).join(', ') || '--'}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Email</div>
                                            <div className="drawer-info-value">{selectedLead.email || '--'}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Imported</div>
                                            <div className="drawer-info-value">{formatDate(selectedLead.createdAt)}</div>
                                        </div>
                                    </div>

                                    <div className="sequence-step-card">
                                        <div className="drawer-section-title">Audit Summary</div>
                                        <div className="preview-body">{summarizeAnalysis(selectedLead)}</div>
                                    </div>

                                    <div className="sequence-step-card">
                                        <div className="drawer-section-title">Status</div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span className={`badge ${selectedLead.website ? 'active' : 'neutral'}`}>{selectedLead.website ? 'website found' : 'no website'}</span>
                                            <span className={`badge ${selectedLead.analysis?.summary ? 'active' : 'neutral'}`}>{selectedLead.analysis?.summary ? 'analysis ready' : 'needs analysis'}</span>
                                            <span className={`badge ${selectedLead.lastReportId ? 'active' : 'neutral'}`}>{selectedLead.lastReportId ? 'report ready' : 'no report'}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button
                                            className="hud-btn primary"
                                            type="button"
                                            onClick={() => analyzeLeadIds([selectedLead.id])}
                                            disabled={busy || !selectedLead.website}
                                        >
                                            <LayoutDashboard size={14} /> Run audit
                                        </button>
                                        <button
                                            className="hud-btn"
                                            type="button"
                                            onClick={() => generateReport(selectedLead.id)}
                                            disabled={busy || !selectedLead.analysis?.summary}
                                        >
                                            <FileText size={14} /> Generate report
                                        </button>
                                        {selectedLead.lastReportId && (
                                            <button className="hud-btn" type="button" onClick={() => onNavigate?.('/reports')}>
                                                Open reports
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
