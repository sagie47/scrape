import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Zap, Globe, Loader2, Plus, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

const Dashboard = () => {
  const [currentView, setCurrentView] = useState('analyze'); // 'analyze' | 'outreach' | 'pricing'
  const [activeJob, setActiveJob] = useState(null); // null = "New Scrape" mode

  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [jobHistory, setJobHistory] = useState([]);
  const [analysisType, setAnalysisType] = useState('batch');
  const [singleUrl, setSingleUrl] = useState('');
  const [sheet, setSheet] = useState('');
  const [column, setColumn] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Poll for status
  useEffect(() => {
    let interval;
    if (jobId) {
      interval = setInterval(checkStatus, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:3000/jobs');
      const sorted = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setJobHistory(sorted);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const loadJob = (id) => {
    const job = jobHistory.find(j => j.id === id);
    if (!job) return;
    setStatus(job);
    setActiveJob(job);

    // Resume polling if needed
    if (job.status === 'running' || job.status === 'pending') {
      setJobId(id);
    } else {
      setJobId(null);
    }
  };

  const handleNewScrape = () => {
    setActiveJob(null);
    setStatus(null);
    setJobId(null);
    setFile(null);
    setProgress(0);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheet', sheet);
    formData.append('column', column);

    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setJobId(res.data.jobId);
      // We keep activeJob as null for the "Processing" view, 
      // or we could set a temp object. For now null works with progress view.
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    }
    setLoading(false);
  };

  const checkStatus = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/status/${jobId}`);
      setStatus(res.data);
      setProgress(res.data.progress || 0);

      if (res.data.status === 'done' || res.data.status === 'error') {
        setJobId(null);
        fetchHistory();
        // If this is the active job (or we are in new mode), update active job
        if (!activeJob) {
          // We might want to switch to "active job" mode once done, 
          // but keeping it in "new mode" with results is fine too.
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-shell">
      <div className="void-atmosphere"></div>

      {/* SIDEBAR PANEL */}
      <aside className="sidebar-panel">
        <div className="sidebar-header">
          <Zap size={24} className="text-neon-primary" fill="currentColor" />
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>TeamPilot</span>
        </div>

        {/* MAIN NAVIGATION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          <div
            className={`history-item ${currentView === 'analyze' && !activeJob ? 'active' : ''}`}
            onClick={() => { setCurrentView('analyze'); handleNewScrape(); }}
          >
            <Upload size={16} /> <span className="history-name">Scraper</span>
          </div>
          <div
            className={`history-item ${currentView === 'outreach' ? 'active' : ''}`}
            onClick={() => { setCurrentView('outreach'); setActiveJob(null); }}
          >
            <Globe size={16} /> <span className="history-name">Outreach</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">HISTORY</div>
          <div className="history-list">
            {jobHistory.map(job => (
              <div
                key={job.id}
                className={`history-item ${activeJob?.id === job.id ? 'active' : ''}`}
                onClick={() => { setCurrentView('analyze'); loadJob(job.id); }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {job.status === 'done' ? <CheckCircle2 size={14} className="text-success" /> :
                    job.status === 'error' ? <AlertCircle size={14} className="text-error" /> :
                      <Loader2 size={14} className="spin text-subtle" />}
                  <span className="history-name">
                    {job.type === 'single' ? 'Single Scan' : `Batch (${job.total || '?'})`}
                  </span>
                </div>
                <span className="history-date">
                  {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN STAGE */}
      <main className="stage">
        <div className="stage-content">

          {/* ==================== VIEW: COMMAND CENTER (ANALYZE) ==================== */}
          {currentView === 'analyze' && (
            <div className="fade-in">

              {/* HEADER (Only show if Results/Active Job, otherwise show Status Line layout) */}
              {activeJob && (
                <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h1 className="display-text" style={{ fontSize: '1.8rem', margin: 0 }}>
                    Intelligence Report
                  </h1>
                </header>
              )}

              {/* 1. Status Line (Floating Data) - ONLY IN COMMAND CENTER MODE (No Active Job) */}
              {!activeJob && (
                <div className="status-line" style={{ marginBottom: '3rem' }}>
                  <div className="status-group">
                    <div className="status-metric">
                      <span className="metric-value">{jobId ? 1 : 0}</span>
                      <span className="metric-label">Active Agents</span>
                    </div>
                    <div className="status-metric" style={{ opacity: 0.5 }}>
                      <span className="metric-value">{jobHistory.filter(j => j.status === 'done').length}</span>
                      <span className="metric-label">Completed</span>
                    </div>
                    <div className="status-metric" style={{ opacity: 0.3 }}>
                      <span className="metric-value">{status?.total || 0}</span>
                      <span className="metric-label">Scanned</span>
                    </div>
                  </div>

                  <div className="flex-row gap-sm text-subtle" style={{ letterSpacing: '0.1em', fontSize: '0.75rem' }}>
                    <div className={`status-dot ${jobId ? 'active' : ''}`}></div>
                    SYSTEM ONLINE
                  </div>
                </div>
              )}

              {!activeJob && (
                <div className="display-text delay-1" style={{ fontSize: '1.5rem', marginBottom: '3rem' }}>
                  Command <span style={{ opacity: 0.4 }}>Center</span>
                </div>
              )}

              {/* 2. Main Interface (Event Horizon) */}
              {/* UPLOAD flow (activeJob == null) */}
              {!activeJob && (
                <div className="delay-2">
                  {!jobId ? (
                    /* UPLOAD FORM */
                    <div style={{ maxWidth: '800px' }}>
                      <form onSubmit={handleUpload}>
                        <div className="event-horizon" onClick={() => document.getElementById('file-upload')?.click()}>
                          <div className="horizon-glow"></div>
                          <input type="file" id="file-upload" hidden onChange={e => setFile(e.target.files[0])} accept=".xlsx" />

                          <div className="flex-col" style={{ alignItems: 'center', gap: '1rem', zIndex: 2 }}>
                            <Upload size={48} strokeWidth={1} style={{ opacity: file ? 1 : 0.4, transition: 'opacity 0.3s' }} />
                            <div className="display-text" style={{ fontSize: '2rem', fontWeight: 200 }}>
                              {file ? file.name : 'Drop Dataset'}
                            </div>
                            <div className="text-subtle mono-text" style={{ fontSize: '0.8rem' }}>
                              .XLSX FORMAT
                            </div>
                          </div>

                          {file && (
                            <div className="flex-row gap-md" style={{ marginTop: '3rem', zIndex: 2 }}>
                              <input
                                placeholder="Sheet Name"
                                value={sheet}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setSheet(e.target.value)}
                                className="glass-input"
                              />
                              <input
                                placeholder="Column Name"
                                value={column}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setColumn(e.target.value)}
                                className="glass-input"
                              />
                              <button type="submit" className="glass-icon-btn">
                                {loading ? <Loader2 size={16} className="spin" /> : <Zap size={16} fill="black" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* PROGRESS */
                    <div className="event-horizon">
                      <div className="display-text" style={{ fontSize: '4rem', fontWeight: 100 }}>
                        {progress}%
                      </div>
                      <div className="text-subtle mono-text" style={{ marginTop: '1rem' }}>
                        PROCESSING SEQUENCE
                      </div>
                    </div>
                  )}

                  {/* Show results if available (e.g. just finished in this view) */}
                  {status?.results && (
                    <div style={{ marginTop: '6rem' }}>
                      <div className="display-text" style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Intelligence Report</div>
                      <div className="results-grid">
                        {status.results.map((res, i) => (
                          <div key={i} className="result-card">
                            <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{new URL(res.url).hostname}</div>
                            <div className="text-subtle" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                              {res.report?.summary || "Analysis pending..."}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: JOB DETAILS (When activeJob is set) - Restored from original results view logic */}
              {activeJob && (
                <div className="fade-in">
                  <div className="results-grid">
                    {(status?.results || activeJob.results || []).map((res, i) => (
                      <div key={i} className="result-card">
                        <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                          {res.url ? new URL(res.url).hostname : 'Unknown Host'}
                        </div>
                        <div className="text-subtle" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                          {res.report?.summary}
                        </div>
                      </div>
                    ))}
                    {(!status?.results && !activeJob.results?.length) && (
                      <div className="text-subtle">No data available for this job.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== VIEW: OUTREACH (RESULTS) ==================== */}
          {currentView === 'outreach' && (
            <div className="fade-in">
              <div className="display-text" style={{ fontSize: '1.5rem', marginBottom: '3rem' }}>
                Global <span style={{ opacity: 0.4 }}>Intelligence</span>
              </div>
              <div className="text-subtle mono-text">Use the Command Center to initiate intelligence gathering.</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
