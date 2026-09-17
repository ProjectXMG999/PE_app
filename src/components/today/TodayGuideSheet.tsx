import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, PanInfo, useDragControls, useReducedMotion } from 'framer-motion'
import {
  BoltGlyph, CalendarGlyph, CheckCircleGlyph, FlagGlyph, HeadphonesGlyph, PulseGlyph,
  InfoGlyph, RepeatGlyph, RoutesGlyph, SparklesGlyph, StepsGlyph, TargetGlyph, TrendUpGlyph,
} from '../mode/glyphs'
import { RETIRE_AT_REVIEW_COUNT, SERVING_MAX, SERVING_MIN } from '../../services/reviewConfig'
import { SPRING_SNAPPY } from './motion'
import './TodayGuideSheet.css'

export type GuideTopic = 'smart' | 'review' | 'paths'

interface Props {
  open: boolean
  initialTopic?: GuideTopic
  onClose: () => void
}

/** Token names a point's symbol can be tinted with — Apple's "What's New"
 *  sheets colour each row's symbol, which is most of what makes them scannable. */
type Tint = 'accent' | 'live' | 'gold' | 'blue' | 'green' | 'orange' | 'warning' | 'danger'

interface Point {
  glyph: ReactNode
  tint: Tint
  title: string
  text: string
}

interface Topic {
  tab: string
  /** The large symbol above the title, on a gradient between two tints. */
  badge: { glyph: ReactNode; from: Tint; to: Tint }
  title: string
  lead: string
  points: Point[]
  /** A colour key shown under the points. */
  legend?: { title: string; items: { tint: Tint; label: string }[] }
}

const TINT_VAR: Record<Tint, string> = {
  accent: 'var(--accent)',
  live: 'var(--live)',
  gold: 'var(--gold)',
  blue: 'var(--accent-blue)',
  green: 'var(--success)',
  orange: 'var(--accent-orange)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

const G = 24

const TOPICS: Record<GuideTopic, Topic> = {
  smart: {
    tab: 'Sesja',
    badge: { glyph: <SparklesGlyph size={32} weight={1.9} />, from: 'accent', to: 'blue' },
    title: 'Ucz się inteligentnie',
    lead: 'Nie musisz niczego planować. Aplikacja sama łączy nowe słowa z powtórkami i układa z nich sesję dopasowaną do tego, jak Ci idzie.',
    points: [
      {
        glyph: <TargetGlyph size={G} />,
        tint: 'accent',
        title: 'Mieści się w Twoim celu',
        text: 'Sesja trwa tyle, ile wynosi Twój cel dnia. Dotknij pierścienia, żeby go zmienić.',
      },
      {
        glyph: <PulseGlyph size={G} />,
        tint: 'live',
        title: 'Reaguje na Twoje odpowiedzi',
        text: 'Kiedy dobrze pamiętasz słowa, dostajesz więcej nowych. Kiedy coś zaczyna uciekać, sesja przesuwa się w stronę powtórek, zanim zdążysz zapomnieć.',
      },
      {
        glyph: <TrendUpGlyph size={G} />,
        tint: 'gold',
        title: 'Podnosi poprzeczkę we właściwym momencie',
        text: 'Po serii dobrych sesji dorzuca słowa z wyższego poziomu i proponuje przejście dalej. Decyzja zawsze należy do Ciebie.',
      },
    ],
  },
  review: {
    tab: 'Powtórki',
    badge: { glyph: <RepeatGlyph size={32} weight={1.9} />, from: 'live', to: 'blue' },
    title: 'Powtórki, które mają koniec',
    lead: 'Każde słowo zapominasz w innym tempie. Aplikacja to śledzi i przypomina Ci je dokładnie wtedy, gdy zaczyna umykać.',
    points: [
      {
        glyph: <CalendarGlyph size={G} />,
        tint: 'live',
        title: 'Tyle, ile dasz radę zrobić',
        text: `Codziennie dostajesz od ${SERVING_MIN} do ${SERVING_MAX} słów, zależnie od Twojego celu i tempa. Nawet gdy zaległości urosną, reszta spokojnie poczeka na kolejne dni.`,
      },
      {
        glyph: <FlagGlyph size={G} />,
        tint: 'orange',
        title: 'Najważniejsze słowa idą pierwsze',
        text: 'Najpierw wracają te najdłużej zaległe, świeżo poznane i te, które już raz Ci się pomyliły.',
      },
      {
        glyph: <CheckCircleGlyph size={G} />,
        tint: 'green',
        title: 'Znane słowa przestają wracać',
        text: `Każda dobra odpowiedź wydłuża przerwę do następnej powtórki. Po ${RETIRE_AT_REVIEW_COUNT} udanych powtórkach słowo wraca już tylko raz w roku. Pomyłka cofa je o krok, a nie na sam początek.`,
      },
    ],
    legend: {
      title: 'Kolor ikony przy powtórkach mówi, jak stoisz',
      items: [
        { tint: 'live', label: 'Na bieżąco' },
        { tint: 'warning', label: 'Kolejka rośnie' },
        { tint: 'danger', label: 'Czas nadrobić' },
      ],
    },
  },
  paths: {
    tab: 'Słuchaj i Trenuj',
    badge: { glyph: <RoutesGlyph size={32} weight={1.9} />, from: 'blue', to: 'accent' },
    title: 'Dwie drogi, jedna trasa',
    lead: 'Wszystkie paczki układają się w jedną trasę do 10\u00a0000 słów, zaczynając od tych, których używa się najczęściej. Na ekranie Dzisiaj zawsze czeka następna paczka do słuchania i do treningu.',
    points: [
      {
        glyph: <HeadphonesGlyph size={G} />,
        tint: 'blue',
        title: 'Słuchaj',
        text: 'Osłuchujesz się z wymową i utrwalasz znaczenie słów. Paczka jest zaliczona, gdy przesłuchasz ją do końca. Idealne w drodze albo przy gotowaniu.',
      },
      {
        glyph: <BoltGlyph size={G} />,
        tint: 'accent',
        title: 'Trenuj',
        text: 'Sprawdzasz, czy naprawdę pamiętasz. Paczka jest zaliczona, gdy każde słowo przypomnisz sobie sam, bez podpowiedzi.',
      },
      {
        glyph: <StepsGlyph size={G} />,
        tint: 'green',
        title: 'Zaczynasz od swojego poziomu',
        text: 'Znasz już podstawy? Wybierz poziom u góry ekranu, a propozycje pominą łatwiejsze paczki.',
      },
    ],
  },
}

const ORDER: GuideTopic[] = ['smart', 'review', 'paths']

/** How far down, or how fast, a drag has to go before it dismisses the sheet. */
const DISMISS_OFFSET = 120
const DISMISS_VELOCITY = 500

/**
 * "Jak działa Dzisiaj" — one bottom sheet, three topics behind a segmented
 * control.
 *
 * It replaces an index sheet that closed itself and opened one of three other
 * sheets: two native <dialog> animations back to back, each with a blurred
 * backdrop over the WebGL ground and a staggered list of seven emoji cards.
 * It stuttered, and the copy was a wall. Now the sheet slides once on a
 * spring (transform only, no backdrop-filter while it moves), topics swap in
 * place with a short fade, and each topic is a lead sentence and three points.
 *
 * Drag the grabber (or the header) down to dismiss, like an iOS sheet; the
 * content itself scrolls normally.
 */
export function TodayGuideSheet({ open, initialTopic = 'smart', onClose }: Props) {
  const reduced = useReducedMotion()
  const dragControls = useDragControls()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [topic, setTopic] = useState<GuideTopic>(initialTopic)

  useEffect(() => {
    if (open) setTopic(initialTopic)
  }, [open, initialTopic])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    sheetRef.current?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose()
  }

  const current = TOPICS[topic]
  // In on a spring, out on a short tween with iOS's sheet curve. A spring on
  // the way out spends its last frames creeping the final pixels off-screen,
  // which reads as a stall right before the sheet disappears.
  const enter = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 40, mass: 0.9 }
  const leave = reduced ? { duration: 0 } : { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="guide-root">
          <motion.div
            className="guide-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.24 } }}
            exit={{ opacity: 0, transition: leave }}
            onClick={onClose}
          />

          <motion.div
            ref={sheetRef}
            className="guide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: enter }}
            exit={{ y: '100%', transition: leave }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div className="guide__header" onPointerDown={e => dragControls.start(e)}>
              <span className="guide__grabber" aria-hidden="true" />
              <div className="guide__titlebar">
                <h2 id="guide-title" className="guide__heading">Jak działa Dzisiaj</h2>
                <button
                  type="button"
                  className="guide__done"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={onClose}
                >
                  Gotowe
                </button>
              </div>

              <div className="guide__tabs" role="tablist">
                {ORDER.map(t => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={topic === t}
                    className={`guide__tab${topic === t ? ' guide__tab--active' : ''}`}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => setTopic(t)}
                  >
                    {topic === t && (
                      <motion.span
                        layoutId="guide-tab-indicator"
                        className="guide__tab-indicator"
                        transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                      />
                    )}
                    <span className="guide__tab-label">{TOPICS[t].tab}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="guide__body">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={topic}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                  transition={{ duration: reduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="guide__hero">
                    <span
                      className="guide__badge"
                      aria-hidden="true"
                      style={{
                        ['--badge-from' as string]: TINT_VAR[current.badge.from],
                        ['--badge-to' as string]: TINT_VAR[current.badge.to],
                      } as CSSProperties}
                    >
                      {current.badge.glyph}
                    </span>
                    <h3 className="guide__title">{current.title}</h3>
                    <p className="guide__lead">{current.lead}</p>
                  </div>

                  <ul className="guide__points">
                    {current.points.map(p => (
                      <li key={p.title} className="guide__point">
                        <span
                          className="guide__point-glyph"
                          aria-hidden="true"
                          style={{ color: TINT_VAR[p.tint] }}
                        >
                          {p.glyph}
                        </span>
                        <div className="guide__point-copy">
                          <h4 className="guide__point-title">{p.title}</h4>
                          <p className="guide__point-text">{p.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {current.legend && (
                    <div className="guide__legend">
                      <p className="guide__legend-title">{current.legend.title}</p>
                      <ul className="guide__legend-items">
                        {current.legend.items.map(item => (
                          <li key={item.label} className="guide__legend-item">
                            <span
                              className="guide__legend-dot"
                              style={{ ['--dot' as string]: TINT_VAR[item.tint] } as CSSProperties}
                              aria-hidden="true"
                            />
                            {item.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/**
 * The ⓘ button and the sheet it opens, as one component that owns its own
 * open state. Opening and closing used to be state on TodayPage, so every
 * toggle re-rendered the whole page — recomputing both pack recommendations
 * and the session mix — in the very first frame of the animation, which is
 * where the close visibly hitched.
 */
export function TodayGuideButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Jak działa Dzisiaj"
      >
        <InfoGlyph size={22} />
      </button>
      <TodayGuideSheet open={open} onClose={close} />
    </>
  )
}
