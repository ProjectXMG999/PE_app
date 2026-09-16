import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { SessionHero } from '../components/today/SessionHero'
import { DailyGoalPicker } from '../components/today/DailyGoalPicker'
import { LevelPill } from '../components/today/LevelPill'
import { LevelPicker } from '../components/today/LevelPicker'
import { NextStepInfoSheet } from '../components/today/NextStepInfoSheet'
import { ReviewPriorityInfoSheet } from '../components/today/ReviewPriorityInfoSheet'
import { PathStrip, StripBand, StripTick } from '../components/today/PathStrip'
import { ModeSlider, StudyPath } from '../components/today/ModeSlider'
import { LevelUpPrompt } from '../components/today/LevelUpPrompt'
import { EASE_SPRING, fadeUpReduced, heroCard, heroReveal, staggerContainer, staggerContainerWide } from '../components/today/motion'
import { useProgressData, avgWordsPerDayTrend, packLevelOf } from '../hooks/useProgressData'
import { useProgressPulse } from '../hooks/useProgressPulse'
import { useCountUp } from '../hooks/useCountUp'
import { useHaptics } from '../hooks/useHaptics'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { playTick, playSuccess } from '../services/sfx'
import { nextListenPack, nextTrainPack, listenedPacksCount, estimateMinutes, packLevelThresholds } from '../data/nextPack'
import { shouldPromptLevelUp } from '../services/comfort'
import { LEVEL_COLORS, LEVEL_META, ROUTE_TOTAL } from '../data/levels'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './TodayPage.css'

const allPacks = packagesIndex as PackMeta[]

/* ── Path strip scales ──────────────────────────────────────────────────────
 * Both paths measure the same four levels, just in different units: Trenuj
 * counts words against ROUTE_TOTAL, Słuchaj counts packs listened through. The
 * final threshold is dropped from the ticks in both — the strip's own end
 * already reads as the finish line. */

const trainTicks: StripTick[] = LEVEL_META
  .filter(l => l.threshold < ROUTE_TOTAL)
  .map(l => ({ at: l.threshold }))

/** Cumulative pack counts per level, so Słuchaj gets a named scale too — it
 *  used to show the same four marks with nothing saying what they were. */
const listenThresholds = packLevelThresholds(allPacks)
const listenTicks: StripTick[] = listenThresholds.slice(0, 3).map(at => ({ at }))

/** The level a value has reached, plus what's next and how far. */
function bandFor(value: number, thresholds: number[]): StripBand | undefined {
  const reachedIdx = thresholds.reduce((acc, t, i) => (value >= t ? i : acc), -1)
  const nextIdx = thresholds.findIndex(t => t > value)
  const reached = reachedIdx >= 0 ? LEVEL_META[reachedIdx] : undefined
  const next = nextIdx >= 0 ? LEVEL_META[nextIdx] : undefined

  return {
    label: reached?.name ?? 'Start trasy',
    color: reached ? LEVEL_COLORS[reached.level] : undefined,
    next: next ? { label: next.name, remaining: thresholds[nextIdx] - value } : undefined,
  }
}

const trainBand = (knownWords: number) =>
  bandFor(knownWords, LEVEL_META.map(l => l.threshold))

const listenBand = (listenedPacks: number) => bandFor(listenedPacks, listenThresholds)

/**
 * Dzisiaj — the coaching screen: where am I, and the one next thing on each of
 * my two paths. The focus stage carries the daily goal; a slim rail flags the
 * review debt; the slider recommends a pack per path; a quiet strip shows the
 * long-route position. The library (Pakiety) is a different screen.
 */
export function TodayPage() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const haptics = useHaptics()
  const snapshot = useProgressData()
  const pulse = useProgressPulse()
  const todayLevel = useAppStore(s => s.todayLevel)
  const setTodayLevel = useAppStore(s => s.setTodayLevel)
  const homeSetLevel = useAppStore(s => s.setLevel)

  const comfortLevel = useAppStore(s => s.comfortLevel)
  const strongStreak = useAppStore(s => s.strongStreak)
  const levelUpPromptState = useAppStore(s => s.levelUpPrompt)
  const dismissLevelUp = useAppStore(s => s.dismissLevelUp)

  const [goalOpen, setGoalOpen] = useState(false)
  const [levelPickerOpen, setLevelPickerOpen] = useState(false)
  const [nextStepInfoOpen, setNextStepInfoOpen] = useState(false)
  const [reviewInfoOpen, setReviewInfoOpen] = useState(false)
  const [levelUpTarget, setLevelUpTarget] = useState<number | null>(null)
  const celebratedRef = useRef(false)
  const goalCelebratedRef = useRef(false)
  const goalWasMetRef = useRef<boolean | null>(null)

  // Offer the level-up prompt here too (not just after an Inteligentny
  // session) — someone who trains via plain Trenuj still moves comfortLevel.
  useEffect(() => {
    if (!snapshot) return
    const floor = todayLevel ?? 1
    const masteredPacksAtFloor = snapshot.packageProgress.filter(
      p => p.masteredAt != null && packLevelOf(p.packageId) === floor
    ).length
    const prompt = shouldPromptLevelUp({
      comfortLevel, strongStreak, todayLevel, levelUpPrompt: levelUpPromptState, masteredPacksAtFloor,
    })
    setLevelUpTarget(prompt?.target ?? null)
  }, [snapshot, comfortLevel, strongStreak, todayLevel, levelUpPromptState])

  const scopedPacks = todayLevel == null ? allPacks : allPacks.filter(p => p.level >= todayLevel)
  const listen = nextListenPack(scopedPacks, snapshot)
  const train = nextTrainPack(scopedPacks, snapshot)

  const [activeMode, setActiveMode] = useState<StudyPath>(() => (train ? 'train' : 'listen'))

  const backlog = pulse?.dueCount ?? 0
  const serving = pulse?.servingLeft ?? 0
  const urgency = pulse?.reviewUrgency ?? 'calm'
  const reviewDone = backlog > 0 && serving === 0
  const pace = snapshot ? avgWordsPerDayTrend(snapshot) : null
  const showPace = pace?.deltaPct != null && pace.deltaPct > 0

  const nothingLeft = listen == null && train == null && serving === 0
  const goalMet = pulse?.goalMet ?? false
  const shownServing = useCountUp(serving, 800)

  useEffect(() => {
    if (nothingLeft && !celebratedRef.current) {
      celebratedRef.current = true
      playSuccess()
      haptics.success()
    }
  }, [nothingLeft, haptics])

  useEffect(() => {
    if (pulse == null) return
    const prev = goalWasMetRef.current
    goalWasMetRef.current = goalMet
    if (prev === false && goalMet && !goalCelebratedRef.current && !nothingLeft) {
      goalCelebratedRef.current = true
      playSuccess()
      haptics.success()
    }
  }, [goalMet, nothingLeft, pulse, haptics])

  function pressCta(action: () => void) {
    playTick()
    haptics.tap()
    action()
  }

  const variants = reduced ? fadeUpReduced : heroReveal
  const cardVariants = reduced ? fadeUpReduced : heroCard

  const trainContent = (
    <>
      <motion.div variants={variants}>
        {snapshot ? (
          <PathStrip
            tone="train"
            eyebrow={<>⚡ Twój <em>progress</em> treningu</>}
            value={snapshot.knownTotal}
            total={ROUTE_TOTAL}
            unit="słów"
            ticks={trainTicks}
            band={trainBand(snapshot.knownTotal)}
          />
        ) : (
          <div className="today__strip-loading" />
        )}
      </motion.div>
      {train ? (
        <motion.button
          type="button"
          className="today__pick"
          variants={cardVariants}
          onClick={() => pressCta(() => navigate(`/pakiet/${train.pack.id}/fiszki-start`, { viewTransition: true }))}
        >
          <span className="today__pick-head">
            <span className="u-kicker">⚡ Trenuj</span>
            {showPace && (
              <span className="today__pick-pace">+{pace!.deltaPct}% szybciej niż w zeszłym tygodniu</span>
            )}
          </span>
          <span className="today__pick-name">{train.pack.name}</span>
          <span className="today__pick-detail">
            {LEVEL_META.find(l => l.level === train.pack.level)?.name ?? `Poziom ${train.pack.level}`} ·{' '}
            ~{estimateMinutes(train.pack.wordCount - train.known)} min
          </span>
          <span className="today__pick-cta u-cta fx-shine">
            Trenuj
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </motion.button>
      ) : (
        <motion.p className="today__path-empty" variants={variants}>Nic do trenowania na tym poziomie — sprawdź Słuchaj albo zmień poziom.</motion.p>
      )}
    </>
  )

  const listenContent = (
    <>
      <motion.div variants={variants}>
        {snapshot ? (
          <PathStrip
            tone="listen"
            eyebrow={<>🎧 Twój <em>progress</em> słuchania</>}
            value={listenedPacksCount(allPacks, snapshot)}
            total={allPacks.length}
            unit="paczek"
            ticks={listenTicks}
            band={listenBand(listenedPacksCount(allPacks, snapshot))}
          />
        ) : (
          <div className="today__strip-loading" />
        )}
      </motion.div>
      {listen ? (
        <motion.button
          type="button"
          className="today__pick today__pick--listen"
          variants={cardVariants}
          onClick={() => pressCta(() => navigate(`/pakiet/${listen.pack.id}/start`, { viewTransition: true }))}
        >
          <span className="today__pick-head">
            <span className="u-kicker">🎧 Słuchaj</span>
          </span>
          <span className="today__pick-name">{listen.pack.name}</span>
          <span className="today__pick-detail">
            {LEVEL_META.find(l => l.level === listen.pack.level)?.name ?? `Poziom ${listen.pack.level}`} ·{' '}
            ~{estimateMinutes(listen.pack.wordCount - listen.startIndex)} min
          </span>
          <span className="today__pick-cta today__pick-cta--listen u-cta fx-shine">
            Słuchaj
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </motion.button>
      ) : (
        <motion.p className="today__path-empty" variants={variants}>Nic do słuchania na tym poziomie — sprawdź Trenuj albo zmień poziom.</motion.p>
      )}
    </>
  )

  return (
    <AppShell>
      <motion.div className="today" variants={staggerContainerWide} initial="hidden" animate="show">
        {/* Heading kept for the document outline / screen readers only — the
            bottom-nav tab already labels this screen, and a big visible word
            just competed with the focus stage below it. */}
        <h1 className="today__title-sr">Dzisiaj</h1>

        {/* Three groups, not one stack: gdzie jestem · co teraz · przeglądaj.
            The gap between groups is twice the gap inside one, which is the
            whole difference between a composed page and a list of widgets.
            Each group is a motion.div with its own stagger — framer only
            cascades to *direct* children, so a plain <div> here would silently
            kill the entrance animation of everything it wraps. */}
        <motion.div className="today__group" variants={staggerContainer}>
          <motion.div className="today__level-row" variants={variants}>
            <LevelPill level={todayLevel} onPress={() => setLevelPickerOpen(true)} />
            {todayLevel != null && (
              <button
                className="today__browse-level"
                onClick={() => { homeSetLevel(todayLevel); navigate('/', { viewTransition: true }) }}
              >
                Przeglądaj poziom
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            )}
          </motion.div>
        </motion.div>

        {nothingLeft ? (
          <motion.section
            className="today__done u-surface--raised u-surface--gold"
            variants={variants}
          >
            <motion.span
              className="today__done-icon"
              aria-hidden="true"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={reduced ? { duration: 0 } : EASE_SPRING}
            >
              ✓
            </motion.span>
            <h2 className="today__done-title u-display">Zrobione</h2>
            <p className="today__done-text">
              {reviewDone
                ? `Na dziś wszystko. Jeszcze ${backlog} w kolejce powtórek wróci jutro.`
                : goalMet
                  ? 'Cel osiągnięty i nic nie czeka na powtórkę. Jutro Progress pokaże Ci następne.'
                  : 'Nic nie czeka. Jutro Progress pokaże Ci następne.'}
            </p>
          </motion.section>
        ) : (
          <>
            {/* Co teraz. Inteligentny is the recommended one-tap action — it
                sits above everything else, but Trenuj/Słuchaj/Powtórka below
                stay exactly as they were for anyone who wants to pick by hand.
                The daily goal ring lives inside it now (see SessionHero)
                rather than as its own card above. */}
            <motion.div className="today__group" variants={staggerContainer}>
            <motion.div variants={cardVariants}>
              {pulse == null ? (
                <div className="today__skeleton skeleton" style={{ height: 220 }} />
              ) : (
                <SessionHero
                  snapshot={snapshot}
                  onStart={() => pressCta(() => { unlockAudioGlobally(); navigate('/inteligentny') })}
                  secondsStudied={pulse.secondsToday}
                  goalSec={pulse.goalSec}
                  onEditGoal={() => setGoalOpen(true)}
                />
              )}
            </motion.div>

            {serving > 0 && (
              <motion.button
                type="button"
                className={`today__rail u-rail today__rail--${urgency}`}
                variants={variants}
                onClick={() => pressCta(() => { unlockAudioGlobally(); navigate('/powtorka', { viewTransition: true }) })}
              >
                <span className="today__rail-head">
                  <span
                    className={`today__rail-dot today__rail-dot--${urgency}${urgency === 'calm' ? '' : ' fx-ping'}`}
                    aria-hidden="true"
                  />
                  <span className="u-kicker">
                    🔁 {urgency === 'urgent' ? 'Sporo zaległych' : urgency === 'building' ? 'Powtórki się zbierają' : 'Priorytet na dziś'}
                  </span>
                </span>
                <span className="today__rail-body">
                  <strong>Powtórka · {shownServing} słów</strong>
                  <span>~{estimateMinutes(serving)} min</span>
                </span>
                <span className="today__rail-go" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
                <button
                  type="button"
                  className="today__rail-info"
                  onClick={(e) => { e.stopPropagation(); setReviewInfoOpen(true) }}
                  aria-label="Jak działają powtórki"
                >
                  ⓘ
                </button>
              </motion.button>
            )}

            {reviewDone && (
              <motion.button
                type="button"
                className="today__review-done u-rail"
                variants={variants}
                onClick={() => pressCta(() => { unlockAudioGlobally(); navigate('/powtorka', { viewTransition: true }) })}
              >
                <span className="today__review-done-icon" aria-hidden="true">✓</span>
                <span className="today__review-done-body">
                  <strong>Powtórki na dziś zrobione</strong>
                  <span>Jeszcze {backlog} w kolejce, wrócą jutro — albo zrób je już teraz</span>
                </span>
                <span className="today__review-done-go" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </motion.button>
            )}
            </motion.div>

            {/* Przeglądaj ścieżkami. */}
            <motion.div className="today__group" variants={staggerContainer}>
              <motion.div variants={variants}>
                <ModeSlider
                  active={activeMode}
                  onChange={setActiveMode}
                  listenContent={listenContent}
                  trainContent={trainContent}
                  onInfoClick={() => setNextStepInfoOpen(true)}
                />
              </motion.div>
            </motion.div>
          </>
        )}

        {goalOpen && <DailyGoalPicker onClose={() => setGoalOpen(false)} />}
        {nextStepInfoOpen && <NextStepInfoSheet onClose={() => setNextStepInfoOpen(false)} />}
        {reviewInfoOpen && <ReviewPriorityInfoSheet onClose={() => setReviewInfoOpen(false)} />}
        {levelPickerOpen && (
          <LevelPicker
            current={todayLevel}
            onSelect={l => { setTodayLevel(l); setLevelPickerOpen(false); playTick(); haptics.tap() }}
            onClose={() => setLevelPickerOpen(false)}
          />
        )}
        {levelUpTarget != null && (
          <LevelUpPrompt
            target={levelUpTarget}
            onAccept={() => { setTodayLevel(levelUpTarget); dismissLevelUp(levelUpTarget) }}
            onDecline={() => dismissLevelUp(levelUpTarget)}
          />
        )}
      </motion.div>
    </AppShell>
  )
}
