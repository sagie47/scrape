import { useEffect, useMemo, useState } from 'react';
import { Compass, Loader2, MapPinned, RefreshCw, SearchCheck, TimerReset } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { api } from '../lib/api';

const DEFAULT_FORM = {
    keyword: '',
    location: '',
    limit: 25,
    email: '',
    depth: 1,
    fastMode: false
};

const ACTIVE_STATUSES = new Set(['queued', 'running']);

const formatDateTime = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
};

const formatStatus = (status) => (status || 'unknown').replace(/_/g, ' ');

export default function ProspectingPage() {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState('');

    const loadJobs = async (preserveSelection = true) => {
        setLoadingJobs(true);
        try {
            const allJobs = await api.getJobs();
            const mapsJobs = (allJobs || []).filter((job) => job.type === 'maps_import');
            setJobs(mapsJobs);
            setSelectedJobId((current) => {
                if (preserveSelection && current && mapsJobs.some((job) => job.id === current)) {
                    return current;
                }
                return mapsJobs[0]?.id || '';
            });
        } catch (err) {
            console.error('Failed to load maps jobs', err);
            setError(err.message || 'Unable to load prospecting jobs.');
        } finally {
            setLoadingJobs(false);
        }
    };

    useEffect(() => {
        loadJobs(false);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadDetail = async () => {
            if (!selectedJobId) {
                setSelectedJob(null);
                return;
            }
            setLoadingDetail(true);
            try {
                const detail = await api.getMapsJob(selectedJobId);
                if (!cancelled) setSelectedJob(detail);
            } catch (err) {
                console.error('Failed to load maps job detail', err);
                if (!cancelled) setError(err.message || 'Unable to load job detail.');
            } finally {
                if (!cancelled) setLoadingDetail(false);
            }
        };
        loadDetail();
        return () => {
            cancelled = true;
        };
    }, [selectedJobId]);

    useEffect(() => {
        const activeIds = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).map((job) => job.id);
        if (activeIds.length === 0) return undefined;

        const interval = window.setInterval(async () => {
            try {
                const refreshed = await Promise.all(activeIds.map((jobId) => api.getMapsJob(jobId)));
                setJobs((current) => current.map((job) => refreshed.find((item) => item.id === job.id) || job));
                setSelectedJob((current) => {
                    if (!current) return current;
                    return refreshed.find((job) => job.id === current.id) || current;
                });
            } catch (err) {
                console.error('Failed to poll maps jobs', err);
            }
        }, 5000);

        return () => window.clearInterval(interval);
    }, [jobs]);

    const stats = useMemo(() => {
        const importedLeads = jobs.reduce((sum, job) => sum + (job.processed || 0), 0);
        const activeCount = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
        const lastRun = jobs[0]?.createdAt;
        return { importedLeads, activeCount, totalJobs: jobs.length, lastRun };
    }, [jobs]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                keyword: form.keyword.trim(),
                location: form.location.trim(),
                limit: Number(form.limit) || 25,
                email: form.email.trim() || undefined,
                depth: Number(form.depth) || 1,
                fastMode: Boolean(form.fastMode)
            };
            const created = await api.createMapsJob(payload);
            await loadJobs(false);
            if (created?.jobId) {
                setSelectedJobId(created.jobId);
            }
        } catch (err) {
            console.error('Failed to create maps job', err);
            setError(err.message || 'Unable to start maps import.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="dashboard-grid">
                <StatsCard icon={<Compass size={16} />} title="Maps Jobs" value={stats.totalJobs} subtext="Recent imports" />
                <StatsCard icon={<MapPinned size={16} />} title="Imported Leads" value={stats.importedLeads} subtext="Across all maps runs" />
                <StatsCard icon={<Loader2 size={16} />} title="Active" value={stats.activeCount} subtext="Queued or running" />
                <StatsCard icon={<TimerReset size={16} />} title="Last Run" value={stats.lastRun ? new Date(stats.lastRun).toLocaleDateString() : '--'} subtext="Most recent import" />
            </div>

            <div className="campaign-builder-grid" style={{ alignItems: 'start' }}>
                <div className="campaign-builder-column">
                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title"><SearchCheck size={16} /> Start Maps Import</div>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <label className="sequence-field">
                                <span className="stat-label">Keyword</span>
                                <input
                                    className="hud-input"
                                    value={form.keyword}
                                    onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))}
                                    placeholder="e.g. plumbers"
                                    required
                                />
                            </label>

                            <label className="sequence-field">
                                <span className="stat-label">Location</span>
                                <input
                                    className="hud-input"
                                    value={form.location}
                                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                                    placeholder="Kelowna, BC"
                                />
                            </label>

                            <div className="sequence-step-grid">
                                <label className="sequence-field">
                                    <span className="stat-label">Lead Limit</span>
                                    <input
                                        className="hud-input"
                                        type="number"
                                        min="1"
                                        max="250"
                                        value={form.limit}
                                        onChange={(event) => setForm((current) => ({ ...current, limit: event.target.value }))}
                                    />
                                </label>

                                <label className="sequence-field">
                                    <span className="stat-label">Depth</span>
                                    <input
                                        className="hud-input"
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={form.depth}
                                        onChange={(event) => setForm((current) => ({ ...current, depth: event.target.value }))}
                                    />
                                </label>
                            </div>

                            <label className="sequence-field">
                                <span className="stat-label">Notification Email</span>
                                <input
                                    className="hud-input"
                                    type="email"
                                    value={form.email}
                                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                    placeholder="optional@domain.com"
                                />
                            </label>

                            <label className="lead-selector-item" style={{ cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.fastMode}
                                    onChange={(event) => setForm((current) => ({ ...current, fastMode: event.target.checked }))}
                                />
                                <div className="lead-selector-content">
                                    <div className="lead-selector-name">Fast mode</div>
                                    <div className="lead-selector-meta">Prefer speed over deeper collection.</div>
                                </div>
                            </label>

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button className="hud-btn primary" type="submit" disabled={submitting}>
                                    {submitting ? <Loader2 size={16} className="spin" /> : <Compass size={16} />}
                                    Start Import
                                </button>
                                <button className="hud-btn" type="button" onClick={() => setForm(DEFAULT_FORM)}>
                                    Reset
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="widget">
                        <div className="widget-header">
                            <div className="widget-title">Recent Maps Jobs</div>
                            <button className="hud-btn" type="button" onClick={() => loadJobs(true)}>
                                <RefreshCw size={14} /> Refresh
                            </button>
                        </div>

                        {loadingJobs ? (
                            <div className="campaigns-loading">Loading maps jobs...</div>
                        ) : jobs.length === 0 ? (
                            <div className="campaigns-empty">No maps jobs yet. Kick off your first import.</div>
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
                                                <div className="leads-table-name">{job.name || job.metadata?.keyword || 'Maps import'}</div>
                                                <div className="leads-table-meta">{formatDateTime(job.createdAt)}</div>
                                            </div>
                                            <span className={`badge status-badge status-${job.status}`}>{formatStatus(job.status)}</span>
                                        </div>
                                        <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            <span>{job.processed || 0} / {job.total || 0} leads</span>
                                            <span>{job.metadata?.location || 'No location set'}</span>
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
                            <div className="widget-title">Selected Job</div>
                        </div>

                        {!selectedJobId ? (
                            <div className="campaigns-empty">Select a maps import to inspect it.</div>
                        ) : loadingDetail && !selectedJob ? (
                            <div className="campaigns-loading">Loading job detail...</div>
                        ) : !selectedJob ? (
                            <div className="campaigns-error">Unable to load the selected job.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedJob.name}</div>
                                            <div className="leads-table-meta">{selectedJob.metadata?.keyword || 'No keyword'}{selectedJob.metadata?.location ? ` in ${selectedJob.metadata.location}` : ''}</div>
                                        </div>
                                        <span className={`badge status-badge status-${selectedJob.status}`}>{formatStatus(selectedJob.status)}</span>
                                    </div>
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
                                        <div className="stat-value">{selectedJob.progress || 0}%</div>
                                        <div className="stat-label">Progress</div>
                                    </div>
                                </div>

                                <div className="sequence-step-card">
                                    <div className="drawer-section-title">Job Metadata</div>
                                    <div className="drawer-info-grid">
                                        <div>
                                            <div className="stat-label">Created</div>
                                            <div className="drawer-info-value">{formatDateTime(selectedJob.createdAt)}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Completed</div>
                                            <div className="drawer-info-value">{formatDateTime(selectedJob.completedAt)}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">Source</div>
                                            <div className="drawer-info-value">{selectedJob.metadata?.source || 'gosom'}</div>
                                        </div>
                                        <div>
                                            <div className="stat-label">External Job ID</div>
                                            <div className="drawer-info-value">{selectedJob.metadata?.externalJobId || '--'}</div>
                                        </div>
                                    </div>
                                </div>

                                {selectedJob.errors?.length > 0 && (
                                    <div className="sequence-step-card" style={{ borderColor: 'rgba(255, 42, 42, 0.2)' }}>
                                        <div className="drawer-section-title" style={{ color: 'var(--accent-error)' }}>Errors</div>
                                        <div className="preview-body">{selectedJob.errors.join('\n')}</div>
                                    </div>
                                )}

                                <div className="sequence-step-card">
                                    <div className="drawer-section-title">What this page tracks</div>
                                    <div className="preview-body">
                                        Maps imports create lead inventory. Once a batch is done, use the Leads page to select businesses for CRO analysis and report generation.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="campaigns-error">{error}</div>}
        </div>
    );
}
