import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAppStore } from '../store/useAppStore'
import { usePackageData } from '../hooks/usePackageData'
import { getPackageProgress } from '../services/db'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { unlockKeepAlive } from '../audio/keepAlive'
import { RATES } from '../constants/audioRates'
import {
  AUTOPLAY_MODES,
  planSequence,
  modeStepsForContent,
  estimateStepsMs,
  AutoplayLine,
} from '../config/autoplayModes'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import { AutoplayMode } from '../types/progress'
import './AutoplayModePage.css'

const allPacks = packagesIndex as PackMeta[]

const MODE_HINT: Record<AutoplayMode, string> = {
  fast: 'Sam rytm słów: usłysz polskie, przypomnij sobie angielskie, powtórz. Najkrócej.',
  standard: 'Słowo, przerwa na przypomnienie, angielski dwa razy. Do codziennej nauki.',
  speaking: 'Powiedz na głos w przerwie, zanim usłyszysz. Najbardziej aktywnie.',
}
const MODE_ICON: Record<AutoplayMode, string> = { fast: '⚡', standard: '⭐', speaking: '🎙️' }
const MODE_ORDER: AutoplayMode[] = ['fast', 'standard', 'speaking']

const LINE_LABEL: Record<AutoplayLine, string> = { 0: 'PL', 1: 'EN', 2: 'PL zd.', 3: 'EN zd.' }

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  return min < 1 ? 'poniżej minuty' : `~${min} min`
}

export function AutoplayModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()
  const { autoplayMode, setAutoplayMode, enRate, setEnRate } = useAppStore()
  const [infoOpen, setInfoOpen] = useState(false)
  const [resume, setResume] = useState<{ index: number; total: number } | null>(null)

  const meta = allPacks.find(p => p.id === packageId)
  const { pack } = usePackageData(packageId ?? null)

  // A word that carries sentences if the pack has any — so the step preview and
  // the estimate reflect what this pack will actually play. Falls back to the
  // first word, or (before the pack body loads) to "no sentences".
  const sample = useMemo(
    () => pack?.words.find(w => w.sentenceEn || w.sentencePl) ?? pack?.words[0] ?? null,
    [pack],
  )
  const hasSentences = !!pack?.words.some(w => w.sentenceEn || w.sentencePl)
  const wordCount = pack?.words.length ?? meta?.wordCount ?? 0

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
    <AppShell hideBottomNav hideSidebar={false}>
      <div className="autoplay-mode">
        <div className="autoplay-mode__header">
          <button
            className="autoplay-mode__back"
            onClick={() => navigate(packageId ? `/pakiet/${packageId}` : '/')}
            aria-label="Wróć do pakietu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span className="autoplay-mode__back-label">Pakiet</span>
          </button>
          <span className="autoplay-mode__pack-name">{meta?.name ?? packageId}</span>
        </div>

        <h1 className="autoplay-mode__title">Wybierz tryb słuchania</h1>

        {resume && (
          <div className="autoplay-mode__resume">
            <span className="autoplay-mode__resume-text">
              Przerwałeś na słowie <strong>{resume.index + 1}</strong> z {resume.total}
            </span>
            <div className="autoplay-mode__resume-actions">
              <button
                className="autoplay-mode__resume-btn autoplay-mode__resume-btn--primary"
                onClick={() => start(autoplayMode, 'from')}
              >
                Wznów
              </button>
              <button className="autoplay-mode__resume-btn" onClick={() => start(autoplayMode, 'start')}>
                Od początku
              </button>
            </div>
          </div>
        )}

        <div className="autoplay-mode__cards">
          {MODE_ORDER.map(id => {
            const steps = sample ? planSequence(id, sample) : modeStepsForContent(id, hasSentences)
            const durMs = wordCount > 0 ? estimateStepsMs(steps) * wordCount : 0
            const selected = autoplayMode === id
            return (
              <button
                key={id}
                className={`autoplay-mode__card${selected ? ' autoplay-mode__card--selected' : ''}`}
                onClick={() => start(id, 'start')}
              >
                <span className="autoplay-mode__card-icon">{MODE_ICON[id]}</span>
                <div className="autoplay-mode__card-body">
                  <span className="autoplay-mode__card-name">
                    {AUTOPLAY_MODES[id].label}
                    {selected && <span className="autoplay-mode__card-badge">ostatnio</span>}
                  </span>
                  <span className="autoplay-mode__card-seq" aria-hidden="true">
                    {steps.map((s, i) => (
                      <span key={i} className="autoplay-mode__seq-dot" data-line={s.line}>
                        {LINE_LABEL[s.line]}
                      </span>
                    ))}
                  </span>
                  <span className="autoplay-mode__card-desc">{MODE_HINT[id]}</span>
                  {durMs > 0 && (
                    <span className="autoplay-mode__card-dur">
                      {fmtDuration(durMs)} · {wordCount} słów
                    </span>
                  )}
                </div>
                <svg className="autoplay-mode__card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )
          })}
        </div>

        <div className="autoplay-mode__tempo">
          <span className="autoplay-mode__tempo-label">Tempo</span>
          <div className="autoplay-mode__tempo-pills" role="radiogroup" aria-label="Tempo odtwarzania">
            {RATES.map(({ value, label }) => (
              <button
                key={value}
                role="radio"
                aria-checked={enRate === value}
                className={`autoplay-mode__tempo-pill${enRate === value ? ' autoplay-mode__tempo-pill--active' : ''}`}
                onClick={() => setEnRate(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="autoplay-mode__info">
          <button
            type="button"
            className="autoplay-mode__info-toggle"
            onClick={() => setInfoOpen(o => !o)}
            aria-expanded={infoOpen}
          >
            <span>Jak działa tryb Słuchaj?</span>
            <svg
              className={`autoplay-mode__info-chevron${infoOpen ? ' autoplay-mode__info-chevron--open' : ''}`}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {infoOpen && (
            <p className="autoplay-mode__info-desc">
              Trening audio bez patrzenia w ekran. Słuchasz, przypominasz sobie i powtarzasz
              słowa. Idealny na spacer, trening, sprzątanie lub podróż. Tryb i tempo zmienisz
              też w trakcie — nic nie tracisz.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
