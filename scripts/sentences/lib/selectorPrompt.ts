// ============================================================================
// SELECTOR PROMPT — picks the best existing candidate per word (it never
// writes new sentences). The rubric is the generation prompt itself
// (lib/prompt.ts, embedded verbatim) plus the owner's Style Guide: the
// owner wants candidates judged by the same definition of naturalness they
// were written against, not by any selection goal of the judge's own.
// Also lists the failure modes live testing showed generators actually
// produce, so the judge knows what to reject.
//
// Unlike the generator, the selector CAN see the whole base: every call gets
// the picks already made in the same pack, the most recent picks elsewhere,
// running composition stats, and fixed examples of the owner's own choices.
// That makes the guide's base-level proportions (20-30% questions, 30-40%
// Emotional Memory...) something it can actually steer toward, instead of a
// per-sentence wish.
// ============================================================================

import { SYSTEM_PROMPT as GENERATION_PROMPT } from './prompt.js'

export interface SelectorExemplar {
  english: string
  polish: string
  candidates: { n: number; pl: string; en: string }[]
  humanPick: number
}

export interface SelectorWordInput {
  wordId: string
  english: string
  polish: string
  candidates: { n: number; pl: string; en: string }[]
  humanNote?: string
}

export interface SelectorContext {
  packName: string
  category: string
  level: number
  cefr: string
  samePackPicks: { english: string; pl: string; en: string; source: 'człowiek' | 'AI' }[]
  recentPicks: { pl: string; en: string }[]
  // The owner's nearest earlier decisions WITH the candidates he passed
  // over — calibration showed chosen sentences alone don't convey what he
  // rejects (agreement with him was ~25% without this).
  nearbyDecisions: SelectorExemplar[]
  stats: string
}

export const INTENTS = [
  'request',
  'question',
  'reaction',
  'opinion',
  'decision',
  'refusal',
  'agreement',
  'emotion',
  'relationship',
  'planning',
  'problem_solving',
  'everyday_action',
] as const

export const TRAITS = ['emotional_memory', 'identity_builder', 'humor', 'short_reaction', 'modern_world'] as const

const STYLE_GUIDE = `PROJECT ENGLISH — SENTENCE STYLE GUIDE (dokument właściciela, obowiązuje w całości)

MANIFEST
Nie tworzymy 11 000 słów. Tworzymy 11 000 sytuacji życiowych. Ludzie nie uczą się języka po to, żeby znać słowa — uczą się go po to, żeby w odpowiednim momencie wiedzieć, co powiedzieć. Inne aplikacje uczą słów. Project English uczy myśli, reakcji i zdań, które człowiek naprawdę chce umieć powiedzieć.

TRZY WARSTWY PASS/FAIL — kandydatura odpada natychmiast, jeśli nie spełnia któregokolwiek:
1. Naturalność: brzmi jak człowiek. Nie jak podręcznik, nie jak nauczyciel, nie jak egzamin, nie jak tłumaczenie maszynowe. Źle: "I have a red pen." Dobrze: "I forgot my charger."
2. Realna użyteczność: realna szansa, że człowiek użyje tego zdania w prawdziwym życiu. Pytanie kontrolne: czy ktoś naprawdę mógłby to powiedzieć w rozmowie? Life Probability Score 1/10 prawie nigdy, 5/10 w określonej sytuacji, 10/10 bardzo prawdopodobne jeszcze dziś. Minimum 7/10.
3. Dopasowanie do poziomu: zgodne z poziomem paczki. Poza słowem docelowym maksymalnie jeden element wykraczający poza poziom ucznia (słowo, zwrot, idiom albo konstrukcja), łatwy do zrozumienia z kontekstu i nieutrudniający zrozumienia słowa docelowego. Słowo docelowe w podstawowym, częstym, użytecznym znaczeniu, chyba że paczka świadomie uczy znaczenia dodatkowego.

SENTENCE QUALITY SCORE (0-12; sześć kryteriów po 0/1/2; minimum 10/12; żadne kryterium nie może mieć 0):
- łatwo je sobie wyobrazić / tworzy obraz (źle: "I drink water." dobrze: "Can I get a bottle of water?")
- ma odbiorcę (partner, szef, kolega, kelner, siebie)
- ma intencję komunikacyjną — coś robi: prosi, zgadza się, odmawia, pyta, przeprasza, planuje
- brzmi dobrze na głos (przeczytane na głos brzmi dziwnie → wypada)
- ludzka wartość: choć odrobina życia — relacja, emocja, charakter, humor, ciekawość, troska, sprawczość albo rozpoznawalna codzienność; nie musi być zabawne ani coachingowe, ale musi być czymś więcej niż mechanicznym nośnikiem słowa
- jasność i konkretność: jedna jasna myśl, zrozumiała bez dodatkowego wyjaśnienia (0 = ogólne/abstrakcyjne/niejasne, 1 = zrozumiałe, ale do uproszczenia, 2 = jedna jasna myśl, zero zbędnych słów; źle: "Things are sometimes difficult.")

KANONICZNA DECYZJA: 0-8 REJECT, 9 REWRITE, 10-12 ACCEPT — i żadne kryterium nie może dostać 0.

TRZY FILARY STYLISTYCZNE (charakter całej bazy, nie sześć kryteriów punktowych):
- READY TO LIVE — fundament obowiązkowy dla 100% zdań. "Czy człowiek naprawdę mógłby kiedyś to powiedzieć?" Przykłady: I need five minutes. / Let's go. / I don't feel like it today. / I think you're right. / That's exactly what I wanted. / Give me a second. / I'll call you later. / I changed my mind.
- EMOTIONAL MEMORY — walor dodatkowy: mała emocja — uśmiech, zaskoczenie, ulga, ciekawość, ciepło, rozpoznanie własnego doświadczenia. Przykłady: My dog thinks he's the boss. / Coffee first. Decisions later. / Today my bed almost won. / I opened the fridge and forgot why. Emocja nie może być wymuszona.
- IDENTITY BUILDER — walor dodatkowy: delikatnie wzmacnia sposób myślenia, granice, sprawczość, troskę o siebie lub relacje. Mikrotożsamość, nie coaching. "I work every day." → "I finish what I start." / "I exercise." → "I take care of my body." / "I learn English." → "I keep my promises to myself." / "I like books." → "I'm curious how people think."

Emotional Memory i Identity Builder nie są obowiązkowe dla pojedynczego zdania — ich udział kontroluje się na poziomie paczki i całej bazy. Co najmniej 40% zdań w bazie powinno realizować jeden z tych dwóch filarów. "Give me a second.", "Can you repeat that?", "Where can I pay?" są znakomite jako czyste Ready to Live. Gdyby każde zdanie musiało mieć emocję lub mikrotożsamość, baza brzmiałaby sztucznie, coachingowo albo nadmiernie dowcipnie.

KOMPOZYCJA BAZY (docelowe proporcje): 100% Ready to Live; 30-40% Emotional Memory; 15-25% Identity Builder; 20-30% pytania; 10-15% lekki humor; 10-20% krótkie reakcje i komendy; reszta neutralne, bardzo praktyczne zdania sytuacyjne. Walor dodatkowy: osadzenie we współczesnym świecie (aplikacje, technologie, marki, media społecznościowe, współczesne sytuacje).

KANONICZNA LOGIKA WEJŚCIA — zdanie trafia do aplikacji tylko gdy: spełnia trzy warunki PASS/FAIL; ma min. 10/12 bez żadnego zera; realizuje Ready to Live; nie narusza Czerwonej Listy; ma walor dodatkowy, jeśli zwiększa on naturalność lub wartość komunikacyjną (nieobowiązkowe); zostało sprawdzone na głos; ma poprawne i naturalne tłumaczenie polskie; nie dubluje funkcji innego zdania w tej samej paczce.

CZERWONA LISTA — czego nigdy nie przepuszczamy:
1. Zdania podręcznikowe bez życia ("I have a red pen.", "Anna likes apples.", "The book is on the table.", "John is in the kitchen.", "This is a big house.")
2. Zdania sztuczne i nienaturalne ("I choose peace in my house.", "I perform my daily activities.", "I consume coffee every morning.", "I am experiencing happiness today.")
3. Dosłowne kalki z polskiego ("I have twenty years.", "Make me a photo.", "I feel myself good.", "I very like it.") — angielskie zdanie ma być naturalne po angielsku, nie tylko zgodne znaczeniowo.
4. Zdania zbyt trudne dla poziomu (dla A1/A2: wielokrotnie złożone zdania, rzadkie phrasal verbs, nietypowe idiomy, skomplikowane okresy warunkowe, formalne/literackie słownictwo).
5. Słowo docelowe ginie w nadmiarze treści ("Although I was exhausted after a difficult day at work, I eventually decided to choose a different option." → lepiej "I chose the easier option.").
6. Rzadkie, archaiczne lub metaforyczne znaczenie słowa przy pierwszym kontakcie.
7. Coaching i motywacja na siłę ("I can achieve anything.", "I am unstoppable.", "I attract success.", "Every day I become the best version of myself.", "I was born to win.") — mikrotożsamość ma być ludzka: "I need time to think.", "I can change my mind."
8. Humor wymuszony, infantylny lub memiczny: przypadkowy absurd, żarty niezrozumiałe kulturowo, zbyt dużo zdań o kawie, spaniu i poniedziałkach, dziecinne puenty. Jedno dobre zdanie z humorem lepsze niż pięć wymuszonych.
9. Nadmierna negatywność (zmęczenie, stres, porażki bez równowagi).
10. Nadmierna pozytywność ("I feel amazing every day.", "Everything is perfect.", "My life is wonderful.") — normalne życie, nie reklama suplementu.
11. Kontrowersje bez potrzeby: polityka, religia, przemoc, seks, choroby, tragedie, spory społeczne, silne oceny moralne.
12. Stereotypy: płeć, narodowość, wiek, zawód, wygląd, status społeczny, rodzina.
13. Zdania zależne od jednego modelu życia bez potrzeby (współmałżonek, dzieci, szef, samochód, pies, praca biurowa, dom).
15. Formalne, gdy istnieje prostsza wersja mówiona ("I would like to express my disagreement." → "I don't agree."; "Could you provide me with further information?" → "Can you tell me more?").
16. Zbyt długie (orientacyjnie A1 3-7 słów, A2 5-10, B1 7-14, B2 9-18).
17. Dwa lub więcej nowych problemów w jednym zdaniu (nowe słowo + idiom + konstrukcja + nietypowy przyimek + rzadki kontekst).
18. Powtarzalne schematy ("I like...", "I need...", "I want...", "I think..." w kółko).
19. Sztuczne zdania tworzone tylko po to, by "upchnąć" słowo.
20. Polskie tłumaczenie, którego nikt nie powiedziałby po polsku — obie wersje muszą być naturalne, sens zachowany, struktura nie musi być identyczna.
21. Niedokładne lub mylące tłumaczenie (zmieniona intencja, czas, osoba, stopień emocji albo kontekst).
22. Zdania bez jasnego celu — każde zdanie musi dać się oznaczyć intencją: request, question, reaction, opinion, decision, refusal, agreement, emotion, relationship, planning, problem solving, everyday action.

GOLDEN RULE: jeżeli człowiek nie powiedziałby tego naturalnie, nie powinien uczyć się tego jako jednego z 11 000 najważniejszych zdań swojego życia.`

const OBSERVED_FAILURES = `BŁĘDY, KTÓRE GENERATORY ZDAŃ NAPRAWDĘ POPEŁNIAJĄ (znalezione w testach) — kandydatura z którymkolwiek z nich odpada, nawet jeśli poza tym jest dobra:
- NPC vibe: poprawne, może nawet z emocją, ale wymienne — mogłoby paść z ust kogokolwiek w dowolnej scenie ("Jestem zmęczony pracą.").
- Kicz / wymuszona ekscentryczność: wymyślony dla efektu dziwaczny obrazek zamiast wiarygodnej sytuacji ("Ten dobrze wyszkolony pies zamyka lodówkę.", "Taśma przykleiła się do kota.").
- Kalka angielskiego żartu, mema albo idiomu przeniesiona do polskiego bez polskiego odpowiednika ("Fajny design — ziemniak robił tę stronę?", "spotkanie zjadło mi przerwę").
- Formalny rejestr całego zdania tylko dlatego, że słowo docelowe jest formalne ("Aplikacja zapewnia mapę wolnych stojaków rowerowych." brzmi jak opis produktu, nie jak człowiek).
- Błąd zgodności rodzaju/przypadka ("po tym opóźnionym wideorozmowie" zamiast "po tej opóźnionej wideorozmowie").
- Słowo docelowe wklejone w formie słownikowej zamiast naturalnie odmienione ("Jestem lubiący X" zamiast "Lubię X"), albo angielskie słowo wstawione do polskiego zdania ("Jestem fond X").
- Słowo wieloznaczne użyte w innym znaczeniu niż para PL/EN (polskie "za" jako "zbyt" przy słowie "beyond" → "beyond too loud", co nie jest angielskim).
- Angielskie tłumaczenie dodające albo zmieniające szczegóły względem polskiego (inna godzina, inna osoba, inny czas) — to błąd #21 z Czerwonej Listy.
- Sentymentalizm z kartki okolicznościowej zamiast konkretnego wspomnienia ("Twoja obecność zapewnia mi spokój.").`

const HOW_TO_CHOOSE = `JAK WYBIERASZ
Dla każdego słowa dostajesz ponumerowane kandydatury (numer = numer kolumny w arkuszu właściciela). Kandydatury mogą pochodzić z różnych rund generowania — oceniasz treść, nie numer.
1. Przepuść każdą kandydaturę przez PASS/FAIL, Czerwoną Listę i listę błędów z testów. Czytaj osobno zdanie polskie i angielskie — oba muszą być naturalne i zgodne znaczeniem.
2. Oceń pozostałe wg Sentence Quality Score. Kandydatury poniżej 10/12 albo z zerem w dowolnym kryterium nie wchodzą w grę.
3. Spośród kandydatur ACCEPT wybierz tę, która NAJPEŁNIEJ spełnia kryteria PROMPTU TWORZENIA ZDAŃ (pełna treść poniżej) — przede wszystkim naturalność tak, jak jest tam zdefiniowana. Oceniasz wyłącznie według tych kryteriów i style guide'a; nie wprowadzasz własnych celów ani upodobań spoza nich. Wcześniejsze wybory (przykłady, najbliższe decyzje właściciela, wybory w paczce) służą jako kontekst: spójność z bazą i unikanie dublowania — nie zastępują kryteriów promptu.
4. Przy zbliżonej jakości rozstrzygaj kontekstem (dostajesz go w każdym zapytaniu):
   - WYBORY W TEJ SAMEJ PACZCE: nie wybieraj zdania, które dubluje funkcję, schemat, żart albo rekwizyt zdania już wybranego w tej paczce.
   - OSTATNIE WYBORY z innych paczek: unikaj powtarzania tego samego schematu, tematu i rekwizytów, które przewijają się w ostatnich wyborach.
   - BIEŻĄCE PROPORCJE: jeśli jakiś udział odbiega od docelowych proporcji guide'a (np. za mało pytań, za dużo humoru), przy remisie jakościowym wybierz kandydaturę, która to wyrównuje. Nigdy nie wybieraj słabszego zdania tylko dla proporcji.
5. Jeśli żadna kandydatura nie spełnia progu ACCEPT, zwróć chosen = 0 — lepiej zostawić słowo do ręcznego przeglądu niż przepuścić słabe zdanie.
6. Jeśli przy słowie jest notatka właściciela (np. "2.3" = wahał się między 2 i 3, "1?" = raczej 1, "-" = nic mu nie pasowało), potraktuj ją jako mocną wskazówkę, ale nadal oceń sam.

ZWRACASZ dla każdego słowa: wordId; chosen (numer kandydatury albo 0); runnerUp (druga najlepsza kandydatura ACCEPT albo 0); intent (intencja wybranego zdania); traits (walory wybranego zdania: emotional_memory, identity_builder, humor, short_reaction, modern_world — tylko te, które naprawdę realizuje); reason (1 zdanie po polsku: dlaczego ta, a jeśli chosen = 0 — co jest nie tak z kandydaturami). Tylko JSON zgodny ze schematem.`

function formatExemplar(e: SelectorExemplar): string {
  const cands = e.candidates.map((c) => `   ${c.n}. ${c.pl} | ${c.en}`).join('\n')
  return `- "${e.polish}" / "${e.english}"\n${cands}\n   → właściciel wybrał: ${e.humanPick}`
}

export function buildSelectorSystemPrompt(exemplars: SelectorExemplar[]): string {
  return [
    'Jesteś redaktorem prowadzącym Project English — aplikacji do nauki angielskiego dla Polaków. Nie piszesz zdań. Wybierasz najlepsze z gotowych kandydatur, oceniając je dokładnie według promptu, według którego zostały stworzone.',
    `PROMPT TWORZENIA ZDAŃ (według niego powstały kandydatury — jego definicje naturalności, bramki PASS/FAIL, standard jakości i Czerwona Lista są Twoimi kryteriami oceny; fragmenty mówiące "napisz"/"wygeneruj" czytaj jako "oceń, czy kandydatura to spełnia"):\n\n${GENERATION_PROMPT}`,
    STYLE_GUIDE,
    OBSERVED_FAILURES,
    HOW_TO_CHOOSE,
    `PRZYKŁADY WYBORÓW WŁAŚCICIELA (kalibracja gustu — wszystkie kandydatury i to, co faktycznie wybrał):\n${exemplars.map(formatExemplar).join('\n')}`,
  ].join('\n\n')
}

export function buildSelectorUserPrompt(words: SelectorWordInput[], ctx: SelectorContext): string {
  const samePack =
    ctx.samePackPicks.length > 0
      ? ctx.samePackPicks.map((p) => `- [${p.source}] ${p.english}: ${p.pl} | ${p.en}`).join('\n')
      : '(brak — to pierwsze wybory w tej paczce)'
  const recent =
    ctx.recentPicks.length > 0 ? ctx.recentPicks.map((p) => `- ${p.pl} | ${p.en}`).join('\n') : '(brak)'
  const wordBlocks = words
    .map((w) => {
      const cands = w.candidates.map((c) => `  ${c.n}. ${c.pl} | ${c.en}`).join('\n')
      const note = w.humanNote ? `\n  notatka właściciela: "${w.humanNote}"` : ''
      return `wordId: ${w.wordId} — "${w.polish}" / "${w.english}"${note}\n${cands}`
    })
    .join('\n\n')

  const nearby =
    ctx.nearbyDecisions.length > 0 ? ctx.nearbyDecisions.map(formatExemplar).join('\n') : '(brak)'

  return [
    `Paczka: "${ctx.packName}" (kategoria: ${ctx.category}), poziom ${ctx.level} (~${ctx.cefr}).`,
    `NAJBLIŻSZE DECYZJE WŁAŚCICIELA (wszystkie kandydatury i co wybrał — ucz się też z tego, co odrzucił):\n${nearby}`,
    `WYBORY JUŻ DOKONANE W TEJ PACZCE:\n${samePack}`,
    `OSTATNIE WYBORY Z INNYCH PACZEK:\n${recent}`,
    `BIEŻĄCE PROPORCJE WYBORÓW AI (cele guide'a w nawiasach):\n${ctx.stats}`,
    `SŁOWA DO WYBORU:\n\n${wordBlocks}`,
  ].join('\n\n')
}
