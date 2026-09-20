import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, useDragControls, useReducedMotion, type PanInfo, type Variants } from 'framer-motion'
import { EASE_OUT_EXPO } from '../today/motion'

/**
 * ── The sheet ───────────────────────────────────────────────────────────────
 * One bottom sheet for the whole app: a native <dialog> (focus trap, top layer,
 * Escape for free) with the motion the goal picker already had.
 *
 * Every other sheet used to be `animation: slideUp 280ms` and nothing else: it
 * arrived on a linear-ish curve, it could not be flicked away, and on close it
 * simply stopped existing — the panel and its blurred scrim vanished in the
 * same frame the button was released. Opening one felt like a page swap;
 * opening the goal picker felt like an object moving. This is that object:
 *
 *   · it rises on a spring and settles, rather than easing to a stop;
 *   · the scrim fades in behind it and, crucially, fades back out;
 *   · the panel leaves on a short tween (a spring on the way out spends its
 *     last frames creeping the final pixels off-screen, which reads as a stall);
 *   · the grabber is a real handle — drag it down, or flick, to dismiss;
 *   · the content cascades in behind the panel instead of arriving with it.
 *
 * That last one is what makes the goal picker read as "efektownie": children
 * marked `variants={sheetRise}` inherit the panel's stagger, so the title, the
 * options and the button land one after another, a beat after the sheet does.
 *
 * Drag starts from the grabber only (`dragListener={false}`), never from the
 * body — the panel is also the scroll container, and a sheet that dismisses
 * itself when you try to scroll it is worse than one that cannot be dragged.
 */

export interface SheetHandle {
  /** Play the exit, then close the dialog (which fires `onClose`). */
  close: () => void
}

interface Props {
  /** Fired once the dialog has actually closed — unmount the sheet here. */
  onClose: () => void
  /** Class for the panel, alongside `.u-sheet__panel` (padding, layout, type). */
  className?: string
  /** Class for the <dialog> itself, alongside `.u-sheet`. */
  dialogClassName?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  /**
   * Backdrop click, Escape and drag-to-dismiss. Off while a sheet is committing
   * something irreversible, so a stray tap can't walk out mid-write.
   */
  dismissible?: boolean
  /** The drag handle. Off for centred confirm dialogs, which aren't draggable. */
  grabber?: boolean
  /**
   * Centre the panel on every width instead of docking it to the bottom edge
   * on a phone. For the few dialogs that are a CARD rather than a sheet — a
   * welcome, a confirmation — where rising from the bottom would read as
   * "here is more of the page" instead of "stop and answer this".
   */
  centered?: boolean
  children: ReactNode
}

const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 } as const
/** iOS's sheet curve — out fast, no creep at the end. */
const SHEET_LEAVE = { duration: 0.26, ease: [0.32, 0.72, 0, 1] } as const
const STAGGER = { delayChildren: 0.08, staggerChildren: 0.045 }

const DISMISS_OFFSET = 90
const DISMISS_VELOCITY = 600

/** Rise for anything inside a sheet: inherits the panel's stagger by name. */
export const sheetRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT_EXPO } },
}

/** `sheetRise` with the travel taken out, for prefers-reduced-motion. */
export const sheetRiseReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2 } },
}

/** Same rise, but also cascades its own `sheetRise` children — a list of rows. */
export const sheetGroup: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE_OUT_EXPO, staggerChildren: 0.05 },
  },
}

export const sheetGroupReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2, staggerChildren: 0.02 } },
}

/**
 * Everything a sheet's content needs to join the choreography: the two variant
 * sets already switched for reduced motion, and the press feedback its buttons
 * share. Saves every sheet re-deriving the same four lines.
 */
export function useSheetMotion() {
  const reduced = useReducedMotion()
  return {
    reduced,
    rise: reduced ? sheetRiseReduced : sheetRise,
    group: reduced ? sheetGroupReduced : sheetGroup,
    tap: reduced ? undefined : { scale: 0.97 },
  }
}

/**
 * On a phone the sheet rises from the bottom edge; from 640px it is a centred
 * card, which should settle into place rather than travel a whole screen.
 */
function isDocked(): boolean {
  return !window.matchMedia('(min-width: 640px)').matches
}

export const Sheet = forwardRef<SheetHandle, Props>(function Sheet(
  {
    onClose,
    className = '',
    dialogClassName = '',
    dismissible = true,
    grabber = true,
    centered = false,
    children,
    ...aria
  },
  handle,
) {
  const ref = useRef<HTMLDialogElement>(null)
  const reduced = useReducedMotion()
  const dragControls = useDragControls()
  const [closing, setClosing] = useState(false)
  const [wide] = useState(() => !isDocked())
  const docked = !centered && !wide

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  function requestClose() {
    if (closing) return
    // Nothing to play out under reduced motion — close on the spot.
    if (reduced) { ref.current?.close(); return }
    setClosing(true)
  }

  useImperativeHandle(handle, () => ({ close: requestClose }))

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) requestClose()
  }

  const variants: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        shown: { opacity: 1, transition: { staggerChildren: 0.02 } },
        closed: { opacity: 0, transition: { duration: 0.14 } },
      }
    : docked
      ? {
          hidden: { y: '100%' },
          shown: { y: 0, transition: { ...SHEET_SPRING, ...STAGGER } },
          closed: { y: '100%', transition: SHEET_LEAVE },
        }
      : {
          hidden: { opacity: 0, y: 24, scale: 0.97 },
          shown: { opacity: 1, y: 0, scale: 1, transition: { ...SHEET_SPRING, ...STAGGER } },
          closed: { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
        }

  return (
    <dialog
      ref={ref}
      className={`u-sheet${centered ? ' u-sheet--centered' : ''}${closing ? ' u-sheet--closing' : ''}${dialogClassName ? ` ${dialogClassName}` : ''}`}
      onClose={onClose}
      // Escape arrives as 'cancel'; let it play the exit like every other close.
      onCancel={e => { e.preventDefault(); if (dismissible) requestClose() }}
      onClick={e => { if (e.target === ref.current && dismissible) requestClose() }}
      {...aria}
    >
      <motion.div
        className={`u-sheet__panel${className ? ` ${className}` : ''}`}
        variants={variants}
        initial="hidden"
        animate={closing ? 'closed' : 'shown'}
        onAnimationComplete={def => { if (def === 'closed') ref.current?.close() }}
        drag={reduced || !dismissible ? false : 'y'}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        {grabber && (
          <span
            className="u-sheet__grip"
            aria-hidden="true"
            onPointerDown={e => { if (dismissible && !reduced) dragControls.start(e) }}
          >
            <span className="u-sheet__grabber" />
          </span>
        )}
        {children}
      </motion.div>
    </dialog>
  )
})
