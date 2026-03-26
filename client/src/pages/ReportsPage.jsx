import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, FileText, RefreshCw, Sparkles } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { api } from '../lib/api';

function formatDateTime(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
}

export default function ReportsPage({ onNavigate }) {
    const [reports, setReports] = useState([]);
    const [leads, setLeads] = useState([]);
    const [leadId, setLeadId] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [reportData, leadData] = await Promise.all([
                api.getReports(),
                api.getLeads()
            ]);
            setReports(reportData || []);
            setLeads(leadData || []);
            setLeadId((current) => current || leadData?.find((lead) => lead.analysis?.summary)?.id || '');
        } catch (err) {
            console.error('Failed to load reports', err);
            setError(err.message || 'Unable to load reports.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const eligibleLeads = useMemo(() => (
        leads.filter((lead) => lead.analysis?.summary)
    ), [leads]);

    const stats = useMemo(() => {
        const now = Date.now();
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        return {
            total: reports.length,
            shareReady: reports.filter((report) => report.shareUrl).length,
            pdfReady: reports.filter((report) => report.pdfArtifactId).length,
            recent: reports.filter((report) => new Date(report.createdAt).getTime() >= weekAgo).length
        };
    }, [reports]);

    const generateReport = async (event) => {
        event.preventDefault();
        if (!leadId) return;
        setBusy(true);
        setError('');
        try {
            await api.createReport({ leadId });
            await loadData();
        } catch (err) {
            console.error('Failed to generate report', err);
            setError(err.message || 'Unable to generate report.');
        } finally {
            setBusy(false);
        }
    };

    const copyShareLink = async (shareUrl) => {
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch (err) {
            console.error('Failed to copy share URL', err);
            setError('Clipboard copy failed. Open the report directly instead.');
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="dashboard-grid">
                <StatsCard icon={<FileText size={16} />} title="Reports" value={stats.total} subtext="Generated report groups" />
                <StatsCard icon={<ExternalLink size={16} />} title="Share Links" value={stats.shareReady} subtext="Public report URLs" />
                <StatsCard icon={<Download size={16} />} title="PDFs" value={stats.pdfReady} subtext="Downloadable artifacts" />
                <StatsCard icon={<Sparkles size={16} />} title="Last 7 Days" value={stats.recent} subtext="Recent report volume" />
            </div>

            <div className="widget">
                <div className="widget-header">
                    <div className="widget-title">Generate New Report</div>
                    <button className="hud-btn" type="button" onClick={loadData}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                <form onSubmit={generateReport} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                    <label className="sequence-field">
                        <span className="stat-label">Lead with completed analysis</span>
                        <select className="hud-input" value={leadId} onChange={(event) => setLeadId(event.target.value)}>
                            <option value="">Select a lead</option>
                            {eligibleLeads.map((lead) => (
                                <option key={lead.id} value={lead.id}>
                                    {lead.name} {lead.website ? `- ${lead.website}` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="hud-btn primary" type="submit" disabled={busy || !leadId}>
                        <Sparkles size={14} /> Generate
                    </button>
                </form>

                {eligibleLeads.length === 0 && (
                    <div className="row-preview" style={{ marginTop: '0.75rem' }}>
                        No analyzed leads yet. Run audits first, then generate branded reports here.
                    </div>
                )}
            </div>

            {error && <div className="campaigns-error">{error}</div>}

            <div className="widget">
                <div className="widget-header">
                    <div className="widget-title">Report Library</div>
                </div>

                {loading ? (
                    <div className="campaigns-loading">Loading reports...</div>
                ) : reports.length === 0 ? (
                    <div className="campaigns-empty">
                        No reports yet. Start from Leads or Audits, generate a report, then use it for outbound or client-facing review.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {reports.map((report) => (
                            <div key={report.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{report.leadName}</div>
                                    <div className="row-preview">{report.website || 'No website stored'}</div>
                                    <div className="row-preview">Created {formatDateTime(report.createdAt)}</div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {report.shareUrl && (
                                        <>
                                            <button className="hud-btn" type="button" onClick={() => copyShareLink(report.shareUrl)}>
                                                <Copy size={14} /> Copy link
                                            </button>
                                            <a className="hud-btn" href={report.shareUrl} target="_blank" rel="noreferrer">
                                                <ExternalLink size={14} /> Open
                                            </a>
                                        </>
                                    )}
                                    {report.pdfArtifactId && (
                                        <button
                                            className="hud-btn primary"
                                            type="button"
                                            onClick={() => api.downloadReport(report.pdfArtifactId, `${report.leadName || 'report'}.pdf`)}
                                        >
                                            <Download size={14} /> PDF
                                        </button>
                                    )}
                                    <button className="hud-btn" type="button" onClick={() => onNavigate?.('/campaigns')}>
                                        Use in outreach
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
