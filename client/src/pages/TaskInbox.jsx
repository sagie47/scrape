import { useEffect, useMemo, useState } from 'react';
import TaskCard from '../components/TaskCard';
import ObsidianDropdown from '../ObsidianDropdown';
import { api } from '../lib/api';

/**
 * @typedef {Object} TaskItem
 * @property {string} id
 * @property {string} channel
 * @property {string} dueAt
 * @property {string} [subject]
 * @property {string} [body]
 * @property {Object} [lead]
 * @property {string} [campaignLeadId]
 */

/**
 * @param {object} props
 * @param {string} [props.campaignId]
 * @param {(path: string) => void} [props.onNavigate]
 */
export default function TaskInbox({ campaignId, onNavigate }) {
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState(campaignId || '');
    const [bucket, setBucket] = useState('today');
    const [tasks, setTasks] = useState(/** @type {TaskItem[]} */([]));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [channelFilter, setChannelFilter] = useState('all');
    const [leadQuery, setLeadQuery] = useState('');
    const [busyTaskIds, setBusyTaskIds] = useState(new Set());

    useEffect(() => {
        setSelectedCampaignId(campaignId || '');
    }, [campaignId]);

    useEffect(() => {
        if (onNavigate && campaignId && selectedCampaignId && selectedCampaignId !== campaignId) {
            onNavigate(`/campaigns/${selectedCampaignId}/tasks`);
        }
    }, [campaignId, onNavigate, selectedCampaignId]);

    useEffect(() => {
        let isMounted = true;
        const loadCampaigns = async () => {
            try {
                const list = await api.getCampaigns();
                if (!isMounted) return;
                setCampaigns(list || []);
                if (!selectedCampaignId && list?.length) {
                    setSelectedCampaignId(list[0].id);
                }
            } catch (err) {
                console.error('Failed to load campaigns', err);
            }
        };
        loadCampaigns();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadTasks = async () => {
            if (!selectedCampaignId) return;
            setLoading(true);
            setError('');
            try {
                const list = await api.getTasks(selectedCampaignId, bucket);
                if (!isMounted) return;
                setTasks(list || []);
            } catch (err) {
                console.error('Failed to load tasks', err);
                if (isMounted) setError('Unable to load tasks.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadTasks();
        return () => { isMounted = false; };
    }, [bucket, selectedCampaignId]);

    const filteredTasks = useMemo(() => {
        const query = leadQuery.toLowerCase();
        return tasks.filter((task) => {
            if (channelFilter !== 'all' && task.channel !== channelFilter) return false;
            if (!query) return true;
            const leadName = task.lead?.name || '';
            const leadCompany = task.lead?.company || task.lead?.website || '';
            return leadName.toLowerCase().includes(query) || leadCompany.toLowerCase().includes(query);
        });
    }, [channelFilter, leadQuery, tasks]);

    const handleComplete = async (task) => {
        const snapshotIndex = tasks.findIndex((item) => item.id === task.id);
        const snapshotTask = tasks[snapshotIndex];
        setTasks((prev) => prev.filter((item) => item.id !== task.id));
        setBusyTaskIds((prev) => new Set(prev).add(task.id));
        try {
            await api.completeTask(task.id);
        } catch (err) {
            console.error('Failed to complete task', err);
            if (snapshotTask) {
                setTasks((prev) => {
                    const next = [...prev];
                    const insertAt = snapshotIndex < 0 ? 0 : Math.min(snapshotIndex, next.length);
                    next.splice(insertAt, 0, snapshotTask);
                    return next;
                });
            }
        } finally {
            setBusyTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const handleOutcome = async (task, outcome) => {
        if (!task.campaignLeadId) return;
        setBusyTaskIds((prev) => new Set(prev).add(task.id));
        try {
            await api.setOutcome(task.campaignLeadId, outcome);
        } catch (err) {
            console.error('Failed to set outcome', err);
            alert('Failed to set outcome.');
        } finally {
            setBusyTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const handleCopy = (task) => {
        const text = task.subject ? `Subject: ${task.subject}\n\n${task.body || ''}` : (task.body || '');
        navigator.clipboard.writeText(text || '');
    };

    return (
        <div className="task-inbox animate-fade-in">
            <div className="campaigns-header">
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Task Inbox</h2>
                    <p className="campaigns-subtitle">Work the highest priority touch tasks.</p>
                </div>
                {onNavigate && (
                    <button className="hud-btn" type="button" onClick={() => onNavigate('/campaigns')}>
                        Back to campaigns
                    </button>
                )}
            </div>

            <div className="task-inbox-controls">
                <div className="task-buckets">
                    {[
                        { value: 'today', label: 'Today' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'upcoming', label: 'Upcoming' }
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            className={`badge ${bucket === value ? 'active' : ''}`}
                            type="button"
                            onClick={() => setBucket(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="task-inbox-selectors">
                    <ObsidianDropdown
                        label="Campaign"
                        value={selectedCampaignId}
                        onChange={setSelectedCampaignId}
                        options={campaigns.map((campaign) => ({
                            label: campaign.name,
                            value: campaign.id
                        }))}
                        placeholder="Select campaign"
                    />
                </div>
            </div>

            <div className="task-filter-bar">
                <select
                    className="hud-input task-filter"
                    value={channelFilter}
                    onChange={(event) => setChannelFilter(event.target.value)}
                >
                    <option value="all">All channels</option>
                    <option value="email">Email</option>
                    <option value="dm_task">DM</option>
                    <option value="call_task">Phone</option>
                </select>
                <input
                    className="hud-input task-filter"
                    placeholder="Filter by lead..."
                    value={leadQuery}
                    onChange={(event) => setLeadQuery(event.target.value)}
                />
            </div>

            {error && <div className="campaigns-error">{error}</div>}

            {loading ? (
                <div className="campaigns-loading">Loading tasks...</div>
            ) : (
                <div className="task-list">
                    {filteredTasks.length === 0 && (
                        <div className="task-empty widget">No tasks in this bucket.</div>
                    )}
                    {filteredTasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onComplete={handleComplete}
                            onOutcome={handleOutcome}
                            onCopy={handleCopy}
                            disabled={busyTaskIds.has(task.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
