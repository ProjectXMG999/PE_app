import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import { DeviceFrame } from '../ui/DeviceFrame'
import { IconHeadphones, IconBolt } from '../ui/icons'
import './TwoTrainingModesSection.css'

export function TwoTrainingModesSection() {
  return (
    <section className="section modes" id="two-modes">
      <div className="section__inner section__inner--wide">
        <RevealOnScroll className="modes__head">
          <p className="section__eyebrow u-kicker u-kicker--accent">Dwa tryby</p>
          <h2 className="section__title">Ucz się wtedy, kiedy naprawdę masz czas.</h2>
        </RevealOnScroll>

        <div className="modes__grid">
          <RevealOnScroll delay={0} className="modes__item modes__item--listen">
            <DeviceFrame
              name="tryb-sluchaj-mobile"
              alt="Tryb Słuchaj w aplikacji: pasek postępu słuchania i karta z pakietem „Człowiek” gotowym do odtworzenia bez patrzenia w ekran."
              width={390}
              height={844}
            />
            <div className="modes__copy">
              <span className="modes__tag">
                <IconHeadphones size={18} />
                Słuchaj
              </span>
              <p className="modes__text">
                Nie musisz patrzeć w ekran. Możesz iść na spacer, biegać, jechać samochodem,
                sprzątać albo gotować. Wybierasz 10, 20, 40 lub 60 minut i zaczynasz, a
                Progress prowadzi Cię przez trening, do którego nie potrzebujesz ekranu.
              </p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15} className="modes__item modes__item--train">
            <DeviceFrame
              name="tryb-trenuj-mobile"
              alt="Tryb Trenuj w aplikacji: pasek postępu treningu z licznikiem 1221 słów i karta następnego pakietu do przećwiczenia."
              width={390}
              height={844}
            />
            <div className="modes__copy">
              <span className="modes__tag">
                <IconBolt size={18} />
                Trenuj
              </span>
              <p className="modes__text">
                Kiedy masz telefon w ręku, przypominasz sobie angielskie słowo, zanim
                zobaczysz odpowiedź, budujesz zdania, tworzysz własne przykłady i uruchamiasz
                słowa, które wcześniej tylko rozpoznawałeś.
              </p>
              <p className="modes__punch">Nie tylko „znam". Potrafię użyć.</p>
            </div>
          </RevealOnScroll>
        </div>

        <div className="section__cta-wrap">
          <CTAButton href="#offer" subtext="Pierwszy trening zajmie Ci 10 minut.">
            Zacznij swój Progress
          </CTAButton>
        </div>
      </div>
    </section>
  )
}
