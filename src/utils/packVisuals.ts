import { PackMeta } from '../types/vocabulary'
import { PackageProgress } from '../types/progress'

export const CATEGORY_ICONS: Record<string, string> = {
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

export const PACK_NAME_ICONS: Record<string, string> = {
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

export const LEVEL_COLORS: Record<number, string> = {
  1: '#eab308',
  2: '#f97316',
  3: '#22c55e',
  4: '#3b82f6',
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Rzeczowniki': '#8B5CF6',
  'Czasowniki': '#F59E0B',
  'Przymiotniki': '#10B981',
  'Przysłówki': '#3B82F6',
  'Phrasale': '#EC4899',
  'Slang': '#EF4444',
  'default': '#6B7280',
}

/** Emoji for a pack: name match first, then category, then a default book. */
export function getPackIcon(pack: Pick<PackMeta, 'name' | 'category'>): string {
  return PACK_NAME_ICONS[pack.name] ?? CATEGORY_ICONS[pack.category] ?? CATEGORY_ICONS.default
}

/** Category tint color, falling back to a neutral grey. */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default
}

/** Extract pack number badge: "t1-p07" → "7", "t1-p86" → "86". */
export function getPackNumber(id: string): string | null {
  const match = id.match(/p0*(\d+)$/)
  return match ? match[1] : null
}

export type PackStatus = 'new' | 'started' | 'completed' | 'mastered'

export function getStatus(progress: PackageProgress | undefined): PackStatus {
  if (!progress) return 'new'
  if (progress.masteredAt) return 'mastered'
  if (progress.completedAt) return 'completed'
  return 'started'
}

export const STATUS_META: Record<PackStatus, { label: string; className: string }> = {
  new:       { label: '',              className: '' },
  started:   { label: 'W toku',        className: 'packcard--started' },
  completed: { label: '✓ Odsłuchana',  className: 'packcard--completed' },
  mastered:  { label: '★ Opanowana',   className: 'packcard--mastered' },
}

/** Polish plural for "słowo": 1 → słowo, 2–4 → słowa, else → słów. */
export function plWords(n: number): string {
  const abs = Math.abs(n)
  const last = abs % 10
  const last2 = abs % 100
  if (abs === 1) return 'słowo'
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return 'słowa'
  return 'słów'
}
