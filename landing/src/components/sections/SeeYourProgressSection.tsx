import { useEffect, useRef, useState } from 'react'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import { DeviceFrame } from '../ui/DeviceFrame'
import './SeeYourProgressSection.css'

/** The copy's own beat: "najpierw widzisz 316, potem 684, a później 1 221". */
const MILESTONES = [316, 684, 1221]

/**
 * "Wreszcie widzisz swój Progress" — the counter climbs 316 → 684 → 1 221 while
 * the card stays put and the text beside it scrolls past.
 *
 * Built on `position: sticky` plus a scroll handler, where it used to be
 * ScrollTrigger's pin + scrub. Sticky is what pinning actually is, and doing it
 * in CSS means the browser handles it on the compositor — no layout thrash on
 * pin/unpin, no stale trigger positions needing a global
 * `ScrollTrigger.refresh()` after fonts and images settle, and no 110 KB of
 * animation library for one effect.
 *
 * The proof below is the real Postęp screen, where 1 221 is the number the
 * counter just landed on — so the animation and the screenshot agree.
 */
export function SeeYourProgressSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIndex(MILESTONES.length - 1)
      return
    }

    let raf = 0
    const measure = () => {
      raf = 0
      const rect = track.getBoundingClientRect()
      const vh = window.innerHeight

      // How far the sticky card has travelled through its track, 0→1.
      //
      // The travel distance is the track's height minus one viewport: the card
      // sticks when the track's top reaches the top, and unsticks when its
      // bottom arrives. Where the track is SHORTER than the viewport — narrow
      // windows, short viewports, and the mobile layout where the card isn't
      // sticky at all — there is no such travel, and dividing by it pinned the
      // counter at 316 for the entire page. Fall back to the section's plain
      // traversal of the viewport there, so the number still steps.
      const travel = rect.height - vh
      const progress = travel > 32 ? -rect.top / travel : (vh - rect.top) / (rect.height + vh)

      const clamped = Math.min(0.999, Math.max(0, progress))
      setIndex(Math.floor(clamped * MILESTONES.length))
    }

    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const value = MILESTONES[index] ?? MILESTONES[0]

  return (
    <section className="section seeprogress" id="see-progress">
      <div className="section__inner section__inner--wide">
        <div className="seeprogress__track" ref={trackRef}>
          {/* The grid cell and the sticky element have to be two boxes. When
              they were one, `align-items: stretch` made it as tall as the whole
              track, so `position: sticky` had no slack to move in and the card
              simply scrolled away with the page. */}
          <div className="seeprogress__aside">
            <div className="seeprogress__sticky">
              <p className="section__eyebrow u-kicker u-kicker--accent">Twój Progress</p>
              <div className="seeprogress__counter u-surface--raised" aria-live="polite">
                {/* Keyed on the value so each step remounts and replays .fx-pop
                    — the number lands rather than just changing. */}
                <span key={value} className="seeprogress__num u-tabular fx-pop">
                  {value.toLocaleString('pl-PL')}
                </span>
                <span className="seeprogress__total u-tabular">/ 10 000</span>
                <span className="seeprogress__hint">słów poznanych</span>
              </div>
            </div>
          </div>

          <div className="seeprogress__text">
            <h2 className="section__title">„Chyba mówię trochę lepiej" to za mało.</h2>
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
              <p className="section__punch">
                Progress nie powinien być czymś, co czujesz raz na pół roku.{' '}
                <em>Powinieneś widzieć go cały czas.</em>
              </p>
            </div>
          </div>
        </div>

        <RevealOnScroll className="seeprogress__proof">
          <DeviceFrame
            name="postep-mobile"
            alt="Ekran Postęp w aplikacji: 1221 z 10 000 słów poznanych, 35 dni serii, 46 991 punktów i tempo 27 słów dziennie."
            width={390}
            height={844}
          />
          <p className="seeprogress__caption">
            Seria, punkty, tempo i miejsce na trasie — wszystko widoczne za każdym razem,
            kiedy otwierasz aplikację.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
