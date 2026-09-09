import { useCallback, useRef } from 'react'

/**
 * Warms a lazy route chunk the moment the user signals intent (pointer enter,
 * focus, or touch start) instead of paying the import cost after the click.
 * The loader runs at most once. Returns props to spread onto the trigger.
 */
export function usePrefetchOnHover(load: () => Promise<unknown>) {
  const done = useRef(false)
  const fire = useCallback(() => {
    if (done.current) return
    done.current = true
    void load()
  }, [load])

  return {
    onMouseEnter: fire,
    onFocus: fire,
    onTouchStart: fire,
  }
}

/** Shared loader for the pack preview route (mirrors the lazy() call in App.tsx). */
export const loadPackPreview = () => import('../pages/PackPreviewPage')
