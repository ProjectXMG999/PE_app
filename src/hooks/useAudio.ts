import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

const EN_BASE = 0.60
const PL_BASE = 1.0

// enRate/plRate are multipliers: 1.0 = default speed, 0.5 = half, 1.5 = faster
export function useAudio(packId: string | null, enRate = 1.0, plRate = 1.0) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Resolver for the currently pending play() promise — lets stop() unblock awaits
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  const play = useCallback((url: string, rate = 1.0): Promise<'ok' | 'timeout' | 'error'> => {
    return new Promise((resolve) => {
      // Stop previous audio WITHOUT resolving its promise via resolveCurrentRef —
      // the previous promise was already resolved (sequence moves linearly).
      // We only need to kill the DOM element.
      if (audioRef.current) {
        const prev = audioRef.current
        audioRef.current = null
        console.log('[audio] play() killing prev, paused=', prev.paused, 'time=', prev.currentTime.toFixed(2))
        prev.pause()
        prev.currentTime = 0
        prev.src = ''
        prev.load()
      }

      const audio = new Audio()
      audio.preload = 'auto'
      // playbackRate is set in onloadedmetadata, not here — iOS Safari may reset to 1.0 if set before src
      audioRef.current = audio

      // done() is idempotent — safe to call from multiple paths
      let resolved = false
      const done = (result: 'ok' | 'timeout' | 'error' = 'ok') => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolveCurrentRef.current = null
        if (audioRef.current === audio) audioRef.current = null
        resolve(result)
      }

      // Expose done() so stop() can unblock a pending await playX() immediately
      resolveCurrentRef.current = () => done('ok')

      // Hard ceiling — never hang longer than 10s on a single file
      const timeoutId = setTimeout(() => done('timeout'), 10000)

      // Exactly one audio.play() call — guards against double-fire from
      // oncanplaythrough + onloadeddata both triggering on cached files.
      // Also guards against stale closures: if stop() replaced audioRef before
      // this fires, we bail out so the old element never plays.
      let playStarted = false
      const tryPlay = (evt?: string) => {
        console.log('[audio] tryPlay via', evt, 'rs=', audio.readyState, 'started=', playStarted, url.split('file=')[1])
        if (playStarted) return
        if (audioRef.current !== audio) return  // superseded by a newer play() call
        playStarted = true
        audio.oncanplaythrough = null
        audio.onloadedmetadata = null
        audio.onloadeddata = null
        audio.play().catch(e => { console.error('[audio] play() rejected:', e.name, e.message, url.split('file=')[1]); done('error') })
      }

      audio.onended = () => done('ok')
      audio.onerror = () => { console.error('[audio] onerror', audio.error?.code, audio.error?.message, url.split('file=')[1]); done('error') }
      audio.oncanplaythrough = () => tryPlay('canplaythrough')
      audio.onloadedmetadata = () => {
        // Set playbackRate here (after metadata loads) for iOS compatibility — setting it before src can be ignored
        audio.playbackRate = rate
        tryPlay('loadedmetadata')
      }
      audio.onloadeddata = () => { console.log('[audio] loadeddata rs=', audio.readyState, url.split('file=')[1]); if (audio.readyState >= 2) tryPlay('loadeddata') }

      audio.src = url
      audio.load()
    })
  }, [])

  const playWord = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioWord), EN_BASE * enRate)
  }, [packId, play, enRate])

  const playSentence = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId) return Promise.resolve('ok' as const)
    // EN sentence files are generated at 0.75 speed in ElevenLabs — play at 1.0 so
    // the waveform's own tempo is the only slowdown applied.
    return play(getAudioUrl(packId, word.audioSentence), enRate)
  }, [packId, play, enRate])

  const playWordPl = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId || !word.audioWordPl) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioWordPl), PL_BASE * plRate)
  }, [packId, play, plRate])

  const playSentencePl = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId || !word.audioSentencePl) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioSentencePl), PL_BASE * plRate)
  }, [packId, play, plRate])

  const stop = useCallback(() => {
    // Unblock any pending await playX() in runSequence — it will hit the next
    // `if (cancelled) return` and exit cleanly
    console.log('[audio] stop() called, resolveRef=', !!resolveCurrentRef.current, 'audioRef=', !!audioRef.current)
    if (resolveCurrentRef.current) {
      resolveCurrentRef.current()
      resolveCurrentRef.current = null
    }
    if (audioRef.current) {
      const el = audioRef.current
      audioRef.current = null
      console.log('[audio] stop() killing el, paused=', el.paused, 'time=', el.currentTime.toFixed(2))
      el.pause()
      el.currentTime = 0
      el.src = ''
      el.load()
    }
  }, [])

  const preloadNext = useCallback((words: Word[], currentIndex: number) => {
    if (!packId) return
    const toPreload = [currentIndex + 1, currentIndex + 2]
    const schedule = 'requestIdleCallback' in window
      ? (fn: () => void) => requestIdleCallback(fn)
      : (fn: () => void) => setTimeout(fn, 100)
    schedule(() => {
      toPreload.forEach(i => {
        if (i < words.length) {
          const w = words[i]
          preloadAudio(getAudioUrl(packId, w.audioWord))
          preloadAudio(getAudioUrl(packId, w.audioSentence))
          if (w.audioWordPl) preloadAudio(getAudioUrl(packId, w.audioWordPl))
          if (w.audioSentencePl) preloadAudio(getAudioUrl(packId, w.audioSentencePl))
        }
      })
    })
  }, [packId])

  // Unlock audio playback on iOS Safari by playing + immediately stopping a silent WAV.
  // iOS Safari blocks audio.play() unless it's triggered by a user gesture.
  // Once audio.play() succeeds within a gesture, playback is "unlocked" for the session.
  const unlockAudio = useCallback(() => {
    console.log('[audio] unlockAudio() START')
    // 43-byte minimal WAV header with single silent sample — plays and ends instantly
    const silence = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
    silence.volume = 0
    console.log('[audio] silence element created, about to call play()')
    silence.play()
      .then(() => {
        console.log('[audio] unlockAudio play() SUCCEEDED — audio unlocked')
        silence.pause()
      })
      .catch(e => {
        console.error('[audio] unlockAudio play() FAILED:', e.name, e.message)
      })
  }, [])

  return { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext, unlockAudio }
}
