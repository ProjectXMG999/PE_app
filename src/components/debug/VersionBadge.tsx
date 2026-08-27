// TEMP: loud build stamp so we can tell which bundle a device is actually
// running while chasing the bottom-nav issue. Remove once confirmed.
export function VersionBadge() {
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'
  const timestamp = import.meta.env.VITE_BUILD_TIME || new Date().toISOString()
  const built = new Date(timestamp).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 2px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        padding: '2px 10px',
        borderRadius: 999,
        background: '#e11d48',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {version} · {built}
    </div>
  )
}
