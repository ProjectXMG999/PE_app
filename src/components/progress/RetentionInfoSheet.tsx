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
 * Explains the retention breakdown on Postęp — what memory strength
 * means, how a word climbs the tiers, and that the user doesn't have to do
 * anything special about it. Same native <dialog> / slideUp as the other info
 * sheets used to; still styled by NextStepInfoSheet.css.
 */
const POINTS: Point[] = [
  {
    icon: '🧠',
    title: 'Skąd biorą się te grupy',
    text: 'Przy każdym opanowanym słowie liczymy, po ilu dniach zaczniesz je zapominać. Im dłużej słowo zostaje w pamięci, tym rzadziej musisz je powtarzać.',
  },
  {
    icon: '📈',
    title: 'Jak słowo przechodzi wyżej',
    text: 'Każda poprawna odpowiedź w powtórce wydłuża czas do następnej: z kilku dni do tygodnia, potem do miesiąca, a w końcu do roku. Gdy odpowiesz „Nie znam”, słowo spada o grupę niżej. Niczego nie musisz pilnować — wystarczy robić powtórki, które pojawiają się na ekranie Dzisiaj.',
  },
  {
    icon: '🌱',
    title: 'Nowe · Utrwalają się · Utrwalone · Dobrze znane',
    text: 'Grupy zależą od tego, jak długo słowo zostaje w pamięci: krócej niż tydzień, do 3 tygodni, do 2 miesięcy i dłużej. Każde słowo zaczyna w grupie „Nowe” i przechodzi wyżej, jeśli regularnie je powtarzasz.',
  },
  {
    icon: '🎓',
    title: 'Na stałe',
    text: 'Po mniej więcej pół roku słowo znika z codziennych powtórek. Wraca tylko raz w roku, żeby sprawdzić, czy nadal je pamiętasz, i nie zabiera Ci już czasu.',
  },
  {
    icon: '🎯',
    title: 'Co z tym zrobić',
    text: 'Nic szczególnego. Dużo słów w grupie „Nowe” oznacza po prostu, że ostatnio sporo się nauczyłeś — z czasem przejdą wyżej. Im więcej słów w grupach „Dobrze znane” i „Na stałe”, tym trwalsze jest Twoje słownictwo.',
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

        <h2 className="nextstepinfo__title">Jak dobrze pamiętasz słowa</h2>
        <p className="nextstepinfo__sub">
          Opanowane słowa podzielone według tego, jak długo zostają w pamięci.
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
