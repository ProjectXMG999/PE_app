import { useState, useEffect } from 'react'
import { getLogs, subscribeToLogs } from '../../debug/audioLogger'

export function DebugOverlay() {
  const [logs, setLogs] = useState<string[]>(() => getLogs())
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return subscribeToLogs(() => setLogs([...getLogs()]))
  }, [])

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setVisible(!visible)}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 12,
          zIndex: 9998,
          background: visible ? '#f44' : '#e33',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          opacity: 0.9,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
        aria-label="Toggle debug log"
      >
        {visible ? '✕' : '🔍'} DEBUG
      </button>

      {/* Floating panel — only when visible, doesn't block interactions */}
      {visible && (
        <div
          style={{
            position: 'fixed',
            bottom: 120,
            right: 12,
            width: 280,
            height: 360,
            zIndex: 9997,
            background: 'rgba(0,0,0,0.95)',
            border: '1px solid #444',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid #333',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: 'bold',
              }}
            >
              Logs: {logs.length}/80
            </span>
            <button
              onClick={() => setLogs([])}
              style={{
                background: '#555',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: 10,
                cursor: 'pointer',
              }}
              title="Clear logs"
            >
              Clear
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 10px',
              fontFamily: 'monospace',
              fontSize: 9,
              lineHeight: 1.4,
            }}
          >
            {logs.length === 0 && (
              <div style={{ color: '#666' }}>Waiting for logs...</div>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                style={{
                  color:
                    log.includes('ERR') ||
                    log.includes('rejected') ||
                    log.includes('FAILED')
                      ? '#f66'
                      : log.includes('SUCCEEDED') || log.includes('ok')
                      ? '#6f6'
                      : '#aaa',
                  padding: '0px',
                  marginBottom: '2px',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
