import { useEffect, useRef } from 'react'
import './MetricsInfoSheet.css'

interface Props {
  onClose: () => void
}

interface Metric {
  icon: string
  title: string
  lead: string
  detail: string
  accent: 'streak' | 'points' | 'pace'
}

/**
 * Plain-language explanations for the three gauges on the compass card.
 *
 * Deliberately not a spec dump of services/points.ts — a learner opening this
 * wants "why did my number move", not the exact weight table. Each explanation
 * stays to one concrete mechanic worth knowing, phrased as what to actually do.
 */
const METRICS: Metric[] = [
  {
    icon: '🔥',
    title: 'Seria',
    lead: 'Dni z rzędu, w których się uczyłeś — choćby jedną paczkę.',
    detail: 'Ominięcie jednego dnia nie musi jej zepsuć: raz na 14 dni dostajesz zamrożenie ❄, które automatycznie ratuje serię za Ciebie.',
    accent: 'streak',
  },
  {
    icon: '⬥',
    title: 'Punkty Progress',
    lead: 'Waluta wysiłku — rosną za każdą minutę nauki, nie tylko za nowe słowa.',
    detail: 'Najwięcej dają mówienie i aktywny trening, mniej szybkie słuchanie. Do tego bonus za opanowane słowa, ukończone paczki i regularność — liczy się nawet dzień, w którym nic „nie kliknęło".',
    accent: 'points',
  },
  {
    icon: '⚡',
    title: 'Tempo',
    lead: 'Średnia nowych słów dziennie z ostatnich 7 dni.',
    detail: 'Strzałka obok porównuje to z tygodniem wcześniej — pokazuje, czy ostatnio przyspieszasz, czy zwalniasz.',
    accent: 'pace',
  },
]

/**
 * Bottom sheet explaining seria / punkty / tempo. Native <dialog>, matching
 * AchievementSheet and DailyGoalPicker elsewhere on this page — same handle
 * bar, same slideUp entrance, so opening it feels like part of the same screen
 * rather than a bolted-on tooltip.
 */
export function MetricsInfoSheet({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="metricsinfo"
      onClose={onClose}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="metricsinfo__inner">
        <span className="metricsinfo__handle" aria-hidden="true" />

        <h2 className="metricsinfo__title">Jak to liczymy</h2>
        <p className="metricsinfo__sub">Trzy liczby, które widzisz nad trasą.</p>

        <ul className="metricsinfo__list">
          {METRICS.map((m, i) => (
            <li
              key={m.title}
              className={`metricsinfo__item metricsinfo__item--${m.accent}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="metricsinfo__icon" aria-hidden="true">{m.icon}</span>
              <div className="metricsinfo__text">
                <h3 className="metricsinfo__item-title">{m.title}</h3>
                <p className="metricsinfo__lead">{m.lead}</p>
                <p className="metricsinfo__detail">{m.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <button className="metricsinfo__close" onClick={() => ref.current?.close()}>
          Zrozumiałem
        </button>
      </div>
    </dialog>
  )
}
