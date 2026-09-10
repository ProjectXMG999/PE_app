import { useState } from 'react'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import { startCheckout, type Plan } from '../../services/checkout'
import './OfferSection.css'

const FEATURES = [
  'Pełna mapa języka: 10 000 słów',
  'Cztery poziomy: Survival → World Class',
  'Trening SŁUCHAJ i trening TRENUJ',
  'Zdania do każdego słowa',
  'Ćwiczenia mówienia',
  'Statystyki i widoczny Progress',
]

const PLANS: Array<{ id: Plan; tag: string; price: string; total: string; note: string; recommended: boolean }> = [
  {
    id: 'landing_6mo',
    tag: '6 MIESIĘCY — START',
    price: '6 × 95 zł',
    total: '570 zł łącznie',
    note: 'Dla tych, którzy chcą zacząć od 6 miesięcy dostępu.',
    recommended: false,
  },
  {
    id: 'landing_12mo',
    tag: '12 MIESIĘCY — REKOMENDOWANE',
    price: '12 × 79 zł',
    total: '948 zł łącznie',
    note: 'Pełny rok treningu i najniższa cena miesięczna.',
    recommended: true,
  },
]

export function OfferSection() {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelectPlan(planId: Plan) {
    setError(null)
    setLoadingPlan(planId)
    try {
      await startCheckout(planId)
      // startCheckout redirects the browser on success — no further state
      // update needed; this only reruns if that redirect never happens.
    } catch {
      setError('Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę.')
      setLoadingPlan(null)
    }
  }

  return (
    <section className="section section--wide offer" id="offer">
      <RevealOnScroll className="offer__head">
        <p className="section__eyebrow">Twój Progress zaczyna się dzisiaj</p>
        <h2 className="section__title">
          Otrzymujesz pełną mapę języka.
        </h2>
        <p className="section__lead">
          Nie planujesz. Nie szukasz kolejnych materiałów. Otwierasz aplikację i wiesz,
          co zrobić dalej.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delay={0.1} className="offer__features">
        {FEATURES.map(f => (
          <span key={f} className="offer__feature">
            <span className="offer__check" aria-hidden="true">✓</span>
            {f}
          </span>
        ))}
      </RevealOnScroll>

      <div className="offer__plans">
        {PLANS.map((p, i) => (
          <RevealOnScroll key={p.id} delay={0.15 + i * 0.1} className={`plan${p.recommended ? ' plan--recommended' : ''}`}>
            {p.recommended && <span className="plan__badge">Rekomendowane</span>}
            <span className="plan__tag">{p.tag}</span>
            <span className="plan__price">{p.price}</span>
            <span className="plan__total">{p.total}</span>
            <p className="plan__note">{p.note}</p>
            <CTAButton
              variant={p.recommended ? 'primary' : 'secondary'}
              onClick={() => handleSelectPlan(p.id)}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === p.id ? 'Otwieram płatność…' : 'Zacznij swój Progress'}
            </CTAButton>
          </RevealOnScroll>
        ))}
      </div>

      {error && (
        <p className="offer__error" role="alert">
          {error}
        </p>
      )}

      <RevealOnScroll delay={0.3} className="offer__footnote">
        <p>Pierwszy trening zajmie Ci około 10 minut.</p>
      </RevealOnScroll>
    </section>
  )
}
