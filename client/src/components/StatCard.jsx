// Stat Card Component - Reusable dashboard stat widget

import React from 'react';

/**
 * @param {object} props
 * @param {React.ReactNode} props.icon - Icon component
 * @param {string} props.title - Stat title
 * @param {string|number} props.value - Stat value
 * @param {string} props.label - Stat label/description
 * @param {string} props.color - Icon color variable
 */
export function StatCard({ icon, title, value, label, color = 'var(--neon-primary)' }) {
    return (
        <div className="widget quarter-width">
            <div className="widget-header">
                <div className="widget-title">
                    {React.cloneElement(icon, { size: 16, color })}
                    {' '}{title}
                </div>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

export default StatCard;
