import { AnimationEvent, ReactNode, useEffect } from 'react'
import { LEVEL_COLORS } from '../../data/levels'
import { useAppStore } from '../../store/useAppStore'
import { CardSide } from '../../hooks/useCardFlip'
import packagesIndex from '../../data/packages-index.json'
import { PackMeta } from '../../types/vocabulary'
import './StudyStage.css'

const allPacks = packagesIndex as PackMeta[]

/** Which session you're in. Drives --stage-accent and nothing else. */
export type StageTone = 'train' | 'review' | 'smart'

interface Props {
  tone: StageTone
  /** ALL-CAPS eyebrow naming the session: "Powtórka", "Inteligentnie", "Trenuj". */
  kicker: ReactNode
  /** The pack the *current card* comes from — resolved to name + level here.
   *  In a review or Inteligentny run this changes card to card, which is the
   *  whole point: you can see which ground the word is standing on. */
  packageId?: string | null
  /** "3 / 20". Always in the header, whatever the rail below looks like. */
  counter: ReactNode
  /** The progress element: <StageTrack> for a plain run, SmartProgressRail for
   *  a segmented one. */
  rail: ReactNode
  onExit: () => void
  exitLabel?: string

  /** Remount key — the enter animation is keyed on it. */
  cardKey: string | number
  polish: string
  english: string
  side: CardSide
  /** useCardFlip's cardClass; the base name stays this component's business. */
  cardClass: (base: string) => string
  onFlip: () => void
  onAnimationEnd: (e: AnimationEvent) => void
  /** Pronounce the English answer — every mode has this. */
  onPlay: () => void
  /** Pronounce the Polish prompt. Only modes that offer it pass this. */
  onPlayPolish?: () => void
  /** Extra content under the word on each face — the example sentence in
   *  Zdania. Passing either one switches the card to the reading layout:
   *  left-aligned and a size down, because a sentence under a centred 46px
   *  word is a ransom note. */
  frontExtra?: ReactNode
  backExtra?: ReactNode
  frontHint?: ReactNode
  backHint?: ReactNode

  answersVisible: boolean
  answersDisabled: boolean
  onAnswer: (recalled: boolean) => void
}

/**
 * The flashcard session, as one screen: header → progress → card → answers.
 *
 * WordFlash, Powtórka and Inteligentny used to each carry their own copy of
 * this markup (~110 identical lines apiece, against one stylesheet named after
 * one of them). They drifted, and a fix in one never reached the other two.
 * Everything that genuinely differs between the three is a prop: the tone
 * colour, the eyebrow, and what the progress rail looks like.
 */
export function StudyStage({
  tone, kicker, packageId, counter, rail, onExit, exitLabel = 'Zakończ sesję',
  cardKey, polish, english, side, cardClass, onFlip, onAnimationEnd, onPlay, onPlayPolish,
  frontExtra, backExtra, frontHint, backHint,
  answersVisible, answersDisabled, onAnswer,
}: Props) {
  const rich = Boolean(frontExtra || backExtra)
  useStageAmbient()

  return (
    <div className={`stage stage--${tone}${rich ? ' stage--rich' : ''}`}>
      <StageHeader
        kicker={kicker}
        packageId={packageId}
        counter={counter}
        onExit={onExit}
        exitLabel={exitLabel}
      />

      <div className="stage__rail">{rail}</div>

      <div className="stage__scene">
        <div
          key={cardKey}
          className={`stage__card${cardClass('stage__card')}`}
          onClick={onFlip}
          onAnimationEnd={onAnimationEnd}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onFlip()}
        >
          {side === 'front' ? (
            <div className="stage__face stage__face--front">
              <span className="stage__lang stage__lang--pl">PL</span>
              <div className="stage__body">
                <div className="stage__word-row">
                  <p className="stage__word">{polish}</p>
                  {onPlayPolish && (
                    <button
                      type="button"
                      className="stage__play"
                      onClick={e => { e.stopPropagation(); onPlayPolish() }}
                      aria-label={`Wymowa po polsku: ${polish}`}
                    >
                      <PlayGlyph />
                    </button>
                  )}
                </div>
                {frontExtra}
              </div>
              <p className="stage__hint">{frontHint ?? 'Powiedz po angielsku. Potem odsłoń.'}</p>
            </div>
          ) : (
            <div className="stage__face stage__face--back">
              <span className="stage__lang stage__lang--en">EN</span>
              <div className="stage__body">
                <div className="stage__word-row">
                  <p className="stage__word">{english}</p>
                  <button
                    type="button"
                    className="stage__play"
                    onClick={e => { e.stopPropagation(); onPlay() }}
                    aria-label={`Wymowa: ${english}`}
                  >
                    <PlayGlyph />
                  </button>
                </div>
                {backExtra}
              </div>
              <p className="stage__hint">{backHint ?? 'Dotknij, aby wrócić do przodu.'}</p>
            </div>
          )}
        </div>
      </div>

      <div className={`stage__actions${answersVisible ? ' stage__actions--visible' : ''}`}>
        <button
          type="button"
          className="stage__btn stage__btn--no"
          onClick={() => onAnswer(false)}
          disabled={answersDisabled}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Nie znam
        </button>
        <button
          type="button"
          className="stage__btn stage__btn--yes u-cta"
          onClick={() => onAnswer(true)}
          disabled={answersDisabled}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Znam
        </button>
      </div>
    </div>
  )
}

/**
 * Drop the ambient WebGL shader for the length of a session.
 *
 * AppShell does this for every page that uses it; the session screens don't,
 * because they own the whole viewport and have no shell. Without it the shader
 * keeps running behind an opaque background for the entire session — which on
 * the listening player, holding a wake lock for twenty minutes, is real battery
 * spent painting something nobody can see.
 */
export function useStageAmbient() {
  useEffect(() => {
    const setAmbientHidden = useAppStore.getState().setAmbientHidden
    setAmbientHidden(true)
    return () => setAmbientHidden(false)
  }, [])
}

/**
 * Exit · what this session is and where this card comes from · position.
 *
 * Exported because the listening player (FlashcardPage) wears the same header —
 * it is the one piece of session chrome that must be identical across all
 * seven study modes, and it is the only place the pack's name and level appear
 * once a session has started.
 */
export function StageHeader({
  kicker, packageId, counter, onExit, exitLabel = 'Zakończ sesję',
}: {
  kicker: ReactNode
  packageId?: string | null
  counter: ReactNode
  onExit: () => void
  exitLabel?: string
}) {
  const meta = packageId ? allPacks.find(p => p.id === packageId) : undefined

  return (
    <header className="stage__top">
      <button type="button" className="stage__exit" onClick={onExit} aria-label={exitLabel}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="stage__id">
        <span className="stage__kicker u-kicker">{kicker}</span>
        {meta && (
          <span className="stage__source">
            <span className="stage__source-name">{meta.name}</span>
            {meta.level > 0 && (
              <span
                className="stage__source-level"
                style={{ ['--lvl' as string]: LEVEL_COLORS[meta.level] ?? 'var(--text-muted)' }}
              >
                Poziom {meta.level}
              </span>
            )}
          </span>
        )}
      </div>

      <span className="stage__counter">{counter}</span>
    </header>
  )
}

function PlayGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

/**
 * The example sentence under a word, with its own play button. Stops the click
 * from reaching the card, which would flip it mid-listen.
 */
export function StageSentence({ text, onPlay, label }: { text: string; onPlay: () => void; label: string }) {
  return (
    <div className="stage__sentence">
      <p className="stage__sentence-text">{text}</p>
      <button
        type="button"
        className="stage__play stage__play--sm"
        onClick={e => { e.stopPropagation(); onPlay() }}
        aria-label={label}
      >
        <PlayGlyph size={12} />
      </button>
    </div>
  )
}

/**
 * The plain progress track. `known` is the share of the pack already mastered
 * (a standing fact), `current` is how far this run has got — two readings of
 * the same bar, which is why they are one element and not two.
 */
export function StageTrack({ current, known = 0 }: { current: number; known?: number }) {
  return (
    <div className="stage__track">
      {known > 0 && <span className="stage__track-known" style={{ width: `${known}%` }} />}
      <span className="stage__track-fill" style={{ width: `${current}%` }} />
    </div>
  )
}
