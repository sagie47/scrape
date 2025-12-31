import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, List } from 'lucide-react';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import StatsCard from '../components/StatsCard';
import { api, API_BASE } from '../lib/api';
import { supabase } from '../lib/supabaseClient';

/**
 * @typedef {Object} Lead
 * @property {string} id
 * @property {string} name
 * @property {string} [company]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {string} [address]
 * @property {Object} [analysis]
 * @property {string} [auditUrl]
 */

/**
 * @typedef {Object} CampaignLead
 * @property {string} id
 * @property {string} leadId
 * @property {string} state
 * @property {number} [currentStep]
 * @property {string} [nextDue]
 * @property {string} [outcome]
 */

/**
 * @typedef {Object} CampaignDetail
 * @property {string} id
 * @property {string} name
 * @property {string} status
 * @property {string} createdAt
 * @property {string} [startAt]
 * @property {Object} stats
 * @property {CampaignLead[]} leads
 */

const formatDate = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString();
};

/**
 * @param {object} props
 * @param {string} props.campaignId
 * @param {(path: string) => void} props.onNavigate
 */
export default function CampaignDashboard({ campaignId, onNavigate }) {
    const [campaign, setCampaign] = useState(/** @type {CampaignDetail|null} */(null));
    const [leads, setLeads] = useState(/** @type {Lead[]} */([]));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stateFilter, setStateFilter] = useState('all');
    const [outcomeFilter, setOutcomeFilter] = useState('all');
    const [activeLead, setActiveLead] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadCampaign = async () => {
            if (!campaignId) return;
            setLoading(true);
            setError('');
            try {
                const [campaignData, leadsData] = await Promise.all([
                    api.getCampaign(campaignId),
                    api.get('/leads')
                ]);
                if (!isMounted) return;
                setCampaign(campaignData);
                setLeads(leadsData || []);
            } catch (err) {
                console.error('Failed to load campaign', err);
                if (isMounted) setError('Unable to load campaign.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadCampaign();
        return () => { isMounted = false; };
    }, [campaignId]);

    useEffect(() => {
        setActiveLead(null);
    }, [campaignId]);

    const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);

    const mergedLeads = useMemo(() => {
        if (!campaign) return [];
        return campaign.leads.map((entry) => ({
            ...entry,
            lead: leadMap.get(entry.leadId)
        }));
    }, [campaign, leadMap]);

    const filteredLeads = useMemo(() => (
        mergedLeads.filter((entry) => {
            if (stateFilter !== 'all' && entry.state !== stateFilter) return false;
            if (outcomeFilter !== 'all' && (entry.outcome || 'none') !== outcomeFilter) return false;
            return true;
        })
    ), [mergedLeads, outcomeFilter, stateFilter]);

    const handleOutcome = async (campaignLeadId, outcome) => {
        try {
            await api.setOutcome(campaignLeadId, outcome);
            setCampaign((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    leads: prev.leads.map((lead) => (
                        lead.id === campaignLeadId ? { ...lead, outcome } : lead
                    ))
                };
            });
        } catch (err) {
            console.error('Failed to set outcome', err);
            alert('Failed to set outcome.');
        }
    };

    const handleExport = async () => {
        if (!campaignId) return;
        setExporting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${API_BASE}/campaigns/${campaignId}/export.csv`, {
                headers: {
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
                }
            });
            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Export failed');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `campaign_${campaignId}.csv`;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export', err);
            alert('Export failed.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="campaign-dashboard animate-fade-in">
            <div className="campaigns-header">
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{campaign?.name || 'Campaign'}</h2>
                    <p className="campaigns-subtitle">
                        Status: {campaign?.status || '--'} - Created {formatDate(campaign?.createdAt)} - Started {formatDate(campaign?.startAt)}
                    </p>
                </div>
                <div className="campaign-dashboard-actions">
                    <button className="hud-btn" type="button" onClick={() => onNavigate(`/campaigns/${campaignId}/tasks`)}>
                        <List size={14} /> Task Inbox
                    </button>
                    <button className="hud-btn primary" type="button" onClick={handleExport} disabled={exporting}>
                        <FileSpreadsheet size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {error && <div className="campaigns-error">{error}</div>}

            {loading ? (
                <div className="campaigns-loading">Loading campaign...</div>
            ) : (
                <>
                    <div className="dashboard-grid">
                        <StatsCard title="Enrolled" value={campaign?.stats?.total ?? 0} subtext="Total leads" />
                        <StatsCard title="In Progress" value={campaign?.stats?.inProgress ?? 0} subtext="Active leads" />
                        <StatsCard title="Stopped" value={campaign?.stats?.stopped ?? 0} subtext="Paused or exited" />
                        <StatsCard title="Completed" value={campaign?.stats?.completed ?? 0} subtext="Finished" />
                    </div>

                    <div className="widget leads-table">
                        <div className="widget-header">
                            <div className="widget-title">Leads ({filteredLeads.length})</div>
                            <div className="leads-table-filters">
                                <select
                                    className="hud-input leads-filter"
                                    value={stateFilter}
                                    onChange={(event) => setStateFilter(event.target.value)}
                                >
                                    <option value="all">All states</option>
                                    <option value="queued">Queued</option>
                                    <option value="in_progress">In progress</option>
                                    <option value="waiting">Waiting</option>
                                    <option value="stopped">Stopped</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <select
                                    className="hud-input leads-filter"
                                    value={outcomeFilter}
                                    onChange={(event) => setOutcomeFilter(event.target.value)}
                                >
                                    <option value="all">All outcomes</option>
                                    <option value="replied">Replied</option>
                                    <option value="booked">Booked</option>
                                    <option value="not_interested">Not interested</option>
                                    <option value="no_response">No response</option>
                                    <option value="skipped">Skipped</option>
                                    <option value="none">No outcome</option>
                                </select>
                            </div>
                        </div>

                        <div className="leads-table-grid leads-table-header">
                            <div>Lead</div>
                            <div>Status</div>
                            <div>Step</div>
                            <div>Next Due</div>
                            <div>Outcome</div>
                        </div>
                        <div className="leads-table-body">
                            {filteredLeads.length === 0 && (
                                <div className="leads-empty">No leads match your filters.</div>
                            )}
                            {filteredLeads.map((entry) => {
                                const lead = entry.lead || {};
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className="leads-table-grid leads-table-row"
                                        onClick={() => setActiveLead({ ...entry, lead })}
                                    >
                                        <div className="leads-table-lead">
                                            <div className="leads-table-name">{lead.name || entry.leadId}</div>
                                            <div className="leads-table-meta">{lead.website || lead.email || lead.phone || '--'}</div>
                                        </div>
                                        <div><span className={`badge status-badge status-${entry.state}`}>{entry.state.replace('_', ' ')}</span></div>
                                        <div>{entry.currentStep ?? '--'}</div>
                                        <div>{formatDate(entry.nextDue)}</div>
                                        <div>{entry.outcome || '--'}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            <LeadDetailDrawer
                open={Boolean(activeLead)}
                lead={activeLead?.lead}
                analysisSummary={activeLead?.lead?.analysis?.summary || activeLead?.lead?.analysisSummary}
                auditUrl={activeLead?.lead?.auditUrl}
                activity={activeLead?.activity || []}
                onOutcome={(outcome) => handleOutcome(activeLead.id, outcome)}
                onSkipRemaining={() => handleOutcome(activeLead.id, 'skipped')}
                onClose={() => setActiveLead(null)}
            />
        </div>
    );
}
