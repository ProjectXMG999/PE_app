import { useEffect, useRef } from 'react'
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
 * The mechanics behind the two Dziś recommendation cards, in the order a
 * learner would actually ask the questions: what am I looking at → why this
 * exact pack → why two cards instead of one → what does the level chip do.
 *
 * Kept out of jargon (no "currentIndex", no explaining what Trenuj vs Słuchaj
 * count as "done" without saying what that means for the reader) — each point
 * is one honest mechanic, not the full implementation.
 */
const POINTS: Point[] = [
  {
    icon: '🗺️',
    title: '10 000 słów, jedna sprawdzona kolejność',
    text: 'Nie proponujemy przypadkowych słówek — obie drogi idą po tej samej trasie, ułożonej według tego, które słowa naprawdę otwierają Ci rozmowy. Każda pokazuje pierwszą nieukończoną paczkę na swoim etapie trasy. Nie musisz niczego szukać ani wybierać — wystarczy iść za podpowiedzią.',
  },
  {
    icon: '🔁',
    title: 'Nic, czego się nauczyłeś, nie ucieka',
    text: 'Gdy jakieś słowo zaczyna Ci umykać, wskakuje przed nowym materiałem jako osobny krok „Powtórz”. Utrwalenie tego, co już umiesz, liczy się bardziej niż jeden dodatkowy dzień z nowym materiałem — po prostu zrób powtórkę, zanim pójdziesz dalej.',
  },
  {
    icon: '🎧⚡',
    title: 'Dwie osobne propozycje, nie jeden wybór',
    text: 'Słuchaj buduje rozpoznawanie — kończysz paczkę, gdy przesłuchasz ją do końca. Trenuj buduje aktywne przypominanie — kończysz, gdy sam, bez podpowiedzi, przypomnisz sobie każde słowo. To dwie różne umiejętności, więc każda ma własną kartę i własną paczkę — nie musisz wybierać jednej kosztem drugiej. Przełączaj się między nimi zakładkami u góry — obie drogi zawsze czekają, nawet gdy patrzysz na drugą.',
  },
  {
    icon: '🎯',
    title: 'Zaczynasz tam, gdzie naprawdę jesteś',
    text: 'Nie jesteś kompletnym początkującym? Nie musisz przechodzić od słowa 1. Wybierz swój poziom w pigułce obok daty — od tej chwili podpowiedzi pomijają wszystko poniżej niego.',
  },
  {
    icon: '📈',
    title: 'Widzisz, że to naprawdę działa',
    text: 'Gdy uczysz się szybciej niż w zeszłym tygodniu, pokazujemy Ci to wprost, obok rekomendacji. To nie ozdobnik — to policzone z Twoich własnych sesji.',
  },
  {
    icon: '⏱',
    title: 'Czas to przybliżenie',
    text: 'Minuty przy paczce liczymy na podstawie liczby słów. Twoje realne tempo może być inne — i to zupełnie normalne. Liczy się to, że robisz krok, nie to, ile dokładnie on zajmie.',
  },
]

/**
 * Explains how the two Dziś recommendation cards work. Native <dialog>,
 * matching every other sheet on Dziś (DailyGoalPicker, LevelPicker) and the
 * equivalent info sheet on Postęp — same handle bar, same slideUp entrance.
 */
export function NextStepInfoSheet({ onClose }: Props) {
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

        <h2 className="nextstepinfo__title">Twoje dwie drogi nauki</h2>
        <p className="nextstepinfo__sub">
          Zamiast zgadywać, czego się uczyć, dostajesz osobną podpowiedź dla Słuchaj i dla Trenuj. Oto jak z nich korzystać.
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
