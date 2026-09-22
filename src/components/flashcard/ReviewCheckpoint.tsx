import { useId } from 'react'
import { plural, plWords } from '../../utils/plural'
import './ReviewCheckpoint.css'

interface Props {
  /** Words recalled in the batch that just ended. */
  kept: number
  /** Size of the batch that just ended. */
  cardCount: number
  /** Words reviewed today across every visit, this batch included. */
  doneToday: number
  /** Today's ceiling. 0 when the schedule has no budget to show. */
  reviewBudget: number
  /** Still due and not served today. */
  queueLeft: number
  /** Has today's portion been met? Flips which action is the primary one. */
  portionDone: boolean
  onContinue: () => void
  onStop: () => void
  /** Wording for the way out — "Na dziś wystarczy", or where back leads. */
  stopLabel: string
}

const R = 58
const C = 2 * Math.PI * R

/**
 * The checkpoint between two review batches: how the batch went, how far today
 * has got, and the choice to keep going or stop.
 *
 * Deliberately not the shared `.review__state` column (a circled emoji, a
 * heading and a sentence) that the error and empty screens still use: this is
 * the screen a learner lands on several times a run, and the numbers on it are
 * the point of the whole mode. So it borrows the premium language the other
 * end-of-session screens already speak — bloom, glass card, staged rise — with
 * the batch's retention as a dial and today's portion as a meter, instead of
 * three numbers buried in a paragraph.
 */
export function ReviewCheckpoint({
  kept, cardCount, doneToday, reviewBudget, queueLeft, portionDone,
  onContinue, onStop, stopLabel,
}: Props) {
  const gradId = useId()
  const ratio = cardCount > 0 ? kept / cardCount : 0
  const missed = Math.max(0, cardCount - kept)
  const perfect = cardCount > 0 && missed === 0
  const cleared = queueLeft === 0

  // The dial sits right above the headline, so the headline reports the same
  // thing it does — how this batch went — and the meter below owns the day.
  // Saying "porcja" in all three was the first draft, and it read as a stutter.
  const title = cleared
    ? 'Kolejka pusta'
    : perfect
      ? 'Komplet!'
      : ratio >= 0.8
        ? 'Świetna robota!'
        : ratio >= 0.5
          ? 'Dobra robota!'
          : 'Trudna runda'

  // One line, and it has to earn its place: the buttons below already say what
  // the choices are, so this says what just happened instead. The "wrócą
  // wcześniej" promise is one the scheduler actually keeps — applyUnknown
  // grades a miss as AGAIN, which lands the word back within a day or two.
  const lede = cleared
    ? 'Pamięć odświeżona. Nic więcej dziś nie wraca.'
    : perfect
      ? 'Cała porcja wróciła bez potknięcia.'
      : `${missed} ${plWords(missed)} ${plural(missed, 'umknęło', 'umknęły', 'umknęło')}`
        + ` — ${plural(missed, 'wróci', 'wrócą', 'wrócą')} wcześniej niż reszta.`

  // The day's budget is only worth showing while there is still something it
  // could hold back. With the queue empty it is a ceiling on nothing.
  const showMeter = reviewBudget > 0 && !cleared
  const budgetPct = reviewBudget > 0
    ? Math.min(100, (doneToday / reviewBudget) * 100)
    : 0

  const continueBtn = (
    <button
      key="continue"
      className={`rcheck__btn${portionDone ? ' rcheck__btn--quiet' : ' rcheck__btn--primary u-cta u-cta--live fx-shine'}`}
      onClick={onContinue}
    >
      <span className="rcheck__btn-label">Kontynuuj powtórkę</span>
      {!portionDone && queueLeft > 0 && (
        <span className="rcheck__btn-sub">jeszcze {queueLeft} {plWords(queueLeft)} w kolejce</span>
      )}
    </button>
  )

  const stopBtn = (
    <button
      key="stop"
      className={`rcheck__btn${portionDone ? ' rcheck__btn--primary u-cta u-cta--live fx-shine' : ' rcheck__btn--quiet'}`}
      onClick={onStop}
    >
      <span className="rcheck__btn-label">{stopLabel}</span>
    </button>
  )

  return (
    <div className="rcheck">
      <div className="rcheck__card u-liquid" role="group" aria-label="Porcja powtórki zakończona">
        <p className="rcheck__eyebrow">{cleared ? 'Powtórka zakończona' : 'Punkt kontrolny'}</p>

        <div
          className="rcheck__dial"
          role="img"
          aria-label={`Utrzymane ${kept} z ${cardCount} słów w tej porcji`}
        >
          <svg viewBox="0 0 132 132" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--live)" />
                <stop offset="100%" stopColor="var(--success)" />
              </linearGradient>
            </defs>
            <circle className="rcheck__dial-track" cx="66" cy="66" r={R} />
            <circle
              className="rcheck__dial-fill"
              cx="66" cy="66" r={R}
              stroke={`url(#${gradId})`}
              strokeDasharray={C}
              style={{
                ['--dial-c' as string]: `${C}`,
                ['--dial-o' as string]: `${C * (1 - ratio)}`,
              }}
            />
          </svg>
          <span className="rcheck__dial-body">
            <span className="rcheck__dial-value">
              {kept}<span className="rcheck__dial-of">/{cardCount}</span>
            </span>
            <span className="rcheck__dial-label">utrzymane</span>
          </span>
        </div>

        <div className="rcheck__text">
          <h1 className="rcheck__title">{title}</h1>
          <p className="rcheck__lede">{lede}</p>
        </div>

        {showMeter ? (
          <div className="rcheck__meter">
            <div className="rcheck__meter-top">
              <span className="rcheck__meter-name">Dzisiejsza porcja</span>
              <span className="rcheck__meter-count">
                <strong>{Math.min(doneToday, reviewBudget)}</strong> / {reviewBudget}
              </span>
            </div>
            <div className="rcheck__meter-track">
              <span
                className="rcheck__meter-fill"
                style={{ ['--pct' as string]: `${budgetPct}%` }}
              />
            </div>
            <p className="rcheck__meter-foot">
              {portionDone
                ? <>Reszta kolejki (<strong>{queueLeft}</strong> {plWords(queueLeft)}) spokojnie może poczekać do jutra.</>
                : <>W kolejce jeszcze <strong>{queueLeft}</strong> {plWords(queueLeft)} — {plural(queueLeft, 'wróci', 'wrócą', 'wrócą')} w kolejnych dniach.</>}
            </p>
          </div>
        ) : (
          <p className="rcheck__meter-foot rcheck__meter-foot--bare">
            Dziś powtórzone: <strong>{doneToday}</strong> {plWords(doneToday)}.
          </p>
        )}

        <div className="rcheck__actions">
          {queueLeft > 0
            ? (portionDone ? [stopBtn, continueBtn] : [continueBtn, stopBtn])
            : stopBtn}
        </div>
      </div>
    </div>
  )
}
