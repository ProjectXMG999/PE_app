/**
 * Named haptic patterns, formalizing the one precedent already in the app
 * (`navigator.vibrate?.(8)` in useCardFlip.ts) into reusable calls.
 */
export function useHaptics() {
  return {
    /** A tiny tick — level picked, primary action pressed. */
    tap: () => navigator.vibrate?.(8),
    /** A double tap — the "day complete" moment. */
    success: () => navigator.vibrate?.([8, 40, 8]),
  }
}
