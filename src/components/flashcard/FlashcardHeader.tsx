import { HOME, useBack } from '../../navigation/navigation'
import './FlashcardHeader.css'
import { useTransitionNavigate } from '../../navigation/transitions'

interface Props {
  title: string
  current: number
  total: number
  packageId?: string
}

export function FlashcardHeader({ title, current, total, packageId }: Props) {
  const navigate = useTransitionNavigate()
  const { goBack, label, backLabel } = useBack()

  return (
    <div className="fc-header">
      <button
        className="fc-header__back"
        onClick={() => goBack()}
        aria-label={backLabel}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span className="fc-header__back-label">{label}</span>
      </button>

      <span className="fc-header__title">{title}</span>

      <button
        className="fc-header__home"
        onClick={() => navigate(HOME, { direction: 'back' })}
        aria-label="Strona główna"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </button>

      <div className="fc-header__progress">
        {current + 1} / {total}
      </div>
    </div>
  )
}
