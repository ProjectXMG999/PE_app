import { useState } from 'react'
import { smartPeek } from '../../services/smartQueue'
import { useAppStore } from '../../store/useAppStore'
import type { ProgressSnapshot } from '../../hooks/useProgressData'
import { SmartModeInfoSheet } from './SmartModeInfoSheet'
import './SmartStartCard.css'

interface Props {
  snapshot: ProgressSnapshot | null
  onStart: () => void
}

/**
 * The main call to action on Dzisiaj: one button that hands off to the
 * Inteligentny session. The subline previews today's actual mix (a cheap,
 * fetch-free `smartPeek`) so the card reads as considered, not generic. The ⓘ
 * opens the sales-pitch sheet explaining what the mode does and why it's worth
 * using, for anyone who wants the "why" before tapping in.
 */
export function SmartStartCard({ snapshot, onStart }: Props) {
  const comfortLevel = useAppStore(s => s.comfortLevel)
  const todayLevel = useAppStore(s => s.todayLevel)
  const dailyGoalSec = useAppStore(s => s.dailyGoalSec)
  const reviewHealth = useAppStore(s => s.reviewHealth)
  const [infoOpen, setInfoOpen] = useState(false)

  const peek = snapshot
    ? smartPeek({ snapshot, comfortLevel, todayLevel, goalSec: dailyGoalSec, reviewHealth })
    : null

  const parts: string[] = []
  if (peek) {
    if (peek.learn > 0) parts.push(`${peek.learn} nowych`)
    if (peek.review > 0) parts.push(`${peek.review} powtórek`)
    if (peek.stretch > 0) parts.push(`${peek.stretch} trudniejszych`)
  }

  // Only when the mix actually moved — a line explaining a decision that wasn't
  // made reads as noise, and worse, as the app talking about nothing.
  const reason =
    peek?.adapted && peek.tone === 'strong'
      ? 'Powtórki trzymają się mocno — dziś więcej nowych słów.'
      : peek?.adapted && peek.tone === 'slipping'
        ? 'Kilka słów zaczyna uciekać — dziś więcej powtarzamy.'
        : null

  return (
    <section className="smartstart u-surface--raised">
      <button
        type="button"
        className="smartstart__info"
        onClick={() => setInfoOpen(true)}
        aria-label="Jak działa tryb Inteligentny"
      >
        ⓘ
      </button>

      <span className="u-kicker smartstart__kicker">✨ Twoja sesja na dziś</span>
      <h2 className="smartstart__title u-display">Ucz się inteligentnie</h2>
      <p className="smartstart__sub">
        {parts.length > 0
          ? `${parts.join(' · ')} · ~${peek!.minutes} min`
          : 'Sam dobiorę słowa i powtórki do tego, jak Ci dziś idzie.'}
      </p>
      {reason && <p className="smartstart__reason">{reason}</p>}
      <button className="smartstart__cta u-cta fx-shine" onClick={onStart}>
        Zaczynamy
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      {infoOpen && <SmartModeInfoSheet onClose={() => setInfoOpen(false)} />}
    </section>
  )
}
