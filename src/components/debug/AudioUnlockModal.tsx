import { useCallback } from 'react'

interface AudioUnlockModalProps {
  visible: boolean
  onUnlock: () => void
}

export function AudioUnlockModal({ visible, onUnlock }: AudioUnlockModalProps) {
  const handleUnlock = useCallback(() => {
    console.log('[action] AudioUnlockModal — user tapped to unlock audio')
    onUnlock()
  }, [onUnlock])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 12,
          padding: '24px 20px',
          maxWidth: 320,
          textAlign: 'center',
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            fontSize: 32,
            marginBottom: 16,
          }}
        >
          🔊
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
            color: 'var(--text-primary)',
          }}
        >
          Uruchom audio
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Dotknij przycisku poniżej aby rozpocząć odtwarzanie. Twoja przeglądarka wymaga interakcji użytkownika.
        </p>
        <button
          onClick={handleUnlock}
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark, #7c3aed) 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          ▶ Rozpocznij
        </button>
      </div>
    </div>
  )
}
