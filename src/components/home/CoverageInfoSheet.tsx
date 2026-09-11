import { useEffect, useRef } from 'react'
import { coveragePct } from '../../utils/coverage'
import { LEVEL_META } from '../../data/levels'
import './CoverageInfoSheet.css'

interface Props {
  knownWords: number
  onClose: () => void
}

/**
 * Where the percentage comes from — and what it is not.
 *
 * The product's own scientific section sets the bar this sheet has to clear:
 * "Jednocześnie mierzenie musi być uczciwe. Liczba odsłuchanych słów nie
 * powinna być nazywana liczbą słów opanowanych, jeśli system tego nie
 * sprawdził." A capability figure with no stated basis would fail exactly that
 * test, so the estimate ships with its assumptions attached.
 */
export function CoverageInfoSheet({ knownWords, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])

  return (
    <dialog
      ref={ref}
      className="covinfo"
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) ref.current?.close() }}
    >
      <div className="covinfo__inner">
        <span className="covinfo__handle" aria-hidden="true" />
        <h2 className="covinfo__title">Skąd ta liczba</h2>
        <p className="covinfo__lead">
          Znasz <strong>{knownWords.toLocaleString('pl-PL')}</strong> słów, co daje około{' '}
          <strong>{coveragePct(knownWords)}%</strong> słów w typowej rozmowie.
        </p>

        <p className="covinfo__text">
          Słowa w języku nie występują równo często. Kilkaset najczęstszych pokrywa
          większość tego, co ludzie mówią, a kolejne tysiące dodają precyzję i odcienie.
          Dlatego <strong>kolejność jest tu ważniejsza od liczby</strong> — uczysz się
          słów w kolejności użyteczności, więc pierwszy tysiąc daje najwięcej.
        </p>

        <ul className="covinfo__list">
          {LEVEL_META.map(l => (
            <li key={l.level} className={knownWords >= l.threshold ? 'is-reached' : ''}>
              <span className="covinfo__list-n">{l.threshold.toLocaleString('pl-PL')}</span>
              <span className="covinfo__list-b">
                <strong>~{coveragePct(l.threshold)}%</strong> · {l.name}
                <em>{l.promise}</em>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="covinfo__sub">Czym to jest, a czym nie</h3>
        <p className="covinfo__text covinfo__text--fine">
          To <strong>szacunek, nie pomiar</strong>. Opiera się na badaniach pokrycia
          leksykalnego (Nation, Schmitt, Webb; korpusy BNC/COCA) i na założeniu, że
          kolejność naszej trasy odpowiada kolejności użyteczności. Liczba dotyczy
          mowy codziennej — w tekstach naukowych czy prawniczych to samo słownictwo
          pokrywa mniej. Nie mierzymy Twojego rozumienia bezpośrednio; mierzymy, ile
          słów potwierdziłeś, i przeliczamy to na typową rozmowę.
        </p>

        <button className="covinfo__close" onClick={() => ref.current?.close()}>
          Rozumiem
        </button>
      </div>
    </dialog>
  )
}
