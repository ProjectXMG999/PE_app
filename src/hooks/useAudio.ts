import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio, stopAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

export function useAudio(packId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

  const play = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      const audio = new Audio(url)
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
    const url = getAudioUrl(packId, word.audioWord)
    return play(url)
  }, [packId, play])

  const playSentence = useCallback((word: Word) => {
    if (!packId) return Promise.resolve()
    const url = getAudioUrl(packId, word.audioSentence)
    return play(url)
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

  return { playWord, playSentence, stop, preloadNext }
}
