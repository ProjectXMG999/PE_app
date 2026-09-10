import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import './WhyOrderSection.css'

export function WhyOrderSection() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const left = leftRef.current
    const right = rightRef.current
    if (!left || !right) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.set(left, { opacity: 0, x: -40 })
    gsap.set(right, { opacity: 0, x: 40 })

    const trigger = ScrollTrigger.create({
      trigger: left,
      start: 'top 82%',
      onEnter: () => {
        gsap.to(left, { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' })
        gsap.to(right, { opacity: 1, x: 0, duration: 0.7, delay: 0.15, ease: 'power2.out' })
      },
      onEnterBack: () => {
        gsap.to(left, { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' })
        gsap.to(right, { opacity: 1, x: 0, duration: 0.7, delay: 0.15, ease: 'power2.out' })
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <section className="section whyorder" id="why-order">
      <RevealOnScroll>
        <p className="section__eyebrow">3 · Dlaczego kolejność ma znaczenie?</p>
        <h2 className="section__title">
          Wszystkie słowa są angielskie, ale nie wszystkie są równie ważne.
        </h2>
        <p className="section__lead">Zobaczmy dom.</p>
      </RevealOnScroll>

      <div className="whyorder__compare">
        <div className="whyorder__col whyorder__col--priority" ref={leftRef}>
          <span className="whyorder__label">Wysoki priorytet</span>
          <div className="whyorder__words">
            <span>bed</span>
            <span>table</span>
            <span>chair</span>
          </div>
        </div>
        <div className="whyorder__vs" aria-hidden="true">versus</div>
        <div className="whyorder__col whyorder__col--later" ref={rightRef}>
          <span className="whyorder__label">Może poczekać</span>
          <div className="whyorder__words">
            <span>curtain</span>
            <span>shelf</span>
            <span>carpet</span>
          </div>
        </div>
      </div>

      <RevealOnScroll className="section__body">
        <p>
          Wszystkie są normalnymi, podstawowymi słowami. Żadne nie jest „dziwne". A jednak
          nie ma logicznego powodu, żeby człowiek uczący się pierwszych 500–1000 słów
          dostał <em>carpet</em> z takim samym priorytetem jak <em>bed</em> albo{' '}
          <em>table</em>, tylko dlatego, że wszystkie należą do kategorii „My House".
        </p>
        <p>
          Czy naprawdę powinieneś uczyć się ich w tym samym momencie, tylko dlatego, że
          stoją w tym samym pokoju? My uważamy, że nie.
        </p>
        <p>
          Tradycyjna nauka często grupuje język według tematów. Progress układa go według
          użyteczności. Są słowa, które otwierają Ci setki rozmów. Są takie, których nie
          użyjesz przez pięć lat.
        </p>
        <p className="whyorder__punch">
          Nie ucz się słów dlatego, że należą do tej samej kategorii — ucz się według tego,
          ile rozmów nimi przeprowadzisz.
        </p>
      </RevealOnScroll>
    </section>
  )
}
