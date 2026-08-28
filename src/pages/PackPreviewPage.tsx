import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Pack, PackMeta } from '../types/vocabulary'
import { PackageProgress } from '../types/progress'
import { loadProgressSnapshot, ProgressSnapshot } from '../hooks/useProgressData'
import { getAudioUrl } from '../services/audioService'
import { supabase } from '../services/supabaseClient'
import { getPackageWordProgress, getPackageProgress, saveWordProgress, savePackageProgress } from '../services/db'
import { applyKnown } from '../services/review'
import { AppShell } from '../components/layout/AppShell'
import { EASE_OUT_EXPO } from '../components/today/motion'
import {
  LEVEL_COLORS,
  getPackIcon,
  getPackNumber,
  getStatus,
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

/** Compact status shown on a related-pack row: label + modifier class. */
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
  const navigate = useNavigate()
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
          <button onClick={() => navigate('/')}>Wróć do listy</button>
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
        saveWordProgress(applyKnown(byId.get(w.id), w.id, packageId, now, { bulk: true }))
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

  return (
    <AppShell
      hideBottomNav hideSidebar={false} hideAmbient={false} lockScroll={false}
      topBarAccountOverride={prevPack ? {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 6 9 12 15 18" />
          </svg>
        ),
        label: `Poprzedni pakiet: ${prevPack.name}`,
        onClick: () => navigate(`/pakiet/${prevPack.id}`),
      } : undefined}
    >
    <div className="packpreview">
      {/* Back (→ home icon, since the chevron pair below is for stepping
          through the catalog — a matching chevron here read as "previous
          pack" but actually exited the page entirely) + next-pack nav */}
      <div className="packpreview__nav-row">
        <button
          className="packpreview__back"
          onClick={() => navigate('/')}
          aria-label="Wróć do listy pakietów"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 10v9a1 1 0 0 0 1 1H9v-6h6v6h2.5a1 1 0 0 0 1-1v-9" />
          </svg>
          <span className="packpreview__back-label">Wróć</span>
        </button>

        {nextPack && (
          <button
            className="packpreview__next"
            onClick={() => navigate(`/pakiet/${nextPack.id}`)}
            aria-label={`Następny pakiet: ${nextPack.name}`}
            title={nextPack.name}
          >
            <span className="packpreview__next-label">Następny</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Hero — tinted by the pack's level color (falls back to the app
          accent for level-less packs), same "mood follows context" idea as
          Dzisiaj's Trenuj/Słuchaj hero cards. */}
      <section
        className="packpreview__hero"
        style={{ '--hero-accent': levelColor ?? 'var(--accent)' } as CSSProperties}
      >
        <div className="packpreview__hero-icon">
          {icon}
        </div>

        <div className="packpreview__hero-body">
          <h2 className="packpreview__hero-name">{pack.name}</h2>
          <p className="packpreview__hero-sub">{pack.category} · {pack.volume}</p>
          <div className="packpreview__hero-pills">
            {pack.level > 0 && (
              <span
                className="packpreview__pill packpreview__pill--level"
                style={levelColor ? { color: levelColor, borderColor: `${levelColor}55` } : undefined}
              >
                Poziom {pack.level}
              </span>
            )}
            {packNum && <span className="packpreview__pill packpreview__pill--num">#{packNum}</span>}
            {status === 'mastered' && progress?.masteredAt && (
              <span
                className="packpreview__pill packpreview__pill--mastered"
                title={`Opanowana: ${formatDate(progress.masteredAt)}`}
              >
                ★ Opanowana
              </span>
            )}
            {status === 'completed' && progress?.completedAt && (
              <span
                className="packpreview__pill packpreview__pill--completed"
                title={`Odsłuchana: ${formatDate(progress.completedAt)}`}
              >
                ✓ Odsłuchana
              </span>
            )}
          </div>
          {knownCount < wordCount && (
            <button
              type="button"
              className="packpreview__mark-all-btn"
              onClick={() => setMarkAllOpen(true)}
            >
              <span className="packpreview__mark-all-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              Znam wszystko
            </button>
          )}
        </div>

        {/* Mastery progress ring */}
        <div className="packpreview__ring" role="img" aria-label={`${knownCount} z ${wordCount} opanowanych`}>
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
            <span className="packpreview__ring-num">{knownCount}</span>
            <span className="packpreview__ring-total">/{wordCount}</span>
          </div>
        </div>
      </section>

      <main className="packpreview__main">
        {/* Word list */}
        <ul className="packpreview__wordlist">
          {pack.words.map(word => (
            <li key={word.id} className="packpreview__wordrow">
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

        {/* Related packs (same topic across levels), numbered by stable position */}
        {seriesAll.length > 1 && (
          <section className="packpreview__related">
            <h3 className="packpreview__related-title">Powiązane pakiety</h3>
            <p className="packpreview__related-hint">Ten sam temat na innych poziomach</p>
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
                      style={!isCurrent && sibColor
                        ? { background: `linear-gradient(165deg, ${sibColor}33 0%, ${sibColor}11 100%)`, color: sibColor }
                        : undefined}
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
                    className="packpreview__related-row"
                    onClick={() => navigate(`/pakiet/${sib.id}`)}
                  >
                    {inner}
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </main>

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
              <p className="packpreview__mode-info-title">{MODE_INFO[activeInfo].title}</p>
              <p className="packpreview__mode-info-desc">{MODE_INFO[activeInfo].desc}</p>
            </div>
          </div>
        )}
        <div className="packpreview__btns">
          <div className="packpreview__btn-wrap">
            <button
              className="packpreview__btn packpreview__btn--fiszki"
              onClick={() => navigate(`/pakiet/${packageId}/fiszki-start`)}
            >
              <span className="packpreview__btn-icon" aria-hidden="true">⚡</span>
              <span className="packpreview__btn-label">Trenuj</span>
              <span className="packpreview__btn-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </span>
            </button>
            <button
              className={`packpreview__info-btn packpreview__info-btn--light${activeInfo === 'aktywuj' ? ' packpreview__info-btn--active' : ''}`}
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
              className="packpreview__btn packpreview__btn--autoplay"
              onClick={() => navigate(`/pakiet/${packageId}/start`)}
            >
              <span className="packpreview__btn-icon" aria-hidden="true">🎧</span>
              <span className="packpreview__btn-label">Słuchaj</span>
              <span className="packpreview__btn-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </span>
            </button>
            <button
              className={`packpreview__info-btn packpreview__info-btn--light${activeInfo === 'sluchaj' ? ' packpreview__info-btn--active' : ''}`}
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
            Wszystkie {wordCount} {plWords(wordCount)} w tej paczce zostaną oznaczone jako opanowane, a paczka jako w pełni opanowana. Nadal będą wracać w powtórkach jak każde inne opanowane słowo.
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
              className="packpreview__mark-modal-btn packpreview__mark-modal-btn--confirm"
              onClick={handleMarkAllKnown}
              disabled={markingAll}
            >
              {markingAll ? 'Oznaczanie…' : 'Tak, oznacz wszystkie'}
            </button>
          </div>
        </dialog>
      )}
    </div>
    </AppShell>
  )
}
