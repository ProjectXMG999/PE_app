import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { StatCard } from '../components/stats/StatCard'
import { ActivityChart } from '../components/stats/ActivityChart'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { ResetProgressModal } from '../components/stats/ResetProgressModal'
import { useStats } from '../hooks/useStats'
import './StatsPage.css'

export function StatsPage() {
  const { streak, knownWords, sessionCount, masteredPacks, activity, levelStats, loading, reload, tick } = useStats()
  const [showReset, setShowReset] = useState(false)

  function handleReset() {
    setShowReset(false)
    reload()
  }

  return (
    <AppShell>
      <div className="statspage">
        <h1 className="statspage__title">Statystyki</h1>

        <div className="statspage__grid">
          <StatCard value={knownWords} label="Poznanych słów" />
          <StatCard value={streak} label="Dni z rzędu" icon="🔥" />
          <StatCard value={sessionCount} label="Sesji ukończono" />
          <StatCard value={masteredPacks} label="Paczek opanowanych" icon="★" />
        </div>

        {levelStats && (
          <div className="statspage__grid">
            <StatCard value={levelStats.avgWordsPerDay} label="Średnio dziennie" unit="słów/dzień" />
            {levelStats.nextLevel && levelStats.daysToNextLevel !== null && (
              <StatCard value={levelStats.daysToNextLevel} label={`Do poziomu ${levelStats.nextLevel}`} unit="dni przy tym tempie" />
            )}
          </div>
        )}

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
