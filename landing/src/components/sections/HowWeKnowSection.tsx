import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import './HowWeKnowSection.css'

const STATS = [
  { value: '10 lat', label: 'nauczania' },
  { value: '10 000+', label: 'uczniów' },
  { value: '10 000', label: 'słów ułożonych w system' },
  { value: '100 000 zł+', label: 'zainwestowane w badania i metodę' },
]

const TESTIMONIALS = [
  { name: 'Łukasz', headline: '1300 słów w 2 miesiące', detail: 'Po 60 dniach przeszedł przez 1300 słów w systemie.' },
  { name: 'Marta', headline: '684 słowa w 6 tygodni', detail: 'Wróciła do angielskiego po latach przerwy i utrzymywała regularne treningi co tydzień.' },
  { name: 'Piotr', headline: '316 → 1221 słów w 90 dni', detail: '+905 słów na jego drodze Progress.' },
]

export function HowWeKnowSection() {
  return (
    <section className="section section--wide howweknow" id="how-we-know">
      <RevealOnScroll className="howweknow__head">
        <p className="section__eyebrow">8 · Skąd wiemy, co masz zrobić dzisiaj?</p>
        <h2 className="section__title">Nie stworzyliśmy Progress w weekend.</h2>
      </RevealOnScroll>

      <div className="howweknow__stats">
        {STATS.map((s, i) => (
          <RevealOnScroll key={s.label} delay={i * 0.06} className="howweknow__stat">
            <span className="howweknow__stat-value">{s.value}</span>
            <span className="howweknow__stat-label">{s.label}</span>
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll className="section__body howweknow__narrative">
        <p>
          Przez lata obserwowaliśmy, jak ludzie naprawdę uczą się i używają angielskiego.
          Analizowaliśmy częstotliwość, użyteczność i to, jak słowa pracują w prawdziwych
          rozmowach — i zrozumieliśmy jedną rzecz: większość ludzi nie potrzebuje kolejnego
          kursu. Potrzebuje mapy. Efektem jest kolejność.
        </p>
        <p>
          Dzięki temu Progress może odpowiedzieć na najważniejsze pytanie:{' '}
          <strong>„Co mam zrobić dzisiaj?"</strong>
        </p>
        <p>
          Dzięki niemu wiesz, którego słowa nauczyć się jako 1., 20., 317., 1300. czy 6000.
          — i które spokojnie może poczekać do słowa numer 9437.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className="howweknow__proof-lead">
        <p>Ale liczby o nas to za mało. Zobacz wyniki ludzi.</p>
      </RevealOnScroll>

      <div className="howweknow__testimonials">
        {TESTIMONIALS.map((t, i) => (
          <RevealOnScroll key={t.name} delay={i * 0.1} className="testimonial">
            <span className="testimonial__name">{t.name}</span>
            <span className="testimonial__headline">{t.headline}</span>
            <p className="testimonial__detail">{t.detail}</p>
          </RevealOnScroll>
        ))}
      </div>

      <div className="section__cta-wrap">
        <CTAButton href="#offer">Dołącz do nich</CTAButton>
      </div>
    </section>
  )
}
