interface Props {
  label: string
  count?: number
}

export function SectionHeader({ label, count }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-sm)',
      padding: '0 var(--spacing-md)',
      marginBottom: 'var(--spacing-sm)',
    }}>
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--accent)',
        }}>
          · {count}
        </span>
      )}
    </div>
  )
}
