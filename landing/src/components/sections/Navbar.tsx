import './Navbar.css'

const LINKS = [
  { href: '#map', label: 'Mapa' },
  { href: '#two-modes', label: 'Jak to działa' },
  { href: '#proof', label: 'Dowody' },
  { href: '#offer', label: 'Cena' },
]

export function Navbar() {
  return (
    <nav className="navbar u-glass">
      <div className="navbar__inner">
        <a href="#hero" className="navbar__brand">
          <span className="navbar__mark" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" fill="url(#navbar-grad)" />
              <path
                d="M8 12.5 L10.5 15 L16 9"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="navbar-grad" x1="2" y1="2" x2="22" y2="22">
                  <stop offset="0" stopColor="var(--brand-purple)" />
                  <stop offset="1" stopColor="var(--accent-bright)" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          Progress
        </a>

        {/* The navbar used to be a wordmark and a single button. On a page this
            long that leaves a reader who wants the price with no way to get
            there but scrolling past every argument. Hidden below 860px, where
            there isn't room for them beside the CTA. */}
        <ul className="navbar__links">
          {LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} className="navbar__link">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#offer" className="navbar__cta">
          Zacznij swój Progress
        </a>
      </div>
    </nav>
  )
}
