import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { SessionHero } from '../components/today/SessionHero'
import { DailyGoalPicker } from '../components/today/DailyGoalPicker'
import { LevelPill } from '../components/today/LevelPill'
import { LevelPicker } from '../components/today/LevelPicker'
import { TodayGuideButton } from '../components/today/TodayGuideSheet'
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
import { BoltGlyph, CheckGlyph, ChevronRightGlyph, HeadphonesGlyph, RepeatGlyph } from '../components/mode/glyphs'
import { plWords } from '../utils/plural'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './TodayPage.css'
import { useAppNavigate } from '../navigation/navigation'

const allPacks = packagesIndex as PackMeta[]

/* ── Path strip scales ──────────────────────────────────────────────────────
 * Both paths measure the same four levels, just in different units: Trenuj
 * counts words against ROUTE_TOTAL, Słuchaj counts packs listened through. The
 * final threshold is dropped from the ticks in both — the strip's own end
 * already reads as the finish line. */

const trainTicks: StripTick[] = LEVEL_META
  .filter(l => l.threshold < ROUTE_TOTAL)
  .map(l => ({ at: l.threshold }))

/** Cumulative pack counts per level, so Słuchaj gets a named scale too. */
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

/** "środa, 17 września" — the line above the large title. */
const todayLabel = () =>
  new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * Dzisiaj — the coaching screen, laid out to fit a phone without scrolling:
 * a large title, the session hero with the daily goal ring, the review row,
 * and one recommendation per path behind a segmented control. The library
 * (Pakiety) is a different screen.
 */
export function TodayPage() {
  const navigate = useAppNavigate()
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

  const levelName = (level: number) => LEVEL_META.find(l => l.level === level)?.name ?? `Poziom ${level}`

  const trainStrip = snapshot && (
    <PathStrip
      eyebrow={<><BoltGlyph size={14} weight={2} /> Twój <em>progress</em> treningu</>}
      value={snapshot.knownTotal}
      total={ROUTE_TOTAL}
      unit="słów"
      ticks={trainTicks}
      band={trainBand(snapshot.knownTotal)}
    />
  )

  const listenedCount = snapshot ? listenedPacksCount(allPacks, snapshot) : 0
  const listenStrip = snapshot && (
    <PathStrip
      eyebrow={<><HeadphonesGlyph size={14} weight={2} /> Twój <em>progress</em> słuchania</>}
      value={listenedCount}
      total={allPacks.length}
      unit="paczek"
      ticks={listenTicks}
      band={listenBand(listenedCount)}
    />
  )

  const trainPick = train ? (
    <motion.button
      type="button"
      className="today__pick u-liquid"
      variants={cardVariants}
      onClick={() => pressCta(() => navigate(`/pakiet/${train.pack.id}/fiszki-start`, { viewTransition: true }))}
    >
      {showPace && (
        <span className="today__pick-pace">+{pace!.deltaPct}% szybciej niż tydzień temu</span>
      )}
      <span className="today__pick-name">{train.pack.name}</span>
      <span className="today__pick-detail">
        {levelName(train.pack.level)} · ok. {estimateMinutes(train.pack.wordCount - train.known)} min
      </span>
      <span className="today__pick-cta">Zacznij trening</span>
    </motion.button>
  ) : (
    <motion.div className="today__path-empty u-liquid" variants={variants}>
      <p>Na tym poziomie nie ma nic do trenowania. Zajrzyj do Słuchaj albo zmień poziom.</p>
    </motion.div>
  )

  const listenPick = listen ? (
    <motion.button
      type="button"
      className="today__pick u-liquid"
      variants={cardVariants}
      onClick={() => pressCta(() => navigate(`/pakiet/${listen.pack.id}/start`, { viewTransition: true }))}
    >
      <span className="today__pick-name">{listen.pack.name}</span>
      <span className="today__pick-detail">
        {levelName(listen.pack.level)} · ok. {estimateMinutes(listen.pack.wordCount - listen.startIndex)} min
      </span>
      <span className="today__pick-cta">Zacznij słuchać</span>
    </motion.button>
  ) : (
    <motion.div className="today__path-empty u-liquid" variants={variants}>
      <p>Na tym poziomie nie ma nic do słuchania. Zajrzyj do Trenuj albo zmień poziom.</p>
    </motion.div>
  )

  const stripSlot = (strip: typeof trainStrip) => (
    <motion.div variants={variants}>
      {strip || <div className="today__strip-loading" />}
    </motion.div>
  )

  const trainContent = <>{stripSlot(trainStrip)}{trainPick}</>
  const listenContent = <>{stripSlot(listenStrip)}{listenPick}</>

  return (
    <AppShell>
      <motion.div className="today" variants={staggerContainerWide} initial="hidden" animate="show">
        {/* Large title, the way an iOS tab opens: the date above, the screen's
            name below, the level and the one info button on the right. */}
        <motion.header className="today__header" variants={variants}>
          <div className="today__heading">
            <p className="today__date">{todayLabel()}</p>
            <h1 className="today__title">Dzisiaj</h1>
          </div>
          <div className="today__header-actions">
            <LevelPill level={todayLevel} onPress={() => setLevelPickerOpen(true)} />
            <TodayGuideButton className="today__info" />
          </div>
        </motion.header>

        {nothingLeft ? (
          <motion.section className="today__done u-liquid u-liquid--gold" variants={variants}>
            <motion.span
              className="today__done-icon"
              aria-hidden="true"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={reduced ? { duration: 0 } : EASE_SPRING}
            >
              <CheckGlyph size={30} weight={2.4} />
            </motion.span>
            <h2 className="today__done-title">Na dziś wszystko</h2>
            <p className="today__done-text">
              {reviewDone
                ? `Jeszcze ${backlog} ${plWords(backlog)} w kolejce powtórek wróci jutro.`
                : goalMet
                  ? 'Cel osiągnięty i nic nie czeka na powtórkę. Jutro pokażemy Ci, co dalej.'
                  : 'Nic nie czeka. Jutro pokażemy Ci, co dalej.'}
            </p>
          </motion.section>
        ) : (
          <>
            <motion.div className="today__group" variants={staggerContainer}>
              <motion.div variants={cardVariants}>
                {pulse == null ? (
                  <div className="today__skeleton skeleton" style={{ height: 196 }} />
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

              {backlog > 0 && (
                <motion.div
                  className={`today__reviews u-liquid today__reviews--${reviewDone ? 'done' : urgency}`}
                  variants={variants}
                >
                  {/* Row 1 — the action: today's portion and how long it takes. */}
                  <button
                    type="button"
                    className="today__reviews-row"
                    onClick={() => pressCta(() => { unlockAudioGlobally(); navigate('/powtorka', { viewTransition: true }) })}
                  >
                    <span className={`today__reviews-badge${urgency === 'urgent' && !reviewDone ? ' fx-ping' : ''}`} aria-hidden="true">
                      {reviewDone ? <CheckGlyph size={18} weight={2.4} /> : <RepeatGlyph size={18} weight={2.2} />}
                    </span>
                    <span className="today__reviews-body">
                      <strong>{reviewDone ? 'Porcja na dziś zrobiona' : 'Powtórka na dziś'}</strong>
                      <span>
                        {reviewDone
                          ? 'Możesz powtórzyć więcej z kolejki'
                          : `${shownServing} ${plWords(serving)} · ok. ${estimateMinutes(serving)} min`}
                      </span>
                    </span>
                    <span className="today__reviews-chevron" aria-hidden="true"><ChevronRightGlyph size={16} weight={2.2} /></span>
                  </button>

                  {/* Row 2 — the context: the whole queue, and where it sits. */}
                  <button
                    type="button"
                    className="today__reviews-row today__reviews-row--queue"
                    onClick={() => navigate('/postęp#powtorki', { viewTransition: true })}
                  >
                    <span className="today__reviews-body">
                      <span>
                        Czeka łącznie
                        {!reviewDone && urgency !== 'calm' && (
                          <em> · {urgency === 'urgent' ? 'sporo zaległych' : 'rośnie'}</em>
                        )}
                      </span>
                      <strong>{backlog.toLocaleString('pl-PL')} {plWords(backlog)} · ok. {estimateMinutes(backlog)} min</strong>
                    </span>
                    <span className="today__reviews-link">
                      Statystyki <ChevronRightGlyph size={14} weight={2.2} />
                    </span>
                  </button>
                </motion.div>
              )}
            </motion.div>

            <motion.div className="today__group" variants={staggerContainer}>
              <motion.div variants={variants}>
                <ModeSlider
                  active={activeMode}
                  onChange={setActiveMode}
                  listenContent={listenContent}
                  trainContent={trainContent}
                />
              </motion.div>
              {todayLevel != null && (
                <motion.button
                  type="button"
                  className="today__browse-level"
                  variants={variants}
                  onClick={() => { homeSetLevel(todayLevel); navigate('/pakiety', { viewTransition: true }) }}
                >
                  Wszystkie paczki poziomu {levelName(todayLevel)}
                  <ChevronRightGlyph size={14} weight={2.2} />
                </motion.button>
              )}
            </motion.div>
          </>
        )}

        {goalOpen && <DailyGoalPicker onClose={() => setGoalOpen(false)} />}
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
