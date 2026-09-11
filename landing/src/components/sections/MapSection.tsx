import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import { DeviceFrame } from '../ui/DeviceFrame'
import './MapSection.css'

/**
 * "MAPA" — the section that most literally shows what the copy describes.
 *
 * The visual used to be a live CompassHero fed by mock data, which cost the
 * whole FSRS engine and review queue in the bundle to render one card. It's a
 * real screenshot of the route now: conquered packs in gold above the frontier,
 * the violet "następny na trasie" pack, and the dim road ahead — which is the
 * argument the copy is making, made in one picture.
 */
export function MapSection() {
  return (
    <section className="section section--tinted mapsection" id="map">
      <div className="section__inner section__inner--wide section__split section__split--text-lead">
        <RevealOnScroll className="mapsection__text">
          <p className="section__eyebrow u-kicker u-kicker--accent">Mapa</p>
          <h2 className="section__title">
            Nawigacja wie, gdzie skręcić. Progress wie, którego słowa potrzebujesz dalej.
          </h2>
          <p className="section__lead">
            Gdy wpisujesz adres do Google Maps, nie dostajesz 200 przypadkowych ulic.
            Dostajesz trasę.
          </p>
          <p className="section__lead">
            Tak samo zaprojektowaliśmy Progress: uporządkowaliśmy 10 000 najbardziej
            użytecznych słów tak, abyś zawsze wiedział, co jest następnym krokiem.
          </p>
          <p className="section__punch">10 000 słów. 4 poziomy. Jedna mapa.</p>
          <div className="mapsection__cta">
            <CTAButton href="#offer" subtext="Pierwszy trening zajmie Ci około 10 minut." align="start">
              Zacznij swój Progress
            </CTAButton>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.12} className="mapsection__visual">
          <DeviceFrame
            name="pakiety-granica-mobile"
            alt="Trasa pakietów w aplikacji: ukończone pakiety #118–#120, znacznik 1200 słów, a pod nim pakiet #121 „Dziecko” oznaczony jako następny na trasie."
            width={390}
            height={844}
          />
          <p className="mapsection__caption">
            Twoje miejsce na trasie: <strong>#121</strong> z 864 pakietów. Zawsze wiadomo,
            co jest następne.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
