import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import { coveragePct } from '../../utils/coverage'
import { LEVEL_META } from '../../data/levels'
import './CoverageInfoSheet.css'

interface Props {
  knownWords: number
  onClose: () => void
}

/**
 * Where the percentage comes from — and what it is not.
 *
 * The product's own scientific section sets the bar this sheet has to clear:
 * "Jednocześnie mierzenie musi być uczciwe. Liczba odsłuchanych słów nie
 * powinna być nazywana liczbą słów opanowanych, jeśli system tego nie
 * sprawdził." A capability figure with no stated basis would fail exactly that
 * test, so the estimate ships with its assumptions attached.
 */
export function CoverageInfoSheet({ knownWords, onClose }: Props) {
  const sheet = useRef<SheetHandle>(null)
  const { rise, group, tap } = useSheetMotion()

  return (
    <Sheet ref={sheet} onClose={onClose} className="covinfo__inner" aria-label="Skąd ta liczba">
      <motion.h2 className="covinfo__title" variants={rise}>Skąd ta liczba</motion.h2>
      <motion.p className="covinfo__lead" variants={rise}>
        Znasz <strong>{knownWords.toLocaleString('pl-PL')}</strong> słów, co daje około{' '}
        <strong>{coveragePct(knownWords)}%</strong> słów w typowej rozmowie.
      </motion.p>

      <motion.p className="covinfo__text" variants={rise}>
        Słowa w języku nie występują równo często. Kilkaset najczęstszych pokrywa
        większość tego, co ludzie mówią, a kolejne tysiące dodają precyzję i odcienie.
        Dlatego <strong>kolejność jest tu ważniejsza od liczby</strong> — uczysz się
        słów w kolejności użyteczności, więc pierwszy tysiąc daje najwięcej.
      </motion.p>

      <motion.ul className="covinfo__list" variants={group}>
        {LEVEL_META.map(l => (
          <motion.li
            key={l.level}
            className={knownWords >= l.threshold ? 'is-reached' : ''}
            variants={rise}
          >
            <span className="covinfo__list-n">{l.threshold.toLocaleString('pl-PL')}</span>
            <span className="covinfo__list-b">
              <strong>~{coveragePct(l.threshold)}%</strong> · {l.name}
              <em>{l.promise}</em>
            </span>
          </motion.li>
        ))}
      </motion.ul>

      <motion.h3 className="covinfo__sub" variants={rise}>Czym to jest, a czym nie</motion.h3>
      <motion.p className="covinfo__text covinfo__text--fine" variants={rise}>
        To <strong>szacunek, nie pomiar</strong>. Opiera się na badaniach pokrycia
        leksykalnego (Nation, Schmitt, Webb; korpusy BNC/COCA) i na założeniu, że
        kolejność naszej trasy odpowiada kolejności użyteczności. Liczba dotyczy
        mowy codziennej — w tekstach naukowych czy prawniczych to samo słownictwo
        pokrywa mniej. Nie mierzymy Twojego rozumienia bezpośrednio; mierzymy, ile
        słów potwierdziłeś, i przeliczamy to na typową rozmowę.
      </motion.p>

      <motion.button
        type="button"
        className="covinfo__close"
        variants={rise}
        whileTap={tap}
        onClick={() => sheet.current?.close()}
      >
        Rozumiem
      </motion.button>
    </Sheet>
  )
}
