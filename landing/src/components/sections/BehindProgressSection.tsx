import { useEffect, useRef, useState } from 'react'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import './BehindProgressSection.css'

const PROOF_STRIP = [
  { target: 15000, suffix: '+', label: 'uczniów pracujących metodą' },
  { target: 30, suffix: '+', label: 'osób współtworzących system' },
  { target: 15, suffix: '', label: 'lat doświadczenia najbardziej doświadczonych praktyków' },
  { target: 10000, suffix: '', label: 'słów uporządkowanych w mapę' },
  { target: 40, suffix: '%', prefix: '~', label: 'szybszy progres w naszych testach*' },
]

function ProofStat({ target, suffix = '', prefix = '', label }: { target: number; suffix?: string; prefix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const duration = 900
        const start = performance.now()
        let raf = 0
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 3)
          setValue(Math.round(target * eased))
          if (t < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return (
    <div className="proofstrip__stat" ref={ref}>
      <span className="proofstrip__value">
        {prefix}
        {value.toLocaleString('pl-PL')}
        {suffix}
      </span>
      <span className="proofstrip__label">{label}</span>
    </div>
  )
}

export function BehindProgressSection() {
  return (
    <section className="section section--wide behind" id="behind-progress">
      <RevealOnScroll className="behind__head">
        <p className="section__eyebrow">Behind Progress</p>
        <h2 className="section__title">15 000 uczniów. 30 specjalistów. Jedna metoda rozwijana przez lata.</h2>
      </RevealOnScroll>

      <RevealOnScroll delay={0.1} className="section__body behind__narrative">
        <p>
          Progress nie zaczął się od aplikacji. Zaczął się dużo wcześniej — od ludzi, którzy
          chcieli mówić po angielsku, ale mimo lat nauki nadal nie czuli się w tym języku swobodnie.
        </p>
        <p>
          U podstaw Progress znajduje się autorska <strong>Metoda Łukasiewicza</strong> oraz rozwijany
          przez lata system <strong>Language Performance Training</strong>. Przez ten system przeszło
          już około 15 000 uczniów — tysiące godzin realnego kontaktu z tym, jak ludzie zapamiętują
          słowa, gdzie się blokują i jakie ćwiczenia rzeczywiście pomagają im przejść od
          „rozumiem" do „potrafię powiedzieć".
        </p>
        <p className="behind__punch">Najpierw była praktyka. Dopiero później technologia.</p>
      </RevealOnScroll>

      <RevealOnScroll delay={0.15} className="section__body behind__narrative">
        <p>
          Przy tworzeniu Progress pracował około 30-osobowy interdyscyplinarny zespół: lingwiści,
          kognitywiści, nauczyciele języka angielskiego, specjaliści od AI i machine learningu oraz
          praktycy edukacji z wieloletnim doświadczeniem bezpośredniej pracy z uczniami.
        </p>
        <p>
          Nie pytaliśmy tylko „czy uczniom się podoba?". Pytaliśmy przede wszystkim: czy uczą się
          skuteczniej? W naszych testach entry/exit osoby uczące się metodą Language Performance
          Training osiągały wyniki około 40% szybciej niż przyjęty przez nas benchmark rynkowy.
        </p>
        <p className="behind__punch">
          Progress nie jest aplikacją, do której dopisaliśmy metodę.
          Jest metodą sprawdzaną przez lata na tysiącach ludzi, którą zamieniliśmy w aplikację.
        </p>
      </RevealOnScroll>

      <div className="proofstrip">
        {PROOF_STRIP.map((s, i) => (
          <RevealOnScroll key={s.label} delay={i * 0.06} className="proofstrip__item">
            <ProofStat {...s} />
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll delay={0.2} className="behind__footnote">
        <p>
          * Wynik na podstawie testów entry/exit Language Performance Training. Metodologia pomiaru
          dostępna na życzenie.
        </p>
      </RevealOnScroll>
    </section>
  )
}
