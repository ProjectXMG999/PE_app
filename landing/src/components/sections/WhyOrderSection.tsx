import { useEffect, useRef } from 'react'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import './WhyOrderSection.css'

export function WhyOrderSection() {
  const compareRef = useRef<HTMLDivElement>(null)

  // The two halves slide in from opposite sides — the one bespoke bit of motion
  // on the page, because the movement *is* the argument: two sets of words
  // arriving from different directions to be weighed against each other.
  // Observing the wrapper (not each card) keeps them on one shared trigger, so
  // the 0.15s offset between them stays exactly that.
  useEffect(() => {
    const el = compareRef.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('whyorder__compare--shown')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.classList.add('whyorder__compare--shown')
        observer.disconnect()
      },
      { rootMargin: '0px 0px -18% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="section whyorder" id="why-order">
      <div className="section__inner">
        <RevealOnScroll>
          <p className="section__eyebrow u-kicker u-kicker--accent">Kolejność</p>
          <h2 className="section__title">
            Wszystkie słowa są angielskie, ale nie wszystkie są równie ważne.
          </h2>
          <p className="section__lead">Zobaczmy dom.</p>
        </RevealOnScroll>

        <div className="whyorder__compare" ref={compareRef}>
          <div className="whyorder__col whyorder__col--priority u-surface">
            <span className="whyorder__label u-kicker">Wysoki priorytet</span>
            <div className="whyorder__words">
              <span>bed</span>
              <span>table</span>
              <span>chair</span>
            </div>
          </div>
          <div className="whyorder__vs u-kicker" aria-hidden="true">versus</div>
          <div className="whyorder__col whyorder__col--later u-surface">
            <span className="whyorder__label u-kicker">Może poczekać</span>
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
          <p className="section__punch">
            Nie ucz się słów dlatego, że należą do tej samej kategorii — ucz się według tego,
            <em> ile rozmów nimi przeprowadzisz</em>.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
