import { AppShell } from '../components/layout/AppShell'
import { StatCard } from '../components/stats/StatCard'
import { ActivityChart } from '../components/stats/ActivityChart'
import { PackageProgressList } from '../components/stats/PackageProgressList'
import { useStats } from '../hooks/useStats'
import './StatsPage.css'

export function StatsPage() {
  const { streak, knownWords, sessionCount, masteredPacks, activity, loading } = useStats()

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
            <PackageProgressList />
          )}
        </section>
      </div>
    </AppShell>
  )
}
