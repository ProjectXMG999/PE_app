/**
 * Polish plurals.
 *
 * Polish has three forms, not two: 1 → *słowo*, 2–4 → *słowa*, 5+ → *słów*, and
 * the teens (12–14) take the last form despite ending in 2–4. Every
 * `n === 1 ? 'a' : 'b'` ternary in the codebase therefore gets 2, 3 and 4 wrong
 * — which is how the Postęp page ended up saying "przez 3 minut" and
 * "2 słów w dzisiejszej porcji".
 *
 * Use these helpers anywhere a number meets a noun in user-facing copy.
 */

/**
 * @param one  form for exactly 1 ("minuta")
 * @param few  form for 2–4, excluding 12–14 ("minuty")
 * @param many form for 0, 5+, and the teens ("minut")
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n))
  if (abs === 1) return one
  const last = abs % 10
  const last2 = abs % 100
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few
  return many
}

export const plWords = (n: number) => plural(n, 'słowo', 'słowa', 'słów')
export const plPacks = (n: number) => plural(n, 'paczka', 'paczki', 'paczek')
export const plMinutes = (n: number) => plural(n, 'minuta', 'minuty', 'minut')
export const plDays = (n: number) => plural(n, 'dzień', 'dni', 'dni')
export const plSessions = (n: number) => plural(n, 'sesja', 'sesje', 'sesji')
export const plTimes = (n: number) => plural(n, 'raz', 'razy', 'razy')
export const plReviews = (n: number) => plural(n, 'powtórka', 'powtórki', 'powtórek')
export const plWeekends = (n: number) => plural(n, 'weekend', 'weekendy', 'weekendów')
export const plVolumes = (n: number) => plural(n, 'Tom', 'Tomy', 'Tomów')
export const plChapters = (n: number) => plural(n, 'rozdział', 'rozdziały', 'rozdziałów')
export const plCategories = (n: number) => plural(n, 'kategoria', 'kategorie', 'kategorii')

/** Agreement for past-tense participles that follow a count — "35 słów
 *  przerobionych" but "3 słowa przerobione". */
export const plPractised = (n: number) => plural(n, 'przerobione', 'przerobione', 'przerobionych')
