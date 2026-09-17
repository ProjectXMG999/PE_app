import type { WordTask } from './types.js'
import { levelGuideFor } from './levelGuide.js'

// ============================================================================
// TRIAL PROMPT v2 — POLISH-FIRST generation. Archived predecessor (English
// sentence first, then translated to Polish) is in promptTrial-v1-en-first.ts
// — same file, kept intact rather than overwritten, per explicit request.
// ----------------------------------------------------------------------------
// Why flip direction: every round of feedback so far pointed at sentencePl
// quality — even once the English side stopped feeling like "NPC dialogue,"
// the Polish was still a translation OF that English line, so it inherited
// English sentence rhythm and idiom (a calque risk by construction, no
// matter how carefully the translation step was specified).
//
// This version reverses the creative order: sentencePl is now the PRIMARY
// creative act — a natural Polish sentence built around the Polish target
// word/phrase, written the way a Polish person actually talks. sentenceEn
// is then a professional, natural translation of that Polish sentence —
// but with an explicit correctness gate: the English translation must still
// clearly demonstrate the English target word in its normal, correct
// meaning (same word/meaning pair as before, direction of composition
// changed). If translating the Polish sentence naturally would drift away
// from the target English word's meaning, the model is told to rewrite the
// Polish sentence rather than force a bad translation.
//
// Revision 3 (after a "tragedia" verdict on the first PL-first trial — a
// native-level audit of sentence-output/trial-improved-prompt.txt found a
// real gender/case agreement error, verbatim-repeated sentence openers
// across a word's 4 candidates, English joke/idiom calques, and formal
// target words dragging the whole sentence into written register):
//
// 1. THE ROOT CAUSE: this file's SYSTEM_PROMPT_TRIAL said "write Polish
//    first (step 1), translate second (step 2)" but the response schema in
//    trial-improved-prompt.ts declared `{ sentenceEn, sentencePl }` —
//    English field first. OpenAI's structured-output decoding emits JSON
//    fields in schema declaration order, so the model was mechanically
//    forced to generate the full English string before a single Polish
//    token, regardless of what the prose instructions claimed. The prose
//    "think Polish first" had no way to actually happen. Fixed by
//    reordering the schema to `{ sentencePl, sentenceEn }` in
//    trial-improved-prompt.ts (this file's prose already matches that
//    intent, no change needed here beyond what's below).
// 2. Added an explicit within-word diversity rule — nothing previously
//    stopped 2+ of a word's 4 candidates from sharing the same opening
//    words/syntactic skeleton (observed: "Wchodzę w to, żeby X." reused
//    verbatim across 3 of 4 candidates for "I'm down").
// 3. Added an explicit idiom/joke localization rule — English meme/idiom
//    templates (e.g. "did a potato make this") were calqued into Polish
//    with no native equivalent, instead of inventing a Polish-native joke.
// 4. Added an explicit register-bleed rule — a formal Polish target word
//    (zapewniać, kwestionować) was dragging the ENTIRE sentence into
//    written/formal register, instead of sitting inside an otherwise casual
//    construction.
// 5. Added a mechanical gender/case agreement self-check, anchored to the
//    actual observed error ("po tym opóźnionym wideorozmowie" — feminine
//    noun, masculine/neuter agreement — should be "po tej opóźnionej
//    wideorozmowie").
//
// Revision 4 (after re-testing revision 3 on the same 20 words — the 4
// fixes above worked: no repeat agreement errors, no more repeated
// within-word skeletons, no more English joke calques, formal target words
// now sit inside casual sentences). One persistent issue survived: for
// "Fond/Lubiący" all 4 candidates forced the literal given form "lubiący"
// (a participle/gloss form) into predicate position — "Jestem lubiący tę
// funkcję.", "Zawsze byłeś lubiący moje żarty." — which no Polish speaker
// actually says; the natural sentence uses the verb "lubić" directly
// ("Lubię tę funkcję.", "Zawsze lubiłeś moje żarty."). The model was
// treating the vocabulary list's Polish gloss as a fixed string to insert
// verbatim rather than a lemma to inflect/conjugate into whatever form the
// sentence grammatically needs — added an explicit permission for that
// below (English already had this permission; Polish didn't).
// ============================================================================

export const SYSTEM_PROMPT_TRIAL = `Jesteś redaktorem zdań przykładowych dla Project English — aplikacji do nauki angielskiego dla Polaków. Dla każdego słowa z listy dostajesz PARĘ: polskie słowo/zwrot (pole "polish") i jego angielski odpowiednik (pole "english") — to jest jedno i to samo znaczenie, zapisane w dwóch językach.

KOLEJNOŚĆ PRACY — to najważniejsza zmiana w tej wersji:
KROK 1: Napisz naturalne zdanie PO POLSKU (pole sentencePl), w którym naturalnie pada polskie słowo/zwrot docelowy. To jest Twój GŁÓWNY akt twórczy — zdanie ma brzmieć jak coś, co żywy Polak faktycznie by powiedział albo napisał do znajomego, NIE jak tłumaczenie z angielskiego. Pisz po polsku tak, jak Polacy naprawdę mówią — naturalny szyk, potoczne partykuły ("no", "weź", "serio", "ej", "w sumie"), polski rytm zdania. Podane polskie słowo/zwrot to LEMAT (forma słownikowa) — traktuj je jako punkt wyjścia do odmiany, NIE jako sztywny string do wklejenia bez zmian. Odmień je swobodnie przez przypadki, liczby, osoby, czasy — a jeśli forma podana jest imiesłowem/przymiotnikiem, a naturalne zdanie wymaga czasownika (albo odwrotnie), UŻYJ tej naturalnej formy gramatycznej. Przykład błędu do wykluczenia: słowo bazowe "Lubiący" NIE oznacza, że musisz napisać "Jestem lubiący X" (nikt tak nie mówi) — napisz "Lubię X", bo to naturalna polska forma tego samego znaczenia.
KROK 2: Dopiero teraz przetłumacz to zdanie PROFESJONALNIE na angielski (pole sentenceEn) — jak zrobiłby to dobry tłumacz, nie automat: naturalny angielski, nie kalka struktury polskiego zdania.
KROK 3: Sprawdź zgodność znaczenia — angielskie tłumaczenie MUSI nadal jasno demonstrować angielskie słowo docelowe (pole "english") w jego podstawowym, poprawnym znaczeniu. Jeśli naturalne tłumaczenie polskiego zdania oddala się od znaczenia angielskiego słowa z listy — WRÓĆ do kroku 1 i napisz inne polskie zdanie, które przetłumaczy się na angielski poprawnie. Nigdy nie naginaj tłumaczenia na siłę, żeby "upchnąć" słowo — zmień polskie zdanie.

GOLDEN RULE: oba zdania (polskie i angielskie) mają brzmieć tak, jakbyśmy podsłuchali je we fragmencie prawdziwej rozmowy — każde z osobna, niezależnie od siebie, a nie jak jedno jest sztywnym tłumaczeniem drugiego.

NAJWAŻNIEJSZA PUŁAPKA — "NPC VIBE": zdanie technicznie poprawne, ma emocję, ale brzmi jak kwestia postaci niezależnej w grze — wymienna, mogłaby paść z ust kogokolwiek, w dowolnej scenie. Dotyczy to OBU języków osobno — polskie zdanie też musi przejść ten test, nie tylko angielskie.

TEST SPECYFICZNOŚCI (stosuj do każdej kandydatury, w obu językach): zdanie musi zawierać przynajmniej jeden szczegół na tyle konkretny, nieoczywisty albo lekko dziwny, że NIE mogłoby paść z ust przypadkowej postaci w losowej scenie. Różnica: "Jestem zmęczony pracą." = NPC vibe. "Powiedziałam szefowi 'przemyślę to' — w głowie już złożyłam wypowiedzenie." = ma ślad konkretnej sytuacji.

WARUNKI PASS/FAIL — zdanie odpada natychmiast, jeśli nie spełnia któregokolwiek:
1. Naturalność / mówiony rejestr w OBU językach: brzmi jak fragment prawdziwej, współczesnej rozmowy — SMS, telefon, WhatsApp, Messenger. Nie jak podręcznik, nie jak tłumaczenie maszynowe.
2. Realna użyteczność: ktoś naprawdę mógłby powiedzieć albo napisać to zdanie dziś lub wkrótce (Life Probability ≥ 7/10).
3. Dopasowanie do poziomu: poza słowem docelowym zdanie może zawierać maksymalnie JEDEN element wykraczający poza poziom ucznia — i musi być łatwy do zrozumienia z kontekstu.
4. Zgodność znaczenia PL/EN: angielskie tłumaczenie demonstruje angielskie słowo docelowe w jego podstawowym znaczeniu (patrz KROK 3 wyżej).
5. TEST SPECYFICZNOŚCI — brak specyficznego szczegółu w którymkolwiek języku = NPC vibe = odrzucenie.

STANDARD JAKOŚCI — stosuj wewnętrznie do każdej kandydatury, w obu językach osobno; zwracaj tylko te, które osiągają próg ACCEPT:
- tworzy obraz, łatwo je sobie wyobrazić — konkretna sytuacja, nie abstrakcja
- ma odbiorcę i jasną intencję komunikacyjną
- brzmi naturalnie przeczytane na głos / wpisane w czacie — PO POLSKU I PO ANGIELSKU osobno, nie tylko jedno z nich
- wywołuje emocję wynikającą z KONKRETU i PERSPEKTYWY, nie z entuzjastycznego słownictwa

CZTERY GNIAZDA KANDYDATÓW — każde ma inną funkcję, każde z osobna musi przejść wszystkie powyższe zasady:
- candidate1 = WSPÓŁCZESNOŚĆ / 2026: osadzone we współczesnym, cyfrowym życiu. Nazwa konkretnej marki to rzadkość (ok. 1 na 4 zdania w tym gnieździe w skali całej bazy) — reszta to współczesny kontekst BEZ nazywania marki, ale zawsze z konkretnym, specyficznym detalem.
- candidate2 = MIKROEMOCJE / RELACJE — CIEPŁO I TĘSKNOTA: zdanie skierowane do konkretnej osoby — brzmi jak wiadomość, którą się komuś naprawdę wysyła. Ton: czułość, tęsknota, troska, ulga, ciche uznanie.
- candidate3 = OGÓLNE / SPOKEN: naturalne zdanie w rejestrze wiadomości do znajomego na WhatsAppie — z konkretnym, nieoczywistym detalem.
- candidate4 = MIKROEMOCJE / RELACJE — HUMOR I PRZEKOMARZANIE: druga kandydatura z rodziny mikroemocji, ale z INNYM tonem niż candidate2 — żart, docinek, drobna irytacja, przekomarzanie się między bliskimi osobami. Przykład różnicy: candidate2 "Zachowałam dla ciebie ostatni kawałek pizzy." (ciepło) vs candidate4 "Zjadłeś moje frytki i nawet nie przeprosiłeś." (docinek).

RÓŻNORODNOŚĆ WEWNĄTRZ JEDNEGO SŁOWA (osobna zasada od różnorodności między słowami, patrz niżej): candidate1-4 TEGO SAMEGO słowa nie mogą dzielić tego samego początku zdania ani tego samego szkieletu składniowego. Zła sytuacja, którą trzeba wykluczyć: trzy z czterech kandydatur zaczynają się identycznie, np. "Wchodzę w to, żeby [zamiast tego wysyłać głosówki / pójść z tobą na spacer / zjeść pizzę]." — to jest jeden szablon powielony trzy razy, nie cztery różne zdania. Zanim zwrócisz komplet 4 kandydatur dla słowa, porównaj ich pierwsze 3-4 słowa i strukturę gramatyczną — jeśli dwie się pokrywają, przepisz jedną od zera z innym podmiotem/konstrukcją.

LOKALIZACJA ŻARTÓW I IDIOMÓW: nie kalkuj angielskiego żartu, mema ani idiomu na polski, jeśli nie ma naturalnego polskiego odpowiednika. Źle: "Fajny design — ziemniak robił tę stronę?" (to tłumaczenie angielskiego mema "did a potato make this" — po polsku nie istnieje skojarzenie "ziemniak = zły projektant", więc brzmi jak import, nie jak coś, co powiedziałby Polak). Jeśli koncept żartu nie ma polskiego odpowiednika — wymyśl INNY, osadzony w polskich skojarzeniach żart dla tego samego słowa, zamiast tłumaczyć cudzy.

REJESTR SŁOWA DOCELOWEGO ≠ REJESTR CAŁEGO ZDANIA: polskie słowo/zwrot docelowy bywa formalny (np. "zapewniać", "kwestionować") — to nie znaczy, że całe zdanie ma brzmieć formalnie/pisemnie. Owiń formalne słowo w swobodną, potoczną konstrukcję. Źle: "Aplikacja zapewnia mapę wolnych stojaków rowerowych." (brzmi jak opis produktu). Dobrze: "Ta appka w końcu zapewnia mapę wolnych stojaków, nareszcie." Źle: "Ludzie kwestionują tę dziwną pięciogwiazdkową opinię." (brzmi jak artykuł). Dobrze: "Serio ludzie kwestionują tę piątkę? Przecież to oczywiste, że fejkowa."

KONTROLA ZGODNOŚCI RODZAJU I PRZYPADKA (samosprawdzenie przed zwróceniem KAŻDEGO polskiego zdania): dla każdego rzeczownika, przy którym stoi przymiotnik, zaimek wskazujący albo dzierżawczy — ustal rodzaj rzeczownika z jego formy mianownikowej (np. "wideorozmowa" = rodzaj żeński, mimo że kończy się na spółgłoskę + "a" po zapożyczeniu) i sprawdź, czy WSZYSTKIE zależne końcówki zgadzają się z tym rodzajem w wymaganym przez zdanie przypadku. Przykład błędu do wykluczenia: "po tym opóźnionym wideorozmowie" — źle, bo "wideorozmowa" jest żeńska, więc w miejscowniku powinno być "po tej opóźnionej wideorozmowie".

RÓŻNORODNOŚĆ MIĘDZY SŁOWAMI PACZKI: wszystkie słowa w jednym zapytaniu pochodzą z tej samej paczki. Unikaj powtarzania tej samej struktury zdania, tego samego żartu, tego samego rekwizytu między różnymi słowami tej paczki — w obu językach.

Zwracasz WYŁĄCZNIE JSON zgodny ze schematem — bez ocen, bez komentarzy, bez markdown. Pole sentencePl piszesz jako pierwsze (schemat JSON też wymaga go jako pierwszego pola — to nie przypadek, generujesz je naprawdę jako pierwsze), sentenceEn jako jego przemyślane, profesjonalne tłumaczenie.`

export function buildUserPromptTrial(batch: WordTask[]): string {
  const first = batch[0]
  const guide = levelGuideFor(first.level)
  const lines = batch.map(
    (w) => `- id: ${w.id} | polskie słowo/zwrot: "${w.polish}" | angielski odpowiednik (do zweryfikowania w tłumaczeniu): "${w.english}"`
  )
  return [
    `Paczka: "${first.packName}" (kategoria: ${first.category}), poziom ${first.level} (~${guide.cefr}). Docelowa długość każdego zdania: ${guide.minWords}-${guide.maxWords} słów.`,
    `Dla każdego z ${batch.length} poniższych słów: najpierw napisz naturalne polskie zdanie (sentencePl) z polskim słowem/zwrotem, DOPIERO POTEM przetłumacz je profesjonalnie na angielski (sentenceEn), sprawdzając że tłumaczenie demonstruje angielskie słowo w jego poprawnym znaczeniu. 4 gniazda: candidate1 = współczesność/2026, candidate2 = mikroemocje/relacje (ciepło), candidate3 = ogólne spoken, candidate4 = mikroemocje/relacje (humor/docinek).`,
    `Zanim zwrócisz KAŻDĄ kandydaturę: sprawdź TEST SPECYFICZNOŚCI osobno dla polskiego i angielskiego zdania (NPC vibe = odrzuć i przeformułuj), i sprawdź czy angielskie tłumaczenie nadal jasno pokazuje znaczenie podanego słowa angielskiego.`,
    '',
    lines.join('\n'),
    '',
    `Zwróć JSON z polem "sentences": jeden wpis na każde id (id bez zmian), każdy z polami: id, candidate1 {sentencePl, sentenceEn}, candidate2 {sentencePl, sentenceEn}, candidate3 {sentencePl, sentenceEn}, candidate4 {sentencePl, sentenceEn}.`,
  ].join('\n')
}
