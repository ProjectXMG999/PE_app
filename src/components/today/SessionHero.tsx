import { useState } from 'react'
import { useCountUp } from '../../hooks/useCountUp'
import { smartPeek } from '../../services/smartQueue'
import { useAppStore } from '../../store/useAppStore'
import type { ProgressSnapshot } from '../../hooks/useProgressData'
import { SmartModeInfoSheet } from '../smart/SmartModeInfoSheet'
import './SessionHero.css'

interface Props {
  snapshot: ProgressSnapshot | null
  onStart: () => void
  secondsStudied: number
  goalSec: number
  onEditGoal: () => void
}

/**
 * Dzisiaj's one hero — merges what used to be two stacked cards (FocusStage's
 * goal ring, SmartStartCard's session pitch). Both were answering the same
 * underlying question ("what do I do right now, and how's today going") from
 * two separate cards with their own type scale, which is how a screen ends up
 * with four different places minutes get mentioned. The goal ring survives as
 * a compact badge — still tappable, still the exact FocusStage math — instead
 * of a whole card of its own; the headline stat drops the learn/review/stretch
 * breakdown to one number (the full mix is one ⓘ tap away, in
 * SmartModeInfoSheet, which already explains the mode in plain language).
 */
export function SessionHero({ snapshot, onStart, secondsStudied, goalSec, onEditGoal }: Props) {
  const comfortLevel = useAppStore(s => s.comfortLevel)
  const todayLevel = useAppStore(s => s.todayLevel)
  const dailyGoalSec = useAppStore(s => s.dailyGoalSec)
  const reviewHealth = useAppStore(s => s.reviewHealth)
  const [infoOpen, setInfoOpen] = useState(false)

  const mins = Math.floor(secondsStudied / 60)
  const goalMins = Math.round(goalSec / 60)
  const pct = goalSec > 0 ? Math.min(100, Math.round((secondsStudied / goalSec) * 100)) : 0
  const met = pct >= 100
  const shownMins = useCountUp(mins, 1000, 100)

  const peek = snapshot
    ? smartPeek({ snapshot, comfortLevel, todayLevel, goalSec: dailyGoalSec, reviewHealth })
    : null
  const hasMix = peek != null && (peek.learn > 0 || peek.review > 0 || peek.stretch > 0)

  // Only when the mix actually moved — a line explaining a decision that wasn't
  // made reads as noise, and worse, as the app talking about nothing.
  const reason =
    peek?.adapted && peek.tone === 'strong'
      ? 'Powtórki trzymają się mocno — dziś więcej nowych słów.'
      : peek?.adapted && peek.tone === 'slipping'
        ? 'Kilka słów zaczyna uciekać — dziś więcej powtarzamy.'
        : null

  return (
    <button
      type="button"
      className={`sessionhero u-surface--raised${met ? ' u-surface--gold' : ''}`}
      onClick={onStart}
    >
      <span className="sessionhero__head">
        <span className="u-kicker sessionhero__kicker">✨ Twoja sesja na dziś</span>
        <span
          className="sessionhero__info"
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); setInfoOpen(true) }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setInfoOpen(true) } }}
          aria-label="Jak działa tryb Inteligentny"
        >
          ⓘ
        </span>
        <span
          className="sessionhero__goal"
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); onEditGoal() }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onEditGoal() } }}
          aria-label={`Cel dnia: ${mins} z ${goalMins} minut. Dotknij, aby zmienić.`}
          style={{ ['--focus-fill' as string]: pct }}
        >
          <span className="sessionhero__goal-num fx-pop" key={mins}>{shownMins}</span>
        </span>
      </span>

      <h2 className="sessionhero__title u-display">Ucz się inteligentnie</h2>

      <p className="sessionhero__stat">
        {hasMix ? `~${peek!.minutes} minut` : 'Sam dobiorę słowa i powtórki do tego, jak Ci dziś idzie.'}
      </p>
      {reason && <p className="sessionhero__reason">{reason}</p>}

      <span className="sessionhero__cta u-cta fx-shine">
        Zaczynamy
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </span>

      {infoOpen && <SmartModeInfoSheet onClose={() => setInfoOpen(false)} />}
    </button>
  )
}
