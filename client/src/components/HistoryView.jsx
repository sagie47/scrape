/**
 * HistoryView - Job history/archives display
 * 
 * Shows past jobs with status badges and delete functionality.
 */

import { History, FileSpreadsheet, Trash2 } from 'lucide-react'

function HistoryView({ 
  jobHistory, 
  onLoadJob, 
  onDeleteJob, 
  onRefresh 
}) {
  return (
    <div className="dashboard-grid animate-fade-in">
      <div className="widget full-width">
        <div className="widget-header">
          <div className="widget-title">MISSION LOGS</div>
          <button 
            className="badge neutral" 
            style={{ border: 'none', cursor: 'pointer' }} 
            onClick={onRefresh}
          >
            REFRESH
          </button>
        </div>
        
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {jobHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <History size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
              <p>No past missions recorded.</p>
            </div>
          ) : (
            jobHistory.map(job => (
              <div 
                key={job.id} 
                onClick={() => onLoadJob(job.id)} 
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
                <span 
                  className={`badge ${job.status === 'done' ? 'active' : 'neutral'}`} 
                  style={{ fontSize: '0.7rem' }}
                >
                  {job.status}
                </span>
                <button 
                  onClick={(e) => onDeleteJob(e, job.id)} 
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
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoryView
