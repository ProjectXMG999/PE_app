import { RevealOnScroll } from '../ui/RevealOnScroll'
import './RecognitionVsUseSection.css'

export function RecognitionVsUseSection() {
  return (
    <section className="section" id="recognition-vs-use">
      <RevealOnScroll>
        <p className="section__eyebrow">4 · Znasz więcej angielskiego, niż potrafisz użyć</p>
        <h2 className="section__title">
          Bo uczono Cię języka jak wiedzy, a nie umiejętności.
        </h2>
      </RevealOnScroll>

      <div className="quiz">
        <RevealOnScroll delay={0.05} className="quiz__step">
          <p className="quiz__prompt">Zróbmy prosty test. Jak nazywa się stolica Francji?</p>
          <p className="quiz__answer">Paryż.</p>
          <p className="quiz__note">Nie analizowałeś. Nie szukałeś. Odpowiedź po prostu się pojawiła.</p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1} className="quiz__step">
          <p className="quiz__prompt">Teraz przeczytaj:</p>
          <p className="quiz__en">„Can you bring me a charger?"</p>
          <p className="quiz__note">Rozumiesz? Prawdopodobnie tak.</p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.15} className="quiz__step quiz__step--reverse">
          <p className="quiz__prompt">A teraz odwróć kierunek. Chcesz powiedzieć:</p>
          <p className="quiz__pl">„Przyniesiesz mi ładowarkę?"</p>
          <p className="quiz__note quiz__note--strong">Jak szybko pojawiło Ci się <em>bring</em>?</p>
        </RevealOnScroll>
      </div>

      <RevealOnScroll className="section__body">
        <p>
          I właśnie tu jest różnica między rozpoznawaniem języka a dostępem do niego.
        </p>
        <p>
          W prawdziwej rozmowie nikt nie pokazuje Ci odpowiedzi. Musisz znaleźć słowo,
          zbudować zdanie i powiedzieć je w kilka sekund.
        </p>
        <p>
          I właśnie tu jest problem tradycyjnej nauki: często trenuje rozpoznawanie
          odpowiedzi, podczas gdy rozmowa wymaga samodzielnego wydobycia jej z głowy.
        </p>
        <p className="recognition__punch">Progress trenuje właśnie ten moment.</p>
      </RevealOnScroll>
    </section>
  )
}
