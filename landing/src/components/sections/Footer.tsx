import './Footer.css'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <span className="footer__brand">Progress</span>
        <p className="footer__copy">© {new Date().getFullYear()} Progress. Wszystkie prawa zastrzeżone.</p>
      </div>
    </footer>
  )
}
