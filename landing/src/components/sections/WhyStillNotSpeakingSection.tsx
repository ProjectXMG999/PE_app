import { RevealOnScroll } from '../ui/RevealOnScroll'
import './WhyStillNotSpeakingSection.css'

export function WhyStillNotSpeakingSection() {
  return (
    <section className="section whystill" id="why-not-speaking">
      <RevealOnScroll>
        <p className="section__eyebrow">5 · Dlaczego wciąż nie mówisz?</p>
        <h2 className="section__title">Języka nie uczysz się „chodząc na angielski"</h2>
      </RevealOnScroll>

      <RevealOnScroll className="section__body">
        <p>
          Jazdy na rowerze uczysz się jeżdżąc, gry na gitarze — grając, a mówienia — mówiąc.
          Możesz chodzić na lekcje przez 10 lat, ale jeśli przez ten czas słuchałeś
          nauczyciela, wypełniałeś ćwiczenia i uczyłeś się zasad, a nie trenowałeś
          mówienia — samo siedzenie na lekcji nie nauczy Cię mówić.
        </p>
        <p className="whystill__proverb">
          To, że mysz przez 10 lat mieszkała w stajni, nie znaczy, że została koniem.
        </p>
        <p>
          Progress został zbudowany jako trening języka, a nie kolejne miejsce do
          oglądania angielskiego. Słyszysz, przypominasz sobie, powtarzasz, budujesz
          zdania i mówisz. Bo język jest umiejętnością, a umiejętności się trenuje.
        </p>
        <p className="whystill__punch">
          Dlatego Progress został zaprojektowany tak, żebyś nie tylko słyszał poprawną
          odpowiedź. Najpierw próbujesz znaleźć ją sam.
        </p>
      </RevealOnScroll>
    </section>
  )
}
