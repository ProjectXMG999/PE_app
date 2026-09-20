# Audyt: ekonomia słów, tryby, logika inteligentna

> **Status:** audyt punktowy, spisany 18.09.2026. Nie zmienia kodu — tylko go opisuje. Uzupełnia
> `docs/strona-pakiety.md` (który ocenia logikę inteligentną na poziomie produktowym) o trzy rzeczy,
> których tamten dokument nie robi: ekonomię słów (mikrocopy, słownictwo paczek, budżety długości),
> analizę trybów ćwiczeń/audio na poziomie plików, i analizę logiki Smart/FSRS na poziomie linii kodu.

## 0. Metoda i punkt wyjścia

Trzy niezależne przebiegi analizy kodu (mikrocopy + ekonomia paczek + budżety długości; tryby
ćwiczeń + tryby generowania audio; logika Smart/FSRS linia-po-linii), skonfrontowane z tym, co już
wiadomo z `docs/strona-pakiety.md`, `docs/system-powtorek.md`, `docs/voicelab.md`. Każde ustalenie
niżej ma odwołanie plik:linia możliwe do samodzielnego sprawdzenia.

## 1. Czy `docs/strona-pakiety.md` jest jeszcze aktualny?

Sprawdzone dziś na żywo:

| Ustalenie z `strona-pakiety.md` | Stan dziś (18.09.2026) |
|---|---|
| §6.8 `REVIEW_INTERLUDES_ENABLED = false` | **Nadal `false`** — `src/services/reviewConfig.ts:139` |
| §6.2 wszystkie słowa produkcyjne mają `sentenceEn: null` | **Nadal prawda na produkcji** (Netlify Blobs) — ale patrz **3.1.3 niżej: to się zmienia lokalnie, jeszcze nie wdrożone** |
| §6.5 `packages-index.json` ~152 kB, ładowany synchronicznie | Plik ma dziś **150 574 B** (~147 kB) — praktycznie bez zmian, problem aktualny |
| §6.9 `useReviewSet` limit 20 słów / 8 paczek | Potwierdzone stałymi `REVIEW_MAX_WORDS = 20`, `REVIEW_MAX_PACKS = 8` w `src/hooks/useReviewSet.ts:25-26` — nadal aktualne |
| §5.2 `PackMemory.strength` liczone a ledwo używane | Grep: `.strength` występuje w **5 miejscach** w `src/` — zgodne z opisem "jeden bit `<0.7`", nadal aktualne |

Wniosek: dokument jest wiarygodny i pozostaje właściwym źródłem dla strategii Pakietów/inteligencji.
Poniżej **nie powtarzam** jego ustaleń — tylko to, czego nie obejmuje.

---

## 2. Ekonomia słów

### 2.1 Mikrocopy UI

**Trzy różne nazwy marki w jednej aplikacji — najpoważniejsze znalezisko tej sekcji.**
Użytkownik widzi różną nazwę produktu zależnie od ekranu:
- „Project English" — `package.json:2`, `index.html:21` (meta opisu, czyli to, co indeksuje Google),
  `src/components/home/InstallBanner.tsx:34` (baner instalacji PWA — jedno z pierwszych zdań nowego
  użytkownika), `src/components/brand/ProgressLogo.tsx:103`.
- „Language Performance" — cały ekran onboardingu: `src/components/onboarding/OnboardingModal.tsx:9,69,98`,
  `src/components/home/OnboardingCard.tsx:10,49,70`, `src/components/settings/AboutAppSection.tsx:49,58,161,173`.
- „Language Performance Training" — `AboutAppSection.tsx:28`, nagłówek H1 realnego ekranu treningu
  `src/pages/TrainingPage.tsx:32`.

To nie kosmetyka — to ryzyko zaufania do marki i spójności SEO/ASO. **Rekomendacja:** jeden grep
`Language Performance|Project English` po `src/` i `index.html`, wybrać jedną nazwę oficjalną.

**„Paczka" vs „Pakiet" — dług terminologiczny, już częściowo świadomy dla samych autorów kodu.**
Routing i nazwa strony są kanonicznie „pakiet" (`/pakiety`, `/pakiet/:id`), ale słowo „paczka" żyje
równolegle w ośmiu+ miejscach:
- `src/utils/packVisuals.ts:249-251` — komentarz w kodzie **przyznaje wprost**: *"the masculine form
  the rest of the UI uses — plPacks() above is the older 'paczka' wording, still live in the memory
  strip."*
- `src/pages/PackPreviewPage.tsx:254-255` — kod świadomie **omija rzeczownik**, żeby nie zdradzić
  niespójności ("avoids the noun entirely... by talking about the words").
- Dwie równoległe funkcje pluralizacji dla tego samego pojęcia: `plPacks()` (`src/utils/plural.ts:28`,
  używana w `MemoryStrip.tsx:99`, `ResetProgressModal.tsx:136`, `StatsPage.tsx:264`,
  `PackPreviewPage.tsx:437`) i `plPackets()` (`packVisuals.ts:252-259`, używana w `ReviewPage.tsx:245`,
  `SmartSessionPage.tsx:252`).
- W **jednym pliku** `TodayPage.tsx` obie formy współistnieją: strona docelowa nazywa się „Pakiety"
  (`:346` `navigate('/pakiety')`), ale przycisk prowadzący do niej mówi (`:348`) „Wszystkie **paczki**
  poziomu…".
- `src/data/trainingExercises.ts:26,36` — w dwóch sąsiednich zdaniach tego samego opisu: „Mówimy
  **pakietami**" vs „wchodzisz w daną **paczkę**".

**Rekomendacja:** skoro routing i nazwa strony są kanonicznie „pakiet", ujednolicić całość do tej
formy, usunąć `plPacks()` na rzecz `plPackets()` (i przy okazji poprawić nazwę tej funkcji — brzmi
jak kalka z „packets", nie „pakiety").

**Anglicyzm w nazwie metryki.** `src/components/progress/MetricsInfoSheet.tsx:33` — „**Punkty
Progress**" (mieszanka PL/EN), podczas gdy sąsiednie metryki w tej samej liście są w pełni po
polsku ("Seria", "Tempo"). Sam opis w `:34` podpowiada lepszą nazwę: „Waluta wysiłku" → „Punkty
wysiłku" lub „Punkty postępu".

**Niespójny rejestr komunikatów błędu dla tej samej sytuacji.** `LoginPage.tsx:69` i
`AccountPage.tsx:158`: „Coś poszło nie tak." (pełne zdanie, rejestr rozmówny) vs
`PackPreviewPage.tsx:165` dla analogicznego błędu ładowania: „Błąd ładowania" (urzędowy rzeczownik
bez orzeczenia, bez kropki). Rekomendacja: ujednolicić do jednego wzorca.

**Pozytyw do odnotowania:** brak mieszania Ty/Pan-Pani w całej aplikacji, CTA konsekwentnie w
trybie rozkazującym ("Trenuj", "Słuchaj", "Zacznij trening").

### 2.2 Dobór słownictwa w paczkach/poziomach

**Brak udokumentowanego kryterium przypisania słowa do konkretnej paczki** — potwierdzone także
przez sam projekt (`docs/strona-pakiety.md` §6.1): jedyne mapowanie w repo (`levelGuide.ts`) działa
per poziom, nie per słowo. Nazwa/kategoria paczki to jedyny sygnał tematyczny.

**521 nadmiarowych duplikatów tego samego angielskiego hasła w obrębie tego samego poziomu**,
policzone skryptem po `src/data/packs/*.json`:

| Poziom | Słów łącznie | Unikalnych | Zduplikowanych stringów | Nadmiarowe wystąpienia |
|---|---|---|---|---|
| 1 | 1090 | 1027 | 53 | 63 |
| 2 | 2100 | 1973 | 109 | 127 |
| 3 | 3210 | 3058 | 143 | 152 |
| 4 | 4535 | 4356 | 156 | 179 |

Część to zamierzona polisemia (np. "go down" na poziomie 4 poprawnie realizuje 7 różnych znaczeń z
trafnymi, różnymi tłumaczeniami PL) — ale **nic w danych tego nie oznacza** (brak pola
`sense`/`meaning_id`), więc z zewnątrz celowa wieloznaczność i przeoczenie wyglądają identycznie.

**Poważniejszy podprzypadek: to samo hasło 2-3× WEWNĄTRZ jednej paczki — znaleziono w 31 paczkach.**
Przykład: `t1-p825.json` ("Co poszło nie tak?", poziom 4) — "go down" 3× w jednej paczce, odróżnione
wyłącznie polskim tłumaczeniem ("Przegrać" / "Spaść (o samolocie)" / "Tonąć (o statku)"). Ponieważ
(§6.2 + 3.1.3 niżej) `sentenceEn` jest w produkcji `null` dla niemal wszystkich słów, użytkownik nie
ma nawet zdania kontekstowego odróżniającego te karty — tylko polskie tłumaczenie. To realne ryzyko
dezorientacji w nauce, nie tylko kosmetyczny duplikat.

**Rekomendacja:** tani, jednorazowy skrypt audytowy uruchamiany po `rebuild-packs-from-source.ts`,
zgłaszający **intra-pack** duplikaty `english` jako twardy błąd (inter-pack polisemia jest zasadna
i nie powinna być blokowana).

### 2.3 Budżety długości w promptach i audio

Wspólny wzorzec architektoniczny w obu pipeline'ach: **limit długości/kosztu jest opisany w
promptcie dla LLM albo w docs dla ludzi, ale nigdy nie jest sprawdzany deterministycznie w kodzie
po fakcie.**

**a) Długość zdania — luka potwierdzona, nienadrobiona przez nic innego.**
- `scripts/sentences/lib/levelGuide.ts:14-17` definiuje `minWords`/`maxWords` na poziom, wstrzykiwane
  do promptu w `prompt.ts:93`.
- `scripts/sentences/lib/schema.ts:14-17` (Zod) waliduje tylko, że pole jest niepustym stringiem —
  zero sprawdzenia liczby słów.
- `scripts/generate-sentences.ts` (cały runner, 175 linii) nigdzie nie liczy długości wygenerowanego
  zdania.
- Jedyny mechanizm jakości działający po fakcie, `repetitionTracker.ts`, pilnuje różnorodności
  rekwizytów/słownictwa — nie długości. Nie nadrabia luki.
- Drugi, oddzielny prompt-oceniający w `scripts/sentences/lib/selectorPrompt.ts:112` wspomina limity
  długości, ale to wciąż osąd modelu, nie policzenie słów w kodzie — i **ma własne, inne progi niż
  `levelGuide.ts`** (A1/A2 rozbite osobno zamiast jednego zakresu poziomu 1) oraz **w ogóle nie
  obejmuje poziomu 4/C1**.
- **Rekomendacja:** kilkulinijkowy deterministyczny check w `apply-chosen-candidates.ts` porównujący
  `sentencePl.split(/\s+/).length` z `LEVEL_GUIDES`, logujący outliery do przeglądu — zerowy koszt
  API, realna siatka bezpieczeństwa.

**b) Długość frazy nośnej (carrier phrase) — zasada tylko opisowa, brak guardu przed regresją.**
- `docs/voicelab.md:37,56` opisuje zasadę "trzymaj frazę nośną krótką" (koszt per-słowo rośnie
  ~3-4× z frazą nośną, bo ElevenLabs bilinguje per znak).
- `scripts/audio/lib/carrierPhrase.ts:3-6` implementuje to jako **dwa zaszyte na stałe stringi**
  bez żadnego limitu/asercji długości i bez testu jednostkowego (`find scripts/audio -iname
  "*.test.*"` nic nie zwraca).
- **Rekomendacja:** prosta asercja przy starcie generacji (`if (carrier.length - word.length > N)
  warn/throw`) + jeden test pinujący aktualną długość szablonów.

**c) Limit API ElevenLabs (10 000 znaków/request)** — zewnętrzny, nieegzekwowany osobno w repo, ale
przy długości pojedynczych słów/fraz ryzyko przekroczenia jest w praktyce zerowe. Odnotowane jako
brak jawnego guardu, nie jako realny problem.

---

## 3. Tryby

### 3.1 Tryby ćwiczeń/nauki w appce

**3.1.1 `WordFlashPage` i `ActiveSentencePage` to w ~80% ten sam plik.** Cały stan sesji, zapis
progresu, liczenie `ratedCount`/`knownHitCount`, `saveSession`, `handleRepeat` — skopiowane linia po
linii: `WordFlashPage.tsx:32-65` vs `ActiveSentencePage.tsx:32-65` (init), `:82-149` vs `:84-151`
(`advance`), `:151-169` vs `:153-172` (`handleRepeat`). Komentarz w `ActiveSentencePage.tsx:190-192`
sam przyznaje, że ekran końcowy już raz skonsolidowano — ale logikę sesji zostawiono zduplikowaną.
**Ryzyko:** zmiana w logice FSRS/progresu wymaga ręcznej synchronizacji dwóch plików. **Rekomendacja:**
wydzielić wspólny hook (`useCardSession`), parametryzowany `trainMode` — wzorem już dobrze zrobionej
konsolidacji w `src/components/mode/ModeScreen.tsx`.

**3.1.2 Martwy, osierocony komponent `ModeToggle`.** `src/components/flashcard/ModeToggle.tsx` +
`.css` nie są nigdzie importowane. Nawiguje na `/pakiet/:id/fiszki`, trasę bez dedykowanej definicji
w `App.tsx` (łapie ją catch-all `:136`) — technicznie wciąż działa, ale nieosiągalna z UI, tylko
ręcznym wpisaniem URL. **Rekomendacja:** usunąć albo świadomie zdecydować, czy generyczna gałąź
"fiszki" ma prawo bytu.

**3.1.3 Ważna aktualizacja "Fali 0" z `docs/strona-pakiety.md` §6.2 — treść już jest, brakuje
deploya.** Lokalne pliki `src/data/packs/*.json` (834 paczki, 10 935 słów) mają już **2953 słowa**
z wypełnionymi **oboma** polami `sentenceEn`/`sentencePl` — z commitu `8002a4b`
("final sentences for Lp 1-3000, full Polish translations", **17.09.2026**, czyli dzień przed tym
audytem). Produkcja jednak nie czyta tych plików bezpośrednio: `netlify/functions/pack-content.ts:16-17`
serwuje z Netlify Blobs, synchronizowanych ręcznie przez `npm run upload-pack-blobs`
(`scripts/upload-pack-blobs.ts`) — nic nie wskazuje, że ten upload odbył się po `8002a4b`.
**To zmienia szacowany koszt "Fali 0": praca merytoryczna (dobór 2953 zdań) już się odbyła, zostaje
czysto deployowy krok** (`npm run upload-pack-blobs`) — dużo tańsze niż odpalanie generatora zdań
od nowa.

**3.1.4 Druga, osobna blokada niezależna od 3.1.3: `sentenceAudio`.** Sam tekst zdania nie
wystarczy do odtworzenia dźwięku — `src/hooks/useAudio.ts:103-104,114`: `playSentence`/
`playSentencePl` cicho zwracają `'ok'` bez odtworzenia, gdy `sentenceAudio !== true`
(`src/types/vocabulary.ts:18-25`). Z 2953 słów z tekstem zdania, **tylko 14 mają `sentenceAudio:
true`**. `ActiveSentencePage.tsx:210-244` sprawdza tylko obecność tekstu, nie `sentenceAudio` — więc
nawet po wgraniu blobs (3.1.3) karta pokaże tekst i przycisk odtwarzania, który dla ~2939 słów **nic
nie zagra** (cichy no-op), a autoplay (`useAutoplaySequence.ts:149-153`) wejdzie w krok "zdanie" i
przejdzie ciszą zamiast dźwiękiem. Produkcyjny `scripts/audio/generate-packs.ts:176` sam przypomina
o kolejności: `upload-audio-blobs` → `upload-pack-blobs`. **Rekomendacja:** traktować odblokowanie
trybów sentencji jako dwuetapowe: (1) upload tekstu — tani, gotowy do zrobienia teraz dla 2953 słów;
(2) wygenerowanie i upload audio zdań — kosztowniejsze, do zaplanowania osobno.

**3.1.5 Trzy nieskorelowane sposoby liczenia "ile to potrwa".** `autoplayModes.ts:93-101`
(realny `gapMs` + `CLIP_GUESS_MS=1500`) vs `studyDays.ts:57`/`useStats.ts:10`
(`ESTIMATED_SECONDS_PER_WORD=8`, płaskie) vs `nextPack.ts:90-93` (też płaskie 8s). Tylko
`smartQueue.ts:229-236` już zauważyło i naprawiło ten sam problem (komentarz: domyślne 8s zaniża
sesję Smart nawet 3×) — ale poprawka nie rozlała się na resztę aplikacji. **Ryzyko:** karta paczki
na "Dziś" i karta wewnątrz `/pakiet/:id/start` mogą pokazać wyraźnie różne szacunki czasu dla tej
samej paczki.

**3.1.6 Niespójna konwencja nazewnictwa trybów widoczna dla użytkownika.** Tryby autoplay mają
polskie etykiety ("Słowa"/"Standard"/"Mówienie", `autoplayModes.ts:51,60,71`), tryby Trenuj są
pokazywane **po angielsku wprost** ("Word Flash", "Active Sentence" — `FlashcardModePage.tsx:33,42`
i kickery w `WordFlashPage.tsx:209`/`ActiveSentencePage.tsx:216`), a `TrainingPage.tsx:32` miesza
angielski nagłówek "Language Performance Training" z polskim kickerem "Trening" (`:31`). Samo
typowanie (`AutoplayMode`/`TrainMode` w `src/types/progress.ts`) jest spójne — problem jest
wyłącznie na poziomie tego, co widzi użytkownik.

### 3.2 Tryby generowania audio

**3.2.1 Skala duplikacji — policzona.** `ab-sample-round5.ts` vs `ab-sample-round6.ts`: 64
identyczne linie (~75-80% pliku) — różni się tylko lista głosów i szablon. Każdy z 5 plików
`build-reels*.mjs`/`build-isolation-reel.mjs` ma **własną kopię** `concatSilence()`/`duration()`
(~15-20 linii każda, ~90 linii zduplikowanych łącznie), mimo że `scripts/audio/lib/` istnieje
właśnie po to, by to współdzielić. `detectSilencePeriods()` (nowa funkcja z r5, ~25 linii) jest
skopiowana bez zmian do `build-reels-r6.mjs:47-70`. Wzorzec jest **aktywny, nie tylko historyczny**
— w trakcie tej sesji w repo pojawiły się kolejne `ab-sample-round6.ts`/`build-reels-r6.mjs`.
Przykład realnego ryzyka: `ab-sample-round4.ts:36-45` hardkoduje własną listę głosów zamiast
importować ją z `lib/voicePresets.ts:58-71`, gdzie ta sama lista już istnieje i jest aktualizowana.

**Ważne rozróżnienie (w przeciwieństwie do sekcji 2.3-podobnej serii w `scripts/sentences/`):**
`promptTrial-v1..v6.ts` **są** świadomie udokumentowanym archiwum decyzji (komentarz w `prompt.ts:11`
wprost to tłumaczy) — to nie jest ten sam problem. Seria `ab-sample-round*`/`build-reels-r*` **nie
ma** takiego wyjaśnienia i wygląda na kopiuj-wklej bez wspólnego harnessu.

**Rekomendacja:** wydzielić `concatSilence`/`duration`/`detectSilencePeriods` do jednego
`scripts/audio/lib/reelBuilder.ts`, sprowadzić `build-reels-r*.mjs` do konfiguracji + wywołania
wspólnej funkcji (realistyczny spadek z ~440 do ~120-150 linii). Podobnie `ab-sample-round*.ts` →
jeden `run-ab-round.ts` przyjmujący config. Komentarze nagłówkowe (log decyzji) warto zachować
niezależnie od konsolidacji kodu.

**3.2.2 Błąd driftu mp3-duration z r5 NIE dotyczy produkcyjnego `generate-packs.ts` w tej postaci —
ale ten sam prymityw pomiaru jest tam używany gdzie indziej.** `generate-packs.ts` nie konkatenuje
wielu klipów (zapisuje każdy osobno) i **jeszcze nie używa** carrier-phrase (woła `ttsPlain`, nie
`ttsWithTimestamps` — sam plik przyznaje w liniach 1-11: "Etap 2 (carrier-phrase) is not implemented
yet"). Drift wymaga sumowania wielu pomiarów pod rząd (~57 pomiarów → ~1s w r5) — tego mechanizmu
tu nie ma. Natomiast ten sam `mp3-duration` jest używany w `ffmpegPost.ts:109-110`
(`getDuration()` → `fadeOutStart`) dla **każdego** produkcyjnego klipu — błąd ~25ms tu nie akumuluje
się (brak efektu "coraz bardziej ucięte"), ale to ten sam błąd pomiaru, warto o nim wiedzieć przy
przyszłym audycie audio, żeby go nie odkrywać ponownie jako nowy problem.

**3.2.3 `carrierPhrase.ts` zawiera obie generacje logiki obok siebie, starsza nieoznaczona jako
przestarzała.** `extractWordSpan` (`:22-33`, v2/v3, szacuje start I koniec — dokładnie ta metoda,
o której r5 mówi, że ucina słowa) wciąż używana przez `ab-sample.ts`/`round2/3/4.ts`.
`extractWordStart` (`:37-41`, v4, tylko start + `cutClipFromStart`+`trimTrailingSilence`) — jedyne
poprawne podejście wg diagnozy r5. Obie funkcje eksportowane równorzędnie, `extractWordSpan` jako
pierwsza — łatwo nieświadomie sięgnąć po wadliwą. **Rekomendacja:** oznaczyć `extractWordSpan`
`@deprecated` albo przenieść do `carrierPhrase.legacy.ts`.

### 3.3 Logika adaptacyjna/inteligentna (poziom linii kodu)

Poniższe uzupełnia `docs/strona-pakiety.md` Część 5 (która ocenia *co jest wykorzystane na UI*) o
błędy w tym, *jak działa logika wewnętrznie* — niezależnie od tego, co z niej pokazuje interfejs.

**3.3.1 `MAX_PACKS=8` deterministycznie ucina sesję nowego użytkownika z dużym celem czasowym.**
`src/services/smartQueue.ts:183-190` przerywa dobieranie paczek do strumienia `learn`, gdy
`learnPackIds.length >= SMART.MAX_PACKS` — niezależnie od tego, czy suma słów osiągnęła
`learnTarget`. Scenariusz: nowy użytkownik, `todayLevel=1`, cel 60 min →
`smartTargetCount = MAX_CARDS = 132`. Poziom 1 ma paczki po dokładnie 10 słów (potwierdzone w
`packages-index.json`) → 8 paczek × 10 = **80 słów** wobec `learnTarget=132`. **Sesja "Inteligentna"
dla nowego konta z celem 45-60 min dostarczy ~80 kart zamiast 132 (~36% krócej niż obiecane),
deterministycznie, dla całej kohorty onboardingowej.** Niepokryte testem w `smartQueue.test.ts`.

**3.3.2 Flaga `urgent` nie ma efektu bez świeżego sygnału `reviewHealth` — dokładnie dla
użytkowników wracających po przerwie.** `reviewHealth.ts:159-164`: gdy `deviation()` zwraca `null`
(< 20 próbek albo dane starsze niż `STALE_DAYS=30` — `reviewHealth.ts:130-134`), funkcja wraca
`opts.base` **przed** sprawdzeniem `opts.urgent`. W konsumencie `smartQueue.ts:151-156`, `behind`
(które steruje `dueCap`) może być `true` tylko gdy ratio faktycznie przekroczyło bazę — czyli
wymaga świeżego sygnału health. **Scenariusz:** użytkownik wraca po >30-dniowej przerwie z pilnym
backlogiem (`reviewUrgency='urgent'`) i tego samego dnia wyczerpał budżet `/powtorka`
(`servingLeft=0`) → `dueCap=0` → **żadne realnie zaległe słowo nie trafia do sesji Smart**, mimo że
mechanizm w komentarzu (`smartQueue.ts:144-150`) mówi wprost, że ma zadziałać właśnie w tej
sytuacji. Niepokryte testem (istniejący test w `smartQueue.test.ts:233-237` sprawdza tylko połowę
kombinacji).

**3.3.3 Dolna granica 50% w cięciu `reviewWords` w praktyce dominuje nad `reviewRatio` przy każdym
nie-pogarszającym się stanie zdrowia.** `smartQueue.ts:160`: `.slice(0, Math.max(reviewTarget,
Math.ceil(targetCount * 0.5)))`. Ponieważ `reviewRatio ∈ [0.2, 0.65]`, ten cap **przewyższa**
`reviewTarget` za każdym razem, gdy ratio < 0.5 — czyli w całym zakresie od bazowego 0.35 w dół.
Jeśli `stragglerWords` (nieograniczone przez `dueCap`) dostarczą nadmiar, realny udział review w
sesji może urosnąć do ~50% niezależnie od tego, co `reviewHealth`/`tone` sugerują użytkownikowi na
start-card. Przykład liczbowy w pełnym raporcie źródłowym: `goalSec=900`→`targetCount=33`,
`reviewTarget=12` przy bazowym ratio, ale cap cięcia = 17 (~52%).

**3.3.4 Stragglery pomijają priorytetyzację i bramkowanie datą.** `smartQueue.ts:126-130` filtruje
`stragglerWords` bez wywołania `scoreDueWord`/`orderDueWords` i bez sprawdzenia `nextReviewAt` —
o tym, które trafią do sesji przy docinaniu (3.3.3), decyduje kolejność w tablicy
`snapshot.wordProgress`, nie realna pilność. Świadomy wybór produktowy ("dokończ paczkę"), ale w
połączeniu z 3.3.3 może wypychać nowe słowa aż do progu 50% bez związku z pilnością.

**3.3.5 Martwe stałe w `reviewConfig.ts`.** `PRIORITY.overduePerDay`/`overdueCap`
(`reviewConfig.ts:74-77`) nigdzie nie są używane — `scoreDueWord` liczy przeterminowanie inaczej
(`clamp(late/20,0,1)`). Ślad niedokończonego refaktoru; ryzyko, że ktoś zmieni te stałe myśląc, że
to wpływa na kolejkowanie.

**3.3.6 Drobne, niższy priorytet:** `composeSmartSteps` (`smartQueue.ts:280-287`) cicho gubi
review-słowo bez podstawienia zamiennika, gdy jego paczka/słowo nie zostały pobrane (wymaga błędu
fetch, rzadka ścieżka).

**Zweryfikowane jako poprawne (żeby nie wracać do tego w przyszłym audycie):**
`learnTarget` nie może wyjść ujemny/zerowy przy obecnych stałych (matematyczny dowód w pełnym
raporcie: suma capów review+stretch ≤ 0.85×targetCount) · `fsrs.ts` zgodny ze specyfikacją
FSRS-4.5, bez dzielenia przez zero/NaN · `comfort.ts` odporny na małe próbki (próg `MIN_RATED=5`,
krok ograniczony `MAX_STEP=0.3`) · zakresy w `reviewHealth.ts` (`reviewRatioFor`,
`requestRetentionFor`) poprawnie zaciśnięte do udokumentowanych przedziałów.

---

## 4. Priorytetyzowana lista — co robić najpierw

**Szybkie, tanie (godziny), wysoki wpływ:**
1. `npm run upload-pack-blobs` — wdrożyć 2953 już gotowe zdania na produkcję (3.1.3). Tańsze niż
   sądzono w `strona-pakiety.md` §6.2/7, bo praca merytoryczna jest zrobiona.
2. Naprawić `MAX_PACKS`/dobór paczek w `selectSmart`, żeby `learnTarget` było realnie osiągalne przy
   dużych celach na niskich poziomach (3.3.1) — wpływa na każdego nowego użytkownika z celem 45-60 min.
3. Deterministyczny check długości zdania względem `LEVEL_GUIDES` w pipeline'ie sentencji (2.3a) —
   kilka linijek, zero kosztu.
4. Skrypt audytowy na intra-pack duplikaty `english` (2.2) — jednorazowy, tani.

**Średni koszt, realny wpływ na spójność produktu:**
5. Ujednolicić nazwę marki (2.1) i terminologię paczka/pakiet (2.1) — wymaga przeglądu, ale
   mechaniczny.
6. Skonsolidować `WordFlashPage`/`ActiveSentencePage` do wspólnego hooka (3.1.1) — zapobiega
   przyszłym rozjazdom logiki FSRS.
7. Naprawić interakcję `urgent`/`reviewHealth` gdy sygnał jest pusty/przestarzały (3.3.2) i
   udokumentować/ograniczyć podłogę 50% w cięciu review (3.3.3-3.3.4).

**Do zaplanowania osobno (wyższy koszt):**
8. Wygenerowanie i wgranie audio zdań (`sentenceAudio`) dla 2953 słów (3.1.4) — dopiero to naprawdę
   odblokowuje tryby `standard`/`speaking`, tekst sam nie wystarczy.
9. Konsolidacja rodziny skryptów `ab-sample-round*`/`build-reels-r*` do wspólnego harnessu (3.2.1) —
   warto zrobić po ustabilizowaniu podejścia carrier-phrase, nie w trakcie aktywnych eksperymentów.

**Do decyzji, nie do naprawy automatycznej:**
10. Usunąć martwy `ModeToggle.tsx` (3.1.2) i martwe stałe `PRIORITY.overduePerDay/overdueCap`
    (3.3.5) — albo świadomie zdecydować, że zostają jako dokumentacja zamiaru.
