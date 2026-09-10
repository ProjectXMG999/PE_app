import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsap'
import { CTAButton } from '../ui/CTAButton'
import './Hero.css'

export function Hero() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo('.hero__eyebrow', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 })
      .fromTo('.hero__title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.3')
      .fromTo('.hero__lead', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
      .fromTo('.hero__cta-wrap', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  }, [])

  return (
    <header className="hero" id="hero" ref={ref}>
      <div className="hero__glow" aria-hidden="true" />
      <div className="hero__inner">
        <p className="hero__eyebrow">Progress — twoja mapa do 10 000 słów</p>
        <h1 className="hero__title">
          Masz Duolingo, YouTube, kurs, książkę i fiszki.
          <br />I właśnie dlatego możesz nie robić <em>Progress</em>.
        </h1>
        <p className="hero__lead">
          Wyobraź sobie, że jedziesz do Rzymu i masz siedem nawigacji. Każda prowadzi Cię
          gdzie indziej. Nie potrzebujesz ósmej. Potrzebujesz jednej dobrej mapy.
        </p>
        <p className="hero__lead">
          Progress to 10 000 najbardziej użytecznych słów ułożonych w kolejności, która
          mówi Ci, czego uczyć się teraz i co zrobić dalej.
        </p>
        <p className="hero__punch">
          Może nie brakowało Ci motywacji. Może brakowało Ci jednej drogi?
          <br />Bo w nauce angielskiego liczy się jedno. <strong>Progress.</strong>
        </p>
        <div className="hero__cta-wrap">
          <CTAButton href="#offer" subtext="Pierwszy trening zajmie Ci około 10 minut.">
            Zacznij swój Progress
          </CTAButton>
        </div>
      </div>
    </header>
  )
}
