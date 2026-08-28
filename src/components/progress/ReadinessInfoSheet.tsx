import { useEffect, useRef } from 'react'
import './ReadinessInfoSheet.css'

interface Props {
  onClose: () => void
}

interface Metric {
  icon: string
  title: string
  lead: string
  detail: string
  accent: 'swiezosc' | 'retencja' | 'regularnosc' | 'mowienie' | 'skutecznosc' | 'score'
}

/**
 * Plain-language explanations for the five parts behind "Gotowość do mówienia"
 * plus the blended score itself — a learner seeing five unexplained percentages
 * (and Mówienie 0% next to Forma 100%, which look contradictory unless
 * you know they measure completely different things) has no way to reverse-
 * engineer any of this from the bars alone.
 */
const METRICS: Metric[] = [
  {
    icon: '🌿',
    title: 'Świeżość',
    lead: 'Ile dni minęło od ostatniej nauki.',
    detail: 'Nauka dzisiaj = 100%. Każdy dzień przerwy obniża wynik, a po tygodniu bez nauki spada do 0%.',
    accent: 'swiezosc',
  },
  {
    icon: '🧠',
    title: 'Pamięć',
    lead: 'Ile poznanych słów naprawdę zostaje w głowie.',
    detail: 'Odsetek widzianych słów, które udało Ci się opanować — a nie tylko raz przerobić.',
    accent: 'retencja',
  },
  {
    icon: '🔥',
    title: 'Regularność',
    lead: 'Twoja seria dni nauki pod rząd.',
    detail: '7 dni nauki z rzędu daje 100% — najprostszy sposób na wysoki wynik.',
    accent: 'regularnosc',
  },
  {
    icon: '🗣️',
    title: 'Mówienie',
    lead: 'Jak często ostatnio ćwiczysz na głos.',
    detail: 'Udział ćwiczeń na głos w sesjach z ostatnich 14 dni. 0% nie znaczy „nie uczysz się" — znaczy „rzadko mówisz na głos".',
    accent: 'mowienie',
  },
  {
    icon: '⚡',
    title: 'Forma',
    lead: 'Twoje obecne tempo względem Twojego rekordu.',
    detail: 'Porównuje ostatni tydzień z Twoim najlepszym tygodniem w historii. 100% = jesteś na poziomie życiówki.',
    accent: 'skutecznosc',
  },
  {
    icon: '🎙️',
    title: 'Gotowość do mówienia',
    lead: 'Średnia ważona powyższych pięciu.',
    detail: 'Świeżość i Pamięć liczą się najbardziej — bez nich nie ma czego użyć w rozmowie. Regularność trochę mniej, Mówienie i Forma najmniej.',
    accent: 'score',
  },
]

/**
 * Bottom sheet explaining the readiness breakdown. Native <dialog>, matching
 * MetricsInfoSheet on the same page — same handle bar, same slideUp entrance,
 * so opening it feels like part of the same screen rather than a bolted-on
 * tooltip.
 */
export function ReadinessInfoSheet({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="readinessinfo"
      onClose={onClose}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="readinessinfo__inner">
        <span className="readinessinfo__handle" aria-hidden="true" />

        <h2 className="readinessinfo__title">Jak to liczymy</h2>
        <p className="readinessinfo__sub">Pięć części, z których składa się Twoja gotowość do mówienia.</p>

        <ul className="readinessinfo__list">
          {METRICS.map((m, i) => (
            <li
              key={m.title}
              className={`readinessinfo__item readinessinfo__item--${m.accent}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="readinessinfo__icon" aria-hidden="true">{m.icon}</span>
              <div className="readinessinfo__text">
                <h3 className="readinessinfo__item-title">{m.title}</h3>
                <p className="readinessinfo__lead">{m.lead}</p>
                <p className="readinessinfo__detail">{m.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <button className="readinessinfo__close" onClick={() => ref.current?.close()}>
          Zrozumiałem
        </button>
      </div>
    </dialog>
  )
}
