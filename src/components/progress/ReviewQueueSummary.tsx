import { motion, useReducedMotion } from 'framer-motion'
import type { ProgressSnapshot } from '../../hooks/useProgressData'
import { packLevelOf } from '../../hooks/useProgressData'
import { reviewMinutes } from '../../services/reviewQueue'
import { LEVEL_COLORS, LEVEL_META } from '../../data/levels'
import { plural, plReviews, plWords } from '../../utils/plural'
import { EASE_OUT_EXPO } from '../today/motion'
import './ReviewQueueSummary.css'

interface Props {
  snapshot: ProgressSnapshot
}

/**
 * The review queue in full — the detail behind Dzisiaj's "Powtórki" element,
 * which only has room for today's portion and the queue's size. Rendered as
 * the top half of the RetentionBars card on Postęp, not as a card of its own:
 * the queue (what's due) and retention (how well it holds) are one subject.
 *
 * Two different numbers people used to read as one: today's portion (a
 * budget scaled to the daily goal, so it's always doable) and the whole queue
 * (everything whose review date has arrived). Then the queue split by level,
 * so a long queue can be traced to where it actually sits.
 */
export function ReviewQueueSummary({ snapshot }: Props) {
  const reduced = useReducedMotion()
  const {
    dueWords, dueCount, reviewBudget, served, servingLeft,
    maintenanceLoad: load, reviewSecPerCard: pace,
  } = snapshot
  // Every "ok. N min" on this card is the learner's own measured pace, the same
  // one the budget above was sized with.
  const minutes = (count: number) => reviewMinutes(count, pace)

  const perLevel = LEVEL_META.map(meta => {
    const count = dueWords.filter(w => packLevelOf(w.packageId) === meta.level).length
    return { ...meta, count }
  })
  const maxCount = Math.max(1, ...perLevel.map(l => l.count))
  // "Kontynuuj mimo to" on /powtorka lets a learner go past today's portion, so
  // served can exceed the budget. Cap the figure at the portion and name the
  // extra separately, rather than showing "266 z 8".
  const doneToday = Math.min(served, reviewBudget)
  const extraToday = Math.max(0, served - reviewBudget)
  // The target can never exceed what actually exists. `servingLeft` is already
  // capped by the queue (reviewQueue.ts caps `remaining` at the backlog), but
  // the budget behind the denominator isn't capped by anything — so a budget of
  // 42 against a queue of 5 printed "16 z 42 · 5 do zrobienia" and a bar that
  // stops at 38% with nothing left to do. Now the two halves of "N z M" are
  // measured against the same queue.
  const todayTotal = Math.min(reviewBudget, served + dueCount)
  const todayPct = todayTotal > 0 ? Math.min(100, (served / todayTotal) * 100) : 0

  return (
    <div className="reviewqueue">
      <div className="reviewqueue__split">
        <div className="reviewqueue__stat">
          <span className="reviewqueue__label">Na dziś</span>
          <span className="reviewqueue__value">
            {doneToday}<small> z {todayTotal}</small>
          </span>
          <span className="reviewqueue__hint">
            {servingLeft > 0
              ? `${servingLeft} do zrobienia, ok. ${minutes(servingLeft)} min`
              : extraToday > 0
                ? `Zrobione, do tego ${extraToday} ${plural(extraToday, 'dodatkowa', 'dodatkowe', 'dodatkowych')}`
                : 'Wszystko zrobione'}
          </span>
        </div>
        <div className="reviewqueue__stat">
          <span className="reviewqueue__label">Czeka łącznie</span>
          <span className="reviewqueue__value">
            {dueCount.toLocaleString('pl-PL')}<small> {plWords(dueCount)}</small>
          </span>
          <span className="reviewqueue__hint">
            {dueCount > 0 ? `razem ok. ${minutes(dueCount)} min` : 'Nic nie czeka'}
          </span>
        </div>
      </div>

      <div
        className="reviewqueue__today-track"
        role="img"
        aria-label={`Powtórki na dziś: ${doneToday} z ${todayTotal}`}
      >
        <motion.span
          className="reviewqueue__today-fill"
          initial={{ width: reduced ? `${todayPct}%` : 0 }}
          animate={{ width: `${todayPct}%` }}
          transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.1 }}
        />
      </div>

      <p className="reviewqueue__note">
        Na dziś dostajesz tyle powtórek, ile zmieścisz w dziennym celu. Gdy zaległości rosną, porcja rośnie razem z nimi.
      </p>

      {/* The inflow the serving is up against. Until this existed, a queue that
          was simply the schedule's equilibrium read as arrears to catch up on —
          and no amount of budget tuning drains a queue that refills faster. */}
      {load.perDay > 0 && (
        <p className="reviewqueue__note reviewqueue__note--load">
          Twoje słownictwo wymaga dziennie ok. <strong>{load.perDay} {plReviews(load.perDay)}</strong>
          {' '}(~{load.minutesPerDay} min), żeby się utrzymać.{' '}
          {load.coveredPct >= 100
            ? 'Dzisiejsza porcja w pełni to pokrywa.'
            : `Dzisiejsza porcja pokrywa ${load.coveredPct}% — przy takim tempie kolejka będzie rosła.`}
        </p>
      )}

      <h3 className="reviewqueue__levels-title">Ile czeka na każdym poziomie</h3>
      <ul className="reviewqueue__levels">
        {perLevel.map((l, i) => (
          <li key={l.level} className="reviewqueue__level">
            <span className="reviewqueue__level-name" style={{ color: LEVEL_COLORS[l.level] }}>
              {l.name}
            </span>
            <span className="reviewqueue__level-bar">
              <motion.span
                className="reviewqueue__level-fill"
                style={{ background: LEVEL_COLORS[l.level] }}
                initial={{ width: reduced ? `${(l.count / maxCount) * 100}%` : 0 }}
                animate={{ width: `${(l.count / maxCount) * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.15 + i * 0.05 }}
              />
            </span>
            <span className="reviewqueue__level-count">
              {l.count.toLocaleString('pl-PL')}
              <small> {plWords(l.count)}{l.count > 0 && `, ok. ${minutes(l.count)} min`}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
