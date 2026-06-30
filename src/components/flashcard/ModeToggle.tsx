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
        🃏 Fiszki
      </button>
      <button
        className={`modetoggle__btn ${mode === 'autoplay' ? 'modetoggle__btn--active' : ''}`}
        onClick={() => navigate(`/pakiet/${packageId}/autoplay`, { replace: true })}
      >
        🚗 Auto-play
      </button>
    </div>
  )
}
