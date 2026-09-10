import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import './TwoTrainingModesSection.css'

export function TwoTrainingModesSection() {
  return (
    <section className="section section--wide" id="two-modes">
      <RevealOnScroll className="modes__head">
        <p className="section__eyebrow">6 · Dwa sposoby treningu</p>
        <h2 className="section__title">Ucz się wtedy, kiedy naprawdę masz czas.</h2>
      </RevealOnScroll>

      <div className="modes__grid">
        <RevealOnScroll delay={0} className="modes__card modes__card--listen">
          <span className="modes__icon" aria-hidden="true">🎧</span>
          <span className="modes__tag">SŁUCHAJ</span>
          <p className="modes__text">
            Nie musisz patrzeć w ekran. Możesz iść na spacer, biegać, jechać samochodem,
            sprzątać albo gotować. Wybierasz 10, 20, 40 lub 60 minut i zaczynasz, a Progress
            prowadzi Cię przez trening, do którego nie potrzebujesz ekranu.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.15} className="modes__card modes__card--train">
          <span className="modes__icon" aria-hidden="true">⚡</span>
          <span className="modes__tag">TRENUJ</span>
          <p className="modes__text">
            Kiedy masz telefon w ręku, przypominasz sobie angielskie słowo, zanim zobaczysz
            odpowiedź, budujesz zdania, tworzysz własne przykłady i uruchamiasz słowa, które
            wcześniej tylko rozpoznawałeś.
          </p>
          <p className="modes__punch">Nie tylko „znam". Potrafię użyć.</p>
        </RevealOnScroll>
      </div>

      <div className="section__cta-wrap">
        <CTAButton href="#offer" subtext="Pierwszy trening zajmie Ci 10 minut.">
          Zacznij swój Progress
        </CTAButton>
      </div>
    </section>
  )
}
