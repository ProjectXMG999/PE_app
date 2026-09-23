import { useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { SessionHero } from '../components/today/SessionHero'
import { DailyGoalPicker } from '../components/today/DailyGoalPicker'
import { LevelPill } from '../components/today/LevelPill'
import { LevelPicker } from '../components/today/LevelPicker'
import { TodayGuideButton } from '../components/today/TodayGuideSheet'
import { PathStrip, StripBand, StripTick } from '../components/today/PathStrip'
import { ModeSlider, StudyPath } from '../components/today/ModeSlider'
import { LevelUpPrompt } from '../components/today/LevelUpPrompt'
import { useProgressData, avgWordsPerDayTrend, packLevelOf } from '../hooks/useProgressData'
import { useProgressPulse } from '../hooks/useProgressPulse'
import { FlowNumber } from '../components/shared/FlowNumber'
import { useHaptics } from '../hooks/useHaptics'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { playTick, playSuccess, warmCurtainSound } from '../services/sfx'
import { nextListenPack, nextTrainPack, listenedPacksCount, estimateMinutes, packLevelThresholds } from '../data/nextPack'
import { shouldPromptLevelUp } from '../services/comfort'
import { reviewMinutes } from '../services/reviewQueue'
import { LEVEL_COLORS, LEVEL_META, ROUTE_TOTAL } from '../data/levels'
import { BoltGlyph, CheckGlyph, ChevronRightGlyph, HeadphonesGlyph, RepeatGlyph } from '../components/mode/glyphs'
import { plWords } from '../utils/plural'
import { frontierPack } from '../utils/packRoute'
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

/** "środa, 17 września" — the line above the large title.
 *
 *  The formatter is built once for the module rather than per call:
 *  `toLocaleDateString` constructs a fresh Intl.DateTimeFormat every time, and
 *  this is called from the render body of a component that re-renders on every
 *  frame of a count-up. The Date is still read per call, so the label is still
 *  right after midnight. */
const dayFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long', day: 'numeric', month: 'long',
})
const todayLabel = () => dayFormatter.format(new Date())

/**
 * Dzisiaj — the coaching screen, laid out to fit a phone without scrolling:
 * a large title, the session hero with the daily goal ring, the review row,
 * and one recommendation per path behind a segmented control. The library
 * (Pakiety) is a different screen.
 *
 * ── The entrance is CSS, and it is one movement ────────────────────────────
 * Every block here used to be a Framer `motion` element in a staggered
 * container: ten of them, each rising 12 px on its own 60 ms offset, each one
 * a glass surface re-convolving a 28 px backdrop blur while it moved, and all
 * of it driven from the main thread. Opening this tab on a phone-class CPU
 * blocks that thread for 107–250 ms mounting the route, which is exactly when
 * the cascade was mid-flight — so it stalled and then jumped. It is now
 * `.pe-arrive` on the page root (animations.css): one plane, on the
 * compositor, starting only once the page has actually painted.
 *
 * The motion that is left is motion you ask for — the mode slider's
 * indicator, the level sheet, the goal ring. Nothing animates merely because
 * the screen opened.
 */
export function TodayPage() {
  const navigate = useAppNavigate()
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

  // Memoised because this page re-renders on every mode toggle, progress pulse
  // and goal-sheet open, and unmemoised each of those re-filtered all 834 packs
  // and re-scanned them twice more for the two next-pack picks. (It used to be
  // far worse: the serving counter held its interpolation in this component's
  // state, so a single count-up meant ~48 of these renders in 800 ms. That one
  // is now a NumberFlow, which animates without involving React at all.)
  // `allPacks` is a module constant, so level is the only input; `snapshot`
  // changes identity only per fetch.
  const scopedPacks = useMemo(
    () => (todayLevel == null ? allPacks : allPacks.filter(p => p.level >= todayLevel)),
    [todayLevel]
  )
  // Słuchaj starts from where the learner actually is, not from the top of the
  // catalogue. Since the listen axis stopped counting declared and trained
  // packs, "the earliest pack you haven't heard" is pack #1 for nearly
  // everyone — a plain reading of the route that would send someone at 3 000
  // words back to the beginning. The frontier is the honest starting point.
  // The packs behind it used to be summed into a line under the strip ("z tyłu
  // do przesłuchania: 109 paczek"); Dzisiaj is a screen about what to do next,
  // and a standing tally of what you skipped is not that. The Mapa still shows
  // them, which is where someone actually goes to pick one up.
  const frontier = useMemo(() => frontierPack(scopedPacks, snapshot), [scopedPacks, snapshot])
  const listenPacks = useMemo(() => {
    if (!frontier) return scopedPacks
    const from = scopedPacks.findIndex(p => p.id === frontier.id)
    return from <= 0 ? scopedPacks : scopedPacks.slice(from)
  }, [scopedPacks, frontier])
  const listen = useMemo(() => nextListenPack(listenPacks, snapshot), [listenPacks, snapshot])
  const train = useMemo(() => nextTrainPack(scopedPacks, snapshot), [scopedPacks, snapshot])

  const [activeMode, setActiveMode] = useState<StudyPath>(() => (train ? 'train' : 'listen'))

  const backlog = pulse?.dueCount ?? 0
  const serving = pulse?.servingLeft ?? 0
  const urgency = pulse?.reviewUrgency ?? 'calm'
  const reviewDone = backlog > 0 && serving === 0
  // The learner's own measured seconds-per-card, so the two "ok. N min" below
  // describe their pace rather than an assumed one.
  const reviewSec = pulse?.reviewSecPerCard
  // Three full passes over the session history — not something to redo on every
  // frame of a count-up.
  const pace = useMemo(() => (snapshot ? avgWordsPerDayTrend(snapshot) : null), [snapshot])
  const showPace = pace?.deltaPct != null && pace.deltaPct > 0

  const nothingLeft = listen == null && train == null && serving === 0
  const goalMet = pulse?.goalMet ?? false

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

  // A fourth full pass over the catalogue — same reasoning as scopedPacks above.
  const listenedCount = useMemo(
    () => (snapshot ? listenedPacksCount(allPacks, snapshot) : 0),
    [snapshot]
  )
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
    <button
      type="button"
      className="today__pick u-liquid"
      onClick={() => pressCta(() => navigate(`/pakiet/${train.pack.id}/fiszki-start`))}
    >
      {showPace && (
        <span className="today__pick-pace">+{pace!.deltaPct}% szybciej niż tydzień temu</span>
      )}
      <span className="today__pick-name">{train.pack.name}</span>
      <span className="today__pick-detail">
        {levelName(train.pack.level)} · ok. {estimateMinutes(train.pack.wordCount - train.known)} min
      </span>
      <span className="today__pick-cta">Zacznij trening</span>
    </button>
  ) : (
    <div className="today__path-empty u-liquid">
      <p>Na tym poziomie nie ma nic do trenowania. Zajrzyj do Słuchaj albo zmień poziom.</p>
    </div>
  )

  const listenPick = listen ? (
    <button
      type="button"
      className="today__pick u-liquid"
      onClick={() => pressCta(() => navigate(`/pakiet/${listen.pack.id}/start`))}
    >
      <span className="today__pick-name">{listen.pack.name}</span>
      <span className="today__pick-detail">
        {levelName(listen.pack.level)} · ok. {estimateMinutes(listen.pack.wordCount - listen.startIndex)} min
      </span>
      <span className="today__pick-cta">Zacznij słuchać</span>
    </button>
  ) : (
    <div className="today__path-empty u-liquid">
      <p>Na tym poziomie nie ma nic do słuchania. Zajrzyj do Trenuj albo zmień poziom.</p>
    </div>
  )

  const stripSlot = (strip: typeof trainStrip) => strip || <div className="today__strip-loading" />

  const trainContent = <>{stripSlot(trainStrip)}{trainPick}</>
  const listenContent = <>{stripSlot(listenStrip)}{listenPick}</>

  return (
    <AppShell>
      <div className="today pe-arrive">
        {/* Large title, the way an iOS tab opens: the date above, the screen's
            name below, the level and the one info button on the right. */}
        <header className="today__header">
          <div className="today__heading">
            <p className="today__date">{todayLabel()}</p>
            <h1 className="today__title">Dzisiaj</h1>
          </div>
          <div className="today__header-actions">
            <LevelPill level={todayLevel} onPress={() => setLevelPickerOpen(true)} />
            <TodayGuideButton className="today__info" />
          </div>
        </header>

        {nothingLeft ? (
          <section className="today__done u-liquid u-liquid--gold">
            {/* The one flourish the screen keeps — and CSS, like the rest:
                a spring here meant a motion component (and its projection
                node) mounted on the page's busiest frame. */}
            <span className="today__done-icon" aria-hidden="true">
              <CheckGlyph size={30} weight={2.4} />
            </span>
            <h2 className="today__done-title">Na dziś wszystko</h2>
            <p className="today__done-text">
              {reviewDone
                ? `Jeszcze ${backlog} ${plWords(backlog)} w kolejce powtórek wróci jutro.`
                : goalMet
                  ? 'Cel osiągnięty i nic nie czeka na powtórkę. Jutro pokażemy Ci, co dalej.'
                  : 'Nic nie czeka. Jutro pokażemy Ci, co dalej.'}
            </p>
          </section>
        ) : (
          <>
            <div className="today__group">
              {pulse == null ? (
                <div className="today__skeleton skeleton skeleton--glass" style={{ height: 196 }} />
              ) : (
                <SessionHero
                  snapshot={snapshot}
                  onStart={() => pressCta(() => { unlockAudioGlobally(); warmCurtainSound(); navigate('/inteligentny') })}
                  secondsStudied={pulse.secondsToday}
                  goalSec={pulse.goalSec}
                  onEditGoal={() => setGoalOpen(true)}
                />
              )}

              {backlog > 0 && (
                <div className={`today__reviews u-liquid today__reviews--${reviewDone ? 'done' : urgency}`}>
                  {/* The urgency breath — the whole card, not the icon. It has
                      to be an element of its own: .u-liquid has already spent
                      both pseudo-elements on the glass and its rim. */}
                  <span className="today__reviews-aura" aria-hidden="true" />

                  {/* Row 1 — the action: today's portion and how long it takes. */}
                  <button
                    type="button"
                    className="today__reviews-row"
                    onClick={() => pressCta(() => { unlockAudioGlobally(); warmCurtainSound(); navigate('/powtorka') })}
                  >
                    <span className="today__reviews-badge" aria-hidden="true">
                      {reviewDone ? <CheckGlyph size={18} weight={2.4} /> : <RepeatGlyph size={18} weight={2.2} />}
                    </span>
                    <span className="today__reviews-body">
                      <strong>{reviewDone ? 'Porcja na dziś zrobiona' : 'Powtórka na dziś'}</strong>
                      <span>
                        {reviewDone ? (
                          'Możesz powtórzyć więcej z kolejki'
                        ) : (
                          <>
                            <FlowNumber value={serving} /> {plWords(serving)} · ok.{' '}
                            {reviewMinutes(serving, reviewSec)} min
                          </>
                        )}
                      </span>
                    </span>
                    <span className="today__reviews-chevron" aria-hidden="true"><ChevronRightGlyph size={16} weight={2.2} /></span>
                  </button>

                  {/* Row 2 — the context: the whole queue, and where it sits. */}
                  <button
                    type="button"
                    className="today__reviews-row today__reviews-row--queue"
                    onClick={() => navigate('/postęp#powtorki')}
                  >
                    <span className="today__reviews-body">
                      <span>
                        Czeka łącznie
                        {!reviewDone && urgency !== 'calm' && (
                          <em> · {urgency === 'urgent' ? 'sporo zaległych' : 'rośnie'}</em>
                        )}
                      </span>
                      <strong>{backlog.toLocaleString('pl-PL')} {plWords(backlog)} · ok. {reviewMinutes(backlog, reviewSec)} min</strong>
                    </span>
                    <span className="today__reviews-link">
                      Statystyki <ChevronRightGlyph size={14} weight={2.2} />
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="today__group">
              <ModeSlider
                active={activeMode}
                onChange={setActiveMode}
                listenContent={listenContent}
                trainContent={trainContent}
              />
              {todayLevel != null && (
                <button
                  type="button"
                  className="today__browse-level"
                  onClick={() => { homeSetLevel(todayLevel); navigate('/pakiety') }}
                >
                  Wszystkie paczki poziomu {levelName(todayLevel)}
                  <ChevronRightGlyph size={14} weight={2.2} />
                </button>
              )}
            </div>
          </>
        )}

        {goalOpen && <DailyGoalPicker onClose={() => setGoalOpen(false)} />}
        {levelPickerOpen && (
          <LevelPicker
            current={todayLevel}
            /* Fires once the sheet has closed, and the sheet plays its own tap
               feedback — re-scoping the whole page on the tap itself is what
               made the marker stutter. See the note on `choose` in LevelPicker. */
            onSelect={setTodayLevel}
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
      </div>
    </AppShell>
  )
}
