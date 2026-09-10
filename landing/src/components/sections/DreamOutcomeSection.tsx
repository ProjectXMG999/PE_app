import { RevealOnScroll } from '../ui/RevealOnScroll'
import { CTAButton } from '../ui/CTAButton'
import './DreamOutcomeSection.css'

export function DreamOutcomeSection() {
  return (
    <section className="section dreamoutcome" id="dream-outcome">
      <RevealOnScroll y={48} duration={0.9}>
        <p className="section__eyebrow">9 · Dream outcome</p>
        <h2 className="dreamoutcome__title">
          Nie uczysz się po to, żeby zamienić A2 na B1.
        </h2>
      </RevealOnScroll>

      <RevealOnScroll y={40} duration={0.9} delay={0.1} className="section__body dreamoutcome__body">
        <p>
          Uczysz się, żeby zagadać do człowieka w Barcelonie. Wejść na meeting i powiedzieć
          dokładnie to, co myślisz. Poznać kogoś, kogo bez angielskiego nigdy byś nie poznał.
          Włączyć podcast i po prostu go słuchać. Podróżować dalej. Pracować szerzej.
          Rozmawiać z większą częścią świata.
        </p>
        <p className="dreamoutcome__punch">
          Nie chcemy, żebyś był lepszym uczniem angielskiego.
          <br />
          Chcemy, żeby angielski dał Ci większe życie.
        </p>
        <p className="dreamoutcome__tagline">From limited English to a bigger life.</p>
      </RevealOnScroll>

      <RevealOnScroll y={32} delay={0.2} className="section__body dreamoutcome__body">
        <p>
          Nie musisz dziś wiedzieć, jak dojść do 10 000 słów.
          Musisz zrobić pierwsze 10. Jutro Progress pokaże Ci następne.
        </p>
        <p>
          Możesz przez kolejne pół roku uczyć się wielu dobrych rzeczy w przypadkowej
          kolejności. Albo przez te same pół roku iść jedną trasą i dokładnie wiedzieć,
          co jest następne.
        </p>
        <p className="dreamoutcome__punch">Czas i tak minie. Pytanie, czy zobaczysz Progress.</p>
      </RevealOnScroll>

      <RevealOnScroll delay={0.3} className="section__cta-wrap">
        <CTAButton href="#offer" subtext="Pierwszy trening: około 10 minut.">
          Zacznij swój Progress
        </CTAButton>
      </RevealOnScroll>
    </section>
  )
}
