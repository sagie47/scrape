// Job History Item Component

import React from 'react';
import { FileSpreadsheet, Trash2 } from 'lucide-react';

/**
 * @param {object} props
 * @param {object} props.job - Job data
 * @param {function} props.onClick - Click handler
 * @param {function} props.onDelete - Delete handler
 */
export function JobHistoryItem({ job, onClick, onDelete }) {
    return (
        <div
            onClick={onClick}
            className="list-item"
            style={{ cursor: 'pointer' }}
        >
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <FileSpreadsheet size={16} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {job.type || 'Batch Scan'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(job.createdAt).toLocaleString()}
                </div>
            </div>
            <span className={`badge ${job.status === 'done' ? 'active' : 'neutral'}`} style={{ fontSize: '0.7rem' }}>
                {job.status}
            </span>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
                className="hud-btn"
                style={{
                    padding: '0.4rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--neon-alert)',
                    opacity: 0.6
                }}
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
}

export default JobHistoryItem;
