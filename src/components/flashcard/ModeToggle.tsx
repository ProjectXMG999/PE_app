import { useParams } from 'react-router-dom'
import { StudyMode } from '../../types/progress'
import './ModeToggle.css'
import { useTransitionNavigate } from '../../navigation/transitions'

interface Props {
  mode: StudyMode
}

export function ModeToggle({ mode }: Props) {
  const navigate = useTransitionNavigate()
  const { packageId } = useParams()

  return (
    <div className="modetoggle">
      <button
        className={`modetoggle__btn ${mode === 'fiszki' ? 'modetoggle__btn--active' : ''}`}
        onClick={() => navigate(`/pakiet/${packageId}/fiszki`, { replace: true, direction: 'lateral' })}
      >
        <div className="modetoggle__content">
          <div className="modetoggle__label">⚡ Trenuj</div>
          <div className="modetoggle__sublabel">Z ekranem</div>
        </div>
      </button>
      <button
        className={`modetoggle__btn ${mode === 'autoplay' ? 'modetoggle__btn--active' : ''}`}
        onClick={() => navigate(`/pakiet/${packageId}/autoplay`, { replace: true, direction: 'lateral' })}
      >
        <div className="modetoggle__content">
          <div className="modetoggle__label">🎧 Słuchaj</div>
          <div className="modetoggle__sublabel">Bez ekranu</div>
        </div>
      </button>
    </div>
  )
}
