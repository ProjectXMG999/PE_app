import { useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import { BoltGlyph, FlameGlyph, GemGlyph } from '../mode/glyphs'
import './MetricsInfoSheet.css'

interface Props {
  onClose: () => void
}

interface Metric {
  /* The same glyphs the compass and the header pill use for these three
     readings — an explanation that draws its subject differently from the
     thing it explains is a second icon to learn, not a caption. */
  icon: ReactNode
  title: string
  lead: string
  detail: string
  accent: 'streak' | 'points' | 'pace'
}

/**
 * Plain-language explanations for the three gauges on the compass card.
 *
 * Deliberately not a spec dump of services/points.ts — a learner opening this
 * wants "why did my number move", not the exact weight table. Each explanation
 * stays to one concrete mechanic worth knowing, phrased as what to actually do.
 */
const METRICS: Metric[] = [
  {
    icon: <FlameGlyph size={26} weight={1.7} />,
    title: 'Seria',
    lead: 'Dni z rzędu, w których się uczyłeś — liczy się każda minuta, nie tylko domknięta paczka.',
    detail: 'Ominięcie jednego dnia nie musi jej zepsuć: raz na 14 dni dostajesz zamrożenie, które automatycznie ratuje serię za Ciebie.',
    accent: 'streak',
  },
  {
    icon: <GemGlyph size={24} weight={1.7} />,
    title: 'Punkty Progress',
    lead: 'Waluta wysiłku — rosną za każdą minutę nauki, nie tylko za nowe słowa.',
    detail: 'Najwięcej dają mówienie i aktywny trening, mniej szybkie słuchanie. Do tego bonus za opanowane słowa, ukończone paczki i regularność — liczy się nawet dzień, w którym nic „nie kliknęło".',
    accent: 'points',
  },
  {
    icon: <BoltGlyph size={26} weight={1.7} />,
    title: 'Tempo',
    lead: 'Średnia liczba nowo opanowanych słów na dzień, od pierwszego dnia nauki.',
    detail: 'Słowa oznaczone jako znane bez nauki w aplikacji się tu nie liczą — tempo ma pokazywać, ile faktycznie przerabiasz. Strzałka obok porównuje ostatni tydzień z poprzednim: mówi, czy przyspieszasz, czy zwalniasz.',
    accent: 'pace',
  },
]

/**
 * Bottom sheet explaining seria / punkty / tempo. One `<Sheet>`, like every
 * other in the app: it springs in, the three cards cascade behind it, and it
 * can be flicked away — so it reads as part of this screen rather than a
 * bolted-on tooltip. The cascade used to be three hand-set animation-delays.
 */
export function MetricsInfoSheet({ onClose }: Props) {
  const sheet = useRef<SheetHandle>(null)
  const { rise, group, tap } = useSheetMotion()

  return (
    <Sheet ref={sheet} onClose={onClose} className="metricsinfo__inner" aria-label="Jak to liczymy">
      <motion.h2 className="metricsinfo__title" variants={rise}>Jak to liczymy</motion.h2>
      <motion.p className="metricsinfo__sub" variants={rise}>Trzy liczby, które widzisz nad trasą.</motion.p>

      <motion.ul className="metricsinfo__list" variants={group}>
        {METRICS.map(m => (
          <motion.li
            key={m.title}
            className={`metricsinfo__item metricsinfo__item--${m.accent}`}
            variants={rise}
          >
            <span className="metricsinfo__icon" aria-hidden="true">{m.icon}</span>
            <div className="metricsinfo__text">
              <h3 className="metricsinfo__item-title">{m.title}</h3>
              <p className="metricsinfo__lead">{m.lead}</p>
              <p className="metricsinfo__detail">{m.detail}</p>
            </div>
          </motion.li>
        ))}
      </motion.ul>

      <motion.button
        type="button"
        className="metricsinfo__close"
        variants={rise}
        whileTap={tap}
        onClick={() => sheet.current?.close()}
      >
        Zrozumiałem
      </motion.button>
    </Sheet>
  )
}
