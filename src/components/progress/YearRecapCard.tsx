import { useState } from 'react'
import { YearSummary, shareYear } from '../../services/yearCard'
import { showToast } from '../../services/toast'
import { plDays, plWords } from '../../utils/plural'
import './WeeklyRecapCard.css'

interface Props {
  year: YearSummary
}

/**
 * The year, offered as one image.
 *
 * Deliberately leaner on screen than the weekly card: everything worth reading
 * is in the image, and the point of this block is the button. Shares the weekly
 * card's stylesheet — same object, different span — rather than duplicating it.
 */
export function YearRecapCard({ year }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    setBusy(true)
    try {
      const result = await shareYear(year)
      if (result === 'downloaded') showToast('Obrazek zapisany.', { icon: '🖼' })
      if (result === 'failed') showToast('Nie udało się przygotować obrazka.', { icon: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  const hours = Math.round(year.minutes / 60)

  return (
    <div className="recap recap--year">
      <header className="recap__head">
        <h3 className="recap__title">Twój {year.year} z angielskim</h3>
        <span className="recap__range">cały rok</span>
      </header>

      <p className="recap__lead">
        <strong>{year.wordsPractised.toLocaleString('pl-PL')}</strong>{' '}
        {plWords(year.wordsPractised)} przez <strong>{hours}</strong>{' '}
        {hours === 1 ? 'godzinę' : 'godzin'}, w ciągu{' '}
        <strong>{year.activeDays}</strong> {plDays(year.activeDays)}.
      </p>

      <button className="recap__share" onClick={handleShare} disabled={busy}>
        {busy ? 'Przygotowuję…' : 'Pokaż swój rok'}
      </button>
    </div>
  )
}
