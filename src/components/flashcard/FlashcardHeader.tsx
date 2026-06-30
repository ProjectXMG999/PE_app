import { useNavigate } from 'react-router-dom'
import './FlashcardHeader.css'

interface Props {
  title: string
  current: number
  total: number
}

export function FlashcardHeader({ title, current, total }: Props) {
  const navigate = useNavigate()

  return (
    <div className="fc-header">
      <button className="fc-header__back" onClick={() => navigate('/')} aria-label="Wróć">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span className="fc-header__title">{title}</span>
      <div className="fc-header__progress">
        {current + 1} / {total}
      </div>
    </div>
  )
}
