import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { TrainingOnboardingCard } from '../components/training/TrainingOnboardingCard'
import { exerciseGlyph } from '../components/training/exerciseGlyph'
import { CheckGlyph, ChevronRightGlyph, SpeakerGlyph } from '../components/mode/glyphs'
import { fadeUpReduced, glassReveal, glassRevealReduced, heroReveal, staggerContainer } from '../components/today/motion'
import { TRAINING_EXERCISES, getListenedExercises } from '../data/trainingExercises'
import './TrainingPage.css'

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
  const reduced = useReducedMotion()
  const item = reduced ? fadeUpReduced : heroReveal
  /* Anything that IS or CONTAINS glass rises without an opacity channel. A
     group opacity below 1 composites the blurred backdrop at partial alpha over
     the unblurred one, so the card lands looking almost clear and only reaches
     full fog a third of a second later — it reads as the effect restarting
     after the page has arrived. See glassReveal in today/motion.ts. */
  const glassItem = reduced ? glassRevealReduced : glassReveal

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
              viewTransition
              className="training-card u-liquid"
              style={{ ['--ex' as string]: exercise.color } as CSSProperties}
              variants={glassItem}
              whileTap={reduced ? undefined : { scale: 0.975 }}
            >
              <div className="training-card__top">
                <div
                  className="training-card__icon"
                  aria-hidden="true"
                  style={{ viewTransitionName: `exercise-icon-${exercise.id}` }}
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
