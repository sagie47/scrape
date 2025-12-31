import { useState, useEffect, useRef } from 'react'

export default function ScraperFeedback({ status, progress, onAbort }) {
    const [logs, setLogs] = useState([])
    const logContainerRef = useRef(null)

    // Flavor text messages to mix in with real status
    const flavorText = [
        "Initializing neural protocols...",
        "Bypassing perimeter firewalls...",
        "Handshaking with target host...",
        "Decrypting SSL certificate chains...",
        "Optimizing agent vectors...",
        "Parsing DOM structure...",
        "Extracting metadata payload...",
        "Verifying data integrity...",
        "Compiling intelligence report...",
        "Sanitizing output stream..."
    ]

    useEffect(() => {
        if (!status) return

        // Always add the real status message
        const newLog = {
            text: status.message || `Processing... ${progress}%`,
            type: 'info',
            timestamp: new Date().toLocaleTimeString()
        }

        setLogs(prev => [...prev, newLog])

        // Randomly inject flavor text for "activity" feel
        if (Math.random() > 0.7) {
            const randomMsg = flavorText[Math.floor(Math.random() * flavorText.length)]
            setTimeout(() => {
                setLogs(prev => [...prev, {
                    text: randomMsg,
                    type: 'flavor',
                    timestamp: new Date().toLocaleTimeString()
                }])
            }, 500)
        }

    }, [status, progress])

    // Auto-scroll to bottom
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
    }, [logs])

    return (
        <div className="scraper-terminal animate-scale-in">
            <div className="terminal-header">
                <div className="terminal-title">
                    <span className="blink-dot"></span> SYSTEM_OVERRIDE_ACTIVE
                </div>
                <div className="terminal-stats">
                    <span>CPU: {Math.floor(Math.random() * 30 + 10)}%</span>
                    <span>MEM: {Math.floor(Math.random() * 40 + 20)}%</span>
                </div>
            </div>

            <div className="terminal-window" ref={logContainerRef}>
                {logs.map((log, i) => (
                    <div key={i} className={`terminal-line ${log.type}`}>
                        <span className="timestamp">[{log.timestamp}]</span>
                        <span className="cmd-prefix">{'>'}</span>
                        {log.text}
                    </div>
                ))}
                <div className="terminal-line active">
                    <span className="cursor-block"></span>
                </div>
            </div>

            <div className="terminal-footer">
                <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="footer-actions">
                    <span className="progress-text">{progress}% COMPLETE</span>
                    <button onClick={onAbort} className="terminal-abort-btn">ABORT_SEQUENCE</button>
                </div>
            </div>
        </div>
    )
}
