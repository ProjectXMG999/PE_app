import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { CompassHero } from '../components/progress/CompassHero'
import { RouteMap } from '../components/progress/RouteMap'
import { PaceSimulator } from '../components/progress/PaceSimulator'
import { AchievementGrid } from '../components/progress/AchievementGrid'
import { ActivityHeatmap } from '../components/progress/ActivityHeatmap'
import { ReadinessBreakdown } from '../components/progress/ReadinessBreakdown'
import { RetentionBars } from '../components/progress/RetentionBars'
import { WeeklyRecapCard } from '../components/progress/WeeklyRecapCard'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { LevelProgressBars } from '../components/home/LevelProgressBars'
import { CategoryProgressBars } from '../components/stats/CategoryProgressBars'
import { TimeOfDayChart } from '../components/stats/TimeOfDayChart'
import { useStats, measuredStudyMinutes } from '../hooks/useStats'
import { useProgressData } from '../hooks/useProgressData'
import { useAchievements } from '../hooks/useAchievements'
import { useReadinessScore } from '../hooks/useReadinessScore'
import { useAppStore } from '../store/useAppStore'
import { getAllDailyTime, getEffectivenessByTimeOfDay, TimeOfDayStats } from '../services/db'
import { computeWeeklyRecap, recapWorthShowing } from '../services/weeklyRecap'
import { DailyTime } from '../types/progress'
import { LEVEL_META, stationForThreshold } from '../data/levels'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './StatsPage.css'

const allPacks = packagesIndex as PackMeta[]

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
    return `${servingLeft} ${servingLeft === 1 ? 'słowo w dzisiejszej porcji' : 'słów w dzisiejszej porcji'} powtórek — najszybszy sposób, żeby nic nie uciekło.`
  }
  if (levelStats?.nextLevel == null) {
    return `${knownWords.toLocaleString('pl-PL')} słów. Cała trasa za Tobą.`
  }
  const target = stationName(knownWords, levelStats.nextLevelWords)
  const days = levelStats.daysToNextLevel
  if (days == null || days <= 0) {
    return `Jeszcze ${levelStats.nextLevelWords?.toLocaleString('pl-PL')} słów do ${target}.`
  }
  return `Przy tym tempie jesteś ${days} ${days === 1 ? 'dzień' : 'dni'} od ${target}.`
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

  // Words learned per minute of study, the basis for the projection below.
  // Bulk-marked words ("oznacz wszystkie jako znam") are excluded — they add a
  // pack's worth of words in seconds against zero study minutes. The clamp is a
  // second guard: a sustained rate no learner beats over a whole history.
  const MAX_WORDS_PER_MINUTE = 5
  const studyKnownWords = Math.max(0, knownWords - (snapshot?.bulkKnownTotal ?? 0))
  const wordsPerMinute = studyMinutes > 0
    ? Math.min(studyKnownWords / studyMinutes, MAX_WORDS_PER_MINUTE)
    : 0

  const guidance = buildGuidance(sessionCount, knownWords, levelStats, servingLeft)

  const recap = useMemo(() => {
    if (snapshot == null || achievements == null) return null
    const next = levelStats?.nextLevel != null && levelStats.nextLevelWords != null
      ? { words: levelStats.nextLevelWords, name: stationName(knownWords, levelStats.nextLevelWords) }
      : null
    const r = computeWeeklyRecap(snapshot, dailyTime, achievements.states, next)
    return recapWorthShowing(r) ? r : null
  }, [snapshot, achievements, dailyTime, levelStats, knownWords])

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

        {!loading && (snapshot?.bulkKnownTotal ?? 0) > 0 && (
          <p className="statspage__note">
            {snapshot!.bulkKnownTotal === 1
              ? 'Jedno słowo oznaczyłeś'
              : `${snapshot!.bulkKnownTotal.toLocaleString('pl-PL')} słów oznaczyłeś`}{' '}
            jako znane bez nauki w aplikacji — liczą się do „słów poznanych", ale nie do tempa.
          </p>
        )}

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
            <AchievementGrid states={achievements.states} onSeen={markUnlocksSeen} />
          )}
        </section>

        {recap && (
          <section className="statspage__section">
            <WeeklyRecapCard recap={recap} />
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
              <dd>{totalWordsHeard.toLocaleString('pl-PL')}<span>słów</span></dd>
            </div>
            <div className="statspage__fact">
              <dt>Czas nauki</dt>
              <dd>{studyMinutes.toLocaleString('pl-PL')}<span>min</span></dd>
            </div>
            <div className="statspage__fact statspage__fact--train">
              <dt>⚡ Opanowane</dt>
              <dd>{masteredPacks}<span>paczek</span></dd>
            </div>
            <div className="statspage__fact">
              <dt>Na bieżąco</dt>
              <dd>{freshnessPct}<span>%</span></dd>
            </div>
          </dl>
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Poziom zapamiętania</h2>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 280 }} />
          ) : (
            <RetentionBars wordProgress={snapshot.wordProgress} />
          )}
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Terytoria — poziomy</h2>
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
            <PackageProgressList key={tick} limit={5} />
          )}
        </section>
      </div>
    </AppShell>
  )
}
