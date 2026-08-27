import { ToastData } from '../components/shared/Toast'

/**
 * A one-at-a-time toast channel.
 *
 * Milestones fire from inside the study clock, which has no component of its
 * own, so the message needs somewhere to go that isn't tied to whichever page
 * happens to be mounted. ToastHost sits in App and listens here.
 */

let listener: ((t: ToastData) => void) | null = null
let seq = 0

export function setToastListener(fn: ((t: ToastData) => void) | null): void {
  listener = fn
}

export function showToast(text: string, opts: { icon?: string; celebrate?: boolean } = {}): void {
  listener?.({ id: ++seq, text, icon: opts.icon, celebrate: opts.celebrate })
}
