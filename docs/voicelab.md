# Naturalne TTS dla pojedynczych słów w ElevenLabs — analiza i rekomendacje dla apki do nauki języka

## TL;DR
- **Przyczyna problemu:** eleven_multilingual_v2 to model *kontekstowy* — jak pisze ElevenLabs, „our models adapt to textual cues across 32 languages and multiple voice styles", a modele nowej generacji „read the entire passage first, then use that wider context to decide how a line should sound". Przy pojedynczym słowie model nie ma z czego przewidzieć naturalnej prozodii (rytmu, akcentu, intonacji), więc dokleja losowe pauzy/urwania. Kropka (`withPeriod()`) sygnalizuje tylko opadającą intonację oznajmującą — nie dostarcza kontekstu rytmicznego, dlatego pełne zdania z tego samego pipeline'u brzmią świetnie, a słowa nie.
- **Najskuteczniejsze rozwiązanie jakościowe:** generuj słowo *wewnątrz krótkiej frazy nośnej* („Słowo: {word}."), użyj endpointu `/with-timestamps` (zwraca `characters[]`, `character_start_times_seconds[]`, `character_end_times_seconds[]`) i wytnij samo słowo przez ffmpeg. Endpoint jest rozliczany per znak jak zwykłe TTS (~$0.10/1000 znaków dla multilingual_v2), bez dopłaty za timestampy.
- **Model:** zostań przy `eleven_multilingual_v2`. **NIE** przechodź na `eleven_v3` do słów — „results can vary significantly between generations and often require multiple attempts", brak parametru `speed`. Podnieś `stability` do ~0.5–0.6 dla słów, zweryfikuj `speed` (0.75 jest blisko minimum 0.7), dodaj post-processing (trim ciszy + normalizacja LUFS), a przy skali ~96 000 plików zaplanuj concurrency wg planu (Pro=10, Scale=15).

---

## Key Findings

### 1. Dlaczego pojedyncze słowa brzmią źle — przyczyna techniczna
Neuronowe modele TTS nie wymawiają słów w izolacji — analizują całą frazę i przewidują prozodię kontekstowo. Prozodia (intonacja, tempo, akcent zdaniowy, pauzy) jest przewidywana na podstawie pozycji słowa w zdaniu, gramatyki, interpunkcji i tokenów końca zdania. Przy pojedynczym słowie pojawia się klasyczny „one-to-many mapping problem": to samo słowo może zabrzmieć na wiele sposobów, a bez kontekstu model wybiera nieprzewidywalnie. Stąd: urwane końcówki, dziwne tempo, „rosnąca intonacja niedokończonej frazy".

Twój workaround z kropką działa *częściowo*, bo kropka to sygnał „falling declarative" (opadająca intonacja oznajmująca zamiast pytającej rosnącej). Ale kropka nie naprawia tempa ani rytmu — model nadal nie wie, ile sylab jest przed/po słowie ani gdzie pada akcent zdaniowy. To dokładnie tłumaczy Twoją obserwację: **zdania brzmią świetnie, bo mają kontekst; słowa nie, bo go nie mają.**

### 2. voice_settings — różne presety dla słów i zdań
Parametry (multilingual_v2): `stability` (0–1, default 0.5), `similarity_boost` (0–1, default 0.75), `style` (default 0), `use_speaker_boost` (default true), `speed` (0.7–1.2, default 1.0).

- **stability:** niskie wartości dają większą zmienność, ale ElevenLabs ostrzega, że zbyt niskie „may result in odd performances that are overly random and cause the character to speak too quickly". **Dla izolowanych słów zalecam wyższe stability (~0.5–0.6, test do 0.7)** — mniej losowości = mniej dziwnego tempa i urwań. Dla zdań zostaw obecne ustawienia (skoro brzmią dobrze), zwykle ~0.4–0.5.
- **similarity_boost:** ~0.75 (default) jest OK; 0.75–0.9 zwiększa klarowność, ale 1.0 powoduje przesadną artykulację („news anchor effect").
- **style:** trzymaj na 0. ElevenLabs pisze wprost: „using this setting has shown to make the model slightly less stable… In general, we recommend keeping this setting at 0 at all times".
- **use_speaker_boost:** możesz zostawić `true` (subtelny efekt, lekko zwiększa latencję).

**Kluczowa zmiana:** wprowadź osobny preset `word` (wyższa stability) i `sentence` (obecne ustawienia).

### 3. Spowalnianie mowy (0.75 dla uczących się angielskiego)
- Parametr `speed` jest oficjalny i dostępny w multilingual_v2. Z dokumentacji: „The default value is 1.0… Values below 1.0 will slow the voice down, to a minimum of 0.7. Values above 1.0 will speed up the voice, to a maximum of 1.2. Extreme values may affect the quality of the generated speech. Speed is not available for the Eleven v3 model." **Twoje 0.75 jest blisko dolnej granicy — może obniżać naturalność zależnie od głosu.**
- `speed` jest lepszy niż SSML `<prosody rate>`, bo multilingual_v2 **nie obsługuje** SSML prosody/break/phoneme (phoneme tags działają tylko we flash_v2; IPA tylko w v3).
- **Alternatywa dająca często czystszy efekt:** generuj słowo w tempie 1.0 (naturalne dla modelu) i spowalniaj post-processingiem — ffmpeg `atempo=0.75` (zachowuje wysokość tonu) lub biblioteka rubberband (lepsza jakość time-stretch).
- **Rekomendacja:** A/B test na kilkunastu słowach: (a) `speed=0.75` natywnie vs (b) `speed=0.8`/`1.0` + ffmpeg `atempo`. Dla wielu głosów natywny 0.8 + lekki post-processing to najlepszy kompromis.

### 4. Fraza nośna + wycinanie — najważniejsza rekomendacja jakościowa
Zamiast gołego słowa + kropka: umieść słowo w minimalnej, neutralnej frazie, wygeneruj przez `/with-timestamps` i wytnij audio samego słowa. To udokumentowany wzorzec w literaturze TTS — umieszczenie słowa „in a natural carrier phrase" daje naturalną wymowę, a izolowane fragmenty przycina się przez VAD/trim. To standard budowy korpusów słów.

- **Endpoint:** `POST /v1/text-to-speech/{voice_id}/with-timestamps`. Domyślny model to `eleven_multilingual_v2`, obsługuje polski. Zwraca `audio_base64` oraz `alignment` i `normalized_alignment`, każdy z polami `characters[]`, `character_start_times_seconds[]`, `character_end_times_seconds[]`. Uwaga: parametr `language_code` jest „not supported for multilingual_v2 models" — model sam wykrywa język z tekstu (polski działa natywnie).
- **Koszt:** rozliczany per znak jak zwykłe TTS (multilingual_v2 = 1 kredyt/znak, ~$0.10/1000 znaków w API), **bez dopłaty za timestampy**. ALE fraza nośna dodaje znaki (np. „To słowo: dom." ≈ 14 znaków zamiast 4), więc koszt *na słowo* rośnie proporcjonalnie — trzymaj frazę krótką.
- **Implementacja (TS):** dekoduj `audio_base64` → pogrupuj znaki w słowa po spacjach → weź `character_start_times_seconds` pierwszego znaku docelowego słowa i `character_end_times_seconds` ostatniego → ffmpeg `-ss START -to END` + margines ~30 ms + fade in/out ~10–30 ms (przeciw klikom).
- **Alternatywa:** Forced Alignment API daje timestampy od razu na poziomie słów (obsługuje polski), ale wymaga osobnego wywołania (audio + tekst). Dla generowania od zera `/with-timestamps` jest prostszy — jeden request = audio + czasy.

### 5. Sztuczki tekstowe / interpunkcja
- multilingual_v2 **nie obsługuje** SSML break/prosody. Obsługuje interpunkcję jako sygnały prozodii: kropka (opadająca intonacja), przecinek (krótka pauza), wielokropek `…` (spowolnienie/zawieszenie), myślnik `—` (krótka pauza), WIELKIE LITERY (nacisk).
- Dla gołego słowa kropka jest lepsza niż jej brak, ale sama interpunkcja nie zastąpi kontekstu — dlatego fraza nośna jest skuteczniejsza.
- **Pronunciation Dictionary** (alias via `.PLS`) — przydatny do wymuszenia wymowy trudnych słów/zapożyczeń, ale **nie naprawia** problemu prozodii/tempa. Multilingual_v2 obsługuje tylko alias, nie phoneme tags.

### 6. Modele — v2 vs v3 vs Flash dla słów
- **eleven_multilingual_v2:** „most life-like", stabilny, polski + angielski, limit 10 000 znaków/request, ~$0.10/1000 znaków (API). **Zostań przy nim.**
- **eleven_v3:** najbardziej ekspresyjny, 70+ języków, ale to model alpha — „results can vary significantly between generations and often require multiple attempts to achieve the desired output". Brak parametru `speed`, brak `similarity`/`speaker_boost`, limit 5000 znaków, droższy. **Nieodpowiedni** do masowej, deterministycznej generacji słów.
- **eleven_flash_v2_5:** ultra-niska latencja (~75 ms) na 32 językach, ~$0.05/1000 znaków (50% taniej), obsługuje polski — ale niższa jakość i gorsza normalizacja liczb (domyślnie wyłączona). Kandydat tylko gdyby koszt/tempo dominowały nad jakością; dla nauki języka jakość v2 jest ważniejsza.
- **Turbo:** deprecated — ElevenLabs zaleca Flash.

### 7. Skala (~96 000 plików)
- **Concurrency (Multilingual v2):** Free=2, Starter=3, Creator=5, Pro=10, Scale=15, Business=15 (Flash mniej więcej podwaja te wartości). **Twoje obecne 3 równoległe = plan Starter.** Dla 96k plików rozważ Pro (10) lub Scale (15) by drastycznie skrócić czas generacji.
- **429 — dwa kody:** `too_many_concurrent_requests` (rozwiązanie: kolejkowanie/queue, np. `p-queue`, **nie** zwykły retry) oraz `system_busy` (exponential backoff z jitterem: start 1 s, podwajaj, cap 32 s). Twój backoff jest dobry — dodaj rozróżnienie typu błędu.
- **Monitoring:** czytaj nagłówki `current-concurrent-requests` i `maximum-concurrent-requests`.
- **Koszt:** goły word ~5–8 znaków; z frazą nośną ~15–20 znaków; zdania ~40–80 znaków. Fraza nośna zwiększa koszt słów ~3–4×, ale słowa to i tak mały ułamek wszystkich znaków (dominują zdania). Cały projekt to niskie miliony znaków → mieści się w budżecie planu Pro/Scale.
- **Skip-existing** (masz) — zostaw, jest kluczowy. Idempotentne nazwy plików (`t1-p001-001-word.mp3`) — dobrze.

### 8. Post-processing (standard dla bibliotek słów w apkach językowych)
- **Trim ciszy:** ffmpeg `silenceremove` (start i koniec) — usuwa wiodące/końcowe pauzy doklejane przez model. Uwaga na próg: plozywne spółgłoski bywają ciche na starcie — użyj marginesu ~50–100 ms, by nie ucinać nagłosu.
- **Normalizacja głośności:** ffmpeg `loudnorm` (EBU R128), **dwuprzebiegowo** (pomiar → korekta liniowa), cel np. `I=-16` LUFS, `TP=-1.5`. Ujednolica głośność między 8 głosami i tysiącami słów. Gotowe narzędzie: `ffmpeg-normalize`. (Jednoprzebiegowy `loudnorm` „pompuje" głośność — nie używaj do plików offline.)
- **Fade in/out** ~10–30 ms na krańcach — usuwa kliki/trzaski.
- **Kolejność:** wytnij po timestampach → trim resztek ciszy → normalizuj (2-pass) → fade → eksport mp3.

---

## Details

**Mechanizm modelu.** eleven_multilingual_v2 przewiduje reprezentację akustyczną z całej sekwencji tekstu. Model duration/prosody uczy się z godzin mowy, w której słowa niemal zawsze występują w kontekście zdania. Izolowane słowo to rozkład danych rzadko widziany w treningu → model „halucynuje" kontur intonacyjny i długości fonemów. Kropka pomaga (sygnał końca oznajmienia), ale nie dostarcza kontekstu rytmicznego.

**Dlaczego fraza nośna działa.** Umieszczając „dom" w „To słowo: dom." dajesz modelowi pełną, naturalną wypowiedź. Model generuje „dom" z akcentem i tempem jak w zdaniu, a timestampy pozwalają precyzyjnie wyciąć fragment. Efekt: słowo brzmi jak wypowiedziane przez człowieka, nie sztucznie wyizolowane.

**Wybór frazy nośnej.** PL: „Słowo: {word}." lub „To jest {word}." EN: „The word is {word}." lub „Say: {word}." Kluczowe: umieść {word} **na końcu** frazy + kropka → naturalna opadająca kadencja i łatwiejsze wycięcie. Testuj kilka konstrukcji — różne głosy różnie reagują.

**Timestampy — szczegół.** Odpowiedź zwraca czasy **per znak**, nie per słowo. Dla „To słowo: dom." docelowe słowo to znaki po ostatniej spacji do kropki — weź start „d" i end „m" (pomiń kropkę), dodaj margines ~30 ms.

**Speed vs post-processing.** Parametr `speed` modyfikuje samą generację modelu; przy 0.75 (blisko minimum 0.7) część głosów traci naturalność. ffmpeg `atempo=0.75` rozciąga gotowe audio bez zmiany wysokości; rubberband daje jeszcze lepszą jakość. Decyzja przez A/B test na próbce Twoich głosów.

---

## Recommendations (priorytetowo)

**ETAP 1 — Szybkie zwycięstwa (niski nakład, natychmiastowa poprawa):**
1. Osobny preset `voice_settings` dla słów: `stability` 0.5→0.6 (test do 0.7), `similarity_boost` 0.75, `style` 0, `use_speaker_boost` true. Zostaw obecne ustawienia dla zdań.
2. Post-processing ffmpeg dla każdego pliku słowa: `silenceremove` + `loudnorm` (2-pass) + fade. To samo usunie większość „ucięć" i ujednolici głośność.
3. Zweryfikuj `speed`: 0.8 natywnie vs 0.75; rozważ 0.8 + lekki `atempo`.
> **Próg decyzyjny:** jeśli po Etapie 1 słowa nadal brzmią „ucięte/robotycznie" na >20% próbki → przejdź do Etapu 2.

**ETAP 2 — Fraza nośna + wycinanie (średni nakład, największa poprawa jakości):**
4. Zmień generację słów: zamiast `word.withPeriod()` użyj frazy nośnej „Słowo: {word}." (PL) / „The word is {word}." (EN) przez endpoint `/with-timestamps`.
5. Wytnij audio samego słowa po character timestamps + ffmpeg (grupowanie znaków po spacjach, margines 30 ms, fade).
6. Zdania zostaw bez zmian.
> **Próg decyzyjny:** artefakty na krańcach → zwiększ margines i fade; problem kosztu frazy nośnej → skróć do „{word}." z lepszymi voice_settings (fallback do Etapu 1).

**ETAP 3 — Skala i niezawodność:**
7. Zwiększ plan do Pro (concurrency 10) lub Scale (15) i podnieś równoległość z 3 do wartości planu (margines ~1–2 poniżej limitu).
8. Rozróżnij 429: `too_many_concurrent_requests` → kolejka (`p-queue`); `system_busy` → exponential backoff z jitterem.
9. Zostaw skip-existing; dodaj walidację długości plików (wykryj puste/za krótkie nagrania do regeneracji).

**Tradeoffy:**
| Podejście | Nakład | Dodatkowy koszt API | Poprawa jakości |
|---|---|---|---|
| Goły word + lepsze settings + post-processing | Niski | Brak | Umiarkowana |
| Fraza nośna + timestampy + wycinanie | Średni (parsing + ffmpeg) | ~3–4× na słowo (mały % całości) | **Największa** |
| Zmiana na v3 | — | Wyższy | Ryzykowna (niestabilny) — **nie** |

Rekomendacja główna: **Etap 1 od razu; Etap 2 jeśli produkt edukacyjny wymaga najwyższej naturalności słów** (a wymaga — to serce apki do nauki wymowy).

---

## Caveats
- ElevenLabs **nie publikuje** oficjalnego tutoriala do wycinania pojedynczych słów po timestampach — opisuje endpoint jako „character-level timing for audio-text synchronization". Wzorzec carrier-phrase+trim jest dobrze udokumentowany w literaturze TTS i praktyce budowy korpusów, ale wdrożenie jest po Twojej stronie.
- **Brak wprost zacytowanego** oficjalnego zdania „timestamps kosztuje tyle samo co zwykłe TTS" — to wniosek z polityki „billed per character" (1 kredyt/znak dla multilingual_v2, ~$0.10/1000 znaków w API). Zweryfikuj na nagłówku `character-cost` w odpowiedzi.
- Wartości `voice_settings` są **zależne od konkretnego głosu** — podane zakresy to punkt startowy; wymagają A/B testu na Twoich 8 głosach (Piotr, Magdalena, Paweł, Violetta, Adam, Samantha, William, Tamsin).
- `speed` < 0.7 niedostępny; przy 0.7–0.75 jakość może spadać zależnie od głosu.
- Concurrency limity mogą się zmienić — monitoruj nagłówki API i dokumentację.
- Domyślne/generowane głosy ElevenLabs mają bazowo angielski akcent; upewnij się, że polskie głosy są trenowane na polskim (lub sklonowane z polskich próbek), by uniknąć obcego akcentu w polskich słowach. ElevenLabs zaleca: „choose a voice with an accent that matches your target language and region".
- eleven_v3 jest oznaczany jako model alpha/research preview — jego zachowanie i dostępność mogą się zmieniać; nie buduj na nim masowego, deterministycznego pipeline'u.