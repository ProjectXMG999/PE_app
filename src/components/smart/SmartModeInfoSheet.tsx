import { useEffect, useRef } from 'react'
import '../today/NextStepInfoSheet.css'

interface Props {
  onClose: () => void
}

interface Point {
  icon: string
  title: string
  text: string
}

/**
 * The sales pitch for Inteligentny, in plain language — what the mode actually
 * does for the learner and why it's worth tapping instead of picking manually.
 * Same native <dialog> / slideUp / stylesheet as NextStepInfoSheet and
 * ReviewPriorityInfoSheet, opened from the ⓘ on SessionHero.
 */
const POINTS: Point[] = [
  {
    icon: '🧠',
    title: 'Wie, jak Ci dziś idzie',
    text: 'System na bieżąco czyta Twoje odpowiedzi — jeśli świetnie sobie radzisz, od razu to widzi. Jeśli dzień jest trudniejszy, też to zauważa i reaguje. To nie zgadywanka, tylko decyzja oparta na Twoich realnych wynikach.',
  },
  {
    icon: '🎯',
    title: 'Jedna sesja, zero decyzji',
    text: 'Nie musisz się zastanawiać, czy dziś trenować, słuchać, czy powtarzać. Wsiadasz i jedziesz — Inteligentny sam miesza to wszystko w jedną, sensowną sesję skrojoną pod Twój dzisiejszy cel.',
  },
  {
    icon: '🚀',
    title: 'Podnosi poprzeczkę w idealnym momencie',
    text: 'Kiedy idzie Ci naprawdę dobrze, dorzuca słowa z trudniejszego, wyższego poziomu — zanim zdążysz się znudzić. Zawsze z uprzedzeniem, więc wiesz, że to bonus za dobrą passę, a nie przypadek.',
  },
  {
    icon: '🧩',
    title: 'Koniec z utkniętymi resztkami',
    text: 'Te uparte dwa słówka, które zapętlały pakiet w nieskończoność? Trafiają do powtórek razem z resztą, zamiast męczyć Cię osobną, wiecznie tą samą sesją. Pakiet kończy się naturalnie.',
  },
  {
    icon: '🛡️',
    title: 'Chroni to, co już umiesz',
    text: 'Nowe słowa i inteligentnie dobrane powtórki idą w jednym pakiecie, więc nic Ci po cichu nie umyka. Nie musisz o tym pamiętać ani niczego pilnować — to jego jedyna robota.',
  },
  {
    icon: '⚖️',
    title: 'Sam reguluje proporcje',
    text: 'Kiedy powtórki idą Ci dobrze przez dłuższy czas, przestaje Cię nimi męczyć i oddaje więcej miejsca nowym słowom. Kiedy zaczynasz się gubić, robi odwrotnie — dokłada powtórek kosztem nowości i przywraca słowa szybciej, żeby nie zdążyły wypaść Ci z głowy.',
  },
  {
    icon: '🏆',
    title: 'Docenia Twoją passę',
    text: 'Kilka mocnych sesji z rzędu i sam zaproponuje podniesienie domyślnego poziomu — z jasnym wyjaśnieniem, co się zmieni. Ty decydujesz, on tylko podsuwa dobry moment.',
  },
]

export function SmartModeInfoSheet({ onClose }: Props) {
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

        <h2 className="nextstepinfo__title">Twój osobisty trener słownictwa</h2>
        <p className="nextstepinfo__sub">
          Genialne w tym trybie jest to, że w ogóle nie musisz o niczym myśleć —
          on sam wie, czego dziś potrzebujesz, i dobiera to za Ciebie, lepiej niż
          zrobiłbyś to sam.
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
          Krótko mówiąc: to najbliżej, jak można się znaleźć prawdziwemu trenerowi,
          który pamięta każdą Twoją sesję i zawsze wie, co dalej.
        </p>

        <button className="nextstepinfo__close" onClick={() => ref.current?.close()}>
          Super, zaczynajmy
        </button>
      </div>
    </dialog>
  )
}
