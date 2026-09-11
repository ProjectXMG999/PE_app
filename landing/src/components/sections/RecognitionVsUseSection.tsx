import { RevealOnScroll } from '../ui/RevealOnScroll'
import './RecognitionVsUseSection.css'

/**
 * "Znasz więcej angielskiego, niż potrafisz użyć" — merged with what used to be
 * a separate section 5, "Dlaczego wciąż nie mówisz?".
 *
 * They were one argument told twice: recognising a language is not the same as
 * being able to produce it, therefore practice has to be production. Splitting
 * that across two consecutive prose-column sections made the page longer without
 * making the case stronger. The quiz demonstrates it; the mouse-in-a-stable
 * proverb lands it.
 */
export function RecognitionVsUseSection() {
  return (
    <section className="section section--tinted" id="recognition-vs-use">
      <div className="section__inner">
        <RevealOnScroll>
          <p className="section__eyebrow u-kicker u-kicker--accent">Rozpoznajesz ≠ mówisz</p>
          <h2 className="section__title">
            Bo uczono Cię języka jak wiedzy, a nie umiejętności.
          </h2>
        </RevealOnScroll>

        <div className="quiz">
          <RevealOnScroll delay={0.05} className="quiz__step u-surface">
            <p className="quiz__prompt">Zróbmy prosty test. Jak nazywa się stolica Francji?</p>
            <p className="quiz__answer">Paryż.</p>
            <p className="quiz__note">Nie analizowałeś. Nie szukałeś. Odpowiedź po prostu się pojawiła.</p>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1} className="quiz__step u-surface">
            <p className="quiz__prompt">Teraz przeczytaj:</p>
            <p className="quiz__answer quiz__answer--en">„Can you bring me a charger?"</p>
            <p className="quiz__note">Rozumiesz? Prawdopodobnie tak.</p>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15} className="quiz__step quiz__step--reverse u-surface u-surface--strong">
            <p className="quiz__prompt">A teraz odwróć kierunek. Chcesz powiedzieć:</p>
            <p className="quiz__answer">„Przyniesiesz mi ładowarkę?"</p>
            <p className="quiz__note quiz__note--strong">
              Jak szybko pojawiło Ci się <em>bring</em>?
            </p>
          </RevealOnScroll>
        </div>

        <RevealOnScroll className="section__body">
          <p>
            I właśnie tu jest różnica między rozpoznawaniem języka a dostępem do niego.
            W prawdziwej rozmowie nikt nie pokazuje Ci odpowiedzi. Musisz znaleźć słowo,
            zbudować zdanie i powiedzieć je w kilka sekund.
          </p>
          <p>
            I właśnie tu jest problem tradycyjnej nauki: często trenuje rozpoznawanie
            odpowiedzi, podczas gdy rozmowa wymaga samodzielnego wydobycia jej z głowy.
          </p>
          <p>
            Jazdy na rowerze uczysz się jeżdżąc, gry na gitarze — grając, a mówienia —
            mówiąc. Możesz chodzić na lekcje przez 10 lat, ale jeśli przez ten czas
            słuchałeś nauczyciela, wypełniałeś ćwiczenia i uczyłeś się zasad, a nie
            trenowałeś mówienia — samo siedzenie na lekcji nie nauczy Cię mówić.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.08}>
          <blockquote className="proverb u-rail">
            To, że mysz przez 10 lat mieszkała w stajni, nie znaczy, że została koniem.
          </blockquote>
        </RevealOnScroll>

        <RevealOnScroll className="section__body">
          <p>
            Progress został zbudowany jako trening języka, a nie kolejne miejsce do
            oglądania angielskiego. Słyszysz, przypominasz sobie, powtarzasz, budujesz
            zdania i mówisz. Bo język jest umiejętnością, a umiejętności się trenuje.
          </p>
          <p className="section__punch">
            Nie tylko słyszysz poprawną odpowiedź. <em>Najpierw próbujesz znaleźć ją sam.</em>
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
