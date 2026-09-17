import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ExitDirection, Toast } from './Toast'
import { AchievementToast, ToastData, setToastListener } from '../../services/toast'
import { useAppStore } from '../../store/useAppStore'

/** Queue ceiling — past this, older plain notes are dropped, never badges. */
const MAX_QUEUED = 6

/**
 * Mounted once in App so notices work on any screen.
 *
 * Shows one toast at a time, in arrival order: the next one enters only after
 * the current one has left, so two notices never talk over each other and a
 * burst of them reads as a sequence rather than a stack.
 *
 * Badge notices wait out a study session. A session screen (the same flag that
 * dims the ambient background) is a place for the card, not for a medal sliding
 * over the answer buttons — so a badge earned on the last card is presented the
 * moment you step out of the session, which is also when it lands best. Plain
 * notes (the daily-goal milestone) still show in-session, as they always have.
 */
export function ToastHost() {
  const [queue, setQueue] = useState<ToastData[]>([])
  const [exitDir, setExitDir] = useState<ExitDirection>('down')
  const inSession = useAppStore(s => s.ambientHidden)
  const navigate = useNavigate()

  useEffect(() => {
    setToastListener(t => setQueue(q => {
      // The same note twice in a row is noise, not news.
      const last = q[q.length - 1]
      if (t.kind === 'note' && last?.kind === 'note' && last.text === t.text) return q
      const next = [...q, t]
      while (next.length > MAX_QUEUED) {
        const i = next.findIndex(x => x.kind === 'note')
        if (i < 0) break
        next.splice(i, 1)
      }
      return next
    }))
    return () => setToastListener(null)
  }, [])

  const current = queue.find(t => t.kind === 'note' || !inSession) ?? null

  const dismiss = useCallback((direction: ExitDirection = 'down') => {
    setExitDir(direction)
    setQueue(q => q.filter(t => t.id !== current?.id))
  }, [current?.id])

  const open = useCallback((t: AchievementToast) => {
    setExitDir('down')
    setQueue(q => q.filter(x => x.id !== t.id))
    navigate('/postęp', { state: { badge: t.achievement.id } })
  }, [navigate])

  return (
    <div className="toast-layer">
      <AnimatePresence mode="wait" custom={exitDir} initial={false}>
        {current && (
          <Toast key={current.id} toast={current} onDismiss={dismiss} onOpen={open} />
        )}
      </AnimatePresence>
    </div>
  )
}
