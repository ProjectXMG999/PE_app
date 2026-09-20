import { TIER_LABEL, unitLabel } from '../data/achievements'
import { ROUTE_TOTAL } from '../data/levels'
import { AchievementState } from './achievements'
import { renderShareCard, shareImage, type ShareCardSpec, type ShareResult } from './shareCard'

/**
 * A badge, as a share card.
 *
 * The milestone half of the "cards worth showing someone" idea. Cheaper than a
 * year in review and, unlike it, useful all year: the route's stations ARE
 * badges (`level-1`…`level-4` share the route's thresholds exactly), so every
 * milestone already arrives as an unlock with a date on it.
 *
 * Only unlocked badges can be shared — a card announcing something you haven't
 * done yet is the opposite of the point.
 */

/** Tier colours, as the card's bloom. Matched to tiers.css, not invented. */
const TIER_ACCENT: Record<string, [number, number, number]> = {
  bronze: [193, 126, 74],
  silver: [178, 190, 205],
  gold: [232, 179, 64],
  legend: [167, 120, 255],
}

export function badgeCardSpec(
  state: AchievementState,
  knownTotal: number,
  next: { words: number; name: string } | null
): ShareCardSpec {
  const a = state.achievement
  return {
    // The icon rides in the kicker rather than in a stat tile: an emoji set at
    // 76px Montserrat falls back to the system emoji face and sits visibly off
    // its box, and the tile's label could only repeat the title below it.
    kicker: `${a.icon}  ${(TIER_LABEL[a.tier] ?? a.tier).toUpperCase()}`,
    // The badge's own threshold, not the raw metric: the card is about the
    // thing that was crossed, and a live counter would read as a stat sheet.
    headline: a.threshold.toLocaleString('pl-PL'),
    subline: `${unitLabel(a.unit, a.threshold)} — ${a.title}`,
    // No stat tiles. A badge card has one fact — the thing that was crossed —
    // and the template closes the gap when `stats` is absent.
    route: {
      knownTotal,
      total: ROUTE_TOTAL,
      toNext: next?.words ?? null,
      nextName: next?.name ?? null,
    },
    accent: TIER_ACCENT[a.tier] ?? [139, 92, 246],
  }
}

export async function shareBadge(
  state: AchievementState,
  knownTotal: number,
  next: { words: number; name: string } | null
): Promise<ShareResult> {
  if (!state.unlocked) return 'failed'
  const blob = await renderShareCard(badgeCardSpec(state, knownTotal, next))
  return shareImage(blob, `progress-${state.achievement.id}.png`, `${state.achievement.title} — Progress`)
}
