import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AudioModal } from '../components/shared/AudioModal'
import { TrainingMarkdown } from '../components/training/TrainingMarkdown'
import {
  TRAINING_EXERCISES,
  exerciseToParagraphs,
  markExerciseListened,
} from '../data/trainingExercises'
import './TrainingPage.css'

export function TrainingExercisePage() {
  const { exerciseId } = useParams()
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const exercise = TRAINING_EXERCISES.find(e => e.id === exerciseId)
  if (!exercise) {
    return <Navigate to="/trening" replace />
  }

  function handlePlayAudio() {
    markExerciseListened(exercise!.id)
    setIsPlayingAudio(true)
  }

  return (
    <AppShell>
      <div className="training-detail">
        <Link className="training-detail__back" to="/trening">
          ← Wróć
        </Link>

        <div className="training-detail__header">
          <div className="training-detail__title-row">
            <div
              className="training-detail__icon"
              style={{
                background: `color-mix(in srgb, ${exercise.color} 13%, transparent)`,
                color: exercise.color,
              }}
            >
              {exercise.icon}
            </div>
            <div>
              <h1>{exercise.titlePL}</h1>
              <p className="training-detail__subtitle">{exercise.titleEN}</p>
            </div>
          </div>
          <button className="training-detail__audio-btn" onClick={handlePlayAudio}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Słuchaj opis ćwiczenia
            <span className="training-detail__audio-duration">{exercise.audioDuration}</span>
          </button>
        </div>

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

        <div className="training-detail__content">
          <TrainingMarkdown text={exercise.fullDescription} />
        </div>
      </div>
    </AppShell>
  )
}
