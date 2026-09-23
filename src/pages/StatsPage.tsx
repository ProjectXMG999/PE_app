import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { CompassHero } from '../components/progress/CompassHero'
import { RouteMap } from '../components/progress/RouteMap'
import { PaceSimulator } from '../components/progress/PaceSimulator'
import { AchievementGrid } from '../components/progress/AchievementGrid'
import { ActivityHeatmap } from '../components/progress/ActivityHeatmap'
import { ReadinessBreakdown } from '../components/progress/ReadinessBreakdown'
import { RetentionBars } from '../components/progress/RetentionBars'
import { ReviewQueueSummary } from '../components/progress/ReviewQueueSummary'
import { WeeklyRecapCard } from '../components/progress/WeeklyRecapCard'
import { YearRecapCard } from '../components/progress/YearRecapCard'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { LevelProgressBars } from '../components/home/LevelProgressBars'
import { CategoryProgressBars } from '../components/stats/CategoryProgressBars'
import { TimeOfDayChart } from '../components/stats/TimeOfDayChart'
import { FlowNumber } from '../components/shared/FlowNumber'
import { useStats, measuredStudyMinutes } from '../hooks/useStats'
import { studyWordsPerMinute } from '../utils/pace'
import { useProgressData } from '../hooks/useProgressData'
import { useAchievements } from '../hooks/useAchievements'
import { useReadinessScore } from '../hooks/useReadinessScore'
import { useAppStore } from '../store/useAppStore'
import { getAllDailyTime, getEffectivenessByTimeOfDay, TimeOfDayStats } from '../services/db'
import { computeWeeklyRecap, recapWorthShowing } from '../services/weeklyRecap'
import { computeYearSummary, yearWorthShowing } from '../services/yearCard'
import { DailyTime } from '../types/progress'
import { LEVEL_META, ROUTE_TOTAL, stationForThreshold } from '../data/levels'
import { plWords, plDays, plPacks } from '../utils/plural'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './StatsPage.css'

const allPacks = packagesIndex as PackMeta[]

/** Split out for the same reason MeshField is: it carries the WebGL runtime,
 *  and nobody should download that just to read their streak. */
const Constellation = lazy(() => import('../components/progress/Constellation/Constellation'))

/** Words available across all 864 packs. Larger than ROUTE_TOTAL — the route is
 *  a goal, the corpus is the supply. */
const corpusWords = allPacks.reduce((sum, p) => sum + p.wordCount, 0)

/**
 * Name of the station the user is heading for.
 *
 * Resolved from the threshold rather than the tier number: `nextLevelFromTotal-
 * Known` returns the tier you *become* (level 3 once past 3 000 words), whereas
 * LEVEL_META numbers the stations themselves (level 2 = Everyday at 3 000).
 * Matching on the number showed someone at 1 221 words that they were heading
 * for Freedom English, two stations too far.
 */
function stationName(knownWords: number, wordsToNext: number | null): string {
  if (wordsToNext == null) return 'końca trasy'
  return stationForThreshold(knownWords + wordsToNext)?.name ?? 'następnego etapu'
}

/**
 * The single sentence under the compass. Deliberately phrased as navigation —
 * what this means for what's next — rather than as another statistic.
 */
function buildGuidance(
  sessionCount: number,
  knownWords: number,
  levelStats: ReturnType<typeof useStats>['levelStats'],
  servingLeft: number
): string {
  if (sessionCount === 0) {
    return 'Trasa czeka. Pierwszy trening to około 10 minut.'
  }
  if (servingLeft > 0) {
    // Polish, not English word order. "N słów w dzisiejszej porcji powtórek —
    // najszybszy sposób, żeby…" is the English apposition ("X — the fastest way
    // to Y") wearing Polish words: it opens on a bare noun phrase and hangs the
    // point off a dash. A sentence with a verb, and the reason in the second
    // clause, is how this is actually said.
    return `Powtórz dziś ${servingLeft} ${plWords(servingLeft)}, a nic Ci nie ucieknie.`
  }
  if (levelStats?.nextLevel == null) {
    return `${knownWords.toLocaleString('pl-PL')} ${plWords(knownWords)}. Cała trasa za Tobą.`
  }
  const target = stationName(knownWords, levelStats.nextLevelWords)
  const days = levelStats.daysToNextLevel
  if (days == null || days <= 0) {
    const left = levelStats.nextLevelWords ?? 0
    return `Jeszcze ${left.toLocaleString('pl-PL')} ${plWords(left)} do ${target}.`
  }
  // Same fault, one branch down: "jesteś 91 dni od Everyday English" is
  // "you are N days from X" with Polish words on it. Polish puts the distance
  // where it belongs — what's left, and to what.
  return `Przy tym tempie do ${target} zostało Ci ${days} ${plDays(days)}.`
}

/**
 * Holds the rest of the page back for one beat, so the hero can animate.
 *
 * Postęp mounts a lot at once — the constellation's WebGL over every known
 * word, the retention bars over the same rows, the route map, the achievement
 * grid, the heatmap. Traced on a phone-class CPU with ~2 400 known words, that
 * arrived as 2.4 seconds of blocked frames in the first 2.7 — including single
 * frames of 225 ms and 425 ms — and the hero's figures roll straight through
 * it. NumberFlow animates on the main thread like everything else, so a blocked
 * frame isn't a slow roll, it's a stopped one: exactly the "crunch" you see.
 *
 * None of that work is visible yet. The hero is the only thing on the first
 * screenful, so the rest waits for its sweep to finish — or for the first sign
 * that the learner is heading down the page, whichever comes first. Scrolling,
 * a deep link (/postęp#powtorki) and reduced motion all open it immediately;
 * nobody waits for content they asked for.
 */
function useBelowHeroReady(immediate: boolean): boolean {
  const reduced = useReducedMotion()
  const [ready, setReady] = useState(() => immediate || !!reduced)

  useEffect(() => {
    if (ready) return
    const open = () => setReady(true)
    const timer = window.setTimeout(open, HERO_BEAT_MS)
    const opts = { passive: true, once: true, capture: true } as const
    // Capture on window: the app scrolls inside AppShell's own container, and
    // scroll events don't bubble — they do reach window on the way down.
    window.addEventListener('scroll', open, opts)
    window.addEventListener('wheel', open, opts)
    window.addEventListener('touchstart', open, opts)
    window.addEventListener('keydown', open, opts)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', open, true)
      window.removeEventListener('wheel', open, true)
      window.removeEventListener('touchstart', open, true)
      window.removeEventListener('keydown', open, true)
    }
  }, [ready])

  return ready
}

/** The hero's sweep is 900 ms (SWEEP_MS in CompassHero), and its last figure
 *  starts rolling at 260 ms. A beat past that, and the page fills itself in. */
const HERO_BEAT_MS = 1100

export function StatsPage() {
  const {
    streak, knownWords, sessionCount, masteredPacks, totalWordsHeard,
    servingLeft, freshnessPct, activity, levelStats, paceTrend,
    loading, tick,
  } = useStats()
  const snapshot = useProgressData()
  const achievements = useAchievements()
  const readiness = useReadinessScore()
  const markUnlocksSeen = useAppStore(s => s.markUnlocksSeen)
  const achievementUnlocks = useAppStore(s => s.achievementUnlocks)
  const frozenDays = useAppStore(s => s.streakFreeze.usedOn)
  const { hash } = useLocation()
  // A deep link is a request for something further down — open the page at once.
  const belowReady = useBelowHeroReady(hash !== '')

  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayStats[] | null | undefined>(undefined)

  useEffect(() => {
    getEffectivenessByTimeOfDay().then(setTimeOfDay)
  }, [tick])

  // Level badges share the route's thresholds exactly, so their unlock stamps
  // double as the date each station was reached — no separate bookkeeping, and
  // no drifting estimate derived from lastSeen (which reviews keep moving).
  const reachedAt = useMemo(() => {
    const out: Record<number, string | undefined> = {}
    for (const l of LEVEL_META) out[l.level] = achievementUnlocks[`level-${l.level}`]?.at
    return out
  }, [achievementUnlocks])

  // The daily-time ledger — measured study seconds per day. Not part of the
  // progress snapshot, so it's loaded alongside; feeds both the weekly recap
  // and the "Czas nauki" figure.
  const [dailyTime, setDailyTime] = useState<DailyTime[]>([])
  useEffect(() => {
    getAllDailyTime().then(setDailyTime)
  }, [tick])

  const studyMinutes = useMemo(
    () => measuredStudyMinutes(dailyTime, snapshot?.sessions ?? []),
    [dailyTime, snapshot]
  )

  // Words learned per minute of study, the basis for the projection below —
  // the same model the daily-goal picker on Dzisiaj projects with.
  const wordsPerMinute = studyWordsPerMinute(knownWords, snapshot?.declaredKnownTotal ?? 0, studyMinutes)

  // Arriving from Dzisiaj's review element (/postęp#powtorki): the page renders
  // its sections as data lands, so wait for the snapshot, then bring the
  // section into view.
  const hasSnapshot = snapshot != null
  useEffect(() => {
    if (hash !== '#powtorki' || !hasSnapshot) return
    const id = requestAnimationFrame(() =>
      document.getElementById('powtorki')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
    return () => cancelAnimationFrame(id)
  }, [hash, hasSnapshot])

  const guidance = buildGuidance(sessionCount, knownWords, levelStats, servingLeft)

  const recap = useMemo(() => {
    if (snapshot == null || achievements == null) return null
    const next = levelStats?.nextLevel != null && levelStats.nextLevelWords != null
      ? { words: levelStats.nextLevelWords, name: stationName(knownWords, levelStats.nextLevelWords) }
      : null
    const r = computeWeeklyRecap(snapshot, dailyTime, achievements.states, next)
    return recapWorthShowing(r) ? r : null
  }, [snapshot, achievements, dailyTime, levelStats, knownWords])

  // Only once there is a year's worth of something to show — see
  // YEAR_CARD_MIN_DAYS. A "year in review" built from four days of use is
  // embarrassing for whoever shares it.
  const yearSummary = useMemo(() => {
    if (snapshot == null) return null
    const next = levelStats?.nextLevel != null && levelStats.nextLevelWords != null
      ? { words: levelStats.nextLevelWords, name: stationName(knownWords, levelStats.nextLevelWords) }
      : null
    const y = computeYearSummary(snapshot, dailyTime, next)
    return yearWorthShowing(y) ? y : null
  }, [snapshot, dailyTime, levelStats, knownWords])

  return (
    <AppShell>
      <div className="statspage">
        <header className="statspage__header">
          <h1 className="statspage__title">Postęp</h1>
          <p className="statspage__sub">Gdzie jesteś na trasie do 10 000 słów</p>
        </header>

        {/* Waits for the POINTS too, not just for `loading`.
            The panel's figures roll once, from zero, on a clock they start on
            mount — so a reading that lands afterwards doesn't join the
            choreography, it interrupts it: the achievements pass over every
            known word used to fall in the middle of the roll, and the roll is
            on the main thread like everything else. One instrument, coming up
            once, with all four readings in hand. */}
        {loading ? (
          <div className="statspage__skeleton skeleton" style={{ height: 320 }} />
        ) : (
          <CompassHero
            knownWords={knownWords}
            streak={streak}
            points={achievements?.points.total ?? 0}
            pace={paceTrend}
            guidance={guidance}
            loading={loading}
          />
        )}

        {!loading && (snapshot?.declaredKnownTotal ?? 0) > 0 && (
          <p className="statspage__note">
            {snapshot!.declaredKnownTotal === 1
              ? 'Jedno słowo oznaczyłeś'
              : `${snapshot!.declaredKnownTotal.toLocaleString('pl-PL')} ${plWords(snapshot!.declaredKnownTotal)} oznaczyłeś`}{' '}
            jako znane bez nauki w aplikacji — {snapshot!.declaredKnownTotal === 1 ? 'liczy' : 'liczą'} się
            do „słów poznanych", ale nie do tempa ani do punktów/odznak.
          </p>
        )}

        {!belowReady ? (
          /* Not a loading state — the data is here. It is the hero's beat, and
             this keeps the page's height honest while it passes. */
          <div className="statspage__skeleton skeleton" style={{ height: 460 }} aria-hidden="true" />
        ) : (
        <>
        {/* --overlay-host: the panel can go full screen, and the scroll-settle
            animation on a plain section would trap that `position: fixed`
            inside it — see StatsPage.css. */}
        {snapshot != null && (
          <section className="statspage__section statspage__section--overlay-host">
            <h2 className="statspage__section-title">Konstelacja pamięci</h2>
            <Suspense
              fallback={<div className="statspage__skeleton skeleton skeleton--glass" style={{ height: 460 }} />}
            >
              <Constellation packs={allPacks} wordProgress={snapshot.wordProgress} />
            </Suspense>
          </section>
        )}

        <section className="statspage__section" id="powtorki">
          <h2 className="statspage__section-title">Powtórki</h2>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton skeleton--glass" style={{ height: 760 }} />
          ) : (
            <RetentionBars
              wordProgress={snapshot.wordProgress}
              queue={<ReviewQueueSummary snapshot={snapshot} />}
            />
          )}
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Trasa</h2>
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 360 }} />
          ) : (
            <RouteMap knownWords={knownWords} reachedAt={reachedAt} />
          )}
        </section>

        {!loading && wordsPerMinute > 0 && (
          <section className="statspage__section">
            <h2 className="statspage__section-title">Co gdybyś dał więcej czasu</h2>
            <PaceSimulator
              knownWords={knownWords}
              wordsPerMinute={wordsPerMinute}
              currentWordsPerDay={paceTrend?.current ?? 0}
            />
          </section>
        )}

        <section className="statspage__section">
          {achievements == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 260 }} />
          ) : (
            <AchievementGrid
              states={achievements.states}
              onSeen={markUnlocksSeen}
              knownTotal={knownWords}
              nextStation={
                levelStats?.nextLevel != null && levelStats.nextLevelWords != null
                  ? { words: levelStats.nextLevelWords, name: stationName(knownWords, levelStats.nextLevelWords) }
                  : null
              }
            />
          )}
        </section>

        {recap && (
          <section className="statspage__section">
            <WeeklyRecapCard recap={recap} />
          </section>
        )}

        {yearSummary && (
          <section className="statspage__section">
            <YearRecapCard year={yearSummary} />
          </section>
        )}

        <section className="statspage__section">
          <h2 className="statspage__section-title">Rytm — ostatnie 4 tygodnie</h2>
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 200 }} />
          ) : (
            <ActivityHeatmap data={activity} frozenDays={frozenDays} />
          )}
        </section>

        {readiness != null && readiness !== undefined && (
          <section className="statspage__section">
            <ReadinessBreakdown result={readiness} />
          </section>
        )}

        {timeOfDay && timeOfDay.length > 0 && (
          <section className="statspage__section">
            <h2 className="statspage__section-title">
              Twoja najlepsza pora: {timeOfDay[0].band}
            </h2>
            <TimeOfDayChart data={timeOfDay} />
          </section>
        )}

        {/* Numbers that don't belong on the route itself, but are worth having. */}
        <section className="statspage__section">
          <h2 className="statspage__section-title">W liczbach</h2>
          {/* Each figure rolls when its tile scrolls into view, a beat after
              the one before it — the four read as a row counting itself up
              rather than as four numbers switching on together. `onView` is
              what makes them animate at all this far down: without it they'd
              have finished while the page was still at the top. */}
          <dl className="statspage__facts">
            <div className="statspage__fact statspage__fact--listen">
              <dt>🎧 Odsłuchane</dt>
              <dd><FlowNumber value={totalWordsHeard} onView delayMs={0} /><span>{plWords(totalWordsHeard)}</span></dd>
            </div>
            <div className="statspage__fact">
              <dt>Czas nauki</dt>
              <dd><FlowNumber value={studyMinutes} onView delayMs={70} /><span>min</span></dd>
            </div>
            <div className="statspage__fact statspage__fact--train">
              <dt>⚡ Opanowane</dt>
              <dd><FlowNumber value={masteredPacks} onView delayMs={140} /><span>{plPacks(masteredPacks)}</span></dd>
            </div>
            <div className="statspage__fact">
              <dt>Na bieżąco</dt>
              <dd><FlowNumber value={freshnessPct} onView delayMs={210} /><span>%</span></dd>
            </div>
          </dl>
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Terytoria — poziomy</h2>
          {/* Without this line the two halves of the page contradict each other:
              the route counts to 10 000, while these bars add up to the size of
              the actual corpus, which is larger. Both numbers are true; only
              the relationship between them was missing. */}
          <p className="statspage__note statspage__note--tight">
            Trasa mierzy do {ROUTE_TOTAL.toLocaleString('pl-PL')} {plWords(ROUTE_TOTAL)} —
            to cel. W paczkach czeka ich {corpusWords.toLocaleString('pl-PL')}, więc po
            drodze jest z czego wybierać.
          </p>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 120 }} />
          ) : (
            <LevelProgressBars allPacks={allPacks} knownMap={snapshot.knownMap} />
          )}
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Terytoria — kategorie</h2>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 200 }} />
          ) : (
            <CategoryProgressBars allPacks={allPacks} knownMap={snapshot.knownMap} />
          )}
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Ostatnio odwiedzone</h2>
          {/* `tick || undefined` below, not `tick`. useProgressData treats ANY
              defined refreshKey as "force a fresh read", and `tick` starts at
              0 — which is defined. So this list forced a second full
              fetchSnapshot (six getAll()s, ~11 000 rows, four passes) on every
              visit, and reset the dedupe window while it was at it, so the next
              page paid for a cold read too. HomePage:120 already spells the
              idiom out for the same reason. */}
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 80 }} />
          ) : (
            <PackageProgressList limit={5} refreshKey={tick || undefined} />
          )}
        </section>
        </>
        )}
      </div>
    </AppShell>
  )
}
