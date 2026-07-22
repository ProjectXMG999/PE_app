import './AutoplayControls.css'

const STEP_LABELS = ['PL', 'EN', 'PL zdanie', 'EN zdanie'] as const
const MODE_LABELS: Record<'fast' | 'standard' | 'speaking', string> = {
  fast: '⚡ Szybko',
  standard: '★ Standard',
  speaking: '🎙 Speaking',
}

export interface AutoplayCountdown {
  ms: number
  key: number
}

interface Props {
  autoplayMode: 'fast' | 'standard' | 'speaking'
  onModeChange: (m: 'fast' | 'standard' | 'speaking') => void
  playStep: 0 | 1 | 2 | 3 | null
  audioLoading: boolean
  audioError: 'timeout' | 'error' | null
  isPaused: boolean
  onPauseResume: () => void
  onRestart: () => void
  onSkip: () => void
  onOpenSettings: () => void
  countdown: AutoplayCountdown | null
}

// Ring geometry: r=38 inside an 84×84 viewBox around the 72px pause button
const RING_R = 38
const RING_C = 2 * Math.PI * RING_R

// Dumb presentational bottom bar for autoplay — all handlers live in FlashcardPage.
export function AutoplayControls({
  autoplayMode, onModeChange, playStep, audioLoading, audioError,
  isPaused, onPauseResume, onRestart, onSkip, onOpenSettings, countdown,
}: Props) {
  return (
    <div className="apc">
      <div className="apc__mode-pills">
        {(['fast', 'standard', 'speaking'] as const).map(m => (
          <button
            key={m}
            className={`apc__mode-pill ${autoplayMode === m ? 'active' : ''}`}
            onClick={() => onModeChange(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="apc__playsteps" aria-hidden="true">
        {STEP_LABELS.map((label, i) => {
          const isActive = playStep === i
          return (
            <span key={i} className={`apc__playstep ${isActive ? 'active' : ''}`}>
              {isActive && audioLoading
                ? <span className="apc__playstep-spinner" />
                : <span className="apc__playstep-dot" />}
              {label}
            </span>
          )
        })}
      </div>
      <span className="apc__sr-status" aria-live="polite">
        {playStep !== null ? `Odtwarzanie: ${STEP_LABELS[playStep]}` : ''}
      </span>

      <div className="apc__notice">
        {audioError ? (
          <div className="apc__error" role="status">
            {audioError === 'timeout' ? 'Audio nie odpowiada — pomijam' : 'Problem z audio — pomijam ten fragment'}
          </div>
        ) : countdown ? (
          <div className="apc__speak-label">Powiedz na głos</div>
        ) : null}
      </div>

      <div className="apc__btns">
        <button className="apc__gear-btn" onClick={onOpenSettings} aria-label="Ustawienia odtwarzania">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" /><circle cx="9" cy="7" r="2.5" fill="var(--bg-surface)" />
            <line x1="4" y1="17" x2="20" y2="17" /><circle cx="15" cy="17" r="2.5" fill="var(--bg-surface)" />
          </svg>
        </button>

        <button className="apc__side-btn" onClick={onRestart} aria-label="Powtórz słowo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
          </svg>
          <span className="apc__side-label">Powtórz</span>
        </button>

        <div className="apc__pause-wrap">
          {countdown && (
            <svg
              key={countdown.key}
              className="apc__ring"
              viewBox="0 0 84 84"
              aria-hidden="true"
            >
              <circle className="apc__ring-track" cx="42" cy="42" r={RING_R} />
              <circle
                className="apc__ring-fill"
                cx="42" cy="42" r={RING_R}
                strokeDasharray={RING_C}
                style={{ animationDuration: `${countdown.ms}ms`, ['--ring-c' as string]: `${RING_C}px` }}
              />
            </svg>
          )}
          <button
            className={`apc__pause-btn ${isPaused ? 'apc__pause-btn--paused' : ''}`}
            onClick={onPauseResume}
            aria-label={isPaused ? 'Wznów' : 'Pauza'}
          >
            {isPaused ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="7,4 20,12 7,20"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            )}
          </button>
        </div>

        <button className="apc__side-btn" onClick={onSkip} aria-label="Pomiń słowo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
          </svg>
          <span className="apc__side-label">Pomiń</span>
        </button>
      </div>
    </div>
  )
}
