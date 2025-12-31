import { Copy, CheckCircle2, Mail, MessageSquare, Phone } from 'lucide-react';

const CHANNEL_META = {
    email: { label: 'Email', icon: Mail },
    dm_task: { label: 'DM', icon: MessageSquare },
    call_task: { label: 'Phone', icon: Phone }
};

const formatPreview = (subject, body) => {
    if (!subject && !body) return 'No preview available.';
    const combined = subject ? `${subject} - ${body || ''}` : body;
    return combined.length > 180 ? `${combined.slice(0, 180)}...` : combined;
};

/**
 * @typedef {Object} Task
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
 * @param {Task} props.task
 * @param {(task: Task) => void} props.onComplete
 * @param {(task: Task, outcome: string) => void} props.onOutcome
 * @param {(task: Task) => void} props.onCopy
 * @param {boolean} [props.disabled]
 */
export default function TaskCard({ task, onComplete, onOutcome, onCopy, disabled = false }) {
    const meta = CHANNEL_META[task.channel] || { label: task.channel, icon: Mail };
    const Icon = meta.icon;
    const leadName = task.lead?.name || 'Unknown Lead';
    const leadCompany = task.lead?.company || task.lead?.website || task.lead?.email || '';

    return (
        <div className="task-card">
            <div className="task-card-header">
                <div className="task-card-lead">
                    <div className="task-card-name">{leadName}</div>
                    {leadCompany && <div className="task-card-meta">{leadCompany}</div>}
                </div>
                <span className="badge task-channel">
                    <Icon size={12} />
                    {meta.label}
                </span>
            </div>
            <div className="task-card-preview">
                {formatPreview(task.subject, task.body)}
            </div>
            <div className="task-card-actions">
                <button className="hud-btn" type="button" onClick={() => onCopy(task)} disabled={disabled}>
                    <Copy size={14} /> Copy
                </button>
                <select
                    className="task-outcome-select"
                    disabled={disabled || !task.campaignLeadId}
                    onChange={(event) => {
                        if (event.target.value) {
                            onOutcome(task, event.target.value);
                            event.target.value = '';
                        }
                    }}
                >
                    <option value="">Set outcome</option>
                    <option value="replied">Replied</option>
                    <option value="booked">Booked</option>
                    <option value="not_interested">Not interested</option>
                    <option value="none">No response</option>
                </select>
                <button className="hud-btn primary" type="button" onClick={() => onComplete(task)} disabled={disabled}>
                    <CheckCircle2 size={14} /> Mark Done
                </button>
            </div>
        </div>
    );
}
