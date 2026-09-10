import './Navbar.css'

export function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <a href="#hero" className="navbar__brand">
          <span className="navbar__mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" fill="url(#navbar-grad)" />
              <path d="M8 12.5 L10.5 15 L16 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        <a href="#offer" className="navbar__cta">Zacznij swój Progress</a>
      </div>
    </nav>
  )
}
