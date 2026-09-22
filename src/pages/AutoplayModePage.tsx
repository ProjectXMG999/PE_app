import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { usePackageData } from '../hooks/usePackageData'
import { getPackageProgress } from '../services/db'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { unlockKeepAlive } from '../audio/keepAlive'
import { hasAnySentenceAudio } from '../audio/sentenceAudio'
import { RATES } from '../constants/audioRates'
import {
  AUTOPLAY_MODES,
  planSequence,
  modeStepsForContent,
  estimateStepsMs,
  AutoplayLine,
  AutoplayStep,
} from '../config/autoplayModes'
import { ModeScreen, ModeBlock, ModeCard, ModeFact, ModeLabel, ModeNote } from '../components/mode/ModeScreen'
import { BoltGlyph, LevelsGlyph, MicGlyph } from '../components/mode/glyphs'
import { getPackNumber, plWords } from '../utils/packVisuals'
import { LEVEL_COLORS } from '../data/levels'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import { AutoplayMode } from '../types/progress'
import './AutoplayModePage.css'
import { useAppNavigate } from '../navigation/navigation'

const allPacks = packagesIndex as PackMeta[]

const MODE_ORDER: AutoplayMode[] = ['fast', 'standard', 'speaking']

const MODE_GLYPH: Record<AutoplayMode, ReactNode> = {
  fast: <BoltGlyph />,
  standard: <LevelsGlyph />,
  speaking: <MicGlyph />,
}

const MODE_TAGLINE: Record<AutoplayMode, string> = {
  fast: 'Szybka powtórka',
  standard: 'Słowo i zdanie w kontekście',
  speaking: 'Powiedz, zanim usłyszysz',
}

/** Standard zapowiada zdanie w kontekście — w pakiecie bez nagranych zdań
 *  sesja jest samym słowem z powtórką, więc tyle ma obiecywać. */
function modeTagline(id: AutoplayMode, hasSentenceAudio: boolean): string {
  if (id === 'standard' && !hasSentenceAudio) return 'Słowo z powtórką i przerwą'
  return MODE_TAGLINE[id]
}

const MODE_HINT: Record<AutoplayMode, string> = {
  fast: 'Usłysz polskie słowo, przypomnij sobie angielskie i powtórz.',
  standard: 'Najlepszy tryb do regularnej nauki.',
  speaking: 'Przypomnij sobie słowo, zbuduj zdanie i mów na głos.',
}

const LINE_LABEL: Record<AutoplayLine, string> = {
  0: 'PL', 1: 'EN', 2: 'PL zdanie', 3: 'EN zdanie',
}

/**
 * The session estimate on a mode card.
 *
 * Whole minutes alone were useless here: on a short pack all three modes came
 * out 1 min / 1 min / 2 min, and telling them apart is the entire job of this
 * screen. Seconds are rounded to 5 — this is an estimate built from gap timings
 * and a flat guess per clip, not a stopwatch — and dropped once the number is
 * big enough that they stop carrying information.
 */
function fmtDuration(ms: number): string {
  const secs = Math.max(5, Math.round(ms / 5000) * 5)
  if (secs < 60) return `~${secs} s`
  const min = Math.floor(secs / 60)
  const rest = secs % 60
  if (min >= 10 || rest === 0) return `~${Math.round(secs / 60)} min`
  return `~${min} min ${rest} s`
}

/** Polish plural for "krok": 1 → krok, 2–4 → kroki, else → kroków. */
function plSteps(n: number): string {
  const last = n % 10
  const last2 = n % 100
  if (n === 1) return 'krok'
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return 'kroki'
  return 'kroków'
}

/**
 * The mode's timeline, drawn as beads on a thread — one per clip it will
 * actually play for *this* pack (sentence beads drop out when the pack has no
 * sentence recordings). Shows what a mode does before you commit to a session.
 */
function StepStrip({ steps }: { steps: AutoplayStep[] }) {
  return (
    <span className="seqstrip" aria-hidden="true">
      {steps.map((step, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="seqstrip__link" />}
          <span className="seqstrip__bead" data-line={step.line}>
            {LINE_LABEL[step.line]}
            {(step.repeat ?? 1) > 1 && <em>×{step.repeat}</em>}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

export function AutoplayModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useAppNavigate()
  const { autoplayMode, setAutoplayMode, enRate, setEnRate } = useAppStore()
  const [resume, setResume] = useState<{ index: number; total: number } | null>(null)

  const meta = allPacks.find(p => p.id === packageId)
  const { pack } = usePackageData(packageId ?? null)

  // A word with playable sentence audio if the pack has any — so the step
  // preview and the estimate reflect what this pack will actually play. Sentence
  // TEXT isn't enough: most packs carry text whose recording doesn't exist yet,
  // and those steps never sound. Falls back to the first word, or (before the
  // pack body loads) to "no sentence audio".
  const sample = useMemo(
    () => pack?.words.find(hasAnySentenceAudio) ?? pack?.words[0] ?? null,
    [pack],
  )
  const hasSentences = !!pack?.words.some(hasAnySentenceAudio)
  const wordCount = pack?.words.length ?? meta?.wordCount ?? 0
  const packNum = packageId ? getPackNumber(packageId) : null

  useEffect(() => {
    if (!packageId || wordCount === 0) return
    let alive = true
    getPackageProgress(packageId).then(pp => {
      if (!alive) return
      const i = pp?.currentIndex ?? 0
      setResume(i > 0 && i < wordCount ? { index: i, total: wordCount } : null)
    })
    return () => { alive = false }
  }, [packageId, wordCount])

  const start = (mode: AutoplayMode, from: 'start' | 'from') => {
    // Unlock iOS audio while still inside the tap gesture.
    unlockAudioGlobally()
    unlockKeepAlive()
    setAutoplayMode(mode)
    navigate(`/pakiet/${packageId}/autoplay`, { state: { resume: from } })
  }

  return (
    <ModeScreen
      tone="listen"
      kicker={<>Słuchaj{packNum ? ` · pakiet #${packNum}` : ''}</>}
      title={meta?.name ?? packageId ?? 'Pakiet'}
      facts={
        <>
          {meta?.level ? (
            <ModeFact color={LEVEL_COLORS[meta.level]}>Poziom {meta.level}</ModeFact>
          ) : null}
          {meta?.volume ? <ModeFact>{meta.volume}</ModeFact> : null}
          {wordCount > 0 && <ModeFact>{wordCount} {plWords(wordCount)}</ModeFact>}
        </>
      }
      lead="Wybierz rytm sesji. Tryb i tempo zmienisz też w trakcie słuchania."
    >
      {resume && (
        <ModeBlock className="resume u-liquid">
          <div className="resume__top">
            <span className="u-kicker resume__kicker">Przerwana sesja</span>
            <span className="resume__count">{resume.index} / {resume.total}</span>
          </div>
          <div
            className="resume__bar"
            role="img"
            aria-label={`Odsłuchane ${resume.index} z ${resume.total} słów`}
          >
            <i style={{ width: `${(resume.index / resume.total) * 100}%` }} />
          </div>
          <span className="resume__text">Wracasz do słowa {resume.index + 1}.</span>
          <div className="resume__actions">
            <button className="resume__btn" onClick={() => start(autoplayMode, 'start')}>
              Od początku
            </button>
            <button
              className="resume__btn resume__btn--primary u-cta u-cta--live"
              onClick={() => start(autoplayMode, 'from')}
            >
              Wznów
            </button>
          </div>
        </ModeBlock>
      )}

      <ModeBlock>
        <div className="modescreen__cards">
          {MODE_ORDER.map(id => {
            const steps = sample ? planSequence(id, sample) : modeStepsForContent(id, hasSentences)
            const durMs = wordCount > 0 ? estimateStepsMs(steps) * wordCount : 0
            return (
              <ModeCard
                key={id}
                glyph={MODE_GLYPH[id]}
                color={AUTOPLAY_MODES[id].color}
                cta="Zacznij słuchać"
                name={AUTOPLAY_MODES[id].label}
                tagline={modeTagline(id, steps.some(s => s.needs != null))}
                desc={MODE_HINT[id]}
                detail={<StepStrip steps={steps} />}
                badge={autoplayMode === id ? 'Ostatnio' : undefined}
                current={autoplayMode === id}
                meta={
                  <>
                    {durMs > 0 && <span><em>{fmtDuration(durMs)}</em> sesji</span>}
                    <span>{steps.length} {plSteps(steps.length)} na słowo</span>
                  </>
                }
                onClick={() => start(id, 'start')}
              />
            )
          })}
        </div>
      </ModeBlock>

      <ModeBlock className="tempo">
        <ModeLabel aside={`${Math.round(enRate * 100)}%`}>Tempo angielskiego</ModeLabel>
        <div className="tempo__track" role="radiogroup" aria-label="Tempo odtwarzania">
          {RATES.map(({ value, label }) => (
            <button
              key={value}
              role="radio"
              aria-checked={enRate === value}
              className={`tempo__pill${enRate === value ? ' tempo__pill--active' : ''}`}
              onClick={() => setEnRate(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="tempo__hint">Dotyczy nagrań po angielsku — polskie zostają w naturalnym tempie.</p>
      </ModeBlock>

      <ModeBlock>
        <ModeNote label="Jak działa tryb Słuchaj?">
          Trening audio bez patrzenia w ekran. Słuchasz, przypominasz sobie i powtarzasz słowa.
          Idealny na spacer, trening, sprzątanie albo podróż.
        </ModeNote>
      </ModeBlock>
    </ModeScreen>
  )
}
