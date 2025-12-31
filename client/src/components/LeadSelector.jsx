import { useMemo, useState } from 'react';
import { Search, Check, Square, Layers } from 'lucide-react';

/**
 * @typedef {Object} Lead
 * @property {string} id
 * @property {string} name
 * @property {string} [company]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {string} [address]
 * @property {string[]} [tags]
 * @property {string} [jobId]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} Batch
 * @property {string} id
 * @property {string} name
 * @property {string} [date]
 * @property {number} [count]
 */

/**
 * @param {object} props
 * @param {Lead[]} props.leads
 * @param {Batch[]} [props.batches] - Batch options for grouping (from job history)
 * @param {string} [props.selectedBatchId] - Currently selected batch ID
 * @param {(batchId: string) => void} [props.onBatchChange] - Handler for batch selection
 * @param {Set<string>} props.selectedIds
 * @param {(next: Set<string>) => void} props.onChange
 * @param {boolean} [props.loading]
 * @param {string} [props.helperText]
 */
export default function LeadSelector({
    leads,
    batches = [],
    selectedBatchId = '',
    onBatchChange,
    selectedIds,
    onChange,
    loading = false,
    helperText
}) {
    const [query, setQuery] = useState('');

    // First filter by batch/job, then by search query
    const filteredLeads = useMemo(() => {
        let result = leads;

        // Filter by batch/jobId if selected
        if (selectedBatchId) {
            result = result.filter((lead) => lead.jobId === selectedBatchId);
        }

        // Then filter by search query
        if (query) {
            const lowered = query.toLowerCase();
            result = result.filter((lead) => (
                (lead.name || '').toLowerCase().includes(lowered)
                || (lead.company || '').toLowerCase().includes(lowered)
                || (lead.website || '').toLowerCase().includes(lowered)
                || (lead.email || '').toLowerCase().includes(lowered)
                || (lead.phone || '').toLowerCase().includes(lowered)
            ));
        }

        return result;
    }, [leads, selectedBatchId, query]);

    const toggleLead = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange(next);
    };

    const handleSelectAll = () => {
        const next = new Set(selectedIds);
        if (next.size === filteredLeads.length) {
            filteredLeads.forEach((lead) => next.delete(lead.id));
        } else {
            filteredLeads.forEach((lead) => next.add(lead.id));
        }
        onChange(next);
    };

    return (
        <div className="lead-selector">
            <div className="lead-selector-header">
                {/* Batch Filter Dropdown */}
                {batches.length > 0 && onBatchChange && (
                    <div className="lead-selector-batch">
                        <Layers size={16} />
                        <select
                            className="lead-selector-batch-select"
                            value={selectedBatchId}
                            onChange={(e) => onBatchChange(e.target.value)}
                        >
                            <option value="">All Batches ({leads.length})</option>
                            {batches.map((batch) => (
                                <option key={batch.id} value={batch.id}>
                                    {batch.name} ({batch.count})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="lead-selector-search">
                    <Search size={16} />
                    <input
                        className="lead-selector-input"
                        value={query}
                        placeholder="Search leads..."
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <button className="hud-btn" type="button" onClick={handleSelectAll} disabled={loading || filteredLeads.length === 0}>
                    {filteredLeads.length > 0 && selectedIds.size === filteredLeads.length ? 'Clear Visible' : 'Select Visible'}
                </button>
            </div>
            {helperText && <div className="lead-selector-helper">{helperText}</div>}
            <div className="lead-selector-list">
                {loading && <div className="lead-selector-empty">Loading leads...</div>}
                {!loading && filteredLeads.length === 0 && <div className="lead-selector-empty">No leads found.</div>}
                {!loading && filteredLeads.map((lead) => {
                    const selected = selectedIds.has(lead.id);
                    return (
                        <button
                            key={lead.id}
                            type="button"
                            className={`lead-selector-item ${selected ? 'selected' : ''}`}
                            onClick={() => toggleLead(lead.id)}
                        >
                            <span className="lead-selector-icon">
                                {selected ? <Check size={16} /> : <Square size={16} />}
                            </span>
                            <span className="lead-selector-content">
                                <span className="lead-selector-name">{lead.name || 'Unnamed Lead'}</span>
                                <span className="lead-selector-meta">
                                    {[lead.company, lead.website, lead.phone].filter(Boolean).join(' - ')}
                                </span>
                            </span>
                            {lead.tags && lead.tags.length > 0 && (
                                <span className="lead-selector-tags">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                        <span key={tag} className="lead-selector-tag">{tag}</span>
                                    ))}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
