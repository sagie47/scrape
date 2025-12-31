import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Eye, PlusCircle } from 'lucide-react';
import { api } from '../lib/api';

/**
 * @typedef {Object} CampaignSummary
 * @property {string} id
 * @property {string} name
 * @property {"draft"|"active"|"paused"} status
 * @property {string|null} sequenceName
 * @property {number} leadsCount
 * @property {string} createdAt
 * @property {string|null} startAt
 */

/**
 * @typedef {Object} CampaignStats
 * @property {number} total
 * @property {number} queued
 * @property {number} inProgress
 * @property {number} waiting
 * @property {number} stopped
 * @property {number} completed
 */

const statusLabel = (status) => {
    if (status === 'active') return 'Active';
    if (status === 'paused') return 'Paused';
    return 'Draft';
};

/**
 * @param {object} props
 * @param {(path: string) => void} props.onNavigate
 */
export default function CampaignsList({ onNavigate }) {
    const [campaigns, setCampaigns] = useState(/** @type {CampaignSummary[]} */([]));
    const [statsById, setStatsById] = useState(/** @type {Record<string, CampaignStats>} */({}));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;
        const loadCampaigns = async () => {
            setLoading(true);
            setError('');
            try {
                const list = await api.getCampaigns();
                if (!isMounted) return;
                setCampaigns(list || []);
                const statsEntries = await Promise.all((list || []).map(async (campaign) => {
                    try {
                        const detail = await api.getCampaign(campaign.id);
                        return [campaign.id, detail.stats];
                    } catch (err) {
                        console.error('Failed to load campaign stats', err);
                        return null;
                    }
                }));
                if (!isMounted) return;
                const nextStats = {};
                statsEntries.forEach((entry) => {
                    if (entry) nextStats[entry[0]] = entry[1];
                });
                setStatsById(nextStats);
            } catch (err) {
                console.error('Failed to load campaigns', err);
                if (isMounted) setError('Unable to load campaigns.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadCampaigns();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleActivate = async (campaignId) => {
        try {
            await api.activateCampaign(campaignId);
            setCampaigns((prev) => prev.map((campaign) => (
                campaign.id === campaignId ? { ...campaign, status: 'active', startAt: new Date().toISOString() } : campaign
            )));
        } catch (err) {
            console.error('Failed to activate campaign', err);
            alert('Failed to activate campaign.');
        }
    };

    const handlePause = async (campaignId) => {
        try {
            await api.pauseCampaign(campaignId);
            setCampaigns((prev) => prev.map((campaign) => (
                campaign.id === campaignId ? { ...campaign, status: 'paused' } : campaign
            )));
        } catch (err) {
            console.error('Failed to pause campaign', err);
            alert('Failed to pause campaign.');
        }
    };

    const cards = useMemo(() => campaigns.map((campaign) => {
        const stats = statsById[campaign.id];
        const pending = stats ? stats.queued + stats.inProgress + stats.waiting : null;
        const completedPct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : null;

        return (
            <div key={campaign.id} className="widget campaign-card">
                <div className="campaign-card-header">
                    <div>
                        <div className="campaign-card-title">{campaign.name}</div>
                        <div className="campaign-card-subtitle">{campaign.sequenceName || 'No sequence'}</div>
                    </div>
                    <span className={`badge status-badge status-${campaign.status}`}>
                        {statusLabel(campaign.status)}
                    </span>
                </div>
                <div className="campaign-card-stats">
                    <div className="campaign-stat">
                        <div className="stat-value">{campaign.leadsCount}</div>
                        <div className="stat-label">Leads</div>
                    </div>
                    <div className="campaign-stat">
                        <div className="stat-value">{pending ?? '--'}</div>
                        <div className="stat-label">Pending Tasks</div>
                    </div>
                    <div className="campaign-stat">
                        <div className="stat-value">{completedPct !== null ? `${completedPct}%` : '--'}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                </div>
                <div className="campaign-card-actions">
                    <button className="hud-btn" type="button" onClick={() => onNavigate(`/campaigns/${campaign.id}`)}>
                        <Eye size={14} /> View
                    </button>
                    {campaign.status === 'active' ? (
                        <button className="hud-btn" type="button" onClick={() => handlePause(campaign.id)}>
                            <Pause size={14} /> Pause
                        </button>
                    ) : (
                        <button className="hud-btn primary" type="button" onClick={() => handleActivate(campaign.id)}>
                            <Play size={14} /> Activate
                        </button>
                    )}
                </div>
            </div>
        );
    }), [campaigns, onNavigate, statsById]);

    return (
        <div className="campaigns-page animate-fade-in">
            <div className="campaigns-header">
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Campaigns</h2>
                    <p className="campaigns-subtitle">Track outreach states and launch new sequences.</p>
                </div>
                <button className="hud-btn primary" type="button" onClick={() => onNavigate('/campaigns/new')}>
                    <PlusCircle size={16} /> New Campaign
                </button>
            </div>

            {error && <div className="campaigns-error">{error}</div>}

            {loading ? (
                <div className="campaigns-loading">Loading campaigns...</div>
            ) : (
                <div className="campaigns-grid">
                    {campaigns.length === 0 ? (
                        <div className="campaigns-empty widget">
                            No campaigns yet. Create your first outreach run.
                        </div>
                    ) : cards}
                </div>
            )}
        </div>
    );
}
