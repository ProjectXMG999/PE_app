import { useEffect, useRef, useState } from 'react'
import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import './ProofSection.css'

/**
 * "Skąd wiemy, co masz zrobić dzisiaj?" — the credibility section.
 *
 * This is three former sections in one: the stats + testimonials of "Skąd
 * wiemy", plus "Scientific Foundation of Progress" and "Behind Progress", which
 * were the two densest walls of prose on the page and sat back to back near the
 * bottom. Neither is cut — both are here in full, behind a <details> each.
 *
 * The reasoning: a buyer who wants the research reads it, and a buyer who
 * doesn't isn't made to scroll past 1 800 words of it to reach the price. Real
 * <details> rather than JS state so the content is in the DOM for search
 * engines and for anyone who prints or reader-modes the page.
 */

const STATS = [
  { value: '10 lat', label: 'nauczania' },
  { value: '10 000+', label: 'uczniów' },
  { value: '10 000', label: 'słów ułożonych w system' },
  { value: '100 000 zł+', label: 'zainwestowane w badania i metodę' },
]

const TESTIMONIALS = [
  {
    name: 'Łukasz',
    headline: '1300 słów w 2 miesiące',
    detail: 'Po 60 dniach przeszedł przez 1300 słów w systemie.',
  },
  {
    name: 'Marta',
    headline: '684 słowa w 6 tygodni',
    detail: 'Wróciła do angielskiego po latach przerwy i utrzymywała regularne treningi co tydzień.',
  },
  {
    name: 'Piotr',
    headline: '316 → 1221 słów w 90 dni',
    detail: '+905 słów na jego drodze Progress.',
  },
]

const PILLARS = [
  {
    n: '1',
    name: 'Vocabulary Frequency & Lexical Coverage',
    lead: 'Nie wszystkie słowa mają taką samą wartość na tym samym etapie nauki.',
    body: 'Pierwsze kilka tysięcy najczęstszych rodzin wyrazów daje nieproporcjonalnie dużą część pokrycia codziennego języka — to jeden z podstawowych wniosków lingwistyki korpusowej (Paul Nation, Norbert Schmitt, Stuart Webb). Dlatego grupowanie słów wyłącznie według tematów nie musi oznaczać optymalnej kolejności uczenia się.',
    question: 'Czego warto nauczyć się wcześniej, żeby jak najszybciej zwiększać to, co można z językiem zrobić?',
  },
  {
    n: '2',
    name: 'Retrieval Practice',
    lead: 'Pamięć wzmacnia się nie tylko wtedy, kiedy ponownie widzimy odpowiedź, ale wtedy, kiedy próbujemy ją wydobyć.',
    body: 'Klasyczne badanie Jeffreya Karpicke’a (Purdue) i Henry’ego Roedigera (Washington University), opublikowane w Science w 2008 roku, dotyczyło m.in. nauki słownictwa języka obcego — powtórne studiowanie nie dawało takiego efektu jak kolejne próby retrieval.',
    question: 'Czy użytkownik tylko ponownie widzi słowo, czy musi spróbować znaleźć je we własnej pamięci?',
  },
  {
    n: '3',
    name: 'Output Hypothesis',
    lead: 'Rozumienie języka i produkowanie języka stawiają przed mózgiem inne wymagania.',
    body: 'Merrill Swain (University of Toronto/OISE) na podstawie kanadyjskich programów immersion pokazała, że konieczność samodzielnego produkowania języka uruchamia procesy, których samo rozumienie nie uruchamia w tym samym stopniu — tzw. „noticing the gap".',
    question: 'Ile razy użytkownik ma okazję sam coś powiedzieć, zanim system zrobi to za niego?',
  },
  {
    n: '4',
    name: 'Automaticity & Lexical Access',
    lead: 'Płynność wymaga nie tylko posiadania wiedzy, ale coraz szybszego dostępu do niej.',
    body: 'Robert DeKeyser (University of Maryland) i Norman Segalowitz (Concordia University) opisują fluency jako sprawność procesów pozwalających słowom pojawiać się w odpowiednim momencie bez nadmiernego obciążania uwagi.',
    question: 'Czy język istnieje tylko w pamięci użytkownika, czy staje się coraz szybciej dostępny podczas prawdziwej komunikacji?',
  },
  {
    n: '5',
    name: 'The Progress Principle',
    lead: 'Widoczny postęp może zmieniać sposób, w jaki człowiek postrzega własną zdolność do dalszej nauki.',
    body: 'Teresa Amabile (Harvard Business School) i Steven Kramer, analizując blisko 12 000 zapisów 238 osób, pokazali siłę „small wins". W edukacji Dale Schunk wiązał informację o postępie z wyższym self-efficacy i lepszym wykonaniem zadań.',
    question: 'Czy użytkownik jedynie ma nadzieję, że się rozwija, czy może zobaczyć wiarygodne dowody własnego postępu?',
  },
]

const PROOF_STRIP = [
  { target: 15000, suffix: '+', label: 'uczniów pracujących metodą' },
  { target: 30, suffix: '+', label: 'osób współtworzących system' },
  { target: 15, suffix: '', label: 'lat doświadczenia najbardziej doświadczonych praktyków' },
  { target: 10000, suffix: '', label: 'słów uporządkowanych w mapę' },
  { target: 40, suffix: '%', prefix: '~', label: 'szybszy progres w naszych testach*' },
]

function ProofStat({
  target,
  suffix = '',
  prefix = '',
  label,
}: {
  target: number
  suffix?: string
  prefix?: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    // The rAF handle has to live out here. The previous version returned a
    // cleanup function from the IntersectionObserver callback — which the IO
    // API ignores — so cancelAnimationFrame never ran and an unmount mid-count
    // left the loop calling setState on a dead component.
    let raf = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const duration = 900
        const start = performance.now()
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 3)
          setValue(Math.round(target * eased))
          if (t < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target])

  return (
    <div className="proofstrip__stat" ref={ref}>
      <span className="proofstrip__value u-tabular">
        {prefix}
        {value.toLocaleString('pl-PL')}
        {suffix}
      </span>
      <span className="proofstrip__label">{label}</span>
    </div>
  )
}

export function ProofSection() {
  return (
    <section className="section section--tinted proof" id="proof">
      <div className="section__inner section__inner--wide">
        <RevealOnScroll className="proof__head">
          <p className="section__eyebrow u-kicker u-kicker--accent">Skąd to wiemy</p>
          <h2 className="section__title">Nie stworzyliśmy Progress w weekend.</h2>
        </RevealOnScroll>

        <div className="proof__stats">
          {STATS.map((s, i) => (
            <RevealOnScroll key={s.label} delay={i * 0.06} className="proof__stat u-surface">
              <span className="proof__stat-value">{s.value}</span>
              <span className="proof__stat-label">{s.label}</span>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll className="section__body proof__narrative">
          <p>
            Przez lata obserwowaliśmy, jak ludzie naprawdę uczą się i używają angielskiego.
            Analizowaliśmy częstotliwość, użyteczność i to, jak słowa pracują w prawdziwych
            rozmowach — i zrozumieliśmy jedną rzecz: większość ludzi nie potrzebuje kolejnego
            kursu. Potrzebuje mapy. Efektem jest kolejność.
          </p>
          <p>
            Dzięki temu Progress może odpowiedzieć na najważniejsze pytanie:{' '}
            <strong>„Co mam zrobić dzisiaj?"</strong> Wiesz, którego słowa nauczyć się jako
            1., 20., 317., 1300. czy 6000. — i które spokojnie może poczekać do słowa numer
            9437.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="proof__testimonials-lead">
          <p>Ale liczby o nas to za mało. Zobacz wyniki ludzi.</p>
        </RevealOnScroll>

        <div className="proof__testimonials">
          {TESTIMONIALS.map((t, i) => (
            <RevealOnScroll key={t.name} delay={i * 0.1} className="testimonial u-surface">
              <span className="testimonial__name u-kicker">{t.name}</span>
              <span className="testimonial__headline">{t.headline}</span>
              <p className="testimonial__detail">{t.detail}</p>
            </RevealOnScroll>
          ))}
        </div>

        {/* The long-form credibility material, in full, one click away. */}
        <div className="proof__more">
          <RevealOnScroll delay={0.05}>
            <details className="disclosure">
              <summary className="disclosure__summary">
                <span className="disclosure__title">Podstawy naukowe</span>
                <span className="disclosure__hint">
                  Pięć tradycji badawczych, na których opiera się trening
                </span>
                <Chevron />
              </summary>

              <div className="disclosure__content">
                <p className="disclosure__lead">
                  Częstotliwość. Retrieval. Output. Automatyzacja. Widoczny postęp. Pięć
                  dobrze opisanych tradycji badawczych, z których czerpiemy przy
                  projektowaniu treningu — nie pięć sloganów marketingowych.
                </p>

                <ol className="pillars">
                  {PILLARS.map(p => (
                    <li key={p.n} className="pillar">
                      <span className="pillar__num u-tabular">{p.n}</span>
                      <div className="pillar__content">
                        <h3 className="pillar__name">{p.name}</h3>
                        <p className="pillar__lead">{p.lead}</p>
                        <p className="pillar__body">{p.body}</p>
                        <p className="pillar__question u-rail">{p.question}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="disclosure__body">
                  Żaden z tych filarów sam w sobie nie stanowi kompletnej teorii nauki
                  języka. Rozmowa z ludźmi, bogaty input, interakcja i realne doświadczenie
                  języka nadal mają znaczenie. Scientific Foundation of Progress to próba
                  przełożenia kilku trwałych idei na konkretne decyzje projektowe:
                </p>
                <p className="disclosure__summary-line">
                  priorytetyzuj to, co użyteczne · wymagaj przypominania · twórz okazje do
                  produkcji · ćwicz dostęp, nie tylko rozpoznanie · pokazuj postęp uczciwie.
                </p>
              </div>
            </details>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <details className="disclosure">
              <summary className="disclosure__summary">
                <span className="disclosure__title">Kto za tym stoi</span>
                <span className="disclosure__hint">
                  15 000 uczniów, 30 specjalistów, metoda rozwijana przez lata
                </span>
                <Chevron />
              </summary>

              <div className="disclosure__content">
                <p className="disclosure__body">
                  Progress nie zaczął się od aplikacji. Zaczął się dużo wcześniej — od ludzi,
                  którzy chcieli mówić po angielsku, ale mimo lat nauki nadal nie czuli się w
                  tym języku swobodnie.
                </p>
                <p className="disclosure__body">
                  U podstaw Progress znajduje się autorska <strong>Metoda Łukasiewicza</strong>{' '}
                  oraz rozwijany przez lata system{' '}
                  <strong>Language Performance Training</strong>. Przez ten system przeszło
                  już około 15 000 uczniów — tysiące godzin realnego kontaktu z tym, jak
                  ludzie zapamiętują słowa, gdzie się blokują i jakie ćwiczenia rzeczywiście
                  pomagają im przejść od „rozumiem" do „potrafię powiedzieć".
                </p>
                <p className="disclosure__punch">Najpierw była praktyka. Dopiero później technologia.</p>
                <p className="disclosure__body">
                  Przy tworzeniu Progress pracował około 30-osobowy interdyscyplinarny zespół:
                  lingwiści, kognitywiści, nauczyciele języka angielskiego, specjaliści od AI
                  i machine learningu oraz praktycy edukacji z wieloletnim doświadczeniem
                  bezpośredniej pracy z uczniami.
                </p>
                <p className="disclosure__body">
                  Nie pytaliśmy tylko „czy uczniom się podoba?". Pytaliśmy przede wszystkim:
                  czy uczą się skuteczniej? W naszych testach entry/exit osoby uczące się
                  metodą Language Performance Training osiągały wyniki około 40% szybciej niż
                  przyjęty przez nas benchmark rynkowy.
                </p>
                <p className="disclosure__punch">
                  Progress nie jest aplikacją, do której dopisaliśmy metodę. Jest metodą
                  sprawdzaną przez lata na tysiącach ludzi, którą zamieniliśmy w aplikację.
                </p>

                <div className="proofstrip">
                  {PROOF_STRIP.map(s => (
                    <ProofStat key={s.label} {...s} />
                  ))}
                </div>

                <p className="disclosure__footnote">
                  * Wynik na podstawie testów entry/exit Language Performance Training.
                  Metodologia pomiaru dostępna na życzenie.
                </p>
              </div>
            </details>
          </RevealOnScroll>
        </div>

        <div className="section__cta-wrap">
          <CTAButton href="#offer">Dołącz do nich</CTAButton>
        </div>
      </div>
    </section>
  )
}

function Chevron() {
  return (
    <svg
      className="disclosure__chevron"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
