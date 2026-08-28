# System powtórek — dokumentacja techniczna

Autorytatywny opis procesu powtórek. **Opisuje stan wdrożony w kodzie**, nie plany.
Aktualizowany wraz ze zmianami w `src/services/{review,fsrs,reviewQueue,reviewConfig}.ts`,
`src/hooks/useReviewSet.ts`, `src/pages/ReviewPage.tsx`.

Stan: **FSRS jest aktywny** (`FSRS_ENABLED = true`, `GRADUATION_ENABLED = true` — migracje
`0006`/`0007` wdrożone na prod). Istniejące słowa migrują leniwie (seed z drabiny przy
pierwszej ocenie — §16); drabina Leitnera zostaje wyłącznie jako źródło tego seeda.
Aktywne też: dzienny budżet porcji **z realnego tempa**, checkpoint „kontynuuj", priorytet
oparty o retrievability, dziennik `reviewLedger` dla „czystej trasy".

Flagi (`src/services/reviewConfig.ts`):
`FSRS_ENABLED = true`, `SERVING_ENABLED = true`, `GRADUATION_ENABLED = true`,
`REVIEW_INTERLUDES_ENABLED = false`, `BUDGET_MODE = 'pace'`.

---

## 1. Model danych

### `WordProgress` — jeden rekord na słowo (`src/types/progress.ts`)

| Pole | Typ | Znaczenie |
|---|---|---|
| `wordId` | `string` | Klucz główny. Format `${packId}-${seq}`, np. `t1-p001-003`. |
| `packageId` | `string` | Paczka słowa. |
| `seenCount` | `number` | Ile razy słowo w ogóle ocenione (znam **i** nie znam). Rośnie zawsze. |
| `lastSeen` | `string` (ISO) | Znacznik ostatniej oceny. Pełni też rolę „ostatniej powtórki". |
| `status` | `'new' \| 'learning' \| 'known'` | `known` jest **trwałe** — słowo raz opanowane nigdy nie spada niżej. Zapominanie modelują osobne pola. |
| `reviewCount` | `number?` | Szczebel drabiny interwałów. Ile razy słowo potwierdzone poprawnie **po** pierwszym opanowaniu. |
| `lapseCount` | `number?` | Ile razy „nie znam" padło na słowie `status: known`. |
| `lastLapseAt` | `string?` (ISO) | Kiedy ostatnia wpadka na opanowanym słowie. |
| `nextReviewAt` | `string?` | Klucz dnia `YYYY-MM-DD`, od którego słowo jest „due". `undefined` = niezaplanowane (nowe / po graduacji na ścieżce legacy). Na ścieżce FSRS emerytura **nie** kasuje tej daty. |
| `retiredAt` | `string?` (ISO) | Legacy: `reviewCount` osiągnął `RETIRE_AT_REVIEW_COUNT`. FSRS: `stability >= RETIRE_STABILITY_DAYS`. Kasowane przy każdej wpadce. |
| `stability` | `number?` | FSRS: siła pamięci w dniach (patrz `src/services/fsrs.ts`). `undefined` = słowo jeszcze nie w FSRS → scheduler i priorytet spadają na drabinę / `daysLate`. |
| `difficulty` | `number?` | FSRS: wewnętrzna trudność 1..10, para ze `stability`. |

### `ReviewLedgerEntry` (`src/types/progress.ts`)
```ts
{ date: string /* YYYY-MM-DD */, cleared: boolean, clearedAt: string | null }
```
Jeden wiersz na dzień: czy dzienna porcja została domknięta. Zapisywany na żywo przez
`fetchSnapshot`, gdy `serving.remaining` spadnie do 0. Zasila `cleanDays` (§7).

### `Session` (`src/types/progress.ts`)

Sesja powtórki fiszek:
```ts
{ packageId: '__review__', date: dayKey(), startedAt: <ISO>,
  wordsCompleted: <liczba KART w porcji>, mode: 'fiszki',
  trainMode: 'review', durationSec: <zmierzony czas> }
```
Marker `'__review__'` odróżnia sesję powtórki od sesji pojedynczej paczki.
`wordsCompleted` = liczba kart przerobionych (nie trafień) — metryka nakładu.

### Klucze dnia (`src/utils/day.ts`)

- `dayKey(d = now)` → lokalny kalendarzowy `YYYY-MM-DD`, sortuje się leksykograficznie.
- `shiftDay(offset, from)` → klucz dnia oddalony o `offset` dni (kotwica w południe, odporne na DST).
- `daysBetween(a, b)` → całe dni od `a` do `b`; dodatnie gdy `b` później.

---

## 2. Przechowywanie i synchronizacja

**Źródło prawdy: IndexedDB** (`PE_DB` v6, `src/services/db.ts`).
- `wordProgress` — keyPath `wordId`, indeks `by-package`.
- `sessions` — keyPath `id` autoincrement, indeksy `by-date`, `by-package`.
- `packageProgress` — keyPath `packageId`. `dailyTime` — keyPath `date`.
- `reviewLedger` — keyPath `date` (v6; store schemaless, `stability`/`difficulty` na
  `wordProgress` dopisywane w locie).

**Mirror: Supabase.** `saveWordProgress` → `syncUpsert('word_progress', {…, retired_at,
stability, difficulty})`; `saveSession` → `syncInsert('sessions', …)`; `saveReviewLedger`
→ `syncUpsert('review_ledger', …)`. Best-effort, cichy no-op gdy wylogowany.
Migracje: `0005_review_retirement.sql` (`retired_at`), `0006_fsrs_fields.sql`
(`stability real`, `difficulty real`), `0007_review_ledger.sql` (tabela) — wszystkie nullable.

**Reconciliacja przy logowaniu** (`pullAndMergeProgress`, `src/services/progressSync.ts`):
- `betterWordProgress(a, b)` — zwycięzca = wyższy rank statusu (`new` 0 < `learning` 1 < `known` 2),
  przy remisie nowszy `lastSeen`.
- Merge: `{...winner}` + `seenCount: max`, `reviewCount: maxDefined`, `lapseCount: maxDefined`,
  `lastLapseAt: laterDefined`.
- `retiredAt` / `stability` / `difficulty` **nie mergowane** — jadą ze zwycięzcą (spójna
  para z jego ostatniej powtórki). Guard normalizujący: jeśli `stability != null` → wymuś
  spójność `retiredAt` (`>= RETIRE_STABILITY_DAYS`) i `nextReviewAt != null`.
- `reviewLedger` — merge OR: `cleared = a.cleared || b.cleared` (jeśli którekolwiek
  urządzenie domknęło dzień, dzień domknięty).

**Cache:**
- `loadProgressSnapshot(force?)` — dedup przez `DEDUPE_MS = 2000`. `invalidateProgressSnapshot()`
  czyści; `subscribeProgress(invalidateProgressSnapshot)` → każdy `emitProgress` czyści.
- `useProgressPulse` — cache `CACHE_MS = 60_000`, dodatkowo czyszczony + eager reload przy `emitProgress`.
- `saveWordProgress` → `emitProgress('word')`; `saveSession` → `emitProgress('session')`;
  zmiana celu czasowego → `emitProgress('dailyTime')`.

---

## 3. Harmonogram — maszyna stanów słowa (`src/services/review.ts`, `fsrs.ts`)

`applyKnown` / `applyUnknown` mają dwie ścieżki, wybierane flagą `FSRS_ENABLED`.

### 3a. Ścieżka legacy — drabina interwałów (NIEAKTYWNA, tylko gdy `FSRS_ENABLED = false`)
```ts
REVIEW_LADDER = [3, 8, 20, 45, 100, 240]   // dni
intervalFor(rc) = REVIEW_LADDER[min(rc, 5)]
```
`reviewCount` (rc) indeksuje drabinę. Graduacja przy `rc >= RETIRE_AT_REVIEW_COUNT (5)`
(gdy `GRADUATION_ENABLED`) — `nextReviewAt = undefined`. **Wykorzystywana już tylko jako
źródło seeda dla ścieżki FSRS** (`seedFromLadder`, niżej) — runtime jej nie używa.

### 3b. Ścieżka FSRS (`src/services/fsrs.ts`, AKTYWNA — `FSRS_ENABLED = true`)

Wariant FSRS-4.5, oceny binarne: „Nie znam" = `AGAIN` (1), „Znam" = `GOOD` (3). Stałe
(`W`, `REQUEST_RETENTION = 0.9`, `FSRS_MAX_INTERVAL = 730`, `FUZZ_FACTOR = 0.08`,
`RETIRE_STABILITY_DAYS = 365`) w `reviewConfig.ts`. „Znam wszystko" w widoku paczki seeduje
słowo od razu wyżej: `BULK_KNOWN_STABILITY = 15`, `BULK_KNOWN_DIFFICULTY = 4.5`, bez
inkrementu `reviewCount` (§ `applyKnown`, `opts.bulk`).

```
FACTOR = 19/81 ;  DECAY = -0.5
retrievability(t, S) = (1 + FACTOR * t / S) ** DECAY      // R = 0.9 gdy t = S
nextInterval(S)      = round(clamp((S/FACTOR)*(0.9**(1/DECAY) - 1), 1, 730))   // ≈ S przy RR 0.9

init (pierwsza ocena):  S0(G) = W[G-1] ;  D0(G) = clamp(W[4] - exp(W[5]*(G-1)) + 1, 1, 10)

review (słowo z FSRS-state), t = max(1, dni od lastSeen), R = retrievability(t, S):
  D' = clamp( W[7]*D0(4) + (1-W[7])*(D - W[6]*(G-3)) , 1, 10)
  sukces:  S' = S * (1 + exp(W[8])*(11-D')*S**(-W[9])*(exp(W[10]*(1-R)) - 1))
  wpadka:  S' = min( W[11]*D'**(-W[12])*((S+1)**W[13] - 1)*exp(W[14]*(1-R)) , S )
  nextReviewAt = shiftDay( applyFuzz(nextInterval(S')) )   // ± ~8%, min 1 dzień

seed z drabiny (istniejący user, brak `stability`):
  S_seed = REVIEW_LADDER[min(reviewCount, 5)] ;  D_seed = clamp(5.3 + lapseCount*0.8, 1, 10)
  → potem normalny review(...)
```

Emerytura FSRS: `applyKnown`, jeśli `stability >= RETIRE_STABILITY_DAYS` → `retiredAt`
ostemplowane, ale **`nextReviewAt` zostaje** (interwał ~rok = „głębokie utrzymanie"; raz
w roku realny test). Każda wpadka → `retiredAt = undefined`, S spada wg wzoru wpadki.
`applyUnknown` nigdy nie inkrementuje `reviewCount`.

`fsrs.ts` — czyste, przetestowane (`fsrs.test.ts`, `review.test.ts`).

### Jak słowo wchodzi do systemu
`applyKnown` / `applyUnknown` wołane z: `WordFlashPage`, `ActiveSentencePage`, `FlashcardPage`
(tryb `fiszki`), `ReviewPage` (`/powtorka`), `PackPreviewPage` („Znam wszystko" — bulk).
Sesje Trenuj filtrują `status === 'known'` — do treningu trafiają tylko `new`/`learning`.

**„Znam wszystko" (`PackPreviewPage` → `handleMarkAllKnown`)** woła `applyKnown(…, { bulk: true })`.
Słowo **bez historii** (brak `stability`, `reviewCount === 0`, nie `known`) jest wtedy
seedowane parę poziomów wyżej — zakładamy, że user faktycznie te słowa znał, skoro chciał
je szybko uzupełnić:
- FSRS: `stability = BULK_KNOWN_STABILITY (15)`, `difficulty = BULK_KNOWN_DIFFICULTY (4.5)`,
  `nextReviewAt ≈ dziś + 15` (nie +3). `reviewCount` zostaje 0 (żadnych realnych powtórek → punkty uczciwe).
- legacy: `reviewCount = BULK_KNOWN_REVIEW_COUNT (2)` → `intervalFor(2) = 20` dni.
- Słowo, które **ma** już historię → normalna ścieżka (bulk nic nie cofa).

### `applyKnown(existing, …)` — użytkownik zna *(ścieżka legacy — NIEAKTYWNA, patrz §3b dla FSRS)*
```
wasKnown    = existing?.status === 'known'
reviewCount = wasKnown ? (existing.reviewCount ?? 0) + 1 : (existing.reviewCount ?? 0)
graduating  = GRADUATION_ENABLED && wasKnown && reviewCount >= 5

seenCount   += 1
lastSeen     = now.toISOString()
status       = 'known'                     // ZAWSZE — tak słowo staje się opanowane
retiredAt    = graduating ? (existing.retiredAt ?? now.toISOString()) : existing.retiredAt
nextReviewAt = graduating ? undefined : shiftDay(intervalFor(reviewCount), dayKey(now))
```

Przebieg dla słowa uczonego od zera:

| Zdarzenie | `wasKnown` | `reviewCount` po | dni od teraz |
|---|---|---|---|
| 1. „Znam" (pierwsze opanowanie) | `false` | 0 | **3** |
| 2. „Znam" w powtórce | `true` | 1 | **8** |
| 3. „Znam" | `true` | 2 | **20** |
| 4. „Znam" | `true` | 3 | **45** |
| 5. „Znam" | `true` | 4 | **100** |
| 6. „Znam" | `true` | 5 | *graduacja* (gdy flaga on) |

Suma do graduacji ≈ 3+8+20+45+100 = **176 dni ≈ 6 miesięcy**.

**Stan obecny (`FSRS_ENABLED = true`):** powyższa tabela to ścieżka legacy — runtime jej
nie wykonuje. Faktyczne planowanie: §3b (S/D, `nextInterval`, fuzz), emerytura przy
`stability ≥ 365` z zachowaniem `nextReviewAt` (głębokie utrzymanie). `GRADUATION_ENABLED
= true`.

### `applyUnknown(existing, wordId, packageId, now)` — użytkownik nie zna

**Ścieżka FSRS (aktywna).** `review(card, AGAIN, t)` → `S' = min(Sl, S)` (wpadka nie
podnosi S), `D'` rośnie; `nextReviewAt = shiftDay(applyFuzz(nextInterval(S')))` — wzór
wpadki sam daje krótki interwał (nie sztywne „jutro"). Bookkeeping niezależny od ścieżki:
```
seenCount   += 1
lastSeen     = now.toISOString()
status       = wasKnown ? 'known' : 'learning'   // NIGDY nie degraduje opanowanego
reviewCount  = bez zmian                          // wpadka NIE inkrementuje (FSRS)
lapseCount   = wasKnown ? (existing.lapseCount ?? 0) + 1 : existing.lapseCount
lastLapseAt  = wasKnown ? now.toISOString() : existing.lastLapseAt
retiredAt    = undefined                          // KAŻDA wpadka od-emerytuje
```

Ścieżka legacy (`FSRS_ENABLED = false`, nieaktywna): `nextReviewCount` = przy
`!GRADUATION_ENABLED` `max(0, rc-1)`, inaczej stopniowane (`rc≤2 → 0`, `rc≤4 → rc-2`,
`rc≥5 → rc-1`); `nextReviewAt = jutro`.

**Konsekwencje:**
- Słowo `new`/`learning` + „nie znam" w Trenuj → `status: 'learning'`, krótki `nextReviewAt`,
  `reviewCount` nietknięty. **Wkrótce pojawi się w kolejce powtórek** — kolejka zawiera też
  świeżo pomylone słowa `learning`.
- Słowo `known` → `status` zostaje `known`, `lapseCount++`, `stability` spada, `retiredAt`
  skasowane.

### `isDue(wp, on = dayKey())`
```ts
wp.nextReviewAt != null && wp.nextReviewAt <= on
```
Porównanie stringów `YYYY-MM-DD`. Kanoniczna lista „due" to `snapshot.dueWords` (patrz §4).

---

## 4. Snapshot — agregacja (`src/hooks/useProgressData.ts`, `fetchSnapshot`)

Moduł buduje raz `PACK_LEVEL: Map<packageId, level>` z `packages-index.json`;
`packLevelOf(id) = PACK_LEVEL.get(id) ?? 1`.

`fetchSnapshot` czyta równolegle `getAllPackageProgress`, `getAllWordProgress`,
`getAllSessions`, `getStreak(frozenDays)`. Pętla po `wordProgress`:
```
if wp.status === 'known':  knownMap[wp.packageId]++ ;  knownTotal++
if wp.retiredAt != null:   retiredCount++
else if wp.nextReviewAt != null && wp.nextReviewAt <= today:  dueWords.push(wp)
reviewTotal += wp.reviewCount ?? 0
```
Retired wykluczone z `dueWords`. Wszystko inne z przeszłą/dzisiejszą datą wchodzi
**niezależnie od statusu** (`learning` też).

Czyta też `getAllReviewLedger()`. Potem:
```
serving = computeServingState({ due: dueWords, wordProgress, goalSec: dailyGoalSec,
                                recentPace: sevenDayPace(sessions, today), knownTotal, today })
priorityCtx = { today, todayLevel, packLevelOf }

// Zapis dziennika na żywo: jeśli serving.done i brak wiersza cleared dla dziś →
// saveReviewLedger({ date: today, cleared: true, clearedAt: now })  (raz dziennie)

ProgressSnapshot += {
  dueCount:      serving.backlog,        // = dueWords.length
  dueWords, servingLeft: serving.remaining, reviewBudget: serving.budget, served: serving.served,
  retiredCount, staleCount: staleWordCount(dueWords, priorityCtx),
  reviewUrgency: reviewUrgency({ state: serving, due: dueWords, today }),
  reviewTotal, reviewLedger,
}
```

`useProgressPulse` przenosi z snapshotu: `dueCount`, `servingLeft`, `reviewBudget`, `reviewUrgency`.

---

## 5. Dzienny budżet porcji (`src/services/reviewQueue.ts`)

### `computeReviewBudget({ goalSec, recentPace, knownTotal })` — `BUDGET_MODE = 'pace'`
```
goalDerived = round(goalSec / 60 * REVIEWS_PER_MINUTE)      // REVIEWS_PER_MINUTE = 1.2 — SUFIT
paceDerived = round(recentPace * PACE_HEADROOM)             // PACE_HEADROOM = 1.5 — REALNE TEMPO
budget      = clamp(min(goalDerived, max(paceDerived, PACE_FLOOR)), SERVING_MIN, SERVING_MAX)
              // PACE_FLOOR = 6, clamp(_, 8, 40)
```
`recentPace` = `sevenDayPace(sessions, today)` = suma `wordsCompleted` z ostatnich 7 dni / 7.
`BUDGET_MODE = 'flex'` (legacy, do rollbacku): `goalDerived + min(12, floor(knownTotal/500))`.

| Cel | Tempo 7 dni | budżet |
|---|---|---|
| 15 min | 40/dzień | 18 (sufit z celu) |
| 60 min | 4/dzień | 8 (tempo × 1.5 = 6 → clamp do MIN) |
| 15 min | 0 (nowy user) | 8 |
| 30 min | 30/dzień | 36 |

### `reviewsDoneToday(wordProgress, today)`
```
#{ w : dayKey(w.lastSeen) === today
     && (w.reviewCount ?? 0) + (w.lapseCount ?? 0) >= 1     // przeszło ≥1 cykl (nie pierwsze uczenie)
     && w.nextReviewAt != null && w.nextReviewAt > today }  // przełożone w przód
```
Liczone z `wordProgress`, nie z sesji — łapie też powtórki „przy okazji" w Trenuj i nie
zależy od momentu zapisu sesji.

### `computeServingState({ due, wordProgress, goalSec, recentPace, knownTotal, today? }) → ServingState`
```
backlog = due.length
if (!SERVING_ENABLED):  return { backlog, budget: backlog, served: 0, remaining: backlog, done: backlog === 0 }
budget    = computeReviewBudget({ goalSec, recentPace, knownTotal })
served    = reviewsDoneToday(wordProgress, today)
remaining = min(backlog, max(0, budget - served))
done      = backlog === 0 || remaining === 0
```
- `remaining` (= `servingLeft`) = porcja na dziś. `backlog` (= `dueCount`) = wszystkie zaległe.
- „w kolejce" na UI = `backlog − servingLeft`.

---

## 6. Priorytet — która karta pierwsza (`src/services/reviewQueue.ts`)

### `scoreDueWord(wp, ctx) → number`
```
late = daysLate(wp, today)
R    = retrievabilityOf(wp, today)      // null gdy brak `stability`

// człon rdzeniowy: rozpad pamięci
decay = R != null ? (1 - R) : clamp(late / 20, 0, 1)
score = decay * W_DECAY                 // W_DECAY = 40

// anty-głodzenie — oba biją belowLevel / nearGraduation
if R != null && R < R_CRITICAL:  score += W_CRITICAL   // R_CRITICAL = 0.65, W_CRITICAL = 50
if late > STALE_GRACE_DAYS:       score += W_NEGLECT    // +25

S = wp.stability ?? 0 ;  rc = wp.reviewCount ?? 0
if S > 0 ? S < 7 : rc <= 1:       score += PRIORITY.fragileYoung   // +6
elif S === 0 && rc === 2:         score += PRIORITY.fragileMid     // +3
if S === 0 && rc >= 4:            score += PRIORITY.nearGraduation // -4

if (wp.lapseCount ?? 0) >= STRUGGLE_LAPSES || (wp.difficulty ?? 0) >= 8:  score += PRIORITY.struggle  // +5
if wp.retiredAt != null:          score += W_DEEP_MAINT            // -6  (deep-maint może poczekać)

stillSafe = R != null ? R > 0.75 : late <= BELOW_LEVEL_GRACE_DAYS
if isBelowLevel(wp, ctx) && stillSafe:  score += PRIORITY.belowLevel   // -8, tylko gdy bezpiecznie
```
`retrievabilityOf(wp, today)` = `retrievability(daysBetween(dayKey(wp.lastSeen), today),
wp.stability)` albo `null`. `W_CRITICAL 50` + `W_NEGLECT 25` gwarantują, że słowo realnie
uciekające zawsze wypływa — niezależnie od poziomu.

### `orderDueWords(due, ctx) → WordProgress[]`
Sort malejąco po `score`; remis → `nextReviewAt` rosnąco; remis → **hash FNV-1a `wordId`**
(nie `localeCompare` — nie faworyzuje wczesnych paczek).

---

## 7. Wskaźnik pilności i świeżość (`src/services/reviewQueue.ts`)

### `reviewUrgency({ state, due, today? }) → 'calm' | 'building' | 'urgent'`
```
maxDaysLate = max(daysLate(wp, today)  dla wp in due)
leeches     = #{ due : (lapseCount ?? 0) >= LEECH_LAPSES }   // LEECH_LAPSES = 3
critical    = #{ due : R < R_CRITICAL }     // zaraz zapomni (0.65)
weak        = #{ due : R < 0.8 }            // zauważalnie osłabione

if critical > 0 || backlog > 3*budget || maxDaysLate > STALE_GRACE_DAYS || leeches > 0:  'urgent'
if weak === 0 && backlog <= budget && maxDaysLate <= 3 && leeches === 0:                 'calm'
else                                                                                     'building'
```

| Tier | Kropka | Eyebrow na „Dzisiaj" |
|---|---|---|
| `calm` | zielony `--success` | „Zanim zaczniesz coś nowego" |
| `building` | bursztyn `--warning` | „Powtórki się zbierają" |
| `urgent` | czerwony `--danger` | „Sporo zaległych powtórek" |

### `staleWordCount(due, ctx) → number`
```
#{ due : daysLate > STALE_GRACE_DAYS
       && !(R != null && R >= 0.8)                              // zaplanowane długo, jeszcze nie osłabione
       && !(isBelowLevel && R == null && daysLate <= STALE_GRACE_DAYS*2) }
```
`STALE_GRACE_DAYS = 14`. Słowo poniżej poziomu jest wybaczane tylko póki bezpieczne
(R > 0.8, albo do 28 dni po terminie bez FSRS) — inaczej czarna dziura `todayLevel` byłaby
niewidoczna w metryce.

- `useStats.freshnessPct = knownWords > 0 ? round((knownWords − min(staleCount, knownWords)) / knownWords * 100) : 100`.
  Etykieta na `/postęp`: „Świeżość trasy".

### `reviewLedger` + `cleanDays`
- **Zapis:** w `fetchSnapshot`, gdy `serving.done` (backlog 0 albo budżet wydany) i brak
  wiersza `cleared:true` dla dziś → `saveReviewLedger({ date: today, cleared: true, clearedAt })`.
  Raz dziennie (`emitProgress('reviewLedger')` → re-fetch widzi wiersz i pomija).
- **`achievements.cleanDays(snapshot)`:** brak zaplanowanych słów → 0. Inaczej: seria
  kolejnych dni `cleared === true` wstecz od dziś (albo od wczoraj, jeśli dziś jeszcze bez
  wiersza — „w toku"). Brakujący dzień = przerwa. **Monotoniczne, bez skoków.** Odznaki
  „Czysty tydzień/miesiąc/kwartał" (progi 7/30/90).
- **Sync:** merge OR `cleared` (§2).

### 7a. Rozkład siły pamięci (`retentionBreakdown`, `reviewQueue.ts`)

Zasila sekcję „Poziom zapamiętania" na `/postęp` (§11). Wyłącznie prezentacja — nie wpływa
na harmonogram ani priorytet.

```
effectiveStability(wp) = wp.stability ?? REVIEW_LADDER[min(wp.reviewCount ?? 0, len-1)]
                                        // słowo sprzed FSRS: szczebel drabiny ≈ interwał ≈ S

retentionTierOf(wp):
  wp.retiredAt != null                 → 'locked'          // głębokie utrzymanie liczy się jako „na stałe"
  s = effectiveStability(wp)
  s >= 365 → 'locked'   s >= 60 → 'strong'   s >= 21 → 'solid'   s >= 7 → 'setting'   else 'fresh'

retentionBreakdown(wordProgress):
  liczy tylko status === 'known'
  → { buckets: [{tier, count} × 5 w kolejności RETENTION_TIERS], total, durablePct }
  durablePct = round((strong + locked) / total * 100)   // 0 gdy total === 0
```

Progi w `RETENTION_TIER_MIN` (dni): `fresh 0 / setting 7 / solid 21 / strong 60 / locked 365`.

---

## 8. Złożenie sesji powtórki (`src/hooks/useReviewSet.ts`)

```
REVIEW_MAX_WORDS = 20      // twardy sufit sesji
REVIEW_MAX_PACKS = 8
```
`useReviewSet(enabled = true, { overBudget?, nonce? })`. Efekt przebudowuje się na
`[enabled, overBudget, nonce]`.

Przebieg `build()`:
1. `snap = await loadProgressSnapshot()` → `due = snap.dueWords`.
2. `cap = overBudget ? min(20, due.length) : min(20, max(0, snap.servingLeft))`.
3. Pusto? `due.length === 0 || cap === 0` → `{ steps: [], cardCount: 0, dueTotal, servingLeft,
   exhausted: (cap === 0 && due.length > 0), … }`.
4. `ctx = { today, todayLevel, packLevelOf }`; `ordered = orderDueWords(due, ctx)`.
5. Greedy: dokładaj do `chosen` aż `chosen.length >= cap`; pomiń słowo, jeśli byłoby 9-tą paczką.
6. `plan = REVIEW_INTERLUDES_ENABLED ? planInterludes({...}) : { count: 0 }`.
7. `fetchPack(id, signal).catch(() => null)` dla wszystkich paczek (kart + przerywników).
8. `cards: ReviewCardStep[]` z `chosen` gdzie słowo się wczytało.
9. `steps = spliceInterludes(cards, plan, …)` — przy `plan.count === 0` zwraca `cards`.
10. `{ steps, cardCount, dueTotal, servingLeft, exhausted: false, packCount, error }`.

`ReviewStep` = `{ kind: 'card', word, packageId, progress }` | `{ kind: 'interlude', words: {word, packageId}[] }`.

### Przerywniki (gdy `REVIEW_INTERLUDES_ENABLED` — obecnie OFF)
- `planInterludes`: `count = floor(cardCount / REVIEW_INTERLUDE_EVERY)` (=6). `perInterlude =
  REVIEW_INTERLUDE_SIZE` (=4), z tego `INTERLUDE_KNOWN_SLOTS` (=1) = słowa `retiredAt != null ||
  status === 'known'`, reszta z `packsBelowKnownRatio(…, 0.5)` (≤ `LISTEN_MAX_PACKS` = 4).
  Brak paczek <50% i brak znanych → `count: 0`.
- `spliceInterludes`: wplata przerywnik po każdej 6-tej karcie, nigdy pierwszy/ostatni krok.

---

## 9. Runtime `/powtorka` (`src/pages/ReviewPage.tsx`)

### Stan
`overBudget`, `round` (nonce), `stepIndex`, `kept`, `batchDone`, `noAudio`,
`sessionSeen` / `sessionKept` (kumulacja przez wizytę).

`useReviewSet(true, { overBudget, nonce: round })`. Pochodne: `current = steps[stepIndex]`,
`isLastStep`, `cardsBefore` (liczba kroków `card` przed `stepIndex`), `card = current?.kind === 'card' ? current : null`.
Audio: `useAudio(card?.packageId ?? null)` — re-kluczowane per bieżąca karta.

### Przepływ
- **`flipCard()`** — jeśli karta: `flip()`; przy odsłanianiu gra EN; przy chowaniu `stop()`.
- **`answer(recalled)`** — guard `card && !isAdvancing`; `stop()`;
  `updated = recalled ? applyKnown(…) : applyUnknown(…)`; `await saveWordProgress(updated)`;
  `if recalled: kept++`; `animateOut(() => goNext())`.
- **`goNext()`** — `isLastStep` → `finishBatch()`; inaczej `stepIndex++`, `resetToFront()`.
- **`finishBatch()`** — `saveSession({ packageId: '__review__', …, wordsCompleted: cardCount,
  trainMode: 'review', durationSec: elapsedSec() })`; `sessionSeen += cardCount`;
  `sessionKept += kept`; `batchDone = true`.
- **`continueBatch()`** — `stepIndex = 0`, `kept = 0`, `batchDone = false`, `overBudget = true`,
  `round++`. Efekt re-startuje: świeży `loadProgressSnapshot()` → `due` mniejsze → `cap = min(20, due.length)`.
- Przerywnik + `noAudio` → efekt `goNext()` (pomija).

### Ekrany (kolejność)
1. `loading` → skeleton „Zbieram słowa do powtórki…".
2. `error || cardCount === 0` → ekran stanu:
   - `error` → „Nie udało się wczytać powtórki".
   - `exhausted` → „Dzisiejsza porcja zrobiona" / „Na dziś tyle. W kolejce jeszcze {dueTotal}"
     + jeśli `dueTotal > 0` **„Kontynuuj mimo to"** (`continueBatch`) + „Wróć do Dzisiaj".
   - inaczej → „Nic nie czeka na powtórkę".
3. **`batchDone` → checkpoint** (pętla):
   `queueLeft = max(0, dueTotal − cardCount)`; `portionDone = reviewBudget > 0 && sessionSeen >= reviewBudget`
   - ikona `queueLeft > 0 ? 💪 : 🎉`, „Świetnie!" / „Wszystko zrobione!".
   - „Utrzymane {kept} z {cardCount} w tej porcji" (+ „· dziś łącznie {sessionSeen}") +
     „W kolejce jeszcze {queueLeft}." / „Kolejka pusta." (+ gdy `portionDone`: „Zrobiłeś dziś
     {sessionSeen} — reszta spokojnie może poczekać.").
   - `queueLeft > 0`: przyciski **„Kontynuuj powtórkę"** i **„Na dziś wystarczy"** — primary
     jest „Kontynuuj", **chyba że `portionDone`** (dzienna porcja zrobiona) → primary staje
     się „Na dziś wystarczy", „Kontynuuj" schodzi na secondary.
   - `queueLeft === 0`: „Wróć do Dzisiaj".
4. `current.kind === 'interlude'` → `<ReviewInterlude>` (gra PL→EN per słowo z **minimalnym
   dwellem 1,6 s / 0,6 s** — tekst stoi tyle nawet bez audio / przy braku klipu; „Pomiń" /
   „Bez słuchania"; **nie** dotyka `WordProgress`, nie liczy się do `wordsCompleted`).
5. domyślnie — fiszka: header (pasek `cardsBefore / cardCount`, licznik `{cardsBefore + 1} / {cardCount}`,
   przerywniki poza licznikiem), badge „🔁 Powtórka · {packCount} paczek · {dueTotal − cardCount} w kolejce",
   karta PL/EN, akcje „Nie pamiętam" / „Pamiętam".

---

## 10. Zapis zwrotny i unieważnianie cache

| Zapis | Event | Skutek |
|---|---|---|
| `saveWordProgress` (z `answer`) | `emitProgress('word')` | `loadProgressSnapshot` cache invalid; `useProgressPulse` eager reload |
| `saveSession` (z `finishBatch`) | `emitProgress('session')` | jw. — `served` / `servingLeft` przeliczone przy następnym snapshotcie |
| `setDailyGoalSec` | `emitProgress('dailyTime')` | budżet przeliczony |

`continueBatch` liczy na to, że po `saveSession` cache jest nieważny — świeży
`loadProgressSnapshot()` widzi zmniejszony `dueWords`.

---

## 11. Powierzchnie UI

### „Dzisiaj" (`src/pages/TodayPage.tsx`)
```
backlog     = pulse?.dueCount ?? 0
serving     = pulse?.servingLeft ?? 0
urgency     = pulse?.reviewUrgency ?? 'calm'
reviewDone  = backlog > 0 && serving === 0
nothingLeft = listen == null && train == null && serving === 0
```
- **`serving > 0`** → hero „Powtórka": eyebrow zależny od `urgency` + kolorowa kropka +
  tint ramki; licznik `{serving} słów`; detal `backlog > serving ? "{serving} na dziś ·
  jeszcze {backlog − serving} w kolejce" : "Słowa, które zaczynają uciekać"` + „· ~{estimateMinutes(serving)} min";
  mikrotekst „Na dziś tylko najpilniejsze słowa, dobrane pod Twój cel — reszta poczeka." + ⓘ;
  CTA „Powtórz" → `unlockAudioGlobally()` (w geście tapnięcia, dla iOS) → `navigate('/powtorka')`.
- **`reviewDone`** → wąski pasek „✓ Powtórki na dziś zrobione · jeszcze {backlog} w kolejce, wrócą jutro".
- **`backlog === 0`** → brak elementu.

### `<ReviewPriorityInfoSheet>` (`src/components/today/ReviewPriorityInfoSheet.tsx`)
Natywny `<dialog>`, styl `NextStepInfoSheet.css`. Tytuł „Twoja powtórka myśli za Ciebie",
7 punktów (porcja skrojona / powtórka ma koniec / widzisz jak stoisz / najpierw najważniejsze /
emerytura słowa / pomyłka nie cofa na start / chwila słuchania) + stopka.

### Sidebar (`src/components/layout/SidebarPulse.tsx`)
`if pulse.servingLeft > 0`: „🔁 {servingLeft} na dziś" + (`dueCount > servingLeft` ? „·
{dueCount − servingLeft} w kolejce" : "").

### `/postęp` (`src/pages/StatsPage.tsx`)
`buildGuidance(…, servingLeft)`: `servingLeft > 0` → „{n} słów w dzisiejszej porcji
powtórek — najszybszy sposób, żeby nic nie uciekło."; inaczej porady o poziomie.
Fakt „Świeżość trasy" = `freshnessPct%`.

### `<RetentionBars>` — sekcja „Poziom zapamiętania" (`src/components/progress/RetentionBars.tsx`)
Rozkład **opanowanego** słownictwa (`status === 'known'`) po sile pamięci. Sekcja
`statspage__section` z `<h2>Poziom zapamiętania</h2>`, pod „W liczbach", nad „Terytoria —
poziomy". Dane liczy `retentionBreakdown(wordProgress)` z `reviewQueue.ts` (patrz §7a).

- **Nagłówek karty**: `{total} opanowanych słów` + przycisk ⓘ.
- **Pasek segmentowy**: jeden `<span>` na niepusty próg, `width = count/total`, kolor progu.
- **Legenda** (`<dl>`): kropka + nazwa + `count` + `%` + kadencja. Puste progi wyszarzone
  (`--empty`, `opacity .4`) — pokazują, dokąd słowa zmierzają.
- **Podsumowanie** (adaptacyjne, wg `durablePct` = udział `strong` + `locked`):
  `≥ 50` → „{durablePct}% … utrzymuje się przez miesiące lub dłużej — to efekt powtórek
  w coraz większych odstępach."; `> 0` → „{durablePct}% … mocno utrwalone. Reszta wciąż
  się utrwala — im częściej ją poprawnie powtarzasz, tym rzadziej wraca."; `0` →
  „Większość Twoich słów jest na etapie „{najliczniejszy próg}". …".
- **Pusto** (`total === 0`): zachęta zamiast paska.

Progi (`TIER_META`): `fresh` „Świeże" #F59E0B / `setting` „Krzepnące" #84CC16 /
`solid` „Utrwalone" #22C55E / `strong` „Mocne" #14B8A6 / `locked` „Na stałe" #8B5CF6.
Ramp ciepły→zimny = pamięć się układa; `locked` w kolorze marki, bo to inny stan (poza
rotacją, nie „mocniejsze").

### `<RetentionInfoSheet>` (`src/components/progress/RetentionInfoSheet.tsx`)
Natywny `<dialog>`, współdzieli `today/NextStepInfoSheet.css`. Tytuł „Jak czytać poziom
zapamiętania", 5 punktów (co znaczy poziom / jak słowo awansuje / progi / „Na stałe" / co
z tym zrobić).

---

## 12. Punkty i osiągnięcia

### `src/services/points.ts` — `RULES_VERSION = 3`
```
POINTS.perReview      = 3      // × reviewTotal (Σ reviewCount)
POINTS.perRetiredWord = 30     // × retiredCount
SESSION_WEIGHTS['fiszki:review'] = 2.5    // waga wordsCompleted sesji __review__ w składniku „sessions"
```
`computePoints`: `reviews = reviewTotal * 3`; `retired = retiredCount * 30`;
`breakdown = { sessions, known, reviews, retired, packs, streak, goals }`.

`GRADUATION_ENABLED = true` → `retiredCount` > 0, gdy słowa osiągną `stability ≥ 365`.

### `src/services/achievements.ts` / `src/data/achievements.ts`
`cleanDays` — patrz §7. Ladder `clean` (progi 7/30/90), opis „…dni z porcją powtórek na czas".

---

## 13. Flagi funkcji (`src/services/reviewConfig.ts`)

| Flaga | Wartość | Co gejtuje | Efekt włączenia |
|---|---|---|---|
| `FSRS_ENABLED` | **`true`** | scheduler w `review.ts` | On (stan obecny): FSRS (`fsrs.ts`), leniwy seed `stability`/`difficulty` przy pierwszej ocenie słowa. Off: drabina Leitnera. `reviewQueue` i tak używa retrievability, gdy słowo ma `stability`. Flip nastąpił po wdrożeniu `0006` na prod. |
| `BUDGET_MODE` | `'pace'` | `computeReviewBudget` | `'pace'`: `min(z-celu, tempo7dni × 1.5)`. `'flex'` (legacy rollback): `z-celu + min(12, floor(known/500))`. |
| `SERVING_ENABLED` | **`true`** | `computeServingState` | On: `remaining = min(backlog, budget − served)`. Off: `remaining = backlog`. |
| `GRADUATION_ENABLED` | **`true`** | zapis `retiredAt` (FSRS `stability ≥ 365` — głębokie utrzymanie; legacy `rc ≥ 5`) + step-back w legacy `applyUnknown` | Wymaga `0005`/`0006` na prod (wdrożone). |
| `REVIEW_INTERLUDES_ENABLED` | `false` | `useReviewSet` (przerywniki) | On: co 6 kart krótki przerywnik słuchania. Off: `/powtorka` = czyste fiszki. |

---

## 14. Stałe (`src/services/reviewConfig.ts`)

| Stała | Wartość | Rola |
|---|---|---|
| `REVIEW_LADDER` | `[3, 8, 20, 45, 100, 240]` | legacy: dni wg `reviewCount`; FSRS: seed `stability` |
| `RETIRE_AT_REVIEW_COUNT` | `5` | legacy `reviewCount` graduacji |
| **FSRS** `REQUEST_RETENTION` | `0.9` | cel retencji |
| `W` | FSRS-4.5 (19) | wagi modelu |
| `FSRS_MAX_INTERVAL` | `730` | sufit interwału (deep-maint) |
| `FUZZ_FACTOR` | `0.08` | rozrzut `nextReviewAt` |
| `RETIRE_STABILITY_DAYS` | `365` | `stability` emerytury (FSRS) |
| `BULK_KNOWN_STABILITY` / `_DIFFICULTY` / `_REVIEW_COUNT` | `15` / `4.5` / `2` | seed dla „Znam wszystko" |
| `REVIEWS_PER_MINUTE` | `1.2` | sufit budżetu z celu |
| `PACE_HEADROOM` / `PACE_FLOOR` | `1.5` / `6` | budżet z tempa |
| `SERVING_MIN` / `SERVING_MAX` | `8` / `40` | klamry budżetu |
| `SERVING_FLEX_DIVISOR` / `SERVING_FLEX_CAP` | `500` / `12` | @deprecated (tryb `flex`) |
| `W_DECAY` / `W_CRITICAL` / `R_CRITICAL` / `W_DEEP_MAINT` | `40` / `50` / `0.65` / `−6` | priorytet FSRS |
| `PRIORITY.overduePerDay` / `overdueCap` | `1.0` / `30` | człon spóźnienia (fallback) |
| `PRIORITY.fragileYoung` / `fragileMid` | `+6` / `+3` | `rc ≤ 1` / `rc === 2` |
| `PRIORITY.struggle` | `+5` | `lapseCount ≥ STRUGGLE_LAPSES` |
| `PRIORITY.nearGraduation` | `−4` | `rc ≥ 4` |
| `PRIORITY.belowLevel` | `−8` | `pack.level < todayLevel` |
| `STRUGGLE_LAPSES` / `LEECH_LAPSES` | `2` / `3` | próg „bump w kolejce" / „czerwony wskaźnik" |
| `W_NEGLECT` | `25` | bonus priorytetu dla `daysLate > STALE_GRACE_DAYS` (anty-głodzenie) |
| `BELOW_LEVEL_GRACE_DAYS` | `7` | po tylu dniach kara `belowLevel` znika |
| `STALE_GRACE_DAYS` | `14` | > tylu dni po terminie = zaniedbanie |
| `REVIEW_INTERLUDE_EVERY` / `_SIZE` | `6` / `4` | 1 przerywnik na 6 kart, 4 słowa |
| `INTERLUDE_KNOWN_SLOTS` | `1` | z tego tyle = znane/retired |
| `LISTEN_BELOW_RATIO` / `LISTEN_MAX_PACKS` | `0.5` / `4` | pula przerywników |
| `REVIEW_MAX_WORDS` / `REVIEW_MAX_PACKS` (`useReviewSet.ts`) | `20` / `8` | sufit sesji |
| `RETENTION_TIER_MIN` (`reviewQueue.ts`) | `fresh 0 / setting 7 / solid 21 / strong 60 / locked 365` | progi (dni `stability`) sekcji „Poziom zapamiętania" (§7a, §11) |

---

## 15. Przykłady

> Dwa pierwsze przykłady ilustrują **ścieżkę legacy** (drabina) — zachowane jako punkt
> odniesienia. Runtime (`FSRS_ENABLED = true`) planuje wg §3b: interwał ≈ `stability`,
> rosnący z każdą trafną powtórką, z rozrzutem ±8%.

### Nowe słowo, ścieżka do „szczebla 5" (legacy)
Dzień 0 „Znam" → due dzień 3. Dzień 3 „Znam" → due dzień 11. Dzień 11 „Znam" → due dzień 31.
… szczebel 5 po ~176 dniach. Przy `GRADUATION_ENABLED = false` zostaje na 240-dniowym
interwale w kółko.

### Wpadka na opanowanym słowie (legacy, `GRADUATION_ENABLED = false`)
`rc = 4`, „Nie znam" → `rc → 3`, `lapseCount++`, `nextReviewAt = jutro`. Następne „Znam" →
`rc → 4`, due za 100 dni. (FSRS: „Nie znam" → `S' = min(Sl, S)`, `reviewCount` bez zmian,
`retiredAt` skasowane.)

### Heavy-user, backlog 150, cel 15 min, 1200 znanych
Budżet 21. `/powtorka` → `cap = min(20, 21) = 20`. Sesja 20 kart, badge „130 w kolejce".
Checkpoint: „💪 Świetnie! Utrzymane X z 20. W kolejce jeszcze 130." + „Kontynuuj powtórkę" /
„Na dziś wystarczy". „Kontynuuj" → `overBudget = true` → świeży snapshot (due ≈ 130) →
kolejna porcja 20. Pętla aż kolejka pusta albo „Na dziś wystarczy".
Po „Na dziś wystarczy": `served = 20`, następnego dnia `served` zerowane.

### Dzień „na bieżąco"
6 słów due, budżet 18 → `servingLeft = min(6, 18) = 6`. Hero „6 słów · Słowa, które
zaczynają uciekać". Urgency `calm`. Po zrobieniu 6 → hero znika (`backlog === 0`).

---

## 16. Migracja istniejących użytkowników

- **Drabina → FSRS jest leniwe.** Przy `FSRS_ENABLED = true` `review.ts` seeduje
  `stability`/`difficulty` z `seedFromLadder(reviewCount, lapseCount)` przy **pierwszej**
  ocenie słowa bez `stability`. Istniejące `nextReviewAt` nietknięte do tego momentu.
  Zero masowego przeliczenia. Opcjonalny `window.__migrateFsrs()` (dev/ops, porcjami)
  wypełnia seedy od razu.
- Nowa drabina `[3, 8, 20, 45, 100, 240]` (ze `[3, 7, 21, 60, 180]`) działa bezwarunkowo
  na ścieżce legacy, też dopiero przy następnej ocenie.
- `GRADUATION_ENABLED = true` → `retiredAt` zapisywane, gdy `stability ≥ 365` (z zachowaniem
  `nextReviewAt` — głębokie utrzymanie).
- Supabase `0005`/`0006`/`0007`: kolumny nullable / nowa tabela → starsze klienty działają dalej.
- `RULES_VERSION 2 → 3`: punkty (derived) przeliczane wszystkim, bez migracji.

---

## 17. Znane ograniczenia

1. **Wagi FSRS są populacyjne**, nie per-user — optymalizacja wymaga logu powtórek +
   optimizera (osobny projekt). `review_log` nie jest zbierany.
2. **Leniwa migracja FSRS** → tygodnie mieszanego stanu (część słów z `stability`, część
   bez); `scoreDueWord`/pilność mają fallback `daysLate`, ale doświadczenie niespójne aż
   słowa się zmigrują. Mitygacja: `__migrateFsrs()`.
3. **`reviewsDoneToday` — heurystyka** (`reps+lapses ≥ 1 && przełożone w przód`) może źle
   sklasyfikować wielokrotną powtórkę tego samego dnia. Niski wpływ.
4. **Ledger cross-device:** dzień domknięty na telefonie, appka nieotwarta na desktopie →
   desktop wpisuje `cleared:false`, sync OR-uje przy następnym pull. Okno rozbieżności `cleanDays`.
5. **Latencja „na dziś zrobione"** przy porzuceniu sesji przed `finishBatch` — sesja nie
   zapisana, ale `reviewsDoneToday` liczy z `wordProgress`, więc odpowiedziane karty i tak
   się liczą (mniejszy problem niż przed Fazą 3).
6. **Brak undo** na omyłkowe „Pamiętam/Nie pamiętam".
