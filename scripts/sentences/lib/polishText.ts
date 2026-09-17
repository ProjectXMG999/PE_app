// Whole-translation corrections the general rules can't infer (proper nouns,
// abbreviations, a broken quote, spelling). Keyed by the text after the general rules.
const EXACT_FIXES: Record<string, string> = {
  'Bośnia i hercegowina': 'Bośnia i Hercegowina',
  'Lek. Med.': 'Lek. med.',
  'P.N.E.': 'P.n.e.',
  'N.E.': 'N.e.',
  'Podkreślenie, że zrobiłem coś super ("Bang!)': 'Podkreślenie, że zrobiłem coś super ("Bang!")',
  'W tę i wewtę': 'W tę i we w tę',
  'Wyjaśnić coś (np. sytuacje)': 'Wyjaśnić coś (np. sytuację)',
}

// Proper nouns that legitimately follow "np." etc. — never lower-cased.
const PROPER_NOUNS = new Set(['Berlin', 'Manhattan'])

function lowerFirst(word: string): string {
  return PROPER_NOUNS.has(word) ? word : word.charAt(0).toLowerCase() + word.slice(1)
}

// Typographic clean-up of a translation from the word database, for display.
// The sheet was edited with sentence-case autocorrect, which capitalised the
// word after every abbreviation dot ("np. W grze") and the conjunction "i"
// ("małe I średnie"); spacing around punctuation is inconsistent too. Only
// typography changes — never the meaning. Text inside quotes is left alone
// ("Yes, I agree").
export function cleanPolishTranslation(text: string): string {
  let t = text.replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim()

  // Spacing: "( np." → "(np.", "internet  (" → "internet (", "kimś,czymś" → "kimś, czymś",
  // "Luksusowo/ git" → "Luksusowo/git", "nadrzędny,; główny" → "nadrzędny; główny"
  t = t
    .replace(/\( +/g, '(')
    .replace(/ +\)/g, ')')
    .replace(/([;,])(?=\p{L})/gu, '$1 ')
    .replace(/(\p{L}) *\/ *(\p{L})/gu, '$1/$2')
    .replace(/,;/g, ';')
    .replace(/[;,]+$/, '')
    .trim()

  // Abbreviation dots: "np ceny" → "np. ceny"
  t = t.replace(/\b([Nn]p)(?= \p{Ll})/gu, '$1.')

  // Case fixes, applied outside quoted fragments only
  t = t
    .split(/("[^"]*"?)/)
    .map((part, i) => {
      if (i % 2 === 1) return part
      return part
        // after an abbreviation: "np. W grze" → "np. w grze", "ds. Sprzedaży", "wew. Budynku", "Lic. Nauk"
        .replace(/((?:^|[\s(])(?:[Nn]p|ds|zew|wew|Lic)\. )(\p{Lu}\p{Ll}*)/gu, (_, pre, w) => pre + lowerFirst(w))
        // conjunction "i" anywhere but the very start: "małe I średnie", "(I nie", "; I super"
        .replace(/(^|[ (])I(?= )/g, (m, pre, offset) => (offset === 0 && i === 0 ? m : pre + 'i'))
        // new meaning / note / follow-up question starts lower-case: "; Iść za kimś", "(Moim celem", "komu? Czemu?"
        .replace(/(; |\(|[a-ząćęłńóśźż]\? )(\p{Lu}\p{Ll}+)(?=[\s)?,;]|$)/gu, (_, pre, w) => pre + lowerFirst(w))
        // "Iść" is autocorrect-capitalised mid-phrase: "Muszę Iść", "nigdzie nie Iść"
        .replace(/(?<=\S )Iść(?![\p{L}])/gu, 'iść')
    })
    .join('')

  return EXACT_FIXES[t] ?? t
}

// Short spoken form of a Polish translation, for recording word audio.
// The word database keeps the full translation ("Móc; umieć; potrafić",
// "Miasto (małe i średnie)") and that's what the app displays; a voice
// reading the notes and every alternative aloud sounds wrong, so audio uses
// the first meaning only. Shared by the CSV importer (parse-wizard-csv.ts)
// and apply-master-translations.ts so both produce the same `polishAudio`.
export function normalizePolishForAudio(translation: string): string {
  // 1. Usuń non-breaking spaces
  translation = translation.replace(/\xa0/g, ' ')

  // 2. Trim (usuń trailing spaces)
  translation = translation.trim()

  // 3. Usuń zawartość nawiasów PRZED splitem po średniku — średnik może być
  //    wewnątrz nawiasu ("Oszaleć (z wściekłości; przesadzać…)") i split
  //    zostawiłby niedomknięty nawias
  const noParens = translation.replace(/\s*\(.*?\)/g, '').trim()
  if (noParens) {
    translation = noParens
  } else {
    // Tłumaczenie było wyłącznie nawiasem (np. "(służy do wyrażania przyszłości)")
    // — użyj jego treści, z wielką literą jak pozostałe tłumaczenia
    translation = translation.replace(/[()]/g, '').trim()
    translation = translation.charAt(0).toUpperCase() + translation.slice(1)
  }

  // 4. Tylko pierwsze znaczenie (przed pierwszym średnikiem)
  if (translation.includes(';')) {
    translation = translation.split(';')[0].trim()
  }

  // 5. Ukośniki: "sam/sama" -> "sam lub sama"
  translation = translation.replace(/(\p{L}+)\/(\p{L}+)/gu, '$1 lub $2')

  // 6. Napraw urwane tłumaczenia (kończące się przecinkami itp.)
  if (translation.endsWith(',')) {
    translation = translation.slice(0, -1).trim()
  }

  return translation
}
