import { useEffect, useMemo, useState } from 'react';
import { FileText, Globe, LayoutDashboard, RefreshCw, ScanSearch, Sparkles } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { api } from '../lib/api';

const AUDIT_JOB_TYPES = new Set(['lead_analysis', 'single', 'batch']);
const ACTIVE_STATUSES = new Set(['queued', 'running']);

function formatDateTime(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
}

function statusLabel(value) {
    return (value || 'unknown').replace(/_/g, ' ');
}

export default function AuditsPage({ onNavigate }) {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [selectedResultId, setSelectedResultId] = useState('');
    const [singleUrl, setSingleUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const loadJobs = async () => {
        setLoading(true);
        setError('');
        try {
            const allJobs = await api.getJobs();
            const auditJobs = (allJobs || []).filter((job) => AUDIT_JOB_TYPES.has(job.type));
            setJobs(auditJobs);
            setSelectedJobId((current) => current || auditJobs[0]?.id || '');
        } catch (err) {
            console.error('Failed to load audit jobs', err);
            setError(err.message || 'Unable to load audit jobs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, []);

    const selectedJob = useMemo(() => (
        jobs.find((job) => job.id === selectedJobId) || null
    ), [jobs, selectedJobId]);

    const selectedResult = useMemo(() => (
        selectedJob?.results?.find((result) => result.id === selectedResultId)
        || selectedJob?.results?.[0]
        || null
    ), [selectedJob, selectedResultId]);

    useEffect(() => {
        if (selectedJob?.results?.length) {
            setSelectedResultId((current) => current || selectedJob.results[0].id);
        } else {
            setSelectedResultId('');
        }
    }, [selectedJob]);

    useEffect(() => {
        const activeIds = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).map((job) => job.id);
        if (!activeIds.length) return undefined;

        const interval = window.setInterval(async () => {
            try {
                const refreshed = await Promise.all(activeIds.map((jobId) => api.getJobStatus(jobId)));
                setJobs((current) => current.map((job) => refreshed.find((item) => item.id === job.id) || job));
            } catch (err) {
                console.error('Failed to refresh audit jobs', err);
            }
        }, 5000);

        return () => window.clearInterval(interval);
    }, [jobs]);

    const stats = useMemo(() => ({
        total: jobs.length,
        active: jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length,
        analyzed: jobs.reduce((sum, job) => sum + (job.processed || 0), 0),
        errors: jobs.reduce((sum, job) => sum + ((job.errors || []).length), 0)
    }), [jobs]);

    const runSingleAudit = async (event) => {
        event.preventDefault();
        if (!singleUrl.trim()) return;
        setBusy(true);
        setError('');
        try {
            const created = await api.analyzeSingle({ url: singleUrl.trim() });
            setSingleUrl('');
            await loadJobs();
            if (created?.jobId) setSelectedJobId(created.jobId);
        } catch (err) {
            console.error('Failed to analyze single URL', err);
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
            onNavigate?.('/reports');
        } catch (err) {
            console.error('Failed to generate report', err);
            setError(err.message || 'Unable to generate report from audit result.');
        } finally {
            setBusy(false);
        }
    };

    const report = selectedResult?.report || {};
    const issues = Array.isArray(report.issues) ? report.issues : [];
    const quickWins = Array.isArray(report.quick_wins) ? report.quick_wins : [];

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="dashboard-grid">
                <StatsCard icon={<LayoutDashboard size={16} />} title="Audit Jobs" value={stats.total} subtext="Batch and single runs" />
                <StatsCard icon={<Sparkles size={16} />} title="Active" value={stats.active} subtext="Queued or running" />
                <StatsCard icon={<ScanSearch size={16} />} title="Analyzed URLs" value={stats.analyzed} subtext="Completed screenshots and reviews" />
                <StatsCard icon={<Globe size={16} />} title="Errors" value={stats.errors} subtext="Jobs with blockers" />
            </div>

            <div className="campaign-builder-grid" style={{ alignItems: 'start' }}>
                <div className="campaign-builder-column">
                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Ad Hoc Audit</div>
                        </div>
                        <form onSubmit={runSingleAudit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <input
                                className="hud-input"
                                style={{ flex: 1, minWidth: '260px' }}
                                value={singleUrl}
                                onChange={(event) => setSingleUrl(event.target.value)}
                                placeholder="https://example.com"
                            />
                            <button className="hud-btn primary" type="submit" disabled={busy}>
                                <Sparkles size={14} /> Run audit
                            </button>
                        </form>
                    </div>

                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Recent Audit Jobs</div>
                            <button className="hud-btn" type="button" onClick={loadJobs}>
                                <RefreshCw size={14} /> Refresh
                            </button>
                        </div>

                        {loading ? (
                            <div className="campaigns-loading">Loading audit jobs...</div>
                        ) : jobs.length === 0 ? (
                            <div className="campaigns-empty">No audit jobs yet. Start from Leads or run a single URL here.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {jobs.map((job) => (
                                    <button
                                        key={job.id}
                                        type="button"
                                        className="leads-table-row"
                                        onClick={() => setSelectedJobId(job.id)}
                                        style={{
                                            borderColor: selectedJobId === job.id ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                                            background: selectedJobId === job.id ? 'rgba(0, 240, 255, 0.06)' : undefined
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ textAlign: 'left' }}>
                                                <div className="leads-table-name">{job.name}</div>
                                                <div className="leads-table-meta">{formatDateTime(job.createdAt)}</div>
                                            </div>
                                            <span className={`badge status-badge status-${job.status}`}>{statusLabel(job.status)}</span>
                                        </div>
                                        <div style={{ marginTop: '0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {job.processed || 0} / {job.total || 0} analyzed
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="campaign-builder-column">
                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Selected Audit</div>
                        </div>

                        {!selectedJob ? (
                            <div className="campaigns-empty">Select a job to inspect screenshots, issues, and report generation status.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedJob.name}</div>
                                        <div className="leads-table-meta">{formatDateTime(selectedJob.createdAt)}</div>
                                    </div>
                                    <span className={`badge status-badge status-${selectedJob.status}`}>{statusLabel(selectedJob.status)}</span>
                                </div>

                                <div className="campaign-card-stats">
                                    <div className="campaign-stat">
                                        <div className="stat-value">{selectedJob.processed || 0}</div>
                                        <div className="stat-label">Processed</div>
                                    </div>
                                    <div className="campaign-stat">
                                        <div className="stat-value">{selectedJob.total || 0}</div>
                                        <div className="stat-label">Target</div>
                                    </div>
                                    <div className="campaign-stat">
                                        <div className="stat-value">{selectedJob.results?.length || 0}</div>
                                        <div className="stat-label">Results</div>
                                    </div>
                                </div>

                                {selectedJob.results?.length ? (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div className="drawer-section-title">Result Rows</div>
                                        {selectedJob.results.map((result) => (
                                            <button
                                                key={result.id}
                                                type="button"
                                                className="leads-table-row"
                                                onClick={() => setSelectedResultId(result.id)}
                                                style={{
                                                    borderColor: selectedResult?.id === result.id ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                                                    background: selectedResult?.id === result.id ? 'rgba(0, 240, 255, 0.06)' : undefined
                                                }}
                                            >
                                                <div className="leads-table-name">{result.name || result.url}</div>
                                                <div className="leads-table-meta">{result.url}</div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="drawer-empty">No result rows yet.</div>
                                )}

                                {selectedResult && (
                                    <>
                                        {selectedResult.screenshot && (
                                            <img
                                                src={api.getScreenshotUrl(selectedResult.screenshot)}
                                                alt={selectedResult.name || selectedResult.url}
                                                style={{ width: '100%', borderRadius: '14px', border: '1px solid var(--glass-border)' }}
                                            />
                                        )}

                                        <div className="sequence-step-card">
                                            <div className="drawer-section-title">Executive Summary</div>
                                            <div className="preview-body">{report.summary || selectedResult.error || 'No summary available yet.'}</div>
                                        </div>

                                        <div className="drawer-info-grid">
                                            <div>
                                                <div className="stat-label">Confidence</div>
                                                <div className="drawer-info-value">{report.confidence ?? '--'}</div>
                                            </div>
                                            <div>
                                                <div className="stat-label">Lead Linked</div>
                                                <div className="drawer-info-value">{selectedResult.leadId ? 'yes' : 'no'}</div>
                                            </div>
                                        </div>

                                        <div className="sequence-step-card">
                                            <div className="drawer-section-title">Top Issues</div>
                                            <div className="preview-body">{issues.length ? issues.join('\n') : 'No structured issues returned yet.'}</div>
                                        </div>

                                        <div className="sequence-step-card">
                                            <div className="drawer-section-title">Quick Wins</div>
                                            <div className="preview-body">{quickWins.length ? quickWins.join('\n') : 'No quick wins returned yet.'}</div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            {selectedResult.url && (
                                                <a className="hud-btn" href={selectedResult.url} target="_blank" rel="noreferrer">
                                                    <Globe size={14} /> Open site
                                                </a>
                                            )}
                                            <button
                                                className="hud-btn primary"
                                                type="button"
                                                onClick={() => generateReport(selectedResult.leadId)}
                                                disabled={busy || !selectedResult.leadId}
                                            >
                                                <FileText size={14} /> Generate report
                                            </button>
                                        </div>
                                    </>
                                )}

                                {selectedJob.errors?.length > 0 && (
                                    <div className="campaigns-error">{selectedJob.errors.join('\n')}</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="campaigns-error">{error}</div>}
        </div>
    );
}
