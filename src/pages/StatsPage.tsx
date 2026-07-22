import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { StatCard } from '../components/stats/StatCard'
import { ActivityChart } from '../components/stats/ActivityChart'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { ResetProgressModal } from '../components/stats/ResetProgressModal'
import { useStats } from '../hooks/useStats'
import './StatsPage.css'

const LEVEL_THRESHOLDS = [
  { level: 1, words: 0 },
  { level: 2, words: 1000 },
  { level: 3, words: 3000 },
  { level: 4, words: 6000 },
  { level: 5, words: 10000 },
]

export function StatsPage() {
  const { streak, knownWords, sessionCount, masteredPacks, totalWordsHeard, estimatedMinutes, activity, levelStats, loading, reload, tick } = useStats()
  const [showReset, setShowReset] = useState(false)

  function handleReset() {
    setShowReset(false)
    reload()
  }

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

        {/* Hero card */}
        <div className="statspage__hero-wrap">
          <StatCard
            hero
            value={knownWords}
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
            accentColor="#f97316"
          />
          <StatCard
            value={masteredPacks}
            label="paczek opanowanych"
            icon="📦"
            accentColor="#22c55e"
          />
          <StatCard
            value={sessionCount}
            label="sesji ukończono"
            icon="⚡"
            accentColor="#3b82f6"
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
            accentColor="#14b8a6"
          />
          <StatCard
            small
            value={totalWordsHeard}
            label="słów odsłuchanych"
            icon="👂"
            unit="łącznie"
            accentColor="#6366f1"
          />
        </div>

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

        <div className="statspage__danger-zone">
          <button
            className="statspage__reset-btn"
            onClick={() => setShowReset(true)}
          >
            Resetuj progres…
          </button>
        </div>
      </div>

      {showReset && (
        <ResetProgressModal
          onClose={() => setShowReset(false)}
          onReset={handleReset}
        />
      )}
    </AppShell>
  )
}
