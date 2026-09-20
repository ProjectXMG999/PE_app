import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
    return `${servingLeft} ${plWords(servingLeft)} w dzisiejszej porcji powtórek — najszybszy sposób, żeby nic nie uciekło.`
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
  return `Przy tym tempie jesteś ${days} ${plDays(days)} od ${target}.`
}

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

        {/* --overlay-host: the panel can go full screen, and the scroll-settle
            animation on a plain section would trap that `position: fixed`
            inside it — see StatsPage.css. */}
        {snapshot != null && (
          <section className="statspage__section statspage__section--overlay-host">
            <h2 className="statspage__section-title">Konstelacja pamięci</h2>
            <Suspense
              fallback={<div className="statspage__skeleton skeleton" style={{ height: 460 }} />}
            >
              <Constellation packs={allPacks} wordProgress={snapshot.wordProgress} />
            </Suspense>
          </section>
        )}

        <section className="statspage__section" id="powtorki">
          <h2 className="statspage__section-title">Powtórki</h2>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 760 }} />
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
          <dl className="statspage__facts">
            <div className="statspage__fact statspage__fact--listen">
              <dt>🎧 Odsłuchane</dt>
              <dd>{totalWordsHeard.toLocaleString('pl-PL')}<span>{plWords(totalWordsHeard)}</span></dd>
            </div>
            <div className="statspage__fact">
              <dt>Czas nauki</dt>
              <dd>{studyMinutes.toLocaleString('pl-PL')}<span>min</span></dd>
            </div>
            <div className="statspage__fact statspage__fact--train">
              <dt>⚡ Opanowane</dt>
              <dd>{masteredPacks}<span>{plPacks(masteredPacks)}</span></dd>
            </div>
            <div className="statspage__fact">
              <dt>Na bieżąco</dt>
              <dd>{freshnessPct}<span>%</span></dd>
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
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 80 }} />
          ) : (
            <PackageProgressList limit={5} refreshKey={tick} />
          )}
        </section>
      </div>
    </AppShell>
  )
}
