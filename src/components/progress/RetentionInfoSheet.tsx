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
 * Explains the "Poziom zapamiętania" breakdown on Postęp — what memory strength
 * means, how a word climbs the tiers, and that the user doesn't have to do
 * anything special about it. Same native <dialog> / slideUp as the other info
 * sheets; shares NextStepInfoSheet.css.
 */
const POINTS: Point[] = [
  {
    icon: '🧠',
    title: 'Co znaczy „poziom zapamiętania"',
    text: 'Dla każdego opanowanego słowa system szacuje, po ilu dniach szansa na przypomnienie sobie tego słowa spadnie do około 90%. Im to dłużej, tym mocniej słowo siedzi w pamięci i tym rzadziej trzeba je powtarzać.',
  },
  {
    icon: '📈',
    title: 'Jak słowo awansuje',
    text: 'Za każdym razem, gdy przypomnisz sobie słowo w powtórce, odstęp do następnej rośnie: kilka dni → tydzień → miesiąc → rok. „Nie znam" cofa słowo o poziom niżej. Nie musisz nic liczyć — wystarczy robić powtórki, gdy słowa pojawią się na „Dzisiaj".',
  },
  {
    icon: '🌱',
    title: 'Świeże · Krzepnące · Utrwalone · Mocne',
    text: 'To progi trwałości pamięci: poniżej tygodnia, do 3 tygodni, do 2 miesięcy i dłużej. Nowo nauczone słowa zaczynają jako „Świeże" i awansują same, o ile regularnie je powtarzasz.',
  },
  {
    icon: '🎓',
    title: 'Na stałe',
    text: 'Po mniej więcej pół roku rosnących odstępów słowo wypada z codziennej rotacji. Wraca już tylko raz w roku — dla pewności, że wciąż je pamiętasz — i przestaje zajmować Ci czas w powtórkach.',
  },
  {
    icon: '🎯',
    title: 'Co z tym zrobić',
    text: 'Nic specjalnego. Duży udział „Świeżych" znaczy po prostu, że sporo się ostatnio nauczyłeś — te słowa z czasem awansują wyżej. Rosnący udział „Mocnych" i „Na stałe" to znak, że Twoje słownictwo naprawdę się utrwala.',
  },
]

export function RetentionInfoSheet({ onClose }: Props) {
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

        <h2 className="nextstepinfo__title">Jak czytać poziom zapamiętania</h2>
        <p className="nextstepinfo__sub">
          Twoje opanowane słowa, pogrupowane według tego, jak mocno trzymają się w pamięci.
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

        <button className="nextstepinfo__close" onClick={() => ref.current?.close()}>
          Zrozumiałem
        </button>
      </div>
    </dialog>
  )
}
