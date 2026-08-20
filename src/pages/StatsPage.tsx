import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { StatCard } from '../components/stats/StatCard'
import { ActivityChart } from '../components/stats/ActivityChart'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { LevelProgressBars } from '../components/home/LevelProgressBars'
import { CategoryProgressBars } from '../components/stats/CategoryProgressBars'
import { PersonalBestCard } from '../components/stats/PersonalBestCard'
import { ReadinessScoreBanner } from '../components/stats/ReadinessScoreBanner'
import { TimeOfDayChart } from '../components/stats/TimeOfDayChart'
import { useStats } from '../hooks/useStats'
import { useProgressData } from '../hooks/useProgressData'
import { useCountUp } from '../hooks/useCountUp'
import { getEffectivenessByTimeOfDay, TimeOfDayStats } from '../services/db'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './StatsPage.css'

const allPacks = packagesIndex as PackMeta[]

function levelLabel(level: number | 'MASTER'): string {
  return level === 'MASTER' ? 'MASTER' : `Level ${level}`
}

export function StatsPage() {
  const { streak, longestStreak, bestDayCount, knownWords, sessionCount, masteredPacks, totalWordsHeard, estimatedMinutes, activity, levelStats, paceTrend, loading, tick } = useStats()
  const snapshot = useProgressData()
  const animatedKnown = useCountUp(loading ? 0 : knownWords)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayStats[] | null | undefined>(undefined)

  useEffect(() => {
    getEffectivenessByTimeOfDay().then(setTimeOfDay)
  }, [tick])

  // Progress bar to next level — sourced from the same per-pack level totals as LevelProgressBars
  const levelPct = levelStats?.levelPct ?? 0
  const wordsToNext = levelStats?.nextLevelWords ?? null

  return (
    <AppShell>
      <div className="statspage">
        <div className="statspage__header">
          <h1 className="statspage__title">Postęp</h1>
          <p className="statspage__sub">Twoja nauka w liczbach</p>
        </div>

        <div className="statspage__readiness-wrap">
          <ReadinessScoreBanner />
        </div>

        {loading ? (
          <>
            <div className="statspage__skeleton skeleton" style={{ height: 148 }} />
            <div className="statspage__grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="statspage__skeleton skeleton" style={{ height: 104 }} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Hero card */}
            <div className="statspage__hero-wrap">
              <StatCard
                hero
                value={animatedKnown}
                label="słów poznanych"
              />
              {levelStats && (
                <div className="statspage__level-bar-wrap">
                  <div className="statspage__level-bar-track">
                    <div className="statspage__level-bar-fill" style={{ width: `${levelPct}%` }} />
                  </div>
                  <div className="statspage__level-meta">
                    <span className="statspage__level-pct">{levelPct}%</span>
                    {wordsToNext != null && levelStats.nextLevel ? (
                      <span className="statspage__level-hint">{wordsToNext} słów do {levelLabel(levelStats.nextLevel)}</span>
                    ) : (
                      <span className="statspage__level-hint">MASTER osiągnięty ★</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="statspage__personal-best-wrap">
              <PersonalBestCard bestDayCount={bestDayCount} longestStreak={longestStreak} />
            </div>

            {/* 2×2 core stats */}
            <div className="statspage__grid">
              <StatCard
                value={streak}
                label="dni z rzędu"
                icon="🔥"
                accentColor="var(--accent-orange)"
              />
              <StatCard
                value={masteredPacks}
                label="paczek opanowanych"
                icon="📦"
                accentColor="var(--accent-green)"
              />
              <StatCard
                value={paceTrend?.current ?? sessionCount}
                label={paceTrend ? 'słów/dzień' : 'sesji ukończono'}
                icon="⚡"
                accentColor="var(--accent-blue)"
                trend={paceTrend?.deltaPct != null ? { deltaPct: paceTrend.deltaPct } : undefined}
              />
              {levelStats?.nextLevel ? (
                <StatCard
                  value={levelStats.daysToNextLevel ?? '—'}
                  label={`dni do ${levelLabel(levelStats.nextLevel)}`}
                  icon="🎯"
                  accentColor="var(--accent)"
                />
              ) : (
                <StatCard
                  value="MASTER"
                  label="poziom słownictwa"
                  icon="🎯"
                  accentColor="var(--accent)"
                />
              )}
            </div>

            {/* 2 new stats */}
            <div className="statspage__grid statspage__grid--secondary">
              <StatCard
                small
                value={`~${estimatedMinutes}`}
                label="minut nauki"
                icon="⏱"
                unit="szacunkowo"
                accentColor="var(--accent-teal)"
              />
              <StatCard
                small
                value={totalWordsHeard}
                label="słów odsłuchanych"
                icon="👂"
                unit="łącznie"
                accentColor="var(--accent-indigo)"
              />
            </div>
          </>
        )}

        <section className="statspage__section">
          <h2 className="statspage__section-title">Poziomy słownictwa</h2>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 120 }} />
          ) : (
            <LevelProgressBars allPacks={allPacks} knownMap={snapshot.knownMap} />
          )}
        </section>

        <section className="statspage__section">
          <h2 className="statspage__section-title">Słowa wg kategorii</h2>
          {snapshot == null ? (
            <div className="statspage__skeleton skeleton" style={{ height: 200 }} />
          ) : (
            <CategoryProgressBars allPacks={allPacks} knownMap={snapshot.knownMap} />
          )}
        </section>

        <section className="statspage__section statspage__section--chart">
          <h2 className="statspage__section-title">Aktywność — ostatnie 7 dni</h2>
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 140 }} />
          ) : (
            <ActivityChart data={activity} />
          )}
        </section>

        {timeOfDay && timeOfDay.length > 0 && (
          <section className="statspage__section">
            <h2 className="statspage__section-title">Skuteczność wg pory dnia</h2>
            <TimeOfDayChart data={timeOfDay} />
          </section>
        )}

        <section className="statspage__section">
          <h2 className="statspage__section-title">Postęp paczek</h2>
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 80 }} />
          ) : (
            <PackageProgressList key={tick} />
          )}
        </section>
      </div>
    </AppShell>
  )
}
