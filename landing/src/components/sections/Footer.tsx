import './Footer.css'

/**
 * The footer used to be a wordmark and a copyright line.
 *
 * For a subscription sold to Polish consumers that's both a credibility problem
 * and a compliance one: the buyer needs the terms, the privacy policy, the
 * 14-day right of withdrawal, who they're actually paying, and a way to reach
 * a human — before they hand over a card, not after.
 *
 * ⚠️ SELLER DETAILS AND LEGAL COPY ARE PLACEHOLDERS. Fill in SELLER below and
 * write the two documents in public/ before this goes live.
 */
const SELLER = {
  name: 'NAZWA SPRZEDAWCY sp. z o.o.',
  address: 'ul. PRZYKŁADOWA 1, 00-000 Miasto',
  nip: 'NIP 000-000-00-00',
  email: 'kontakt@example.com',
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__col footer__col--brand">
          <span className="footer__brand">Progress</span>
          <p className="footer__tagline">
            10 000 najbardziej użytecznych słów angielskiego, ułożonych w jedną trasę.
          </p>
        </div>

        <div className="footer__col">
          <h2 className="footer__heading u-kicker">Dokumenty</h2>
          <ul className="footer__list">
            <li><a href="/regulamin.html">Regulamin</a></li>
            <li><a href="/polityka-prywatnosci.html">Polityka prywatności</a></li>
            <li><a href="/regulamin.html#odstapienie">Odstąpienie od umowy</a></li>
          </ul>
        </div>

        <div className="footer__col">
          <h2 className="footer__heading u-kicker">Kontakt</h2>
          <ul className="footer__list">
            <li><a href={`mailto:${SELLER.email}`}>{SELLER.email}</a></li>
            <li className="footer__seller">{SELLER.name}</li>
            <li className="footer__seller">{SELLER.address}</li>
            <li className="footer__seller">{SELLER.nip}</li>
          </ul>
          <p className="footer__payments">Płatności obsługuje Stripe.</p>
        </div>
      </div>

      <p className="footer__copy">
        © {new Date().getFullYear()} Progress. Wszystkie prawa zastrzeżone.
      </p>
    </footer>
  )
}
