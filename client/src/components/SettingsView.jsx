/**
 * SettingsView - User preferences and configuration
 * 
 * Settings for capture mode, export defaults, and account management.
 * Uses Obsidian Glass design system for consistency.
 */

import { useState, useEffect } from 'react'
import {
    Settings,
    Zap,
    FileSpreadsheet,
    User,
    Key,
    Save,
    Check,
    Camera,
    Clock,
    Download
} from 'lucide-react'
import ObsidianDropdown from '../ObsidianDropdown'

const STORAGE_KEY = 'scraper_settings'

const defaultSettings = {
    captureMode: 'standard',
    defaultExportFormat: 'xlsx',
    includeTimestamps: true,
    concurrencyLimit: 4
}

function SettingsView({ user, captureMode, onCaptureModeChange }) {
    const [settings, setSettings] = useState(defaultSettings)
    const [saved, setSaved] = useState(false)

    // Load settings from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                setSettings({ ...defaultSettings, ...parsed })
            }
        } catch (err) {
            console.error('Failed to load settings:', err)
        }
    }, [])

    // Sync captureMode from parent
    useEffect(() => {
        if (captureMode && captureMode !== settings.captureMode) {
            setSettings(s => ({ ...s, captureMode }))
        }
    }, [captureMode])

    const updateSetting = (key, value) => {
        setSettings(prev => {
            const updated = { ...prev, [key]: value }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

            // Sync capture mode to parent if changed
            if (key === 'captureMode' && onCaptureModeChange) {
                onCaptureModeChange(value)
            }

            return updated
        })

        // Show saved indicator
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="dashboard-grid animate-fade-in">
            {/* Header */}
            <div className="full-width" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Settings size={28} strokeWidth={1.5} style={{ color: 'var(--lux-tertiary)' }} />
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.25rem' }}>Settings</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configure your scanning preferences</p>
                    </div>
                    {saved && (
                        <div className="badge active" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Check size={12} /> Saved
                        </div>
                    )}
                </div>
            </div>

            {/* Capture Settings */}
            <div className="widget" style={{ gridColumn: 'span 6' }}>
                <div className="widget-header">
                    <div className="widget-title">
                        <Camera size={16} /> CAPTURE_SETTINGS
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            DEFAULT CAPTURE MODE
                        </label>
                        <ObsidianDropdown
                            value={settings.captureMode}
                            onChange={(val) => updateSetting('captureMode', val)}
                            options={[
                                { label: 'FULL CAPTURE', value: 'standard', subtext: 'Full page scroll + analysis' },
                                { label: 'FAST SCAN', value: 'fast', subtext: 'Viewport only for speed' }
                            ]}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Full capture scrolls pages to reveal lazy-loaded content. Fast scan captures viewport only.
                        </p>
                    </div>

                    <div>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            CONCURRENCY LIMIT
                        </label>
                        <ObsidianDropdown
                            value={settings.concurrencyLimit}
                            onChange={(val) => updateSetting('concurrencyLimit', Number(val))}
                            options={[
                                { label: '2 PARALLEL', value: 2, subtext: 'Conservative' },
                                { label: '4 PARALLEL', value: 4, subtext: 'Balanced' },
                                { label: '8 PARALLEL', value: 8, subtext: 'Aggressive' }
                            ]}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Number of pages to process simultaneously. Higher values are faster but use more resources.
                        </p>
                    </div>
                </div>
            </div>

            {/* Export Settings */}
            <div className="widget" style={{ gridColumn: 'span 6' }}>
                <div className="widget-header">
                    <div className="widget-title">
                        <Download size={16} /> EXPORT_DEFAULTS
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            DEFAULT FORMAT
                        </label>
                        <ObsidianDropdown
                            value={settings.defaultExportFormat}
                            onChange={(val) => updateSetting('defaultExportFormat', val)}
                            options={[
                                { label: 'XLSX', value: 'xlsx', subtext: 'Excel workbook' },
                                { label: 'CSV', value: 'csv', subtext: 'Comma-separated' }
                            ]}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            padding: '1rem',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.includeTimestamps}
                                onChange={(e) => updateSetting('includeTimestamps', e.target.checked)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: 'var(--accent-cyan)'
                                }}
                            />
                            <div>
                                <div style={{ fontWeight: 500 }}>Include Timestamps</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Add date/time columns to exports
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Account Info */}
            <div className="widget" style={{ gridColumn: 'span 6' }}>
                <div className="widget-header">
                    <div className="widget-title">
                        <User size={16} /> ACCOUNT
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="list-item" style={{ marginBottom: 0 }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #9333ea 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 600
                        }}>
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{user?.email || 'Not signed in'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {user?.user_metadata?.full_name || 'User'}
                            </div>
                        </div>
                        <span className="badge active">ACTIVE</span>
                    </div>
                </div>
            </div>

            {/* API Keys Status */}
            <div className="widget" style={{ gridColumn: 'span 6' }}>
                <div className="widget-header">
                    <div className="widget-title">
                        <Key size={16} /> API_SERVICES
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="list-item" style={{ marginBottom: 0 }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--accent-success)',
                            boxShadow: '0 0 8px var(--accent-success)'
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Gemini AI</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Screenshot analysis</div>
                        </div>
                        <span className="badge active">Connected</span>
                    </div>

                    <div className="list-item" style={{ marginBottom: 0 }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--accent-success)',
                            boxShadow: '0 0 8px var(--accent-success)'
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Serper</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lead scraping</div>
                        </div>
                        <span className="badge active">Connected</span>
                    </div>

                    <div className="list-item" style={{ marginBottom: 0 }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--lux-tertiary)'
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>PageSpeed Insights</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Performance metrics</div>
                        </div>
                        <span className="badge neutral">Not configured</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsView
