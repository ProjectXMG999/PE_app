import { useNavigate, useParams } from 'react-router-dom'
import { StudyMode } from '../../types/progress'
import './ModeToggle.css'

interface Props {
  mode: StudyMode
}

export function ModeToggle({ mode }: Props) {
  const navigate = useNavigate()
  const { packageId } = useParams()

  return (
    <div className="modetoggle">
      <button
        className={`modetoggle__btn ${mode === 'fiszki' ? 'modetoggle__btn--active' : ''}`}
        onClick={() => navigate(`/pakiet/${packageId}/fiszki`, { replace: true })}
      >
        <div className="modetoggle__content">
          <div className="modetoggle__label">⚡ Aktywuj</div>
          <div className="modetoggle__sublabel">Flashcards</div>
        </div>
      </button>
      <button
        className={`modetoggle__btn ${mode === 'autoplay' ? 'modetoggle__btn--active' : ''}`}
        onClick={() => navigate(`/pakiet/${packageId}/autoplay`, { replace: true })}
      >
        <div className="modetoggle__content">
          <div className="modetoggle__label">🎧 Słuchaj</div>
          <div className="modetoggle__sublabel">Autoplay</div>
        </div>
      </button>
    </div>
  )
}
