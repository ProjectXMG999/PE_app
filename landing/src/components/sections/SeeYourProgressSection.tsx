import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsap'
import { AchievementGrid } from '../progress/AchievementGrid'
import { RouteMap } from '../progress/RouteMap'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import { achievementStates, routeMapData } from '../../data/mockProgress'
import './SeeYourProgressSection.css'

const MILESTONES = [316, 684, 1221]

/**
 * "WRESZCIE WIDZISZ SWÓJ PROGRESS" — the section that most directly needs the
 * "proof" framing. Pins while a counter climbs 316 → 684 → 1221 in sync with
 * scroll, dramatizing the copy's own "najpierw widzisz 316, potem 684…" beat.
 */
export function SeeYourProgressSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState(316)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(1221)
      return
    }

    const counter = { value: 316 }
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      // A fixed '+=90%' had no relation to how tall .seeprogress__text
      // actually is — if the pin released before that column (the first
      // thing that must scroll clear) finished passing the viewport, its
      // text visually overlapped the frozen counter card. Sizing the pin
      // range off its real height keeps the two in sync; recalculated by
      // ScrollTrigger.refresh() (called globally in App.tsx) whenever
      // layout settles.
      end: () => '+=' + ((textRef.current?.offsetHeight ?? 0) + 120),
      pin: '.seeprogress__counter-wrap',
      scrub: 0.6,
      onUpdate: self => {
        const idx = Math.min(MILESTONES.length - 1, Math.floor(self.progress * MILESTONES.length))
        const target = MILESTONES[idx]
        gsap.to(counter, {
          value: target,
          duration: 0.3,
          overwrite: true,
          onUpdate: () => setDisplay(Math.round(counter.value)),
        })
      },
    })

    return () => trigger.kill()
  }, [])

  return (
    <section className="seeprogress" id="see-progress" ref={sectionRef}>
      <div className="seeprogress__grid">
        <div className="seeprogress__counter-wrap">
          <div className="seeprogress__counter-pin">
            <p className="section__eyebrow">7 · Wreszcie widzisz swój Progress</p>
            <div className="seeprogress__counter" aria-live="polite">
              <span className="seeprogress__num">{display.toLocaleString('pl-PL')}</span>
              <span className="seeprogress__total">/ 10 000</span>
            </div>
            <p className="seeprogress__hint">słów poznanych</p>
          </div>
        </div>

        <div className="seeprogress__text" ref={textRef}>
          <h2 className="section__title">
            „Chyba mówię trochę lepiej" to za mało.
          </h2>
          <div className="section__body">
            <p>
              Zawsze powtarzaliśmy naszym uczniom — nic tak nie motywuje jak widzialność
              własnego progresu. Progress pokazuje Ci liczby.
            </p>
            <p>
              Nie musisz już zastanawiać się, czy nauka działa, bo widzisz drogę, którą
              przeszedłeś. Śledzisz opanowane słowa, tempo nauki, regularność treningu.
              Każde kolejne 100 słów staje się małym momentem sukcesu i kolejnym krokiem
              na trasie.
            </p>
            <p className="seeprogress__punch">
              Progress nie powinien być czymś, co czujesz raz na pół roku.
              Powinieneś widzieć go cały czas.
            </p>
          </div>
        </div>
      </div>

      <RevealOnScroll className="seeprogress__proof">
        <AchievementGrid states={achievementStates} />
      </RevealOnScroll>

      <RevealOnScroll delay={0.1} className="seeprogress__proof seeprogress__proof--route">
        <RouteMap {...routeMapData} />
      </RevealOnScroll>
    </section>
  )
}
