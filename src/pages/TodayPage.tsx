import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { DailyTimeRing } from '../components/today/DailyTimeRing'
import { DailyGoalPicker } from '../components/today/DailyGoalPicker'
import { LevelPill } from '../components/today/LevelPill'
import { LevelPicker } from '../components/today/LevelPicker'
import { NextStepInfoSheet } from '../components/today/NextStepInfoSheet'
import { ReviewPriorityInfoSheet } from '../components/today/ReviewPriorityInfoSheet'
import { RouteStrip } from '../components/today/RouteStrip'
import { ListenStrip } from '../components/today/ListenStrip'
import { RouteLoader } from '../components/today/RouteLoader'
import { ModeSlider, StudyPath } from '../components/today/ModeSlider'
import { EASE_SPRING, fadeUpReduced, heroCard, heroReveal, staggerContainerWide } from '../components/today/motion'
import { useProgressData, avgWordsPerDayTrend } from '../hooks/useProgressData'
import { useProgressPulse } from '../hooks/useProgressPulse'
import { useCountUp } from '../hooks/useCountUp'
import { useHaptics } from '../hooks/useHaptics'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { playTick, playSuccess } from '../services/sfx'
import { nextListenPack, nextTrainPack, listenedPacksCount, estimateMinutes } from '../data/nextPack'
import { LEVEL_META } from '../data/levels'
import { useAppStore } from '../store/useAppStore'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './TodayPage.css'

const allPacks = packagesIndex as PackMeta[]

/**
 * Dzisiaj — where am I, and what's next on each of my two paths.
 *
 * The pack list is 864 items deep with filters and a search box; that's a
 * library, and a library is a place you browse when you already know what you
 * want. This is the answer to "what do I do today", which is the promise the
 * method is actually built on. It doesn't replace the library — it stands in
 * front of it.
 *
 * Słuchaj and Trenuj are two independent skills (recognising vs. actively
 * recalling), so the screen recommends a next pack for *each*, presented as
 * two full pages of a slider — not one editorialised "best" pick with the
 * other demoted to a footnote. Powtórka (review) sits above the slider,
 * since protecting what's already known is a different, time-sensitive
 * concern from either path.
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

  const [goalOpen, setGoalOpen] = useState(false)
  const [levelPickerOpen, setLevelPickerOpen] = useState(false)
  const [nextStepInfoOpen, setNextStepInfoOpen] = useState(false)
  const [reviewInfoOpen, setReviewInfoOpen] = useState(false)
  const celebratedRef = useRef(false)
  const goalCelebratedRef = useRef(false)
  const goalWasMetRef = useRef<boolean | null>(null)

  const scopedPacks = todayLevel == null ? allPacks : allPacks.filter(p => p.level >= todayLevel)
  const listen = nextListenPack(scopedPacks, snapshot)
  const train = nextTrainPack(scopedPacks, snapshot)

  const [activeMode, setActiveMode] = useState<StudyPath>(() => (train ? 'train' : 'listen'))

  // backlog = every due word; serving = how many of them to show today.
  const backlog = pulse?.dueCount ?? 0
  const serving = pulse?.servingLeft ?? 0
  const urgency = pulse?.reviewUrgency ?? 'calm'
  const reviewDone = backlog > 0 && serving === 0
  const pace = snapshot ? avgWordsPerDayTrend(snapshot) : null
  const showPace = pace?.deltaPct != null && pace.deltaPct > 0

  const nothingLeft = listen == null && train == null && serving === 0
  const goalMet = pulse?.goalMet ?? false
  const shownServing = useCountUp(serving, 800)

  // The "day complete" chime/haptic fires once per visit, the first time the
  // page actually lands on the done state — not on every render while it stays there.
  useEffect(() => {
    if (nothingLeft && !celebratedRef.current) {
      celebratedRef.current = true
      playSuccess()
      haptics.success()
    }
  }, [nothingLeft, haptics])

  // Goal-met moment: only on the false→true transition seen during this visit,
  // never on a page that opens already-met (which would chime every visit).
  // Gated on !nothingLeft so it can't double up with the "day complete" chime.
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
          <RouteStrip knownWords={snapshot.knownTotal} />
        ) : (
          <div className="today__strip-loading">
            <RouteLoader height={20} />
          </div>
        )}
      </motion.div>
      {train ? (
        <motion.section className="today__hero" variants={cardVariants}>
          <motion.div className="today__hero-head" variants={variants}>
            <span className="today__hero-eyebrow">⚡ Trenuj</span>
            {showPace && (
              <span className="today__hero-pace">+{pace!.deltaPct}% szybciej niż w zeszłym tygodniu</span>
            )}
          </motion.div>
          <motion.p className="today__hero-name" variants={variants}>{train.pack.name}</motion.p>
          <motion.p className="today__hero-detail" variants={variants}>
            {LEVEL_META.find(l => l.level === train.pack.level)?.name ?? `Poziom ${train.pack.level}`} ·{' '}
            ~{estimateMinutes(train.pack.wordCount - train.known)} min
          </motion.p>
          <motion.div className="today__hero-actions" variants={variants}>
            <motion.button
              className="today__cta today__cta--train"
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.015 }}
              onClick={() => pressCta(() => navigate(`/pakiet/${train.pack.id}/fiszki-start`))}
            >
              <span className="today__cta-icon" aria-hidden="true">⚡</span>
              <span className="today__cta-label">Trenuj</span>
              <span className="today__cta-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </span>
            </motion.button>
          </motion.div>
        </motion.section>
      ) : (
        <motion.p className="today__path-empty" variants={variants}>Nic do trenowania na tym poziomie — sprawdź Słuchaj albo zmień poziom.</motion.p>
      )}
    </>
  )

  const listenContent = (
    <>
      <motion.div variants={variants}>
        {snapshot ? (
          <ListenStrip
            listenedPacks={listenedPacksCount(allPacks, snapshot)}
            totalPacks={allPacks.length}
            packs={allPacks}
          />
        ) : (
          <div className="today__strip-loading">
            <RouteLoader height={20} />
          </div>
        )}
      </motion.div>
      {listen ? (
        <motion.section className="today__hero today__hero--listen" variants={cardVariants}>
          <motion.div className="today__hero-head" variants={variants}>
            <span className="today__hero-eyebrow">🎧 Słuchaj</span>
          </motion.div>
          <motion.p className="today__hero-name" variants={variants}>{listen.pack.name}</motion.p>
          <motion.p className="today__hero-detail" variants={variants}>
            {LEVEL_META.find(l => l.level === listen.pack.level)?.name ?? `Poziom ${listen.pack.level}`} ·{' '}
            ~{estimateMinutes(listen.pack.wordCount - listen.startIndex)} min
          </motion.p>
          <motion.div className="today__hero-actions" variants={variants}>
            <motion.button
              className="today__cta today__cta--listen"
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.015 }}
              onClick={() => pressCta(() => navigate(`/pakiet/${listen.pack.id}/start`))}
            >
              <span className="today__cta-icon" aria-hidden="true">🎧</span>
              <span className="today__cta-label">Słuchaj</span>
              <span className="today__cta-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </span>
            </motion.button>
          </motion.div>
        </motion.section>
      ) : (
        <motion.p className="today__path-empty" variants={variants}>Nic do słuchania na tym poziomie — sprawdź Trenuj albo zmień poziom.</motion.p>
      )}
    </>
  )

  return (
    <AppShell>
      <motion.div
        className="today"
        variants={staggerContainerWide}
        initial="hidden"
        animate="show"
      >
        <div className="today__context">
          <motion.header className="today__header" variants={variants}>
            {/* Page heading kept for the document outline / screen readers only —
                the bottom-nav tab already labels this screen "Dzisiaj", and the
                visible word crowded the level row on narrow phones. */}
            <h1 className="today__title-sr">Dzisiaj</h1>
            <div className="today__header-level">
              <LevelPill level={todayLevel} onPress={() => setLevelPickerOpen(true)} />
              {todayLevel != null && (
                <button
                  className="today__browse-level"
                  onClick={() => { homeSetLevel(todayLevel); navigate('/') }}
                >
                  Przeglądaj ten poziom
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              )}
            </div>
          </motion.header>

          <motion.div variants={variants}>
            {pulse == null ? (
              <div className="today__skeleton skeleton" style={{ height: 72 }} />
            ) : (
              <DailyTimeRing
                secondsStudied={pulse.secondsToday}
                goalSec={pulse.goalSec}
                onEditGoal={() => setGoalOpen(true)}
              />
            )}
          </motion.div>
        </div>

        <div className="today__action">
          {nothingLeft ? (
            <motion.div
              className="today__done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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
              <h2 className="today__done-title">Zrobione</h2>
              <p className="today__done-text">
                {reviewDone
                  ? `Na dziś wszystko. Jeszcze ${backlog} w kolejce powtórek wróci jutro.`
                  : goalMet
                    ? 'Cel osiągnięty i nic nie czeka na powtórkę. Jutro Progress pokaże Ci następne.'
                    : 'Nic nie czeka. Jutro Progress pokaże Ci następne.'}
              </p>
            </motion.div>
          ) : (
            <>
              {serving > 0 && (
                <motion.section
                  className={`today__hero today__hero--review today__hero--review-${urgency}`}
                  variants={variants}
                >
                  <div className="today__hero-head">
                    <span className="today__hero-eyebrow">
                      <span className={`today__hero-dot today__hero-dot--${urgency}`} aria-hidden="true" />
                      {urgency === 'urgent'
                        ? 'Sporo zaległych powtórek'
                        : urgency === 'building'
                          ? 'Powtórki się zbierają'
                          : 'Zanim zaczniesz coś nowego'}
                    </span>
                    <span className="today__hero-count">{shownServing} słów</span>
                  </div>
                  <p className="today__hero-name">Powtórka</p>
                  <p className="today__hero-detail">
                    {backlog > serving
                      ? `${serving} na dziś · jeszcze ${backlog - serving} w kolejce`
                      : 'Słowa, które zaczynają uciekać'}{' '}
                    · ~{estimateMinutes(serving)} min
                  </p>
                  <p className="today__hero-note">
                    Na dziś tylko najpilniejsze słowa, dobrane pod Twój cel — reszta poczeka.
                    <button
                      type="button"
                      className="today__hero-info"
                      onClick={() => setReviewInfoOpen(true)}
                      aria-label="Jak działają powtórki"
                    >
                      ⓘ
                    </button>
                  </p>
                  <div className="today__hero-actions">
                    <motion.button
                      className="today__cta today__cta--review"
                      whileTap={{ scale: 0.96 }}
                      whileHover={{ scale: 1.015 }}
                      onClick={() => pressCta(() => {
                        // Unlock audio inside the tap gesture so listening
                        // interludes on /powtorka can play on iOS.
                        unlockAudioGlobally()
                        navigate('/powtorka')
                      })}
                    >
                      Powtórz
                    </motion.button>
                  </div>
                </motion.section>
              )}

              {reviewDone && (
                <motion.div className="today__review-done" variants={variants}>
                  ✓ Powtórki na dziś zrobione
                  {backlog > 0 && ` · jeszcze ${backlog} w kolejce, wrócą jutro`}
                </motion.div>
              )}

              <motion.div variants={variants}>
                <ModeSlider
                  active={activeMode}
                  onChange={setActiveMode}
                  listenContent={listenContent}
                  trainContent={trainContent}
                  onInfoClick={() => setNextStepInfoOpen(true)}
                />
              </motion.div>
            </>
          )}

        </div>

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
      </motion.div>
    </AppShell>
  )
}
