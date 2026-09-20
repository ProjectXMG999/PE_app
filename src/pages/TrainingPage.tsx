import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { TrainingOnboardingCard } from '../components/training/TrainingOnboardingCard'
import { exerciseGlyph } from '../components/training/exerciseGlyph'
import { CheckGlyph, ChevronRightGlyph, SpeakerGlyph } from '../components/mode/glyphs'
import { fadeUpReduced, glassReveal, glassRevealReduced, heroReveal, staggerContainer } from '../components/today/motion'
import { TRAINING_EXERCISES, getListenedExercises } from '../data/trainingExercises'
import './TrainingPage.css'
import { armMorph, morphArmed, useLinkTransition } from '../navigation/transitions'

const MotionLink = motion.create(Link)

/**
 * Trening — the four speaking exercises.
 *
 * Each card is liquid glass lit by its exercise's own colour from the top-left
 * corner, with the exercise symbol on a gradient tile. It used to be a flat
 * black card with a coloured bar across the top and an emoji in a tinted box —
 * the bar and the emoji were the only places the colour lived.
 */
export function TrainingPage() {
  const listened = getListenedExercises()
  const onLink = useLinkTransition()
  const reduced = useReducedMotion()
  const item = reduced ? fadeUpReduced : heroReveal
  /* Anything that IS or CONTAINS glass rises without an opacity channel. A
     group opacity below 1 composites the blurred backdrop at partial alpha over
     the unblurred one, so the card lands looking almost clear and only reaches
     full fog a third of a second later — it reads as the effect restarting
     after the page has arrived. See glassReveal in today/motion.ts. */
  const glassItem = reduced ? glassRevealReduced : glassReveal

  /* ── The icon morph ────────────────────────────────────────────────────────
     The four icons used to carry `view-transition-name` permanently, in the
     JSX. That is the thing armMorph exists to prevent, and it broke two ways:

      - Leaving Trening for anywhere else (any tab) snapshotted four named
        groups with no counterpart on the page being entered. A lone half still
        animates, and a view-transition group lives in the transition overlay —
        above the whole document — so the four icons floated over the tab bar
        on the way out instead of leaving with the page under it.
      - Every navigation on this screen, morph or not, paid for four extra
        groups, each snapshotting an element inside a backdrop-blurred glass
        card. That is the stutter.

     So: named for the one card being tapped, for the length of one
     transition. Same shape as PackageCard.open(). */
  const iconRefs = useRef(new Map<string, HTMLDivElement | null>())

  const openExercise = (id: string) => {
    const el = iconRefs.current.get(id)
    if (el) {
      el.style.viewTransitionName = `exercise-icon-${id}`
      window.setTimeout(() => { el.style.viewTransitionName = '' }, 600)
    }
    // Let the detail page claim the other half. Without this an exercise
    // reached any other way (a deep link, a reload) animates a lone icon.
    armMorph(`exercise:${id}`)
  }

  /* The return leg: coming back from an exercise, its icon travels to the card
     it came from. Claimed the same way, and only when that page armed it. */
  useLayoutEffect(() => {
    const id = TRAINING_EXERCISES.find(e => morphArmed(`exercise:${e.id}`))?.id
    const el = id ? iconRefs.current.get(id) : null
    if (!id || !el) return
    el.style.viewTransitionName = `exercise-icon-${id}`
    const clear = () => { el.style.viewTransitionName = '' }
    const t = window.setTimeout(clear, 600)
    return () => { window.clearTimeout(t); clear() }
  }, [])

  return (
    <AppShell>
      <motion.div className="training-page" variants={staggerContainer} initial="hidden" animate="show">
        <motion.div className="training-header" variants={item}>
          <p className="training-header__kicker u-kicker">Trening</p>
          <h1 className="training-header__title">Language Performance Training</h1>
          <p className="training-header__subtitle">Poznaj 4 ćwiczenia, dzięki którym zaczniesz naprawdę mówić po angielsku.</p>
        </motion.div>

        <motion.div variants={glassItem}>
          <TrainingOnboardingCard />
        </motion.div>

        <motion.div className="training-grid" variants={staggerContainer}>
          {TRAINING_EXERCISES.map((exercise, idx) => (
            <MotionLink
              key={exercise.id}
              to={`/trening/${exercise.id}`}
              onClick={e => { openExercise(exercise.id); onLink(`/trening/${exercise.id}`, 'forward')(e) }}
              className="training-card u-liquid"
              style={{ ['--ex' as string]: exercise.color } as CSSProperties}
              variants={glassItem}
              whileTap={reduced ? undefined : { scale: 0.975 }}
            >
              <div className="training-card__top">
                <div
                  className="training-card__icon"
                  aria-hidden="true"
                  ref={el => { iconRefs.current.set(exercise.id, el) }}
                >
                  {exerciseGlyph(exercise.id, 24)}
                </div>
                <span className="training-card__num">{String(idx + 1).padStart(2, '0')}</span>
              </div>

              <div className="training-card__content">
                <h3 className="training-card__title">{exercise.titlePL}</h3>
                <p className="training-card__subtitle">{exercise.titleEN}</p>
                <p className="training-card__description">{exercise.description}</p>
              </div>

              <div className="training-card__footer">
                <span className="training-card__duration">
                  <SpeakerGlyph size={14} weight={2} /> {exercise.duration}
                </span>
                {listened.has(exercise.id) && (
                  <span className="training-card__done" aria-label="Odsłuchane">
                    <CheckGlyph size={13} weight={2.6} /> Odsłuchane
                  </span>
                )}
                <span className="training-card__go" aria-hidden="true">
                  <ChevronRightGlyph size={16} weight={2.2} />
                </span>
              </div>
            </MotionLink>
          ))}
        </motion.div>
      </motion.div>
    </AppShell>
  )
}
