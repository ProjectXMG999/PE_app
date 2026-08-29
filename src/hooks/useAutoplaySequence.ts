import { useCallback, useEffect, useRef, useState } from 'react'
import { AutoplayMode } from '../types/progress'
import { Word } from '../types/vocabulary'
import { AutoplayLine, planSequence } from '../config/autoplayModes'

type PlayFn = () => Promise<'ok' | 'timeout' | 'error'>

interface Params {
  word: Word | null
  mode: AutoplayMode
  /** studyMode === 'autoplay' && studyWords.length > 0 && !showCompletion */
  enabled: boolean
  isPaused: boolean
  isLastCard: boolean
  /** Card identity — a change tears down the running sequence and starts the next. */
  cardIndex: number
  play: { word: PlayFn; sentence: PlayFn; wordPl: PlayFn; sentencePl: PlayFn }
  stop: (opts?: { hard?: boolean }) => void
  onCardDone: () => void
  onLastDone: () => void
}

interface SpeakCountdown {
  ms: number
  key: number
}

export interface AutoplaySequenceState {
  playStep: AutoplayLine | null
  audioLoading: boolean
  audioError: 'timeout' | 'error' | null
  speakCountdown: SpeakCountdown | null
  /** Card tap — end the current gap early, or cut a clip short, to jump a step. */
  skipStep: () => void
  /** Replay the current word from step 0 (mode switch, "Powtórz" button). */
  restart: () => void
}

const START_DELAY_MS = 800
const HANDOFF_DELAY_MS = 600
const AUDIO_ERROR_HOLD_MS = 1500

/**
 * Runs the declarative autoplay timeline (see config/autoplayModes.ts) for one
 * word at a time: play a clip, hold silence, advance; abortable mid-flight;
 * resumable from the step it was paused on.
 *
 * This is a faithful extraction of the ~100-line inline `runSequence` effect
 * that lived in FlashcardPage — same timings, same abort/cleanup machinery. The
 * one deliberate change: when resuming, steps *before* the paused step are
 * skipped whole (no dead gap), instead of skipping the play but still waiting.
 */
export function useAutoplaySequence({
  word, mode, enabled, isPaused, isLastCard, cardIndex,
  play, stop, onCardDone, onLastDone,
}: Params): AutoplaySequenceState {
  const [playStep, setPlayStep] = useState<AutoplayLine | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<'timeout' | 'error' | null>(null)
  const [speakCountdown, setSpeakCountdown] = useState<SpeakCountdown | null>(null)
  const [restartKey, setRestartKey] = useState(0)

  // Live mirrors so the effect body doesn't need these as deps
  const playStepRef = useRef<AutoplayLine | null>(null)
  playStepRef.current = playStep
  const playRef = useRef(play); playRef.current = play
  const stopRef = useRef(stop); stopRef.current = stop
  const onCardDoneRef = useRef(onCardDone); onCardDoneRef.current = onCardDone
  const onLastDoneRef = useRef(onLastDone); onLastDoneRef.current = onLastDone
  const wordRef = useRef(word); wordRef.current = word
  const isLastCardRef = useRef(isLastCard); isLastCardRef.current = isLastCard

  // Sequence-owned machinery
  const abortRef = useRef<AbortController | null>(null)
  const skipStepRef = useRef<(() => void) | null>(null)
  const resumeFromRef = useRef<AutoplayLine | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownKeyRef = useRef(0)
  const prevCardIndexRef = useRef(cardIndex)

  const skipStep = useCallback(() => {
    if (skipStepRef.current) {
      skipStepRef.current()
    } else {
      // Mid-clip (no gap armed) — no-op guard so rapid taps don't re-stop, then
      // cut the audio; its resolve unblocks the sequence into the next step.
      skipStepRef.current = () => {}
      stopRef.current()
    }
  }, [])

  const restart = useCallback(() => {
    resumeFromRef.current = null
    setPlayStep(null)
    setRestartKey(k => k + 1)
  }, [])

  useEffect(() => {
    // A fresh card invalidates any paused-step snapshot from the previous one.
    if (prevCardIndexRef.current !== cardIndex) {
      prevCardIndexRef.current = cardIndex
      resumeFromRef.current = null
    }

    if (!enabled || !word) return
    if (isPaused) {
      // Remember where we stopped so resume replays from here, and bail.
      resumeFromRef.current = playStepRef.current
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const isCancelled = () => controller.signal.aborted
    let pauseTimer: ReturnType<typeof setTimeout> | null = null

    const hold = (ms: number, opts?: { countdown?: boolean }) => new Promise<void>(resolve => {
      if (opts?.countdown) setSpeakCountdown({ ms, key: ++countdownKeyRef.current })
      const end = () => {
        clearTimeout(pauseTimer!)
        pauseTimer = null
        skipStepRef.current = null
        controller.signal.removeEventListener('abort', onAbort)
        if (opts?.countdown) setSpeakCountdown(null)
        resolve()
      }
      const onAbort = () => end()
      controller.signal.addEventListener('abort', onAbort)
      pauseTimer = setTimeout(end, ms)
      skipStepRef.current = () => end()
    })

    const playWithStatus = async (fn: PlayFn) => {
      if (isCancelled()) return
      setAudioLoading(true)
      setAudioError(null)
      const result = await fn()
      setAudioLoading(false)
      if (isCancelled()) return
      if (result !== 'ok') {
        setAudioError(result)
        await hold(AUDIO_ERROR_HOLD_MS)
        setAudioError(null)
      }
    }

    const clipFn = (clip: 'wordPl' | 'word' | 'sentencePl' | 'sentenceEn'): PlayFn => {
      const p = playRef.current
      return clip === 'wordPl' ? p.wordPl
        : clip === 'word' ? p.word
        : clip === 'sentencePl' ? p.sentencePl
        : p.sentence
    }

    const runSequence = async () => {
      if (isCancelled()) return

      const resumeFrom = resumeFromRef.current
      resumeFromRef.current = null

      const steps = planSequence(mode, word)
      for (const step of steps) {
        if (isCancelled()) return
        if (resumeFrom !== null && step.line < resumeFrom) continue

        setPlayStep(step.line)
        const plays = step.repeat ?? 1
        for (let i = 0; i < plays; i++) {
          await playWithStatus(clipFn(step.clip))
          if (isCancelled()) return
          if (i < plays - 1) {
            await hold(step.repeatGapMs ?? 0)
            if (isCancelled()) return
          }
        }
        await hold(step.gapMs, { countdown: step.speak })
        if (isCancelled()) return
      }

      setPlayStep(null)
      const done = isLastCardRef.current
        ? () => onLastDoneRef.current()
        : () => onCardDoneRef.current()
      timerRef.current = setTimeout(done, HANDOFF_DELAY_MS)
    }

    timerRef.current = setTimeout(runSequence, START_DELAY_MS)

    return () => {
      controller.abort()
      if (abortRef.current === controller) abortRef.current = null
      skipStepRef.current = null
      if (pauseTimer) clearTimeout(pauseTimer)
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      // Soft stop between cards/steps: a new play() is about to load the next
      // clip. Hard stops (real pause/skip/restart) are done by the caller.
      stopRef.current({ hard: false })
      setAudioLoading(false)
      setAudioError(null)
      setSpeakCountdown(null)
    }
    // word is read via closure at fire time; cardIndex is the identity trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex, restartKey, enabled, isPaused, mode, isLastCard])

  return { playStep, audioLoading, audioError, speakCountdown, skipStep, restart }
}
