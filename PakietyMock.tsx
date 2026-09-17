/* =============================================================================
 * PakietyMock.tsx — self-contained snapshot of the "Pakiety" (packages) screen
 * -----------------------------------------------------------------------------
 * Drop this ONE file into Vercel v0 as context. It has no imports from the real
 * project: the design tokens, the sample data, and every component are inlined.
 * Render <PakietyMock /> and you get the current screen, pixel-close.
 *
 * WHAT THE SCREEN IS
 *   A route, not a catalogue. 864 vocab packs in a fixed order; "where you are
 *   on the route" is the whole point. Two views:
 *     • map view (default)  — packs grouped into collapsible "Tom" (volume)
 *       sections, each with a completion meter; milestone bands ("1 000 słów ·
 *       Survival English") dropped between cards; a "Jesteś tu" frontier bar.
 *     • flat view (when any filter is set) — a plain filtered grid, "Pokaż
 *       więcej" pagination.
 *   A sticky filter bar (Poziom / Kategoria / Status / search) sits on top;
 *   volume headers stick just below it.
 *
 * THE PACK CARD (packcard) — the repeated unit, most of the visual weight
 *   grid: [ mark 46px | body 1fr | tail auto ], full-height left "state edge".
 *   - mark      = the route number (#317) in a tile, wrapped in a conic
 *                 progress ring (known / total). NOT an emoji — position in the
 *                 order is the identity.
 *   - body      = pack name + a sample of its words (blurred for locked users).
 *   - tail      = "<known>/<total>", a status glyph (◐ started, ✓ completed,
 *                 ★ mastered), a "Dalej →" cue on the frontier pack.
 *   - states    = new (no edge) · started (animated edge + orange "heard"
 *                 hairline) · completed (green) · mastered (struck-gold rim +
 *                 one-shot foil sweep) · fading (amber, "wraca do powtórki")
 *                 · sealed (holographic — out of the review queue for good)
 *                 · frontier (accent glow, the earliest unfinished pack).
 *
 * GOOD PROMPTS FOR v0
 *   "Keep the route/number identity and the state edge; make the card read more
 *    like a tile than a table row." · "Redesign the volume header — the meter +
 *    percent + chevron feels busy." · "Give the map view more sense of travel
 *    between milestones." · "Rework the sticky filter bar as a single search-
 *    forward control." Attach a screenshot of the live screen too.
 *
 * NOTE: v0 outputs Tailwind + shadcn/ui; this app is hand-written CSS on CSS
 * custom-property tokens. Treat v0's result as a visual direction to port, not
 * paste-in code. The palette below is the dark theme (the app also has light).
 * ========================================================================== */

import { useMemo, useState, type CSSProperties } from 'react'

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. DESIGN TOKENS + COMPONENT CSS  (verbatim from src/styles/tokens.css and
 *    the component .css files — this is the design language to preserve/evolve)
 * ─────────────────────────────────────────────────────────────────────────── */

const STYLE = `
:root {
  --bg-primary: #0D0B1E;
  --bg-surface: #1A1040;
  --bg-card: #241B5C;
  --bg-card-hover: #2E2470;

  --accent: #8B5CF6;
  --accent-bright: #A78BFA;
  --accent-glow: rgba(139, 92, 246, 0.3);

  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.75);
  --text-muted: rgba(255, 255, 255, 0.45);
  --text-accent: #C4B5FD;

  --border: rgba(255, 255, 255, 0.08);
  --border-accent: rgba(139, 92, 246, 0.4);

  --success: #34D399;
  --warning: #FBBF24;
  --danger: #F87171;

  --points-gold: #F5C451;
  --milestone-gold: #F0B429;
  --route-line: rgba(255, 255, 255, 0.14);
  --route-glow: rgba(139, 92, 246, 0.38);

  --shadow-sm: 0 2px 8px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 20px rgba(0,0,0,0.5);
  --shadow-card: inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.3), 0 12px 32px rgba(0,0,0,0.35);

  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px; --radius-full: 9999px;
  --spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px; --spacing-lg: 24px; --spacing-xl: 32px; --spacing-2xl: 48px;

  --font-heading: 'Montserrat', system-ui, sans-serif;
  --font-body: 'Roboto', system-ui, sans-serif;

  --transition-fast: 150ms ease;
  --transition-med: 250ms ease;
  --transition-slow: 400ms ease;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* published live by a ResizeObserver in the real app — volume headers stick below the bar */
  --pfbar-h: 96px;
}

@property --known-pct { syntax: '<number>'; inherits: true; initial-value: 0; }

.pakiety { background: var(--bg-primary); color: var(--text-primary); min-height: 100vh;
  font-family: var(--font-body); max-width: 480px; margin: 0 auto; padding-bottom: 80px; }
.pakiety * { box-sizing: border-box; }

/* ── Sticky filter bar ─────────────────────────────────────────────────────── */
.homepage__bar { position: sticky; top: 0; z-index: 3; }
.pfbar { background: var(--bg-primary); border-bottom: 1px solid var(--border); }
.pfbar__row { display: flex; align-items: center; gap: var(--spacing-sm); padding: 10px var(--spacing-md); overflow-x: auto; }
.pfbar__btn { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px;
  border-radius: var(--radius-full); font-family: var(--font-heading); font-size: 13px; font-weight: 600;
  color: var(--text-secondary); background: var(--bg-surface); border: 1px solid var(--border); cursor: pointer;
  transition: all var(--transition-fast); }
.pfbar__btn--icon { padding: 0; width: 32px; justify-content: center; }
.pfbar__btn.is-active { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 0 12px var(--accent-glow); }
.pfbar__caret { font-size: 9px; opacity: 0.7; }
.pfbar__meta { display: flex; align-items: center; gap: var(--spacing-sm); padding: 0 var(--spacing-md) 10px; }
.pfbar__count { font-family: var(--font-heading); font-size: 11px; font-weight: 700; color: var(--text-muted); }
.pfbar__here { margin-left: auto; font-family: var(--font-heading); font-size: 10px; font-weight: 800;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent-bright); }
.pfbar__clear { margin-left: auto; font-family: var(--font-heading); font-size: 11px; font-weight: 700;
  color: var(--accent-bright); background: none; border: none; cursor: pointer; }

/* ── Frontier "Jesteś tu" bar ──────────────────────────────────────────────── */
.frontierbar { width: calc(100% - 2 * var(--spacing-md)); margin: 0 var(--spacing-md); display: grid;
  grid-template-columns: auto 1fr auto; align-items: center; gap: var(--spacing-md); padding: 12px var(--spacing-md);
  border-radius: var(--radius-lg); border: 1px solid var(--border-accent); cursor: pointer; text-align: left;
  background: linear-gradient(120deg, color-mix(in srgb, var(--accent) 16%, var(--bg-card)), var(--bg-card) 70%);
  box-shadow: 0 0 0 1px var(--accent-glow), var(--shadow-card); color: inherit; }
.frontierbar__eyebrow { font-family: var(--font-heading); font-size: 9px; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--accent-bright); }
.frontierbar__pack { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.frontierbar__num { font-family: var(--font-heading); font-size: 15px; font-weight: 800; color: var(--accent-bright); }
.frontierbar__name { font-family: var(--font-heading); font-size: 14px; font-weight: 700; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
.frontierbar__go { font-size: 18px; color: var(--accent-bright); }

/* ── Volume section ───────────────────────────────────────────────────────── */
.volsec { --band: var(--text-muted); }
.volsec + .volsec { margin-top: var(--spacing-md); }
.volsec__head { position: sticky; top: var(--pfbar-h, 0px); z-index: 2; margin: 0; background: var(--bg-primary); }
.volsec__toggle { width: 100%; display: grid; grid-template-columns: minmax(0,1fr) auto auto; align-items: center;
  gap: var(--spacing-md); padding: 12px var(--spacing-md); background: transparent; border: none;
  border-bottom: 1px solid var(--border); cursor: pointer; text-align: left; color: var(--text-primary); }
.volsec__titles { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.volsec__label { font-family: var(--font-heading); font-size: 11px; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--band); }
.volsec__meta { display: flex; align-items: baseline; gap: var(--spacing-sm); font-family: var(--font-heading);
  font-variant-numeric: tabular-nums; }
.volsec__range { font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: var(--text-primary); }
.volsec__done { font-size: 11px; font-weight: 600; color: var(--text-muted); }
.volsec__levels { margin-left: auto; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; color: var(--text-muted); }
.volsec__meter { position: relative; height: 4px; border-radius: var(--radius-full); background: var(--route-line); overflow: hidden; }
.volsec__meter-fill { position: absolute; inset: 0 auto 0 0; border-radius: var(--radius-full);
  background: linear-gradient(90deg, color-mix(in srgb, var(--band) 55%, transparent), var(--band));
  transition: width var(--transition-slow) var(--ease-out-expo); }
.volsec__pct { font-family: var(--font-heading); font-size: 11px; font-weight: 800; color: var(--band);
  font-variant-numeric: tabular-nums; min-width: 30px; text-align: right; }
.volsec__chevron { flex-shrink: 0; color: var(--text-muted); transition: transform var(--transition-fast); }
.volsec__chevron.is-collapsed { transform: rotate(-90deg); }
.volsec.is-done .volsec__label, .volsec.is-done .volsec__pct { color: #F5C451; }
.volsec.is-done .volsec__meter-fill { background: linear-gradient(90deg, #C8860C, #F5C451); }
.volsec__cards { display: grid; grid-template-columns: 1fr; gap: 6px; padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md); }

/* ── Milestone band (dropped between cards) ────────────────────────────────── */
.mstone-tick { display: flex; align-items: center; gap: 8px; padding: 6px var(--spacing-md); }
.mstone-tick::before, .mstone-tick::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.mstone-tick__label { font-family: var(--font-heading); font-size: 10px; font-weight: 700; color: var(--text-muted);
  font-variant-numeric: tabular-nums; }
.mstone-tick.is-passed .mstone-tick__label { color: var(--success); }
.mstone { --station: var(--accent); position: relative; display: flex; align-items: center; gap: var(--spacing-md);
  padding: 14px var(--spacing-md); margin: 6px 0; }
.mstone__rule { position: absolute; left: var(--spacing-md); right: var(--spacing-md); top: 50%; height: 2px;
  background: linear-gradient(90deg, var(--station), transparent 80%); opacity: 0.5; }
.mstone__body { position: relative; display: flex; flex-direction: column; gap: 2px;
  padding: 6px 12px; border-radius: var(--radius-md); background: var(--bg-primary); border: 1px solid var(--border); }
.mstone__words { margin: 0; font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: var(--station);
  font-variant-numeric: tabular-nums; }
.mstone__words span { font-size: 11px; font-weight: 700; color: var(--text-muted); }
.mstone__name { margin: 0; font-family: var(--font-heading); font-size: 12px; font-weight: 700; color: var(--text-secondary); }
.mstone.is-passed .mstone__body { border-color: color-mix(in srgb, var(--station) 45%, transparent); }
.mstone__date { font-family: var(--font-body); font-size: 10px; color: var(--text-muted); }

/* ── Pack card ────────────────────────────────────────────────────────────── */
.packcard { position: relative; display: grid; grid-template-columns: 46px minmax(0,1fr) auto; align-items: center;
  gap: var(--spacing-md); padding: 11px var(--spacing-md) 11px 13px; border-radius: var(--radius-lg);
  border: 1px solid var(--border); box-shadow: var(--shadow-card); color: inherit; text-decoration: none; overflow: hidden;
  background: linear-gradient(168deg, color-mix(in srgb, var(--lvl, var(--accent)) 5%, var(--bg-card)) 0%, var(--bg-card) 60%);
  transition: border-color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast); cursor: pointer; }
.packcard:hover { transform: translateY(-1px); border-color: var(--border-accent); box-shadow: 0 10px 26px rgba(0,0,0,0.24); }

.packcard__edge { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: transparent; }
.packcard--started .packcard__edge { background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent), var(--accent));
  background-size: 100% 250%; animation: packcard-stripe-flow 2.8s ease-in-out infinite; }
.packcard--completed .packcard__edge { background: #10B981; }
.packcard--mastered .packcard__edge { background: linear-gradient(180deg, #FDE08A, #f2b619 45%, #C8860C); }
.packcard--fading .packcard__edge { background: linear-gradient(180deg, #FBBF24, #F59E0B); }
@keyframes packcard-stripe-flow { 0%,100% { background-position: 0 0; } 50% { background-position: 0 100%; } }

.packcard__mark { position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md); background: color-mix(in srgb, var(--lvl, var(--accent)) 14%, transparent);
  --ring-track: color-mix(in srgb, var(--ring, #10b981) 15%, transparent); }
.packcard__mark::before { content: ''; position: absolute; inset: -3.5px; border-radius: calc(var(--radius-md) + 3.5px);
  padding: 2.5px;
  background: conic-gradient(from -90deg, var(--ring, #10b981) calc(var(--known-pct, 0) * 1%), var(--ring-track) 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; pointer-events: none; }
.packcard__mark-num { font-family: var(--font-heading); font-size: 17px; font-weight: 800; letter-spacing: -0.04em;
  line-height: 1; color: var(--lvl, var(--accent)); font-variant-numeric: tabular-nums; }
.packcard__mark-num.is-wide { font-size: 15px; }

.packcard__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.packcard__name { font-family: var(--font-heading); font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  line-height: 1.2; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.packcard__sub { font-family: var(--font-body); font-size: 12px; line-height: 1.25; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.packcard__sub--locked { display: flex; align-items: center; gap: 5px; }
.packcard__sub--locked em { font-style: normal; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; filter: blur(3px); opacity: 0.85; user-select: none; }

.packcard__tail { display: flex; align-items: center; gap: var(--spacing-sm); }
.packcard__count { font-family: var(--font-heading); font-size: 12px; font-weight: 600; color: var(--text-muted);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.packcard__count b { font-weight: 800; color: var(--text-secondary); }
.packcard--mastered .packcard__count b { color: #F5C451; }
.packcard__state { display: flex; align-items: center; gap: 5px; min-width: 14px; justify-content: flex-end; }
.packcard__glyph { font-size: 13px; line-height: 1; }
.packcard__glyph--started { color: var(--accent-bright); }
.packcard__glyph--completed { color: #10B981; }
.packcard__glyph--mastered { color: #f2b619; }
.packcard__fade-dot { width: 6px; height: 6px; border-radius: var(--radius-full); background: #F59E0B;
  box-shadow: 0 0 8px 1px color-mix(in srgb, #F59E0B 55%, transparent); flex-shrink: 0; }
.packcard__go { font-family: var(--font-heading); font-size: 11px; font-weight: 700; padding: 4px 9px;
  border-radius: var(--radius-full); background: var(--accent); color: #fff; white-space: nowrap; }
.packcard__seal { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: var(--radius-full);
  font-family: var(--font-heading); font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  white-space: nowrap; border: 1px solid transparent; color: #DDD3FF;
  background: linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box,
              linear-gradient(135deg, #7C3AED, #F5C451 45%, #3B82F6) border-box; }

.packcard--frontier { border-color: var(--border-accent);
  background: linear-gradient(168deg, color-mix(in srgb, var(--accent) 15%, var(--bg-card)) 0%, var(--bg-card) 62%);
  box-shadow: 0 0 0 1px var(--accent-glow), 0 10px 28px rgba(0,0,0,0.26); }
.packcard--frontier .packcard__edge { background: var(--accent-bright); }
.packcard--completed { border-color: rgba(16,185,129,0.3); }
.packcard--fading { border-color: color-mix(in srgb, #F59E0B 30%, var(--border)); }

/* Mastered: struck gold — deep base, metallic rim (padding-box/border-box double bg), one-shot foil sweep */
.packcard--mastered { border: 1px solid transparent;
  background:
    linear-gradient(125deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 34%) padding-box,
    radial-gradient(130% 100% at 14% -14%, rgba(247,214,130,0.13) 0%, rgba(247,214,130,0) 58%) padding-box,
    linear-gradient(158deg, rgba(44,36,74,0.96) 0%, rgba(22,18,44,0.98) 100%) padding-box,
    linear-gradient(135deg, #fbf1c4 0%, #d7ad46 12%, #fff6d8 26%, #a4741b 40%, #f1d275 54%, #8a6212 68%, #f4db88 82%, #fff6d8 100%) border-box;
  box-shadow: 0 10px 30px rgba(0,0,0,0.42), 0 0 20px rgba(226,180,74,0.16), inset 0 1px 0 rgba(255,255,255,0.26); }
.packcard--mastered .packcard__name { color: #FDF3D0; }
.packcard--mastered .packcard__sub { color: rgba(240,214,150,0.72); }
.packcard--mastered .packcard__mark-num { background: linear-gradient(160deg, #fff7d6 0%, #f3ce74 48%, #c79320 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.packcard--mastered .packcard__mark { background: linear-gradient(150deg, rgba(250,222,140,0.22) 0%, rgba(250,222,140,0.05) 100%);
  box-shadow: inset 0 1px 1px rgba(255,248,214,0.45), inset 0 -4px 9px rgba(0,0,0,0.2); }

/* Sealed: a tier above gold — holographic rim, violet-led (out of the review queue for good) */
.packcard--sealed { border: 1px solid transparent;
  background:
    linear-gradient(125deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 36%) padding-box,
    radial-gradient(140% 110% at 12% -16%, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0) 60%) padding-box,
    linear-gradient(158deg, rgba(42,30,84,0.97) 0%, rgba(20,14,46,0.98) 100%) padding-box,
    linear-gradient(135deg, #7C3AED 0%, #F5C451 26%, #22C55E 48%, #3B82F6 72%, #7C3AED 100%) border-box;
  box-shadow: 0 12px 34px rgba(0,0,0,0.46), 0 0 24px rgba(139,92,246,0.26), inset 0 1px 0 rgba(255,255,255,0.3); }
.packcard--sealed .packcard__edge { background: none; }
.packcard--sealed .packcard__name { color: #F1ECFF; }
.packcard--sealed .packcard__sub { color: rgba(196,181,253,0.72); }
.packcard--sealed .packcard__mark-num { background: linear-gradient(160deg, #F3EEFF 0%, #C4B5FD 45%, #F5C451 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }

.packcard--mastered::after, .packcard--sealed::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(102deg, transparent 40%, rgba(255,250,224,0.12) 46%, rgba(255,255,255,0.46) 50%, rgba(255,250,224,0.12) 54%, transparent 60%);
  transform: translateX(130%) skewX(-16deg); opacity: 0; transition: transform 1.1s var(--ease-out-expo), opacity 1.1s var(--ease-out-expo); }
.packcard--mastered:hover::after, .packcard--sealed:hover::after { transform: translateX(-130%) skewX(-16deg); opacity: 1; transition: none; }

.packcard__heard { position: absolute; left: 3px; right: 0; bottom: 0; height: 2px; background: var(--bg-surface); }
.packcard__heard-fill { display: block; height: 100%; background: #f97316; }

/* ── Flat (filtered) view ─────────────────────────────────────────────────── */
.homepage__list { display: grid; grid-template-columns: 1fr; gap: var(--spacing-sm); padding: 0 var(--spacing-md) var(--spacing-md); }
.homepage__more { justify-self: center; margin-top: var(--spacing-sm); height: 36px; padding: 0 var(--spacing-lg);
  border-radius: var(--radius-full); font-family: var(--font-heading); font-size: 13px; font-weight: 600;
  color: var(--text-secondary); background: var(--bg-surface); border: 1px solid var(--border); cursor: pointer; }
.homepage__empty { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-md); text-align: center;
  color: var(--text-muted); font-size: 14px; padding: var(--spacing-2xl) 0; }
.homepage__empty-cta { height: 36px; padding: 0 var(--spacing-lg); border-radius: var(--radius-full);
  font-family: var(--font-heading); font-size: 13px; font-weight: 600; background: var(--accent); color: #fff; border: none; cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  .packcard--started .packcard__edge { animation: none; }
  .packcard--mastered::after { display: none; }
}
`

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. SAMPLE DATA  (shape = the real src/data/packages-index.json + progress)
 * ─────────────────────────────────────────────────────────────────────────── */

interface PackMeta {
  id: string
  name: string
  volume: string        // "Tom I".."Tom VI" — contiguous in route order
  level: 1 | 2 | 3 | 4  // CEFR-ish difficulty tier (NOT the same as volume order)
  category: string
  wordCount: number
  chapter: string
}

/** Per-pack progress. relation drives the fading/sealed decorations. */
interface Progress {
  known: number
  status: 'new' | 'started' | 'completed' | 'mastered'
  heardPct?: number
  relation?: 'fading' | 'sealed'
}

const LEVEL_COLORS: Record<number, string> = { 1: '#eab308', 2: '#f97316', 3: '#22c55e', 4: '#3b82f6' }

const STATUS_GLYPH: Record<string, { glyph: string; aria: string }> = {
  started:   { glyph: '◐', aria: 'W toku' },
  completed: { glyph: '✓', aria: 'Odsłuchana' },
  mastered:  { glyph: '★', aria: 'Opanowana' },
}

// A short vertical slice of the 864-pack route: three volumes, a spread of
// levels/categories, and one card of every state.
const PACKS: PackMeta[] = [
  { id: 't1-p001', name: 'Czasowniki 1',    volume: 'Tom I',   level: 1, category: 'Czasowniki',   wordCount: 10, chapter: 'Rozdział I' },
  { id: 't1-p002', name: 'Miasto',          volume: 'Tom I',   level: 1, category: 'Rzeczowniki',  wordCount: 10, chapter: 'Rozdział I' },
  { id: 't1-p003', name: 'Dzięki, to miłe', volume: 'Tom I',   level: 1, category: 'Przymiotniki', wordCount: 10, chapter: 'Rozdział I' },
  { id: 't1-p004', name: 'Napoje',          volume: 'Tom I',   level: 1, category: 'Rzeczowniki',  wordCount: 10, chapter: 'Rozdział I' },
  { id: 't1-p005', name: 'Ruch i bezruch',  volume: 'Tom I',   level: 1, category: 'Czasowniki',   wordCount: 10, chapter: 'Rozdział II' },
  { id: 't1-p006', name: 'Liczby do 20',    volume: 'Tom I',   level: 1, category: 'Liczby',       wordCount: 10, chapter: 'Rozdział II' },

  { id: 't2-p034', name: 'Rozmowa o pracy', volume: 'Tom II',  level: 2, category: 'Rzeczowniki',  wordCount: 12, chapter: 'Rozdział V' },
  { id: 't2-p035', name: 'Plany na weekend',volume: 'Tom II',  level: 2, category: 'Czasowniki',   wordCount: 12, chapter: 'Rozdział V' },
  { id: 't2-p036', name: 'Slang 4',         volume: 'Tom II',  level: 1, category: 'Slang',        wordCount: 10, chapter: 'Rozdział V' },
  { id: 't2-p037', name: 'Emocje',          volume: 'Tom II',  level: 2, category: 'Przymiotniki', wordCount: 12, chapter: 'Rozdział VI' },
  { id: 't2-p038', name: 'Phrasal verbs I', volume: 'Tom II',  level: 3, category: 'Phrasale',     wordCount: 14, chapter: 'Rozdział VI' },

  { id: 't3-p112', name: 'Opowiadanie historii', volume: 'Tom III', level: 3, category: 'Czasowniki', wordCount: 14, chapter: 'Rozdział IX' },
  { id: 't3-p113', name: 'Negocjacje',      volume: 'Tom III', level: 4, category: 'Rzeczowniki',  wordCount: 16, chapter: 'Rozdział IX' },
  { id: 't3-p114', name: 'Idiomy biznesowe',volume: 'Tom III', level: 4, category: 'Phrasale',     wordCount: 16, chapter: 'Rozdział X' },
]

const PROGRESS: Record<string, Progress> = {
  't1-p001': { known: 10, status: 'mastered' },
  't1-p002': { known: 10, status: 'mastered', relation: 'sealed' },
  't1-p003': { known: 10, status: 'completed', relation: 'fading', heardPct: 100 },
  't1-p004': { known: 10, status: 'mastered' },
  't1-p005': { known: 6,  status: 'started', heardPct: 100 },
  't1-p006': { known: 10, status: 'mastered' },
  't2-p034': { known: 4,  status: 'started', heardPct: 60 },   // ← frontier
  't2-p035': { known: 0,  status: 'completed', heardPct: 100 },
  't2-p036': { known: 0,  status: 'new' },
  't2-p037': { known: 0,  status: 'new' },
  't2-p038': { known: 0,  status: 'new' },
  't3-p112': { known: 0,  status: 'new' },
  't3-p113': { known: 0,  status: 'new' },
  't3-p114': { known: 0,  status: 'new' },
}

const FRONTIER_ID = 't2-p034'

// Milestone bands, keyed by the pack they appear *before*.
const MILESTONES: Record<string, { kind: 'tick' | 'station'; words: number; name?: string; promise?: string; date?: string }> = {
  't1-p001': { kind: 'station', words: 0,    name: 'Start', promise: 'Zaczynasz trasę.' },
  't2-p034': { kind: 'station', words: 1000, name: 'Survival English', promise: 'Dogadasz się w podróży.', date: '4 mar 2026' },
  't2-p037': { kind: 'tick',    words: 1500 },
  't3-p112': { kind: 'station', words: 3000, name: 'Everyday English', promise: 'Powiesz, co myślisz, na spotkaniu.' },
}

const KNOWN_WORDS = 1120  // total known across the whole route — decides passed vs ahead on milestones

const VOLUMES = ['Tom I', 'Tom II', 'Tom III'] as const

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. COMPONENTS
 * ─────────────────────────────────────────────────────────────────────────── */

function PackCard({ pack, locked }: { pack: PackMeta; locked: boolean }) {
  const p = PROGRESS[pack.id] ?? { known: 0, status: 'new' as const }
  const num = parseInt(pack.id.match(/p0*(\d+)$/)?.[1] ?? '0', 10)
  const levelColor = LEVEL_COLORS[pack.level]
  const knownPct = Math.round((p.known / pack.wordCount) * 100)
  const isMastered = p.status === 'mastered' && p.known >= pack.wordCount
  const glyph = STATUS_GLYPH[p.status]
  const isFrontier = pack.id === FRONTIER_ID
  const fading = p.relation === 'fading'
  const sealed = p.relation === 'sealed'
  const words = SAMPLE_WORDS[pack.id] ?? [pack.category]

  const cls = [
    'packcard',
    p.status === 'started' ? 'packcard--started' : '',
    p.status === 'completed' ? 'packcard--completed' : '',
    isMastered ? 'packcard--mastered' : '',
    isFrontier ? 'packcard--frontier' : '',
    fading ? 'packcard--fading' : '',
    sealed ? 'packcard--sealed' : '',
  ].filter(Boolean).join(' ')

  return (
    <a className={cls} style={{ ['--lvl' as string]: levelColor } as CSSProperties} href="#">
      <span className="packcard__edge" aria-hidden="true" />

      <span
        className="packcard__mark"
        style={{
          ['--known-pct' as string]: isMastered ? 100 : knownPct,
          ['--ring' as string]: isMastered ? '#f2b619' : '#10B981',
        } as CSSProperties}
      >
        <span className={`packcard__mark-num${num >= 100 ? ' is-wide' : ''}`}>{num}</span>
      </span>

      <span className="packcard__body">
        <span className="packcard__name">{pack.name}</span>
        {locked ? (
          <span className="packcard__sub packcard__sub--locked">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <em>{words.join(' · ')}</em>
          </span>
        ) : (
          <span className="packcard__sub">{words.join(' · ')}</span>
        )}
      </span>

      <span className="packcard__tail">
        {isFrontier && <span className="packcard__go">Dalej →</span>}
        {sealed && <span className="packcard__seal">◆ Na stałe</span>}
        <span className="packcard__count"><b>{p.known}</b>/{pack.wordCount}</span>
        <span className="packcard__state">
          {fading && <span className="packcard__fade-dot" title="Wraca do powtórki" aria-hidden="true" />}
          {glyph && (
            <span className={`packcard__glyph packcard__glyph--${p.status}`} title={glyph.aria} aria-hidden="true">
              {glyph.glyph}
            </span>
          )}
        </span>
      </span>

      {p.heardPct && p.heardPct > 0 && !isMastered && (
        <span className="packcard__heard" aria-hidden="true">
          <span className="packcard__heard-fill" style={{ width: `${p.heardPct}%` }} />
        </span>
      )}
    </a>
  )
}

const SAMPLE_WORDS: Record<string, string[]> = {
  't2-p036': ['Nie mam', 'Za starych czasów', 'Pewniaczek', 'Kumasz?', 'Muszę spadać'],
  't2-p034': ['awans', 'termin', 'spotkanie', 'projekt', 'zespół'],
  't1-p001': ['być', 'mieć', 'iść', 'robić', 'chcieć'],
}

function MilestoneBand({ id }: { id: string }) {
  const m = MILESTONES[id]
  if (!m) return null
  const passed = KNOWN_WORDS >= m.words
  if (m.kind === 'tick') {
    return (
      <div className={`mstone-tick${passed ? ' is-passed' : ''}`} aria-hidden="true">
        <span className="mstone-tick__label">{m.words.toLocaleString('pl-PL')}{passed && ' ✓'}</span>
      </div>
    )
  }
  return (
    <div className={`mstone${passed ? ' is-passed' : ''}`} style={{ ['--station' as string]: '#8B5CF6' } as CSSProperties}>
      <div className="mstone__rule" aria-hidden="true" />
      <div className="mstone__body">
        <p className="mstone__words">{m.words.toLocaleString('pl-PL')} <span>słów</span></p>
        <h3 className="mstone__name">{m.name}</h3>
        {m.promise && <span className="mstone__date">{m.promise}{m.date ? ` · ${m.date}` : ''}</span>}
      </div>
    </div>
  )
}

function VolumeSection({
  volume, packs, collapsed, onToggle, locked,
}: {
  volume: string; packs: PackMeta[]; collapsed: boolean; onToggle: () => void; locked: boolean
}) {
  const short = volume.replace('Tom ', '')
  const done = packs.filter(p => (PROGRESS[p.id]?.status === 'mastered')).length
  const pct = Math.round((done / packs.length) * 100)
  const allDone = done === packs.length
  const nums = packs.map(p => parseInt(p.id.match(/p0*(\d+)$/)?.[1] ?? '0', 10))
  const levels = [...new Set(packs.map(p => p.level))].sort()
  const band = LEVEL_COLORS[levels[0]] ?? 'var(--text-muted)'

  return (
    <section className={`volsec${allDone ? ' is-done' : ''}`} style={{ ['--band' as string]: band } as CSSProperties}>
      <h2 className="volsec__head">
        <button type="button" className="volsec__toggle" aria-expanded={!collapsed} onClick={onToggle}>
          <span className="volsec__titles">
            <span className="volsec__label">Tom {short}</span>
            <span className="volsec__meta">
              <span className="volsec__range">#{nums[0]}–#{nums[nums.length - 1]}</span>
              <span className="volsec__done">{allDone ? 'ukończony' : `${done}/${packs.length} ukończonych`}</span>
              <span className="volsec__levels">{levels.map(l => `L${l}`).join('·')}</span>
            </span>
            <span className="volsec__meter"><span className="volsec__meter-fill" style={{ width: `${pct}%` }} /></span>
          </span>
          <span className="volsec__pct">{allDone ? '✓' : `${pct}%`}</span>
          <svg className={`volsec__chevron ${collapsed ? 'is-collapsed' : ''}`} width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </h2>

      {!collapsed && (
        <div className="volsec__body">
          <div className="volsec__cards">
            {packs.map(p => (
              <div key={p.id}>
                <MilestoneBand id={p.id} />
                <PackCard pack={p} locked={locked} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function FilterBar({
  active, onOpen, onClear, count, total, currentVolume,
}: {
  active: boolean; onOpen: (k: string) => void; onClear: () => void
  count: number; total: number; currentVolume: string | null
}) {
  return (
    <div className="homepage__bar">
      <div className="pfbar">
        <div className="pfbar__row">
          <button className="pfbar__btn pfbar__btn--icon" onClick={() => onOpen('search')} aria-label="Szukaj">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
          </button>
          <button className="pfbar__btn" onClick={() => onOpen('level')}>Poziom <span className="pfbar__caret">▾</span></button>
          <button className="pfbar__btn" onClick={() => onOpen('category')}>Kategoria <span className="pfbar__caret">▾</span></button>
          <button className={`pfbar__btn${active ? ' is-active' : ''}`} onClick={() => onOpen('status')}>
            {active ? 'Opanowane' : 'Status'} <span className="pfbar__caret">▾</span>
          </button>
        </div>
        <div className="pfbar__meta">
          <span className="pfbar__count">
            {active ? `${count.toLocaleString('pl-PL')} z ${total.toLocaleString('pl-PL')} pakietów` : `${total.toLocaleString('pl-PL')} pakietów`}
          </span>
          {!active && currentVolume && <span className="pfbar__here">{currentVolume}</span>}
          {active && <button className="pfbar__clear" onClick={onClear}>Wyczyść filtry</button>}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. THE SCREEN
 * ─────────────────────────────────────────────────────────────────────────── */

export default function PakietyMock() {
  // Flip to see the "flat filtered grid" view; the real trigger is any active filter.
  const [filtered, setFiltered] = useState(false)
  // Everything collapsed except the volume the frontier lives in.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['Tom I', 'Tom III']))
  // Set to false to preview the paying-user view (words instead of a blurred sample).
  const locked = true

  const byVolume = useMemo(
    () => VOLUMES.map(v => ({ volume: v, packs: PACKS.filter(p => p.volume === v) })),
    [],
  )
  const flat = useMemo(() => PACKS.filter(p => p.level === 1), []) // stand-in for "Poziom 1" filter

  const toggle = (v: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })

  return (
    <>
      <style>{STYLE}</style>
      <div className="pakiety">
        <FilterBar
          active={filtered}
          onOpen={k => { if (k !== 'search') setFiltered(true) }}
          onClear={() => setFiltered(false)}
          count={flat.length}
          total={864}
          currentVolume="Tom II"
        />

        {!filtered && (
          <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
            <button className="frontierbar" onClick={() => {}}>
              <span className="frontierbar__eyebrow">Jesteś tu</span>
              <span className="frontierbar__pack">
                <span className="frontierbar__num">#34</span>
                <span className="frontierbar__name">Rozmowa o pracy</span>
              </span>
              <span className="frontierbar__go" aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {filtered ? (
          <div className="homepage__list">
            {flat.map(p => <PackCard key={p.id} pack={p} locked={locked} />)}
            <button className="homepage__more" onClick={() => setFiltered(false)}>Pokaż więcej (95)</button>
          </div>
        ) : (
          <div className="homepage__volumes">
            {byVolume.map(({ volume, packs }) => (
              <VolumeSection
                key={volume}
                volume={volume}
                packs={packs}
                collapsed={collapsed.has(volume)}
                onToggle={() => toggle(volume)}
                locked={locked}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
