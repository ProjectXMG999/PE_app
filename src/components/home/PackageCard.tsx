import { useNavigate } from 'react-router-dom'
import { PackMeta } from '../../types/vocabulary'
import { PackageProgress } from '../../types/progress'
import './PackageCard.css'

const CATEGORY_ICONS: Record<string, string> = {
  'Rzeczowniki':  '🏷️',
  'Czasowniki':   '🎬',
  'Przymiotniki': '✨',
  'Przysłówki':   '🚀',
  'Phrasale':     '🧩',
  'Slang':        '😎',
  'Wulgaryzmy':   '💢',
  'Skróty':       '✂️',
  'Spójniki':     '➕',
  'Liczby':       '🔢',
  'Maleństwa':    '🌱',
  'Zaimki':       '👤',
  'default':      '📖',
}

const PACK_NAME_ICONS: Record<string, string> = {
  'Agresja': '👊',
  'Bibka': '🍺',
  'Biuro': '🏢',
  'Biznes': '💼',
  'Biznes zaczyna się w głowie': '🧠',
  'Biżuteria': '💍',
  'Budynki': '🏗️',
  'Ciągle w ruchu': '🏃',
  'Co poszło nie tak?': '❓',
  'Co się patrzysz?': '👀',
  'Czas': '⏰',
  'Czas I kolejność': '⏱️',
  'Czas I miary': '📏',
  'Czas to pieniądz': '💰',
  'Czasu mamy mało': '⏳',
  'Części ciała': '🦴',
  'Człowiek': '🧍',
  'Człowiek jest piękny': '💫',
  'Człowiekiem jestem': '🙋',
  'Demolki małe I duże': '💥',
  'Dla dorosłych': '🔞',
  'Dodanie kolejnej myśli': '💭',
  'Dolegliwości': '🤒',
  'Dom': '🏠',
  'Drzewa': '🌳',
  'Działania': '⚡',
  'Dziecko': '👶',
  'Dzięki, to miłe': '🙏',
  'Edukacja': '📚',
  'Elfy': '🧝',
  'Emocje': '😊',
  'Emocje I uczucia': '❤️',
  'Fantasy': '🏰',
  'Finanse': '💵',
  'Gadka': '💬',
  'Gangsterka': '🎩',
  'Gdy grasz w grę': '🎮',
  'Gdy musisz coś zmierzyć': '📐',
  'Geografia': '🗺️',
  'Higiena I wygląd': '🧴',
  'Ilość': '🔢',
  'Inaczej ubiorę to w słowa': '🔄',
  'It': '💻',
  'Jak często': '📅',
  'Jedzenie': '🍕',
  'Języki': '🌍',
  'Języki (I nie tylko)': '🌐',
  'Kalendarz I czas': '📅',
  'Kalkulator': '🧮',
  'Każdy to robi': '🤷',
  'Kierunek': '🧭',
  'Kierunek I miejsce': '📍',
  'Kolory': '🎨',
  'Komu? Czemu?': '🤔',
  'Komunikacja': '📱',
  'Kontrakcje': '✂️',
  'Kosmos': '🚀',
  'Kraje': '🌍',
  'Książki I pisownia': '📖',
  'Kto jest kto': '👥',
  'Kto pyta, nie błądzi': '❓',
  'Kto? Co?': '🎯',
  'Który na mecie': '🏆',
  'Kuchnia': '🍳',
  'Kultura': '🎭',
  'Love': '❤️',
  'Majsterkowanie': '🔨',
  'Mali, lecz ważni': '🌟',
  'Masterchef': '👨‍🍳',
  'Materiały I substancje': '⚗️',
  'Małżonkowie': '💑',
  'Media': '📺',
  'Memiczne': '😂',
  'Mentalne': '🧠',
  'Miary': '📏',
  'Miasto': '🏙️',
  'Miejsce': '📍',
  'Mile widziane': '😊',
  'Mistrz kierownicy': '🚗',
  'Mądre': '💡',
  'Na koncie': '💳',
  'Nagle': '⚡',
  'Najpiękniejsze słowa': '🌸',
  'Napoje': '🥤',
  'Natura': '🌿',
  'Nauki ścisłe': '🔬',
  'Nie przestawaj liczyć!': '🔢',
  'Niefajne': '😤',
  'Niefajne - Slang': '😡',
  'Ocieka splendorem': '✨',
  'Od świtu do zmierzchu': '🌅',
  'Ogniowe': '🔥',
  'Opakowania': '📦',
  'Orientuj się': '🧭',
  'Pani domu': '🏡',
  'Pewność': '💪',
  'Poczta': '📬',
  'Podryw': '😍',
  'Podróże': '✈️',
  'Pogoda': '🌤️',
  'Popularne': '⭐',
  'Porównania': '⚖️',
  'Praca': '💼',
  'Przemieszczanie się': '🚶',
  'Przemysł': '🏭',
  'Przestrzeń I położenie': '🗺️',
  'Przyczyna I skutek': '🔗',
  'Przykład': '📋',
  'Ptaki': '🐦',
  'Religia': '✝️',
  'Restauracja': '🍽️',
  'Rewelacja': '🎉',
  'Rodzina': '👨‍👩‍👦',
  'Rodzinka': '👨‍👩‍👧',
  'Romantyczne': '🌹',
  'Rozkmina': '🤔',
  'Rośliny I ogród': '🌻',
  'Ruch': '🏃',
  'Ruch I bezczynność': '⚡',
  'Ruch abstrakcyjny': '🌀',
  'Ryby': '🐟',
  'Rycerz': '⚔️',
  'Ręką': '✋',
  'Skala I intensywność': '📊',
  'Sport': '⚽',
  'Społeczeństwo': '👥',
  'Sprzęt elektroniczny': '📱',
  'Substancje': '⚗️',
  'Sukces': '🏆',
  'Szamka': '🍔',
  'Szkoła': '🎒',
  'Szybcy I wściekli': '🏎️',
  'Sądownicze': '⚖️',
  'Słaby moment': '😔',
  'Słodziak': '🍭',
  'Technologia': '💻',
  'Telefon': '📞',
  'To już (prawie) koniec': '🏁',
  'Transport': '🚌',
  'Ubrania': '👔',
  'Ucieczka': '🏃',
  'Umysłowe': '🧠',
  'Unikać': '🚫',
  'W odniesieniu do': '🔗',
  'W skali 1-10': '📊',
  'Wakacje': '🏖️',
  'Warzywa I owoce': '🥦',
  'Widzenie': '👁️',
  'Wieś': '🌾',
  'Witaj w świecie skrótów': '✂️',
  'Woda wszędzie': '💧',
  'Wojskowe': '🎖️',
  'Wszystko, co najlepsze': '🌟',
  'Wymaga wysiłku': '💪',
  'Wypadek': '🚑',
  'Wyższa matematyka': '📐',
  'Wzrost I spadek': '📈',
  'Zagrożenie': '⚠️',
  'Zawody': '🏅',
  'Zdrowie': '💊',
  'Znaki zodiaku': '♈',
  'Zostań w świecie skrótów': '✂️',
  'Zwierzęta': '🐾',
  'Złe': '😈',
  'Złota rączka': '🔨',
  'Śmierć': '💀',
  'Świat cyfrowy': '💻',
  'Światło': '💡',
  'Świętowanie': '🎊',
  'Życie': '🌱',
  'Atak klonów': '🤖',
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#eab308',
  2: '#f97316',
  3: '#22c55e',
  4: '#3b82f6',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Rzeczowniki': '#8B5CF6',
  'Czasowniki': '#F59E0B',
  'Przymiotniki': '#10B981',
  'Przysłówki': '#3B82F6',
  'Phrasale': '#EC4899',
  'Slang': '#EF4444',
  'default': '#6B7280',
}

interface Props {
  pack: PackMeta
  progress?: PackageProgress
  knownCount?: number
}

function getPackNumber(id: string): string | null {
  const match = id.match(/p0*(\d+)$/)
  return match ? match[1] : null
}

type PackStatus = 'new' | 'started' | 'completed' | 'mastered'

function getStatus(progress: PackageProgress | undefined): PackStatus {
  if (!progress) return 'new'
  if (progress.masteredAt) return 'mastered'
  if (progress.completedAt) return 'completed'
  return 'started'
}

const STATUS_META: Record<PackStatus, { label: string; className: string }> = {
  new:       { label: '',              className: '' },
  started:   { label: 'W toku',        className: 'packcard--started' },
  completed: { label: '✓ Odsłuchana',  className: 'packcard--completed' },
  mastered:  { label: '★ Opanowana',   className: 'packcard--mastered' },
}

export function PackageCard({ pack, progress, knownCount = 0 }: Props) {
  const navigate = useNavigate()
  const icon = PACK_NAME_ICONS[pack.name] ?? CATEGORY_ICONS[pack.category] ?? CATEGORY_ICONS.default
  const color = CATEGORY_COLORS[pack.category] ?? CATEGORY_COLORS.default
  const heardPct = progress ? Math.min((progress.currentIndex / pack.wordCount) * 100, 100) : 0
  const knownPct = pack.wordCount > 0 ? Math.min((knownCount / pack.wordCount) * 100, 100) : 0
  const status = getStatus(progress)
  const { label: statusLabel, className: statusClass } = STATUS_META[status]
  const packNum = getPackNumber(pack.id)

  return (
    <div
      className={`packcard ${statusClass}`}
      onClick={() => navigate(`/pakiet/${pack.id}`)}
      style={{ cursor: 'pointer' }}
    >
      {/* Status stripe — visible left border accent */}
      {status !== 'new' && <div className="packcard__stripe" />}

      <div className="packcard__header">
        {packNum && (
          <div className="packcard__num">
            <span
              className="packcard__num-text"
              style={{ color: pack.level ? LEVEL_COLORS[pack.level] : undefined }}
            >
              #{packNum}
            </span>
          </div>
        )}
        <div className="packcard__icon" style={{ background: `${color}22`, color }}>
          {icon}
        </div>
        <div className="packcard__info">
          <h3 className="packcard__name">{pack.name}</h3>
          <span className="packcard__meta">{pack.category}</span>
        </div>
        <div className="packcard__right">
          {statusLabel && (
            <span className={`packcard__status-pill packcard__status-pill--${status}`}>
              {statusLabel}
            </span>
          )}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      <div className="packcard__progress-row">
        <span className="packcard__count">
          {knownCount} / {pack.wordCount} opanowanych
        </span>
        {pack.level && (
          <span className="packcard__level">Level {pack.level}</span>
        )}
      </div>

      {(heardPct > 0 || knownPct > 0) && (
        <div className="packcard__bars">
          <div className="packcard__bar packcard__bar--heard">
            <div className="packcard__bar-fill" style={{ width: `${heardPct}%` }} />
          </div>
          <div className="packcard__bar packcard__bar--known">
            <div className="packcard__bar-fill" style={{ width: `${knownPct}%` }} />
          </div>
        </div>
      )}

      <div className="packcard__actions">
        <button
          className="packcard__btn packcard__btn--autoplay"
          onClick={(e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/start`) }}
        >
          <span>🎧</span> Słuchaj
        </button>
        <button
          className="packcard__btn packcard__btn--fiszki"
          onClick={(e) => { e.stopPropagation(); navigate(`/pakiet/${pack.id}/fiszki-start`) }}
        >
          <span>⚡</span> Trenuj
        </button>
      </div>
    </div>
  )
}
