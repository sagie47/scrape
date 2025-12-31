import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload,
  User,
  Zap,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  History,
  PlusCircle,
  BarChart3,
  ExternalLink,
  Search,
  CreditCard,
  Settings,
  Target,
  MoreHorizontal,
  FileSpreadsheet,
  Trash2,
  MessageSquare,
  Phone,
  Mail,
  Copy,
  Check,
  LogOut
} from 'lucide-react'
import LandingPage from './LandingPage'
import ObsidianDropdown from './ObsidianDropdown'
import ScraperFeedback from './ScraperFeedback'
import SettingsView from './components/SettingsView'
import { useAuth } from './contexts/AuthContext'
import { api } from './lib/api'
import CampaignsList from './pages/CampaignsList'
import CampaignBuilder from './pages/CampaignBuilder'
import CampaignDashboard from './pages/CampaignDashboard'
import TaskInbox from './pages/TaskInbox'

const parseRoute = (pathname) => {
  if (pathname === '/campaigns') return { view: 'campaigns', params: {} }
  if (pathname === '/campaigns/new') return { view: 'campaign-builder', params: {} }
  const tasksMatch = pathname.match(/^\/campaigns\/([^/]+)\/tasks$/)
  if (tasksMatch) return { view: 'task-inbox', params: { campaignId: tasksMatch[1] } }
  const campaignMatch = pathname.match(/^\/campaigns\/([^/]+)$/)
  if (campaignMatch) return { view: 'campaign-dashboard', params: { campaignId: campaignMatch[1] } }
  if (pathname === '/inbox') return { view: 'task-inbox', params: {} }
  return null
}

function App() {
  // --- Auth State ---
  const { user, loading: authLoading, signOut } = useAuth()

  // --- Global State ---
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname))
  const [currentView, setCurrentView] = useState(() => route?.view || 'landing')
  const [loading, setLoading] = useState(false)

  // --- Analyze/Upload State ---
  const [file, setFile] = useState(null)
  const [sheet, setSheet] = useState('')
  const [column, setColumn] = useState('')
  const [analysisType, setAnalysisType] = useState('batch')
  const [singleUrl, setSingleUrl] = useState('')

  // --- Scraper State ---
  const [scrapeSector, setScrapeSector] = useState('Chiropractors')
  const [scrapeKeyword, setScrapeKeyword] = useState('')
  const [scrapeLocation, setScrapeLocation] = useState('')
  const [leads, setLeads] = useState([])

  // --- Outreach State ---
  const [outreachScripts, setOutreachScripts] = useState({})
  const [generatingScript, setGeneratingScript] = useState(null)
  const [selectedOutreach, setSelectedOutreach] = useState(new Set())

  // --- Job & Data State ---
  const [jobId, setJobId] = useState(null)
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [jobHistory, setJobHistory] = useState([])
  const [expandedResults, setExpandedResults] = useState({})
  const [scrapeLimit, setScrapeLimit] = useState(10)
  const [leadsLimit, setLeadsLimit] = useState(10)
  const [campaignsCollapsed, setCampaignsCollapsed] = useState(false)
  const [expandedCro, setExpandedCro] = useState({})
  const [activeScriptTab, setActiveScriptTab] = useState({}) // { [idx]: 'email' | 'sms' | 'phone' }
  const [captureMode, setCaptureMode] = useState('standard')
  const [resultsLayout, setResultsLayout] = useState('grid')

  // --- Refs ---
  const pollInterval = useRef(null)

  const isCampaignView = ['campaigns', 'campaign-builder', 'campaign-dashboard'].includes(currentView)
  const isTaskView = currentView === 'task-inbox'

  const setView = (nextView) => {
    setCurrentView(nextView)
    if (route) {
      window.history.pushState({}, '', '/')
      setRoute(null)
    }
  }

  const navigate = (path) => {
    const nextRoute = parseRoute(path)
    if (!nextRoute) return
    window.history.pushState({}, '', path)
    setRoute(nextRoute)
    setCurrentView(nextRoute.view)
  }

  const sectors = [
    'Chiropractors', 'Plumbers', 'Roofing Contractors', 'Dentists',
    'HVAC Services', 'Solar Installers', 'Custom Query'
  ]
  const captureModeOptions = [
    { label: 'FULL CAPTURE', value: 'standard', subtext: 'Full page scroll + analysis' },
    { label: 'FAST SCAN', value: 'fast', subtext: 'Viewport capture for speed' }
  ]

  // --- Actions ---
  const fetchHistory = async () => {
    try {
      const data = await api.get('/jobs')
      setJobHistory(data)
    } catch (err) {
      console.error('Failed to fetch history', err)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setStatus({ status: 'uploading' })

    const formData = new FormData()
    formData.append('excel', file)
    formData.append('sheet', sheet)
    formData.append('column', column)
    formData.append('limit', scrapeLimit)
    formData.append('captureMode', captureMode)

    try {
      const data = await api.upload('/upload', formData)
      if (data.jobId) {
        setJobId(data.jobId)
        startPolling(data.jobId)
      }
    } catch (err) {
      console.error('Upload failed', err)
      setStatus({ status: 'error', message: 'Upload failed' })
      setLoading(false)
    }
  }

  const handleSingleAnalyze = async (e) => {
    e.preventDefault()
    if (!singleUrl) return

    setLoading(true)
    setStatus({ status: 'initializing' })

    try {
      const data = await api.post('/analyze-single', { url: singleUrl, captureMode })
      if (data.jobId) {
        setJobId(data.jobId)
        startPolling(data.jobId)
      }
    } catch (err) {
      console.error('Single analysis failed', err)
      setStatus({ status: 'error', message: 'Analysis failed' })
      setLoading(false)
    }
  }

  const handleScrapeSubmit = async (e) => {
    e.preventDefault()
    const keyword = scrapeSector === 'Custom Query' ? scrapeKeyword : scrapeSector
    if (!keyword) return
    setLoading(true)
    setLeads([])

    try {
      const location = scrapeLocation || "United States"
      const response = await api.post('/scrape-leads', { keyword, location, limit: leadsLimit })
      // Response now includes { jobId, leads }
      setLeads(response.leads || response)
      // Refresh job history to include the new leads batch
      fetchHistory()
    } catch (err) {
      console.error('Scrape failed', err)
      alert('Scraping Error: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const exportData = (format) => {
    try {
      if (leads.length === 0) return alert('No data to export')

      const cleanData = leads.map(l => ({
        Name: l.title || 'N/A',
        Company: l.company || 'N/A',
        Phone: l.phone || 'N/A',
        Email: l.email || 'N/A',
        Website: l.url || 'N/A',
        Address: l.address || 'N/A',
        City: l.city || 'N/A',
        State: l.state || 'N/A'
      }))

      const ws = XLSX.utils.json_to_sheet(cleanData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Leads")

      if (format === 'csv') {
        XLSX.writeFile(wb, `leads_export_${Date.now()}.csv`)
      } else {
        XLSX.writeFile(wb, `leads_export_${Date.now()}.xlsx`)
      }
    } catch (err) {
      console.error(err)
      alert('Export failed')
    }
  }

  const handleAnalyzeLeads = async () => {
    if (leads.length === 0) return
    const leadsWithWebsites = leads.filter(l => l.website)
    if (leadsWithWebsites.length === 0) return alert('No valid websites found')
    setLoading(true)
    try {
      const data = await api.post('/analyze-leads', {
        leads: leadsWithWebsites,
        keyword: scrapeSector === 'Custom Query' ? scrapeKeyword : scrapeSector,
        location: scrapeLocation || 'United States',
        captureMode
      })
      if (data.jobId) {
        setJobId(data.jobId)
        setView('analyze')
        startPolling(data.jobId)
      }
    } catch (err) { alert('Error starting analysis') }
    finally { setLoading(false) }
  }

  const startPolling = (id) => {
    if (pollInterval.current) clearInterval(pollInterval.current)
    let pollDelay = 2000
    const startTime = Date.now()

    const poll = async () => {
      try {
        const data = await api.get(`/status/${id}`)
        setStatus(data)
        if (data.total > 0) {
          setProgress(Math.round((data.processed / data.total) * 100))
        }
        if (['done', 'error', 'stopped'].includes(data.status)) {
          clearTimeout(pollInterval.current)
          setLoading(false)
          fetchHistory()
          return
        }
        const elapsed = Date.now() - startTime
        if (elapsed > 60000) pollDelay = 10000
        else if (elapsed > 30000) pollDelay = 5000
        pollInterval.current = setTimeout(poll, pollDelay)
      } catch (err) {
        console.error('Polling error', err)
        pollInterval.current = setTimeout(poll, pollDelay)
      }
    }
    poll()
  }

  const loadJob = (id, switchView = true) => {
    setJobId(id)
    setStatus(null)
    if (switchView) setView('analyze')
    startPolling(id)
  }

  const handleDeleteJob = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Permanently delete this mission record?')) return
    try {
      await api.delete(`/jobs/${id}`)
      setJobHistory(prev => prev.filter(j => j.id !== id))
      if (jobId === id) setJobId(null)
    } catch (err) { alert('Failed to delete job') }
  }

  const toggleOutreachSelection = (id) => {
    setSelectedOutreach(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const toggleSelectAll = (items) => {
    if (selectedOutreach.size === items.length) {
      setSelectedOutreach(new Set())
    } else {
      setSelectedOutreach(new Set(items.map(i => i.id)))
    }
  }

  const handleGenerateOutreach = async (item) => {
    setGeneratingScript(item.id)
    try {
      const data = await api.post('/generate-outreach', {
        name: item.name || new URL(item.url).hostname,
        url: item.url,
        report: item.report || {}
      })
      setOutreachScripts(prev => ({ ...prev, [item.id]: data }))
    } catch (err) {
      console.error('Script generation failed', err)
    } finally {
      setGeneratingScript(null)
    }
  }

  const handleBatchGenerate = async () => {
    const allItems = [...jobHistory, ...leads.map(l => ({ ...l, id: l.url }))]
    for (const item of allItems) {
      if (selectedOutreach.has(item.id) && !outreachScripts[item.id]) {
        await handleGenerateOutreach(item)
      }
    }
  }

  useEffect(() => {
    fetchHistory()
    const handlePopState = () => {
      const nextRoute = parseRoute(window.location.pathname)
      setRoute(nextRoute)
      if (nextRoute?.view) setCurrentView(nextRoute.view)
      else setCurrentView((prev) => (prev === 'landing' ? 'landing' : 'analyze'))
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      clearInterval(pollInterval.current)
    }
  }, [])

  return (
    <div className="app-container">
      {currentView === 'landing' && <LandingPage onLogin={() => setView('analyze')} />}

      {/* Sidebar */}
      <aside className="control-deck">
        <div className="deck-header" onClick={() => setView('analyze')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
          <Zap size={32} strokeWidth={3} style={{ color: 'var(--accent-cyan)', filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.5))' }} />
        </div>

        <nav className="deck-nav">
          <button className={`deck-nav-item ${currentView === 'analyze' ? 'active' : ''}`} onClick={() => setView('analyze')} title="Dashboard">
            <LayoutGrid size={24} />
          </button>
          <button className={`deck-nav-item ${isCampaignView ? 'active' : ''}`} onClick={() => navigate('/campaigns')} title="Campaigns">
            <Target size={24} />
          </button>
          <button className={`deck-nav-item ${isTaskView ? 'active' : ''}`} onClick={() => navigate('/inbox')} title="Task Inbox">
            <List size={24} />
          </button>
          <button className={`deck-nav-item ${currentView === 'scraper' ? 'active' : ''}`} onClick={() => setView('scraper')} title="Lead Scraper">
            <Globe size={24} />
          </button>
          <button className={`deck-nav-item ${currentView === 'outreach' ? 'active' : ''}`} onClick={() => setView('outreach')} title="Outreach">
            <MessageSquare size={24} />
          </button>
          <button className={`deck-nav-item ${currentView === 'history' ? 'active' : ''}`} onClick={() => { setJobId(null); setView('history'); fetchHistory(); }} title="Archives">
            <History size={24} />
          </button>
          <button className={`deck-nav-item ${currentView === 'pricing' ? 'active' : ''}`} onClick={() => setView('pricing')} title="Upgrade">
            <CreditCard size={24} />
          </button>
        </nav>

        <div style={{ marginTop: 'auto', paddingBottom: '1.5rem' }}>
          <button className={`deck-nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')} title="Settings">
            <Settings size={24} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="viewscreen">
        <header className="view-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {currentView === 'analyze' ? 'Command Center' :
                  currentView === 'campaigns' ? 'Campaigns' :
                    currentView === 'campaign-builder' ? 'Campaign Builder' :
                      currentView === 'campaign-dashboard' ? 'Campaign Dashboard' :
                        currentView === 'task-inbox' ? 'Task Inbox' :
                          currentView === 'scraper' ? 'Lead Intelligence' :
                            currentView === 'history' ? 'Mission Archives' :
                              currentView === 'outreach' ? 'Outreach Operations' :
                                currentView === 'settings' ? 'System Configuration' : 'Plan Selection'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {jobId && (
              <div className="animate-fade-in">
                <div className="job-pulse">
                  <Zap size={14} fill="currentColor" /> SYSTEM ACTIVE
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user ? (
              <>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {user.email}
                </span>
                <button
                  onClick={async () => {
                    await signOut();
                    setView('landing');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setView('landing')}
                className="hud-btn primary"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem'
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="view-content">
          {currentView === 'campaigns' && (
            <CampaignsList onNavigate={navigate} />
          )}
          {currentView === 'campaign-builder' && (
            <CampaignBuilder onNavigate={navigate} />
          )}
          {currentView === 'campaign-dashboard' && (
            <CampaignDashboard campaignId={route?.params?.campaignId} onNavigate={navigate} />
          )}
          {currentView === 'task-inbox' && (
            <TaskInbox campaignId={route?.params?.campaignId} onNavigate={navigate} />
          )}

          {/* DASHBOARD VIEW */}
          {currentView === 'analyze' && (
            <div className="dashboard-grid animate-fade-in">
              {!jobId && (
                <>
                  <div className="widget quarter-width">
                    <div className="widget-header">
                      <div className="widget-title"><Zap size={16} color="var(--neon-primary)" /> ACTIVE_JOBS</div>
                    </div>
                    <div className="stat-value">{jobId ? 1 : 0}</div>
                    <div className="stat-label">Running Process</div>
                  </div>

                  <div className="widget quarter-width">
                    <div className="widget-header">
                      <div className="widget-title"><CheckCircle2 size={16} color="var(--neon-cyan)" /> COMPLETED</div>
                    </div>
                    <div className="stat-value">{jobHistory.filter(j => j.status === 'done').length}</div>
                    <div className="stat-label">Successful Missions</div>
                  </div>

                  <div className="widget quarter-width">
                    <div className="widget-header">
                      <div className="widget-title"><Globe size={16} color="var(--neon-violet)" /> SITES_SCANNED</div>
                    </div>
                    <div className="stat-value">{status?.total || 0}</div>
                    <div className="stat-label">Total URLs Processed</div>
                  </div>

                  <div className="widget quarter-width">
                    <div className="widget-header">
                      <div className="widget-title"><AlertCircle size={16} color="var(--neon-alert)" /> ISSUES</div>
                    </div>
                    <div className="stat-value">{jobHistory.filter(j => j.status === 'error').length}</div>
                    <div className="stat-label">Failed Connections</div>
                  </div>
                </>
              )}

              {!jobId && (
                <>
                  <div className="widget half-width" style={{ gridColumn: 'span 8' }}>
                    <div className="widget-header">
                      <div className="widget-title">MISSION PARAMETERS</div>
                      <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                        <button onClick={() => setAnalysisType('batch')} className={`badge ${analysisType === 'batch' ? 'active' : 'neutral'}`} style={{ border: 'none', cursor: 'pointer' }}>BATCH</button>
                        <button onClick={() => setAnalysisType('single')} className={`badge ${analysisType === 'single' ? 'active' : 'neutral'}`} style={{ border: 'none', cursor: 'pointer' }}>SINGLE</button>
                      </div>
                    </div>

                    <div className="control-form-container">
                      {!jobId ? (
                        analysisType === 'batch' ? (
                          <form onSubmit={handleUpload}>
                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                              <div style={{ flex: 1 }}>
                                <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>TARGET DATASET (.xlsx)</label>
                                <div className="upload-zone" onClick={() => document.getElementById('file-upload').click()}>
                                  <input type="file" id="file-upload" hidden onChange={e => setFile(e.target.files[0])} accept=".xlsx" />
                                  <Upload size={32} color={file ? 'var(--neon-primary)' : 'var(--text-muted)'} style={{ marginBottom: '1rem' }} />
                                  <div style={{ color: file ? '#fff' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    {file ? file.name : 'Click or Drag to Upload'}
                                  </div>
                                </div>
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>SHEET NODE</label>
                                  <input className="hud-input" placeholder="e.g. Leads" value={sheet} onChange={e => setSheet(e.target.value)} />
                                </div>
                                <div>
                                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>URL VECTOR</label>
                                  <input className="hud-input" placeholder="e.g. Website" value={column} onChange={e => setColumn(e.target.value)} />
                                </div>
                                <div>
                                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>AGENTS LIMIT</label>
                                  <div style={{ width: '100%' }}>
                                    <ObsidianDropdown
                                      value={scrapeLimit}
                                      onChange={val => setScrapeLimit(Number(val))}
                                      options={[
                                        { label: '10 AGENTS', value: 10 },
                                        { label: '20 AGENTS', value: 20 },
                                        { label: '50 AGENTS', value: 50 },
                                        { label: '100 AGENTS', value: 100 }
                                      ]}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>SCAN MODE</label>
                                  <div style={{ width: '100%' }}>
                                    <ObsidianDropdown
                                      value={captureMode}
                                      onChange={setCaptureMode}
                                      options={captureModeOptions}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <button type="submit" disabled={!file || loading} className="hud-btn primary" style={{ width: '100%' }}>
                              {loading ? <Loader2 className="spin" /> : 'INITIATE BATCH SEQUENCE'}
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={handleSingleAnalyze}>
                            <div style={{ marginBottom: '2rem' }}>
                              <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>TARGET COORDINATE</label>
                              <input className="hud-input" placeholder="https://example.com" style={{ fontSize: '1.2rem', padding: '1.2rem' }} value={singleUrl} onChange={e => setSingleUrl(e.target.value)} />
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                              <label className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>SCAN MODE</label>
                              <ObsidianDropdown
                                value={captureMode}
                                onChange={setCaptureMode}
                                options={captureModeOptions}
                              />
                            </div>
                            <button type="submit" disabled={!singleUrl || loading} className="hud-btn primary" style={{ width: '100%' }}>
                              {loading ? <Loader2 className="spin" /> : 'DEPLOY SINGLE AGENT'}
                            </button>
                          </form>
                        )
                      ) : (
                        <ScraperFeedback
                          status={status}
                          progress={progress}
                          onAbort={() => setJobId(null)}
                        />
                      )}
                    </div>
                  </div>

                  <div className="widget half-width" style={{ gridColumn: 'span 4' }}>
                    <div className="widget-header">
                      <div className="widget-title">RECENT ACTIVITY</div>
                      <button className="badge neutral" style={{ border: 'none', cursor: 'pointer' }} onClick={fetchHistory}>REFRESH</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {jobHistory.slice(0, 5).map(job => (
                        <div key={job.id} className="list-item" onClick={() => loadJob(job.id)} style={{ cursor: 'pointer' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileSpreadsheet size={16} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{job.type || 'Batch Scan'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(job.createdAt).toLocaleDateString()}</div>
                          </div>
                          <span className={`badge ${job.status === 'done' ? 'active' : 'neutral'}`} style={{ fontSize: '0.7rem' }}>{job.status}</span>
                        </div>
                      ))}
                      {jobHistory.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>No recent missions.</p>}
                    </div>
                  </div>
                </>
              )}

              {jobId && (
                <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                  <button onClick={() => { setJobId(null); setView('history'); }} className="hud-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={16} /> BACK TO ARCHIVES
                  </button>
                </div>
              )}

              {status?.results && (
                <div className="widget full-width">
                  <div className="widget-header">
                    <div className="widget-title">INTELLIGENCE REPORT</div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span className="badge active">{status.results.length} RESULTS</span>
                      <div className="results-view-toggle">
                        <button
                          className={`icon-toggle ${resultsLayout === 'grid' ? 'active' : ''}`}
                          onClick={() => setResultsLayout('grid')}
                          title="Grid view"
                        >
                          <LayoutGrid size={16} />
                        </button>
                        <button
                          className={`icon-toggle ${resultsLayout === 'list' ? 'active' : ''}`}
                          onClick={() => setResultsLayout('list')}
                          title="List view"
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {resultsLayout === 'grid' ? (
                    <div className="preview-grid">
                      {status.results.map((res, i) => {
                        const previewSrc = res.thumbnail || res.screenshot
                        return (
                          <div
                            key={i}
                            className="preview-card"
                            onClick={() => {
                              setResultsLayout('list')
                              setExpandedCro(prev => ({ ...prev, [i]: true }))
                            }}
                          >
                            <div className="preview-thumb">
                              {previewSrc ? (
                                <img src={previewSrc} alt="Site Preview" loading="lazy" />
                              ) : (
                                <div className="preview-empty">NO PREVIEW</div>
                              )}
                            </div>
                            <div className="preview-body">
                              <div className="preview-title">{res.name || (res.url ? new URL(res.url).hostname : 'Unknown Target')}</div>
                              {res.url && (
                                <a href={res.url} target="_blank" onClick={(e) => e.stopPropagation()} className="preview-link">
                                  {res.url}
                                </a>
                              )}
                              <div className="preview-summary">{res.report?.summary || "No analysis available."}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="dossier-grid">
                      {status.results.map((res, i) => {
                        const previewSrc = res.thumbnail || res.screenshot
                        return (
                          <div
                            key={i}
                            className={`obsidian-row ${expandedCro[i] ? 'expanded' : ''}`}
                            onClick={() => setExpandedCro(prev => ({ ...prev, [i]: !prev[i] }))}
                          >
                            {/* Header Section (Always Visible) */}
                            <div className="row-thumbnail">
                              {previewSrc ? (
                                <img src={previewSrc} alt="Site Preview" loading="lazy" />
                              ) : (
                                <div className="preview-empty">NO PREVIEW</div>
                              )}
                            </div>
                            <div className="row-content">
                              <div className="row-title">{res.name || (res.url ? new URL(res.url).hostname : 'Unknown Target')}</div>
                              <div className="row-preview">
                                <span style={{ fontWeight: 600, color: '#fff', display: expandedCro[i] ? 'block' : 'inline', marginBottom: expandedCro[i] ? '0.5rem' : 0 }}>
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
                              <a href={res.url} target="_blank" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--neon-cyan)', opacity: 0.8, transition: 'opacity 0.2s', display: 'flex', fontSize: '0.8rem', alignItems: 'center', gap: '4px' }}>
                                VISIT SITE <ExternalLink size={14} />
                              </a>
                            </div>

                            {/* Expanded Content: Quick Wins & Issues */}
                            {expandedCro[i] && (
                              <div className="row-details" onClick={e => e.stopPropagation()}>
                                {/* Quick Wins */}
                                {res.report?.quick_wins?.length > 0 && (
                                  <div className="quick-wins-container">
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>OPPORTUNITIES:</span>
                                    {res.report.quick_wins.map((win, idx) => (
                                      <span key={idx} className="quick-win-tag">
                                        <Zap size={12} fill="currentColor" /> {win}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Issues List (if distinct) or other details */}
                                {res.report?.issues?.length > 0 && (
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--neon-alert)', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>CRITICAL ISSUES DETECTED:</span>
                                    <ul style={{ margin: '0 0 0 1.25rem', padding: 0, color: 'var(--lux-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                      {res.report.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SCRAPER VIEW */}
          {currentView === 'scraper' && (
            <div className="dashboard-grid animate-fade-in">
              <div className="widget half-width" style={{ gridColumn: 'span 12' }}>
                <div className="widget-header">
                  <div className="widget-title">LEAD ACQUISITION PROTOCOLS</div>
                </div>
                <form onSubmit={handleScrapeSubmit} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>SECTOR</label>
                    <div style={{ width: '100%', minWidth: '220px' }}>
                      <ObsidianDropdown
                        value={scrapeSector}
                        onChange={setScrapeSector}
                        options={sectors.map(s => ({ label: s, value: s }))}
                      />
                    </div>
                  </div>
                  {scrapeSector === 'Custom Query' && (
                    <div style={{ flex: 1 }}>
                      <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>KEYWORD</label>
                      <input className="hud-input" value={scrapeKeyword} onChange={e => setScrapeKeyword(e.target.value)} placeholder="..." />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>REGION</label>
                    <input className="hud-input" value={scrapeLocation} onChange={e => setScrapeLocation(e.target.value)} placeholder="City, State" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>LIMIT</label>
                    <div style={{ width: '100%' }}>
                      <ObsidianDropdown
                        value={leadsLimit}
                        onChange={val => setLeadsLimit(Number(val))}
                        options={[
                          { label: '10 LEADS', value: 10 },
                          { label: '20 LEADS', value: 20 },
                          { label: '50 LEADS', value: 50 },
                          { label: '100 LEADS', value: 100 }
                        ]}
                      />
                    </div>
                  </div>
                  <button className="hud-btn primary" disabled={loading} style={{ width: '200px' }}>
                    {loading ? <Loader2 className="spin" /> : 'DEPLOY AGENTS'}
                  </button>
                </form>
              </div>

              <div className="widget full-width">
                <div className="widget-header">
                  <div className="widget-title">EXTRACTED TARGETS</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span className="stat-label">SCAN MODE</span>
                      <div style={{ minWidth: '180px' }}>
                        <ObsidianDropdown
                          value={captureMode}
                          onChange={setCaptureMode}
                          options={captureModeOptions}
                        />
                      </div>
                    </div>
                    {leads.length > 0 && (
                      <>
                        <button onClick={() => exportData('csv')} className="hud-btn" style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem' }}>
                          <FileSpreadsheet size={14} style={{ marginRight: '4px' }} /> CSV
                        </button>
                        <button onClick={() => exportData('xlsx')} className="hud-btn" style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem' }}>
                          <FileSpreadsheet size={14} style={{ marginRight: '4px' }} /> XLSX
                        </button>
                        <button onClick={handleAnalyzeLeads} className="hud-btn primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}>
                          ANALYZE ALL <ChevronRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {leads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                      <Search size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                      <p>Ready to deploy agents.</p>
                    </div>
                  ) : (
                    leads.map((lead, idx) => (
                      <div key={idx} className="list-item">
                        <div style={{ width: '30px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{idx + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{lead.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)' }}>{lead.website}</div>
                          {lead.address && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>📍 {lead.address}</div>}
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
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* HISTORY VIEW */}
          {currentView === 'history' && (
            <div className="dashboard-grid animate-fade-in">
              {!jobId ? (
                <div className="widget full-width">
                  <div className="widget-header">
                    <div className="widget-title">MISSION LOGS</div>
                    <button className="badge neutral" style={{ border: 'none', cursor: 'pointer' }} onClick={fetchHistory}>REFRESH</button>
                  </div>
                  <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                    {jobHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <History size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No past missions recorded.</p>
                      </div>
                    ) : (
                      jobHistory.map(job => (
                        <div key={job.id} onClick={() => { loadJob(job.id); setView('analyze'); }} className="list-item" style={{ cursor: 'pointer' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileSpreadsheet size={16} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{job.type || 'Batch Scan'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(job.createdAt).toLocaleString()}</div>
                          </div>
                          <span className={`badge ${job.status === 'done' ? 'active' : 'neutral'}`} style={{ fontSize: '0.7rem' }}>{job.status}</span>
                          <button onClick={(e) => handleDeleteJob(e, job.id)} className="hud-btn" style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: 'var(--neon-alert)', opacity: 0.6 }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* PRICING VIEW */}
          {currentView === 'pricing' && (
            <div className="dashboard-grid animate-fade-in" style={{ alignItems: 'stretch', gap: '2rem' }}>
              <div className="widget full-width" style={{ textAlign: 'center', marginBottom: '3rem', background: 'transparent', border: 'none' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', letterSpacing: '-0.02em', background: 'linear-gradient(to bottom, #fff, #999)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Upgrade Your Intelligence</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>Select the tier that matches your operational scale.</p>
              </div>

              {/* SCOUT PLAN */}
              <div className="widget" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', padding: '2.5rem', background: 'rgba(255,255,255,0.02)', borderColor: 'var(--glass-border)' }}>
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>SCOUT</h3>
                <div style={{ fontSize: '3rem', fontWeight: 200, marginBottom: '2rem', letterSpacing: '-0.05em' }}>$0</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>Essential reconnaissance tools for small-scale operations and testing.</p>
                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', padding: 0, color: 'var(--lux-secondary)', fontSize: '0.95rem' }}>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> 5 Batch Analyses / Day</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> Basic Web Scraper</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> Email Support</li>
                  </ul>
                </div>
                <button className="hud-btn" disabled style={{ width: '100%', marginTop: '2rem', opacity: 0.5 }}>CURRENT PLAN</button>
              </div>

              {/* OPERATIVE PLAN */}
              <div className="widget" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', padding: '2.5rem', border: '1px solid var(--accent-cyan)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0, 240, 255, 0.05) 100%)', position: 'relative', transform: 'scale(1.02)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}>
                <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-cyan)', color: '#000', fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 1.5rem', borderRadius: '0 0 12px 12px', letterSpacing: '0.1em' }}>MOST POPULAR</div>
                <h3 style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '1rem', marginTop: '1rem' }}>OPERATIVE</h3>
                <div style={{ fontSize: '4rem', fontWeight: 200, marginBottom: '2rem', letterSpacing: '-0.05em' }}>$49<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span></div>
                <p style={{ color: '#fff', marginBottom: '2rem', lineHeight: '1.6' }}>Professional grade tools for serious field agents and data extraction.</p>
                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', padding: 0, color: '#fff', fontSize: '0.95rem' }}>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--neon-primary)" /> <strong>Unlimited</strong> Batch Analysis</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--neon-primary)" /> Deep Web Extractions</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--neon-primary)" /> Priority Processing Queue</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--neon-primary)" /> Advanced CRO Reports</li>
                  </ul>
                </div>
                <button className="hud-btn primary" style={{ width: '100%', marginTop: '2rem', fontSize: '1rem', fontWeight: 600 }}>UPGRADE NOW</button>
              </div>

              {/* WARLORD PLAN */}
              <div className="widget" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', padding: '2.5rem', background: 'rgba(255,255,255,0.02)', borderColor: 'var(--glass-border)' }}>
                <h3 style={{ color: '#fff', fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>WARLORD</h3>
                <div style={{ fontSize: '3rem', fontWeight: 200, marginBottom: '2rem', letterSpacing: '-0.05em' }}>$199<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span></div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>Enterprise domination. Full access to API and dedicated resources.</p>
                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', padding: 0, color: 'var(--lux-secondary)', fontSize: '0.95rem' }}>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> Everything in Operative</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> Full API Access</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> Dedicated Account Manager</li>
                    <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><CheckCircle2 size={18} color="var(--lux-tertiary)" /> Custom Integrations</li>
                  </ul>
                </div>
                <button className="hud-btn" style={{ width: '100%', marginTop: '2rem', borderColor: 'var(--glass-highlight)' }}>CONTACT SALES</button>
              </div>
            </div>
          )}

          {currentView === 'outreach' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Campaign Selector Bar */}
              <div className="widget" style={{ padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Target size={20} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CAMPAIGN</span>
                    <div style={{ minWidth: '320px' }}>
                      <ObsidianDropdown
                        placeholder="Select a campaign..."
                        value={jobId || ''}
                        onChange={(val) => {
                          if (val) {
                            setSelectedOutreach(new Set())
                            setOutreachScripts({})
                            setExpandedCro({})
                            loadJob(val, false)
                          }
                        }}
                        options={jobHistory
                          .filter(j => j.status === 'done' && j.results?.length > 0)
                          .map(job => ({
                            label: `${job.type || 'Batch Scan'} (${job.results?.length} sites)`,
                            value: job.id,
                            subtext: new Date(job.createdAt).toLocaleDateString()
                          }))
                        }
                      />
                    </div>
                    <button className="hud-btn" onClick={fetchHistory} style={{ padding: '0.5rem 1rem' }}>
                      <History size={14} /> Refresh
                    </button>
                  </div>

                  {status?.results?.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={selectedOutreach.size === status.results.length && status.results.length > 0}
                          onChange={() => {
                            if (selectedOutreach.size === status.results.length) {
                              setSelectedOutreach(new Set())
                            } else {
                              setSelectedOutreach(new Set(status.results.map((_, i) => i)))
                            }
                          }}
                          style={{ width: '16px', height: '16px' }}
                        />
                        Select All ({status.results.length})
                      </label>
                      <button
                        className={`hud-btn ${selectedOutreach.size > 0 ? 'primary' : ''}`}
                        onClick={async () => {
                          for (const idx of selectedOutreach) {
                            const res = status.results[idx]
                            if (res && !outreachScripts[idx]) {
                              await handleGenerateOutreach({ ...res, id: idx })
                            }
                          }
                        }}
                        disabled={selectedOutreach.size === 0 || generatingScript}
                        style={{ opacity: selectedOutreach.size === 0 ? 0.5 : 1 }}
                      >
                        {generatingScript ? <Loader2 size={16} className="spin" /> : `Generate Scripts (${selectedOutreach.size})`}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Targets List - Full Width */}
              {/* Targets List - Full Width */}
              <div className="widget full-width" style={{ padding: '0' }}> {/* No padding for edge-to-edge list feeling or custom padding */}
                <div className="widget-header" style={{ margin: '1.5rem 1.5rem 0.5rem 1.5rem' }}>
                  <div className="widget-title">TARGETS ({status?.results?.length || 0})</div>
                </div>
                <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto', padding: '0 1rem 1rem 1rem' }}>
                  {!status?.results || status.results.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                      <Target size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                      <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>No Campaign Selected</h3>
                      <p style={{ color: 'var(--lux-tertiary)' }}>Choose a completed campaign from the dropdown above to view outreach targets.</p>
                    </div>
                  ) : (
                    status.results.map((res, idx) => {
                      const previewSrc = res.thumbnail || res.screenshot
                      return (
                        <div key={idx} style={{
                          marginBottom: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.01)',
                          borderRadius: 'var(--radius-md)',
                          border: outreachScripts[idx] ? '1px solid var(--glass-border)' : '1px solid transparent',
                          transition: 'all 0.2s',
                          overflow: 'hidden'
                        }}>
                          {/* --- HEADER ROW (Mimics list-item) --- */}
                          <div
                            className="list-item"
                            style={{
                              marginBottom: 0,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'default',
                              padding: '1rem'
                            }}
                          >
                            {/* Checkbox */}
                            <div onClick={(e) => { e.stopPropagation(); toggleOutreachSelection(idx); }} style={{ cursor: 'pointer', display: 'flex' }}>
                              <div style={{
                                width: '20px', height: '20px',
                                borderRadius: '4px',
                                border: selectedOutreach.has(idx) ? '1px solid var(--neon-primary)' : '1px solid var(--glass-border)',
                                background: selectedOutreach.has(idx) ? 'rgba(0,255,157,0.1)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}>
                                {selectedOutreach.has(idx) && <Check size={14} color="var(--neon-primary)" />}
                              </div>
                            </div>

                            {/* Thumbnail */}
                            <div className="row-thumbnail" style={{ width: '40px', height: '40px' }}>
                              {previewSrc ? (
                                <img src={previewSrc} alt="Site" loading="lazy" />
                              ) : (
                                <div className="preview-empty">NO PREVIEW</div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="row-content">
                              <div className="row-title" style={{ fontSize: '0.9rem' }}>{res.name || (res.url ? new URL(res.url).hostname : 'Unknown')}</div>
                              <a href={res.url} target="_blank" className="row-preview" style={{ color: 'var(--neon-cyan)', textDecoration: 'none', fontSize: '0.8rem' }}>
                                {res.url}
                              </a>
                            </div>

                            {/* ACTION BAR (Inline) */}
                            <div className="outreach-header-actions" style={{ marginLeft: 'auto' }}>
                              {/* Script Type Toggles */}
                              <div className="script-toggles">
                                <button
                                  className={`script-toggle-btn ${(activeScriptTab[idx] || 'email') === 'email' ? 'active' : ''}`}
                                  onClick={() => setActiveScriptTab(prev => ({ ...prev, [idx]: 'email' }))}
                                  title="Email Script"
                                >
                                  <Mail size={14} />
                                </button>
                                <button
                                  className={`script-toggle-btn ${activeScriptTab[idx] === 'sms' ? 'active' : ''}`}
                                  onClick={() => setActiveScriptTab(prev => ({ ...prev, [idx]: 'sms' }))}
                                  title="SMS Script"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                <button
                                  className={`script-toggle-btn ${activeScriptTab[idx] === 'phone' ? 'active' : ''}`}
                                  onClick={() => setActiveScriptTab(prev => ({ ...prev, [idx]: 'phone' }))}
                                  title="Phone Script"
                                >
                                  <Phone size={14} />
                                </button>
                              </div>

                              {/* Generate Button */}
                              <button
                                onClick={() => handleGenerateOutreach({ ...res, id: idx })}
                                disabled={generatingScript === idx}
                                className={`hud-btn ${outreachScripts[idx] ? '' : 'primary'}`}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '90px' }}
                              >
                                {generatingScript === idx ? <Loader2 size={14} className="spin" /> : outreachScripts[idx] ? 'Regenerate' : 'Generate'}
                              </button>
                            </div>
                          </div>

                          {/* --- SCRIPT DRAWER (Expanded) --- */}
                          <div className="script-drawer" style={{
                            width: '100%',
                            maxHeight: outreachScripts[idx] ? '800px' : '0', // Increased height for content
                            opacity: outreachScripts[idx] ? 1 : 0,
                            borderTop: outreachScripts[idx] ? '1px solid var(--glass-border)' : 'none'
                          }}>
                            {outreachScripts[idx] && (
                              <div className="script-drawer-content" style={{ padding: '0', display: 'flex' }}>
                                {/* LEFT: Analysis Feedback (New) */}
                                <div style={{ flex: 1, padding: '1.5rem', borderRight: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
                                  <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--lux-secondary)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                                    <Zap size={14} /> INTELLIGENCE BRIEF
                                  </div>
                                  <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#eee', marginBottom: '1.5rem' }}>
                                    {res.report?.summary || "No analysis data available."}
                                  </div>

                                  {res.report?.quick_wins?.length > 0 && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>OPPORTUNITIES</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {res.report.quick_wins.map((win, i) => (
                                          <span key={i} className="quick-win-tag" style={{ fontSize: '0.7rem' }}>
                                            {win}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {res.report?.issues?.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--neon-alert)', marginBottom: '0.5rem' }}>PAIN POINTS</div>
                                      <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.85rem', color: 'var(--lux-secondary)' }}>
                                        {res.report.issues.map((issue, i) => (
                                          <li key={i} style={{ marginBottom: '0.25rem' }}>{issue}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* RIGHT: Script Content */}
                                <div style={{ flex: 1, padding: '1.5rem', position: 'relative' }}>
                                  <button
                                    onClick={() => {
                                      const tab = activeScriptTab[idx] || 'email'
                                      if (tab === 'email') navigator.clipboard.writeText(`Subject: ${outreachScripts[idx].email?.subject}\n\n${outreachScripts[idx].email?.body}`)
                                      else if (tab === 'sms') navigator.clipboard.writeText(outreachScripts[idx].sms)
                                      else navigator.clipboard.writeText(outreachScripts[idx].phone)
                                    }}
                                    className="copy-btn-abs"
                                    style={{ top: '1rem', right: '1rem' }}
                                  >
                                    <Copy size={12} /> Copy
                                  </button>

                                  {(activeScriptTab[idx] || 'email') === 'email' && (
                                    <>
                                      <div style={{ marginBottom: '1rem', color: 'var(--neon-primary)', paddingRight: '4rem' }}>
                                        <span style={{ opacity: 0.5 }}>{'>'} SUBJECT:</span> {outreachScripts[idx].email?.subject}
                                      </div>
                                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.85rem' }}>
                                        {outreachScripts[idx].email?.body}
                                      </div>
                                    </>
                                  )}

                                  {activeScriptTab[idx] === 'sms' && (
                                    <div style={{ color: '#fcd34d', fontStyle: 'italic', paddingRight: '4rem' }}>
                                      <span style={{ opacity: 0.5, fontStyle: 'normal', marginRight: '0.5rem' }}>{'>'} SMS:</span>
                                      "{outreachScripts[idx].sms}"
                                    </div>
                                  )}

                                  {activeScriptTab[idx] === 'phone' && (
                                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#f87171', paddingRight: '4rem' }}>
                                      <span style={{ opacity: 0.5, marginRight: '0.5rem', color: '#fff' }}>{'>'} CALL SCRIPT:</span>
                                      {'\n'}{outreachScripts[idx].phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS VIEW */}
          {currentView === 'settings' && (
            <SettingsView
              user={user}
              captureMode={captureMode}
              onCaptureModeChange={setCaptureMode}
            />
          )}
        </div >
      </main >
    </div >
  )
}

export default App
