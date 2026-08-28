import { useEffect, useRef } from 'react'
import { RETIRE_AT_REVIEW_COUNT, SERVING_MIN, SERVING_MAX } from '../../services/reviewConfig'
import './NextStepInfoSheet.css'

interface Props {
  onClose: () => void
}

interface Point {
  icon: string
  title: string
  text: string
}

/**
 * The mechanics behind the "Powtórka" element on Dziś, in plain language — how
 * the daily number is chosen, why not everything shows at once, what the colour
 * means, which words come first, when a word retires, what a lapse costs, and
 * what the listening breaks are. Same native <dialog> / slideUp as
 * NextStepInfoSheet, and shares its stylesheet.
 */
const POINTS: Point[] = [
  {
    icon: '🎯',
    title: 'Porcja skrojona na Ciebie',
    text: `Liczbę powtórek na dziś liczymy z Twojego celu czasowego i z tego, ile realnie się ostatnio uczysz — jeśli robisz mniej, porcja też jest mniejsza. Nigdy tyle, żeby Cię przytłoczyć: zawsze między ${SERVING_MIN} a ${SERVING_MAX}, dopasowane do dnia.`,
  },
  {
    icon: '📚',
    title: 'Powtórka ma koniec',
    text: 'Nawet jeśli zaległych słów uzbierało się trzysta, dziś zobaczysz tylko dzisiejszą porcję. Resztę chowamy i podajemy po trochu w kolejne dni. Powtórka jest zadaniem do odhaczenia, nie ścianą bez końca — i nie zjada czasu, który należy się nowym słowom.',
  },
  {
    icon: '🔺',
    title: 'Widzisz jednym spojrzeniem, jak stoisz',
    text: 'Kropka przy „Powtórce” zmienia kolor: zielona — jesteś na bieżąco, żółta — robi się kolejka, pomarańczowa — czas nadrobić. Tyle wystarczy, żeby wiedzieć, czy możesz spokojnie ruszyć dalej.',
  },
  {
    icon: '🧮',
    title: 'Najpierw to, co najważniejsze',
    text: 'Gdy zaległych jest więcej niż porcja, nie losujemy. Na przód idą słowa najdłużej zaległe, te świeżo nauczone (najłatwiej je stracić) i te, z którymi już raz czy dwa się potknąłeś. Słowa łatwiejsze niż Twój poziom i te tuż przed „emeryturą” grzecznie czekają na swoją kolej.',
  },
  {
    icon: '🎓',
    title: 'Słowo może przejść na emeryturę',
    text: `Kiedy przypomnisz sobie słowo poprawnie ${RETIRE_AT_REVIEW_COUNT} razy, w coraz większych odstępach (ostatni to pół roku), uznajemy, że po prostu je znasz. Wypada z powtórek na dobre — przestajemy Ci nim zawracać głowę. Jedna pomyłka i wraca, bez dramatu.`,
  },
  {
    icon: '🩹',
    title: 'Pomyłka nie cofa Cię na start',
    text: 'Klikasz „nie pamiętam” i słowo wraca jutro. Ale kara jest proporcjonalna: świeżo poznane wraca na sam początek, mocno utrwalone cofa się tylko o krok. Jeden gorszy dzień nie kasuje miesięcy pracy.',
  },
  {
    icon: '🎧',
    title: 'Chwila słuchania w środku',
    text: 'Co kilka kart wpada krótki przerywnik: parę słów z paczek, których jeszcze nie domknąłeś, granych i wypisanych na ekranie. Bez klikania, bez oceniania — czysty dodatkowy kontakt z materiałem. Nie masz słuchawek? „Pomiń” albo „Bez słuchania” i lecisz z fiszkami dalej.',
  },
]

export function ReviewPriorityInfoSheet({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="nextstepinfo"
      onClose={onClose}
      onClick={e => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="nextstepinfo__inner">
        <span className="nextstepinfo__handle" aria-hidden="true" />

        <h2 className="nextstepinfo__title">Twoja powtórka myśli za Ciebie</h2>
        <p className="nextstepinfo__sub">
          Nie wrzucamy Ci wszystkiego naraz i nie każemy zgadywać, co powtarzać. Każdego dnia dostajesz dokładnie tyle, ile ma sens — a o resztę system dba sam.
        </p>

        <ul className="nextstepinfo__list">
          {POINTS.map((pt, i) => (
            <li
              key={pt.title}
              className="nextstepinfo__item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="nextstepinfo__icon" aria-hidden="true">{pt.icon}</span>
              <div className="nextstepinfo__text">
                <h3 className="nextstepinfo__item-title">{pt.title}</h3>
                <p className="nextstepinfo__detail">{pt.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="nextstepinfo__sub" style={{ alignSelf: 'flex-start', marginTop: 0 }}>
          Nie musisz tego pamiętać — po to jest system. Ty klikasz «Powtórz», reszta dzieje się sama.
        </p>

        <button className="nextstepinfo__close" onClick={() => ref.current?.close()}>
          Zrozumiałem
        </button>
      </div>
    </dialog>
  )
}
