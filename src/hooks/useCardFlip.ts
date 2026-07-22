import { useCallback, useEffect, useRef, useState } from 'react'

export type CardSide = 'front' | 'back'
export type FlipPhase = 'enter' | 'idle' | 'fold' | 'unfold' | 'advance'

/** Keyframe names from animations.css — the animationend contract. */
const ANIM_ENTER = 'card-enter'
const ANIM_FOLD = 'card-flip-fold'
const ANIM_UNFOLD = 'card-flip-unfold'
const ANIM_ADVANCE = 'card-advance-out'

/** If animationend never arrives (element hidden, etc.) force the phase on. */
const PHASE_SAFETY_MS = 800

/**
 * State machine for the half-flip study card (WordFlash / ActiveSentence).
 * One face is in the DOM at a time; the flip folds the card edge-on,
 * swaps the face at the midpoint, then unfolds. Phases advance on
 * animationend, so reduced-motion (0.01ms animations) flips instantly
 * instead of waiting out hardcoded setTimeout chains.
 */
export function useCardFlip() {
  const [side, setSide] = useState<CardSide>('front')
  const [phase, _setPhase] = useState<FlipPhase>('enter')

  const phaseRef = useRef<FlipPhase>('enter')
  const midpointRef = useRef<(() => void) | null>(null)
  const advanceDoneRef = useRef<(() => void) | null>(null)
  const safetyRef = useRef<number>(0)

  const setPhase = useCallback((p: FlipPhase) => {
    phaseRef.current = p
    _setPhase(p)
  }, [])

  useEffect(() => () => window.clearTimeout(safetyRef.current), [])

  const armSafety = useCallback((handler: () => void) => {
    window.clearTimeout(safetyRef.current)
    safetyRef.current = window.setTimeout(handler, PHASE_SAFETY_MS)
  }, [])

  const atFoldMidpoint = useCallback(() => {
    if (phaseRef.current !== 'fold') return
    setSide(s => (s === 'front' ? 'back' : 'front'))
    navigator.vibrate?.(8)
    midpointRef.current?.()
    midpointRef.current = null
    setPhase('unfold')
  }, [setPhase])

  const atUnfoldEnd = useCallback(() => {
    if (phaseRef.current !== 'unfold') return
    setPhase('idle')
  }, [setPhase])

  const atAdvanceEnd = useCallback(() => {
    if (phaseRef.current !== 'advance') return
    setSide('front')
    // The replacement card (remounted via key) plays the enter animation
    setPhase('enter')
    advanceDoneRef.current?.()
    advanceDoneRef.current = null
  }, [setPhase])

  /** Start a flip; onMidpoint fires exactly when the visible face swaps. */
  const flip = useCallback((onMidpoint?: () => void) => {
    // Allowed from 'enter' too — a quick tap shouldn't wait out the slide-in
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'enter') return
    midpointRef.current = onMidpoint ?? null
    armSafety(atFoldMidpoint)
    setPhase('fold')
  }, [armSafety, atFoldMidpoint, setPhase])

  /** Animate the card out; onDone fires when it has left the stage. */
  const advance = useCallback((onDone: () => void) => {
    if (phaseRef.current === 'advance') return
    advanceDoneRef.current = onDone
    armSafety(atAdvanceEnd)
    setPhase('advance')
  }, [armSafety, atAdvanceEnd, setPhase])

  const resetToFront = useCallback(() => {
    window.clearTimeout(safetyRef.current)
    midpointRef.current = null
    advanceDoneRef.current = null
    setSide('front')
    setPhase('enter')
  }, [setPhase])

  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.animationName === ANIM_ENTER) {
      if (phaseRef.current === 'enter') setPhase('idle')
    } else if (e.animationName === ANIM_FOLD) {
      window.clearTimeout(safetyRef.current)
      atFoldMidpoint()
      armSafety(atUnfoldEnd)
    } else if (e.animationName === ANIM_UNFOLD) {
      window.clearTimeout(safetyRef.current)
      atUnfoldEnd()
    } else if (e.animationName === ANIM_ADVANCE) {
      window.clearTimeout(safetyRef.current)
      atAdvanceEnd()
    }
  }, [armSafety, atFoldMidpoint, atUnfoldEnd, atAdvanceEnd, setPhase])

  /** Modifier suffix for the card element, e.g. `wf__card${cardClass('wf__card')}`. */
  const cardClass = useCallback((base: string) => {
    if (phase === 'enter') return ` ${base}--enter`
    if (phase === 'fold') return ` ${base}--fold`
    if (phase === 'unfold') return ` ${base}--unfold`
    if (phase === 'advance') return ` ${base}--advance`
    return ''
  }, [phase])

  return {
    side,
    phase,
    isBusy: phase !== 'idle',
    isAdvancing: phase === 'advance',
    flip,
    advance,
    resetToFront,
    handleAnimationEnd,
    cardClass,
  }
}
