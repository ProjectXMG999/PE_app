import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate, useBack } from '../navigation/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Pack, PackMeta } from '../types/vocabulary'
import { PackageProgress } from '../types/progress'
import { loadProgressSnapshot, ProgressSnapshot } from '../hooks/useProgressData'
import { getAudioUrl } from '../services/audioService'
import { supabase } from '../services/supabaseClient'
import { getPackageWordProgress, getPackageProgress, saveWordProgress, savePackageProgress } from '../services/db'
import { applyKnown } from '../services/review'
import { currentRequestRetention } from '../store/useAppStore'
import { AppShell } from '../components/layout/AppShell'
import { ModeFact, ModeLabel } from '../components/mode/ModeScreen'
import { EASE_OUT_EXPO, fadeUp, fadeUpReduced, staggerContainer } from '../components/today/motion'
import { noOrphans } from '../utils/typography'
import {
  LEVEL_COLORS,
  getPackIcon,
  getPackNumber,
  getStatus,
  plPacks,
  plWords,
  PackStatus,
} from '../utils/packVisuals'
import packagesIndex from '../data/packages-index.json'
import './PackPreviewPage.css'

const allPacks = packagesIndex as PackMeta[]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MODE_INFO = {
  sluchaj: {
    title: 'Słuchaj',
    icon: '🎧',
    desc: 'Tryb audio do osłuchania, powtórki i nauki w tle. Uczysz się słów bez patrzenia w ekran. Idealne w aucie, na spacerze, na siłowni, w poczekalni albo w metrze.',
  },
  aktywuj: {
    title: 'Trenuj',
    icon: '⚡',
    desc: 'Tryb głębokiego treningu słowa. Przypominasz sobie znaczenie, mówisz na głos i budujesz własne frazy lub zdania. Tutaj słowo przestaje być tylko znane — zaczynasz czuć, że potrafisz go użyć w prawdziwej rozmowie.',
  },
}

/** Strip trailing number (and surrounding space) from pack name to get base series name */
function getSeriesBase(name: string): string {
  return name.replace(/\s+\d+$/, '').trim()
}

/** Trailing number in a pack name (e.g. "Czasowniki 28" -> 28), used to order
 * a series by its intended position rather than by pack id — ids are assigned
 * by creation order, which doesn't always match the number in the name. */
function getSeriesNumber(name: string): number {
  const match = name.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

/** Next pack in plain catalog order — same pattern as FlashcardPage's
 * getNextPack, used for the autoplay "keep going" flow. Duplicated locally
 * rather than shared, since FlashcardPage's version isn't exported. */
function getNextPack(currentId: string): PackMeta | null {
  const idx = allPacks.findIndex(p => p.id === currentId)
  return idx >= 0 && idx < allPacks.length - 1 ? allPacks[idx + 1] : null
}

/** Previous pack in plain catalog order — wraps to the last pack when
 * already at the first one, so this control always has somewhere to go. */
function getPrevPack(currentId: string): PackMeta | null {
  const idx = allPacks.findIndex(p => p.id === currentId)
  if (idx === -1) return null
  return idx > 0 ? allPacks[idx - 1] : allPacks[allPacks.length - 1]
}

/** Compact status shown on a related-pack row: label + modifier class. The
 * tones map onto the app-wide colour meanings — gold is earned (mastered),
 * --listen-blue belongs to Słuchaj, --accent to a route you're on. */
function relatedStatus(
  status: PackStatus
): { label: string; tone: 'mastered' | 'completed' | 'started' } | null {
  switch (status) {
    case 'mastered':  return { label: 'Opanowana', tone: 'mastered' }
    case 'completed': return { label: 'Odsłuchana', tone: 'completed' }
    case 'started':   return { label: 'W toku', tone: 'started' }
    default:          return null
  }
}

export function PackPreviewPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useAppNavigate()
  const back = useBack()
  /** Out of the pack page. Into Pakiety it hands the pack id over, so the list
   *  lands on this row — in its volume, pulsing — rather than on a remembered
   *  scroll offset from however you last browsed it. */
  const leave = () => back.goBack(back.path.split('?')[0] === '/pakiety' && packageId ? { focusPack: packageId } : undefined)
  const reduced = useReducedMotion()
  const [pack, setPack] = useState<Pack | null>(null)
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeInfo, setActiveInfo] = useState<'sluchaj' | 'aktywuj' | null>(null)
  const [markAllOpen, setMarkAllOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)
  const markDialogRef = useRef<HTMLDialogElement>(null)

  // Close the mode-info popover on any outside click.
  useEffect(() => {
    if (!activeInfo) return
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setActiveInfo(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeInfo])

  // "Znam wszystko" confirm dialog — mirrors ResetProgressModal: only mounted
  // while markAllOpen is true, and calls showModal() on that mount. A dialog
  // element left permanently in the DOM stays visible regardless of its
  // `open` attribute once any CSS on it sets `display`, since an author rule
  // and the UA's `dialog:not([open]) { display: none }` tie on specificity
  // and the author rule wins — so "always mounted, toggle imperatively" was
  // the bug, not a viable alternative.
  useEffect(() => {
    if (!markAllOpen) return
    const dialog = markDialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    function handleClose() { setMarkAllOpen(false) }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [markAllOpen])

  useEffect(() => {
    if (!packageId) return
    setLoading(true)
    setError(null)
    // Reset scroll — navigating between related packs reuses this page, so the
    // container would otherwise keep the previous pack's scroll position.
    document.querySelector('.appshell__main')?.scrollTo({ top: 0 })
    Promise.all([
      supabase!.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        return fetch(`/.netlify/functions/pack-content?pack=${encodeURIComponent(packageId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      }).then(r => {
        if (r.status === 402) { navigate('/konto'); throw new Error('Wymagana subskrypcja') }
        if (!r.ok) throw new Error('Nie znaleziono pakietu')
        return r.json() as Promise<Pack>
      }),
      loadProgressSnapshot(),
    ])
      .then(([data, snap]) => {
        setPack(data)
        setSnapshot(snap)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Błąd ładowania')
        setLoading(false)
      })
  }, [packageId])

  const currentMeta = allPacks.find(p => p.id === packageId)
  const nextPack = packageId ? getNextPack(packageId) : null
  const prevPack = packageId ? getPrevPack(packageId) : null
  const seriesBase = currentMeta ? getSeriesBase(currentMeta.name) : null
  // Full series (incl. current), ordered by level then id. The order is
  // deterministic and independent of which pack is open, so a pack's position
  // number (1, 2, 3…) stays the same no matter where you navigate from.
  const seriesAll = useMemo(() => {
    if (!seriesBase) return []
    return allPacks
      .filter(p => getSeriesBase(p.name) === seriesBase)
      .sort((a, b) => getSeriesNumber(a.name) - getSeriesNumber(b.name))
  }, [seriesBase])

  if (loading) {
    return (
      <AppShell hideBottomNav hideSidebar={false} hideAmbient={false} lockScroll={false}>
        <div className="packpreview__loading">
          <div className="spinner" />
        </div>
      </AppShell>
    )
  }

  if (error || !pack) {
    return (
      <AppShell hideBottomNav hideSidebar={false} hideAmbient={false} lockScroll={false}>
        <div className="packpreview__error">
          <p>{error ?? 'Nie znaleziono pakietu'}</p>
          <button onClick={leave}>{back.backLabel}</button>
        </div>
      </AppShell>
    )
  }

  const progress: PackageProgress | undefined = snapshot?.progressMap.get(pack.id)
  const knownCount = snapshot?.knownMap.get(pack.id) ?? 0
  const status = getStatus(progress)
  const packNum = packageId ? getPackNumber(packageId) : null
  const icon = getPackIcon(pack)
  const levelColor = pack.level ? LEVEL_COLORS[pack.level] : undefined
  // The pack blob from /.netlify/functions/pack-content never carries a
  // wordCount field (only packages-index.json's PackMeta does) — pack.words
  // is always present and always accurate, so it's the source of truth here.
  const wordCount = pack.words.length

  // Progress ring geometry
  const knownPct = wordCount > 0 ? Math.min((knownCount / wordCount) * 100, 100) : 0
  const R = 26
  const C = 2 * Math.PI * R
  const dash = (knownPct / 100) * C

  // Marks every word in the pack 'known' in one go, for someone who already
  // knows this vocabulary and doesn't want to click through it card by card.
  // `bulk: true` → words with no history are seeded a couple of review levels in
  // (they're asserting prior knowledge, not learning now — see review.ts).
  async function handleMarkAllKnown() {
    if (!packageId) return
    setMarkingAll(true)
    try {
      const now = new Date()
      const existingList = await getPackageWordProgress(packageId)
      const byId = new Map(existingList.map(w => [w.wordId, w]))
      await Promise.all(pack!.words.map(w =>
        saveWordProgress(applyKnown(byId.get(w.id), w.id, packageId, now, {
          bulk: true, requestRetention: currentRequestRetention(),
        }))
      ))
      const existingPkg = await getPackageProgress(packageId)
      const nowIso = now.toISOString()
      await savePackageProgress({
        packageId,
        startedAt: existingPkg?.startedAt ?? nowIso,
        completedAt: nowIso,
        masteredAt: nowIso,
        currentIndex: wordCount,
      })
      setSnapshot(await loadProgressSnapshot(true))
      markDialogRef.current?.close()
    } finally {
      setMarkingAll(false)
    }
  }

  // What the progress card says under the count. Avoids the noun entirely
  // ("paczka" vs "pakiet" are both used in the app) by talking about the words.
  const progressHint = noOrphans(
    status === 'mastered'
      ? progress?.masteredAt
        ? `Wszystko opanowane — ${formatDate(progress.masteredAt)}. Słowa i tak wracają w powtórkach.`
        : 'Wszystko opanowane. Słowa i tak wracają w powtórkach.'
      : (() => {
          const heard = progress?.completedAt
            ? `Odsłuchane w całości — ${formatDate(progress.completedAt)}. `
            : ''
          const left = wordCount - knownCount
          if (left <= 0) return `${heard}Wszystkie słowa masz już opanowane.`
          if (knownCount === 0) return `${heard}Żadne słowo nie jest jeszcze opanowane.`
          return `${heard}Zostało ${left} ${plWords(left)} do opanowania.`
        })()
  )

  const item = reduced ? fadeUpReduced : fadeUp

  return (
    <AppShell hideBottomNav hideSidebar={false} hideAmbient={false} lockScroll={false}>
    <motion.div
      className="packpreview"
      style={{ '--pp-accent': levelColor ?? 'var(--accent)' } as CSSProperties}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Nav ──────────────────────────────────────────────────────────────
          In the flow, not floating over it. The old version pinned these as
          fixed circles at the top corners, which sat on top of the TopBar's
          logo and action buttons. Same pill language as ModeScreen's back. */}
      <motion.div className="packpreview__nav" variants={item}>
        <button
          type="button"
          className="packpreview__navbtn"
          onClick={leave}
          aria-label={back.backLabel}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>{back.label}</span>
        </button>

        <div className="packpreview__steps">
          {prevPack && (
            <button
              type="button"
              className="packpreview__navbtn packpreview__navbtn--icon"
              onClick={() => navigate(`/pakiet/${prevPack.id}`, { step: 'sideways' })}
              aria-label={`Poprzedni pakiet: ${prevPack.name}`}
              title={prevPack.name}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          {nextPack && (
            <button
              type="button"
              className="packpreview__navbtn"
              onClick={() => navigate(`/pakiet/${nextPack.id}`, { step: 'sideways' })}
              aria-label={`Następny pakiet: ${nextPack.name}`}
              title={nextPack.name}
            >
              <span>Następny</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Head — the same kicker / display title / fact-pill header the two
          mode screens use, so the pack keeps its identity all the way into a
          session. Tinted by the pack's level colour. */}
      <motion.header className="packpreview__head" variants={item}>
        <p className="packpreview__kicker u-kicker">
          {pack.category}{packNum ? ` · pakiet #${packNum}` : ''}
        </p>
        <div className="packpreview__titlerow">
          <span className="packpreview__glyph" aria-hidden="true">{icon}</span>
          <h1
            className="packpreview__title u-display"
            style={{ viewTransitionName: `pack-name-${pack.id}` }}
          >
            {pack.name}
          </h1>
        </div>
        <div className="packpreview__facts">
          {pack.level > 0 && <ModeFact color={levelColor}>Poziom {pack.level}</ModeFact>}
          {pack.volume && <ModeFact>{pack.volume}</ModeFact>}
          <ModeFact>{wordCount} {plWords(wordCount)}</ModeFact>
          {status === 'mastered' && <ModeFact color="var(--gold)">★ Opanowana</ModeFact>}
          {status === 'completed' && <ModeFact color="var(--listen-blue)">✓ Odsłuchana</ModeFact>}
        </div>
      </motion.header>

      {/* ── Progress ── the one raised card on the page (the .u-surface--raised
          recipe: gradient ground, float shadow, glowing hairline). */}
      <motion.section className="packpreview__progress u-surface--raised" variants={item}>
        <div
          className="packpreview__ring"
          role="img"
          aria-label={`${knownCount} z ${wordCount} opanowanych`}
        >
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle className="packpreview__ring-track" cx="32" cy="32" r={R} strokeWidth="6" fill="none" />
            <circle
              className="packpreview__ring-fill"
              cx="32" cy="32" r={R} strokeWidth="6" fill="none"
              strokeDasharray={`${dash} ${C}`}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div className="packpreview__ring-label">
            {/* The two spans share a baseline inside this wrapper; the wrapper
                is what gets centred in the ring — aligning them to a baseline
                directly in the centring box would pin the line to its top. */}
            <span className="packpreview__ring-value">
              <span className="packpreview__ring-num">{Math.round(knownPct)}</span>
              <span className="packpreview__ring-pct">%</span>
            </span>
          </div>
        </div>

        <div className="packpreview__progress-body">
          <p className="u-kicker">Opanowane</p>
          <p className="packpreview__progress-count">
            <strong>{knownCount}</strong> z {wordCount} {plWords(wordCount)}
          </p>
          <p className="packpreview__progress-hint">{progressHint}</p>
        </div>

        {status !== 'mastered' && (
          <button
            type="button"
            className="packpreview__mark-all"
            onClick={() => setMarkAllOpen(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Znam wszystko
          </button>
        )}
      </motion.section>

      {/* ── Words ────────────────────────────────────────────────────────── */}
      <motion.section className="packpreview__block" variants={item}>
        <ModeLabel aside={`${wordCount} ${plWords(wordCount)}`}>Słowa w pakiecie</ModeLabel>
        <ul className="packpreview__wordlist">
          {pack.words.map(word => (
            <li key={word.id} className="packpreview__wordrow u-tile">
              <span className="packpreview__polish">{word.polish}</span>
              <span className="packpreview__sep" aria-hidden="true">–</span>
              <span className="packpreview__english">{word.english}</span>
              <button
                className="packpreview__audio-btn"
                aria-label={`Wymowa: ${word.english}`}
                onClick={e => {
                  e.stopPropagation()
                  const audio = new Audio(getAudioUrl(pack.id, word.audioWord))
                  audio.play().catch(() => {})
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* ── Related packs (same topic across levels), numbered by stable position ── */}
      {seriesAll.length > 1 && (
        <motion.section className="packpreview__block" variants={item}>
          <ModeLabel aside={`${seriesAll.length} ${plPacks(seriesAll.length)}`}>
            Powiązane pakiety
          </ModeLabel>
          <p className="packpreview__block-hint">Ten sam temat na innych poziomach</p>
          <div className="packpreview__related-list">
            {seriesAll.map((sib, i) => {
              const num = i + 1
              const isCurrent = sib.id === pack.id
              const sibProg = snapshot?.progressMap.get(sib.id)
              const st = relatedStatus(getStatus(sibProg))
              const sibColor = sib.level ? LEVEL_COLORS[sib.level] : undefined

              const inner = (
                <>
                  <span className="packpreview__related-num">{num}</span>
                  <span
                    className="packpreview__related-icon"
                    style={sibColor ? ({ '--sib-accent': sibColor } as CSSProperties) : undefined}
                  >
                    {getPackIcon(sib)}
                  </span>
                  <div className="packpreview__related-body">
                    <span className="packpreview__related-name">{sib.name}</span>
                    <span className="packpreview__related-meta">
                      Poziom {sib.level} · {sib.volume} · {sib.wordCount} {plWords(sib.wordCount)}
                    </span>
                  </div>
                  {isCurrent ? (
                    <span className="packpreview__related-here">Tu jesteś</span>
                  ) : (
                    <>
                      {st && (
                        <span className={`packpreview__related-status packpreview__related-status--${st.tone}`}>
                          {st.label}
                        </span>
                      )}
                      <span className="packpreview__related-chevron" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </>
                  )}
                </>
              )

              return isCurrent ? (
                <div key={sib.id} className="packpreview__related-row packpreview__related-row--current">
                  {inner}
                </div>
              ) : (
                <button
                  key={sib.id}
                  className="packpreview__related-row u-tile"
                  onClick={() => navigate(`/pakiet/${sib.id}`, { step: 'sideways' })}
                >
                  {inner}
                </button>
              )
            })}
          </div>
        </motion.section>
      )}

      {/* Sticky bottom action bar — takes over the exact screen region
          BottomNav just vacated (AppShell hides it on this route), so this
          slides in from the same place the tab bar slides out to, rather
          than just appearing underneath it. */}
      <motion.div
        className="packpreview__actions"
        ref={infoRef}
        initial={{ y: '120%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.32, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.05 }}
      >
        {activeInfo && (
          <div className="packpreview__mode-info">
            <span className="packpreview__mode-info-icon">{MODE_INFO[activeInfo].icon}</span>
            <div>
              <p className="packpreview__mode-info-title u-kicker">{MODE_INFO[activeInfo].title}</p>
              <p className="packpreview__mode-info-desc">{MODE_INFO[activeInfo].desc}</p>
            </div>
          </div>
        )}
        <div className="packpreview__btns">
          <div className="packpreview__btn-wrap">
            <button
              className="packpreview__btn u-cta fx-shine"
              onClick={() => navigate(`/pakiet/${packageId}/fiszki-start`)}
            >
              <span className="packpreview__btn-icon" aria-hidden="true">⚡</span>
              Trenuj
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button
              className={`packpreview__info-btn${activeInfo === 'aktywuj' ? ' packpreview__info-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'aktywuj' ? null : 'aktywuj') }}
              aria-label="Informacje o trybie Trenuj"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/><line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            </button>
          </div>
          <div className="packpreview__btn-wrap">
            <button
              className="packpreview__btn packpreview__btn--listen u-cta fx-shine"
              onClick={() => navigate(`/pakiet/${packageId}/start`)}
            >
              <span className="packpreview__btn-icon" aria-hidden="true">🎧</span>
              Słuchaj
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button
              className={`packpreview__info-btn${activeInfo === 'sluchaj' ? ' packpreview__info-btn--active' : ''}`}
              onClick={e => { e.stopPropagation(); setActiveInfo(v => v === 'sluchaj' ? null : 'sluchaj') }}
              aria-label="Informacje o trybie Słuchaj"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/><line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            </button>
          </div>
        </div>
      </motion.div>

      {markAllOpen && (
        <dialog
          ref={markDialogRef}
          className="packpreview__mark-modal"
          aria-labelledby="mark-all-title"
          onClick={e => { if (e.target === markDialogRef.current) markDialogRef.current?.close() }}
        >
          <div className="packpreview__mark-modal-icon" aria-hidden="true">✓</div>
          <h2 className="packpreview__mark-modal-title" id="mark-all-title">Oznaczyć wszystko jako znane?</h2>
          <p className="packpreview__mark-modal-desc">
            Wszystkie {wordCount} {plWords(wordCount)} z tego pakietu zostaną oznaczone jako opanowane, a cały pakiet jako w pełni opanowany. Nadal będą wracać w powtórkach jak każde inne opanowane słowo.
          </p>
          <div className="packpreview__mark-modal-actions">
            <button
              className="packpreview__mark-modal-btn packpreview__mark-modal-btn--cancel"
              onClick={() => markDialogRef.current?.close()}
              disabled={markingAll}
            >
              Anuluj
            </button>
            <button
              className="packpreview__mark-modal-btn packpreview__mark-modal-btn--confirm u-cta"
              onClick={handleMarkAllKnown}
              disabled={markingAll}
            >
              {markingAll ? 'Oznaczanie…' : 'Tak, oznacz wszystkie'}
            </button>
          </div>
        </dialog>
      )}
    </motion.div>
    </AppShell>
  )
}
