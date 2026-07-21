import { createPortal } from 'react-dom'
import './AudioModal.css'

interface AudioModalProps {
  title: string
  label: string
  duration: string
  src: string
  paragraphs: string[]
  onClose: () => void
}

export function AudioModal({ title, label, duration, src, paragraphs, onClose }: AudioModalProps) {
  return createPortal(
    <div className="audio-modal__overlay" onClick={onClose}>
      <div className="audio-modal" onClick={e => e.stopPropagation()}>
        <div className="audio-modal__header">
          <div className="audio-modal__meta">
            <span className="audio-modal__label">{label}</span>
            <span className="audio-modal__duration">{duration}</span>
          </div>
          <button className="audio-modal__close" onClick={onClose} aria-label="Zamknij">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <h2 className="audio-modal__title">{title}</h2>

        <div className="audio-modal__player">
          <audio controls autoPlay className="audio-modal__audio" onEnded={onClose}>
            <source src={src} type="audio/mpeg" />
          </audio>
        </div>

        <div className="audio-modal__transcript">
          <div className="audio-modal__transcript-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Transkrypcja
          </div>
          <div className="audio-modal__transcript-body">
            {paragraphs.map((p, i) => (
              <p key={i} className="audio-modal__paragraph">{p}</p>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
