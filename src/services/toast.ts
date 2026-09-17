import type { Achievement } from '../data/achievements'

/**
 * The app's notification channel.
 *
 * Milestones fire from inside the study clock and badges from the app-wide
 * AchievementWatcher — neither has a component of its own, so messages need
 * somewhere to go that isn't tied to whichever page happens to be mounted.
 * ToastHost sits in App, listens here, and shows them one at a time in order.
 */

interface ToastBase {
  id: number
}

/** A short line of text — a milestone, a confirmation, an error. */
export interface NoteToast extends ToastBase {
  kind: 'note'
  text: string
  icon?: string
  /** A goal-level moment: gold rim, a spark burst, a chime. Use sparingly. */
  celebrate?: boolean
}

/** A badge was just earned. */
export interface AchievementToast extends ToastBase {
  kind: 'achievement'
  achievement: Achievement
  /** Other badges earned in the same moment, folded into this one notice. */
  more: number
}

export type ToastData = NoteToast | AchievementToast

let listener: ((t: ToastData) => void) | null = null
let seq = 0

export function setToastListener(fn: ((t: ToastData) => void) | null): void {
  listener = fn
}

export function showToast(text: string, opts: { icon?: string; celebrate?: boolean } = {}): void {
  listener?.({ id: ++seq, kind: 'note', text, icon: opts.icon, celebrate: opts.celebrate })
}

export function showAchievementToast(achievement: Achievement, more = 0): void {
  listener?.({ id: ++seq, kind: 'achievement', achievement, more })
}
