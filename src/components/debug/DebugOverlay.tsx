import { useState, useEffect } from 'react'
import { getLogs, subscribeToLogs } from '../../debug/audioLogger'

export function DebugOverlay() {
  const [logs, setLogs] = useState<string[]>(() => getLogs())
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return subscribeToLogs(() => setLogs([...getLogs()]))
  }, [])

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 12,
          zIndex: 9999,
          background: '#e33',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          opacity: 0.85,
          fontFamily: 'monospace',
        }}
        aria-label="Open debug log"
      >
        🔍 DEBUG
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.93)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #333',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 'bold',
          }}
        >
          Audio Debug Log ({logs.length}/{80})
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLogs([])}
            style={{
              background: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={() => setVisible(false)}
            style={{
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          fontFamily: 'monospace',
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {logs.length === 0 && (
          <div style={{ color: '#666' }}>Brak logów — uruchom autoplay</div>
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
                  : '#ccc',
              padding: '1px 0',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}
