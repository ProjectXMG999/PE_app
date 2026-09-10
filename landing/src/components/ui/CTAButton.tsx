import './CTAButton.css'

interface Props {
  children: React.ReactNode
  subtext?: string
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export function CTAButton({ children, subtext, onClick, href, variant = 'primary', disabled = false }: Props) {
  const Tag = href ? 'a' : 'button'
  return (
    <div className="cta">
      <Tag
        className={`cta__btn cta__btn--${variant}${disabled ? ' cta__btn--disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
        href={disabled ? undefined : href}
        aria-disabled={disabled}
      >
        {children}
      </Tag>
      {subtext && <p className="cta__subtext">{subtext}</p>}
    </div>
  )
}
