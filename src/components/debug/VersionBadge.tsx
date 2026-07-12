export function VersionBadge() {
  // Read from import.meta.env.VITE_APP_VERSION or fallback to package.json version
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'
  const timestamp = import.meta.env.VITE_BUILD_TIME || new Date().toISOString()

  // Only show in non-production, or always if explicitly enabled
  const shouldShow = !import.meta.env.PROD || import.meta.env.VITE_SHOW_VERSION === 'true'

  if (!shouldShow) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        fontSize: 10,
        color: '#888',
        fontFamily: 'monospace',
        lineHeight: 1.3,
        textAlign: 'right',
        pointerEvents: 'none',
      }}
    >
      <div>v{version}</div>
      <div style={{ fontSize: 9, color: '#666' }}>
        {new Date(timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}
