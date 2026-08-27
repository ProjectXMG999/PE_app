import { useState } from 'react'
import { WeeklyRecap, shareRecap } from '../../services/weeklyRecap'
import { showToast } from '../../services/toast'
import './WeeklyRecapCard.css'

interface Props {
  recap: WeeklyRecap
}

const MAX_BADGES_LISTED = 3

export function WeeklyRecapCard({ recap }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    setBusy(true)
    try {
      const result = await shareRecap(recap)
      if (result === 'downloaded') showToast('Obrazek zapisany.', { icon: '🖼' })
      if (result === 'failed') showToast('Nie udało się przygotować obrazka.', { icon: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="recap">
      <header className="recap__head">
        <h3 className="recap__title">Twój tydzień</h3>
        <span className="recap__range">ostatnie 7 dni</span>
      </header>

      <p className="recap__lead">
        <strong>{recap.wordsPractised.toLocaleString('pl-PL')}</strong> słów przerobionych
        przez <strong>{recap.minutes}</strong> minut.
      </p>

      <dl className="recap__grid">
        <div className="recap__stat">
          <dt>Dni z treningiem</dt>
          <dd>{recap.activeDays}<span>/7</span></dd>
        </div>
        <div className="recap__stat">
          <dt>Cel osiągnięty</dt>
          <dd>{recap.goalDays}<span>razy</span></dd>
        </div>
        <div className="recap__stat">
          <dt>Sesji</dt>
          <dd>{recap.sessions}</dd>
        </div>
        <div className="recap__stat">
          <dt>Najlepszy dzień</dt>
          <dd>{recap.bestDay?.count ?? 0}<span>słów</span></dd>
        </div>
      </dl>

      {recap.newBadges.length > 0 && (
        <p className="recap__badges">
          <span aria-hidden="true">🏅</span> Nowe odznaki:{' '}
          {recap.newBadges.slice(0, MAX_BADGES_LISTED).map(b => b.achievement.title).join(', ')}
          {/* A first week — or an imported history — can unlock dozens at once,
              and a paragraph of 27 names stops being a summary. */}
          {recap.newBadges.length > MAX_BADGES_LISTED &&
            ` i ${recap.newBadges.length - MAX_BADGES_LISTED} więcej`}
        </p>
      )}

      {recap.nextStationName && recap.toNextStation != null && (
        <p className="recap__next">
          Jeszcze <strong>{recap.toNextStation.toLocaleString('pl-PL')}</strong> słów
          do {recap.nextStationName}.
        </p>
      )}

      <button className="recap__share" onClick={handleShare} disabled={busy}>
        {busy ? 'Przygotowuję…' : 'Zapisz obrazek'}
      </button>
    </div>
  )
}
