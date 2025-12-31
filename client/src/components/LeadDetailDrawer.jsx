import { ExternalLink, X } from 'lucide-react';

/**
 * @typedef {Object} ActivityItem
 * @property {string} id
 * @property {string} label
 * @property {string} timestamp
 */

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.lead
 * @param {string} [props.analysisSummary]
 * @param {string} [props.auditUrl]
 * @param {ActivityItem[]} [props.activity]
 * @param {(outcome: string) => void} props.onOutcome
 * @param {() => void} props.onSkipRemaining
 * @param {() => void} props.onClose
 */
export default function LeadDetailDrawer({
    open,
    lead,
    analysisSummary,
    auditUrl,
    activity = [],
    onOutcome,
    onSkipRemaining,
    onClose
}) {
    if (!open || !lead) return null;

    return (
        <div className="drawer-backdrop" onClick={onClose}>
            <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                    <div>
                        <div className="drawer-title">{lead.name || 'Lead Detail'}</div>
                        <div className="drawer-subtitle">{lead.company || lead.website || lead.email || ''}</div>
                    </div>
                    <button className="icon-toggle" onClick={onClose} aria-label="Close drawer">
                        <X size={16} />
                    </button>
                </div>

                <div className="drawer-section">
                    <div className="drawer-section-title">Lead Info</div>
                    <div className="drawer-info-grid">
                        <div>
                            <div className="stat-label">Email</div>
                            <div className="drawer-info-value">{lead.email || '--'}</div>
                        </div>
                        <div>
                            <div className="stat-label">Phone</div>
                            <div className="drawer-info-value">{lead.phone || '--'}</div>
                        </div>
                        <div>
                            <div className="stat-label">Website</div>
                            <div className="drawer-info-value">{lead.website || '--'}</div>
                        </div>
                        <div>
                            <div className="stat-label">Location</div>
                            <div className="drawer-info-value">{lead.address || '--'}</div>
                        </div>
                    </div>
                </div>

                <div className="drawer-section">
                    <div className="drawer-section-title">Analysis Summary</div>
                    <div className="drawer-summary">
                        {analysisSummary || 'No analysis summary available yet.'}
                    </div>
                    {auditUrl && (
                        <a className="drawer-link" href={auditUrl} target="_blank" rel="noreferrer">
                            View Mini Audit <ExternalLink size={14} />
                        </a>
                    )}
                </div>

                <div className="drawer-section">
                    <div className="drawer-section-title">Activity Timeline</div>
                    {activity.length === 0 ? (
                        <div className="drawer-empty">No activity yet.</div>
                    ) : (
                        <div className="drawer-activity">
                            {activity.map((item) => (
                                <div key={item.id} className="drawer-activity-item">
                                    <span>{item.label}</span>
                                    <span className="drawer-activity-time">{item.timestamp}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="drawer-section">
                    <div className="drawer-section-title">Quick Actions</div>
                    <div className="drawer-actions">
                        <select
                            className="task-outcome-select"
                            onChange={(event) => {
                                if (event.target.value) {
                                    onOutcome(event.target.value);
                                    event.target.value = '';
                                }
                            }}
                        >
                            <option value="">Set outcome</option>
                            <option value="replied">Replied</option>
                            <option value="booked">Booked</option>
                            <option value="not_interested">Not interested</option>
                            <option value="no_response">No response</option>
                            <option value="skipped">Skipped</option>
                        </select>
                        <button className="hud-btn" type="button" onClick={onSkipRemaining}>
                            Skip Remaining
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
