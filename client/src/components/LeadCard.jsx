// Lead Card Component - Displays a single lead in the scraper view

import React from 'react';

/**
 * @param {object} props
 * @param {object} props.lead - Lead data
 * @param {number} props.index - Lead index
 */
export function LeadCard({ lead, index }) {
    return (
        <div className="list-item">
            <div style={{ width: '30px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                {index + 1}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#fff' }}>{lead.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)' }}>{lead.website}</div>
                {lead.address && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        📍 {lead.address}
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', fontSize: '0.85rem' }}>
                {lead.phone && <span>📞 {lead.phone}</span>}
                {lead.email && <span>✉️ {lead.email}</span>}
                {lead.rating && (
                    <span className="badge neutral">
                        ⭐ {lead.rating} ({lead.reviews})
                    </span>
                )}
            </div>
        </div>
    );
}

export default LeadCard;
