# Trening — burza mózgów: rewolucyjny rozwój

## Kontekst

### Koncepcja produktu

Progress to nie kolejna apka z treścią do nauki angielskiego — obietnica to **mapa/nawigacja**:
10 000 najużyteczniejszych słów angielskich uporządkowanych wg częstości użycia (nie wg
kategorii tematycznych typu "Mój dom"), więc użytkownik zawsze wie *co dalej* i *jak daleko
zaszedł*. Landing: `landing/copywriting_lp.txt`, `landing/sekcja_naukowe_lp.txt`.

Pięć filarów naukowych deklarowanych w komunikacji produktowej:
- częstość leksykalna → kolejność słów (Nation, Schmitt, Webb)
- retrieval practice → aktywne przypominanie zamiast podpowiedzi (Karpicke & Roediger)
- Output Hypothesis → produkcja/mówienie, nie tylko rozpoznawanie (Swain)
- automatyzacja / szybkość dostępu leksykalnego (DeKeyser, Segalowitz)
- "Progress Principle" → widoczny, uczciwy postęp (Amabile, Bandura)

Dwa tryby nauki: **Słuchaj** (audio, ekran wyłączony) i **Trenuj** (aktywne przypominanie
na telefonie).

Silnik adaptacyjny: FSRS-4.5 (`src/services/fsrs.ts`, `docs/system-powtorek.md`) +
`comfort.ts` (poziom komfortu 1.0–4.9 sterujący trudnością) + `reviewHealth.ts` (EWMA,
cel retencji 0.85, dwie sprzężone pętle sterujące proporcją review/new) + `smartQueue.ts`
(komponowanie sesji learn/review/stretch).

Treść: 4 poziomy (L1 "Survival English" ~1000 słów → L4 "World-Class English" ~10 000
słów), Tomy → Rozdziały → 864 Paczki (`src/data/packs/*.json`). Audio generowane przez
ElevenLabs z rotującymi głosami PL/EN, z osobnym pipeline'em QA jakości wymowy
(`docs/voicelab.md`, technika carrier-phrase).

Znane, już zdiagnozowane luki (`docs/strona-pakiety.md`): strona Pakiety nie
personalizuje jeszcze kolejności (każdy widzi to samo), a treść zdaniowa jest martwa —
wszystkie 11 375 słów mają `sentenceEn: null`, mimo że zweryfikowane zdania istnieją
w pipeline, ale nie zostały zaaplikowane.

### Stan strony Trening (dziś)

`/trening` to osobna, statyczna sekcja — 4 karty ćwiczeń mówieniowych: *Słowo w Akcji*,
*Moje Zdanie*, *Jedno Słowo, Trzy Dziedziny*, *Drabina Zdania*
(`src/pages/TrainingPage.tsx`, `src/data/trainingExercises.ts`). To czysty instruktaż
(tekst + audio wyjaśniające), **bez przechwytywania odpowiedzi i bez oceny** — user ma
mówić na głos poza aplikacją.

Zapisywana jest wyłącznie lokalna flaga "odsłuchane" (`lp_exercises_listened` w
`localStorage`) — zero danych o tym, czy ktoś faktycznie ćwiczy, zero informacji
zwrotnej, brak synchronizacji.

Prawdziwy silnik quizowy (fiszki, Znam/Nie znam, cała inteligencja FSRS/comfort/
reviewHealth) żyje osobno — w `WordFlashPage.tsx` i `SmartSessionPage.tsx` — i nigdy
się nie styka z Treningiem.

Odznaka `speakingSessions` w systemie osiągnięć jest podpięta pod ambient autoplay
(`useMediaSession.ts`), **nie** pod faktyczne użycie Treningu — fałszywy sygnał, appka
myśli że mierzy mówienie, a nie mierzy.

**Diagnoza**: to największa rozbieżność między obietnicą marketingową (Output
Hypothesis — aktywna produkcja języka) a rzeczywistością produktu. Trening każe
użytkownikowi "powiedz to na głos", ale aplikacja jest głucha — nie słyszy, nie
ocenia, nie pamięta.

---

## A. Zamknięcie pętli zwrotnej (fundamentalna dźwignia)

1. **ASR + automatyczna ocena wymowy/płynności** (Whisper API / Web Speech API) —
   zamienia Trening z ulotki instruktażowej w faktyczne ćwiczenie z oceną.
2. **Self-recording playback** — nagraj się i odsłuchaj obok głosu native'a (z
   istniejącego pipeline'u TTS). Tani, szybki MVP bez AI, natychmiast domyka
   "nie słyszę siebie".
3. **Shadowing mode** — mów równolegle z audio TTS, ocena rytmu/tempa przez
   porównanie energii sygnału (tańsza alternatywa dla pełnego ASR).
4. **Minimalna telemetria** — zapis realnego wykonania ćwiczenia (nie tylko
   "odsłuchane") do `saveSession()`, żeby cokolwiek dało się zmierzyć i iterować.

## B. Integracja Treningu z silnikiem adaptacyjnym (dziś żyje w oderwaniu)

5. **Ćwiczenia Trening jako pełnoprawny trainMode** w `smartQueue.ts` — rozstawiane
   i powtarzane w czasie jak fiszki, nie jednorazowa "przeczytana instrukcja".
6. **Trudność ćwiczeń mówieniowych sterowana przez `comfort.ts`/`reviewHealth.ts`** —
   im lepiej user radzi sobie z produkcją, tym śmielsze konstrukcje.
7. **Ćwiczenia budowane wyłącznie ze słów już opanowanych** (na bazie `stability` z
   FSRS) — "mów tylko tym, czego już się nauczyłeś", spójne z filozofią mapy/kolejności.

## C. AI jako partner do produkcji językowej (największy skok jakościowy)

8. **Konwersacyjny AI partner (roleplay) ograniczony do słownictwa użytkownika** —
   unikalna przewaga: baza 10k słów + poziomy dają naturalny "vocabulary cap" dla LLM,
   czego generyczne apki (Duolingo, ChatGPT) nie mają.
9. **Mikroscenariusze sytuacyjne** (kawiarnia, rozmowa o pracę, wynajem mieszkania)
   budowane z paczek na aktualnym poziomie użytkownika.
10. **Personalizowane zdania "z życia użytkownika"** (praca, hobby zebrane raz)
    generowane na żywo przez AI zamiast generycznych przykładów.
11. **AI-coach z konkretnym feedbackiem po nagraniu** (nie "dobrze/źle", tylko
    realna wskazówka gramatyczna/leksykalna).

## D. Motywacja i społeczność (zgodnie z zasadą "no punishing gamification")

12. **Prawdziwe podpięcie odznaki `speakingSessions`** pod realne użycie Treningu
    zamiast pod ambient autoplay.
13. **Współpraca zamiast rywalizacji** — wspólne wyzwania tygodniowe, partner do
    praktyki, niepunitywne (spójne z odrzuceniem "punishing gamification" w
    `docs/strona-pakiety.md`).
14. **"Głosowy pamiętnik"** — spaced repetition własnych nagrań: usłysz siebie
    sprzed miesiąca vs teraz, namacalny dowód postępu (spójne z "Progress Principle").

## E. Jakość i zaufanie (rozszerzenie istniejącego pipeline'u audio)

15. **Wykorzystanie istniejącego pipeline'u TTS/voicelab** do porównania wymowy
    usera z głosem referencyjnym — ta sama infrastruktura co carrier-phrase QA,
    tylko odwrócona.
16. **Warstwa premium**: okresowy przegląd nagrań przez człowieka-tutora — hybryda
    AI+human, wykorzystuje już zintegrowany Stripe do monetyzacji.

---

## Macierz: szybkie wygrane vs duże zakłady

| Skala | Pomysły |
|---|---|
| Szybkie/tanie | #2 self-recording, #4 telemetria, #12 poprawka odznaki |
| Średnie | #5 integracja z smartQueue, #6/#7 adaptacja trudności, #3 shadowing |
| Duże zakłady | #8 konwersacyjny AI partner, #1 pełny ASR, #16 human review |

## Sugerowana sekwencja do dyskusji (nie decyzja)

1. Telemetria + self-recording — zacząć cokolwiek mierzyć
2. Integracja z `smartQueue` — Trening żyje w tym samym silniku co reszta appki
3. ASR + ocena — faktyczne zamknięcie pętli Output Hypothesis
4. Konwersacyjny AI partner — najbardziej "rewolucyjna" różnica względem konkurencji

## Otwarte pytania / ryzyka

- Koszt i prywatność ASR w chmurze (Whisper API per-request) vs rozwiązanie on-device.
- Zgodność z zasadą "nieudowodnionych twierdzeń" (`docs/strona-pakiety.md`) — efekt
  trzeba będzie zmierzyć, zanim się go zareklamuje.
- Czy warto zaplanować to falami (Wave 0/1/2...), analogicznie do
  `docs/strona-pakiety.md`.
