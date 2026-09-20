import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../components/layout/AppShell'
import { AudioModal } from '../components/shared/AudioModal'
import { TrainingMarkdown } from '../components/training/TrainingMarkdown'
import { exerciseGlyph } from '../components/training/exerciseGlyph'
import { ChevronLeftGlyph, PlayGlyph } from '../components/mode/glyphs'
import { fadeUpReduced, glassReveal, glassRevealReduced, heroReveal, staggerContainer } from '../components/today/motion'
import {
  TRAINING_EXERCISES,
  exerciseToParagraphs,
  markExerciseListened,
} from '../data/trainingExercises'
import { useBack } from '../navigation/navigation'
import { armMorph, morphArmed } from '../navigation/transitions'
import './TrainingPage.css'

/**
 * One exercise: a glass hero card in the exercise's colour — gradient icon
 * tile, title, and the listen button as the card's one filled action — then
 * the description set for reading, with headings and bullets in that colour.
 */
export function TrainingExercisePage() {
  const { exerciseId } = useParams()
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const { goBack, backLabel } = useBack()
  const reduced = useReducedMotion()
  const item = reduced ? fadeUpReduced : heroReveal
  /* The hero card is glass — no opacity channel on its entrance, or its fog
     thickens after it lands. See glassReveal in today/motion.ts. */
  const glassItem = reduced ? glassRevealReduced : glassReveal

  /* ── The icon morph, this half ─────────────────────────────────────────────
     Claimed rather than declared: the card that opened this page arms the name
     (see TrainingPage.openExercise), and the name comes straight off again.
     Left on permanently — as it was — the icon is snapshotted as its own
     transition group on every navigation away from here, including the ones
     with nothing to morph into, and a transition group is painted above the
     document: the icon floated over the tab bar on the way out. */
  const iconRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (exerciseId == null || !morphArmed(`exercise:${exerciseId}`)) return
    const el = iconRef.current
    if (!el) return
    el.style.viewTransitionName = `exercise-icon-${exerciseId}`
    const clear = () => { el.style.viewTransitionName = '' }
    const t = window.setTimeout(clear, 600)
    return () => { window.clearTimeout(t); clear() }
  }, [exerciseId])

  const exercise = TRAINING_EXERCISES.find(e => e.id === exerciseId)
  if (!exercise) {
    return <Navigate to="/trening" replace />
  }

  /** Back the way we came, icon and all — the return leg of the same morph. */
  function leave() {
    const el = iconRef.current
    if (el && exerciseId != null) {
      el.style.viewTransitionName = `exercise-icon-${exerciseId}`
      window.setTimeout(() => { el.style.viewTransitionName = '' }, 600)
      armMorph(`exercise:${exerciseId}`)
    }
    goBack()
  }

  function handlePlayAudio() {
    markExerciseListened(exercise!.id)
    setIsPlayingAudio(true)
  }

  return (
    <AppShell>
      <motion.div
        className="training-detail"
        style={{ ['--ex' as string]: exercise.color } as CSSProperties}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.button
          type="button"
          className="training-detail__back"
          onClick={leave}
          aria-label={backLabel}
          variants={item}
        >
          <ChevronLeftGlyph size={20} weight={2.2} />
          Wróć
        </motion.button>

        <motion.div className="training-detail__header u-liquid" variants={glassItem}>
          <div className="training-detail__title-row">
            <div className="training-detail__icon" aria-hidden="true" ref={iconRef}>
              {exerciseGlyph(exercise.id, 30)}
            </div>
            <div className="training-detail__titles">
              <h1>{exercise.titlePL}</h1>
              <p className="training-detail__subtitle">{exercise.titleEN}</p>
            </div>
          </div>
          <button className="training-detail__audio-btn" onClick={handlePlayAudio}>
            <span className="training-detail__audio-play" aria-hidden="true">
              <PlayGlyph size={15} />
            </span>
            Słuchaj opis ćwiczenia
            <span className="training-detail__audio-duration">{exercise.audioDuration}</span>
          </button>
        </motion.div>

        {isPlayingAudio && (
          <AudioModal
            title={exercise.titlePL}
            label="Ćwiczenie"
            duration={exercise.audioDuration}
            src={`/audio/exercise-${exercise.id}.mp3`}
            paragraphs={exerciseToParagraphs(exercise.fullDescription)}
            onClose={() => setIsPlayingAudio(false)}
          />
        )}

        <motion.div className="training-detail__content" variants={item}>
          <TrainingMarkdown text={exercise.fullDescription} />
        </motion.div>
      </motion.div>
    </AppShell>
  )
}
