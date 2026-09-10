import { RevealOnScroll } from '../ui/RevealOnScroll'
import './ScientificFoundationSection.css'

const PILLARS = [
  {
    n: '1',
    name: 'Vocabulary Frequency & Lexical Coverage',
    lead: 'Nie wszystkie słowa mają taką samą wartość na tym samym etapie nauki.',
    body: 'Pierwsze kilka tysięcy najczęstszych rodzin wyrazów daje nieproporcjonalnie dużą część pokrycia codziennego języka — to jeden z podstawowych wniosków lingwistyki korpusowej (Paul Nation, Norbert Schmitt, Stuart Webb). Dlatego grupowanie słów wyłącznie według tematów nie musi oznaczać optymalnej kolejności uczenia się.',
    question: 'Czego warto nauczyć się wcześniej, żeby jak najszybciej zwiększać to, co można z językiem zrobić?',
  },
  {
    n: '2',
    name: 'Retrieval Practice',
    lead: 'Pamięć wzmacnia się nie tylko wtedy, kiedy ponownie widzimy odpowiedź, ale wtedy, kiedy próbujemy ją wydobyć.',
    body: 'Klasyczne badanie Jeffreya Karpicke\'a (Purdue) i Henry\'ego Roedigera (Washington University), opublikowane w Science w 2008 roku, dotyczyło m.in. nauki słownictwa języka obcego — powtórne studiowanie nie dawało takiego efektu jak kolejne próby retrieval.',
    question: 'Czy użytkownik tylko ponownie widzi słowo, czy musi spróbować znaleźć je we własnej pamięci?',
  },
  {
    n: '3',
    name: 'Output Hypothesis',
    lead: 'Rozumienie języka i produkowanie języka stawiają przed mózgiem inne wymagania.',
    body: 'Merrill Swain (University of Toronto/OISE) na podstawie kanadyjskich programów immersion pokazała, że konieczność samodzielnego produkowania języka uruchamia procesy, których samo rozumienie nie uruchamia w tym samym stopniu — tzw. „noticing the gap".',
    question: 'Ile razy użytkownik ma okazję sam coś powiedzieć, zanim system zrobi to za niego?',
  },
  {
    n: '4',
    name: 'Automaticity & Lexical Access',
    lead: 'Płynność wymaga nie tylko posiadania wiedzy, ale coraz szybszego dostępu do niej.',
    body: 'Robert DeKeyser (University of Maryland) i Norman Segalowitz (Concordia University) opisują fluency jako sprawność procesów pozwalających słowom pojawiać się w odpowiednim momencie bez nadmiernego obciążania uwagi.',
    question: 'Czy język istnieje tylko w pamięci użytkownika, czy staje się coraz szybciej dostępny podczas prawdziwej komunikacji?',
  },
  {
    n: '5',
    name: 'The Progress Principle',
    lead: 'Widoczny postęp może zmieniać sposób, w jaki człowiek postrzega własną zdolność do dalszej nauki.',
    body: 'Teresa Amabile (Harvard Business School) i Steven Kramer, analizując blisko 12 000 zapisów 238 osób, pokazali siłę „small wins". W edukacji Dale Schunk wiązał informację o postępie z wyższym self-efficacy i lepszym wykonaniem zadań.',
    question: 'Czy użytkownik jedynie ma nadzieję, że się rozwija, czy może zobaczyć wiarygodne dowody własnego postępu?',
  },
]

export function ScientificFoundationSection() {
  return (
    <section className="section section--wide scientific" id="scientific-foundation">
      <RevealOnScroll className="scientific__head">
        <p className="section__eyebrow">Scientific Foundation of Progress</p>
        <h2 className="section__title">Dlaczego uczymy właśnie w ten sposób</h2>
        <p className="section__lead">
          Częstotliwość. Retrieval. Output. Automatyzacja. Widoczny postęp.
          Pięć dobrze opisanych tradycji badawczych, z których czerpiemy przy projektowaniu treningu —
          nie pięć sloganów marketingowych.
        </p>
      </RevealOnScroll>

      <div className="scientific__list">
        {PILLARS.map((p, i) => (
          <RevealOnScroll key={p.n} delay={i * 0.08} className="pillar">
            <span className="pillar__num">{p.n}</span>
            <div className="pillar__content">
              <h3 className="pillar__name">{p.name}</h3>
              <p className="pillar__lead">{p.lead}</p>
              <p className="pillar__body">{p.body}</p>
              <p className="pillar__question">{p.question}</p>
            </div>
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll className="section__body scientific__footer">
        <p>
          Żaden z tych filarów sam w sobie nie stanowi kompletnej teorii nauki języka.
          Rozmowa z ludźmi, bogaty input, interakcja i realne doświadczenie języka nadal mają znaczenie.
          Scientific Foundation of Progress to próba przełożenia kilku trwałych idei na konkretne decyzje projektowe:
        </p>
        <p className="scientific__summary">
          priorytetyzuj to, co użyteczne · wymagaj przypominania · twórz okazje do produkcji ·
          ćwicz dostęp, nie tylko rozpoznanie · pokazuj postęp uczciwie.
        </p>
      </RevealOnScroll>
    </section>
  )
}
