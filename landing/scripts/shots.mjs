/**
 * Generates the product screenshots the landing page shows.
 *
 * The landing shipped with no images at all, so nothing on it ever showed the
 * app. These are real captures of the real app, seeded with a real-looking
 * learner so the screens aren't empty — an empty-state screenshot sells nothing.
 *
 *   1. Start the app:   npm run dev            (repo root, port 5174)
 *   2. Run this:        node scripts/shots.mjs (from landing/)
 *
 * Output lands in landing/public/shots/ as <name>.webp (1x) and <name>@2x.webp,
 * which is exactly what <DeviceFrame name="..."> expects.
 *
 * When the app's design changes, re-run this. Never retouch the output.
 */
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'shots')
const TMP = join(HERE, '..', '.shots-tmp')
const APP = process.env.APP_URL ?? 'http://localhost:5174'
const PACKS_INDEX = join(HERE, '..', '..', 'public', 'data', 'packages-index.json')

/* ── The persona ────────────────────────────────────────────────────────────
 * 1 221 known words — the same number the "Wreszcie widzisz swój Progress"
 * section counts up to, so the copy and the screenshot agree.
 *
 * The pack states are chosen to show the whole memory model on one screen,
 * because that model IS the product:
 *   sealed  — stability past RETIRE_STABILITY_DAYS (365) + retiredAt set
 *   held    — conquered, high stability, seen recently
 *   fading  — conquered but decayed: R < FADING_RETRIEVABILITY (0.7)
 *   active  — the frontier pack, partially known
 *   ahead   — untouched
 * Thresholds come from src/services/reviewConfig.ts + src/utils/packMemory.ts.
 * ------------------------------------------------------------------------- */
const TARGET_KNOWN = 1221
const SEALED_UNTIL = 40 // packs 1..40

/**
 * Only the last few conquered packs are allowed to fade, and only mildly.
 *
 * A first pass faded 24 packs at retrievability ≈ 0.6, six weeks overdue. Every
 * one of those trips `critical` (R < R_CRITICAL 0.65) and `maxDaysLate >
 * STALE_GRACE_DAYS`, so Dzisiaj rendered its red "SPORO ZALEGŁYCH · jeszcze 256
 * w kolejce" rail — a debt notice on the hero screenshot, and one that
 * contradicted the 35-day streak sitting right above it. Someone who has
 * studied every day for a month does not have 256 words rotting in the queue.
 *
 * So: three packs, tuned to sit in the narrow band that is genuinely fading
 * (R < FADING_RETRIEVABILITY 0.7, so the route still shows the teal "wraca do
 * Ciebie" state that is half the point of the memory model) but not critical
 * (R > 0.65) and not neglected (days late well under the grace window).
 * R = (1 + (19/81)·t/S)^-0.5 → t=42 days at S=8 gives R ≈ 0.67.
 */
const FADING_FROM_END = 3
const FADING_LAST_SEEN_DAYS = 42
const FADING_STABILITY = 8
const FADING_DAYS_LATE = 6

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString()

/**
 * LOCAL calendar day key, matching src/utils/day.ts. Using toISOString() here
 * (a UTC day) silently shifts every key by one whenever the machine is ahead of
 * UTC — which put "today" in the future and left the daily-goal ring reading 0.
 */
const dayKeyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayKey = (daysAhead) => dayKeyOf(new Date(Date.now() + daysAhead * 864e5))

async function buildSeed() {
  const packs = JSON.parse(await readFile(PACKS_INDEX, 'utf8'))

  const wordProgress = []
  const packageProgress = []
  let known = 0
  let frontier = null

  // How many packs fit entirely inside the target, worked out up front so the
  // loop below knows which ones are the *last* few (the only ones allowed to
  // fade) without having to look ahead.
  let fullPackCount = 0
  {
    let sum = 0
    for (const pack of packs) {
      const n = pack.wordCount ?? 10
      if (sum + n > TARGET_KNOWN) break
      sum += n
      fullPackCount++
    }
  }

  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i]
    const n = pack.wordCount ?? 10
    const ordinal = i + 1

    if (known + n <= TARGET_KNOWN) {
      // A fully conquered pack.
      const sealed = ordinal <= SEALED_UNTIL
      const fading = !sealed && ordinal > fullPackCount - FADING_FROM_END
      for (let w = 0; w < n; w++) {
        wordProgress.push({
          wordId: `${pack.id}-w${w + 1}`,
          packageId: pack.id,
          seenCount: 6 + (w % 4),
          lastSeen: sealed
            ? iso(120 + (w % 30))
            : fading
              ? iso(FADING_LAST_SEEN_DAYS)
              : iso(3 + (w % 9)),
          status: 'known',
          reviewCount: sealed ? 7 : fading ? 3 : 4,
          stability: sealed ? 420 + (w % 40) : fading ? FADING_STABILITY : 90 + (w % 30),
          difficulty: 4.6 + ((w % 5) * 0.3),
          nextReviewAt: sealed
            ? dayKey(280)
            : fading
              ? dayKey(-FADING_DAYS_LATE)
              : dayKey(30 + (w % 20)),
          ...(sealed ? { retiredAt: iso(90) } : {}),
        })
      }
      packageProgress.push({
        packageId: pack.id,
        startedAt: iso(180 - Math.min(170, ordinal)),
        completedAt: iso(Math.max(1, 170 - ordinal)),
        masteredAt: iso(Math.max(1, 170 - ordinal)),
        // listenedPacksCount() counts a pack as heard when currentIndex >=
        // wordCount, so a finished pack sits AT n, not at the last index.
        currentIndex: n,
      })
      known += n
      continue
    }

    // The frontier: the one pack in progress. Everything after it is untouched.
    if (frontier == null && known < TARGET_KNOWN) {
      const partial = TARGET_KNOWN - known
      for (let w = 0; w < partial; w++) {
        wordProgress.push({
          wordId: `${pack.id}-w${w + 1}`,
          packageId: pack.id,
          seenCount: 2,
          lastSeen: iso(0),
          status: 'known',
          reviewCount: 1,
          stability: 4,
          difficulty: 5.3,
          nextReviewAt: dayKey(2),
        })
      }
      packageProgress.push({
        packageId: pack.id,
        startedAt: iso(1),
        completedAt: null,
        masteredAt: null,
        currentIndex: partial,
      })
      known += partial
      frontier = pack.id
    }
    break
  }

  // Sessions drive points, pace and the streak.
  //
  // There must be one for EVERY mastered pack, not just the recent days:
  // useProgressData counts any pack with masteredAt but no session against it as
  // "marked known without studying in the app", and StatsPage prints that as a
  // caveat under the headline number. 34 sessions against 119 mastered packs
  // put "858 słów oznaczyłeś jako znane bez nauki" on the screenshot.
  const sessions = []
  const SPAN_DAYS = 170
  const STREAK_DAYS = 34
  const total = packageProgress.length
  packageProgress.forEach((pp, i) => {
    const pack = packs.find((p) => p.id === pp.packageId)
    const words = pack?.wordCount ?? 10
    // The most recent STREAK_DAYS packs get exactly one day each, unbroken and
    // ending today, so getStreak() walks a continuous chain back from today.
    // Everything older is spread across the rest of the history, where gaps are
    // fine because only the *current* run is displayed.
    const fromEnd = total - 1 - i
    const daysAgo =
      fromEnd < STREAK_DAYS
        ? fromEnd
        : STREAK_DAYS +
          Math.round((SPAN_DAYS - STREAK_DAYS) * ((fromEnd - STREAK_DAYS) / Math.max(1, total - STREAK_DAYS)))
    sessions.push({
      date: dayKey(-daysAgo),
      startedAt: iso(daysAgo),
      packageId: pp.packageId,
      // StudyMode is 'fiszki' | 'autoplay' (src/types/progress.ts) — anything
      // else silently falls through weightFor() to the default weight.
      mode: i % 3 === 0 ? 'autoplay' : 'fiszki',
      ...(i % 3 === 0 ? { autoplayMode: 'standard' } : { trainMode: 'word-flash' }),
      // The field is `wordsCompleted`. Writing `wordsStudied` leaves it
      // undefined, and computePoints' reduce turns the whole total into NaN —
      // which is exactly what the first pass rendered on the Postęp card.
      wordsCompleted: words,
      durationSec: 420 + (i % 7) * 90,
      ratedCount: words,
      knownHitCount: Math.max(1, words - (i % 3)),
    })
  })

  const dailyTime = []
  for (let d = 0; d < 34; d++) {
    const date = dayKey(-d)
    // Shape must match DailyTime in src/types/progress.ts exactly —
    // `secondsStudied`, not `seconds`, or the goal ring silently reads 0.
    const secondsStudied = d === 0 ? 640 : 900 + (d % 6) * 130
    dailyTime.push({
      // Today deliberately sits just under the goal, so the ring reads as
      // "in progress" rather than either empty or already finished.
      date,
      secondsStudied,
      goalSec: 900,
      goalMetAt: secondsStudied >= 900 ? iso(d) : null,
    })
  }

  return { wordProgress, packageProgress, sessions, dailyTime, known, frontier }
}

/** Runs in the page before any app code — writes IndexedDB + localStorage. */
function seedInPage(seed) {
  localStorage.setItem('pe-onboarding-done', 'true')
  localStorage.setItem('lp_onboarding_seen', 'true')
  localStorage.setItem('lp_onboarding_card_hidden', 'true')
  localStorage.setItem(
    'pe-store',
    JSON.stringify({
      state: {
        theme: 'dark',
        todayLevel: 2,
        comfortLevel: 2,
        dailyGoalSec: 900,
        soundEnabled: false,
        streakFreeze: { days: [], lastGrantedMonth: null },
        achievementUnlocks: {},
        levelUpPrompt: { dismissedForLevel: null, lastShownAt: null },
      },
      version: 2,
    }),
  )

  // Create PE_DB at the exact version/shape the app expects (src/services/db.ts),
  // so its own openDB() finds a ready database and never runs an upgrade.
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PE_DB', 6)
    req.onupgradeneeded = () => {
      const db = req.result
      const sessions = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true })
      sessions.createIndex('by-date', 'date')
      sessions.createIndex('by-package', 'packageId')
      const wp = db.createObjectStore('wordProgress', { keyPath: 'wordId' })
      wp.createIndex('by-package', 'packageId')
      db.createObjectStore('packageProgress', { keyPath: 'packageId' })
      db.createObjectStore('dailyTime', { keyPath: 'date' })
      db.createObjectStore('reviewLedger', { keyPath: 'date' })
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(
        ['wordProgress', 'packageProgress', 'sessions', 'dailyTime'],
        'readwrite',
      )
      for (const w of seed.wordProgress) tx.objectStore('wordProgress').put(w)
      for (const p of seed.packageProgress) tx.objectStore('packageProgress').put(p)
      for (const s of seed.sessions) tx.objectStore('sessions').add(s)
      for (const d of seed.dailyTime) tx.objectStore('dailyTime').put(d)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error)
    }
  })
}

/**
 * Screenshot-only chrome suppression. The build-version string in the top bar
 * (and sidebar) is a developer affordance — a five-tap easter egg toggles the
 * debug overlay — and putting "1.0.0+91ee50d" on a sales page reads as a
 * screenshot someone forgot to clean up. Hidden here rather than changed in the
 * app, because the app is right to show it.
 */
const HIDE_DEV_CHROME = `
  .topbar__version, .sidebar__version { visibility: hidden !important; }
`

/** Let fonts land, the mesh gradient settle, and entrance animations finish. */
async function settle(page) {
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(2200)
  await page.evaluate(
    () => new Promise((r) => (window.requestIdleCallback ?? requestAnimationFrame)(() => r(true))),
  )
}

async function emit(pngPath, name, cssWidth, cssHeight) {
  const src = sharp(pngPath)
  await src.clone().webp({ quality: 82 }).toFile(join(OUT, `${name}@2x.webp`))
  await src
    .clone()
    .resize(cssWidth, cssHeight, { fit: 'inside' })
    .webp({ quality: 82 })
    .toFile(join(OUT, `${name}.webp`))
  console.log(`  ✓ ${name}.webp + @2x (${cssWidth}×${cssHeight})`)
}

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

async function main() {
  await mkdir(OUT, { recursive: true })
  await mkdir(TMP, { recursive: true })

  const seed = await buildSeed()
  console.log(`Persona: ${seed.known} known words, frontier = ${seed.frontier}`)

  const browser = await chromium.launch({ channel: 'chrome' })

  /** One fresh, seeded context per shot — no state leaks between screens. */
  const shoot = async (name, viewport, path, prepare) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
    await ctx.addInitScript(seedInPage, seed)
    const page = await ctx.newPage()
    await page.goto(`${APP}${path}`, { waitUntil: 'networkidle' })
    await page.addStyleTag({ content: HIDE_DEV_CHROME })
    await page.keyboard.press('Escape').catch(() => {})
    await settle(page)
    if (prepare) await prepare(page)
    const png = join(TMP, `${name}.png`)
    await page.screenshot({ path: png })
    await emit(png, name, viewport.width, viewport.height)
    await ctx.close()
  }

  // Pakiety — the route as territory, shot AT THE FRONTIER. Left at the top the
  // list only ever shows finished packs; the frontier is where the argument
  // actually lives: conquered gold above, the violet "you are here" pack, then
  // the dim road ahead.
  const scrollToFrontier = async (page) => {
    // HomePage decides which volume to leave expanded once, on first paint. At
    // that moment the progress snapshot (~1 200 IndexedDB records) hasn't
    // resolved, so frontierPack() still returns pack #1 and it expands Tom I
    // and collapses the rest — including Tom II, where this persona actually
    // stands. Expand it explicitly instead of waiting for a card that will
    // never render.
    const head = page.locator('.volsec__head[data-volume="Tom II"] .volsec__toggle')
    // `attached`, not `visible`: the volume headers sit far down an 864-row list
    // rendered with `content-visibility: auto`, so an off-screen one reports a
    // zero-size box and never satisfies a visibility wait. Scroll it into view
    // first, then it's real.
    await head.first().waitFor({ state: 'attached', timeout: 30_000 })
    await head.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    if ((await head.first().getAttribute('aria-expanded')) === 'false') {
      await head.first().click()
      await page.waitForTimeout(700)
    }

    const card = page.locator('.packcard.is-frontier')
    await card.first().waitFor({ state: 'attached', timeout: 20_000 })
    await card.first().scrollIntoViewIfNeeded()
    // Nudge it off dead-centre so a few packs of untravelled road stay visible.
    await page.evaluate(() => document.querySelector('.appshell__main')?.scrollBy(0, -150))
    await page.waitForTimeout(900)
  }
  await shoot('pakiety-granica-mobile', MOBILE, '/pakiety', scrollToFrontier)

  // Dzisiaj — "what do I do now". This is the hero shot, so it has to show the
  // screen doing its job: the goal ring, the session card, both paths and the
  // next pack on the route. Wait for the pick card specifically — it's the last
  // thing to resolve, and a shot taken before it lands is a mostly-empty screen
  // with one button on it.
  await shoot('dzisiaj-mobile', MOBILE, '/dzis', async (page) => {
    await page.locator('.today__pick').first().waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(700)
  })

  // The two training modes, captured by actually switching the mode slider
  // rather than faking two variants of one screenshot.
  // ModeSlider renders plain <button>s, not ARIA tabs — target the classes it
  // actually emits (src/components/today/ModeSlider.tsx) and fail loudly rather
  // than silently shipping two copies of the default mode.
  const pickMode = (mode, label) => async (page) => {
    // The mode slider has moved in and out of a collapsed "Ćwicz ręcznie"
    // <details> as Dzisiaj has been reworked. Open it if it's there; it's a
    // no-op when the slider sits directly on the page.
    const manual = page.locator('details.today__manual')
    if (await manual.count()) {
      await manual.first().evaluate((el) => el.setAttribute('open', ''))
      await page.waitForTimeout(500)
    }

    const tab = page.locator(`.modeslider__tab--${mode}`)
    await tab.first().waitFor({ state: 'visible', timeout: 20_000 })
    // dispatchEvent, not click(): the slider sits inside a drag/swipe handler
    // that swallows synthesised mouse events, so a real click lands on the
    // pager instead of the tab and the mode never changes.
    await tab.first().dispatchEvent('click')
    await page.waitForTimeout(900)
    const active = await page.locator(`.modeslider__tab--${mode}.modeslider__tab--active`).count()
    if (!active) throw new Error(`clicking "${label}" did not activate it`)
  }
  await shoot('tryb-sluchaj-mobile', MOBILE, '/dzis', pickMode('listen', 'Słuchaj'))
  await shoot('tryb-trenuj-mobile', MOBILE, '/dzis', pickMode('train', 'Trenuj'))

  // Postęp — the numbers behind the "you can finally see it" claim.
  await shoot('postep-mobile', MOBILE, '/post%C4%99p')

  await browser.close()
  await rm(TMP, { recursive: true, force: true })
  console.log(`\nDone → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
