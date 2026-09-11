import { useState } from 'react'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import { IconCheck, IconShield, IconRefresh, IconLock } from '../ui/icons'
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

/**
 * What replaced the countdown.
 *
 * The old promo bar ran a clock on a rolling 3-day window anchored to
 * Date.UTC(2026, 0, 1) — it re-armed itself forever, so "kończy się za" was
 * never true. Anyone who reloaded the page a week later saw the same urgency,
 * and the kind of buyer who checks is exactly the kind who then doesn't buy.
 * These three are claims that hold up when checked.
 */
const ASSURANCES = [
  { Icon: IconShield, text: '30 dni gwarancji zwrotu' },
  { Icon: IconRefresh, text: 'Anulujesz w każdej chwili' },
  { Icon: IconLock, text: 'Bezpieczna płatność — Stripe' },
]

interface PlanData {
  id: Plan
  tag: string
  monthly: string
  regularMonthly: string
  discount: string
  saving: string
  note: string
  recommended: boolean
}

// Regular price basis: 129 zł/mo. The charged price is unchanged (it's the
// Stripe Price ID) — regularMonthly / discount / saving are promo framing only.
const PLANS: PlanData[] = [
  {
    id: 'landing_6mo',
    tag: '6 miesięcy — start',
    monthly: '95 zł',
    regularMonthly: '129 zł',
    discount: '−26%',
    saving: '34 zł taniej co miesiąc',
    note: 'Dla tych, którzy chcą zacząć od 6 miesięcy dostępu.',
    recommended: false,
  },
  {
    id: 'landing_12mo',
    tag: '12 miesięcy',
    monthly: '79 zł',
    regularMonthly: '129 zł',
    discount: '−39%',
    saving: '50 zł taniej co miesiąc',
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
    <section className="section offer" id="offer">
      {/* "Dream outcome" — was its own section immediately before this one,
          making the same argument the price is the answer to. It reads better
          as the run-up than as a separate stop. */}
      <div className="section__inner offer__dream">
        <RevealOnScroll y={40} duration={0.9}>
          <h2 className="offer__dream-title u-display u-display--lg">
            Nie uczysz się po to, żeby zamienić A2 na B1.
          </h2>
        </RevealOnScroll>

        <RevealOnScroll y={32} duration={0.9} delay={0.1} className="section__body">
          <p>
            Uczysz się, żeby zagadać do człowieka w Barcelonie. Wejść na meeting i powiedzieć
            dokładnie to, co myślisz. Poznać kogoś, kogo bez angielskiego nigdy byś nie
            poznał. Włączyć podcast i po prostu go słuchać. Podróżować dalej. Pracować
            szerzej. Rozmawiać z większą częścią świata.
          </p>
          <p className="offer__dream-punch">
            Nie chcemy, żebyś był lepszym uczniem angielskiego.
            <br />
            Chcemy, żeby angielski dał Ci <em>większe życie</em>.
          </p>
          <p>
            Nie musisz dziś wiedzieć, jak dojść do 10 000 słów. Musisz zrobić pierwsze 10.
            Jutro Progress pokaże Ci następne.
          </p>
          <p className="offer__dream-punch">Czas i tak minie. Pytanie, czy zobaczysz Progress.</p>
        </RevealOnScroll>
      </div>

      <div className="section__inner section__inner--wide offer__buy">
        <RevealOnScroll className="offer__head">
          <p className="section__eyebrow u-kicker u-kicker--accent">
            Twój Progress zaczyna się dzisiaj
          </p>
          <h2 className="section__title">Otrzymujesz pełną mapę języka.</h2>
          <p className="section__lead">
            Nie planujesz. Nie szukasz kolejnych materiałów. Otwierasz aplikację i wiesz,
            co zrobić dalej.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1} className="offer__features">
          {FEATURES.map(f => (
            <span key={f} className="offer__feature">
              <span className="offer__check" aria-hidden="true">
                <IconCheck size={14} />
              </span>
              {f}
            </span>
          ))}
        </RevealOnScroll>

        <div className="offer__plans">
          {PLANS.map((p, i) => (
            <RevealOnScroll
              key={p.id}
              delay={0.15 + i * 0.1}
              className={`plan${p.recommended ? ' plan--recommended u-surface--raised' : ' u-surface'}`}
            >
              <span className="plan__badge-row">
                {p.recommended && <span className="plan__badge">Rekomendowane</span>}
                <span className="plan__discount u-tabular">{p.discount}</span>
              </span>
              <span className="plan__tag u-kicker">{p.tag}</span>
              <span className="plan__pricing">
                <s className="plan__regular u-tabular">{p.regularMonthly}</s>
                <span className="plan__price u-tabular">
                  {p.monthly}
                  <span className="plan__per">/ mies.</span>
                </span>
              </span>
              <span className="plan__saving">{p.saving}</span>
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

        <RevealOnScroll delay={0.25} className="offer__assurances">
          {ASSURANCES.map(({ Icon, text }) => (
            <span key={text} className="offer__assurance">
              <Icon size={20} />
              {text}
            </span>
          ))}
        </RevealOnScroll>

        <RevealOnScroll delay={0.3} className="offer__footnote">
          <p>Pierwszy trening zajmie Ci około 10 minut.</p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
