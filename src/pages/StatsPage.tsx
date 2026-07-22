import { AppShell } from '../components/layout/AppShell'
import { StatCard } from '../components/stats/StatCard'
import { ActivityChart } from '../components/stats/ActivityChart'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { LevelProgressBars } from '../components/home/LevelProgressBars'
import { useStats } from '../hooks/useStats'
import { useProgressData } from '../hooks/useProgressData'
import { useCountUp } from '../hooks/useCountUp'
import { LEVEL_THRESHOLDS } from '../data/levels'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './StatsPage.css'

const allPacks = packagesIndex as PackMeta[]

export function StatsPage() {
  const { streak, knownWords, sessionCount, masteredPacks, totalWordsHeard, estimatedMinutes, activity, levelStats, loading, tick } = useStats()
  const snapshot = useProgressData()
  const animatedKnown = useCountUp(loading ? 0 : knownWords)

  // Compute progress bar to next level
  let levelPct = 0
  let wordsToNext: number | null = null
  if (levelStats) {
    const prevThreshold = LEVEL_THRESHOLDS.slice().reverse().find(t => t.words <= knownWords)
    const prevWords = prevThreshold?.words ?? 0
    const nextWords = levelStats.nextLevelWords ?? 10000
    const range = nextWords - prevWords
    levelPct = range > 0 ? Math.min(100, Math.round(((knownWords - prevWords) / range) * 100)) : 100
    wordsToNext = levelStats.nextLevelWords ? Math.max(0, levelStats.nextLevelWords - knownWords) : null
  }

  return (
    <AppShell>
      <div className="statspage">
        <div className="statspage__header">
          <h1 className="statspage__title">Postęp</h1>
          <p className="statspage__sub">Twoja nauka w liczbach</p>
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
                      <span className="statspage__level-hint">{wordsToNext} słów do Level {levelStats.nextLevel}</span>
                    ) : (
                      <span className="statspage__level-hint">Maks. poziom osiągnięty ★</span>
                    )}
                  </div>
                </div>
              )}
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
                value={sessionCount}
                label="sesji ukończono"
                icon="⚡"
                accentColor="var(--accent-blue)"
              />
              {levelStats?.nextLevel ? (
                <StatCard
                  value={levelStats.daysToNextLevel ?? '—'}
                  label={`dni do Level ${levelStats.nextLevel}`}
                  icon="🎯"
                  accentColor="var(--accent)"
                />
              ) : (
                <StatCard
                  value="MAX"
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
          <h2 className="statspage__section-title">Aktywność — ostatnie 7 dni</h2>
          {loading ? (
            <div className="statspage__skeleton skeleton" style={{ height: 140 }} />
          ) : (
            <ActivityChart data={activity} />
          )}
        </section>

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
