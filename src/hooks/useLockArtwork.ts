import { useEffect, useRef, useState } from 'react'
import { LockArtworkSpec, releaseArtwork, renderLockArtwork } from '../services/lockArtwork'

/**
 * Keeps one lock-screen cover current for the word being played.
 *
 * The whole job here is lifetime: every card produces a new blob URL, and a
 * listening session is hundreds of cards, so failing to revoke them would leak
 * a few hundred kB of image data per session into a tab that is deliberately
 * left running with the screen off.
 *
 * Pass `null` to render nothing and release whatever is held (leaving the
 * session, finishing a pack, switching out of Słuchaj).
 */
export function useLockArtwork(spec: LockArtworkSpec | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  // The URL currently handed out, tracked in a ref so the effect can revoke the
  // previous one without listing it as a dependency and re-running itself.
  const heldRef = useRef<string | null>(null)

  const english = spec?.english ?? ''
  const polish = spec?.polish ?? ''
  const packName = spec?.packName ?? ''
  const level = spec?.level ?? 0

  useEffect(() => {
    if (!english) {
      releaseArtwork(heldRef.current)
      heldRef.current = null
      setUrl(null)
      return
    }

    let alive = true
    void renderLockArtwork({ english, polish, packName, level }).then(next => {
      // Cards can advance faster than a toBlob round trip. If this render lost
      // the race, throw away its own URL rather than the one now on screen.
      if (!alive) {
        releaseArtwork(next)
        return
      }
      releaseArtwork(heldRef.current)
      heldRef.current = next
      setUrl(next)
    })

    return () => {
      alive = false
    }
  }, [english, polish, packName, level])

  // Unmount: release whatever is still held. Deliberately separate from the
  // effect above, whose cleanup runs on every card.
  useEffect(() => () => {
    releaseArtwork(heldRef.current)
    heldRef.current = null
  }, [])

  return url
}
