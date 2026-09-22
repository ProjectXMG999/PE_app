import { unlockAudioGlobally } from '../audio/audioUnlock'
import { playSessionCurtain } from '../services/sfx'

/**
 * The launch curtain's moving parts — the few that cannot be CSS.
 *
 * The curtain itself lives in index.html, markup and all, emitted there by
 * scripts/generate-brand.mjs. That is not an optimisation: it is the only way
 * the first frame of the app can be the brand rather than a blank rectangle,
 * because nothing in the bundle exists yet when the browser starts painting.
 * Its whole sequence is authored in CSS for the same reason, so the timings
 * hold whether the bundle arrives in 40ms or 400ms and nothing has to be
 * re-synchronised against a clock that started somewhere else.
 *
 * Which leaves three jobs that genuinely need JS, and no others:
 *
 *  1. Releasing `data-splash` when the lift begins, so the page's own
 *     `.pe-arrive` cascade starts INTO the fade instead of playing out unseen
 *     behind an opaque screen. (index.html also releases it on a timer, in case
 *     this module never loads — both are idempotent.)
 *  2. Taking the node out of the document once it has left.
 *  3. The sound. Autoplay policy means a page that has not been touched cannot
 *     make one, and a cold launch is by definition untouched — so the launch
 *     sound is ARMED rather than played: the first touch while the curtain is
 *     still up unlocks audio, sounds the curtain, and skips the rest of the
 *     animation (the same tap-to-skip `SessionOpener` offers). No touch means
 *     a silent launch, which is the honest outcome and costs the user nothing.
 *     The arming window closes with the curtain, so nothing can chime later
 *     from a tap that was meant for something else.
 */

/** Animation names are a contract with the generated CSS — see useCardFlip for
 *  the same pattern. Only the lift is listened for; the rest is decoration.
 *  Two names for one event: tap-to-skip runs a separate, shorter copy, because
 *  re-timing an animation still inside its delay lands it past its own end. */
const LIFT = ['pe-splash-out', 'pe-splash-out-fast']

let ran = false

export function runSplash() {
  if (ran) return
  ran = true

  const el = document.getElementById('pe-splash')
  if (!el) return

  const root = document.documentElement
  // 'off' — this session has already been opened once, and index.html has
  // display:none'd the curtain. No animation will fire, so nothing would ever
  // clean up; drop the node and leave.
  if (root.getAttribute('data-splash') !== 'on') {
    el.remove()
    return
  }

  let lifting = false

  const release = () => {
    lifting = true
    root.removeAttribute('data-splash')
    // Marked here rather than when the curtain went up: the first-ever visit
    // reloads itself when the service worker takes control, and a session
    // marked up front spent its one curtain on the load that got thrown away.
    try { sessionStorage.setItem('pe:splash', '1') } catch { /* private mode */ }
    window.removeEventListener('pointerdown', arm)
    window.removeEventListener('keydown', arm)
  }

  const arm = () => {
    // Already on its way out: a tap now is aimed at the screen underneath, and
    // a curtain sound over a curtain that has gone is just a noise.
    if (lifting) return
    unlockAudioGlobally()
    playSessionCurtain(null)
    el.classList.add('pe-splash--skip')
    release()
  }

  const onStart = (e: AnimationEvent) => {
    if (LIFT.includes(e.animationName)) release()
  }

  const onEnd = (e: AnimationEvent) => {
    if (!LIFT.includes(e.animationName)) return
    release()
    el.removeEventListener('animationstart', onStart)
    el.removeEventListener('animationend', onEnd)
    el.remove()
  }

  el.addEventListener('animationstart', onStart)
  el.addEventListener('animationend', onEnd)
  window.addEventListener('pointerdown', arm, { passive: true })
  window.addEventListener('keydown', arm)
}
