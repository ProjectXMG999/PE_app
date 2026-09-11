# Pakiety — cele, funkcje, inteligencja. Plan systemu.

> **Status:** dokument kierunkowy, spisany 10.09.2026. Nie opisuje stanu kodu — opisuje, czym ta
> strona ma być. Kod Pakietów wrócił świadomie do stanu z `44d92fb` (wersja ze statystykami na
> górze); wszystkie próby implementacji z tego planu są dostępne w historii i w stashu — patrz
> „Historia prób" na końcu.

## Context

Dokument strategiczny, nie zlecenie implementacyjne. Spisuje: do czego ta strona służy, jakie
**wszystkie** cele ma spełniać, co już robi, co w danych mamy i nie wykorzystujemy, oraz jakie
inteligentne funkcje są realne — z rozdzieleniem, które stoją na danych, które wymagają jednego
przebiegu treściowego, a które są jeszcze badaniem.

Podstawa: audyt kodu (dwie rundy prac nad Pakietami, commity `337129a`, `bdae290`, `7dda968`),
przegląd systemu powtórek, osiągnięć, punktów i Readiness, oraz inspekcja danych źródłowych
`database/database/Baza Wizard + Zdania - Cała baza.csv`.

---

## Ustalenie, wokół którego kręci się cały dokument

Produkt sprzedaje **nawigację**: *„Nie potrzebujesz ósmej nawigacji. Potrzebujesz jednej dobrej
mapy"*, *„Nawigacja wie, gdzie skręcić. Progress wie, którego słowa potrzebujesz dalej"*.

A w kodzie:

- jedyna personalizacja w całej aplikacji to `todayLevel` (poziom startowy) i `dailyGoalSec`
  (`src/store/useAppStore.ts`);
- wybór następnego pakietu to `nextListenPack` / `nextTrainPack` (`src/data/nextPack.ts`) —
  **„najwcześniejszy nieukończony"**, i nic więcej;
- kolejność 864 pakietów jest identyczna dla każdego użytkownika i nie zmienia się nigdy.

**Nawigacja, która każdemu podaje tę samą trasę niezależnie od celu, nie jest nawigacją — jest mapą
z jedną narysowaną linią.** To nie jest wada implementacji Pakietów. To jest największa
niewykorzystana szansa produktu i główna oś tego planu.

---

## Część 1. Rola: do czego służy ta strona

| Ekran | Rola | Pytanie | Czego NIE robi |
|---|---|---|---|
| **Dzisiaj** | trener | „Co robić teraz?" | nie pokazuje katalogu |
| **Postęp** | analityk (13 sekcji) | „Jak mi idzie?" | nie proponuje działania |
| **Pakiety** | **terytorium** | **„Jak wygląda świat, który zdobywam, ile z niego jest moje i co jest warte następnego kroku?"** | nie coachuje i nie analizuje |

Pakiety to **jedyny ekran, który widzi cały produkt naraz**. Stąd jego wyłączne zadania: skala,
kolejność, treść, dorobek i wybór spośród 864 możliwości. Wszystko, co odpowiada na „jak mi idzie",
należy do Postępu; wszystko, co na „zrób to teraz", do Dzisiaj.

---

## Część 2. Cele — pełna lista

Każdy cel ma mierzalne kryterium, żeby dało się powiedzieć, czy strona go realizuje.

### A. Orientacja — „gdzie jestem"
- **A1. Pozycja na trasie.** Ile z 10 000 i gdzie to jest. *Miara:* użytkownik wskazuje swoje
  miejsce bez czytania liczb.
- **A2. Znaczenie tej pozycji.** Liczba „1 221 / 10 000" to 12% — demotywujące i nieinformacyjne.
  Cel: pokazać **zdolność**, nie ułamek (patrz T1.1 — pokrycie).
- **A3. Granica wiedzy.** Gdzie kończy się zdobyte, zaczyna nieznane.
- **A4. Następny kamień milowy.** Ile do niego i co da.

### B. Wartość i zakres — „co mam"
- **B1. Skala jako majątek.** 864 pakiety to rzecz kupiona za ~95 zł/mies. Ma wyglądać na dorobek,
  nie na listę zadań.
- **B2. Kolejność jako widoczna wartość.** Cała teza produktu. Jeśli użytkownik nie widzi, *dlaczego*
  ten pakiet jest teraz — kupił listę słów.
- **B3. Treść.** Co jest w środku pakietu.
- **B4. Dorobek trwały.** Co zdobyte i na jak długo.

### C. Decyzja — „co teraz"
- **C1. Jedna następna akcja** — bez dublowania Dzisiaj.
- **C2. Koszt każdego wyboru.** Ile czasu, jak trudno *dla mnie*.
- **C3. Alternatywy**, gdy nie chcę „następnego": powtórka, słabe ogniwo, coś krótkiego.
- **C4. Dopasowanie do teraz.** 3 minuty o 23:00 to inna propozycja niż 40 minut o 8:00.

### D. Uczciwość — „czy to prawda"
- **D1. Co blaknie.** FSRS wie; żaden ekran nie mówi, *które* zdobyte terytorium się osuwa.
- **D2. Zadeklarowane vs sprawdzone.** „Znam wszystko" ustawia `stability` bez ani jednej powtórki.
- **D3. Niepewność szacunków.** Prognozy jako zakresy, nie punkty.
- **D4. Prognoza.** Co się stanie, jeśli nic nie zrobię.
- *Wymóg z sekcji naukowej landingu:* **„pokazuj postęp uczciwie"**, *„Czy użytkownik jedynie ma
  nadzieję, że się rozwija, czy może zobaczyć wiarygodne dowody?"*.

### E. Dostęp i nawigacja
- **E1. Dotarcie do dowolnego z 864 w dwie sekundy.**
- **E2. Szukanie przez znaczenie**, nie tylko po nazwie pakietu.
- **E3. Filtry jako soczewki** (poziom, kategoria, stan) — nie jako sortowanie.
- **E4. Powrót do miejsca.** Scroll, rozwinięte tomy, pozycja mapy.

### F. Motywacja i tożsamość
- **F1. Poziomy nagrody** — widoczna różnica między „w toku", „opanowane" i „na stałe".
- **F2. Małe zwycięstwa** — co 100 słów, zgodnie z obietnicą landingu.
- **F3. Artefakt do pokazania** — „moja mapa".
- **F4. Cel osobisty** — po co ja się tego uczę (dziś nie istnieje w modelu danych).

### G. Biznes
- **G1. Sprzedaż.** Dla nieopłaconych katalog jest powierzchnią paywalla: ma kusić, nie straszyć.
- **G2. Retencja.** Widoczny dorobek to koszt odejścia.
- **G3. Wzrost.** Udostępnialny artefakt.

### H. Higiena (warunki, nie cele)
- **H1.** Nie dublować Dzisiaj ani Postępu. **H2.** Mobile-first, płynność (rAF stoi w bezczynności).
- **H3.** Dostępność i `prefers-reduced-motion`. **H4.** Nie przeciekać treści za paywallem.

---

## Część 3. Co strona robi dziś (stan `44d92fb`)

`StatsRow` (4 chipy: seria, słowa, słowa/dzień, dni do Level N) · `OnboardingCard` ·
`QuickStartCards` (Kontynuuj: Słuchaj / Trenuj) · `FilterTabs` w trzech rzędach (poziomy +
`LevelProgressBars` + karta opisu poziomu, kategorie, statusy) · `SectionHeader` „Pakiety" ·
lista okienkowana z `LevelBandHeader` · karta z numerem, emoji, pierścieniem opanowania,
paskiem odsłuchania i **dwoma przyciskami** (Słuchaj / Trenuj).

Realizuje: A1 częściowo (pasek 0→10 000), A4, B1, B4, C1, E1, E3, F1, F2 częściowo, G1.

**Nie realizuje wcale: A2, A3, B2, B3, C2, C3, C4, D1, D2, D3, D4, E2, E4, F3, F4.**
Dodatkowo łamie H1 — `StatsRow` i `QuickStartCards` dublują ekran Dzisiaj, a lista sortuje
pakiety po `pack.level`, który **nie jest monotoniczny** wzdłuż trasy, więc rozbija kolejność
stanowiącą rdzeń produktu.

---

## Część 4. Analiza naszej idei — co jest mocne, co słabe

**Mocne.** Metafora mapy jest właściwa i nieprzypadkowa — wynika z copy produktu, a nie z mody.
Podział ról między trzy ekrany jest czysty. Warstwa pamięci (blaknięcie) to jedyna rzecz na rynku,
której nikt nie pokazuje, i wynika wprost z FSRS, który już działa. Zasada „nagroda nigdy nie
znika" chroni nas od gamifikacji karzącej.

**Słabe — i to są prawdziwe luki, nie kosmetyka:**

1. **Mapa jest statyczna, a nazywa się nawigacją.** Ta sama trasa dla wszystkich (patrz wyżej).
2. **Strona nie ma opinii.** Pokazuje 864 możliwości i jedną („następny"). Nie mówi, *dlaczego*,
   nie zna kosztu, nie proponuje alternatywy.
3. **Nagłówek liczy ułamek, nie zdolność.** „1 221 / 10 000" mierzy dystans do końca listy, a nie
   to, co użytkownik już potrafi. Produkt sprzedaje drugie, a interfejs pokazuje pierwsze.
4. **Mapa patrzy tylko w przeszłość.** FSRS pozwala policzyć przyszłość dokładnie — nie robimy tego.
5. **Bogata analityka leży odłogiem** (Część 5.2) — liczymy dużo i nie używamy tego do decyzji.

---

## Część 5. Inteligencja

### 5.1 Co już jest inteligentne (i gdzie)

| Mechanizm | Gdzie | Czy działa na Pakietach |
|---|---|---|
| FSRS-4.5, `REQUEST_RETENTION = 0.9` | `services/fsrs.ts` | tylko jako kolor węzła |
| Priorytet słowa `scoreDueWord` (rozpad pamięci, zaniedbanie, kruchość) | `services/reviewQueue.ts` | nie |
| Budżet dzienny `computeServingState` (tryb `pace`) | `reviewQueue.ts` | nie |
| Pilność `reviewUrgency` (calm/building/urgent) | `reviewQueue.ts` | nie |
| Emerytura słowa `stability ≥ 365` | `review.ts` | nie (planowane jako „Na stałe") |
| Readiness: 5 składowych (świeżość .25, retencja .25, regularność .20, mówienie .15, skuteczność .15) | `hooks/useReadinessScore.ts` | nie |
| 62 odznaki / 18 metryk | `services/achievements.ts` | nie |
| Punkty ⬥ z rozbiciem na 7 źródeł | `services/points.ts` | nie (i rozbicie nigdzie się nie renderuje) |
| Najlepsza pora dnia | `components/stats/TimeOfDayChart.tsx` | nie |

**Wniosek: cała inteligencja aplikacji jest albo w silniku powtórek, albo na ekranie analitycznym.
Na ekranie decyzyjnym nie ma jej wcale.**

### 5.2 Sygnały liczone i nieużywane — inteligencja leżąca odłogiem

**Najcenniejsze: `PackMemory.strength`.** Dla każdego z 864 pakietów liczymy **średnie
prawdopodobieństwo przypomnienia** (`packStrength`, `packMemory.ts:68-79`) — i to **na tej właśnie
stronie**, przy każdym renderze. Używamy z tego jednego bitu: `strength < 0.7`. Sama liczba nigdy
nie jest pokazywana. To jest gotowy, policzony fundament pod T1.2, T1.3 i T1.7.

**Drugie: wiemy *które* pakiety blakną i tego nie mówimy.** `fadingPacks()` zwraca listę
identyfikatorów, a `MemoryStrip` renderuje wyłącznie `.length` („N pakietów wraca do Ciebie").

**Nie istnieje żaden wskaźnik skuteczności per kategoria / poziom / tom / rozdział.**
`CategoryProgressBars` i `LevelProgressBars` to czyste liczniki słów. Wszystkie składniki są
zindeksowane (`seenCount`, `lapseCount`, `difficulty`, `stability`, `retrievabilityOf`,
`packLevelOf`, `PackMeta.category`) — **nic ich nie łączy**. T1.7 to więc tani JOIN, nie nowe dane.

Dalej odłogiem: `bulkKnownTotal` · `PackMemory.claimed` (liczone, czytane przez nic) ·
`PackMemory.retired` · `staleCount` · `retiredCount` · `served` · `reviewTotal` ·
`retentionBreakdown` (tylko globalnie, nigdy per pakiet) · 7-elementowe rozbicie punktów ·
pełny Readiness · skuteczność wg pory dnia · wynik `scoreDueWord` (nigdy nie widać „dlaczego to
słowo") · `longestStreak`, `bestDayCount`, `startedPacks`, `estimatedMinutes` z `useStats`.

### 5.3 Czego chcemy — T1: stoi na danych, które już mamy

- **T1.1 Pokrycie zamiast ułamka.** *(największa pojedyncza zmiana w tym dokumencie)*
  Zamiast „1 221 / 10 000 (12%)" → **„rozumiesz ~X% codziennej rozmowy"**. Dane: `Lp` w bazie
  źródłowej biegnie 1→11 413 **ściśle monotonicznie**, czyli istnieje globalna ranga użyteczności
  każdego słowa; produkt sam twierdzi, że to ranga użyteczności. Cztery progi już *są* deklaracjami
  pokrycia w języku naturalnym („Dogadasz się w podróży" @1000, „Powiesz, co myślisz" @3000).
  **Uczciwość:** brak w danych rangi częstotliwości z korpusu (kolumny to `Lp, Poziom, Tom,
  Rozdział, Jednostka, Nazwa paczki, Słowo ENG, Tłumaczenie PL, Zdanie ENG, Zdanie PL`) — więc
  liczbę pokazujemy jako **szacunek zakotwiczony w progach poziomów**, z arkuszem „skąd to wiemy"
  i cytatem badań, które landing już przywołuje (Nation, Schmitt, Webb). Nigdy jako pomiar.
- **T1.2 Prognoza — mapa, która patrzy w przyszłość.** Suwak czasu na atlasie: „za 7 / 30 / 90 dni,
  jeśli nic nie zrobisz". `retrievability(t, stability)` to funkcja czasu, więc przyszłość liczymy
  dokładnie. Spektakularne wizualnie, prawdziwe naukowo, i odwracalne — nie łamie zasady „nagroda
  nie znika". Nikt na rynku tego nie pokazuje.
- **T1.3 Przewidywany koszt pakietu.** „~12 min · dla Ciebie trudniejszy niż zwykle”. Z FSRS
  `difficulty` i `lapseCount` Twoich słów w tej kategorii + realne słowa/min z `Session.durationSec`.
- **T1.4 Detekcja okazji.** „3 pakiety są jedną powtórką od »Na stałe«" — z `stability` względem
  progu 365. Precyzyjny, tani, mocny bodziec.
- **T1.5 Następny pakiet z opinią.** Dziś „najwcześniejszy nieukończony". Zamiast tego mieszanka:
  kolejność trasy + dług powtórkowy + Twoje słabe kategorie + dostępny czas — **z wyjaśnieniem**.
- **T1.6 Dopasowanie do teraz.** Trzy minuty o 23:00 → inna propozycja niż 40 minut o 8:00.
  Dane: `startedAt`, `dailyTime`, Readiness, najlepsza pora dnia.
- **T1.7 Profil mocnych i słabych stron jako soczewka.** „Twoje słabe ogniwo: Phrasale (61%)".
  Filtr kategorii przestaje być listą, a staje się diagnozą.
- **T1.8 Gotowość treściowa pakietu.** *(patrz Część 6.2 — to nie jest zadanie interfejsowe)*
  Dopóki żadne słowo nie ma zdania, nie ma czego oznaczać. Po uruchomieniu potoku `apply-*` karta
  powinna wiedzieć, które tryby są dla niej dostępne — uczciwość wobec użytkownika i darmowy
  pulpit produkcyjny dla zespołu.
- **T1.9 Poziom komfortu.** `ratedCount` / `knownHitCount` (Twoja praca w toku) → wskaźnik
  sukcesu sesji → rozmiar porcji i rekomendacja trybu. Sygnał już jest zapisywany.
- **T1.10 Wyjaśnij rekomendację.** Każda propozycja mówi dlaczego. To warunek zaufania do systemu,
  który zaczyna decydować za użytkownika.

### 5.4 Czego chcemy — T2: wymaga jednego przebiegu treściowego

Zespół ma już potok skryptów na OpenAI (`scripts/generate-sentences.ts` i pokrewne), więc to jest
rozszerzenie istniejącej infrastruktury, nie nowa.

- **T2.1 Tagi tematyczne per słowo → trasa zależna od celu.** „Jadę do Londynu za 6 tygodni",
  „praca w IT", „rozmowy z rodziną partnera" → trasa **przewaguje kolejność w obrębie poziomu**
  (nie przeskakuje poziomów). To domyka **F4** i realizuje obietnicę nawigacji.
- **T2.2 Szukanie przez znaczenie.** „chcę umieć rozmawiać o pieniądzach" → mapa podświetla
  właściwe pakiety. Embeddingi liczone w buildzie, skwantyzowane i doładowywane leniwie
  (11 413 słów × 128 wymiarów int8 ≈ 1,5 MB, cache SW); szukanie kosinusowe po stronie klienta jest
  trywialne. **Zera infrastruktury wektorowej w repo**: brak embeddingów, kolumny wektorowej
  w 7 migracjach, indeksu ANN i jakiegokolwiek artefaktu — jedyne podobieństwo tekstu to
  `fuzzyScore` po nazwach pakietów. To nowa warstwa, choć mała.
- **T2.3 Pary mylące się.** Sąsiedzi w przestrzeni embeddingów + Twoje `lapseCount` → „te dwa słowa
  Ci się mylą" i celowany drill.
- **T2.4 Część mowy i poziom CEFR.** Brakuje w danych; wzbogacenie poprawia T1.3.

### 5.5 Czego chcemy — T3: badanie, nie plan

- **T3.1 Osobisty model pamięci.** FSRS pozwala dopasować wagi `W` do użytkownika. Wymaga danych
  i walidacji; nie ruszać bez pomiaru.
- **T3.2 Skład pakietu świadomy interferencji** — przebudowa treści, nie interfejsu.
- **T3.3 Pokrycie zwalidowane korpusem** (BNC/COCA) — zamieniłoby szacunek z T1.1 na pomiar.

---

## Część 6. Ograniczenia i długi (znalezione przy analizie)

**6.1. Brak rangi częstotliwości, części mowy i tagów tematycznych** w danych — gate dla T1.1
(szacunek zamiast pomiaru), T2.1 i T2.4. Jedyne mapowanie CEFR w repo to `scripts/sentences/lib/
levelGuide.ts` i jest **per poziom, nie per słowo** (1→A1-A2, 2→B1, 3→B2, 4→C1).

**6.2. ⚠ Najpoważniejsze ustalenie całego audytu: połowa trybów treningowych nie działa.**
W wysłanych do klienta pakietach **wszystkie 11 375 słów mają `sentenceEn: null`** — nie 9%, jak
napisałem wcześniej na podstawie bazy źródłowej, a **zero**. Skutek:
`ActiveSentencePage`, kroki `standard` i `speaking` w autoplayu (`autoplayModes.ts` — `needs:
'sentenceEn'`) oraz linia zdania na fiszce **są dziś martwe**.
Jednocześnie treść **istnieje i jest opłacona**: ~3 000 słów ma po 3 zweryfikowane kandydatury
w `sentence-output/checkpoint.jsonl` (6 009 rekordów), a `database/database/candidates-master-v4.xlsx`
ma 11 413 wierszy z kolumnami `Zdanie ENG 1..12 / Zdanie PL 1..12` **plus kolumnę `Wybrane`
z ludzkim wyborem kandydata** i kolumnę `audio` z werdyktem QA. Nikt nie uruchomił
`scripts/apply-generated-sentences.ts` / `apply-chosen-candidates.ts`.
*To jest zadanie o wyższym priorytecie niż cokolwiek na Pakietach* — żadna funkcja tej strony nie
da tyle, ile odblokowanie dwóch trybów nauki, które użytkownik już kupił. Do tego źródło ma
bogatsze tłumaczenia niż klient (`„Móc; umieć; potrafić"` vs wysłane `„Móc"`).

**6.3. 14 pakietów odstaje od modelu „10 lub 15 słów"** — `t1-p734` (1 słowo), `t1-p677` (2),
`t1-p571` (3), `t1-p865` „Fantasy" (35). Numer trasy jest teraz tożsamością pakietu, więc te
anomalie będą widoczne. Do decyzji treściowej: scalić czy zostawić.

**6.4. Luki w numeracji trasy** (#102 nie istnieje między #101 i #103).

**6.5. `packages-index.json` (152 kB) w 17 modułach synchronicznie**, część przy starcie — pełne
odroczenie wymaga refaktoru async.

**6.6. Brak w modelu pojęcia celu użytkownika** — jedyna personalizacja to `todayLevel`.

**6.7. Sygnał komfortu nie opuszcza urządzenia.** `ratedCount` / `knownHitCount` nie są w payloadzie
`saveSession` do Supabase i żadna migracja nie dodaje kolumn — po zmianie telefonu przepadają.
Jeśli mają napędzać adaptację, potrzebują kolumn i migracji.

**6.8. Zbudowane i wyłączone / martwe.** `REVIEW_INTERLUDES_ENABLED = false` wyłącza cały podsystem
przeplatania powtórek (`planInterludes`, `packsBelowKnownRatio`). `PRIORITY.overduePerDay`
i `overdueCap` nie są referencjonowane przez żaden kod (zamiast nich zaszyty `clamp(late/20,0,1)`).
Komponenty `ReadinessScoreBanner`, `PersonalBestCard`, `ActivityChart` nie są nigdzie importowane.
`useStats()` zwraca 19 pól, `StatsPage` czyta 12.

**6.9. `useReviewSet` ogranicza sesję do 20 słów i 8 pakietów**, więc `SERVING_MAX = 40` jest
nieosiągalne w jednej sesji, a słowo o wysokim priorytecie w 9. pakiecie zostaje pominięte.

**6.10. Per-user FSRS to dziś fantazja.** `W` to publikowane wagi populacyjne, a w bazie **nie ma
tabeli logu powtórek** — bez niej nie ma na czym optymalizować.

---

## Część 7. Priorytety

**Fala 0 — poza Pakietami, ale przed nimi: uruchomić `apply-*` i wgrać zdania.**
Dwa tryby nauki, które użytkownik kupił, są martwe, a treść jest wygenerowana i zweryfikowana
(Część 6.2). Żadna funkcja tej strony nie da tyle wartości. Wpisuję to tutaj, bo plan Pakietów
byłby nieuczciwy, gdyby przemilczał, że priorytet leży gdzie indziej.

**Fala 1 — strona zaczyna mieć opinię (bez nowych danych):** T1.1 pokrycie · T1.4 okazje ·
T1.5 następny z opinią · T1.10 wyjaśnienie · **pokazać `strength` i listę blaknących**
(policzone, ukryte — Część 5.2).
*Uzasadnienie:* domyka A2, B2, C1, C3, D2 — największe brakujące cele — i całość stoi na danych,
które już leżą w IndexedDB, a część nawet w pamięci tej strony.

**Fala 2 — mapa żyje:** T1.2 prognoza · T1.3 koszt pakietu · T1.7 profil (tani JOIN — Część 5.2) ·
T1.6 dopasowanie do teraz · T1.8 gotowość treściowa (po Fali 0).
*Uzasadnienie:* to jest „wow" i jednocześnie D3/D4/C2/C4.

**Fala 3 — trasa staje się osobista:** T2.1 tagi + cel · T2.2 szukanie przez znaczenie.
*Uzasadnienie:* dopiero to czyni z mapy nawigację i domyka F4 oraz E2. Wymaga przebiegu treściowego,
więc planować równolegle z produkcją zdań.

**Fala 4 — badanie:** T2.3, T3.x. T3.1 (osobisty model pamięci) wymaga najpierw **tabeli logu
powtórek**, której nie ma — bez niej nie ma na czym optymalizować wag FSRS.

**Osobno, poza falami — decyzje o długu:** czy włączyć `REVIEW_INTERLUDES_ENABLED`, czy podnieść
limit 20 słów / 8 pakietów w `useReviewSet`, czy zsynchronizować sygnał komfortu do Supabase,
czy usunąć trzy martwe komponenty i dwie martwe stałe (Część 6.7–6.9).

---

## Część 8. Co świadomie odrzucam

- **Przeniesienie analityki z Postępu na Pakiety.** Ekran ma mieć opinię, nie wykresy.
- **Skracanie trasy / przeskakiwanie poziomów przez algorytm.** Kolejność to produkt; wolno ją
  **przeważać w obrębie poziomu**, nie porzucać.
- **Gamifikacja karząca.** Blaknięcie nigdy nie odbiera dorobku (`known` jest trwały w modelu).
- **Pokrycie podane jako pomiar** bez korpusu — to byłoby złamanie własnej deklaracji uczciwości.
- **Automatyczne podważanie „Znam wszystko"** bez decyzji produktowej — scheduler i tak sprawdzi
  te słowa za ~2 tygodnie (`BULK_KNOWN_STABILITY = 15`, `retiredAt: undefined`).

---

## Część 9. Jak zmierzymy, że plan zadziałał

- **A2:** użytkownik potrafi powiedzieć, co potrafi, nie tylko ile zrobił.
- **B2:** potrafi wyjaśnić, dlaczego proponowany pakiet jest teraz.
- **C1/C2:** czas od wejścia na stronę do rozpoczęcia sesji spada; spada też odsetek wejść
  kończących się bez żadnej akcji.
- **D1/D4:** rośnie udział dni z wyczyszczoną porcją powtórek (`reviewLedger.cleared`).
- **F1:** rośnie liczba pakietów w stanie „Na stałe" (metryka, której dziś nie liczymy nigdzie).
- **H2:** pętla rAF nadal stoi w bezczynności; startowy chunk nie rośnie.

---

## Historia prób — gdzie leży kod

Strona przeszła trzy podejścia i została **świadomie cofnięta** do `44d92fb`. Żadne z nich nie
przepadło; każde jest jedną komendą od przywrócenia i warto je znać, bo każde rozwiązywało coś,
co w wersji bieżącej wraca jako problem.

| Wersja | Co wnosiła | Czego jej brakowało |
|---|---|---|
| `337129a` | kolejność trasy (nie sortowanie po poziomie), tomy jako sekcje, jedna akcja na kartę, filtry w URL, kamienie milowe | nadal płaska lista, zero angielskiego na kartach |
| `bdae290` | płótno z całymi 864 pakietami, terytoria poziomów, mgła, warstwa pamięci FSRS, 3 słowa na karcie | przy 864 kropkach mapa jest teksturą pokazującą głównie pustkę; zjadała pół ekranu |
| `7dda968` | atlas okolicy (~48 pakietów, czytelne numery), minimapa całości, numer trasy zamiast emoji, hierarchia wiersza | dużo miejsca na hero; emoji usunięte kosztem rozpoznawalności |
| stash | pokrycie `~85% rozmowy` zamiast ułamka, panel „co teraz" z powodem i kosztem, złote i holograficzne poziomy nagrody, nazwane pakiety w pasie pamięci, koszt na kartach, 32 testy | nieukończone (brakowało CSS kosztu na karcie) |

Przywracanie:

```bash
git stash list                                        # praca z ostatniej tury
git stash pop
git checkout 7dda968 -- src/components/home/Atlas/    # atlas okolicy + minimapa
git checkout bdae290 -- src/components/home/Atlas/    # atlas z całymi 864
git checkout 337129a -- src/pages/HomePage.tsx src/components/home/
```

Weryfikacja czegokolwiek z tego dokumentu (Node nie jest na `PATH`):
`export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"` → `npx tsc -b && npx vitest run && npm run build`.

## Co z tego planu jest niezależne od wyglądu strony

Trzy rzeczy z tego dokumentu **nie zależą** od tego, jak strona wygląda, i zostają aktualne
niezależnie od wybranego kierunku wizualnego:

1. **Fala 0** — uruchomić `apply-*` i wgrać zdania (Część 6.2). Dwa tryby nauki są martwe.
2. **`PackMemory.strength`** — średnie prawdopodobieństwo przypomnienia liczone dla każdego
   pakietu i redukowane do jednego bitu (Część 5.2).
3. **Brak wskaźnika skuteczności per kategoria** — tani JOIN, wszystkie składniki zindeksowane.
