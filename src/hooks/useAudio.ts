import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

export function useAudio(packId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

  const EN_RATE = 0.85
  const PL_RATE = 1.0

  const play = useCallback((url: string, rate = 1.0): Promise<void> => {
    return new Promise((resolve) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      const audio = new Audio(url)
      audio.playbackRate = rate
      audioRef.current = audio
      playingRef.current = true

      const timeoutId = setTimeout(() => {
        playingRef.current = false
        audio.pause()
        if (audioRef.current === audio) audioRef.current = null
        resolve()
      }, 8000)

      const cleanup = () => {
        clearTimeout(timeoutId)
        playingRef.current = false
        if (audioRef.current === audio) audioRef.current = null
      }

      audio.onended = () => { cleanup(); resolve() }
      audio.onerror = () => { cleanup(); resolve() }
      audio.play().catch(() => { cleanup(); resolve() })
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
    if (audioRef.current) {
      audioRef.current.pause()
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
