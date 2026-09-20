import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet, useSheetMotion, type SheetHandle } from '../shared/Sheet'
import { SPRING_SNAPPY } from '../today/motion'
import { getCategoryColor } from '../../utils/packVisuals'
import { plural } from '../../utils/plural'
import { LENS_LABEL, PACK_LENSES, PackFilters, PackLens } from '../../utils/packRoute'
import { CategoryStat, MIN_SAMPLE } from '../../utils/packProfile'
import { coveragePct } from '../../utils/coverage'
import { CoverageInfoSheet } from './CoverageInfoSheet'
import './PackFilterSheet.css'

/**
 * Two tabs. "Tomy" and "Poziom" used to live here too; both are now the level
 * and volume switcher at the top of the page, and the level tab was actively
 * wrong next to it (it filtered on a per-pack difficulty tag, the switcher
 * groups whole volumes).
 */
export type SheetKind = 'lens' | 'category'

const TABS: { id: SheetKind; label: string }[] = [
  { id: 'lens',     label: 'Stan' },
  { id: 'category', label: 'Kategoria' },
]

interface Props {
  kind: SheetKind
  filters: PackFilters
  onChange: (patch: Partial<PackFilters>) => void
  onSwitchKind: (kind: SheetKind) => void
  lensCounts: Record<PackLens, number>
  knownWords: number
  categories: { cat: string; n: number }[]
  /** Your measured success rate per category — turns the filter into a diagnosis. */
  categoryStats: CategoryStat[]
  onClose: () => void
}

/**
 * Everything that is not "search" lives here, behind one button.
 *
 * Before this, the lenses, the volume index, the result counter and the level
 * tabs were four separate permanent strips — about 230px of chrome above the
 * first pack, on the one screen whose entire job is showing packs. None of them
 * are needed on every visit; all of them are needed sometimes. That is exactly
 * what a sheet is for.
 *
 * The category list is the interesting tab. Every ingredient for "which kinds
 * of word are hard *for you*" was already indexed — `lapseCount`, `difficulty`,
 * `seenCount` per word, `category` per pack — and nothing joined them, so the
 * filter was a list of nouns. Here each row carries your own success rate,
 * which makes picking "Phrasale · 61%" an act of diagnosis. Rows below
 * `MIN_SAMPLE` rated words show no number: an unlabelled guess is worse than
 * silence.
 */
export function PackFilterSheet({
  kind, filters, onChange, onSwitchKind, lensCounts, knownWords, categories, categoryStats, onClose,
}: Props) {
  const sheet = useRef<SheetHandle>(null)
  const [covOpen, setCovOpen] = useState(false)
  const { reduced, rise, group, tap } = useSheetMotion()

  const close = () => sheet.current?.close()
  // Picking is also the way out — but the sheet leaves on its own animation,
  // so the row you chose is visibly marked before it goes.
  const pick = (patch: Partial<PackFilters>) => { onChange(patch); close() }

  const statOf = new Map(categoryStats.map(s => [s.category, s]))
  const dirty: Record<SheetKind, boolean> = {
    lens: filters.lens !== 'all',
    category: filters.cat != null,
  }

  return (
    <>
    <Sheet ref={sheet} onClose={onClose} className="pfsheet__inner" aria-label="Filtry pakietów">
      <motion.div className="pfsheet__tabs" role="tablist" variants={rise}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab" aria-selected={kind === t.id}
            className={`pfsheet__tab${kind === t.id ? ' is-active' : ''}`}
            onClick={() => onSwitchKind(t.id)}
          >
            {/* One pill that slides between the tabs, rather than two
                backgrounds swapping — the same marker as everywhere else. */}
            {kind === t.id && (
              <motion.span
                layoutId="pfsheet-tab"
                className="pfsheet__tab-pill"
                aria-hidden="true"
                transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
              />
            )}
            <span className="pfsheet__tab-label">
              {t.label}
              {dirty[t.id] && <span className="pfsheet__tab-dot" />}
            </span>
          </button>
        ))}
      </motion.div>

      {kind === 'lens' && (
        <>
          {/* Capability, not a fraction: "1 221 / 10 000" measures distance to
              the end of a list, while the same words are most of an ordinary
              conversation. Always an estimate — hence the tilde and the sheet
              behind it. It lives here rather than on the bar so it costs no
              height on a screen whose job is showing packs. */}
          {knownWords > 0 && (
            <motion.button
              type="button"
              className="pfsheet__coverage"
              variants={rise}
              whileTap={tap}
              onClick={() => setCovOpen(true)}
            >
              <span className="pfsheet__coverage-num">~{coveragePct(knownWords)}%</span>
              <span className="pfsheet__coverage-text">
                codziennej rozmowy już rozumiesz
                <em>skąd to wiemy →</em>
              </span>
            </motion.button>
          )}
          <motion.p className="pfsheet__note pfsheet__note--top" variants={rise}>
            Liczby dotyczą całej trasy. Poziomy i tomy zostają — przy każdym zobaczysz, ile pasuje.
          </motion.p>
          <motion.div className="pfsheet__list" role="radiogroup" aria-label="Stan pakietów" variants={group}>
            {PACK_LENSES.map(lens => {
              const n = lensCounts[lens]
              if (n === 0 && lens !== 'all' && filters.lens !== lens) return null
              return (
                <motion.button
                  key={lens}
                  type="button"
                  className={`pfsheet__row${filters.lens === lens ? ' is-active' : ''}`}
                  role="radio" aria-checked={filters.lens === lens}
                  variants={rise}
                  whileTap={tap}
                  onClick={() => pick({ lens })}
                >
                  <span className={`pfsheet__lens-dot pfsheet__lens-dot--${lens}`} aria-hidden="true" />
                  <span className="pfsheet__row-text">
                    <span className="pfsheet__row-name">{LENS_LABEL[lens]}</span>
                  </span>
                  <span className="pfsheet__count">{n.toLocaleString('pl-PL')}</span>
                </motion.button>
              )
            })}
          </motion.div>
        </>
      )}

      {kind === 'category' && (
        <motion.div className="pfsheet__list" role="radiogroup" aria-label="Kategoria" variants={group}>
          <motion.button
            type="button"
            className={`pfsheet__row${filters.cat == null ? ' is-active' : ''}`}
            role="radio" aria-checked={filters.cat == null}
            variants={rise}
            whileTap={tap}
            onClick={() => pick({ cat: null })}
          >
            <span className="pfsheet__row-name">Wszystkie kategorie</span>
          </motion.button>
          {categories.map(({ cat, n }) => {
            const stat = statOf.get(cat)
            const show = stat?.reliable === true
            return (
              <motion.button
                key={cat}
                type="button"
                className={`pfsheet__row${filters.cat === cat ? ' is-active' : ''}`}
                role="radio" aria-checked={filters.cat === cat}
                variants={rise}
                whileTap={tap}
                onClick={() => pick({ cat })}
              >
                {/* Same dot-per-row pattern as the Poziom tab, in the exact
                    colour PackageCard already tints this category's emoji
                    tile with — scanning the two lists now uses the same eye. */}
                <span className="pfsheet__dot" style={{ background: getCategoryColor(cat) }} aria-hidden="true" />
                <span className="pfsheet__row-text">
                  <span className="pfsheet__row-name">{cat}</span>
                  <span className="pfsheet__row-sub">
                    {show
                      ? `${stat!.successPct}% Twoich słów opanowanych`
                      : `${n} ${plural(n, 'pakiet', 'pakiety', 'pakietów')}`}
                  </span>
                </span>
                {show && (
                  <span className="pfsheet__gauge" aria-hidden="true">
                    <span className="pfsheet__gauge-fill" style={{ width: `${stat!.successPct}%` }} />
                  </span>
                )}
                <span className="pfsheet__count">{show ? `${stat!.successPct}%` : n}</span>
              </motion.button>
            )
          })}
          <p className="pfsheet__note">
            Procent liczymy tylko tam, gdzie masz co najmniej {MIN_SAMPLE} ocenionych słów —
            niżej byłby to szum, nie diagnoza.
          </p>
        </motion.div>
      )}

      <motion.button
        type="button"
        className="pfsheet__close"
        variants={rise}
        whileTap={tap}
        onClick={close}
      >
        Gotowe
      </motion.button>
    </Sheet>

    {/* A sheet of its own, kept OUTSIDE the panel above: the panel is a
        transformed, scrolling box, and nesting one dialog inside another's
        transformed subtree is asking a browser to decide what "fixed" means. */}
    {covOpen && <CoverageInfoSheet knownWords={knownWords} onClose={() => setCovOpen(false)} />}
    </>
  )
}
