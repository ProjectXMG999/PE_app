import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio, stopAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

export function useAudio(packId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

  const EN_RATE = 0.85  // EN slightly slower for comprehension
  const PL_RATE = 1.0

  const play = useCallback((url: string, rate = 1.0): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      const audio = new Audio(url)
      audio.playbackRate = rate
      audioRef.current = audio
      playingRef.current = true

      audio.onended = () => {
        playingRef.current = false
        resolve()
      }
      audio.onerror = () => {
        playingRef.current = false
        reject(new Error('audio error'))
      }
      audio.play().catch(err => {
        playingRef.current = false
        reject(err)
      })
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
    stopAudio()
  }, [])

  const preloadNext = useCallback((words: Word[], currentIndex: number) => {
    if (!packId) return
    const toPreload = [currentIndex + 1, currentIndex + 2]
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        toPreload.forEach(i => {
          if (i < words.length) {
            preloadAudio(getAudioUrl(packId, words[i].audioWord))
            preloadAudio(getAudioUrl(packId, words[i].audioSentence))
          }
        })
      })
    }
  }, [packId])

  return { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext }
}
