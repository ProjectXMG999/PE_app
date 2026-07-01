import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

export function useAudio(packId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Resolver for the currently pending play() promise — lets stop() unblock awaits
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  const EN_RATE = 0.65
  const PL_RATE = 1.0

  const play = useCallback((url: string, rate = 1.0): Promise<'ok' | 'timeout' | 'error'> => {
    return new Promise((resolve) => {
      // Stop previous audio WITHOUT resolving its promise via resolveCurrentRef —
      // the previous promise was already resolved (sequence moves linearly).
      // We only need to kill the DOM element.
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }

      const audio = new Audio()
      audio.playbackRate = rate
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
      // oncanplaythrough + onloadeddata both triggering on cached files
      let playStarted = false
      const tryPlay = () => {
        if (playStarted) return
        playStarted = true
        audio.oncanplaythrough = null
        audio.onloadeddata = null
        audio.play().catch(() => done('error'))
      }

      audio.onended = () => done('ok')
      audio.onerror = () => done('error')
      audio.oncanplaythrough = tryPlay
      audio.onloadeddata = () => { if (audio.readyState >= 3) tryPlay() }

      audio.src = url
      audio.load()
    })
  }, [])

  const playWord = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioWord), EN_RATE)
  }, [packId, play])

  const playSentence = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioSentence), EN_RATE)
  }, [packId, play])

  const playWordPl = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId || !word.audioWordPl) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioWordPl), PL_RATE)
  }, [packId, play])

  const playSentencePl = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId || !word.audioSentencePl) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioSentencePl), PL_RATE)
  }, [packId, play])

  const stop = useCallback(() => {
    // Unblock any pending await playX() in runSequence — it will hit the next
    // `if (cancelled) return` and exit cleanly
    if (resolveCurrentRef.current) {
      resolveCurrentRef.current()
      resolveCurrentRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
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

  return { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext }
}
