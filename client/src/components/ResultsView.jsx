/**
 * ResultsView - Display analysis results with expandable CRO reports
 * 
 * Shows intelligence reports with screenshots, issues, quick wins, and confidence scores.
 */

import { Zap, ExternalLink } from 'lucide-react'
import { api } from '../lib/api'

function ResultsView({ results, expandedCro, onToggleExpand }) {
    if (!results || results.length === 0) return null

    return (
        <div className="widget full-width">
            <div className="widget-header">
                <div className="widget-title">INTELLIGENCE REPORT</div>
                <span className="badge active">{results.length} RESULTS</span>
            </div>
            <div className="dossier-grid">
                {results.map((res, i) => (
                    <div
                        key={i}
                        className={`obsidian-row ${expandedCro[i] ? 'expanded' : ''}`}
                        onClick={() => onToggleExpand(i)}
                    >
                        {/* Header Section (Always Visible) */}
                        <div className="row-thumbnail">
                            <img src={res.screenshot} alt="Site Preview" />
                        </div>
                        <div className="row-content">
                            <div className="row-title">
                                {res.name || (res.url ? new URL(res.url).hostname : 'Unknown Target')}
                            </div>
                            <div className="row-preview">
                                <span style={{
                                    fontWeight: 600,
                                    color: '#fff',
                                    display: expandedCro[i] ? 'block' : 'inline',
                                    marginBottom: expandedCro[i] ? '0.5rem' : 0
                                }}>
                                    {expandedCro[i] ? 'EXECUTIVE SUMMARY' : ''}
                                </span>
                                {res.report?.summary || "No analysis available."}
                            </div>
                        </div>
                        <div className="row-actions">
                            <span
                                className="badge obsidian-tooltip"
                                style={{
                                    background: res.report?.confidence > 80 ? 'rgba(0,255,157,0.1)' : 'rgba(255,215,0,0.1)',
                                    color: res.report?.confidence > 80 ? 'var(--accent-success)' : 'var(--accent-gold)',
                                    border: `1px solid ${res.report?.confidence > 80 ? 'var(--accent-success)' : 'var(--accent-gold)'}`
                                }}
                            >
                                CONFIDENCE: {res.report?.confidence || 'N/A'}%
                            </span>
                            <a
                                href={res.url}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    color: 'var(--neon-cyan)',
                                    opacity: 0.8,
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    fontSize: '0.8rem',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                VISIT SITE <ExternalLink size={14} />
                            </a>
                        </div>

                        {/* Expanded Content: Quick Wins & Issues */}
                        {expandedCro[i] && (
                            <div className="row-details" onClick={e => e.stopPropagation()}>
                                {/* Quick Wins */}
                                {res.report?.quick_wins?.length > 0 && (
                                    <div className="quick-wins-container">
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-muted)',
                                            letterSpacing: '0.1em'
                                        }}>
                                            OPPORTUNITIES:
                                        </span>
                                        {res.report.quick_wins.map((win, idx) => (
                                            <span key={idx} className="quick-win-tag">
                                                <Zap size={12} fill="currentColor" /> {win}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Issues List */}
                                {res.report?.issues?.length > 0 && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.75rem',
                                            color: 'var(--neon-alert)',
                                            letterSpacing: '0.1em',
                                            display: 'block',
                                            marginBottom: '0.5rem'
                                        }}>
                                            CRITICAL ISSUES DETECTED:
                                        </span>
                                        <ul style={{
                                            margin: '0 0 0 1.25rem',
                                            padding: 0,
                                            color: 'var(--lux-secondary)',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.6'
                                        }}>
                                            {res.report.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ResultsView
