import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'
import { CompassHero } from '../progress/CompassHero'
import { CTAButton } from '../ui/CTAButton'
import { compassHeroData } from '../../data/mockProgress'
import './MapSection.css'

/**
 * "MAPA" — the section that most literally shows what the copy describes.
 * Pins while the route line draws in (stroke-dashoffset scrubbed to scroll),
 * so the visual and the "nawigacja" metaphor arrive together.
 */
export function MapSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const lineRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const line = lineRef.current
    if (!section || !line) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const length = line.getTotalLength()
    gsap.set(line, { strokeDasharray: length, strokeDashoffset: length })

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=120%',
      pin: '.mapsection__visual',
      scrub: 0.6,
      onUpdate: self => {
        gsap.set(line, { strokeDashoffset: length * (1 - self.progress) })
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <section className="mapsection" id="map" ref={sectionRef}>
      <div className="mapsection__grid">
        <div className="mapsection__text">
          <p className="section__eyebrow">2 · Mapa</p>
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
          <p className="mapsection__punch">10 000 słów. 4 poziomy. Jedna mapa.</p>
          <CTAButton href="#offer" subtext="Pierwszy trening zajmie Ci około 10 minut.">
            Zacznij swój Progress
          </CTAButton>
        </div>

        <div className="mapsection__visual">
          <svg className="mapsection__line" viewBox="0 0 4 400" preserveAspectRatio="none" aria-hidden="true">
            <path ref={lineRef} d="M2 0 L2 400" stroke="var(--accent-bright)" strokeWidth="2" fill="none" />
          </svg>
          <div className="mapsection__cards">
            <CompassHero {...compassHeroData} />
          </div>
        </div>
      </div>
    </section>
  )
}
