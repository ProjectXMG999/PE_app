import { useNavigate } from 'react-router-dom'
import './TrainingPage.css'

const TRAINING_EXERCISES = [
  {
    id: 'word-in-action',
    titlePL: 'Słowo w Akcji',
    titleEN: 'Word in Action',
    description: 'Zrób pierwsze frazy ze słowem.',
    duration: '2 min',
    icon: '🎯',
  },
  {
    id: 'personal-sentence',
    titlePL: 'Moje Zdanie',
    titleEN: 'Personal Sentence Method',
    description: 'Zamień słowo w zdanie z Twojego życia.',
    duration: '3 min',
    icon: '💬',
  },
  {
    id: 'three-domains',
    titlePL: 'Jedno Słowo, Trzy Dziedziny',
    titleEN: 'One Word, Three Lives',
    description: 'Użyj słowa w domu, pracy i codzienności.',
    duration: '3 min',
    icon: '🌍',
  },
  {
    id: 'sentence-ladder',
    titlePL: 'Drabina Zdania',
    titleEN: 'Sentence Ladder',
    description: 'Rozwiń krótkie zdanie w prawdziwą wypowiedź.',
    duration: '4 min',
    icon: '📈',
  },
]

export function TrainingPage() {
  const navigate = useNavigate()

  return (
    <div className="training-page">
      <div className="training-header">
        <h1>Trening</h1>
        <p>Wybierz ćwiczenie i zacznij trenować</p>
      </div>

      <div className="training-grid">
        {TRAINING_EXERCISES.map(exercise => (
          <button
            key={exercise.id}
            className="training-card"
            onClick={() => navigate(`/trening/${exercise.id}`)}
          >
            <div className="training-card__icon">{exercise.icon}</div>
            <div className="training-card__content">
              <h3 className="training-card__title">{exercise.titlePL}</h3>
              <p className="training-card__subtitle">{exercise.titleEN}</p>
              <p className="training-card__description">{exercise.description}</p>
              <div className="training-card__footer">
                <span className="training-card__duration">🔊 {exercise.duration}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
