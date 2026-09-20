# Estetyka — burza mózgów: co zrobi „wow"

## Stan wdrożenia

Dokument powstał jako burza mózgów; poniższe punkty są już w kodzie. Korekty naniesione po
weryfikacji są oznaczone **Korekta** przy odpowiednich paragrafach — kilka pierwotnych założeń
okazało się nieprawdziwych i zostały poprawione, a nie usunięte.

| punkt | stan |
|---|---|
| §1 okładka na ekranie blokady | wdrożone (`services/lockArtwork.ts`, `hooks/useLockArtwork.ts`) |
| §2 liczniki NumberFlow | wdrożone (`components/shared/FlowNumber.tsx`); `useCountUp` usunięty |
| §3 krój | **odwrócone** — `system-ui` zostaje (patrz korekta); usunięto tylko martwe importy |
| §4 animowany rant | wdrożone jako `.fx-rim` na przycisku „Zaczynamy" |
| §5 dług `fx-*` | wdrożone — 5 martwych efektów usuniętych |
| §6 dźwięk sesji | **nie zaczęte** — jedyny nieruszony punkt |
| §7 tło reagujące na lektora | **odłożone** — blokada opisana w punkcie |
| §8 podkład „study room" | wdrożone (`audio/studyPad.ts` + `audio/tonality.ts`), **domyślnie włączone** |
| §9 Konstelacja Pamięci | wdrożone, domyślnie włączone |
| §10 kartka roczna | wdrożone (`services/yearCard.ts`, próg `YEAR_CARD_MIN_DAYS`) |
| §11 kartka kamienia milowego | wdrożone jako kartka odznaki (`services/badgeCard.ts`) |
| §12 kinowe wejście | wdrożone (`components/flashcard/SessionOpener.tsx`) |
| §13 odsłona przez rozmycie | wdrożone — blur w klatkach `card-flip-unfold` |
| §14 animacje sterowane scrollem | wdrożone — `animation-timeline: view()` na `/postęp` |
| §15 dotyk i fizyka | świadomie odłożone |

Wszystkie trzy kartki dzielą jeden szablon — `services/shareCard.ts`.

---

## Kontekst

### Z czym startujemy

To nie jest aplikacja, która potrzebuje ratunku wizualnego. Ma już:

- **Tokeny w OKLCH** — `src/styles/tokens.css` (391 linii, obszernie skomentowanych): kolor,
  materiały, poświaty, cienie, promienie, skala typograficzna, krzywe ruchu, zmienne układu.
  Jasny motyw to osobna paleta, nie odwrócenie ciemnej.
- **Materiał „liquid glass"** — `src/styles/surfaces.css`: `.u-liquid`, `.u-cta`, `.u-surface`,
  `.u-tile`, `.u-glass`, `.u-rail`. Rozmyte tło, gradientowy rant, promienisty połysk.
- **Shaderowe tło WebGL** — `src/components/ambient/MeshField.tsx` +
  `AmbientBackground.tsx` (`@paper-design/shaders-react`), lazy-loadowane na `requestIdleCallback`,
  przebarwiane na żywo przy zmianie motywu, gaszone na ekranach sesji, z ziarnem filmowym w CSS
  na wierzchu.
- **framer-motion w 30 plikach** — wspólne tokeny ruchu w `src/components/today/motion.ts`,
  `layoutId` na wskaźniku nawigacji, przeciąganie tomów na `HomePage`, wszędzie `useReducedMotion`.
- **View Transitions API** na nawigacji, własne confetti na canvasie
  (`src/components/shared/Confetti.tsx`), syntezowane dźwięki UI (`src/services/sfx.ts`).

### Czego jej brakuje

Trzy luki, i każda z nich jest luką *w wykorzystaniu tego, co już jest*:

1. **Aplikacja jest audio-first, ale nic o tym nie wie poza samym odtwarzaczem.** Tło nie reaguje
   na lektora. Ekran blokady — miejsce, gdzie użytkownik faktycznie patrzy podczas słuchania z
   wygaszonym ekranem — pokazuje ikonę aplikacji zamiast słowa, które właśnie leci.

2. **Wszystkie wizualizacje pokazują aktywność, żadna nie pokazuje pamięci.** `ActivityHeatmap`,
   `ActivityChart`, `RouteMap`, `CompassHero` mówią „ćwiczyłeś, zaszedłeś tu". Silnik liczy
   `stability` FSRS dla każdego słowa od miesięcy i jedyne, co z tego widać, to zagregowane
   słupki w `RetentionBars`. Żaden ekran nie mówi *„to umiesz"*.

3. **Nie ma własnego kroju.** `@fontsource-variable/bricolage-grotesque` siedzi w zależnościach
   i jest importowany, ale `global.css:1` przyznaje wprost, że `--font-heading` i `--font-body`
   rozwiązują się do `system-ui`. Aplikacja mówi cudzym głosem typograficznym.

### Zakres tej burzy mózgów

Trzy kierunki: **dźwięk i głos**, **dane jako sztuka**, **rzemiosło typografii i ruchu**.
Kierunek czwarty — dotyk i fizyka — jest tu opisany, ale świadomie odłożony (§15).

Dopuszczalne są małe, niszowe zależności. Poza zasięgiem: Tailwind i biblioteki komponentów —
aplikacja ma 90 ręcznie pisanych arkuszy w konwencji BEM i plik tokenów, a to jest spójny system,
nie dług.

---

## Tier 0 — szybkie wygrane

Godziny pracy, zero lub prawie zero bajtów w bundlu.

### 1. Okładka z aktualnym słowem na ekranie blokady

**Co.** `src/hooks/useMediaSession.ts:81` podaje dziś jako `artwork` statyczne
`/icons/icon-192.png` i `icon-512.png`. Zamiast tego rysować okładkę 512×512 na
`OffscreenCanvas` przy każdej zmianie słowa: angielskie słowo dużym krojem, polskie pod spodem,
nazwa paczki jako nadtytuł, gradient w kolorze poziomu (`LEVEL_COLORS` z `src/data/levels.ts`).
`canvas.toBlob()` → `URL.createObjectURL` → `MediaMetadata.artwork`, poprzedni URL zwalniać
przez `revokeObjectURL`.

**Dlaczego to robi wrażenie.** Tryb Słuchaj jest pomyślany do nauki z wygaszonym ekranem.
W tym trybie ekran blokady *jest* interfejsem aplikacji — i dziś jest pusty. Po zmianie
wyciągasz telefon z kieszeni i widzisz słowo, które właśnie usłyszałeś. Żadna konkurencyjna
aplikacja do nauki słówek tego nie robi.

**Koszt.** ~80 linii, brak zależności.

**Ryzyko.** Android Chrome: pewne. iOS: „best effort" — `useMediaSession.ts:22-33` już uczciwie
opisuje, że metadane na iOS są niepotwierdzone i że ten obszar przeszedł długi cykl rewertów.
Nie pogarszamy niczego: gorszym przypadkiem jest okładka, która się nie pokazuje.

---

### 2. Liczniki z fizyką — `@number-flow/react`

**Co.** Podmiana `src/hooks/useCountUp.ts` na `@number-flow/react` (~8 kB, agnostyczny wobec CSS,
działa na `font-variant-numeric` i transformach). Cyfry przetaczają się osobno, każda ze swoją
sprężyną, z poprawną obsługą zmiany liczby znaków.

**Gdzie.** Zweryfikowane przy wdrożeniu — **osiem miejsc w sześciu plikach**:
`LevelProgressBars.tsx:41`, `CompassHero.tsx:32`, `SmartDoneScreen.tsx:28-31` (×4),
`SessionHero.tsx:45`, `TodayPage.tsx:126`. *Korekta pierwotnej listy: `StatCard`,
`SessionDoneScreen`, `MasteryScreen` i `ProgressPill` istnieją, ale żaden z nich nie wołał
`useCountUp`.*

**Dlaczego.** Liczba słów to najważniejsza liczba w całej aplikacji. Dziś rośnie liniowo.
Po zmianie ma wagę.

**Koszt.** ~8 kB, podmiana w pięciu miejscach.

---

### 3. Prawdziwy krój zmienny

**Co.** Włączyć Bricolage Grotesque na nagłówki (jest już zainstalowany), dodać
`font-variation-settings` na osi wagi i rozmiaru optycznego, tak żeby duży tytuł i mała etykieta
nie były tym samym krojem przeskalowanym.

**Korekta po weryfikacji.** `system-ui` **nie jest zaniedbaniem** — `tokens.css:255-266` ma
ośmiolinijkowy komentarz, który tej decyzji broni, a głównym argumentem są poprawne polskie
diakrytyki na każdym urządzeniu. To jest decyzja do odwrócenia z uzasadnieniem, nie luka do
zasypania. Wdrożona została tylko druga połowa punktu: martwe importy poszły z `global.css`
(−45 plików / ~770 KiB z precache), a tokeny zostały nietknięte.

**Do sprawdzenia przed wdrożeniem — poważnie, nie formalnie.** Komplet polskich diakrytyków:
**ą ć ę ł ń ó ś ź ż**. Bricolage ma wysoki kontrast i nietypowe proporcje; ogonki w „ą" i „ę"
oraz przekreślenie w „ł" to miejsca, gdzie kroje projektowane pod angielski zwykle się sypią.
Testować na prawdziwym tekście z aplikacji („Słuchaj", „Powtórka", „Ćwiczenia", „Dzięki, to miłe"),
nie na pangramie.

**Plan B, jeśli diakrytyki zawiodą.** Instrument Sans albo Geist — oba mają solidny Latin Extended
i oba są mniej ryzykowne przy polskim.

---

### 4. Animowany rant na karcie „frontier"

**Co.** `@property --angle` + obracany `conic-gradient` jako rant paczki, którą użytkownik ma
przed sobą (`PackageCard` ma już wyróżnienie `frontier`), ewentualnie na `.u-cta`.

**Dlaczego.** Czysty CSS, dwadzieścia linii, a jest to efekt, który ludzie kojarzą z drogimi
produktami. Wsparcie: Safari 16.4+, degraduje się do statycznego rantu.

**Gdzie trafił i dlaczego nie tam, gdzie planowano.** Karta „frontier" odpada: `.packcard::before`
to nośny pasek stanu i wygrywa kolejnością, a karta ma `overflow: hidden` — rant nie malował się
wcale. Karta sesji też odpada: `.u-liquid` zajmuje oba pseudo-elementy (ma własny „lit rim, top
sheen"). Został przycisk „Zaczynamy" — jedyny wypełniony przycisk ekranu startowego. Przy 1px
i bieli 0.9 efekt był poniżej progu widoczności; działa dopiero przy 2px i pełnej bieli.

---

### 5. Spłata długu `fx-*`

**Co.** `src/styles/animations.css` definiowało osiem sparametryzowanych efektów, z czego w TSX
używane były **dwa** (`fx-shine`, `fx-ping`).

**Korekta:** `fx-rise` **nie był martwy** — jest używany przez surowe `animation: fx-rise …`
w pięciu plikach CSS (`RouteControls.css:228`, `HomePage.css:125,131`, `PackPreviewPage.css:605,718`).
Martwych było pięć: `fx-breathe`, `fx-pop`, `fx-trail`, `fx-fill-sweep`, `fx-equalizer` — i te
zostały usunięte, a nie obsadzone na siłę (`fx-equalizer` w `AutoplayControls` oznaczałby dopisanie
nowego DOM, czyli nową funkcję, nie spłatę długu).

**Jak to się skończyło.** Zamiast pięciu martwych efektów doszedł jeden używany: `fx-rim` —
obracany `conic-gradient` z §4, na przycisku „Zaczynamy". Bilans arkusza: −5 nieużywanych,
+1 użyty.

---

## Tier 1 — dźwięk

Największa różnica na bajt, bo bajtów tu nie ma: wszystko jest syntezowane.

### 6. Sesja jako utwór, nie jako seria pisków

**Stan dzisiejszy.** `src/services/sfx.ts` to 60 linii: jeden oscylator sinusoidalny z kopertą,
`playTick` (660 Hz), `playSuccess` (C-E-G), `playUnlock` (pentatonika, długość rośnie z tierem
odznaki). To jest zrobione dobrze, tylko malutkie.

**Propozycja.**
- `ConvolverNode` z **syntezowaną** odpowiedzią impulsową — szum o wykładniczo opadającej
  kopercie, ~30 linii, zero plików audio. Nagle wszystko brzmi jak w pomieszczeniu, a nie
  w pustce.
- **Tonacja przypisana do poziomu**: L1 C-dur, L2 G-dur, L3 A-mixolidyjska, L4 d-dorycka.
  Poziom zaczyna brzmieć, nie tylko wyglądać.
- **Nuta wspina się po skali z każdą poprawną odpowiedzią w sesji** i wraca do toniki po błędzie.

**Dlaczego to jest zgodne z produktem.** `docs/strona-pakiety.md` §8 deklaruje „bez karzącej
grywalizacji". Ta mechanika tego nie łamie: sukces brzmi coraz pełniej, a błąd po prostu wraca do
punktu wyjścia — nie ma dysonansu, brzęczyka ani kary. Duolingo robi z tego arkadę; tu może to być
muzyka.

**Koszt.** Rozbudowa jednego pliku. Zero zależności, zero bajtów treści.

---

### 7. Tło oddychające głosem lektora

**Co.** `distortion` i `swirl` shadera reagują na to, co właśnie gra. Aplikacja wygląda, jakby
słuchała razem z Tobą.

**Kanał sterowania już istnieje.** `AmbientBackground.tsx` ustawia uniformy na żywo przez
`paperShaderMount.setUniforms` — używa tego przy przełączeniu motywu, razem z `MutationObserver`.
Nie trzeba niczego przebudowywać, trzeba podać inne liczby.

**Dwa warianty — i ta różnica jest najważniejszą rzeczą w tym punkcie.**

*Wariant bezpieczny (domyślny).* Sterowanie z sekwencera. `useAutoplaySequence` wie, kiedy klip
startuje i mniej więcej ile trwa, więc generujemy syntetyczną kopertę (attack/decay) i nią
modulujemy uniformy. Wizualnie różnica wobec prawdziwej analizy jest niewielka — człowiek widzi
„coś pulsuje razem z głosem", nie widzi widma. **Zero ryzyka dla ścieżki audio.**

**BLOKADA, przeoczona w pierwszej wersji tego punktu.** Shader ambientowy jest *odmontowywany*
na ekranach sesji (`showShader = armed && !ambientHidden`, `AmbientBackground.tsx:120`, a
`FlashcardPage` woła `useStageAmbient()`) — czyli dokładnie tam, gdzie działa autoplay, **nie ma
czego modulować**. Do tego `AmbientBackground` jest montowany raz w korzeniu aplikacji, a
`useAutoplaySequence` żyje lokalnie w `FlashcardPage`, więc nawet wariant bezpieczny wymaga nowego
kanału przez drzewo. Realny koszt §7 to ta zmiana polityki, nie dopisanie `setUniforms`. Punkt
jest z tego powodu odłożony.

*Wariant za flagą.* Prawdziwy `AnalyserNode`. Wymaga `createMediaElementSource()` na singletonowym
`<audio>` z `src/audio/audioElement.ts`, co przepuszcza **cały** dźwięk aplikacji przez graf
WebAudio i uzależnia odtwarzanie od poprawnego podpięcia do `ctx.destination`.

**To repo ma bliznę dokładnie w tym miejscu.** `useMediaSession.ts:22-33` opisuje długi cykl
rewertów wokół `src`/`load()` i iOS AVAudioSession, z nakładającym się audio jako historycznym
trybem awarii. `audioUnlock.ts` pokazuje, jak delikatna jest ta konstrukcja (komentarz o
`volume = 1`, bo Android utrwala głośność między zmianami `src`). Nie ruszać bez testu na
prawdziwym iPhonie.

---

### 8. Podkład „study room"

**Co.** Opcjonalny generatywny pad pod tryb Słuchaj: dwa lekko rozstrojone oscylatory przez filtr
dolnoprzepustowy, −30 dB, powolna modulacja odcięcia.

**Nieoczekiwana korzyść.** Mógłby zastąpić `src/audio/keepAlive.ts` — dziś to drugi, ukryty
`<audio>` zapętlający ciszę na `volume 0.01`, żeby timery przeżyły wygaszenie ekranu. Cichy pad
robi dokładnie to samo, tylko że po drodze buduje wrażenie miejsca zamiast niczego.

**Ryzyko.** Musi być wyłączalny i domyślnie wyłączony. Część ludzi uczy się w ciszy i podkład
będzie dla nich wrogiem, nie atmosferą.

---

## Tier 2 — dane jako sztuka

### 9. Konstelacja Pamięci ★ moonshot — **wdrożona, domyślnie włączona**

**Co.** Pełnoekranowy widok na `/postęp`: ~10 935 gwiazd, po jednej na każde słowo na trasie.
Pozycja deterministyczna z `wordId` (`t1-p001-001` → paczka + numer → globalny indeks): kąt
z rangi częstotliwości, promień z poziomu. L1 tworzy jasne jądro, L4 zewnętrzne ramię — wychodzi
spirala.

Stan słowa = wygląd gwiazdy:

| stan | wygląd |
|---|---|
| nietknięte | ciemny pył, alpha ~0.06 |
| `learning` | iskra, pulsuje |
| `known` | gwiazda; jasność i rozmiar rosną z `stability` (FSRS, w dniach) |
| `retiredAt` | stała, z delikatnym krzyżem dyfrakcyjnym |
| `lapseCount > 0` | migocze — słowo, które kiedyś uciekło |

Kolor z `LEVEL_COLORS` (`src/data/levels.ts` → tokeny `--accent-*`), więc paleta jest ta sama,
co w reszcie aplikacji. Uwaga na marginesie, sprawdzona przy okazji: `--accent-yellow/orange/
green/blue` **nie są** redefiniowane w bloku `[data-theme="light"]` — cztery kolory poziomów są
dziś niezależne od motywu. Panel i tak zachowuje ciemne tło w obu motywach (gwiazdy to światło
dodawane, a światło dodawane na papierze to szara plama).

**Dlaczego akurat to.** To jedyna wizualizacja z całej tej listy, która pokazuje **pamięć**,
a nie **aktywność**. Heatmapa mówi „ćwiczyłeś w środę". Konstelacja mówi „to umiesz — a tamto
świeci słabiej, bo zaraz zapomnisz". Silnik liczy `stability` dla każdego słowa od miesięcy
i nigdzie tego nie widać.

Drugi powód: to pierwszy ekran w tej aplikacji, który ktoś sam z siebie pokaże znajomemu.

**Dane — zero nowej infrastruktury.**
- `src/data/packages-index.json` — 834 wpisy `{ id, level, wordCount }`; suma `wordCount` daje
  deterministyczne indeksy globalne. Już importowany w `StatsPage.tsx:28`.
- `getAllWordProgress()` (`src/services/db.ts:156`) — `status`, `stability`, `difficulty`,
  `lapseCount`, `retiredAt`, `lastSeen` dla każdego dotkniętego słowa. `useProgressData` już to
  czyta i wystawia jako `snapshot.wordProgress`.

Żadnej paczki nie trzeba wczytywać, żadnego zapytania sieciowego.

**Render.** `ogl` (~12 kB) — jeden `Points`, atrybuty w typed arrays, fragment shader rysuje
miękki dysk z poświatą. 11 tysięcy punktów to dla GPU nic. Fallback na canvas 2D
z pre-renderowanym sprite'em poświaty — dla braku WebGL i dla `prefers-reduced-motion`
(tam i tak jedna statyczna klatka).

**Kolizja do rozwiązania.** To drugi kontekst WebGL obok ambientowego shadera — i nie jest to
tylko kwestia wydajności: tam, gdzie budżet GPU jest ciasny, przeglądarka nie odmawia drugiego
kontekstu, tylko odbiera pierwszy. Rozwiązanie już istnieje: flaga `ambientHidden` w store gasi
tło na ekranach sesji, a konstelacja korzysta z tego samego mechanizmu przez cały czas, gdy jest
zamontowana. Koszt: na Postępie znika gradient w tle, dopóki panel jest włączony.

**Wejście.** Gwiazdy zapalają się w kolejności, w jakiej je poznałeś (sortowanie po `lastSeen`),
skompresowane do ~2,5 s. Historia nauki jako film.

**Ryzyka.** Wydajność na słabszych telefonach (cap na DPR w duchu `maxPixelCount` z
`MeshField.tsx:55`); przy zerowym postępie ekran jest prawie pusty — nowy użytkownik musi
zobaczyć „to się zapali, gdy zaczniesz", a nie czarną dziurę.

---

### 10. „Twój rok z angielskim" — kartki do udostępnienia

**Korekta: maszyneria już istniała.** `weeklyRecap.ts` miał kompletny pipeline canvas→PNG→
`navigator.share({ files })` z fallbackiem na pobranie. To było uogólnienie szablonu, nie budowa
od zera — i przy okazji naprawa żywego błędu: `Montserrat` i `Roboto` były w `package.json`, ale
nigdzie nieimportowane, więc kartka tygodniowa renderowała się krojem zastępczym.

**Co.** Kartki w formacie story generowane na canvasie → PNG → `navigator.share({ files })`
(Web Share Level 2 działa w PWA na iOS). Sześć-osiem plansz: ile słów, ile dni z rzędu,
o której godzinie uczysz się najskuteczniej (`getEffectivenessByTimeOfDay` już to liczy),
najlepszy dzień, zdobyte odznaki, gdzie jesteś na trasie.

**Dlaczego to jest inne niż reszta listy.** Każdy inny pomysł tutaj poprawia wrażenia
istniejącego użytkownika. Ten jeden **robi nowych**. To jedyna pozycja z realnym potencjałem
wirusowym, bo jako jedyna wychodzi poza aplikację.

**Dane są w komplecie.** `sessions`, `dailyTime`, `achievements`, `weeklyRecap.ts`,
`getBestDayWordCount`, `getLongestStreak`, `getEffectivenessByTimeOfDay`.

**Ryzyko.** Sensowne dopiero przy kilku miesiącach historii. Dla użytkownika z tygodniem stażu
kartki będą żałosne — potrzebny próg minimalny i uczciwy komunikat poniżej niego.

---

### 11. Karta kamienia milowego

**Co.** Ta sama maszyneria co w §10, wyzwalana przy 1000 / 3000 / 6000 / 10 000 słów oraz przy
odznace „legenda". Jedna kartka zamiast serii.

**Dlaczego.** Tańsza niż podsumowanie roku i działa przez cały rok, a nie w grudniu.
Naturalnie dokłada się do `MasteryScreen` i `AchievementSheet`, które już mają moment
świętowania — brakuje im tylko przycisku „pokaż to komuś".

---

## Tier 3 — ruch i rytuał

### 12. Kinowe wejście w sesję

**Co.** 1,2 s planszy przed pierwszą kartą: nazwa paczki, poziom, liczba kart, pozycja na trasie
— a dopiero potem karta. framer-motion + View Transitions (oba już w użyciu), z poszanowaniem
`useReducedMotion`.

**Dlaczego.** Zamienia „kliknąłem przycisk" w „zaczyna się". Rytuał otwarcia to najtańszy sposób,
żeby sesja nauki miała ciężar. Ekrany sesji i tak już zrzucają całe chrome i gaszą shader —
dramaturgia jest w połowie zbudowana, brakuje kurtyny.

---

### 13. Odsłona tłumaczenia przez rozmycie

**Co.** Zamiast twardego obrotu — `filter: blur()` schodzące do zera razem z opacity, jak
ustawianie ostrości obiektywu.

**Dlaczego to nie jest tylko ozdoba.** Pasuje do pedagogiki: najpierw przypomnij sobie, potem
zobacz. Rozmycie przez ułamek sekundy pokazuje, że *coś tam jest*, nie zdradzając co — to jest
dokładnie ten moment wysiłku przypominania, na którym stoi retrieval practice.

**Uwaga.** Współistnieje z `useCardFlip` (`src/hooks/useCardFlip.ts`, maszyna stanów na
`animationend`), nie zastępuje go. Wariant do wyboru w ustawieniach albo A/B.

---

### 14. Animacje sterowane scrollem

**Co.** `animation-timeline: view()` na sekcjach `/postęp` — karty wjeżdżają i ustawiają ostrość
w miarę przewijania, bez jednej linii JavaScriptu.

**Dlaczego.** Zero kosztu wykonawczego, degraduje się do statyki tam, gdzie brak wsparcia.
`StatsPage` to długa strona z ośmioma sekcjami — idealny kandydat.

---

## Świadomie odłożone

### 15. Dotyk i fizyka

Dwa pomysły, które byłyby dobre, ale nie w tej rundzie:

- **Przeciąganie fiszki zamiast dwóch przycisków** — karta idzie za palcem, obraca się, zalewa
  kolorem w stronę „Znam"/„Nie znam". `HomePage` ma już `drag` + `PanInfo` z framer-motion, więc
  wzorzec jest w repo. Przyciski zostają jako alternatywa.
- **Szkło reagujące na przechył telefonu** — `DeviceOrientation` steruje pozycją połysku na
  `.u-liquid`. Wymaga `requestPermission()` w geście użytkownika na iOS 13+.

**Przy okazji uczciwa uwaga, którą warto znać, zanim ktoś zainwestuje w „język wibracji":**
`navigator.vibrate` **nie jest wspierane w Safari ani w PWA na iOS**. Cała obecna warstwa haptyki
— `src/hooks/useHaptics.ts`, `useCardFlip.ts:46`, `Toast.tsx:120,123`, `AchievementSheet.tsx:30`,
`DailyGoalPicker.tsx:104` — jest odczuwalna **wyłącznie na Androidzie**. To nie jest błąd
w kodzie, to ograniczenie platformy, ale zmienia rachunek opłacalności każdej przyszłej pracy
nad haptyką.

---

## Werdykt o bibliotekach

**Bierzemy:**

| biblioteka | rozmiar | po co |
|---|---|---|
| `@number-flow/react` | ~8 kB | liczniki z fizyką (§2) |
| `ogl` | patrz niżej | WebGL do konstelacji (§9) |

Zmierzone po wdrożeniu prototypu: cały leniwie ładowany fragment `Constellation` (ogl + shader +
komponent) to **60,9 kB / 19,4 kB po gzipie**, plus 1,2 kB CSS. Nie dolicza się do startu —
`StatsPage` ładuje go dopiero, gdy flaga jest włączona.

**Rozważyć osobno:**
- `vaul` — sheety z przeciąganiem do zamknięcia. Aplikacja ma ich sporo (`MetricsInfoSheet`,
  `AchievementSheet`, `CoverageInfoSheet`, `ReadinessInfoSheet`), a dziś nie mają gestu zamknięcia.
- `rive` — płomień serii jako maszyna stanów zamiast pętli. Ale ~100 kB runtime'u i wymaga pracy
  w edytorze Rive, więc tylko jeśli znajdzie się budżet na projektanta.

**Odrzucamy, i dlaczego:**
- **Wszystko na Tailwindzie** (shadcn/ui, Aceternity, Magic UI) — to drugi stack obok 90 ręcznie
  pisanych arkuszy BEM i pliku tokenów. Koszt integracji przewyższa efekt.
- **`lenis`** (smooth scroll) — psuje natywny scroll momentum w PWA. Na desktopie robi wrażenie,
  na telefonie szkodzi.
- **GSAP** — framer-motion już to robi, a jest w bundlu.
- **three.js / react-three-fiber** — ~150 kB tam, gdzie `ogl` załatwia sprawę za 12.
- **tsParticles** — ciężki i nie robi nic, czego nie zrobi własny shader.
- **Houdini Paint API** (ziarno, tekstury proceduralne) — brak wsparcia w Safari, czyli brak
  u większości użytkowników tej aplikacji.

---

## Macierz decyzyjna

**Szybkie wygrane** (efekt wysoki, koszt niski) — §1 okładka na ekranie blokady, §3 krój zmienny,
§5 spłata długu `fx-*`, §4 animowany rant, §2 liczniki.

**Duże zakłady** (efekt bardzo wysoki, koszt wysoki) — §9 konstelacja, §10 podsumowanie roku,
§6 dźwięk sesji.

**Wypełniacze** (efekt średni, koszt niski) — §12 wejście w sesję, §13 rozmycie, §14 scroll.

**Wymaga badania przed decyzją** — §7 wariant z `AnalyserNode` (test na iPhonie), §8 podkład
(test na ludziach: atmosfera czy irytacja), §3 diakrytyki w Bricolage.

## Sugerowana kolejność

1. **§1 okładka na ekranie blokady** — najlepszy stosunek efektu do kosztu i dotyka trybu, który
   jest sednem produktu.
2. **§3 krój** — bo zmienia wszystko naraz, a jest jednym plikiem tokenów (po przejściu testu
   diakrytyków).
3. **§9 konstelacja** — moonshot, za flagą, do oceny na żywo.
4. **§6 dźwięk sesji** — zero bajtów, duża zmiana charakteru.
5. **§10 podsumowanie roku** — kiedy będzie dość użytkowników z historią, żeby miało sens.
