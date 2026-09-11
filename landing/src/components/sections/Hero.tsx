import { CTAButton } from '../ui/CTAButton'
import { DeviceFrame } from '../ui/DeviceFrame'
import './Hero.css'

/**
 * The entrance is a pure CSS stagger (`.fx-rise` + a per-element
 * --fx-rise-delay in Hero.css) rather than a GSAP timeline. It's above the fold
 * and plays on load, so there's nothing to observe and no reason to wait for a
 * JS bundle to animate it — the old timeline couldn't start until React had
 * hydrated, which is exactly the wrong moment to be holding the hero at
 * opacity 0.
 */
export function Hero() {
  return (
    <header className="hero" id="hero">
      <div className="hero__inner">
        <div className="hero__text">
          <p className="hero__eyebrow u-kicker u-kicker--accent fx-rise">
            Twoja mapa do 10 000 słów
          </p>
          <h1 className="hero__title u-display u-display--xl fx-rise">
            Masz Duolingo, YouTube, kurs, książkę i fiszki. I właśnie dlatego możesz nie
            robić <em>Progress</em>.
          </h1>
          <p className="hero__lead fx-rise">
            Wyobraź sobie, że jedziesz do Rzymu i masz siedem nawigacji. Każda prowadzi Cię
            gdzie indziej. Nie potrzebujesz ósmej. Potrzebujesz jednej dobrej mapy.
          </p>
          <p className="hero__lead fx-rise">
            Progress to 10 000 najbardziej użytecznych słów ułożonych w kolejności, która
            mówi Ci, czego uczyć się teraz i co zrobić dalej.
          </p>
          <p className="hero__punch fx-rise">
            Może nie brakowało Ci motywacji. Może brakowało Ci jednej drogi?
            <br />
            Bo w nauce angielskiego liczy się jedno. <strong>Progress.</strong>
          </p>
          <div className="hero__cta-wrap fx-rise">
            <CTAButton href="#offer" subtext="Pierwszy trening zajmie Ci około 10 minut." align="start">
              Zacznij swój Progress
            </CTAButton>
          </div>
        </div>

        <div className="hero__visual fx-rise">
          <DeviceFrame
            name="dzisiaj-mobile"
            alt="Ekran „Dzisiaj” w aplikacji Progress: cel dnia 10 z 15 minut, sesja na dziś z 28 nowymi słowami i przyciskiem „Zaczynamy”."
            width={390}
            height={844}
            priority
          />
        </div>
      </div>
    </header>
  )
}
