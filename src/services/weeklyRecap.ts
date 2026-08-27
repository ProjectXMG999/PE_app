import { ProgressSnapshot } from '../hooks/useProgressData'
import { DailyTime } from '../types/progress'
import { AchievementState } from './achievements'
import { studiedMinutes } from '../hooks/useStats'
import { dayKey, shiftDay } from '../utils/day'

/**
 * The week in review.
 *
 * Every figure here is counted from session and daily-time records rather than
 * inferred. In particular "words practised" is not "words learned": mastery is
 * timestamped by `lastSeen`, which a review moves forward, so counting mastered
 * words per week would quietly credit old words to whichever week they were
 * last revisited.
 */

export interface WeeklyRecap {
  /** Day keys, oldest first. */
  from: string
  to: string
  wordsPractised: number
  minutes: number
  sessions: number
  activeDays: number
  goalDays: number
  bestDay: { date: string; count: number } | null
  newBadges: AchievementState[]
  /** Words still to go before the next milestone. */
  toNextStation: number | null
  nextStationName: string | null
  knownTotal: number
}

export function computeWeeklyRecap(
  snapshot: ProgressSnapshot,
  dailyTime: DailyTime[],
  badges: AchievementState[],
  next: { words: number; name: string } | null,
  today = dayKey()
): WeeklyRecap {
  const from = shiftDay(-6, today)

  const week = snapshot.sessions.filter(s => s.date >= from && s.date <= today)
  const weekDaily = dailyTime.filter(d => d.date >= from && d.date <= today)

  const byDate = new Map<string, number>()
  for (const s of week) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.wordsCompleted)

  let bestDay: WeeklyRecap['bestDay'] = null
  for (const [date, count] of byDate) {
    if (bestDay == null || count > bestDay.count) bestDay = { date, count }
  }

  const weekStart = `${from}T00:00:00.000Z`
  const newBadges = badges.filter(b => b.unlocked && b.unlockedAt != null && b.unlockedAt >= weekStart)

  return {
    from,
    to: today,
    wordsPractised: week.reduce((sum, s) => sum + s.wordsCompleted, 0),
    minutes: studiedMinutes(week),
    sessions: week.length,
    activeDays: byDate.size,
    goalDays: weekDaily.filter(d => d.goalMetAt != null).length,
    bestDay,
    newBadges,
    toNextStation: next?.words ?? null,
    nextStationName: next?.name ?? null,
    knownTotal: snapshot.knownTotal,
  }
}

/** True once the week has anything worth reporting. */
export function recapWorthShowing(r: WeeklyRecap): boolean {
  return r.sessions > 0
}

// ── Share image ─────────────────────────────────────────────────────────────

const W = 1080
const H = 1350

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Draws the recap as a share image.
 *
 * Painted directly onto a canvas rather than rasterising the DOM: there's no
 * html-to-canvas dependency in the project, and a share image wants a different
 * composition from the in-app card anyway — bigger numbers, portrait crop,
 * legible as a thumbnail.
 */
export async function renderRecapImage(r: WeeklyRecap): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Background, with the same violet bloom the app uses behind the route marker.
  ctx.fillStyle = '#0D0B1E'
  ctx.fillRect(0, 0, W, H)
  const bloom = ctx.createRadialGradient(W * 0.3, H * 0.28, 0, W * 0.3, H * 0.28, W * 0.75)
  bloom.addColorStop(0, 'rgba(139, 92, 246, 0.34)')
  bloom.addColorStop(1, 'rgba(139, 92, 246, 0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, W, H)

  const pad = 88

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '700 30px Montserrat, sans-serif'
  ctx.letterSpacing = '5px'
  ctx.fillText('MÓJ TYDZIEŃ', pad, 150)
  ctx.letterSpacing = '0px'

  // Headline: the number that means the most.
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 190px Montserrat, sans-serif'
  ctx.fillText(String(r.wordsPractised), pad, 340)

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '400 40px Roboto, sans-serif'
  ctx.fillText('słów przerobionych', pad, 400)

  // Stat grid.
  const stats: [string, string][] = [
    [`${r.minutes}`, 'minut nauki'],
    [`${r.activeDays}/7`, 'dni z treningiem'],
    [`${r.sessions}`, 'sesji'],
    [`${r.goalDays}`, 'dni z celem'],
  ]

  const gx = pad
  const gy = 500
  const cw = (W - pad * 2 - 32) / 2
  const ch = 190

  stats.forEach(([value, label], i) => {
    const x = gx + (i % 2) * (cw + 32)
    const y = gy + Math.floor(i / 2) * (ch + 32)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, x, y, cw, ch, 32)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 76px Montserrat, sans-serif'
    ctx.fillText(value, x + 40, y + 108)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '400 30px Roboto, sans-serif'
    ctx.fillText(label, x + 40, y + 152)
  })

  // Route position.
  const ry = gy + ch * 2 + 96
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 32px Roboto, sans-serif'
  ctx.fillText('Na trasie do 10 000 słów', pad, ry)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 84px Montserrat, sans-serif'
  ctx.fillText(`${r.knownTotal.toLocaleString('pl-PL')} / 10 000`, pad, ry + 96)

  const barY = ry + 140
  const barW = W - pad * 2
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  roundRect(ctx, pad, barY, barW, 16, 8)
  ctx.fill()

  const fillW = Math.max(16, Math.min(1, r.knownTotal / 10000) * barW)
  const grad = ctx.createLinearGradient(pad, 0, pad + barW, 0)
  grad.addColorStop(0, '#eab308')
  grad.addColorStop(0.35, '#f97316')
  grad.addColorStop(0.7, '#22c55e')
  grad.addColorStop(1, '#3b82f6')
  ctx.fillStyle = grad
  roundRect(ctx, pad, barY, fillW, 16, 8)
  ctx.fill()

  if (r.nextStationName && r.toNextStation != null) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '400 32px Roboto, sans-serif'
    ctx.fillText(
      `jeszcze ${r.toNextStation.toLocaleString('pl-PL')} do ${r.nextStationName}`,
      pad,
      barY + 76
    )
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '700 28px Montserrat, sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('PROGRESS', pad, H - 70)
  ctx.letterSpacing = '0px'

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/**
 * Shares the recap image, falling back to a download. The Web Share file API is
 * absent on desktop Chrome and older Safari, so the fallback isn't an edge case.
 */
export async function shareRecap(r: WeeklyRecap): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await renderRecapImage(r)
  if (blob == null) return 'failed'

  const file = new File([blob], `progress-${r.to}.png`, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mój tydzień w Progress' })
      return 'shared'
    } catch (err) {
      // A user dismissing the share sheet is not a failure worth reporting.
      if ((err as Error).name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
