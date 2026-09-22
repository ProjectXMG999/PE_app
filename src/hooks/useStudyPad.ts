import { useEffect } from 'react'
import { startStudyPad, stopStudyPad } from '../audio/studyPad'
import { useAppStore } from '../store/useAppStore'

/**
 * The breathing pad (audio/studyPad.ts) under whatever session is on screen.
 *
 * One hook rather than the same five lines in each mode, because the rules are
 * the same everywhere and they are easy to get subtly wrong: the pad is opt-in
 * ("Muzyka w tle"), it is tuned to the session's level, and it must be torn
 * down on the way out — a drone that outlives its screen is the worst bug this
 * can have, so the teardown lives here where no mode can forget it.
 *
 * It started as Słuchaj's alone, on the theory that the pad was filling the
 * gaps between clips. It isn't: what it fills is the room, and a flashcard run
 * has the same room. Every mode now calls this — the pack modes, Powtórka and
 * Inteligentny — and the toggle in Personalizacja governs all of them.
 *
 * `active` is the session actually running: not the curtain, not the done
 * screen, not a paused player. Those screens have sounds of their own, and the
 * pad would sit under them rather than behind the session.
 */
export function useStudyPad(active: boolean, level: number | null | undefined): void {
  const enabled = useAppStore(s => s.studyPadEnabled)
  const on = enabled && active
  // Normalised here so a level that resolves from undefined to the key the pad
  // is already in — which is what a pack-index lookup does on its second render
  // — doesn't retune the voices for nothing.
  const key = level ?? 1

  useEffect(() => {
    if (on) startStudyPad(key)
    else stopStudyPad()
    return () => stopStudyPad()
  }, [on, key])
}
