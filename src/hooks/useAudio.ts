import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

export function useAudio(packId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  // Holds the done() resolver of the currently pending play() promise so stop()
  // can resolve it immediately instead of leaving it hanging until onended fires
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  const EN_RATE = 0.85
  const PL_RATE = 1.0

  const play = useCallback((url: string, rate = 1.0): Promise<void> => {
    return new Promise((resolve) => {
      // Hard-stop any previous audio before starting new one
      if (resolveCurrentRef.current) {
        resolveCurrentRef.current()
        resolveCurrentRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }

      const audio = new Audio()
      audio.playbackRate = rate
      audioRef.current = audio
      playingRef.current = true

      // Single-fire guard — done() is idempotent
      let resolved = false
      const done = () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolveCurrentRef.current = null
        playingRef.current = false
        if (audioRef.current === audio) audioRef.current = null
        resolve()
      }

      resolveCurrentRef.current = done

      // Safety net — if audio never ends or loads, move on after 10s
      const timeoutId = setTimeout(done, 10000)

      // Single-fire guard — only one audio.play() call regardless of which
      // event fires first (oncanplaythrough vs onloadeddata)
      let playStarted = false
      const tryPlay = () => {
        if (playStarted) return
        playStarted = true
        audio.oncanplaythrough = null
        audio.onloadeddata = null
        audio.play().catch(done)
      }

      audio.onended = done
      audio.onerror = done
      audio.oncanplaythrough = tryPlay
      audio.onloadeddata = () => {
        if (audio.readyState >= 3) tryPlay()
      }

      audio.src = url
      audio.load()
    })
  }, [])

  const playWord = useCallback((word: Word) => {
    if (!packId) return Promise.resolve()
    return play(getAudioUrl(packId, word.audioWord), EN_RATE)
  }, [packId, play])

  const playSentence = useCallback((word: Word) => {
    if (!packId) return Promise.resolve()
    return play(getAudioUrl(packId, word.audioSentence), EN_RATE)
  }, [packId, play])

  const playWordPl = useCallback((word: Word) => {
    if (!packId || !word.audioWordPl) return Promise.resolve()
    return play(getAudioUrl(packId, word.audioWordPl), PL_RATE)
  }, [packId, play])

  const playSentencePl = useCallback((word: Word) => {
    if (!packId || !word.audioSentencePl) return Promise.resolve()
    return play(getAudioUrl(packId, word.audioSentencePl), PL_RATE)
  }, [packId, play])

  const stop = useCallback(() => {
    // Resolve pending play() promise immediately — unblocks any awaiting sequence
    if (resolveCurrentRef.current) {
      resolveCurrentRef.current()
      resolveCurrentRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    playingRef.current = false
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
