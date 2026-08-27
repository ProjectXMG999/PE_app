import { useEffect, useState } from 'react'
import './Toast.css'

export interface ToastData {
  id: number
  text: string
  icon?: string
  /** Adds a short confetti burst. Reserved for reaching the daily goal. */
  celebrate?: boolean
}

interface Props {
  toast: ToastData | null
  onDismiss: () => void
}

const VISIBLE_MS = 4000

/**
 * A quiet milestone notice, in the spirit of Apple Books' reading goals.
 *
 * Anchored to the bottom and non-modal on purpose: this fires *during* a study
 * session, and anything that stole focus or covered the card would punish the
 * user for the very behaviour it's congratulating.
 */
export function Toast({ toast, onDismiss }: Props) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (toast == null) return
    setLeaving(false)

    const hide = window.setTimeout(() => setLeaving(true), VISIBLE_MS)
    const remove = window.setTimeout(onDismiss, VISIBLE_MS + 300)
    return () => {
      window.clearTimeout(hide)
      window.clearTimeout(remove)
    }
  }, [toast, onDismiss])

  if (toast == null) return null

  return (
    <div
      className={`toast${leaving ? ' toast--leaving' : ''}${toast.celebrate ? ' toast--celebrate' : ''}`}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {toast.icon && <span className="toast__icon" aria-hidden="true">{toast.icon}</span>}
      <span className="toast__text">{toast.text}</span>
    </div>
  )
}
