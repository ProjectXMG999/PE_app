import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'

const EN_BASE = 0.70
const PL_BASE = 1.0

// enRate/plRate are multipliers: 1.0 = default speed, 0.5 = half, 1.5 = faster
export function useAudio(packId: string | null, enRate = 1.0, plRate = 1.0) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Resolver for the currently pending play() promise — lets stop() unblock awaits
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  // Initialize persistent audio element on first use
  const ensureAudio = useCallback(() => {
    if (!audioRef.current && typeof document !== 'undefined') {
      const el = document.createElement('audio')
      el.crossOrigin = 'anonymous'
      el.style.display = 'none'
      document.body.appendChild(el)
      audioRef.current = el
    }
    return audioRef.current
  }, [])

  const play = useCallback((url: string, rate = 1.0): Promise<'ok' | 'timeout' | 'error'> => {
    return new Promise((resolve) => {
      const filename = url.split('file=')[1] || url.split('/').pop() || 'unknown'
      const audio = ensureAudio()
      if (!audio) {
        console.error('[audio] no audio element available')
        resolve('error')
        return
      }

      console.log('[audio] play() filename=', filename, 'rate=', rate)

      let resolved = false
      const done = (result: 'ok' | 'timeout' | 'error' = 'ok') => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolveCurrentRef.current = null
        resolve(result)
      }

      resolveCurrentRef.current = () => done('ok')
      const timeoutId = setTimeout(() => done('timeout'), 10000)

      let playStarted = false
      const tryPlay = (evt?: string) => {
        console.log('[audio] tryPlay via', evt, 'rs=', audio.readyState, 'started=', playStarted, 'filename=', filename)
        if (playStarted) return
        playStarted = true
        audio.oncanplaythrough = null
        audio.onloadedmetadata = null
        audio.onloadeddata = null
        console.log('[audio] calling play() from', evt)
        audio.play()
          .then(() => {
            console.log('[audio] play() SUCCEEDED from', evt)
          })
          .catch(e => {
            console.error('[audio] play() rejected from', evt, '— error:', e.name, e.message, 'filename:', filename)
            console.error('[audio] play() stack:', new Error().stack)
            done('error')
          })
      }

      audio.onended = () => {
        console.log('[audio] onended')
        done('ok')
      }
      audio.onerror = () => {
        console.error('[audio] onerror', audio.error?.code, audio.error?.message, 'filename:', filename)
        done('error')
      }
      audio.oncanplaythrough = () => tryPlay('canplaythrough')
      audio.onloadedmetadata = () => {
        audio.playbackRate = rate
        tryPlay('loadedmetadata')
      }
      audio.onloadeddata = () => {
        console.log('[audio] loadeddata rs=', audio.readyState, 'filename=', filename)
        if (audio.readyState >= 2) tryPlay('loadeddata')
      }

      audio.src = url
      audio.load()
    })
  }, [ensureAudio])

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
    console.log('[audio] stop() called')
    if (resolveCurrentRef.current) {
      resolveCurrentRef.current()
      resolveCurrentRef.current = null
    }
    if (audioRef.current) {
      const el = audioRef.current
      console.log('[audio] stop() pausing audio')
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

  return { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext }
}
