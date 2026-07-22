import { Link } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { TrainingOnboardingCard } from '../components/training/TrainingOnboardingCard'
import { TRAINING_EXERCISES, getListenedExercises } from '../data/trainingExercises'
import './TrainingPage.css'

export function TrainingPage() {
  const listened = getListenedExercises()

  return (
    <AppShell>
      <div className="training-page">
        <TrainingOnboardingCard />
        <div className="training-header">
          <h1>Language Performance Training</h1>
          <p>Poznaj 4 ćwiczenia, dzięki którym zaczniesz naprawdę mówić po angielsku.</p>
        </div>

        <div className="training-grid">
          {TRAINING_EXERCISES.map((exercise, idx) => (
            <Link
              key={exercise.id}
              to={`/trening/${exercise.id}`}
              viewTransition
              className="training-card"
              style={{ borderTopColor: exercise.color }}
            >
              <div className="training-card__top">
                <div
                  className="training-card__icon"
                  style={{
                    background: `color-mix(in srgb, ${exercise.color} 13%, transparent)`,
                    color: exercise.color,
                    viewTransitionName: `exercise-icon-${exercise.id}`,
                  }}
                >
                  {exercise.icon}
                </div>
                <span className="training-card__num">{String(idx + 1).padStart(2, '0')}</span>
              </div>
              <div className="training-card__content">
                <h3 className="training-card__title">{exercise.titlePL}</h3>
                <p className="training-card__subtitle">{exercise.titleEN}</p>
                <p className="training-card__description">{exercise.description}</p>
                <div className="training-card__footer">
                  <span className="training-card__duration">🔊 {exercise.duration}</span>
                  {listened.has(exercise.id) && (
                    <span className="training-card__done" aria-label="Odsłuchane">✓ Odsłuchane</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
